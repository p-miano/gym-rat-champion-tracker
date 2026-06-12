## Mudança

`src/lib/gymrats-parser.ts` → `STRENGTH_TEXT_RE`: adicionar:
- `treino\s*\d*\b` — captura "Treino", "Treino 5", "Treino 12", etc.
- `come[cç]ando` — captura "Começando"
- `membros\s+(?:inferiores|superiores)` — termos técnicos

## Resultado esperado (Sandra)

Todos os 17 dias caem em **Musculação**: Treino, Treino N, Começando, Membros inferiores.

## Risco

`treino` é genérico e pode capturar "treino de cardio". Mitigação: a precedência atual já é **strength > cardio > sport > mobility**, então um título tipo "Treino de cardio" cairia em musculação (errado). Mas:
- A cascata textual só é usada como fallback quando NÃO há subs com duração. Quem registra via Apple Watch/Strava terá platform_activities e o regex não importa.
- Quem escreve "Treino de cardio" provavelmente também marca `activity_type=running/cycling`, então pega no native primeiro.
- Casos restantes (texto livre "treino de cardio" sem metadados) seriam falsos positivos raros — aceitável dado o ganho.

## Validação

Rerodar Sandra (0 sem categoria esperado) e Anne/Amanda/Allan/Guigaldi pra garantir que ninguém regride pra musculação errada.
