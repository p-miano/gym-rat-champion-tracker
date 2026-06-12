import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Skull, Coins, CalendarDays } from "lucide-react";
import { getAnnualStanding, listMonths } from "@/lib/data.functions";

const YEAR = new Date().getFullYear();

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hall da Fama — Atletas com Dorflex" },
      { name: "description", content: "Pódio anual, bolada e o Cliente Ouro do Dorflex." },
    ],
  }),
  loader: async ({ context }) => {
    const standing = await context.queryClient.ensureQueryData(standingOpts());
    await context.queryClient.ensureQueryData(monthsOpts());
    return standing;
  },
  component: HomePage,
});

const standingOpts = () =>
  queryOptions({
    queryKey: ["annual", YEAR],
    queryFn: () => getAnnualStanding({ data: { year: YEAR } }),
  });
const monthsOpts = () =>
  queryOptions({ queryKey: ["months"], queryFn: () => listMonths() });

function HomePage() {
  const { data: standing } = useSuspenseQuery(standingOpts());
  const { data: months } = useSuspenseQuery(monthsOpts());

  const podium = standing.wins.slice(0, 3);
  const lastMonth = months[0];

  return (
    <div className="space-y-10">
      <section className="grid-bg rounded-2xl border border-border bg-card/40 p-8 md:p-12">
        <div className="text-xs uppercase tracking-[0.3em] text-primary/80">Temporada {YEAR}</div>
        <h1 className="display mt-2 text-5xl md:text-7xl text-lime-glow">Hall da Fama</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Quem mais venceu meses leva a bolada, se aposenta, faz a viagem dos sonhos e manda
          mensagem no Natal. O resto paga R$10. O lanterna paga R$20 e a vergonha.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Stat icon={<CalendarDays className="h-5 w-5" />} label="Meses fechados" value={standing.months} />
          <Stat icon={<Coins className="h-5 w-5" />} label="Bolada estimada" value={`R$ ${standing.pot}`} highlight />
          <Stat icon={<Skull className="h-5 w-5" />} label="Vagas na lanterna" value={standing.lasts_total} />
        </div>
      </section>

      <section>
        <SectionTitle icon={<Trophy className="h-5 w-5" />}>Pódio anual</SectionTitle>
        {podium.length === 0 ? (
          <Empty>Ninguém ganhou nada ainda. Importe um mês pra começar a humilhação.</Empty>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 0, 2].map((order, i) => {
              const w = podium[order];
              if (!w) return <div key={i} />;
              return (
                <PodiumCard key={w.athlete_id} place={order + 1} wins={w.wins} athlete={w.athlete} />
              );
            })}
          </div>
        )}
      </section>

      {standing.lasts.length > 0 && (
        <section>
          <SectionTitle icon={<Skull className="h-5 w-5" />}>
            Clientes Ouro do Dorflex 💊
          </SectionTitle>
          <div className="flex flex-wrap gap-3">
            {standing.lasts.map((l) => (
              <Link key={l.athlete_id} to="/atletas/$id" params={{ id: l.athlete_id }}>
                <div className="flex items-center gap-3 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm transition-colors hover:bg-destructive/20">
                  <Avatar src={l.athlete?.profile_picture_url} name={l.athlete?.full_name} size={28} />
                  <span className="font-medium">{l.athlete?.full_name}</span>
                  <Badge variant="destructive" className="ml-1">{l.count}x lanterna</Badge>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {lastMonth && (
        <section>
          <SectionTitle icon={<CalendarDays className="h-5 w-5" />}>Última rodada</SectionTitle>
          <Link to="/meses/$id" params={{ id: lastMonth.id }}>
            <Card className="transition-colors hover:bg-card/80">
              <CardHeader>
                <CardTitle className="display text-2xl">{lastMonth.name}</CardTitle>
                <CardDescription>
                  {lastMonth.winners.length > 0
                    ? `Campeão${lastMonth.winners.length > 1 ? "es" : ""}: ${lastMonth.winners.map((w: any) => w.full_name).join(", ")}`
                    : "Sem campeão ainda."}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </section>
      )}
    </div>
  );
}

function Stat({
  icon, label, value, highlight,
}: { icon: React.ReactNode; label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border ${highlight ? "border-primary/40 bg-primary/10" : "border-border bg-card/60"} p-5`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        {icon} {label}
      </div>
      <div className={`mt-2 display text-4xl ${highlight ? "text-lime-glow" : ""}`}>{value}</div>
    </div>
  );
}

function SectionTitle({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="display mb-4 flex items-center gap-2 text-2xl uppercase tracking-wider text-foreground/90">
      {icon}
      {children}
    </h2>
  );
}

function PodiumCard({ place, wins, athlete }: { place: number; wins: number; athlete: any }) {
  const sizes = { 1: "md:scale-110 md:-translate-y-2", 2: "", 3: "" } as Record<number, string>;
  const colors = {
    1: "border-primary/60 bg-primary/10",
    2: "border-border bg-card/80",
    3: "border-border bg-card/60",
  } as Record<number, string>;
  return (
    <Link to="/atletas/$id" params={{ id: athlete?.id ?? "" }}>
      <div className={`rounded-2xl border p-6 text-center transition-all ${colors[place]} ${sizes[place] ?? ""}`}>
        <div className="display text-5xl text-lime-glow">{place === 1 ? "🥇" : place === 2 ? "🥈" : "🥉"}</div>
        <div className="mt-3 flex justify-center">
          <Avatar src={athlete?.profile_picture_url} name={athlete?.full_name} size={64} />
        </div>
        <div className="display mt-3 text-xl">{athlete?.full_name}</div>
        <div className="mt-1 text-sm text-muted-foreground">{wins} {wins === 1 ? "vitória" : "vitórias"}</div>
      </div>
    </Link>
  );
}

export function Avatar({ src, name, size = 40 }: { src?: string | null; name?: string | null; size?: number }) {
  const initials = (name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return src ? (
    <img
      src={src}
      alt={name ?? ""}
      width={size}
      height={size}
      className="rounded-full border border-border object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="grid place-items-center rounded-full border border-border bg-secondary text-secondary-foreground"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center text-muted-foreground">
      {children}
    </div>
  );
}
