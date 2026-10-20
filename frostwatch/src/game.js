/* Frostwatch renderer and input. All rules live in sim.js. */
(function () {
'use strict';
const F = window.Frost;
const { W, H, EDGE, FENCE, DAYS, ST, UPS, PAD_R } = F;
const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
const screen = document.getElementById('screen');
const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

let s = null, scale = 1, started = false, botFn = null;
let joy = null;            // {ox, oy, x, y} in world units while a finger is down
const keys = {};
const flakes = Array.from({ length: 46 }, (_, i) => ({ x: (i * 97) % W, y: (i * 53) % H, v: 12 + (i % 7) * 4, r: 1 + (i % 3) * 0.6 }));

// ---------- layout ----------
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const aw = cv.parentElement.clientWidth - 0, ah = cv.parentElement.clientHeight - 0;
  scale = Math.min(aw / W, ah / H);
  cv.style.width = W * scale + 'px'; cv.style.height = H * scale + 'px';
  cv.width = Math.round(W * scale * dpr); cv.height = Math.round(H * scale * dpr);
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
}
window.addEventListener('resize', resize);

// ---------- input ----------
function toWorld(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }; }
cv.addEventListener('pointerdown', e => { const p = toWorld(e); joy = { ox: p.x, oy: p.y, x: p.x, y: p.y, id: e.pointerId }; cv.setPointerCapture(e.pointerId); e.preventDefault(); });
cv.addEventListener('pointermove', e => { if (joy && e.pointerId === joy.id) { const p = toWorld(e); joy.x = p.x; joy.y = p.y; } });
const endJoy = e => { if (joy && e.pointerId === joy.id) joy = null; };
cv.addEventListener('pointerup', endJoy); cv.addEventListener('pointercancel', endJoy);
window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; if (e.key.startsWith('Arrow')) e.preventDefault(); });
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
function readInput() {
  if (botFn && s) return botFn(s);
  let dx = 0, dy = 0;
  if (joy) { const R = 34; dx = (joy.x - joy.ox) / R; dy = (joy.y - joy.oy) / R; const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; } if (m < 0.12) { dx = 0; dy = 0; } }
  if (keys['arrowleft'] || keys['a']) dx -= 1;
  if (keys['arrowright'] || keys['d']) dx += 1;
  if (keys['arrowup'] || keys['w']) dy -= 1;
  if (keys['arrowdown'] || keys['s']) dy += 1;
  return { dx, dy };
}

// ---------- drawing helpers ----------
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function emoji(ch, x, y, size, alpha) { ctx.save(); if (alpha != null) ctx.globalAlpha = alpha; ctx.font = size + 'px ' + EMOJI; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ch, x, y); ctx.restore(); }
function text(t, x, y, size, color, align, weight) { ctx.font = (weight || 700) + ' ' + size + 'px system-ui, sans-serif'; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color || '#fff'; ctx.fillText(t, x, y); }
function label(t, x, y, size, color) { ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(8,20,40,.85)'; ctx.font = '800 ' + size + 'px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.strokeText(t, x, y); ctx.fillStyle = color || '#fff'; ctx.fillText(t, x, y); }
function shadow(x, y, rx, ry) { ctx.fillStyle = 'rgba(40,20,10,.25)'; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 6.3); ctx.fill(); }
function pad(x, y, r, tint) { ctx.fillStyle = tint || 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill(); ctx.setLineDash([5, 4]); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]); }

