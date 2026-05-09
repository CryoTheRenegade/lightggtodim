import type { LightggWeaponPopularity } from "../types";
import { scrapeWeaponPageHtml } from "./scrapeWeaponPage";

const DEFAULT_FLARESOLVERR_URL = "http://127.0.0.1:8191/v1";
const FLARESOLVERR_TIMEOUT_MS = 120_000;

interface FlareSolverrResponse {
  status?: string;
  session?: string;
  solution?: {
    response?: string;
    status?: number;
  };
  message?: string;
}

export async function createFlareSolverrSession(): Promise<string | null> {
  if (process.env.LIGHTGGTODIM_DISABLE_FLARESOLVERR === "1") {
    return null;
  }

  try {
    const response = await postFlareSolverr({ cmd: "sessions.create" });
    return response.status === "ok" && response.session ? response.session : null;
  } catch {
    return null;
  }
}

export async function destroyFlareSolverrSession(session: string): Promise<void> {
  await postFlareSolverr({ cmd: "sessions.destroy", session }).catch(() => undefined);
}

export async function scrapeWithFlareSolverr(
  url: string,
  session: string
): Promise<LightggWeaponPopularity | null> {
  try {
    const response = await postFlareSolverr({
      cmd: "request.get",
      url,
      session,
      maxTimeout: 90_000
    });

    const html = response.solution?.response;
    if (response.status !== "ok" || !html) {
      return null;
    }

    const parsed = scrapeWeaponPageHtml(html, url);
    return parsed.individualPerks.length > 0 || parsed.traitCombos.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

async function postFlareSolverr(body: Record<string, unknown>): Promise<FlareSolverrResponse> {
  const endpoint = process.env.FLARESOLVERR_URL ?? DEFAULT_FLARESOLVERR_URL;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(FLARESOLVERR_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error(`FlareSolverr returned ${response.status}`);
  }

  return (await response.json()) as FlareSolverrResponse;
}
