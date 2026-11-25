/* =====================================================================
   TROPICAL FISHING ADVENTURE  -  Phaser 3 (v3.80)
   Satu pulau, isometrik pixel art (semua gambar dibuat lewat kode).
   Bagian A: data + peta + pembuat pixel art (murni JS/canvas)
   Bagian B: UI (DOM)   Bagian C: scene Phaser   Bagian D: start
   ===================================================================== */
(function () {
'use strict';

/* ---------- Penampil error (supaya terlihat di HP tanpa console) ---------- */
window.addEventListener('error', function (e) {
  var b = document.getElementById('errbox');
  if (!b) return;
  b.style.display = 'block';
  b.textContent = 'Error: ' + (e.message || e) + (e.lineno ? ' (game.js baris ' + e.lineno + ')' : '');
});

/* =====================================================================
   A. DATA & KONSTANTA
   ===================================================================== */
var GRID = 36, C = 18;                 // 36x36 tile, pusat pulau di (18,18)
var TW = 64, TH = 32;                  // ukuran tile isometrik 2:1
var W = GRID * TW, H = GRID * TH + 24; // ukuran dunia (px)
var ELEV_LAND = 8, ELEV_DOCK = 6;
var WATER = 0, SAND = 1, GRASS = 2, DOCK = 3;
var SPEED = 165;
var CAM_ZOOM = 3;                      // 1 = jauh, 2 = dekat dengan karakter (ubah sesuai selera)                       // px layar / detik
var REEL = {                            // gain = isi bar tiap tekan, decay = bar turun per detik (ikan melawan)
  common: { gain: 0.13, decay: 0.14 }, uncommon: { gain: 0.11, decay: 0.18 }, rare: { gain: 0.09, decay: 0.22 },
  epic: { gain: 0.08, decay: 0.26 }, legendary: { gain: 0.07, decay: 0.30 }
};
var SAVE_KEY = 'tropicalFishing.save.v1';

var RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
var RARITY = {
  common:    { label: 'Common',    color: '#cfd8dc', weight: 56, window: 1.8  },
  uncommon:  { label: 'Uncommon',  color: '#5fd56a', weight: 26, window: 1.5  },
  rare:      { label: 'Rare',      color: '#4aa8ff', weight: 12, window: 1.25 },
  epic:      { label: 'Epic',      color: '#c96bff', weight: 5,  window: 1.0  },
  legendary: { label: 'Legendary', color: '#ffc23a', weight: 1,  window: 0.85 }
};

var FISH = [
  { id: 'teri',     name: 'Teri Pantai',        rarity: 'common',    price: 10,   c: ['#aebfcc', '#eef5fa', '#7f98a8'],
    desc: 'Ikan kecil keperakan yang berenang berkelompok di air dangkal. Enak digoreng renyah.' },
  { id: 'kembung',  name: 'Kembung Biru',       rarity: 'common',    price: 14,   c: ['#3f7fb5', '#d5e8f5', '#2b5f8c'],
    desc: 'Perenang cepat berpunggung biru. Sering terlihat di sekitar dermaga.' },
  { id: 'bandeng',  name: 'Bandeng Laguna',     rarity: 'common',    price: 18,   c: ['#bfc9cf', '#f1f3f4', '#8d9aa2'],
    desc: 'Ikan tenang penghuni laguna hangat. Dagingnya gurih dan lembut.' },
  { id: 'kakap',    name: 'Kakap Merah',        rarity: 'uncommon',  price: 40,   c: ['#d9473a', '#f5b7a8', '#a8322a'],
    desc: 'Bersisik merah menyala dan suka bersembunyi di dekat karang.' },
  { id: 'badut',    name: 'Ikan Badut Jingga',  rarity: 'uncommon',  price: 55,   c: ['#ff8a1f', '#ffc27a', '#d96a00'], stripe: '#ffffff',
    desc: 'Berloreng putih dan bersahabat dengan anemon. Cantik dan lincah.' },
  { id: 'baronang', name: 'Baronang Tropis',    rarity: 'uncommon',  price: 70,   c: ['#c9b13a', '#f1e6a0', '#8f7d1c'],
    desc: 'Pemakan lumut yang waspada. Sirip punggungnya tajam, hati-hati!' },
  { id: 'kerapu',   name: 'Kerapu Macan',       rarity: 'rare',      price: 150,  c: ['#8a6a47', '#d8c3a0', '#5e432a'], dots: '#3d2a18',
    desc: 'Predator karang berbintik gelap. Gigitannya kuat dan menarik kail ke bawah.' },
  { id: 'tenggiri', name: 'Tenggiri Emas',      rarity: 'rare',      price: 210,  c: ['#e0b43a', '#fff0b8', '#b58710'],
    desc: 'Ikan ramping berkilau keemasan yang berenang kencang di laut terbuka.' },
  { id: 'tuna',     name: 'Tuna Sirip Kuning',  rarity: 'epic',      price: 520,  c: ['#27457c', '#dfe6ee', '#ffd400'],
    desc: 'Raksasa laut dalam bersirip kuning terang. Kebanggaan setiap nelayan.' },
  { id: 'naga',     name: 'Naga Laut Pelangi',  rarity: 'legendary', price: 2500, c: ['#ff5ea8', '#fff4ff', '#7a5cff'], rainbow: true,
    desc: 'Makhluk legendaris bersisik pelangi. Konon hanya muncul bagi nelayan yang sabar.' }
];
var FISH_BY_ID = {};
FISH.forEach(function (f) { FISH_BY_ID[f.id] = f; });

/* ---------- Save (LocalStorage) ---------- */
function cleanCounts(o) {
  var r = {};
  if (o && typeof o === 'object') {
    FISH.forEach(function (f) { var n = Math.floor(+o[f.id] || 0); if (n > 0) r[f.id] = n; });
  }
  return r;
}
var Save = {
  data: { coins: 0, inv: {}, caught: {}, px: null, py: null },
  load: function () {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      var d = JSON.parse(raw);
      if (!d || typeof d !== 'object') return;
      this.data.coins = Math.max(0, Math.floor(+d.coins || 0));
      this.data.inv = cleanCounts(d.inv);
      this.data.caught = cleanCounts(d.caught);
      this.data.px = typeof d.px === 'number' ? d.px : null;
      this.data.py = typeof d.py === 'number' ? d.py : null;
    } catch (e) { /* abaikan */ }
  },
  write: function () {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) { /* abaikan */ }
  },
  reset: function () {
    this.data = { coins: 0, inv: {}, caught: {}, px: null, py: null };
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* abaikan */ }
  }
};

/* ---------- Pembantu kecil ---------- */
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(a, b, c) {
  var h = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function mkCanvas(w, h) {
  var c = document.createElement('canvas');
  c.width = w; c.height = h;
  var g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return [c, g];
}
function px(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }
function disc(g, cx, cy, r, col, S) {
  for (var y = -r; y <= r; y++) {
    var hw = Math.floor(Math.sqrt(r * r - y * y));
    px(g, (cx - hw) * S, (cy + y) * S, (hw * 2 + 1) * S, S, col);
  }
}
function ell(g, cx, cy, rx, ry, col, S) {
  for (var y = -ry; y <= ry; y++) {
    var hw = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.0001))));
    px(g, (cx - hw) * S, (cy + y) * S, (hw * 2 + 1) * S, S, col);
  }
}

/* kontur gelap 1 piksel di sekeliling sprite (ala pixel art game komersial) */
function outlined(d, col, p) {
  p = p || 2;
  var c = d.canvas, w = c.width, h = c.height;
  var tm = mkCanvas(w, h), tg = tm[1];
  tg.drawImage(c, 0, 0); tg.globalCompositeOperation = 'source-in'; tg.fillStyle = col; tg.fillRect(0, 0, w, h);
  var o = mkCanvas(w + 2 * p, h + 2 * p), og = o[1];
  [[-p, 0], [p, 0], [0, -p], [0, p]].forEach(function (k) { og.drawImage(tm[0], p + k[0], p + k[1]); });
  og.drawImage(c, p, p);
  return { canvas: o[0], ox: (d.ox * w + p) / (w + 2 * p), oy: (d.oy * h + p) / (h + 2 * p) };
}
function outlineSheet(c, col) {                      // per sel: atas, kiri, kanan (bawah dibiarkan)
  var tm = mkCanvas(c.width, c.height), tg = tm[1];
  tg.drawImage(c, 0, 0); tg.globalCompositeOperation = 'source-in'; tg.fillStyle = col; tg.fillRect(0, 0, c.width, c.height);
  var g = c.getContext('2d');
  g.globalCompositeOperation = 'destination-over';
  [[-2, 0], [2, 0], [0, -2]].forEach(function (k) { g.drawImage(tm[0], k[0], k[1]); });
  g.globalCompositeOperation = 'source-over';
  return c;
}

/* =====================================================================
   A2. PETA PULAU
   ===================================================================== */
function noise(i, j) {
  return Math.sin(i * 0.7 + 1.3) * 0.7 + Math.cos(j * 0.9 + 0.4) * 0.7 +
         Math.sin((i + j) * 0.45) * 0.5 + Math.cos((i - j) * 0.6) * 0.4;
}

