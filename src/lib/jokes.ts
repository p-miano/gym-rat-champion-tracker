// Pool de zoeira ácida em PT-BR. Usado para microcopy e legendas dos prêmios.

const POOL: Record<string, string[]> = {
  rust_enemy: [
    "Mobilidade em dia. Articulação de bebê, ego de senhor.",
    "Yoga, pilates, alongamento — inimigo declarado da ferrugem.",
    "Range de movimento maior que paciência de zelador de academia.",
  ],
  influencer: [
    "Cada check-in vira novela. O grupo curte, comenta e ri.",
    "Engajamento alto. Falta só vender curso de emagrecimento.",
    "Não treina, performa. Reações chovem igual notificação de boleto.",
  ],

  bodybuilding_beast: [
    "Cheira a anilha e suor. Não cumprimenta sem fazer rosca.",
    "Marombeiro raiz. Espelho da academia já tem foto sua emoldurada.",
    "Vive em ciclo eterno de supino, perna e mais supino.",
  ],
  cardio_king: [
    "Coração igual locomotiva. Cardiologista pediu pra você maneirar.",
    "Esteira, bike, escada... só falta correr pelado pra completar.",
    "Suor escorrendo igual chuveiro. Inimigo declarado do descanso.",
  ],
  nature_lover: [
    "Trocou o ar-condicionado por mosquito. Hippie fitness.",
    "Treina onde tem mato, sol e poeira. Academia indoor que se cuide.",
    "Foto de treino com paisagem. Influencer de parquinho.",
  ],
  no_borders: [
    "Treina em qualquer CEP. Nômade fitness, vagabundo do whey.",
    "Bate ponto em academia que nem sabia que existia.",
    "Geolocalização do treino parece itinerário de companhia aérea.",
  ],
  wod_comedian: [
    "Vira piada virou métrica. Parabéns, comediante de WOD.",
    "O grupo ri mais do treino do que do seu progresso.",
    "Mais 😂 que 🔥. Você é a atração principal do circo.",
  ],


  mile_eater: [
    "Engole quilômetro como se fosse pão de queijo.",
    "Já podia ter ido pra Bahia a pé.",
    "Papa-milhas. Cheira até a asfalto.",
  ],
  phoenix: [
    "Sumiu, todos acharam que tinha desistido, e voltou queimando geral.",
    "Ressurgiu das cinzas (e do sofá).",
    "Fênix? Mais pra Fênix da Garoa, mas valeu o retorno.",
  ],
  night_owl: [
    "Fecha a academia. Os funcionários já te chamam pelo nome.",
    "Corujão. Treino é só desculpa pra não dormir.",
    "22h é hora de prancha pra você. Triste.",
  ],
};

export function jokeFor(awardKey: string, seed: string | number = 0): string {
  const pool = POOL[awardKey];
  if (!pool || pool.length === 0) return "";
  const s = typeof seed === "string" ? seed.length + seed.charCodeAt(0) : Number(seed);
  return pool[Math.abs(s) % pool.length];
}

export const AWARD_META: Record<
  string,
  { emoji: string; title: string; short: string }
> = {
  rust_enemy: {
    emoji: "🧘",
    title: "Inimigo da Ferrugem",
    short: "Mais treinos de mobilidade (pilates, yoga, alongamento) no ano.",
  },
  influencer: {
    emoji: "📣",
    title: "Topa tudo por biscoito",
    short: "Mais reações recebidas nos check-ins.",
  },


  bodybuilding_beast: {
    emoji: "💪",
    title: "Marombeiro",
    short: "Mais treinos de musculação / força no ano.",
  },
  cardio_king: {
    emoji: "🫀",
    title: "Inimigo do Cardiologista",
    short: "Mais treinos de cardio no ano.",
  },
  nature_lover: {
    emoji: "🌿",
    title: "Amante da Natureza",
    short: "Mais treinos ao ar livre no ano.",
  },
  no_borders: {
    emoji: "✈️",
    title: "Fitness Sem Fronteiras",
    short: "Treinou em endereços bem fora do QG.",
  },
  wod_comedian: {
    emoji: "😂",
    title: "Humorista do WOD",
    short: "Mais reações de risada nos treinos.",
  },
  mile_eater: {
    emoji: "🏃‍♀️",
    title: "Papa-Milhas",
    short: "Maior quilometragem total no ano.",
  },
  phoenix: {
    emoji: "🔥",
    title: "A Fênix",
    short: "Voltou de um hiato e engatou a meta.",
  },
  night_owl: {
    emoji: "🦉",
    title: "Corujão",
    short: "Mais treinos depois das 22h.",
  },
};

// Rótulos PT-BR para as chaves de `details` salvas em annual_awards.
export const DETAIL_LABELS: Record<string, { singular: string; plural: string }> = {
  mobility_checkins: { singular: "treino de mobilidade", plural: "treinos de mobilidade" },
  total_reactions: { singular: "reação", plural: "reações" },
  strength_checkins: { singular: "treino de força", plural: "treinos de força" },
  cardio_checkins: { singular: "treino de cardio", plural: "treinos de cardio" },
  outdoor_checkins: { singular: "treino ao ar livre", plural: "treinos ao ar livre" },
  far_checkins: { singular: "treino viajando", plural: "treinos viajando" },
  laughs: { singular: "risada", plural: "risadas" },
  total_km: { singular: "km", plural: "km" },
  comebacks: { singular: "ressurreição", plural: "ressurreições" },
  early_checkins: { singular: "treino antes das 7h", plural: "treinos antes das 7h" },
  late_checkins: { singular: "treino depois das 22h", plural: "treinos depois das 22h" },
};

// Chaves de details que são metadados internos (não exibir no card).
export const DETAIL_HIDDEN = new Set(["base_lat", "base_lng", "home_checkins"]);

export function formatDetail(key: string, value: unknown): string | null {
  if (DETAIL_HIDDEN.has(key)) return null;
  const n = typeof value === "number" ? value : Number(value);
  const label = DETAIL_LABELS[key];
  if (!label) return `${value} ${key.replace(/_/g, " ")}`;
  return `${n} ${n === 1 ? label.singular : label.plural}`;
}
