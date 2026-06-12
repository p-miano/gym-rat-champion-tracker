## Objetivo

Resolver as 15 categorizações erradas da Anne Miano (e similares de outros atletas):
- LPO indo pra "outros" por bug
- Surf sem categoria → criar nova categoria **Outros Esportes**
- Funcional/circuito sem categoria → mapear pra **Cardio**

"Sem categoria" permanece como rede de segurança pra check-ins que não batem em nenhum regex (decisão caso a caso depois).

## Mudanças

### 1. `src/lib/gymrats-parser.ts`

**Fix LPO**
- `STRENGTH_TYPES`: adicionar `weight_lifting` (variante com underscore).
- `STRENGTH_TEXT_RE`: incluir `\blpo\b`.

**Cardio — incluir funcional/circuito**
- `CARDIO_NATIVE` e `CARDIO_PLATFORMS`: adicionar `circuit_training`, `functional_training`, `cross_training`.
- `CARDIO_PLATFORM_RE`: adicionar `circuit|functional_training|cross_training`.
- `CARDIO_TEXT_RE`: adicionar `funcional|circuito|wod|crossfit`.
- ⚠ Não confundir com `functional_strength_training` (continua em `STRENGTH_PLATFORMS`).

**Nova categoria: Outros Esportes (`sport`)**
- Tipo de retorno:
  ```ts
  export type ExclusiveCategory = "strength" | "cardio" | "mobility" | "sport" | "other";
  ```
- Novo `SPORT_TYPES` / `SPORT_PLATFORMS`: `surfing`, `skating`, `skateboarding`, `snowboarding`, `climbing`, `soccer`, `basketball`, `volleyball`, `tennis`, `badminton`, `martial_arts`, `boxing`, `kickboxing`, `jiu_jitsu`, `judo`, `karate`, `taekwondo`, `mma`, `golf`, `baseball`.
- `SPORT_TEXT_RE`: `surf|skate|escalad|boulder|futebol|basquete|v[oô]lei|t[eê]nis|bad?minton|boxe|muay|jiu[\s-]?jitsu|jud[oô]|karat[eê]|taekwondo|mma|luta`.
- Função `isSport(c: ClassifyInput): boolean`.

**Precedência em `classifyCheckInExclusive`**

Quatro buckets de duração: strength, cardio, mobility, sport. Decisão:
1. Se houver ms em algum bucket → vence o maior. Empates resolvidos nesta ordem de preferência: **strength > cardio > sport > mobility** (carga > aeróbico cíclico > esporte > ADM).
2. Sem ms → cascata textual exclusiva: `isStrength` → `isCardio` → `isSport` → `isMobility` → `other`.

Subs desconhecidas distribuem ms via fallback textual do check-in.

### 2. `src/routes/atletas.$id.tsx`

- Contador `sport` no `audit` (junto com `strength`/`cardio`/`mobility`/`other`).
- Nova linha "Treinos de Outros Esportes" no painel (ícone neutro; sub: "surf, escalada, futebol, lutas etc.").
- Texto explicativo: Musculação + Cardio + Mobilidade + Outros Esportes + Outros = Dias Ativos.

### 3. Validação esperada para Anne

- 15/04 LPO → musculação
- 18/04 WOD+REMO, 20/04 remo, 22/04 → cardio
- 30/04, 14/05, 26/05, 28/05 Surftraining → cardio
- 05/05 Surf training (`functional_training`) → cardio
- 29/04, 09/05, 12/05, 13/05, 15/05, 20/05, 22/05, 27/05, 29/05 Surf → outros esportes
- 01/04 surfe (sub surfing 5400000ms) → outros esportes
- 13/04 "row + mobilidade surf" → outros esportes (texto "surf" bate)

Esperado: 0 dias em "Sem categoria" pra Anne.

## Detalhes técnicos

- `awards.ts` só consome `"strength"` e `"cardio"` — adicionar `sport` é compatível.
- Meta semanal 3× continua por Dia Ativo (qualquer categoria).