function buildMap() {
  var T = new Uint8Array(GRID * GRID);
  function at(i, j) { return (i < 0 || j < 0 || i >= GRID || j >= GRID) ? WATER : T[j * GRID + i]; }
  function isLand(t) { return t === SAND || t === GRASS || t === DOCK; }
  var i, j;

  // 1) bentuk dasar pulau (bergelombang lewat noise)
  for (j = 0; j < GRID; j++) {
    for (i = 0; i < GRID; i++) {
      var d = Math.hypot(i + 0.5 - C, j + 0.5 - C);
      var r = d + noise(i, j) * 0.85;
      T[j * GRID + i] = r < 7.6 ? GRASS : (r < 11 ? SAND : WATER);
    }
  }

  // 2) buang daratan kecil yang terpisah (flood fill dari titik spawn)
  var seen = new Uint8Array(GRID * GRID), stack = [[C, C]];
  seen[C * GRID + C] = 1;
  while (stack.length) {
    var p = stack.pop();
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (dd) {
      var ni = p[0] + dd[0], nj = p[1] + dd[1];
      if (ni < 0 || nj < 0 || ni >= GRID || nj >= GRID) return;
      var k = nj * GRID + ni;
      if (!seen[k] && isLand(T[k])) { seen[k] = 1; stack.push([ni, nj]); }
    });
  }
  for (i = 0; i < GRID * GRID; i++) if (isLand(T[i]) && !seen[i]) T[i] = WATER;

  // 3) dermaga kayu (2 tile lebar) menjorok ke laut ke arah +i
  var dockEnd = 0, dockStart = GRID;
  [C - 1, C].forEach(function (dj) {
    var s = C;
    while (s < GRID - 1 && at(s, dj) !== WATER) s++;
    dockStart = Math.min(dockStart, s);
    var e = Math.min(s + 6, GRID - 3);
    for (var di = s; di <= e; di++) T[dj * GRID + di] = DOCK;
    if (e > dockEnd) dockEnd = e;
  });

  // 4) titik memancing (spot) di air
  var spots = [];
  spots.push({ name: 'Dermaga Utama', gx: dockEnd + 2.0, gy: C, luck: 0.3 });
  [
    { di: -1, dj: 0,  name: 'Teluk Tenang',   luck: 0.0 },
    { di: 0,  dj: -1, name: 'Pantai Pelangi', luck: 0.5 },
    { di: 0,  dj: 1,  name: 'Karang Biru',    luck: 1.0 }
  ].forEach(function (ray) {
    var ci = C, cj = C;
    while (isLand(at(ci, cj)) && ci > 1 && cj > 1 && ci < GRID - 2 && cj < GRID - 2) { ci += ray.di; cj += ray.dj; }
    var off = 1.8;
    var gx = Math.min(GRID - 1.5, Math.max(1.5, ci + 0.5 + ray.di * off));
    var gy = Math.min(GRID - 1.5, Math.max(1.5, cj + 0.5 + ray.dj * off));
    spots.push({ name: ray.name, gx: gx, gy: gy, luck: ray.luck });
  });

  // 5) NPC & spawn
  var spawn = { gx: C + 0.5, gy: C + 0.5 };
  var stall = { i: 21, j: 15 };
  var npc = { gx: 22.5, gy: 15.5 };

  // 6) rintangan (pohon kelapa, semak, batu) dengan posisi acak tetap
  var R = rng(20260);
  var obstacles = [];
  var cand = [];
  for (j = 0; j < GRID; j++) for (i = 0; i < GRID; i++) {
    var t = T[j * GRID + i];
    if (t === SAND || t === GRASS) cand.push([i, j]);
  }
  for (i = cand.length - 1; i > 0; i--) { j = Math.floor(R() * (i + 1)); var tmp = cand[i]; cand[i] = cand[j]; cand[j] = tmp; }

  function free(ci, cj, spacing) {
    var cx = ci + 0.5, cy = cj + 0.5;
    if (Math.hypot(cx - spawn.gx, cy - spawn.gy) < 3.4) return false;
    if (Math.hypot(cx - npc.gx, cy - npc.gy) < 3.2) return false;
    if (ci >= C + 5 && cj >= C - 4 && cj <= C + 3) return false;       // jalur ke dermaga
    for (var s = 0; s < spots.length; s++) if (Math.hypot(cx - spots[s].gx, cy - spots[s].gy) < 3.4) return false;
    for (var o = 0; o < obstacles.length; o++) if (Math.hypot(cx - obstacles[o].gx, cy - obstacles[o].gy) < spacing) return false;
    return true;
  }
  function place(kind, count, test, spacing) {
    var n = 0;
    for (var k = 0; k < cand.length && n < count; k++) {
      var ci = cand[k][0], cj = cand[k][1];
      if (!test(ci, cj)) continue;
      if (!free(ci, cj, spacing)) continue;
      obstacles.push({ kind: kind, gx: ci + 0.5, gy: cj + 0.5, i: ci, j: cj, v: Math.floor(R() * 2) });
      n++;
    }
  }
  function dist(ci, cj) { return Math.hypot(ci + 0.5 - C, cj + 0.5 - C); }
  function nearWater(ci, cj) {
    return at(ci + 1, cj) === WATER || at(ci - 1, cj) === WATER || at(ci, cj + 1) === WATER || at(ci, cj - 1) === WATER;
  }
  place('palm', 22, function (ci, cj) { var d = dist(ci, cj); return d > 4.5 && d < 10.8; }, 2.6);
  place('tree', 11, function (ci, cj) { return T[cj * GRID + ci] === GRASS && dist(ci, cj) < 7.4; }, 2.6);
  place('bush', 18, function (ci, cj) { return T[cj * GRID + ci] === GRASS && dist(ci, cj) < 7.4; }, 2.3);
  place('rock', 13, function (ci, cj) { return nearWater(ci, cj) || dist(ci, cj) > 7.6; }, 2.3);

  function addProp(kind, ci, cj) {
    var tt = at(ci, cj);
    if (tt !== GRASS && tt !== SAND) return;
    for (var o = 0; o < obstacles.length; o++) if (obstacles[o].i === ci && obstacles[o].j === cj) return;
    if (ci === stall.i && cj === stall.j) return;
    obstacles.push({ kind: kind, gx: ci + 0.5, gy: cj + 0.5, i: ci, j: cj, v: 0 });
  }
  addProp('sign', dockStart - 2, C - 2); addProp('lamp', dockStart - 2, C + 1);
  addProp('lamp', stall.i + 3, stall.j + 2); addProp('lamp', stall.i - 1, stall.j - 2);

  // dekor tanpa tabrakan: alang-alang di tepi air, teratai, bayangan ikan
  var R2 = rng(777), decor = [], fishC = [], cand2 = [];
  for (j = 0; j < GRID; j++) for (i = 0; i < GRID; i++) if (T[j * GRID + i] === SAND || T[j * GRID + i] === GRASS) cand2.push([i, j]);
  for (i = cand2.length - 1; i > 0; i--) { j = Math.floor(R2() * (i + 1)); var t2 = cand2[i]; cand2[i] = cand2[j]; cand2[j] = t2; }
  function farFrom(list, x, y, d) { for (var q = 0; q < list.length; q++) if (Math.hypot(list[q].gx - x, list[q].gy - y) < d) return false; return true; }
  for (var q = 0; q < cand2.length && decor.length < 28; q++) {
    var ri = cand2[q][0], rj = cand2[q][1];
    if (!nearWater(ri, rj) || (ri >= C + 4 && Math.abs(rj - C) <= 4)) continue;
    var rx = ri + 0.3 + R2() * 0.4, ry = rj + 0.3 + R2() * 0.4;
    if (!farFrom(decor, rx, ry, 2.2)) continue;
    var blocked = false;
    for (var oo = 0; oo < obstacles.length; oo++) if (obstacles[oo].i === ri && obstacles[oo].j === rj) blocked = true;
    if (!blocked) decor.push({ kind: 'reed', gx: rx, gy: ry });
  }
  var pads = 0;
  for (var tries = 0; tries < 900 && pads < 20; tries++) {
    var pi = 1 + Math.floor(R2() * (GRID - 2)), pj = 1 + Math.floor(R2() * (GRID - 2));
    if (at(pi, pj) !== WATER || at(pi + 1, pj) !== WATER || at(pi, pj + 1) !== WATER || at(pi + 1, pj + 1) !== WATER) continue;
    var nearL = false;
    for (var a1 = -2; a1 <= 1 && !nearL; a1++) for (var b1 = -2; b1 <= 1; b1++) if (isLand(at(pi + a1, pj + b1))) { nearL = true; break; }
    if (!nearL) continue;
    var px0 = pi + 0.3 + R2() * 0.4, py0 = pj + 0.3 + R2() * 0.4, okp = true;
    for (var sp = 0; sp < spots.length; sp++) if (Math.hypot(px0 - spots[sp].gx, py0 - spots[sp].gy) < 2.2) okp = false;
    if (!okp || !farFrom(decor, px0, py0, 1.5)) continue;
    decor.push({ kind: 'pad', gx: px0, gy: py0, f: R2() < 0.4 ? 1 : 0 }); pads++;
  }
  spots.forEach(function (sp2) { fishC.push({ gx: sp2.gx, gy: sp2.gy, r: 30, n: 2 }); });
  for (tries = 0; tries < 400 && fishC.length < 9; tries++) {
    var fi = 1 + Math.floor(R2() * (GRID - 2)), fj = 1 + Math.floor(R2() * (GRID - 2)), okf = true;
    for (var a2 = -1; a2 <= 1; a2++) for (var b2 = -1; b2 <= 1; b2++) if (at(fi + a2, fj + b2) !== WATER) okf = false;
    var nl2 = false;
    for (a2 = -4; a2 <= 4 && !nl2; a2++) for (b2 = -4; b2 <= 4; b2++) if (isLand(at(fi + a2, fj + b2))) { nl2 = true; break; }
    if (okf && nl2) fishC.push({ gx: fi + 0.5, gy: fj + 0.5, r: 26, n: 1 });
  }

  // 7) peta bisa-dilalui
  var WALK = new Uint8Array(GRID * GRID);
  for (i = 0; i < GRID * GRID; i++) WALK[i] = T[i] !== WATER ? 1 : 0;
  obstacles.forEach(function (o) { WALK[o.j * GRID + o.i] = 0; });
  WALK[stall.j * GRID + stall.i] = 0;
  WALK[Math.floor(npc.gy) * GRID + Math.floor(npc.gx)] = 0;

  return { T: T, WALK: WALK, obstacles: obstacles, spots: spots, spawn: spawn, stall: stall, npc: npc, dockEnd: dockEnd, dockStart: dockStart, decor: decor, fishC: fishC };
}

/* =====================================================================
   A3. PEMBUAT PIXEL ART (semua lewat canvas)
   ===================================================================== */
function drawDiamond(g, cx, cy, col) {            // diamond 64x32, pixel-perfect (tanpa anti-alias)
  g.fillStyle = col;
  for (var y = 0; y < 32; y++) {
    var hw = y < 16 ? 2 * y + 2 : 2 * (31 - y) + 2;
    g.fillRect(cx - hw, cy + y, hw * 2, 1);
  }
}
function rowHW(y) { return y < 16 ? 2 * y + 2 : 2 * (31 - y) + 2; }

function makeGround(map) {
  var T = map.T;
  var plx = map.stall.i + 1, ply = map.stall.j + 0.5;
  function segD(px_, py_, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((px_ - ax) * dx + (py_ - ay) * dy) / l2));
    return Math.hypot(px_ - (ax + dx * u), py_ - (ay + dy * u));
  }
  function onPath(a, b) {
    var x = a + 0.5, y = b + 0.5;
    return Math.hypot(x - plx, y - ply) < 2.6 || segD(x, y, plx, ply, C + 0.5, C + 0.5) < 0.8 || segD(x, y, C + 0.5, C + 0.5, map.dockStart - 0.5, C + 0.5) < 0.8;
  }
  var cv = mkCanvas(W, H), c = cv[0], g = cv[1];
  var i, j;
  function at(a, b) { return (a < 0 || b < 0 || a >= GRID || b >= GRID) ? WATER : T[b * GRID + a]; }
  function isLand(t) { return t !== WATER; }
  function sx(a, b) { return (a - b) * 32 + W / 2; }
  function sy(a, b) { return (a + b) * 16; }

  // laut dalam: gradasi gelap di tepi dunia
  var grad = g.createRadialGradient(W / 2, H / 2, 260, W / 2, H / 2, Math.hypot(W, H) / 2);
  grad.addColorStop(0, 'rgba(0,70,130,0)');
  grad.addColorStop(1, 'rgba(0,45,105,0.5)');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);

  // air dangkal (turquoise terang di sekitar pulau)
  var shallow = mkCanvas(W, H), sc = shallow[0], sg = shallow[1];
  var shallow2 = mkCanvas(W, H), sc2 = shallow2[0], sg2 = shallow2[1];
  for (j = 0; j < GRID; j++) for (i = 0; i < GRID; i++) {
    if (T[j * GRID + i] !== WATER) continue;
    var near1 = false, near3 = false;
    for (var dj = -3; dj <= 3 && !near1; dj++) for (var di = -3; di <= 3; di++) {
      if (isLand(at(i + di, j + dj))) {
        near3 = true;
        if (Math.abs(di) <= 1 && Math.abs(dj) <= 1) { near1 = true; break; }
      }
    }
    if (near3) drawDiamond(sg, sx(i, j), sy(i, j), '#46d7e0');
    if (near1) drawDiamond(sg2, sx(i, j), sy(i, j), '#a6f5ea');
  }
  g.globalAlpha = 0.5; g.drawImage(sc, 0, 0);
  g.globalAlpha = 0.45; g.drawImage(sc2, 0, 0);
  g.globalAlpha = 1;

  // tile daratan, dari belakang ke depan
  var grassCols = ['#55b947', '#4eaa3d', '#69ca50', '#3f9638'];
  var sandCols = ['#f6e6b6', '#ead39a', '#fff2c9', '#dfc58a'];
  for (var s = 0; s <= 2 * GRID - 2; s++) {
    for (i = Math.max(0, s - GRID + 1); i <= Math.min(s, GRID - 1); i++) {
      j = s - i;
      var t = T[j * GRID + i];
      if (t === WATER) continue;
      var h = t === DOCK ? ELEV_DOCK : ELEV_LAND;
      var cx = sx(i, j), cy = sy(i, j), top = cy - h;
      var nR = at(i + 1, j), nL = at(i, j + 1), k;
      var sideR = t === GRASS ? '#8c6a3c' : t === SAND ? '#dcc78f' : '#6b4a26';
      var sideL = t === GRASS ? '#6f5230' : t === SAND ? '#c4ad74' : '#4f3719';

      if (!isLand(nR)) {
        for (k = 0; k < 32; k++) {
          var yy = top + 31 - (k >> 1);
          px(g, cx + k, yy, 1, h + 1, sideR);
          px(g, cx + k, yy, 1, 1, t === GRASS ? '#3f9a35' : '#fff2c9');                  // bibir tebing
          if (k % 7 === 2) px(g, cx + k, yy + h, 3, 1, 'rgba(255,255,255,0.85)');       // buih
        }
      }
      if (!isLand(nL)) {
        for (k = 0; k < 32; k++) {
          var yl = top + 31 - (k >> 1);
          px(g, cx - 1 - k, yl, 1, h + 1, sideL);
          px(g, cx - 1 - k, yl, 1, 1, t === GRASS ? '#2f7f2c' : '#f3e2b0');
          if (k % 7 === 4) px(g, cx - 3 - k, yl + h, 3, 1, 'rgba(255,255,255,0.7)');
        }
      }

      // permukaan atas
      var base, cols, wet = false;
      if (t === GRASS) { base = grassCols[0]; cols = grassCols; }
      else if (t === SAND) {
        wet = at(i + 1, j) === WATER || at(i - 1, j) === WATER || at(i, j + 1) === WATER || at(i, j - 1) === WATER;
        base = wet ? '#e6d3a0' : sandCols[0]; cols = wet ? ['#e6d3a0', '#dcc58c', '#efdeb0'] : sandCols;
      } else { base = '#b88a52'; cols = ['#b88a52', '#a87a46']; }
      if (t !== DOCK) {                                   // bercak warna supaya tidak datar
        var pv = hash(i, j, 5) * 0.72 + hash(i * 3, j * 2, 6) * 0.28;
        if (t === GRASS) base = grassCols[Math.min(3, Math.floor(pv * 4))];
        else if (!wet) base = sandCols[Math.min(3, Math.floor(pv * 4))];
      }
      var cob = (t === GRASS && onPath(i, j));
      drawDiamond(g, cx, top, cob ? '#b3ae9d' : base);
      if (cob) {                                          // jalan batu
        for (var rr3 = 2; rr3 < 29; rr3 += 4) {
          var hwr = Math.min(rowHW(rr3), rowHW(rr3 + 2)) - 3, off = ((rr3 >> 2) & 1) * 4 + Math.floor(hash(i, j, rr3) * 3);
          for (var xx3 = -hwr + off; xx3 + 6 <= hwr; xx3 += 8) {
            px(g, cx + xx3, top + rr3, 6, 3, hash(i + xx3, j, rr3) < 0.5 ? '#dcd7c7' : '#cfcab9');
            px(g, cx + xx3, top + rr3, 6, 1, '#f1eddf'); px(g, cx + xx3, top + rr3 + 2, 6, 1, '#a39e8c');
          }
        }
      }

      if (t === DOCK) {
        // papan kayu searah sumbu i
        var tt;
        for (tt = 8; tt < 32; tt += 8) {
          for (k = 0; k < 32; k++) px(g, cx + k - tt, top + ((k + tt) >> 1), 1, 1, '#7a5530');
        }
        for (var q = 0; q < 8; q++) {
          var r2 = 2 + Math.floor(hash(i, j, q) * 27), hw2 = rowHW(r2);
          px(g, cx - hw2 + 2 + Math.floor(hash(i, j, q + 9) * (hw2 * 2 - 6)), top + r2, 2, 1, cols[1]);
        }
      } else if (!cob) {
        for (var n = 0; n < 9; n++) {
          var rr = 2 + Math.floor(hash(i, j, n) * 27), hw = rowHW(rr);
          var xx = cx - hw + 2 + Math.floor(hash(i, j, n + 20) * (hw * 2 - 6));
          px(g, xx, top + rr, 2, 1, cols[1 + Math.floor(hash(i, j, n + 40) * (cols.length - 1))]);
        }
        if (t === GRASS && hash(i, j, 77) < 0.45) {            // rumput kecil
          var gr = 9 + Math.floor(hash(i, j, 78) * 12), gh = rowHW(gr), gx2 = cx + Math.floor((hash(i, j, 79) - 0.5) * gh);
          px(g, gx2, top + gr, 1, 1, '#2f8a34'); px(g, gx2 - 1, top + gr - 1, 1, 1, '#2f8a34'); px(g, gx2 + 1, top + gr - 1, 1, 1, '#2f8a34');
        }
        if (t === GRASS) {                                     // rumput lebih rapat + bercak cahaya/bayangan
          for (var tf = 0; tf < 12; tf++) if (hash(i, j, 200 + tf) < 0.88) {
            var tr = 6 + Math.floor(hash(i, j, 210 + tf) * 17), th2 = rowHW(tr), tx2 = cx + Math.floor((hash(i, j, 220 + tf) - 0.5) * (th2 - 4));
            var dark = hash(i, j, 230 + tf) < 0.5;
            px(g, tx2, top + tr - 2, 1, 3, dark ? '#2f8a34' : '#8fe06a');
            px(g, tx2 + 2, top + tr - 1, 1, 2, dark ? '#3b9a3c' : '#a6ee7c');
            px(g, tx2 - 2, top + tr - 1, 1, 2, dark ? '#3b9a3c' : '#7fd35e');
          }
          if (hash(i, j, 240) < 0.35) { var dr = 8 + Math.floor(hash(i, j, 241) * 14); px(g, cx - 6 + Math.floor(hash(i, j, 242) * 10), top + dr, 5, 1, 'rgba(20,90,40,0.28)'); }
          if (hash(i, j, 243) < 0.3) { var lr = 6 + Math.floor(hash(i, j, 244) * 14); px(g, cx - 8 + Math.floor(hash(i, j, 245) * 14), top + lr, 4, 1, 'rgba(220,255,160,0.25)'); }
          // kelompok tekstur rumput kecil: warna gelap, midtone, dan kilau matahari
          for (var cl = 0; cl < 5; cl++) if (hash(i, j, 310 + cl) > 0.28) {
            var cr = 5 + Math.floor(hash(i, j, 320 + cl) * 21), chw = rowHW(cr);
            var cxx = cx + Math.floor((hash(i, j, 330 + cl) - 0.5) * (chw - 5));
            px(g, cxx, top + cr, 3, 1, cl % 2 ? '#328b37' : '#8bd85d');
            px(g, cxx + 1, top + cr - 1, 1, 1, cl % 2 ? '#54b64a' : '#b0e879');
          }
        }
        if (t === SAND) {                                      // riak pasir + kerikil
          if (hash(i, j, 250) < 0.5) { var rr2 = 8 + Math.floor(hash(i, j, 251) * 14); px(g, cx - 9 + Math.floor(hash(i, j, 252) * 12), top + rr2, 6, 1, 'rgba(190,160,100,0.45)'); px(g, cx - 7 + Math.floor(hash(i, j, 252) * 12), top + rr2 + 1, 3, 1, 'rgba(255,250,225,0.5)'); }
          if (hash(i, j, 253) < 0.14) { var pr = 9 + Math.floor(hash(i, j, 254) * 12), pxx = cx - 8 + Math.floor(hash(i, j, 255) * 14); px(g, pxx, top + pr, 3, 2, '#a89c82'); px(g, pxx, top + pr, 2, 1, '#cfc4a8'); }
        }
        if (t === GRASS && hash(i, j, 90) < 0.1) {             // bunga kecil
          var fr = 10 + Math.floor(hash(i, j, 91) * 10);
          px(g, cx + Math.floor((hash(i, j, 92) - 0.5) * 20), top + fr, 2, 2, hash(i, j, 93) < 0.5 ? '#ff7aa8' : '#ffe36a');
        }
        if (t === SAND && hash(i, j, 95) < 0.12) {             // kerang
          var sr = 10 + Math.floor(hash(i, j, 96) * 10);
          px(g, cx + Math.floor((hash(i, j, 97) - 0.5) * 20), top + sr, 2, 1, hash(i, j, 98) < 0.5 ? '#ffffff' : '#f7c1c9');
        }
        if (t === GRASS && hash(i, j, 270) < 0.42) {          // bilah rumput kecil tambahan
          var br = 8 + Math.floor(hash(i, j, 271) * 16);
          var bx = cx + Math.floor((hash(i, j, 272) - 0.5) * 22);
          px(g, bx, top + br, 1, 3, '#347f35');
          px(g, bx + 2, top + br - 1, 1, 2, '#8cdb63');
        }
        if (t === SAND && hash(i, j, 273) < 0.34) {           // kilau pasir halus
          var glr = 7 + Math.floor(hash(i, j, 274) * 17);
          var glx = cx + Math.floor((hash(i, j, 275) - 0.5) * 24);
          px(g, glx, top + glr, 2, 1, 'rgba(255,255,235,0.62)');
        }
      }

      // tiang dermaga
      if (t === DOCK) {
        var postAt = function (vx, vy) {
          px(g, vx - 2, vy - h - 5, 4, h + 12, '#5a3b1c');
          px(g, vx - 2, vy - h - 5, 4, 2, '#8a5d30');
        };
        if (!(at(i, j + 1) === DOCK) && i % 2 === 0) postAt(cx - 31, cy + 16);
        if (!(at(i + 1, j) === DOCK) && j % 2 === 1) postAt(cx + 31, cy + 16);
        if (at(i, j + 1) !== DOCK && at(i + 1, j) !== DOCK) postAt(cx, cy + 32);
      }
    }
  }

  // penanda area spawn (cincin batu)
  var spCx = sx(C, C) - 0, spCy = sy(C, C) + 16 - ELEV_LAND;
  for (var a = 0; a < Math.PI * 2; a += 0.09) {
    var ex = Math.round(spCx + Math.cos(a) * 20), ey = Math.round(spCy + Math.sin(a) * 10);
    px(g, ex - 1, ey, 3, 2, (Math.floor(a / 0.09) % 3 === 0) ? '#d9c68e' : '#bfae79');
  }
  return c;
}

