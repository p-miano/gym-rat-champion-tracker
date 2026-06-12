import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, MapPin, Heart, Camera, Activity } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from "recharts";
import { getAthlete } from "@/lib/data.functions";
import { Avatar } from "./index";
import { AWARD_META, jokeFor } from "@/lib/jokes";
import { spDateKey } from "@/lib/gymrats-parser";

const MONTH_NAMES = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const COLORS = ["#b6ff1a", "#8bd926", "#5ec05f", "#f0b800", "#e26161", "#7e6cd9"];

const opts = (id: string) =>
  queryOptions({ queryKey: ["athlete", id], queryFn: () => getAthlete({ data: { id } }) });

export const Route = createFileRoute("/atletas/$id")({
  head: () => ({ meta: [{ title: "Ficha Técnica — Atletas com Dorflex" }] }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(opts(params.id)),
  component: AthleteDetail,
});

function AthleteDetail() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(opts(id));
  const { athlete, check_ins, month_results, awards } = data;

  const dna = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of check_ins) {
      const k = c.activity_type ?? "indefinido";
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [check_ins]);

  const dnaTag = useMemo(() => {
    const total = dna.reduce((s, d) => s + d.value, 0);
    if (total === 0) return null;
    const strength = dna.filter((d) => /strength|muscul|musculaç/i.test(d.name)).reduce((s, d) => s + d.value, 0);
    const flex = dna.filter((d) => /pilate|yoga|stretch|alongament|flex/i.test(d.name)).reduce((s, d) => s + d.value, 0);
    if (strength / total > 0.8) return "Monstro da Academia de Bairro";
    if (flex / total > 0.4) return "Alongado & Flexível (Até Demais)";
    return null;
  }, [dna]);

  const qg = useMemo(() => {
    const buckets = new Map<string, { lat: number; lng: number; count: number; name: string | null }>();
    for (const c of check_ins) {
      if (c.location_latitude == null || c.location_longitude == null) continue;
      const key = `${Number(c.location_latitude).toFixed(2)},${Number(c.location_longitude).toFixed(2)}`;
      const cur = buckets.get(key) ?? { lat: 0, lng: 0, count: 0, name: c.location_name ?? null };
      cur.lat += Number(c.location_latitude);
      cur.lng += Number(c.location_longitude);
      cur.count++;
      buckets.set(key, cur);
    }
    let best: any = null;
    for (const [, v] of buckets) if (!best || v.count > best.count) best = v;
    if (!best) return null;
    return {
      lat: (best.lat / best.count).toFixed(5),
      lng: (best.lng / best.count).toFixed(5),
      count: best.count,
      name: best.name,
    };
  }, [check_ins]);

  const monthlyBars = useMemo(() => {
    const m = new Map<string, { label: string; days: Set<string> }>();
    for (const c of check_ins) {
      if (!c.is_valid) continue;
      const d = new Date(c.occurred_at);
      const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const label = `${MONTH_NAMES[d.getUTCMonth() + 1]}/${String(d.getUTCFullYear()).slice(2)}`;
      const cur = m.get(k) ?? { label, days: new Set() };
      cur.days.add(spDateKey(c.occurred_at));
      m.set(k, cur);
    }
    return [...m.entries()].sort().map(([, v]) => ({ name: v.label, days: v.days.size }));
  }, [check_ins]);

  const totalDays = monthlyBars.reduce((s, b) => s + b.days, 0);
  const avgMin = check_ins.length
    ? Math.round(check_ins.reduce((s, c) => s + (c.duration_min ?? 0), 0) / check_ins.length)
    : 0;
  const totalKm = check_ins.reduce((s, c) => s + Number(c.distance_km ?? 0), 0);
  const noPhoto = check_ins.filter((c) => !c.has_photo).length;
  const monthsWon = month_results.filter((m) => m.is_winner).length;
  const monthsLast = month_results.filter((m) => m.is_last).length;

  return (
    <div className="space-y-8">
      <div>
        <Link to="/atletas" className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
          ← Todos os atletas
        </Link>
        <div className="mt-3 flex items-center gap-4">
          <Avatar src={athlete.profile_picture_url} name={athlete.full_name} size={88} />
          <div>
            <h1 className="display text-4xl text-lime">{athlete.full_name}</h1>
            <div className="mt-1 flex flex-wrap gap-2">
              {dnaTag && <Badge variant="secondary">{dnaTag}</Badge>}
              {monthsWon > 0 && (
                <Badge className="gap-1"><Trophy className="h-3 w-3" />{monthsWon}x campeão</Badge>
              )}
              {monthsLast > 0 && (
                <Badge variant="destructive">💸 {monthsLast}x lanterna</Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <Stat label="Dias ativos" value={totalDays} highlight />
        <Stat label="Média min/treino" value={avgMin} />
        <Stat label="Quilometragem" value={`${totalKm.toFixed(1)} km`} />
        <Stat label="Treinos sem foto" value={noPhoto} danger={noPhoto > 0} />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4 text-primary" />DNA Maromba</CardTitle>
          </CardHeader>
          <CardContent>
            {dna.length === 0 ? (
              <div className="text-sm text-muted-foreground">Sem dados.</div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={dna} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                      {dna.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "oklch(0.21 0.015 140)", border: "1px solid oklch(0.30 0.02 140)", borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" />Habitat Natural (QG)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {qg ? (
              <>
                <div className="display text-3xl">{qg.count} <span className="text-base font-normal text-muted-foreground">treinos no mesmo lugar</span></div>
                {qg.name && <div className="text-muted-foreground">{qg.name}</div>}
                <a
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                  href={`https://www.google.com/maps?q=${qg.lat},${qg.lng}`}
                  target="_blank" rel="noreferrer"
                >
                  📍 {qg.lat}, {qg.lng}
                </a>
              </>
            ) : (
              <div className="text-muted-foreground">Sem geolocalização cadastrada.</div>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="display mb-3 text-xl flex items-center gap-2"><Activity className="h-5 w-5" />Dias ativos por mês</h2>
        {monthlyBars.length === 0 ? (
          <div className="text-sm text-muted-foreground">Sem treinos válidos.</div>
        ) : (
          <div className="h-56 rounded-xl border border-border bg-card/40 p-4">
            <ResponsiveContainer>
              <BarChart data={monthlyBars}>
                <XAxis dataKey="name" stroke="#888" fontSize={12} />
                <YAxis stroke="#888" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "oklch(0.21 0.015 140)", border: "1px solid oklch(0.30 0.02 140)", borderRadius: 8 }} />
                <Bar dataKey="days" fill="#b6ff1a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section>
        <h2 className="display mb-3 text-xl flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" />Estante de Badges</h2>
        {awards.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhum prêmio ainda. Não basta treinar, tem que ter personalidade.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {awards.map((a: any) => {
              const meta = AWARD_META[a.award_key];
              if (!meta) return null;
              return (
                <div key={a.award_key} className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">{meta.emoji}</div>
                    <div className="flex-1">
                      <div className="display text-lg text-lime">{meta.title}</div>
                      <div className="text-xs text-muted-foreground">{meta.short}</div>
                      <div className="mt-2 text-sm italic">"{jokeFor(a.award_key, athlete.id)}"</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="display mb-3 text-xl flex items-center gap-2"><Heart className="h-5 w-5 text-destructive" />Histórico Clínico</h2>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Mês</th>
                <th className="px-3 py-2 text-right">Dias</th>
                <th className="px-3 py-2 text-right">Treinos</th>
                <th className="px-3 py-2 text-right">Rank</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {month_results.sort((a: any, b: any) => (b.months?.year - a.months?.year) || (b.months?.month - a.months?.month)).map((r: any) => (
                <tr key={r.month_id} className="border-t border-border/60">
                  <td className="px-3 py-2">
                    <Link to="/meses/$id" params={{ id: r.month_id }} className="hover:underline">
                      {MONTH_NAMES[r.months?.month]}/{String(r.months?.year).slice(2)} · {r.months?.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right font-mono display text-lg">{r.active_days}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.total_checkins}</td>
                  <td className="px-3 py-2 text-right font-mono">#{r.rank}</td>
                  <td className="px-3 py-2">
                    {r.is_winner && <Badge>🏆</Badge>}
                    {r.is_last && <Badge variant="destructive">💸</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, highlight, danger }: { label: string; value: React.ReactNode; highlight?: boolean; danger?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? "border-primary/40 bg-primary/10" : danger ? "border-destructive/30 bg-destructive/5" : "border-border bg-card/60"}`}>
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-1 display text-3xl ${highlight ? "text-lime" : ""}`}>{value}</div>
    </div>
  );
}
