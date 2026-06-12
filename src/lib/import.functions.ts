// Server functions: importação e leituras.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  parseExport,
  spDateKey,
  type GymRatsExport,
  type ParsedMonth,
} from "./gymrats-parser";
import { computeAwards, type AwardCheckIn } from "./awards";

function assertAdmin(supabase: any, userId: string) {
  return supabase
    .rpc("has_role", { _user_id: userId, _role: "admin" })
    .then(({ data, error }: any) => {
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Forbidden: admin only");
    });
}

function rankingFromCheckIns(
  athleteIds: string[],
  checkIns: { athlete_id: string; occurred_at: string; is_valid: boolean; duration_min: number | null; distance_km: number | null }[],
) {
  const stats = new Map<
    string,
    { days: Set<string>; total: number; minutes: number; km: number }
  >();
  for (const a of athleteIds) stats.set(a, { days: new Set(), total: 0, minutes: 0, km: 0 });
  for (const c of checkIns) {
    const s = stats.get(c.athlete_id);
    if (!s) continue;
    s.total += 1;
    s.minutes += c.duration_min ?? 0;
    s.km += c.distance_km ?? 0;
    if (c.is_valid) s.days.add(spDateKey(c.occurred_at));
  }
  const rows = [...stats.entries()].map(([athlete_id, s]) => ({
    athlete_id,
    active_days: s.days.size,
    total_checkins: s.total,
    total_minutes: s.minutes,
    total_distance_km: Math.round(s.km * 100) / 100,
  }));
  rows.sort((a, b) => b.active_days - a.active_days || b.total_minutes - a.total_minutes);
  let rank = 0;
  let prevDays = -1;
  const ranked = rows.map((r, i) => {
    if (r.active_days !== prevDays) {
      rank = i + 1;
      prevDays = r.active_days;
    }
    return { ...r, rank };
  });
  const maxDays = ranked[0]?.active_days ?? 0;
  const minDays = ranked[ranked.length - 1]?.active_days ?? 0;
  return ranked.map((r) => ({
    ...r,
    is_winner: r.active_days === maxDays && maxDays > 0,
    is_last: r.active_days === minDays && ranked.length > 1,
  }));
}

export const importMonth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { payload: GymRatsExport }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const parsed: ParsedMonth = parseExport(data.payload);

    // Upsert month
    const { data: monthRow, error: monthErr } = await supabaseAdmin
      .from("months")
      .upsert(
        {
          year: parsed.year,
          month: parsed.month,
          name: parsed.name,
          source_id: parsed.source_id,
          created_by: context.userId,
          imported_at: new Date().toISOString(),
        },
        { onConflict: "year,month" },
      )
      .select("id")
      .single();
    if (monthErr || !monthRow) throw new Error(monthErr?.message ?? "Falha ao salvar mês");

    // Upsert athletes
    const athleteRows = parsed.members.map((m) => ({
      gymrats_id: m.id,
      full_name: m.full_name,
      profile_picture_url: m.profile_picture_url,
    }));
    if (athleteRows.length) {
      const { error } = await supabaseAdmin
        .from("athletes")
        .upsert(athleteRows, { onConflict: "gymrats_id" });
      if (error) throw new Error(error.message);
    }

    // Get athlete id map
    const gymIds = parsed.members.map((m) => m.id);
    const { data: athletes, error: athErr } = await supabaseAdmin
      .from("athletes")
      .select("id, gymrats_id")
      .in("gymrats_id", gymIds);
    if (athErr) throw new Error(athErr.message);
    const idMap = new Map<number, string>();
    for (const a of athletes ?? []) idMap.set(a.gymrats_id as number, a.id as string);

    // Replace check-ins for this month
    await supabaseAdmin.from("check_ins").delete().eq("month_id", monthRow.id);

    const ciRows = parsed.check_ins
      .map((c) => {
        const aid = idMap.get(c.gymrats_member_id);
        if (!aid) return null;
        return {
          id: c.id,
          month_id: monthRow.id,
          athlete_id: aid,
          occurred_at: c.occurred_at,
          duration_min: c.duration_min,
          distance_km: c.distance_km,
          location_latitude: c.location_latitude,
          location_longitude: c.location_longitude,
          location_name: c.location_name,
          has_photo: c.has_photo,
          photo_url: c.photo_url,
          title: c.title,
          description: c.description,
          activity_type: c.activity_type,
          reactions: c.reactions,
          is_valid: c.is_valid,
          invalid_reasons: c.invalid_reasons,
          raw: c.raw as any,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (ciRows.length) {
      // chunked insert to avoid payload limits
      const chunk = 200;
      for (let i = 0; i < ciRows.length; i += chunk) {
        const slice = ciRows.slice(i, i + chunk);
        const { error } = await supabaseAdmin.from("check_ins").upsert(slice);
        if (error) throw new Error(error.message);
      }
    }

    // Recompute month_results
    await supabaseAdmin.from("month_results").delete().eq("month_id", monthRow.id);
    const athleteIds = [...idMap.values()];
    const results = rankingFromCheckIns(
      athleteIds,
      ciRows.map((r) => ({
        athlete_id: r.athlete_id,
        occurred_at: r.occurred_at,
        is_valid: r.is_valid,
        duration_min: r.duration_min,
        distance_km: r.distance_km,
      })),
    ).map((r) => ({ ...r, month_id: monthRow.id }));
    if (results.length) {
      const { error } = await supabaseAdmin.from("month_results").insert(results);
      if (error) throw new Error(error.message);
    }

    // Recompute awards for the year
    await recomputeAwardsForYear(supabaseAdmin, parsed.year);

    return {
      month_id: monthRow.id,
      year: parsed.year,
      month: parsed.month,
      members: parsed.members.length,
      check_ins: ciRows.length,
      invalid: ciRows.filter((r) => !r.is_valid).length,
    };
  });

async function recomputeAwardsForYear(admin: any, year: number) {
  const { data: months } = await admin.from("months").select("id").eq("year", year);
  const monthIds = (months ?? []).map((m: any) => m.id);
  if (!monthIds.length) return;

  const { data: checkIns } = await admin
    .from("check_ins")
    .select(
      "athlete_id, occurred_at, is_valid, distance_km, duration_min, activity_type, title, description, location_latitude, location_longitude, reactions, raw",
    )
    .in("month_id", monthIds);

  const awards = computeAwards((checkIns ?? []) as AwardCheckIn[]);
  await admin.from("annual_awards").delete().eq("year", year);
  const rows = awards
    .filter((a) => a.athlete_id)
    .map((a) => ({
      year,
      athlete_id: a.athlete_id!,
      award_key: a.award_key,
      details: a.details,
    }));
  if (rows.length) {
    const { error } = await admin.from("annual_awards").insert(rows);
    if (error) throw new Error(error.message);
  }
}

export const recomputeAwards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { year: number }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await recomputeAwardsForYear(supabaseAdmin, data.year);
    return { ok: true, year: data.year };
  });

export const deleteMonth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { month_id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: month } = await supabaseAdmin.from("months").select("year").eq("id", data.month_id).single();
    const { error } = await supabaseAdmin.from("months").delete().eq("id", data.month_id);
    if (error) throw new Error(error.message);
    if (month?.year) await recomputeAwardsForYear(supabaseAdmin, month.year);
    return { ok: true };
  });
