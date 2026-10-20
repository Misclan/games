/* Rampart Run rules engine. Pure and deterministic: no DOM, no clocks.
   The game advances it in fixed steps of DT seconds. Works in the browser
   (window.RR) and in Node (require). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RR = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DT = 1 / 30;       // seconds per step
  const V = 5;             // squad run speed (units/s)
  const LAT = 1.7;         // squad sideways speed (lane widths/s)
  const RANGE = 15;        // shooting range
  const ACT = 34;          // enemies wake up this far ahead
  const WSPD = 1.8;        // zombie wave speed toward you
  const BSPD = 1.2;        // boss speed toward you
  const LATW = 0.35;       // zombie sideways tracking speed
  const START_N = 10;

  const PERKS = {
    reinforce: { cost: 0.8, name: 'Reinforce',     w: 3 },
    rapid:     { cost: 1.0, name: 'Rapid fire',    w: 3 },
    shield:    { cost: 1.2, name: 'Shield',        w: 2 },
    spread:    { cost: 1.3, name: 'Spread shot',   w: 2 },
    pierce:    { cost: 1.5, name: 'Piercing shot', w: 2 },
    heavy:     { cost: 1.8, name: 'Heavy shot',    w: 1 },
  };
  const THEMES = {
    bridge: { name: 'The Bridge', throws: ['car', 'rail'] },
    port:   { name: 'The Port',   throws: ['container', 'oil'] },
  };
  const ALLY = {
    turret: { name: 'Auto turret', hp: 120, bps: 36, dmg: 2 },
    drone:  { name: 'Drone',       hp: 80,  bps: 20, dmg: 1 },
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Level generation uses its own seeded generator, the running game uses s.rs.
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rnd(s) {
    s.rs = (s.rs + 0x6D2B79F5) | 0;
    let t = Math.imul(s.rs ^ (s.rs >>> 15), 1 | s.rs);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Per-level difficulty scale found by tools/calibrate.js (see src/cal.js).
  let CAL = {};
  function setCal(t) { CAL = t || {}; }
  // Difficulty ramp the calibrator aims for.
  const targetK = lvl => Math.min(0.9 + 0.12 * lvl, 5);
  // CAL[lvl] = [k, variant]: difficulty scale and which layout variant to use.
  function calFor(lvl) {
    if (CAL[lvl]) return CAL[lvl];
    const ks = Object.keys(CAL).map(Number);
    if (!ks.length) return [0.8, 0];
    const last = Math.max.apply(null, ks);
    return [Math.min(5, CAL[last][0] + (lvl - last) * 0.04), (lvl * 7) % 12];
  }

  // ---------- level generation ----------
  function genLevel(lvl, k, variant) {
    if (k == null) { const c = calFor(lvl); k = c[0]; variant = c[1]; }
    const r = rng(lvl * 7919 + 13 + (variant || 0) * 104729);
    const theme = lvl % 2 ? 'bridge' : 'port';
    const objs = [], rows = [];
    let id = 0;
    const add = o => { o.id = id++; objs.push(o); return o; };
    const pick = a => a[Math.floor(r() * a.length)];
    const sd = () => (r() < 0.5 ? -1 : 1);
    const pickPerk = (not) => {
      const keys = Object.keys(PERKS);
      for (let tries = 0; tries < 6; tries++) {
        let tot = 0; keys.forEach(p => tot += PERKS[p].w);
        let x = r() * tot, got = keys[0];
        for (const p of keys) { x -= PERKS[p].w; if (x <= 0) { got = p; break; } }
        if (got !== not) return got;
      }
      return 'rapid';
    };
    const stream = lvl % 5 === 0;
    const pattern = ['cards', 'recruit', 'barrel', 'wave', 'cards', 'spikes', 'wave', 'cards', 'barrel', 'wave', 'recruit', 'cards', 'wave'];
    const nRows = 7 + Math.min(lvl, 8);
    const off = Math.floor(r() * pattern.length);
    let z = 24, waveIdx = 0, allyKind = 0;

    for (let i = 0; i < nRows; i++) {
      let type = pattern[(i + off) % pattern.length];
      if (i === 0 && (type === 'wave' || type === 'spikes')) type = 'cards';
      if (lvl >= 2 && (i === 4 || i === 9)) type = 'crate';
      z += 15 + (type === 'wave' ? 5 : 0);
      rows.push(z);

      if (type === 'cards') {
        const goodv = () => pick([2, 2, 3, 3, 4]);
        const m = r();
        let a, b;
        if (m < 0.4) { a = { op: 'x', v: goodv() }; b = { op: 'x', v: goodv() }; if (b.v === a.v) b.v = a.v === 2 ? 3 : 2; }
        else if (m < 0.85) { a = { op: 'x', v: goodv() }; b = pick([{ op: '/', v: 2 }, { op: '/', v: 3 }, { op: '-', v: 6 + lvl * 2 }]); }
        else { a = { op: 'x', v: 2 }; b = { op: '-', v: 4 + lvl }; }
        const flip = r() < 0.5;
        add({ type: 'card', z, x: -0.5, w: 0.5, op: (flip ? a : b).op, v: (flip ? a : b).v });
        add({ type: 'card', z, x: 0.5, w: 0.5, op: (flip ? b : a).op, v: (flip ? b : a).v });
      } else if (type === 'recruit') {
        const n = Math.round((7 + lvl * 2.2) * (1 + i * 0.08));
        const side = sd();
        add({ type: 'recruit', z, x: side * 0.5, w: 0.4, n });
        if (r() < 0.5) add({ type: 'recruit', z, x: -side * 0.5, w: 0.4, n: Math.max(3, Math.round(n * 0.5)) });
      } else if (type === 'barrel') {
        const two = r() < 0.6, side = sd();
        const p1 = pickPerk();
        const mk = (x, perk) => {
          const cost = Math.round(PERKS[perk].cost * (26 + lvl * 5) * (0.9 + r() * 0.3));
          add({ type: 'barrel', z, x, w: 0.3, hp: cost, max: cost, perk });
        };
        if (two) { mk(-0.5, p1); mk(0.5, pickPerk(p1)); } else mk(side * 0.5, p1);
      } else if (type === 'wave') {
        const n = Math.max(3, Math.round((5 + lvl * 2.4) * (1 + waveIdx * 0.25) * (1 + i * 0.04) * k));
        const spit = lvl >= 3 && r() < Math.min(0.8, 0.2 + lvl * 0.06);
        add({ type: 'wave', z, x: (r() - 0.5) * 1.0, w: clamp(0.22 + Math.sqrt(n) * 0.03, 0.2, 0.8), n, hp: n, max: n, spit, spitT: 1.5 + r() });
        waveIdx++;
      } else if (type === 'spikes') {
        add({ type: 'spikes', z, gx: (r() - 0.5) * 1.4, gw: 0.3 });
      } else if (type === 'crate') {
        const hp = Math.round(Math.min(300, 200 + lvl * 6));
        add({ type: 'crate', z, x: sd() * 0.4, w: 0.45, hp, max: hp, ally: allyKind++ % 2 ? 'drone' : 'turret' });
      }
    }

    const bossZ = z + 40;
    if (stream) {
      for (let j = 0; j < 12; j++) {
        const n = Math.max(2, Math.round((3 + lvl * 0.9) * k));
        add({ type: 'wave', z: bossZ - 27 + j * 4.5, x: (r() - 0.5) * 1.4, w: clamp(0.2 + Math.sqrt(n) * 0.03, 0.2, 0.6), n, hp: n, max: n, spit: lvl >= 3 && r() < 0.3, spitT: 1.5 + r() });
      }
    }
    const bhp = Math.round((90 + lvl * 60) * k * 5);
    add({ type: 'boss', z: bossZ, x: 0, w: 0.55, hp: bhp, max: bhp, strikeT: 0.5, thrT: 3 });
    rows.push(bossZ - 18);
    objs.sort((a, b) => a.z - b.z || a.id - b.id);
    return { lvl, theme, objs, rows, bossZ, k, stream, variant: variant || 0 };
  }

  // The level to play for a number. Inside the calibrated table it is just
  // genLevel; beyond it, search for a layout the solver can beat that running
  // straight cannot. (Cheap: tens of milliseconds.)
  const searched = {};
  function levelFor(lvl) {
    if (CAL[lvl]) return genLevel(lvl);
    if (searched[lvl]) return searched[lvl];
    const target = targetK(lvl);
    let fallback = null;
    for (let v = 0; v < 12; v++) {
      for (let k = target; k > 0.3; k *= 0.88) {
        const L = genLevel(lvl, +k.toFixed(2), v);
        if (solve(L)) { if (!straight(L)) return (searched[lvl] = L); if (!fallback) fallback = L; break; }
      }
    }
    return (searched[lvl] = fallback || genLevel(lvl, 0.4, 0));
  }

  // ---------- state ----------
  function newState(level) {
    const objs = JSON.parse(JSON.stringify(level.objs));
    return {
      lvl: level.lvl, theme: level.theme, rs: level.lvl * 104729 + 7,
      t: 0, z: 0, x: 0, n: START_N, shield: 0, acc: 0,
      perks: { rapid: 0, heavy: 0, spread: 0, pierce: 0 },
      allies: [], globs: [], throws: [], objs,
      boss: objs.find(o => o.type === 'boss'),
      over: false, won: false, blocked: false, lost: 0, cz: -1,
      fxOn: false, fx: [],
    };
  }
  function clone(s) { const c = structuredClone(s); c.fx = []; return c; }

  const half = n => Math.min(0.42, 0.08 + Math.sqrt(Math.max(n, 0)) * 0.022);
  const fx = (s, e) => { if (s.fxOn) s.fx.push(e); };

  function hurt(s, k, kind) {
    k = Math.ceil(k);
    if (k <= 0) return;
    if (s.shield > 0) {
      const a = Math.min(s.shield, k);
      s.shield -= a; k -= a;
      fx(s, { t: 'shield', x: s.x, n: a });
    }
    if (k > 0) {
      s.n -= k; s.lost += k;
      fx(s, { t: 'hurt', x: s.x, n: k, kind: kind || '' });
      if (s.allies.length) {
        const a = s.allies[0];
        a.hp -= Math.max(1, Math.round(k * 0.35));
        if (a.hp <= 0) { s.allies.shift(); fx(s, { t: 'allyDown', kind: a.kind }); }
      }
    }
    if (s.n <= 0) { s.n = 0; s.over = true; s.won = false; }
  }

  function applyPerk(s, p) {
    if (p === 'reinforce') { const n = 8 + 2 * s.lvl; s.n += n; fx(s, { t: 'gain', x: s.x, n }); }
    else if (p === 'rapid') s.perks.rapid = Math.min(4, s.perks.rapid + 1);
    else if (p === 'shield') s.shield += 20 + s.lvl;
    else if (p === 'spread') s.perks.spread = 1;
    else if (p === 'pierce') s.perks.pierce = 1;
    else if (p === 'heavy') s.perks.heavy = 1;
  }

  function kill(s, o) {
    o.dead = true;
    if (o.type === 'boss') { s.won = true; s.over = true; fx(s, { t: 'bossDown', x: o.x, z: o.z }); }
    else if (o.type === 'barrel') { applyPerk(s, o.perk); fx(s, { t: 'perk', x: o.x, z: o.z, perk: o.perk }); }
    else if (o.type === 'crate') {
      const A = ALLY[o.ally];
      s.allies.push({ kind: o.ally, hp: A.hp, max: A.hp, acc: 0 });
      fx(s, { t: 'ally', x: o.x, z: o.z, kind: o.ally });
    } else if (o.type === 'wave') fx(s, { t: 'zdie', x: o.x, z: o.z, w: o.w });
    else if (o.type === 'glob') fx(s, { t: 'splat', x: o.x, z: o.z });
  }

  // things that cross the squad's position
  function pass(s, z0, z1) {
    const h = half(s.n);
    for (const o of s.objs) {
      if (o.dead || o.z <= z0 || o.z > z1) continue;
      if (o.type === 'card') {
        if (s.cz === o.z) continue;
        s.cz = o.z;
        let best = o;
        for (const q of s.objs) if (q.type === 'card' && q.z === o.z && Math.abs(q.x - s.x) < Math.abs(best.x - s.x)) best = q;
        if (Math.abs(s.x - best.x) <= best.w) {
          const n0 = s.n;
          if (best.op === 'x') s.n = Math.round(s.n * best.v);
          else if (best.op === '/') s.n = Math.max(1, Math.floor(s.n / best.v));
          else s.n = Math.max(1, s.n - best.v);
          fx(s, { t: 'card', x: s.x, op: best.op, v: best.v, d: s.n - n0 });
        }
        for (const q of s.objs) if (q.type === 'card' && q.z === o.z) q.dead = true;
      } else if (o.type === 'recruit') {
        if (Math.abs(s.x - o.x) <= o.w + h * 0.6) { s.n += o.n; o.dead = true; fx(s, { t: 'gain', x: s.x, n: o.n }); }
      } else if (o.type === 'spikes') {
        o.dead = true;
        if (Math.abs(s.x - o.gx) > o.gw) { hurt(s, Math.ceil(s.n * 0.25), 'spikes'); }
        else fx(s, { t: 'clean', x: s.x });
      } else if (o.type === 'barrel' || o.type === 'crate') {
        o.dead = true; // rolled past unopened
      }
    }
  }

  function targets(s, extra, enemiesOnly) {
    const h = half(s.n) + extra, out = [];
    for (const o of s.objs) {
      if (o.dead) continue;
      const t = o.type;
      if (t !== 'wave' && t !== 'boss' && !(t === 'barrel' || t === 'crate') || (enemiesOnly && (t === 'barrel' || t === 'crate'))) continue;
      const d = o.z - s.z;
      if (d <= 0.3 || d > RANGE) continue;
      if (Math.abs(o.x - s.x) <= o.w + h) out.push(o);
    }
    for (const g of s.globs) {
      if (g.dead) continue;
      const d = g.z - s.z;
      if (d > 0.3 && d <= RANGE && Math.abs(g.x - s.x) <= g.w + h) out.push(g);
    }
    out.sort((a, b) => a.z - b.z);
    return out;
  }

  function allocate(s, list, shots, dmg, pierce) {
    if (!list.length || shots <= 0) return;
    let rem = shots;
    const touched = [];
    for (let i = 0; i < list.length && rem > 0; i++) {
      const o = list[i];
      const need = Math.max(0, Math.ceil(o.hp / dmg));
      const use = Math.min(rem, need);
      if (!use) continue;
      o.hp -= use * dmg; rem -= use; touched.push(o);
      if (pierce && i + 1 < list.length) { list[i + 1].hp -= Math.round(use * dmg * 0.5); touched.push(list[i + 1]); }
    }
    for (const o of touched) if (o.hp <= 0 && !o.dead) kill(s, o);
    if (s.fxOn) {
      const o = list[0];
      for (let i = 0; i < Math.min(3, shots); i++) s.fx.push({ t: 'tr', x: s.x + (Math.random() - 0.5) * half(s.n) * 1.6, tx: o.x + (Math.random() - 0.5) * o.w, tz: o.z });
      s.fx.push({ t: 'hit', id: o.id, z: o.z });
    }
  }

  function step(s, input) {
    if (s.over) return;
    s.t += DT;
    if (s.t > 240) { s.over = true; return; }
    const h = half(s.n);
    const tx = clamp(input.x, -0.92, 0.92), dx = tx - s.x, m = LAT * DT;
    s.x += Math.abs(dx) <= m ? dx : Math.sign(dx) * m;

    const boss = s.boss;
    s.blocked = !!(boss && !boss.dead && boss.z - s.z < 1.4);
    if (!s.blocked) {
      const z0 = s.z; s.z += V * DT; pass(s, z0, s.z);
      if (s.over) return;
    }

    // zombies
    for (const o of s.objs) {
      if (o.dead || o.type !== 'wave') continue;
      const d = o.z - s.z;
      if (d >= ACT) continue;
      o.z -= WSPD * DT;
      const ddx = s.x - o.x, mm = LATW * DT;
      o.x += Math.abs(ddx) <= mm ? ddx : Math.sign(ddx) * mm;
      if (o.spit && d < RANGE + 8 && d > 2) {
        o.spitT -= DT;
        if (o.spitT <= 0) {
          o.spitT = 2.2 + rnd(s) * 1.2;
          const hp = 2 + Math.floor(s.lvl / 6);
          s.globs.push({ type: 'glob', x: s.x + (rnd(s) - 0.5) * 0.2, z: o.z - 0.3, hp, max: hp, w: 0.14, id: 'g' + s.t });
        }
      }
      if (o.z - s.z <= 0.7) {
        if (Math.abs(o.x - s.x) <= o.w + h) { const k = Math.ceil(o.hp); kill(s, o); hurt(s, k, 'zombie'); if (s.over) return; }
        else if (o.z - s.z < -2) o.dead = true;
      }
    }

    // boss
    if (boss && !boss.dead) {
      const d = boss.z - s.z;
      if (d < ACT) {
        const contact = d < 1.6;
        if (!contact) boss.z -= BSPD * DT;
        const ddx = s.x - boss.x, mm = 0.5 * DT;
        boss.x += Math.abs(ddx) <= mm ? ddx : Math.sign(ddx) * mm;
        if (contact) {
          if (Math.abs(boss.x - s.x) <= boss.w + h + 0.1) {
            boss.strikeT -= DT;
            if (boss.strikeT <= 0) {
              boss.strikeT = 1.0;
              fx(s, { t: 'strike' });
              hurt(s, Math.ceil(s.n * 0.45) + 15, 'boss');
              if (s.over) return;
            }
          }
        } else if (d < 18) {
          boss.thrT -= DT;
          if (boss.thrT <= 0) {
            boss.thrT = Math.max(2, 3.4 - s.lvl * 0.03);
            const kinds = THEMES[s.theme].throws;
            s.throws.push({ kind: kinds[Math.floor(rnd(s) * kinds.length)], x: clamp(s.x, -0.9, 0.9), t: 1.3, t0: 1.3, r: 0.3 });
            fx(s, { t: 'throw' });
          }
        }
      }
    }

    // thrown items
    for (const th of s.throws) {
      th.t -= DT;
      if (th.t <= 0 && !th.done) {
        th.done = true;
        const hit = Math.abs(s.x - th.x) <= th.r + h * 0.8;
        fx(s, { t: 'land', x: th.x, kind: th.kind, hit });
        if (hit) { hurt(s, Math.ceil(s.n * 0.12) + 8, 'throw'); if (s.over) return; }
      }
    }
    if (s.throws.length) s.throws = s.throws.filter(t => !t.done);

    // acid
    for (const g of s.globs) {
      if (g.dead) continue;
      g.z -= 4.5 * DT;
      if (g.z - s.z <= 0.4) {
        g.dead = true;
        if (Math.abs(g.x - s.x) <= 0.1 + h) { hurt(s, 3 + Math.floor(s.lvl / 3), 'acid'); if (s.over) return; }
        else fx(s, { t: 'splat', x: g.x, z: g.z });
      }
    }
    if (s.globs.length) s.globs = s.globs.filter(g => !g.dead);

    // shooting
    const bps = (4 + s.n * 1.5) * (1 + 0.35 * s.perks.rapid);
    s.acc += bps * DT;
    const shots = Math.floor(s.acc); s.acc -= shots;
    if (shots > 0) allocate(s, targets(s, s.perks.spread ? 0.28 : 0, false), shots, s.perks.heavy ? 2 : 1, s.perks.pierce);
    for (const a of s.allies) {
      const A = ALLY[a.kind];
      a.acc += A.bps * DT;
      const n = Math.floor(a.acc); a.acc -= n;
      if (n > 0) allocate(s, targets(s, 2, true), n, A.dmg, false);
    }
  }

  // ---------- autopilot, solver, reference runs ----------
  // Holds a lane, but side-steps thrown items. Used by the solver and tests.
  function autoX(s, lane, dodge) {
    let x = lane;
    if (dodge) {
      const h = half(s.n);
      for (const th of s.throws) {
        const clear = th.r + h + 0.12;
        if (Math.abs(th.x - s.x) < clear) {
          const side = s.x === th.x ? (th.x > 0 ? -1 : 1) : Math.sign(s.x - th.x);
          x = clamp(th.x + side * clear, -0.92, 0.92);
        }
      }
    }
    return x;
  }
  function runTo(s, lane, zStop, dodge) {
    while (!s.over && s.z < zStop) step(s, { x: autoX(s, lane, dodge) });
  }
  function runOut(s, lane, dodge) {
    while (!s.over) step(s, { x: autoX(s, lane, dodge) });
  }
  const LANES = [-0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75];

  // Beam search over lane choices, one choice per row. True if some line wins.
  // Candidate lanes for a row come from what sits on it (cards, barrels, gaps).
  function lanesFor(level, z0, z1) {
    const set = new Set([0]);
    for (const o of level.objs) {
      if (o.z <= z0 || o.z > z1 + 0.6) continue;
      if (o.type === 'spikes') set.add(+o.gx.toFixed(2));
      else if (o.x != null && o.type !== 'boss') set.add(+o.x.toFixed(2));
    }
    return Array.from(set);
  }
  function solve(level, opts) {
    opts = opts || {};
    const K = opts.K || 12;
    let beam = [newState(level)];
    const score = s => (s.n * (1 + 0.35 * s.perks.rapid) * (s.perks.heavy ? 1.6 : 1) * (s.perks.spread ? 1.15 : 1) * (s.perks.pierce ? 1.15 : 1)) + s.shield + 50 * s.allies.length;
    let prev = -1;
    for (const z of level.rows) {
      const lanes = lanesFor(level, prev, z);
      prev = z;
      const kids = [];
      for (const st of beam) for (const lane of lanes) {
        const c = clone(st); runTo(c, lane, z + 0.5, true);
        c.path = (st.path || []).concat([lane]);
        if (c.over) continue;
        // look ahead: finish the level holding the centre lane
        const r = clone(c); runOut(r, 0, false);
        if (r.won) return opts.path ? { rows: c.path, final: 0, dodge: false } : true;
        kids.push({ c, sc: (1 - r.boss.hp / r.boss.max) * 1000 + score(c) * 0.01 });
      }
      if (!kids.length) return opts.path ? null : false;
      kids.sort((a, b) => b.sc - a.sc);
      beam = kids.slice(0, K).map(k => k.c);
    }
    for (const st of beam) for (const lane of [0, -0.4, 0.4]) for (const dodge of [false, true]) {
      const c = clone(st); runOut(c, lane, dodge);
      if (c.won) return opts.path ? { rows: st.path, final: lane, dodge } : true;
    }
    return opts.path ? null : false;
  }
  // Holds the centre lane the whole way, making no choices.
  function straight(level) {
    const s = newState(level);
    while (!s.over) step(s, { x: 0 });
    return s.won;
  }

  return {
    DT, V, LAT, RANGE, START_N, PERKS, THEMES, ALLY, LANES,
    genLevel, levelFor, newState, clone, step, half, hurt, autoX, solve, straight, setCal, calFor, targetK,
  };
});
