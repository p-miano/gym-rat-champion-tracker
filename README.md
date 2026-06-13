# 🏋️ Atletas com Dorflex

> Placar anual bem-humorado do grupo **"Atletas com Dorflex"** — um app que consome os exports do **Gym Rats**, calcula o campeão e o "Cliente Ouro" (lanterna) de cada mês, mantém o ranking do ano e distribui conquistas sarcásticas para cada atleta.

**Stack:** Lovable (React + TanStack Start + Tailwind CSS) · Lovable Cloud (PostgreSQL + RLS + Auth) · TypeScript estrito · Deploy edge (Cloudflare Workers).

---

## Índice

1. [📥 Fluxo de Ingestão de Dados (O papel do Administrador)](#-fluxo-de-ingestão-de-dados-o-papel-do-administrador)
2. [📊 Regras de Negócio & Lógica de Classificação](#-regras-de-negócio--lógica-de-classificação)
3. [🏆 Conquistas / Badges (Gamificação)](#-conquistas--badges-gamificação)
4. [📱 Funcionalidades do Aplicativo](#-funcionalidades-do-aplicativo)
5. [🔐 Segurança, RLS & Privacidade (LGPD)](#-segurança-rls--privacidade-lgpd)
6. [🛠️ Stack Tecnológica](#️-stack-tecnológica)
7. [🚀 Setup local](#-setup-local)

---

## 📥 Fluxo de Ingestão de Dados (O papel do Administrador)

A aplicação **não coleta** treinos diretamente: ela depende de um pipeline de ingestão manual operado por um administrador autenticado. Esse design mantém a fonte da verdade no Gym Rats e evita acoplamento com APIs privadas de terceiros.

### 1. Origem dos dados — Gym Rats

Toda performance bruta (atletas, check-ins, fotos, reações, geolocalização aproximada, durações, distâncias e sub-atividades) vem do **Gym Rats**, plataforma onde o grupo registra os treinos do desafio mensal. O Gym Rats expõe um **export JSON** por grupo/mês contendo:

- `id`, `name` — identificação do grupo/desafio
- `members[]` — atletas participantes
- `check_ins[]` — todos os treinos do período, com `activity_type`, `duration_millis`, `distance_miles`, `details.location_latitude/longitude`, `photo_url`, `reactions[]`, `check_in_activities[]` (sub-atividades por plataforma)

### 2. Processo de ingestão — botão "Importar"

O administrador autenticado acessa a rota **`/importar`** (link "Importar" visível no header em telas desktop; também acessível pela barra inferior no mobile):

1. Faz **upload (drag-and-drop ou file picker)** do arquivo JSON exportado do Gym Rats.
2. A app valida superficialmente o payload (`id`, `members`, `check_ins`) e mostra um **preview** com: nome do desafio, ano/mês inferidos, total de atletas, total de check-ins, válidos e flagrados.
3. O admin informa o **código de convite do grupo Gym Rats** (4–32 caracteres alfanuméricos) — esse código fica salvo em `valid_group_codes` e passa a liberar a entrada de novos atletas no onboarding.
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

## 📊 Regras de Negócio & Lógica de Classificação

### Normalização dos check-ins (`parseCheckIn`)

- **Duração:** `duration` (min) ou `duration_millis / 60000` arredondado.
- **Distância:** `distance_miles × 1.609344` com 3 casas decimais.
- **Activity type:** usa `activity_type` nativo → `check_in_activities[0].platform_activity` → fallback regex em título/descrição (corrida, caminhada, pilates, bike, yoga, musculação, funcional/crossfit/hiit, natação, alongamento, LPO).
- **GPS:** truncado para 2 casas decimais antes de salvar (privacidade).
- **Reações:** extraídas como array de strings de emoji.
- **Validação:** atualmente **todo check-in importado conta** (alinhado ao Gym Rats — `is_valid = true` por padrão). A infraestrutura para flags de invalidade existe mas está desligada.

### Classificação exclusiva por check-in (`classifyCheckInExclusive`)

Cada check-in é classificado em **uma única categoria** somando `duration_millis` das sub-atividades em buckets:

- **`strength`** — `weightlifting`, `lpo`, `functional_strength_training`, ou texto casando `musculação`, `treino de força`, `supino`, `agachamento`, `peito/costas/ombro/bíceps/tríceps/perna`, etc.
- **`cardio`** — `running`, `walking`, `cycling`, `swimming`, `treadmill`, `elliptical`, `rowing`, `hiit`, `dance`, `circuit_training`, `functional_training` ou texto (`corrida`, `esteira`, `pedal`, `bike`, `cardio`, `wod`, `crossfit`…).
- **`mobility`** — `pilates`, `yoga`, `stretching`, `flexibility`, `mobility` ou texto (`alongamento`, `mobilidade`, `liberação miofascial`, `recovery`…).
- **`sport`** — esportes coletivos/individuais (`surf`, `escalada`, `futebol`, `basquete`, `vôlei`, `tênis`, `boxe`, `jiu-jitsu`, `mma`, etc.).
- **`other`** — quando nada acima casa.

**Desempate de categoria:** `strength > cardio > sport > mobility`.

### Detecção `isOutdoor`

Tipos indoor (`treadmill`, `indoor_cycling`, `elliptical`, `stationary_bike`, `spinning`, `rowing_machine`, `stair_climber`) **forçam indoor**. Tipos `running/walking/cycling/hiking/surfing` forçam outdoor. Caso contrário, **descrição tem precedência sobre o título**, e marcadores de força (`musculação`, `supino`…) eliminam outdoor antes de testar `parque|praça|praia|trilha|mato|ar livre|natureza`.

### Ranking mensal (`rankingFromCheckIns`)

Para cada atleta no mês:

```
active_days      = nº de dias distintos (TZ São Paulo) com pelo menos 1 check-in válido
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

Recalculadas anualmente por `computeAwards()` em [`src/lib/awards.ts`](src/lib/awards.ts). Cada prêmio escolhe **um único vencedor** (`topByScore`) com critérios de desempate específicos.

| Badge | Critério | Desempate |
|---|---|---|
| **`rust_enemy`** (Inimigo da Ferrugem) | Maior nº de check-ins classificados como `mobility` (pilates, yoga, alongamento, mobilidade). | Total de dias ativos no ano. |
| **`influencer`** | Maior nº total de **reações recebidas** somando todos os check-ins. | Dias ativos. |
| **`bodybuilding_beast`** (Monstro do Ferro) | Maior nº de check-ins `strength`. | Total de minutos no ano. |
| **`cardio_king`** | Maior nº de check-ins `cardio`. | Total de km no ano. |
| **`nature_lover`** | Maior nº de check-ins `isOutdoor === true`. | Dias ativos. |
| **`no_borders`** (Sem Fronteiras) | Maior nº de check-ins **fora da área usual**: identifica o cluster GPS dominante (grid de ~5 km) e conta check-ins a **mais de 30 km de raio** desse centro (Haversine). Exige ≥ 3 check-ins com GPS. | Dias ativos. |
| **`wod_comedian`** | Maior nº de reações **😂** recebidas em check-ins. | — |
| **`mile_eater`** (Devorador de Quilômetros) | Maior soma de `distance_km` no ano. | — |
| **`phoenix`** | Maior nº de "renascimentos": qualquer hiato **≥ 21 dias entre dois check-ins válidos** seguido por **3 semanas com pelo menos 3 dias ativos cada** dentro dos 21 dias subsequentes. | Dias ativos. |
| **`night_owl`** (Coruja) | Maior nº de check-ins com hora local (TZ São Paulo) **≥ 22h**. | — |

> O badge `early_bird` foi removido da engine anual e virou um **perfil dinâmico** exibido no perfil individual do atleta.

Todos os scores precisam ser **> 0** para gerar vencedor — em meses fracos o badge pode ficar vago.

---

## 📱 Funcionalidades do Aplicativo

### 🏟️ Hall da Fama (`/`)
Página inicial pública. Mostra:
- **Pódio anual** (top 3 do ano corrente).
- **Bolada estimada** (R$ acumulados) e contagem de **Clientes Ouro** (lanternas).
- Resumo do desafio em tom bem-humorado.

### 📅 Meses (`/meses` e `/meses/$id`)
- **Lista** cronológica de todos os meses já importados, com campeão e lanterna de cada um.
- **Detalhe do mês:** ranking completo (`month_results`), feed de check-ins validados, indicadores de performance consolidados (dias ativos, minutos, km, total de check-ins) e tags por categoria.

### 👥 Atletas (`/atletas` e `/atletas/$id`)
- **Diretório** completo dos atletas do grupo.
- **Perfil individual:** stats acumulados, histórico de consistência (heatmap mensal), status de identidade reivindicada (claimed via onboarding), perfil dinâmico (early bird / coruja / equilibrado), e grid de conquistas.

### 🏆 Conquistas / Badges
Grid visual mostrando os 10 prêmios anuais — cada um com:
- Atleta vencedor (ou estado **bloqueado**, quando ainda não há score > 0).
- Métrica relevante (`details` retornados por `computeAwards`).
- Estado reativo: hover/click revela o critério exato e o desempate.

### 📥 Importar (`/importar`) — somente admin
Painel administrativo descrito acima. Bloqueado por `requireSupabaseAuth` + `has_role('admin')`. Inclui ação separada de **"Recalcular conquistas do ano"**.

### 🔓 Onboarding (`/onboarding`)
Atleta autenticado informa o **código de convite** do grupo Gym Rats e reivindica sua identidade na lista de membros importados. Sem código válido, o usuário permanece como visitante.

---

## 🔐 Segurança, RLS & Privacidade (LGPD)

A app opera com **arquitetura de dois mundos** sobre os mesmos dados:

### 🟢 Visitante público (não autenticado)

Camada de anonimização em [`src/lib/anonymize.ts`](src/lib/anonymize.ts):

- **Nomes substituídos** deterministicamente por um pool de **30 primeiros nomes brasileiros** (`Lucas, Maria, Gabriel, Ana, Matheus, Julia, Felipe, Yasmin, Guilherme, Vitória, Rafael, Larissa, Daniel, Bruna, Gustavo, Camila, Pedro, Letícia, João, Jéssica, Thiago, Carolina, Leonardo, Mariana, Bruno, Amanda, Vinícius, Beatriz, Rodrigo, Isabela`) via hash estável do `athlete.id`.
- **Avatares:** apenas **iniciais coloridas** (HSL determinístico) — **nunca a foto do Google**, e a foto do Gym Rats só aparece quando o atleta optou explicitamente por `show_google_photo = true` no onboarding.
- **Fotos dos check-ins (selfies de academia, foto do espelho, etc.):** **completamente suprimidas** das views públicas.
- **Conteúdo bruto (`check_ins.raw`), GPS preciso, identidade real:** invisíveis.

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

### Conformidade LGPD

- Dado pessoal (nome, foto, geolocalização) é **opt-in granular** via `display_mode` e `show_google_photo`.
- Visitante anônimo nunca recebe PII.
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
- **Desktop:** header superior com navegação completa (`Hall`, `Meses`, `Atletas`, `Importar` para admin).
- **Mobile:** header enxuto + **bottom tab bar fixa** ([`src/components/bottom-nav.tsx`](src/components/bottom-nav.tsx)) com ícones e labels para todas as rotas principais. Renderização condicional baseada em viewport no `__root.tsx`.

---

## 🚀 Setup local

```bash
bun install
bun dev
```

Acesse `http://localhost:8080`. Banco e auth já vêm provisionados via Lovable Cloud (variáveis em `.env` gerenciadas automaticamente). Para importar dados, faça login com a conta de administrador (o primeiro usuário cadastrado é promovido automaticamente a `admin` por `handle_new_user`; novos admins podem ser concedidos manualmente via `user_roles`) e acesse `/importar`.

---

> Feito com 💪, 😂 e uma pitada de Dorflex.
