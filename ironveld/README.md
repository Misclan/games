# Ironveld

A single-player war strategy game for the browser. Build an ironworks stronghold, train troops, lead heroes into battle and take the Ironlord Citadel. Inspired by the genre of Total Battle: War Strategy, with original rules and nothing you can buy to win.

## Play

Open `index.html` in any modern browser. No install, no build, no network needed. It works on phones, tablets and desktops, and saves automatically in your browser.

## Run the tests

```
node test/smoke.js
```

## Notes

- [DESIGN.md](./DESIGN.md) covers the decisions, rules, tuning and next ideas.
- All rules are in `src/sim.js` and are deterministic, so the same seed always plays out the same way.
