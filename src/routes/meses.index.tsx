import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Skull } from "lucide-react";
import { listMonths } from "@/lib/data.functions";
import { Avatar } from "./index";

const MONTH_NAMES = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const monthsOpts = () => queryOptions({ queryKey: ["months"], queryFn: () => listMonths() });

export const Route = createFileRoute("/meses/")({
  head: () => ({ meta: [{ title: "Meses — Atletas com Dorflex" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(monthsOpts()),
  component: MonthsPage,
});

function MonthsPage() {
  const { data: months } = useSuspenseQuery(monthsOpts());
  return (
    <div className="space-y-6">
      <h1 className="display text-4xl text-lime">Meses do desafio</h1>
      {months.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          Ainda não rolou import. Vai ali em <Link to="/importar" className="underline">Importar</Link>.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {months.map((m: any) => (
            <Link key={m.id} to="/meses/$id" params={{ id: m.id }}>
              <Card className="transition-colors hover:bg-card/80">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="uppercase">
                      {MONTH_NAMES[m.month]} / {m.year}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{m.total_athletes} atletas</span>
                  </div>
                  <CardTitle className="display mt-2 text-2xl">{m.name}</CardTitle>
                  <CardDescription>
                    Importado em {new Date(m.imported_at).toLocaleDateString("pt-BR")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Row icon={<Trophy className="h-4 w-4 text-primary" />} label={m.winners.length > 1 ? "Campeões" : "Campeão"}>
                    {m.winners.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      m.winners.map((w: any) => (
                        <Pill key={w.athlete_id} src={w.profile_picture_url} name={w.full_name} suffix={`${w.active_days}d`} />
                      ))
                    )}
                  </Row>
                  <Row icon={<Skull className="h-4 w-4 text-destructive" />} label="Cliente Ouro">
                    {m.lasts.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      m.lasts.map((w: any) => (
                        <Pill key={w.athlete_id} src={w.profile_picture_url} name={w.full_name} suffix={`${w.active_days}d`} variant="destructive" />
                      ))
                    )}
                  </Row>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="mt-1 flex flex-wrap gap-2">{children}</div>
      </div>
    </div>
  );
}
function Pill({ src, name, suffix, variant }: { src?: string | null; name: string; suffix?: string; variant?: "destructive" }) {
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-2 py-1 text-xs ${variant === "destructive" ? "border-destructive/40 bg-destructive/10" : "border-primary/30 bg-primary/10"}`}>
      <Avatar src={src} name={name} size={20} />
      <span className="font-medium">{name}</span>
      {suffix && <span className="text-muted-foreground">{suffix}</span>}
    </div>
  );
}
