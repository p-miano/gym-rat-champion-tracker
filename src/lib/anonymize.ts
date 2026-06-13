// Public-visitor anonymization layer.
// Maps each athlete deterministically to a placeholder Brazilian name when the
// viewer is not authenticated AND the athlete hasn't opted into showing
// their real (Gym Rats) name.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const PLACEHOLDER_NAMES = [
  "Lucas", "Maria", "Gabriel", "Ana", "Matheus", "Julia", "Felipe", "Yasmin",
  "Guilherme", "Vitória", "Rafael", "Larissa", "Daniel", "Bruna", "Gustavo",
  "Camila", "Pedro", "Letícia", "João", "Jéssica", "Thiago", "Carolina",
  "Leonardo", "Mariana", "Bruno", "Amanda", "Vinícius", "Beatriz", "Rodrigo",
  "Isabela",
];

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
    // Members always see the official GymRats name and photo.
    return { name: realName, photoUrl: realPhoto, forceInitials: false };
  }

  // Public visitor: only two modes — 'real' (opted-in) or 'placeholder' (default).
  // Never display the Google account photo; use the official Gym Rats picture.
  const mode = athlete?.display_mode ?? "placeholder";
  if (mode === "real") {
    const photo = athlete?.show_google_photo ? realPhoto : null;
    return {
      name: realName,
      photoUrl: photo,
      forceInitials: !photo,
      initialsColor: photo ? undefined : placeholderColorFor(id),
    };
  }
  // placeholder (default)
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
