# Roster contínuo da temporada

## Problema
Hoje `month_results` só contém atletas presentes naquele mês (vem de `parsed.members` do export do GymRats). Quem não entra num mês some do ranking em vez de aparecer com 0 check-ins e disputar a lanterna.

## Solução
Ao (re)calcular `month_results`, usar como roster a **união de todos os atletas com resultado em qualquer mês do mesmo ano** — não apenas os membros presentes no export daquele mês. Ausentes recebem `active_days=0`, `total_checkins=0`, `total_minutes=0`, `total_distance_km=0` e entram normalmente no cálculo de rank/winner/last (empate no mínimo mantém múltiplas lanternas, como hoje).

## Mudanças

### 1. `src/lib/import.functions.ts`
- Em `importMonth.handler`, depois de fazer upsert do mês/atletas/check-ins do export atual, buscar o **roster do ano**: união de `athletes.id` presentes em `month_results` de qualquer mês do mesmo `parsed.year` **mais** os `idMap.values()` recém-importados.
- Passar esse roster expandido para `rankingFromCheckIns` em vez de só `[...idMap.values()]`. `rankingFromCheckIns` já trata atletas sem check-ins como 0 (o `Set` fica vazio), então a função em si não muda.
- **Recomputar `month_results` dos outros meses do ano** para incluir os atletas novos que entraram agora. Fluxo: para cada `month_id` do ano, apagar `month_results`, buscar `check_ins` daquele mês, rodar `rankingFromCheckIns(rosterDoAno, checkIns)`, reinserir. Fazer isso antes do `recomputeAwardsForYear`.

### 2. Nenhuma mudança de schema
As tabelas já suportam linhas com zeros. `month_results` tem PK/uniq por `(month_id, athlete_id)` que continua válida.

### 3. Nenhuma mudança de UI/leitura
`listMonths`, `getMonth`, `getAnnualStanding` já leem tudo de `month_results` — vão passar a mostrar os ausentes com 0 automaticamente, inclusive na lanterna.

## Efeito
- Import de qualquer mês passa a sincronizar o roster de todos os meses do ano.
- Atleta que aparece pela primeira vez no mês 5 retroage com 0 nos meses 1–4 (contando como lanterna se aplicável).
- Regra de empate na lanterna preservada: se vários zerarem, todos são `is_last`.
