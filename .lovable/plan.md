# Fitness Sem Fronteiras — novo cálculo

## Objetivo

Para cada atleta, descobrir a **área usual** (onde ele treina no dia-a-dia) e contar quantos check-ins foram feitos **fora dela**. Ganha quem mais "treinou viajando". O método atual (centróide aritmético) falha quando o atleta tem dois polos frequentes — a média cai num ponto fantasma e tudo vira "fora".

## Regra proposta

Para cada atleta com ≥ 3 check-ins geolocalizados no ano:

1. **Encontrar a base pessoal (centro da área usual):**
   - Arredondar cada check-in numa grade de ~5 km (≈ 0,05° de lat/lng).
   - A célula com mais check-ins é o "polo principal". Usar o **centróide só dos check-ins dessa célula** como base — assim a base é um ponto real onde a pessoa de fato treina, não uma média entre cidades.

2. **Definir a área usual:** círculo de **30 km** de raio em torno dessa base.
   - 30 km cobre deslocamento normal dentro de uma cidade/região metropolitana (academias, parques, casa de parentes no mesmo eixo).
   - Acima disso, já é "viagem" pelo critério do prêmio.

3. **Pontuação:** número de check-ins ≥ 30 km da base.

4. **Vencedor:** maior pontuação. Empate desempata por total de dias ativos no ano (igual hoje).

5. **Detalhes salvos** em `annual_awards.details` para exibição no card:
   - `far_checkins`: nº de check-ins fora da área usual
   - `base_lat`, `base_lng`: a base pessoal usada
   - `home_checkins`: nº de check-ins dentro da área usual (pra dar contexto)

## Aplicação no caso da Amanda (validação)

- 57 check-ins, 2 clusters: ~45 em Campinas e ~12 em João Pessoa.
- Cluster dominante: Campinas → base ≈ (−22.81, −47.23).
- Check-ins dentro de 30 km de Campinas: ~45 → "casa".
- Check-ins ≥ 30 km: ~12 (os de João Pessoa) → **pontuação = 12**.
- Bate com a intuição: ela viajou pra PB e treinou lá → conta como "sem fronteiras".

## Detalhes técnicos

- **Arquivo único alterado:** `src/lib/awards.ts`, regra `no_borders` (item 5).
- Constantes locais à regra: `GRID_DEG = 0.05` (≈ 5 km), `HOME_RADIUS_KM = 30`.
- Reaproveitar `haversineKm` existente. Sem nova dependência.
- O recálculo dispara automaticamente na próxima importação de mês (não muda o fluxo). Pra recalcular já, basta reimportar qualquer mês de 2026/2027 — o `computeAwards` é chamado a cada import e sobrescreve `annual_awards` do ano.
- Sem migração de banco. Sem mudança na UI (o card já mostra `details.far_checkins`).

## Fora do escopo

- Não toco em outros prêmios.
- Não mudo a forma como os detalhes são renderizados no card (só passo a ter números mais realistas).
- Não cadastro "cidade-base" manual por atleta — fica 100% automático a partir dos check-ins.

## Pergunta antes de implementar

O raio de **30 km** te parece bom pra "área usual"? Alternativas razoáveis: 20 km (mais rigoroso, conta como "viagem" qualquer treino na grande SP partindo do centro) ou 50 km (mantém o threshold atual, só muda a base). Posso seguir com 30 km se você não disser nada.
