// Public-visitor anonymization layer.
// Maps each athlete deterministically to a placeholder Brazilian name when the
// viewer is not authenticated AND the athlete hasn't opted into a more open
// display mode.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const PLACEHOLDER_NAMES = [
  "Maria Silva",
  "João Santos",
  "Pedro Oliveira",
  "Ana Souza",
  "Lucas Pereira",
  "Mariana Costa",
  "Bruno Almeida",
  "Carla Lima",
  "Rafael Rodrigues",
  "Juliana Ferreira",
  "Gustavo Carvalho",
  "Beatriz Ribeiro",
  "Thiago Gomes",
  "Camila Martins",
  "Felipe Araújo",
  "Larissa Barbosa",
  "Eduardo Cardoso",
  "Patrícia Mendes",
  "Rodrigo Teixeira",
  "Vanessa Moreira",
  "Marcelo Rocha",
  "Fernanda Dias",
  "Diego Nascimento",
  "Tatiana Castro",
];

// Lightweight color palette for initials avatars (HSL hues stable per id).
function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function placeholderNameFor(athleteId: string | null | undefined) {
  if (!athleteId) return "Atleta Anônimo";
  return PLACEHOLDER_NAMES[hashStr(athleteId) % PLACEHOLDER_NAMES.length];
}

export function placeholderColorFor(athleteId: string | null | undefined) {
  const hue = (hashStr(athleteId ?? "x") * 47) % 360;
  return `hsl(${hue} 60% 45%)`;
}

export type AthleteLike = {
  id?: string | null;
  full_name?: string | null;
  profile_picture_url?: string | null;
  display_mode?: string | null;
  public_nickname?: string | null;
  show_google_photo?: boolean | null;
  google_photo_url?: string | null;
} | null | undefined;

export interface DisplayInfo {
  name: string;
  photoUrl: string | null;
  /** Use a colored initials avatar (no photo allowed for public visitor). */
  forceInitials: boolean;
  initialsColor?: string;
}

export function displayAthlete(athlete: AthleteLike, isAuthed: boolean): DisplayInfo {
  const id = athlete?.id ?? "";
  const realName = athlete?.full_name ?? "Atleta";
  const realPhoto = athlete?.profile_picture_url ?? null;

  if (isAuthed) {
    // Members see real names/photos unless the athlete opted into nickname/placeholder
    const mode = athlete?.display_mode ?? "placeholder";
    if (mode === "nickname" && athlete?.public_nickname) {
      return { name: athlete.public_nickname, photoUrl: realPhoto, forceInitials: false };
    }
    return { name: realName, photoUrl: realPhoto, forceInitials: false };
  }

  // Public visitor: honor athlete's preferences
  const mode = athlete?.display_mode ?? "placeholder";
  if (mode === "real") {
    const photo = athlete?.show_google_photo ? athlete?.google_photo_url ?? realPhoto : null;
    return {
      name: realName,
      photoUrl: photo,
      forceInitials: !photo,
      initialsColor: photo ? undefined : placeholderColorFor(id),
    };
  }
  if (mode === "nickname" && athlete?.public_nickname) {
    const photo = athlete?.show_google_photo ? athlete?.google_photo_url ?? null : null;
    return {
      name: athlete.public_nickname,
      photoUrl: photo,
      forceInitials: !photo,
      initialsColor: photo ? undefined : placeholderColorFor(id),
    };
  }
  // placeholder default
  return {
    name: placeholderNameFor(id),
    photoUrl: null,
    forceInitials: true,
    initialsColor: placeholderColorFor(id),
  };
}

export function useIsAuthed() {
  const [authed, setAuthed] = useState<boolean>(false);
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setAuthed(!!data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return authed;
}
