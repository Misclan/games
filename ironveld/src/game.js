/* Ironveld UI. All rules live in sim.js; this file only draws state and forwards clicks. */
(function () {
  'use strict';
  var G = window.Ironveld;
  var SAVE_KEY = 'ironveld.save.v1';
  var S;
  var ui = { tab: 'hold', qty: { pike: 5, bow: 5, rider: 3, siege: 2 }, dispatch: null, battle: null, modal: null, lastTick: 0, lastSave: 0 };
  var dirty = {};
  var pending = [];

  /* ---------- helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function icon(n) { return '<svg class="ic" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; }
  function fmt(n) { n = Math.floor(n + 1e-6); return n >= 10000 ? (n / 1000).toFixed(1) + 'k' : String(n); }
  function mmss(ms) { var t = Math.max(0, Math.ceil(ms / 1000)); var m = Math.floor(t / 60), s = t % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function costAttr(c) { return Object.keys(c).map(function (r) { return r + ':' + c[r]; }).join('|'); }
  function costHTML(c) {
    var h = '<span class="cost">';
    Object.keys(c).forEach(function (r) { h += '<span class="c" data-r="' + r + '" data-n="' + c[r] + '">' + icon(r) + fmt(c[r]) + '</span>'; });
    return h + '</span>';
  }
  function unitName(k, n) { return n === 1 ? G.UNITS[k].name.toLowerCase() : G.UNITS[k].plural.toLowerCase(); }
  function lostText(lost) {
    var parts = [];
    G.UNIT_ORDER.forEach(function (k) { if (lost[k]) parts.push(lost[k] + ' ' + unitName(k, lost[k])); });
    return parts.length ? parts.join(', ') : 'none';
  }
  function lootHTML(l) {
    if (!l) return '';
    var h = '<div class="lootrow">';
    G.RES.forEach(function (r) { if (l[r]) h += '<span class="cost"><span class="c" data-r="' + r + '">' + icon(r) + '+' + fmt(l[r]) + '</span></span>'; });
    return h + '</div>';
  }

  /* ---------- save / load ---------- */
  function load() {
    var raw = null;
    try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { raw = null; }
    var s = raw ? G.deserialize(raw) : null;
    return s;
  }
  function save() { try { localStorage.setItem(SAVE_KEY, G.serialize(S)); } catch (e) { /* storage unavailable: play on without saving */ } ui.lastSave = Date.now(); }

  /* ---------- toasts ---------- */
  function toast(text, opt) {
    opt = opt || {};
    var box = $('toasts');
    while (box.children.length >= 3) box.removeChild(box.firstChild);
    var d = document.createElement('div');
    d.className = 'toast' + (opt.kind ? ' ' + opt.kind : '');
    d.innerHTML = '<span>' + esc(text) + '</span>' + (opt.label ? '<button class="btn small" data-act="' + opt.act + '" data-id="' + opt.id + '">' + esc(opt.label) + '</button>' : '');
    box.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, opt.ms || 4500);
  }

  /* ---------- static header ---------- */
  function buildHeader() {
    var h = '';
    G.RES.forEach(function (r) {
      var col = 'var(--' + r + ')';
      h += '<div class="chip" data-r="' + r + '" style="--c:' + col + '"><div class="row">' + icon(r) + '<span class="v">0</span><span class="rate"></span></div><div class="of"></div><i class="fill"></i></div>';
    });
    $('res').innerHTML = h;
  }
  function updateHeader() {
    var rates = G.rates(S), cap = G.storageCap(S);
    G.RES.forEach(function (r) {
      var chip = document.querySelector('.chip[data-r="' + r + '"]');
      chip.querySelector('.v').textContent = fmt(S.res[r]);
      chip.querySelector('.rate').textContent = '+' + rates[r].toFixed(1) + '/s';
      var full = S.res[r] >= cap - 0.5;
      chip.classList.toggle('full', full);
      chip.querySelector('.of').textContent = full ? 'Storage full, spend it' : 'of ' + fmt(cap);
      chip.querySelector('.fill').style.width = Math.min(100, 100 * S.res[r] / cap) + '%';
    });
    var won = S.stats.wins;
    $('rank').textContent = S.won ? 'Citadel taken' : (won ? plural(won, 'battle won', 'battles won') : 'New warden');
  }

  /* ---------- tutorial coach ---------- */
  var COACH = [
    'Your first goal: train 10 more pikemen. Open the Army tab and press Train.',
    'Send them to the goblin camp next to your keep. Open the Map tab and tap the glowing camp.',
    'Your troops are marching out. The battle plays when they arrive.',
    'Well fought. Grow your income: upgrade any building.'
  ];
  function updateCoach() {
    var box = $('coach');
    if (S.tut >= 4) { box.hidden = true; } else {
      box.hidden = false;
      box.innerHTML = '<span>' + esc(COACH[S.tut]) + '</span><button data-act="skip-tut">Skip</button>';
    }
    var hintTab = S.tut === 0 ? 'army' : S.tut === 1 ? 'map' : S.tut === 3 ? 'hold' : '';
    document.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('hint', t.dataset.tab === hintTab && ui.tab !== hintTab); });
  }

  /* ---------- panels ---------- */
  function renderHold() {
    var busy = S.queue.length;
    var h = '<p class="note" style="margin-bottom:8px">Builders at work: ' + busy + ' of ' + G.BUILDER_SLOTS + '</p>';
    G.BUILDING_ORDER.forEach(function (id) {
      var b = G.BUILDINGS[id], lvl = G.levelOf(S, id);
      var q = S.queue.filter(function (x) { return x.id === id; })[0];
      h += '<article class="card"><div class="ti">' + icon(b.icon) + '</div><div><h3>' + b.name + '<span class="lvl">' + (lvl ? 'level ' + lvl : 'not built') + '</span></h3>';
      h += '<p class="eff">' + esc(lvl ? G.describeLevel(id, lvl) : b.blurb) + '</p>';
      if (lvl && lvl < G.MAX_LEVEL) h += '<p>Next level: ' + esc(G.describeLevel(id, lvl + 1)) + '</p>';
      if (q) h += '<div class="bar" data-bar="' + q.start + ',' + q.finish + '"><i></i></div><p>Upgrading to level ' + q.to + ', <span data-cd="' + q.finish + '"></span> left</p>';
      h += '</div><div class="act">';
      if (q) h += '<span class="time">' + icon('clock') + 'Building</span>';
      else if (lvl >= G.MAX_LEVEL) h += '<span class="maxed">Fully upgraded</span>';
      else {
        var cost = G.upgradeCost(id, lvl);
        h += '<button class="btn primary" data-act="upgrade" data-id="' + id + '" data-cost="' + costAttr(cost) + '">' + (lvl ? 'Upgrade' : 'Build') + '</button>' + costHTML(cost) + '<span class="time">' + icon('clock') + mmss(G.upgradeTime(lvl + 1)) + '</span>';
      }
      h += '</div></article>';
    });
    $('hold').innerHTML = h;
  }

  function awayCount(k) { var n = 0; S.marches.forEach(function (m) { n += m.units[k] || 0; }); return n; }
  function trainingCount(k) { var n = 0; S.training.forEach(function (t) { if (t.unit === k) n += t.count; }); return n; }
  function maxTrain(k) {
    var c = G.UNITS[k].cost, m = 50;
    Object.keys(c).forEach(function (r) { m = Math.min(m, Math.floor(S.res[r] / c[r])); });
    return Math.max(1, m);
  }
  function beatsText(k) {
    var out = [];
    Object.keys(G.ADV[k] || {}).forEach(function (t) { out.push(t === 'brute' ? 'brutes' : G.UNITS[t].plural.toLowerCase()); });
    return out.length ? 'Strong against ' + out.join(' and ') + '.' : '';
  }
  function passiveText(id) {
    var h = G.HEROES[id], p = [];
    if (h.hp) p.push('+' + +(h.hp * 100).toFixed(1) + '% health');
    if (h.atk) p.push('+' + +(h.atk * 100).toFixed(1) + '% damage');
    return p.join(' and ') + ' per level';
  }

  function renderArmy() {
    var h = '<div class="sub">Troops</div>';
    G.UNIT_ORDER.forEach(function (k) {
      var u = G.UNITS[k], locked = G.levelOf(S, 'barracks') < u.needs;
      var n = ui.qty[k] || 1;
      h += '<article class="card unit' + (locked ? ' locked' : '') + '"><div class="ti">' + icon(u.icon) + '</div><div><h3>' + u.plural + '</h3>';
      h += '<p class="eff">At home ' + (S.units[k] || 0) + (awayCount(k) ? ', away ' + awayCount(k) : '') + (trainingCount(k) ? ', training ' + trainingCount(k) : '') + '</p>';
      h += '<p>Health ' + u.hp + ', attack ' + u.atk + '. ' + esc(beatsText(k)) + '</p></div><div class="act">';
      if (locked) h += '<span class="note">Needs Barracks level ' + u.needs + '</span>';
      else {
        var cost = {};
        Object.keys(u.cost).forEach(function (r) { cost[r] = u.cost[r] * n; });
        h += '<div class="stepper"><button data-act="qty" data-u="' + k + '" data-d="-1" aria-label="Fewer">&minus;</button><output>' + n + '</output><button data-act="qty" data-u="' + k + '" data-d="1" aria-label="More">+</button></div>';
        h += '<button class="btn small" data-act="qty-max" data-u="' + k + '">Max</button>';
        h += '<button class="btn primary" data-act="train" data-u="' + k + '" data-cost="' + costAttr(cost) + '">Train ' + n + '</button>' + costHTML(cost) + '<span class="time">' + icon('clock') + mmss(n * u.ms * G.trainFactor(S)) + '</span>';
      }
      h += '</div></article>';
    });
    if (S.training.length) {
      h += '<div class="sub">In training</div>';
      S.training.forEach(function (t) {
        h += '<div class="march"><span>' + icon(G.UNITS[t.unit].icon) + '</span><span>' + plural(t.count, G.UNITS[t.unit].name.toLowerCase(), G.UNITS[t.unit].plural.toLowerCase()) + '</span><small data-cd="' + t.finish + '"></small><div class="bar" data-bar="' + t.start + ',' + t.finish + '"><i></i></div></div>';
      });
    }
    h += '<div class="sub">Heroes</div>';
    var cap = G.heroCap(S);
    G.HERO_ORDER.forEach(function (id) {
      var d = G.HEROES[id], own = S.heroes[id];
      h += '<article class="card unit' + (!own && G.levelOf(S, 'hall') < d.hall ? ' locked' : '') + '"><div class="ti">' + icon('star') + '</div><div><h3>' + d.name + (own ? '<span class="lvl">level ' + own.level + ' of ' + cap + '</span>' : '') + '</h3>';
      h += '<p class="eff">' + d.title + '. ' + passiveText(id) + '.</p>';
      h += '<p><b>' + d.skill.name + ':</b> ' + esc(d.skill.text) + '</p>';
      if (own) {
        var need = G.xpNeed(own.level);
        h += own.level >= cap ? '<p>Level cap reached. Upgrade the Hero hall to train further.</p>' : '<div class="bar xp" data-w="' + Math.min(100, 100 * own.xp / need) + '"><i></i></div><p>' + own.xp + ' of ' + need + ' experience</p>';
        if (G.heroBusy(S, id)) h += '<p>Out on a march.</p>';
      }
      h += '</div><div class="act">';
      if (!own) {
        if (G.levelOf(S, 'hall') < d.hall) h += '<span class="note">Needs Hero hall level ' + d.hall + '</span>';
        else h += '<button class="btn primary" data-act="recruit" data-id="' + id + '" data-cost="' + costAttr(d.cost) + '">Recruit</button>' + costHTML(d.cost);
      }
      h += '</div></article>';
    });
    $('army').innerHTML = h;
    document.querySelectorAll('.bar[data-w]').forEach(function (b) { b.firstChild.style.width = b.dataset.w + '%'; });
  }

  function hintTile() {
    if (S.tut !== 1) return null;
    var t = S.tiles.filter(function (x) { return x.kind === 'camp' && x.comp === 'goblins' && G.dist(x.x, x.y) === 1 && G.tileState(S, x, Date.now()) === 'ready'; })[0];
    return t || null;
  }
  function tileLabel(t) {
    if (t.kind === 'base') return 'Your keep';
    if (t.kind === 'node') return G.NODE_NAMES[t.res] + ', pays ' + t.res;
    if (t.kind === 'citadel') return 'Ironlord Citadel, level ' + t.level;
    if (t.kind === 'camp') return G.COMPS[t.comp].name + ', level ' + t.level;
    return 'Open ground';
  }
  function renderMap() {
    var now = Date.now(), hint = hintTile();
    var regionName = G.REGIONS[(S.region - 1) % G.REGIONS.length];
    if (S.region > G.REGIONS.length) regionName += ' ' + (1 + Math.floor((S.region - 1) / G.REGIONS.length));
    var h = '<div class="frontier"><div><b>Frontier ' + S.region + ': ' + esc(regionName) + '</b><small>Take the level ' + G.tileAt(S, G.CITADEL.x, G.CITADEL.y).level + ' Ironlord Citadel to open the next map.</small></div>';
    if (S.won) h += '<button class="btn small primary" data-act="next-region">Open next frontier</button>';
    h += '</div>';
    if (S.raid && S.raid.phase === 'incoming') {
      var source = G.tileAt(S, S.raid.x, S.raid.y);
      h += '<div class="raid-warning" role="status"><b>Raid approaching</b><span>' + esc(G.COMPS[source.comp].name) + ' is marching on your keep.</span><small>Arrival in <i data-cd="' + S.raid.arriveAt + '"></i></small></div>';
    }
    h += '<div class="grid" data-region="' + (((S.region - 1) % G.REGIONS.length) + 1) + '" role="group" aria-label="World map">';
    S.tiles.forEach(function (t) {
      var st = G.tileState(S, t, now);
      var cls = 'tile t' + t.terrain + (st === 'cooldown' ? ' cool' : '') + (st === 'targeted' ? ' out' : '') + (hint === t ? ' hint' : '');
      var inner = '', style = '';
      if (t.kind === 'base') inner = icon('base');
      else if (t.kind === 'camp') inner = icon('camp') + '<span class="lv">' + t.level + '</span>';
      else if (t.kind === 'citadel') inner = icon('citadel') + '<span class="lv">' + t.level + '</span>';
      else if (t.kind === 'node') { inner = icon(t.res); style = ' style="--c:var(--' + t.res + ')"'; }
      if (st === 'cooldown') inner += '<span class="cd" data-cd="' + t.readyAt + '" data-rerender="1"></span>';
      if (t.kind === 'camp' || t.kind === 'node' || t.kind === 'citadel')
        h += '<button class="' + cls + '" data-act="tile" data-x="' + t.x + '" data-y="' + t.y + '" data-k="' + t.kind + '"' + style + ' aria-label="' + esc(tileLabel(t)) + '">' + inner + '</button>';
      else h += '<div class="' + cls + '" data-k="' + t.kind + '" role="img" aria-label="' + esc(tileLabel(t)) + '">' + inner + '</div>';
    });
    h += '</div><div class="legend"><span class="a">' + icon('camp') + 'Monster camp (number is its level)</span><span class="b">' + icon('node') + 'Resource node</span><span class="c">' + icon('citadel') + 'Ironlord Citadel</span></div>';
    $('map').innerHTML = h;

    var m = '';
    S.marches.forEach(function (mm) {
      var t = G.tileAt(S, mm.x, mm.y), out = mm.phase === 'out';
      var end = out ? mm.arrive : mm.ret, start = out ? mm.depart : mm.arrive;
      var total = 0; G.UNIT_ORDER.forEach(function (k) { total += mm.units[k] || 0; });
      m += '<div class="march"><span>' + icon('go') + '</span><span>' + (out ? 'Marching to ' : 'Returning from ') + esc(tileLabel(t).split(',')[0].toLowerCase()) + '<br><small>' + plural(total, 'soldier', 'soldiers') + (mm.hero ? ' led by ' + esc(G.HEROES[mm.hero].name.split(' ')[0]) : '') + '</small></span><small data-cd="' + end + '"></small><div class="bar" data-bar="' + start + ',' + end + '"><i></i></div></div>';
    });
    $('marches').innerHTML = m;
  }

  function renderReports() {
    var h = '';
    if (!S.reports.length) h += '<p class="empty">No battles yet. Send troops to a monster camp on the map.</p>';
    S.reports.forEach(function (r) {
      h += '<article class="rep' + (r.seen ? '' : ' unseen') + '"><div><h3><span class="pill ' + (r.win ? 'win' : 'lose') + '">' + (r.win ? 'Victory' : 'Defeat') + '</span> ' + esc(r.name) + ', level ' + r.level + '</h3>';
      h += '<p>' + r.rounds + ' rounds. Lost: ' + esc(lostText(r.lost)) + '.' + (r.hero ? ' Hero: ' + esc(G.HEROES[r.hero].name.split(' ')[0]) + '.' : '') + '</p></div><button class="btn small" data-act="replay" data-id="' + r.id + '">Watch</button></article>';
    });
    h += '<div class="foot"><span>Won ' + S.stats.wins + ', lost ' + S.stats.losses + '. Troops lost ' + S.stats.lost + '. Enemies beaten ' + S.stats.killed + '.</span><button class="link" data-act="reset">Start over</button></div>';
    $('reports').innerHTML = h;
    $('repdot').hidden = !S.reports.some(function (r) { return !r.seen; });
  }

  function flush() {
    if (dirty.hold) renderHold();
    if (dirty.army) renderArmy();
    if (dirty.map) renderMap();
    if (dirty.reports) renderReports();
    dirty = {};
    tickDynamic();
  }
  function markAll() { dirty = { hold: 1, army: 1, map: 1, reports: 1 }; }
  function setTab(t) {
    ui.tab = t; $('main').dataset.tab = t;
    document.querySelectorAll('.tab').forEach(function (b) { b.setAttribute('aria-current', b.dataset.tab === t ? 'true' : 'false'); });
    updateCoach(); window.scrollTo(0, 0);
  }

  /* ---------- live bits that change every tick ---------- */
  function tickDynamic() {
    var now = Date.now();
    document.querySelectorAll('[data-cd]').forEach(function (e) {
      var left = +e.dataset.cd - now;
      e.textContent = mmss(left);
      if (left <= 0 && e.dataset.rerender) dirty.map = 1;
    });
    document.querySelectorAll('[data-bar]').forEach(function (e) {
      var p = e.dataset.bar.split(',');
      var f = (now - +p[0]) / Math.max(1, +p[1] - +p[0]);
      e.firstChild.style.width = Math.max(0, Math.min(1, f)) * 100 + '%';
    });
    document.querySelectorAll('[data-cost]').forEach(function (b) {
      var ok = true;
      b.dataset.cost.split('|').forEach(function (x) { var p = x.split(':'); if (S.res[p[0]] < +p[1]) ok = false; });
      b.classList.toggle('cant', !ok);
    });
    document.querySelectorAll('.cost .c[data-n]').forEach(function (c) { c.classList.toggle('short', S.res[c.dataset.r] < +c.dataset.n); });
  }

  /* ---------- modal plumbing ---------- */
  function showModal(kind) { ui.modal = kind; $('modal').hidden = false; $('sheet').scrollTop = 0; $('sheet').focus(); }
  function closeModal() {
    if (ui.battle && ui.battle.timer) clearTimeout(ui.battle.timer);
    if (ui.battle && !ui.battle.rep.seen) { ui.battle.rep.seen = true; dirty.reports = 1; }
    ui.battle = null; ui.dispatch = null; ui.modal = null; $('modal').hidden = true; $('sheet').innerHTML = '';
    save(); flush(); updateHeader(); updateCoach();
  }

  /* ---------- dispatch (march planner) ---------- */
  function openDispatch(x, y) {
    var t = G.tileAt(S, x, y), left = G.marchCapacity(S), units = {}, rows = {}, hero = null;
    G.UNIT_ORDER.forEach(function (k) { var n = Math.min(S.units[k] || 0, left); if (n > 0) { units[k] = n; left -= n; } rows[k] = G.UNITS[k].row; });
    G.HERO_ORDER.forEach(function (id) { if (!hero && S.heroes[id] && !G.heroBusy(S, id)) hero = id; });
    ui.dispatch = { x: x, y: y, units: units, rows: rows, hero: hero, timing: 'open' };
    showModal('dispatch'); renderDispatch();
  }
  function counterHint(type) {
    var who = G.UNIT_ORDER.filter(function (u) { return G.adv(u, type) > 1; }).map(function (u) { return G.UNITS[u].plural.toLowerCase(); });
    return who.length ? 'beaten by ' + who.join(' and ') : '';
  }
  function renderDispatch() {
    var d = ui.dispatch, t = G.tileAt(S, d.x, d.y), isNode = t.kind === 'node';
    var cap = G.marchCapacity(S), total = G.unitTotal(d.units);
    var h = '<button class="btn small close" data-act="close">Close</button><h2>' + esc(isNode ? G.NODE_NAMES[t.res] : G.COMPS[t.comp].name) + '</h2>';
    h += '<p class="lead">' + (isNode ? 'Unguarded. Your troops gather ' + t.res + ' and come home.' : 'Level ' + t.level + '. Scouts report these defenders:') + '</p>';
    if (!isNode) {
      var army = G.campArmy(t.level, t.comp);
      army.forEach(function (q) {
        h += '<div class="enemy">' + icon(q.icon) + '<div><b>' + q.count + ' ' + esc(q.name) + '</b><small>' + (q.row === 'front' ? 'Front line' : 'Back line') + (counterHint(q.type) ? ', ' + counterHint(q.type) : '') + '</small></div></div>';
      });
    }
    h += '<div class="block-t">Your march: ' + total + ' of ' + cap + ' troops</div>';
    G.UNIT_ORDER.forEach(function (k) {
      var u = G.UNITS[k], have = S.units[k] || 0;
      if (G.levelOf(S, 'barracks') < u.needs && !have) return;
      var n = d.units[k] || 0;
      h += '<div class="sendrow"><div class="nm">' + icon(u.icon) + ' ' + u.plural + ' <small>' + have + ' at home</small></div><div class="ctl">';
      h += '<div class="stepper"><button data-act="d-dec" data-u="' + k + '" aria-label="Fewer ' + u.plural + '">&minus;</button><output>' + n + '</output><button data-act="d-inc" data-u="' + k + '" aria-label="More ' + u.plural + '">+</button></div>';
      h += '<button class="btn small" data-act="d-max" data-u="' + k + '">All</button>';
      if (!isNode) h += '<div class="seg" role="group" aria-label="Line for ' + u.plural + '"><button data-act="d-row" data-u="' + k + '" data-v="front" aria-pressed="' + (d.rows[k] === 'front') + '">Front</button><button data-act="d-row" data-u="' + k + '" data-v="back" aria-pressed="' + (d.rows[k] === 'back') + '">Back</button></div>';
      h += '</div></div>';
    });
    if (!isNode) {
      h += '<div class="block-t">Hero</div><div class="herobox"><div class="seg"><button data-act="d-hero" data-id="" aria-pressed="' + (!d.hero) + '">None</button>';
      G.HERO_ORDER.forEach(function (id) {
        if (!S.heroes[id]) return;
        var busy = G.heroBusy(S, id);
        h += '<button data-act="d-hero" data-id="' + id + '" aria-pressed="' + (d.hero === id) + '"' + (busy ? ' disabled title="Out on a march"' : '') + '>' + esc(G.HEROES[id].name.split(' ')[0]) + ' (level ' + S.heroes[id].level + ')</button>';
      });
      h += '</div></div>';
      if (d.hero) {
        h += '<p class="note" style="margin-top:6px"><b>' + G.HEROES[d.hero].skill.name + ':</b> ' + esc(G.HEROES[d.hero].skill.text) + '</p>';
        h += '<div class="block-t">Use the skill</div><div class="seg">';
        Object.keys(G.TIMINGS).forEach(function (k) { h += '<button data-act="d-timing" data-v="' + k + '" aria-pressed="' + (d.timing === k) + '">' + G.TIMINGS[k] + '</button>'; });
        h += '</div>';
      }
      var f = total ? G.forecast(S, d) : null;
      h += '<div class="forecast">';
      if (!f) h += 'Pick at least one soldier to see the scouts’ forecast.';
      else {
        var cls = f.verdict === 'Easy win' || f.verdict === 'Likely win' ? 'good' : f.verdict === 'Risky' ? 'warn' : 'bad';
        h += '<span class="pill ' + cls + '">' + f.verdict + '</span>Scouts replayed this fight ' + f.of + ' times and you won ' + f.wins + '.' + (f.wins ? ' You usually keep about ' + f.avgLeft + '% of your army.' : '');
      }
      h += '</div>';
    } else {
      var est = G.nodeLoot(t, total);
      h += '<div class="forecast">Expected haul' + lootHTML(est) + '</div>';
    }
    var travel = G.dist(d.x, d.y) * G.TRAVEL_MS_PER_TILE * 2;
    h += '<p class="note" style="margin-top:8px">' + icon('clock') + ' Out and back: ' + mmss(travel) + '.</p>';
    h += '<div class="actions"><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="d-go">' + (isNode ? 'Send troops' : 'March to battle') + '</button></div>';
    $('sheet').innerHTML = h;
  }
  function setUnits(k, n) {
    var d = ui.dispatch, others = G.unitTotal(d.units) - (d.units[k] || 0);
    n = Math.max(0, Math.min(n, S.units[k] || 0, G.marchCapacity(S) - others));
    if (n) d.units[k] = n; else delete d.units[k];
  }

  /* ---------- battle viewer ---------- */
  function sqHTML(q, i) {
    return '<div class="sq ' + q.side + '" data-i="' + i + '"><div class="t">' + icon(q.icon) + '<span>' + esc(q.name) + '</span></div><div class="n"><span class="cnt">' + q.count0 + '</span> <small>of ' + q.count0 + '</small></div><div class="hpbar"><i></i></div></div>';
  }
  function lane(rep, side, row) {
    var out = '';
    rep.squads.forEach(function (q, i) { if (q.side === side && q.row === row) out += sqHTML(q, i); });
    return out ? '<div class="lane-t">' + (side === 'e' ? 'Enemy ' : 'Your ') + (row === 'front' ? 'front line' : 'back line') + '</div><div class="lane">' + out + '</div>' : '';
  }
  function openBattle(rep, live) {
    if (ui.battle && ui.battle.timer) clearTimeout(ui.battle.timer);
    var h = '<div class="bhead"><h2>' + esc(rep.name) + ', level ' + rep.level + '</h2><div class="seg" role="group" aria-label="Playback speed"><button data-act="speed" data-v="1" aria-pressed="' + (S.prefs.speed === 1) + '">1×</button><button data-act="speed" data-v="2" aria-pressed="' + (S.prefs.speed === 2) + '">2×</button><button data-act="skip">Skip</button></div></div>';
    h += '<div class="arena">' + lane(rep, 'e', 'back') + lane(rep, 'e', 'front') + '<div class="clash"><span>Round <b id="brd">0</b> of ' + rep.rounds + '</span><span>' + (rep.hero ? esc(G.HEROES[rep.hero].name.split(' ')[0]) + ' leads your troops' : 'No hero') + '</span></div>' + lane(rep, 'p', 'front') + lane(rep, 'p', 'back') + '</div>';
    h += '<div class="blog" id="blog" aria-live="polite"></div><div id="bres"></div>';
    $('sheet').innerHTML = h;
    ui.battle = { rep: rep, k: 0, timer: null, live: !!live };
    showModal('battle');
    applyFrame(0, false);
    schedule();
  }
  function applyFrame(k, animate) {
    var b = ui.battle; if (!b) return;
    var f = b.rep.frames[k];
    var sheet = $('sheet');
    f.c.forEach(function (c, i) {
      var el = sheet.querySelector('.sq[data-i="' + i + '"]'); if (!el) return;
      el.querySelector('.cnt').textContent = c;
      el.querySelector('.hpbar i').style.width = f.h[i] + '%';
      el.classList.toggle('dead', c === 0);
    });
    if (animate && f.hits.length) {
      var seen = {};
      f.hits.forEach(function (p) { seen[p[1]] = 1; });
      Object.keys(seen).forEach(function (i) { var el = sheet.querySelector('.sq[data-i="' + i + '"]'); if (el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); } });
    }
    $('brd').textContent = k;
    var log = $('blog');
    b.rep.log.forEach(function (l) {
      if (l.r === k) { var d = document.createElement('div'); d.className = l.kind; d.textContent = 'Round ' + l.r + ': ' + l.text; log.appendChild(d); while (log.children.length > 3) log.removeChild(log.firstChild); }
    });
  }
  function schedule() {
    var b = ui.battle; if (!b) return;
    b.timer = setTimeout(function () {
      b.k++; applyFrame(b.k, true);
      if (b.k >= b.rep.frames.length - 1) finishBattle(); else schedule();
    }, 650 / S.prefs.speed);
  }
  function finishBattle() {
    var b = ui.battle; if (!b) return;
    clearTimeout(b.timer); b.timer = null;
    var r = b.rep; r.seen = true; dirty.reports = 1;
    var h = '<div class="result ' + (r.win ? 'win' : 'lose') + '"><h3>' + (r.win ? 'Victory' : 'Defeat') + '</h3>';
    h += '<p>' + (r.win ? 'The defenders are broken after ' + r.rounds + ' rounds.' : 'Your troops could not break them in ' + r.rounds + ' rounds.') + ' Lost: ' + esc(lostText(r.lost)) + '.</p>';
    if (r.win && r.loot) h += '<p>Loot comes home with your troops:</p>' + lootHTML(r.loot);
    if (r.hero) h += '<p>' + esc(G.HEROES[r.hero].name.split(' ')[0]) + ' earned ' + r.heroXp + ' experience.</p>';
    if (!r.win) h += '<p>Tip: check the scouts’ forecast and bring the troops that beat their front line.</p>';
    h += '</div><div class="actions"><button class="btn" data-act="replay" data-id="' + r.id + '">Watch again</button><button class="btn primary" data-act="close">Continue</button></div>';
    $('bres').innerHTML = h;
    save();
  }
  function skipBattle() {
    var b = ui.battle; if (!b) return;
    clearTimeout(b.timer);
    var last = b.rep.frames.length - 1;
    while (b.k < last) { b.k++; applyFrame(b.k, false); }
    finishBattle();
  }

  /* ---------- events from the rules engine ---------- */
  function handleEvents(evs, now, away) {
    var live = !away, structural = false;
    evs.forEach(function (e) {
      structural = true;
      if (away) return;
      if (e.kind === 'battle') {
        var rep = S.reports.filter(function (r) { return r.id === e.report; })[0];
        if (!rep) return;
        if (!ui.modal && document.visibilityState === 'visible') openBattle(rep, true);
        else toast(e.text, { kind: e.win ? 'good' : 'bad', label: 'Watch', act: 'replay', id: rep.id, ms: 9000 });
      } else if (e.kind === 'victory') {
        showVictory();
      } else {
        toast(e.text, { kind: e.kind === 'return' ? 'good' : e.kind === 'raid-warning' ? 'warn' : '' });
      }
    });
    if (structural) markAll();
    return live;
  }
  function showVictory() {
    var mins = Math.max(1, Math.round((Date.now() - S.started) / 60000));
    $('sheet').innerHTML = '<h2>The Ironlord Citadel has fallen</h2><p class="lead">You took it in about ' + plural(mins, 'minute', 'minutes') + ' of play time, winning ' + S.stats.wins + ' battles and losing ' + S.stats.lost + ' troops along the way.</p><p style="margin-top:10px">The frontier is secure. Carry your stronghold and army into a new region, or stay here and keep hunting.</p><div class="actions"><button class="btn" data-act="reset">Start over</button><button class="btn" data-act="close">Keep this region</button><button class="btn primary" data-act="next-region">Open next frontier</button></div>';
    showModal('victory');
  }
  function showAway(before, evs, ms) {
    var gains = [], battles = 0, wins = 0, ups = [], trained = 0;
    G.RES.forEach(function (r) { var d = S.res[r] - before[r]; if (d >= 1) gains.push('<span class="c" data-r="' + r + '">' + icon(r) + '+' + fmt(d) + '</span>'); });
    evs.forEach(function (e) { if (e.kind === 'battle') { battles++; if (e.win) wins++; } if (e.kind === 'upgrade') ups.push(e.text); if (e.kind === 'train') trained++; });
    var mins = Math.round(ms / 60000);
    var h = '<h2>Welcome back</h2><p class="lead">You were away for ' + (mins >= 90 ? Math.round(mins / 60) + ' hours' : plural(Math.max(1, mins), 'minute', 'minutes')) + '. Your stronghold kept working.</p>';
    h += '<div class="block-t">While you were gone</div><div class="lootrow"><span class="cost">' + (gains.join('') || 'Nothing new, your storage was already full.') + '</span></div><ul style="margin:10px 0 0;padding-left:18px">';
    if (ups.length) ups.forEach(function (u) { h += '<li>' + esc(u) + '</li>'; });
    if (trained) h += '<li>' + plural(trained, 'batch', 'batches') + ' of troops finished training.</li>';
    if (battles) h += '<li>' + plural(battles, 'battle', 'battles') + ' fought, ' + wins + ' won. See the Reports tab.</li>';
    if (!ups.length && !trained && !battles) h += '<li>No builders or troops were busy. Queue some work before you leave next time.</li>';
    h += '</ul><div class="actions"><button class="btn primary" data-act="close">Back to the stronghold</button></div>';
    $('sheet').innerHTML = h; showModal('away');
  }

  /* ---------- click handling ---------- */
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-act]');
    if (!el) { if (ev.target.id === 'modal') closeModal(); return; }
    var act = el.dataset.act, now = Date.now();
    pending = pending.concat(G.advance(S, now));
    var r;
    switch (act) {
      case 'tab': setTab(el.dataset.tab); return;
      case 'skip-tut': S.tut = 4; updateCoach(); renderMap(); save(); return;
      case 'upgrade': r = G.startUpgrade(S, el.dataset.id, now); if (!r.ok) toast(r.reason, { kind: 'bad' }); afterAction(); return;
      case 'qty': ui.qty[el.dataset.u] = Math.max(1, Math.min(50, (ui.qty[el.dataset.u] || 1) + (+el.dataset.d))); dirty.army = 1; flush(); return;
      case 'qty-max': ui.qty[el.dataset.u] = maxTrain(el.dataset.u); dirty.army = 1; flush(); return;
      case 'train': r = G.trainUnits(S, el.dataset.u, ui.qty[el.dataset.u] || 1, now); if (!r.ok) toast(r.reason, { kind: 'bad' }); afterAction(); return;
      case 'recruit': r = G.recruitHero(S, el.dataset.id); if (!r.ok) toast(r.reason, { kind: 'bad' }); else toast(G.HEROES[el.dataset.id].name + ' joins your stronghold.', { kind: 'good' }); afterAction(); return;
      case 'tile': {
        var x = +el.dataset.x, y = +el.dataset.y, t = G.tileAt(S, x, y), st = G.tileState(S, t, now);
        if (st === 'cooldown') toast('Nothing left there for now. It recovers soon.'); else if (st === 'targeted') toast('Troops are already on their way there.'); else openDispatch(x, y);
        return;
      }
      case 'd-inc': setUnits(el.dataset.u, (ui.dispatch.units[el.dataset.u] || 0) + 1); renderDispatch(); return;
      case 'd-dec': setUnits(el.dataset.u, (ui.dispatch.units[el.dataset.u] || 0) - 1); renderDispatch(); return;
      case 'd-max': setUnits(el.dataset.u, S.units[el.dataset.u] || 0); renderDispatch(); return;
      case 'd-row': ui.dispatch.rows[el.dataset.u] = el.dataset.v; renderDispatch(); return;
      case 'd-hero': ui.dispatch.hero = el.dataset.id || null; renderDispatch(); return;
      case 'd-timing': ui.dispatch.timing = el.dataset.v; renderDispatch(); return;
      case 'd-go':
        r = G.sendMarch(S, ui.dispatch, now);
        if (!r.ok) { toast(r.reason, { kind: 'bad' }); return; }
        closeModal(); afterAction(); toast('Your troops march out.', { kind: 'good' }); return;
      case 'next-region':
        r = G.advanceRegion(S, now);
        if (!r.ok) { toast(r.reason, { kind: 'bad' }); return; }
        closeModal(); afterAction(); setTab('map'); toast('Frontier ' + S.region + ' is open.', { kind: 'good' }); return;
      case 'close': closeModal(); return;
      case 'replay': {
        var rep = S.reports.filter(function (q) { return q.id === +el.dataset.id; })[0];
        if (rep) openBattle(rep, false);
        return;
      }
      case 'speed': S.prefs.speed = +el.dataset.v; $('sheet').querySelectorAll('[data-act="speed"]').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.v === S.prefs.speed)); }); return;
      case 'skip': skipBattle(); return;
      case 'reset':
        $('sheet').innerHTML = '<h2>Start over?</h2><p class="lead">You get a new map. Your current stronghold, troops and heroes are lost.</p><div class="actions"><button class="btn" data-act="close">Keep playing</button><button class="btn primary" data-act="reset-yes">Start over</button></div>';
        showModal('confirm'); return;
      case 'reset-yes':
        try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
        if (ui.battle && ui.battle.timer) clearTimeout(ui.battle.timer);
        ui.battle = null; ui.dispatch = null; ui.modal = null; $('modal').hidden = true; $('sheet').innerHTML = '';
        pending = []; S = G.newGame(Date.now()); save(); markAll(); flush(); updateHeader(); updateCoach(); setTab('hold');
        return;
    }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ui.modal) closeModal(); });
  function afterAction() { G.updateTutorial(S); save(); markAll(); flush(); updateCoach(); }

  /* ---------- main loop ---------- */
  function tick() {
    var now = Date.now();
    var gap = now - ui.lastTick;
    var before = null;
    if (gap > 45000 && ui.lastTick) before = JSON.parse(JSON.stringify(S.res));
    var evs = pending.concat(G.advance(S, now, { away: gap > 45000 && !!ui.lastTick }));
    pending = [];
    if (ui.modal === 'battle') { pending = evs; evs = []; }   // no spoilers while a fight is playing
    if (before) { handleEvents(evs, now, true); flush(); showAway(before, evs, gap); }
    else if (evs.length) { handleEvents(evs, now, false); }
    ui.lastTick = now;
    flush();
    if (ui.modal !== 'battle') { updateHeader(); updateCoach(); }
    if (now - ui.lastSave > 5000) save();
  }

  function init() {
    var now = Date.now();
    S = load();
    var returning = !!S;
    if (!S) S = G.newGame(now);
    buildHeader();
    var before = JSON.parse(JSON.stringify(S.res)), gap = now - S.t;
    var evs = G.advance(S, now, { away: gap > 45000 });
    ui.lastTick = now;
    markAll(); flush(); updateHeader(); updateCoach(); setTab('hold');
    if (returning && gap > 45000) showAway(before, evs, gap);
    save();
    setInterval(tick, 250);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') save(); else tick(); });
    window.addEventListener('pagehide', save);
  }
  init();
})();
