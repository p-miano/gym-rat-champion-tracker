// Convenience wrappers that wire athlete data through the anonymization layer.
import { Avatar } from "@/routes/index";
import { displayAthlete, useIsAuthed, type AthleteLike } from "@/lib/anonymize";

export function AthleteAvatar({
  athlete,
  size = 40,
  shape = "circle",
}: {
  athlete: AthleteLike;
  size?: number;
  shape?: "circle" | "rounded" | "square";
}) {
  const authed = useIsAuthed();
  const info = displayAthlete(athlete, authed);
  return (
    <Avatar
      src={info.forceInitials ? null : info.photoUrl}
      name={info.name}
      size={size}
      shape={shape}
      initialsColor={info.initialsColor}
    />
  );
}

export function useAthleteName(athlete: AthleteLike) {
  const authed = useIsAuthed();
  return displayAthlete(athlete, authed).name;
}

export function AthleteName({ athlete }: { athlete: AthleteLike }) {
  return <>{useAthleteName(athlete)}</>;
}
