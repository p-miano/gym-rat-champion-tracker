# 🏋️ Atletas com Dorflex

> Placar anual bem-humorado do grupo **"Atletas com Dorflex"** — um app que consome os exports do **Gym Rats**, calcula o campeão e o "Cliente Ouro" (lanterna) de cada mês, mantém o ranking do ano e distribui conquistas sarcásticas para cada atleta.

**Stack:** Lovable (React + TanStack Start + Tailwind CSS) · Lovable Cloud (PostgreSQL + RLS + Auth) · TypeScript estrito · Deploy edge (Cloudflare Workers).

---

## Índice

1. [📥 Fluxo de Ingestão de Dados (O papel do Administrador)](#-fluxo-de-ingestão-de-dados-o-papel-do-administrador)
2. [📊 Regras de Negócio & Classificação de Atividade Diária](#-regras-de-negócio--classificação-de-atividade-diária)
3. [🏆 Conquistas / Badges (Gamificação)](#-conquistas--badges-gamificação)
4. [📱 Funcionalidades do Aplicativo](#-funcionalidades-do-aplicativo)
5. [🔐 Segurança, RLS & Privacidade (LGPD)](#-segurança-rls--privacidade-lgpd)
6. [🛠️ Stack Tecnológica](#️-stack-tecnológica)
7. [🚀 Setup local](#-setup-local)

---

## 📥 Fluxo de Ingestão de Dados (O papel do Administrador)

A aplicação **não coleta** treinos diretamente: ela depende de um pipeline de ingestão manual operado por um Administrador autenticado. Esse design mantém a fonte da verdade no Gym Rats e evita acoplamento com APIs privadas de terceiros.

### 1. Origem dos dados — Gym Rats

Toda performance bruta (atletas, check-ins, fotos, reações, geolocalização aproximada, durações, distâncias e sub-atividades) vem do **Gym Rats**, plataforma onde o grupo registra os treinos do desafio mensal. O Gym Rats expõe um **export JSON** por grupo/mês contendo:

- `id`, `name` — identificação do grupo/desafio
- `members[]` — atletas participantes
- `check_ins[]` — todos os treinos do período, com `activity_type`, `duration_millis`, `distance_miles`, `details.location_latitude/longitude`, `photo_url`, `reactions[]`, `check_in_activities[]` (sub-atividades por plataforma)

### 2. Processo de ingestão — botão "Importar"

O Administrador autenticado acessa a rota **`/importar`** (link "Importar" visível no header em telas desktop; também acessível pela barra inferior no mobile):

1. Faz **upload (drag-and-drop ou file picker)** do arquivo JSON exportado do Gym Rats.
2. A app valida superficialmente o payload (`id`, `members`, `check_ins`) e mostra um **preview** com: nome do desafio, ano/mês inferidos, total de atletas, total de check-ins, válidos e flagrados.
3. O Admin informa o **código de convite do grupo Gym Rats** (4–32 caracteres alfanuméricos) — esse código fica salvo em `valid_group_codes` e passa a liberar a entrada de novos atletas no onboarding.
4. Confirma → o backend recebe o payload via `createServerFn` em [`src/lib/import.functions.ts`](src/lib/import.functions.ts).

### 3. Processamento no backend (`importMonth`)

A server function `importMonth` (protegida por `requireSupabaseAuth` + verificação `has_role('admin')`) executa atomicamente:

| Etapa | O que faz |
|---|---|
| **Parse** | `parseExport()` ([`src/lib/gymrats-parser.ts`](src/lib/gymrats-parser.ts)) normaliza datas (TZ `America/Sao_Paulo`), converte milhas→km, milissegundos→minutos, infere `activity_type` por regex, extrai reações, **trunca GPS para 2 casas decimais (~1.1 km)** para nunca persistir precisão de rua. |
| **Upsert do mês** | `months` por `(year, month)` — reimportar sobrescreve. |
| **Registro do grupo** | `valid_groups` + `valid_group_codes` (libera onboarding). |
| **Upsert de atletas** | `athletes` por `gymrats_id` (preserva `id` interno e relações). |
| **Substituição de check-ins** | `DELETE` + `UPSERT` em lotes de 200 em `check_ins`. |
| **Recálculo do mês** | `rankingFromCheckIns()` recalcula `month_results` (rank, dias ativos, minutos, km, `is_winner`, `is_last`). |
| **Recálculo do ano** | `recomputeAwardsForYear()` apaga e reinsere `annual_awards` rodando a engine de conquistas sobre o ano inteiro. |

> Botão extra **"Recalcular conquistas do ano"** permite re-rodar a engine sem reimportar JSON — útil após mudanças na lógica de classificação.

---

## 📊 Regras de Negócio & Classificação de Atividade Diária

### Normalização dos check-ins (`parseCheckIn`)

- **Duração:** `duration` (min) ou `duration_millis / 60000` arredondado.
- **Distância:** `distance_miles × 1.609344` com 3 casas decimais.
- **Activity type:** usa `activity_type` nativo → `check_in_activities[0].platform_activity` → fallback regex em título/descrição (corrida, caminhada, pilates, bike, yoga, musculação, funcional/crossfit/hiit, natação, alongamento, LPO).
- **GPS:** truncado para 2 casas decimais antes de salvar (privacidade).
- **Reações:** extraídas como array de strings de emoji.
- **Validação:** atualmente **todo check-in importado conta** (alinhado ao Gym Rats — `is_valid = true` por padrão). A infraestrutura para flags de invalidade existe mas está desligada.

### Dia ativo — a métrica primária

A métrica que **decide ranking mensal e consistência** é **Dias Ativos** (`active_days`): número de **datas distintas** (TZ `America/Sao_Paulo`) em que o atleta registrou pelo menos um check-in válido. Volume de check-ins, minutos e km existem apenas como **desempate** ou enriquecimento de perfil — não como ranking primário.

### Agregação por dia (merge de check-ins do mesmo dia)

Quando o atleta registra **múltiplos check-ins ou sub-atividades de plataforma na mesma data**, o sistema **mescla todos eles antes de avaliar o perfil daquele dia**:

1. Agrupa por `(athlete_id, data_local_TZ_São_Paulo)`.
2. Para cada check-in do dia, distribui `duration_millis` (incluindo o de cada `check_in_activities[i]`) nos buckets de classificação.
3. **Soma os minutos por bucket no dia inteiro** — não conta "1 check-in = 1 categoria"; conta **tempo total executado em cada categoria naquele dia**.

### Critério de Predominância (1 dia = 1 bucket exclusivo)

Cada **data** recebe **exatamente uma** classificação exclusiva dentre:

- **`strength`** — `weightlifting`, `lpo`, `functional_strength_training`, ou texto casando `musculação`, `treino de força`, `supino`, `agachamento`, `peito/costas/ombro/bíceps/tríceps/perna`, etc.
- **`cardio`** — `running`, `walking`, `cycling`, `swimming`, `treadmill`, `elliptical`, `rowing`, `hiit`, `dance`, `circuit_training`, `functional_training` ou texto (`corrida`, `esteira`, `pedal`, `bike`, `cardio`, `wod`, `crossfit`…).
- **`sport`** — esportes coletivos/individuais (`surf`, `escalada`, `futebol`, `basquete`, `vôlei`, `tênis`, `boxe`, `jiu-jitsu`, `mma`, etc.).
- **`mobility`** — `pilates`, `yoga`, `stretching`, `flexibility`, `mobility` ou texto (`alongamento`, `mobilidade`, `liberação miofascial`, `recovery`…).
- **`other`** — quando nada acima casa.

A predominância é decidida pelo **bucket que acumulou mais minutos ativos naquela data específica** (após o merge descrito acima).

### Hierarquia fixa de desempate

Se dois ou mais buckets terminarem o dia com **exatamente a mesma duração total**, vence o primeiro da hierarquia:

```
strength  >  cardio  >  sport  >  mobility  >  other
```

Essa ordem é fixa e determinística — não depende de ordem de inserção nem do tipo do primeiro check-in do dia.

### Detecção `isOutdoor`

Tipos indoor (`treadmill`, `indoor_cycling`, `elliptical`, `stationary_bike`, `spinning`, `rowing_machine`, `stair_climber`) **forçam indoor**. Tipos `running/walking/cycling/hiking/surfing` forçam outdoor. Caso contrário, **descrição tem precedência sobre o título**, e marcadores de força (`musculação`, `supino`…) eliminam outdoor antes de testar `parque|praça|praia|trilha|mato|ar livre|natureza`.

### Ranking mensal (`rankingFromCheckIns`)

Para cada atleta no mês:

```
active_days      = nº de dias distintos (TZ São Paulo) com pelo menos 1 check-in válido  ← métrica primária
total_checkins   = soma de check-ins
total_minutes    = soma de duration_min
total_distance   = soma de distance_km (2 casas)
```

**Ordenação:** `active_days DESC` → desempate por `total_minutes DESC`.
**Rank:** posições com empate compartilham a colocação (1, 1, 3…).
**`is_winner`:** todos os que empataram com o maior `active_days` (se > 0).
**`is_last`:** todos os que empataram com o menor `active_days` (Cliente Ouro do Dorflex 🥇💸).

### Bolada acumulada (regra do grupo)

Calculada em [`src/lib/data.functions.ts`](src/lib/data.functions.ts):

```
pot = R$10 × meses_importados × atletas_distintos  +  R$10 × total_de_lanternas
```

Tradução: cada atleta entra com **R$10/mês**, e cada vez que alguém é lanterna paga **mais R$10** de multa. Quem vencer mais meses leva a bolada inteira — o resto paga R$10, o lanterna paga R$20 e passa vergonha.

---

## 🏆 Conquistas / Badges (Gamificação)

Recalculadas anualmente por `computeAwards()` em [`src/lib/awards.ts`](src/lib/awards.ts). Cada prêmio escolhe **um único vencedor** (`topByScore`) com critérios de desempate específicos. **Não existe subpágina dedicada de conquistas** — o grid completo é renderizado direto no **Placar** (`/`).

| Badge | Critério | Desempate |
|---|---|---|
| **`rust_enemy`** (Inimigo da Ferrugem) | Maior nº de dias classificados como `mobility` (pilates, yoga, alongamento, mobilidade). | Total de dias ativos no ano. |
| **`influencer`** | Maior nº total de **reações recebidas** somando todos os check-ins. | Dias ativos. |
| **`bodybuilding_beast`** (Monstro do Ferro) | Maior nº de dias `strength`. | Total de minutos no ano. |
| **`cardio_king`** | Maior nº de dias `cardio`. | Total de km no ano. |
| **`nature_lover`** | Maior nº de check-ins `isOutdoor === true`. | Dias ativos. |
| **`no_borders`** (Sem Fronteiras) | Maior nº de check-ins **fora da área usual**: identifica o cluster GPS dominante (grid de ~5 km) e conta check-ins a **mais de 30 km de raio** desse centro (Haversine). Exige ≥ 3 check-ins com GPS. | Dias ativos. |
| **`wod_comedian`** | Maior nº de reações **😂** recebidas em check-ins. | — |
| **`mile_eater`** (Devorador de Quilômetros) | Maior soma de `distance_km` no ano. | — |
| **`phoenix`** | Maior nº de "renascimentos": qualquer hiato **≥ 21 dias entre dois check-ins válidos** seguido por **3 semanas com pelo menos 3 dias ativos cada** dentro dos 21 dias subsequentes. | Dias ativos. |
| **`night_owl`** (Coruja) | Maior nº de check-ins com hora local (TZ São Paulo) **≥ 22h**. | — |

> O badge `early_bird` foi removido da engine anual e virou um **perfil dinâmico** exibido no perfil individual do atleta.

Todos os scores precisam ser **> 0** para gerar vencedor — em meses fracos o badge pode ficar **bloqueado** (locked state).

---

## 📱 Funcionalidades do Aplicativo

### 🏟️ Placar (`/`)
Página inicial pública e dashboard principal do app. Concentra:

- **Pódio anual** (top 3 do ano corrente, baseado em **Dias Ativos**).
- **Bolada estimada** (R$ acumulados) e contagem de **Clientes Ouro** (lanternas).
- Resumo do desafio em tom bem-humorado.
- **Grid unificado das 10 conquistas anuais** — renderizado diretamente aqui (não há rota/subpágina dedicada). O grid é **totalmente reativo**:
  - Mostra o **atleta líder atual** de cada badge, ou um **estado bloqueado** quando nenhum atleta tem score > 0.
  - **Hover/click** em cada card revela a **lógica subjacente**, a **métrica calculada** (`details` retornados por `computeAwards`) e os **desempates específicos** do prêmio.

### 📅 Meses (`/meses` e `/meses/$id`)
- **Lista** cronológica de todos os meses já importados, com campeão e lanterna de cada um.
- **Detalhe do mês:** ranking completo (`month_results`) ordenado por **Dias Ativos**, feed de check-ins validados, indicadores consolidados (dias ativos, minutos, km, total de check-ins) e tags por categoria predominante.

### 👥 Atletas (`/atletas` e `/atletas/$id`)
- **Diretório** completo dos atletas do grupo.
- **Perfil individual:** stats acumulados, histórico de consistência (heatmap mensal de dias ativos), status de identidade reivindicada (claimed via onboarding) e perfil dinâmico (early bird / coruja / equilibrado).

### 📥 Importar (`/importar`) — somente Admin
Painel administrativo descrito acima. Bloqueado por `requireSupabaseAuth` + `has_role('admin')`. Inclui ação separada de **"Recalcular conquistas do ano"**.

### 🔓 Onboarding (`/onboarding`)
Atleta autenticado informa o **código de convite** do grupo Gym Rats e reivindica sua identidade na lista de membros importados. Sem código válido, o usuário permanece como visitante.

---

## 🔐 Segurança, RLS & Privacidade (LGPD)

A app opera com **arquitetura de dois mundos** sobre os mesmos dados:

### 🟢 Visitante público (não autenticado)

Camada de anonimização em [`src/lib/anonymize.ts`](src/lib/anonymize.ts):

- **Nomes substituídos** deterministicamente por um pool de **30 primeiros nomes brasileiros** (`Lucas, Maria, Gabriel, Ana, Matheus, Julia, Felipe, Yasmin, Guilherme, Vitória, Rafael, Larissa, Daniel, Bruna, Gustavo, Camila, Pedro, Letícia, João, Jéssica, Thiago, Carolina, Leonardo, Mariana, Bruno, Amanda, Vinícius, Beatriz, Rodrigo, Isabela`) via **hash criptográfico estável** do `athlete.id` — o mesmo atleta sempre cai no mesmo placeholder, sem expor identidade.
- **Avatares:** apenas **iniciais coloridas** (HSL determinístico) — **nunca a foto do Google**, e a foto do Gym Rats só aparece quando o atleta optou explicitamente por `show_google_photo = true` no onboarding.
- **Fotos dos check-ins (selfies de academia, foto do espelho, etc.):** **completamente suprimidas** das views públicas.
- **Seleção explícita de colunas:** as queries públicas filtram colunas no `SELECT` para **nunca trazer** `check_ins.raw` (payload original do Gym Rats), GPS preciso ou identidade real.

Modos de exibição configuráveis por atleta: `placeholder` (default), `nickname` (apelido público), `real` (nome real liberado).

### 🔒 Membro autenticado (Google Auth + código de grupo válido)

Acesso liberado **somente** após:
1. Login Google via Supabase Auth.
2. Onboarding completo: matching de **código de convite** contra `valid_group_codes` (alimentado pela ingestão).
3. Reivindicação de identidade na lista `athletes`.

Para esses usuários, **Row-Level Security do PostgreSQL** libera:
- `check_ins.raw` (payload original do Gym Rats),
- coordenadas GPS (mesmo truncadas, só visíveis a membros),
- fotos reais dos check-ins,
- nome real dos atletas (override do Google avatar pela foto oficial do Gym Rats).

### Camadas técnicas de segurança

| Camada | Implementação |
|---|---|
| **Auth** | Supabase Auth (Google OAuth). Sessão em `localStorage` no client, JWT propagado para server functions por `attachSupabaseAuth`. |
| **RLS** | Habilitada em **todas** as tabelas públicas. Policies usam `auth.uid()` e `public.has_role(uid, 'admin')` (SECURITY DEFINER) para evitar recursão. |
| **Roles** | Tabela separada `user_roles` + enum `app_role` (`admin`, `user`). **Nunca** roles no profile — previne escalação de privilégio. |
| **Server functions privilegiadas** | `requireSupabaseAuth` + checagem de role antes de carregar `supabaseAdmin` (service role) **dentro do handler** — nunca em escopo de módulo. |
| **GPS** | Truncado a 2 casas decimais (`~1.1 km`) já no parser — precisão de rua nunca chega ao banco. |
| **Códigos de grupo** | Sanitizados (`/[^A-Z0-9]/g`), 4–32 chars, validados no server. |
| **Anonimização determinística** | Hash criptográfico do `athlete.id` mapeia para placeholder estável — visitantes públicos veem o mesmo pseudônimo entre sessões sem nunca acessar o nome real. |

### Conformidade LGPD

- Dado pessoal (nome, foto, geolocalização) é **opt-in granular** via `display_mode` e `show_google_photo`.
- Visitante anônimo nunca recebe PII — nem por payload, nem por coluna vazada em `SELECT *`.
- Atleta pode escolher `placeholder` e desaparecer publicamente sem perder o histórico interno do grupo.
- Backend (Lovable Cloud) hospedado em PostgreSQL gerenciado com RLS por padrão.

---

## 🛠️ Stack Tecnológica

### Backend — Lovable Cloud
- **PostgreSQL** gerenciado.
- **Row-Level Security** em todas as tabelas (`annual_awards`, `athletes`, `check_ins`, `month_results`, `months`, `profiles`, `user_roles`, `valid_group_codes`, `valid_groups`).
- **Funções `SECURITY DEFINER`** (`has_role`, `handle_new_user`) com `search_path` fixo.
- **Auth:** Google OAuth.
- **Storage:** não utilizado (fotos vêm dos URLs do Gym Rats).
- **Server logic:** `createServerFn` do TanStack Start (edge — Cloudflare Workers via `nodejs_compat`), **sem edge functions Supabase**.

### Frontend — Lovable
- **TanStack Start v1** (React 19, file-based routing em `src/routes/`).
- **TanStack Query** para data loading (loaders + `useSuspenseQuery`).
- **Tailwind CSS v4** (tokens semânticos em `src/styles.css`, dark theme nativo).
- **shadcn/ui** como base de componentes.
- **Vite 7** como bundler.
- **TypeScript estrito**.

### Design responsivo
- **Desktop:** header superior com navegação completa (`Placar`, `Meses`, `Atletas`, `Importar` para Admin).
- **Mobile:** header enxuto + **bottom tab bar fixa** ([`src/components/bottom-nav.tsx`](src/components/bottom-nav.tsx)) com ícones e labels para todas as rotas principais. Renderização condicional baseada em viewport no `__root.tsx`.

---

## 🚀 Setup local

```bash
bun install
bun dev
```

Acesse `http://localhost:8080`. Banco e auth já vêm provisionados via Lovable Cloud (variáveis em `.env` gerenciadas automaticamente). Para importar dados, faça login com a conta de **Admin** (promovida automaticamente por `handle_new_user`) e use `/importar`.

---

> Feito com 💪, 😂 e uma pitada de Dorflex.
