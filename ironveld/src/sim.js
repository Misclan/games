/* Ironveld rules engine.
 * Pure and deterministic: no DOM, no Date.now(), no Math.random() inside battles.
 * Works in the browser (window.Ironveld) and in Node (require).
 * All times are in milliseconds and passed in by the caller.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Ironveld = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- constants ---------- */
  const VERSION = 1;
  const MAP_SIZE = 9;
  const BASE = { x: 4, y: 4 };
  const CITADEL = { x: 8, y: 0 };
  const MAX_LEVEL = 8;
  const BUILDER_SLOTS = 2;
  const OFFLINE_CAP_MS = 8 * 3600 * 1000;
  const TRAVEL_MS_PER_TILE = 4000;
  const RESPAWN_MS = 150000;
  const NODE_COOLDOWN_MS = 120000;
  const MAX_ROUNDS = 40;
  const DMG_SCALE = 0.22;
  const RES = ['food', 'stone', 'iron'];
  const REPORT_LIMIT = 15;

  /* ---------- small helpers ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function mix(a, b) { return (Math.imul(a ^ 0x5bd1e995, 0x01000193) ^ Math.imul(b + 0x7f4a7c15, 0x85ebca6b)) >>> 0; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function dist(x, y) { return Math.max(Math.abs(x - BASE.x), Math.abs(y - BASE.y)); }
  function tidx(x, y) { return y * MAP_SIZE + x; }
  function round5(n) { return Math.max(5, Math.ceil(n / 5) * 5); }

  /* ---------- game data ---------- */
  const BUILDING_ORDER = ['farm', 'quarry', 'forge', 'barracks', 'hall', 'wall'];
  const BUILDINGS = {
    farm:     { name: 'Farmstead',    icon: 'farm',     res: 'food',  base: 1.4, per: 0.9, cost: { stone: 40 },           start: 1, blurb: 'Grows the food your troops eat.' },
    quarry:   { name: 'Quarry',       icon: 'quarry',   res: 'stone', base: 1.2, per: 0.8, cost: { food: 40 },            start: 1, blurb: 'Cuts the stone every upgrade needs.' },
    forge:    { name: 'Ironworks',    icon: 'forge',    res: 'iron',  base: 0.5, per: 0.4, cost: { stone: 60, food: 30 }, start: 1, blurb: 'Smelts iron for weapons and heroes.' },
    barracks: { name: 'Barracks',     icon: 'barracks',                                   cost: { stone: 50, iron: 20 }, start: 1, blurb: 'Trains troops faster, lets you march more of them, unlocks riders (2) and bombards (3).' },
    hall:     { name: 'Hero hall',    icon: 'hall',                                       cost: { stone: 80, iron: 40 }, start: 0, blurb: 'Raises hero level cap. Sera joins at 2, Dag at 3.' },
    wall:     { name: 'Bulwark wall', icon: 'wall',                                       cost: { stone: 70 },           start: 0, blurb: 'Every soldier you field gets +4% health per level.' }
  };

  const UNIT_ORDER = ['pike', 'bow', 'rider', 'siege'];
  const UNITS = {
    pike:  { name: 'Pikeman', plural: 'Pikemen',  icon: 'pike',  hp: 50, atk: 6,  cost: { food: 18, iron: 6 },   ms: 2000, row: 'front', needs: 1, note: 'Cheap and sturdy. Beats riders.' },
    bow:   { name: 'Bowman',  plural: 'Bowmen',   icon: 'bow',   hp: 30, atk: 9,  cost: { food: 16, iron: 10 },  ms: 2500, row: 'back',  needs: 1, note: 'Shoots over the front line. Beats pikemen.' },
    rider: { name: 'Rider',   plural: 'Riders',   icon: 'rider', hp: 70, atk: 10, cost: { food: 30, iron: 16 },  ms: 4000, row: 'front', needs: 2, note: 'Fast and hard-hitting. Beats bowmen.' },
    siege: { name: 'Bombard', plural: 'Bombards', icon: 'siege', hp: 95, atk: 16, cost: { stone: 50, iron: 30 }, ms: 8000, row: 'back',  needs: 3, note: 'Long range. Beats brutes.' }
  };
  const ENEMY_ONLY = { brute: { name: 'Brute', icon: 'brute', hp: 120, atk: 12 } };
  const TYPE_INFO = { pike: UNITS.pike, bow: UNITS.bow, rider: UNITS.rider, siege: UNITS.siege, brute: ENEMY_ONLY.brute };
  const RANGED = { bow: true, siege: true };
  const ADV = { pike: { rider: 1.5 }, rider: { bow: 1.5 }, bow: { pike: 1.5 }, siege: { brute: 1.5 }, brute: { pike: 1.5 } };
  function adv(a, b) { return (ADV[a] && ADV[a][b]) || 1; }

  const HEROES = {
    brannoc: { name: 'Brannoc Ironhand', title: 'Shieldwarden', hall: 0, cost: null,
      hp: 0.03, atk: 0, skill: { id: 'bulwark', name: 'Bulwark', text: 'Your troops take 35% less damage for 6 rounds.' } },
    sera: { name: 'Sera Quickfletch', title: 'Volley captain', hall: 2, cost: { food: 150, iron: 120 },
      hp: 0, atk: 0.025, skill: { id: 'volley', name: 'Volley', text: 'Every enemy squad loses 10% of its health (+1% per hero level).' } },
    dag: { name: 'Dag Emberforge', title: 'Rally smith', hall: 3, cost: { stone: 200, iron: 200 },
      hp: 0.015, atk: 0.02, skill: { id: 'rally', name: 'Rally', text: 'Your troops deal 40% more damage for 6 rounds.' } }
  };
  const HERO_ORDER = ['brannoc', 'sera', 'dag'];
  const TIMINGS = {
    open: 'At the start',
    mid:  'Mid-fight (round 8)',
    hurt: 'When your army is hurt'
  };

  const COMPS = {
    goblins: { name: 'Goblin camp',   parts: [['pike', 'Scrap Goblins', 0.6, 'front'], ['bow', 'Goblin Slingers', 0.4, 'back']] },
    wolves:  { name: 'Wolf den',      parts: [['rider', 'Dire Wolves', 0.7, 'front'], ['pike', 'Wolf Handlers', 0.3, 'back']] },
    bandits: { name: 'Bandit hideout', parts: [['bow', 'Bandit Archers', 0.6, 'back'], ['pike', 'Bandit Thugs', 0.4, 'front']] },
    golems:  { name: 'Cinder pit',    parts: [['brute', 'Cinder Golems', 0.6, 'front'], ['bow', 'Ember Wisps', 0.4, 'back']] },
    warband: { name: 'Warband camp',  parts: [['pike', 'Warband Spears', 0.3, 'front'], ['rider', 'Warband Riders', 0.3, 'front'], ['bow', 'Warband Bows', 0.3, 'back'], ['brute', 'Slag Brutes', 0.1, 'front']] },
    citadel: { name: 'Ironlord Citadel', parts: [['brute', 'Slag Brutes', 0.3, 'front'], ['pike', 'Citadel Guard', 0.2, 'front'], ['rider', 'Citadel Lancers', 0.15, 'front'], ['bow', 'Citadel Archers', 0.2, 'back'], ['siege', 'Citadel Bombards', 0.15, 'back']] }
  };
  const NODE_NAMES = { food: 'Orchard', stone: 'Stone seam', iron: 'Iron vein' };

  /* ---------- derived numbers ---------- */
  function upgradeCost(id, curLevel) {
    const out = {};
    const f = Math.pow(1.7, curLevel);
    for (const r of Object.keys(BUILDINGS[id].cost)) out[r] = round5(BUILDINGS[id].cost[r] * f);
    return out;
  }
  function upgradeTime(target) { return Math.round(4000 * Math.pow(1.6, target - 1)); }
  function levelOf(s, id) { return s.b[id] || 0; }
  function sumLevels(s) { let n = 0; for (const id of BUILDING_ORDER) n += levelOf(s, id); return n; }
  function storageCap(s) { return 300 + 120 * sumLevels(s); }
  function rateFor(id, lvl) { const b = BUILDINGS[id]; return lvl > 0 ? b.base + b.per * (lvl - 1) : 0; }
  function rates(s) {
    const r = { food: 0, stone: 0, iron: 0 };
    for (const id of BUILDING_ORDER) { const b = BUILDINGS[id]; if (b.res) r[b.res] += rateFor(id, levelOf(s, id)); }
    return r;
  }
  function marchCapacity(s) { return 20 + 10 * levelOf(s, 'barracks'); }
  function trainFactor(s) { return Math.pow(0.92, Math.max(0, levelOf(s, 'barracks') - 1)); }
  function wallBonus(s) { return 0.04 * levelOf(s, 'wall'); }
  function heroCap(s) { return 3 + 2 * levelOf(s, 'hall'); }
  function xpNeed(level) { return 40 * level; }
  function heroBonus(id, level) { return { hp: HEROES[id].hp * level, atk: HEROES[id].atk * level }; }
  function describeLevel(id, lvl) {
    if (lvl <= 0) return 'Not built';
    if (BUILDINGS[id].res) return '+' + rateFor(id, lvl).toFixed(1) + ' ' + BUILDINGS[id].res + ' per second';
    if (id === 'barracks') return 'March up to ' + (20 + 10 * lvl) + ' troops' + (lvl > 1 ? ', training ' + Math.round((1 - Math.pow(0.92, lvl - 1)) * 100) + '% faster' : '');
    if (id === 'hall') return 'Heroes can reach level ' + (3 + 2 * lvl);
    if (id === 'wall') return '+' + (4 * lvl) + '% health for your troops';
    return '';
  }
  function canAfford(s, cost) { for (const r of Object.keys(cost)) if ((s.res[r] || 0) < cost[r]) return false; return true; }
  function pay(s, cost) { for (const r of Object.keys(cost)) s.res[r] -= cost[r]; }
  function addRes(s, loot) {
    const cap = storageCap(s);
    for (const r of RES) if (loot[r]) s.res[r] = Math.max(s.res[r], Math.min(cap, s.res[r] + loot[r]));
  }
  function unitTotal(u) { let n = 0; for (const k of UNIT_ORDER) n += u[k] || 0; return n; }
  function heroBusy(s, id) { return s.marches.some(m => m.hero === id); }
  function tileAt(s, x, y) { return s.tiles[tidx(x, y)]; }
  function campLoot(level, mult) {
    const m = mult || 1;
    return { food: Math.round((40 + 26 * level) * m), stone: Math.round((30 + 20 * level) * m), iron: Math.round((15 + 12 * level) * m) };
  }
  function nodeLoot(tile, units) {
    const amt = Math.round((50 + 35 * tile.level) * (1 + 0.03 * units));
    const l = { food: 0, stone: 0, iron: 0 };
    l[tile.res] = amt;
    return l;
  }

  /* ---------- enemy armies ---------- */
  function campArmy(level, key) {
    const comp = COMPS[key];
    const total = (5 + 4.2 * Math.pow(level, 1.3)) * (key === 'citadel' ? 1.8 : 1);
    const mul = 1 + 0.03 * (level - 1);
    return comp.parts.map(function (p) {
      const type = p[0], u = TYPE_INFO[type];
      const w = (u.hp * u.atk) / 300;
      return {
        type: type, name: p[1], icon: u.icon, row: p[3],
        count: Math.max(1, Math.round(total * p[2] / w)),
        hp: Math.round(u.hp * mul), atk: Math.round(u.atk * mul * 100) / 100
      };
    });
  }

  /* ---------- battle ---------- */
  function runBattle(spec, seed) {
    const rng = mulberry32(seed >>> 0);
    const sq = [];
    function add(side, q) {
      sq.push({ i: sq.length, side: side, type: q.type, name: q.name, icon: q.icon || TYPE_INFO[q.type].icon, row: q.row,
        count0: q.count, count: q.count, hp: q.hp, atk: q.atk, pool: q.count * q.hp, max: q.count * q.hp });
    }
    spec.player.squads.forEach(q => add('p', q));
    spec.enemy.squads.forEach(q => add('e', q));
    const hero = spec.player.hero || null;
    const buff = { p: { takenUntil: 0, atkUntil: 0 }, e: { takenUntil: 0, atkUntil: 0 } };
    const log = [];
    const frames = [];
    let skillUsed = false;

    function alive(side) { return sq.filter(q => q.side === side && q.count > 0); }
    function frameOf(r, hits) { return { r: r, c: sq.map(q => q.count), h: sq.map(q => q.max ? Math.round(100 * Math.max(0, q.pool) / q.max) : 0), hits: hits || [] }; }
    function poolFrac(side) { let p = 0, m = 0; for (const q of sq) if (q.side === side) { p += Math.max(0, q.pool); m += q.max; } return m ? p / m : 0; }
    function pick(att) {
      const foes = alive(att.side === 'p' ? 'e' : 'p');
      if (!foes.length) return null;
      let cands = foes;
      if (!RANGED[att.type]) { const front = foes.filter(f => f.row === 'front'); if (front.length) cands = front; }
      let best = null, bestA = -1;
      for (const c of cands) {
        const a = adv(att.type, c.type);
        if (a > bestA || (a === bestA && c.pool < best.pool)) { best = c; bestA = a; }
      }
      return best;
    }
    function fireSkill(r) {
      skillUsed = true;
      const sk = HEROES[hero.id].skill;
      if (sk.id === 'bulwark') buff.p.takenUntil = r + 5;
      if (sk.id === 'rally') buff.p.atkUntil = r + 5;
      if (sk.id === 'volley') {
        const f = 0.10 + 0.01 * hero.level;
        for (const q of alive('e')) q.pool -= q.max * f;
        recount(r);
      }
      log.push({ r: r, kind: 'skill', text: HEROES[hero.id].name + ' uses ' + sk.name + '.' });
    }
    function recount(r) {
      for (const q of sq) {
        if (q.count <= 0) continue;
        q.count = q.pool <= 0.0001 ? 0 : Math.ceil(q.pool / q.hp - 1e-9);
        if (q.count === 0) { q.pool = 0; log.push({ r: r, kind: q.side === 'p' ? 'loss' : 'kill', text: q.name + (q.side === 'p' ? ' are wiped out.' : ' are routed.') }); }
      }
    }

    frames.push(frameOf(0));
    let rounds = 0;
    for (let r = 1; r <= MAX_ROUNDS; r++) {
      rounds = r;
      if (hero && !skillUsed) {
        if (hero.timing === 'open' && r === 1) fireSkill(r);
        else if (hero.timing === 'mid' && r === 8) fireSkill(r);
        else if (hero.timing === 'hurt' && r >= 2 && poolFrac('p') < 0.5) fireSkill(r);
      }
      const dmgs = [];
      for (const s of sq) {
        if (s.count <= 0) continue;
        const t = pick(s);
        if (!t) continue;
        let d = s.count * s.atk * DMG_SCALE * adv(s.type, t.type) * (0.9 + 0.2 * rng());
        if (buff[s.side].atkUntil >= r) d *= 1.4;
        dmgs.push([s, t, d]);
      }
      const hits = [];
      for (const e of dmgs) {
        const s = e[0], t = e[1];
        let d = e[2];
        if (buff[t.side].takenUntil >= r) d *= 0.65;
        t.pool -= d;
        hits.push([s.i, t.i]);
      }
      recount(r);
      frames.push(frameOf(r, hits));
      if (!alive('p').length || !alive('e').length) break;
    }

    const pAlive = alive('p').length > 0, eAlive = alive('e').length > 0;
    let winner;
    if (pAlive && !eAlive) winner = 'player';
    else if (!pAlive && eAlive) winner = 'enemy';
    else { const a = poolFrac('p'), b = poolFrac('e'); winner = a > b ? 'player' : (b > a ? 'enemy' : 'draw'); }

    const survivors = {};
    for (const q of sq) if (q.side === 'p') survivors[q.type] = (survivors[q.type] || 0) + q.count;
    return {
      winner: winner, rounds: rounds, frames: frames, log: log, survivors: survivors,
      leftPct: Math.round(100 * poolFrac('p')), enemyLeftPct: Math.round(100 * poolFrac('e')),
      squads: sq.map(q => ({ side: q.side, type: q.type, name: q.name, icon: q.icon, row: q.row, count0: q.count0 }))
    };
  }

  /* ---------- game state ---------- */
  function genTiles(seed) {
    const rng = mulberry32(mix(seed, 0x1234));
    const tiles = [];
    for (let y = 0; y < MAP_SIZE; y++) for (let x = 0; x < MAP_SIZE; x++)
      tiles.push({ x: x, y: y, kind: 'empty', level: 0, comp: null, res: null, readyAt: 0, terrain: Math.floor(rng() * 4) });
    tiles[tidx(BASE.x, BASE.y)].kind = 'base';
    const ring1 = tiles.filter(t => dist(t.x, t.y) === 1);
    for (let i = ring1.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const tmp = ring1[i]; ring1[i] = ring1[j]; ring1[j] = tmp; }
    const first = [['goblins', 1], ['wolves', 1], ['bandits', 2]];
    first.forEach(function (c, i) { ring1[i].kind = 'camp'; ring1[i].comp = c[0]; ring1[i].level = c[1]; });
    ring1[3].kind = 'node'; ring1[3].res = 'food'; ring1[3].level = 1;
    ring1[4].kind = 'node'; ring1[4].res = 'stone'; ring1[4].level = 1;
    for (const t of tiles) {
      const d = dist(t.x, t.y);
      if (d < 2) continue;
      const r = rng();
      if (r < 0.22) {
        t.kind = 'camp';
        t.level = Math.min(9, 2 * d - 1 + (rng() < 0.5 ? 0 : 1));
        const pool = d === 2 ? ['goblins', 'wolves', 'bandits', 'golems'] : ['wolves', 'bandits', 'golems', 'warband'];
        t.comp = pool[Math.floor(rng() * pool.length)];
      } else if (r < 0.34) {
        t.kind = 'node'; t.level = d; t.res = RES[Math.floor(rng() * 3)];
      }
    }
    const c = tiles[tidx(CITADEL.x, CITADEL.y)];
    c.kind = 'citadel'; c.level = 10; c.comp = 'citadel'; c.res = null;
    return tiles;
  }

  function newGame(now, seed) {
    if (seed === undefined || seed === null) seed = (Math.random() * 2147483647) | 0;
    const s = {
      v: VERSION, seed: seed, t: now, started: now,
      res: { food: 260, stone: 180, iron: 100 },
      b: {}, queue: [], training: [],
      units: { pike: 4, bow: 0, rider: 0, siege: 0 },
      heroes: { brannoc: { level: 1, xp: 0 } },
      tiles: genTiles(seed), marches: [], reports: [], nextId: 1,
      tut: 0, won: false,
      stats: { wins: 0, losses: 0, lost: 0, killed: 0 },
      prefs: { speed: 1 }
    };
    for (const id of BUILDING_ORDER) s.b[id] = BUILDINGS[id].start;
    return s;
  }

  function serialize(s) { return JSON.stringify(s); }
  function deserialize(str) {
    let s;
    try { s = JSON.parse(str); } catch (e) { return null; }
    if (!s || s.v !== VERSION || !s.res || !s.b || !s.tiles || s.tiles.length !== MAP_SIZE * MAP_SIZE) return null;
    return s;
  }

  /* ---------- actions ---------- */
  function startUpgrade(s, id, now) {
    const b = BUILDINGS[id];
    if (!b) return { ok: false, reason: 'Unknown building.' };
    const lvl = levelOf(s, id);
    if (lvl >= MAX_LEVEL) return { ok: false, reason: 'Already at the highest level.' };
    if (s.queue.some(q => q.id === id)) return { ok: false, reason: 'Already upgrading.' };
    if (s.queue.length >= BUILDER_SLOTS) return { ok: false, reason: 'Both builders are busy.' };
    const cost = upgradeCost(id, lvl);
    if (!canAfford(s, cost)) return { ok: false, reason: 'Not enough resources.' };
    pay(s, cost);
    s.queue.push({ id: id, to: lvl + 1, start: now, finish: now + upgradeTime(lvl + 1) });
    return { ok: true };
  }

  function trainUnits(s, unit, count, now) {
    const u = UNITS[unit];
    count = Math.floor(count);
    if (!u || !(count >= 1)) return { ok: false, reason: 'Pick a number of troops.' };
    if (levelOf(s, 'barracks') < u.needs) return { ok: false, reason: 'Needs Barracks level ' + u.needs + '.' };
    if (s.training.length >= 6) return { ok: false, reason: 'The training queue is full.' };
    const cost = {};
    for (const r of Object.keys(u.cost)) cost[r] = u.cost[r] * count;
    if (!canAfford(s, cost)) return { ok: false, reason: 'Not enough resources.' };
    pay(s, cost);
    let start = now;
    for (const t of s.training) start = Math.max(start, t.finish);
    s.training.push({ unit: unit, count: count, start: start, finish: start + Math.round(count * u.ms * trainFactor(s)) });
    return { ok: true };
  }

  function recruitHero(s, id) {
    const h = HEROES[id];
    if (!h || !h.cost) return { ok: false, reason: 'Cannot recruit.' };
    if (s.heroes[id]) return { ok: false, reason: 'Already recruited.' };
    if (levelOf(s, 'hall') < h.hall) return { ok: false, reason: 'Needs Hero hall level ' + h.hall + '.' };
    if (!canAfford(s, h.cost)) return { ok: false, reason: 'Not enough resources.' };
    pay(s, h.cost);
    s.heroes[id] = { level: 1, xp: 0 };
    return { ok: true };
  }

  function tileState(s, t, now) {
    if (t.kind === 'empty' || t.kind === 'base') return 'none';
    if (s.marches.some(m => m.phase === 'out' && m.x === t.x && m.y === t.y)) return 'targeted';
    if (now < t.readyAt) return 'cooldown';
    return 'ready';
  }

  function buildSpec(s, p, tile) {
    const w = wallBonus(s);
    const hero = p.hero && s.heroes[p.hero] ? { id: p.hero, level: s.heroes[p.hero].level, timing: p.timing || 'open' } : null;
    const hb = hero ? heroBonus(hero.id, hero.level) : { hp: 0, atk: 0 };
    const squads = [];
    for (const k of UNIT_ORDER) {
      const n = (p.units && p.units[k]) || 0;
      if (n > 0) squads.push({
        type: k, name: UNITS[k].name, icon: UNITS[k].icon,
        row: (p.rows && p.rows[k]) || UNITS[k].row, count: n,
        hp: UNITS[k].hp * (1 + w + hb.hp), atk: UNITS[k].atk * (1 + hb.atk)
      });
    }
    return { player: { squads: squads, hero: hero }, enemy: { squads: campArmy(tile.level, tile.comp) } };
  }

  function checkMarch(s, p, now) {
    const tile = (p.x >= 0 && p.x < MAP_SIZE && p.y >= 0 && p.y < MAP_SIZE) ? tileAt(s, p.x, p.y) : null;
    if (!tile || (tile.kind !== 'camp' && tile.kind !== 'node' && tile.kind !== 'citadel')) return { ok: false, reason: 'Nothing to attack there.' };
    const st = tileState(s, tile, now);
    if (st === 'targeted') return { ok: false, reason: 'Troops are already on their way there.' };
    if (st === 'cooldown') return { ok: false, reason: 'Nothing left there for now.' };
    let total = 0;
    for (const k of UNIT_ORDER) {
      const n = (p.units && p.units[k]) || 0;
      if (n < 0 || n !== Math.floor(n)) return { ok: false, reason: 'Invalid troop count.' };
      if (n > (s.units[k] || 0)) return { ok: false, reason: 'You do not have that many ' + UNITS[k].plural.toLowerCase() + '.' };
      total += n;
    }
    if (total < 1) return { ok: false, reason: 'Pick at least one soldier.' };
    if (total > marchCapacity(s)) return { ok: false, reason: 'Your Barracks only lets you march ' + marchCapacity(s) + ' troops.' };
    if (p.hero) {
      if (!s.heroes[p.hero]) return { ok: false, reason: 'That hero has not joined you.' };
      if (heroBusy(s, p.hero)) return { ok: false, reason: 'That hero is already out on a march.' };
    }
    return { ok: true, tile: tile };
  }

  function sendMarch(s, p, now) {
    const chk = checkMarch(s, p, now);
    if (!chk.ok) return chk;
    const units = {};
    for (const k of UNIT_ORDER) { const n = (p.units && p.units[k]) || 0; if (n > 0) { units[k] = n; s.units[k] -= n; } }
    const travel = dist(p.x, p.y) * TRAVEL_MS_PER_TILE;
    const id = s.nextId++;
    const m = {
      id: id, x: p.x, y: p.y, units: units, rows: Object.assign({}, p.rows || {}), hero: p.hero || null, timing: p.timing || 'open',
      depart: now, arrive: now + travel, phase: 'out', ret: null, loot: null, seed: mix(s.seed, id)
    };
    s.marches.push(m);
    return { ok: true, march: m };
  }

  /* Scouts' forecast: runs the real battle with fixed seeds, never touches state. */
  function forecast(s, p) {
    const tile = tileAt(s, p.x, p.y);
    if (!tile || !tile.comp) return null;
    const spec = buildSpec(s, p, tile);
    if (!spec.player.squads.length) return null;
    let wins = 0, left = 0, rounds = 0;
    const N = 7;
    for (let i = 1; i <= N; i++) {
      const r = runBattle(spec, 1000 + i * 7919);
      if (r.winner === 'player') { wins++; left += r.leftPct; }
      rounds += r.rounds;
    }
    const verdict = wins === N ? (left / wins >= 55 ? 'Easy win' : 'Likely win') : wins >= N - 2 ? 'Risky' : wins >= 1 ? 'Unlikely' : 'Hopeless';
    return { wins: wins, of: N, avgLeft: wins ? Math.round(left / wins) : 0, avgRounds: Math.round(rounds / N), verdict: verdict };
  }

  /* ---------- time ---------- */
  function nextEvent(s, now) {
    let best = null;
    function consider(time, kind, ref) { if (time <= now && (!best || time < best.time)) best = { time: time, kind: kind, ref: ref }; }
    s.queue.forEach(q => consider(q.finish, 'upgrade', q));
    s.training.forEach(q => consider(q.finish, 'train', q));
    s.marches.forEach(m => consider(m.phase === 'out' ? m.arrive : m.ret, m.phase === 'out' ? 'arrive' : 'return', m));
    return best;
  }

  function levelUpHero(s, id) {
    const h = s.heroes[id];
    while (h.level < heroCap(s) && h.xp >= xpNeed(h.level)) { h.xp -= xpNeed(h.level); h.level++; }
  }

  function resolveArrival(s, m, out) {
    const tile = tileAt(s, m.x, m.y);
    const travel = dist(m.x, m.y) * TRAVEL_MS_PER_TILE;
    const n = unitTotal(m.units);
    if (tile.kind === 'node') {
      m.loot = nodeLoot(tile, n);
      tile.readyAt = m.arrive + NODE_COOLDOWN_MS;
      m.phase = 'back'; m.ret = m.arrive + travel;
      out.push({ t: m.arrive, kind: 'node', text: 'Your troops reached the ' + NODE_NAMES[tile.res].toLowerCase() + '.' });
      return;
    }
    const spec = buildSpec(s, m, tile);
    const res = runBattle(spec, m.seed);
    const win = res.winner === 'player';
    const lost = {};
    let lostN = 0;
    for (const k of UNIT_ORDER) { const d = (m.units[k] || 0) - (res.survivors[k] || 0); if (d > 0) { lost[k] = d; lostN += d; } }
    let killed = 0;
    res.squads.forEach(function (q, i) { if (q.side === 'e') killed += q.count0 - res.frames[res.frames.length - 1].c[i]; });
    const loot = win ? campLoot(tile.level, tile.kind === 'citadel' ? 3 : 1) : null;
    let heroXp = 0;
    if (m.hero && s.heroes[m.hero]) {
      heroXp = win ? 12 + 8 * tile.level : 4;
      s.heroes[m.hero].xp += heroXp;
      levelUpHero(s, m.hero);
    }
    const rid = s.nextId++;
    const report = {
      id: rid, time: m.arrive, x: m.x, y: m.y,
      name: tile.kind === 'citadel' ? COMPS.citadel.name : COMPS[tile.comp].name, level: tile.level,
      win: win, result: res.winner, rounds: res.rounds, frames: res.frames, log: res.log, squads: res.squads,
      loot: loot, lost: lost, heroXp: heroXp, hero: m.hero, timing: m.timing, seen: false
    };
    s.reports.unshift(report);
    if (s.reports.length > REPORT_LIMIT) s.reports.length = REPORT_LIMIT;
    s.stats.killed += killed; s.stats.lost += lostN;
    if (win) {
      s.stats.wins++;
      tile.readyAt = m.arrive + (tile.kind === 'citadel' ? 600000 : RESPAWN_MS);
      if (tile.kind === 'citadel' && !s.won) { s.won = true; out.push({ t: m.arrive, kind: 'victory', text: 'The Ironlord Citadel has fallen.' }); }
    } else s.stats.losses++;
    const survN = unitTotal(res.survivors);
    out.push({ t: m.arrive, kind: 'battle', report: rid, win: win, text: (win ? 'Victory at the ' : 'Defeat at the ') + report.name.toLowerCase() + '.' });
    if (survN > 0) { m.units = res.survivors; m.loot = loot; m.phase = 'back'; m.ret = m.arrive + travel; m.reportId = rid; }
    else s.marches = s.marches.filter(x => x !== m);
  }

  function advance(s, now) {
    const out = [];
    if (now < s.t) { s.t = now; return out; }
    const floor = Math.max(s.t, now - OFFLINE_CAP_MS);
    let cursor = s.t;
    function integrate(to) {
      const from = Math.max(cursor, floor);
      if (to > from) {
        const dt = (to - from) / 1000, r = rates(s), cap = storageCap(s);
        for (const k of RES) if (s.res[k] < cap) s.res[k] = Math.min(cap, s.res[k] + r[k] * dt);
      }
      cursor = Math.max(cursor, to);
    }
    for (let guard = 0; guard < 5000; guard++) {
      const ev = nextEvent(s, now);
      if (!ev) break;
      integrate(ev.time);
      if (ev.kind === 'upgrade') {
        s.queue = s.queue.filter(q => q !== ev.ref);
        s.b[ev.ref.id] = ev.ref.to;
        out.push({ t: ev.time, kind: 'upgrade', text: BUILDINGS[ev.ref.id].name + ' is now level ' + ev.ref.to + '.' });
      } else if (ev.kind === 'train') {
        s.training = s.training.filter(q => q !== ev.ref);
        s.units[ev.ref.unit] = (s.units[ev.ref.unit] || 0) + ev.ref.count;
        out.push({ t: ev.time, kind: 'train', text: ev.ref.count + ' ' + (ev.ref.count === 1 ? UNITS[ev.ref.unit].name : UNITS[ev.ref.unit].plural).toLowerCase() + ' finished training.' });
      } else if (ev.kind === 'arrive') {
        resolveArrival(s, ev.ref, out);
      } else if (ev.kind === 'return') {
        const m = ev.ref;
        for (const k of UNIT_ORDER) s.units[k] = (s.units[k] || 0) + (m.units[k] || 0);
        if (m.loot) addRes(s, m.loot);
        s.marches = s.marches.filter(x => x !== m);
        out.push({ t: ev.time, kind: 'return', text: 'Your troops are home' + (m.loot ? ' with loot.' : '.'), loot: m.loot });
      }
    }
    integrate(now);
    s.t = now;
    updateTutorial(s);
    return out;
  }

  /* Tutorial advances in order and never goes back. */
  function updateTutorial(s) {
    let pikes = s.units.pike || 0;
    s.training.forEach(t => { if (t.unit === 'pike') pikes += t.count; });
    s.marches.forEach(m => { pikes += m.units.pike || 0; });
    if (s.tut === 0 && pikes >= 10) s.tut = 1;
    if (s.tut === 1 && (s.marches.length > 0 || s.reports.length > 0)) s.tut = 2;
    if (s.tut === 2 && s.stats.wins + s.stats.losses >= 1 && s.marches.length === 0) s.tut = 3;
    if (s.tut === 3 && (s.queue.length > 0 || sumLevels(s) > BUILDING_ORDER.reduce((n, id) => n + BUILDINGS[id].start, 0))) s.tut = 4;
    return s.tut;
  }

  return {
    VERSION, MAP_SIZE, BASE, CITADEL, MAX_LEVEL, BUILDER_SLOTS, OFFLINE_CAP_MS, TRAVEL_MS_PER_TILE, RESPAWN_MS, NODE_COOLDOWN_MS, MAX_ROUNDS, DMG_SCALE, RES,
    BUILDINGS, BUILDING_ORDER, UNITS, UNIT_ORDER, TYPE_INFO, HEROES, HERO_ORDER, TIMINGS, COMPS, NODE_NAMES, ADV, RANGED,
    newGame, serialize, deserialize, advance, startUpgrade, trainUnits, recruitHero, sendMarch, checkMarch, forecast, buildSpec, runBattle, campArmy,
    upgradeCost, upgradeTime, levelOf, sumLevels, storageCap, rates, rateFor, marchCapacity, trainFactor, wallBonus, heroCap, xpNeed, heroBonus, describeLevel,
    canAfford, unitTotal, heroBusy, tileAt, tileState, dist, campLoot, nodeLoot, updateTutorial, clone, adv
  };
});
