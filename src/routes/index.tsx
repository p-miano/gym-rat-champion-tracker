import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Skull, Coins, CalendarDays, Flame } from "lucide-react";
import { getAnnualStanding, listMonths } from "@/lib/data.functions";

const YEAR = new Date().getFullYear();
const SEASON_LABEL = "2026 / 2027";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Placar Geral — Atletas com Dorflex" },
      { name: "description", content: "Placar geral, bolada acumulada e o Lanterna do Dorflex." },
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

  // Group winners by win count → ties share a card
  const podiumGroups: { wins: number; athletes: any[] }[] = [];
  for (const w of standing.wins) {
    const last = podiumGroups[podiumGroups.length - 1];
    if (last && last.wins === w.wins) last.athletes.push(w.athlete);
    else podiumGroups.push({ wins: w.wins, athletes: [w.athlete] });
    if (podiumGroups.length >= 3) break;
  }

  const lastMonth = months[0];

  return (
    <div className="space-y-12">
      <section className="grid-bg rounded-none border-2 border-border bg-card/40 p-8 md:p-12">
        <div className="font-condensed text-xs text-primary">// Temporada {SEASON_LABEL}</div>
        <h1 className="display mt-2 text-6xl md:text-8xl text-lime">Placar Geral</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Quem mais venceu meses leva a bolada, se aposenta, faz a viagem dos sonhos e manda
          mensagem no Natal. O resto paga R$10. O lanterna paga R$20 e a vergonha.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Stat icon={<CalendarDays className="h-5 w-5" />} label="Meses Fechados" value={standing.months} />
          <Stat icon={<Coins className="h-5 w-5" />} label="Bolada Acumulada" value={`R$ ${standing.pot}`} highlight />
        </div>
        {standing.total_active_days > 0 && (
          <p className="mt-6 font-condensed text-sm uppercase tracking-wider text-foreground/90">
            <span className="text-lime">{standing.total_active_days}</span> dias ativos foram registrados ao longo de{" "}
            <span className="text-lime">{standing.days_span}</span> dias por{" "}
            <span className="text-lime">{standing.athletes}</span> atletas. Bom trabalho!
          </p>
        )}
      </section>

      <section>
        <SectionTitle icon={<Trophy className="h-5 w-5" />}>Pódio anual · Campeões</SectionTitle>
        {podiumGroups.length === 0 ? (
          <Empty>Ninguém ganhou nada ainda. Importe um mês pra começar a humilhação.</Empty>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 0, 2].map((order, i) => {
              const g = podiumGroups[order];
              if (!g) return <div key={i} />;
              return <PodiumCard key={order} place={order + 1} wins={g.wins} athletes={g.athletes} />;
            })}
          </div>
        )}
      </section>

      {(standing.active_days_ranking ?? []).length > 0 && (
        <section>
          <SectionTitle icon={<Flame className="h-5 w-5" />}>Ranking geral · dias ativos</SectionTitle>
          <div className="overflow-hidden border-2 border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 font-condensed text-xs uppercase tracking-wider">
                <tr>
                  <th className="w-12 px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Atleta</th>
                  <th className="px-3 py-2 text-right">Dias ativos</th>
                </tr>
              </thead>
              <tbody>
                {standing.active_days_ranking.map((row: any, i: number) => (
                  <tr key={row.athlete_id} className="border-t border-border/60">
                    <td className="px-3 py-2 font-condensed text-lg text-lime">{i + 1}</td>
                    <td className="px-3 py-2">
                      <Link to="/atletas/$id" params={{ id: row.athlete_id }} className="flex items-center gap-3 hover:underline">
                        <Avatar src={row.athlete?.profile_picture_url} name={row.athlete?.full_name} size={32} />
                        <span className="font-medium">{row.athlete?.full_name}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right font-condensed text-xl">{row.active_days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {(standing.lasts ?? []).length > 0 && (
        <section>
          <SectionTitle icon={<Skull className="h-5 w-5" />}>Lanternas do Dorflex 💊</SectionTitle>
          <div className="flex flex-wrap gap-3">
            {(standing.lasts ?? []).map((l: any) => (
              <Link key={l.athlete_id} to="/atletas/$id" params={{ id: l.athlete_id }}>
                <div className="flex items-center gap-3 border-2 border-destructive/60 bg-destructive/10 px-3 py-2 text-sm transition-colors hover:bg-destructive/20">
                  <Avatar src={l.athlete?.profile_picture_url} name={l.athlete?.full_name} size={28} />
                  <span className="font-medium">{l.athlete?.full_name}</span>
                  <Badge variant="destructive" className="ml-1 font-condensed">{l.count}x lanterna</Badge>
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
            <Card className="rounded-none border-2 transition-colors hover:bg-card/80">
              <div className="p-6">
                <div className="display text-2xl">{lastMonth.name}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {lastMonth.winners.length > 0
                    ? `Campe${lastMonth.winners.length > 1 ? "ões" : "ão"}: ${lastMonth.winners.map((w: any) => w.full_name).join(", ")}`
                    : "Sem campeão ainda."}
                </div>
              </div>
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
    <div className={`border-2 ${highlight ? "border-primary/60 bg-primary/10" : "border-border bg-card/60"} p-5`}>
      <div className="flex items-center gap-2 font-condensed text-xs uppercase tracking-widest text-muted-foreground">
        {icon} {label}
      </div>
      <div className={`mt-2 display text-5xl ${highlight ? "text-lime" : ""}`}>{value}</div>
    </div>
  );
}

function SectionTitle({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="display mb-4 flex items-center gap-2 text-3xl text-foreground/90">
      {icon}
      {children}
    </h2>
  );
}

function PodiumCard({ place, wins, athletes }: { place: number; wins: number; athletes: any[] }) {
  const sizes = { 1: "md:scale-110 md:-translate-y-2", 2: "", 3: "" } as Record<number, string>;
  const colors = {
    1: "border-primary/60 bg-primary/10",
    2: "border-border bg-card/80",
    3: "border-border bg-card/60",
  } as Record<number, string>;
  const medal = place === 1 ? "🥇" : place === 2 ? "🥈" : "🥉";
  return (
    <div className={`border-2 p-6 text-center transition-all ${colors[place]} ${sizes[place] ?? ""}`}>
      <div className="display text-6xl text-lime">{medal}</div>
      <div className="mt-4 flex flex-wrap items-end justify-center gap-4">
        {athletes.map((a) => (
          <Link key={a?.id} to="/atletas/$id" params={{ id: a?.id ?? "" }} className="flex flex-col items-center hover:opacity-90">
            <Avatar src={a?.profile_picture_url} name={a?.full_name} size={56} />
            <div className="display mt-2 text-lg leading-tight">{a?.full_name}</div>
          </Link>
        ))}
      </div>
      <div className="mt-3 font-condensed text-sm text-muted-foreground">
        {wins} {wins === 1 ? "vitória" : "vitórias"}{athletes.length > 1 ? ` · empate (${athletes.length})` : ""}
      </div>
    </div>
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
      className="border-2 border-border object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="grid place-items-center border-2 border-border bg-secondary text-secondary-foreground"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-2 border-dashed border-border bg-card/30 p-10 text-center text-muted-foreground">
      {children}
    </div>
  );
}
