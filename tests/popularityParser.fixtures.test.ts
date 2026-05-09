import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parsePopularityHtml } from "../src/lightgg/popularityParser";

describe("light.gg popularity parser", () => {
  it("parses saved fixture HTML", async () => {
    const html = await readFile("tests/fixtures/lightgg-weapon-page.html", "utf8");
    const parsed = parsePopularityHtml(
      html,
      "https://www.light.gg/db/items/12345/",
      "2026-05-08T00:00:00.000Z"
    );

    expect(parsed.itemHash).toBe(12345);
    expect(parsed.individualPerks).toHaveLength(5);
    expect(parsed.traitCombos).toEqual([
      { trait3Hash: 311, trait4Hash: 411, percent: 28.4, activity: "pvp" }
    ]);
  });

  it("handles missing sections", () => {
    const parsed = parsePopularityHtml(
      "<h1>No Popularity</h1>",
      "https://www.light.gg/db/items/999/"
    );

    expect(parsed.itemHash).toBe(999);
    expect(parsed.individualPerks).toEqual([]);
    expect(parsed.traitCombos).toEqual([]);
  });

  it("handles malformed percentages by skipping malformed entries", () => {
    const parsed = parsePopularityHtml(
      '<h1>Malformed</h1><div data-popularity-perk data-hash="1" data-name="Bad" data-percent="not-a-number" data-kind="barrel"></div>',
      "https://www.light.gg/db/items/1/"
    );

    expect(parsed.individualPerks).toEqual([]);
  });

  it("parses live light.gg community average columns", async () => {
    const html = await readFile("tests/fixtures/lightgg-community-average-snippet.html", "utf8");
    const parsed = parsePopularityHtml(html, "https://www.light.gg/db/items/4164201232/");

    expect(parsed.itemName).toBe("1000 Yard Stare");
    expect(parsed.individualPerks).toEqual([
      {
        hash: 1840239774,
        name: "Fluted Barrel",
        percent: 15.6,
        activity: "either",
        socketKind: "barrel"
      },
      {
        hash: 839105230,
        name: "Arrowhead Brake",
        percent: 15.2,
        activity: "either",
        socketKind: "barrel"
      },
      {
        hash: 3142289711,
        name: "Accurized Rounds",
        percent: 30.1,
        activity: "either",
        socketKind: "magazine"
      },
      {
        hash: 2846385770,
        name: "Snapshot Sights",
        percent: 22.5,
        activity: "either",
        socketKind: "trait3"
      },
      {
        hash: 47981717,
        name: "Opening Shot",
        percent: 18.7,
        activity: "either",
        socketKind: "trait4"
      }
    ]);
  });
});
