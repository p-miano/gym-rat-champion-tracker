import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Dumbbell, LogIn, LogOut, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setEmail(s?.user.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground">
            <Dumbbell className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="display text-lg text-lime-glow">Atletas com Dorflex</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              placar anual · 2026
            </div>
          </div>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          <NavLink to="/">Hall da Fama</NavLink>
          <NavLink to="/meses">Meses</NavLink>
          <NavLink to="/atletas">Atletas</NavLink>
        </nav>
        <div className="flex items-center gap-2">
          {email ? (
            <>
              <Link to="/importar">
                <Button size="sm" variant="secondary" className="gap-2">
                  <Upload className="h-4 w-4" /> Importar
                </Button>
              </Link>
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
