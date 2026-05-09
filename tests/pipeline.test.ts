import { describe, expect, it } from "vitest";
import sampleManifest from "./fixtures/manifestWeapon.sample.json";
import { buildWishlistFromData } from "../src/pipeline/buildWishlist";
import { formatWishlist } from "../src/dim/format";
import type { AppConfig } from "../src/config";
import type { LightggWeaponPopularity } from "../src/types";
import type { ManifestData } from "../src/bungie/manifest";

const config: AppConfig = {
  language: "en",
  output: {
    wishlistPath: "dist/wishlists/lightgg-popular-pvp.txt",
    metadataPath: "dist/wishlists/metadata.json"
  },
  scrape: { delayMs: 0, maxRetries: 0, profileDir: ".browser/lightgg-profile" },
  rolls: {
    activity: "pvp",
    strategy: "strict-dim-supported-full-roll",
    includeUniversalPopularity: true,
    topBarrels: 2,
    topMagazines: 2,
    topTrait3: 3,
    topTrait4: 3,
    maxRollsPerWeapon: 36
  },
  weapons: {
    scope: "current-random-roll-legendary",
    excludeSunset: true,
    excludeCraftingPatternsOnly: false
  }
};

describe("pipeline", () => {
  it("fixture manifest and popularity produce a stable wishlist", async () => {
    const popularity: LightggWeaponPopularity[] = [
      {
        itemHash: 12345,
        itemName: "Fixture Weapon",
        sourceUrl: "https://www.light.gg/db/items/12345/",
        scrapedAt: "2026-05-08T00:00:00.000Z",
        individualPerks: [
          {
            hash: 111,
            name: "Arrowhead Brake",
            percent: 50,
            activity: "pvp",
            socketKind: "barrel"
          },
          {
            hash: 211,
            name: "Ricochet Rounds",
            percent: 60,
            activity: "pvp",
            socketKind: "magazine"
          },
          { hash: 311, name: "Keep Away", percent: 30, activity: "pvp", socketKind: "trait3" },
          { hash: 411, name: "Kill Clip", percent: 40, activity: "pvp", socketKind: "trait4" }
        ],
        traitCombos: []
      }
    ];

    const result = await buildWishlistFromData(config, sampleManifest as ManifestData, popularity);
    expect(
      formatWishlist(result.rolls, {
        title: "lightggtodim Popular PvP Rolls",
        description:
          "Generated from light.gg popularity data. Masterworks are not included because DIM wishlists do not support them.",
        generatedAt: "2026-05-08T00:00:00.000Z",
        source: "fixture"
      })
    ).toMatchInlineSnapshot(`
      "title:lightggtodim Popular PvP Rolls
      description:Generated from light.gg popularity data. Masterworks are not included because DIM wishlists do not support them.
      // Generated: 2026-05-08T00:00:00.000Z
      // Source: fixture
      //notes:light.gg popular PvP full roll; masterwork unsupported by DIM
      dimwishlist:item=12345&perks=111,211,311,411#notes:popular-pvp lightgg full-roll mw-unsupported
      "
    `);
  });
});
