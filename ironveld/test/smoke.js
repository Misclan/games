/* Headless checks for the Ironveld rules engine. Run: node test/smoke.js */
'use strict';
const assert = require('assert');
const G = require('../src/sim.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('FAIL  ' + name + '\n      ' + (e && e.stack || e)); process.exitCode = 1; }
}
const T0 = 1700000000000;
const sec = n => n * 1000;

function nearestCamp(s) {
  return s.tiles.find(t => t.kind === 'camp' && G.dist(t.x, t.y) === 1 && t.comp === 'goblins');
}

test('map layout: base in the centre, citadel in the corner, easy camps next to base', () => {
  const s = G.newGame(T0, 7);
  assert.strictEqual(s.tiles.length, 81);
  assert.strictEqual(G.tileAt(s, 4, 4).kind, 'base');
  assert.strictEqual(G.tileAt(s, 8, 0).kind, 'citadel');
  const ring = s.tiles.filter(t => G.dist(t.x, t.y) === 1 && t.kind === 'camp');
  assert.strictEqual(ring.length, 3);
  assert.ok(ring.every(t => t.level <= 2));
  assert.ok(nearestCamp(s), 'a level 1 goblin camp is adjacent to the base');
});

test('same seed gives the same map and battle result', () => {
  const a = G.newGame(T0, 99), b = G.newGame(T0, 99);
  assert.deepStrictEqual(a.tiles, b.tiles);
  const spec = G.buildSpec(a, { units: { pike: 14 }, hero: 'brannoc', timing: 'open' }, nearestCamp(a));
  const r1 = G.runBattle(spec, 5), r2 = G.runBattle(spec, 5);
  assert.deepStrictEqual(r1, r2);
});

test('resources grow at the building rates and stop at storage cap', () => {
  const s = G.newGame(T0, 1);
  const before = s.res.food, rate = G.rates(s).food;
  G.advance(s, T0 + sec(60));
  assert.ok(Math.abs(s.res.food - (before + rate * 60)) < 0.01);
  G.advance(s, T0 + sec(60 * 600));
  assert.ok(s.res.food <= G.storageCap(s) + 1e-6);
});

test('upgrades cost resources, take time, then raise production', () => {
  const s = G.newGame(T0, 1);
  const stone0 = s.res.stone;
  const r = G.startUpgrade(s, 'farm', T0);
  assert.ok(r.ok);
  assert.strictEqual(s.res.stone, stone0 - G.upgradeCost('farm', 1).stone);
  assert.strictEqual(G.levelOf(s, 'farm'), 1);
  const ev = G.advance(s, T0 + G.upgradeTime(2) + 10);
  assert.strictEqual(G.levelOf(s, 'farm'), 2);
  assert.ok(ev.some(e => e.kind === 'upgrade'));
  assert.ok(G.rates(s).food > 1.4);
});

test('upgrade rules: two builders, no duplicates, must afford', () => {
  const s = G.newGame(T0, 1);
  s.res.food = s.res.stone = s.res.iron = 5000;
  assert.ok(G.startUpgrade(s, 'farm', T0).ok);
  assert.ok(!G.startUpgrade(s, 'farm', T0).ok);
  assert.ok(G.startUpgrade(s, 'quarry', T0).ok);
  assert.ok(!G.startUpgrade(s, 'forge', T0).ok);
  const p = G.newGame(T0, 1); p.res.stone = 0;
  assert.ok(!G.startUpgrade(p, 'farm', T0).ok);
});

test('training takes time and adds troops; locked units are refused', () => {
  const s = G.newGame(T0, 1);
  assert.ok(G.trainUnits(s, 'pike', 5, T0).ok);
  assert.strictEqual(s.units.pike, 4);
  G.advance(s, T0 + sec(11));
  assert.strictEqual(s.units.pike, 9);
  assert.ok(!G.trainUnits(s, 'rider', 1, T0).ok, 'riders need Barracks 2');
});

test('a full expedition: send, fight, return with loot and survivors', () => {
  const s = G.newGame(T0, 3);
  G.trainUnits(s, 'pike', 10, T0);
  G.advance(s, T0 + sec(30));
  assert.strictEqual(s.units.pike, 14);
  const c = nearestCamp(s);
  const food = s.res.food;
  const m = G.sendMarch(s, { x: c.x, y: c.y, units: { pike: 14 }, hero: 'brannoc', timing: 'open' }, T0 + sec(30));
  assert.ok(m.ok, m.reason);
  assert.strictEqual(s.units.pike, 0);
  const ev = G.advance(s, T0 + sec(30 + 60));
  assert.strictEqual(s.reports.length, 1);
  assert.ok(s.reports[0].win, 'level 1 camp falls to 14 pikemen and Brannoc');
  assert.ok(ev.some(e => e.kind === 'battle') && ev.some(e => e.kind === 'return'));
  assert.ok(s.units.pike > 0 && s.units.pike <= 14);
  assert.ok(s.res.food > food, 'loot added');
  assert.strictEqual(s.marches.length, 0);
  assert.ok(s.heroes.brannoc.xp > 0 || s.heroes.brannoc.level > 1);
  assert.ok(G.tileState(s, c, T0 + sec(100)) === 'cooldown', 'cleared camp rests before respawning');
});