/* ----- karakter pixel art ----- */
var PAL_PLAYER = { skin: '#f2c28b', hair: '#17171b', hairHi: '#3d3e48', shirt: '#f6f7f9', shirt2: '#d5dbe3', pants: '#2a2c33', pantsD: '#18191e', shoe: '#0c0c0e', belt: '#0c0c0e', hat: 'none' };
var PAL_NPC = { skin: '#c98a5a', hair: '#2e2e2e', shirt: '#1fb5a5', shirt2: '#e8fffb', pants: '#7a5230', pantsD: '#5f3f22', shoe: '#2a1d12', hat: 'cap', apron: true };

function drawChar(g, ox, oy, o) {
  var S = 2, p = o.pal, by = o.by | 0, ph = o.phase || 0, walk = !!o.walk, v = o.view, sd = o.side | 0;
  function R(x, y, w, h, col) {
    g.fillStyle = col;
    var X = o.flip ? 16 - x - w : x;
    g.fillRect(ox + X * S, oy + y * S, w * S, h * S);
  }
  var al = walk ? [-1, 0, 1, 0][ph] : 0;
  if (v === 'side') {
    var L = walk ? [[2, -2, 0, 0], [0, 0, 1, 0], [-2, 2, 0, 0], [0, 0, 0, 1]][ph] : [0, 0, 0, 0];
    R(7 + L[1], 16 + L[3], 2, 6 - L[3], p.pantsD); R(7 + L[1], 22 - L[3], 3, 2, p.shoe);
    R(7 + L[0], 16 + L[2], 2, 6 - L[2], p.pants);  R(7 + L[0], 22 - L[2], 3, 2, p.shoe);
    R(5, 15, 6, 2, p.pants);
    R(5, 9 + by, 6, 6, p.shirt);
    R(6, 11 + by, 1, 1, p.shirt2); R(6, 13 + by, 1, 1, p.shirt2);
    if (p.apron) R(8, 11 + by, 2, 5, '#f5f5f5');
    R(7 + al, 10 + by, 2, 2, p.shirt); R(7 + al, 12 + by, 2, 3, p.skin);
    R(5, 3 + by, 6, 6, p.skin); R(5, 3 + by, 3, 6, p.hair);
    R(9, 6 + by, 1, 1, '#222'); R(11, 6 + by, 1, 1, p.skin); R(9, 8 + by, 2, 1, '#b5654a');
    if (p.hat === 'straw') {
      R(4, 3 + by, 10, 1, '#e9c46a'); R(5, 1 + by, 6, 2, '#f4d58d'); R(5, 2 + by, 6, 1, '#e76f51');
    } else if (p.hat === 'none') {
      R(4, 2 + by, 7, 2, p.hair); R(4, 4 + by, 4, 4, p.hair); R(9, 3 + by, 2, 1, p.hair);
      R(5, 2 + by, 3, 1, p.hairHi);
      if (p.belt) R(5, 15, 6, 1, p.belt);
    } else {
      R(5, 1 + by, 6, 3, '#d62828'); R(10, 3 + by, 4, 1, '#9d1c1c');
    }
  } else {
    var lf = walk ? [[0, 0], [1, 0], [0, 0], [0, 1]][ph] : [0, 0];
    R(5, 16 + lf[0], 3, 6 - lf[0], p.pants); R(5, 22 - lf[0], 3, 2, p.shoe);
    R(8, 16 + lf[1], 3, 6 - lf[1], p.pantsD); R(8, 22 - lf[1], 3, 2, p.shoe);
    R(4, 15, 8, 2, p.pants);
    R(4, 9 + by, 8, 6, p.shirt);
    if (v === 'front') {
      R(6, 11 + by, 1, 1, p.shirt2); R(9, 12 + by, 1, 1, p.shirt2); R(7, 13 + by, 1, 1, p.shirt2);
      if (p.apron) R(5, 11 + by, 6, 5, '#f5f5f5');
    } else {
      R(7, 11 + by, 2, 1, p.shirt2); R(6, 13 + by, 1, 1, p.shirt2); R(9, 13 + by, 1, 1, p.shirt2);
    }
    R(2, 10 + by + al, 2, 2, p.shirt); R(2, 12 + by + al, 2, 3, p.skin);
    R(12, 10 + by - al, 2, 2, p.shirt); R(12, 12 + by - al, 2, 3, p.skin);
    R(5, 3 + by, 6, 6, p.skin); R(5, 8 + by, 6, 1, '#d9a46d');
    if (v === 'front') {
      R(5, 4 + by, 1, 3, p.hair); R(10, 4 + by, 1, 3, p.hair);
      R(6 + sd, 6 + by, 1, 1, '#222'); R(9 + sd, 6 + by, 1, 1, '#222'); R(7 + sd, 8 + by, 2, 1, '#b5654a');
    } else {
      R(5, 3 + by, 6, 6, p.hair);
    }
    if (p.hat === 'straw') {
      R(3 + sd, 3 + by, 10, 1, '#e9c46a'); R(5 + sd, 1 + by, 6, 2, '#f4d58d'); R(5 + sd, 2 + by, 6, 1, '#e76f51');
    } else if (p.hat === 'none') {
      if (v === 'front') {
        R(4, 2 + by, 8, 3, p.hair); R(4, 5 + by, 1, 3, p.hair); R(11, 5 + by, 1, 3, p.hair);
        R(6, 2 + by, 3, 1, p.hairHi); R(6, 9 + by, 4, 1, p.skin);
      } else {
        R(4, 2 + by, 8, 7, p.hair); R(6, 2 + by, 3, 1, p.hairHi); R(7, 5 + by, 2, 1, p.hairHi);
      }
      if (p.belt) R(4, 15, 8, 1, p.belt);
    } else if (v === 'front') {
      R(5, 1 + by, 6, 3, '#d62828'); R(5 + sd, 4 + by, 6, 1, '#9d1c1c');
    } else {
      R(5, 1 + by, 6, 4, '#d62828');
    }
  }
}
var DIRVIEW = [
  { v: 'side',  flip: false, s: 0 },   // 0 E
  { v: 'front', flip: false, s: 1 },   // 1 SE
  { v: 'front', flip: false, s: 0 },   // 2 S
  { v: 'front', flip: false, s: -1 },  // 3 SW
  { v: 'side',  flip: true,  s: 0 },   // 4 W
  { v: 'back',  flip: false, s: -1 },  // 5 NW
  { v: 'back',  flip: false, s: 0 },   // 6 N
  { v: 'back',  flip: false, s: 1 }    // 7 NE
];
function makePlayerSheet() {
  var cv = mkCanvas(6 * 32, 8 * 48), c = cv[0], g = cv[1];
  for (var d = 0; d < 8; d++) for (var col = 0; col < 6; col++) {
    var dv = DIRVIEW[d];
    var walk = col >= 2, ph = walk ? col - 2 : 0;
    drawChar(g, col * 32, d * 48, {
      pal: PAL_PLAYER, view: dv.v, flip: dv.flip, side: dv.s, walk: walk, phase: ph,
      by: walk ? [1, 0, 1, 0][ph] : col
    });
  }
  return outlineSheet(c, '#14181f');
}
function makeNpcSheet() {
  var cv = mkCanvas(64, 48), c = cv[0], g = cv[1];
  for (var k = 0; k < 2; k++) drawChar(g, k * 32, 0, { pal: PAL_NPC, view: 'front', flip: false, side: 0, walk: false, phase: 0, by: k });
  return outlineSheet(c, '#14181f');
}

