import type { AvatarId } from "./types";

export interface AvatarDef {
  id: AvatarId;
  name: string;
  role: string;
  src: string;
}

export const AVATARS: AvatarDef[] = [
  { id: "warden", name: "Dracula", role: "Fighter", src: "/avatars/warden.png" },
  { id: "technomancer", name: "MJ", role: "Fighter", src: "/avatars/technomancer.png" },
  { id: "scholar", name: "Carmen", role: "Fighter", src: "/avatars/scholar.png" },
  { id: "scavenger", name: "Batman", role: "Fighter", src: "/avatars/scavenger.png" },
  { id: "imp", name: "Myrtle", role: "Fighter", src: "/avatars/imp.png" },
  { id: "avatar6", name: "Just a girl 🎀", role: "Fighter", src: "/avatars/avatar-6.png" },
  { id: "avatar8", name: "Dr. Strange", role: "Fighter", src: "/avatars/avatar-8.png" },
  { id: "avatar9", name: "Muzan", role: "Fighter", src: "/avatars/avatar-9.png" },
  { id: "avatar10", name: "Marinette", role: "Fighter", src: "/avatars/avatar-10.png" },
  { id: "avatar11", name: "Spidey", role: "Fighter", src: "/avatars/avatar-11.png" },
  { id: "avatar12", name: "Shady Spidey", role: "Fighter", src: "/avatars/avatar-12.png" },
  { id: "gremlin", name: "Pegasus", role: "Fighter", src: "/avatars/gremlin.png" },
];

export function avatarFor(id?: AvatarId): AvatarDef {
  return AVATARS.find((avatar) => avatar.id === id) ?? AVATARS[0]!;
}