test('march rules: capacity, availability, one march per tile, hero busy', () => {
  const s = G.newGame(T0, 3);
  s.units.pike = 100;
  const c = nearestCamp(s);
  assert.ok(!G.sendMarch(s, { x: c.x, y: c.y, units: { pike: 50 } }, T0).ok, 'over capacity');
  assert.ok(!G.sendMarch(s, { x: c.x, y: c.y, units: { pike: 200 } }, T0).ok, 'not enough troops');
  assert.ok(!G.sendMarch(s, { x: c.x, y: c.y, units: {} }, T0).ok, 'empty march');
  assert.ok(!G.sendMarch(s, { x: 4, y: 4, units: { pike: 5 } }, T0).ok, 'cannot attack your own base');
  assert.ok(G.sendMarch(s, { x: c.x, y: c.y, units: { pike: 10 }, hero: 'brannoc' }, T0).ok);
  assert.ok(!G.sendMarch(s, { x: c.x, y: c.y, units: { pike: 10 } }, T0).ok, 'same tile twice');
  const other = s.tiles.find(t => t.kind === 'node' && G.dist(t.x, t.y) === 1);
  assert.ok(!G.sendMarch(s, { x: other.x, y: other.y, units: { pike: 5 }, hero: 'brannoc' }, T0).ok, 'hero already away');
});

test('resource nodes pay out and then rest', () => {
  const s = G.newGame(T0, 3);
  s.units.pike = 5;
  const n = s.tiles.find(t => t.kind === 'node' && t.res === 'stone' && G.dist(t.x, t.y) === 1);
  const stone = s.res.stone;
  assert.ok(G.sendMarch(s, { x: n.x, y: n.y, units: { pike: 5 } }, T0).ok);
  G.advance(s, T0 + sec(30));
  assert.ok(s.res.stone > stone);
  assert.strictEqual(s.units.pike, 5);
  assert.ok(!G.sendMarch(s, { x: n.x, y: n.y, units: { pike: 5 } }, T0 + sec(31)).ok);
});

test('offline progress: 24 hours away finishes everything and caps resources', () => {
  const s = G.newGame(T0, 3);
  s.res.stone = 600;
  G.startUpgrade(s, 'quarry', T0);
  G.trainUnits(s, 'pike', 10, T0);
  const ev = G.advance(s, T0 + 24 * 3600 * 1000);
  assert.strictEqual(G.levelOf(s, 'quarry'), 2);
  assert.strictEqual(s.units.pike, 14);
  assert.ok(ev.length >= 2);
  for (const r of G.RES) assert.ok(s.res[r] <= G.storageCap(s) + 1e-6);
});

test('clock going backwards does not break anything', () => {
  const s = G.newGame(T0, 3);
  G.advance(s, T0 + sec(10));
  const f = s.res.food;
  G.advance(s, T0);
  assert.ok(s.res.food >= f - 1e-9 || s.res.food === f);
});

test('save and load round trip; bad saves are rejected', () => {
  const s = G.newGame(T0, 3);
  G.trainUnits(s, 'pike', 3, T0);
  const back = G.deserialize(G.serialize(s));
  assert.deepStrictEqual(back, s);
  assert.strictEqual(G.deserialize('not json'), null);
  assert.strictEqual(G.deserialize('{"v":99}'), null);
});

test('counters matter: pikemen beat riders, bowmen beat pikemen, bombards beat brutes', () => {
  const s = G.newGame(T0, 3);
  s.b.barracks = 3;
  function duel(a, b, na, nb) {
    const spec = { player: { squads: [{ type: a, name: a, row: 'front', count: na || 12, hp: G.UNITS[a].hp, atk: G.UNITS[a].atk }], hero: null },
      enemy: { squads: [{ type: b, name: b, icon: b, row: 'front', count: nb || 12, hp: G.TYPE_INFO[b].hp, atk: G.TYPE_INFO[b].atk }] } };
    return G.runBattle(spec, 11).winner;
  }
  assert.strictEqual(duel('pike', 'rider', 18, 12), 'player', 'a cheaper pike line holds riders');
  assert.strictEqual(duel('bow', 'pike'), 'player');
  assert.strictEqual(duel('rider', 'bow'), 'player');
  assert.strictEqual(duel('siege', 'brute'), 'player');
});

