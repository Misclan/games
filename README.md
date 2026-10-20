# games

A home for my game ideas. Each game lives in its own sub-folder and is self-contained.

| Game | Folder | What it is |
|------|--------|-----------|
| Frostwatch | [`frostwatch/`](frostwatch/) | Idle-tycoon survival: net fish and driftwood, cook meals, feed a freezing crowd, keep the fire lit and buy upgrades for ten days (playable) |
| Gatecrash | [`gatecrash/`](gatecrash/) | Block-breaker where the blocks sit inside a fortress and you must thread the ball through narrow gates |
| Ironveld | [`ironveld/`](ironveld/) | Fantasy war-strategy / base-builder in the Total Battle genre, no pay-to-win (playable, single-player) |
| Rampart Run | [`rampart-run/`](rampart-run/) | Crowd-shooter / gate-runner: multiply your squad, shoot perk barrels, cut down zombie hordes and beat the boss on a bridge or a dock (playable) |
| Starbound Steps | [`starbound-steps/`](starbound-steps/) | Side-scrolling platform adventure: hop across floating trails, collect stars and reach the pennant |

## Conventions
- One folder per game, with its own `README.md` and a `DESIGN.md` for ideas and mechanics.
- Prefer zero-dependency, single-file web games (static hosting costs nothing).
- `test/` inside a game folder holds headless checks, run with `node test/smoke.js`.
