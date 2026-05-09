import { loadConfig } from "../config";
import { fetchManifestData } from "../bungie/manifest";
import { getWeaponCandidates } from "../bungie/weaponFilter";
import { readFile } from "node:fs/promises";
import { logger } from "../util/logger";

const dimWishlistLineRegex =
  /^dimwishlist:item=(?<itemHash>-?\d+)(?:&perks=)?(?<itemPerks>[\d|,]*)(?:#notes:)?(?<wishListNotes>[^|]*)/;

export async function validateWishlist(): Promise<void> {
  const config = await loadConfig();
  const manifest = await fetchManifestData(config.language);
  const candidates = new Map(getWeaponCandidates(manifest).map((weapon) => [weapon.hash, weapon]));
  const socketKinds = ["barrel", "magazine", "trait3", "trait4"] as const;
  const wishlistPaths = [config.output.wishlistPath, config.output.pveWishlistPath];

  let dimLines = 0;
  let parsedLines = 0;
  const errors: string[] = [];

  for (const wishlistPath of wishlistPaths) {
    const text = await readFile(wishlistPath, "utf8");
    let fileDimLines = 0;
    let fileParsedLines = 0;

    for (const [index, line] of text.split(/\r?\n/).entries()) {
      if (!line.startsWith("dimwishlist:")) {
        continue;
      }

      dimLines += 1;
      fileDimLines += 1;
      const match = dimWishlistLineRegex.exec(line);
      if (!match || match.length !== 4) {
        errors.push(`${wishlistPath} line ${index + 1}: DIM parser would not parse this line`);
        continue;
      }

      parsedLines += 1;
      fileParsedLines += 1;
      const itemHash = Number(match.groups?.itemHash);
      const perkHashes = (match.groups?.itemPerks ?? "")
        .split(",")
        .map(Number)
        .filter((hash) => hash > 0);
      const weapon = candidates.get(itemHash);
      if (!weapon) {
        errors.push(
          `${wishlistPath} line ${index + 1}: item ${itemHash} is not a current weapon candidate`
        );
        continue;
      }

      const invalidPerks = perkHashes.filter((perkHash, perkIndex) => {
        const socketKind = socketKinds[perkIndex];
        const allowed = weapon.sockets.perkHashesBySocketKind?.[socketKind];
        return allowed ? !allowed.includes(perkHash) : true;
      });

      const nonNormalPerks = perkHashes.filter((perkHash, perkIndex) => {
        const socketKind = socketKinds[perkIndex];
        const normalHash =
          weapon.sockets.normalPerkHashBySocketKind?.[socketKind]?.[String(perkHash)];
        return normalHash !== undefined && normalHash !== perkHash;
      });

      if (invalidPerks.length > 0) {
        errors.push(
          `${wishlistPath} line ${index + 1}: ${weapon.name} has perks not found in expected sockets: ${invalidPerks.join(",")}`
        );
      }
      if (nonNormalPerks.length > 0) {
        errors.push(
          `${wishlistPath} line ${index + 1}: ${weapon.name} uses enhanced/duplicate perk hashes instead of normal hashes: ${nonNormalPerks.join(",")}`
        );
      }
    }

    logger.info(`${wishlistPath} DIM lines: ${fileDimLines}`);
    logger.info(`${wishlistPath} DIM-parser accepted lines: ${fileParsedLines}`);
  }

  logger.info(`DIM lines: ${dimLines}`);
  logger.info(`DIM-parser accepted lines: ${parsedLines}`);
  logger.info(`Manifest/socket validation errors: ${errors.length}`);

  for (const error of errors.slice(0, 20)) {
    logger.warn(error);
  }

  if (errors.length > 0) {
    process.exitCode = 1;
  }
}
