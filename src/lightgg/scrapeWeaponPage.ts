import type { LightggWeaponPopularity } from "../types";
import { parsePopularityHtml } from "./popularityParser";

export function scrapeWeaponPageHtml(
  html: string,
  sourceUrl: string,
  scrapedAt = new Date().toISOString()
): LightggWeaponPopularity {
  return parsePopularityHtml(html, sourceUrl, scrapedAt);
}
