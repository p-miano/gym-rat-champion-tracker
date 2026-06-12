## Problema

Dois pontos divergem do esperado no mês de abril:

1. **Dias ativos diferentes do GymRats.** O parser marca check-ins como "inválidos" quando não têm foto ou duram menos de 30 min (com exceção para corrida/caminhada ≥3 km). Só os "válidos" contam para `active_days`, então o ranking diverge do app oficial.
2. **Bolada** já está correta (R$10 × atletas + R$10 por cada último; com 3 empatados em último → R$130). Você confirmou que essa fórmula é a desejada — nenhuma mudança aqui.

## Mudanças

### Código — `src/lib/gymrats-parser.ts`
Simplificar `validateCheckIn` para sempre retornar `{ is_valid: true, invalid_reasons: [] }`. Todo check-in importado passa a contar, igual ao GymRats. Manter a função (e os campos `is_valid`/`invalid_reasons` na tabela) para não quebrar o schema nem futuras alterações.

### Banco — recálculo do mês de abril já importado
Os check-ins de abril já estão no banco com `is_valid=false` em vários casos. Vou:

1. Atualizar `check_ins` do mês de abril: setar `is_valid=true` e `invalid_reasons='{}'`.
2. Recomputar `month_results` do mês de abril com base na nova contagem de dias ativos (data em São Paulo TZ), refazendo rank, `is_winner` e `is_last`.
3. Recomputar `annual_awards` do ano 2026 (já que os prêmios anuais dependem dos dados do mês).

O recálculo da tabela `month_results` é feito via SQL: para cada atleta, contar `COUNT(DISTINCT data_em_SP)` a partir de `check_ins`, ordenar por dias (desempate por minutos totais), e marcar `is_winner` (top) e `is_last` (bottom, exigindo ≥2 atletas no grupo).

Para `annual_awards`, o caminho mais limpo é deletar as awards do ano e reexecutar a função `recomputeAwardsForYear` — mas como ela vive em TypeScript, vou apagar `annual_awards` do ano e deixar que a próxima reimportação recompute (ou disparo manualmente após o deploy).

## Resultado esperado para abril

Ranking (por dias ativos):

```text
1° Amanda          28
2° GUIGALDI        27
3° Paula           21
4° Sandra          14
5° Leandro Sousa   13
6° Gisele          12
7° Allan Yukio Waki 9
8° Anne Miano       8
9° Nathalia         5
10° Carolina        0  (último)
```

Bolada anual: **R$110** (10 atletas × R$10 + R$10 do último).

## Pós-mudança

- Próximas importações de outros meses (maio, etc.) já passam a contar todos os check-ins.
- Se quiser reintroduzir regras de validação no futuro, basta voltar a lógica em `validateCheckIn`.
