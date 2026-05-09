import { describe, expect, it } from "vitest";
import sampleManifest from "./fixtures/manifestWeapon.sample.json";
import { getWeaponCandidates } from "../src/bungie/weaponFilter";
import type { ManifestData } from "../src/bungie/manifest";

describe("weapon filtering", () => {
  it("includes valid legendary random-roll weapons", () => {
    const candidates = getWeaponCandidates(sampleManifest as ManifestData);
    expect(candidates.map((candidate) => candidate.hash)).toContain(12345);
  });

  it("excludes non-weapons and non-legendary weapons", () => {
    const candidates = getWeaponCandidates(sampleManifest as ManifestData);
    expect(candidates.map((candidate) => candidate.hash)).not.toContain(22222);
    expect(candidates.map((candidate) => candidate.hash)).not.toContain(33333);
  });

  it("excludes non-random-roll weapons", () => {
    const manifest = {
      ...sampleManifest,
      inventoryItems: {
        ...sampleManifest.inventoryItems,
        "44444": {
          hash: 44444,
          displayProperties: { name: "Static Weapon" },
          itemType: 3,
          inventory: { tierType: 5 },
          sockets: { socketEntries: [] }
        }
      }
    } as ManifestData;

    expect(getWeaponCandidates(manifest).map((candidate) => candidate.hash)).not.toContain(44444);
  });
});
