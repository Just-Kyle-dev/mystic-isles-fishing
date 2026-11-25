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
  place('palm', 12, function (ci, cj) { var d = dist(ci, cj); return d > 4.5 && d < 10.8; }, 2.6);
  place('bush', 8, function (ci, cj) { return T[cj * GRID + ci] === GRASS && dist(ci, cj) < 7.4; }, 2.3);
  place('rock', 8, function (ci, cj) { return nearWater(ci, cj) || dist(ci, cj) > 7.6; }, 2.3);

  // dekor tanpa tabrakan: alang-alang di tepi air, teratai, bayangan ikan
  var R2 = rng(777), decor = [], fishC = [], cand2 = [];
  for (j = 0; j < GRID; j++) for (i = 0; i < GRID; i++) if (T[j * GRID + i] === SAND || T[j * GRID + i] === GRASS) cand2.push([i, j]);
  for (i = cand2.length - 1; i > 0; i--) { j = Math.floor(R2() * (i + 1)); var t2 = cand2[i]; cand2[i] = cand2[j]; cand2[j] = t2; }
  function farFrom(list, x, y, d) { for (var q = 0; q < list.length; q++) if (Math.hypot(list[q].gx - x, list[q].gy - y) < d) return false; return true; }
  for (var q = 0; q < cand2.length && decor.length < 18; q++) {
    var ri = cand2[q][0], rj = cand2[q][1];
    if (!nearWater(ri, rj) || (ri >= C + 4 && Math.abs(rj - C) <= 4)) continue;
    var rx = ri + 0.3 + R2() * 0.4, ry = rj + 0.3 + R2() * 0.4;
    if (!farFrom(decor, rx, ry, 2.2)) continue;
    var blocked = false;
    for (var oo = 0; oo < obstacles.length; oo++) if (obstacles[oo].i === ri && obstacles[oo].j === rj) blocked = true;
    if (!blocked) decor.push({ kind: 'reed', gx: rx, gy: ry });
  }
  var pads = 0;
  for (var tries = 0; tries < 900 && pads < 16; tries++) {
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

  // dekor tropis tambahan (murni visual, tanpa tabrakan)
  function hasObs(ci, cj) { for (var o = 0; o < obstacles.length; o++) if (obstacles[o].i === ci && obstacles[o].j === cj) return true; return ci === stall.i && cj === stall.j; }
  function onLane(x, y) { return segDist(x, y, stall.i + 1, stall.j + 0.5, C + 0.5, C + 0.5) < 1.7 || segDist(x, y, C + 0.5, C + 0.5, dockStart, C + 0.5) < 1.9 || Math.hypot(x - spawn.gx, y - spawn.gy) < 2.3 || Math.hypot(x - npc.gx, y - npc.gy) < 2.7; }
  var nb = 0;
  for (q = 0; q < cand2.length && nb < 6; q++) {
    var bi = cand2[q][0], bj = cand2[q][1], bxx = bi + 0.5, byy = bj + 0.5;
    if (T[bj * GRID + bi] !== GRASS || hasObs(bi, bj) || onLane(bxx, byy) || dist(bi, bj) > 7.0 || !farFrom(decor, bxx, byy, 2.6)) continue;
    decor.push({ kind: 'banana', gx: bxx, gy: byy }); nb++;
  }
  [[dockStart - 1, C - 2], [dockStart - 1, C + 1], [stall.i + 3, stall.j + 2], [stall.i - 1, stall.j - 2]].forEach(function (tp) {
    var tt = at(tp[0], tp[1]);
    if ((tt === GRASS || tt === SAND) && !hasObs(tp[0], tp[1])) decor.push({ kind: 'torch', gx: tp[0] + 0.5, gy: tp[1] + 0.5 });
  });
  decor.push({ kind: 'barrel', gx: stall.i + 0.25, gy: stall.j + 1.55 });
  decor.push({ kind: 'crate', gx: stall.i + 2.55, gy: stall.j + 0.1 });
  for (q = 0; q < cand2.length; q++) {
    var pi0 = cand2[q][0], pj0 = cand2[q][1], pgx = pi0 + 0.5, pgy = pj0 + 0.5;
    if (T[pj0 * GRID + pi0] !== SAND || nearWater(pi0, pj0) || hasObs(pi0, pj0) || dist(pi0, pj0) < 8.2 || dist(pi0, pj0) > 10 || onLane(pgx, pgy) || !farFrom(decor, pgx, pgy, 3)) continue;
    if (!(isLand(at(pi0 + 1, pj0)) && isLand(at(pi0, pj0 + 1)) && isLand(at(pi0 - 1, pj0)) && isLand(at(pi0, pj0 - 1)))) continue;
    decor.push({ kind: 'towel', gx: pgx + 0.35, gy: pgy + 0.55 }); decor.push({ kind: 'parasol', gx: pgx - 0.2, gy: pgy - 0.25 });
    break;
  }
  if (at(dockStart + 2, C + 1) === WATER && at(dockStart + 3, C + 1) === WATER && at(dockStart + 2, C + 2) === WATER) decor.push({ kind: 'boat', gx: dockStart + 2.9, gy: C + 1.8 });
  var nc = 0;
  for (tries = 0; tries < 900 && nc < 10; tries++) {
    var ci2 = 1 + Math.floor(R2() * (GRID - 2)), cj2 = 1 + Math.floor(R2() * (GRID - 2));
    if (at(ci2, cj2) !== WATER || at(ci2 + 1, cj2) !== WATER || at(ci2, cj2 + 1) !== WATER || at(ci2 + 1, cj2 + 1) !== WATER) continue;
    var nl3 = false;
    for (var a3 = -2; a3 <= 1 && !nl3; a3++) for (var b3 = -2; b3 <= 1; b3++) if (isLand(at(ci2 + a3, cj2 + b3))) { nl3 = true; break; }
    var cgx = ci2 + 0.3 + R2() * 0.4, cgy = cj2 + 0.3 + R2() * 0.4, okc = nl3;
    for (var sp3 = 0; sp3 < spots.length; sp3++) if (Math.hypot(cgx - spots[sp3].gx, cgy - spots[sp3].gy) < 2.4) okc = false;
    if (okc && farFrom(decor, cgx, cgy, 1.8)) { decor.push({ kind: 'coral', gx: cgx, gy: cgy }); nc++; }
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

/* ---------- helper pixel art (cahaya dari kiri-atas, bayangan jatuh ke kanan-bawah) ---------- */
function PX(g, x, y, col, S) { g.fillStyle = col; g.fillRect(Math.round(x) * S, Math.round(y) * S, S, S); }
function segDist(x, y, ax, ay, bx, by) {
  var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
  return Math.hypot(x - (ax + dx * u), y - (ay + dy * u));
}
/* daun lebar (pisang, semak): cols = [terang, tengah, gelap, tulang daun] */
function leaf(g, x0, y0, ang, len, wmax, S, cols, droop) {
  var ca = Math.cos(ang), sa = Math.sin(ang), nx = -sa, ny = ca, sg = ny > 0 ? 1 : -1, t, u, w, cx, cy, d, col;
  droop = droop || 0;
  for (t = 0; t <= len; t += 0.5) {
    u = t / len; w = wmax * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.93 + 0.04)), 0.75);
    cx = x0 + ca * t; cy = y0 + sa * t + droop * u * u;
    for (d = -w; d <= w; d += 0.5) {
      col = d * sg < -w * 0.35 ? cols[0] : (d * sg > w * 0.4 ? cols[2] : cols[1]);
      PX(g, cx + nx * d, cy + ny * d, col, S);
    }
    if (cols[3]) PX(g, cx, cy, cols[3], S);
  }
}
/* daun menyirip (kelapa, pakis) */
function frond(g, x0, y0, ang, len, droop, S, cols, ll) {
  var ca = Math.cos(ang), sa = Math.sin(ang), t, u, cx, cy, tx, ty, tl, nx, ny, side, m, vx, vy, vl, ln, upper;
  ll = ll || 6;
  for (t = 0; t <= len; t += 1.7) {
    u = t / len;
    cx = x0 + ca * t; cy = y0 + sa * t + droop * u * u;
    tx = ca; ty = sa + 2 * droop * u / len; tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    nx = -ty; ny = tx;
    ln = ll * Math.sin(Math.PI * (0.1 + 0.8 * u)) * (1 - u * 0.25);
    for (side = -1; side <= 1; side += 2) {
      vx = side * nx * 0.8 + tx * 0.85; vy = side * ny * 0.8 + ty * 0.85; vl = Math.hypot(vx, vy); vx /= vl; vy /= vl;
      upper = vy < 0.2;
      for (m = 1; m <= ln; m += 0.5) {
        PX(g, cx + vx * m, cy + vy * m + 0.07 * m * m, upper ? (m > ln * 0.6 ? cols[0] : cols[1]) : (m > ln * 0.6 ? cols[1] : cols[2]), S);
      }
    }
    PX(g, cx, cy, cols[3], S);
  }
}

