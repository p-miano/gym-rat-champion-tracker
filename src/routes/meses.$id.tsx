import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Skull, AlertTriangle, Camera, Clock, MapPin } from "lucide-react";
import { getMonth } from "@/lib/data.functions";
import { Avatar } from "./index";

const MONTH_NAMES = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const REASON_LABEL: Record<string, string> = {
  no_photo: "sem foto",
  short_duration: "menos de 30 min",
  short_distance: "corrida/caminhada < 3 km",
};

const monthOpts = (id: string) =>
  queryOptions({ queryKey: ["month", id], queryFn: () => getMonth({ data: { id } }) });

export const Route = createFileRoute("/meses/$id")({
  head: () => ({ meta: [{ title: "Detalhe do mês — Atletas com Dorflex" }] }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(monthOpts(params.id)),
  component: MonthDetail,
});

function MonthDetail() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(monthOpts(id));
  const { month, results, check_ins } = data;

  const byAthlete = new Map<string, any[]>();
  for (const c of check_ins) {
    const arr = byAthlete.get(c.athlete_id) ?? [];
    arr.push(c);
    byAthlete.set(c.athlete_id, arr);
  }

  return (
    <div className="space-y-8">
      <div>
        <Link to="/meses" className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
          ← Todos os meses
        </Link>
        <h1 className="display mt-2 text-4xl text-lime">{month.name}</h1>
        <p className="text-muted-foreground">
          {MONTH_NAMES[month.month]} / {month.year}
        </p>
      </div>

      <section>
        <h2 className="display mb-3 text-xl">Classificação por dias ativos</h2>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="w-12 px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Atleta</th>
                <th className="px-3 py-2 text-right">Dias</th>
                <th className="px-3 py-2 text-right">Treinos</th>
                <th className="px-3 py-2 text-right">Minutos</th>
                <th className="px-3 py-2 text-right">Km</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {results.map((r: any) => (
                <tr key={r.athlete_id} className="border-t border-border/60 hover:bg-card/60">
                  <td className="px-3 py-2 display text-lg">{r.rank}</td>
                  <td className="px-3 py-2">
                    <Link to="/atletas/$id" params={{ id: r.athlete_id }} className="flex items-center gap-2 hover:underline">
                      <Avatar src={r.athletes?.profile_picture_url} name={r.athletes?.full_name} size={28} />
                      {r.athletes?.full_name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right font-mono display text-lg text-lime">{r.active_days}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.total_checkins}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.total_minutes}</td>
                  <td className="px-3 py-2 text-right font-mono">{Number(r.total_distance_km ?? 0).toFixed(1)}</td>
                  <td className="px-3 py-2">
                    {r.is_winner && <Badge className="gap-1"><Trophy className="h-3 w-3" />Campeão</Badge>}
                    {r.is_last && <Badge variant="destructive" className="gap-1"><Skull className="h-3 w-3" />Dorflex</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="display text-xl">Check-ins por atleta</h2>
        {results.map((r: any) => {
          const list = byAthlete.get(r.athlete_id) ?? [];
          if (list.length === 0) return null;
          return (
            <Card key={r.athlete_id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Avatar src={r.athletes?.profile_picture_url} name={r.athletes?.full_name} size={28} />
                  {r.athletes?.full_name}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {list.length} treinos · {list.filter((c: any) => !c.is_valid).length} flagrados
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {list.map((c: any) => (
                    <CheckInCard key={c.id} c={c} />
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}

function CheckInCard({ c }: { c: any }) {
  return (
    <div className={`overflow-hidden rounded-lg border ${c.is_valid ? "border-border" : "border-destructive/40"} bg-card/50`}>
      {c.photo_url ? (
        <img src={c.photo_url} alt={c.title ?? ""} className="aspect-video w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex aspect-video items-center justify-center bg-destructive/10 text-destructive">
          <Camera className="h-8 w-8" />
        </div>
      )}
      <div className="p-3">
        <div className="text-xs text-muted-foreground">
          {new Date(c.occurred_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
        </div>
        <div className="font-medium">{c.title || "Sem título"}</div>
        {c.description && <div className="text-xs text-muted-foreground line-clamp-2">{c.description}</div>}
        <div className="mt-2 flex flex-wrap gap-1 text-xs">
          {c.duration_min != null && (
            <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />{c.duration_min}min</Badge>
          )}
          {c.distance_km != null && (
            <Badge variant="outline" className="gap-1"><MapPin className="h-3 w-3" />{Number(c.distance_km).toFixed(1)}km</Badge>
          )}
          {c.activity_type && <Badge variant="secondary">{c.activity_type}</Badge>}
          {(c.reactions ?? []).slice(0, 6).map((r: string, i: number) => (
            <span key={i} className="rounded bg-muted px-1.5 py-0.5">{r}</span>
          ))}
        </div>
        {!c.is_valid && (
          <div className="mt-2 flex items-start gap-1.5 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            <span>{(c.invalid_reasons ?? []).map((r: string) => REASON_LABEL[r] ?? r).join(" · ")}</span>
          </div>
        )}
      </div>
    </div>
  );
}
