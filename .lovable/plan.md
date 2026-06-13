## Botão "Recalcular conquistas do ano"

A server fn `recomputeAwards` já existe em `src/lib/import.functions.ts` (admin-only, recebe `{ year }` e regrava `annual_awards` rodando `computeAwards` sobre os check-ins do ano). Só falta UI.

### Mudanças em `src/routes/importar.tsx`

1. Importar `RefreshCw` (lucide) e `recomputeAwards` de `@/lib/import.functions`.
2. Criar `recomputeMutation` com `useServerFn(recomputeAwards)` chamando `{ year: new Date().getFullYear() }`. `onSuccess` → toast + `router.invalidate()`.
3. Renderizar um Card logo abaixo do título "Importar JSON do Gym Rats" (acima da dropzone), só visível para admin (já que a página inteira já bloqueia não-admin), com:
   - Título "Recalcular conquistas do ano" + descrição curta ("Roda o cálculo de prêmios anuais sobre os check-ins já importados, sem reimportar JSON. Use depois de mudanças na lógica de classificação.").
   - Botão `variant="secondary"` com `RefreshCw` (gira durante `isPending`) e label `Recalcular {ano}`.

Sem mudanças de banco. Sem mudanças em outras rotas. Após clicar, os novos prêmios (`rust_enemy`, `influencer`) aparecem no Placar.
