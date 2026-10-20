/* Headless checks for the Frostwatch rules engine. Run: node test/smoke.js */
'use strict';
const assert = require('assert');
const F = require('../src/sim.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('FAIL  ' + name + '\n      ' + (e && e.stack || e)); process.exitCode = 1; }
}
function run(s, secs, inp) { for (let i = 0; i < secs * 30 && s.phase === 'play'; i++) F.step(s, inp || {}); }
function goto(s, k, secs) {   // walk the player onto a station or pad
  const t = F.ST[k] || F.UPS.find(u => u.id === k);
  for (let i = 0; i < 30 * 12; i++) {
    const dx = t.x - s.player.x, dy = t.y - s.player.y, d = Math.hypot(dx, dy);
    if (d < 4) break;
    F.step(s, { dx: dx / d, dy: dy / d });
  }
  run(s, secs || 0);
}

// A greedy bot: runs the logistics loop and buys upgrades in a fixed order.
const BUY = ['carry', 'netw', 'pot', 'hearth', 'netr', 'fence', 'carry', 'boots', 'hf', 'pot', 'hm', 'netw', 'hearth', 'fence', 'hf', 'hm', 'netr', 'boots', 'carry', 'pot', 'hearth', 'netw', 'fence'];
function bot(s) {
  const c = s.player.carry;
  const next = BUY.find(id => { const u = F.UPS.find(x => x.id === id); return u.costs[F.lvl(s, id)] != null; });
  const nu = next && F.UPS.find(u => u.id === next);
  const want = nu && nu.costs[F.lvl(s, next)];
  let tgt;
  if (s.cashPile >= 8) tgt = F.ST.cash;
  else if (nu && s.wallet >= want) tgt = nu;
  else if (c.n > 0) tgt = c.type === 'fish' ? F.ST.pot : c.type === 'wood' ? F.ST.furnace : F.ST.bench;
  else if (s.pot.out > 2) tgt = F.ST.pot;
  else if (s.pileWood > 0 && s.furnace.fuel < 5) tgt = F.ST.wood;
  else if (s.pileFish > 0 && s.pot.in < 6) tgt = F.ST.fish;
  else if (s.cashPile >= 1) tgt = F.ST.cash;
  else tgt = F.ST.fish;
  const dx = tgt.x - s.player.x, dy = tgt.y - s.player.y, d = Math.hypot(dx, dy);
  return d < 3 ? {} : { dx: dx / d, dy: dy / d };
}
function playBot(seed) {
  const s = F.newState(seed);
  while (s.phase === 'play') F.step(s, bot(s));
  return s;
}

test('a fresh game starts on day 1 with the town warm and calm', () => {
  const s = F.newState(1);
  assert.strictEqual(s.day, 1); assert.strictEqual(s.phase, 'play');
  assert.ok(s.morale > 50 && s.warmth > 50);
});
test('the net runs itself and fills the winch pile', () => {
  const s = F.newState(2); const before = s.pileFish;
  run(s, 20);
  assert.ok(s.pileFish > before, 'pile should grow: ' + s.pileFish);
});
test('the net never overfills the pile', () => {
  const s = F.newState(3); run(s, 60);
  assert.ok(s.pileFish <= F.PILE_CAP && s.pileWood <= F.PILE_CAP);
});
test('standing on the fish pile picks fish up, up to your carry cap', () => {
  const s = F.newState(4); s.pileFish = 30;
  goto(s, 'fish', 3);
  assert.strictEqual(s.player.carry.type, 'fish');
  assert.strictEqual(s.player.carry.n, F.stats(s).cap);
});
test('fish go into the pot and come out as meals', () => {
  const s = F.newState(5); s.pileFish = 8;
  goto(s, 'fish', 1); const had = s.player.carry.n;
  assert.ok(had >= 6);
  goto(s, 'pot', 1);
  assert.strictEqual(s.player.carry.n, 0);
  run(s, 12, {});
  const got = s.pot.out + (s.player.carry.type === 'meals' ? s.player.carry.n : 0); assert.ok(got >= 1, 'meals cooked: ' + got);
});
test('meals reach the bench and feed the crowd, which pays cash', () => {
  const s = F.newState(6); s.pot.out = 6; s.queue.push({ id: 99, pat: 50 }, { id: 98, pat: 50 });
  goto(s, 'pot', 1);
  assert.strictEqual(s.player.carry.type, 'meals');
  goto(s, 'bench', 2);
  const stock0 = s.bench.stock; run(s, 3);
  assert.ok(s.served >= 1 && s.cashPile > 0, 'served=' + s.served);
  assert.ok(stock0 >= 2);
});
test('wood feeds the furnace', () => {
  const s = F.newState(7); s.pileWood = 9; s.pileFish = 0; s.furnace.fuel = 0;
  goto(s, 'wood', 2); assert.strictEqual(s.player.carry.type, 'wood');
  goto(s, 'furnace', 2);
  assert.ok(s.furnace.fuel >= 1);
});
test('cold without fuel drains warmth to zero', () => {
  const s = F.newState(8); s.furnace.fuel = 0; s.bench.stock = 40;
  run(s, 80);
  assert.strictEqual(s.warmth, 0);
});
test('an unfed crowd loses patience and morale', () => {
  const s = F.newState(9); s.bench.stock = 0; s.pileFish = 0;
  const m0 = s.morale; run(s, 70, {});
  assert.ok(s.morale < m0 && s.lost >= 1);
});
test('standing still all game loses', () => {
  const s = F.newState(10); run(s, 600, {});
  assert.strictEqual(s.phase, 'lost');
});
test('upgrade pad buys the next level only when you can afford it', () => {
  const s = F.newState(11); s.wallet = 10;
  goto(s, 'carry', 2); assert.strictEqual(F.lvl(s, 'carry'), 0);
  s.wallet = 100; run(s, 1.2);
  assert.strictEqual(F.lvl(s, 'carry'), 1); assert.strictEqual(s.wallet, 60);
  assert.strictEqual(F.stats(s).cap, 14);
});
test('the player cannot walk into the water or the crowd', () => {
  const s = F.newState(12);
  run(s, 3, { dx: 0, dy: -1 }); assert.ok(s.player.y >= F.EDGE);
  run(s, 8, { dx: 0, dy: 1 }); assert.ok(s.player.y <= F.FENCE);
});
test('the same seed plays out the same way', () => {
  const a = F.newState(5), b = F.newState(5);
  run(a, 30); run(b, 30);
  assert.strictEqual(a.pileFish, b.pileFish); assert.strictEqual(a.fish.length, b.fish.length);
});
test('a competent player (greedy bot) wins sometimes but not always (balance check)', () => {
  let wins = 0; const res = [];
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) { const s = playBot(seed); if (s.phase === 'won') wins++; res.push(s.phase + '@d' + s.day + ' served ' + s.served + ' lost ' + s.lost); }
  console.log('      bot: ' + res.join(' | '));
  assert.ok(wins >= 3 && wins <= 7, 'bot wins ' + wins + '/8 (should be a real fight, not a walkover)');
});

console.log(passed + ' passed');
