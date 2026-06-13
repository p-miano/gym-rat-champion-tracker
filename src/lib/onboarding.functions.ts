// Onboarding server functions: validate group code, list claimable athletes,
// link athlete to user, save privacy preferences.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const DisplayMode = z.enum(["placeholder", "real"]);

export const getMyOnboardingState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, linked_athlete_id, onboarded_at")
      .eq("id", context.userId)
      .maybeSingle();
    return {
      userId: context.userId,
      onboarded: !!profile?.onboarded_at,
      linked_athlete_id: profile?.linked_athlete_id ?? null,
    };
  });

export const validateGroupCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ code: z.string().trim().min(1).max(32) }).parse(d),
  )
  .handler(async ({ data }) => {
    const code = data.code.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length < 4) {
      throw new Error("Código inválido. Use o código de convite do GymRats fornecido pelo administrador.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("valid_group_codes")
      .select("code, gymrats_group_id, label")
      .eq("code", code)
      .maybeSingle();
    if (!row) {
      throw new Error("Código inválido. Use o código de convite do GymRats fornecido pelo administrador.");
    }

    const { data: athletes } = await supabaseAdmin
      .from("athletes")
      .select("id, full_name, claimed_by_user_id")
      .order("full_name");
    return {
      group: { gymrats_group_id: row.gymrats_group_id, name: row.label ?? "" },
      athletes: (athletes ?? []).map((a) => ({
        id: a.id as string,
        full_name: a.full_name as string,
        claimed: !!a.claimed_by_user_id,
      })),
    };
  });

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        group_code: z.string().trim().min(1).max(32),
        athlete_id: z.string().uuid(),
        display_mode: DisplayMode,
        show_google_photo: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const code = data.group_code.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length < 4) throw new Error("Código inválido.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("valid_group_codes")
      .select("gymrats_group_id")
      .eq("code", code)
      .maybeSingle();
    if (!row) throw new Error("Código inválido. Use o código de convite do GymRats fornecido pelo administrador.");

    // Ensure athlete exists and is not already claimed by someone else
    const { data: athlete } = await supabaseAdmin
      .from("athletes")
      .select("id, claimed_by_user_id")
      .eq("id", data.athlete_id)
      .maybeSingle();
    if (!athlete) throw new Error("Atleta não encontrado.");
    if (athlete.claimed_by_user_id && athlete.claimed_by_user_id !== context.userId) {
      throw new Error("Este atleta já foi vinculado a outra conta.");
    }

    // Get Google avatar from auth user metadata
    const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const googlePhoto =
      (userRes?.user?.user_metadata?.avatar_url as string | undefined) ??
      (userRes?.user?.user_metadata?.picture as string | undefined) ??
      null;

    // Release any previous claim by this user
    await supabaseAdmin
      .from("athletes")
      .update({ claimed_by_user_id: null })
      .eq("claimed_by_user_id", context.userId)
      .neq("id", data.athlete_id);

    const { error: athErr } = await supabaseAdmin
      .from("athletes")
      .update({
        claimed_by_user_id: context.userId,
        display_mode: data.display_mode,
        public_nickname: data.public_nickname ?? null,
        show_google_photo: data.show_google_photo,
        google_photo_url: googlePhoto,
      })
      .eq("id", data.athlete_id);
    if (athErr) throw new Error(athErr.message);

    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .update({
        linked_athlete_id: data.athlete_id,
        onboarded_at: new Date().toISOString(),
      })
      .eq("id", context.userId);
    if (profErr) throw new Error(profErr.message);

    return { ok: true };
  });
