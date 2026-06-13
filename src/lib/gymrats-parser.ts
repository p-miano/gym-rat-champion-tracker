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
  "stationary_bike",
  "spinning",
  "rowing_machine",
  "stair_climber",
  "hiit",
  "dance",
  "circuit_training",
  "functional_training",
  "cross_training",
]);
const CARDIO_PLATFORM_RE = /treadmill|running|elliptical|stationary_bike|spinning|rowing|stair|hiit|dance|circuit|functional_training|cross_training/;
const CARDIO_TEXT_RE =
  /\b(corrid(?:a|inha)?|esteira|caminhad(?:a|inha)?|caminhar|cardio(?:zinho)?|pedal(?:ada)?|escada|el[ií]ptico|bike|bicicleta|spinning|ergom[eé]trica|trote|transport|remo|dance|dan[cç]a|hiit|funcional|circuito|wod|crossfit)\b/;

export function isCardio(c: ClassifyInput): boolean {
  const t = (c.activity_type ?? "").toLowerCase();
  if (CARDIO_NATIVE.has(t)) return true;
  if (c.platform_activities.some((p) => CARDIO_PLATFORM_RE.test(p))) return true;
  const blob = `${c.title ?? ""} ${c.description ?? ""}`.toLowerCase();
  return CARDIO_TEXT_RE.test(blob);
}

const INDOOR_TYPES = new Set([
  "treadmill",
  "indoor_cycling",
  "elliptical",
  "stationary_bike",
  "spinning",
  "rowing_machine",
  "stair_climber",
]);
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
  // Precedência: descrição antes do título. Se qualquer um casar como
  // strength textual, trata como indoor (academia) antes de testar outdoor.
  const desc = (c.description ?? "").toLowerCase();
  const title = (c.title ?? "").toLowerCase();
  if (STRENGTH_TEXT_RE.test(desc)) return false;
  if (STRENGTH_TEXT_RE.test(title)) return false;
  if (OUTDOOR_TEXT_RE.test(desc)) return true;
  if (OUTDOOR_TEXT_RE.test(title)) return true;
  return false;
}

const STRENGTH_TYPES = new Set([
  "weightlifting",
  "weight_lifting",
  "strength_training",
  "strength",
  "lpo",
  "functional_strength_training",
  "functional_strength",
]);
const STRENGTH_TEXT_RE =
  /\b(muscula[cç][aã]o|treino de for[cç]a|treino\s*\d+|^treino\s*$|come[cç]ando|membros\s+(?:inferiores|superiores)|hipertrofia|supino|agachament|levantament|peito|costas|ombro|b[ií]ceps|tr[ií]ceps|gl[uú]teo|perna|lpo|dorsal|delt[oó]ide|trap[eé]zio|lombar|abdom|abd[oô]men|panturr|qu[aá]driceps|isquiotib|adutor|abdutor|bra[cç]o|antebra[cç]o)/;

export function isStrength(c: ClassifyInput): boolean {
  const t = (c.activity_type ?? "").toLowerCase();
  if (STRENGTH_TYPES.has(t)) return true;
  const blob = `${c.title ?? ""} ${c.description ?? ""}`.toLowerCase();
  return STRENGTH_TEXT_RE.test(blob);
}

const MOBILITY_TYPES = new Set([
  "pilates",
  "yoga",
  "stretching",
  "flexibility",
  "mind_and_body",
  "mobility",
]);
const MOBILITY_TEXT_RE =
  /\b(pilates|yoga|mobs|mobilidade|alongament(?:o|os)?|alongar|flexibilidade|libera[cç][aã]o miofascial|miofascial|adm|amplitude de movimento|tor[aá]cica|tornozelo|quadril|massagem|cadeira de massagem|recupera[cç][aã]o|recovery)\b/;

export function isMobility(c: ClassifyInput): boolean {
  const t = (c.activity_type ?? "").toLowerCase();
  if (MOBILITY_TYPES.has(t)) return true;
  if (c.platform_activities.some((p) => MOBILITY_TYPES.has(p))) return true;
  const blob = `${c.title ?? ""} ${c.description ?? ""}`.toLowerCase();
  return MOBILITY_TEXT_RE.test(blob);
}

