import { loadConfig } from "../config";
import { fetchManifestData } from "../bungie/manifest";
import { getWeaponCandidates } from "../bungie/weaponFilter";
import {
  createFlareSolverrSession,
  destroyFlareSolverrSession,
  scrapeWithFlareSolverr
} from "../lightgg/flaresolverr";
import { launchLightggBrowser, scrapeLightggUrlOnPage } from "../lightgg/browser";
import type { LightggWeaponPopularity } from "../types";
import { writeJsonFile } from "../util/fs";
import { logger } from "../util/logger";
import { sleep } from "../util/retry";
import type { BrowserContext, Page } from "playwright";

const POPULARITY_PATH = "data/lightgg-popularity.json";

export async function scrape(
  config?: Awaited<ReturnType<typeof loadConfig>>
): Promise<LightggWeaponPopularity[]> {
  const resolvedConfig = config ?? (await loadConfig());
  logger.info("Fetching Bungie manifest data...");
  const manifest = await fetchManifestData(resolvedConfig.language);
  const weapons = getWeaponCandidates(manifest);
  const scraped: LightggWeaponPopularity[] = [];
  const flareSolverrSession = await createFlareSolverrSession();
  logger.info(`Found ${weapons.length} candidate weapons.`);

  if (flareSolverrSession) {
    logger.info("Using local FlareSolverr session first; Playwright will navigate on fallback.");
  } else {
    logger.info("No local FlareSolverr session found; using Playwright browser scraping.");
  }

  const browserState: {
    context?: BrowserContext;
    page?: Page;
  } = {};

  async function browserPage(): Promise<Page> {
    if (!browserState.context) {
      logger.info(`Opening Chromium with persistent profile ${resolvedConfig.scrape.profileDir}`);
      browserState.context = await launchLightggBrowser(resolvedConfig.scrape);
      browserState.page = browserState.context.pages()[0] ?? (await browserState.context.newPage());
    }
    if (!browserState.page) {
      browserState.page = browserState.context.pages()[0] ?? (await browserState.context.newPage());
    }
    return browserState.page;
  }

  try {
    for (const weapon of weapons) {
      try {
        logger.info(`Scraping ${weapon.name} (${weapon.hash})`);
        const flareSolverrEntry = flareSolverrSession
          ? await scrapeWithFlareSolverr(weapon.lightggUrl, flareSolverrSession)
          : null;

        if (flareSolverrEntry) {
          logger.info(`FlareSolverr scraped ${weapon.lightggUrl}`);
          scraped.push(flareSolverrEntry);
          await sleep(resolvedConfig.scrape.delayMs);
          continue;
        }

        logger.info(`Navigating browser to ${weapon.lightggUrl}`);
        const entry = await scrapeLightggUrlOnPage(
          await browserPage(),
          weapon.lightggUrl,
          resolvedConfig.scrape
        );
        scraped.push(entry);
      } catch (error) {
        logger.warn(`Skipping ${weapon.name} (${weapon.hash}): ${String(error)}`);
      }
      await sleep(resolvedConfig.scrape.delayMs);
    }
  } finally {
    await browserState.context?.close();
    if (flareSolverrSession) {
      await destroyFlareSolverrSession(flareSolverrSession);
    }
  }

  await writeJsonFile(POPULARITY_PATH, scraped);
  logger.info(`Wrote ${scraped.length} popularity records to ${POPULARITY_PATH}`);
  return scraped;
}
