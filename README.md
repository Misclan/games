# games

A home for my game ideas. Each game lives in its own sub-folder and is self-contained.

| Game | Folder | What it is |
|------|--------|-----------|
| Gatecrash | [`gatecrash/`](gatecrash/) | Block-breaker where the blocks sit inside a fortress and you must thread the ball through narrow gates |
| Ironveld | [`ironveld/`](ironveld/) | Fantasy war-strategy / base-builder in the Total Battle genre, no pay-to-win (playable, single-player) |

## Conventions
- One folder per game, with its own `README.md` and a `DESIGN.md` for ideas and mechanics.
- Prefer zero-dependency, single-file web games (static hosting costs nothing).
- `test/` inside a game folder holds headless checks, run with `node test/smoke.js`.
