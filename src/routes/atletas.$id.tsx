import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Trophy,
  MapPin,
  Heart,
  Activity,
  Dumbbell,
  Wind,
  Trees,
  Laugh,
  Route as RouteIcon,
  Timer,
  CalendarCheck,
  CalendarX,
  Plane,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { getAthlete } from "@/lib/data.functions";
import { Avatar } from "./index";
import { AWARD_META, jokeFor } from "@/lib/jokes";
import {
  spDateKey,
  classifyCheckInExclusive,
  isOutdoor,
  extractPlatformActivities,
} from "@/lib/gymrats-parser";

const MONTH_NAMES = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const COLORS = ["#b6ff1a", "#8bd926", "#5ec05f", "#f0b800", "#e26161", "#7e6cd9"];

const opts = (id: string) =>
  queryOptions({ queryKey: ["athlete", id], queryFn: () => getAthlete({ data: { id } }) });

export const Route = createFileRoute("/atletas/$id")({
  head: () => ({ meta: [{ title: "Ficha Técnica — Atletas com Dorflex" }] }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(opts(params.id)),
  component: AthleteDetail,
});

// Extrai cidade do location_name (ex: "Academia X, Rua Y, São Paulo, SP, Brasil" → "São Paulo")
function cityFromLocationName(name: string | null | undefined): string | null {
  if (!name) return null;
  const parts = name.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length >= 3) return parts[parts.length - 3]; // costuma ser a cidade
  return parts[parts.length - 1];
}

function getSubActivities(raw: unknown) {
  const r = raw as { check_in_activities?: unknown } | null | undefined;
  const arr = r?.check_in_activities;
  return Array.isArray(arr) ? (arr as Array<{ platform_activity?: string | null; duration_millis?: number | null }>) : [];
}

