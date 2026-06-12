// Pure parser for Gym Rats exported JSON. No side effects, no I/O.

export interface GymRatsMember {
  id: number;
  full_name: string;
  profile_picture_url: string | null;
}

export interface GymRatsCheckIn {
  id: number;
  account_id: number;
  occurred_at: string;
  created_at?: string;
  title?: string | null;
  description?: string | null;
  duration?: number | null;
  duration_millis?: number | null;
  distance_miles?: string | null;
  photo_url?: string | null;
  activity_type?: string | null;
  reactions?: Array<{ emoji?: string; reaction?: string } | string> | null;
  details?: {
    location_latitude?: string | null;
    location_longitude?: string | null;
  } | null;
  check_in_activities?: Array<{
    platform_activity?: string | null;
    distance_miles?: string | null;
  }> | null;
}

export interface GymRatsExport {
  id: number;
  name: string;
  start_date?: string;
  end_date?: string;
  members: GymRatsMember[];
  check_ins: GymRatsCheckIn[];
}

export interface ParsedCheckIn {
  id: number;
  gymrats_member_id: number;
  occurred_at: string;
  duration_min: number | null;
  distance_km: number | null;
  location_latitude: number | null;
  location_longitude: number | null;
  location_name: string | null;
  has_photo: boolean;
  photo_url: string | null;
  title: string | null;
  description: string | null;
  activity_type: string | null;
  reactions: string[];
  is_valid: boolean;
  invalid_reasons: string[];
  raw: unknown;
}

export interface ParsedMonth {
  source_id: number;
  name: string;
  year: number;
  month: number; // 1..12
  members: GymRatsMember[];
  check_ins: ParsedCheckIn[];
}

const MILES_TO_KM = 1.609344;
const TZ = "America/Sao_Paulo";

function parseDecimal(str: string | null | undefined): number | null {
  if (str == null || str === "") return null;
  const n = Number(String(str).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function inferActivityType(c: GymRatsCheckIn): string | null {
  if (c.activity_type) return c.activity_type;
  const platform = c.check_in_activities?.[0]?.platform_activity;
  if (platform) return platform;
  const blob = `${c.title ?? ""} ${c.description ?? ""}`.toLowerCase();
  const map: Array<[RegExp, string]> = [
    [/corrid|run/, "running"],
    [/caminhad|walk/, "walking"],
    [/pilate/, "pilates"],
    [/bike|ciclis|pedal|cycl/, "cycling"],
    [/yoga/, "yoga"],
    [/musculaç|muscul|treino de forc|forca|força|peito|costas|perna|ombro|biceps|tríceps|triceps/, "strength"],
    [/funcional|crossfit|hiit|wod/, "functional"],
    [/nataç|swim/, "swimming"],
    [/alongament|stretch/, "stretching"],
    [/lpo|levantamento/, "lpo"],
  ];
  for (const [re, tag] of map) if (re.test(blob)) return tag;
  return null;
}

function extractReactions(raw: GymRatsCheckIn["reactions"]): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      if (typeof r === "string") return r;
      return r.emoji ?? r.reaction ?? null;
    })
    .filter((x): x is string => typeof x === "string" && x.length > 0);
}

function isRunningOrWalking(activityType: string | null, title: string | null): boolean {
  const t = (activityType ?? "").toLowerCase();
  const titleL = (title ?? "").toLowerCase();
  return (
    /run|walk|caminh|corrid|treadmill/.test(t) ||
    /caminhad|corrid/.test(titleL)
  );
}

// --- Classificadores reaproveitáveis (parser + engine de prêmios) ---

export interface ClassifyInput {
  activity_type: string | null;
  title: string | null;
  description: string | null;
  platform_activities: string[];
}

export function extractPlatformActivities(raw: unknown): string[] {
  const r = raw as GymRatsCheckIn | null | undefined;
  const arr = r?.check_in_activities;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((a) => (a?.platform_activity ?? "").toString().toLowerCase())
    .filter((s) => s.length > 0);
}

