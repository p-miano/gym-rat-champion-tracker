// Redirect freshly-authenticated users to /onboarding until they finish it.
import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const ALLOWED_PATHS = ["/onboarding", "/auth"];

export function OnboardingGate() {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;

    async function waitForSession(timeoutMs = 5000) {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) return data.session;

      return await new Promise<typeof data.session>((resolve) => {
        const timer = setTimeout(() => {
          sub.data.subscription.unsubscribe();
          resolve(null);
        }, timeoutMs);

        const sub = supabase.auth.onAuthStateChange((_event, session) => {
          if (session?.access_token) {
            clearTimeout(timer);
            sub.data.subscription.unsubscribe();
            resolve(session);
          }
        });
      });
    }

    async function check() {
      const session = await waitForSession();
      if (!session) return;
      const path = window.location.pathname;
      if (ALLOWED_PATHS.includes(path)) return;
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarded_at")
          .eq("id", session.user.id)
          .maybeSingle();
        if (cancelled) return;
        if (!profile?.onboarded_at) {
          router.navigate({ to: "/onboarding" });
        }
      } catch (error) {
        console.error("[onboarding-gate] falha ao consultar perfil:", error);
      }
    }

    check();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "USER_UPDATED") {
        if (session?.access_token) check();
      }
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
