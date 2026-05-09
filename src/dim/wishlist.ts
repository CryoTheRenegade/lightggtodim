import type {
  Activity,
  DimWishlistRoll,
  LightggWeaponPopularity,
  PopularPerk,
  PopularTraitCombo,
  WeaponCandidate
} from "../types";

export interface RollSelectionOptions {
  activity: Activity;
  includeUniversalPopularity: boolean;
  topBarrels?: number;
  topMagazines?: number;
  topTrait3?: number;
  topTrait4?: number;
  maxRollsPerWeapon?: number;
}

export type RollSelectionResult =
  | { ok: true; roll: DimWishlistRoll }
  | { ok: false; reason: string };

export type RollSelectionManyResult =
  | { ok: true; rolls: DimWishlistRoll[] }
  | { ok: false; reason: string };

export function selectStrictDimRoll(
  weapon: WeaponCandidate,
  popularity: LightggWeaponPopularity,
  options: RollSelectionOptions
): RollSelectionResult {
  const barrel = topPerk(popularity.individualPerks, "barrel", options);
  const magazine = topPerk(popularity.individualPerks, "magazine", options);
  const combo = topTraitCombo(popularity.traitCombos, options);

  let trait3: number | undefined;
  let trait4: number | undefined;
  if (combo) {
    trait3 = combo.trait3Hash;
    trait4 = combo.trait4Hash;
  } else {
    trait3 = topPerk(popularity.individualPerks, "trait3", options)?.hash;
    trait4 = topPerk(popularity.individualPerks, "trait4", options)?.hash;
  }

  if (!barrel || !magazine || !trait3 || !trait4) {
    return { ok: false, reason: "missing strict full-roll popularity data" };
  }

  const perkHashes = normalizePerkHashes(weapon, [barrel.hash, magazine.hash, trait3, trait4]);
  const invalid = validatePerks(weapon, perkHashes);
  if (invalid.length > 0) {
    return { ok: false, reason: `perk not found in manifest socket pool: ${invalid.join(",")}` };
  }

  return {
    ok: true,
    roll: {
      itemHash: weapon.hash,
      itemName: weapon.name,
      perkHashes,
      notes: ["popular-pvp", "lightgg", "full-roll", "mw-unsupported"]
    }
  };
}

export function selectStrictDimRolls(
  weapon: WeaponCandidate,
  popularity: LightggWeaponPopularity,
  options: RollSelectionOptions
): RollSelectionManyResult {
  const barrels = topPerkHashes(
    weapon,
    popularity.individualPerks,
    "barrel",
    options,
    options.topBarrels ?? 2
  );
  const magazines = topPerkHashes(
    weapon,
    popularity.individualPerks,
    "magazine",
    options,
    options.topMagazines ?? 2
  );
  const trait3s = topPerkHashes(
    weapon,
    popularity.individualPerks,
    "trait3",
    options,
    options.topTrait3 ?? 3
  );
  const trait4s = topPerkHashes(
    weapon,
    popularity.individualPerks,
    "trait4",
    options,
    options.topTrait4 ?? 3
  );

  if (
    barrels.length === 0 ||
    magazines.length === 0 ||
    trait3s.length === 0 ||
    trait4s.length === 0
  ) {
    return { ok: false, reason: "missing strict full-roll popularity data" };
  }

  const rolls: DimWishlistRoll[] = [];
  const seen = new Set<string>();
  const maxRolls = options.maxRollsPerWeapon ?? 36;

  for (const barrel of barrels) {
    for (const magazine of magazines) {
      for (const trait3 of trait3s) {
        for (const trait4 of trait4s) {
          const perkHashes = [barrel, magazine, trait3, trait4];
          const invalid = validatePerks(weapon, perkHashes);
          if (invalid.length > 0) {
            continue;
          }

          const key = perkHashes.join(",");
          if (seen.has(key)) {
            continue;
          }
          seen.add(key);
          rolls.push({
            itemHash: weapon.hash,
            itemName: weapon.name,
            perkHashes,
            notes: ["popular-pvp", "lightgg", "full-roll", "mw-unsupported"]
          });

          if (rolls.length >= maxRolls) {
            return { ok: true, rolls };
          }
        }
      }
    }
  }

  if (rolls.length === 0) {
    return { ok: false, reason: "no valid strict full-roll permutations" };
  }

  return { ok: true, rolls };
}

function normalizePerkHashes(weapon: WeaponCandidate, perkHashes: number[]): number[] {
  const socketKinds: PopularPerk["socketKind"][] = ["barrel", "magazine", "trait3", "trait4"];
  return perkHashes.map((hash, index) => {
    const aliases = weapon.sockets.normalPerkHashBySocketKind?.[socketKinds[index]];
    return aliases?.[String(hash)] ?? hash;
  });
}

function normalizePerkHash(
  weapon: WeaponCandidate,
  socketKind: PopularPerk["socketKind"],
  hash: number
): number {
  const aliases = weapon.sockets.normalPerkHashBySocketKind?.[socketKind];
  return aliases?.[String(hash)] ?? hash;
}

function topPerk(
  perks: PopularPerk[],
  socketKind: PopularPerk["socketKind"],
  options: RollSelectionOptions
): PopularPerk | undefined {
  return perks
    .filter((perk) => perk.socketKind === socketKind)
    .filter((perk) => activityMatches(perk.activity, options))
    .sort((a, b) => b.percent - a.percent || a.hash - b.hash)[0];
}

function topPerkHashes(
  weapon: WeaponCandidate,
  perks: PopularPerk[],
  socketKind: PopularPerk["socketKind"],
  options: RollSelectionOptions,
  limit: number
): number[] {
  const allowed = weapon.sockets.perkHashesBySocketKind?.[socketKind];
  const hashes: number[] = [];
  const seen = new Set<number>();

  for (const perk of perks
    .filter((candidate) => candidate.socketKind === socketKind)
    .filter((candidate) => activityMatches(candidate.activity, options))
    .sort((a, b) => b.percent - a.percent || a.hash - b.hash)) {
    const normalizedHash = normalizePerkHash(weapon, socketKind, perk.hash);
    if (seen.has(normalizedHash)) {
      continue;
    }
    if (allowed && !allowed.includes(normalizedHash)) {
      continue;
    }
    seen.add(normalizedHash);
    hashes.push(normalizedHash);
    if (hashes.length >= limit) {
      break;
    }
  }

  return hashes;
}

function topTraitCombo(
  combos: PopularTraitCombo[],
  options: RollSelectionOptions
): PopularTraitCombo | undefined {
  return combos
    .filter((combo) => activityMatches(combo.activity, options))
    .sort(
      (a, b) => b.percent - a.percent || a.trait3Hash - b.trait3Hash || a.trait4Hash - b.trait4Hash
    )[0];
}

function activityMatches(activity: Activity | undefined, options: RollSelectionOptions): boolean {
  const normalized = activity ?? "unknown";
  if (normalized === options.activity) {
    return true;
  }
  if (options.includeUniversalPopularity && (normalized === "either" || normalized === "unknown")) {
    return true;
  }
  return false;
}

function validatePerks(weapon: WeaponCandidate, perkHashes: number[]): number[] {
  const pools = weapon.sockets.perkHashesBySocketKind;
  if (!pools) {
    return [];
  }
  const socketKinds: PopularPerk["socketKind"][] = ["barrel", "magazine", "trait3", "trait4"];
  return perkHashes.filter((hash, index) => {
    const allowed = pools[socketKinds[index]];
    return allowed ? !allowed.includes(hash) : false;
  });
}
