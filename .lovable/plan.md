## Problema

A semana de 25→31/05 aparece como "em curso" (cinza) porque o cutoff dinâmico está sendo calculado **só com os check-ins deste atleta**. Se o último check-in dele foi antes de 31/05 (ou mesmo em 31/05 mas com um detalhe de fuso), o domingo da semana cai fora do cutoff e a semana não é avaliada.

O cutoff correto é **global**: a data do check-in mais recente do dataset inteiro (qualquer atleta). Assim a régua de avaliação fica igual pra todo mundo e a semana só vira cinza se nenhum atleta tiver registrado nada nela ainda.

## Plano

1. **Server (`src/lib/data.functions.ts` → `getAthlete`)**
   - Adicionar uma quinta query em paralelo: `select("occurred_at").order("occurred_at", { ascending: false }).limit(1)` na tabela `check_ins` (sem filtro de atleta).
   - Retornar o campo `dataset_max_occurred_at: string | null` junto com os outros dados.

2. **Cliente (`src/routes/atletas.$id.tsx` → `weekly` useMemo)**
   - Trocar o cálculo de `maxKey` (que hoje varre só `check_ins` do atleta) por `spDateKey(dataset_max_occurred_at)` vindo do servidor.
   - Manter o fallback: se `dataset_max_occurred_at` for nulo, usar `todayKey`.
   - Resto da lógica (transição 30/03, meta 1 dia na semana de início, formato DD/MM, semanas após o cutoff escondidas) fica igual.

3. **Validação**
   - Abrir a página do atleta da Paula e confirmar que a semana 25/05→31/05 aparece avaliada (verde ou vermelha, não cinza).
   - Confirmar que semanas claramente futuras (depois do último check-in do dataset) continuam sumindo do timeline.

## Detalhes técnicos

- A query extra é barata (`order desc limit 1` num índice por `occurred_at`).
- `dataset_max_occurred_at` é um ISO timestamp; converter pra chave SP com `spDateKey` no cliente garante consistência de fuso com o resto da timeline.
- Nada muda na lógica de classificação de treinos, auditoria ou nos outros painéis.