function drawWorld(t) {
  // water
  const g = ctx.createLinearGradient(0, 0, 0, EDGE);
  g.addColorStop(0, '#0b3f78'); g.addColorStop(1, '#1d73bd');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, EDGE);
  ctx.strokeStyle = 'rgba(190,225,255,.12)'; ctx.lineWidth = 1;
  for (let i = 0; i < 9; i++) { const y = 20 + i * 20 + Math.sin(t + i) * 2; ctx.beginPath(); for (let x = 0; x <= W; x += 12) ctx.lineTo(x, y + Math.sin(x * 0.05 + t * 1.3 + i) * 2); ctx.stroke(); }
  // snow at the very bottom, dock in the middle
  ctx.fillStyle = '#dfeaf5'; ctx.fillRect(0, FENCE, W, H - FENCE);
  ctx.fillStyle = '#c98a6a'; ctx.fillRect(0, EDGE, W, FENCE - EDGE);
  ctx.strokeStyle = 'rgba(80,40,25,.28)'; ctx.lineWidth = 1;
  for (let y = EDGE + 18; y < FENCE; y += 18) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  for (let y = EDGE, r = 0; y < FENCE; y += 18, r++) for (let x = (r % 2) * 40; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 18); ctx.stroke(); }
  // posts along the dock edge and the fence
  for (let x = 6; x < W; x += 15) post(x, EDGE);
  for (let x = 6; x < W; x += 15) post(x, FENCE);
}
function post(x, y) { ctx.fillStyle = '#7a3f22'; ctx.beginPath(); ctx.arc(x, y, 6.5, 0, 6.3); ctx.fill(); ctx.fillStyle = '#c9743f'; ctx.beginPath(); ctx.arc(x - 1, y - 1.5, 5, 0, 6.3); ctx.fill(); ctx.fillStyle = '#e8a06a'; ctx.beginPath(); ctx.arc(x - 1.5, y - 2, 2.2, 0, 6.3); ctx.fill(); }

