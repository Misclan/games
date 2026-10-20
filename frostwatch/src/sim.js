/* Frostwatch rules engine. Pure logic, no DOM, so it can be tested headless.
   Coordinates: a 360 x 640 world. Water above y=EDGE, the dock below it,
   a fence at y=FENCE with the hungry crowd waiting behind it. */
(function (root) {
'use strict';

const W = 360, H = 640, EDGE = 200, FENCE = 566;
const DAYS = 10, DAY_LEN = 60;
const PILE_CAP = 40, BENCH_CAP = 40, POT_OUT_CAP = 30;
const DT = 1 / 30;

// Stations you walk onto. Standing on one does its job automatically.
const ST = {
  fish:    { x: 126, y: 232, r: 28 },
  wood:    { x: 234, y: 232, r: 28 },
  pot:     { x: 72,  y: 322, r: 32 },
  furnace: { x: 288, y: 322, r: 32 },
  bench:   { x: 150, y: 536, r: 34 },
  cash:    { x: 248, y: 536, r: 26 },
};

// Upgrade pads: stand on one for a moment to buy the next level.
const UPS = [
  { id: 'netw',   name: 'Wider net',    icon: '↔', costs: [50, 110, 200],  x: 54,  y: 408 },
  { id: 'netr',   name: 'Longer rope',  icon: '↕', costs: [60, 130],       x: 120, y: 408 },
  { id: 'carry',  name: 'Big sled',     icon: '📦', costs: [40, 90, 170],   x: 186, y: 408 },
  { id: 'boots',  name: 'Snow boots',   icon: '🥾', costs: [60, 140],       x: 252, y: 408 },
  { id: 'fence',  name: 'Bigger fence', icon: '🚧', costs: [120, 260, 420], x: 318, y: 408 },
  { id: 'pot',    name: 'Extra pot',    icon: '🍲', costs: [90, 180, 320],  x: 87,  y: 462 },
  { id: 'hearth', name: 'Hearth',       icon: '🔥', costs: [100, 220, 380], x: 153, y: 462 },
  { id: 'hf',     name: 'Fish husky',   icon: '🐕', costs: [160, 300],      x: 219, y: 462 },
  { id: 'hm',     name: 'Meal husky',   icon: '🐶', costs: [200, 340],      x: 285, y: 462 },
];
const PAD_R = 22;

function rand(s) {                       // mulberry32, state kept in the game
  let t = (s.seed = (s.seed + 0x6D2B79F5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const lvl = (s, id) => s.ups[id] || 0;
function stats(s) {
  return {
    halfW: 26 + 10 * lvl(s, 'netw'),
    reach: 70 + 30 * lvl(s, 'netr'),
    cap: 8 + 6 * lvl(s, 'carry'),
    speed: 115 + 22 * lvl(s, 'boots'),
    pots: 1 + lvl(s, 'pot'),
    heat: 2.4 + 0.9 * lvl(s, 'hearth'),
    fuelCap: 12 + 6 * lvl(s, 'hearth'),
    queueCap: 8 + 6 * lvl(s, 'fence'),
    hf: lvl(s, 'hf'), hm: lvl(s, 'hm'),
  };
}
function fx(s, x, y, txt, c) { if (s.fx.length < 60) s.fx.push({ x, y, txt, c: c || '#fff', t: 0 }); }

function newState(seed) {
  const s = {
    seed: (seed == null ? 1 : seed) | 0,
    t: 0, day: 1, dayT: 0, phase: 'play', reason: '', blizzard: false,
    player: { x: 180, y: 372, carry: { type: null, n: 0 } },
    net: { x: 180, tx: 180, phase: 'seek', t: 0, reach: 0, last: 0 },
    schools: [], fish: [], logs: [], logT: 4,
    pileFish: 6, pileWood: 0,
    pot: { in: 0, out: 0, prog: 0 },
    furnace: { fuel: 3, burnT: 0 },
    bench: { stock: 2 }, cashPile: 0, wallet: 0,
    queue: [], arrT: 2, servT: 0, nextId: 1,
    morale: 70, warmth: 70, served: 0, lost: 0, earned: 0,
    ups: {}, pad: { id: null, t: 0 },
    acc: { take: 0, drop: 0, hf: 0, hm: 0 },
    fx: [],
  };
  for (let i = 0; i < 3; i++) {
    s.schools.push({ x: 80 + i * 100, y: 90 + rand(s) * 80, tx: 180, ty: 120, t: 0, rt: 0 });
  }
  s.schools.forEach((sc, i) => { for (let k = 0; k < 16; k++) spawnFish(s, i, true); });
  return s;
}
function spawnFish(s, si, instant) {
  const sc = s.schools[si];
  const q = { sch: si, ox: (rand(s) - 0.5) * 80, oy: (rand(s) - 0.5) * 52, x: 0, y: 0, ph: rand(s) * 6.28 };
  q.x = sc.x + q.ox; q.y = sc.y + q.oy;
  if (!instant) { q.x += (rand(s) < 0.5 ? -1 : 1) * 40; }
  s.fish.push(q);
}

function aimNet(s) {
  const st = stats(s), n = s.net;
  let best = n.x, bs = -1e9;
  for (let k = 0; k < 14; k++) {
    const cx = 30 + (W - 60) * k / 13;
    let sc = 0;
    for (const q of s.fish) if (Math.abs(q.x - cx) < st.halfW && q.y > EDGE - st.reach) sc += 1;
    for (const l of s.logs) if (Math.abs(l.x - cx) < st.halfW && l.y > EDGE - st.reach) sc += s.furnace.fuel < 5 ? 6 : 2;
    sc += rand(s) * 0.6 - Math.abs(cx - n.x) * 0.01;
    if (sc > bs) { bs = sc; best = cx; }
  }
  n.tx = best;
}
function doCatch(s) {
  const st = stats(s), n = s.net;
  const x0 = n.x - st.halfW, x1 = n.x + st.halfW, y0 = EDGE - st.reach;
  let f = 0, w = 0;
  for (let i = s.fish.length - 1; i >= 0; i--) {
    const q = s.fish[i];
    if (q.x > x0 && q.x < x1 && q.y > y0 && q.y < EDGE && s.pileFish + f < PILE_CAP) { s.fish.splice(i, 1); f++; }
  }
  for (let i = s.logs.length - 1; i >= 0; i--) {
    const l = s.logs[i];
    if (l.x > x0 && l.x < x1 && l.y > y0 && l.y < EDGE && s.pileWood + w < PILE_CAP) { s.logs.splice(i, 1); w += 3; }
  }
  s.pileFish += f; s.pileWood += w; n.last = f + w;
  if (f) fx(s, n.x, EDGE - 14, '+' + f + ' 🐟', '#bfe6ff');
  if (w) fx(s, n.x + 16, EDGE - 28, '+' + w + ' 🪵', '#ffd9a0');
}

function stepWorld(s, dt, st) {
  // schools and fish
  for (const sc of s.schools) {
    sc.t -= dt;
    const dx = sc.tx - sc.x, dy = sc.ty - sc.y, d = Math.hypot(dx, dy);
    if (sc.t <= 0 || d < 4) { sc.tx = 40 + rand(s) * 280; sc.ty = 70 + rand(s) * 105; sc.t = 6 + rand(s) * 6; }
    else { sc.x += dx / d * 16 * dt; sc.y += dy / d * 16 * dt; }
  }
  const counts = [0, 0, 0];
  for (const q of s.fish) {
    const sc = s.schools[q.sch];
    q.x += (sc.x + q.ox - q.x) * Math.min(1, dt * 2) + Math.sin(s.t * 2 + q.ph) * 6 * dt;
    q.y += (sc.y + q.oy - q.y) * Math.min(1, dt * 2) + Math.cos(s.t * 1.7 + q.ph) * 5 * dt;
    q.y = Math.max(20, Math.min(EDGE - 8, q.y));
    counts[q.sch]++;
  }
  s.schools.forEach((sc, i) => {
    sc.rt -= dt;
    if (counts[i] < 16 && sc.rt <= 0) { spawnFish(s, i, false); sc.rt = s.blizzard ? 2.2 : 1.0; }
  });
  // drifting logs
  s.logT -= dt;
  if (s.logT <= 0) {
    s.logs.push({ x: rand(s) < 0.5 ? -10 : W + 10, y: 70 + rand(s) * 105, vx: 0, rot: rand(s) * 3, age: 0 });
    const l = s.logs[s.logs.length - 1]; l.vx = (l.x < 0 ? 1 : -1) * (7 + rand(s) * 8);
    s.logT = (s.blizzard ? 5 : 7) + rand(s) * 3;
  }
  for (let i = s.logs.length - 1; i >= 0; i--) {
    const l = s.logs[i]; l.x += l.vx * dt; l.age += dt; l.rot += dt * 0.3;
    if (l.x < -30 || l.x > W + 30 || l.age > 60) s.logs.splice(i, 1);
  }
  // the net runs itself
  const n = s.net; n.t += dt;
  if (n.phase === 'seek') {
    if (n.t === dt || n.t < 0.001) aimNet(s);
    const dx = n.tx - n.x, m = 140 * dt;
    if (Math.abs(dx) > m) n.x += Math.sign(dx) * m; else n.x = n.tx;
    n.reach = Math.max(0, n.reach - st.reach * dt * 2);
    if ((n.x === n.tx && n.t > 0.2) || n.t > 1.1) {
      if (s.pileFish >= PILE_CAP && s.pileWood >= PILE_CAP) { n.t = 0; }
      else { n.phase = 'cast'; n.t = 0; }
    }
  } else if (n.phase === 'cast') {
    n.reach = st.reach * Math.min(1, n.t / 0.8);
    if (n.t >= 0.8) { n.reach = st.reach; doCatch(s); n.phase = 'haul'; n.t = 0; }
  } else {
    n.reach = st.reach * Math.max(0, 1 - n.t / 0.7);
    if (n.t >= 0.7) { n.reach = 0; n.phase = 'seek'; n.t = 0; aimNet(s); }
  }
}

function stepPlayer(s, inp, dt, st) {
  const p = s.player;
  let dx = inp.dx || 0, dy = inp.dy || 0;
  const m = Math.hypot(dx, dy);
  if (m > 1) { dx /= m; dy /= m; }
  p.x = Math.max(12, Math.min(W - 12, p.x + dx * st.speed * dt));
  p.y = Math.max(EDGE + 14, Math.min(FENCE - 14, p.y + dy * st.speed * dt));
  if (m > 0.05) { p.fx = dx; p.fy = dy; }

  const c = p.carry, near = k => Math.hypot(p.x - ST[k].x, p.y - ST[k].y) < ST[k].r;
  const rate = 22 * dt;
  let onStation = false;
  for (const type of ['fish', 'wood']) {
    if (!near(type)) continue;
    onStation = true;
    if (c.n === 0) c.type = null;
    if ((c.type === null || c.type === type) && (type === 'fish' ? s.pileFish : s.pileWood) > 0) {
      s.acc.take += rate;
      const k = Math.min(Math.floor(s.acc.take), st.cap - c.n, type === 'fish' ? s.pileFish : s.pileWood);
      if (k > 0) { c.type = type; c.n += k; s.acc.take -= k; if (type === 'fish') s.pileFish -= k; else s.pileWood -= k; }
    }
  }
  if (near('pot')) {
    onStation = true;
    s.acc.drop += rate;
    if (c.type === 'fish' && c.n > 0) {
      const k = Math.min(Math.floor(s.acc.drop), c.n, 20 * st.pots - s.pot.in);
      if (k > 0) { c.n -= k; s.pot.in += k; s.acc.drop -= k; }
    } else if (c.type === null || c.type === 'meals' || c.n === 0) {
      const k = Math.min(Math.floor(s.acc.drop), st.cap - c.n, s.pot.out);
      if (k > 0) { c.type = 'meals'; c.n += k; s.pot.out -= k; s.acc.drop -= k; }
    }
  }
  if (near('furnace') && c.type === 'wood' && c.n > 0) {
    onStation = true;
    s.acc.drop += rate;
    const k = Math.min(Math.floor(s.acc.drop), c.n, st.fuelCap - s.furnace.fuel);
    if (k > 0) { c.n -= k; s.furnace.fuel += k; s.acc.drop -= k; }
  }
  if (near('bench') && c.type === 'meals' && c.n > 0) {
    onStation = true;
    s.acc.drop += rate;
    const k = Math.min(Math.floor(s.acc.drop), c.n, BENCH_CAP - s.bench.stock);
    if (k > 0) { c.n -= k; s.bench.stock += k; s.acc.drop -= k; }
  }
  if (near('cash') && s.cashPile >= 1) {
    const k = Math.floor(s.cashPile);
    s.cashPile -= k; s.wallet += k; s.earned += k;
    fx(s, p.x, p.y - 26, '+$' + k, '#9dff9d');
  }
  if (!onStation) { s.acc.take = 0; s.acc.drop = 0; }
  if (c.n <= 0) { c.n = 0; c.type = null; }

  // upgrade pads
  let on = null;
  for (const u of UPS) {
    if (Math.hypot(p.x - u.x, p.y - u.y) < PAD_R + 2) { on = u; break; }
  }
  if (on) {
    const L = lvl(s, on.id), cost = on.costs[L];
    if (cost != null && s.wallet >= cost) {
      if (s.pad.id !== on.id) { s.pad.id = on.id; s.pad.t = 0; }
      s.pad.t += dt;
      if (s.pad.t >= 0.7) {
        s.wallet -= cost; s.ups[on.id] = L + 1; s.pad.t = 0;
        fx(s, on.x, on.y - 24, on.name + '!', '#ffe27a');
      }
    } else { s.pad.id = null; s.pad.t = 0; }
  } else { s.pad.id = null; s.pad.t = 0; }
}

function stepTown(s, dt, st) {
  // pots
  const po = s.pot;
  if (po.in > 0 && po.out < POT_OUT_CAP) {
    po.prog += dt * 0.65 * st.pots;
    while (po.prog >= 1 && po.in > 0 && po.out < POT_OUT_CAP) { po.prog -= 1; po.in--; po.out++; }
  } else po.prog = Math.min(po.prog, 0.99);
  // huskies
  if (st.hf > 0) {
    s.acc.hf += 0.9 * st.hf * dt;
    const k = Math.min(Math.floor(s.acc.hf), s.pileFish, 20 * st.pots - po.in);
    if (k > 0) { s.pileFish -= k; po.in += k; s.acc.hf -= k; } else if (s.pileFish <= 0 || po.in >= 20 * st.pots) s.acc.hf = Math.min(s.acc.hf, 0.99);
  }
  if (st.hm > 0) {
    s.acc.hm += 0.9 * st.hm * dt;
    const k = Math.min(Math.floor(s.acc.hm), po.out, BENCH_CAP - s.bench.stock);
    if (k > 0) { po.out -= k; s.bench.stock += k; s.acc.hm -= k; } else if (po.out <= 0 || s.bench.stock >= BENCH_CAP) s.acc.hm = Math.min(s.acc.hm, 0.99);
  }
  // furnace and warmth
  const fu = s.furnace; let burning = false;
  if (fu.fuel > 0) {
    burning = true; fu.burnT += dt;
    const per = 7 / (1 + 0.25 * lvl(s, 'hearth'));
    if (fu.burnT >= per) { fu.burnT -= per; fu.fuel--; }
  }
  const drain = 1.4 * (1 + 0.12 * (s.day - 1)) * (s.blizzard ? 2.2 : 1);
  s.warmth = Math.max(0, Math.min(100, s.warmth + ((burning ? st.heat : 0) - drain) * dt));
  s.burning = burning;

  // crowd arrives
  s.arrT -= dt;
  if (s.arrT <= 0) {
    if (s.queue.length < st.queueCap) s.queue.push({ id: s.nextId++, pat: 45 });
    s.arrT = Math.max(1.4, 3.9 / (1 + 0.1 * (s.day - 1))) * (0.8 + rand(s) * 0.4);
  }
  // patience
  const cold = s.warmth < 30 ? 1.6 : 1;
  for (let i = s.queue.length - 1; i >= 0; i--) {
    const v = s.queue[i]; v.pat -= dt * cold;
    if (v.pat <= 0) {
      s.queue.splice(i, 1); s.morale -= 7; s.lost++;
      fx(s, 150, FENCE + 10, '😠 -7', '#ff9a9a');
    }
  }
  // serving
  s.servT -= dt;
  if (s.servT <= 0 && s.bench.stock > 0 && s.queue.length > 0) {
    s.queue.shift(); s.bench.stock--; s.served++;
    s.cashPile += 4 + s.day; s.morale = Math.min(100, s.morale + 0.6);
    s.servT = 0.45;
  }
  if (s.warmth <= 0) s.morale -= 1.5 * dt;
  if (s.morale <= 0) { s.morale = 0; s.phase = 'lost'; s.reason = s.warmth <= 0 ? 'frozen' : 'angry'; }
}

function step(s, inp, dt) {
  if (s.phase !== 'play') return;
  dt = dt || DT; inp = inp || {};
  s.t += dt; s.dayT += dt;
  if (s.dayT >= DAY_LEN) {
    s.dayT = 0; s.day++;
    if (s.day > DAYS) { s.day = DAYS; s.phase = 'won'; return; }
    fx(s, W / 2, 130, 'Day ' + s.day, '#fff');
  }
  const wasB = s.blizzard;
  s.blizzard = s.day % 3 === 0 && s.dayT > 15 && s.dayT < 45;
  if (s.blizzard && !wasB) fx(s, W / 2, 150, 'Blizzard!', '#cfe8ff');
  const st = stats(s);
  stepWorld(s, dt, st);
  stepPlayer(s, inp, dt, st);
  stepTown(s, dt, st);
}

const Frost = { W, H, EDGE, FENCE, DAYS, DAY_LEN, PILE_CAP, BENCH_CAP, DT, ST, UPS, PAD_R, newState, step, stats, lvl };
if (typeof module !== 'undefined' && module.exports) module.exports = Frost; else root.Frost = Frost;
})(typeof window !== 'undefined' ? window : this);
