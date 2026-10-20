# Ironveld: design notes

A single-player, browser-first war strategy game in the genre of Total Battle: War Strategy (build a base, train troops, hunt camps, climb to a final boss), with its own setting, its own rules, and no pay-to-win.

## Decisions

| Question | Decision |
|---|---|
| Theme | Ironveld, an industrial-fantasy highland of mining city-states. You are a warden of a small ironworks holding. |
| Platform | Browser, zero dependencies, no build step. Responsive from 320px phones to wide desktops. |
| Goal | Portfolio build. No accounts, no backend, no monetisation in this version. |
| Players | Single player. Progress saves in the browser. |

## What we learned from Total Battle

- Loop worth keeping: build, train, march out, fight camps, grow stronger.
- Praised: combat arrives early, short build timers, story beats.
- Criticised: constant spending pressure ("battle of wallets") and clan politics.
- Our answer: no purchase can buy power. Everything is earned with time and decisions, and offline progress is generous but capped so there is no pressure to check in.

## The game as built

**Stronghold.** Six buildings, levels 1 to 8, two builders working at once.

| Building | Effect |
|---|---|
| Farmstead, Quarry, Ironworks | Produce food, stone and iron. Storage cap grows with total building levels, so idling at the cap wastes income. |
| Barracks | Raises the march size (20 + 10 per level), speeds training, unlocks riders (level 2) and bombards (level 3). |
| Hero hall | Raises hero level cap. Sera joins at level 2, Dag at level 3. |
| Bulwark wall | Every soldier you field gets +4% health per level. |

**Troops.** Pikemen, bowmen, riders and bombards. Counters form a loop: pikemen beat riders, riders beat bowmen, bowmen beat pikemen, bombards beat brutes (enemy-only heavy golems that also crush pikemen). Melee squads can only hit the enemy front line while it stands; bowmen and bombards shoot over it.

**Heroes.** Brannoc (Bulwark: take 35% less damage for 6 rounds), Sera (Volley: every enemy squad loses 10% health), Dag (Rally: +40% damage for 6 rounds). Heroes level through battle experience. Recruiting is deterministic: pay the cost, no random pulls.

**Battles.** Auto-resolved, up to 40 rounds, a few seconds each when watched. The decisions happen before the fight:
- which squads stand in the front or back line,
- which hero leads,
- when the hero skill fires (at the start, round 8, or when your army is hurt).

Before marching, the scouts replay the exact fight 7 times with fixed seeds and report a verdict from "Easy win" to "Hopeless". This is the real simulator, not an estimate.

**The frontiers.** Each region is a seeded 9 by 9 map with your keep in the centre. Camps get harder with distance, resource nodes pay out and then rest, and the Ironlord Citadel sits in the far corner as the final boss. Citadel victory opens another map while preserving your stronghold, resources, heroes and troops. Later frontiers raise camp and Citadel levels. Cleared camps respawn after 2.5 minutes.

**Raids.** Every five minutes, an active camp adjacent to the keep may gather a raiding party. The map and a toast warn the player two minutes before it arrives. The troops currently at home defend automatically, with the Bulwark wall and Brannoc contributing as usual. A successful defense rests that camp; a defeat costs 8% of stored resources. Raids are deferred while the game is away, so offline time does not consume the garrison or stores.

**Offline.** Up to 8 hours of production is credited, queued upgrades and training finish, and a "Welcome back" summary lists what happened.

**Tutorial.** A coach strip leads you through train, march, fight, upgrade. First fight lands about 30 seconds after you start.

## Code layout

| File | Role |
|---|---|
| `src/sim.js` | All rules. Pure and deterministic, takes time as an argument, runs in the browser and in Node. |
| `src/game.js` | Draws state to the DOM and forwards clicks to the rules. |
| `style.css` | Blued steel, molten amber, verdigris. One decorative device: riveted plates. |
| `test/smoke.js` | 23 headless checks. Run `node test/smoke.js`. |

Saves live in `localStorage` under `ironveld.save.v1`. Version 1 saves migrate to the current rules while preserving the existing map and progress. The whole game state is plain JSON, so save, load and replay are trivial.

## Tuning facts (checked by the tests)

- Battles between sensibly matched armies run 15 to 35 rounds.
- 14 pikemen with Brannoc beat the level 1 goblin camp; 10 do not.
- The Citadel falls to a fully upgraded stronghold with about 100 mixed troops, and never to pikemen alone.

## Ideas for next time

1. Sound and richer art (current icons are hand-drawn SVG shapes).
2. Camp variety: terrain effects, camps with their own hero.
3. Research tree between battles.
4. Seasons: map reset with cosmetic rewards that persist.
5. Optional cloud save and async raids (Lambda + DynamoDB, on-demand billing keeps idle cost near zero).
6. Cosmetic-only shop if it ever becomes a product. Power stays unbuyable.
