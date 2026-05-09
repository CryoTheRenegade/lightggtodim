import type { DestinyHash } from "../types";
import { sleep } from "../util/retry";

const MANIFEST_URL = "https://www.bungie.net/Platform/Destiny2/Manifest/";
const BUNGIE_HOST = "https://www.bungie.net";
const MAX_FETCH_ATTEMPTS = 4;
const FETCH_TIMEOUT_MS = 60_000;

export interface ManifestMetadata {
  version: string;
  inventoryItemPath: string;
  plugSetPath?: string;
}

export interface DestinyInventoryItemDefinition {
  hash: DestinyHash;
  displayProperties?: {
    name?: string;
    description?: string;
    icon?: string;
  };
  itemType?: number;
  itemSubType?: number;
  inventory?: {
    tierType?: number;
  };
  sockets?: {
    socketEntries?: ManifestSocketEntry[];
  };
  plug?: {
    plugCategoryIdentifier?: string;
  };
  quality?: {
    currentVersion?: number;
    versions?: Array<{ powerCapHash?: DestinyHash }>;
  };
  itemCategoryHashes?: DestinyHash[];
}

export interface ManifestSocketEntry {
  socketTypeHash?: DestinyHash;
  singleInitialItemHash?: DestinyHash;
  randomizedPlugSetHash?: DestinyHash;
  reusablePlugSetHash?: DestinyHash;
  reusablePlugItems?: Array<{ plugItemHash: DestinyHash }>;
}

export interface DestinyPlugSetDefinition {
  hash: DestinyHash;
  reusablePlugItems?: Array<{ plugItemHash: DestinyHash }>;
}

export interface ManifestData {
  version: string;
  inventoryItems: Record<string, DestinyInventoryItemDefinition>;
  plugSets: Record<string, DestinyPlugSetDefinition>;
}

interface ManifestResponse {
  Response?: {
    version?: string;
    jsonWorldComponentContentPaths?: Record<string, Record<string, string>>;
  };
}

export async function fetchManifestMetadata(language = "en"): Promise<ManifestMetadata> {
  const body = await fetchJson<ManifestResponse>(MANIFEST_URL, "Bungie manifest metadata");
  const paths = body.Response?.jsonWorldComponentContentPaths?.[language];
  const inventoryItemPath = paths?.DestinyInventoryItemDefinition;
  if (!body.Response?.version || !inventoryItemPath) {
    throw new Error(`Bungie manifest response did not include ${language} item definitions`);
  }

  return {
    version: body.Response.version,
    inventoryItemPath,
    plugSetPath: paths?.DestinyPlugSetDefinition
  };
}

export async function fetchManifestData(language = "en"): Promise<ManifestData> {
  const metadata = await fetchManifestMetadata(language);
  const [inventoryItems, plugSets] = await Promise.all([
    fetchJson<Record<string, DestinyInventoryItemDefinition>>(metadata.inventoryItemPath),
    metadata.plugSetPath
      ? fetchJson<Record<string, DestinyPlugSetDefinition>>(metadata.plugSetPath)
      : Promise.resolve({})
  ]);

  return {
    version: metadata.version,
    inventoryItems,
    plugSets
  };
}

async function fetchJson<T>(path: string, label = path): Promise<T> {
  const url = path.startsWith("http") ? path : `${BUNGIE_HOST}${path}`;
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: bungieHeaders(),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
      });
      const text = await response.text();

      if (response.ok) {
        return JSON.parse(text) as T;
      }

      lastError = new Error(
        `Failed to fetch ${label}: ${response.status}${formatResponseDetail(text)}`
      );
      if (!isTransientStatus(response.status)) {
        break;
      }
    } catch (error) {
      lastError = error;
    }

    if (attempt < MAX_FETCH_ATTEMPTS) {
      await sleep(1_000 * attempt);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Failed to fetch ${label}: ${String(lastError)}`);
}

function bungieHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    accept: "application/json",
    "user-agent": "lightggtodim/0.1.0"
  };
  if (process.env.BUNGIE_API_KEY) {
    headers["x-api-key"] = process.env.BUNGIE_API_KEY;
  }
  return headers;
}

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function formatResponseDetail(text: string): string {
  if (!text.trim()) {
    return "";
  }

  try {
    const json = JSON.parse(text) as { ErrorStatus?: string; Message?: string };
    const detail = [json.ErrorStatus, json.Message].filter(Boolean).join(" - ");
    return detail ? ` (${detail})` : "";
  } catch {
    return ` (${text.slice(0, 200)})`;
  }
}
