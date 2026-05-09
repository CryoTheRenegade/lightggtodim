import type { Activity, LightggWeaponPopularity, PopularPerk } from "../types";
import { lightggWeaponPopularitySchema } from "./schemas";

const activityValues = new Set<Activity>(["pvp", "pve", "either", "unknown"]);
const socketKinds = new Set<PopularPerk["socketKind"]>([
  "barrel",
  "magazine",
  "trait3",
  "trait4",
  "origin",
  "unknown"
]);

export function parsePopularityHtml(
  html: string,
  sourceUrl: string,
  scrapedAt = new Date().toISOString()
): LightggWeaponPopularity {
  const structured = parseStructuredPopularity(html, sourceUrl, scrapedAt);
  if (structured) {
    return structured;
  }

  return parseDomPopularity(html, sourceUrl, scrapedAt);
}

function parseStructuredPopularity(
  html: string,
  sourceUrl: string,
  scrapedAt: string
): LightggWeaponPopularity | null {
  const scriptBodies = [
    ...html.matchAll(/<script[^>]*id=["']lightgg-popularity["'][^>]*>([\s\S]*?)<\/script>/gi),
    ...html.matchAll(/window\.__LIGHTGG_POPULARITY__\s*=\s*(\{[\s\S]*?\});/gi)
  ].map((match) => decodeHtml(match[1]?.trim() ?? ""));

  for (const body of scriptBodies) {
    const parsed = parseJsonObject(body);
    if (!parsed) {
      continue;
    }
    const normalized = normalizeStructuredObject(parsed, sourceUrl, scrapedAt);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function parseDomPopularity(
  html: string,
  sourceUrl: string,
  scrapedAt: string
): LightggWeaponPopularity {
  const itemHash = Number(sourceUrl.match(/\/items\/(\d+)/)?.[1] ?? 0);
  const itemName = parseItemName(html, itemHash);

  const individualPerks = [
    ...parseCommunityAveragePerks(html),
    ...[...html.matchAll(/<[^>]+data-popularity-perk\b[^>]*>/gi)]
      .map((match) => parsePerkElement(match[0]))
      .filter((perk): perk is PopularPerk => perk !== null)
  ];

  const traitCombos = [...html.matchAll(/<[^>]+data-popularity-combo\b[^>]*>/gi)]
    .map((match) => {
      const attrs = parseAttributes(match[0]);
      const percent = parsePercent(attrs["data-percent"]);
      const trait3Hash = Number(attrs["data-trait3-hash"]);
      const trait4Hash = Number(attrs["data-trait4-hash"]);
      if (!Number.isInteger(trait3Hash) || !Number.isInteger(trait4Hash) || percent === null) {
        return null;
      }
      return {
        trait3Hash,
        trait4Hash,
        percent,
        activity: normalizeActivity(attrs["data-activity"])
      };
    })
    .filter((combo): combo is NonNullable<typeof combo> => combo !== null);

  return lightggWeaponPopularitySchema.parse({
    itemHash,
    itemName,
    sourceUrl,
    scrapedAt,
    individualPerks,
    traitCombos
  });
}

function parseCommunityAveragePerks(html: string): PopularPerk[] {
  const container = extractElementById(html, "community-average");
  if (!container) {
    return [];
  }

  const socketKinds: PopularPerk["socketKind"][] = ["barrel", "magazine", "trait3", "trait4"];
  const socketColumns = [
    ...container.matchAll(/<ul\b[^>]*class=["'][^"']*\bsockets\b[^"']*["'][^>]*>([\s\S]*?)<\/ul>/gi)
  ];

  return socketColumns.flatMap((column, index) => {
    const socketKind = socketKinds[index] ?? "unknown";
    return [...column[1].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
      .map((match) => parseCommunityAveragePerk(match[1], socketKind))
      .filter((perk): perk is PopularPerk => perk !== null);
  });
}

function parseCommunityAveragePerk(
  html: string,
  socketKind: PopularPerk["socketKind"]
): PopularPerk | null {
  const percent = parsePercent(
    html.match(/<div\b[^>]*class=["'][^"']*\bpercent\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]
  );
  const itemElement = html.match(
    /<div\b[^>]*class=["'][^"']*\bitem\b[^"']*["'][^>]*data-id=["'](\d+)["'][^>]*>/i
  );
  const hash = Number(itemElement?.[1]);
  const name = decodeHtml(
    html.match(/<img\b[^>]*\balt=["']([^"']+)["'][^>]*>/i)?.[1] ?? `Perk ${hash}`
  )
    .replace(/<[^>]+>/g, "")
    .trim();

  if (!Number.isInteger(hash) || percent === null) {
    return null;
  }

  return {
    hash,
    name,
    percent,
    activity: "either",
    socketKind
  };
}

function extractElementById(html: string, id: string): string | null {
  const startMatch = new RegExp(
    `<([a-z0-9]+)\\b[^>]*id=["']${escapeRegex(id)}["'][^>]*>`,
    "i"
  ).exec(html);
  if (startMatch?.index === undefined) {
    return null;
  }

  const tag = startMatch[1];
  const start = startMatch.index;
  const tagPattern = new RegExp(`<\\/?${tag}\\b[^>]*>`, "gi");
  tagPattern.lastIndex = start;
  let depth = 0;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(html)) !== null) {
    if (match[0].startsWith("</")) {
      depth -= 1;
      if (depth === 0) {
        return html.slice(start, tagPattern.lastIndex);
      }
    } else {
      depth += 1;
    }
  }

  return null;
}

function parseItemName(html: string, itemHash: number): string {
  const raw =
    html.match(/<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i)?.[1] ??
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ??
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ??
    `Item ${itemHash}`;

  return decodeHtml(raw)
    .replace(/\s+-\s+Destiny 2[\s\S]*$/i, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function normalizeStructuredObject(
  value: unknown,
  sourceUrl: string,
  scrapedAt: string
): LightggWeaponPopularity | null {
  const direct = lightggWeaponPopularitySchema.safeParse({
    ...(typeof value === "object" && value !== null ? value : {}),
    sourceUrl: getStringProperty(value, "sourceUrl") ?? sourceUrl,
    scrapedAt: getStringProperty(value, "scrapedAt") ?? scrapedAt
  });
  if (direct.success) {
    return direct.data;
  }

  return null;
}

function parsePerkElement(element: string): PopularPerk | null {
  const attrs = parseAttributes(element);
  const percent = parsePercent(attrs["data-percent"]);
  const hash = Number(attrs["data-hash"]);
  const socketKind = normalizeSocketKind(attrs["data-kind"]);

  if (!Number.isInteger(hash) || percent === null) {
    return null;
  }

  return {
    hash,
    name: decodeHtml(attrs["data-name"] ?? `Perk ${hash}`),
    percent,
    activity: normalizeActivity(attrs["data-activity"]),
    socketKind
  };
}

function parseAttributes(element: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of element.matchAll(/([\w:-]+)=["']([^"']*)["']/g)) {
    attrs[match[1].toLowerCase()] = decodeHtml(match[2]);
  }
  return attrs;
}

function parsePercent(raw: string | undefined): number | null {
  if (!raw) {
    return null;
  }
  const normalized = raw.replace("%", "").trim();
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function normalizeActivity(raw: string | undefined): Activity {
  const value = raw?.toLowerCase() as Activity | undefined;
  return value && activityValues.has(value) ? value : "unknown";
}

function normalizeSocketKind(raw: string | undefined): PopularPerk["socketKind"] {
  const value = raw?.toLowerCase() as PopularPerk["socketKind"] | undefined;
  return value && socketKinds.has(value) ? value : "unknown";
}

function parseJsonObject(body: string): unknown | null {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function decodeHtml(value: string): string {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#34;", '"')
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&#39;", "'");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getStringProperty(value: unknown, key: string): string | undefined {
  if (typeof value !== "object" || value === null || !(key in value)) {
    return undefined;
  }
  const property = (value as Record<string, unknown>)[key];
  return typeof property === "string" ? property : undefined;
}
