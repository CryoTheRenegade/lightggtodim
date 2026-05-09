import { chromium, type BrowserContext, type Page } from "playwright";
import { mkdir } from "node:fs/promises";
import { scrapeWeaponPageHtml } from "./scrapeWeaponPage";
import type { LightggWeaponPopularity } from "../types";
import { retry } from "../util/retry";

export interface BrowserScrapeOptions {
  profileDir: string;
  delayMs: number;
  maxRetries: number;
}

export async function launchLightggBrowser(options: BrowserScrapeOptions): Promise<BrowserContext> {
  await mkdir(options.profileDir, { recursive: true });
  return await chromium.launchPersistentContext(options.profileDir, {
    headless: false,
    viewport: { width: 1440, height: 1000 }
  });
}

export async function withLightggBrowser<T>(
  options: BrowserScrapeOptions,
  callback: (context: BrowserContext) => Promise<T>
): Promise<T> {
  const context = await launchLightggBrowser(options);

  try {
    return await callback(context);
  } finally {
    await context.close();
  }
}

export async function scrapeLightggUrl(
  context: BrowserContext,
  url: string,
  options: BrowserScrapeOptions
): Promise<LightggWeaponPopularity> {
  const page = await context.newPage();
  try {
    return await scrapeLightggUrlOnPage(page, url, options);
  } finally {
    await page.close();
  }
}

export async function scrapeLightggUrlOnPage(
  page: Page,
  url: string,
  options: BrowserScrapeOptions
): Promise<LightggWeaponPopularity> {
  return await retry(
    async () => {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await waitForManualChallengeIfNeeded(page);
      const html = await page.content();
      return scrapeWeaponPageHtml(html, url);
    },
    { retries: options.maxRetries, delayMs: options.delayMs }
  );
}

async function waitForManualChallengeIfNeeded(page: Page): Promise<void> {
  const challengeText = /cloudflare|checking your browser|verify you are human|challenge/i;
  const body = await page
    .locator("body")
    .innerText({ timeout: 10_000 })
    .catch(() => "");
  if (!challengeText.test(body)) {
    return;
  }

  await page.waitForFunction(
    () =>
      !/cloudflare|checking your browser|verify you are human|challenge/i.test(
        document.body.innerText
      ),
    undefined,
    { timeout: 120_000 }
  );
}
