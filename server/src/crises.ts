import type { Crisis } from "./types.js";

export const CRISES: Crisis[] = [
  { id: "professor", name: "Professor Walks Behind You", description: "Your screen is now a moral event.", stat: "uselessness", direction: "LOW" },
  { id: "three-am", name: "3:14 AM, No Consequences", description: "The night shift of bad decisions begins.", stat: "uselessness", direction: "HIGH" },
  { id: "incognito", name: "Incognito Olympics", description: "Gold medals in plausible deniability.", stat: "shadiness", direction: "HIGH" },
  { id: "inspection", name: "Corporate Laptop Inspection", description: "IT would like a word with your tabs.", stat: "shadiness", direction: "LOW" },
  { id: "main-character", name: "Main Character Moment", description: "The spotlight found your browser.", stat: "aura", direction: "HIGH" },
  { id: "nobody-asked", name: "Nobody Asked", description: "Your vibe just got peer-reviewed.", stat: "aura", direction: "LOW" },
  { id: "tabs-97", name: "Chrome Has 97 Tabs Open", description: "The RAM is bargaining for its life.", stat: "ram", direction: "LOW" },
  { id: "battery", name: "Battery at 2%", description: "Every extra process is a personal insult.", stat: "ram", direction: "LOW" },
  { id: "nasa", name: "NASA Supercomputer Benchmark", description: "Your laptop thinks it launched.", stat: "ram", direction: "HIGH" },
  { id: "screen-share", name: "You're Sharing Your Screen", description: "The whole room can see your sins.", stat: "shadiness", direction: "LOW" },
  { id: "wifi", name: "Airport Wi-Fi Boss Fight", description: "Packet loss is now a combat mechanic.", stat: "ram", direction: "LOW" },
  { id: "algorithm", name: "The Algorithm Chose Violence", description: "Recommended: more of whatever ruined you.", stat: "uselessness", direction: "HIGH" },
  { id: "group-chat", name: "Dropped in the Group Chat", description: "Your digital reputation just loaded.", stat: "aura", direction: "HIGH" },
  { id: "browser-history", name: "Mom Checks Browser History", description: "Incognito cannot save you now.", stat: "shadiness", direction: "LOW" },
  { id: "deadline", name: "Deadline in Four Minutes", description: "Focus or perish.", stat: "uselessness", direction: "LOW" },
  { id: "fan-noise", name: "Laptop Achieves Flight", description: "The fans have entered the arena.", stat: "ram", direction: "HIGH" },
  { id: "touch-grass", name: "Emergency Touch Grass Protocol", description: "The sun is still a thing, allegedly.", stat: "uselessness", direction: "LOW" },
  { id: "receipts", name: "The Internet Has Receipts", description: "Every questionable tab just stood up.", stat: "shadiness", direction: "HIGH" },
  { id: "viral", name: "Accidentally Goes Viral", description: "Fame found the worst possible tab.", stat: "aura", direction: "HIGH" },
  { id: "humble", name: "Mandatory Humbling Event", description: "The main-character license expired.", stat: "aura", direction: "LOW" },
];
