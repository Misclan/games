/* Headless checks for the Rampart Run rules engine. Run: node test/smoke.js */
'use strict';
const assert = require('assert');
const R = require('../src/sim.js');
require('../src/cal.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('FAIL  ' + name + '\n      ' + (e && e.stack || e)); process.exitCode = 1; }
}
// A tiny hand-built level, so single rules can be checked in isolation.
function mini(objs, lvl) {
  objs.forEach((o, i) => { o.id = i; });
  objs.sort((a, b) => a.z - b.z);
  const s = R.newState({ lvl: lvl || 1, theme: 'bridge', objs });
  return s;
}
function run(s, x, secs) { for (let i = 0; i < secs * 30 && !s.over; i++) R.step(s, { x }); }
const boss = z => ({ type: 'boss', z, x: 0, w: 0.55, hp: 100000, max: 100000, strikeT: 0.5, thrT: 3 });

test('multiplier card multiplies the soldiers you have, once', () => {
  const s = mini([{ type: 'card', z: 10, x: -0.5, w: 0.5, op: 'x', v: 4 }, { type: 'card', z: 10, x: 0.5, w: 0.5, op: '/', v: 2 }, boss(900)]);
  run(s, -0.5, 4);
  assert.strictEqual(s.n, 40);
});
test('straddling the middle only takes one card of a pair', () => {
  const s = mini([{ type: 'card', z: 10, x: -0.5, w: 0.5, op: 'x', v: 3 }, { type: 'card', z: 10, x: 0.5, w: 0.5, op: 'x', v: 3 }, boss(900)]);
  run(s, 0, 4);
  assert.strictEqual(s.n, 30);
});
test('divide and minus cards shrink the squad but never below 1', () => {
  const s = mini([{ type: 'card', z: 10, x: 0, w: 1, op: '/', v: 3 }, { type: 'card', z: 20, x: 0, w: 1, op: '-', v: 99 }, boss(900)]);
  run(s, 0, 6);
  assert.strictEqual(s.n, 1);
});
test('recruits add soldiers and are separate from multipliers', () => {
  const s = mini([{ type: 'recruit', z: 10, x: 0, w: 0.4, n: 25 }, boss(900)]);
  run(s, 0, 3);
  assert.strictEqual(s.n, 35);
});
test('bullets break a barrel after exactly its count and the perk applies', () => {
  const s = mini([{ type: 'barrel', z: 12, x: 0, w: 0.3, hp: 30, max: 30, perk: 'rapid' }, boss(900)]);
  run(s, 0, 3);
  assert.strictEqual(s.perks.rapid, 1);
});
test('an unopened barrel just rolls past', () => {
  const s = mini([{ type: 'barrel', z: 12, x: 0.8, w: 0.3, hp: 30, max: 30, perk: 'heavy' }, boss(900)]);
  run(s, -0.8, 4);
  assert.strictEqual(s.perks.heavy, 0);
});
test('bullets hurt zombies; survivors that reach you take soldiers with them', () => {
  const s = mini([{ type: 'wave', z: 30, x: 0, w: 0.4, n: 500, hp: 500, max: 500, spit: false, spitT: 9 }, boss(900)]);
  run(s, 0, 20);
  assert.ok(s.over && !s.won);
});
test('a small wave dies before contact and costs nothing', () => {
  const s = mini([{ type: 'wave', z: 30, x: 0, w: 0.3, n: 8, hp: 8, max: 8, spit: false, spitT: 9 }, boss(900)]);
  run(s, 0, 6);
  assert.strictEqual(s.n, 10);
  assert.ok(s.objs.find(o => o.type === 'wave').dead);
});
test('spikes cost a quarter of the squad unless you take the gap', () => {
  const mk = () => mini([{ type: 'spikes', z: 10, gx: 0.6, gw: 0.3 }, boss(900)]);
  const a = mk(); run(a, -0.6, 3); assert.strictEqual(a.n, 7);
  const b = mk(); run(b, 0.6, 3); assert.strictEqual(b.n, 10);
});
test('shield absorbs losses before soldiers', () => {
  const s = mini([boss(900)]);
  s.shield = 6; R.hurt(s, 4); assert.strictEqual(s.n, 10);
  R.hurt(s, 4); assert.strictEqual(s.n, 8);
});
test('acid globs are shot down by the squad', () => {
  const s = mini([boss(900)]);
  s.globs.push({ type: 'glob', x: 0, z: 8, hp: 2, max: 2, w: 0.14, id: 'g' });
  run(s, 0, 1);
  assert.strictEqual(s.n, 10);
});
test('an acid glob that is not shot or dodged kills soldiers', () => {
  const s = mini([boss(900)]);
  s.globs.push({ type: 'glob', x: 0.9, z: 1.2, hp: 50, max: 50, w: 0.14, id: 'g' });
  s.x = 0.9; run(s, 0.9, 1);
  assert.ok(s.n < 10);
});
test('breaking a crate unlocks an ally that can take damage', () => {
  const s = mini([{ type: 'crate', z: 14, x: 0, w: 0.45, hp: 20, max: 20, ally: 'turret' }, boss(900)]);
  run(s, 0, 3);
  assert.strictEqual(s.allies.length, 1);
  R.hurt(s, 100);
  assert.ok(s.allies.length === 0 || s.allies[0].hp < 120);
});
test('boss crit: a squad of 150 is gone in 2-3 strikes, and only when it reaches you', () => {
  const b = boss(20); b.hp = b.max = 1e9;
  const s = mini([b]);
  s.n = 150; s.x = 0;
  run(s, 0, 8);
  assert.ok(s.over && !s.won, 'squad should be dead');
  assert.ok(s.t < 8);
  const far = mini([boss(200)]);
  far.n = 150; run(far, 0, 1.5);
  assert.strictEqual(far.n, 150);
});
test('killing the boss wins', () => {
  const b = boss(30); b.hp = b.max = 20;
  const s = mini([b]); s.n = 40; run(s, 0, 10);
  assert.ok(s.won);
});
test('thrown items land on a lane and can be dodged', () => {
  const mk = () => { const b = boss(24); b.hp = b.max = 1e9; b.thrT = 0.1; const s = mini([b]); s.n = 400; return s; };
  const stay = mk(); run(stay, 0, 3.2);
  assert.ok(stay.n < 400, 'item should hit');
  const dodge = mk();
  for (let i = 0; i < 96; i++) R.step(dodge, { x: R.autoX(dodge, 0, true) });
  assert.strictEqual(dodge.lost, 0);
});
test('same level number gives the same level and the same run', () => {
  const a = R.genLevel(7), b = R.genLevel(7);
  assert.deepStrictEqual(a, b);
  const s1 = R.newState(a), s2 = R.newState(b);
  while (!s1.over) R.step(s1, { x: 0.3 });
  while (!s2.over) R.step(s2, { x: 0.3 });
  assert.deepStrictEqual([s1.n, s1.t, s1.won], [s2.n, s2.t, s2.won]);
});
test('both themes appear and levels end in a boss', () => {
  const themes = new Set();
  for (let l = 1; l <= 6; l++) {
    const L = R.genLevel(l); themes.add(L.theme);
    assert.strictEqual(L.objs.filter(o => o.type === 'boss').length, 1);
  }
  assert.deepStrictEqual([...themes].sort(), ['bridge', 'port']);
});
test('stream levels have a crowd of zombies around the boss', () => {
  const L = R.genLevel(5);
  assert.ok(L.stream);
  assert.ok(L.objs.filter(o => o.type === 'wave').length >= 12);
});
test('every level 1-60 is winnable by a perfect run, and not by running straight (from level 2)', () => {
  for (let l = 1; l <= 60; l++) {
    const L = R.levelFor(l);
    assert.ok(R.solve(L), 'level ' + l + ' should be winnable');
    if (l >= 2) assert.ok(!R.straight(L), 'level ' + l + ' should not be won by running straight');
  }
});
test('levels past the calibrated table still generate and solve', () => {
  for (const l of [61, 75, 100]) { const L = R.levelFor(l); assert.ok(R.solve(L), 'level ' + l); assert.ok(!R.straight(L), 'level ' + l + ' straight'); }
});

console.log('\n' + passed + ' passed' + (process.exitCode ? ', some FAILED' : ''));
