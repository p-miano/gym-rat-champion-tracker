# Corrigir contagem incompleta de treinos (limite de 1000 linhas)

## Diagnóstico (confirmado)
- O arquivo de outubro tem 31 check-ins da Paula, e os 31 foram salvos no banco.
- O placar mostra 30 porque, ao recalcular o ranking do ano, o app busca todos os check-ins de 2026 de uma vez só. O banco devolve no máximo 1000 linhas por consulta, e 2026 já tem 1004. Os 4 últimos ficam de fora — um deles é o treino da Paula em 31/10.
- O mesmo limite afeta o cálculo das conquistas do ano e vai piorar a cada mês importado.

## Correção
1. Criar um utilitário que busca os check-ins em páginas de 1000 até acabar.
2. Usá-lo em `recomputeYearResults` (ranking mensal) e em `recomputeAwardsForYear` (conquistas) em `src/lib/import.functions.ts`.
3. Verificar outras leituras de check-ins em `src/lib/data.functions.ts` que possam passar de 1000 linhas e aplicar a mesma paginação.
4. Depois disso, clicar em "Recalcular 2026" em Importar para corrigir os meses já salvos (não precisa reimportar).

## Verificação
- Confirmar no banco que a Paula fica com 31 dias ativos em outubro e que os outros meses não mudaram de forma inesperada.
