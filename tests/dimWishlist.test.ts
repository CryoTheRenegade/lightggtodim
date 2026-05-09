import { describe, expect, it } from "vitest";
import { formatWishlist } from "../src/dim/format";
import { selectStrictDimRoll, selectStrictDimRolls } from "../src/dim/wishlist";
import type { LightggWeaponPopularity, WeaponCandidate } from "../src/types";

const weapon: WeaponCandidate = {
  hash: 12345,
  name: "Fixture Weapon",
  itemType: "weapon",
  lightggUrl: "https://www.light.gg/db/items/12345/",
  sockets: {
    barrelSocketIndexes: [0],
    magazineSocketIndexes: [1],
    traitSocketIndexes: [2, 3],
    originTraitSocketIndexes: [],
    perkHashesBySocketKind: {
      barrel: [111, 112],
      magazine: [211, 212],
      trait3: [311, 312],
      trait4: [411, 412]
    }
  }
};

const popularity: LightggWeaponPopularity = {
  itemHash: 12345,
  itemName: "Fixture Weapon",
  sourceUrl: "https://www.light.gg/db/items/12345/",
  scrapedAt: "2026-05-08T00:00:00.000Z",
  individualPerks: [
    { hash: 112, name: "Smallbore", percent: 10, activity: "pvp", socketKind: "barrel" },
    { hash: 111, name: "Arrowhead Brake", percent: 50, activity: "pvp", socketKind: "barrel" },
    { hash: 211, name: "Ricochet Rounds", percent: 60, activity: "pvp", socketKind: "magazine" },
    {
      hash: 212,
      name: "High-Caliber Rounds",
      percent: 20,
      activity: "pvp",
      socketKind: "magazine"
    },
    { hash: 312, name: "Perpetual Motion", percent: 11, activity: "pvp", socketKind: "trait3" },
    { hash: 311, name: "Keep Away", percent: 30, activity: "pvp", socketKind: "trait3" },
    { hash: 412, name: "Headseeker", percent: 12, activity: "pvp", socketKind: "trait4" },
    { hash: 411, name: "Kill Clip", percent: 40, activity: "pvp", socketKind: "trait4" }
  ],
  traitCombos: [{ trait3Hash: 312, trait4Hash: 412, percent: 20, activity: "pvp" }]
};

describe("DIM wishlist formatting", () => {
  it("formats a single roll with headers and notes", () => {
    const text = formatWishlist(
      [
        {
          itemHash: 12345,
          itemName: "Fixture Weapon",
          perkHashes: [111, 211, 311, 411],
          notes: ["popular pvp", "lightgg"]
        }
      ],
      {
        title: "Title",
        description: "Description",
        generatedAt: "2026-05-08T00:00:00.000Z",
        source: "fixture"
      }
    );

    expect(text).toContain("title:Title\n");
    expect(text).toContain("description:Description\n");
    expect(text).toContain("// Generated: 2026-05-08T00:00:00.000Z\n");
    expect(text).toContain(
      "dimwishlist:item=12345&perks=111,211,311,411#notes:popular pvp lightgg"
    );
  });

  it("deduplicates identical item/perk sets", () => {
    const text = formatWishlist(
      [
        {
          itemHash: 12345,
          itemName: "Fixture Weapon",
          perkHashes: [111, 211, 311, 411],
          notes: ["a"]
        },
        {
          itemHash: 12345,
          itemName: "Fixture Weapon",
          perkHashes: [111, 211, 311, 411],
          notes: ["a"]
        }
      ],
      { title: "Title", description: "Description", generatedAt: "now", source: "fixture" }
    );

    expect(text.match(/^dimwishlist:/gm)).toHaveLength(1);
  });
});

describe("roll selection", () => {
  it("chooses top barrel, magazine, and trait combo", () => {
    const selected = selectStrictDimRoll(weapon, popularity, {
      activity: "pvp",
      includeUniversalPopularity: true
    });

    expect(selected).toEqual(
      expect.objectContaining({
        ok: true,
        roll: expect.objectContaining({ perkHashes: [111, 211, 312, 412] })
      })
    );
  });

  it("falls back to individual trait columns", () => {
    const selected = selectStrictDimRoll(
      weapon,
      { ...popularity, traitCombos: [] },
      {
        activity: "pvp",
        includeUniversalPopularity: true
      }
    );

    expect(selected).toEqual(
      expect.objectContaining({
        ok: true,
        roll: expect.objectContaining({ perkHashes: [111, 211, 311, 411] })
      })
    );
  });

  it("rejects incomplete strict rolls", () => {
    const selected = selectStrictDimRoll(
      weapon,
      { ...popularity, individualPerks: [] },
      {
        activity: "pvp",
        includeUniversalPopularity: true
      }
    );

    expect(selected).toEqual(expect.objectContaining({ ok: false }));
  });

  it("builds top-N full-roll permutations", () => {
    const selected = selectStrictDimRolls(
      weapon,
      { ...popularity, traitCombos: [] },
      {
        activity: "pvp",
        includeUniversalPopularity: true,
        topBarrels: 2,
        topMagazines: 2,
        topTrait3: 2,
        topTrait4: 2,
        maxRollsPerWeapon: 16
      }
    );

    expect(selected).toEqual(expect.objectContaining({ ok: true }));
    expect(selected.ok ? selected.rolls.map((roll) => roll.perkHashes) : []).toEqual([
      [111, 211, 311, 411],
      [111, 211, 311, 412],
      [111, 211, 312, 411],
      [111, 211, 312, 412],
      [111, 212, 311, 411],
      [111, 212, 311, 412],
      [111, 212, 312, 411],
      [111, 212, 312, 412],
      [112, 211, 311, 411],
      [112, 211, 311, 412],
      [112, 211, 312, 411],
      [112, 211, 312, 412],
      [112, 212, 311, 411],
      [112, 212, 311, 412],
      [112, 212, 312, 411],
      [112, 212, 312, 412]
    ]);
  });
});
