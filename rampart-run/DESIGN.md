# Rampart Run: design notes (v0.1, plan only)

Our own take on the gate-runner / crowd-runner mini-game that Total Battle: Strategy Games shows in its App Store screenshots. Working title: **Rampart Run**. Nothing is built yet. This document is the plan to agree on first.

## What the reference shows

Read from the screenshot, so please correct anything I got wrong:

- A crowd of soldiers runs up a walled rampart seen from behind and above. A number floats over the crowd: that is your army size.
- **Gates** span the lane as banners: x2, x4, x6, +10, +100, and red ones like a divide by 7. Running through one applies the maths to your crowd. Gates come in side-by-side pairs, so the choice is the game.
- **Enemy crowds** are red with a number. If you run into one, both sides lose the same amount. Bigger survives with the difference (10 against 9 leaves 1).
- **Neutral recruits** are a grey crowd with a plus number (+30). Run through to add them.
- **Barrels** with a number on them block parts of the lane. My reading: smashing one costs you that many soldiers, so go around if you can.
- **Spike rows** across the lane cost you troops unless you slip through a gap.
- **A final big fight or rank-up** at the end, with a chevron badge showing your rank (150, rank 50 in the shot).
- Early on you start with a small crowd (10) and a fork: toward recruits on the left, toward a small enemy on the right.

## Our twist

Same feel, our own setting: you are a Warden of Ironveld leading a warband across a fortress rampart. Iron banners instead of generic gates, ember-lit stone, brass numerals. Original art and names only.

## Rules

| Thing | What it does |
|---|---|
| Crowd | Number of soldiers. Reaches 0 and the run is over. |
| Gate | x, +, minus or divide. Always shown with the result so the maths is a quick read. |
| Enemy crowd | Fight on contact. Both lose min(yours, theirs). Survivors keep going. |
| Recruits | Grey crowd, adds its number. |
| Barrel | Smash it by running into it: lose its number. Or steer around. |
| Spikes | Lose 25% of the crowd per row, unless you pass through the gap. |
| Finish | A fortress gate or boss crowd. Beat its number to clear the level. |
| Rank | Every 25 soldiers upgrades your troops' look (cosmetic). |

Controls: drag or swipe left and right on touch, mouse drag on desktop, A/D or arrow keys. The crowd runs forward by itself.

## Levels

- Generated from a seed, so every level number is the same level for everyone.
- Difficulty ramps by level: more gate pairs with a trap choice (a big x6 next to a divide), tighter spike gaps, bigger boss.
- A solver inside the tests plays every generated level. Each level must be winnable by a perfect run and must not be winnable by always going straight. That keeps the choices meaningful.

## Technical plan

| Piece | Choice |
|---|---|
| Rendering | One HTML canvas with a simple perspective projection, so the rampart narrows toward the horizon like the screenshots. Crowds are many small soldier sprites drawn from a few shapes. |
| Rules | `src/sim.js`: pure and deterministic (crowd maths, collisions, level generator, solver). Same split as Ironveld so it can be tested headlessly. |
| Draw and input | `src/game.js`. |
| Responsive | Portrait first (phone), scales up to a centred play column on desktop. |
| Dependencies | None. Plain files, open `index.html`. |
| Saves | Best level reached, in `localStorage`. |
| Monetisation | None. Portfolio build. |

## Build plan

1. **Run and steer.** Rampart, perspective, a crowd that moves, drag to steer, gates with maths.
2. **Dangers.** Enemy crowds, recruits, barrels, spike rows, collision rules and tests.
3. **Levels.** Generator, solver tests, boss at the end, win and lose screens, level counter.
4. **Polish.** Crowd animation, number pops on every change, screen shake on big hits, ranks, optional sound.

## Open questions

1. Are barrels what I think they are (a cost to smash)? If they are something else, tell me.
2. Should the crowd be drawn as individual soldiers (looks great, costs more to draw) or as a dense cloud with a number? I would start with individuals and cap how many are drawn.
3. Add the Ironveld heroes as power-ups later? Not in the first build.