/* ---------- pohon kelapa (2 variasi) ---------- */
function palmTrunk(g, S, bx, by, cx, cy, bend, cl) {
  var i, t, d, w, x, y, col;
  for (i = 0; i <= 70; i++) {
    t = i / 70; x = bx + (cx - bx) * t + Math.sin(t * Math.PI) * bend; y = by + (cy - by) * t;
    w = 3.2 - t * 1.3 + (t < 0.07 ? 1.3 : 0);
    for (d = -w; d <= w; d += 0.5) {
      col = d < -w * 0.45 ? cl[0] : (d > w * 0.4 ? cl[2] : cl[1]);
      if (i % 6 === 0) col = d < -w * 0.45 ? cl[1] : (d > w * 0.4 ? '#3f2812' : cl[2]);
      PX(g, x + d, y, col, S);
    }
  }
}
function makePalm(variant) {
  var S = 2, LW = 96, LH = 90, cv = mkCanvas(LW * S, LH * S), c = cv[0], g = cv[1], k;
  var B = variant === 1;
  var bx = B ? 56 : 38, by = 84, cx = B ? 40 : 58, cy = B ? 38 : 30, bend = B ? 4 : -4.5;
  var back = B ? ['#7fcf4e', '#3f9a3a', '#1b6a33', '#a6d96a'] : ['#6fd04f', '#2f9a3f', '#17683a', '#9ee07a'];
  var front = B ? ['#d8f57a', '#86d84e', '#3da13a', '#e9ffa0'] : ['#a6ef6a', '#4fc24a', '#228a3c', '#d4ff9e'];
  palmTrunk(g, S, bx, by, cx, cy, bend, ['#cf9a60', '#98652f', '#5a381c']);
  var fb = B ? [[-2.85, 25, 9], [-2.1, 22, 4], [-1.05, 22, 4], [-0.3, 25, 9], [-1.57, 15, 2]] : [[-2.95, 29, 14], [-2.25, 24, 6], [-0.9, 24, 6], [-0.2, 29, 14], [-1.57, 16, 1]];
  var ff = B ? [[3.05, 27, 16], [2.45, 22, 15], [1.85, 14, 11], [1.3, 14, 11], [0.7, 22, 15], [0.1, 27, 16]] : [[3.1, 30, 18], [2.5, 25, 17], [1.85, 15, 12], [1.3, 15, 12], [0.65, 25, 17], [0.05, 30, 18]];
  fb.forEach(function (f) { frond(g, cx, cy, f[0], f[1], f[2], S, back, 8); });
  [[-3, 3], [1, 4], [4, 2]].forEach(function (p, n) {
    disc(g, cx + p[0], cy + p[1], 2, n === 1 ? '#7d4f28' : '#6b4423', S); PX(g, cx + p[0] - 1, cy + p[1] - 1, '#b98a52', S);
  });
  if (B) { for (k = 0; k < 6; k++) PX(g, cx - 5 + k % 3 * 2, cy + 6 + (k >> 1), k % 2 ? '#f08a2a' : '#d9641a', S); }
  ff.forEach(function (f) { frond(g, cx, cy, f[0], f[1], f[2], S, front, 9); });
  disc(g, cx, cy, 2, '#2f7a3a', S); PX(g, cx - 1, cy - 1, '#8ee07a', S);
  return { canvas: c, ox: bx / LW, oy: (by + 1) / LH };
}

/* ---------- semak tropis (hibiscus & pakis) ---------- */
function makeBush(variant) {
  var S = 2, LW = 46, LH = 32, cv = mkCanvas(LW * S, LH * S), c = cv[0], g = cv[1], k, a;
  ell(g, 23, 26, 12, 3, '#1b5a28', S);
  if (variant === 0) {
    var cols = ['#7be05a', '#3fae45', '#1f7a3a', '#c4f58a'];
    for (k = 0; k < 13; k++) { a = -Math.PI + 0.2 + k * (Math.PI - 0.4) / 12; leaf(g, 23, 26, a, 11 + (k % 4) * 2.5, 2.3, S, cols, 3); }
    [[13, 14], [31, 13], [22, 9], [26, 17]].forEach(function (p) {
      [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [1, 1]].forEach(function (o) { PX(g, p[0] + o[0], p[1] + o[1], '#ff5e86', S); });
      PX(g, p[0] - 1, p[1] - 1, '#ffa6c0', S); PX(g, p[0], p[1], '#ffd84a', S);
    });
  } else {
    var cf = ['#9be85d', '#52bd48', '#25813a', '#d6f7a0'];
    for (k = 0; k < 9; k++) { a = -Math.PI + 0.2 + k * (Math.PI - 0.4) / 8; frond(g, 23, 27, a, 15 + (k % 2) * 3, 5, S, cf, 5); }
    [[15, 15], [30, 14], [23, 10]].forEach(function (p) { PX(g, p[0], p[1], '#e5392b', S); PX(g, p[0] + 1, p[1], '#e5392b', S); PX(g, p[0], p[1] - 1, '#ff9a8a', S); });
  }
  return { canvas: c, ox: 0.5, oy: 28 / LH };
}

/* ---------- batu (4 variasi: abu, pasir, vulkanik, gugusan berlumut) ---------- */
function makeRock(v) {
  var S = 2, LW = 30, LH = 20, cv = mkCanvas(LW * S, LH * S), c = cv[0], g = cv[1];
  var P = [
    ['#4e5a67', '#74818f', '#a3b0bd', '#dbe4ec'],
    ['#9a8460', '#c0aa80', '#e0cfa4', '#f6ecd0'],
    ['#2f333d', '#4b505c', '#6d7482', '#9aa2b0'],
    ['#566270', '#7d8a98', '#a8b5c2', '#e0e8ef']
  ][v];
  function boulder(x, y, rx, ry) {
    ell(g, x + 1, y + 1, rx, ry, P[0], S); ell(g, x, y, rx, ry, P[1], S);
    ell(g, x - 1, y - 1, Math.max(1, rx - 3), Math.max(1, ry - 2), P[2], S);
    ell(g, x - 2, y - Math.floor(ry / 2), Math.max(1, Math.floor(rx / 3)), 1, P[3], S);
    ell(g, x + 1, y + ry - 1, rx - 1, 1, P[0], S);
  }
  if (v === 3) { boulder(11, 13, 7, 5); boulder(19, 14, 5, 4); boulder(15, 10, 4, 3); }
  else if (v === 1) { boulder(14, 13, 10, 5); boulder(9, 14, 5, 3); }
  else { boulder(14, 12, v === 2 ? 8 : 10, 7); }
  PX(g, 12, 9, P[0], S); PX(g, 13, 10, P[0], S); PX(g, 14, 11, P[0], S);
  PX(g, 18, 12, P[0], S); PX(g, 19, 13, P[0], S);
  if (v === 1 || v === 3) { ell(g, 14, 7, 4, 1, '#4f9a3f', S); ell(g, 13, 7, 2, 1, '#7acb5a', S); PX(g, 17, 8, '#4f9a3f', S); }
  if (v === 2) { [[9, 14], [20, 13], [14, 17]].forEach(function (p) { PX(g, p[0], p[1], '#e8eef2', S); }); }
  [[4, 17], [24, 17], [7, 18]].forEach(function (p) { ell(g, p[0], p[1], 1, 1, P[1], S); PX(g, p[0], p[1], P[2], S); });
  return { canvas: c, ox: 0.5, oy: 17 / LH };
}

