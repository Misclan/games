# Frostwatch: design notes (v0.1, built)

Our own take on the "keep the town warm, fed and alive" idle-tycoon mini-game seen in a Whiteout Survival style ad (screen recording, 20 Oct 2026). Working title: **Frostwatch**. Original art, names and rules only.

## What the reference shows

- An ice-fishing dock beside a huge shoal of fish. A worker drags a rope net through the shoal and hauls a big catch.
- Catch lands in a **pile**. The player carries it as a **stack above their head** to a **cooking pot** (and later a conveyor).
- A **crowd of yellow-coated villagers** waits at a fence. Angry emoji and a red warning appear when they are not served.
- Served villagers pay **green cash stacks**. Cash is spent by walking onto **floor pads** with a price (100, 200) that unlock a helper, a bigger net, a second station, more fence.
- The caption is the whole pitch: *can you keep the town warm, fed and alive?*

## Our twist

- **Two resources, one net.** Fish feed the town, drifting driftwood feeds the fire. The net hauls both, so what it targets matters.
- **Cold is a real clock.** A warmth meter always drains. If the fire runs dry the crowd gets impatient faster, and at zero morale bleeds out.
- **Ten days, with blizzards** on days 3, 6 and 9 (cold drains 2.2x, fish come back half as fast).
- **Finite win.** Reach the end of day 10 with morale above zero. Not every upgrade can be bought, so the order is the strategy.

## Core loop

net auto-hauls fish and logs to piles -> you carry fish to the pot -> you carry meals to the serving bench -> the crowd eats and pays -> you collect cash -> you buy upgrades -> the crowd gets bigger -> repeat

## Rules

| Thing | What it does |
|---|---|
| Move | Drag anywhere (floating stick) or WASD / arrows. You can't enter the water or the crowd. |
| Carry | One type at a time (fish, wood or meals), up to your sled capacity (starts at 8). |
| Net | Runs itself: seek the best spot, cast (0.8s), catch everything in its box, haul (0.7s). Prefers logs when the fire is low. Pauses if both piles are full (40). |
| Fish pile / wood pile | Stand on the pad to pick up (22 per second). Fish and wood are separate pads. |
| Pot | Stand on it carrying fish to drop them in; stand on it with empty hands to take cooked meals. 0.65 meals/s per pot. |
| Serving bench | Drop meals here (holds 40). Serves the longest-waiting villager every 0.45s. |
| Cash pile | Each meal pays 4 + day. Walk over the pile to collect. |
| Furnace | Drop driftwood in. Burns 1 wood per 7s and adds heat while lit. |
| Warmth | Always drains (1.4/s on day 1, +12% per day, x2.2 in a blizzard). Below 30, patience drains 1.6x. At 0, morale drains 1.5/s. |
| Villagers | Arrive on a timer (3.9s on day 1, faster each day, floor 1.4s). 45s patience. Leaving angry costs 7 morale; a meal gives 0.6. |
| Morale | 0 means the town falls. |
| Upgrade pads | Stand on one for 0.7s with enough cash to buy the next level. |

## Upgrades

| Pad | Levels (cost) | Effect |
|---|---|---|
| Wider net | 50 / 110 / 200 | Net half-width 26 + 10 per level |
| Longer rope | 60 / 130 | Reach 70 + 30 per level (deeper fish) |
| Big sled | 40 / 90 / 170 | Carry 8 + 6 per level |
| Snow boots | 60 / 140 | Speed 115 + 22 per level |
| Bigger fence | 120 / 260 / 420 | Queue 8 + 6 per level (more customers, more cash) |
| Extra pot | 90 / 180 / 320 | One more pot per level |
| Hearth | 100 / 220 / 380 | More heat, bigger fuel store, slower burn |
| Fish husky | 160 / 300 | Auto-carries fish pile to pot, 0.9/s per level |
| Meal husky | 200 / 340 | Auto-carries meals from pot to bench, 0.9/s per level |

Total is about 4,100 cash; a full run earns roughly half that, so you can't buy everything.

## Balance

`node test/smoke.js` plays 8 seeds with a deliberately dumb greedy bot. It must win some but not all (currently 4 of 8 on seeds 1 to 8). A human who plans upgrades around the blizzard days should do clearly better. If you retune, keep that check green.

## Ideas for later

- Conveyor belt between pot and bench (the reference has one).
- Ice cracking: the dock shrinks on bad days unless you pay for repairs.
- Villager types (children eat less, hunters pay more).
- Sound, haptics, and a best-day record in localStorage.
- Endless mode after day 10.
