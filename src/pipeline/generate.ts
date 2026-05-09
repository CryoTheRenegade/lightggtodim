import { loadConfig } from "../config";
import { buildWishlist } from "./buildWishlist";
import { scrape } from "./scrape";

export async function generate(): Promise<void> {
  const config = await loadConfig();
  await scrape(config);
  await buildWishlist(config);
}