/* ---------- kios ikan ---------- */
function makeStall() {
  var S = 2, LW = 62, LH = 54, cv = mkCanvas(LW * S, LH * S), c = cv[0], g = cv[1], x, y;
  function R(a, b, w, h, col) { g.fillStyle = col; g.fillRect(a * S, b * S, w * S, h * S); }
  // tiang
  R(5, 14, 4, 34, '#7a4e24'); R(5, 14, 1, 34, '#a8763c'); R(8, 14, 1, 34, '#573517');
  R(53, 14, 4, 34, '#7a4e24'); R(53, 14, 1, 34, '#a8763c'); R(56, 14, 1, 34, '#573517');
  // dinding belakang (papan)
  R(9, 17, 44, 17, '#c9a56f');
  for (x = 9; x < 53; x += 5) { R(x, 17, 1, 17, '#a98550'); R(x + 1, 17, 1, 17, '#dcb985'); }
  R(9, 17, 44, 2, '#8f6a3a');
  // jaring & ikan gantung
  for (x = 12; x < 28; x += 2) R(x, 19 + (x % 4 === 0 ? 1 : 0), 1, 6, '#e9dcb4');
  R(12, 19, 16, 1, '#e9dcb4'); R(12, 22, 16, 1, '#e9dcb4');
  R(38, 20, 5, 2, '#8ecae6'); R(43, 20, 2, 3, '#8ecae6'); R(38, 20, 5, 1, '#d6f0fb');
  R(46, 22, 4, 2, '#ffb703'); R(50, 22, 2, 3, '#ffb703');
  // meja
  R(3, 33, 56, 3, '#e1ab70'); R(3, 33, 56, 1, '#f6cf98'); R(3, 35, 56, 1, '#a8743a');
  R(4, 36, 54, 12, '#a9743c');
  for (x = 4; x < 58; x += 6) { R(x, 36, 1, 12, '#85572a'); R(x + 1, 36, 1, 12, '#be8a52'); }
  R(4, 46, 54, 2, '#6f4620');
  // baki es + ikan di atas meja
  R(8, 29, 22, 4, '#bfe2ee'); R(8, 29, 22, 1, '#eefaff'); R(8, 32, 22, 1, '#7fb4c8');
  [[10, 27, '#6fa8dc'], [16, 26, '#e76f51'], [22, 27, '#ffb703']].forEach(function (f) { R(f[0], f[1], 6, 3, f[2]); R(f[0] + 6, f[1], 2, 3, f[2]); R(f[0], f[1], 6, 1, '#ffffffaa'); PX(g, f[0] + 1, f[1] + 1, '#222', S); });
  // peti kayu berisi ikan
  R(37, 28, 17, 5, '#8b5a2b'); R(37, 28, 17, 1, '#b98550'); R(37, 31, 17, 1, '#6b4420');
  [[39, '#8ecae6'], [44, '#e63946'], [49, '#8ecae6']].forEach(function (f) { R(f[0], 26, 3, 3, f[1]); R(f[0] + 3, 25, 2, 5, f[1]); });
  // papan nama
  R(19, 38, 24, 8, '#4a2e14'); R(20, 39, 22, 6, '#6b4524'); R(20, 39, 22, 1, '#8a5d30');
  g.fillStyle = '#ffffff'; g.font = 'bold ' + (7 * S) + 'px monospace'; g.textAlign = 'center';
  g.fillText('IKAN', 31 * S, 44.4 * S);
  // atap kanopi bergaris merah-putih + lengkung bawah
  for (x = 0; x < 62; x++) {
    var red = (Math.floor(x / 4) % 2) === 1, hi = red ? '#f25a64' : '#ffffff', mid = red ? '#d62835' : '#f1f1f1', lo = red ? '#a51825' : '#cfd3d6';
    R(x, 6, 1, 1, hi); R(x, 7, 1, 7, mid); R(x, 12, 1, 2, lo);
    var sc = (x % 4 === 0 || x % 4 === 3) ? 1 : 3; R(x, 14, 1, sc, lo); R(x, 14, 1, 1, mid);
  }
  R(0, 4, 62, 2, '#8e1a24'); R(0, 4, 62, 1, '#c93442'); R(2, 3, 58, 1, '#8e1a24');
  return { canvas: c, ox: 0.5, oy: 48 / LH };
}

/* ---------- air: tiga tekstur ubin (riak, buih tipis, cahaya dasar laut) ---------- */
function makeWaves(kind) {
  var SZ = kind === 3 ? 256 : 128, SH = SZ / 2, cv = mkCanvas(SZ, SH), c = cv[0], g = cv[1], R = rng([0, 11, 29, 53][kind]), n, w, x, y;
  function wr(a, b, ww, hh, col) { for (var ox = -SZ; ox <= 0; ox += SZ) for (var oy = -SH; oy <= 0; oy += SH) px(g, a + ox, b + oy, ww, hh, col); }
  if (kind === 1) {
    px(g, 0, 0, SZ, SH, '#1fb4c9');
    for (n = 0; n < 12; n++) { w = 18 + Math.floor(R() * 20); x = Math.floor(R() * SZ); y = Math.floor(R() * SH); wr(x, y, w, 3, '#1ba6be'); }
    for (n = 0; n < 22; n++) {
      w = 8 + Math.floor(R() * 14); x = Math.floor(R() * SZ); y = Math.floor(R() * SH);
      wr(x, y, w, 1, '#58d9e8'); wr(x + 2, y + 1, w - 4, 1, '#17a0ba'); wr(x + 4, y + 2, Math.max(2, w - 8), 1, '#1593ad');
    }
    for (n = 0; n < 36; n++) wr(Math.floor(R() * SZ), Math.floor(R() * SH), 1, 1, '#8fe8f0');
  } else if (kind === 2) {
    for (n = 0; n < 12; n++) { w = 6 + Math.floor(R() * 12); x = Math.floor(R() * SZ); y = Math.floor(R() * SH); wr(x, y, w, 1, 'rgba(255,255,255,0.6)'); wr(x + 1, y + 1, w - 2, 1, 'rgba(255,255,255,0.22)'); }
  } else {
    for (n = 0; n < 40; n++) {
      x = Math.floor(R() * SZ); y = Math.floor(R() * SH);
      wr(x + 2, y, 4, 1, 'rgba(215,255,255,0.4)'); wr(x, y + 1, 8, 1, 'rgba(215,255,255,0.4)'); wr(x + 2, y + 2, 4, 1, 'rgba(215,255,255,0.4)');
      wr(x + 3, y + 1, 2, 1, 'rgba(255,255,255,0.7)');
    }
  }
  return c;
}
function makeSparkle() {
  var cv = mkCanvas(17, 17), c = cv[0], g = cv[1], k;
  for (k = 1; k <= 7; k++) { var a = 1 - k / 8; px(g, 8 + k, 8, 1, 1, 'rgba(255,255,255,' + (0.9 * a).toFixed(2) + ')'); px(g, 8 - k, 8, 1, 1, 'rgba(255,255,255,' + (0.9 * a).toFixed(2) + ')'); }
  for (k = 1; k <= 5; k++) { var b = 1 - k / 6; px(g, 8, 8 + k, 1, 1, 'rgba(255,255,255,' + (0.9 * b).toFixed(2) + ')'); px(g, 8, 8 - k, 1, 1, 'rgba(255,255,255,' + (0.9 * b).toFixed(2) + ')'); }
  px(g, 7, 7, 3, 3, '#ffffff');
  return c;
}
function makeGlow() {
  var cv = mkCanvas(64, 64), c = cv[0], g = cv[1];
  g.imageSmoothingEnabled = true;
  var gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,232,150,0.9)'); gr.addColorStop(0.4, 'rgba(255,200,90,0.35)'); gr.addColorStop(1, 'rgba(255,180,60,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return c;
}
function makeShadowTex() {
  var cv = mkCanvas(64, 24), c = cv[0], g = cv[1];
  ell(g, 32, 12, 31, 11, 'rgba(6,40,56,0.12)', 1); ell(g, 32, 12, 26, 9, 'rgba(6,40,56,0.14)', 1);
  ell(g, 32, 12, 20, 7, 'rgba(6,40,56,0.16)', 1); ell(g, 32, 12, 13, 5, 'rgba(6,40,56,0.18)', 1);
  return c;
}
function makeFlame() {
  var S = 2, cv = mkCanvas(10 * S, 16 * S), c = cv[0], g = cv[1];
  disc(g, 5, 11, 4, '#e8531f', S); ell(g, 5, 8, 3, 5, '#ff9a2a', S); ell(g, 5, 9, 2, 4, '#ffd84a', S); PX(g, 5, 2, '#ff9a2a', S); PX(g, 5, 4, '#ff9a2a', S);
  ell(g, 5, 11, 1, 2, '#fff6c2', S);
  return c;
}

