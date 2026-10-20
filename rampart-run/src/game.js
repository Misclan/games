/* Rampart Run: drawing, input and screens. Rules live in sim.js. */
(function () {
  'use strict';
  const R = window.RR;
  const $ = id => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d'), screen = $('screen'), stage = $('stage');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hash = i => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };

  // ---------- save ----------
  const SAVE = 'rampartrun.save.v1';
  let save = { level: 1, best: 0 };
  try { const j = JSON.parse(localStorage.getItem(SAVE) || 'null'); if (j && j.level) save = j; } catch (e) { /* storage may be blocked */ }
  function persist() { try { localStorage.setItem(SAVE, JSON.stringify(save)); } catch (e) { /* ignore */ } }

  // ---------- state ----------
  let mode = 'menu';            // menu | ready | play | done
  let S = null, L = null;       // running sim state and its level
  let demo = null;              // attract-mode sim behind the menu
  let acc = 0, last = 0, T = 0; // fixed-step accumulator, clock
  let target = 0, dragging = false, dragX0 = 0, dragT0 = 0;
  const keys = {};
  let gfx;
  function resetGfx() { gfx = { tr: [], pops: [], parts: [], banner: null, shake: 0, red: 0, flash: {}, doneAt: 0 }; }
  resetGfx();

  // ---------- layout / projection ----------
  let W = 0, H = 0, DPR = 1, cx, yS, yH, laneHalf, base;
  const FAR = 42, KP = 0.052, sFar = 1 / (1 + FAR * KP);
  function resize() {
    W = stage.clientWidth; H = stage.clientHeight; DPR = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cx = W / 2; yS = H * 0.8; yH = H * 0.27; laneHalf = W * 0.42; base = W / 380;
  }
  function proj(d, x) {
    const s = 1 / (1 + d * KP), u = (s - sFar) / (1 - sFar);
    return { x: cx + x * laneHalf * s, y: yH + (yS - yH) * u, s: s * base, k: s };
  }

  // ---------- small drawing helpers ----------
  function rr(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function ell(x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, 6.2832); }
  const FONT = '"Arial Black", Impact, system-ui, sans-serif';
  function label(txt, x, y, size, fill, stroke) {
    ctx.font = '900 ' + size + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, size * 0.2); ctx.strokeStyle = stroke || '#0a0a10';
    ctx.strokeText(txt, x, y); ctx.fillStyle = fill; ctx.fillText(txt, x, y);
  }
  function badge(txt, x, y, sc, bg, fg) {
    const size = clamp(19 * sc, 12, 40);
    ctx.font = '900 ' + size + 'px ' + FONT;
    const w = ctx.measureText(txt).width + size * 0.9, h = size * 1.45;
    rr(x - w / 2, y - h / 2, w, h, h / 2); ctx.fillStyle = bg; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.stroke();
    label(txt, x, y + 1, size, fg || '#fff');
  }

  // ---------- sprites ----------
  function man(x, y, sc, body, t, i) {
    const bob = Math.sin(t * 13 + i * 1.7) * 1.4 * sc, run = Math.sin(t * 13 + i * 1.7) * 2.2 * sc;
    ctx.fillStyle = '#262b38';
    ctx.fillRect(x - 3.6 * sc, y - 6 * sc + bob * 0.4 + run * 0.3, 2.8 * sc, 6 * sc);
    ctx.fillRect(x + 0.8 * sc, y - 6 * sc + bob * 0.4 - run * 0.3, 2.8 * sc, 6 * sc);
    rr(x - 4.8 * sc, y - 14.5 * sc + bob, 9.6 * sc, 9.5 * sc, 2.2 * sc); ctx.fillStyle = body; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x - 4.8 * sc, y - 14.5 * sc + bob, 9.6 * sc, 2.4 * sc);
    ctx.fillStyle = '#101319'; ctx.fillRect(x + 2.6 * sc, y - 15 * sc + bob, 1.9 * sc, 9 * sc);
    ell(x, y - 18 * sc + bob, 3.6 * sc, 3.7 * sc); ctx.fillStyle = '#e9c9a2'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y - 18.4 * sc + bob, 3.9 * sc, Math.PI, 0); ctx.fillStyle = '#8e97a8'; ctx.fill();
  }
  function zombie(x, y, sc, t, i, tone) {
    const sway = Math.sin(t * 7 + i * 2.3) * 1.6 * sc, step = Math.sin(t * 9 + i) * 1.8 * sc;
    ctx.fillStyle = '#2b2733';
    ctx.fillRect(x - 3.4 * sc, y - 6 * sc + step * 0.3, 2.8 * sc, 6 * sc);
    ctx.fillRect(x + 0.7 * sc, y - 6 * sc - step * 0.3, 2.8 * sc, 6 * sc);
    ctx.save(); ctx.translate(sway * 0.3, 0);
    rr(x - 4.6 * sc, y - 14 * sc, 9.2 * sc, 9 * sc, 2 * sc); ctx.fillStyle = tone ? '#5d3b4d' : '#503246'; ctx.fill();
    ctx.fillStyle = '#3a2233'; ctx.fillRect(x - 4.6 * sc, y - 9 * sc, 9.2 * sc, 1.4 * sc);
    ctx.fillStyle = '#6fae5a'; // arms reaching toward the squad
    ctx.fillRect(x - 7.4 * sc, y - 13.5 * sc, 2.8 * sc, 7.5 * sc + Math.abs(sway) * 0.4);
    ctx.fillRect(x + 4.6 * sc, y - 13.5 * sc, 2.8 * sc, 7.5 * sc - Math.abs(sway) * 0.4);
    ell(x + sway * 0.4, y - 17.6 * sc, 3.7 * sc, 3.9 * sc); ctx.fillStyle = '#86c46c'; ctx.fill();
    ctx.fillStyle = '#c1121f'; ctx.fillRect(x - 2.2 * sc + sway * 0.4, y - 18.6 * sc, 1.4 * sc, 1.4 * sc); ctx.fillRect(x + 0.8 * sc + sway * 0.4, y - 18.6 * sc, 1.4 * sc, 1.4 * sc);
    ctx.restore();
  }
  function ogre(x, y, sc, t, hue, slam) {
    const bob = Math.sin(t * 4) * 1.5 * sc, skin = 'hsl(' + hue + ',38%,38%)', skinD = 'hsl(' + hue + ',38%,26%)';
    ell(x, y + 1 * sc, 22 * sc, 6 * sc); ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fill();
    ctx.fillStyle = skinD; ctx.fillRect(x - 11 * sc, y - 12 * sc, 8 * sc, 12 * sc); ctx.fillRect(x + 3 * sc, y - 12 * sc, 8 * sc, 12 * sc);
    rr(x - 17 * sc, y - 44 * sc + bob, 34 * sc, 36 * sc, 12 * sc); ctx.fillStyle = skin; ctx.fill();
    ctx.fillStyle = '#3b2430'; rr(x - 17 * sc, y - 20 * sc + bob, 34 * sc, 9 * sc, 3 * sc); ctx.fill();
    ell(x, y - 28 * sc + bob, 10 * sc, 9 * sc); ctx.fillStyle = skinD; ctx.fill();
    const arm = slam ? 10 * sc : 0;
    ctx.fillStyle = skin;
    rr(x - 29 * sc, y - 42 * sc + bob + arm, 12 * sc, 30 * sc, 6 * sc); ctx.fill();
    rr(x + 17 * sc, y - 42 * sc + bob + arm, 12 * sc, 30 * sc, 6 * sc); ctx.fill();
    ell(x - 23 * sc, y - 11 * sc + bob + arm, 8 * sc, 7 * sc); ctx.fill(); ell(x + 23 * sc, y - 11 * sc + bob + arm, 8 * sc, 7 * sc); ctx.fill();
    ell(x, y - 56 * sc + bob, 11 * sc, 11 * sc); ctx.fillStyle = skin; ctx.fill();
    ctx.fillStyle = '#ffeaa0'; ctx.beginPath(); ctx.moveTo(x - 7 * sc, y - 50 * sc + bob); ctx.lineTo(x - 4 * sc, y - 44 * sc + bob); ctx.lineTo(x - 2 * sc, y - 50 * sc + bob); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 7 * sc, y - 50 * sc + bob); ctx.lineTo(x + 4 * sc, y - 44 * sc + bob); ctx.lineTo(x + 2 * sc, y - 50 * sc + bob); ctx.fill();
    ctx.fillStyle = '#ff2a2a'; ctx.fillRect(x - 6 * sc, y - 59 * sc + bob, 4 * sc, 3 * sc); ctx.fillRect(x + 2 * sc, y - 59 * sc + bob, 4 * sc, 3 * sc);
  }

  // ---------- backgrounds ----------
  function sky(theme) {
    const g = ctx.createLinearGradient(0, 0, 0, yH + 10);
    if (theme === 'bridge') { g.addColorStop(0, '#1a1030'); g.addColorStop(0.55, '#7b3b5f'); g.addColorStop(1, '#f2a65a'); }
    else { g.addColorStop(0, '#040814'); g.addColorStop(0.6, '#10234a'); g.addColorStop(1, '#2a5a73'); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, yH + 10);
    if (theme === 'bridge') {
      const sg = ctx.createRadialGradient(cx, yH, 4, cx, yH, W * 0.5); sg.addColorStop(0, 'rgba(255,220,150,.9)'); sg.addColorStop(1, 'rgba(255,160,80,0)');
      ctx.fillStyle = sg; ctx.fillRect(0, yH - W * 0.5, W, W * 0.5);
      ctx.fillStyle = '#2a1830'; // far hills
      ctx.beginPath(); ctx.moveTo(0, yH + 8);
      for (let i = 0; i <= 12; i++) ctx.lineTo((W / 12) * i, yH - 6 - hash(i + 3) * 26 - (i % 3) * 5);
      ctx.lineTo(W, yH + 8); ctx.closePath(); ctx.fill();
    } else {
      for (let i = 0; i < 60; i++) { ctx.fillStyle = 'rgba(255,255,255,' + (0.3 + hash(i) * 0.6) + ')'; ctx.fillRect(hash(i + 9) * W, hash(i + 31) * yH * 0.8, 1.5, 1.5); }
      ell(W * 0.78, yH * 0.35, 18, 18); ctx.fillStyle = '#dfe9f5'; ctx.fill();
      ctx.fillStyle = '#0b1424'; // cranes
      for (const [px, ph] of [[0.12, 70], [0.3, 52], [0.86, 80]]) {
        const bx = W * px, by = yH + 6;
        ctx.fillRect(bx - 2, by - ph, 4, ph); ctx.fillRect(bx - 38, by - ph, 80, 4); ctx.fillRect(bx + 28, by - ph, 2, 24);
        ctx.fillRect(bx - 12, by - ph - 12, 2, 12); ctx.fillRect(bx - 12, by - ph - 12, 26, 2);
      }
      ctx.fillStyle = '#0b1424'; ctx.fillRect(0, yH - 4, W, 10);
    }
  }
  function ground(theme, st) {
    const g = ctx.createLinearGradient(0, yH, 0, H);
    if (theme === 'bridge') { g.addColorStop(0, '#2a1a30'); g.addColorStop(1, '#0c0814'); } else { g.addColorStop(0, '#0e3342'); g.addColorStop(1, '#030a12'); }
    ctx.fillStyle = g; ctx.fillRect(0, yH, W, H - yH);
    // road
    const a = proj(-4, -1), b = proj(-4, 1), c = proj(FAR, 1), d = proj(FAR, -1);
    const rg = ctx.createLinearGradient(0, yH, 0, H);
    if (theme === 'bridge') { rg.addColorStop(0, '#6a5668'); rg.addColorStop(1, '#3e3f4c'); } else { rg.addColorStop(0, '#3f5666'); rg.addColorStop(1, '#262c35'); }
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fillStyle = rg; ctx.fill();
    // scrolling slabs / lane marks
    const z0 = Math.floor((st.z - 4) / 4) * 4;
    for (let zz = z0; zz < st.z + FAR; zz += 4) {
      const d0 = zz - st.z, d1 = d0 + 2;
      if (d1 < -4) continue;
      const p0 = proj(Math.max(d0, -4), 0), p1 = proj(d1, 0);
      ctx.fillStyle = theme === 'bridge' ? 'rgba(255,255,255,.07)' : 'rgba(255,214,90,.55)';
      const w0 = 0.012 * laneHalf * p0.k, w1 = 0.012 * laneHalf * p1.k;
      ctx.beginPath(); ctx.moveTo(p0.x - w0, p0.y); ctx.lineTo(p0.x + w0, p0.y); ctx.lineTo(p1.x + w1, p1.y); ctx.lineTo(p1.x - w1, p1.y); ctx.fill();
    }
    // edges
    for (const sx of [-1, 1]) {
      const p0 = proj(-4, sx), p1 = proj(FAR, sx);
      ctx.strokeStyle = theme === 'bridge' ? '#a79bb0' : '#e9c64a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }
    // side furniture
    const step = theme === 'bridge' ? 6 : 8, z1 = Math.floor((st.z - 5) / step) * step;
    const items = [];
    for (let zz = z1; zz < st.z + FAR; zz += step) items.push(zz);
    items.reverse();
    for (const zz of items) {
      const dd = zz - st.z; if (dd < -5) continue;
      const idx = Math.round(zz / step);
      for (const sx of [-1, 1]) {
        if (theme === 'bridge') {
          const p = proj(dd, sx * 1.1), top = 30 * p.s;
          ctx.fillStyle = '#7e728c'; ctx.fillRect(p.x - 2.2 * p.s, p.y - top, 4.4 * p.s, top);
          const q = proj(dd + step, sx * 1.1);
          ctx.strokeStyle = '#9d92aa'; ctx.lineWidth = Math.max(1, 2.2 * p.s);
          ctx.beginPath(); ctx.moveTo(p.x, p.y - top * 0.92); ctx.lineTo(q.x, q.y - 30 * q.s * 0.92); ctx.stroke();
          if (idx % 2 === 0) { ell(p.x, p.y - top - 6 * p.s, 5 * p.s, 5 * p.s); ctx.fillStyle = '#ffd89a'; ctx.fill(); }
        } else {
          const p = proj(dd, sx * 1.55), w = 70 * p.s, hh = 30 * p.s * (1 + Math.floor(hash(idx * 3 + (sx > 0 ? 1 : 0)) * 2));
          const hue = [8, 28, 205, 150, 45][Math.floor(hash(idx + sx * 7) * 5)];
          ctx.fillStyle = 'hsl(' + hue + ',55%,34%)'; ctx.fillRect(p.x - w / 2, p.y - hh, w, hh);
          ctx.fillStyle = 'rgba(0,0,0,.28)';
          for (let r = 1; r < 6; r++) ctx.fillRect(p.x - w / 2 + (w / 6) * r, p.y - hh, Math.max(1, 1.5 * p.s), hh);
          ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(p.x - w / 2, p.y - hh, w, 3 * p.s);
        }
      }
    }
    // horizon haze hides pop-in
    const hz = ctx.createLinearGradient(0, yH - 4, 0, yH + 70);
    hz.addColorStop(0, theme === 'bridge' ? 'rgba(242,166,90,.55)' : 'rgba(60,120,150,.5)'); hz.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hz; ctx.fillRect(0, yH - 4, W, 74);
  }

  // ---------- world objects ----------
  const bodyCol = n => (n >= 200 ? '#e0a526' : n >= 100 ? '#a65bd6' : n >= 50 ? '#2fb4a0' : '#3b7bd8');
  function drawSquad(st) {
    const n = st.n, h = R.half(n), m = Math.min(n, 56);
    const rows = Math.min(7, Math.ceil(m / Math.max(1, Math.round((2 * h) / 0.13)))), cols = Math.ceil(m / rows);
    const gx = Math.min(0.16, (2 * h) / Math.max(cols, 1));
    const sizeMul = clamp(gx / 0.1, 0.62, 1.15);
    const col = bodyCol(n);
    const list = [];
    for (let i = 0; i < m; i++) {
      const r = Math.floor(i / cols), c = i % cols, rowN = Math.min(cols, m - r * cols);
      list.push({ r, x: st.x + (c - (rowN - 1) / 2) * gx + (hash(i + 5) - 0.5) * gx * 0.4, d: -r * 0.3 + (hash(i + 11) - 0.5) * 0.15, i });
    }
    list.sort((a, b) => b.d - a.d);
    // shield bubble
    const fp = proj(-0.3, st.x);
    if (st.shield > 0) { ell(fp.x, fp.y - 12 * fp.s, (h * laneHalf + 22 * base), 26 * base + rows * 6 * base); ctx.fillStyle = 'rgba(80,170,255,.16)'; ctx.fill(); ctx.strokeStyle = 'rgba(140,210,255,.8)'; ctx.lineWidth = 2; ctx.stroke(); }
    for (const p of list) { const q = proj(p.d, p.x); man(q.x, q.y, q.s * sizeMul * 1.5, col, T, p.i); }
    // muzzle flash
    const mz = proj(0.6, st.x);
    if (!st.over && (T * 20 | 0) % 2) { ell(mz.x, mz.y - 20 * mz.s, 10 * mz.s * (0.6 + h * 2), 4 * mz.s); ctx.fillStyle = 'rgba(255,220,120,.7)'; ctx.fill(); }
    // allies
    st.allies.forEach((a, k) => {
      const side = k % 2 ? -1 : 1;
      if (a.kind === 'turret') {
        const q = proj(0.5, clamp(st.x + side * (h + 0.22), -1, 1)), s = q.s * 1.2;
        ell(q.x, q.y, 11 * s, 4 * s); ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fill();
        rr(q.x - 8 * s, q.y - 9 * s, 16 * s, 9 * s, 2 * s); ctx.fillStyle = '#566179'; ctx.fill();
        ell(q.x, q.y - 12 * s, 7 * s, 6 * s); ctx.fillStyle = '#7a88a6'; ctx.fill();
        ctx.fillStyle = '#20252f'; ctx.fillRect(q.x - 1.6 * s, q.y - 26 * s, 3.2 * s, 16 * s);
        allyBar(q.x, q.y + 5 * s, s, a);
      } else {
        const q = proj(0.8, clamp(st.x + side * (h + 0.12), -1, 1)), s = q.s * 1.2, y = q.y - 44 * s + Math.sin(T * 5 + k) * 3 * s;
        ell(q.x, q.y, 7 * s, 2.5 * s); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fill();
        ell(q.x, y, 8 * s, 6 * s); ctx.fillStyle = '#d7dcea'; ctx.fill(); ell(q.x, y + 1 * s, 3 * s, 3 * s); ctx.fillStyle = '#ff5a3c'; ctx.fill();
        ctx.strokeStyle = '#9aa3b8'; ctx.lineWidth = 2 * s; const rot = Math.sin(T * 40) * 12 * s;
        ctx.beginPath(); ctx.moveTo(q.x - 14 * s + rot, y - 7 * s); ctx.lineTo(q.x - 2 * s, y - 5 * s); ctx.moveTo(q.x + 14 * s - rot, y - 7 * s); ctx.lineTo(q.x + 2 * s, y - 5 * s); ctx.stroke();
        allyBar(q.x, y + 12 * s, s, a);
      }
    });
    // count badge
    const top = proj(-(rows - 1) * 0.3 * 0.2 + 0.2, st.x);
    badge(String(n), top.x, top.y - 40 * top.s - 6, 1.6, '#16315f', '#fff');
    if (st.shield > 0) label('shield ' + st.shield, top.x, top.y - 40 * top.s - 34, 13, '#8fd0ff');
  }
  function allyBar(x, y, s, a) {
    const w = 26 * s;
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - w / 2, y, w, 4 * s);
    ctx.fillStyle = a.hp / a.max > 0.4 ? '#58d36a' : '#ff6a4a'; ctx.fillRect(x - w / 2, y, w * clamp(a.hp / a.max, 0, 1), 4 * s);
  }

  function drawCard(o, P, Q) {
    const good = o.op === 'x';
    const left = proj(P.d, o.x - o.w + 0.03), right = proj(P.d, o.x + o.w - 0.03), s = P.s;
    const hgt = 70 * s, y = P.y;
    ctx.fillStyle = good ? 'rgba(43,127,255,.30)' : 'rgba(216,51,63,.30)';
    ctx.beginPath(); ctx.moveTo(left.x, y); ctx.lineTo(right.x, y); ctx.lineTo(right.x, y - hgt); ctx.lineTo(left.x, y - hgt); ctx.closePath(); ctx.fill();
    const g = ctx.createLinearGradient(0, y - hgt, 0, y); g.addColorStop(0, good ? '#5aa1ff' : '#ff6a74'); g.addColorStop(1, good ? '#1f55c4' : '#9a1822');
    ctx.fillStyle = g; ctx.fillRect(left.x, y - hgt, right.x - left.x, hgt * 0.34);
    ctx.fillStyle = '#d9d2c3'; ctx.fillRect(left.x - 2 * s, y - hgt - 3 * s, 4 * s, hgt + 3 * s); ctx.fillRect(right.x - 2 * s, y - hgt - 3 * s, 4 * s, hgt + 3 * s);
    ctx.fillRect(left.x, y - hgt - 3 * s, right.x - left.x, 3 * s);
    const sym = o.op === 'x' ? '×' : o.op === '/' ? '÷' : '−';
    label(sym + o.v, (left.x + right.x) / 2, y - hgt * 0.56, clamp(52 * s, 16, 70), '#fff');
  }
  function drawBarrel(o, P, st) {
    const s = P.s * 1.25, fl = gfx.flash[o.id] && T - gfx.flash[o.id] < 0.08;
    ell(P.x, P.y, 14 * s, 5 * s); ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fill();
    rr(P.x - 12 * s, P.y - 30 * s, 24 * s, 30 * s, 5 * s); ctx.fillStyle = fl ? '#fff1d0' : '#a06d3a'; ctx.fill();
    ctx.fillStyle = fl ? '#ffe0a0' : '#5a5f6e'; ctx.fillRect(P.x - 12.5 * s, P.y - 24 * s, 25 * s, 3 * s); ctx.fillRect(P.x - 12.5 * s, P.y - 8 * s, 25 * s, 3 * s);
    ell(P.x, P.y - 30 * s, 12 * s, 4 * s); ctx.fillStyle = '#c28a4e'; ctx.fill();
    label('?', P.x, P.y - 40 * s, clamp(16 * s, 8, 30), '#ffe27a');
    badge(String(Math.ceil(o.hp)), P.x, P.y - 58 * s, P.s * 1.1, fl ? '#ffffff' : '#121724', fl ? '#111' : '#ffe27a');
  }
  function drawCrate(o, P) {
    const s = P.s * 1.7, fl = gfx.flash[o.id] && T - gfx.flash[o.id] < 0.08;
    ell(P.x, P.y, 20 * s, 6 * s); ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fill();
    rr(P.x - 18 * s, P.y - 28 * s, 36 * s, 28 * s, 3 * s); ctx.fillStyle = fl ? '#e9f2ff' : '#3a4a68'; ctx.fill();
    ctx.strokeStyle = '#ffcf5a'; ctx.lineWidth = 2.5 * s; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(P.x - 18 * s, P.y - 28 * s); ctx.lineTo(P.x + 18 * s, P.y); ctx.moveTo(P.x + 18 * s, P.y - 28 * s); ctx.lineTo(P.x - 18 * s, P.y); ctx.strokeStyle = 'rgba(255,207,90,.5)'; ctx.stroke();
    label(o.ally === 'turret' ? 'TURRET' : 'DRONE', P.x, P.y - 14 * s, clamp(7.5 * s, 7, 14), '#ffe27a');
    badge(String(Math.ceil(o.hp)), P.x, P.y - 42 * s, P.s * 1.3, '#121724', '#ffe27a');
  }
  function drawRecruit(o, P) {
    const m = Math.min(o.n, 12);
    for (let i = 0; i < m; i++) { const q = proj(P.d + (hash(i + o.id) - 0.5) * 0.9, o.x + (hash(i + 40 + o.id) - 0.5) * o.w * 1.6); man(q.x, q.y, q.s * 1.4, '#8d94a3', T, i + o.id); }
    badge('+' + o.n, P.x, P.y - 40 * P.s - 8, 1.3 * P.s / base * base, '#4b5160', '#fff');
  }
  function drawSpikes(o, P) {
    const gl = o.gx - o.gw, gr = o.gx + o.gw;
    for (let x = -1; x < 1; x += 0.1) {
      const mid = x + 0.05; if (mid > gl && mid < gr) continue;
      const a = proj(P.d, x), b = proj(P.d, x + 0.1);
      ctx.fillStyle = '#c9ced8'; ctx.beginPath(); ctx.moveTo(a.x + 1, a.y); ctx.lineTo(b.x - 1, b.y); ctx.lineTo((a.x + b.x) / 2, a.y - 22 * P.s); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#555c6a'; ctx.lineWidth = 1; ctx.stroke();
    }
    const a = proj(P.d, gl), b = proj(P.d, gr);
    ctx.fillStyle = 'rgba(80,255,140,.28)'; ctx.fillRect(a.x, a.y - 4 * P.s, b.x - a.x, 4 * P.s);
    label('▼', (a.x + b.x) / 2, a.y - 26 * P.s - Math.sin(T * 6) * 3, clamp(18 * P.s, 10, 26), '#7dffa8');
  }
  function drawWave(o, d, st) {
    const m = Math.min(Math.ceil(o.hp), 34), spread = o.w, ts = T + o.id;
    const list = [];
    for (let i = 0; i < m; i++) list.push({ i, dd: (hash(i * 3 + o.id) - 0.5) * 1.6, x: o.x + (hash(i * 7 + o.id + 3) - 0.5) * 2 * spread });
    list.sort((a, b) => b.dd - a.dd);
    for (const p of list) { const q = proj(d + p.dd, p.x); zombie(q.x, q.y, q.s * 1.5, ts, p.i, o.spit); }
    const top = proj(d, o.x);
    if (o.spit) for (let i = 0; i < 4; i++) { ell(top.x + (hash(i + o.id) - 0.5) * 50 * top.s, top.y - (30 + ((T * 30 + i * 9) % 30)) * top.s, 2.4 * top.s, 2.4 * top.s); ctx.fillStyle = 'rgba(150,255,90,.8)'; ctx.fill(); }
    badge(String(Math.ceil(o.hp)), top.x, top.y - 36 * top.s - 8, 1.2 * top.s / base, o.spit ? '#2d6b17' : '#a31d27', '#fff');
  }
  function drawGlob(g, P) {
    const s = P.s * 1.5;
    ell(P.x, P.y - 9 * s, 12 * s, 12 * s); ctx.fillStyle = 'rgba(140,255,80,.25)'; ctx.fill();
    ell(P.x, P.y - 9 * s, 6.5 * s, 6.5 * s); ctx.fillStyle = '#9dff4a'; ctx.fill(); ctx.strokeStyle = '#2e7a14'; ctx.lineWidth = 1.5; ctx.stroke();
    ell(P.x - 2 * s, P.y - 11 * s, 2 * s, 2 * s); ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fill();
  }
  function drawBoss(o, P, st) {
    const near = P.d < 2.2, slam = near && o.strikeT < 0.3;
    const hue = [95, 130, 20, 280, 190][(st.lvl + 0) % 5];
    ogre(P.x, P.y, P.s * 2.6, T, hue, slam);
  }
  function drawThrow(th, st) {
    const d = th.t * (st.blocked ? 0 : 5) + 1.0, P = proj(d, th.x), f = clamp(th.t / th.t0, 0, 1);
    ell(P.x, P.y, th.r * laneHalf * P.k * (1.1 - 0.3 * f), th.r * laneHalf * P.k * 0.28); ctx.fillStyle = 'rgba(255,40,40,' + (0.28 + 0.3 * (1 - f)) + ')'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,90,90,.9)'; ctx.lineWidth = 2; ctx.stroke();
    const y = P.y - f * H * 0.55, s = P.s * 2.1;
    if (th.kind === 'car') {
      rr(P.x - 22 * s, y - 14 * s, 44 * s, 12 * s, 3 * s); ctx.fillStyle = '#c23b3b'; ctx.fill();
      rr(P.x - 12 * s, y - 24 * s, 24 * s, 11 * s, 3 * s); ctx.fillStyle = '#9fd1ee'; ctx.fill();
      ell(P.x - 13 * s, y - 2 * s, 5 * s, 5 * s); ctx.fillStyle = '#111'; ctx.fill(); ell(P.x + 13 * s, y - 2 * s, 5 * s, 5 * s); ctx.fill();
    } else if (th.kind === 'rail') {
      ctx.fillStyle = '#8f879c'; ctx.fillRect(P.x - 26 * s, y - 8 * s, 52 * s, 5 * s); ctx.fillRect(P.x - 20 * s, y - 16 * s, 4 * s, 12 * s); ctx.fillRect(P.x + 16 * s, y - 16 * s, 4 * s, 12 * s);
    } else if (th.kind === 'container') {
      ctx.fillStyle = '#d4691f'; ctx.fillRect(P.x - 26 * s, y - 20 * s, 52 * s, 20 * s);
      ctx.fillStyle = 'rgba(0,0,0,.28)'; for (let i = 1; i < 7; i++) ctx.fillRect(P.x - 26 * s + i * 7.4 * s, y - 20 * s, 1.6 * s, 20 * s);
    } else {
      rr(P.x - 10 * s, y - 26 * s, 20 * s, 26 * s, 4 * s); ctx.fillStyle = '#202530'; ctx.fill(); ctx.fillStyle = '#f2c230'; ctx.fillRect(P.x - 10 * s, y - 16 * s, 20 * s, 4 * s);
    }
  }

  // ---------- frame ----------
  function draw(st) {
    ctx.save();
    if (gfx.shake > 0) ctx.translate((Math.random() - 0.5) * gfx.shake * 16, (Math.random() - 0.5) * gfx.shake * 16);
    sky(st.theme); ground(st.theme, st);
    const items = [];
    for (const o of st.objs) { if (o.dead) continue; const d = o.z - st.z; if (d < -3 || d > FAR) continue; items.push({ d, o }); }
    for (const g of st.globs) { const d = g.z - st.z; if (d > -2 && d < FAR) items.push({ d, o: g }); }
    items.push({ d: 0, o: { type: 'squad' } });
    items.sort((a, b) => b.d - a.d);
    for (const it of items) {
      const o = it.o, d = it.d;
      if (o.type === 'squad') { drawSquad(st); continue; }
      const P = proj(d, o.x != null ? o.x : (o.gx || 0)); P.d = d;
      ctx.globalAlpha = clamp((FAR - d) / 9, 0, 1);
      if (o.type === 'card') drawCard(o, P);
      else if (o.type === 'barrel') drawBarrel(o, P, st);
      else if (o.type === 'crate') drawCrate(o, P);
      else if (o.type === 'recruit') drawRecruit(o, P);
      else if (o.type === 'spikes') drawSpikes(o, P);
      else if (o.type === 'wave') drawWave(o, d, st);
      else if (o.type === 'glob') drawGlob(o, P);
      else if (o.type === 'boss') drawBoss(o, P, st);
      ctx.globalAlpha = 1;
    }
    // tracers
    ctx.lineCap = 'round';
    for (const t of gfx.tr) {
      const a = proj(0.7, t.x), b = proj(t.tz - st.z, t.tx);
      ctx.strokeStyle = 'rgba(255,230,140,' + clamp(t.life * 11, 0, 0.9) + ')'; ctx.lineWidth = Math.max(1, 2 * a.s);
      ctx.beginPath(); ctx.moveTo(a.x, a.y - 16 * a.s); ctx.lineTo(b.x, b.y - 16 * b.s); ctx.stroke();
    }
    for (const th of st.throws) drawThrow(th, st);
    // particles
    for (const p of gfx.parts) {
      const q = proj(p.z - st.z, p.x); ctx.globalAlpha = clamp(p.life * 2, 0, 1);
      ell(q.x + p.ox, q.y - p.oy * q.s, p.r * q.s, p.r * q.s); ctx.fillStyle = p.col; ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    hud(st);
  }

  function hud(st) {
    // red flash when hurt
    if (gfx.red > 0) { ctx.fillStyle = 'rgba(255,30,30,' + clamp(gfx.red * 0.45, 0, 0.45) + ')'; ctx.fillRect(0, 0, W, H); }
    // pops
    for (const p of gfx.pops) { ctx.globalAlpha = clamp(p.life * 1.6, 0, 1); label(p.text, p.sx, p.sy - (1 - p.life) * 60, p.size, p.col); }
    ctx.globalAlpha = 1;
    if (mode === 'menu') return;
    // header
    ctx.font = '900 16px ' + FONT; ctx.textAlign = 'left'; ctx.lineWidth = 4; ctx.strokeStyle = '#0a0a10';
    ctx.strokeText('LEVEL ' + st.lvl, 14, 22); ctx.fillStyle = '#ffe9b0'; ctx.fillText('LEVEL ' + st.lvl, 14, 22);
    ctx.font = '700 12px ' + FONT; ctx.fillStyle = '#c8c3d6'; ctx.lineWidth = 3; ctx.strokeText(R.THEMES[st.theme].name.toUpperCase(), 14, 40); ctx.fillText(R.THEMES[st.theme].name.toUpperCase(), 14, 40);
    // perk chips
    const chips = [];
    if (st.perks.rapid) chips.push('RAPID ×' + st.perks.rapid);
    if (st.perks.heavy) chips.push('HEAVY');
    if (st.perks.spread) chips.push('SPREAD');
    if (st.perks.pierce) chips.push('PIERCE');
    if (st.shield) chips.push('SHIELD ' + st.shield);
    let cy = 88;
    ctx.font = '900 11px ' + FONT;
    for (const c of chips) {
      const w = ctx.measureText(c).width + 14; rr(10, cy - 10, w, 20, 10); ctx.fillStyle = 'rgba(14,18,30,.8)'; ctx.fill(); ctx.strokeStyle = '#e8b04a'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#ffe9b0'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(c, 17, cy + 1); cy += 25;
    }
    // progress + boss bar
    const bo = st.boss;
    const prog = clamp(st.z / (L ? L.bossZ : 1), 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,.55)'; rr(W - 14 - 90, 16, 90, 8, 4); ctx.fill();
    ctx.fillStyle = '#e8b04a'; rr(W - 14 - 90, 16, 90 * prog, 8, 4); ctx.fill();
    if (bo && !bo.dead && bo.z - st.z < 40) {
      const bw = Math.min(W - 40, 300), bx = (W - bw) / 2, by = 50;
      ctx.fillStyle = 'rgba(0,0,0,.65)'; rr(bx - 2, by - 2, bw + 4, 16, 8); ctx.fill();
      const g = ctx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#d8333f'); g.addColorStop(1, '#ff7a45');
      ctx.fillStyle = g; rr(bx, by, Math.max(4, bw * clamp(bo.hp / bo.max, 0, 1)), 12, 6); ctx.fill();
      label('BOSS  ' + Math.ceil(Math.max(0, bo.hp)), W / 2, by + 6.5, 11, '#fff');
    }
    if (gfx.banner) { const b = gfx.banner; ctx.globalAlpha = clamp(b.life * 1.4, 0, 1); label(b.text, W / 2, H * 0.36 - (1 - b.life) * 14, clamp(W * 0.085, 22, 40), b.col); ctx.globalAlpha = 1; }
  }

  // ---------- effects from the sim ----------
  function pop(text, col, size, st) {
    const q = proj(0, st.x); gfx.pops.push({ text, col, size: size || 26, sx: q.x + (Math.random() - 0.5) * 30, sy: q.y - 130 * q.s, life: 1 });
  }
  function burst(st, x, z, col, n, big) {
    for (let i = 0; i < n; i++) gfx.parts.push({ x, z, ox: (Math.random() - 0.5) * 30, oy: Math.random() * 20, r: (big ? 5 : 3) + Math.random() * 3, col, life: 0.5 + Math.random() * 0.4, vy: 30 + Math.random() * 80, vx: (Math.random() - 0.5) * 80 });
  }
  function banner(text, col) { gfx.banner = { text, col: col || '#ffe27a', life: 1.2 }; }
  function fxStep(st, dt) {
    for (const e of st.fx) {
      switch (e.t) {
        case 'tr': gfx.tr.push({ x: e.x, tx: e.tx, tz: e.tz, life: 0.09 }); break;
        case 'hit': gfx.flash[e.id] = T; break;
        case 'card': if (e.d >= 0) pop('×' + e.v + '  +' + e.d, '#7fb6ff', 30, st); else pop((e.op === '/' ? '÷' : '−') + e.v + '  ' + e.d, '#ff7b84', 30, st); break;
        case 'gain': pop('+' + e.n, '#7dffa8', 28, st); break;
        case 'hurt': pop('−' + e.n, '#ff6b6b', clamp(20 + e.n * 0.3, 22, 40), st); gfx.shake = Math.max(gfx.shake, clamp(0.12 + e.n / 120, 0.1, 0.5)); gfx.red = Math.max(gfx.red, e.kind === 'boss' ? 0.8 : 0.35); break;
        case 'shield': pop('shield −' + e.n, '#8fd0ff', 18, st); break;
        case 'perk': banner(R.PERKS[e.perk].name.toUpperCase() + '!'); burst(st, e.x, e.z, '#ffd36a', 14, true); break;
        case 'ally': banner(R.ALLY[e.kind].name.toUpperCase() + ' ONLINE', '#8fd0ff'); burst(st, e.x, e.z, '#9fc8ff', 16, true); break;
        case 'allyDown': banner((R.ALLY[e.kind].name + ' lost').toUpperCase(), '#ff8a7a'); break;
        case 'zdie': burst(st, e.x, e.z, '#7bbf5a', 10, false); break;
        case 'splat': burst(st, e.x, e.z, '#9dff4a', 6, false); break;
        case 'strike': gfx.shake = 0.7; gfx.red = 1; break;
        case 'land': if (e.hit) { gfx.shake = Math.max(gfx.shake, 0.5); } burst(st, e.x, st.z + 1, '#c9c2d6', 8, true); break;
        case 'bossDown': banner('BOSS DOWN!', '#ffd76a'); burst(st, e.x, e.z, '#ffd36a', 30, true); break;
        case 'throw': break;
        default: break;
      }
    }
    st.fx.length = 0;
    for (const t of gfx.tr) t.life -= dt; gfx.tr = gfx.tr.filter(t => t.life > 0);
    for (const p of gfx.pops) p.life -= dt * 0.8; gfx.pops = gfx.pops.filter(p => p.life > 0);
    for (const p of gfx.parts) { p.life -= dt; p.ox += p.vx * dt; p.oy += p.vy * dt; p.vy -= 120 * dt; } gfx.parts = gfx.parts.filter(p => p.life > 0);
    gfx.shake = Math.max(0, gfx.shake - dt * 2); gfx.red = Math.max(0, gfx.red - dt * 1.6);
    if (gfx.banner) { gfx.banner.life -= dt * 0.8; if (gfx.banner.life <= 0) gfx.banner = null; }
  }

  // ---------- screens ----------
  function show(html, cls) { screen.className = 'screen' + (cls ? ' ' + cls : ''); screen.innerHTML = html; screen.hidden = false }
  function hide() { screen.hidden = true; screen.innerHTML = ''; }
  function menu() {
    mode = 'menu'; resetGfx();
    demo = R.newState(R.levelFor(1)); demo.fxOn = true;
    const lv = save.level;
    show('<h1 class="logo">Rampart<br>Run</h1>' +
      '<p class="sub">Lead the warband. Multiply your squad and shoot through the horde.</p>' +
      '<button class="btn" data-act="play" data-focus>' + (lv > 1 ? 'Play level ' + lv : 'Play') + '</button>' +
      (lv > 1 ? '<button class="btn ghost" data-act="restart">Start from level 1</button>' : '') +
      '<ul class="how">' +
      '<li><b>Drag</b> left and right to steer. The squad runs and shoots by itself.</li>' +
      '<li>Run through <b>×3</b> banners to multiply your soldiers. Red ones shrink them. Grey crowds add recruits.</li>' +
      '<li><b>Shoot barrels</b> open for a perk. The number is the bullets left.</li>' +
      '<li>Zombies and their acid spit kill soldiers. <b>Shoot them first.</b> The boss only hurts you if it reaches you.</li></ul>');
  }
  function startLevel(lvl) {
    L = R.levelFor(lvl); S = R.newState(L); S.fxOn = true;
    mode = 'ready'; resetGfx(); target = 0; acc = 0;
    show('', 'clear'); screen.innerHTML = '<div class="hint" style="position:static">' + (lvl === 1 ? 'Drag to steer. Hold your lane to shoot a barrel open.' : 'Drag to start') + '</div>';
    screen.style.pointerEvents = 'none';
  }
  function begin() { if (mode !== 'ready') return; mode = 'play'; hide(); screen.style.pointerEvents = ''; }
  function finish() {
    mode = 'done'; gfx.doneAt = T;
    setTimeout(() => {
      if (mode !== 'done') return;
      if (S.won) {
        save.level = Math.max(save.level, S.lvl + 1); save.best = Math.max(save.best, S.lvl); persist();
        show('<p class="big win">Level ' + S.lvl + ' cleared</p><p class="stat"><b>' + S.n + '</b> soldiers survived</p><p class="stat">Lost ' + S.lost + ' on the way</p>' +
          '<button class="btn" data-act="next" data-focus>Next level</button><button class="btn ghost" data-act="menu">Menu</button>', 'clear');
      } else {
        const bo = S.boss, left = bo ? Math.round(100 * clamp(bo.hp / bo.max, 0, 1)) : 100;
        show('<p class="big lose">The squad fell</p><p class="stat">Boss health left: <b>' + left + '%</b></p>' +
          '<button class="btn" data-act="retry" data-focus>Try again</button><button class="btn ghost" data-act="menu">Menu</button>', 'clear');
      }
    }, 900);
  }
  screen.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.getAttribute('data-act');
    if (a === 'play') startLevel(save.level);
    else if (a === 'restart') { save.level = 1; persist(); startLevel(1); }
    else if (a === 'next') startLevel(S.lvl + 1);
    else if (a === 'retry') startLevel(S.lvl);
    else if (a === 'menu') menu();
  });

  // ---------- input ----------
  cv.addEventListener('pointerdown', e => {
    if (mode !== 'play' && mode !== 'ready') return;
    dragging = true; dragX0 = e.clientX; dragT0 = target; try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    begin();
  });
  cv.addEventListener('pointermove', e => { if (dragging) target = clamp(dragT0 + ((e.clientX - dragX0) / laneHalf) * 1.25, -1, 1); });
  const up = () => { dragging = false; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'a', 'd'].includes(k)) { keys[k] = true; if (mode === 'ready') begin(); e.preventDefault(); }
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { last = 0; });

  // ---------- loop ----------
  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts; T += dt;
    if (mode === 'play') {
      const dir = (keys.arrowright || keys.d ? 1 : 0) - (keys.arrowleft || keys.a ? 1 : 0);
      if (dir) target = clamp(target + dir * 2.0 * dt, -1, 1);
      acc += dt;
      while (acc >= R.DT && !S.over) { R.step(S, { x: target }); acc -= R.DT; }
      fxStep(S, dt);
      if (S.over) finish();
      draw(S);
    } else if (mode === 'ready' || mode === 'done') {
      if (mode === 'done') { acc = 0; }
      fxStep(S, dt); draw(S);
    } else {
      if (demo.over) { demo = R.newState(R.levelFor(1 + ((T / 20) | 0) % 4)); demo.fxOn = true; }
      acc += dt;
      while (acc >= R.DT && !demo.over) { R.step(demo, { x: R.autoX(demo, Math.sin(demo.t * 0.5) * 0.5, true) }); acc -= R.DT; }
      fxStep(demo, dt); L = null; draw(demo);
    }
  }

  window.__rr = { get S() { return S; }, get mode() { return mode; }, start: startLevel, setTarget: x => { target = x; }, begin };
  resize();
  menu();
  requestAnimationFrame(frame);
})();
