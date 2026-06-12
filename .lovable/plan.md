
# 🏋️‍♂️ Atletas com Dorflex — Placar Anual

App web em **tom zoeira de grupo de WhatsApp** que importa JSONs exportados do Gym Rats mês a mês, calcula o vencedor mensal por **dias ativos**, mantém o ranking anual (quem foi #1 mais vezes leva a bolada), expõe o lanterna do Dorflex e monta uma **ficha técnica estilo RPG maromba** para cada atleta.

## Stack & Persistência

- TanStack Start (já configurado) + Tailwind + shadcn/ui + Recharts
- **Lovable Cloud** (Postgres) para meses, atletas, check-ins e resultados
- **Login**: e-mail/senha + Google (Lovable Cloud). Só admin importa; placar/perfis são públicos
- **Visual**: dark nativo, paleta **verde-limão (#B6FF1A-ish) + preto/cinza-grafite**, vibe academia de bairro/ferro velho, emojis, microcopy ácido em PT-BR, alta scannability (tabelas densas, badges, números grandes)

## Modelo de Dados

```text
profiles            id (uuid auth), full_name, is_admin
months              id, year, month, name, source_id, imported_at, created_by
athletes            id, gymrats_id (UNIQUE), full_name, profile_picture_url
check_ins           id, month_id, athlete_id,
                    occurred_at (timestamptz),
                    duration_min int, distance_km numeric,
                    location_latitude numeric, location_longitude numeric,
                    location_name text,
                    has_photo bool, photo_url,
                    title, description, activity_type,
                    reactions text[],          -- ["😂","🔥"]
                    is_valid bool,
                    invalid_reasons text[],    -- ["no_photo","short_duration","short_distance"]
                    raw jsonb                  -- backup do check-in original
month_results       month_id, athlete_id,
                    active_days, total_checkins, total_minutes,
                    rank int, is_winner bool, is_last bool
                    PRIMARY KEY(month_id, athlete_id)
annual_awards       year, athlete_id, award_key, details jsonb, computed_at
                    PRIMARY KEY(year, athlete_id, award_key)
```

**RLS**: leitura pública em tudo (placar é do grupo); INSERT/UPDATE/DELETE só para `is_admin = true` (checagem via tabela `user_roles` + função `has_role` security-definer, conforme padrão Lovable).

## Parser (`src/lib/gymrats-parser.ts`) — funções puras

Entrada: shape `{ id, name, members, check_ins, start_date, end_date }`.

Transformações:
- `distance_miles` vem como string com vírgula decimal (`"3,3"`). Parser: `Number(str.replace(",", "."))` → milhas → `* 1.609344` → `distance_km`. Tratar `null`/vazio.
- `duration` (minutos, já em int) → `duration_min`. Quando ausente, derivar de `duration_millis / 60000`.
- `details.location_latitude/longitude` (strings) → numeric.
- `location_name`: a partir do título/descrição quando disponível; caso contrário `null`.
- `has_photo = photo_url != null`.
- `reactions`: extrair array de emojis (string) do campo `reactions[]` do check-in.
- `activity_type`: usar `activity_type` se presente, senão inferir de `check_in_activities[].platform_activity` (ex.: `treadmill`, `running`, `pilates`), senão extrair palavras-chave do título.
- `occurred_at`: ISO timestamp UTC; agrupamentos por dia usam timezone fixa `America/Sao_Paulo`.

## Validação de Regras (Sinalizar, Não Descartar)

`is_valid` calculado, mas **todos** os check-ins são gravados. Razões:
- `no_photo` — sem foto (regra mais rígida do grupo)
- `short_duration` — `duration_min < 30` **e** não é corrida/caminhada com `distance_km ≥ 3`
- `short_distance` — atividade for corrida/caminhada com `distance_km < 3`

> Inválidos não contam para `active_days`, mas aparecem em todas as telas com badge vermelho e o motivo.

## Cálculo Mensal

- `active_days` = nº de dias distintos (TZ SP) com pelo menos 1 check-in **válido**.
- Ranking decrescente por `active_days`; **empates no topo compartilham o 1º lugar** (todos marcados `is_winner = true`, todos contam +1 vitória no anual).
- Último colocado: `is_last = true` → marcado como **💊 Cliente Ouro do Dorflex** (paga R$ 20).
- Persistido em `month_results` ao importar e recalculado em re-importação.

## Ranking Anual

- Soma de vitórias mensais por atleta.
- Top 3 no pódio (1º grandão, 2º e 3º).
- **Bolada estimada** = `10 × meses_importados × participantes_distintos + 10 × total_de_lanternas` (cada lanterna agrega +R$10 extra).

## Engine de Prêmios (`src/lib/awards.ts`) — funções puras

Calcula sobre todos os check-ins do ano e grava em `annual_awards`. Cada prêmio escolhe **1 vencedor** (com critério de desempate) e renderiza uma frase aleatória de `src/lib/jokes.ts`.

| Key | Título | Lógica |
|---|---|---|
| `voucher_limit` | ⚖️ No Limite do Voucher | Atleta com maior nº de semanas em que fez **exatamente 3** dias ativos (cumpriu a meta no talo, sem dar 1 a mais) |
| `calendar_cheater` | 🃏 Burleiro de Calendário | Maior nº de "blocos comprimidos": ≥3 treinos em ≤4 dias consecutivos seguidos de hiato de ≥4 dias na mesma semana ISO |
| `dorflex_sponsor` | 💸 Patrocinador Oficial | Mais vezes em `is_last = true` |
| `flexible_iron` | 🧘‍♂️ Maromba Flexível / Pilateiro de Respeito | Mais check-ins cujo `activity_type` ou título casa `/pilates|lpo|levantamento/i` |
| `no_borders` | ✈️ Fitness Sem Fronteiras | Mais check-ins fora do "QG" (≥ 50 km do centroide pessoal de lat/lng) |
| `wod_comedian` | 😂 Humorista do WOD | Mais reações 😂 acumuladas em check-ins próprios |
| `hypochondriac` | 🩺 Hipocondríaco / Sobrevivente | Mais ocorrências em título/descrição de `/sinusite|laringite|dorflex|virose|quase morri|gripado|lesão|lesionado/i` |
| `mile_eater` | 🏃‍♀️ Papa-Milhas | Maior soma `distance_km` |
| `phoenix` | 🔥 A Fênix | Voltou após hiato ≥ 21 dias e emendou ≥ 3 semanas seguidas cumprindo a meta de 3 dias |
| `early_bird` | 🌅 Madrugador (Psicopata das 5h) | Mais treinos com hora local < 07:00 |
| `night_owl` | 🦉 Corujão | Mais treinos com hora local ≥ 22:00 |

Empate: maior `active_days` total no ano; persistindo o empate, ambos recebem o prêmio.

## Páginas (rotas TanStack)

- `/` — **Hall da Fama Anual**: pódio, contador de meses, **Bolada Estimada**, último campeão, lanterna atual, atalho para "Por que perdi de novo?".
- `/meses` — lista dos meses fechados com campeão(ões) e lanterna.
- `/meses/$id` — **Detalhe do mês**: tabela de classificação (dias ativos, treinos, minutos, distância), prêmios do mês, lista de check-ins por atleta com badges de inválido + reações + foto.
- `/atletas/$id` — **Ficha Técnica & Prontuário (RPG Maromba)**:
  - 📊 **DNA Maromba**: pizza Recharts da distribuição de `activity_type`. Se >80% musculação → tag "Monstro da Academia de Bairro"; alta taxa de Pilates/Alongamento → "Alongado & Flexível (Até Demais)".
  - 📍 **Habitat Natural (QG)**: cluster mais frequente de lat/lng + `location_name` mais usado.
  - 🏆 **Estante de Badges**: grid visual com todos os prêmios anuais conquistados.
  - 🩺 **Histórico Clínico**: dias ativos totais, média de min/treino, total invalidado por falta de foto, distância total, vitórias mensais.
  - Gráfico de barras: dias ativos por mês.
- `/importar` — **Dashboard do Admin**: drag & drop do JSON, preview (membros detectados, nº de check-ins, faixa de datas), warnings de validação, botão **Salvar (sobrescreve se mês já existe)**.
- `/auth` — login (e-mail/senha + Google).

## Server Functions (`src/lib/*.functions.ts`)

- `importMonth({ payload })` — admin only; parse + upsert atletas + replace check-ins + recalc `month_results`.
- `listMonths()` / `getMonth(id)` / `listAthletes()` / `getAthlete(id)`.
- `getAnnualStanding(year)` — pódio, bolada, vitórias por atleta.
- `recomputeAwards(year)` — roda engine e popula `annual_awards`.

Todas as leituras públicas usam `supabaseAdmin` (dentro do handler) projetando apenas colunas seguras. Mutações usam `requireSupabaseAuth` + checagem `has_role('admin')`.

## Entrega em Fases

1. Cloud + schema + RLS + roles + tela `/auth` + seed admin
2. Parser puro + testes mentais nos JSONs de abril/maio + tela `/importar`
3. Cálculo mensal + `/meses` + `/meses/$id` com badges de inválido
4. Hall da Fama `/` + ranking anual + bolada
5. Ficha do atleta `/atletas/$id` (DNA Maromba, QG, Histórico Clínico)
6. Engine de prêmios + Estante de Badges + pool de zoeira em `jokes.ts`
