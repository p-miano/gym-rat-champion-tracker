// Redirect freshly-authenticated users to /onboarding until they finish it.
import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const ALLOWED_PATHS = ["/onboarding", "/auth"];

export function OnboardingGate() {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;

    async function check() {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
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
      } catch {
        // ignore
      }
    }

    check();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") check();
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
