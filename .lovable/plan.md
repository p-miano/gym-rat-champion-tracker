## Mudanças

### 1. Foto sempre do GymRats (sobrescrever Google)
Em `src/lib/anonymize.ts`, no ramo autenticado de `displayAthlete`, usar **apenas** `profile_picture_url` (foto do GymRats importada). Ignorar `google_photo_url` para usuários logados. A foto do Google só pode aparecer no ramo público quando o atleta optou por `show_google_photo` — manter esse comportamento como está.

### 2. Lista de 30 primeiros nomes mistos
Substituir `PLACEHOLDER_NAMES` em `src/lib/anonymize.ts` pelos 30 primeiros nomes indicados (sem sobrenome), mantendo a função `placeholderNameFor` (hash determinístico por `athleteId` → consistência entre componentes preservada automaticamente).

### 3. Privacidade das fotos de check-in
Em `src/routes/meses.$id.tsx`, dentro de `CheckInCard`, quando o visitante **não estiver autenticado** (`useIsAuthed()`), não renderizar `<img>` nem o bloco fallback de câmera — colapsar para mostrar apenas os metadados (data, título, descrição, duração, distância, tipo, reações, motivos de invalidação). Cabeçalho do card continua exibindo apenas as métricas textuais.

## Arquivos afetados
- `src/lib/anonymize.ts` — nova lista de nomes; remover uso de `google_photo_url` no ramo autenticado.
- `src/routes/meses.$id.tsx` — `CheckInCard` consome `useIsAuthed` e oculta a foto quando deslogado.

## Fora de escopo
- Schema do banco não muda (`show_google_photo`/`google_photo_url` continuam existindo, apenas não influenciam mais o ramo autenticado).
- Importador GymRats e demais telas não são alterados.
