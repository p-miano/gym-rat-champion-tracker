## Objetivo

Refinar `classifyCheckInExclusive` em `src/lib/gymrats-parser.ts` para suportar três categorias mutuamente exclusivas: **Musculação**, **Cardio** e **Mobilidade** (nova). Treinos que não se encaixam continuam como `other`.

## Mudanças

### 1. `src/lib/gymrats-parser.ts`

**Tipo de retorno**
```ts
export type ExclusiveCategory = "strength" | "cardio" | "mobility" | "other";
```

**Cardio — expandir**
- `CARDIO_PLATFORMS`: adicionar `stationary_bike`, `spinning`, `rowing_machine`, `stair_climber`, `hiit`, `dance`.
- `CARDIO_TEXT_RE` (e `CARDIO_TEXT_RE` do `isCardio`): incluir `bike|bicicleta|spinning|ergom[eé]trica|esteira|corrid(a|inha)?|caminhad(a|inha)?|trote|escada|el[ií]ptico|transport|remo|dance|dança|hiit`.

**Mobilidade — nova**
```ts
const MOBILITY_PLATFORMS = new Set([
  "pilates", "yoga", "stretching", "flexibility", "mind_and_body",
]);
const MOBILITY_TEXT_RE =
  /\b(pilates|yoga|mobs|mobilidade|alongamento|alongar|flexibilidade|libera[cç][aã]o miofascial|miofascial|adm|amplitude de movimento|tor[aá]cica|tornozelo|quadril|ombro\s+mob)\b/;

function isMobility(c: ClassifyInput): boolean { ... }
```

**Nova ordem de precedência em `classifyCheckInExclusive`**

Somar duração (`duration_millis`) por categoria a partir de `check_in_activities`, usando os três buckets (strength, cardio, mobility). Sub-atividade desconhecida cai no fallback textual do check-in (strength → cardio → mobility, nessa ordem).

Decisão:
1. Se houver ms acumulado em qualquer bucket → vence o **maior**. Empate entre strength e qualquer outro → **strength** (regra atual mantida: carga vence ADM). Empate cardio vs mobility → **cardio**.
2. Sem ms → cascata textual exclusiva: `isStrength` → `isCardio` → `isMobility` → `other`.

Isso garante:
- Cardio expandido nunca cai em musculação/mobilidade.
- Pilates/yoga puro vai pra mobilidade, não pra `other`.
- Agachamento profundo com carga continua musculação (strength vence empate).
- HIIT/dance contam como cardio.

### 2. `src/routes/atletas.$id.tsx`

- Adicionar `mobility` aos contadores de Dias Ativos: hoje há `strength`, `cardio`, `others`. Passa a ter `strength`, `cardio`, `mobility`, `others`. A soma das 4 categorias deve continuar batendo com Total de Dias Ativos.
- Adicionar um cartão/coluna "Mobilidade" no painel de métricas e na tabela/auditoria (mesmo layout dos demais).
- Atualizar legendas e textos em PT-BR ("Mobilidade").
- A lógica semanal (meta 3×/semana segunda→domingo) **não** considera mobilidade como treino válido pra meta, mantendo o critério original (musculação+cardio). Confirmar com o usuário se quer incluir — ver pergunta abaixo.

### 3. Validação

- Reabrir página da Amanda e conferir:
  - Os 7 dias de Pilates aparecem em **Mobilidade**.
  - 27/05 ("Bike", `stationary_bike`) aparece em **Cardio**.
  - "Treinos sem categoria" zera (ou some) pra ela.
- Conferir outro atleta com musculação pesada pra garantir que strength continua dominando.

## Pergunta aberta

Mobilidade conta pra meta semanal de 3 treinos? Pelo enunciado original ("Musculação ou Cardio") presumo **não**, mas confirma antes de eu mexer na regra da semana.