function AthleteDetail() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(opts(id));
  const { athlete, check_ins, month_results, awards } = data;

  // Ano em foco = ano mais recente com check-ins
  const year = useMemo(() => {
    let y = new Date().getUTCFullYear();
    for (const c of check_ins) {
      const cy = Number(spDateKey(c.occurred_at).slice(0, 4));
      if (cy > y) y = cy;
    }
    return y;
  }, [check_ins]);

  const yearCheckIns = useMemo(
    () => check_ins.filter((c) => Number(spDateKey(c.occurred_at).slice(0, 4)) === year),
    [check_ins, year],
  );

  // ─── Meta semanal (3x/semana, sempre seg→dom) ──────────────────────────
  // Desafio começou em 01/04/2026. Só avaliamos semanas a partir daí.
  // Semana de transição (a que contém 01/04) tem meta reduzida = 1 dia.
  // Limite dinâmico = data do check-in mais recente no dataset importado.
  // Semanas após esse limite não são avaliadas (ficam cinza "em curso").
  const weekly = useMemo(() => {
    const CHALLENGE_START = "2026-04-01"; // quarta-feira
    const daysWithCheckIn = new Set<string>();
    let maxKey = "";
    for (const c of check_ins) {
      if (!c.is_valid) continue;
      const k = spDateKey(c.occurred_at);
      daysWithCheckIn.add(k);
      if (k > maxKey) maxKey = k;
    }
    const todayKey = spDateKey(new Date().toISOString());
    // Limite = menor entre hoje e último check-in importado (não passa de hoje)
    const cutoffKey = maxKey && maxKey < todayKey ? maxKey : todayKey;

    const fmtDay = (d: Date) =>
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    const fmtBR = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;

    // Segunda-feira da semana que contém 01/04/2026 (= 30/03/2026)
    const [sy, sm, sd] = CHALLENGE_START.split("-").map(Number);
    const startDate = new Date(Date.UTC(sy, sm - 1, sd));
    const startDow = startDate.getUTCDay() || 7;
    const firstMonday = new Date(startDate);
    firstMonday.setUTCDate(startDate.getUTCDate() - (startDow - 1));
    const dec31 = new Date(Date.UTC(year, 11, 31));

    const weeks: {
      wk: string; mondayKey: string; sundayKey: string;
      mondayBR: string; sundayBR: string;
      days: number; goal: number; met: boolean; complete: boolean; transition: boolean;
    }[] = [];
    for (const mon = new Date(firstMonday); mon <= dec31; mon.setUTCDate(mon.getUTCDate() + 7)) {
      const sun = new Date(mon);
      sun.setUTCDate(mon.getUTCDate() + 6);
      const mondayKey = fmtDay(mon);
      const sundayKey = fmtDay(sun);
      // Pula semanas inteiramente posteriores ao cutoff (sem dados nem hoje)
      if (mondayKey > cutoffKey) break;
      let n = 0;
      const cur = new Date(mon);
      for (let i = 0; i < 7; i++) {
        if (daysWithCheckIn.has(fmtDay(cur))) n++;
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
      const transition = mondayKey <= CHALLENGE_START && sundayKey >= CHALLENGE_START;
      const goal = transition ? 1 : 3;
      // Semana só é "completa" (avaliável) se o domingo já passou E está dentro do cutoff
      const complete = sundayKey <= cutoffKey && sundayKey < todayKey;
      weeks.push({
        wk: mondayKey, mondayKey, sundayKey,
        mondayBR: fmtBR(mondayKey), sundayBR: fmtBR(sundayKey),
        days: n, goal, met: n >= goal, complete, transition,
      });
    }
    const evaluable = weeks.filter((w) => w.complete);
    const met = evaluable.filter((w) => w.met).length;
    const debt = evaluable.filter((w) => !w.met).length;
    return { weeks, evaluableCount: evaluable.length, met, debt };
  }, [check_ins, year]);


  // ─── Auditoria por categoria ────────────────────────────────────────────
  const audit = useMemo(() => {
    // Agrupa check-ins por dia (YYYY-MM-DD em SP). Cada dia = 1 sessão virtual.
    type DayBucket = {
      activity_types: (string | null)[];
      titles: string[];
      descriptions: string[];
      subs: Array<{ platform_activity?: string | null; duration_millis?: number | null }>;
      km: number;
      min: number;
      laughs: number;
      anyOutdoor: boolean;
    };
    const days = new Map<string, DayBucket>();
    for (const c of yearCheckIns) {
      if (!c.is_valid) continue;
      const day = spDateKey(c.occurred_at);
      let b = days.get(day);
      if (!b) {
        b = { activity_types: [], titles: [], descriptions: [], subs: [], km: 0, min: 0, laughs: 0, anyOutdoor: false };
        days.set(day, b);
      }
      b.activity_types.push(c.activity_type);
      if (c.title) b.titles.push(c.title);
      if (c.description) b.descriptions.push(c.description);
      b.subs.push(...getSubActivities(c.raw));
      b.km += Number(c.distance_km ?? 0);
      b.min += c.duration_min ?? 0;
      for (const r of c.reactions ?? []) if (r.includes("😂")) b.laughs++;
      if (
        isOutdoor({
          activity_type: c.activity_type,
          title: c.title,
          description: c.description,
          platform_activities: extractPlatformActivities(c.raw),
        })
      )
        b.anyOutdoor = true;
    }

    let strength = 0;
    let cardio = 0;
    let other = 0;
    let outdoor = 0;
    let laughs = 0;
    let totalKm = 0;
    let totalMin = 0;
    for (const b of days.values()) {
      // Classifica a sessão diária: somatório de duração das sub-atividades do dia.
      // Empate → musculação.
      const cat = classifyCheckInExclusive({
        activity_type: b.activity_types.find((t) => t) ?? null,
        title: b.titles.join(" | ") || null,
        description: b.descriptions.join(" | ") || null,
        check_in_activities: b.subs,
      });
      if (cat === "strength") strength++;
      else if (cat === "cardio") cardio++;
      else other++;
      if (b.anyOutdoor) outdoor++;
      laughs += b.laughs;
      totalKm += b.km;
      totalMin += b.min;
    }
    return {
      strength,
      cardio,
      other,
      outdoor,
      laughs,
      totalKm,
      totalMin,
      activeDays: days.size,
    };
  }, [yearCheckIns]);

  // ─── DNA Maromba ────────────────────────────────────────────────────────
  const dna = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of yearCheckIns) {
      const k = c.activity_type ?? "indefinido";
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [yearCheckIns]);

  // ─── Inteligência geográfica: QG / cidade base ──────────────────────────
  const geo = useMemo(() => {
    const cityCount = new Map<string, number>();
    let withCity = 0;
    for (const c of yearCheckIns) {
      const city = cityFromLocationName(c.location_name);
      if (city) {
        withCity++;
        cityCount.set(city, (cityCount.get(city) ?? 0) + 1);
      }
    }
    let baseCity: string | null = null;
    let baseCount = 0;
    for (const [city, n] of cityCount) {
      if (n > baseCount) {
        baseCity = city;
        baseCount = n;
      }
    }
    const awayCity = withCity - baseCount;

    // Fallback grid se não tiver location_name
    let baseLat: number | null = null;
    let baseLng: number | null = null;
    let awayGrid = 0;
    if (!baseCity) {
      const GRID = 0.05;
      const cells = new Map<string, { lat: number; lng: number; count: number }>();
      for (const c of yearCheckIns) {
        if (c.location_latitude == null || c.location_longitude == null) continue;
        const k = `${Math.round(Number(c.location_latitude) / GRID)}:${Math.round(Number(c.location_longitude) / GRID)}`;
        const cur = cells.get(k) ?? { lat: 0, lng: 0, count: 0 };
        cur.lat += Number(c.location_latitude);
        cur.lng += Number(c.location_longitude);
        cur.count++;
        cells.set(k, cur);
      }
      let best: { lat: number; lng: number; count: number } | null = null;
      let total = 0;
      for (const v of cells.values()) {
        total += v.count;
        if (!best || v.count > best.count) best = v;
      }
      if (best) {
        baseLat = Number((best.lat / best.count).toFixed(5));
        baseLng = Number((best.lng / best.count).toFixed(5));
        awayGrid = total - best.count;
      }
    }

    return {
      baseCity,
      baseCount,
      awayCount: baseCity ? awayCity : awayGrid,
      baseLat,
      baseLng,
      hasAnyGeo: cityCount.size > 0 || baseLat !== null,
    };
  }, [yearCheckIns]);

  const monthsWon = month_results.filter((m: any) => m.is_winner).length;
  const monthsLast = month_results.filter((m: any) => m.is_last).length;

  return (
    <div className="space-y-10">
      {/* ─── Cabeçalho ─── */}
      <div>
        <Link to="/atletas" className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
          ← Todos os atletas
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <Avatar src={athlete.profile_picture_url} name={athlete.full_name} size={88} />
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Prontuário {year}</div>
            <h1 className="display text-4xl text-lime truncate">{athlete.full_name}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              {monthsWon > 0 && (
                <Badge className="gap-1"><Trophy className="h-3 w-3" />{monthsWon}x campeão</Badge>
              )}
              {monthsLast > 0 && (
                <Badge variant="destructive">💸 {monthsLast}x lanterna</Badge>
              )}
              {awards.map((a: any) => {
                const meta = AWARD_META[a.award_key];
                if (!meta) return null;
                return (
                  <Badge key={a.award_key} variant="secondary" className="gap-1">
                    <span>{meta.emoji}</span> {meta.title}
                  </Badge>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Performance: meta semanal ─── */}
      <section>
        <SectionTitle icon={<Activity className="h-4 w-4" />} text="Performance · Meta 3x por semana" />
        <div className="grid gap-3 md:grid-cols-3">
          <BigStat
            label="Dias Ativos Totais"
            value={audit.activeDays}
            tone="lime"
          />
          <BigStat
            label="Semanas Cumpridas"
            value={weekly.met}
            sub={`de ${weekly.evaluableCount} semanas encerradas (seg→dom)`}
            tone="ok"
            icon={<CalendarCheck className="h-5 w-5" />}
          />
          <BigStat
            label="Semanas em Débito"
            value={weekly.debt}
            sub={weekly.debt > 0 ? "alerta do tio Dorflex" : "limpo, sem dívidas"}
            tone={weekly.debt > 0 ? "danger" : "muted"}
            icon={<CalendarX className="h-5 w-5" />}
          />
        </div>
      </section>

      {/* ─── Localização ─── */}
      <section>
        <SectionTitle icon={<MapPin className="h-4 w-4" />} text="Inteligência Geográfica" />
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-card/60 p-5">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">QG · Cidade Base</div>
            {geo.baseCity ? (
              <>
                <div className="mt-1 display text-3xl text-lime truncate">{geo.baseCity}</div>
                <div className="text-sm text-muted-foreground">{geo.baseCount} check-ins na base</div>
              </>
            ) : geo.baseLat !== null ? (
              <>
                <div className="mt-1 display text-2xl text-lime">
                  {geo.baseLat?.toFixed(3)}, {geo.baseLng?.toFixed(3)}
                </div>
                <div className="text-sm text-muted-foreground">cluster geográfico (sem cidade definida)</div>
              </>
            ) : (
              <div className="mt-1 text-sm text-muted-foreground">Sem geolocalização cadastrada.</div>
            )}
          </div>
          <div className="rounded-xl border border-border bg-card/60 p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <Plane className="h-3.5 w-3.5" /> Treinos Fora da Base
            </div>
            <div className={`mt-1 display text-3xl ${geo.awayCount > 0 ? "text-primary" : ""}`}>{geo.awayCount}</div>
            <div className="text-sm text-muted-foreground">
              {geo.hasAnyGeo
                ? geo.awayCount > 0
                  ? "check-ins fora do CEP usual"
                  : "fiel ao QG, nem viajar viaja"
                : "sem dados de geolocalização"}
            </div>
          </div>
        </div>
      </section>

      {/* ─── DNA Maromba ─── */}
      <section>
        <SectionTitle icon={<Activity className="h-4 w-4" />} text="DNA Maromba" />
        <Card>
          <CardContent className="pt-6">
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
      </section>

      {/* ─── Auditoria de categorias ─── */}
      <section>
        <SectionTitle icon={<Trophy className="h-4 w-4" />} text="Painel de Auditoria · Métricas do Placar Geral" />
        <p className="mb-3 text-xs text-muted-foreground">
          A unidade de medida é o <strong>Dia Ativo</strong>: vários check-ins no mesmo dia viram 1
          sessão. Cada dia conta UMA categoria — somamos a duração de musculação vs cardio das
          sub-atividades do dia; vence a maior, empate vai pra musculação.
          Musculação + Cardio + Outros = Dias Ativos.
        </p>
        <div className="overflow-hidden rounded-xl border border-border">
          <AuditRow
            icon={<Activity className="h-4 w-4 text-primary" />}
            label="Dias Ativos no ano"
            sub="cada dia com pelo menos 1 check-in válido"
            value={audit.activeDays}
          />

          <AuditRow
            icon={<Dumbbell className="h-4 w-4 text-primary" />}
            label="Treinos de Musculação"
            sub="alimenta o prêmio MAROMBEIRO 💪"
            value={audit.strength}
          />
          <AuditRow
            icon={<Wind className="h-4 w-4 text-primary" />}
            label="Treinos de Cardio"
            sub="alimenta o Inimigo do Cardiologista 🫀"
            value={audit.cardio}
          />
          <AuditRow
            icon={<Activity className="h-4 w-4 text-muted-foreground" />}
            label="Treinos sem categoria"
            sub="não bate nem em musculação nem em cardio"
            value={audit.other}
          />
          <AuditRow
            icon={<Trees className="h-4 w-4 text-primary" />}
            label="Treinos Ao Ar Livre"
            sub="alimenta o Amante da Natureza 🌿"
            value={audit.outdoor}
          />
          <AuditRow
            icon={<Laugh className="h-4 w-4 text-primary" />}
            label="Reações de risada 😂"
            sub="alimenta o Humorista do WOD"
            value={audit.laughs}
          />
          <AuditRow
            icon={<RouteIcon className="h-4 w-4 text-primary" />}
            label="Quilometragem acumulada"
            sub="alimenta o Papa-Milhas 🏃‍♀️"
            value={`${audit.totalKm.toFixed(1)} km`}
          />
          <AuditRow
            icon={<Timer className="h-4 w-4 text-primary" />}
            label="Tempo total treinando"
            sub={`média de ${yearCheckIns.length ? Math.round(audit.totalMin / yearCheckIns.length) : 0} min/treino`}
            value={`${audit.totalMin} min`}
            last
          />
        </div>
      </section>

      {/* ─── Estante de Badges (com piada) ─── */}
      {awards.length > 0 && (
        <section>
          <SectionTitle icon={<Trophy className="h-4 w-4" />} text="Estante de Badges" />
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
        </section>
      )}

      {/* ─── Linha do tempo semanal ─── */}
      <section>
        <SectionTitle icon={<CalendarCheck className="h-4 w-4" />} text={`Linha do tempo · Semanas de ${year}`} />
        {weekly.weeks.length === 0 ? (
          <div className="text-sm text-muted-foreground">Sem semanas registradas em {year}.</div>
        ) : (
          <div className="rounded-xl border border-border bg-card/40 p-4">
            <div className="flex flex-wrap gap-1.5">
              {weekly.weeks.map((w) => {
                const cls = !w.complete
                  ? "border-border bg-muted/20 text-muted-foreground"
                  : w.met
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-destructive/40 bg-destructive/10 text-destructive";
                return (
                  <div
                    key={w.wk}
                    title={`Semana ${w.mondayBR} → ${w.sundayBR} · ${w.days} dia${w.days === 1 ? "" : "s"} ativo${w.days === 1 ? "" : "s"} · meta ${w.goal}${w.transition ? " (transição)" : ""}${w.complete ? "" : " · em curso"}`}
                    className={`flex h-9 min-w-[52px] items-center justify-center rounded-md border px-2 font-mono text-xs ${cls}`}
                  >
                    {w.mondayBR} · {w.days}d
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-sm border border-primary/40 bg-primary/15" />
                meta cumprida (≥3 dias)
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-sm border border-destructive/40 bg-destructive/10" />
                semana em débito
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-sm border border-border bg-muted/20" />
                semana em curso (ainda não avaliada)
              </span>
            </div>
          </div>
        )}
      </section>

      {/* ─── Histórico mensal ─── */}
      <section>
        <SectionTitle icon={<Heart className="h-4 w-4 text-destructive" />} text="Histórico Clínico Mensal" />
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
              {month_results
                .sort((a: any, b: any) => (b.months?.year - a.months?.year) || (b.months?.month - a.months?.month))
                .map((r: any) => (
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

function SectionTitle({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
      {icon}
      <span>{text}</span>
    </h2>
  );
}

function BigStat({
  label,
  value,
  sub,
  tone = "muted",
  icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: "lime" | "ok" | "danger" | "muted";
  icon?: React.ReactNode;
}) {
  const toneClass =
    tone === "lime"
      ? "border-primary/40 bg-primary/10"
      : tone === "ok"
        ? "border-primary/30 bg-primary/5"
        : tone === "danger"
          ? "border-destructive/40 bg-destructive/10"
          : "border-border bg-card/60";
  const valueClass = tone === "danger" ? "text-destructive" : tone === "muted" ? "" : "text-lime";
  return (
    <div className={`rounded-xl border p-5 ${toneClass}`}>
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-muted-foreground">
        <span>{label}</span>
        {icon}
      </div>
      <div className={`mt-2 display text-4xl ${valueClass}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function AuditRow({
  icon,
  label,
  sub,
  value,
  last,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  value: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 bg-card/40 px-4 py-3 ${last ? "" : "border-b border-border/60"}`}>
      <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm uppercase tracking-wide">{label}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </div>
      <div className="display text-2xl text-lime font-mono">{value}</div>
    </div>
  );
}
