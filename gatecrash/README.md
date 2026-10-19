# Gatecrash

A block-breaker with a twist: the blocks live inside a fortress, and the only way in is through the gates in its floor.

## Play
Open `index.html` in any browser. It is one file with no dependencies, and it works on desktop and phone.

To serve it locally: `python3 -m http.server 8000` and open http://localhost:8000.

## Controls
| Input | Action |
|-------|--------|
| Touch | Drag to move the paddle, tap to launch |
| Mouse | Move to steer, click to launch |
| Keyboard | ←/→ or A/D to move, Space to launch, P or Esc to pause, M to mute |

## Rules in 30 seconds
- Bounce the ball up through a gate. Inside, it breaks blocks, then exits through a gate again.
- **Orange (narrow) gates** give OVERDRIVE: 2x damage and 3x score until the ball touches your paddle.
- Broken blocks drop **orbs**. They slide to the nearest gate and fall out, so catch them with the paddle.
- Orbs: **x2/x3** (multiply all balls), **PRC** pierce, **WID** wide paddle, **SLO** slow-mo, **BLT** blast balls, **SHD** shield.
- Steel blocks are unbreakable, orange bomb blocks chain-explode, and gold blocks always drop an orb.
- Gates start sliding from level 4. After level 7 the levels are endless and procedurally generated.

See [DESIGN.md](DESIGN.md) for the design notes, and run `node test/smoke.js` for the headless bot test.
