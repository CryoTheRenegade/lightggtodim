import type { DimWishlistRoll } from "../types";

export interface WishlistFormatOptions {
  title: string;
  description: string;
  generatedAt: string;
  source: string;
}

export function formatWishlist(rolls: DimWishlistRoll[], options: WishlistFormatOptions): string {
  const lines = [
    `title:${options.title}`,
    `description:${options.description}`,
    `// Generated: ${options.generatedAt}`,
    `// Source: ${options.source}`,
    `//notes:light.gg popular PvP full roll; masterwork unsupported by DIM`
  ];

  for (const roll of normalizeRolls(rolls)) {
    lines.push(
      `dimwishlist:item=${roll.itemHash}&perks=${roll.perkHashes.join(",")}#notes:${encodeNotes(roll.notes)}`
    );
  }

  return `${lines.join("\n")}\n`;
}

export function normalizeRolls(rolls: DimWishlistRoll[]): DimWishlistRoll[] {
  const deduped = new Map<string, DimWishlistRoll>();
  for (const roll of rolls) {
    const key = `${roll.itemHash}:${roll.perkHashes.join(",")}`;
    if (!deduped.has(key)) {
      deduped.set(key, roll);
    }
  }

  return [...deduped.values()].sort(
    (a, b) => (a.itemName ?? "").localeCompare(b.itemName ?? "") || a.itemHash - b.itemHash
  );
}

function encodeNotes(notes: string[]): string {
  return notes.join(" ");
}
