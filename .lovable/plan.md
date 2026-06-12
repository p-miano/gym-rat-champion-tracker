## Como o cardio é calculado hoje (e por que está furando)

Em `src/lib/awards.ts`, o prêmio `cardio_king` chama `isCardio(...)` para cada check-in e conta os que voltam `true`. Em paralelo, `bodybuilding_beast` chama `isStrength(...)`. As duas funções são **independentes** — o mesmo check-in pode bater nas duas.

`isCardio` (definida em `src/lib/gymrats-parser.ts`) usa uma cascata:

1. **Camada 1 — tipo nativo:** `activity_type` ∈ {running, walking, treadmill, cycling, swimming}.
2. **Camada 2 — atividades internas:** qualquer item de `check_in_activities[].platform_activity` casando `/treadmill|running|elliptical/`.
3. **Camada 3 — texto:** título/descrição contendo "corrida", "esteira", "cardio", "pedal", "escada", "elíptico" etc.

`isStrength` segue lógica análoga: `activity_type` ∈ {weightlifting, strength_training, lpo} OU texto com "musculação", "supino", "perna", "hipertrofia".

### Exemplo do bug (dado real do banco)

Check-in "Inferior + esteira" do Gabriel (1º/maio):
- `activity_type = null`
- `check_in_activities = [{ platform_activity: "strength_training", duration_millis: 3.895.000 }, { platform_activity: "treadmill", duration_millis: 1.227.000 }]`

Hoje:
- `isCardio` → **true** (Camada 2 viu "treadmill")
- `isStrength` → **true** (Camada 1 viu "strength_training" entre os platform_activities? Não — `isStrength` só olha `activity_type`, que é null. Olha o texto: "inferior" + "esteira" → "perna"/"musculação" não batem, então hoje retorna **false**.)

Resultado atual desse check-in: vai pro Cardio, não vai pro Marombeiro. Mas o atleta ficou **65 min de musculação contra 20 min de esteira** — deveria ser Marombeiro.

E há o caso simétrico (texto "musculação + corridinha rápida") que cai nos dois, dependendo de o `activity_type` ser preenchido.

## Regra nova (sua proposta, formalizada)

Cada check-in tem **no máximo uma categoria** entre `strength` e `cardio` (pode não ter nenhuma — outras modalidades não mudam). A decisão é por **tempo da atividade dominante**:

1. Para cada item de `check_in_activities`, classifique pelo `platform_activity`:
   - **cardio:** treadmill, running, walking, cycling, indoor_cycling, elliptical, swimming, stairs, rowing, hiking
   - **strength:** strength_training, weightlifting, lpo, weight_lifting, functional_strength
   - **outro:** não conta nas duas categorias
2. Some `duration_millis` por categoria dentro do check-in. A categoria com **maior tempo** ganha o check-in. Empate → cardio perde (vai pra força, porque musculação é a "base" do treino combinado; podemos inverter se preferir).
3. **Fallback** quando `check_in_activities` está vazio ou só tem itens "outro":
   - Usa a cascata atual (`activity_type` → texto) mas roda **strength primeiro**; se bater strength, o check-in **não** é cardio. Se não bater strength, aplica `isCardio` como hoje.

Resultado para "Inferior + esteira": força 65 min × cardio 20 min → **Marombeiro** ✅. O cardio_king perde esse check-in.

## Mudanças no código

**`src/lib/gymrats-parser.ts`** (uma adição, sem mexer nas funções existentes):

- Nova função `classifyCheckInExclusive(input)` que devolve `"strength" | "cardio" | "other"`.
- Recebe `activity_type`, `title`, `description` e `check_in_activities` (array com `platform_activity` + `duration_millis`).
- Implementa a regra acima.
- Mantém `isCardio` / `isStrength` / `isOutdoor` exportadas (outras partes podem usar; `isOutdoor` continua independente — um treino na rua pode ser cardio OU força).

**`src/lib/awards.ts`**:

- Estender `AwardCheckIn` com `check_in_activities` (extraído do `raw` já carregado).
- Em `cardio_king` e `bodybuilding_beast`, trocar `isCardio(...)` / `isStrength(...)` pela classificação exclusiva: incrementa força se `classify === "strength"`, cardio se `classify === "cardio"`.
- `nature_lover` continua usando `isOutdoor` (independente).
- Desempates seguem iguais (minutos totais para força, km total para cardio).

**`src/lib/import.functions.ts`**: nenhuma alteração de schema. O `select` já traz `raw`, de onde a engine extrai `check_in_activities`.

## Recálculo

Depois das mudanças, rodar recálculo server-side para 2026 (mesmo fluxo da última vez, via `recomputeAwardsForYear`). Esperado: Marombeiro provavelmente cresce, Cardio cai um pouco; nenhum atleta vai aparecer nas duas listas.

## Pergunta antes de implementar

Em caso de **empate exato** de tempo entre força e cardio no mesmo check-in, o que prefere?

- a) Vai pra **força** (assumo isso por padrão se você não responder — musculação tende a ser a parte estruturada do treino).
- b) Vai pra **cardio**.
- c) Não conta em nenhuma das duas categorias.
