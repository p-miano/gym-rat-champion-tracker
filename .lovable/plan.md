## Mudança

`src/lib/gymrats-parser.ts` → `STRENGTH_TEXT_RE`: adicionar nomes técnicos de grupos musculares:
`dorsal|deltoid|trap[eé]zio|lombar|abdom|abd[oô]men|panturr|qu[aá]driceps|isquiotib|adutor|abdutor|bra[cç]o|antebra[cç]o`.

## Resultado esperado (Guigaldi)

- 21/04 "Dorsal" → Musculação
- 11/05 "Deltóides" → Musculação
- 0 dias em "Sem categoria"

## Validação

Rerodar Guigaldi e conferir que Anne/Amanda/Allan não mudam (regex novo é específico de musculatura).
