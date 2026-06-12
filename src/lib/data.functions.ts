// Public read server functions (use admin client inside handler for safe projections).
import { createServerFn } from "@tanstack/react-start";

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
    .select("month_id, athlete_id, active_days, rank, is_winner, is_last, athletes(full_name, profile_picture_url)");

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
    return {
      ...m,
      winners: winners.map((w) => ({
        athlete_id: w.athlete_id,
        full_name: w.athletes?.full_name,
        profile_picture_url: w.athletes?.profile_picture_url,
        active_days: w.active_days,
      })),
      lasts: lasts.map((w) => ({
        athlete_id: w.athlete_id,
        full_name: w.athletes?.full_name,
        profile_picture_url: w.athletes?.profile_picture_url,
        active_days: w.active_days,
      })),
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
        .select("*, athletes(id, full_name, profile_picture_url)")
        .eq("month_id", data.id)
        .order("rank"),
      supabaseAdmin
        .from("check_ins")
        .select("*")
        .eq("month_id", data.id)
        .order("occurred_at"),
    ]);
    if (!month) throw new Error("Mês não encontrado");
    return { month, results: results ?? [], check_ins: checkIns ?? [] };
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
        pot: 0,
        last_month_winner: null,
        last_month_lasts: [] as any[],
      };
    }
    const { data: results } = await supabaseAdmin
      .from("month_results")
      .select("month_id, athlete_id, is_winner, is_last, active_days, athletes(id, full_name, profile_picture_url)")
      .in("month_id", monthIds);

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
      pot,
    };
  });

export const getAthlete = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: athlete }, { data: checkIns }, { data: monthResults }, { data: awards }] = await Promise.all([
      supabaseAdmin.from("athletes").select("*").eq("id", data.id).single(),
      supabaseAdmin.from("check_ins").select("*").eq("athlete_id", data.id).order("occurred_at"),
      supabaseAdmin
        .from("month_results")
        .select("*, months(id, year, month, name)")
        .eq("athlete_id", data.id),
      supabaseAdmin.from("annual_awards").select("*").eq("athlete_id", data.id),
    ]);
    if (!athlete) throw new Error("Atleta não encontrado");
    return {
      athlete,
      check_ins: checkIns ?? [],
      month_results: monthResults ?? [],
      awards: awards ?? [],
    };
  });

export const listAthletes = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("athletes")
    .select("id, full_name, profile_picture_url")
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