/* ---------- tanaman air & pantai ---------- */
function makeReed() {
  var S = 2, LW = 24, LH = 34, cv = mkCanvas(LW * S, LH * S), c = cv[0], g = cv[1];
  var lc = ['#7fd35e', '#3f9a3f', '#1f6a33', null];
  [[-1.25, 18], [-1.55, 22], [-1.85, 19], [-1.05, 14], [-2.15, 14]].forEach(function (b) { leaf(g, 12, 30, b[0], b[1], 1.1, S, lc, b[0] > -1.55 ? -3 : 3); });
  [[8, 21, 1], [12, 25, 0], [16, 20, 1], [10, 17, 0]].forEach(function (s_) {
    var x = s_[0], h = s_[1];
    px(g, x * S, (30 - h) * S, S, h * S, '#3f8a3a'); px(g, (x + 1) * S, (30 - h) * S, S, h * S, '#6cc15a');
    px(g, x * S - S, (30 - h) * S, 3 * S, 7 * S, '#5a3318'); px(g, x * S, (30 - h) * S, S, 7 * S, '#8f5a2c'); px(g, x * S, (29 - h) * S, S, S, '#d9b27c');
  });
  return { canvas: c, ox: 0.5, oy: 31 / LH };
}
function makePad(flower) {
  var S = 2, LW = 18, LH = 10, cv = mkCanvas(LW * S, LH * S), c = cv[0], g = cv[1];
  ell(g, 9, 5, 7, 3, '#2c9444', S); ell(g, 9, 4, 6, 2, '#4cc05f', S); ell(g, 7, 4, 3, 1, '#8ee07a', S);
  g.clearRect(10 * S, 5 * S, 7 * S, S);
  if (flower) { px(g, 6 * S, 1 * S, 4 * S, 3 * S, '#ff86b0'); px(g, 7 * S, 0, 2 * S, S, '#ffb3cc'); px(g, 7 * S, 2 * S, 2 * S, S, '#fff3a0'); }
  return { canvas: c, ox: 0.5, oy: 0.55 };
}
function makeCoral() {
  var S = 2, LW = 28, LH = 20, cv = mkCanvas(LW * S, LH * S), c = cv[0], g = cv[1], k;
  ell(g, 14, 17, 11, 2, '#7a6a8a', S); ell(g, 13, 16, 8, 1, '#a090b0', S);
  [[8, 16, -1.2, 9, '#ff6fa4', '#ffb0cd'], [14, 16, -1.57, 12, '#ff8a4a', '#ffc08a'], [19, 16, -1.95, 9, '#d9487f', '#ff8fb8'], [11, 16, -1.45, 7, '#c05cd0', '#e5a0f0']].forEach(function (b) {
    var x = b[0], y = b[1], t, a;
    for (t = 0; t < b[3]; t++) {
      a = b[2] + Math.sin(t * 0.9) * 0.18;
      x += Math.cos(a) * 1; y += Math.sin(a) * 1;
      disc(g, Math.round(x), Math.round(y), t < b[3] - 3 ? 1 : 1, b[4], S); PX(g, x - 1, y - 1, b[5], S);
    }
    disc(g, Math.round(x), Math.round(y), 1, b[5], S);
  });
  return { canvas: c, ox: 0.5, oy: 17 / LH };
}
function makeBanana() {
  var S = 2, LW = 46, LH = 46, cv = mkCanvas(LW * S, LH * S), c = cv[0], g = cv[1];
  var lc = ['#a2ec66', '#55bb4a', '#2a8a3b', '#d8f89a'];
  px(g, 21 * S, 24 * S, 4 * S, 18 * S, '#6aa84a'); px(g, 21 * S, 24 * S, S, 18 * S, '#9bd76a'); px(g, 24 * S, 24 * S, S, 18 * S, '#3f7a35');
  [[-2.95, 18, 7], [-0.2, 18, 7], [-2.35, 17, 4], [-0.8, 17, 4], [-1.57, 14, 2], [3.0, 12, 12], [0.1, 12, 12]].forEach(function (l) { leaf(g, 23, 26, l[0], l[1], 4.3, S, lc, l[2]); });
  [[24, 30], [26, 31], [28, 30], [25, 33]].forEach(function (b, n) { px(g, b[0] * S, b[1] * S, 2 * S, 3 * S, n % 2 ? '#e9cf37' : '#bcd13a'); px(g, b[0] * S, b[1] * S, S, 3 * S, '#fff08a'); });
  disc(g, 25, 36, 2, '#7b2d6e', S); PX(g, 24, 35, '#b0549a', S);
  return { canvas: c, ox: 0.5, oy: 42 / LH };
}
function makeTorch() {
  var S = 2, LW = 14, LH = 42, cv = mkCanvas(LW * S, LH * S), c = cv[0], g = cv[1], y;
  px(g, 3 * S, 39 * S, 8 * S, 2 * S, '#6b4526'); px(g, 3 * S, 39 * S, 8 * S, S, '#9a6b3c');
  for (y = 12; y < 40; y++) { px(g, 5 * S, y * S, 4 * S, S, (y % 7 === 0) ? '#6a4a1c' : '#b8913f'); px(g, 5 * S, y * S, S, S, (y % 7 === 0) ? '#8a6a30' : '#e0c070'); px(g, 8 * S, y * S, S, S, '#7d5f27'); }
  px(g, 3 * S, 7 * S, 8 * S, 5 * S, '#8f6a2c'); px(g, 3 * S, 7 * S, 8 * S, S, '#cda255'); px(g, 4 * S, 8 * S, 6 * S, 2 * S, '#2d1c0c'); px(g, 3 * S, 11 * S, 8 * S, S, '#5e4418');
  return { canvas: c, ox: 0.5, oy: 40 / LH };
}
function makeParasol() {
  var S = 2, LW = 46, LH = 54, cv = mkCanvas(LW * S, LH * S), c = cv[0], g = cv[1], x, y;
  px(g, 22 * S, 12 * S, 2 * S, 38 * S, '#efe6d2'); px(g, 22 * S, 12 * S, S, 38 * S, '#ffffff'); px(g, 23 * S, 12 * S, S, 38 * S, '#bfb398');
  ell(g, 23, 51, 3, 1, '#a89f86', S);
  for (y = 3; y <= 15; y++) {
    var hw = Math.round(21 * Math.sqrt(Math.max(0, 1 - Math.pow((y - 15) / 12.5, 2))));
    for (x = -hw; x <= hw; x++) {
      var stripe = Math.floor((x + 30) / 6) % 2, col = stripe ? '#ffffff' : '#1fb5c9';
      if (x > hw * 0.35) col = stripe ? '#d9e4e8' : '#168da0'; else if (x < -hw * 0.45 && y < 9) col = stripe ? '#ffffff' : '#52d5e6';
      PX(g, 23 + x, y, col, S);
    }
  }
  for (x = -20; x <= 20; x += 5) { px(g, (23 + x) * S, 15 * S, 4 * S, 2 * S, (Math.floor((x + 30) / 6) % 2) ? '#d9e4e8' : '#168da0'); }
  px(g, 22 * S, 1 * S, 2 * S, 2 * S, '#efe6d2');
  return { canvas: c, ox: 0.5, oy: 51 / LH };
}
function makeTowel() {
  var S = 2, LW = 40, LH = 20, cv = mkCanvas(LW * S, LH * S), c = cv[0], g = cv[1], r, x;
  for (r = 0; r < 14; r++) for (x = 0; x < 24; x++) {
    var X = 4 + x + Math.floor(r * 1.2), Y = 2 + r;
    PX(g, X, Y, (Math.floor(x / 3) % 2) ? '#ff5e7a' : '#fff4f4', S);
  }
  for (r = 0; r < 14; r++) { PX(g, 4 + Math.floor(r * 1.2), 2 + r, '#a8263f', S); PX(g, 28 + Math.floor(r * 1.2), 2 + r, '#a8263f', S); }
  for (x = 0; x < 24; x++) { PX(g, 4 + x, 2, '#a8263f', S); PX(g, 4 + x + 17, 15, '#a8263f', S); }
  return { canvas: c, ox: 0.5, oy: 0.55 };
}
function makeBarrel() {
  var S = 2, LW = 16, LH = 22, cv = mkCanvas(LW * S, LH * S), c = cv[0], g = cv[1], y;
  ell(g, 8, 18, 6, 2, '#5b3a1a', S);
  for (y = 6; y <= 18; y++) { var hw = 6 - Math.round(Math.pow((y - 12) / 6.5, 2) * 1.2); px(g, (8 - hw) * S, y * S, hw * 2 * S, S, '#a9743c'); px(g, (8 - hw) * S, y * S, 2 * S, S, '#d4a064'); px(g, (8 + hw - 2) * S, y * S, 2 * S, S, '#7a4e24'); }
  ell(g, 8, 6, 6, 2, '#c18a50', S); ell(g, 8, 6, 4, 1, '#5b3a1a', S);
  px(g, 2 * S, 9 * S, 12 * S, S, '#3a3f48'); px(g, 2 * S, 15 * S, 12 * S, S, '#3a3f48');
  return { canvas: c, ox: 0.5, oy: 19 / LH };
}
function makeCrate() {
  var S = 2, LW = 22, LH = 22, cv = mkCanvas(LW * S, LH * S), c = cv[0], g = cv[1], k;
  for (k = 0; k < 8; k++) { var hw = 9 - k; px(g, (11 - hw - 1) * S, (4 + k) * S, (hw * 2 + 2) * S, S, k < 2 ? '#e1ab70' : '#d09660'); }
  px(g, 2 * S, 11 * S, 9 * S, 9 * S, '#a9743c'); px(g, 11 * S, 11 * S, 9 * S, 9 * S, '#85572a');
  for (k = 0; k < 3; k++) { px(g, 2 * S, (12 + k * 3) * S, 9 * S, S, '#7a4e24'); px(g, 11 * S, (12 + k * 3) * S, 9 * S, S, '#5e3a1a'); }
  px(g, 2 * S, 11 * S, 18 * S, S, '#e8b57a'); px(g, 9 * S, 1 * S, 4 * S, 3 * S, '#8ecae6'); px(g, 13 * S, 0, 2 * S, 5 * S, '#8ecae6');
  return { canvas: c, ox: 0.5, oy: 20 / LH };
}
function makeBoat() {
  var S = 2, LW = 56, LH = 28, cv = mkCanvas(LW * S, LH * S), c = cv[0], g = cv[1], x, y;
  ell(g, 28, 22, 26, 3, 'rgba(8,60,90,0.35)', S);
  for (y = 10; y <= 21; y++) {
    var hw = Math.round(25 * Math.sqrt(Math.max(0, 1 - Math.pow((y - 10) / 12, 2))));
    for (x = -hw; x <= hw; x++) {
      var col = y < 13 ? '#e9f1f3' : y < 15 ? '#1f8fb8' : '#b97a40';
      if (x > hw * 0.45) col = y < 13 ? '#c4d2d8' : y < 15 ? '#17708f' : '#8a5a2e'; else if (x < -hw * 0.5 && y > 14) col = '#d9a064';
      if (y > 14 && (y + Math.floor((x + 40) / 7)) % 4 === 0) col = '#8a5a2e';
      PX(g, 28 + x, y, col, S);
    }
  }
  ell(g, 28, 9, 24, 3, '#e1ab70', S); ell(g, 28, 9, 21, 2, '#4a2e14', S); ell(g, 28, 9, 19, 1, '#6b4524', S);
  px(g, 14 * S, 7 * S, 28 * S, S, '#b98550');
  px(g, 20 * S, 7 * S, 3 * S, 3 * S, '#e1ab70'); px(g, 34 * S, 7 * S, 3 * S, 3 * S, '#e1ab70');
  px(g, 51 * S, 6 * S, 3 * S, 4 * S, '#e9f1f3'); px(g, 3 * S, 6 * S, 3 * S, 4 * S, '#e9f1f3');
  return { canvas: c, ox: 0.5, oy: 18 / LH };
}
function makeFishShadow() {
  var S = 2, cv = mkCanvas(44, 20), c = cv[0], g = cv[1];
  ell(g, 9, 5, 8, 3, 'rgba(5,45,80,0.5)', S); px(g, 17 * S, 3 * S, 2 * S, 4 * S, 'rgba(5,45,80,0.5)'); px(g, 19 * S, 2 * S, 2 * S, 6 * S, 'rgba(5,45,80,0.5)');
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

/* ---------- peta dasar: laut, pantai, rumput, jalan batu, dermaga ---------- */
function makeGround(map) {
  var T = map.T, plx = map.stall.i + 1, ply = map.stall.j + 0.5;
  var cv = mkCanvas(W, H), c = cv[0], g = cv[1];
  var i, j, k, n;
  function at(a, b) { return (a < 0 || b < 0 || a >= GRID || b >= GRID) ? WATER : T[b * GRID + a]; }
  function isLand(t) { return t !== WATER; }
  function sx(a, b) { return (a - b) * 32 + W / 2; }
  function sy(a, b) { return (a + b) * 16; }
  function onPath(a, b) {
    var x = a + 0.5, y = b + 0.5;
    return Math.hypot(x - plx, y - ply) < 2.15 || segDist(x, y, plx, ply, C + 0.5, C + 0.5) < 0.8 || segDist(x, y, C + 0.5, C + 0.5, map.dockStart - 0.5, C + 0.5) < 0.8;
  }
  function dashFill(cx, cy, col, alpha, par) {
    g.globalAlpha = alpha; g.fillStyle = col;
    for (var y = 0; y < 32; y++) { var hw = rowHW(y); for (var x = -hw + ((y + par) & 1) * 2; x < hw; x += 4) g.fillRect(cx + x, cy + y, 2, 1); }
    g.globalAlpha = 1;
  }

  // laut dalam: gradasi gelap di tepi dunia
  var grad = g.createRadialGradient(W / 2, H / 2, 260, W / 2, H / 2, Math.hypot(W, H) / 2);
  grad.addColorStop(0, 'rgba(0,70,130,0)'); grad.addColorStop(1, 'rgba(0,45,105,0.5)');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);

  // gradasi air dangkal: 3 tingkat turquoise + dither di batas tingkat
  function level(d) { return d <= 1.45 ? 3 : d <= 2.6 ? 2 : d <= 3.9 ? 1 : 0; }
  var LV = [null, ['#2ec6dd', 0.42], ['#52dde7', 0.5], ['#9cf0e9', 0.55]];
  var dm = new Float32Array(GRID * GRID);
  for (j = 0; j < GRID; j++) for (i = 0; i < GRID; i++) {
    if (T[j * GRID + i] !== WATER) continue;
    var best = 9;
    for (var dj = -5; dj <= 5; dj++) for (var di = -5; di <= 5; di++) if (isLand(at(i + di, j + dj))) best = Math.min(best, Math.hypot(di, dj));
    dm[j * GRID + i] = best;
  }
  for (j = 0; j < GRID; j++) for (i = 0; i < GRID; i++) {
    if (T[j * GRID + i] !== WATER) continue;
    var d0 = dm[j * GRID + i], L = level(d0), cx0 = sx(i, j), cy0 = sy(i, j), par = (i + j) & 1;
    if (L > 0) { g.globalAlpha = LV[L][1]; drawDiamond(g, cx0, cy0, LV[L][0]); g.globalAlpha = 1; }
    var Lo = level(d0 + 0.55), Li = level(d0 - 0.55);
    if (Lo !== L) { if (Lo > 0) dashFill(cx0, cy0, LV[Lo][0], LV[Lo][1], par); else dashFill(cx0, cy0, '#1fb3c8', 0.8, par); }
    if (Li !== L && Li > 0) dashFill(cx0, cy0, LV[Li][0], LV[Li][1], par + 1);
    if (d0 <= 1.05) { g.globalAlpha = 0.22; drawDiamond(g, cx0, cy0, '#eafff4'); g.globalAlpha = 1; }
  }

  // bayangan daratan & dermaga di atas air (jatuh ke kanan-bawah)
  for (j = 0; j < GRID; j++) for (i = 0; i < GRID; i++) {
    var tt0 = T[j * GRID + i];
    if (tt0 === WATER) continue;
    if (tt0 === DOCK) { g.globalAlpha = 0.3; drawDiamond(g, sx(i, j) + 10, sy(i, j) + 9, '#06456a'); }
    else if (at(i + 1, j) === WATER || at(i, j + 1) === WATER) { g.globalAlpha = 0.2; drawDiamond(g, sx(i, j) + 9, sy(i, j) + 8, '#08577f'); }
  }
  g.globalAlpha = 1;

  function scatter(cx, top, which, cnt, cols, a, b, seed, w) {
    var V = [[cx + 32, top + 16], [cx, top + 32], [cx - 32, top + 16], [cx, top]], A = V[which], B = V[(which + 1) % 4];
    for (var q = 0; q < cnt; q++) {
      var u = hash(a, b, seed + q), f = 0.04 + hash(a, b, seed + 50 + q) * 0.26;
      var x = A[0] + (B[0] - A[0]) * u, y = A[1] + (B[1] - A[1]) * u;
      x += (cx - x) * f; y += (top + 16 - y) * f;
      px(g, Math.round(x), Math.round(y), w || 2, 1, cols[Math.floor(hash(a, b, seed + 100 + q) * cols.length)]);
    }
  }
  function dockTop(cx, top, a, b) {
    var plank = ['#c4955a', '#b88a52', '#cf9f62', '#ad7f4a'];
    for (var r = 0; r < 32; r++) {
      var hw = rowHW(r);
      for (var x = -hw; x < hw; x++) {
        var u = ((r / 16) + ((x + 0.5) / 32)) / 2; if (u < 0) u = 0; if (u > 0.999) u = 0.999;
        var pu = Math.floor(u * 16), pl = pu >> 2, sub = pu & 3, col;
        if (sub === 0) col = '#6b4824'; else if (sub === 1) col = '#e0b276'; else col = plank[Math.floor(hash(a, b, pl + 31) * 4)];
        if (sub > 1 && hash(a * 64 + x, b * 64 + r, 5) < 0.035) col = '#8f6234';
        g.fillStyle = col; g.fillRect(cx + x, top + r, 1, 1);
      }
    }
  }

  // tile daratan, dari belakang ke depan
  var grassCols = ['#5fc04a', '#58b946', '#67c94f', '#54b244'];
  var sandCols = ['#f6e7b8', '#ecd9a3', '#fff3cc', '#e6d19a'];
  var flowerCols = ['#ff7aa8', '#ffe36a', '#ffffff', '#9ad0ff', '#ff9a4a'];
  for (var s = 0; s <= 2 * GRID - 2; s++) {
    for (i = Math.max(0, s - GRID + 1); i <= Math.min(s, GRID - 1); i++) {
      j = s - i;
      var t = T[j * GRID + i];
      if (t === WATER) continue;
      var h = t === DOCK ? ELEV_DOCK : ELEV_LAND;
      var cx = sx(i, j), cy = sy(i, j), top = cy - h;
      var nbr = [at(i + 1, j), at(i, j + 1), at(i - 1, j), at(i, j - 1)];
      var nR = nbr[0], nL = nbr[1];
      var sideR = t === GRASS ? '#8c6a3c' : t === SAND ? '#dcc78f' : '#6b4a26';
      var sideL = t === GRASS ? '#6f5230' : t === SAND ? '#c4ad74' : '#4f3719';

      if (!isLand(nR)) {
        for (k = 0; k < 32; k++) {
          var yy = top + 31 - (k >> 1);
          px(g, cx + k, yy, 1, h + 1, sideR);
          px(g, cx + k, yy, 1, 1, t === GRASS ? '#3f9a35' : t === SAND ? '#fff2c9' : '#d9a96a');
          if (t !== DOCK && k % 5 === 1) px(g, cx + k, yy + 3, 1, 1, t === GRASS ? '#6e5230' : '#c9b27a');
          if (t === DOCK && k % 8 === 0) px(g, cx + k, yy, 1, h + 1, '#4f3719');
          if (k % 7 === 2) px(g, cx + k, yy + h, 3, 1, 'rgba(255,255,255,0.85)');
        }
      }
      if (!isLand(nL)) {
        for (k = 0; k < 32; k++) {
          var yl = top + 31 - (k >> 1);
          px(g, cx - 1 - k, yl, 1, h + 1, sideL);
          px(g, cx - 1 - k, yl, 1, 1, t === GRASS ? '#2f7f2c' : t === SAND ? '#f3e2b0' : '#a87a46');
          if (t !== DOCK && k % 5 === 3) px(g, cx - 1 - k, yl + 3, 1, 1, t === GRASS ? '#523a22' : '#ad9660');
          if (t === DOCK && k % 8 === 0) px(g, cx - 1 - k, yl, 1, h + 1, '#35250f');
          if (k % 7 === 4) px(g, cx - 3 - k, yl + h, 3, 1, 'rgba(255,255,255,0.7)');
        }
      }

      // permukaan atas
      var base, cols, wet = false;
      if (t === GRASS) { base = grassCols[0]; cols = grassCols; }
      else if (t === SAND) {
        wet = nbr[0] === WATER || nbr[1] === WATER || nbr[2] === WATER || nbr[3] === WATER;
        base = wet ? '#e6d3a0' : sandCols[0]; cols = wet ? ['#e6d3a0', '#dcc58c', '#efdeb0'] : sandCols;
      } else { base = '#b88a52'; cols = ['#b88a52', '#a87a46']; }
      if (t !== DOCK) {
        var pv = hash(i >> 1, j >> 1, 5) * 0.35 + hash(i, j, 6) * 0.65;
        if (t === GRASS) base = grassCols[Math.min(3, Math.floor(pv * 4))];
        else if (!wet) base = sandCols[Math.min(3, Math.floor(pv * 4))];
      }
      var cob = (t === GRASS && onPath(i, j));
      if (t === DOCK) dockTop(cx, top, i, j);
      else drawDiamond(g, cx, top, cob ? '#b3ae9d' : base);
      if (cob) {                                          // jalan batu pipih (flagstone) hangat
        drawDiamond(g, cx, top, '#a89878');
        for (var rr3 = 1; rr3 < 30; rr3 += 5) {
          var hwr = Math.min(rowHW(rr3), rowHW(rr3 + 3)) - 2, off = ((rr3 / 5 | 0) & 1) * 5 + Math.floor(hash(i, j, rr3) * 3);
          for (var xx3 = -hwr + off; xx3 + 8 <= hwr; xx3 += 10) {
            var sc = hash(i + xx3, j, rr3);
            px(g, cx + xx3, top + rr3, 8, 4, sc < 0.33 ? '#dccba4' : sc < 0.66 ? '#d2c19a' : '#e3d4af');
            px(g, cx + xx3 + 1, top + rr3, 6, 1, '#f3e8c8'); px(g, cx + xx3, top + rr3 + 3, 8, 1, '#b4a37e'); px(g, cx + xx3 + 7, top + rr3 + 1, 1, 2, '#b4a37e');
          }
        }
      } else if (t !== DOCK) {
        var ccol;
        for (n = 0; n < 11; n++) {
          var rr = 2 + Math.floor(hash(i, j, n) * 27), hw = rowHW(rr);
          var xx = cx - hw + 2 + Math.floor(hash(i, j, n + 20) * (hw * 2 - 6));
          px(g, xx, top + rr, 2, 1, cols[1 + Math.floor(hash(i, j, n + 40) * (cols.length - 1))]);
        }
        if (t === GRASS) {
          for (var tf = 0; tf < 5; tf++) if (hash(i, j, 200 + tf) < 0.72) {
            var tr = 6 + Math.floor(hash(i, j, 210 + tf) * 17), th2 = rowHW(tr), tx2 = cx + Math.floor((hash(i, j, 220 + tf) - 0.5) * (th2 - 4));
            var dark = hash(i, j, 230 + tf) < 0.5;
            px(g, tx2, top + tr - 3, 1, 4, dark ? '#2f8a34' : '#9aea72'); px(g, tx2 + 2, top + tr - 2, 1, 3, dark ? '#3b9a3c' : '#b4f48a'); px(g, tx2 - 2, top + tr - 2, 1, 3, dark ? '#3b9a3c' : '#80d85e');
            px(g, tx2, top + tr + 1, 3, 1, 'rgba(20,80,40,0.35)');
          }
          if (hash(i, j, 240) < 0.35) { var dr = 8 + Math.floor(hash(i, j, 241) * 14); px(g, cx - 6 + Math.floor(hash(i, j, 242) * 10), top + dr, 6, 1, 'rgba(20,90,40,0.28)'); px(g, cx - 4 + Math.floor(hash(i, j, 242) * 10), top + dr + 1, 3, 1, 'rgba(20,90,40,0.2)'); }
          if (hash(i, j, 243) < 0.32) { var lr = 6 + Math.floor(hash(i, j, 244) * 14); px(g, cx - 8 + Math.floor(hash(i, j, 245) * 14), top + lr, 5, 1, 'rgba(230,255,170,0.28)'); }
          if (hash(i, j, 260) < 0.12) { var cr = 10 + Math.floor(hash(i, j, 261) * 10), cxx = cx + Math.floor((hash(i, j, 262) - 0.5) * 18); px(g, cxx, top + cr, 2, 1, '#2f9a4a'); px(g, cxx + 1, top + cr - 1, 2, 1, '#3cb25a'); px(g, cxx - 1, top + cr - 1, 2, 1, '#3cb25a'); }
          if (hash(i, j, 90) < 0.16) {
            var fr = 9 + Math.floor(hash(i, j, 91) * 12), fxx = cx + Math.floor((hash(i, j, 92) - 0.5) * 22), fc = flowerCols[Math.floor(hash(i, j, 93) * 5)];
            px(g, fxx, top + fr, 2, 2, fc); px(g, fxx, top + fr, 1, 1, '#ffffff'); px(g, fxx + 1, top + fr + 2, 1, 1, '#2f8a34');
            if (hash(i, j, 94) < 0.5) { px(g, fxx + 4, top + fr + 1, 2, 2, fc); px(g, fxx + 5, top + fr + 3, 1, 1, '#2f8a34'); }
          }
          if (hash(i, j, 96) < 0.05) { var sr = 10 + Math.floor(hash(i, j, 97) * 10), sxx = cx + Math.floor((hash(i, j, 98) - 0.5) * 18); px(g, sxx, top + sr, 4, 3, '#8c96a0'); px(g, sxx, top + sr, 3, 1, '#c3ccd5'); px(g, sxx + 1, top + sr + 3, 4, 1, 'rgba(20,60,40,0.3)'); }
          if (hash(i, j, 99) < 0.03) { var kr = 10 + Math.floor(hash(i, j, 100) * 9), kxx = cx + Math.floor((hash(i, j, 101) - 0.5) * 16); px(g, kxx, top + kr, 4, 3, '#6b4423'); px(g, kxx + 1, top + kr, 2, 1, '#b98a52'); }
        }
        if (t === SAND) {
          if (hash(i, j, 250) < 0.55) { var rr2 = 8 + Math.floor(hash(i, j, 251) * 14), rx2 = cx - 9 + Math.floor(hash(i, j, 252) * 12); px(g, rx2, top + rr2, 7, 1, 'rgba(190,160,100,0.5)'); px(g, rx2 + 2, top + rr2 + 1, 4, 1, 'rgba(255,252,230,0.6)'); }
          if (hash(i, j, 253) < 0.16) { var pr = 9 + Math.floor(hash(i, j, 254) * 12), pxx = cx - 8 + Math.floor(hash(i, j, 255) * 14); px(g, pxx, top + pr, 3, 2, '#a89c82'); px(g, pxx, top + pr, 2, 1, '#d6ccb0'); px(g, pxx + 1, top + pr + 2, 3, 1, 'rgba(120,100,60,0.35)'); }
          if (hash(i, j, 270) < 0.1) { var shr = 10 + Math.floor(hash(i, j, 271) * 10), shx = cx - 6 + Math.floor(hash(i, j, 272) * 12); px(g, shx, top + shr, 3, 2, '#ffffff'); px(g, shx, top + shr, 1, 1, '#f7c1c9'); px(g, shx + 1, top + shr + 2, 3, 1, 'rgba(140,110,70,0.3)'); }
          if (hash(i, j, 273) < 0.035) { var str = 10 + Math.floor(hash(i, j, 274) * 9), stx = cx - 5 + Math.floor(hash(i, j, 275) * 10); px(g, stx + 2, top + str - 2, 1, 2, '#ff7a4a'); px(g, stx, top + str, 5, 1, '#ff7a4a'); px(g, stx + 1, top + str + 1, 3, 1, '#ff9a6a'); px(g, stx + 2, top + str, 1, 1, '#ffd0a0'); }
          if (hash(i, j, 276) < 0.03) { var dw = 10 + Math.floor(hash(i, j, 277) * 8), dx = cx - 8 + Math.floor(hash(i, j, 278) * 8); px(g, dx, top + dw, 9, 2, '#8a6a42'); px(g, dx, top + dw, 9, 1, '#b99468'); px(g, dx + 2, top + dw - 1, 2, 1, '#8a6a42'); px(g, dx + 1, top + dw + 2, 9, 1, 'rgba(120,90,50,0.35)'); }
          if (wet && hash(i, j, 280) < 0.22) { var wr = 8 + Math.floor(hash(i, j, 281) * 12), wxx = cx - 6 + Math.floor(hash(i, j, 282) * 12); px(g, wxx, top + wr, 5, 1, '#3f7a3a'); px(g, wxx + 1, top + wr - 1, 3, 1, '#5aa04a'); }
        }
        // peralihan rumput <-> pasir (dither di tepi) dan tepi basah di pantai
        for (var wch = 0; wch < 4; wch++) {
          var nt = nbr[wch];
          if (t === GRASS && nt === SAND) scatter(cx, top, wch, 12, ['#f1e2b0', '#e6d19a', '#fff3cc'], i, j, 300 + wch * 10, 2);
          else if (t === SAND && nt === GRASS) scatter(cx, top, wch, 10, ['#5fc04a', '#47a03a', '#6fd055'], i, j, 340 + wch * 10, 1);
          else if (t === SAND && nt === WATER && wch >= 2) { scatter(cx, top, wch, 12, ['#d6c28e', '#cdb780'], i, j, 380 + wch * 10, 2); scatter(cx, top, wch, 5, ['#fffbe8', '#ffffff'], i, j, 420 + wch * 10, 1); }
        }
      }

      // tiang dermaga
      if (t === DOCK) {
        var postAt = function (vx, vy) {
          px(g, vx - 2, vy - h - 6, 4, h + 13, '#5a3b1c'); px(g, vx - 2, vy - h - 6, 1, h + 13, '#8a5d30');
          px(g, vx - 3, vy - h - 7, 6, 2, '#a8763c'); px(g, vx - 3, vy - h - 7, 6, 1, '#d9a96a');
          px(g, vx - 2, vy - h - 3, 4, 1, '#e0c88e'); px(g, vx - 2, vy - h - 2, 4, 1, '#b89a60');
        };
        if (!(at(i, j + 1) === DOCK) && i % 2 === 0) postAt(cx - 31, cy + 16);
        if (!(at(i + 1, j) === DOCK) && j % 2 === 1) postAt(cx + 31, cy + 16);
        if (at(i, j + 1) !== DOCK && at(i + 1, j) !== DOCK) postAt(cx, cy + 32);
      }
    }
  }

  // penanda area spawn (cincin batu)
  var spCx = sx(C, C), spCy = sy(C, C) + 16 - ELEV_LAND;
  for (var a = 0; a < Math.PI * 2; a += 0.09) {
    var ex = Math.round(spCx + Math.cos(a) * 20), ey = Math.round(spCy + Math.sin(a) * 10);
    px(g, ex - 1, ey, 3, 2, (Math.floor(a / 0.09) % 3 === 0) ? '#d9c68e' : '#bfae79');
  }
  return c;
}

