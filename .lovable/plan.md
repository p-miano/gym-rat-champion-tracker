Unificar a contagem de "Treinos Fora da Base" na ficha do atleta com a regra do prêmio (>30 km do QG por haversine).

### `src/lib/awards.ts`
- Exportar `haversineKm` (hoje é função local). Sem mudança de comportamento.

### `src/routes/atletas.$id.tsx` — bloco `geo` (linhas ~234-291)
1. Importar `haversineKm` de `@/lib/awards`.
2. Calcular **sempre** o cluster geográfico dominante (grade 0,05°) a partir dos check-ins com `location_latitude`/`location_longitude`, gerando `baseLat` e `baseLng`. Esse passa a ser o QG real para fins de distância.
3. Manter `baseCity` (derivado de `location_name`) só pra exibição quando disponível; `baseCount` continua sendo o nº de check-ins na cidade base (quando há `location_name`).
4. `awayCount` passa a ser: para cada check-in com coordenadas, somar 1 se `haversineKm({baseLat,baseLng}, {lat,lng}) > 30`. Isso vale tanto quando `baseCity` existe quanto quando não.
5. `hasAnyGeo` = `baseLat != null` (qualquer check-in com coord).
6. `GeoBaseCard` continua igual: usa `baseCity` se houver, senão resolve via Nominatim a partir de `baseLat`/`baseLng`.

Resultado para GUIGALDI: 9 (João Pessoa) em vez de 19. Pode ficar igual ao prêmio sem precisar reimportar/recalcular nada — o cálculo é client-side, atualiza no próximo render.
