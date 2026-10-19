# Ironveld — Game Design Draft v0.1

Working title. A browser-first 4X / base-builder / tactical war game, inspired by the *genre* of Total Battle: War Strategy (Scorewarrior) but with its own setting, rules and monetisation.

## 1. What we learned from Total Battle

Public descriptions and reviews agree on the following:

- MMO 4X real-time strategy with PvE and PvP; build a base, train armies, fight on a shared world map.
- Fantasy-flavoured eras (ancient, medieval, age of discovery), heroes, monsters to hunt, castles and forts.
- Clans are the social core: players join clans and fight together.
- Reviewers praise how fast it gets you into combat (short build timers, field battles early) and its story chapters with choices.
- Reviewers criticise heavy microtransaction pressure, "battle of wallets" progression, and clan politics/bullying.

Takeaway: the *loop* (build → recruit → hunt/raid → clan war) is proven. The weak spot is pay-to-win. That is our opening.

## 2. Pillars

1. **Fast to fun** — first battle inside 2 minutes, no waiting on long timers.
2. **Skill over wallet** — spending buys cosmetics and convenience, never raw power.
3. **Short sessions** — a meaningful play session is 5–10 minutes, async-friendly.
4. **Cheap to run** — serverless, free-tier-friendly backend; no always-on game servers in the MVP.
5. **Our own identity** — original setting, heroes and art; no Total Battle names, art or assets.

## 3. Setting (proposal, open to change)

*Ironveld* — a fantasy high-plateau world of mining-city states, ironworks and warring guilds. Factions are built around terrain and trade rather than "races" (e.g. Highland Smelters, River Syndicate, Dune Caravans). Alternative themes are listed in section 9.

## 4. Core loop

1. **Base** — place and upgrade buildings (farm, quarry, forge, barracks, hero hall, wall). Timers are short; builder slots limit parallelism, not a paywall.
2. **Army** — train unit squads (infantry, ranged, cavalry, siege) with a rock-paper-scissors counter system.
3. **Heroes** — collect and level heroes who lead squads and bring one active skill each.
4. **Hunt & raid** — send armies onto the world map to defeat monsters, take resource nodes and raid other bases.
5. **Clan** — join a guild, contribute to shared goals, take part in territory wars.
6. **Seasons** — a season lasts ~8 weeks; the map resets, cosmetic rewards persist.

## 5. Combat

- Auto-resolved tactical battles on a small grid (e.g. 3 × 5 lanes), 20–40 seconds each.
- Player decisions happen **before** the fight: formation, hero choice, skill timing, counters.
- Deterministic simulation from a seed, so battles can be replayed and verified server-side (anti-cheat, cheap to host).

## 6. Anti-pay-to-win rules

- Power only from play: buildings, research, heroes found through gameplay.
- Paid items are cosmetic (skins, banners, base themes) and a small convenience pass (extra queue view, auto-collect).
- Hero acquisition is deterministic: pity counters visible, no hidden odds.
- Damage from raids is capped and shield-protected so small players can't be farmed.

## 7. MVP scope (single-player-first)

Goal: a playable vertical slice that proves the loop before any multiplayer work.

- 1 base screen with 6 buildings and upgrade timers
- 4 unit types, 3 heroes
- Tactical auto-battle against PvE monsters on a small world map
- Local save (browser storage)
- No accounts, no clans, no real-money anything

## 8. Suggested tech stack (matches the free/low-cost default)

| Layer | Choice | Why |
|---|---|---|
| Client | TypeScript + Phaser 3 (or PixiJS) + Vite | Runs in browser, mobile-friendly, free |
| Battle sim | Pure TypeScript module, deterministic | Same code on client and server |
| Hosting (MVP) | Static site on S3 + CloudFront or GitHub Pages | Free-tier |
| Backend (phase 2) | API Gateway + Lambda + DynamoDB (on-demand) | Pay-per-use, near-zero idle cost |
| Auth (phase 2) | Cognito free tier | |
| Art | Original / AI-assisted, licence-checked | Avoid any IP issues |

## 9. Alternative themes to pick from

1. **Ironveld** — industrial fantasy, mining city-states (current draft)
2. **Savanna Crowns** — African-inspired kingdoms, trade routes and wildlife monsters
3. **Tidewall** — coastal empires, naval + land hybrid
4. **Emberfall** — post-collapse fantasy with relic-powered heroes

## 10. Roadmap

| Phase | Outcome |
|---|---|
| 0 | Pick theme, name, art direction (this doc) |
| 1 | Base screen + resource timers |
| 2 | Battle simulator + 3 heroes, PvE monsters |
| 3 | World map + hunting loop, local save |
| 4 | Accounts, cloud save, async raids |
| 5 | Clans, seasons, cosmetic shop |

## 11. Open questions for Ken

1. Theme: Ironveld, or one of the alternatives (or something else)?
2. Platform priority: browser first, or mobile app (Expo/React Native like AllstoreZA)?
3. Is this meant to be a revenue project (cosmetics/ads) or a portfolio/learning build?
4. Single-player MVP first, or go straight to async multiplayer?
5. Art approach: simple 2D shapes/icons first, or AI-generated art from day one?