test('hero skills change outcomes and timing is respected', () => {
  const s = G.newGame(T0, 3);
  const c = { kind: 'camp', level: 3, comp: 'goblins' };
  const base = { units: { pike: 22, bow: 8 } };
  const none = G.runBattle(G.buildSpec(s, Object.assign({ hero: null }, base), c), 5);
  const open = G.runBattle(G.buildSpec(s, Object.assign({ hero: 'brannoc', timing: 'open' }, base), c), 5);
  assert.ok(open.leftPct >= none.leftPct, 'Bulwark should not make things worse');
  assert.ok(open.log.some(l => l.kind === 'skill' && l.r === 1));
  const mid = G.runBattle(G.buildSpec(s, Object.assign({ hero: 'brannoc', timing: 'mid' }, base), c), 5);
  assert.ok(mid.log.some(l => l.kind === 'skill' && l.r === 8) || mid.rounds < 8);
});

test('battle lengths feel right (not instant, never past the cap)', () => {
  const s = G.newGame(T0, 3);
  s.b.barracks = 2;
  const cases = [
    [{ level: 1, comp: 'goblins' }, { pike: 14 }],
    [{ level: 1, comp: 'wolves' }, { pike: 14 }],
    [{ level: 2, comp: 'bandits' }, { rider: 12 }],
    [{ level: 3, comp: 'golems' }, { pike: 20 }]
  ];
  for (const [camp, units] of cases) {
    const spec = G.buildSpec(s, { units: units, hero: 'brannoc', timing: 'open' }, Object.assign({ kind: 'camp' }, camp));
    const r = G.runBattle(spec, 21);
    assert.ok(r.rounds >= 8 && r.rounds <= G.MAX_ROUNDS, camp.comp + ' lasted ' + r.rounds);
  }
});

test('forecast is honest, deterministic and leaves state alone', () => {
  const s = G.newGame(T0, 3);
  s.units.pike = 14;
  const c = nearestCamp(s);
  const before = G.serialize(s);
  const f1 = G.forecast(s, { x: c.x, y: c.y, units: { pike: 14 }, hero: 'brannoc' });
  const f2 = G.forecast(s, { x: c.x, y: c.y, units: { pike: 14 }, hero: 'brannoc' });
  assert.deepStrictEqual(f1, f2);
  assert.strictEqual(G.serialize(s), before);
  assert.ok(f1.wins >= 5);
  const weak = G.forecast(s, { x: c.x, y: c.y, units: { pike: 3 } });
  assert.ok(weak.wins <= 1);
});

test('heroes: recruit rules and levelling', () => {
  const s = G.newGame(T0, 3);
  s.res.food = s.res.iron = s.res.stone = 3000;
  assert.ok(!G.recruitHero(s, 'sera').ok, 'needs Hero hall 2');
  s.b.hall = 2;
  assert.ok(G.recruitHero(s, 'sera').ok);
  assert.ok(!G.recruitHero(s, 'sera').ok, 'only once');
  assert.ok(!G.recruitHero(s, 'dag').ok, 'needs Hero hall 3');
});

test('tutorial walks forward: train, march, return, upgrade', () => {
  const s = G.newGame(T0, 3);
  assert.strictEqual(G.updateTutorial(s), 0);
  G.trainUnits(s, 'pike', 10, T0);
  G.advance(s, T0 + sec(1));
  assert.strictEqual(s.tut, 1);
  G.advance(s, T0 + sec(30));
  const c = nearestCamp(s);
  G.sendMarch(s, { x: c.x, y: c.y, units: { pike: 14 }, hero: 'brannoc' }, T0 + sec(30));
  G.advance(s, T0 + sec(31));
  assert.strictEqual(s.tut, 2);
  G.advance(s, T0 + sec(90));
  assert.strictEqual(s.tut, 3);
  G.startUpgrade(s, 'quarry', T0 + sec(90));
  G.advance(s, T0 + sec(91));
  assert.strictEqual(s.tut, 4);
});

test('a patient player can reach the citadel: maxed economy beats the boss', () => {
  const s = G.newGame(T0, 3);
  for (const id of G.BUILDING_ORDER) s.b[id] = G.MAX_LEVEL;
  s.heroes.brannoc.level = 19;
  s.units = { pike: 30, bow: 30, rider: 20, siege: 20 };
  const f = G.forecast(s, { x: 8, y: 0, units: { pike: 30, bow: 30, rider: 20, siege: 20 }, hero: 'brannoc', timing: 'open' });
  assert.ok(f.wins >= 5, 'late-game army wins: ' + JSON.stringify(f));
  const weak = G.forecast(s, { x: 8, y: 0, units: { pike: 40 }, hero: 'brannoc' });
  assert.strictEqual(weak.wins, 0, 'pikemen alone cannot take the citadel');
});

console.log('\n' + passed + ' checks passed' + (process.exitCode ? ', some failed' : ''));
