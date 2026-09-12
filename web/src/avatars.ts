import type { AvatarId } from "./types";

export interface AvatarDef {
  id: AvatarId;
  name: string;
  role: string;
  src: string;
}

export const AVATARS: AvatarDef[] = [
  { id: "warden", name: "Cache Warden", role: "Hooded tank", src: "/avatars/warden.png" },
  { id: "gremlin", name: "Click Gremlin", role: "Chaotic rogue", src: "/avatars/gremlin.png" },
  { id: "technomancer", name: "CRT Mage", role: "Tech mystic", src: "/avatars/technomancer.png" },
  { id: "scholar", name: "404 Scholar", role: "Masked caster", src: "/avatars/scholar.png" },
  { id: "scavenger", name: "Tab Scavenger", role: "Armored hunter", src: "/avatars/scavenger.png" },
  { id: "imp", name: "Cookie Imp", role: "Tiny menace", src: "/avatars/imp.png" },
  { id: "avatar6", name: "Avatar 6", role: "New fighter", src: "/avatars/avatar-6.png" },
  { id: "avatar7", name: "Avatar 7", role: "New fighter", src: "/avatars/avatar-7.png" },
  { id: "avatar8", name: "Avatar 8", role: "New fighter", src: "/avatars/avatar-8.png" },
  { id: "avatar9", name: "Avatar 9", role: "New fighter", src: "/avatars/avatar-9.png" },
  { id: "avatar10", name: "Avatar 10", role: "New fighter", src: "/avatars/avatar-10.png" },
  { id: "avatar11", name: "Avatar 11", role: "New fighter", src: "/avatars/avatar-11.png" },
  { id: "avatar12", name: "Avatar 12", role: "New fighter", src: "/avatars/avatar-12.png" },
];

export function avatarFor(id?: AvatarId): AvatarDef {
  return AVATARS.find((avatar) => avatar.id === id) ?? AVATARS[0]!;
}