const CARDIO_NATIVE = new Set([
  "running",
  "walking",
  "treadmill",
  "cycling",
  "swimming",
]);
const CARDIO_PLATFORM_RE = /treadmill|running|elliptical/;
const CARDIO_TEXT_RE =
  /\b(corrid(?:a|inha)?|esteira|caminhad(?:a|inha)?|caminhar|cardio(?:zinho)?|pedal(?:ada)?|escada|el[ií]ptico)\b/;

export function isCardio(c: ClassifyInput): boolean {
  const t = (c.activity_type ?? "").toLowerCase();
  if (CARDIO_NATIVE.has(t)) return true;
  if (c.platform_activities.some((p) => CARDIO_PLATFORM_RE.test(p))) return true;
  const blob = `${c.title ?? ""} ${c.description ?? ""}`.toLowerCase();
  return CARDIO_TEXT_RE.test(blob);
}

const INDOOR_TYPES = new Set(["treadmill", "indoor_cycling", "elliptical"]);
const OUTDOOR_TYPES = new Set([
  "running",
  "walking",
  "cycling",
  "hiking",
  "surfing",
]);
const OUTDOOR_TEXT_RE =
  /\b(parque|praç[ao]|praia|trilha|mato|ar livre|natureza|debaixo de sol|chuva)\b/;

export function isOutdoor(c: ClassifyInput): boolean {
  const t = (c.activity_type ?? "").toLowerCase();
  if (INDOOR_TYPES.has(t)) return false;
  if (OUTDOOR_TYPES.has(t)) return true;
  const blob = `${c.title ?? ""} ${c.description ?? ""}`.toLowerCase();
  return OUTDOOR_TEXT_RE.test(blob);
}

const STRENGTH_TYPES = new Set([
  "weightlifting",
  "strength_training",
  "strength",
  "lpo",
]);
const STRENGTH_TEXT_RE =
  /\b(muscula[cç][aã]o|treino de for[cç]a|hipertrofia|supino|perna)\b/;

export function isStrength(c: ClassifyInput): boolean {
  const t = (c.activity_type ?? "").toLowerCase();
  if (STRENGTH_TYPES.has(t)) return true;
  const blob = `${c.title ?? ""} ${c.description ?? ""}`.toLowerCase();
  return STRENGTH_TEXT_RE.test(blob);
}

// Classificação exclusiva strength × cardio por check-in.
// Soma a duração das sub-atividades (check_in_activities) por categoria; vence a maior.
// Empate ou ausência de sub-atividades cai pra cascata textual com strength tendo precedência.
const CARDIO_PLATFORMS = new Set([
  "treadmill",
  "running",
  "walking",
  "cycling",
  "indoor_cycling",
  "elliptical",
  "swimming",
  "stairs",
  "rowing",
  "hiking",
]);
const STRENGTH_PLATFORMS = new Set([
  "strength_training",
  "weightlifting",
  "weight_lifting",
  "lpo",
  "functional_strength_training",
  "functional_strength",
]);

export type ExclusiveCategory = "strength" | "cardio" | "other";

export interface ExclusiveClassifyInput {
  activity_type: string | null;
  title: string | null;
  description: string | null;
  check_in_activities: Array<{
    platform_activity?: string | null;
    duration_millis?: number | null;
  }> | null;
}

export function classifyCheckInExclusive(
  c: ExclusiveClassifyInput,
): ExclusiveCategory {
  const subs = Array.isArray(c.check_in_activities) ? c.check_in_activities : [];

  // Fallback textual do check-in (usado tanto para subs "other"/desconhecidas quanto sem subs)
  const fallbackInput: ClassifyInput = {
    activity_type: c.activity_type,
    title: c.title,
    description: c.description,
    platform_activities: subs
      .map((s) => (s.platform_activity ?? "").toString().toLowerCase())
      .filter((p) => p.length > 0),
  };
  const fallbackStrength = isStrength(fallbackInput);
  const fallbackCardio = !fallbackStrength && isCardio(fallbackInput);

  let strengthMs = 0;
  let cardioMs = 0;
  for (const s of subs) {
    const p = (s.platform_activity ?? "").toString().toLowerCase();
    const ms = Number(s.duration_millis ?? 0) || 0;
    if (ms <= 0) continue;
    if (STRENGTH_PLATFORMS.has(p)) {
      strengthMs += ms;
    } else if (CARDIO_PLATFORMS.has(p)) {
      cardioMs += ms;
    } else {
      // platform_activity "other"/desconhecido → usa o fallback textual do check-in
      if (fallbackStrength) strengthMs += ms;
      else if (fallbackCardio) cardioMs += ms;
    }
  }

  if (strengthMs > 0 || cardioMs > 0) {
    // Empate → strength (musculação é a base do treino combinado)
    return strengthMs >= cardioMs ? "strength" : "cardio";
  }

  // Sem subs com duração e sem hit nas listas → fallback puro
  if (fallbackStrength) return "strength";
  if (fallbackCardio) return "cardio";
  return "other";
}


