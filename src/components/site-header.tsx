import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Dumbbell, LogIn, LogOut, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const [signedIn, setSignedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function refresh(userId: string | null) {
      setSignedIn(!!userId);
      if (!userId) {
        setIsAdmin(false);
        return;
      }
      const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
      setIsAdmin(!!data);
    }
    supabase.auth.getSession().then(({ data }) => refresh(data.session?.user.id ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => refresh(s?.user.id ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur">
      <div className="container mx-auto grid h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 sm:flex sm:justify-between">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
            <Dumbbell className="h-5 w-5" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="display truncate text-base text-lime md:text-lg">Atletas com Dorflex</div>
            <div className="hidden text-[10px] uppercase tracking-widest text-muted-foreground sm:block">
              placar · temporada 2026 / 2027
            </div>
          </div>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          <NavLink to="/">PLACAR</NavLink>
          <NavLink to="/meses">Meses</NavLink>
          <NavLink to="/atletas">Atletas</NavLink>
        </nav>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {email ? (
            <>
              {isAdmin && (
                <Link to="/importar">
                  <Button size="sm" variant="secondary" className="gap-2">
                    <Upload className="h-4 w-4" />
                    <span className="hidden sm:inline">Importar</span>
                  </Button>
                </Link>
              )}
              <Button size="sm" variant="ghost" onClick={signOut} className="gap-2">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            </>
          ) : (
            <Link to="/auth">
              <Button size="sm" variant="secondary" className="gap-2">
                <LogIn className="h-4 w-4" /> Entrar
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      activeProps={{ className: "rounded-md px-3 py-1.5 text-sm font-medium text-foreground bg-accent" }}
    >
      {children}
    </Link>
  );
}
