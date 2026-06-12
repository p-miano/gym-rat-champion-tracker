# Corrigir 404 ao abrir página individual do atleta

## Diagnóstico

- A rota `src/routes/atletas.$id.tsx` existe e o componente está correto.
- `src/routeTree.gen.ts` em disco já contém a entrada `/atletas/$id`.
- O link em `src/routes/atletas.index.tsx` está certo (`<Link to="/atletas/$id" params={{ id: a.id }}>`).
- O clique navega para a URL correta (`/atletas/<uuid>`), mas o app responde com o 404 do root.
- Causa: o dev server tem em memória uma versão antiga do `routeTree` (gerada antes do arquivo `atletas.$id.tsx` ser criado/atualizado) e não recarregou a árvore após o arquivo aparecer. Por isso o router client-side não conhece a rota e cai no `notFoundComponent` raiz.

## Correção

1. Reiniciar o dev server para forçar o plugin do TanStack Router a regenerar a árvore de rotas e o Vite a reconstruir o bundle com a rota `/atletas/$id` registrada.

Não há mudança de código necessária — só rebuild da árvore de rotas.

## Validação

- Abrir `/atletas`, clicar em qualquer card de atleta e confirmar que o prontuário individual carrega no lugar do 404.
- Conferir também acesso direto pela URL (`/atletas/<uuid>` no navegador) para garantir que SSR e client renderizam a rota.
