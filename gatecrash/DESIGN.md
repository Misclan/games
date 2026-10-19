# Gatecrash: design notes

A block-breaker where the blocks live inside a **fortress** and the only way in is through **gates** (tunnels) in its floor.

## Core loop
1. Bounce the ball up through a gate into the fortress.
2. It smashes blocks inside, then drops back out through a gate (or bounces off the underside of the wall).
3. Catch it with the paddle and thread it back in. The paddle's hit position sets the angle, so aiming a gate shot is the skill.
4. Broken blocks drop **orbs**. Catch them for power-ups, including ball multipliers.

## What makes it ours
- **Gates are the whole game.** The fortress floor is a solid wall with 1-3 tunnels, so every shot is a threading shot.
- **Overdrive gates.** Narrow gates (marked orange) charge the ball: 2x damage and 3x score until it touches the paddle again. Wide gates are safe but plain.
- **Orbs funnel through the gates too.** Falling orbs land on the fortress floor and slide to the nearest gate before dropping out. You position the paddle under the gate to catch them.
- **Moving shutters.** From level 4 the gates slide side to side, so timing matters as well as aim.
- **Block types.** Normal (1-3 hits), steel (indestructible), explosive (chain-reacts), and gold (always drops an orb).
- **Thread bonus.** Every clean gate pass scores points, with a bigger bonus for overdrive.

## Orbs
| Orb | Effect |
|-----|--------|
| x2 / x3 | Every ball in play splits into 2 / 3 |
| PRC | Pierce: balls plough through blocks (8s) |
| WID | Wide paddle (12s) |
| SLO | Slow-mo (8s) |
| BLT | Blast balls: every hit explodes (8s) |
| SHD | Shield: saves a ball from falling, once |

## Levels
Seven handcrafted levels (Breach, Thick Walls, Pillars, Shutter, Powder Keg, The Citadel, Revolving Doors), then endless procedurally generated "Siege" levels with random gate layouts. Ball speed ramps per level and creeps up as blocks fall.

## Controls
- Touch: drag to move the paddle (relative), tap to launch.
- Mouse: move to steer, click to launch.
- Keyboard: arrows or A/D to move, Space to launch, P or Esc to pause, M to mute.

## Tech
Single self-contained `index.html` (canvas, no dependencies, no build). It runs on any static host, such as S3, GitHub Pages or Cloudflare Pages, for free. `test/smoke.js` runs the game headlessly with a bot.
