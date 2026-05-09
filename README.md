# lightggtodim

`lightggtodim` generates Destiny Item Manager wishlist text files from light.gg weapon popularity data.

The v1 output is a strict DIM-supported "full popular roll" for each weapon: barrel, magazine or battery, trait column 3, and trait column 4. Masterworks are not encoded because DIM wishlists do not support masterworks.

## Requirements

- Node.js 22 or newer
- pnpm
- A local browser session for light.gg scraping

light.gg blocks basic non-browser requests, so generation uses Playwright Chromium with a persistent browser profile at `.browser/lightgg-profile`. If a Cloudflare challenge appears, solve it in the opened browser once; the session is reused on later runs.

If a local FlareSolverr service is running at `http://127.0.0.1:8191/v1`, scraping will try that session first and fall back to Playwright per weapon when it cannot return parseable HTML. You can run FlareSolverr with Docker Compose:

```bash
docker compose up -d flaresolverr
```

To force visible browser scraping, disable FlareSolverr for a run:

```bash
$env:LIGHTGGTODIM_DISABLE_FLARESOLVERR = "1"
pnpm generate
```

## Commands

```bash
pnpm install
pnpm generate
```

Useful individual commands:

```bash
pnpm scrape
pnpm build:wishlist
pnpm test
pnpm lint
pnpm build
```

`pnpm scrape` fetches the Bungie manifest, filters current legendary random-roll weapon candidates, opens light.gg item pages in Playwright Chromium, and writes normalized data to `data/lightgg-popularity.json`.

`pnpm build:wishlist` reads Bungie manifest data plus `data/lightgg-popularity.json`, validates selected perks against manifest socket pools, and writes separate PvP and PvE wishlists:

```text
dist/wishlists/lightgg-popular-pvp.txt
dist/wishlists/lightgg-popular-pve.txt
dist/wishlists/metadata.json
dist/wishlists/metadata-pve.json
```

`pnpm generate` runs scrape first, then builds the wishlist.

## GitHub Raw Delivery

1. Run `pnpm install`.
2. Run `pnpm generate`.
3. Review `dist/wishlists/lightgg-popular-pvp.txt` and `dist/wishlists/lightgg-popular-pve.txt`.
4. Commit and push.
5. Use the raw GitHub URL in DIM settings.

Example DIM URL shape:

```text
https://raw.githubusercontent.com/<owner>/lightggtodim/<branch>/dist/wishlists/lightgg-popular-pvp.txt
https://raw.githubusercontent.com/<owner>/lightggtodim/<branch>/dist/wishlists/lightgg-popular-pve.txt
```

## Output Format

The wishlist uses DIM syntax:

```text
title:lightggtodim Popular PvP Rolls
description:Generated from light.gg popularity data. Masterworks are not included because DIM wishlists do not support them.
// Generated: 2026-05-08T...
// Source: light.gg popularity data via local browser session
//notes:light.gg popular PvP full roll; masterwork unsupported by DIM
dimwishlist:item=<itemHash>&perks=<barrelHash>,<magHash>,<trait3Hash>,<trait4Hash>#notes:popular-pvp lightgg full-roll mw-unsupported
```

The PvE file uses the same format with `title:lightggtodim Popular PvE Rolls` and `popular-pve` notes. Skipped weapons and skip reasons are written to `dist/wishlists/metadata.json` and `dist/wishlists/metadata-pve.json`.
