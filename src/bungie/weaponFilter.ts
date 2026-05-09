import type { WeaponCandidate } from "../types";
import type { DestinyInventoryItemDefinition, ManifestData } from "./manifest";
import { buildWeaponSocketLayout } from "./sockets";

const ITEM_TYPE_WEAPON = 3;
const TIER_TYPE_LEGENDARY = 5;

export function getWeaponCandidates(manifest: ManifestData): WeaponCandidate[] {
  return Object.values(manifest.inventoryItems)
    .map((item) => toWeaponCandidate(item, manifest))
    .filter((candidate): candidate is WeaponCandidate => candidate !== null)
    .sort((a, b) => a.name.localeCompare(b.name) || a.hash - b.hash);
}

export function toWeaponCandidate(
  item: DestinyInventoryItemDefinition,
  manifest: Pick<ManifestData, "inventoryItems" | "plugSets">
): WeaponCandidate | null {
  if (item.itemType !== ITEM_TYPE_WEAPON) {
    return null;
  }
  if (item.inventory?.tierType !== TIER_TYPE_LEGENDARY) {
    return null;
  }
  const name = item.displayProperties?.name?.trim();
  if (!name) {
    return null;
  }
  const sockets = buildWeaponSocketLayout(item, manifest.inventoryItems, manifest.plugSets);
  if (!sockets) {
    return null;
  }

  return {
    hash: item.hash,
    name,
    itemType: "weapon",
    lightggUrl: `https://www.light.gg/db/items/${item.hash}/`,
    sockets
  };
}