/* ----- karakter pixel art ----- */
var PAL_PLAYER = { shirtD: '#bdc6d2', skin: '#f2c28b', hair: '#17171b', hairHi: '#3d3e48', shirt: '#f6f7f9', shirt2: '#d5dbe3', pants: '#2a2c33', pantsD: '#18191e', shoe: '#0c0c0e', belt: '#0c0c0e', hat: 'none' };
var PAL_NPC = { shirtD: '#12877c', skin: '#c98a5a', hair: '#2e2e2e', shirt: '#1fb5a5', shirt2: '#e8fffb', pants: '#7a5230', pantsD: '#5f3f22', shoe: '#2a1d12', hat: 'cap', apron: true };

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
    if (p.shirtD) { R(10, 9 + by, 1, 6, p.shirtD); R(5, 14 + by, 6, 1, p.shirtD); }
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
    if (p.shirtD) { R(11, 9 + by, 1, 6, p.shirtD); R(4, 14 + by, 8, 1, p.shirtD); R(4, 9 + by, 8, 1, p.shirt2); }
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
  var s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
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
      this.textures.addCanvas('caustic', makeWaves(3));
      this.textures.addCanvas('glow', makeGlow());
      this.textures.addCanvas('shadow', makeShadowTex());
      this.textures.addCanvas('flame', makeFlame());
      this.textures.addCanvas('cloud', makeCloud());
      this.textures.addCanvas('foam', makeFoam(M));
      this.textures.addCanvas('bobber', makeBobber());
      this.textures.addCanvas('ground', makeGround(M));
      this.origins = {};
      var ps = this.textures.addCanvas('player', makePlayerSheet());
      for (var d = 0; d < 8; d++) for (var c = 0; c < 6; c++) ps.add(d + '_' + c, 0, c * 32, d * 48, 32, 48);
      var ns = this.textures.addCanvas('npc', makeNpcSheet());
      ns.add('i0', 0, 0, 0, 32, 48); ns.add('i1', 0, 32, 0, 32, 48);
      var OL = '#0f2a2e', OLG = '#0c3320', OLB = '#2a1408', OLW = '#175a30';
      var defs = {
        palm0: outlined(makePalm(0), OLG), palm1: outlined(makePalm(1), OLG), bush0: outlined(makeBush(0), OLG), bush1: outlined(makeBush(1), OLG),
        rock0: outlined(makeRock(0), OL), rock1: outlined(makeRock(1), OL), rock2: outlined(makeRock(2), OL), rock3: outlined(makeRock(3), OL),
        stall: outlined(makeStall(), OLB), reed: outlined(makeReed(), OLG), pad0: outlined(makePad(0), OLW), pad1: outlined(makePad(1), OLW),
        banana: outlined(makeBanana(), OLG), torch: outlined(makeTorch(), OLB), parasol: outlined(makeParasol(), '#0f3a4a'), towel: outlined(makeTowel(), '#5a1626'),
        barrel: outlined(makeBarrel(), OLB), crate: outlined(makeCrate(), OLB), boat: outlined(makeBoat(), '#1a2a33'), coral: outlined(makeCoral(), '#4a1a3a')
      };
      Object.keys(defs).forEach(function (k) { self.textures.addCanvas(k, defs[k].canvas); self.origins[k] = [defs[k].ox, defs[k].oy]; });
      this.textures.addCanvas('fishsh', makeFishShadow());
      FISH.forEach(function (f) { self.textures.addCanvas('fish_' + f.id, makeFishCanvas(f)); });

      // laut (dua lapis gelombang bergerak) + daratan
      this.waves1 = this.add.tileSprite(0, 0, W, H, 'waves1').setOrigin(0, 0).setDepth(-100);
      this.waves2 = this.add.tileSprite(0, 0, W, H, 'waves2').setOrigin(0, 0).setDepth(-99).setAlpha(0.6);
      this.waves3 = this.add.tileSprite(0, 0, W, H, 'caustic').setOrigin(0, 0).setDepth(-98).setAlpha(0.55).setBlendMode(Phaser.BlendModes.ADD);
      this.add.image(0, 0, 'ground').setOrigin(0, 0).setDepth(-50);

      // buih ombak di tepi pantai (dua lapis, bergantian maju-mundur)
      var foamA = this.add.image(0, 0, 'foam').setOrigin(0, 0).setDepth(-49);
      var foamB = this.add.image(0, 3, 'foam').setOrigin(0, 0).setDepth(-49).setAlpha(0.35);
      this.tweens.add({ targets: foamA, alpha: { from: 0.95, to: 0.3 }, y: { from: 0, to: 2 }, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: foamB, alpha: { from: 0.2, to: 0.75 }, y: { from: 4, to: 1 }, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

      // kilau air
      var R = rng(5), placed = 0, tries = 0;
      while (placed < 60 && tries < 900) {
        tries++;
        var si = Math.floor(R() * GRID), sj = Math.floor(R() * GRID);
        if (this.T[sj * GRID + si] !== WATER) continue;
        var spx = (si - sj) * 32 + W / 2 + (R() - 0.5) * 30, spy = (si + sj) * 16 + 16 + (R() - 0.5) * 12;
        var sp = this.add.image(spx, spy, 'sparkle').setDepth(-45).setAlpha(0);
        this.tweens.add({ targets: sp, alpha: 0.9, scale: { from: 0.6, to: 1.2 }, duration: 600 + R() * 900, yoyo: true, repeat: -1, delay: R() * 2500 });
        placed++;
      }

      // rintangan: pohon, semak, batu (posisi & tabrakan tetap, hanya tampilan yang berubah)
      M.obstacles.forEach(function (o) {
        var key = o.kind === 'rock' ? 'rock' + (o.v + (hash(o.i, o.j, 3) < 0.5 ? 2 : 0)) : o.kind + (o.kind === 'stall' ? '' : o.v);
        var p = self.gp(o.gx, o.gy, ELEV_LAND);
        if (o.kind === 'palm') self.shadowAt(p.x + 15, p.y + 3, 66, 20, 1);
        else if (o.kind === 'bush') self.shadowAt(p.x + 5, p.y + 2, 36, 11, 1);
        else self.shadowAt(p.x + 4, p.y + 2, 32, 10, 1);
        var img = self.add.image(p.x, p.y, key).setOrigin(self.origins[key][0], self.origins[key][1]).setDepth(p.y);
        if (o.kind === 'palm') {
          self.tweens.add({ targets: img, angle: { from: -1.4, to: 1.4 }, duration: 2600 + Math.random() * 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: Math.random() * 1500 });
        }
      });

      // dekor tropis (tanpa tabrakan): alang-alang, teratai, karang, pisang, obor tiki, payung, perahu
      (M.decor || []).forEach(function (d) {
        var key = d.kind, wp = { x: (d.gx - d.gy) * 32 + W / 2, y: (d.gx + d.gy) * 16 }, lp = self.gp(d.gx, d.gy, ELEV_LAND), im;
        if (key === 'pad') {
          key = 'pad' + d.f;
          im = self.add.image(wp.x, wp.y, key).setOrigin(self.origins[key][0], self.origins[key][1]).setDepth(-46);
          self.tweens.add({ targets: im, y: wp.y + 1.5, angle: { from: -3, to: 3 }, duration: 2200 + Math.random() * 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        } else if (key === 'coral') {
          self.add.image(wp.x, wp.y, 'coral').setOrigin(self.origins.coral[0], self.origins.coral[1]).setDepth(-46).setAlpha(0.92);
        } else if (key === 'boat') {
          im = self.add.image(wp.x, wp.y, 'boat').setOrigin(self.origins.boat[0], self.origins.boat[1]).setDepth(wp.y);
          self.tweens.add({ targets: im, y: wp.y + 1.6, angle: { from: -1.2, to: 1.2 }, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        } else if (key === 'towel') {
          self.add.image(lp.x, lp.y, 'towel').setOrigin(self.origins.towel[0], self.origins.towel[1]).setDepth(-48);
        } else {
          if (key === 'parasol') self.shadowAt(lp.x + 16, lp.y + 3, 54, 16, 1);
          else if (key === 'banana') self.shadowAt(lp.x + 7, lp.y + 3, 44, 14, 1);
          else if (key === 'torch') self.shadowAt(lp.x + 5, lp.y + 2, 18, 7, 1);
          else if (key === 'barrel' || key === 'crate') self.shadowAt(lp.x + 4, lp.y + 2, 24, 8, 1);
          im = self.add.image(lp.x, lp.y, key).setOrigin(self.origins[key][0], self.origins[key][1]).setDepth(lp.y);
          if (key === 'reed' || key === 'banana') self.tweens.add({ targets: im, angle: { from: -2.2, to: 2.2 }, duration: 1800 + Math.random() * 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          if (key === 'torch') {
            var fl = self.add.image(lp.x, lp.y - 36, 'flame').setOrigin(0.5, 0.9).setDepth(lp.y + 1);
            var gl = self.add.image(lp.x, lp.y - 38, 'glow').setBlendMode(Phaser.BlendModes.ADD).setScale(1.7).setAlpha(0.5).setDepth(lp.y + 2);
            self.tweens.add({ targets: fl, scaleY: { from: 0.85, to: 1.2 }, scaleX: { from: 1.1, to: 0.85 }, duration: 180 + Math.random() * 120, yoyo: true, repeat: -1 });
            self.tweens.add({ targets: gl, alpha: { from: 0.35, to: 0.65 }, duration: 260 + Math.random() * 200, yoyo: true, repeat: -1 });
          }
        }
      });
      // bayangan ikan berenang pelan di bawah air
      (M.fishC || []).forEach(function (fc) {
        var cx0 = (fc.gx - fc.gy) * 32 + W / 2, cy0 = (fc.gx + fc.gy) * 16;
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
      this.shadowAt(sp0.x + 8, sp0.y + 8, 80, 22, 1);
      this.add.image(sp0.x, sp0.y + 6, 'stall').setOrigin(this.origins.stall[0], this.origins.stall[1]).setDepth(sp0.y);
      var np = this.gp(M.npc.gx, M.npc.gy, ELEV_LAND);
      this.shadowAt(np.x + 3, np.y, 28, 10, 1).setDepth(np.y - 1);
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
      this.shadow = this.add.image(0, 0, 'shadow').setDisplaySize(28, 10);
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
    shadowAt(x, y, w, h, a) { return this.add.image(x, y, 'shadow').setDisplaySize(w, h).setAlpha(a || 1).setDepth(-49); }
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
      this.shadow.setPosition(p.x + 3, p.y).setDepth(p.y - 0.5);
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
      this.waves3.tilePositionX += 5 * dt; this.waves3.tilePositionY += 2.5 * dt;

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
