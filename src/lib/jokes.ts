// Pool de zoeira ácida em PT-BR. Usado para microcopy e legendas dos prêmios.

const POOL: Record<string, string[]> = {
  voucher_limit: [
    "Treinou 3x na semana e nem um burpee a mais. Engenheiro de voucher.",
    "Cumpre a meta com a precisão de um boleto vencendo na sexta.",
    "Calcula 3 treinos por semana como quem racha conta no aniversário.",
  ],
  calendar_cheater: [
    "Foi 5 dias seguidos pra compensar 2 semanas no sofá. Espertinho.",
    "Treinou tudo numa semana só pra fingir que tem rotina.",
    "Faz blitz na academia quando lembra que existe um grupo cobrando.",
  ],
  dorflex_sponsor: [
    "Já pode deixar o PIX de R$20 programado no débito automático.",
    "Patrocinador oficial do Dorflex. Logo na camisa em breve.",
    "Lanterna da rodada. De novo. Surpreendentemente previsível.",
  ],
  flexible_iron: [
    "Veio pra puxar ferro e ficou abraçando o rolo de espuma.",
    "Maromba só de nome — na prática é alongamento com playlist do Spotify.",
    "Pilateiro federado. Respeita o core.",
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
  hypochondriac: [
    "Sinusite, laringite, virose, dor no cotovelo... e ainda treina. Lenda.",
    "Reclama de tudo e aparece em todas. Verdadeiro sobrevivente.",
    "Bula do Dorflex deveria ter sua foto.",
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
  early_bird: [
    "Treina antes do galo cantar. Tem alguma coisa errada com você.",
    "Psicopata das 5h da manhã. Por favor, durma.",
    "Acorda cedo só pra esfregar na cara dos outros.",
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
  voucher_limit: {
    emoji: "⚖️",
    title: "No Limite do Voucher",
    short: "Cumpre a meta cirurgicamente, nem um treino a mais.",
  },
  calendar_cheater: {
    emoji: "🃏",
    title: "Burleiro de Calendário",
    short: "Concentra treinos pra compensar semana de preguiça.",
  },
  dorflex_sponsor: {
    emoji: "💸",
    title: "Patrocinador Oficial do Dorflex",
    short: "Mais vezes na lanterna mensal. PIX programado.",
  },
  flexible_iron: {
    emoji: "🧘‍♂️",
    title: "Maromba Flexível / Pilateiro de Respeito",
    short: "Pilates / LPO em alta frequência.",
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
  hypochondriac: {
    emoji: "🩺",
    title: "Hipocondríaco / Sobrevivente",
    short: "Sinusite, virose, dorflex... e ainda treina.",
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
  early_bird: {
    emoji: "🌅",
    title: "Madrugador (Psicopata das 5h)",
    short: "Mais treinos antes das 7h.",
  },
  night_owl: {
    emoji: "🦉",
    title: "Corujão",
    short: "Mais treinos depois das 22h.",
  },
};
