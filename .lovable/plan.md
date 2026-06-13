# Plano

## 1. Nova tabela `valid_group_codes` (migration)
- `code text PRIMARY KEY` (armazenado em maiúsculas, sem espaços)
- `gymrats_group_id bigint NOT NULL`
- `label text` (nome do mês/grupo para referência)
- `added_at timestamptz default now()`, `added_by uuid`
- GRANTs: `SELECT` para `authenticated`, `ALL` para `service_role` (sem `anon`)
- RLS: leitura para `authenticated`; escrita só admin (`has_role(...,'admin')`)
- Append-only: importações futuras só adicionam, nunca apagam — todos os códigos já cadastrados continuam válidos.

## 2. Tela `/importar`
- Adicionar campo obrigatório **"Código do convite (GymRats)"** antes do botão Importar.
- Validação client-side: 4–32 caracteres alfanuméricos, normalizado para uppercase.
- Enviado junto com o payload para `importMonth`.

## 3. `importMonth` (server fn)
- Aceitar `invite_code: string` no input validator.
- Após salvar `months`, fazer `upsert` em `valid_group_codes` com `{ code, gymrats_group_id, label }`.

## 4. Onboarding
- `validateGroupCode` e `completeOnboarding`: buscar em `valid_group_codes` por `code` (uppercased + trim), em vez do ID numérico.
- Mensagem de erro: *"Código inválido. Use o código de convite do GymRats fornecido pelo administrador."*

## 5. Backfill
- Sem utilitário admin extra — admin re-importa os 2 meses já existentes com o novo campo preenchido.

## Arquivos afetados
- `supabase/migrations/<nova>.sql`
- `src/lib/import.functions.ts`
- `src/routes/importar.tsx`
- `src/lib/onboarding.functions.ts`
