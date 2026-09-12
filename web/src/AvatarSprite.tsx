import { avatarFor } from "./avatars";
import type { AvatarId } from "./types";

export type AvatarPose = "idle" | "ready" | "attack" | "celebrate" | "hit" | "lose" | "winner";

export function AvatarSprite({
  avatarId,
  pose = "idle",
  size = 72,
  label,
}: {
  avatarId?: AvatarId;
  pose?: AvatarPose;
  size?: number;
  label?: string;
}) {
  const avatar = avatarFor(avatarId);
  return (
    <span className={`avatar-sprite pose-${pose}`} style={{ width: size, height: size }} title={label ?? avatar.name}>
      <img src={avatar.src} alt={label ?? avatar.name} draggable={false} />
    </span>
  );
}
