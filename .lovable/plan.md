## Objetivo

Reduzir os 15 "Sem categoria" do Allan adicionando keywords óbvias, sem virar um default agressivo (titles genéricos como "Domingou!" continuam em Sem categoria).

## Mudanças em `src/lib/gymrats-parser.ts`

**Outros Esportes — incluir esportes de mesa**
- `SPORT_TEXT_RE`: adicionar `ping[\s-]?pong|t[eê]nis de mesa|sinuca|bilhar|fute[\s-]?mesa|esporte novo`.

**Mobilidade — incluir recuperação**
- `MOBILITY_TEXT_RE`: adicionar `massagem|cadeira de massagem|recupera[cç][aã]o|recovery`.

## Resultado esperado para Allan

Resolvido (3 → categoria nova):
- 05/05 "cadeira de massagem" → **Mobilidade**
- 08/05 "Esporte novo" → **Outros Esportes**
- 15/05 "Olha o ping pong" → **Outros Esportes**
- 19/05 "Nem só de ping pong" → **Outros Esportes**

Permanece em **Sem categoria** (12 dias) — títulos sem pista nenhuma:
- 03/04, 05/04, 07/04, 08/04, 09/04, 19/04, 20/04, 26/04, 04/05, 23/05, 26/05

Esses ficam como rede de segurança até o atleta passar a registrar modalidade no Gym Rats.

## Validação

Rerodar a página do Allan e conferir os contadores; rodar Anne e Amanda pra garantir que as adições não criam falsos positivos (ex: o regex `massagem` não bate em nenhum título existente delas).
