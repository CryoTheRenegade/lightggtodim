import { z } from "zod";

export const activitySchema = z.enum(["pvp", "pve", "either", "unknown"]);

export const popularPerkSchema = z.object({
  hash: z.number().int().nonnegative(),
  name: z.string(),
  percent: z.number().nonnegative(),
  activity: activitySchema.optional(),
  socketKind: z.enum(["barrel", "magazine", "trait3", "trait4", "origin", "unknown"])
});

export const popularTraitComboSchema = z.object({
  trait3Hash: z.number().int().nonnegative(),
  trait4Hash: z.number().int().nonnegative(),
  percent: z.number().nonnegative(),
  activity: activitySchema.optional()
});

export const lightggWeaponPopularitySchema = z.object({
  itemHash: z.number().int().nonnegative(),
  itemName: z.string(),
  sourceUrl: z.string(),
  scrapedAt: z.string(),
  individualPerks: z.array(popularPerkSchema),
  traitCombos: z.array(popularTraitComboSchema)
});

export const lightggPopularityCacheSchema = z.array(lightggWeaponPopularitySchema);
