#!/usr/bin/env node
import { buildWishlist } from "./pipeline/buildWishlist";
import { generate } from "./pipeline/generate";
import { scrape } from "./pipeline/scrape";
import { validateWishlist } from "./pipeline/validateWishlist";

const command = process.argv[2] ?? "help";

try {
  if (command === "scrape") {
    await scrape();
  } else if (command === "build:wishlist") {
    await buildWishlist();
  } else if (command === "generate") {
    await generate();
  } else if (command === "validate:wishlist") {
    await validateWishlist();
  } else {
    console.log("Usage: pnpm <generate|scrape|build:wishlist|validate:wishlist|test|lint>");
    process.exitCode = command === "help" ? 0 : 1;
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
