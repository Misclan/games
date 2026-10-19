# Rampart Run: design notes (v0.4, plan only)

Our own take on the crowd-shooter / gate-runner mini-game that Total Battle: Strategy Games shows in its App Store screenshots. Working title: **Rampart Run**. Nothing is built yet. This is the plan to agree on first. v0.4 folds in Ken's answers: zombie swarms, melee boss, acid spitters, random perk barrels, big deployables, separate recruit and multiplier cards, and two themes.

## What the reference shows

- A crowd of soldiers runs up a lane seen from behind and above. A number floats over the crowd: your army size.
- **Cards** span part of the lane as banners (x2, x4, +10, +100, and red ones like a divide by 7). They come in side-by-side pairs, so the choice is the game. A multiplier card multiplies the soldiers you already have (x4 turns 10 into 40), applied once when your crowd runs through it.
- **Enemy crowds** are red zombies with a number. They swarm toward you in waves of random size. Your bullets whittle them down. Survivors that reach you kill soldiers.
- **Barrels** hide a perk. The number on the barrel is the bullets it takes to break, and it counts down as you shoot.
- **Spike rows**, then a **finale** with a big number to beat.

## Our twist

You are a Warden of Ironveld leading a warband. Iron banners, ember-lit stone, brass numerals. Original art and names only.

## Rules

| Thing | What it does |
|---|---|
| Crowd | Number of soldiers. Reaches 0 and the run is over. |
| Shooting | Automatic, forward from the crowd's lane. Fire rate grows with soldier count. |
| Bullets | Hurt barrels, enemies, the boss and big deployables' targets alike. One bullet is 1 damage at base. |
| Recruit | Grey crowd with **+N**. Run into it to add N soldiers. |
| Multiplier card | Banner with **xN** (or minus/divide in red). Changes the soldiers you already have. Applied once on pass-through, showing the result. Kept separate from recruits. |
| Barrel | Counts down as bullets hit it. At 0 it breaks and reveals a perk. Ignore it and it rolls past. |
| Zombie wave | A red zombie crowd with a number, moving toward you. Bullets reduce it. Any that reach you kill that many soldiers (and die). Random sizes, scaled by level. |
| Acid spitters | From harder levels, some zombies spit acid globs at your squad. Each glob has its own small health: shoot it down to neutralise it, or take the hit (it kills soldiers where it lands). |
| Stream | Variant level: a continuous stream of enemies with the boss in the middle. You must shoot through the stream and boss before it reaches you. |
| Boss | Big, slow, huge health, walks toward you. It can only hurt you by reaching you: a melee strike with a critical hit kills a large share of the crowd (a 150 squad is gone in 2-3 strikes). Keep it from arriving by killing it first. It also throws themed items (below). |
| Spikes | Lose 25% of the crowd per row, unless you pass through the gap. |
| Finish | Boss dead (or gate reached) clears the level. |
| Rank | Every 25 soldiers upgrades the troops' look (cosmetic). |

## Perks from barrels

Perks are random per barrel (seeded by level, so every level is the same for everyone). The stronger the perk, the more bullets the barrel needs, but never absurdly many.

| Perk | Effect | Typical barrel cost |
|---|---|---|
| Reinforce | Instantly adds soldiers | low |
| Rapid fire | Soldiers shoot faster for the run | low-mid |
| Shield | Absorbs the next 20 soldiers lost | mid |
| Spread shot | Bullets also hit neighbouring lanes | mid |
| Piercing shot | Bullets pass through the first target | mid-high |
| Heavy shot | Each bullet counts as 2 | high |

## Big deployables

Later in a level a large crate appears, around 250 bullets to open. It unlocks a big ally that fights for you for the rest of the run:

| Ally | Effect |
|---|---|
| Auto turret | Fixed gun beside the lane, heavy steady fire |
| Drone | Hovers over the crowd, fires at the nearest enemy |
| (later) Siege cannon | Slow big shells that hit a whole wave |

Allies have health. Enemies target them, and the boss can hit them. They can be destroyed, so protecting them is part of the play.

## Themes

Two to start, same rules, different look and different boss throws.

| Theme | Look | Boss throws |
|---|---|---|
| **Bridge** | Stone bridge over a gorge at dusk, railings, hanging lamps | Cars and wreckage that crush a lane; falling pieces of the railing |
| **Port** | Harbour dock at night, cranes, containers, water either side | Shipping containers and swung crane loads that block a lane; barrels of oil |

A thrown item is a projectile with a landing shadow on the lane. Steer to a clear lane to dodge it, or take the hit. Level N picks a theme from the seed, so a run alternates.

## The core decision

Every few seconds you choose between: a big multiplier card, a barrel worth breaking (holding your lane while the clock and the swarm keep coming), a trap, or dodging a throw. In boss fights you balance firepower against dodging throws while the boss closes in.

## Controls

Drag or swipe left and right on touch, mouse drag on desktop, A/D or arrow keys. The crowd runs and fires by itself.

## Levels

- Generated from a seed. Difficulty ramps with level: more card pairs with a trap choice, barrels with larger numbers, bigger waves, tighter spike gaps, stronger boss with harder strikes, and a stream variant every few levels.
- **Solver in the tests.** It plays every generated level with a perfect run. Each must be winnable by a perfect run, and must not be winnable by going straight with no choices.

## Technical plan

| Piece | Choice |
|---|---|
| Rendering | One HTML canvas, simple perspective so the lane narrows to the horizon. Crowds are many small soldier sprites (drawn count capped for speed, the true number shown). Tracer bullets. |
| Rules | `src/sim.js`: pure and deterministic (seeded RNG, time passed in): cards, shooting, barrels, perks, waves, boss, allies, level generator, solver. |
| Draw and input | `src/game.js`, plus `index.html` and `style.css`. |
| Tests | `test/smoke.js` run with node: maths, determinism, solver on many seeds. Headless browser check before publishing. |
| Responsive | Portrait first, centred play column on desktop. |
| Dependencies | None. |
| Saves | Best level and settings in `localStorage`. |
| Monetisation | None. Portfolio build. |

## Build plan

1. **Run and steer.** Lane, perspective, crowd, drag steering, cards.
2. **Shoot.** Auto fire, barrels with countdown, perks.
3. **Dangers.** Enemy waves swarming, spikes, collisions, tests.
4. **Boss and themes.** Boss strikes and thrown items, bridge and port looks, stream variant.
5. **Allies and levels.** Turret and drone crates, generator, solver tests, win/lose screens.
6. **Polish.** Number pops, screen shake, ranks, optional sound.

## Open questions

None blocking. Will pick sensible defaults for numbers and tune by playing; say if the boss feels too brutal or too soft.
