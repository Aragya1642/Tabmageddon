import type { Crisis } from "./types.js";

export const CRISES: Crisis[] = [
  { id: "professor", name: "Professor Walks Behind You", description: "Lowest Uselessness survives.", stat: "uselessness", direction: "LOW" },
  { id: "three-am", name: "3:14 AM, No Consequences", description: "Highest Uselessness wins.", stat: "uselessness", direction: "HIGH" },
  { id: "incognito", name: "Incognito Olympics", description: "Highest Shadiness wins.", stat: "shadiness", direction: "HIGH" },
  { id: "inspection", name: "Corporate Laptop Inspection", description: "Lowest Shadiness wins.", stat: "shadiness", direction: "LOW" },
  { id: "main-character", name: "Main Character Moment", description: "Highest Aura wins.", stat: "aura", direction: "HIGH" },
  { id: "nobody-asked", name: "Nobody Asked", description: "Lowest Aura wins.", stat: "aura", direction: "LOW" },
  { id: "tabs-97", name: "Chrome Has 97 Tabs Open", description: "Lowest RAM survives.", stat: "ram", direction: "LOW" },
  { id: "battery", name: "Battery at 2%", description: "Lowest RAM survives.", stat: "ram", direction: "LOW" },
  { id: "nasa", name: "NASA Supercomputer Benchmark", description: "Highest RAM wins.", stat: "ram", direction: "HIGH" },
  { id: "screen-share", name: "You're Sharing Your Screen", description: "Lowest Shadiness wins.", stat: "shadiness", direction: "LOW" },
  { id: "wifi", name: "Airport Wi-Fi Boss Fight", description: "Lowest RAM wins.", stat: "ram", direction: "LOW" },
  { id: "algorithm", name: "The Algorithm Chose Violence", description: "Highest Uselessness wins.", stat: "uselessness", direction: "HIGH" },
  { id: "group-chat", name: "Dropped in the Group Chat", description: "Highest Aura wins.", stat: "aura", direction: "HIGH" },
  { id: "browser-history", name: "Mom Checks Browser History", description: "Lowest Shadiness wins.", stat: "shadiness", direction: "LOW" },
  { id: "deadline", name: "Deadline in Four Minutes", description: "Lowest Uselessness wins.", stat: "uselessness", direction: "LOW" },
  { id: "fan-noise", name: "Laptop Achieves Flight", description: "Highest RAM wins.", stat: "ram", direction: "HIGH" },
  { id: "touch-grass", name: "Emergency Touch Grass Protocol", description: "Lowest Uselessness wins.", stat: "uselessness", direction: "LOW" },
  { id: "receipts", name: "The Internet Has Receipts", description: "Highest Shadiness wins.", stat: "shadiness", direction: "HIGH" },
  { id: "viral", name: "Accidentally Goes Viral", description: "Highest Aura wins.", stat: "aura", direction: "HIGH" },
  { id: "humble", name: "Mandatory Humbling Event", description: "Lowest Aura wins.", stat: "aura", direction: "LOW" },
];
