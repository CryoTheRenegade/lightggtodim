import { loadConfig, type AppConfig } from "../config";
import { fetchManifestData, type ManifestData } from "../bungie/manifest";
import { getWeaponCandidates } from "../bungie/weaponFilter";
import { formatWishlist } from "../dim/format";
import { selectStrictDimRolls } from "../dim/wishlist";
import { lightggPopularityCacheSchema } from "../lightgg/schemas";
import type {
  Activity,
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

export interface BuildAllWishlistsResult {
  pvp: BuildWishlistResult;
  pve: BuildWishlistResult;
}

interface WishlistOutputTarget {
  activity: Extract<Activity, "pvp" | "pve">;
  wishlistPath: string;
  metadataPath: string;
  title: string;
  notesComment: string;
}

export async function buildWishlist(config?: AppConfig): Promise<BuildAllWishlistsResult> {
  const resolvedConfig = config ?? (await loadConfig());
  logger.info("Fetching Bungie manifest data...");
  const manifest = await fetchManifestData(resolvedConfig.language);
  const popularity = lightggPopularityCacheSchema.parse(
    await readJsonFile<unknown>(POPULARITY_PATH)
  );
  const weaponsScanned = getWeaponCandidates(manifest).length;
  const generatedAt = new Date().toISOString();
  const sourceUrls = Object.fromEntries(
    popularity.map((entry) => [entry.itemHash, entry.sourceUrl])
  );
  const targets: WishlistOutputTarget[] = [
    {
      activity: "pvp",
      wishlistPath: resolvedConfig.output.wishlistPath,
      metadataPath: resolvedConfig.output.metadataPath,
      title: "lightggtodim Popular PvP Rolls",
      notesComment: "light.gg popular PvP full roll; masterwork unsupported by DIM"
    },
    {
      activity: "pve",
      wishlistPath: resolvedConfig.output.pveWishlistPath,
      metadataPath: resolvedConfig.output.pveMetadataPath,
      title: "lightggtodim Popular PvE Rolls",
      notesComment: "light.gg popular PvE full roll; masterwork unsupported by DIM"
    }
  ];
  const results = {} as BuildAllWishlistsResult;

  for (const target of targets) {
    const result = await buildWishlistFromData(
      resolvedConfig,
      manifest,
      popularity,
      target.activity
    );
    results[target.activity] = result;

    await writeTextFile(
      target.wishlistPath,
      formatWishlist(result.rolls, {
        title: target.title,
        description:
          "Generated from light.gg popularity data. Masterworks are not included because DIM wishlists do not support them.",
        generatedAt,
        source: "light.gg popularity data via local browser session",
        notesComment: target.notesComment
      })
    );

    await writeJsonFile(target.metadataPath, {
      generatedAt,
      activity: target.activity,
      bungieManifestVersion: manifest.version,
      weaponsScanned,
      successfulWishlistEntries: result.rolls.length,
      skippedWeapons: result.skipped.length,
      skippedReasons: result.skipped,
      sourceUrls,
      notes: ["DIM wishlists do not support masterworks, so masterworks are omitted."]
    });

    logger.info(`Wrote ${result.rolls.length} ${target.activity} rolls to ${target.wishlistPath}`);
  }

  return results;
}

export async function buildWishlistFromData(
  config: AppConfig,
  manifest: ManifestData,
  popularity: LightggWeaponPopularity[],
  activity: Activity = config.rolls.activity
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
      activity,
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
