// Headless smoke test: loads index.html's script with a stubbed DOM and lets a bot play.
// Usage: node test/smoke.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) throw new Error('no <script> found');

const ctxProxy = () => {
  const target = { measureText: () => ({ width: 10 }) };
  const p = new Proxy(target, {
    get: (t, k) => (k in t ? t[k] : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop() {} }) : () => {}),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  return p;
};
const mkCanvas = () => ({
  width: 480, height: 800, style: {},
  getContext: () => ctxProxy(),
  addEventListener() {}, setPointerCapture() {}, focus() {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 480, height: 800 }),
});
const sandbox = {
  console, Math, Date, performance: { now: () => Date.now() },
  innerWidth: 480, innerHeight: 800, devicePixelRatio: 1,
  localStorage: { getItem: () => null, setItem() {} },
  requestAnimationFrame() {},
  addEventListener() {},
  document: { getElementById: () => mkCanvas(), createElement: () => mkCanvas(), addEventListener() {}, hidden: false },
  setTimeout,
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(m[1], sandbox);
const gc = sandbox.__gc;
const G = gc.G;

let errors = 0;
const fail = (msg) => { errors++; console.log('FAIL:', msg); };
const rng = (() => { let a = 12345; return () => (a = (a * 1664525 + 1013904223) >>> 0) / 4294967296; })();

function bot(dt) {
  // follow the lowest descending ball, aiming slightly off-centre toward the nearest gate
  let target = null;
  for (const b of G.balls) if (!b.stuck && b.vy > 0 && (!target || b.y > target.y)) target = b;
  if (target) {
    const gate = G.gates.reduce((a, g) => (Math.abs(g.x - target.x) < Math.abs(a.x - target.x) ? g : a), G.gates[0]);
    const off = Math.max(-1, Math.min(1, (gate.x - target.x) / 200)) * G.pad.w * 0.3;
    G.pad.tx = target.x - off;
  } else if (G.balls[0]) G.pad.tx = G.balls[0].x;
  // chase orbs if no ball is close
  for (const o of G.orbs) if (!target || target.y < 600) G.pad.tx = o.x;
}

function playLevel(n, maxSec) {
  gc.G.score = 0; G.lives = 3;
  gc.loadLevel(n);
  const total = G.remaining;
  const dt = 1 / 60;
  let t = 0, maxBalls = 0, orbsCaught = 0, lastOrbs = 0;
  while (t < maxSec && G.state !== 'over') {
    if (G.state === 'serve' && G.stateT > 0.2) gc.launch();
    if (G.state === 'clear') break;
    bot(dt);
    gc.update(dt); gc.draw();
    t += dt;
    maxBalls = Math.max(maxBalls, G.balls.length);
    for (const b of G.balls) {
      if (!isFinite(b.x) || !isFinite(b.y) || !isFinite(b.vx) || !isFinite(b.vy)) { fail('NaN ball on level ' + n); return; }
      if (b.x < -5 || b.x > 485) fail('ball out of x bounds on level ' + n + ': ' + b.x);
    }
  }
  const cleared = G.state === 'clear';
  console.log(`L${String(n).padStart(2)} ${G.levelName.padEnd(16)} blocks=${String(total).padStart(2)} left=${String(G.remaining).padStart(2)} ` +
    `${cleared ? 'CLEARED' : G.state.toUpperCase()} t=${t.toFixed(0)}s score=${G.score} lives=${G.lives} maxBalls=${maxBalls}`);
  return cleared;
}

let cleared = 0;
for (let n = 1; n <= 14; n++) if (playLevel(n, 240)) cleared++;
console.log(`\ncleared ${cleared}/14 levels with a simple bot`);

// forced orb tests: each orb type applies without error
gc.loadLevel(2); gc.launch();
for (let i = 0; i < 30; i++) gc.update(1 / 60);
for (const t of ['x2', 'x3', 'pierce', 'wide', 'slow', 'blast', 'shield']) {
  const before = G.balls.length;
  gc.applyOrb(t, { x: 240, y: 700 });
  for (let i = 0; i < 20; i++) { gc.update(1 / 60); gc.draw(); }
  console.log(`orb ${t}: balls ${before} -> ${G.balls.length}, fx=${JSON.stringify(G.fx)} shield=${G.shield}`);
}
if (G.balls.length <= 1) fail('multiplier orbs did not add balls');

// orb funnel test: an orb dropped over solid wall must slide to a gate and fall through
gc.loadLevel(1); gc.launch(); G.orbs.push({ x: 160, y: 300, vy: 20, type: 'x2', sliding: false, dead: false, t: 0 });
let passed = false;
for (let i = 0; i < 600; i++) { G.pad.tx = 240; gc.update(1 / 60); const o = G.orbs[0]; if (o && o.y > gc.WALL_B + 10) { passed = true; break; } if (!o) { passed = true; break; } }
console.log('orb funnels through gate:', passed);
if (!passed) fail('orb did not funnel through a gate');

console.log(errors ? `\n${errors} FAILURES` : '\nALL OK');
process.exit(errors ? 1 : 0);
