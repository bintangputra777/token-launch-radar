# Token Launch Radar — make.fun bounty token-radar-01

Entry for the make.fun bounty "Build the best token launch radar"
(competition token-radar-01, $1,325 total prize — 1st $1,000 — closes
Mon 14 Dec 2026 17:00 WIB). Built by an AI agent for make.fun's
"Build the best token launch radar" bounty, $1,325 in USDC.

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/bintangputra777/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/bintangputra777/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

## What it does

Reads a sealed DefiLlama protocol snapshot (758 protocols, as of
2026-11-14), finds the protocols that record no token yet, ranks them
by an implied value, and presents them in a static dashboard (board,
per-protocol detail, farm steps) with a machine-readable `board.json`.

- **Board: 198 rows** — all 40 watchlist protocols plus every other
  genuine pre-token candidate in the snapshot. The watchlist's own
  exclusion rule is applied to the whole universe: no Bridge /
  Canonical Bridge / Liquid Staking / Liquid Restaking / Restaked BTC /
  CEX, no name carrying a whole word `wrapped`, `staked` or `staking`,
  no exchange-prefixed name, no version marker. That removes 144 of
  the snapshot's 342 pre-token protocols — including 39 of the 160
  early rows a looser rule would have kept (bridges, staking pools and
  wrapped products that will never launch a token of their own).
- **Model radar-2** (stated in the dashboard, recomputed live per row):
  implied = TVL × 0.25 × growth × maturity × breadth, where growth is
  the 7-day TVL change clamped to −60…+120% (weight 0.5), maturity is
  0.6 + min(age, 1095)/1095 × 0.4, and breadth is 1 + 0.05 ×
  min(chains − 1, 4). No protocol name is special-cased.
- **Farm plan: 7 steps per row**, derived from the protocol's own
  category, chains, TVL and age, each with a cost and a time.
- **Live tokens kept apart**: the 24 largest already-trading protocols
  by market cap, shown as the market's own values, never in the board.
- **Dashboard**: dark navy + gold, searchable, filterable by category
  and chain, sortable, watchlist toggle, per-protocol detail drawer
  with the model's full arithmetic and a "matches board.json" check,
  plus a model sandbox that re-ranks the board live. No network: no
  external scripts, fonts or requests.

## Run it

Node 22+, standard library only, no install step:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input input/snapshot.json
```

Inside the grader's container the sealed snapshot is mounted at
`/input/snapshot.json` and the output goes to `/output`. The run
writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and
`dossier.json` (built with the vendored `vendor/makefun-board.ts`,
byte for byte the kit's copy).

To view the dashboard locally, serve the output directory
(`python3 -m http.server` in `out/`) and open `dashboard/` — it reads
`../data.js`. Hash routes: `#detail/<slug>` opens a protocol's detail
drawer, `#filter/<category>` applies a category filter.

## Verified

- All seven gate rows pass (local re-implementation of the scorer's
  checks): dashboard 3 files / 36,342 bytes (under the 64 KB the judge
  reads whole), board 198 rows with ranks 1–198 and non-increasing
  implied values, watchlist 40/40 covered, farm steps 7 × 20–600
  characters, 3 screenshots 1440×900 (192 KB, 284 KB, 195 KB),
  dossier 933,905 bytes and byte-identical to `buildDossier` output.
- The dashboard's page code and `board.json` agree exactly: the
  page's implied values and farm steps were recomputed in Node from
  the dashboard's own `app.js` pure block and matched all 198 rows
  (0 mismatches).

## Known limits (stated in the dashboard)

- The snapshot carries no `parentProtocol` field, so the house's
  parent rule cannot be applied from these bytes: 20 rows sit above
  the floor but outside the watchlist for that reason. They are ranked
  on their own figures and flagged in the detail view.
- "Records no token" is what the snapshot says — it is not proof a
  protocol has none, and not a promise one will launch. Implied value
  is this radar's own estimate, not a price.

## Submission checklist (still to do, by the owner)

- [ ] Publish this repository to GitHub (public) under the owner's account.
- [ ] Create the owner's Solana wallet/keypair (account + payout).
- [ ] Bundle the transcripts (parent agent attaches the usage rows),
      then submit before 14 Dec 2026 10:00 UTC.
