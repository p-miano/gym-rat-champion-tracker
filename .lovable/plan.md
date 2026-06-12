## Bug encontrado

Caso real da Paula (04/abr/2026): título **"Musculação"**, `check_in_activities = [treadmill 17min, other 60min]`.

A regra exclusiva atual só soma duração de sub-atividades cujo `platform_activity` está numa das listas conhecidas (CARDIO/STRENGTH). Como o Gym Rats marca treino de academia como `platform_activity = "other"` (genérico), os 60 min de musculação **não somam pra força** — só os 17 min de esteira somam pra cardio. Resultado: vai pra **cardio** quando claramente deveria ser **força**.

Contagem da Paula sob a regra atual: **8 força / 45 cardio** (errado).

## Correção

Para cada sub-atividade do check-in:

1. `platform_activity` ∈ cardio (treadmill, running, walking, cycling, indoor_cycling, elliptical, swimming, stairs, rowing, hiking) → **cardio**.
2. `platform_activity` ∈ strength (strength_training, weightlifting, lpo, functional_strength_training) → **strength**.
3. **`platform_activity` = "other" ou desconhecido** → classifica essa sub-atividade pelo **fallback textual do check-in** (`title` + `description`):
   - bate strength (musculação, supino, perna, hipertrofia, treino de força) → **strength**
   - senão bate cardio (corrida, esteira, caminhada, cardio, pedal, escada, elíptico) → **cardio**
   - senão → **outro** (não conta)

Depois soma `duration_millis` por categoria, vence a maior. Empate → strength.

Se o check-in **não tem** `check_in_activities`, segue o fallback antigo (texto + activity_type, strength tem precedência).

### Validação no caso da Paula

- 04-01 "Musculação" [treadmill 17m, other 60m] → cardio 17 + strength 60 → **strength** ✅
- 04-08 "Cardio" [treadmill 37m] → cardio 37 → **cardio** ✅
- 04-23 "Musculação" [other 70m] → strength 70 → **strength** ✅
- 05-01 "Walking" [walking 13m] → cardio 13 → **cardio** ✅
- 05-18 "Musculação" [other 62m, treadmill 21m] → strength 62, cardio 21 → **strength** ✅

Estimativa pós-fix da Paula: ~38 strength / 15 cardio (inverte completamente). E o ranking geral muda — Paula deixa de liderar cardio_king.

## Mudanças no código

**`src/lib/gymrats-parser.ts`** — atualizar `classifyCheckInExclusive`:

- Manter as listas `CARDIO_PLATFORMS` / `STRENGTH_PLATFORMS`.
- Pré-computar fallback do check-in (`isStrength(input)` / `isCardio(input)`) uma vez.
- No loop das subs, quando `platform_activity` não está em nenhuma das listas (incluindo "other", null, ""), atribuir a duração à categoria do fallback textual (se houver); senão ignora.

**`src/lib/awards.ts`** — nada muda, já chama `classifyCheckInExclusive`.

## Recálculo

Rodar o mesmo script que recalcula 2026 e regravar `annual_awards`. Esperado:

- `bodybuilding_beast`: Paula provavelmente assume a liderança (musculação diária + texto "Musculação").
- `cardio_king`: novo líder (provavelmente quem realmente só faz cardio puro).
- `mile_eater`, `early_bird`: continuam baseados em distância/hora, não mudam.

## Fora do escopo

Não vou deduplicar os check-ins repetidos do mesmo dia da Paula (05/01 e 05/02 têm 2-3 entradas idênticas). Parece erro de importação histórico — posso atacar depois se quiser.
