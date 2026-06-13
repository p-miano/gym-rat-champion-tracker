// Public read server functions (use admin client inside handler for safe projections).
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

async function isCallerAuthenticated(): Promise<boolean> {
  try {
    const request = getRequest();
    const auth = request?.headers?.get("authorization");
    if (!auth || !auth.startsWith("Bearer ")) return false;
    const token = auth.replace("Bearer ", "");
    if (!token) return false;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return false;
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });
    const { data, error } = await client.auth.getClaims(token);
    return !error && !!data?.claims?.sub;
  } catch {
    return false;
  }
}

function coarsen(v: number | null | undefined): number | null {
  if (v == null) return null;
  return Math.round(Number(v) * 100) / 100;
}

function scrubCheckIns<T extends Record<string, any>>(rows: T[], authed: boolean): T[] {
  if (authed) return rows;
  return rows.map((r) => ({
    ...r,
    raw: null,
    location_latitude: coarsen(r.location_latitude),
    location_longitude: coarsen(r.location_longitude),
  }));
}

export const listMonths = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: months, error } = await supabaseAdmin
    .from("months")
    .select("id, year, month, name, source_id, imported_at")
    .order("year", { ascending: false })
    .order("month", { ascending: false });
  if (error) throw new Error(error.message);

  const { data: results } = await supabaseAdmin
    .from("month_results")
    .select("month_id, athlete_id, active_days, rank, is_winner, is_last, athletes(id, full_name, profile_picture_url, display_mode, public_nickname, show_google_photo, google_photo_url)");

  const byMonth = new Map<string, any[]>();
  for (const r of results ?? []) {
    const arr = byMonth.get(r.month_id as string) ?? [];
    arr.push(r);
    byMonth.set(r.month_id as string, arr);
  }
  return (months ?? []).map((m) => {
    const rows = byMonth.get(m.id) ?? [];
    const winners = rows.filter((r) => r.is_winner);
    const lasts = rows.filter((r) => r.is_last);

    // 2º e 3º: próximos ranks distintos depois do 1º (excluindo lanternas)
    const nonWinner = rows
      .filter((r) => !r.is_winner && !r.is_last)
      .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
    const distinctRanks: number[] = [];
    for (const r of nonWinner) {
      const rk = r.rank as number;
      if (!distinctRanks.includes(rk)) distinctRanks.push(rk);
      if (distinctRanks.length >= 2) break;
    }
    const secondRank = distinctRanks[0];
    const thirdRank = distinctRanks[1];
    const seconds = secondRank != null ? nonWinner.filter((r) => r.rank === secondRank) : [];
    const thirds = thirdRank != null ? nonWinner.filter((r) => r.rank === thirdRank) : [];

    const mapRow = (w: any) => ({
      athlete_id: w.athlete_id,
      id: w.athletes?.id ?? w.athlete_id,
      full_name: w.athletes?.full_name,
      profile_picture_url: w.athletes?.profile_picture_url,
      display_mode: w.athletes?.display_mode,
      public_nickname: w.athletes?.public_nickname,
      show_google_photo: w.athletes?.show_google_photo,
      google_photo_url: w.athletes?.google_photo_url,
      active_days: w.active_days,
    });

    return {
      ...m,
      winners: winners.map(mapRow),
      seconds: seconds.map(mapRow),
      thirds: thirds.map(mapRow),
      lasts: lasts.map(mapRow),
      total_athletes: rows.length,
    };
  });
});


export const getMonth = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: month }, { data: results }, { data: checkIns }] = await Promise.all([
      supabaseAdmin.from("months").select("*").eq("id", data.id).single(),
      supabaseAdmin
        .from("month_results")
        .select("*, athletes(id, full_name, profile_picture_url, display_mode, public_nickname, show_google_photo, google_photo_url)")
        .eq("month_id", data.id)
        .order("rank"),
      supabaseAdmin
        .from("check_ins")
        .select("*")
        .eq("month_id", data.id)
        .order("occurred_at"),
    ]);
    if (!month) throw new Error("Mês não encontrado");
    const authed = await isCallerAuthenticated();
    return { month, results: results ?? [], check_ins: scrubCheckIns(checkIns ?? [], authed) };
  });

