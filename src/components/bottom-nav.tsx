import { Link } from "@tanstack/react-router";
import { Trophy, Calendar, Users } from "lucide-react";

const tabs = [
  { to: "/", label: "Placar", icon: Trophy, exact: true },
  { to: "/meses", label: "Meses", icon: Calendar, exact: false },
  { to: "/atletas", label: "Atletas", icon: Users, exact: false },
] as const;

export function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-3">
        {tabs.map(({ to, label, icon: Icon, exact }) => (
          <li key={to}>
            <Link
              to={to}
              activeOptions={{ exact }}
              className="flex h-14 flex-col items-center justify-center gap-1 text-muted-foreground transition-colors"
              activeProps={{
                className:
                  "flex h-14 flex-col items-center justify-center gap-1 text-foreground",
              }}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[11px] font-medium">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
