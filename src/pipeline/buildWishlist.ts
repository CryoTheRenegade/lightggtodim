import { loadConfig, type AppConfig } from "../config";
import { fetchManifestData, type ManifestData } from "../bungie/manifest";
import { getWeaponCandidates } from "../bungie/weaponFilter";
import { formatWishlist } from "../dim/format";
import { selectStrictDimRolls } from "../dim/wishlist";
import { lightggPopularityCacheSchema } from "../lightgg/schemas";
import type {
  DimWishlistRoll,
  LightggWeaponPopularity,
  SkippedWeapon,
  WeaponCandidate
} from "../types";
import { readJsonFile, writeJsonFile, writeTextFile } from "../util/fs";
import { logger } from "../util/logger";

const POPULARITY_PATH = "data/lightgg-popularity.json";

export interface BuildWishlistResult {
  rolls: DimWishlistRoll[];
  skipped: SkippedWeapon[];
}

export async function buildWishlist(config?: AppConfig): Promise<BuildWishlistResult> {
  const resolvedConfig = config ?? (await loadConfig());
  logger.info("Fetching Bungie manifest data...");
  const manifest = await fetchManifestData(resolvedConfig.language);
  const popularity = lightggPopularityCacheSchema.parse(
    await readJsonFile<unknown>(POPULARITY_PATH)
  );
  const result = await buildWishlistFromData(resolvedConfig, manifest, popularity);

  await writeTextFile(
    resolvedConfig.output.wishlistPath,
    formatWishlist(result.rolls, {
      title: "lightggtodim Popular PvP Rolls",
      description:
        "Generated from light.gg popularity data. Masterworks are not included because DIM wishlists do not support them.",
      generatedAt: new Date().toISOString(),
      source: "light.gg popularity data via local browser session"
    })
  );

  await writeJsonFile(resolvedConfig.output.metadataPath, {
    generatedAt: new Date().toISOString(),
    bungieManifestVersion: manifest.version,
    weaponsScanned: getWeaponCandidates(manifest).length,
    successfulWishlistEntries: result.rolls.length,
    skippedWeapons: result.skipped.length,
    skippedReasons: result.skipped,
    sourceUrls: Object.fromEntries(popularity.map((entry) => [entry.itemHash, entry.sourceUrl])),
    notes: ["DIM wishlists do not support masterworks, so masterworks are omitted."]
  });

  logger.info(`Wrote ${result.rolls.length} rolls to ${resolvedConfig.output.wishlistPath}`);
  return result;
}

export async function buildWishlistFromData(
  config: AppConfig,
  manifest: ManifestData,
  popularity: LightggWeaponPopularity[]
): Promise<BuildWishlistResult> {
  const weapons = getWeaponCandidates(manifest);
  const popularityByHash = new Map(popularity.map((entry) => [entry.itemHash, entry]));
  const rolls: DimWishlistRoll[] = [];
  const skipped: SkippedWeapon[] = [];

  for (const weapon of weapons) {
    const entry = popularityByHash.get(weapon.hash);
    if (!entry) {
      skipped.push(skip(weapon, "no light.gg popularity data"));
      continue;
    }

    const selected = selectStrictDimRolls(weapon, entry, {
      activity: config.rolls.activity,
      includeUniversalPopularity: config.rolls.includeUniversalPopularity,
      topBarrels: config.rolls.topBarrels,
      topMagazines: config.rolls.topMagazines,
      topTrait3: config.rolls.topTrait3,
      topTrait4: config.rolls.topTrait4,
      maxRollsPerWeapon: config.rolls.maxRollsPerWeapon
    });
    if (!selected.ok) {
      skipped.push(skip(weapon, selected.reason, entry.sourceUrl));
      continue;
    }

    rolls.push(...selected.rolls);
  }

  return { rolls, skipped };
}

function skip(weapon: WeaponCandidate, reason: string, sourceUrl?: string): SkippedWeapon {
  return {
    itemHash: weapon.hash,
    itemName: weapon.name,
    reason,
    sourceUrl: sourceUrl ?? weapon.lightggUrl
  };
}
