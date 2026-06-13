## Problema

Paula (`paulamiano@gmail.com`) loga com sucesso pelo Google, mas é levada para `/onboarding` e fica presa lá, mesmo já tendo `onboarded_at` preenchido no banco e estando vinculada a um atleta.

## Hipóteses

1. **Race do callback OAuth**: o `redirect_uri` configurado em `src/routes/auth.tsx` é `${origin}/onboarding`. Quando o Google devolve o usuário, `/onboarding` monta e chama imediatamente `getMyOnboardingState`. Se a sessão Supabase ainda não foi persistida no `localStorage`, o `attachSupabaseAuth` não anexa o Bearer e o server fn rejeita com `Unauthorized`. O `catch` da página é silencioso (`// ignore`) e o usuário fica preso no formulário.
2. **Erro silencioso no server fn** por outro motivo (timeout, env). O `catch {}` esconde qualquer falha de `getMyOnboardingState`.

## Correções propostas

### 1. Expor o erro em vez de engolir
Em `src/routes/onboarding.tsx` (linhas 58-66), substituir o `catch {}` por: logar o erro no console, mostrar `toast.error` e — se houver sessão válida — assumir o caminho mais seguro (não bloquear o usuário existente).

### 2. Esperar a sessão antes de chamar o server fn
No `useEffect` de `OnboardingPage`, em vez de só `getSession()` uma vez, registrar `onAuthStateChange` e aguardar o evento `SIGNED_IN`/`INITIAL_SESSION` com `access_token` antes de chamar `stateCall()`. Isso elimina a race do callback OAuth.

### 3. Fallback baseado em consulta direta ao próprio perfil
Se o server fn falhar, fazer fallback consultando `supabase.from('profiles').select('onboarded_at').eq('id', user.id).maybeSingle()` direto do client (a RLS permite ao próprio usuário). Se `onboarded_at` existir → `router.navigate({ to: "/" })`.

### 4. (Investigação) Adicionar `console.log` no handler de `getMyOnboardingState`
Logar `userId`, presença de profile e `onboarded_at` no server fn. Após o usuário tentar novamente, ler os logs do worker para confirmar qual hipótese é a verdadeira e ajustar a correção se necessário.

## Arquivos afetados

- `src/routes/onboarding.tsx` — melhorar o `useEffect`, tirar `catch` silencioso, adicionar fallback.
- `src/lib/onboarding.functions.ts` — logar diagnóstico temporário no handler `getMyOnboardingState`.

Nenhuma migração de banco é necessária — os dados da Paula estão íntegros.

## Validação

Após aplicar:
1. Paula recarrega a página, faz logout e login novamente com Google.
2. Confirmar que cai direto em `/` (e não em `/onboarding`).
3. Confirmar que o botão **Importar** volta a aparecer no header (via `has_role` RPC).
4. Ler os server logs para confirmar qual hipótese estava ativa e, se for a #1, manter a correção da race; se for #2, tratar o erro real.
