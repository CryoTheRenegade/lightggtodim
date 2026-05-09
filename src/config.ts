import { readJsonFile } from "./util/fs";
import { z } from "zod";

export const configSchema = z.object({
  language: z.string().default("en"),
  output: z.object({
    wishlistPath: z.string(),
    metadataPath: z.string()
  }),
  scrape: z.object({
    delayMs: z.number().int().nonnegative(),
    maxRetries: z.number().int().nonnegative(),
    profileDir: z.string()
  }),
  rolls: z.object({
    activity: z.enum(["pvp", "pve", "either", "unknown"]).default("pvp"),
    strategy: z.literal("strict-dim-supported-full-roll"),
    includeUniversalPopularity: z.boolean().default(true),
    topBarrels: z.number().int().positive().default(2),
    topMagazines: z.number().int().positive().default(2),
    topTrait3: z.number().int().positive().default(3),
    topTrait4: z.number().int().positive().default(3),
    maxRollsPerWeapon: z.number().int().positive().default(36)
  }),
  weapons: z.object({
    scope: z.literal("current-random-roll-legendary"),
    excludeSunset: z.boolean().default(true),
    excludeCraftingPatternsOnly: z.boolean().default(false)
  })
});

export type AppConfig = z.infer<typeof configSchema>;

export async function loadConfig(path = "lightggtodim.config.json"): Promise<AppConfig> {
  const raw = await readJsonFile<unknown>(path);
  return configSchema.parse(raw);
}