export const getAnnualStanding = createServerFn({ method: "GET" })
  .inputValidator((d: { year: number }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: months } = await supabaseAdmin
      .from("months")
      .select("id, year, month")
      .eq("year", data.year);
    const monthIds = (months ?? []).map((m) => m.id);
    const daysSpan = (months ?? []).reduce(
      (acc, m: any) => acc + new Date(m.year, m.month, 0).getDate(),
      0,
    );
    if (!monthIds.length) {
      return {
        days_span: 0,
        total_active_days: 0,
        active_days_ranking: [] as any[],
        year: data.year,
        months: 0,
        athletes: 0,
        wins: [] as any[],
        lasts_total: 0,
        lasts: [] as any[],
        awards: [] as any[],
        pot: 0,
      };
    }
    const [{ data: results }, { data: awardsRaw }] = await Promise.all([
      supabaseAdmin
        .from("month_results")
        .select("month_id, athlete_id, is_winner, is_last, active_days, athletes(id, full_name, profile_picture_url, display_mode, public_nickname, show_google_photo, google_photo_url)")
        .in("month_id", monthIds),
      supabaseAdmin
        .from("annual_awards")
        .select("award_key, athlete_id, details, athletes(id, full_name, profile_picture_url, display_mode, public_nickname, show_google_photo, google_photo_url)")
        .eq("year", data.year),
    ]);

    const wins = new Map<string, { count: number; athlete: any }>();
    const lasts = new Map<string, { count: number; athlete: any }>();
    const activeDaysByAthlete = new Map<string, { days: number; athlete: any }>();
    const athleteSet = new Set<string>();
    let lastsTotal = 0;
    let totalActiveDays = 0;
    for (const r of results ?? []) {
      athleteSet.add(r.athlete_id as string);
      totalActiveDays += r.active_days ?? 0;
      const cur = activeDaysByAthlete.get(r.athlete_id as string) ?? { days: 0, athlete: r.athletes };
      cur.days += r.active_days ?? 0;
      cur.athlete = r.athletes;
      activeDaysByAthlete.set(r.athlete_id as string, cur);
      if (r.is_winner) {
        const cw = wins.get(r.athlete_id as string) ?? { count: 0, athlete: r.athletes };
        cw.count++;
        cw.athlete = r.athletes;
        wins.set(r.athlete_id as string, cw);
      }
      if (r.is_last) {
        lastsTotal++;
        const cl = lasts.get(r.athlete_id as string) ?? { count: 0, athlete: r.athletes };
        cl.count++;
        cl.athlete = r.athletes;
        lasts.set(r.athlete_id as string, cl);
      }
    }
    const winsList = [...wins.entries()]
      .map(([id, v]) => ({ athlete_id: id, wins: v.count, athlete: v.athlete }))
      .sort((a, b) => b.wins - a.wins);
    const activeDaysRanking = [...activeDaysByAthlete.entries()]
      .map(([id, v]) => ({ athlete_id: id, active_days: v.days, athlete: v.athlete }))
      .sort((a, b) => b.active_days - a.active_days);
    const pot = 10 * monthIds.length * athleteSet.size + 10 * lastsTotal;
    return {
      year: data.year,
      months: monthIds.length,
      days_span: daysSpan,
      total_active_days: totalActiveDays,
      active_days_ranking: activeDaysRanking,
      athletes: athleteSet.size,
      wins: winsList,
      lasts_total: lastsTotal,
      lasts: [...lasts.entries()]
        .map(([id, v]) => ({ athlete_id: id, count: v.count, athlete: v.athlete }))
        .sort((a, b) => b.count - a.count),
      awards: (awardsRaw ?? []).map((a: any) => ({
        award_key: a.award_key,
        athlete_id: a.athlete_id,
        athlete: a.athletes,
        details: a.details,
      })),
      pot,
    };
  });

export const getAthlete = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: athlete }, { data: checkIns }, { data: monthResults }, { data: awards }, { data: maxRow }] = await Promise.all([
      supabaseAdmin.from("athletes").select("*").eq("id", data.id).single(),
      supabaseAdmin.from("check_ins").select("*").eq("athlete_id", data.id).order("occurred_at"),
      supabaseAdmin
        .from("month_results")
        .select("*, months(id, year, month, name)")
        .eq("athlete_id", data.id),
      supabaseAdmin.from("annual_awards").select("*").eq("athlete_id", data.id),
      supabaseAdmin.from("check_ins").select("occurred_at").order("occurred_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (!athlete) throw new Error("Atleta não encontrado");
    const authed = await isCallerAuthenticated();
    const { claimed_by_user_id, ...athletePublic } = athlete as any;
    return {
      athlete: authed ? athlete : athletePublic,
      check_ins: scrubCheckIns(checkIns ?? [], authed),
      month_results: monthResults ?? [],
      awards: awards ?? [],
      dataset_max_occurred_at: (maxRow?.occurred_at as string | null) ?? null,
    };
  });

export const listAthletes = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("athletes")
    .select("id, full_name, profile_picture_url, display_mode, public_nickname, show_google_photo, google_photo_url")
    .order("full_name");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const isCurrentUserAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const { getRequest } = await import("@tanstack/react-start/server");
  const req = getRequest();
  const auth = req?.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return { admin: false };
  const token = auth.replace("Bearer ", "");
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: claims } = await supabase.auth.getClaims(token);
  if (!claims?.claims?.sub) return { admin: false };
  const { data } = await supabase.rpc("has_role", { _user_id: claims.claims.sub, _role: "admin" });
  return { admin: !!data };
});
