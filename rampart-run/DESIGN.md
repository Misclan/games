# Rampart Run: design notes (v0.2, plan only)

Our own take on the gate-runner / crowd-shooter mini-game that Total Battle: Strategy Games shows in its App Store screenshots. Working title: **Rampart Run**. Nothing is built yet. This document is the plan to agree on first. v0.2 folds in Ken's corrections about barrels and multiplier cards.

## What the reference shows

- A crowd of soldiers runs up a walled rampart seen from behind and above. A number floats over the crowd: that is your army size.
- **Cards** span part of the lane as banners: x2, x4, x6, +10, +100, and red ones like a divide by 7. They come in side-by-side pairs, so the choice is the game. A multiplier card multiplies the number of soldiers you already have (x4 turns 10 into 40). It is applied once, when your crowd runs through it.
- **Enemy crowds** are red with a number. Your soldiers shoot them, and if any survive to contact, both sides lose the same amount.
- **Recruits** are a grey crowd with a plus number (+30). Run through to add them.
- **Barrels** carry a hidden upgrade. The number on the barrel is how many bullets it takes to break it. Your soldiers shoot automatically, so you line your crowd up with the barrel you want and keep firing until it opens. Breaking it reveals a perk: better weapons and other advantages.
- **Spike rows** across the lane cost you troops unless you slip through a gap.
- **A finale** with a big number to beat and a rank badge.

## Our twist

You are a Warden of Ironveld leading a warband across a fortress rampart. Iron banners instead of generic cards, ember-lit stone, brass numerals. Original art and names only.

## Rules

| Thing | What it does |
|---|---|
| Crowd | Number of soldiers. Reaches 0 and the run is over. |
| Shooting | Automatic. Soldiers fire forward from the crowd's lane. Total bullets per second grows with the number of soldiers, so a bigger crowd shoots faster. |
| Card | x, +, minus or divide, applied to your current soldier count when you run through it. Shows the result so the maths is a quick read. |
| Barrel | Needs N bullets (the number on it) to break. Drops a mystery perk when opened. Ignore it and it just rolls past. |
| Enemy crowd | Bullets whittle its number down (one bullet, one enemy at base damage). Survivors collide with you and both lose the same amount. |
| Recruits | Grey crowd, adds its number. |
| Spikes | Lose 25% of the crowd per row, unless you pass through the gap. |
| Finish | A fortress gate or boss crowd. Beat its number to clear the level. |
| Rank | Every 25 soldiers upgrades your troops' look (cosmetic). |

## Perks from barrels (first set)

| Perk | Effect |
|---|---|
| Rapid fire | Soldiers shoot faster for the rest of the run. |
| Heavy shot | Each bullet counts as 2 against barrels and enemies. |
| Spread shot | Bullets also hit the neighbouring lane. |
| Piercing shot | Bullets pass through the first target. |
| Shield | Absorbs the next 20 soldiers you would lose. |
| Reinforce | Instantly adds soldiers. |

Perks are random from this list per barrel, seeded by the level, so a level is the same for everyone. Tougher barrels (bigger number) give better odds of the strong perks.

## The core decision

Every few seconds you choose between: a big multiplier card, a barrel worth breaking (time spent in its lane), recruits, or dodging a trap. Shooting a barrel means holding your line while the clock and the enemy ahead keep coming.

## Controls

Drag or swipe left and right on touch, mouse drag on desktop, A/D or arrow keys. The crowd runs forward and fires by itself.

## Levels

- Generated from a seed, so every level number is the same level for everyone.
- Difficulty ramps: more card pairs with a trap choice (a big x6 next to a divide), barrels that cost more bullets, tighter spike gaps, bigger boss.
- A solver inside the tests plays every generated level. Each level must be winnable by a perfect run, and must not be winnable by always going straight with no choices. That keeps the decisions meaningful.

## Technical plan

| Piece | Choice |
|---|---|
| Rendering | One HTML canvas with a simple perspective projection, so the rampart narrows toward the horizon like the screenshots. Crowds are many small soldier sprites. Bullets are small tracers. |
| Rules | `src/sim.js`: pure and deterministic (crowd maths, bullets, collisions, perks, level generator, solver). Same split as Ironveld so it can be tested headlessly. |
| Draw and input | `src/game.js`. |
| Responsive | Portrait first (phone), scales up to a centred play column on desktop. |
| Dependencies | None. Plain files, open `index.html`. |
| Saves | Best level reached and the perk list for the current run, in `localStorage`. |
| Monetisation | None. Portfolio build. |

## Build plan

1. **Run and steer.** Rampart, perspective, a crowd that moves, drag to steer, cards that change your count.
2. **Shoot.** Automatic fire, barrels that break after N bullets, perk reveal, perk effects.
3. **Dangers.** Enemy crowds, recruits, spike rows, collision rules, tests.
4. **Levels.** Generator, solver tests, boss at the end, win and lose screens, level counter.
5. **Polish.** Crowd animation, number pops on every change, screen shake on big hits, ranks, optional sound.

## Open questions

1. Do bullets also hurt red enemy crowds, or only break barrels? I assumed they hurt enemies too.
2. Are the perks random per barrel (my plan), or does each barrel type have a fixed perk you learn to recognise?
