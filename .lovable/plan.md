## Objetivo
No "Placar Geral", colocar o **Ranking geral · dias ativos** e as **Categorias anuais** (Fênix, Humorista do WOD, Patrocinador do Dorflex, etc.) lado a lado em duas colunas no desktop, empilhando no mobile.

## Mudanças

### 1. `src/lib/data.functions.ts` — `getAnnualStanding`
Atualmente retorna `wins`, `lasts`, `active_days_ranking`, etc., mas **não traz as categorias anuais**. Adicionar:
- Buscar `annual_awards` do ano (`where year = data.year`) com join em `athletes(id, full_name, profile_picture_url)`.
- Retornar como `awards: { award_key, athlete_id, athlete, details }[]`.
- Incluir array vazio no caso `monthIds.length === 0`.

### 2. `src/routes/index.tsx`
- Importar `AWARD_META` de `@/lib/jokes`.
- Substituir a seção solo "Ranking geral · dias ativos" por um wrapper:
  ```
  <div className="grid gap-8 lg:grid-cols-2">
    <section>…ranking geral…</section>
    <section>…categorias anuais…</section>
  </div>
  ```
- Card de cada categoria: emoji + título (de `AWARD_META[award_key]`), avatar + nome do atleta vencedor, e o número de `details` (ex.: "4 risadas", "171 km") — mesmo padrão visual já usado em `atletas.$id.tsx`, adaptado para a coluna estreita.
- Se `awards` estiver vazio, mostrar `<Empty>Ainda sem categorias decididas.</Empty>`.

## Pontos fora do escopo
- Não alterar `awards.ts` nem regras de cálculo das categorias.
- Não mudar nomenclatura/jokes existentes.
- Sem migration (dados já estão em `annual_awards`).