function drawFish() {
  for (const q of s.fish) {
    const sc = s.schools[q.sch], dir = sc.tx >= sc.x ? 1 : -1;
    ctx.save(); ctx.translate(q.x, q.y); ctx.scale(dir, 1);
    ctx.fillStyle = '#14304f'; ctx.beginPath(); ctx.ellipse(0, 0, 5.2, 2.4, 0, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-8, -2.6 + Math.sin(s.t * 8 + q.ph)); ctx.lineTo(-8, 2.6 + Math.sin(s.t * 8 + q.ph)); ctx.fill();
    ctx.fillStyle = '#5d86a8'; ctx.beginPath(); ctx.ellipse(0.5, 0.8, 3.4, 1, 0, 0, 6.3); ctx.fill();
    ctx.restore();
  }
  for (const l of s.logs) {
    ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(Math.sin(l.rot) * 0.3);
    ctx.fillStyle = '#6a3b1f'; rr(-13, -4, 26, 8, 4); ctx.fill();
    ctx.fillStyle = '#c58b57'; ctx.beginPath(); ctx.ellipse(13, 0, 2.6, 4, 0, 0, 6.3); ctx.fill();
    ctx.restore();
  }
}
function drawNet() {
  const n = s.net, st = F.stats(s), hw = st.halfW, rch = n.reach;
  if (rch > 2) {
    ctx.save();
    ctx.beginPath(); ctx.moveTo(n.x - hw, EDGE); ctx.quadraticCurveTo(n.x - hw, EDGE - rch, n.x, EDGE - rch); ctx.quadraticCurveTo(n.x + hw, EDGE - rch, n.x + hw, EDGE); ctx.closePath();
    ctx.fillStyle = 'rgba(236,226,150,.20)'; ctx.fill(); ctx.clip();
    ctx.strokeStyle = 'rgba(240,230,160,.6)'; ctx.lineWidth = 1;
    for (let i = -hw; i <= hw; i += 7) { ctx.beginPath(); ctx.moveTo(n.x + i, EDGE); ctx.lineTo(n.x + i * 0.9, EDGE - rch); ctx.stroke(); }
    for (let j = 0; j <= rch; j += 7) { ctx.beginPath(); ctx.moveTo(n.x - hw, EDGE - j); ctx.lineTo(n.x + hw, EDGE - j); ctx.stroke(); }
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(n.x - hw, EDGE); ctx.quadraticCurveTo(n.x - hw, EDGE - rch, n.x, EDGE - rch); ctx.quadraticCurveTo(n.x + hw, EDGE - rch, n.x + hw, EDGE);
    ctx.strokeStyle = '#efe49a'; ctx.lineWidth = 2.5; ctx.stroke();
  }
  for (const sx of [-hw, hw]) { ctx.fillStyle = '#e8903c'; ctx.beginPath(); ctx.arc(n.x + sx, EDGE + 2, 8, 0, 6.3); ctx.fill(); ctx.fillStyle = '#7a3f22'; ctx.fillRect(n.x + sx - 5, EDGE - 1, 10, 2.5); ctx.fillRect(n.x + sx - 1.2, EDGE - 5, 2.5, 10); }
}
function stack(x, y, n, col, cap) {
  const k = Math.min(n, cap || 10);
  for (let i = 0; i < k; i++) { ctx.fillStyle = col; rr(x - 9, y - i * 3.4 - 3, 18, 5, 2.5); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.28)'; rr(x - 8, y - i * 3.4 - 3, 16, 1.6, 1); ctx.fill(); }
}
function drawStations(t) {
  // piles from the net
  for (const [k, n, col, ic] of [['fish', s.pileFish, '#6a98c0', '🐟'], ['wood', s.pileWood, '#8a5630', '🪵']]) {
    const p = ST[k]; pad(p.x, p.y, p.r, 'rgba(255,255,255,.14)');
    stack(p.x, p.y + 6, n, col, 9);
    label(ic + ' ' + n, p.x, p.y + 25, 12);
  }
  // pot
  { const p = ST.pot; pad(p.x, p.y, p.r, 'rgba(255,255,255,.14)');
    emoji('🍲', p.x, p.y - 2, 30);
    label('🐟 ' + s.pot.in + '   🍲 ' + s.pot.out, p.x, p.y + 25, 12);
    if (s.pot.in > 0) { ctx.strokeStyle = '#ffd37a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, p.r - 3, -1.57, -1.57 + 6.28 * s.pot.prog); ctx.stroke(); } }
  // furnace
  { const p = ST.furnace; pad(p.x, p.y, p.r, s.burning ? 'rgba(255,150,60,.25)' : 'rgba(255,255,255,.14)');
    emoji(s.burning ? '🔥' : '🪨', p.x, p.y - 2, 28 + (s.burning ? Math.sin(t * 9) * 1.5 : 0));
    label('🪵 ' + s.furnace.fuel + '/' + F.stats(s).fuelCap, p.x, p.y + 25, 12, s.furnace.fuel < 3 ? '#ffb0a0' : '#fff'); }
  // serving bench
  { const p = ST.bench; pad(p.x, p.y, p.r, 'rgba(255,255,255,.14)');
    ctx.fillStyle = '#7a4a2c'; rr(p.x - 44, p.y - 8, 88, 17, 5); ctx.fill(); ctx.fillStyle = '#b57a4e'; rr(p.x - 44, p.y - 8, 88, 8, 5); ctx.fill();
    for (let i = 0; i < Math.min(8, s.bench.stock); i++) emoji('🍲', p.x - 34 + i * 9.5, p.y - 4, 10);
    label('serve 🍲 ' + s.bench.stock, p.x, p.y + 22, 12); }
  // cash
  { const p = ST.cash; pad(p.x, p.y, p.r, 'rgba(120,255,140,.18)');
    const k = Math.min(10, Math.floor(s.cashPile / 3) + (s.cashPile >= 1 ? 1 : 0));
    for (let i = 0; i < k; i++) { ctx.fillStyle = '#35b552'; rr(p.x - 11, p.y + 6 - i * 3.6, 22, 7, 2); ctx.fill(); ctx.fillStyle = '#7ee08f'; rr(p.x - 9, p.y + 7 - i * 3.6, 18, 2, 1); ctx.fill(); }
    label('$' + Math.floor(s.cashPile), p.x, p.y + 24, 12, '#9dff9d'); }
}
function drawPads(t) {
  for (const u of UPS) {
    const L = F.lvl(s, u.id), cost = u.costs[L];
    if (cost == null) { continue; }
    const can = s.wallet >= cost, active = s.pad.id === u.id;
    ctx.save(); ctx.translate(u.x, u.y);
    ctx.fillStyle = can ? 'rgba(255,214,102,.30)' : 'rgba(40,20,10,.20)';
    rr(-PAD_R, -PAD_R, PAD_R * 2, PAD_R * 2, 9); ctx.fill();
    ctx.setLineDash([4, 3]); ctx.strokeStyle = can ? '#ffe27a' : 'rgba(255,255,255,.45)'; ctx.lineWidth = 1.6; ctx.stroke(); ctx.setLineDash([]);
    emoji(u.icon, 0, -3, 19, can ? 1 : 0.6);
    ctx.fillStyle = can ? '#2d6a2f' : 'rgba(30,15,8,.7)'; rr(-17, 8, 34, 12, 6); ctx.fill();
    text('$' + cost, 0, 14.5, 10, '#fff');
    if (L > 0) text('Lv' + (L + 1), 0, -PAD_R - 6, 9, '#fff3c4');
    if (active) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -3, 16, -1.57, -1.57 + 6.28 * Math.min(1, s.pad.t / 0.7)); ctx.stroke(); }
    ctx.restore();
    if (active || (Math.hypot(s.player.x - u.x, s.player.y - u.y) < 46)) label(u.name, u.x, u.y - PAD_R - (L > 0 ? 17 : 8), 10, '#fff');
  }
}
function drawHuskies(t) {
  const a = ST.fish, b = ST.pot, c = ST.bench;
  const st = F.stats(s);
  if (st.hf > 0) { const k = (Math.sin(t * 1.6) + 1) / 2; emoji('🐕', a.x + (b.x + 24 - a.x) * k, a.y + (b.y - a.y) * k + 8, 18); }
  if (st.hm > 0) { const k = (Math.sin(t * 1.4 + 1) + 1) / 2; emoji('🐶', b.x + 20 + (c.x - 20 - b.x) * k, b.y + 30 + (c.y - b.y - 40) * k, 17); }
}
function drawPlayer(t) {
  const p = s.player, moving = Math.abs(p.fx || 0) + Math.abs(p.fy || 0) > 0;
  shadow(p.x, p.y + 10, 10, 4);
  ctx.fillStyle = '#f2f5fb'; ctx.beginPath(); ctx.arc(p.x, p.y + (moving ? Math.sin(t * 16) * 0.8 : 0), 10, 0, 6.3); ctx.fill();
  ctx.fillStyle = '#d83b3b'; ctx.beginPath(); ctx.arc(p.x, p.y - 3, 7.5, Math.PI, 0); ctx.fill();         // red hood
  ctx.fillStyle = '#ffd7b8'; ctx.beginPath(); ctx.arc(p.x, p.y - 1, 4.2, 0, 6.3); ctx.fill();
  const c = p.carry;
  if (c.n > 0) {
    const col = c.type === 'fish' ? '#6a98c0' : c.type === 'wood' ? '#8a5630' : '#f0a63c';
    const k = Math.min(c.n, 14);
    for (let i = 0; i < k; i++) {
      ctx.fillStyle = col; rr(p.x - 9, p.y - 16 - i * 3.6, 18, 5, 2.5); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.3)'; rr(p.x - 8, p.y - 16 - i * 3.6, 16, 1.6, 1); ctx.fill();
    }
    const full = c.n >= F.stats(s).cap;
    label(full ? 'FULL' : String(c.n), p.x, p.y - 20 - k * 3.6, 12, full ? '#ffd27a' : '#fff');
  }
}
function drawCrowd(t) {
  const q = s.queue;
  for (let i = 0; i < q.length; i++) {
    const col = i % 8, row = Math.floor(i / 8);
    const x = 34 + col * 42 + (row % 2) * 18, y = FENCE + 26 + row * 25;
    const v = q[i], angry = v.pat < 15, sh = angry ? Math.sin(t * 30 + i) * 1 : 0;
    shadow(x + sh, y + 8, 9, 3);
    ctx.fillStyle = angry ? '#e05a3a' : '#f0c02e'; ctx.beginPath(); ctx.arc(x + sh, y, 9, 0, 6.3); ctx.fill();
    ctx.strokeStyle = 'rgba(60,40,10,.5)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#ffd7b8'; ctx.beginPath(); ctx.arc(x + sh, y - 3, 4.2, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#3a4660'; ctx.beginPath(); ctx.arc(x + sh, y - 5, 4.4, Math.PI, 0); ctx.fill();
    if (angry) emoji('😠', x, y - 17, 14); else if (row === 0 && i < 8) emoji('🍲', x, y - 17, 12, 0.85);
    if (v.pat < 25 && !angry) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x - 8, y + 12, 16, 2.5); ctx.fillStyle = '#ffc24a'; ctx.fillRect(x - 8, y + 12, 16 * v.pat / 25, 2.5); }
  }
  if (q.length >= F.stats(s).queueCap) label('Fence full', W - 46, FENCE + 12, 10, '#7a3f22');
}
function drawWeather(t, dt) {
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  const fast = s.blizzard ? 5 : 1;
  for (const f of flakes) {
    f.y += f.v * dt * fast; f.x += (s.blizzard ? 70 : 8) * dt + Math.sin(t + f.v) * 0.2;
    if (f.y > H) { f.y = -4; } if (f.x > W + 4) f.x = -4;
    if (s.blizzard) ctx.fillRect(f.x, f.y, 7, 1.2); else { ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.3); ctx.fill(); }
  }
  if (s.blizzard) { ctx.fillStyle = 'rgba(210,230,255,.16)'; ctx.fillRect(0, 0, W, H); }
  if (s.warmth < 30) { const a = (30 - s.warmth) / 30 * 0.35 * (0.8 + 0.2 * Math.sin(t * 4)); const g = ctx.createRadialGradient(W / 2, H / 2, 160, W / 2, H / 2, 420); g.addColorStop(0, 'rgba(120,190,255,0)'); g.addColorStop(1, 'rgba(120,190,255,' + a + ')'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
}
function bar(x, y, w, v, col, bg) { ctx.fillStyle = bg || 'rgba(0,0,0,.4)'; rr(x, y, w, 9, 4.5); ctx.fill(); if (v > 0) { ctx.fillStyle = col; rr(x, y, Math.max(6, w * v / 100), 9, 4.5); ctx.fill(); } }
function drawHud(t) {
  ctx.fillStyle = 'rgba(8,22,44,.72)'; rr(6, 6, W - 12, 50, 12); ctx.fill();
  text('Day ' + s.day + '/' + DAYS, 16, 19, 14, '#fff', 'left', 800);
  const dp = s.dayT / F.DAY_LEN; ctx.fillStyle = 'rgba(255,255,255,.18)'; rr(84, 15, 150, 7, 3.5); ctx.fill(); ctx.fillStyle = s.blizzard ? '#9fd0ff' : '#ffd37a'; rr(84, 15, Math.max(5, 150 * dp), 7, 3.5); ctx.fill();
  if (s.blizzard) text('BLIZZARD', 160, 29, 9, '#cfe8ff');
  text('$' + s.wallet, W - 16, 19, 16, '#9dff9d', 'right', 800);
  const lowM = s.morale < 30, lowW = s.warmth < 30;
  emoji(s.morale < 30 ? '😠' : s.morale < 60 ? '😐' : '🙂', 20, 42, 14);
  bar(34, 38, 128, s.morale, lowM ? '#ff6a5a' : '#6fdc7a');
  emoji('🔥', 184, 42, 14);
  bar(198, 38, 142, s.warmth, lowW ? '#7ac4ff' : '#ff9a3c');
  if (lowW) text('freezing!', 269, 33, 9, '#cfe8ff');
}
function drawJoy() {
  if (!joy) return;
  ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 34, 0, 6.3); ctx.stroke();
  let dx = joy.x - joy.ox, dy = joy.y - joy.oy; const m = Math.hypot(dx, dy); if (m > 34) { dx *= 34 / m; dy *= 34 / m; }
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(joy.ox + dx, joy.oy + dy, 14, 0, 6.3); ctx.fill();
}
function drawFx(dt) {
  for (let i = s.fx.length - 1; i >= 0; i--) {
    const f = s.fx[i]; f.t += dt;
    if (f.t > 1.3) { s.fx.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(1, (1.3 - f.t) * 2); label(f.txt, f.x, f.y - f.t * 24, f.txt.length > 8 ? 18 : 13, f.c); ctx.globalAlpha = 1;
  }
}

// ---------- screens ----------
function show(html) { screen.innerHTML = '<div class="card">' + html + '</div>'; screen.classList.add('on'); }
function hide() { screen.classList.remove('on'); }
function startScreen() {
  show('<h1>❄️ Frostwatch</h1><p class="sub">Keep the harbor town fed and warm for ten days.</p>' +
    '<ul><li><b>Drag</b> anywhere to walk (or use WASD / arrows). The net fishes by itself.</li>' +
    '<li>Carry <b>🐟 fish</b> to the <b>🍲 pot</b>, then carry the meals to the <b>serving bench</b>.</li>' +
    '<li>Carry <b>🪵 driftwood</b> to the <b>🔥 fire</b> or the town freezes.</li>' +
    '<li>Grab the <b>$ cash</b> the crowd pays, then stand on an <b>upgrade pad</b> to buy it.</li></ul>' +
    '<button class="go" id="go">Start day 1</button>');
  document.getElementById('go').onclick = begin;
}
function endScreen() {
  const won = s.phase === 'won';
  const why = s.reason === 'frozen' ? 'The fire died and the town froze.' : 'The crowd lost faith in you.';
  show('<h1>' + (won ? '🌅 The thaw arrives' : '🥶 The town fell') + '</h1><p class="sub">' + (won ? 'Ten days survived. Spring is here.' : why + ' You reached day ' + s.day + '.') + '</p>' +
    '<div class="stats">🍲 Meals served: <b>' + s.served + '</b><br>😠 Left angry: <b>' + s.lost + '</b><br>$ Earned: <b>' + s.earned + '</b></div>' +
    '<button class="go" id="go">' + (won ? 'Play again' : 'Try again') + '</button>');
  document.getElementById('go').onclick = begin;
}
function begin() { s = F.newState((Math.random() * 1e9) | 0); started = true; hide(); }

// ---------- loop ----------
let last = performance.now(), acc = 0, shown = false;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!s) s = F.newState(1);
  if (started && s.phase === 'play') { acc += dt; while (acc >= F.DT) { F.step(s, readInput(), F.DT); acc -= F.DT; } }
  if (started && s.phase !== 'play' && !shown) { shown = true; endScreen(); }
  if (s.phase === 'play') shown = false;
  const t = now / 1000;
  ctx.clearRect(0, 0, W, H);
  drawWorld(t); drawFish(); drawNet(); drawStations(t); drawPads(t); drawHuskies(t); drawCrowd(t); drawPlayer(t); drawWeather(t, dt); drawHud(t); drawJoy(); drawFx(dt);
  requestAnimationFrame(frame);
}
resize(); startScreen(); requestAnimationFrame(frame);
window.__frost = { get state() { return s; }, begin, setBot(fn) { botFn = fn; }, F };
})();
