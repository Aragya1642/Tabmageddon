import type { AvatarId } from "./types";

export interface AvatarDef {
  id: AvatarId;
  name: string;
  src: string;
}

export const AVATARS: AvatarDef[] = [
  { id: "warden", name: "Dracula", src: "/avatars/warden.png" },
  { id: "technomancer", name: "MJ", src: "/avatars/technomancer.png" },
  { id: "scholar", name: "Carmen", src: "/avatars/scholar.png" },
  { id: "scavenger", name: "Batman", src: "/avatars/scavenger.png" },
  { id: "imp", name: "Myrtle", src: "/avatars/imp.png" },
  { id: "avatar6", name: "Just a girl 🎀", src: "/avatars/avatar-6.png" },
  { id: "avatar8", name: "Dr. Strange", src: "/avatars/avatar-8.png" },
  { id: "avatar9", name: "Muzan", src: "/avatars/avatar-9.png" },
  { id: "avatar10", name: "Marinette", src: "/avatars/avatar-10.png" },
  { id: "avatar11", name: "Spidey", src: "/avatars/avatar-11.png" },
  { id: "avatar12", name: "Shady Spidey", src: "/avatars/avatar-12.png" },
  { id: "gremlin", name: "Pegasus", src: "/avatars/gremlin.png" },
];

export function avatarFor(id?: AvatarId): AvatarDef {
  return AVATARS.find((avatar) => avatar.id === id) ?? AVATARS.find((avatar) => avatar.id === "avatar12") ?? AVATARS[0]!;
}
