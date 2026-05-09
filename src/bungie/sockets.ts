import type { PopularPerk, WeaponSocketLayout } from "../types";
import type {
  DestinyInventoryItemDefinition,
  DestinyPlugSetDefinition,
  ManifestSocketEntry
} from "./manifest";

type PerkPools = Partial<Record<PopularPerk["socketKind"], number[]>>;
type PerkAliasPools = Partial<Record<PopularPerk["socketKind"], Record<string, number>>>;

export function buildWeaponSocketLayout(
  item: DestinyInventoryItemDefinition,
  inventoryItems: Record<string, DestinyInventoryItemDefinition>,
  plugSets: Record<string, DestinyPlugSetDefinition> = {}
): WeaponSocketLayout | null {
  const entries = item.sockets?.socketEntries ?? [];
  const randomSockets = entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.randomizedPlugSetHash !== undefined)
    .map(({ entry, index }) => ({
      entry,
      index,
      perkHashes: collectSocketPlugHashes(entry, plugSets)
    }))
    .filter((socket) => socket.perkHashes.length > 0);

  const pools: PerkPools = {};
  const aliases: PerkAliasPools = {};
  const barrelSocketIndexes: number[] = [];
  const magazineSocketIndexes: number[] = [];
  const traitSocketIndexes: number[] = [];
  const originTraitSocketIndexes: number[] = [];

  for (const socket of randomSockets) {
    const kind = classifySocket(socket.perkHashes, inventoryItems);
    if (kind === "barrel") {
      barrelSocketIndexes.push(socket.index);
      pools.barrel = socket.perkHashes;
      aliases.barrel = buildNormalPerkAliases(socket.perkHashes, inventoryItems);
    } else if (kind === "magazine") {
      magazineSocketIndexes.push(socket.index);
      pools.magazine = socket.perkHashes;
      aliases.magazine = buildNormalPerkAliases(socket.perkHashes, inventoryItems);
    } else if (kind === "origin") {
      originTraitSocketIndexes.push(socket.index);
      pools.origin = socket.perkHashes;
      aliases.origin = buildNormalPerkAliases(socket.perkHashes, inventoryItems);
    } else if (kind === "trait3" || kind === "trait4") {
      traitSocketIndexes.push(socket.index);
      const traitKind = traitSocketIndexes.length === 1 ? "trait3" : "trait4";
      pools[traitKind] = socket.perkHashes;
      aliases[traitKind] = buildNormalPerkAliases(socket.perkHashes, inventoryItems);
    }
  }

  if (barrelSocketIndexes.length === 0 && randomSockets[0]) {
    barrelSocketIndexes.push(randomSockets[0].index);
    pools.barrel = randomSockets[0].perkHashes;
    aliases.barrel = buildNormalPerkAliases(randomSockets[0].perkHashes, inventoryItems);
  }
  if (magazineSocketIndexes.length === 0 && randomSockets[1]) {
    magazineSocketIndexes.push(randomSockets[1].index);
    pools.magazine = randomSockets[1].perkHashes;
    aliases.magazine = buildNormalPerkAliases(randomSockets[1].perkHashes, inventoryItems);
  }
  while (traitSocketIndexes.length < 2 && randomSockets[2 + traitSocketIndexes.length]) {
    const socket = randomSockets[2 + traitSocketIndexes.length];
    const traitKind = traitSocketIndexes.length === 0 ? "trait3" : "trait4";
    traitSocketIndexes.push(socket.index);
    pools[traitKind] = socket.perkHashes;
    aliases[traitKind] = buildNormalPerkAliases(socket.perkHashes, inventoryItems);
  }

  if (
    barrelSocketIndexes.length === 0 ||
    magazineSocketIndexes.length === 0 ||
    traitSocketIndexes.length < 2
  ) {
    return null;
  }

  return {
    barrelSocketIndexes,
    magazineSocketIndexes,
    traitSocketIndexes: [traitSocketIndexes[0], traitSocketIndexes[1]],
    originTraitSocketIndexes,
    perkHashesBySocketKind: pools,
    normalPerkHashBySocketKind: aliases
  };
}

function buildNormalPerkAliases(
  perkHashes: number[],
  inventoryItems: Record<string, DestinyInventoryItemDefinition>
): Record<string, number> {
  const preferredByKey = new Map<string, number>();
  const aliases: Record<string, number> = {};

  for (const hash of perkHashes) {
    const key = equivalentPerkKey(hash, inventoryItems);
    if (!preferredByKey.has(key)) {
      preferredByKey.set(key, hash);
    }
    aliases[String(hash)] = preferredByKey.get(key) ?? hash;
  }

  return aliases;
}

function equivalentPerkKey(
  hash: number,
  inventoryItems: Record<string, DestinyInventoryItemDefinition>
): string {
  const item = inventoryItems[String(hash)];
  return [
    item?.displayProperties?.name ?? hash,
    item?.displayProperties?.icon ?? "",
    item?.plug?.plugCategoryIdentifier ?? ""
  ].join("|");
}

function collectSocketPlugHashes(
  entry: ManifestSocketEntry,
  plugSets: Record<string, DestinyPlugSetDefinition>
): number[] {
  const hashes = new Set<number>();
  for (const plug of entry.reusablePlugItems ?? []) {
    hashes.add(plug.plugItemHash);
  }
  for (const setHash of [entry.randomizedPlugSetHash, entry.reusablePlugSetHash]) {
    const plugSet = setHash ? plugSets[String(setHash)] : undefined;
    for (const plug of plugSet?.reusablePlugItems ?? []) {
      hashes.add(plug.plugItemHash);
    }
  }
  return [...hashes].filter((hash) => Number.isInteger(hash) && hash > 0);
}

function classifySocket(
  perkHashes: number[],
  inventoryItems: Record<string, DestinyInventoryItemDefinition>
): PopularPerk["socketKind"] {
  const categories = perkHashes
    .map((hash) => inventoryItems[String(hash)]?.plug?.plugCategoryIdentifier?.toLowerCase() ?? "")
    .filter(Boolean);

  if (categories.some((category) => category.includes("barrel") || category.includes("barrels"))) {
    return "barrel";
  }
  if (
    categories.some(
      (category) =>
        category.includes("magazine") ||
        category.includes("magazines") ||
        category.includes("battery") ||
        category.includes("batteries")
    )
  ) {
    return "magazine";
  }
  if (categories.some((category) => category.includes("origin"))) {
    return "origin";
  }
  if (categories.some((category) => category.includes("trait") || category.includes("frame"))) {
    return "trait3";
  }
  return "unknown";
}
