# Starbound Steps — design notes

## Pitch

A small, welcoming pixel-art platform game about crossing colorful floating trails. This is an original setting and character, with familiar side-scrolling platform mechanics.

## Core loop

1. Run and jump across platforms.
2. Collect bright starlight for score.
3. Stomp trail bugs for bonus stars; touching one costs a heart.
4. Reach the pennant to clear the world.
5. Try the moonlit ruins and beat your local best.

## Controls

- Keyboard: arrows or A/D to move, Space/Up/W to jump.
- Touch: large, pointer-friendly left, right and jump buttons.
- P/Escape pauses; Enter starts or advances.
- Sound is optional and generated with the browser Web Audio API.

## Rules

- Three hearts per run. A hit grants a brief invulnerability window and knockback.
- Falling below the course costs a heart and returns the player to the trail.
- Stomping bugs bounces the player and awards two stars.
- Starlight is worth one point.
- The score is saved as a local high score; no account or network connection is used.

## Implementation

The game is contained in `index.html`: canvas rendering, two course definitions, collision and movement, drawing, interface, and touch/keyboard input. It uses no external assets, dependencies or requests. The canvas is 960×540 internally and scales to fit the screen. Course geometry and collectibles are defined as tile-coordinate data near the top of the script.
