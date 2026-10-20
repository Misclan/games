# Frostwatch

Keep a frozen harbor town fed and warm for ten days. A net hauls fish and driftwood by itself; you carry fish to the pot, meals to the bench and wood to the fire, then spend the crowd's cash on upgrade pads. Blizzards hit on days 3, 6 and 9.

Zero dependencies, mobile-first, plays in any browser.

## Play

Open `index.html`, or serve the folder: `python3 -m http.server` then visit `http://localhost:8000`.

- **Drag** anywhere to walk (WASD / arrows on a keyboard).
- Fish pile -> pot -> serving bench -> collect the cash.
- Wood pile -> fire.
- Stand on an upgrade pad with enough cash to buy it.

## Layout

| Path | What |
|---|---|
| `src/sim.js` | Rules engine. Pure logic, no DOM. |
| `src/game.js` | Canvas renderer, input and screens. |
| `index.html`, `style.css` | Page shell. |
| `test/smoke.js` | Headless rules checks plus a bot balance check. Run `node test/smoke.js`. |
| `DESIGN.md` | Reference, rules tables, upgrade costs, ideas. |