/* ----- objek dunia ----- */
function makePalm() {
  var S=2, LW=104, LH=92, cv=mkCanvas(LW*S,LH*S), c=cv[0], g=cv[1];
  ell(g,52,84,22,5,'rgba(0,0,0,0.30)',S);
  // curved, ringed trunk
  for(var y=28;y<=82;y++){
    var t=(y-28)/54, x=Math.round(51+7*Math.sin(t*1.25)-3*t);
    var w=4+(y>70?1:0);
    px(g,(x-2)*S,y*S,w*S,1*S,(y%8<3)?'#67401f':'#8b592d');
    px(g,(x-1)*S,y*S,1*S,1*S,'#d5a064');
    if(y%7===0) px(g,(x+1)*S,y*S,2*S,1*S,'#4c321e');
  }
  var cx=55, cy=30;
  // fronds sweep outward and down, each with paired leaflets
  var fronds=[[-1.00,-.15,42],[-.78,-.62,42],[-.36,-.93,38],[.18,-1.00,40],[.62,-.76,43],[.98,-.20,42],[.83,.40,37],[-.78,.42,34],[-.25,.62,31]];
  for(var k=0;k<fronds.length;k++){
    var dx=fronds[k][0],dy=fronds[k][1],len=fronds[k][2],px0=cx,py0=cy;
    for(var q=1;q<=len;q++){
      var u=q/len;
      var xx=Math.round(cx+dx*q+dx*5*u*u);
      var yy=Math.round(cy+dy*q*.62+10*u*u);
      // thick midrib and lit edge
      px(g,xx*S,yy*S,2*S,2*S,k%3===0?'#b5d85a':'#6eae3e');
      if(q%2===0){
        var wing=Math.max(2,Math.round((1-u)*10));
        var leftX=xx-Math.round(dy*wing), leftY=yy+Math.round(dx*wing*.55);
        var rightX=xx+Math.round(dy*wing), rightY=yy-Math.round(dx*wing*.55);
        px(g,leftX*S,leftY*S,3*S,2*S,'#24783b');
        px(g,(leftX-1)*S,(leftY-1)*S,2*S,S,'#58b84d');
        px(g,rightX*S,rightY*S,3*S,2*S,'#176331');
        px(g,(rightX+1)*S,(rightY-1)*S,2*S,S,'#3e9a43');
      }
      px0=xx;py0=yy;
    }
    px(g,(px0-1)*S,(py0-1)*S,3*S,2*S,'#174f2a');
  }
  // dense crown, coconuts and bright leaf clusters
  disc(g,cx,cy,7,'#17602e',S); disc(g,cx-2,cy-2,4,'#3f9b42',S);
  [[-4,3],[2,4],[5,1]].forEach(function(v,i){disc(g,cx+v[0],cy+v[1],2,i===1?'#b97936':'#8b5429',S);});
  for(var n=0;n<34;n++){
    var a=hash(n,4,81)*6.283, rr=3+hash(n,8,82)*11;
    var hx=Math.round(cx+Math.cos(a)*rr),hy=Math.round(cy+Math.sin(a)*rr*.65);
    px(g,hx*S,hy*S,2*S,2*S,n%4===0?'#a3df5b':(n%3===0?'#1d6a31':'#4ba747'));
  }
  return {canvas:c,ox:0.5,oy:84/LH};
}
function makeBush() {
  var S = 2, LW = 30, LH = 22, cv = mkCanvas(LW*S, LH*S), c = cv[0], g = cv[1];
  ell(g, 15, 19, 13, 3, 'rgba(0,0,0,0.22)', S);
  // Lapisan daun bertumpuk dengan highlight pixel.
  [[7,13,7,'#17672e'],[14,10,8,'#23833a'],[22,13,7,'#17672e'],[10,8,6,'#329b45'],[18,7,7,'#3eaa4c'],[25,11,5,'#2b8e3e']].forEach(function(v){
    disc(g,v[0],v[1],v[2],v[3],S);
  });
  [[6,10],[10,6],[16,5],[21,8],[24,12],[13,13]].forEach(function(v,i){
    px(g,v[0]*S,v[1]*S,2*S,2*S,i%2?'#83dc68':'#62c957');
  });
  // Bunga mungil khas taman pulau.
  px(g,5*S,13*S,2*S,2*S,'#ff86a8'); px(g,6*S,12*S,S,S,'#fff0a0');
  px(g,20*S,5*S,2*S,2*S,'#ffd45e'); px(g,21*S,4*S,S,S,'#fff4b0');
  px(g,24*S,14*S,2*S,2*S,'#f58ab2');
  return { canvas:c, ox:0.5, oy:20/LH };
}
function makeRock(v) {
  var S = 2, LW = 26, LH = 19, cv = mkCanvas(LW*S,LH*S), c=cv[0], g=cv[1];
  ell(g,13,16,11,3,'rgba(0,0,0,0.24)',S);
  if (v === 0) {
    ell(g,13,11,10,7,'#586b73',S);
    ell(g,11,9,8,6,'#84969a',S);
    ell(g,9,7,5,3,'#b6c5bd',S);
    ell(g,17,12,5,4,'#465a62',S);
    px(g,7*S,7*S,4*S,S,'#d4dfd1');
    px(g,5*S,10*S,2*S,3*S,'#a9b9b2');
    px(g,17*S,8*S,3*S,2*S,'#71858a');
  } else {
    ell(g,12,12,8,5,'#5c7076',S);
    ell(g,10,10,6,4,'#9aa9a4',S);
    ell(g,18,13,6,4,'#435a62',S);
    px(g,7*S,8*S,4*S,S,'#d1d9c9');
    px(g,13*S,6*S,3*S,2*S,'#bac8bc');
    px(g,18*S,11*S,3*S,2*S,'#71858a');
  }
  // Lumut kecil agar cocok dengan tepi pantai tropis.
  px(g,4*S,13*S,3*S,S,'#4b9a50');
  px(g,20*S,14*S,2*S,S,'#367e43');
  return { canvas:c, ox:0.5, oy:17/LH };
}
function makeStall() {
  var S = 2, LW = 48, LH = 44, cv = mkCanvas(LW * S, LH * S), c = cv[0], g = cv[1], x;
  ell(g, 24, 41, 22, 3, 'rgba(0,0,0,0.22)', S);
  px(g, 4 * S, 10 * S, 3 * S, 30 * S, '#7a4e24'); px(g, 41 * S, 10 * S, 3 * S, 30 * S, '#7a4e24');
  px(g, 7 * S, 10 * S, 34 * S, 16 * S, '#c9ad7c');
  px(g, 4 * S, 26 * S, 40 * S, 14 * S, '#a9743c');
  for (x = 4; x < 44; x += 5) px(g, x * S, 26 * S, S, 14 * S, '#8b5a2b');
  px(g, 2 * S, 24 * S, 44 * S, 3 * S, '#d9a066');
  ell(g, 10, 22, 3, 1, '#8ecae6', S); ell(g, 17, 22, 3, 1, '#ffb703', S); ell(g, 33, 22, 3, 1, '#e76f51', S); ell(g, 39, 22, 2, 1, '#8ecae6', S);
  for (x = 0; x < 48; x++) {
    var col = (Math.floor(x / 4) % 2) ? '#e63946' : '#f8f9fa';
    px(g, x * S, 6 * S, S, 8 * S, col);
    px(g, x * S, 14 * S, S, ((Math.floor(x / 2) % 2) ? 2 : 1) * S, col);
  }
  px(g, 0, 4 * S, 48 * S, 2 * S, '#9d0208');
  px(g, 14 * S, 29 * S, 20 * S, 9 * S, '#5b3a1a');
  g.fillStyle = '#ffffff'; g.font = 'bold ' + (8 * S) + 'px monospace'; g.textAlign = 'center';
  g.fillText('IKAN', 24 * S, 36.5 * S);
  return { canvas: c, ox: 0.5, oy: 41 / LH };
}
function makeWaves(kind) {
  var cv=mkCanvas(192,128),c=cv[0],g=cv[1],R=rng(kind===1?113:229);
  if(kind===1){
    px(g,0,0,192,128,'#20b5c9');
    for(var y=0;y<128;y+=16){
      for(var x=0;x<192;x+=24){
        var v=R();
        if(v>.24) px(g,x+Math.floor(R()*8),y+Math.floor(R()*7),8+Math.floor(R()*13),2,v>.72?'#35c9d4':'#159fb8');
        if(v>.55) px(g,x+Math.floor(R()*13),y+8+Math.floor(R()*5),5+Math.floor(R()*10),1,'#66dce0');
      }
    }
    for(var n=0;n<32;n++){
      var xx=Math.floor(R()*188), yy=Math.floor(R()*124);
      px(g,xx,yy,2+Math.floor(R()*5),1,'#8be8e5');
      if(n%3===0) px(g,xx+1,yy+1,3,1,'#138da9');
    }
  } else {
    for(var q=0;q<40;q++){
      var wx=Math.floor(R()*188),wy=Math.floor(R()*124),ww=4+Math.floor(R()*12);
      px(g,wx,wy,ww,1,R()>.5?'rgba(220,255,250,.55)':'rgba(0,100,150,.28)');
      if(q%4===0) px(g,wx+2,wy+2,ww-3,1,'rgba(255,255,255,.28)');
    }
  }
  return c;
}
function makeCloud() {
  var cv = mkCanvas(256, 128), c = cv[0], g = cv[1];
  g.imageSmoothingEnabled = true;
  [[90, 70, 60, 36], [150, 60, 66, 40], [200, 74, 44, 28], [120, 84, 70, 30]].forEach(function (b) {
    var gr = g.createRadialGradient(b[0], b[1], 2, b[0], b[1], b[2]);
    gr.addColorStop(0, 'rgba(0,25,50,0.9)'); gr.addColorStop(1, 'rgba(0,25,50,0)');
    g.fillStyle = gr; g.save(); g.translate(b[0], b[1]); g.scale(1, b[3] / b[2]); g.translate(-b[0], -b[1]);
    g.beginPath(); g.arc(b[0], b[1], b[2], 0, 6.2832); g.fill(); g.restore();
  });
  return c;
}
function makeFoam(map) {
  var T = map.T, cv = mkCanvas(W, H), c = cv[0], g = cv[1];
  function land(a, b) { return a >= 0 && b >= 0 && a < GRID && b < GRID && T[b * GRID + a] !== WATER; }
  for (var j = 0; j < GRID; j++) for (var i = 0; i < GRID; i++) {
    if (T[j * GRID + i] !== WATER) continue;
    var cx = (i - j) * 32 + W / 2, cy = (i + j) * 16, k;
    if (land(i - 1, j)) for (k = 0; k < 32; k++) { if ((k + i) % 9 < 6) px(g, cx - 32 + k, cy + 16 - (k >> 1) + 1, 1, 2, 'rgba(255,255,255,0.95)'); }
    if (land(i, j - 1)) for (k = 0; k < 32; k++) { if ((k + j) % 9 < 6) px(g, cx + k, cy + (k >> 1) + 1, 1, 2, 'rgba(255,255,255,0.95)'); }
  }
  return c;
}
function makeTree() {
  var S=2,LW=88,LH=78,cv=mkCanvas(LW*S,LH*S),c=cv[0],g=cv[1],r=rng(9031);
  ell(g,44,72,27,5,'rgba(0,0,0,0.30)',S);
  // trunk, roots and bark facets
  px(g,39*S,35*S,11*S,34*S,'#67401f'); px(g,42*S,35*S,3*S,33*S,'#b47a3d');
  px(g,48*S,38*S,2*S,27*S,'#8a572d');
  [[34,64,12,4],[44,65,13,4],[51,64,9,3]].forEach(function(v){px(g,v[0]*S,v[1]*S,v[2]*S,v[3]*S,'#704522');});
  for(var y=38;y<66;y+=7) px(g,40*S,y*S,8*S,S,'#d09a55');
  // deep canopy masses
  [[17,28,15],[34,17,17],[55,22,16],[69,34,13],[55,43,18],[30,43,17],[12,42,11],[42,31,20]].forEach(function(v){disc(g,v[0],v[1],v[2],'#104d29',S);});
  // mid green overlapping leaf clusters
  [[18,25,12],[35,15,14],[56,20,13],[69,32,10],[57,40,14],[31,40,14],[13,40,8],[43,30,17]].forEach(function(v){disc(g,v[0],v[1],v[2],'#27813b',S);});
  // bright sunlit crowns
  [[21,20,8],[37,12,9],[55,16,8],[65,28,7],[53,35,9],[30,34,9],[15,36,5],[43,25,10]].forEach(function(v){disc(g,v[0],v[1],v[2],'#49aa4a',S);});
  for(var n=0;n<150;n++){
    var a=r()*6.283,rad=Math.sqrt(r())*30;
    var x=Math.round(43+Math.cos(a)*rad),y2=Math.round(29+Math.sin(a)*rad*.70);
    var col=r()<.20?'#9be16a':(r()<.48?'#17632f':(r()<.5?'#72c957':'#318d3d'));
    px(g,x*S,y2*S,(r()<.25?2:1)*S,(r()<.25?2:1)*S,col);
  }
  // tiny tropical flowers/berries, very subtle
  for(var b=0;b<7;b++){var bx=18+Math.floor(r()*50),by=20+Math.floor(r()*28);px(g,bx*S,by*S,2*S,2*S,b%2?'#e7a34b':'#e85b4c');}
  return {canvas:c,ox:.5,oy:70/LH};
}
function makeLamp() {
  var S = 2, LW = 14, LH = 40, cv = mkCanvas(LW * S, LH * S), c = cv[0], g = cv[1];
  ell(g, 7, 37, 6, 2, 'rgba(0,0,0,0.25)', S);
  px(g, 4 * S, 34 * S, 6 * S, 3 * S, '#2b2f36'); px(g, 5 * S, 33 * S, 4 * S, S, '#59606b');
  px(g, 6 * S, 11 * S, 2 * S, 23 * S, '#3b4048'); px(g, 6 * S, 11 * S, S, 23 * S, '#5d6470');
  px(g, 3 * S, 3 * S, 8 * S, 2 * S, '#2b2f36'); px(g, 5 * S, 1 * S, 4 * S, 2 * S, '#2b2f36'); px(g, 6 * S, 0, 2 * S, S, '#59606b');
  px(g, 4 * S, 5 * S, 6 * S, 6 * S, '#ffd95a'); px(g, 5 * S, 6 * S, 4 * S, 4 * S, '#fff7c9');
  px(g, 3 * S, 5 * S, S, 6 * S, '#2b2f36'); px(g, 10 * S, 5 * S, S, 6 * S, '#2b2f36'); px(g, 3 * S, 11 * S, 8 * S, S, '#2b2f36');
  return { canvas: c, ox: 0.5, oy: 37 / LH };
}
function makeSign() {
  var S = 2, LW = 32, LH = 38, cv = mkCanvas(LW * S, LH * S), c = cv[0], g = cv[1];
  ell(g, 16, 35, 8, 2, 'rgba(0,0,0,0.25)', S);
  px(g, 14 * S, 7 * S, 4 * S, 28 * S, '#7a4e24'); px(g, 14 * S, 7 * S, S, 28 * S, '#a06f3c'); px(g, 17 * S, 7 * S, S, 28 * S, '#5a3a1e');
  px(g, 5 * S, 9 * S, 20 * S, 7 * S, '#d19b5d'); px(g, 25 * S, 10 * S, 2 * S, 5 * S, '#d19b5d'); px(g, 27 * S, 11 * S, S, 3 * S, '#d19b5d');
  px(g, 5 * S, 9 * S, 20 * S, S, '#ecc388'); px(g, 5 * S, 15 * S, 20 * S, S, '#9a6a35');
  px(g, 9 * S, 18 * S, 20 * S, 7 * S, '#bd8749'); px(g, 7 * S, 19 * S, 2 * S, 5 * S, '#bd8749'); px(g, 6 * S, 20 * S, S, 3 * S, '#bd8749');
  px(g, 9 * S, 18 * S, 20 * S, S, '#dba765'); px(g, 9 * S, 24 * S, 20 * S, S, '#8a5c2d');
  [[8, 12], [22, 12], [12, 21], [26, 21]].forEach(function (n) { px(g, n[0] * S, n[1] * S, S, S, '#4a3018'); });
  return { canvas: c, ox: 0.5, oy: 35 / LH };
}
function makeReed() {
  var S = 2, LW = 20, LH = 30, cv = mkCanvas(LW * S, LH * S), c = cv[0], g = cv[1];
  ell(g, 10, 27, 7, 2, 'rgba(0,0,0,0.18)', S);
  [[5, 16, 0], [8, 22, 0], [11, 19, 1], [14, 14, 0], [10, 12, 0]].forEach(function (s_) {
    var x = s_[0], h = s_[1];
    px(g, x * S, (27 - h) * S, S, h * S, '#3f8a3a'); px(g, (x + 1) * S, (27 - h) * S + S * 2, S, (h - 2) * S, '#69bf58');
    if (s_[2] !== undefined) { px(g, x * S - S, (27 - h) * S, 3 * S, 6 * S, '#6b3f1d'); px(g, x * S, (27 - h) * S, S, 6 * S, '#8f5a2c'); px(g, x * S, (26 - h) * S, S, S, '#c9a06a'); }
  });
  [[2, 24, -1], [16, 24, 1], [7, 25, -1], [12, 25, 1]].forEach(function (b) { px(g, b[0] * S, b[1] * S, S, 3 * S, '#4da545'); px(g, (b[0] + b[2]) * S, (b[1] - 2) * S, S, 2 * S, '#69bf58'); });
  return { canvas: c, ox: 0.5, oy: 27 / LH };
}
function makePad(flower) {
  var S = 2, LW = 18, LH = 10, cv = mkCanvas(LW * S, LH * S), c = cv[0], g = cv[1];
  ell(g, 9, 5, 7, 3, '#2c9444', S); ell(g, 9, 4, 6, 2, '#4cc05f', S); ell(g, 7, 4, 2, 1, '#8ee07a', S);
  g.clearRect(10 * S, 5 * S, 7 * S, S);
  if (flower) { px(g, 6 * S, 1 * S, 4 * S, 3 * S, '#ff86b0'); px(g, 7 * S, 0, 2 * S, S, '#ffb3cc'); px(g, 7 * S, 2 * S, 2 * S, S, '#fff3a0'); }
  return { canvas: c, ox: 0.5, oy: 0.55 };
}
function makeFishShadow() {
  var S = 2, cv = mkCanvas(44, 20), c = cv[0], g = cv[1];
  ell(g, 9, 5, 8, 3, 'rgba(5,45,80,0.5)', S); px(g, 17 * S, 3 * S, 2 * S, 4 * S, 'rgba(5,45,80,0.5)'); px(g, 19 * S, 2 * S, 2 * S, 6 * S, 'rgba(5,45,80,0.5)');
  return c;
}
function makeSparkle() {
  var cv = mkCanvas(7, 7), c = cv[0], g = cv[1];
  px(g, 3, 0, 1, 7, '#ffffff'); px(g, 0, 3, 7, 1, '#ffffff'); px(g, 2, 2, 3, 3, '#ffffff');
  return c;
}
function makeBobber() {
  var S = 2, cv = mkCanvas(6 * S, 9 * S), c = cv[0], g = cv[1];
  disc(g, 3, 3, 3, '#e53935', S);
  px(g, 0, 4 * S, 6 * S, 2 * S, '#ffffff');
  px(g, 1 * S, 6 * S, 4 * S, S, '#cfd8dc');
  px(g, 2 * S, 0, 2 * S, S, '#ffeb3b');
  return c;
}
function makeFishCanvas(f) {
  var cv = mkCanvas(24, 14), c = cv[0], g = cv[1], x, y;
  for (x = 4; x <= 20; x++) {
    var hh = Math.round(5 * Math.sqrt(Math.max(0, 1 - Math.pow((x - 12) / 8.6, 2))));
    if (hh < 1) continue;
    var colx = f.rainbow ? 'hsl(' + Math.round((x - 4) * 22) + ',85%,60%)' : f.c[0];
    px(g, x, 7 - hh, 1, hh * 2, colx);
    var bellyFrom = 7 + Math.floor(hh * 0.25);
    px(g, x, bellyFrom, 1, 7 + hh - bellyFrom, f.rainbow ? 'hsl(' + Math.round((x - 4) * 22 + 40) + ',90%,80%)' : f.c[1]);
  }
  for (x = 0; x <= 4; x++) {                            // ekor
    var th = 1 + Math.round((4 - x) * 1.1);
    px(g, x, 7 - th, 1, th * 2, f.c[2]);
  }
  px(g, 9, 1, 6, 2, f.c[2]);                            // sirip punggung
  px(g, 11, 11, 3, 2, f.c[2]);                          // sirip perut
  if (f.stripe) { px(g, 9, 3, 2, 8, f.stripe); px(g, 14, 3, 2, 8, f.stripe); }
  if (f.dots) { px(g, 8, 5, 2, 2, f.dots); px(g, 12, 7, 2, 2, f.dots); px(g, 15, 5, 2, 2, f.dots); px(g, 10, 9, 2, 1, f.dots); }
  px(g, 17, 5, 2, 2, '#ffffff'); px(g, 18, 6, 1, 1, '#111111');
  if (f.rarity === 'legendary') { px(g, 20, 2, 1, 1, '#fff'); px(g, 2, 11, 1, 1, '#fff'); px(g, 22, 8, 1, 1, '#fff'); }
  return c;
}
var ICON = {};
function buildIcons() {
  FISH.forEach(function (f) { ICON[f.id] = makeFishCanvas(f).toDataURL(); });
}