const SPORT_TYPES = new Set([
  "surfing",
  "skating",
  "skateboarding",
  "snowboarding",
  "climbing",
  "soccer",
  "basketball",
  "volleyball",
  "tennis",
  "badminton",
  "martial_arts",
  "boxing",
  "kickboxing",
  "jiu_jitsu",
  "judo",
  "karate",
  "taekwondo",
  "mma",
  "golf",
  "baseball",
]);
const SPORT_TEXT_RE =
  /\b(surf|skate|escalad|boulder|futebol|basquete|v[oô]lei|t[eê]nis|bad?minton|boxe|muay|jiu[\s-]?jitsu|jud[oô]|karat[eê]|taekwondo|mma|luta|ping[\s-]?pong|t[eê]nis de mesa|sinuca|bilhar|fute[\s-]?mesa|esporte novo)\b/;

export function isSport(c: ClassifyInput): boolean {
  const t = (c.activity_type ?? "").toLowerCase();
  if (SPORT_TYPES.has(t)) return true;
  if (c.platform_activities.some((p) => SPORT_TYPES.has(p))) return true;
  const blob = `${c.title ?? ""} ${c.description ?? ""}`.toLowerCase();
  return SPORT_TEXT_RE.test(blob);
}

// Classificação exclusiva por check-in/dia.
// Soma duração das sub-atividades por categoria; vence a maior.
// Empates: strength > cardio > sport > mobility.
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
  "stationary_bike",
  "spinning",
  "rowing_machine",
  "stair_climber",
  "hiit",
  "dance",
  "circuit_training",
  "functional_training",
  "cross_training",
]);
const STRENGTH_PLATFORMS = new Set([
  "strength_training",
  "weightlifting",
  "weight_lifting",
  "lpo",
  "functional_strength_training",
  "functional_strength",
]);
const MOBILITY_PLATFORMS = new Set([
  "pilates",
  "yoga",
  "stretching",
  "flexibility",
  "mind_and_body",
  "mobility",
]);
const SPORT_PLATFORMS = SPORT_TYPES;

export type ExclusiveCategory =
  | "strength"
  | "cardio"
  | "mobility"
  | "sport"
  | "other";

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

  const fallbackInput: ClassifyInput = {
    activity_type: c.activity_type,
    title: c.title,
    description: c.description,
    platform_activities: subs
      .map((s) => (s.platform_activity ?? "").toString().toLowerCase())
      .filter((p) => p.length > 0),
  };
  const fbStrength = isStrength(fallbackInput);
  const fbCardio = !fbStrength && isCardio(fallbackInput);
  const fbSport = !fbStrength && !fbCardio && isSport(fallbackInput);
  const fbMobility = !fbStrength && !fbCardio && !fbSport && isMobility(fallbackInput);

  let strengthMs = 0;
  let cardioMs = 0;
  let mobilityMs = 0;
  let sportMs = 0;
  for (const s of subs) {
    const p = (s.platform_activity ?? "").toString().toLowerCase();
    const ms = Number(s.duration_millis ?? 0) || 0;
    if (ms <= 0) continue;
    if (STRENGTH_PLATFORMS.has(p)) strengthMs += ms;
    else if (CARDIO_PLATFORMS.has(p)) cardioMs += ms;
    else if (SPORT_PLATFORMS.has(p)) sportMs += ms;
    else if (MOBILITY_PLATFORMS.has(p)) mobilityMs += ms;
    else {
      if (fbStrength) strengthMs += ms;
      else if (fbCardio) cardioMs += ms;
      else if (fbSport) sportMs += ms;
      else if (fbMobility) mobilityMs += ms;
    }
  }

  if (strengthMs > 0 || cardioMs > 0 || mobilityMs > 0 || sportMs > 0) {
    // Preferência em empates: strength > cardio > sport > mobility
    const max = Math.max(strengthMs, cardioMs, sportMs, mobilityMs);
    if (strengthMs === max && strengthMs > 0) return "strength";
    if (cardioMs === max && cardioMs > 0) return "cardio";
    if (sportMs === max && sportMs > 0) return "sport";
    return "mobility";
  }

  if (fbStrength) return "strength";
  if (fbCardio) return "cardio";
  if (fbSport) return "sport";
  if (fbMobility) return "mobility";
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
  const rawLat = parseDecimal(c.details?.location_latitude);
  const rawLng = parseDecimal(c.details?.location_longitude);
  // Privacy: truncate to 2 decimals (~1.1 km) so we never store/expose street-level precision.
  const lat = rawLat == null ? null : Math.round(rawLat * 100) / 100;
  const lng = rawLng == null ? null : Math.round(rawLng * 100) / 100;

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

/** Local minutes since midnight (0-1439) in São Paulo timezone. */
export function spMinutesOfDay(isoTimestamp: string): number {
  const d = new Date(isoTimestamp);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
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
