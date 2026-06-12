// Engine de prêmios. Funções puras sobre os check-ins do ano.
import {
  extractPlatformActivities,
  isCardio,
  isOutdoor,
  isStrength,
  spDateKey,
  spHour,
  spWeekKey,
} from "./gymrats-parser";

export interface AwardCheckIn {
  athlete_id: string;
  occurred_at: string;
  is_valid: boolean;
  distance_km: number | null;
  duration_min: number | null;
  activity_type: string | null;
  title: string | null;
  description: string | null;
  location_latitude: number | null;
  location_longitude: number | null;
  reactions: string[];
  raw: unknown;
}

export interface AwardResult {
  award_key: string;
  athlete_id: string | null;
  details: Record<string, unknown>;
}

function topByScore(
  scores: Map<string, number>,
  tiebreak?: Map<string, number>,
): string | null {
  let bestKey: string | null = null;
  let bestScore = -Infinity;
  let bestTie = -Infinity;
  for (const [k, v] of scores) {
    if (v <= 0) continue;
    const tie = tiebreak?.get(k) ?? 0;
    if (v > bestScore || (v === bestScore && tie > bestTie)) {
      bestKey = k;
      bestScore = v;
      bestTie = tie;
    }
  }
  return bestKey;
}

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function computeAwards(checkIns: AwardCheckIn[]): AwardResult[] {
  // Agrupar por atleta
  const byAthlete = new Map<string, AwardCheckIn[]>();
  for (const c of checkIns) {
    const arr = byAthlete.get(c.athlete_id) ?? [];
    arr.push(c);
    byAthlete.set(c.athlete_id, arr);
  }

  // Total de dias ativos (tiebreak)
  const activeDaysTotal = new Map<string, number>();
  for (const [aid, list] of byAthlete) {
    const days = new Set<string>();
    for (const c of list) if (c.is_valid) days.add(spDateKey(c.occurred_at));
    activeDaysTotal.set(aid, days.size);
  }

  // Total de minutos (tiebreak para marombeiro)
  const totalMinutes = new Map<string, number>();
  for (const [aid, list] of byAthlete) {
    let m = 0;
    for (const c of list) m += c.duration_min ?? 0;
    totalMinutes.set(aid, m);
  }

  // Total de km (tiebreak para cardio_king)
  const totalKm = new Map<string, number>();
  for (const [aid, list] of byAthlete) {
    let k = 0;
    for (const c of list) k += c.distance_km ?? 0;
    totalKm.set(aid, Math.round(k));
  }

  const results: AwardResult[] = [];
  const add = (key: string, aid: string | null, details: Record<string, unknown>) =>
    results.push({ award_key: key, athlete_id: aid, details });

  // 1. voucher_limit: nº de semanas com EXATAMENTE 3 dias ativos
  {
    const score = new Map<string, number>();
    for (const [aid, list] of byAthlete) {
      const weekDays = new Map<string, Set<string>>();
      for (const c of list) {
        if (!c.is_valid) continue;
        const wk = spWeekKey(c.occurred_at);
        const day = spDateKey(c.occurred_at);
        if (!weekDays.has(wk)) weekDays.set(wk, new Set());
        weekDays.get(wk)!.add(day);
      }
      let n = 0;
      for (const s of weekDays.values()) if (s.size === 3) n++;
      score.set(aid, n);
    }
    const winner = topByScore(score, activeDaysTotal);
    add("voucher_limit", winner, { weeks_at_three: winner ? score.get(winner) : 0 });
  }

  // 2. bodybuilding_beast: maior nº de treinos de musculação/força
  {
    const score = new Map<string, number>();
    for (const [aid, list] of byAthlete) {
      let n = 0;
      for (const c of list) {
        if (
          isStrength({
            activity_type: c.activity_type,
            title: c.title,
            description: c.description,
            platform_activities: extractPlatformActivities(c.raw),
          })
        )
          n++;
      }
      score.set(aid, n);
    }
    const winner = topByScore(score, totalMinutes);
    add("bodybuilding_beast", winner, {
      strength_checkins: winner ? score.get(winner) : 0,
    });
  }

  // 3. cardio_king: maior nº de treinos de cardio
  {
    const score = new Map<string, number>();
    for (const [aid, list] of byAthlete) {
      let n = 0;
      for (const c of list) {
        if (
          isCardio({
            activity_type: c.activity_type,
            title: c.title,
            description: c.description,
            platform_activities: extractPlatformActivities(c.raw),
          })
        )
          n++;
      }
      score.set(aid, n);
    }
    const winner = topByScore(score, totalKm);
    add("cardio_king", winner, { cardio_checkins: winner ? score.get(winner) : 0 });
  }

  // 4. nature_lover: maior nº de check-ins ao ar livre
  {
    const score = new Map<string, number>();
    for (const [aid, list] of byAthlete) {
      let n = 0;
      for (const c of list) {
        if (
          isOutdoor({
            activity_type: c.activity_type,
            title: c.title,
            description: c.description,
            platform_activities: extractPlatformActivities(c.raw),
          })
        )
          n++;
      }
      score.set(aid, n);
    }
    const winner = topByScore(score, activeDaysTotal);
    add("nature_lover", winner, { outdoor_checkins: winner ? score.get(winner) : 0 });
  }

  // 5. no_borders: check-ins fora da área usual (raio 30 km do cluster dominante)
  {
    const GRID_DEG = 0.05; // ~5 km
    const HOME_RADIUS_KM = 30;
    const score = new Map<string, number>();
    const detailsByAthlete = new Map<string, { base_lat: number; base_lng: number; home_checkins: number }>();
    for (const [aid, list] of byAthlete) {
      const geo = list.filter(
        (c) => c.location_latitude != null && c.location_longitude != null,
      );
      if (geo.length < 3) {
        score.set(aid, 0);
        continue;
      }
      const cells = new Map<string, typeof geo>();
      for (const c of geo) {
        const gLat = Math.round(c.location_latitude! / GRID_DEG);
        const gLng = Math.round(c.location_longitude! / GRID_DEG);
        const key = `${gLat}:${gLng}`;
        const arr = cells.get(key) ?? [];
        arr.push(c);
        cells.set(key, arr);
      }
      let topCell: typeof geo = [];
      for (const arr of cells.values()) if (arr.length > topCell.length) topCell = arr;
      const baseLat = topCell.reduce((s, c) => s + (c.location_latitude ?? 0), 0) / topCell.length;
      const baseLng = topCell.reduce((s, c) => s + (c.location_longitude ?? 0), 0) / topCell.length;
      let far = 0;
      let home = 0;
      for (const c of geo) {
        const d = haversineKm(
          { lat: baseLat, lng: baseLng },
          { lat: c.location_latitude!, lng: c.location_longitude! },
        );
        if (d >= HOME_RADIUS_KM) far++;
        else home++;
      }
      score.set(aid, far);
      detailsByAthlete.set(aid, {
        base_lat: Number(baseLat.toFixed(4)),
        base_lng: Number(baseLng.toFixed(4)),
        home_checkins: home,
      });
    }
    const winner = topByScore(score, activeDaysTotal);
    const det = winner ? detailsByAthlete.get(winner) : undefined;
    add("no_borders", winner, {
      far_checkins: winner ? score.get(winner) : 0,
      ...(det ?? {}),
    });
  }

  // 6. wod_comedian: 😂 reactions
  {
    const score = new Map<string, number>();
    for (const [aid, list] of byAthlete) {
      let n = 0;
      for (const c of list) for (const r of c.reactions) if (r.includes("😂")) n++;
      score.set(aid, n);
    }
    const winner = topByScore(score);
    add("wod_comedian", winner, { laughs: winner ? score.get(winner) : 0 });
  }

  // 7. mile_eater: soma de distance_km
  {
    const score = new Map<string, number>();
    for (const [aid, list] of byAthlete) {
      let s = 0;
      for (const c of list) if (c.distance_km) s += c.distance_km;
      score.set(aid, Math.round(s));
    }
    const winner = topByScore(score);
    add("mile_eater", winner, { total_km: winner ? score.get(winner) : 0 });
  }

  // 8. phoenix: hiato >= 21 dias seguido de 3 semanas com >= 3 dias ativos
  {
    const score = new Map<string, number>();
    for (const [aid, list] of byAthlete) {
      const valid = list.filter((c) => c.is_valid).sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
      if (valid.length < 4) {
        score.set(aid, 0);
        continue;
      }
      let phoenixCount = 0;
      for (let i = 1; i < valid.length; i++) {
        const gap = (new Date(valid[i].occurred_at).getTime() - new Date(valid[i - 1].occurred_at).getTime()) / 86400000;
        if (gap < 21) continue;
        const afterStart = new Date(valid[i].occurred_at);
        const afterEnd = new Date(afterStart.getTime() + 21 * 86400000);
        const weekDays = new Map<string, Set<string>>();
        for (const c of valid) {
          const t = new Date(c.occurred_at);
          if (t >= afterStart && t <= afterEnd) {
            const wk = spWeekKey(c.occurred_at);
            if (!weekDays.has(wk)) weekDays.set(wk, new Set());
            weekDays.get(wk)!.add(spDateKey(c.occurred_at));
          }
        }
        const okWeeks = [...weekDays.values()].filter((s) => s.size >= 3).length;
        if (okWeeks >= 3) phoenixCount++;
      }
      score.set(aid, phoenixCount);
    }
    const winner = topByScore(score, activeDaysTotal);
    add("phoenix", winner, { comebacks: winner ? score.get(winner) : 0 });
  }

  // 9. early_bird
  {
    const score = new Map<string, number>();
    for (const [aid, list] of byAthlete) {
      let n = 0;
      for (const c of list) if (spHour(c.occurred_at) < 7) n++;
      score.set(aid, n);
    }
    const winner = topByScore(score);
    add("early_bird", winner, { early_checkins: winner ? score.get(winner) : 0 });
  }

  // 10. night_owl
  {
    const score = new Map<string, number>();
    for (const [aid, list] of byAthlete) {
      let n = 0;
      for (const c of list) if (spHour(c.occurred_at) >= 22) n++;
      score.set(aid, n);
    }
    const winner = topByScore(score);
    add("night_owl", winner, { late_checkins: winner ? score.get(winner) : 0 });
  }

  return results;
}