/* =====================================================================
   B. KONTROL & UI (DOM)
   ===================================================================== */
function $(id) { return document.getElementById(id); }
var scene = null;                     // diisi oleh scene Phaser
var view = { s: 1 };
var Ctl = { joyOn: false, joyX: 0, joyY: 0, keys: {}, modal: false };

function fitStage() {
  var s = Math.max(window.innerWidth / 1280, window.innerHeight / 720); // cover: penuhi layar, potong sedikit area berlebih
  view.s = s || 1;
  $('stage').style.transform = 'translate(-50%,-50%) scale(' + view.s + ')';
}

function totalFish() {
  var n = 0; for (var k in Save.data.inv) n += Save.data.inv[k]; return n;
}
function totalValue() {
  var v = 0; FISH.forEach(function (f) { v += (Save.data.inv[f.id] || 0) * f.price; }); return v;
}
function fmt(n) { return Math.floor(n).toLocaleString('id-ID'); }
function rarTag(r) { return '<span class="r-' + r + '">' + RARITY[r].label + '</span>'; }

var UI = {
  cache: {},
  setCoins: function (pop) {
    $('coinText').textContent = fmt(Save.data.coins);
    if (pop) { var b = $('coinBox'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
  },
  setBag: function () { $('bagCount').textContent = totalFish(); },
  setFishButton: function (label, mode, enabled) {   // mode: '', 'cancel', 'bite'
    var key = label + '|' + mode + '|' + enabled;
    if (this.cache.fish === key) return;
    this.cache.fish = key;
    var b = $('btnFish');
    b.textContent = label;
    b.className = (mode || '') + (enabled ? '' : ' disabled');
  },
  showTalk: function (on) {
    if (this.cache.talk === on) return;
    this.cache.talk = on;
    $('btnTalk').classList.toggle('show', on);
  },
  setBanner: function (text, cls) {
    var key = text + '|' + cls;
    if (this.cache.banner === key) return;
    this.cache.banner = key;
    var b = $('banner');
    b.textContent = text || '';
    b.className = text ? ('show ' + (cls || '')) : '';
    $('biteBar').className = cls === 'bite' ? 'show' : '';
  },
  setBite: function (frac) { $('biteBar').firstElementChild.style.width = Math.max(0, Math.min(1, frac)) * 100 + '%'; },
  setReel: function (on, frac) {
    var b = $('reelBar');
    if (this.cache.reel !== on) { this.cache.reel = on; b.className = on ? 'show' : ''; }
    if (!on) return;
    b.firstElementChild.style.width = Math.max(0, Math.min(1, frac)) * 100 + '%';
    b.classList.toggle('low', frac < 0.3);
    if (scene && scene.fish.kick > 0.9) { b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit'); }
  },
  setSpot: function (text) {
    if (this.cache.spot === text) return;
    this.cache.spot = text;
    var s = $('spotLabel'); s.textContent = text || ''; s.className = text ? 'show' : '';
  },
  toastTimer: 0,
  toast: function (html, rc, legendary, ms) {
    var t = $('toast');
    t.innerHTML = html;
    t.style.setProperty('--rc', rc || '#5fe0e6');
    t.className = 'show' + (legendary ? ' legend' : '');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(function () { t.className = ''; }, ms || 2600);
  },
  hintTimer: 0,
  hint: function (text, ms) {
    var h = $('hint'); h.textContent = text; h.className = 'show';
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(function () { h.className = ''; }, ms || 6000);
  }
};

/* ---------- Joystick virtual (melayang di area kiri bawah) ---------- */
var JOY_DEF = { x: 150, y: 570 }, JOY_MAX = 62;
var joy = { id: null, cx: JOY_DEF.x, cy: JOY_DEF.y };
function setJoyBase(x, y) {
  joy.cx = x; joy.cy = y;
  var b = $('joyBase'); b.style.left = (x - 75) + 'px'; b.style.top = (y - 75) + 'px';
}
function resetJoy() {
  joy.id = null; Ctl.joyOn = false; Ctl.joyX = 0; Ctl.joyY = 0;
  setJoyBase(JOY_DEF.x, JOY_DEF.y);
  $('joyKnob').style.transform = 'translate(0px,0px)';
}
function joyUpdate(e) {
  var r = $('stage').getBoundingClientRect();
  var lx = (e.clientX - r.left) / view.s, ly = (e.clientY - r.top) / view.s;
  var dx = lx - joy.cx, dy = ly - joy.cy, len = Math.hypot(dx, dy);
  if (len > JOY_MAX) { dx *= JOY_MAX / len; dy *= JOY_MAX / len; len = JOY_MAX; }
  Ctl.joyX = dx / JOY_MAX; Ctl.joyY = dy / JOY_MAX;
  Ctl.joyOn = true;
  $('joyKnob').style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
}
function initJoystick() {
  var zone = $('joyZone');
  zone.addEventListener('pointerdown', function (e) {
    if (joy.id !== null || Ctl.modal) return;
    e.preventDefault();
    joy.id = e.pointerId;
    try { zone.setPointerCapture(e.pointerId); } catch (err) { /* abaikan */ }
    var r = $('stage').getBoundingClientRect();
    var lx = (e.clientX - r.left) / view.s, ly = (e.clientY - r.top) / view.s;
    setJoyBase(Math.min(400, Math.max(100, lx)), Math.min(650, Math.max(450, ly)));
    joyUpdate(e);
  });
  zone.addEventListener('pointermove', function (e) { if (e.pointerId === joy.id) { e.preventDefault(); joyUpdate(e); } });
  var end = function (e) { if (e.pointerId === joy.id) resetJoy(); };
  zone.addEventListener('pointerup', end);
  zone.addEventListener('pointercancel', end);
  zone.addEventListener('lostpointercapture', end);
  zone.addEventListener('contextmenu', function (e) { e.preventDefault(); });
}

/* ---------- Keyboard (untuk tes di komputer) ---------- */
var KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down' };
function initKeyboard() {
  window.addEventListener('keydown', function (e) {
    if (KEYMAP[e.code]) { Ctl.keys[KEYMAP[e.code]] = true; e.preventDefault(); return; }
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'KeyF') { if (scene) scene.pressFish(); e.preventDefault(); }
    else if (e.code === 'KeyE') { if (scene) scene.pressTalk(); }
    else if (e.code === 'KeyI' || e.code === 'KeyB') Modal.toggle('inv');
    else if (e.code === 'Escape') Modal.close();
  });
  window.addEventListener('keyup', function (e) { if (KEYMAP[e.code]) Ctl.keys[KEYMAP[e.code]] = false; });
  window.addEventListener('blur', function () { Ctl.keys = {}; resetJoy(); });
}

/* ---------- Modal Inventory & Toko ---------- */
var invSel = null, shopSel = null, resetArm = 0;
var NPC_SAY = {
  hi: 'Halo, nelayan! Mau jual hasil tangkapanmu? Aku bayar sesuai harga.',
  thanks: function (n, c) { return 'Terima kasih! ' + n + ' ikan dibeli, kamu dapat ' + fmt(c) + ' Coins.'; },
  none: 'Kamu belum punya ikan. Pergilah memancing dulu, ya!'
};
var npcLine = NPC_SAY.hi;

var Modal = {
  cur: null,
  open: function (name) {
    this.cur = name;
    $('modal').classList.remove('hidden');
    $('panelInv').hidden = name !== 'inv';
    $('panelShop').hidden = name !== 'shop';
    Ctl.modal = true; resetJoy();
    if (name === 'inv') { resetArm = 0; $('btnReset').textContent = 'Reset Data'; renderInventory(); }
    if (name === 'shop') { npcLine = NPC_SAY.hi; renderShop(); }
  },
  close: function () {
    if (!this.cur) return;
    this.cur = null;
    $('modal').classList.add('hidden');
    Ctl.modal = false;
    Save.write();
  },
  toggle: function (name) { if (this.cur === name) this.close(); else this.open(name); }
};

function fishRowHTML(f, right) {
  return '<img class="ficon" src="' + ICON[f.id] + '" alt=""><div class="fname"><b>' + f.name + '</b><span>' + rarTag(f.rarity) + '</span></div><div class="cnt">' + right + '</div>';
}
function fishDetailHTML(f, extra) {
  var n = Save.data.inv[f.id] || 0, caught = Save.data.caught[f.id] || 0;
  return '<img class="big" src="' + ICON[f.id] + '" alt=""><h3>' + f.name + '</h3>' +
    '<div class="tag">' + rarTag(f.rarity) + '</div>' +
    '<div class="stat"><span>Jumlah dimiliki</span><b>' + n + '</b></div>' +
    '<div class="stat"><span>Harga jual</span><b>' + fmt(f.price) + ' Coins</b></div>' +
    '<div class="stat"><span>Total tertangkap</span><b>' + caught + '</b></div>' +
    '<p>' + f.desc + '</p>' + (extra || '');
}

function renderInventory() {
  var list = $('invList'), detail = $('invDetail');
  list.innerHTML = '';
  if (!invSel || !FISH_BY_ID[invSel] || !(Save.data.caught[invSel] > 0)) {
    invSel = null;
    for (var q = 0; q < FISH.length; q++) if (Save.data.caught[FISH[q].id] > 0) { invSel = FISH[q].id; break; }
  }
  FISH.forEach(function (f) {
    var n = Save.data.inv[f.id] || 0, seen = (Save.data.caught[f.id] || 0) > 0;
    var row = document.createElement('div');
    row.className = 'row' + (invSel === f.id ? ' sel' : '') + (seen ? (n ? '' : ' empty') : ' unknown');
    row.style.setProperty('--rc', seen ? RARITY[f.rarity].color : '#556');
    row.innerHTML = seen ? fishRowHTML(f, 'x' + n)
      : '<div class="ficon q">?</div><div class="fname"><b>???</b><span>Belum ditemukan</span></div><div class="cnt">-</div>';
    row.addEventListener('click', function () { if (seen) { invSel = f.id; renderInventory(); } });
    list.appendChild(row);
  });
  detail.innerHTML = invSel ? fishDetailHTML(FISH_BY_ID[invSel])
    : '<div class="empty">Belum ada ikan.<br>Tangkap ikan pertamamu untuk membuka informasinya!</div>';
  var found = FISH.filter(function (f) { return Save.data.caught[f.id] > 0; }).length;
  $('invSummary').textContent = 'Ikan di tas: ' + totalFish() + '  |  Nilai: ' + fmt(totalValue()) + ' Coins  |  Koleksi: ' + found + '/' + FISH.length;
}

function sellFish(id, all) {
  var n = Save.data.inv[id] || 0;
  if (n <= 0) return;
  var cnt = all ? n : 1, earn = cnt * FISH_BY_ID[id].price;
  Save.data.inv[id] = n - cnt;
  if (Save.data.inv[id] <= 0) delete Save.data.inv[id];
  Save.data.coins += earn;
  Save.write();
  UI.setCoins(true); UI.setBag();
  npcLine = NPC_SAY.thanks(cnt, earn);
  renderShop();
}
function sellEverything() {
  var cnt = 0, earn = 0;
  FISH.forEach(function (f) { var n = Save.data.inv[f.id] || 0; cnt += n; earn += n * f.price; });
  if (!cnt) return;
  Save.data.inv = {};
  Save.data.coins += earn;
  Save.write();
  UI.setCoins(true); UI.setBag();
  npcLine = NPC_SAY.thanks(cnt, earn);
  renderShop();
}
function renderShop() {
  var list = $('shopList'), detail = $('shopDetail');
  list.innerHTML = '';
  var owned = FISH.filter(function (f) { return (Save.data.inv[f.id] || 0) > 0; });
  if (!shopSel || !(Save.data.inv[shopSel] > 0)) shopSel = owned.length ? owned[0].id : null;
  owned.forEach(function (f) {
    var row = document.createElement('div');
    row.className = 'row' + (shopSel === f.id ? ' sel' : '');
    row.style.setProperty('--rc', RARITY[f.rarity].color);
    row.innerHTML = fishRowHTML(f, 'x' + Save.data.inv[f.id] + '<small>' + fmt(f.price) + ' /ekor</small>');
    row.addEventListener('click', function () { shopSel = f.id; renderShop(); });
    list.appendChild(row);
  });
  var say = '<div class="npcSay">' + (owned.length ? npcLine : (npcLine === NPC_SAY.hi ? NPC_SAY.none : npcLine)) + '</div>';
  if (shopSel) {
    var f = FISH_BY_ID[shopSel], n = Save.data.inv[shopSel];
    detail.innerHTML = say + fishDetailHTML(f,
      '<div class="btns"><button class="btn blue" type="button" id="sell1">Jual 1 (+' + fmt(f.price) + ')</button>' +
      '<button class="btn" type="button" id="sellN">Jual Semua (+' + fmt(n * f.price) + ')</button></div>');
    $('sell1').addEventListener('click', function () { sellFish(shopSel, false); });
    $('sellN').addEventListener('click', function () { sellFish(shopSel, true); });
  } else {
    detail.innerHTML = say + '<div class="empty">Tidak ada ikan untuk dijual.</div>';
  }
  $('shopSummary').textContent = 'Coins kamu: ' + fmt(Save.data.coins) + '  |  Nilai semua ikan: ' + fmt(totalValue());
  $('btnSellAll').disabled = !owned.length;
  $('btnSellAll').textContent = 'Jual Semua Ikan' + (owned.length ? ' (+' + fmt(totalValue()) + ')' : '');
}

function initButtons() {
  function press(id, fn) {
    $(id).addEventListener('pointerdown', function (e) { e.preventDefault(); fn(); });
  }
  press('btnFish', function () { if (scene) scene.pressFish(); });
  press('btnTalk', function () { if (scene) scene.pressTalk(); });
  press('btnBag', function () { Modal.toggle('inv'); });
  $('btnFull').addEventListener('pointerdown', function (e) {
    e.preventDefault();
    try {
      var el = document.documentElement;
      if (!document.fullscreenElement) {
        var p = el.requestFullscreen ? el.requestFullscreen() : (el.webkitRequestFullscreen && el.webkitRequestFullscreen());
        if (p && p.then) p.then(function () { try { screen.orientation.lock('landscape').catch(function () {}); } catch (err) { /* abaikan */ } }).catch(function () {});
      } else if (document.exitFullscreen) document.exitFullscreen();
    } catch (err) { /* abaikan */ }
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (b) {
    b.addEventListener('click', function () { Modal.close(); });
  });
  $('modal').addEventListener('pointerdown', function (e) { if (e.target === $('modal')) Modal.close(); });
  $('btnSellAll').addEventListener('click', sellEverything);
  $('btnReset').addEventListener('click', function () {
    var b = $('btnReset');
    if (!resetArm) {
      resetArm = 1; b.textContent = 'Yakin? Tap lagi';
      setTimeout(function () { resetArm = 0; b.textContent = 'Reset Data'; }, 3000);
      return;
    }
    Save.reset(); resetArm = 0; b.textContent = 'Reset Data';
    invSel = null; shopSel = null;
    UI.setCoins(false); UI.setBag();
    if (scene) scene.resetPlayer();
    renderInventory();
    UI.toast('Data game direset', '#ff7b7b', false, 1800);
  });
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  window.addEventListener('resize', fitStage);
  window.addEventListener('orientationchange', function () { setTimeout(fitStage, 200); });
}

/* =====================================================================
   C. SCENE PHASER
   ===================================================================== */
function readMove() {
  var x = 0, y = 0;
  if (Ctl.joyOn) { x = Ctl.joyX; y = Ctl.joyY; }
  if (Math.hypot(x, y) < 0.28) {
    x = 0; y = 0;
    var k = Ctl.keys;
    if (k.left) x -= 1; if (k.right) x += 1; if (k.up) y -= 1; if (k.down) y += 1;
  }
  return [x, y];
}
function snapDir(dx, dy) {
  var i = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return ((i % 8) + 8) % 8;
}
function rollFish(luck) {
  var mult = [1, 1 + luck * 0.5, 1 + luck * 1.5, 1 + luck * 3, 1 + luck * 4];
  var total = 0, w = RARITY_ORDER.map(function (k, idx) { var v = RARITY[k].weight * mult[idx]; total += v; return v; });
  var r = Math.random() * total, pick = 'common';
  for (var i = 0; i < RARITY_ORDER.length; i++) { r -= w[i]; if (r <= 0) { pick = RARITY_ORDER[i]; break; } }
  var pool = FISH.filter(function (f) { return f.rarity === pick; });
  return pool[Math.floor(Math.random() * pool.length)];
}
function stars(luck) { return luck >= 0.8 ? ' ★★★' : luck >= 0.4 ? ' ★★' : luck > 0 ? ' ★' : ''; }

function createSceneClass() {
  return class MainScene extends Phaser.Scene {
    constructor() { super('Main'); }

    /* ---------- pembuatan ---------- */
    create() {
      scene = this;
      var self = this, M = this.map = buildMap();
      this.T = M.T; this.WALK = M.WALK;

      // tekstur
      this.textures.addCanvas('waves1', makeWaves(1));
      this.textures.addCanvas('waves2', makeWaves(2));
      this.textures.addCanvas('sparkle', makeSparkle());
      this.textures.addCanvas('cloud', makeCloud());
      this.textures.addCanvas('foam', makeFoam(M));
      this.textures.addCanvas('bobber', makeBobber());
      this.textures.addCanvas('ground', makeGround(M));
      var ps = this.textures.addCanvas('player', makePlayerSheet());
      for (var d = 0; d < 8; d++) for (var c = 0; c < 6; c++) ps.add(d + '_' + c, 0, c * 32, d * 48, 32, 48);
      var ns = this.textures.addCanvas('npc', makeNpcSheet());
      ns.add('i0', 0, 0, 0, 32, 48); ns.add('i1', 0, 32, 0, 32, 48);
      var OL = '#0f2a2e', OLG = '#0c3320';
      var defs = {
        palm: outlined(makePalm(), OLG), bush: outlined(makeBush(), OLG), rock0: outlined(makeRock(0), OL), rock1: outlined(makeRock(1), OL),
        stall: outlined(makeStall(), '#2a1408'), tree: outlined(makeTree(), OLG), lamp: outlined(makeLamp(), '#14161a'),
        sign: outlined(makeSign(), '#2a1408'), reed: outlined(makeReed(), OLG), pad0: outlined(makePad(0), '#175a30'), pad1: outlined(makePad(1), '#175a30')
      };
      this.textures.addCanvas('fishsh', makeFishShadow());
      this.origins = {};
      Object.keys(defs).forEach(function (k) { self.textures.addCanvas(k, defs[k].canvas); self.origins[k] = [defs[k].ox, defs[k].oy]; });
      FISH.forEach(function (f) { self.textures.addCanvas('fish_' + f.id, makeFishCanvas(f)); });

      // laut (dua lapis gelombang bergerak) + daratan
      this.waves1 = this.add.tileSprite(0, 0, W, H, 'waves1').setOrigin(0, 0).setDepth(-100);
      this.waves2 = this.add.tileSprite(0, 0, W, H, 'waves2').setOrigin(0, 0).setDepth(-99).setAlpha(0.6);
      this.add.image(0, 0, 'ground').setOrigin(0, 0).setDepth(-50);

      // buih ombak di tepi pantai (dua lapis, bergantian maju-mundur)
      var foamA = this.add.image(0, 0, 'foam').setOrigin(0, 0).setDepth(-49);
      var foamB = this.add.image(0, 3, 'foam').setOrigin(0, 0).setDepth(-49).setAlpha(0.35);
      this.tweens.add({ targets: foamA, alpha: { from: 0.95, to: 0.3 }, y: { from: 0, to: 2 }, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: foamB, alpha: { from: 0.2, to: 0.75 }, y: { from: 4, to: 1 }, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

      // kilau air
      var R = rng(5), placed = 0, tries = 0;
      while (placed < 90 && tries < 1200) {
        tries++;
        var si = Math.floor(R() * GRID), sj = Math.floor(R() * GRID);
        if (this.T[sj * GRID + si] !== WATER) continue;
        var spx = (si - sj) * 32 + W / 2 + (R() - 0.5) * 30, spy = (si + sj) * 16 + 16 + (R() - 0.5) * 12;
        var sp = this.add.image(spx, spy, 'sparkle').setDepth(-45).setAlpha(0);
        this.tweens.add({ targets: sp, alpha: 0.9, scale: { from: 0.6, to: 1.2 }, duration: 600 + R() * 900, yoyo: true, repeat: -1, delay: R() * 2500 });
        placed++;
      }

      // rintangan: pohon, semak, batu
      M.obstacles.forEach(function (o) {
        var key = o.kind === 'rock' ? 'rock' + o.v : o.kind;
        var p = self.gp(o.gx, o.gy, ELEV_LAND);
        if (o.kind === 'tree') self.add.ellipse(p.x + 8, p.y, 62, 20, 0x0b3d14, 0.3).setDepth(-49);
        if (o.kind === 'lamp') {
          var glow = self.add.ellipse(p.x, p.y - 31, 46, 46, 0xffe28a, 0.2).setBlendMode(Phaser.BlendModes.ADD).setDepth(p.y + 1);
          self.tweens.add({ targets: glow, alpha: { from: 0.12, to: 0.3 }, duration: 1400 + Math.random() * 600, yoyo: true, repeat: -1 });
          self.add.ellipse(p.x, p.y, 70, 26, 0xffe28a, 0.1).setBlendMode(Phaser.BlendModes.ADD).setDepth(-48);
        }
        if (o.kind === 'palm') self.add.ellipse(p.x + 12, p.y + 1, 54, 18, 0x0b3d14, 0.28).setDepth(-49);
        else if (o.kind === 'bush') self.add.ellipse(p.x + 2, p.y, 26, 9, 0x0b3d14, 0.25).setDepth(-49);
        var img = self.add.image(p.x, p.y, key).setOrigin(self.origins[key][0], self.origins[key][1]).setDepth(p.y);
        if (o.kind === 'palm') {
          self.tweens.add({ targets: img, angle: { from: -1.4, to: 1.4 }, duration: 2600 + Math.random() * 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: Math.random() * 1500 });
        }
      });

      // dekor: alang-alang, teratai
      (M.decor || []).forEach(function (d) {
        if (d.kind === 'reed') {
          var rp = self.gp(d.gx, d.gy, ELEV_LAND), rk = self.add.image(rp.x, rp.y, 'reed').setOrigin(self.origins.reed[0], self.origins.reed[1]).setDepth(rp.y);
          self.tweens.add({ targets: rk, angle: { from: -2.5, to: 2.5 }, duration: 1800 + Math.random() * 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        } else {
          var pk = 'pad' + d.f, ppx = (d.gx - d.gy) * 32 + W / 2, ppy = (d.gx + d.gy) * 16 + 16;
          var pi2 = self.add.image(ppx, ppy, pk).setOrigin(self.origins[pk][0], self.origins[pk][1]).setDepth(-46);
          self.tweens.add({ targets: pi2, y: ppy + 1.5, angle: { from: -3, to: 3 }, duration: 2200 + Math.random() * 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
      });
      // bayangan ikan berenang pelan di bawah air
      (M.fishC || []).forEach(function (fc) {
        var cx0 = (fc.gx - fc.gy) * 32 + W / 2, cy0 = (fc.gx + fc.gy) * 16 + 16;
        for (var fk = 0; fk < fc.n; fk++) {
          (function (ph, dir, rr, dur) {
            var fsh = self.add.image(cx0, cy0, 'fishsh').setDepth(-47).setAlpha(0.6).setScale(0.8 + Math.random() * 0.5);
            self.tweens.addCounter({ from: 0, to: 6.2832, duration: dur, repeat: -1, onUpdate: function (tw) {
              var a = tw.getValue() * dir + ph;
              fsh.setPosition(cx0 + Math.cos(a) * rr, cy0 + Math.sin(a) * rr * 0.48);
              fsh.setRotation(Math.atan2(dir * Math.cos(a) * rr * 0.48, -dir * Math.sin(a) * rr));
            } });
          })(Math.random() * 6.28, fk % 2 ? -1 : 1, fc.r * (0.7 + Math.random() * 0.5), 9000 + Math.random() * 6000);
        }
      });

      // kios + NPC penjual ikan
      var sp0 = this.gp(M.stall.i + 0.5, M.stall.j + 0.5, ELEV_LAND);
      this.add.image(sp0.x, sp0.y + 6, 'stall').setOrigin(this.origins.stall[0], this.origins.stall[1]).setDepth(sp0.y);
      var np = this.gp(M.npc.gx, M.npc.gy, ELEV_LAND);
      this.add.ellipse(np.x, np.y - 1, 22, 9, 0x000000, 0.28).setDepth(np.y - 1);
      this.npcSprite = this.add.sprite(np.x, np.y, 'npc', 'i0').setOrigin(0.5, 1).setDepth(np.y);
      this.add.text(np.x, np.y - 56, 'Pak Marlin', { fontFamily: 'Arial, sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#ffffff', stroke: '#06222c', strokeThickness: 4 })
        .setResolution(3).setOrigin(0.5, 1).setDepth(9000);
      var npcFrame = 0;
      this.time.addEvent({ delay: 550, loop: true, callback: function () { npcFrame ^= 1; self.npcSprite.setFrame('i' + npcFrame); } });

      // titik memancing (cincin riak di air)
      M.spots.forEach(function (s) {
        var sx = (s.gx - s.gy) * 32 + W / 2, sy = (s.gx + s.gy) * 16;
        for (var k = 0; k < 2; k++) {
          var ring = self.add.ellipse(sx, sy, 60, 28).setStrokeStyle(3, 0xffffff, 0.9).setDepth(-40);
          self.tweens.add({ targets: ring, scaleX: { from: 0.45, to: 1.35 }, scaleY: { from: 0.45, to: 1.35 }, alpha: { from: 1, to: 0 }, duration: 1800, repeat: -1, delay: k * 900 });
        }
        self.add.text(sx, sy - 14, s.name, { fontFamily: 'Arial, sans-serif', fontSize: '14px', fontStyle: 'bold', color: '#ffffff', stroke: '#0a4a66', strokeThickness: 4 })
          .setResolution(3).setOrigin(0.5, 1).setDepth(-39).setAlpha(0.95);
      });

      // pemain
      this.dirIdx = 2; this.walkT = 0; this.curFrame = '';
      var sx0 = Save.data.px, sy0 = Save.data.py;
      this.gx = M.spawn.gx; this.gy = M.spawn.gy;
      if (typeof sx0 === 'number' && typeof sy0 === 'number' && this.canStand(sx0, sy0)) { this.gx = sx0; this.gy = sy0; }
      this.shadow = this.add.ellipse(0, 0, 22, 9, 0x000000, 0.3);
      this.player = this.add.sprite(0, 0, 'player', '2_0').setOrigin(0.5, 1);

      // pancing
      this.rodG = this.add.graphics();
      this.bobber = this.add.image(0, 0, 'bobber').setOrigin(0.5, 0.75).setVisible(false);
      this.ring = this.add.ellipse(0, 0, 40, 18).setStrokeStyle(3, 0xffffff, 0.9).setVisible(false);
      this.bang = this.add.text(0, 0, '!', { fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '46px', fontStyle: 'bold', color: '#ffeb3b', stroke: '#b71c1c', strokeThickness: 7 })
        .setResolution(3).setOrigin(0.5, 1).setVisible(false).setDepth(9500);
      this.fish = { state: 'idle', t: 0, wait: 0, target: null, spot: null, def: null, window: 1, tip: { x: 0, y: 0 }, bx: 0, by: 0, lastMsg: '' };

      // bayangan awan yang melintas pelan
      for (var ci = 0; ci < 6; ci++) {
        var cl = this.add.image(R() * W, R() * H, 'cloud').setDepth(9990).setAlpha(0.13).setScale(3 + R() * 3, 2.5 + R() * 2.5);
        this.tweens.add({ targets: cl, x: cl.x + W * 0.5, y: cl.y + H * 0.12, duration: 70000 + R() * 50000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }

      // kamera
      var cam = this.cameras.main;
      cam.setBounds(0, 0, W, H);
      cam.roundPixels = true;
      cam.setZoom(CAM_ZOOM);
      this.placePlayer();
      cam.centerOn(this.player.x, this.player.y - 20);
      cam.startFollow(this.player, true, 0.12, 0.12);

      // simpan posisi berkala
      this.time.addEvent({ delay: 4000, loop: true, callback: function () { self.savePos(); } });
      var saveNow = function () { self.savePos(); };
      document.addEventListener('visibilitychange', function () { if (document.hidden) saveNow(); });
      window.addEventListener('pagehide', saveNow);

      UI.setCoins(false); UI.setBag();
      $('loading').classList.add('gone');
      UI.hint('Geser joystick untuk berjalan. Dekati laut / cincin riak, lalu tekan LEMPAR. Jual ikan ke Pak Marlin!', 8000);
    }

    /* ---------- koordinat & tabrakan ---------- */
    gp(gx, gy, elev) { return { x: Math.round((gx - gy) * 32 + W / 2), y: Math.round((gx + gy) * 16 - elev) }; }
    typeAt(gx, gy) {
      var i = Math.floor(gx), j = Math.floor(gy);
      return (i < 0 || j < 0 || i >= GRID || j >= GRID) ? WATER : this.T[j * GRID + i];
    }
    walkAt(gx, gy) {
      var i = Math.floor(gx), j = Math.floor(gy);
      if (i < 0 || j < 0 || i >= GRID || j >= GRID) return false;
      return this.WALK[j * GRID + i] === 1;
    }
    canStand(x, y) {
      var r = 0.22;
      return this.walkAt(x - r, y - r) && this.walkAt(x + r, y - r) && this.walkAt(x - r, y + r) && this.walkAt(x + r, y + r);
    }
    elevAt(gx, gy) { var t = this.typeAt(gx, gy); return t === DOCK ? ELEV_DOCK : (t === WATER ? 0 : ELEV_LAND); }
    resetPlayer() {
      this.cancelFish('');
      this.gx = this.map.spawn.gx; this.gy = this.map.spawn.gy;
      this.placePlayer();
      this.cameras.main.centerOn(this.player.x, this.player.y - 20);
    }
    savePos() { Save.data.px = this.gx; Save.data.py = this.gy; Save.write(); }
    placePlayer() {
      var p = this.gp(this.gx, this.gy, this.elevAt(this.gx, this.gy));
      this.player.setPosition(p.x, p.y).setDepth(p.y + 0.5);
      this.shadow.setPosition(p.x, p.y - 1).setDepth(p.y - 0.5);
      this.foot = p;
    }

    /* ---------- memancing ---------- */
    findFishingTarget() {
      var best = null, M = this.map, k;
      for (k = 0; k < M.spots.length; k++) {
        var s = M.spots[k], d = Math.hypot(this.gx - s.gx, this.gy - s.gy);
        if (d <= 4.4 && (!best || d < best.d)) best = { spot: s, d: d };
      }
      if (best) return { gx: best.spot.gx, gy: best.spot.gy, spot: best.spot };
      var ci = Math.floor(this.gx), cj = Math.floor(this.gy), bd = 1e9, bi = -1, bj = -1;
      for (var j = cj - 3; j <= cj + 3; j++) for (var i = ci - 3; i <= ci + 3; i++) {
        if (i < 0 || j < 0 || i >= GRID || j >= GRID || this.T[j * GRID + i] !== WATER) continue;
        var dd = Math.hypot(i + 0.5 - this.gx, j + 0.5 - this.gy);
        if (dd < bd) { bd = dd; bi = i; bj = j; }
      }
      if (bi >= 0 && bd <= 2.4) return { gx: bi + 0.5, gy: bj + 0.5, spot: null };
      return null;
    }
    pressFish() {
      if (Ctl.modal || !this.fish) return;
      var st = this.fish.state;
      if (st === 'idle') this.startCast();
      else if (st === 'casting' || st === 'waiting') this.cancelFish('Kail ditarik kembali');
      else if (st === 'bite') this.startReel();
      else if (st === 'reel') this.reelPull();
    }
    pressTalk() {
      if (Ctl.modal || !this.nearNpc) return;
      if (this.fish.state !== 'idle' && this.fish.state !== 'cooldown') return;
      Modal.open('shop');
    }
    rodGeometry() {
      var f = this.fish, p = this.foot;
      var tx = f.target ? (f.target.gx - f.target.gy) * 32 + W / 2 : p.x + 20;
      var ty = f.target ? (f.target.gx + f.target.gy) * 16 : p.y;
      var dx = tx - p.x, dy = ty - p.y, l = Math.hypot(dx, dy) || 1;
      dx /= l; dy /= l;
      var hand = { x: p.x + dx * 6, y: p.y - 20 };
      return { hand: hand, tip: { x: hand.x + dx * 26, y: hand.y - 22 + dy * 6 }, tx: tx, ty: ty };
    }
    startCast() {
      var tgt = this.findFishingTarget();
      if (!tgt) { UI.toast('<div>Dekati laut atau cincin riak untuk memancing</div>', '#5fe0e6', false, 1800); return; }
      var f = this.fish;
      f.target = tgt; f.spot = tgt.spot; f.state = 'casting'; f.t = 0;
      var g = this.rodGeometry();
      this.dirIdx = snapDir(g.tx - this.foot.x, (g.ty - this.foot.y) * 2);
      this.curFrame = '';
      f.tip = g.tip; f.bx = g.tx; f.by = g.ty;
      this.bobber.setVisible(true).setPosition(g.tip.x, g.tip.y);
    }
    splash(x, y) {
      var self = this;
      for (var k = 0; k < 2; k++) {
        var e = this.add.ellipse(x, y, 30, 14).setStrokeStyle(3, 0xffffff, 0.95).setDepth(9400);
        this.tweens.add({ targets: e, scaleX: 2.6 + k, scaleY: 2.6 + k, alpha: 0, duration: 650 + k * 250, delay: k * 120, onComplete: function (tw, targets) { targets[0].destroy(); } });
      }
    }
    startBite() {
      var f = this.fish, luck = f.spot ? f.spot.luck : 0;
      f.def = rollFish(luck);
      f.window = RARITY[f.def.rarity].window;
      f.state = 'bite'; f.t = 0;
      this.splash(f.bx, f.by);
      this.bang.setVisible(true);
    }
    hideFishing() {
      this.bobber.setVisible(false); this.ring.setVisible(false); this.bang.setVisible(false);
      this.rodG.clear();
    }
    cancelFish(msg) {
      var f = this.fish;
      if (f.state === 'idle') return;
      f.state = 'idle'; f.t = 0; f.def = null;
      this.hideFishing();
      if (msg) UI.toast('<div>' + msg + '</div>', '#5fe0e6', false, 1400);
    }
    startReel() {
      var f = this.fish;
      f.state = 'reel'; f.t = 0; f.prog = 0.25; f.kick = 0; f.pulls = 0; f.reel = REEL[f.def.rarity];
      this.bang.setVisible(false);
      this.reelPull();
    }
    reelPull() {
      var f = this.fish;
      f.prog = Math.min(1, f.prog + f.reel.gain);
      f.kick = 1; f.pulls++;
      if (f.pulls % 3 === 0) this.splash(f.bx, f.by);
      if (f.prog >= 1) this.landFish();
    }
    loseFish(msg) {
      var f = this.fish;
      f.state = 'cooldown'; f.t = 0; f.def = null;
      this.hideFishing();
      this.splash(f.bx, f.by);
      UI.toast('<div>' + (msg || 'Ikan lepas! Kamu terlambat menarik.') + '</div>', '#ff7b7b', false, 1900);
    }
    landFish() {
      var self = this, f = this.fish, def = f.def;
      if (!def) return;
      var first = !(Save.data.caught[def.id] > 0);
      Save.data.inv[def.id] = (Save.data.inv[def.id] || 0) + 1;
      Save.data.caught[def.id] = (Save.data.caught[def.id] || 0) + 1;
      this.savePos();
      UI.setBag();
      var rc = RARITY[def.rarity].color, bx = f.bx, by = f.by, foot = this.foot;
      f.state = 'cooldown'; f.t = 0; f.def = null;
      this.hideFishing();
      this.splash(bx, by);

      // ikan melompat dari air ke pemain
      var jump = this.add.image(bx, by, 'fish_' + def.id).setScale(2).setDepth(9600);
      this.tweens.addCounter({
        from: 0, to: 1, duration: 650,
        onUpdate: function (tw) {
          var v = tw.getValue();
          jump.setPosition(bx + (foot.x - bx) * v, by + (foot.y - 30 - by) * v - Math.sin(v * Math.PI) * 70);
          jump.setAngle(v * 360);
        },
        onComplete: function () { jump.destroy(); }
      });

      var r = RARITY[def.rarity];
      UI.toast(
        '<img src="' + ICON[def.id] + '" alt=""><div>' + (first ? 'BARU! ' : '') + def.name +
        '<small><span class="rar" style="color:' + rc + '">' + r.label + '</span> - Jual ' + fmt(def.price) + ' Coins</small></div>',
        rc, def.rarity === 'legendary' || def.rarity === 'epic', def.rarity === 'legendary' ? 4000 : 2800);
    }

    /* ---------- loop utama ---------- */
    update(time, delta) {
      var dt = Math.min(delta, 50) / 1000;
      this.waves1.tilePositionX += 9 * dt; this.waves1.tilePositionY += 3 * dt;
      this.waves2.tilePositionX -= 6 * dt; this.waves2.tilePositionY += 4 * dt;

      var f = this.fish, paused = Ctl.modal;
      var mv = paused ? [0, 0] : readMove();
      var moving = Math.hypot(mv[0], mv[1]) > 0.28;

      // bergerak membatalkan pancingan yang masih menunggu
      if (moving && (f.state === 'waiting' || f.state === 'casting')) this.cancelFish('Kail ditarik kembali');
      var canMove = f.state === 'idle' || f.state === 'cooldown';
      var walking = false;

      if (moving && canMove) {
        this.dirIdx = snapDir(mv[0], mv[1]);
        var ang = this.dirIdx * Math.PI / 4;
        var vx = Math.cos(ang), vy = Math.sin(ang) * 0.5, l = Math.hypot(vx, vy);
        var sx = vx / l * SPEED * dt, sy = vy / l * SPEED * dt;
        var dgx = (sx / 32 + sy / 16) / 2, dgy = (sy / 16 - sx / 32) / 2;
        var ox = this.gx, oy = this.gy;
        if (this.canStand(this.gx + dgx, this.gy)) this.gx += dgx;
        if (this.canStand(this.gx, this.gy + dgy)) this.gy += dgy;
        walking = Math.abs(this.gx - ox) + Math.abs(this.gy - oy) > 1e-5;
      }
      if (walking) this.walkT += dt;

      var frame = this.dirIdx + '_' + (walking ? 2 + (Math.floor(this.walkT * 9) % 4) : (Math.floor(time / 500) % 2));
      if (frame !== this.curFrame) { this.curFrame = frame; this.player.setFrame(frame); }
      this.placePlayer();

      this.updateFishing(time, paused ? 0 : dt);
      this.updateHud();
    }

    updateFishing(time, dt) {
      var f = this.fish, st = f.state;
      if (st === 'idle') return;
      var g = this.rodGeometry();
      f.tip = g.tip;
      var sag = 14;

      if (st === 'cooldown') {
        f.t += dt;
        if (f.t > 0.6) { f.state = 'idle'; f.t = 0; }
        return;
      }
      var bx = f.bx, by = f.by;
      if (st === 'casting') {
        f.t += dt;
        var pr = Math.min(1, f.t / 0.55);
        bx = g.tip.x + (g.tx - g.tip.x) * pr;
        by = g.tip.y + (g.ty - g.tip.y) * pr - Math.sin(pr * Math.PI) * 70;
        sag = 4;
        if (pr >= 1) {
          f.state = 'waiting'; f.t = 0; f.wait = 2 + Math.random() * 3.5;
          this.splash(g.tx, g.ty);
        }
      } else if (st === 'waiting') {
        f.t += dt;
        bx = g.tx; by = g.ty + Math.sin(time * 0.004) * 1.6;
        this.ring.setVisible(true).setPosition(bx, g.ty + 2).setDepth(g.ty - 1);
        var ph = (time * 0.0011) % 1;
        this.ring.setScale(0.5 + ph * 0.9).setAlpha(1 - ph);
        if (f.t >= f.wait) this.startBite();
      } else if (st === 'bite') {
        f.t += dt;
        bx = g.tx + Math.sin(time * 0.05) * 1.5; by = g.ty + 5 + Math.sin(time * 0.03) * 2;
        sag = 2;
        var p2 = (time * 0.0035) % 1;
        this.ring.setVisible(true).setPosition(g.tx, g.ty + 2).setDepth(g.ty - 1).setScale(0.6 + p2 * 1.3).setAlpha(1 - p2);
        this.bang.setPosition(g.tx, g.ty - 26 + Math.abs(Math.sin(time * 0.012)) * -8);
        UI.setBite(1 - f.t / f.window);
        if (f.t >= f.window) { this.loseFish(); return; }
      }
      else if (st === 'reel') {
        f.t += dt;
        if (f.t > 0.7) f.prog -= f.reel.decay * dt;
        f.kick = Math.max(0, f.kick - dt * 6);
        g.tip.y += f.kick * 5;
        bx = g.tx + Math.sin(time * 0.045) * 6 * (1.2 - f.prog); by = g.ty + 3 + Math.sin(time * 0.07) * 3;
        sag = 2;
        var p3 = (time * 0.006) % 1;
        this.ring.setVisible(true).setPosition(g.tx, g.ty + 2).setDepth(g.ty - 1).setScale(0.6 + p3 * 1.3).setAlpha(1 - p3);
        if (f.prog >= 1) { this.landFish(); return; }
        if (f.prog <= 0) { this.loseFish('Ikan lepas! Tarikanmu kurang cepat.'); return; }
      }
      f.bx = g.tx; f.by = g.ty;
      this.bobber.setVisible(true).setPosition(bx, by).setDepth(Math.max(g.ty, by) + 1);

      // joran + senar
      var rg = this.rodG; rg.clear().setDepth(this.foot.y + 2);
      rg.lineStyle(3, 0x6b4423, 1); rg.lineBetween(g.hand.x, g.hand.y, g.tip.x, g.tip.y);
      rg.lineStyle(1, 0xc9a06a, 1); rg.lineBetween(g.hand.x, g.hand.y - 1, g.tip.x, g.tip.y - 1);
      rg.lineStyle(1, (st === 'reel' && f.prog < 0.3) ? 0xff5252 : 0xffffff, 0.9); rg.beginPath(); rg.moveTo(g.tip.x, g.tip.y);
      for (var k = 1; k <= 14; k++) {
        var t = k / 14;
        rg.lineTo(g.tip.x + (bx - g.tip.x) * t, g.tip.y + (by - g.tip.y) * t + Math.sin(t * Math.PI) * sag);
      }
      rg.strokePath();
    }

    updateHud() {
      var f = this.fish, st = f.state, M = this.map;
      UI.setReel(st === 'reel', f.prog || 0);
      var tgt = (st === 'idle' || st === 'cooldown') && !Ctl.modal ? this.findFishingTarget() : null;
      if (st === 'idle' || st === 'cooldown') {
        UI.setFishButton('LEMPAR', '', st === 'idle' && !!tgt);
        UI.setBanner('', '');
        UI.setSpot(tgt && tgt.spot ? ('Spot: ' + tgt.spot.name + stars(tgt.spot.luck)) : '');
      } else if (st === 'casting') {
        UI.setFishButton('BATAL', 'cancel', true); UI.setBanner('Melempar kail...', ''); UI.setSpot('');
      } else if (st === 'waiting') {
        UI.setFishButton('BATAL', 'cancel', true); UI.setBanner('Menunggu ikan menggigit' + '...'.slice(0, 1 + Math.floor(performance.now() / 400) % 3), ''); UI.setSpot('');
      } else if (st === 'bite') {
        UI.setFishButton('TARIK!', 'bite', true); UI.setBanner('IKAN MENGGIGIT! TARIK SEKARANG!', 'bite'); UI.setSpot('');
      } else if (st === 'reel') {
        UI.setFishButton('TARIK!', 'bite', true); UI.setBanner('TARIK TERUS SAMPAI BAR PENUH!', 'reel'); UI.setSpot('');
      }
      this.nearNpc = Math.hypot(this.gx - M.npc.gx, this.gy - M.npc.gy) < 2.7;
      UI.showTalk(this.nearNpc && !Ctl.modal && (st === 'idle' || st === 'cooldown'));
    }
  };
}

/* =====================================================================
   D. MULAI
   ===================================================================== */
function start() {
  Save.load();
  buildIcons();
  fitStage();
  initJoystick();
  initKeyboard();
  initButtons();
  resetJoy();
  UI.setCoins(false); UI.setBag();

  if (typeof Phaser === 'undefined') {
    $('loading').textContent = 'Phaser gagal dimuat. Periksa internet, atau taruh phaser.min.js di folder yang sama.';
    return;
  }
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: 1280, height: 720,
    backgroundColor: '#1aa9c4',
    pixelArt: true,
    roundPixels: true,
    scale: { mode: Phaser.Scale.NONE },
    input: { mouse: false, touch: false, keyboard: false, gamepad: false },
    scene: [createSceneClass()]
  });
}

window.__TF = {
  buildMap: buildMap, makeGround: makeGround, makePlayerSheet: makePlayerSheet, makeNpcSheet: makeNpcSheet,
  makePalm: makePalm, makeBush: makeBush, makeRock: makeRock, makeStall: makeStall, makeWaves: makeWaves,
  makeFishCanvas: makeFishCanvas, getScene: function () { return scene; }, Ctl: Ctl, FISH: FISH, RARITY: RARITY, rollFish: rollFish, Save: Save, W: W, H: H, GRID: GRID
};

start();
})();
