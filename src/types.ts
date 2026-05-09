export type DestinyHash = number;

export type Activity = "pvp" | "pve" | "either" | "unknown";

export interface WeaponCandidate {
  hash: DestinyHash;
  name: string;
  itemType: string;
  lightggUrl: string;
  sockets: WeaponSocketLayout;
}

export interface WeaponSocketLayout {
  barrelSocketIndexes: number[];
  magazineSocketIndexes: number[];
  traitSocketIndexes: [number, number];
  originTraitSocketIndexes: number[];
  perkHashesBySocketKind?: Partial<Record<PopularPerk["socketKind"], DestinyHash[]>>;
  normalPerkHashBySocketKind?: Partial<
    Record<PopularPerk["socketKind"], Record<string, DestinyHash>>
  >;
}

export interface PopularPerk {
  hash: DestinyHash;
  name: string;
  percent: number;
  activity?: Activity;
  socketKind: "barrel" | "magazine" | "trait3" | "trait4" | "origin" | "unknown";
}

export interface PopularTraitCombo {
  trait3Hash: DestinyHash;
  trait4Hash: DestinyHash;
  percent: number;
  activity?: Activity;
}

export interface LightggWeaponPopularity {
  itemHash: DestinyHash;
  itemName: string;
  sourceUrl: string;
  scrapedAt: string;
  individualPerks: PopularPerk[];
  traitCombos: PopularTraitCombo[];
}

export interface DimWishlistRoll {
  itemHash: DestinyHash;
  itemName?: string;
  perkHashes: DestinyHash[];
  notes: string[];
}

export interface SkippedWeapon {
  itemHash: DestinyHash;
  itemName: string;
  reason: string;
  sourceUrl?: string;
}
