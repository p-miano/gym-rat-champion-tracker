Ajustar `src/lib/awards.ts` linha 216 (cálculo de `no_borders` / "Treinos Fora da Base"):

- Trocar `if (d >= HOME_RADIUS_KM) far++;` por `if (d > HOME_RADIUS_KM) far++;`.

Efeito: só conta como "fora da base" quem estiver estritamente **acima de 30 km** do QG. Os 5 check-ins do GUIGALDI na zona de Campinas (~22–28 km) continuam não contando; os 9 de João Pessoa continuam contando.

Sem mudança de schema, sem mudança de UI. Para o valor refletir no Placar, basta clicar "Recalcular {ano}" em `/importar` depois do deploy.