export function validateCheckIn(_c: {
  has_photo: boolean;
  duration_min: number | null;
  distance_km: number | null;
  activity_type: string | null;
  title: string | null;
}): { is_valid: boolean; invalid_reasons: string[] } {
  // Sem regras de validação: todo check-in importado conta (igual ao GymRats).
  return { is_valid: true, invalid_reasons: [] };
}

export function parseCheckIn(c: GymRatsCheckIn): ParsedCheckIn {
  const distanceMiles = parseDecimal(c.distance_miles);
  const distance_km = distanceMiles == null ? null : Number((distanceMiles * MILES_TO_KM).toFixed(3));
  const duration_min =
    c.duration != null
      ? c.duration
      : c.duration_millis != null
      ? Math.round(c.duration_millis / 60000)
      : null;

  const activity_type = inferActivityType(c);
  const has_photo = !!c.photo_url;
  const lat = parseDecimal(c.details?.location_latitude);
  const lng = parseDecimal(c.details?.location_longitude);

  const validation = validateCheckIn({
    has_photo,
    duration_min,
    distance_km,
    activity_type,
    title: c.title ?? null,
  });

  return {
    id: c.id,
    gymrats_member_id: c.account_id,
    occurred_at: c.occurred_at,
    duration_min,
    distance_km,
    location_latitude: lat,
    location_longitude: lng,
    location_name: null,
    has_photo,
    photo_url: c.photo_url ?? null,
    title: c.title ?? null,
    description: c.description ?? null,
    activity_type,
    reactions: extractReactions(c.reactions),
    is_valid: validation.is_valid,
    invalid_reasons: validation.invalid_reasons,
    raw: c,
  };
}

/**
 * Infer the (year, month) of the export from check_ins.
 * Uses São Paulo timezone day to bucket. Picks the (year, month) with the most check-ins.
 */
export function inferYearMonth(checkIns: ParsedCheckIn[]): { year: number; month: number } {
  const counts = new Map<string, number>();
  for (const c of checkIns) {
    const d = new Date(c.occurred_at);
    // Format as YYYY-MM in São Paulo TZ
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
    }).formatToParts(d);
    const year = parts.find((p) => p.type === "year")?.value ?? "";
    const month = parts.find((p) => p.type === "month")?.value ?? "";
    const key = `${year}-${month}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best: [string, number] = ["", 0];
  for (const e of counts) if (e[1] > best[1]) best = e;
  if (!best[0]) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  const [y, m] = best[0].split("-");
  return { year: Number(y), month: Number(m) };
}

export function parseExport(payload: GymRatsExport): ParsedMonth {
  const check_ins = (payload.check_ins ?? []).map(parseCheckIn);
  const { year, month } = inferYearMonth(check_ins);
  return {
    source_id: payload.id,
    name: payload.name,
    year,
    month,
    members: payload.members ?? [],
    check_ins,
  };
}

/** Return YYYY-MM-DD in São Paulo timezone for a given timestamp. */
export function spDateKey(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const dd = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}-${m}-${dd}`;
}

/** Local hour (0-23) in São Paulo timezone. */
export function spHour(isoTimestamp: string): number {
  const d = new Date(isoTimestamp);
  const hour = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    hour: "2-digit",
    hour12: false,
  }).format(d);
  return Number(hour);
}

/** ISO week key (YYYY-Www) in São Paulo timezone (approx using UTC day). */
export function spWeekKey(isoTimestamp: string): string {
  const key = spDateKey(isoTimestamp);
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
