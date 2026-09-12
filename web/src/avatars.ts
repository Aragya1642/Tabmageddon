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
];

export function avatarFor(id?: AvatarId): AvatarDef {
  return AVATARS.find((avatar) => avatar.id === id) ?? AVATARS[0]!;
}
