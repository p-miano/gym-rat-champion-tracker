// Engine de prêmios. Funções puras sobre os check-ins do ano.
import { spDateKey, spHour, spWeekKey } from "./gymrats-parser";

export interface AwardCheckIn {
  athlete_id: string;
  occurred_at: string;
  is_valid: boolean;
  distance_km: number | null;
  activity_type: string | null;
  title: string | null;
  description: string | null;
  location_latitude: number | null;
  location_longitude: number | null;
  reactions: string[];
}

export interface AwardResult {
  award_key: string;
  athlete_id: string | null;
  details: Record<string, unknown>;
}

interface MonthLast {
  athlete_id: string;
  is_last: boolean;
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

const HYPO_RE = /sinusit|laringit|dorflex|virose|quase morri|gripad|lesão|lesionad|resfriad|febre|dor de cabeça|enxaqueca|enjoo|gastrite/i;
const FLEX_RE = /pilate|lpo|levantamento|alongamento|stretch|yoga|funcional/i;

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

export function computeAwards(
  checkIns: AwardCheckIn[],
  monthLasts: MonthLast[],
): AwardResult[] {
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

  // 2. calendar_cheater: nº de semanas com 3+ treinos em 3 dias consecutivos
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
      for (const days of weekDays.values()) {
        const sorted = [...days].sort();
        // procura janela de 3 dias consecutivos
        for (let i = 0; i + 2 < sorted.length; i++) {
          const d0 = new Date(sorted[i] + "T00:00:00Z").getTime();
          const d2 = new Date(sorted[i + 2] + "T00:00:00Z").getTime();
          if ((d2 - d0) / 86400000 <= 2) {
            n++;
            break;
          }
        }
      }
      score.set(aid, n);
    }
    const winner = topByScore(score, activeDaysTotal);
    add("calendar_cheater", winner, { compressed_weeks: winner ? score.get(winner) : 0 });
  }

  // 3. dorflex_sponsor
  {
    const score = new Map<string, number>();
    for (const m of monthLasts) {
      if (!m.is_last) continue;
      score.set(m.athlete_id, (score.get(m.athlete_id) ?? 0) + 1);
    }
    const winner = topByScore(score);
    add("dorflex_sponsor", winner, { times_last: winner ? score.get(winner) : 0 });
  }

  // 4. flexible_iron
  {
    const score = new Map<string, number>();
    for (const [aid, list] of byAthlete) {
      let n = 0;
      for (const c of list) {
        const blob = `${c.activity_type ?? ""} ${c.title ?? ""}`;
        if (FLEX_RE.test(blob)) n++;
      }
      score.set(aid, n);
    }
    const winner = topByScore(score);
    add("flexible_iron", winner, { matches: winner ? score.get(winner) : 0 });
  }

  // 5. no_borders: distância > 50km do centróide pessoal
  {
    const score = new Map<string, number>();
    for (const [aid, list] of byAthlete) {
      const geo = list.filter(
        (c) => c.location_latitude != null && c.location_longitude != null,
      );
      if (geo.length < 3) {
        score.set(aid, 0);
        continue;
      }
      const cLat = geo.reduce((s, c) => s + (c.location_latitude ?? 0), 0) / geo.length;
      const cLng = geo.reduce((s, c) => s + (c.location_longitude ?? 0), 0) / geo.length;
      let n = 0;
      for (const c of geo) {
        const d = haversineKm(
          { lat: cLat, lng: cLng },
          { lat: c.location_latitude!, lng: c.location_longitude! },
        );
        if (d >= 50) n++;
      }
      score.set(aid, n);
    }
    const winner = topByScore(score, activeDaysTotal);
    add("no_borders", winner, { far_checkins: winner ? score.get(winner) : 0 });
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

  // 7. hypochondriac
  {
    const score = new Map<string, number>();
    for (const [aid, list] of byAthlete) {
      let n = 0;
      for (const c of list) {
        const blob = `${c.title ?? ""} ${c.description ?? ""}`;
        if (HYPO_RE.test(blob)) n++;
      }
      score.set(aid, n);
    }
    const winner = topByScore(score);
    add("hypochondriac", winner, { complaints: winner ? score.get(winner) : 0 });
  }

  // 8. mile_eater: soma de distance_km
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

  // 9. phoenix: hiato >= 21 dias seguido de 3 semanas com >= 3 dias ativos
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
        // 3 semanas após
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

  // 10. early_bird
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

  // 11. night_owl
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
