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
var ELEV_LAND = 0, ELEV_DOCK = 4;
var WATER = 0, SAND = 1, GRASS = 2, DOCK = 3;
var WALK_SPEED = 92, RUN_SPEED = 165;   // px layar / detik (jalan pelan, lari saat tombol LARI ditahan)
var WALK_CYCLE = 52, RUN_CYCLE = 78;    // jarak (px) untuk satu siklus langkah => kaki sinkron dengan gerak
var CAST_MIN = 80, CAST_MAX = 300, CHARGE_TIME = 1.25;   // jarak lempar (px layar, horizontal) & lama menahan sampai tenaga penuh
var ZOOM_MAX = 3, ZOOM_MIN = 1.5, ZOOM_STEP = 0.5;   // zoom diatur pemain lewat tombol + / - (3 = paling dekat, 1,5 = paling jauh)
var REEL = {                            // gain = isi bar tiap tekan, decay = bar turun per detik (ikan melawan)
  common: { gain: 0.13, decay: 0.14 }, uncommon: { gain: 0.11, decay: 0.18 }, rare: { gain: 0.09, decay: 0.22 },
  epic: { gain: 0.08, decay: 0.26 }, legendary: { gain: 0.07, decay: 0.30 },
  divine: { gain: 0.065, decay: 0.31 }, exalted: { gain: 0.06, decay: 0.32 }, limited: { gain: 0.065, decay: 0.31 },
  genesis: { gain: 0.055, decay: 0.33 }, hidden: { gain: 0.05, decay: 0.34 }
};
var SAVE_KEY = 'tropicalFishing.save.v1';

var RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'divine', 'exalted', 'limited', 'genesis', 'hidden'];   // urutan TETAP
/* Peluang tiap rarity dihitung oleh fishing-core (fishing-core.js): W = B x F^S lalu dinormalkan; B & S ada di rarityConfig.js.
   Di sini hanya tampilan & tantangan: label/color = tampilan, window = jendela reaksi gigitan (detik),
   minPower = tenaga joran minimal agar ikan rarity ini bisa muncul (syarat ikan; joran lebih lemah: tidak pernah muncul).
   'limited' khusus event (belum ada event/ikannya, jadi belum pernah muncul). */
var RARITY = {
  common:    { label: 'Biasa',       color: '#cfd8dc', window: 1.8,  minPower: 1 },
  uncommon:  { label: 'Tidak Biasa', color: '#5fd56a', window: 1.5,  minPower: 1 },
  rare:      { label: 'Langka',      color: '#4aa8ff', window: 1.25, minPower: 2 },
  epic:      { label: 'Epik',        color: '#c96bff', window: 1.0,  minPower: 2 },
  legendary: { label: 'Legendaris',  color: '#ffc23a', window: 0.85, minPower: 3 },
  divine:    { label: 'Ilahi',       color: '#7df9ff', window: 0.8,  minPower: 3 },
  exalted:   { label: 'Agung',       color: '#ff6b4a', window: 0.75, minPower: 4 },
  limited:   { label: 'Terbatas',    color: '#3df5c8', window: 0.85, minPower: 4 },
  genesis:   { label: 'Genesis',     color: '#ffffff', window: 0.7,  minPower: 4 },
  hidden:    { label: 'Tersembunyi', color: '#ff2e88', window: 0.65, minPower: 4 }
};
function reelOf(r) { return REEL[r] || REEL.legendary; }
function xpBase(r) { return XP_FISH[r] || XP_FISH.legendary; }
function maxRarity(power) {                         // rarity tertinggi yang bisa muncul untuk power joran ini
  var best = null;
  RARITY_ORDER.forEach(function (k) { if (RARITY[k].minPower <= power && FISH.some(function (f) { return f.rarity === k; })) best = k; });
  return best || RARITY_ORDER[0];
}

var FISH = [
  { id: 'teri', kg: [0.02, 0.12],     name: 'Teri Pantai',        rarity: 'common',    price: 10,   c: ['#aebfcc', '#eef5fa', '#7f98a8'],
    desc: 'Ikan kecil keperakan yang berenang berkelompok di air dangkal. Enak digoreng renyah.' },
  { id: 'kembung', kg: [0.2, 0.8],  name: 'Kembung Biru',       rarity: 'common',    price: 14,   c: ['#3f7fb5', '#d5e8f5', '#2b5f8c'],
    desc: 'Perenang cepat berpunggung biru. Sering terlihat di sekitar dermaga.' },
  { id: 'bandeng', kg: [0.5, 2.5],  name: 'Bandeng Laguna',     rarity: 'common',    price: 18,   c: ['#bfc9cf', '#f1f3f4', '#8d9aa2'],
    desc: 'Ikan tenang penghuni laguna hangat. Dagingnya gurih dan lembut.' },
  { id: 'kakap', kg: [1, 6],    name: 'Kakap Merah',        rarity: 'uncommon',  price: 40,   c: ['#d9473a', '#f5b7a8', '#a8322a'],
    desc: 'Bersisik merah menyala dan suka bersembunyi di dekat karang.' },
  { id: 'badut', kg: [0.1, 0.5],    name: 'Ikan Badut Jingga',  rarity: 'uncommon',  price: 55,   c: ['#ff8a1f', '#ffc27a', '#d96a00'], stripe: '#ffffff',
    desc: 'Berloreng putih dan bersahabat dengan anemon. Cantik dan lincah.' },
  { id: 'baronang', kg: [0.5, 2.5], name: 'Baronang Tropis',    rarity: 'uncommon',  price: 70,   c: ['#c9b13a', '#f1e6a0', '#8f7d1c'],
    desc: 'Pemakan lumut yang waspada. Sirip punggungnya tajam, hati-hati!' },
  { id: 'kerapu', kg: [3, 25],   name: 'Kerapu Macan',       rarity: 'rare',      price: 150,  c: ['#8a6a47', '#d8c3a0', '#5e432a'], dots: '#3d2a18',
    desc: 'Predator karang berbintik gelap. Gigitannya kuat dan menarik kail ke bawah.' },
  { id: 'tenggiri', kg: [2, 15], name: 'Tenggiri Emas',      rarity: 'rare',      price: 210,  c: ['#e0b43a', '#fff0b8', '#b58710'],
    desc: 'Ikan ramping berkilau keemasan yang berenang kencang di laut terbuka.' },
  { id: 'tuna', kg: [20, 180],     name: 'Tuna Sirip Kuning',  rarity: 'epic',      price: 520,  c: ['#27457c', '#dfe6ee', '#ffd400'],
    desc: 'Raksasa laut dalam bersirip kuning terang. Kebanggaan setiap nelayan.' },
  { id: 'naga', kg: [40, 400],     name: 'Naga Laut Pelangi',  rarity: 'legendary', price: 2500, c: ['#ff5ea8', '#fff4ff', '#7a5cff'], rainbow: true,
    desc: 'Makhluk legendaris bersisik pelangi. Konon hanya muncul bagi nelayan yang sabar.' },
  { id: 'fajar', kg: [60, 500],    name: 'Ikan Cahaya Fajar',  rarity: 'divine',    price: 12000,   c: ['#ffe27a', '#fffbe0', '#e0a82e'], stripe: '#ffffff',
    desc: 'Bersinar seperti fajar di dasar laut. Nelayan tua menyebutnya berkah, bukan tangkapan.' },
  { id: 'rajakarang', kg: [150, 1200], name: 'Raja Karang Merah', rarity: 'exalted', price: 60000,   c: ['#b3122e', '#ff8a7a', '#6e0818'], dots: '#ffd0c0',
    desc: 'Penguasa karang dalam yang bersisik merah darah. Jarang ada yang melihatnya dua kali.' },
  { id: 'awalmula', kg: [300, 2500], name: 'Ikan Awal Mula',    rarity: 'genesis',   price: 350000,  c: ['#6a5cff', '#eae6ff', '#2a1f8f'], stripe: '#ffffff', dots: '#b9f5ff',
    desc: 'Konon sudah ada sejak laut pertama terbentuk. Sisiknya memantulkan cahaya yang tidak ada di langit.' },
  { id: 'bayangan', kg: [500, 5000], name: 'Bayangan Samudra',  rarity: 'hidden',    price: 2000000, c: ['#1d1f3a', '#5b5f8f', '#0a0b18'], dots: '#7ee7ff',
    desc: 'Nyaris tak terlihat. Banyak yang bersumpah ia hanya dongeng.' }
];
var FISH_BY_ID = {};
FISH.forEach(function (f) { FISH_BY_ID[f.id] = f; });

/* ---------- Joran (level + Coins), Skill (poin dari level), Mutasi ikan ---------- */
/* power = tenaga tarik (bar tarik lebih mudah penuh, ikan lebih lambat melawan) DAN syarat ikan (ikan rarity tertentu hanya muncul bila tenaga joran >= RARITY.minPower);
   luck = bonus Hoki dalam PERSEN (Hoki dasar 100%, mis. 40 = +40%). Dua joran boleh punya power sama tapi luck berbeda. */
var RODS = [
  { id: 'kayu', name: 'Joran Kayu Pemula', lv: 1, price: 0, power: 1, luck: 0, accent: '#e0b06a', style: {},
    desc: 'Joran kayu sederhana. Cukup untuk belajar memancing di dermaga.' },
  { id: 'bambu', name: 'Joran Bambu Tua', lv: 5, price: 600, power: 1, luck: 40, accent: '#d6cf6a',
    style: { b0: '#b8b04a', b1: '#efe58a', b2: '#6f6a24', b3: '#9a933a', b4: '#857f2c', w0: '#3f5a2a', w1: '#567a38', w2: '#6e9648', wh0: '#7fae58', wh1: '#a5d070', wd: '#22361a', wm: '#2f4a20' },
    desc: 'Bambu pilihan yang diyakini membawa hoki. Tenaganya sama dengan joran kayu, tapi lebih beruntung.' },
  { id: 'fiber', name: 'Joran Fiber Biru', lv: 10, price: 2200, power: 2, luck: 70, accent: '#59b6ff',
    style: { b0: '#2f7bd0', b1: '#7fc0ff', b2: '#173f78', b3: '#2468b8', b4: '#1d559a', w0: '#3a3f4a', w1: '#505766', w2: '#686f80', wh0: '#7b8396', wh1: '#a0a8ba', wd: '#1b1e25', wm: '#2a2e38',
      m0: '#cfd6e2', m1: '#ffffff', m2: '#7f8798', m3: '#aab2c2', r0: '#c4cbd8', r1: '#8f98ab', r2: '#7a8396', r3: '#eef2fa', r4: '#5b6479', r5: '#9aa3b6', r6: '#dfe5f0', r7: '#6a7388' },
    desc: 'Serat fiber ringan dan lentur. Tarikannya lebih kuat dari joran kayu.' },
  { id: 'karbon', name: 'Joran Karbon Hitam', lv: 18, price: 7500, power: 3, luck: 110, accent: '#ff6b6b',
    style: { b0: '#2d3037', b1: '#6c7280', b2: '#121318', b3: '#23262c', b4: '#1b1d22', w0: '#7a1f1f', w1: '#a02828', w2: '#c23a3a', wh0: '#d85a5a', wh1: '#f08a8a', wd: '#4a1010', wm: '#5e1818',
      m0: '#c9ccd6', m1: '#ffffff', m2: '#6f7384', m3: '#a3a7b6', r0: '#4a4f5c', r1: '#2b2e38', r2: '#383c48', r3: '#9aa0b0', r4: '#1c1e26', r5: '#6a6f7e', r6: '#b0b5c4', r7: '#3c404c' },
    desc: 'Kuat, kaku, dan peka terhadap gigitan. Pilihan nelayan berpengalaman.' },
  { id: 'titan', name: 'Joran Titanium Laut', lv: 28, price: 20000, power: 3, luck: 180, accent: '#6fe3d2',
    style: { b0: '#5fa8b8', b1: '#bff0f8', b2: '#2a5f70', b3: '#4a8fa0', b4: '#3a7788', w0: '#2a3a48', w1: '#3c5266', w2: '#506a82', wh0: '#6a88a4', wh1: '#8fb0cc', wd: '#141e28', wm: '#1e2c3a',
      m0: '#e6e8f0', m1: '#ffffff', m2: '#8a90a2', m3: '#c0c5d4', r0: '#9fe6f0', r1: '#4aa0b4', r2: '#62bcd0', r3: '#e6fcff', r4: '#2f7488', r5: '#bfeaf2', r6: '#f2feff', r7: '#4a8fa0' },
    desc: 'Tenaga sama seperti joran karbon, tetapi diberkahi hoki jauh lebih besar.' },
  { id: 'naga', name: 'Joran Naga Pelangi', lv: 40, price: 60000, power: 4, luck: 260, accent: '#d28cff',
    style: { b0: '#b03ad0', b1: '#f08aff', b2: '#5a1a78', b3: '#9a2cba', b4: '#7e2298', w0: '#3a1a5a', w1: '#552a80', w2: '#6e3ca0', wh0: '#8a58c0', wh1: '#b088e0', wd: '#20103a', wm: '#2c164a',
      m0: '#ffd34a', m1: '#fff7b0', m2: '#b8860b', m3: '#e6b422', r0: '#ffd34a', r1: '#b8860b', r2: '#e6b422', r3: '#fff7b0', r4: '#7a5a08', r5: '#ffe27a', r6: '#fff2b0', r7: '#9a7410' },
    desc: 'Joran legendaris bersisik pelangi. Tenaga tertinggi dan keberuntungan terbaik.' }
];
var RODS_BY_ID = {};
RODS.forEach(function (r) { RODS_BY_ID[r.id] = r; });

var MUTS = [
  { id: 'albino', name: 'Albino', mult: 1.5, w: 40, color: '#eef0ff' },
  { id: 'emas', name: 'Emas', mult: 2.5, w: 28, color: '#ffd54a' },
  { id: 'kristal', name: 'Kristal', mult: 4, w: 16, color: '#7ae8ff' },
  { id: 'neon', name: 'Neon', mult: 6, w: 9, color: '#ff5ee8' },
  { id: 'kosmik', name: 'Kosmik', mult: 12, w: 3, color: '#b48cff' }
];
var MUT_BY_ID = {};
MUTS.forEach(function (m) { MUT_BY_ID[m.id] = m; });
function mutMult(id) { return id && MUT_BY_ID[id] ? MUT_BY_ID[id].mult : 1; }
function mutTag(id) { return id && MUT_BY_ID[id] ? '<span style="color:' + MUT_BY_ID[id].color + ';text-shadow:0 0 6px ' + MUT_BY_ID[id].color + '">[' + MUT_BY_ID[id].name + ']</span> ' : ''; }

var SKILL_ORDER = ['luck', 'mut', 'big', 'swift'];
function fmtP(v) { return String(v).replace('.', ','); }
function r1(v) { return Math.round(v * 10) / 10; }
/* Tiap skill: level mulai 1, tanpa batas, naik 1 level = 1 poin (1 poin didapat tiap naik level pemain). Nilai efek dihitung fishing-core (kurva di gameAdapter.js). */
var SKILLS = {
  luck:  { name: 'Hoki', color: '#6fe36f',
    eff: function (lv) { return 'Hoki +' + fmtP(r1(FCA.skillBonus('luck', lv))) + '%'; },
    desc: 'Menambah Hoki total (dasar 100%). Tiap tingkat +10%. Makin tinggi Hoki, makin besar peluang ikan langka; efeknya diredam otomatis di Hoki yang sangat tinggi.' },
  mut:   { name: 'Mutasi', color: '#d28cff',
    eff: function (lv) { return 'Mutasi +' + fmtP(r1(FCA.skillBonus('mut', lv))) + '%'; },
    desc: 'Menambah peluang ikan bermutasi (dasar 0,5%). Harga mutasi berlipat.' },
  big:   { name: 'Ikan Besar', color: '#ff9a4a',
    eff: function (lv) { return 'Jumbo +' + fmtP(r1(FCA.skillBonus('big', lv))) + '%'; },
    desc: 'Menambah peluang ikan jumbo (berat mendekati batas atas jenisnya; dasar 0,5%).' },
  swift: { name: 'Tangkas', color: '#59b6ff',
    eff: function (lv) { var v = FCA.skillBonus('swift', lv); return 'Tunggu -' + Math.round(v) + '% | Tarik +' + Math.round(v) + '%'; },
    desc: 'Ikan menggigit lebih cepat (maks. -60% waktu tunggu) dan waktu menarik sedikit lebih longgar. Tidak memengaruhi peluang rarity.' }
};
function skillLevel(k) { var v = Save.data.skillLv && Save.data.skillLv[k]; return Math.max(1, Math.floor(+v || 1)); }
function skillSpent() { var s = 0; SKILL_ORDER.forEach(function (k) { s += skillLevel(k) - 1; }); return s; }
function skillPoints() { return Math.max(0, levelInfo(Save.data.xp).level - 1 - skillSpent()); }
function curRod() { return RODS_BY_ID[Save.data.rod] || RODS[0]; }

/* ---------- Umpan: dibeli per paket, terpakai 1 per lemparan, efeknya dijumlah dengan joran dan skill ---------- */
var BAIT_PACK = 10, BAIT_MAX = 999;
var BAITS = [
  { id: 'cacing',    name: 'Cacing Tanah',     lv: 1,  price: 100,   luck: 10,  mut: 0,   big: 0, accent: '#e58a9a', desc: 'Umpan paling murah dan umum. Sedikit menambah hoki.' },
  { id: 'udang',     name: 'Udang Segar',      lv: 4,  price: 400,   luck: 24, mut: 0,   big: 0, accent: '#ff9a5a', desc: 'Ikan karang suka sekali udang segar. Hoki lebih baik dari cacing.' },
  { id: 'larva',     name: 'Larva Cahaya',     lv: 8,  price: 1200,  luck: 0,  mut: 1.5, big: 0, accent: '#c8ff6a', desc: 'Larva berpendar aneh yang memancing ikan bermutasi.' },
  { id: 'terib',     name: 'Umpan Teri Besar', lv: 12, price: 1500,  luck: 20, mut: 0,   big: 5, accent: '#cfe3f0', desc: 'Teri besar mengundang ikan bertubuh besar.' },
  { id: 'gelombang', name: 'Umpan Gelombang',  lv: 16, price: 3500,  luck: 40, mut: 1,   big: 0, accent: '#4aa8ff', desc: 'Berdenyut mengikuti ombak. Menambah hoki dan sedikit peluang mutasi.' },
  { id: 'emas',      name: 'Umpan Emas',       lv: 25, price: 9000,  luck: 70, mut: 2,   big: 5, accent: '#ffd34a', desc: 'Berkilau emas. Hoki besar, mutasi, dan ikan jumbo sekaligus.' },
  { id: 'kosmik',    name: 'Umpan Kosmik',     lv: 40, price: 25000, luck: 100, mut: 4,   big: 0, accent: '#b48cff', desc: 'Umpan dari bintang jatuh. Hoki dan peluang mutasi tertinggi.' }
];
var BAITS_BY_ID = {};
BAITS.forEach(function (b) { BAITS_BY_ID[b.id] = b; });
function baitCount(id) { return (Save.data.baits && Save.data.baits[id]) | 0; }
function activeBait() { var b = BAITS_BY_ID[Save.data.bait]; return b && baitCount(b.id) > 0 ? b : null; }
function baitSummary(b) {
  var t = [];
  if (b.luck) t.push('Hoki +' + b.luck + '%');
  if (b.mut) t.push('Mutasi +' + fmtP(b.mut) + '%');
  if (b.big) t.push('Jumbo +' + b.big + '%');
  return t.join(' | ');
}

/* ---------- Luck, rarity, mutasi, ukuran: dihitung oleh fishing-core (fishing-core.js) ----------
   Hoki dalam PERSEN (100% = faktor 1). Total = 100% + keahlian + joran + umpan + bonus lemparan (lempar penuh 0, pendek sampai -40%).
   Peluang rarity: W = B x F^S dinormalkan; F dilunakkan soft cap (mulai Hoki 10.000%, mendekati maks pada 20.000%).
   CATATAN: ini berjalan di browser (offline/single-player). Untuk multiplayer, pindahkan pemanggilan ini ke server. */
if (typeof FishingCore === 'undefined') throw new Error('fishing-core.js belum dimuat (cek tag <script> di index.html)');
var CAST_LUCK = 40, MUT_BASE = 0.5, JUMBO_BASE = 0.5;
var fmtLuck = FishingCore.formatLuck;
var FCA = FishingCore.createGameAdapter({
  fish: FISH.map(function (f) { return { id: f.id, rarity: f.rarity, kg: f.kg, minPower: RARITY[f.rarity].minPower }; }),
  mutations: MUTS.map(function (m) { return { id: m.id, weight: m.w }; }),
  castLuck: CAST_LUCK, mutationBase: MUT_BASE, jumboBase: JUMBO_BASE
});
function fishState(bait, cp) {
  var r = curRod();
  return { rod: { power: r.power, luck: r.luck }, bait: bait ? { luck: bait.luck, mut: bait.mut || 0, big: bait.big } : null,
    skills: { luck: skillLevel('luck'), mut: skillLevel('mut'), big: skillLevel('big'), swift: skillLevel('swift') }, castPower: cp === undefined ? 1 : cp };
}
function totalLuck(bait, cp) { return FCA.luckInfo(fishState(bait === undefined ? activeBait() : bait, cp)).totalLuck; }
function rarityChances(bait, cp) { return FCA.rarityChances(fishState(bait === undefined ? activeBait() : bait, cp)); }   // [{r, p}] p = 0..1
function mutChance(bait) { return FCA.mutationChance(fishState(bait === undefined ? activeBait() : bait)); }
function jumboChance(bait) { return FCA.jumboChance(fishState(bait === undefined ? activeBait() : bait)); }
function rollCatch(bait, cp) {                        // ketersediaan -> rarity -> ikan -> mutasi -> ukuran
  var res = FCA.rollCatch(fishState(bait, cp)), ok = res.status === 'ok', def = ok ? FISH_BY_ID[res.fishId] : FISH[0];
  var mut = ok ? res.mutation : null, wx = ok ? weatherAt() : null;
  if (wx && Math.random() * 100 < wx.chance) mut = wx.mutId;     // cuaca mutasi: peluang (25-100%) ikan jadi mutasi cuaca itu
  return { def: def, kg: ok ? res.kg : defaultKg(def), mut: mut };
}

/* ---------- Level & XP pemain ---------- */
var XP_FISH = { common: 10, uncommon: 25, rare: 60, epic: 150, legendary: 500, divine: 1200, exalted: 3000, limited: 2000, genesis: 8000, hidden: 25000 };   // XP dasar per ikan (dikali faktor berat)
var XP_FIRST = 20;                                  // bonus XP untuk jenis ikan yang baru pertama kali ditangkap
function xpToNext(l) { return Math.round(80 * Math.pow(l, 1.4)); }   // XP dari level l ke l+1 (Lv1->2 = 80, Lv10->11 = 2.010, Lv50->51 = 19.127); ubah angka 80 / 1.4 untuk atur kesulitan
function levelInfo(xp) {                            // level tidak terbatas
  var l = 1, rest = Math.max(0, Math.floor(xp || 0)), need = xpToNext(1);
  while (rest >= need && l < 100000) { rest -= need; l++; need = xpToNext(l); }
  return { level: l, cur: rest, need: need, frac: rest / need };
}
function levelReward(l) { return l * 25; }          // hadiah Coins saat mencapai level l
function rankTitle(l) {
  return l >= 100 ? 'Dewa Laut' : l >= 75 ? 'Raja Samudra' : l >= 50 ? 'Legenda Laut' : l >= 35 ? 'Master Pancing' : l >= 20 ? 'Pemburu Ikan' : l >= 10 ? 'Nelayan Handal' : l >= 5 ? 'Pemancing Lokal' : 'Nelayan Pemula';
}

/* ---------- Berat ikan (kg): makin berat => makin mahal & makin besar XP ---------- */
function roundKg(kg) { return Math.max(0.01, kg < 10 ? Math.round(kg * 100) / 100 : Math.round(kg * 10) / 10); }
function fmtNum(kg) { var d = kg < 10 ? 2 : 1; return kg.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }); }
function fmtKg(kg) { return fmtNum(kg) + ' kg'; }
function fishScale(kg) {                            // ukuran tampilan ikan menurut berat mutlak (semua jenis)
  var k = Math.max(kg, 0.01), base = Math.pow(k, 0.25);                    // kurva dasar: 1 kg = 1x, 160 kg = 3,6x
  var boost = 1 + 2 * Math.max(0, Math.min(1, Math.log(Math.max(k, 1)) / Math.log(180)));   // ikan <= 1 kg x1, ikan >= 180 kg x3
  return Math.max(0.45, Math.min(13, base * boost));
}
function sizeT(f, kg) { var r = f.kg[1] - f.kg[0]; return r > 0 ? Math.max(0, Math.min(1, (kg - f.kg[0]) / r)) : 0; }   // 0 = terkecil, 1 = terbesar
function sizeFactor(f, kg) { return 0.5 + 1.5 * sizeT(f, kg); }      // 0,5x (terkecil) sampai 2x (terbesar)
function priceOf(id, kg) { var f = FISH_BY_ID[id]; return Math.max(1, Math.round(f.price * sizeFactor(f, kg))); }
function xpOf(f, kg) { return Math.max(1, Math.round(xpBase(f.rarity) * sizeFactor(f, kg))); }
function defaultKg(f) { return roundKg(f.kg[0] + (f.kg[1] - f.kg[0]) / 3); }   // berat yang harganya = harga dasar (dipakai untuk save lama)
function rollKg(f, power, jumboPct) {               // ikan jumbo (t >= 0,85) sangat jarang; lemparan jauh sedikit membantu
  power = Math.max(0, Math.min(1, power || 0));
  var t;
  if (Math.random() * 100 < (jumboPct || 0)) t = 0.85 + 0.15 * Math.random();
  else t = 0.85 * Math.pow(Math.random(), Math.max(1.6, 2.4 - 0.5 * power));
  return roundKg(f.kg[0] + (f.kg[1] - f.kg[0]) * t);
}
function blankKgs() { var r = [], i; for (i = 0; i < 50; i++) r.push(null); return r; }
function cleanKgs(arr, slots) {
  var r = [], i;
  for (i = 0; i < slots.length; i++) {
    var id = slots[i], v = Array.isArray(arr) ? +arr[i] : 0;
    r.push(id ? (v > 0 && isFinite(v) ? roundKg(v) : defaultKg(FISH_BY_ID[id])) : null);
  }
  return r;
}
function cleanRecord(o) {
  var r = {};
  if (o && typeof o === 'object') FISH.forEach(function (f) { var v = +o[f.id]; if (v > 0 && isFinite(v)) r[f.id] = roundKg(v); });
  return r;
}
function cleanName(s) {
  s = String(s == null ? '' : s).replace(/[<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14).trim();
  return s || 'Nelayan';
}

/* ---------- Save (LocalStorage) ---------- */
function cleanCounts(o) {
  var r = {};
  if (o && typeof o === 'object') {
    FISH.forEach(function (f) { var n = Math.floor(+o[f.id] || 0); if (n > 0) r[f.id] = n; });
  }
  return r;
}
var NSLOT = 50, NHOT = 6;                 // 50 kotak tas; 6 kotak pertama tampil di hotbar (setelah slot joran)
function cleanSlots(arr) {
  var r = [], i;
  for (i = 0; i < NSLOT; i++) { var id = Array.isArray(arr) ? arr[i] : null; r.push(id && FISH_BY_ID[id] ? id : null); }
  return r;
}
function slotsFromCounts(counts) {         // migrasi save lama (jumlah per jenis) -> 1 ikan per kotak
  var list = [], over = 0, earn = 0;
  FISH.forEach(function (f) { var n = counts[f.id] || 0; while (n-- > 0) list.push(f); });
  list.sort(function (x, y) { return y.price - x.price; });          // ikan paling berharga disimpan dulu
  var r = [];
  list.forEach(function (f) { if (r.length < NSLOT) r.push(f.id); else { over++; earn += f.price; } });   // kelebihan => dijual otomatis
  while (r.length < NSLOT) r.push(null);
  return { slots: r, over: over, earn: earn };
}
function cleanMuts(arr, slots) { var r = [], i; for (i = 0; i < NSLOT; i++) { var v = Array.isArray(arr) ? arr[i] : null; r.push(slots[i] && v && MUT_BY_ID[v] ? v : null); } return r; }
function blankData() {
  return { coins: 0, inv: {}, slots: cleanSlots(null), caught: {}, px: null, py: null, name: 'Nelayan', xp: 0, kgs: blankKgs(), muts: blankKgs(), record: {}, zoom: ZOOM_MAX,
    rod: 'kayu', rods: ['kayu'], skillLv: { luck: 1, mut: 1, big: 1, swift: 1 }, baits: {}, bait: null };
}
var Save = {
  data: blankData(),
  migrated: 0,
  load: function () {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      var d = JSON.parse(raw);
      if (!d || typeof d !== 'object') return;
      this.data.coins = Math.max(0, Math.floor(+d.coins || 0));
      if (Array.isArray(d.slots)) this.data.slots = cleanSlots(d.slots);
      else { var m = slotsFromCounts(cleanCounts(d.inv)); this.data.slots = m.slots; this.data.coins += m.earn; this.migrated = m.over; }
      this.data.kgs = cleanKgs(d.kgs, this.data.slots);
      this.data.muts = cleanMuts(d.muts, this.data.slots);
      var ro = Array.isArray(d.rods) ? d.rods.filter(function (id) { return RODS_BY_ID[id]; }) : [];
      if (ro.indexOf('kayu') < 0) ro.unshift('kayu');
      this.data.rods = ro;
      this.data.rod = (RODS_BY_ID[d.rod] && ro.indexOf(d.rod) >= 0) ? d.rod : 'kayu';
      var sl = d.skillLv && typeof d.skillLv === 'object' ? d.skillLv : null, old = d.skills && typeof d.skills === 'object' ? d.skills : {}, cum = [0, 1, 3, 6, 10, 15, 21];
      var lvOf = function (k) { return sl ? Math.max(1, Math.floor(+sl[k]) || 1) : 1 + cum[Math.max(0, Math.min(6, old[k] | 0))]; };   // save lama (tingkat 0-6): level = 1 + poin yang sudah dipakai
      this.data.skillLv = { luck: lvOf('luck'), mut: lvOf('mut'), big: lvOf('big'), swift: lvOf('swift') };
      var bt = {};
      if (d.baits && typeof d.baits === 'object') BAITS.forEach(function (b) { var n = Math.floor(+d.baits[b.id] || 0); if (n > 0) bt[b.id] = Math.min(BAIT_MAX, n); });
      this.data.baits = bt;
      this.data.bait = (BAITS_BY_ID[d.bait] && bt[d.bait] > 0) ? d.bait : null;
      this.data.record = cleanRecord(d.record);
      this.data.zoom = (+d.zoom >= ZOOM_MIN && +d.zoom <= ZOOM_MAX) ? Math.round(+d.zoom * 100) / 100 : ZOOM_MAX;
      syncInv();
      this.data.caught = cleanCounts(d.caught);
      this.data.px = typeof d.px === 'number' ? d.px : null;
      this.data.py = typeof d.py === 'number' ? d.py : null;
      this.data.name = cleanName(d.name);
      if (d.xp === undefined) {                        // save lama: hitung XP dari ikan yang pernah ditangkap
        var xp0 = 0, cg = this.data.caught;
        FISH.forEach(function (f) { if (cg[f.id] > 0) xp0 += cg[f.id] * xpBase(f.rarity) + XP_FIRST; });
        this.data.xp = xp0;
      } else this.data.xp = Math.max(0, Math.floor(+d.xp || 0));
    } catch (e) { /* abaikan */ }
  },
  write: function () {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) { /* abaikan */ }
  },
  reset: function () {
    this.data = blankData();
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* abaikan */ }
  }
};

function syncInv() {                      // hitungan per jenis (dipakai toko) diturunkan dari kotak
  var inv = {};
  Save.data.slots.forEach(function (id) { if (id) inv[id] = (inv[id] || 0) + 1; });
  Save.data.inv = inv;
}
function freeSlots() { var n = 0; Save.data.slots.forEach(function (x) { if (!x) n++; }); return n; }
function slotPrice(i) { var id = Save.data.slots[i]; return id ? Math.max(1, Math.round(priceOf(id, Save.data.kgs[i]) * mutMult(Save.data.muts[i]))) : 0; }
function addFishSlot(id, kg, mut) {
  var s = Save.data.slots;
  for (var i = 0; i < s.length; i++) if (!s[i]) { s[i] = id; Save.data.kgs[i] = kg || defaultKg(FISH_BY_ID[id]); Save.data.muts[i] = mut || null; syncInv(); return i; }
  return -1;
}

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
  var q;   // (alang-alang dihapus: sebelumnya menutupi karakter saat berdiri di tepi pantai)
  var pads = 0;
  for (var tries = 0; tries < 900 && pads < 8; tries++) {
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
  for (q = 0; q < cand2.length && nb < 3; q++) {
    var bi = cand2[q][0], bj = cand2[q][1], bxx = bi + 0.5, byy = bj + 0.5;
    if (T[bj * GRID + bi] !== GRASS || hasObs(bi, bj) || onLane(bxx, byy) || dist(bi, bj) > 7.0 || !farFrom(decor, bxx, byy, 2.6)) continue;
    decor.push({ kind: 'banana', gx: bxx, gy: byy }); nb++;
  }
  [[dockStart - 1, C - 2], [dockStart - 1, C + 1]].forEach(function (tp) {
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
  if (at(dockStart + 2, C + 1) === WATER && at(dockStart + 3, C + 1) === WATER && at(dockStart + 2, C + 2) === WATER && at(dockStart + 2, C + 3) === WATER) decor.push({ kind: 'boat', gx: dockStart + 2.6, gy: C + 2.5 });
  var nc = 0;
  for (tries = 0; tries < 900 && nc < 5; tries++) {
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
  for (i = 0; i <= 60; i++) {
    t = i / 60; x = bx + (cx - bx) * t + Math.sin(t * Math.PI) * bend; y = by + (cy - by) * t;
    w = 2.5 - t * 1.0 + (t < 0.08 ? 1.2 : 0);
    for (d = -w; d <= w; d += 0.5) {
      col = d < -w * 0.45 ? cl[0] : (d > w * 0.4 ? cl[2] : cl[1]);
      if (i % 5 === 0) col = d < -w * 0.45 ? cl[1] : (d > w * 0.4 ? '#3f2812' : cl[2]);
      PX(g, x + d, y, col, S);
    }
  }
}
function makePalm(variant) {
  var S = 2, LW = 56, LH = 56, cv = mkCanvas(LW * S, LH * S), c = cv[0], g = cv[1], k;
  var B = variant === 1;
  var bx = B ? 36 : 22, by = 52, cx = B ? 24 : 34, cy = B ? 24 : 20, bend = B ? 3 : -3;
  var back = B ? ['#7fcf4e', '#3f9a3a', '#1b6a33', '#a6d96a'] : ['#6fd04f', '#2f9a3f', '#17683a', '#9ee07a'];
  var front = B ? ['#d8f57a', '#86d84e', '#3da13a', '#e9ffa0'] : ['#a6ef6a', '#4fc24a', '#228a3c', '#d4ff9e'];
  palmTrunk(g, S, bx, by, cx, cy, bend, ['#cf9a60', '#98652f', '#5a381c']);
  var fb = B ? [[-2.85, 15, 6], [-2.1, 13, 3], [-1.05, 13, 3], [-0.3, 15, 6], [-1.57, 9, 1]] : [[-2.95, 17, 8], [-2.25, 14, 4], [-0.9, 14, 4], [-0.2, 17, 8], [-1.57, 10, 1]];
  var ff = B ? [[3.05, 16, 9], [2.45, 13, 9], [1.85, 9, 7], [1.3, 9, 7], [0.7, 13, 9], [0.1, 16, 9]] : [[3.1, 18, 10], [2.5, 15, 10], [1.85, 9, 7], [1.3, 9, 7], [0.65, 15, 10], [0.05, 18, 10]];
  fb.forEach(function (f) { frond(g, cx, cy, f[0], f[1], f[2], S, back, 5); });
  [[-3, 3], [1, 4], [4, 2]].forEach(function (p, n) {
    disc(g, cx + p[0], cy + p[1], 2, n === 1 ? '#7d4f28' : '#6b4423', S); PX(g, cx + p[0] - 1, cy + p[1] - 1, '#b98a52', S);
  });
  if (B) { for (k = 0; k < 6; k++) PX(g, cx - 5 + k % 3 * 2, cy + 6 + (k >> 1), k % 2 ? '#f08a2a' : '#d9641a', S); }
  ff.forEach(function (f) { frond(g, cx, cy, f[0], f[1], f[2], S, front, 6); });
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
  var SZ = kind === 3 ? 128 : 64, SH = SZ / 2, cv = mkCanvas(SZ, SH), c = cv[0], g = cv[1], R = rng([0, 11, 29, 53][kind]), n, w, x, y;
  function wr(a, b, ww, hh, col) { for (var ox = -SZ; ox <= 0; ox += SZ) for (var oy = -SH; oy <= 0; oy += SH) px(g, a + ox, b + oy, ww, hh, col); }
  if (kind === 1) {
    px(g, 0, 0, SZ, SH, '#22b8cc');
    for (n = 0; n < 7; n++) { w = 10 + Math.floor(R() * 14); wr(Math.floor(R() * SZ), Math.floor(R() * SH), w, 2, '#1fb0c6'); }
    for (n = 0; n < 11; n++) { w = 5 + Math.floor(R() * 8); x = Math.floor(R() * SZ); y = Math.floor(R() * SH); wr(x, y, w, 1, '#33c6d8'); wr(x + 1, y + 1, w - 2, 1, '#1aa8bf'); }
    for (n = 0; n < 14; n++) wr(Math.floor(R() * SZ), Math.floor(R() * SH), 1, 1, '#5ad6e3');
  } else if (kind === 2) {
    for (n = 0; n < 8; n++) { w = 3 + Math.floor(R() * 5); x = Math.floor(R() * SZ); y = Math.floor(R() * SH); wr(x, y, w, 1, 'rgba(255,255,255,0.5)'); wr(x + 1, y + 1, w - 2, 1, 'rgba(255,255,255,0.18)'); }
  } else {
    for (n = 0; n < 22; n++) {
      x = Math.floor(R() * SZ); y = Math.floor(R() * SH);
      wr(x + 1, y, 2, 1, 'rgba(215,255,255,0.38)'); wr(x, y + 1, 4, 1, 'rgba(215,255,255,0.38)'); wr(x + 1, y + 2, 2, 1, 'rgba(215,255,255,0.38)'); wr(x + 1, y + 1, 2, 1, 'rgba(255,255,255,0.6)');
    }
  }
  return c;
}
function makeDeep() {
  var cv = mkCanvas(128, 64), c = cv[0], g = cv[1];
  g.imageSmoothingEnabled = true;
  var gr = g.createRadialGradient(64, 32, 8, 64, 32, 74);
  gr.addColorStop(0, 'rgba(0,60,120,0)'); gr.addColorStop(0.5, 'rgba(0,60,120,0)'); gr.addColorStop(1, 'rgba(0,42,110,0.62)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 64);
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
  ell(g, 32, 12, 31, 11, 'rgba(6,40,56,0.09)', 1); ell(g, 32, 12, 26, 9, 'rgba(6,40,56,0.11)', 1);
  ell(g, 32, 12, 20, 7, 'rgba(6,40,56,0.13)', 1); ell(g, 32, 12, 13, 5, 'rgba(6,40,56,0.16)', 1);
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
/* ----- karakter pixel art ----- */
/* =====================================================================
   PULAU ORGANIK: garis pantai halus (bukan balok ubin), rumput berlapis,
   pasir basah, air dangkal turquoise, buih ombak beranimasi, jalan batu.
   Semua digambar pada resolusi "piksel seni" (1 piksel seni = 2 px dunia)
   supaya konsisten dengan sprite objek. Hanya visual: peta gameplay tidak berubah.
   ===================================================================== */
var AP = 2;                                   // 1 piksel seni = 2 px dunia
var COAST = 0.4;
function h2(ix, iy, s) {
  var n = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ Math.imul((s | 0) + 1, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function vn(x, y, s) {                         // value noise halus 0..1
  var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  var a = h2(ix, iy, s), b = h2(ix + 1, iy, s), c = h2(ix, iy + 1, s), d = h2(ix + 1, iy + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
function fbm(U, V, s, f1, f2, f3) {            // 3 oktaf, kisi diputar agar tidak terlihat kotak
  var r1 = vn((U * 0.80 - V * 0.60) * f1, (U * 0.60 + V * 0.80) * f1, s);
  var r2 = vn((U * 0.50 + V * 0.87) * f2 + 17, (-U * 0.87 + V * 0.50) * f2 + 9, s + 1);
  var r3 = vn((U * 0.96 - V * 0.28) * f3 + 5, (U * 0.28 + V * 0.96) * f3 + 31, s + 2);
  return r1 * 0.5 + r2 * 0.3 + r3 * 0.2;
}
var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function bay(x, y) { return (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16; }
function C32(hex, a) {
  var n = parseInt(hex.slice(1), 16);
  return (((a === undefined ? 255 : a) << 24) | ((n & 255) << 16) | (((n >> 8) & 255) << 8) | ((n >> 16) & 255)) >>> 0;
}
function pal32(list, a) { return list.map(function (c) { return C32(c, a); }); }

function makeIsland(map) {
  var T = map.T, RF = 8, NF = GRID * RF, i, j, a, b, k, q;
  var plx = map.stall.i + 1, ply = map.stall.j + 0.5;

  // ---- 1. medan darat / rumput (diburamkan => tepi membulat & organik) ----
  var FL = new Float32Array(NF * NF), FG = new Float32Array(NF * NF);
  for (b = 0; b < NF; b++) for (a = 0; a < NF; a++) {
    var tt = T[(b >> 3) * GRID + (a >> 3)];
    FL[b * NF + a] = (tt === SAND || tt === GRASS) ? 1 : 0;
    FG[b * NF + a] = tt === GRASS ? 1 : 0;
  }
  function blur(src, r) {
    var tmp = new Float32Array(NF * NF), w = 2 * r + 1, x, y, sum;
    for (y = 0; y < NF; y++) {
      sum = 0; for (x = -r; x <= r; x++) sum += (x >= 0 && x < NF) ? src[y * NF + x] : 0;
      for (x = 0; x < NF; x++) { tmp[y * NF + x] = sum / w; sum += (x + r + 1 < NF ? src[y * NF + x + r + 1] : 0) - (x - r >= 0 ? src[y * NF + x - r] : 0); }
    }
    var out = new Float32Array(NF * NF);
    for (x = 0; x < NF; x++) {
      sum = 0; for (y = -r; y <= r; y++) sum += (y >= 0 && y < NF) ? tmp[y * NF + x] : 0;
      for (y = 0; y < NF; y++) { out[y * NF + x] = sum / w; sum += (y + r + 1 < NF ? tmp[(y + r + 1) * NF + x] : 0) - (y - r >= 0 ? tmp[(y - r) * NF + x] : 0); }
    }
    return out;
  }
  FL = blur(blur(FL, 6), 6); FG = blur(blur(FG, 5), 5);

  var NC = new Float32Array(NF * NF), NG = new Float32Array(NF * NF), NS = new Float32Array(NF * NF), N2 = new Float32Array(NF * NF), FP = new Float32Array(NF * NF);
  var bx0 = C + 0.5, by0 = C + 0.5, dockX = map.dockStart - 0.5;
  for (b = 0; b < NF; b++) for (a = 0; a < NF; a++) {
    var U = (a + 0.5) / RF, V = (b + 0.5) / RF, n = b * NF + a;
    NC[n] = (fbm(U, V, 1, 0.42, 1.1, 2.7) - 0.5) * 0.34;
    FL[n] += NC[n] * Math.min(1, FL[n] * 3.0);
    NG[n] = fbm(U, V, 4, 0.33, 1.15, 3.1);
    NS[n] = fbm(U, V, 7, 0.5, 1.7, 4.2);
    N2[n] = fbm(U, V, 10, 1.2, 3.0, 6.5);
    var dpl = Math.max(1 - Math.hypot(U - plx, V - ply) / 2.15, 1 - segDist(U, V, plx, ply, bx0, by0) / 0.8, 1 - segDist(U, V, bx0, by0, dockX, by0) / 0.8);
    FP[n] = dpl + (fbm(U, V, 13, 1.6, 3.4, 6) - 0.5) * 0.45;
  }
  function sm(A, U, V) {
    var fx = U * RF - 0.5, fy = V * RF - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    var x1 = x0 + 1, y1 = y0 + 1;
    if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0; if (x1 < 0) x1 = 0; if (y1 < 0) y1 = 0;
    if (x0 >= NF) x0 = NF - 1; if (y0 >= NF) y0 = NF - 1; if (x1 >= NF) x1 = NF - 1; if (y1 >= NF) y1 = NF - 1;
    var a0 = A[y0 * NF + x0], b0 = A[y0 * NF + x1], c0 = A[y1 * NF + x0], d0 = A[y1 * NF + x1];
    return a0 + (b0 - a0) * tx + (c0 - a0) * ty + (a0 - b0 - c0 + d0) * tx * ty;
  }

  // ---- 2. kotak pembatas (hanya area dekat daratan yang dihitung) ----
  function isL(ti, tj) { return ti >= 0 && tj >= 0 && ti < GRID && tj < GRID && (T[tj * GRID + ti] === SAND || T[tj * GRID + ti] === GRASS); }
  var near = new Uint8Array(GRID * GRID), minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (j = 0; j < GRID; j++) for (i = 0; i < GRID; i++) {
    var nn = false;
    for (var dj = -5; dj <= 5 && !nn; dj++) for (var di = -5; di <= 5; di++) if (isL(i + di, j + dj)) { nn = true; break; }
    if (T[j * GRID + i] === DOCK) nn = true;
    if (!nn) continue;
    near[j * GRID + i] = 1;
    var sx0 = (i - j) * 32 + W / 2, sy0 = (i + j) * 16;
    if (sx0 - 40 < minX) minX = sx0 - 40; if (sx0 + 40 > maxX) maxX = sx0 + 40;
    if (sy0 - 24 < minY) minY = sy0 - 24; if (sy0 + 56 > maxY) maxY = sy0 + 56;
  }
  var ax0 = Math.floor(minX / AP), ay0 = Math.floor(minY / AP), aw = Math.ceil(maxX / AP) - ax0, ah = Math.ceil(maxY / AP) - ay0;

  // ---- 3. palet ----
  var GR = pal32(['#2a7a37', '#35903f', '#45a746', '#58bb4c', '#6fcf59', '#8ae26c']), GRRIM = C32('#25663a'), GRLIP = C32('#9ceb7c');
  var SD = pal32(['#fdf4d2', '#f7ebbe', '#efdfad', '#e5d19a', '#d8c188']);
  var WT = pal32(['#dcc590', '#d0b87f', '#c4aa72', '#b99f68']);
  var SH = [C32('#e6faef'), C32('#bcf3e2'), C32('#88e8de'), C32('#52d5e1'), C32('#2cbcda', 150)];
  var FOAM = C32('#ffffff'), FOAMD = C32('#ffffff', 150), FOAMF = C32('#ffffff', 235), FOAMT = C32('#ffffff', 110);
  var STN = pal32(['#e3d6b4', '#d9caa4', '#cfbf98', '#e8dcbd']), STH = C32('#f6edd2'), STL = C32('#a89874'), MORT = C32('#8f805f'), DIRT = C32('#8a7a58');

  var cvG = mkCanvas(aw, ah), cG = cvG[0], gG = cvG[1];
  var img = gG.createImageData(aw, ah), p32 = new Uint32Array(img.data.buffer);
  var cls = new Uint8Array(aw * ah);
  var FOFF = [0.03, 0.075, 0.12, 0.075], fimg = [], f32 = [], fcv = [];
  for (k = 0; k < 4; k++) { var fc = mkCanvas(aw, ah); fcv.push(fc); var fi = fc[1].createImageData(aw, ah); fimg.push(fi); f32.push(new Uint32Array(fi.data.buffer)); }

  // ---- 4. render per piksel ----
  var ax, ay;
  for (ay = 0; ay < ah; ay++) for (ax = 0; ax < aw; ax++) {
    var X = (ax0 + ax) * AP + 1, Y = (ay0 + ay) * AP + 1, aa = (X - W / 2) / 32, bb = Y / 16, U2 = (aa + bb) / 2, V2 = (bb - aa) / 2;
    var ti = Math.floor(U2), tj = Math.floor(V2);
    if (ti < 0 || tj < 0 || ti >= GRID || tj >= GRID || !near[tj * GRID + ti]) continue;
    var f = sm(FL, U2, V2), dd = COAST - f, idx = ay * aw + ax, bi = bay(ax, ay), hs = h2(ax0 + ax, ay0 + ay, 7), n2 = sm(N2, U2, V2), col = 0;

    if (dd >= 0) {                                              // ---------- air dangkal ----------
      if (dd > 0.4) continue;
      if (dd <= 0.24) {
        var tq = dd / 0.24 * 4, q0 = Math.floor(tq); q = q0 + ((tq - q0) > bi ? 1 : 0); if (q > 4) q = 4;
        col = SH[q];
        if (q <= 2 && hs > 0.992) col = FOAM;
      } else {
        if ((0.4 - dd) / 0.16 < bi) continue;
        col = SH[4];
      }
      var fw = 0.012 + n2 * 0.018;
      if (dd < fw) col = FOAM; else if (dd > 0.035 && dd < 0.075 && n2 > 0.6 && hs > 0.55) col = FOAMD;
      if (dd < 0.17) {
        for (k = 0; k < 4; k++) {
          var o = FOFF[k], hw = 0.013 * (0.6 + n2 * 1.1), dv = Math.abs(dd - o);
          if (dv < hw) f32[k][idx] = FOAMF;
          else if (Math.abs(dd - (o + 0.05)) < hw * 0.6 && hs > 0.45) f32[k][idx] = FOAMT;
        }
      }
      cls[idx] = 5; p32[idx] = col; continue;
    }

    // ---------- darat ----------
    var d = -dd, gg = sm(FG, U2, V2) + (n2 - 0.5) * 0.2, grass = gg > 0.5 && d > 0.15;
    if (grass) {
      var fp = sm(FP, U2, V2);
      if (fp > 0.0) {                                           // jalan batu
        if (fp < 0.1) { col = DIRT; if (hs > 0.55) col = MORT; }
        else {
          var s = U2 * 3.2, t2 = V2 * 3.2, row = Math.floor(t2), s2 = s + (row & 1) * 0.5 + h2(row, 3, 3) * 0.5, cell = Math.floor(s2), fu = s2 - cell, fv = t2 - row;
          var inS = fu > 0.1 && fu < 0.92 && fv > 0.12 && fv < 0.9 && !((fu < 0.2 || fu > 0.82) && (fv < 0.22 || fv > 0.8));
          if (inS) { col = STN[(h2(cell, row, 9) * 4) | 0]; if (fu < 0.28 || fv < 0.26) col = STH; else if (fu > 0.76 || fv > 0.76) col = STL; }
          else col = MORT;
        }
        cls[idx] = 4; p32[idx] = col; continue;
      }
      var tone = (sm(NG, U2, V2) - 0.5) * 1.35 + 0.52 + (h2((ax0 + ax) >> 1, (ay0 + ay) >> 1, 8) - 0.5) * 0.2 + (hs - 0.5) * 0.1;
      var tl = Math.max(0, Math.min(1, tone)) * 5, q1 = Math.floor(tl); q = q1 + ((tl - q1) > bi ? 1 : 0); if (q > 5) q = 5;
      col = GR[q];
      if (gg < 0.53) col = (gg < 0.515) ? GRRIM : GR[Math.max(0, q - 1)];
      else if (gg < 0.56 && (ax + ay) % 3 === 0) col = GRLIP;
      cls[idx] = 1; p32[idx] = col; continue;
    }
    // pasir
    var wetW = 0.07 + (n2 - 0.5) * 0.05;
    if (d < wetW) {                                             // pasir basah, makin gelap dekat air
      var tw = (1 - d / wetW) * 3, w0 = Math.floor(tw); q = w0 + ((tw - w0) > bi ? 1 : 0); if (q > 3) q = 3;
      col = WT[q]; cls[idx] = 3;
      if (d < 0.006 + n2 * 0.012) col = FOAM;
      else if (hs > 0.992) col = SD[0];
    } else {
      var ts = (sm(NS, U2, V2) - 0.5) * 1.5 + 0.5 + (h2((ax0 + ax) >> 1, (ay0 + ay) >> 1, 8) - 0.5) * 0.14 + (hs - 0.5) * 0.06, ls = Math.max(0, Math.min(1, ts)) * 4, s0 = Math.floor(ls);
      q = s0 + ((ls - s0) > bi ? 1 : 0); if (q > 4) q = 4;
      var rip = Math.sin((U2 * 1.15 + V2 * 0.45) * 24 + sm(NS, U2, V2) * 7);
      if (rip > 0.95) q = Math.max(0, q - 1); else if (rip < -0.96) q = Math.min(4, q + 1);
      if (gg > 0.44 && gg <= 0.5 && bi < (gg - 0.44) / 0.06 * 0.7 && d > 0.15) col = GR[2 + ((ax + ay) & 1)];   // rumput menjalar ke pasir
      else col = SD[q];
      cls[idx] = 2;
    }
    p32[idx] = col;
  }
  gG.putImageData(img, 0, 0);
  var foamC = [];
  for (k = 0; k < 4; k++) { fcv[k][1].putImageData(fimg[k], 0, 0); foamC.push(fcv[k][0]); }

  // ---- 5. detail kecil (rumput, bunga, kerang, dll.) ----
  function A(x, y, w, h, col) { gG.fillStyle = col; gG.fillRect(x, y, w, h); }
  var FLC = ['#ff7aa8', '#ffe36a', '#ffffff', '#9ad0ff', '#ff9a4a', '#d79bff'];
  function tuft(x, y, r) {
    var kind = (r * 3) | 0, lt = r > 0.5;
    if (kind === 0) { A(x - 1, y - 2, 1, 3, '#2f8a3a'); A(x, y - 3, 1, 4, lt ? '#a0ee78' : '#74d15a'); A(x + 1, y - 2, 1, 3, '#47ab46'); A(x + 1, y - 3, 1, 1, '#8ae26c'); }
    else if (kind === 1) { A(x - 2, y - 1, 1, 2, '#2f8a3a'); A(x - 1, y - 3, 1, 4, '#5bbf4d'); A(x, y - 4, 1, 5, '#9ceb7c'); A(x + 1, y - 3, 1, 4, '#47ab46'); A(x + 2, y - 2, 1, 3, '#74d15a'); A(x - 1, y - 4, 1, 1, '#9ceb7c'); }
    else { A(x - 1, y - 1, 1, 2, '#3a9a42'); A(x, y - 2, 1, 3, '#74d15a'); A(x + 1, y - 1, 1, 2, '#2f8a3a'); A(x + 2, y - 3, 1, 1, '#a0ee78'); A(x + 1, y - 2, 1, 1, '#5bbf4d'); }
    A(x - 2, y + 1, 5, 1, 'rgba(20,70,40,0.3)');
  }
  function flower(x, y, c) {
    A(x, y, 1, 3, '#2a7a37'); A(x - 1, y + 1, 1, 1, '#3f9a45');
    A(x, y - 2, 1, 1, c); A(x - 1, y - 1, 3, 1, c); A(x, y, 1, 1, c); A(x, y - 1, 1, 1, '#ffe36a');
    A(x - 1, y - 1, 1, 1, '#ffffff');
  }
  function clover(x, y) { A(x - 1, y, 1, 1, '#3cb25a'); A(x + 1, y, 1, 1, '#3cb25a'); A(x, y - 1, 1, 1, '#4ec86a'); A(x, y, 1, 1, '#2f9a4a'); A(x, y + 1, 1, 1, '#2a7a37'); }
  function sprout(x, y) { A(x, y - 1, 1, 3, '#2a7a37'); A(x - 2, y - 2, 2, 1, '#6fd25a'); A(x + 1, y - 3, 2, 1, '#8ae26c'); A(x - 1, y - 1, 1, 1, '#4ec86a'); A(x + 1, y - 2, 1, 1, '#4ec86a'); }
  function fern(x, y) { var m; for (m = 0; m < 5; m++) { A(x - 2 + m, y - Math.abs(m - 2) + 1 - (m === 2 ? 1 : 0), 1, 1, '#2f8a3a'); A(x - 2 + m, y - Math.abs(m - 2) + 2, 1, 1, '#5bbf4d'); } A(x, y - 2, 1, 1, '#8ae26c'); }
  function pebble(x, y, sandy) { A(x, y, 3, 2, sandy ? '#a8998a' : '#8a949e'); A(x, y, 2, 1, sandy ? '#d6cdbd' : '#c3ccd5'); A(x + 1, y + 2, 3, 1, 'rgba(60,50,30,0.3)'); }
  function shell(x, y, c) { A(x, y, 3, 2, c); A(x, y, 1, 1, '#ffffff'); A(x + 1, y + 2, 2, 1, 'rgba(120,90,50,0.3)'); A(x + 2, y, 1, 1, '#d99aa8'); }
  function star(x, y) { A(x + 1, y - 1, 1, 1, '#ff7a4a'); A(x - 1, y, 5, 1, '#ff7a4a'); A(x, y + 1, 3, 1, '#ff9a6a'); A(x, y + 2, 1, 1, '#ff7a4a'); A(x + 2, y + 2, 1, 1, '#ff7a4a'); A(x + 1, y, 1, 1, '#ffd0a0'); }
  function wood(x, y) { A(x, y, 8, 2, '#8a6a42'); A(x, y, 8, 1, '#b99468'); A(x + 2, y - 1, 2, 1, '#8a6a42'); A(x + 6, y + 2, 2, 1, 'rgba(100,80,40,0.3)'); A(x + 7, y, 1, 1, '#d9c8a0'); }
  function weed(x, y) { A(x, y, 1, 3, '#3f7a3a'); A(x + 1, y - 1, 1, 2, '#5aa04a'); A(x - 1, y + 1, 1, 2, '#2f6a32'); }
  var st = 7, cx, cy, gx, gy, c1, r, jx, jy;
  for (cy = 3; cy < ah - 3; cy += st) for (cx = 3; cx < aw - 3; cx += st) {
    gx = ax0 + cx; gy = ay0 + cy;
    jx = cx + ((h2(gx, gy, 21) * st) | 0) - 2; jy = cy + ((h2(gx, gy, 22) * st) | 0) - 2;
    if (jx < 4 || jy < 4 || jx >= aw - 4 || jy >= ah - 4) continue;
    c1 = cls[jy * aw + jx];
    if (!c1 || c1 === 4 || c1 === 5) continue;
    if (cls[(jy + 2) * aw + jx] !== c1 || cls[(jy - 3) * aw + jx] !== c1 || cls[jy * aw + jx + 3] !== c1 || cls[jy * aw + jx - 3] !== c1) continue;
    r = h2(gx, gy, 23);
    if (c1 === 1) {
      if (r < 0.36) tuft(jx, jy, h2(gx, gy, 24));
      else if (r < 0.46) flower(jx, jy, FLC[(h2(gx, gy, 25) * FLC.length) | 0]);
      else if (r < 0.52) clover(jx, jy);
      else if (r < 0.58) sprout(jx, jy);
      else if (r < 0.61) fern(jx, jy);
      else if (r < 0.635) pebble(jx, jy, false);
    } else if (c1 === 2) {
      if (r < 0.07) shell(jx, jy, h2(gx, gy, 26) < 0.5 ? '#fff4f0' : '#ffe0d0');
      else if (r < 0.078 && h2(gx, gy, 27) < 0.4) star(jx, jy);
      else if (r < 0.13) pebble(jx, jy, true);
      else if (r < 0.14) wood(jx - 3, jy);
    } else if (c1 === 3 && r < 0.18) weed(jx, jy);
  }

  // ---- 6. dermaga kayu (di atas air, dengan bayangan lembut) ----
  var ED = ELEV_DOCK / AP;
  function dia(cx2, top2, col) {                      // diamond 32x16 (piksel seni)
    gG.fillStyle = col;
    for (var y = 0; y < 16; y++) { var hw = y < 8 ? 2 * y + 2 : 2 * (15 - y) + 2; gG.fillRect(cx2 - hw, top2 + y, hw * 2, 1); }
  }
  function tileXY(ti2, tj2) { return [((ti2 - tj2) * 32 + W / 2) / AP - ax0, ((ti2 + tj2) * 16) / AP - ay0]; }
  var docks = [];
  for (j = 0; j < GRID; j++) for (i = 0; i < GRID; i++) if (T[j * GRID + i] === DOCK) docks.push([i, j]);
  gG.globalAlpha = 0.32;
  docks.forEach(function (d2) { var p = tileXY(d2[0], d2[1]); dia(p[0] + 4, p[1] + 5, '#04466c'); });
  gG.globalAlpha = 1;
  function isDock(ti2, tj2) { return ti2 >= 0 && tj2 >= 0 && ti2 < GRID && tj2 < GRID && T[tj2 * GRID + ti2] === DOCK; }
  var plankC = ['#c9995c', '#bd8e55', '#d3a366', '#b2834d'];
  docks.sort(function (m, n3) { return (m[0] + m[1]) - (n3[0] + n3[1]); }).forEach(function (d2) {
    var ti2 = d2[0], tj2 = d2[1], p = tileXY(ti2, tj2), cx2 = p[0], top2 = p[1] - ED, x, y2, k2;
    if (!isDock(ti2 + 1, tj2)) for (k2 = 0; k2 < 16; k2++) { var yy = top2 + 15 - (k2 >> 1); gG.fillStyle = k2 % 4 === 0 ? '#3b2810' : '#6b4a26'; gG.fillRect(cx2 + k2, yy, 1, 3 + ED); gG.fillStyle = '#d9a96a'; gG.fillRect(cx2 + k2, yy, 1, 1); }
    if (!isDock(ti2, tj2 + 1)) for (k2 = 0; k2 < 16; k2++) { var yl = top2 + 15 - (k2 >> 1); gG.fillStyle = k2 % 4 === 0 ? '#2a1c0a' : '#4f3719'; gG.fillRect(cx2 - 1 - k2, yl, 1, 3 + ED); gG.fillStyle = '#b98a50'; gG.fillRect(cx2 - 1 - k2, yl, 1, 1); }
    for (y2 = 0; y2 < 16; y2++) {
      var hw2 = y2 < 8 ? 2 * y2 + 2 : 2 * (15 - y2) + 2;
      for (x = -hw2; x < hw2; x++) {
        var u = ((y2 + 0.5) / 8 + (x + 0.5) / 16) / 2; if (u < 0) u = 0; if (u > 0.999) u = 0.999;
        var pu = Math.floor(u * 16), pl = pu >> 2, sub = pu & 3, cc;
        if (sub === 0) cc = '#6b4824'; else if (sub === 1) cc = '#e3b57a'; else cc = plankC[Math.floor(h2(ti2, tj2, pl + 31) * 4)];
        if (sub > 1 && h2(ti2 * 64 + x, tj2 * 64 + y2, 5) < 0.06) cc = '#8f6234';
        gG.fillStyle = cc; gG.fillRect(cx2 + x, top2 + y2, 1, 1);
      }
    }
  });
  docks.forEach(function (d2) {
    var ti2 = d2[0], tj2 = d2[1], p = tileXY(ti2, tj2), cx2 = p[0], top2 = p[1] - ED;
    function post(vx, vy) {
      gG.fillStyle = '#5a3b1c'; gG.fillRect(vx - 1, vy - 7, 2, 9 + ED); gG.fillStyle = '#8a5d30'; gG.fillRect(vx - 1, vy - 7, 1, 9 + ED);
      gG.fillStyle = '#d9a96a'; gG.fillRect(vx - 1, vy - 8, 2, 1); gG.fillStyle = '#e8d6a0'; gG.fillRect(vx - 1, vy - 4, 2, 1); gG.fillStyle = '#b89a60'; gG.fillRect(vx - 1, vy - 3, 2, 1);
    }
    if (!isDock(ti2, tj2 + 1) && ti2 % 2 === 0) post(cx2 - 15, top2 + 8);
    if (!isDock(ti2 + 1, tj2) && tj2 % 2 === 1) post(cx2 + 15, top2 + 8);
    if (!isDock(ti2, tj2 + 1) && !isDock(ti2 + 1, tj2)) post(cx2, top2 + 16);
  });

  foamC.forEach(function (fcn) {
    var fg = fcn.getContext('2d');
    docks.forEach(function (d2) {
      var p = tileXY(d2[0], d2[1]), cx2 = p[0], top2 = p[1] - ED;
      for (var y = -1; y < 20; y++) { var hw = y < 0 ? 0 : (y < 8 ? 2 * y + 2 : (y < 16 ? 2 * (15 - y) + 2 : 16)); if (hw) fg.clearRect(cx2 - hw - 1, top2 + y, hw * 2 + 2, 1); }
    });
  });
  return { ground: cG, foam: foamC, x: ax0 * AP, y: ay0 * AP, w: aw, h: ah };
}

/* =====================================================================
   KARAKTER: rig piksel-seni (kepala, badan, lengan, kaki) + animasi:
   idle, walk, run, fish (memegang joran), cast (melempar), pull (menarik), catch (merayakan).
   Sel 20x32 piksel seni (x2 = 40x64 px). Lengan/kaki digambar sebagai tulang sehingga
   semua pose konsisten di tiap arah. Pandangan: F0/F1 (depan), B0/B1 (belakang), S (samping).
   ===================================================================== */
var HC_W = 20, HC_H = 32, HC_YOFF = 1, HC_FOOT = 30;      // HC_FOOT = baris dasar sol sepatu (untuk origin sprite)
var PAL_PLAYER = {
  skin: ['#ffe2bd', '#f2c28b', '#d9a06c'], shirt: ['#ffffff', '#f4f6f9', '#cdd5e1'], fold: '#b6c0d0', stitch: '#aeb8c8',
  pants: ['#4d5264', '#2c2f3a', '#171920'], shoe: ['#575b6c', '#16171d', '#0a0a0d'], sole: '#e8ebf2',
  hair: '#17181e', hairHi: '#4a5064', hairMid: '#272a35', belt: '#0c0c0f', buckle: '#d4bf72', hat: 'none', mouth: '#b5655a'
};
var PAL_NPC = {
  skin: ['#e8a878', '#c98a5a', '#a86c42'], shirt: ['#3fd0bf', '#1fb5a5', '#128a7e'], fold: '#0f7a70', stitch: '#0f7a70',
  pants: ['#936a40', '#7a5230', '#5a3a20'], shoe: ['#4a3a2a', '#2a1d12', '#160f08'], sole: '#c9b79a',
  hair: '#2e2e2e', hairHi: '#585858', hairMid: '#3c3c3c', belt: '#3a2614', buckle: '#d4bf72', hat: 'cap', apron: true, mouth: '#8a3a30'
};

function limb(R, x0, y0, x1, y1, w, c) {                  // c = [terang, utama, gelap]; 3 lintasan agar shading rapi
  var n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2)), k, x, y, hw = w / 2;
  for (k = 0; k <= n; k++) { x = x0 + (x1 - x0) * k / n; y = y0 + (y1 - y0) * k / n; R(Math.round(x - hw) + 1, Math.round(y - hw) + 1, w, w, c[2]); }
  for (k = 0; k <= n; k++) { x = x0 + (x1 - x0) * k / n; y = y0 + (y1 - y0) * k / n; R(Math.round(x - hw), Math.round(y - hw), w, w, c[1]); }
  if (w > 2) for (k = 0; k <= n; k++) { x = x0 + (x1 - x0) * k / n; y = y0 + (y1 - y0) * k / n; R(Math.round(x - hw), Math.round(y - hw), w - 1, w - 1, c[0]); }
}
function darker(hex, f) {
  var n = parseInt(hex.slice(1), 16), r = Math.round((n >> 16) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
function darkPal(c, f) { return [darker(c[0], f), darker(c[1], f), darker(c[2], f)]; }

/* parameter pose per frame: by(naik-turun badan), lean, n/f = [sudut bahu, sudut siku] lengan dekat/jauh,
   ln/lf = [sudut, angkat] kaki dekat/jauh, rod = sudut joran (rad), blink, mouth */
function heroPose(anim, k) {
  var item = null;
  if (/^[rf](idle|walk|run)$/.test(anim)) { item = anim[0]; anim = anim.slice(1); }
  var P = { by: 0, lean: 0, na: [0.05, 0.2], fa: [-0.05, 0.15], ln: [0, 0], lf: [0, 0], blink: false, mouth: 'smile', rod: null }, ph, s, c;
  if (anim === 'idle') {
    P.by = [0, 0, 1, 1][k]; P.na = [0.06 + (k > 1 ? 0.04 : 0), 0.22]; P.fa = [-0.06, 0.16]; P.blink = k === 3;
  } else if (anim === 'walk' || anim === 'run') {
    var run = anim === 'run'; ph = k / 6 * Math.PI * 2; s = Math.sin(ph); c = Math.cos(ph);
    var amp = run ? 0.95 : 0.5, lift = run ? 3.6 : 1.5;
    P.ln = [s * amp, Math.max(0, c) * lift]; P.lf = [-s * amp, Math.max(0, -c) * lift];
    if (run) {
      P.by = (Math.abs(s) > 0.7) ? 0 : -1; P.lean = 1;
      P.na = [-s * 1.0 + 0.2, -s * 1.0 + 1.55]; P.fa = [s * 1.0 + 0.2, s * 1.0 + 1.55];
    } else {
      P.by = (Math.abs(s) > 0.75) ? 1 : 0;
      P.na = [-s * 0.5, -s * 0.5 + 0.3]; P.fa = [s * 0.5, s * 0.5 + 0.3];
    }
  } else if (anim === 'fish') {
    P.by = k; P.na = [0.55, 1.1]; P.fa = [0.35, 1.0]; P.rod = k ? -0.85 : -0.95; P.lean = 0;
  } else if (anim === 'cast') {
    var T = [
      { na: [-2.3, -2.7], fa: [-2.0, -2.5], lean: -1, rod: -2.35, by: 0 },
      { na: [-1.0, -0.6], fa: [-0.8, -0.5], lean: 0, rod: -1.5, by: 1 },
      { na: [1.15, 1.5], fa: [1.0, 1.3], lean: 1, rod: -0.55, by: 1 },
      { na: [0.85, 1.2], fa: [0.7, 1.1], lean: 1, rod: -0.4, by: 0 }
    ][k];
    P.na = T.na; P.fa = T.fa; P.lean = T.lean; P.rod = T.rod; P.by = T.by;
    P.ln = [k === 0 ? -0.25 : 0.2, 0]; P.lf = [k === 0 ? 0.25 : -0.15, 0];
  } else if (anim === 'pull') {
    P.na = [k ? 0.5 : 0.1, k ? 1.0 : 1.6]; P.fa = [k ? 0.35 : 0.0, k ? 0.9 : 1.5]; P.rod = k ? -0.7 : -1.25; P.lean = k ? 0 : -1; P.by = k ? 0 : 1;
    P.ln = [-0.2, 0]; P.lf = [0.25, 0]; P.mouth = 'o';
  } else if (anim === 'catch') {
    P.na = [-2.6 + k * 0.15, -2.8 + k * 0.1]; P.fa = [-2.5 + k * 0.15, -2.7 + k * 0.1]; P.by = k === 0 ? -1 : (k === 1 ? 0 : 0); P.mouth = 'open';
    P.ln = [0, k === 0 ? 2 : 0]; P.lf = [0, k === 0 ? 2 : 0];
  }
  if (item === 'r') {                                      // membawa joran: lengan dekat memegang gagang, joran miring ke depan-atas
    P.na = [0.42, 0.95]; P.rod = -1.12 + (anim === 'idle' ? (k > 1 ? 0.03 : 0) : Math.sin(k / 6 * Math.PI * 2) * 0.05);
  } else if (item === 'f') {                               // memegang ikan: dua tangan diangkat ke atas kepala (pose sama dengan saat menangkap)
    P.na = [-2.6, -2.8]; P.fa = [-2.5, -2.7]; P.rod = null;
  }
  return P;
}
var HERO_ANIMS = [['idle', 4], ['walk', 6], ['run', 6], ['fish', 2], ['cast', 4], ['pull', 2], ['catch', 3],
  ['ridle', 4], ['rwalk', 6], ['rrun', 6], ['fidle', 4], ['fwalk', 6], ['frun', 6]];
var HERO_VIEWS = ['F0', 'F1', 'B0', 'B1', 'S'];
var IDLE_SEQ = [0, 0, 1, 1, 2, 2, 3, 2, 2, 1, 1, 0];

function drawHeroCell(g, ox, oy, view, P, pal) {
  function R(x, y, w, h, col) { g.fillStyle = col; g.fillRect(ox + x * 2, oy + (y + HC_YOFF) * 2, w * 2, h * 2); }
  var by = P.by, lean = P.lean, fb = view !== 'S', back = view[0] === 'B', s = view === 'F1' || view === 'B1' ? 1 : 0;
  var out = { hand: [10, 16] };
  var skin = pal.skin, shirt = pal.shirt, pants = pal.pants, shoe = pal.shoe;
  var i, x, y;

  function shoeAt(fx, fy, dir, c) {                                    // sepatu dengan sol putih
    if (dir === 0) { R(fx - 2, fy, 5, 2, c[1]); R(fx - 2, fy, 2, 1, c[0]); R(fx + 1, fy + 1, 2, 1, c[2]); R(fx - 2, fy + 2, 5, 1, pal.sole); R(fx, fy, 1, 1, '#dfe4ee'); }
    else { R(fx - 2, fy, 6, 2, c[1]); R(fx - 2, fy, 3, 1, c[0]); R(fx + 2, fy, 2, 2, c[2]); R(fx - 2, fy + 2, 6, 1, pal.sole); R(fx + 1, fy, 2, 1, '#dfe4ee'); R(fx, fy + 1, 1, 1, c[2]); }
  }
  function head() {
    var hy = by;                                                        // posisi vertikal kepala ikut bob
    var hair = pal.hair, hhi = pal.hairHi, hmid = pal.hairMid;
    if (view === 'S') {
      var hx = lean;
      R(hx + 8, 10 + hy, 3, 2, skin[2]);                                  // leher
      R(hx + 8, 4 + hy, 7, 6, skin[1]); R(hx + 9, 10 + hy, 5, 1, skin[2]);   // wajah + dagu
      R(hx + 14, 8 + hy, 2, 1, skin[1]); R(hx + 14, 9 + hy, 1, 1, skin[2]); // hidung
      R(hx + 8, 4 + hy, 1, 5, skin[0]); R(hx + 9, 4 + hy, 5, 1, skin[2]);
      R(hx + 15, 8 + hy, 1, 1, skin[0]); R(hx + 14, 7 + hy, 1, 1, skin[0]);                                   // sorot hidung
      R(hx + 13, 10 + hy, 2, 1, pal.mouth); R(hx + 13, 11 + hy, 1, 1, skin[2]);                              // mulut + dagu
      R(hx + 12, 9 + hy, 1, 1, '#f7b3a0');                                                                   // pipi
      if (P.blink) R(hx + 12, 8 + hy, 2, 1, '#1b1b25');
      else { R(hx + 12, 7 + hy, 2, 2, '#1b1b25'); R(hx + 12, 7 + hy, 1, 1, '#ffffff'); R(hx + 13, 8 + hy, 1, 1, '#3b4f7a'); }   // mata + iris
      R(hx + 11, 6 + hy, 3, 1, hair);                                                                        // alis
      if (pal.hat === 'cap') {
        R(hx + 6, 1 + hy, 8, 3, '#d62828'); R(hx + 7, 0 + hy, 6, 1, '#d62828'); R(hx + 6, 1 + hy, 3, 1, '#ef4a4a'); R(hx + 12, 3 + hy, 5, 1, '#9d1c1c'); R(hx + 6, 3 + hy, 6, 1, '#9d1c1c');
        R(hx + 5, 4 + hy, 3, 5, hair);
      } else {
        R(hx + 7, 0 + hy, 5, 1, hair); R(hx + 6, 1 + hy, 8, 1, hair); R(hx + 5, 2 + hy, 10, 1, hair);
        R(hx + 5, 3 + hy, 11, 1, hair);                                                                      // poni menutup dahi sampai depan
        R(hx + 10, 4 + hy, 5, 1, hair); R(hx + 14, 5 + hy, 1, 1, hair); R(hx + 9, 4 + hy, 1, 2, hair);    // poni jatuh + cambang
        R(hx + 5, 4 + hy, 4, 6, hair); R(hx + 6, 10 + hy, 3, 1, hair); R(hx + 6, 11 + hy, 2, 1, hair);   // rambut belakang sampai tengkuk
        R(hx + 8, 0 + hy, 2, 1, hhi); R(hx + 7, 1 + hy, 3, 1, hhi); R(hx + 11, 2 + hy, 3, 1, hhi); R(hx + 6, 2 + hy, 1, 1, hhi);
        R(hx + 6, 6 + hy, 1, 3, hmid); R(hx + 9, 3 + hy, 2, 1, hmid); R(hx + 13, 3 + hy, 2, 1, hmid); R(hx + 12, 4 + hy, 1, 1, hmid); R(hx + 5, 8 + hy, 1, 2, hmid);
      }
      R(hx + 9, 6 + hy, 2, 2, skin[1]); R(hx + 9, 6 + hy, 1, 1, skin[0]); R(hx + 10, 7 + hy, 1, 1, skin[2]);   // telinga (di atas rambut)
    } else if (back) {
      var sx = s;
      R(9, 10 + hy, 2, 2, skin[2]);
      R(4, 6 + hy, 1, 2, skin[1]); R(15, 6 + hy, 1, 2, skin[2]);
      if (pal.hat === 'cap') {
        R(5, 1 + hy, 10, 9, hair); R(5, 1 + hy, 10, 4, '#d62828'); R(6, 0 + hy, 8, 1, '#d62828'); R(5, 1 + hy, 4, 1, '#ef4a4a');
      } else {
        R(7, 1 + hy, 6, 1, hair); R(6, 2 + hy, 8, 1, hair); R(5, 3 + hy, 10, 6, hair); R(6, 9 + hy, 8, 1, hair); R(7, 10 + hy, 6, 1, hair);
        R(8, 0 + hy, 4, 1, hair); R(9, 0 + hy, 2, 1, hhi); R(9, 11 + hy, 2, 1, hair);
        R(7, 2 + hy, 3, 1, hhi); R(6, 3 + hy, 2, 1, hhi); R(8, 5 + hy, 1, 3, hmid); R(11, 4 + hy, 1, 4, hmid); R(9, 8 + hy, 3, 1, hmid); R(13, 4 + hy, 1, 4, '#0d0e12');
        R(9, 3 + hy, 2, 1, hhi); R(10, 4 + hy, 1, 1, hhi); R(7, 6 + hy, 1, 2, hhi); R(12, 7 + hy, 1, 2, hmid); R(6, 9 + hy, 2, 1, hmid);   // pusaran rambut + helaian
      }
    } else {                                                           // depan
      var o = s;                                                       // pergeseran fitur saat menoleh
      R(9, 10 + hy, 2, 2, skin[2]);
      R(4, 6 + hy, 1, 2, skin[1]); R(15, 6 + hy, 1, 2, skin[2]); R(4, 6 + hy, 1, 1, skin[0]); R(4, 7 + hy, 1, 1, skin[2]); R(15, 7 + hy, 1, 1, darker(skin[2], 0.85));
      R(5, 4 + hy, 10, 7, skin[1]); R(6, 11 + hy, 8, 0, skin[1]);
      R(5, 4 + hy, 1, 6, skin[0]); R(14, 4 + hy, 1, 6, skin[2]); R(6, 10 + hy, 8, 1, skin[2]);
      R(6, 4 + hy, 8, 1, skin[2]);                                      // bayangan poni di dahi
      var ex = 7 + o;
      R(ex, 5 + hy, 2, 1, hair); R(ex + 4, 5 + hy, 2, 1, hair);        // alis
      if (P.blink) { R(ex, 8 + hy, 2, 1, '#1b1b25'); R(ex + 4, 8 + hy, 2, 1, '#1b1b25'); }
      else { R(ex, 7 + hy, 2, 2, '#1b1b25'); R(ex + 4, 7 + hy, 2, 2, '#1b1b25'); R(ex, 7 + hy, 1, 1, '#ffffff'); R(ex + 4, 7 + hy, 1, 1, '#ffffff'); }
      R(6 + o, 7 + hy, 1, 1, skin[2]); R(13 + o, 7 + hy, 1, 1, skin[2]);   // bayangan kelopak
      R(9 + o, 8 + hy, 1, 1, skin[0]); R(9 + o, 9 + hy, 1, 1, skin[2]);    // hidung (sorot + bayangan)
      if (P.mouth === 'open') { R(8 + o, 10 + hy, 3, 1, '#7a2a24'); R(9 + o, 10 + hy, 1, 1, '#e8806f'); }
      else if (P.mouth === 'o') R(9 + o, 10 + hy, 2, 1, '#7a2a24');
      else { R(9 + o, 10 + hy, 2, 1, pal.mouth); }
      R(6 + o, 9 + hy, 2, 1, '#f7b3a0'); R(12 + o, 9 + hy, 2, 1, '#f7b3a0');   // pipi
      if (pal.hat === 'cap') {
        R(5, 1 + hy, 10, 3, '#d62828'); R(6, 0 + hy, 8, 1, '#d62828'); R(5, 1 + hy, 4, 1, '#ef4a4a'); R(5, 3 + hy, 10, 1, '#9d1c1c'); R(4 + o, 4 + hy, 12, 1, '#7a1414');
        R(5, 4 + hy, 1, 3, hair); R(14, 4 + hy, 1, 3, hair);
      } else {
        R(7, 1 + hy, 6, 1, hair); R(6, 2 + hy, 8, 1, hair); R(5, 3 + hy, 10, 1, hair);
        R(5, 4 + hy, 3, 1, hair); R(12, 4 + hy, 3, 1, hair); R(8, 4 + hy, 1, 1, hair); R(11, 4 + hy, 1, 1, hair);
        R(5, 5 + hy, 1, 3, hair); R(14, 5 + hy, 1, 3, hair);
        R(8, 0 + hy, 4, 1, hair); R(9, 0 + hy, 2, 1, hhi); R(6, 3 + hy, 1, 1, hmid); R(5, 8 + hy, 1, 1, hmid); R(14, 8 + hy, 1, 1, hmid);   // volume atas + helaian samping
        R(7, 1 + hy, 3, 1, hhi); R(6, 2 + hy, 2, 1, hhi); R(11, 2 + hy, 2, 1, hhi); R(9, 3 + hy, 2, 1, hmid); R(13, 4 + hy, 1, 1, hmid); R(7, 4 + hy, 1, 1, hhi); R(12, 4 + hy, 1, 1, hhi);
      }
    }
  }

  // ---------- kaki ----------
  if (view === 'S') {
    var hipx = 10 + lean, hipy = 20 + by, L1 = 5.2;
    var legs = [[P.lf, darkPal(pants, 0.82), darkPal(shoe, 0.9)], [P.ln, pants, shoe]];
    legs.forEach(function (lg) {
      var a = lg[0][0], lf = lg[0][1], fx = hipx + Math.sin(a) * L1, fy = hipy + Math.cos(a) * L1 - lf;
      limb(R, hipx, hipy, fx, fy, 3, lg[1]);
      shoeAt(Math.round(fx), Math.round(fy) + 1, 1, lg[2]);
    });
  } else {
    [[7.5, P.lf, darkPal(pants, 0.88), darkPal(shoe, 0.92)], [12.5, P.ln, pants, shoe]].forEach(function (lg) {
      var lf = lg[1][1], fx = lg[0], fy = 25 - lf + (by > 0 ? 0 : 0);
      limb(R, lg[0], 20 + by, fx, fy, 3, lg[2]);
      shoeAt(Math.round(fx), Math.round(fy) + 1, 0, lg[3]);
    });
  }

  // ---------- lengan jauh (di belakang badan) ----------
  function arm(sh, a1, a2, side, sleeve, skn, front) {
    var e, h;
    if (view === 'S') {
      e = [sh[0] + Math.sin(a1) * 3.4, sh[1] + Math.cos(a1) * 3.4]; h = [e[0] + Math.sin(a2) * 3.4, e[1] + Math.cos(a2) * 3.4];
    } else {
      e = [sh[0] + side * (0.4 + Math.abs(Math.sin(a1)) * 1.8), sh[1] + Math.cos(a1) * 3.4];
      h = [e[0] + side * Math.abs(Math.sin(a2)) * 1.4, e[1] + Math.cos(a2) * 3.4];
    }
    limb(R, e[0], e[1], h[0], h[1], 2, skn);                              // lengan bawah
    limb(R, sh[0], sh[1], e[0], e[1], 3, sleeve);                          // lengan atas (kaus pendek)
    R(Math.round(e[0] - 1), Math.round(e[1]), 3, 1, sleeve[2]);            // lipatan ujung lengan baju
    R(Math.round(h[0] - 1), Math.round(h[1]), 2, 2, skn[1]); R(Math.round(h[0] - 1), Math.round(h[1]), 1, 1, skn[0]); R(Math.round(h[0]), Math.round(h[1]) + 1, 1, 1, skn[2]);
    return h;
  }
  var shL, shR, shN, shF;
  if (view === 'S') {
    shF = [10 + lean, 13 + by]; shN = [10 + lean, 13 + by];
    arm(shF, P.fa[0], P.fa[1], 1, darkPal(shirt, 0.86), darkPal(skin, 0.88), false);
  }

  // ---------- badan ----------
  var tx = view === 'S' ? 7 + lean : 6, tw = view === 'S' ? 7 : 8;
  R(tx - (view === 'S' ? 0 : 1), 12 + by, tw + (view === 'S' ? 0 : 2), 1, shirt[1]);                 // garis bahu
  R(tx, 13 + by, tw, 6, shirt[1]);
  R(tx, 13 + by, 1, 5, shirt[0]); R(tx + tw - 2, 13 + by, 2, 6, shirt[2]); R(tx, 18 + by, tw, 1, shirt[2]);
  if (!back) {                                                           // kerah-V, lipatan, jahitan
    if (view === 'S') { R(tx + 4, 12 + by, 2, 1, skin[2]); R(tx + 2, 14 + by, 1, 1, pal.fold); R(tx + 3, 15 + by, 1, 1, pal.fold); R(tx + 1, 16 + by, 2, 1, pal.fold); }
    else { R(9, 12 + by, 2, 1, skin[2]); R(8, 12 + by, 1, 1, shirt[2]); R(11, 12 + by, 1, 1, shirt[2]);
           R(8, 14 + by, 1, 1, pal.fold); R(9, 15 + by, 1, 1, pal.fold); R(7, 16 + by, 2, 1, pal.fold); R(12, 15 + by, 1, 1, pal.fold); R(11, 16 + by, 1, 1, pal.fold); }
  } else {
    R(tx + 3, 13 + by, 1, 5, pal.fold); R(tx + 1, 15 + by, 2, 1, pal.fold); R(tx + 5, 14 + by, 1, 1, pal.fold); R(tx + 4, 16 + by, 2, 1, pal.fold);
  }
  for (i = 0; i < tw; i += 2) R(tx + i, 18 + by, 1, 1, pal.stitch);        // jahitan tepi bawah
  if (!back && !pal.apron) {                                              // saku dada + kerah
    if (view === 'S') { R(tx + 1, 14 + by, 2, 2, shirt[2]); R(tx + 1, 14 + by, 2, 1, pal.stitch); R(tx + 4, 13 + by, 2, 1, shirt[2]); }
    else { R(11, 14 + by, 3, 3, shirt[2]); R(11, 14 + by, 3, 1, pal.stitch); R(11, 16 + by, 3, 1, shirt[1]); R(7, 13 + by, 2, 1, shirt[2]); R(11, 13 + by, 1, 1, shirt[2]); }
  } else if (back && !pal.apron) { R(tx + 1, 13 + by, tw - 2, 1, shirt[2]); }    // kerah belakang
  if (pal.apron) {                                                        // celemek (NPC)
    if (view === 'S') { R(tx + 3, 14 + by, 3, 5, '#f5f5f5'); R(tx + 3, 14 + by, 1, 5, '#ffffff'); }
    else if (!back) { R(7, 14 + by, 6, 5, '#f5f5f5'); R(7, 14 + by, 1, 5, '#ffffff'); R(12, 14 + by, 1, 5, '#d9dde3'); R(7, 18 + by, 6, 1, '#cfd3da'); R(8, 12 + by, 1, 2, '#e6e9ee'); R(11, 12 + by, 1, 2, '#e6e9ee'); }
  }
  R(tx, 19 + by, tw, 1, pal.belt);                                         // sabuk
  if (!back && view !== 'S') { R(9, 19 + by, 2, 1, pal.buckle); }
  if (view === 'S') R(tx + 3, 19 + by, 2, 1, pal.buckle);
  if (view !== 'S') { R(tx, 20 + by, tw, 1, pants[1]); R(tx, 20 + by, 1, 1, pants[0]); R(tx + tw - 1, 20 + by, 1, 1, pants[2]); }
  if (view !== 'S') { R(6, 19 + by, 1, 1, pal.buckle === '#d4bf72' ? '#2a2a31' : pal.belt); R(13, 19 + by, 1, 1, '#2a2a31'); R(9, 21 + by, 2, 1, pants[2]); }   // passant sabuk + kampuh tengah
  else { R(tx + 1, 19 + by, 1, 1, '#2a2a31'); R(tx + 5, 19 + by, 1, 1, '#2a2a31'); }

  // ---------- kepala & lengan dekat ----------
  if (view === 'S') {
    head();
    var hN = arm(shN, P.na[0], P.na[1], 1, shirt, skin, true); out.hand = [hN[0], hN[1]];
  } else {
    var hL = arm([5, 13 + by], P.fa[0], P.fa[1], -1, shirt, skin, true);
    var hR = arm([14, 13 + by], P.na[0], P.na[1], 1, shirt, skin, true);
    out.hand = [hR[0], hR[1]];
    head();
  }
  out.rod = P.rod;
  return out;
}

var HERO_FRAMES = [], HERO_HAND = {};
function makePlayerSheet() {
  var cols = 0, k, a, v, n;
  HERO_ANIMS.forEach(function (an) { cols += an[1]; });
  var cv = mkCanvas(cols * HC_W * 2, HERO_VIEWS.length * HC_H * 2), c = cv[0], g = cv[1];
  HERO_FRAMES = [];
  HERO_VIEWS.forEach(function (view, vi) {
    var col = 0;
    HERO_ANIMS.forEach(function (an) {
      for (k = 0; k < an[1]; k++) {
        var P = heroPose(an[0], k), res = drawHeroCell(g, col * HC_W * 2, vi * HC_H * 2, view, P, PAL_PLAYER), key = view + ':' + an[0] + ':' + k;
        HERO_FRAMES.push({ key: key, x: col * HC_W * 2, y: vi * HC_H * 2 });
        HERO_HAND[key] = [res.hand[0], res.hand[1] + HC_YOFF, res.rod];
        col++;
      }
    });
  });
  return outlineCells(c, '#12161d');
}
function makeNpcSheet() {
  var cv = mkCanvas(4 * HC_W * 2, HC_H * 2), c = cv[0], g = cv[1], k;
  for (k = 0; k < 4; k++) drawHeroCell(g, k * HC_W * 2, 0, 'F0', heroPose('idle', k), PAL_NPC);
  return outlineCells(c, '#12161d');
}
function outlineCells(c, col) {                         // kontur 4 arah (atas, kiri, kanan, bawah)
  var tm = mkCanvas(c.width, c.height), tg = tm[1];
  tg.drawImage(c, 0, 0); tg.globalCompositeOperation = 'source-in'; tg.fillStyle = col; tg.fillRect(0, 0, c.width, c.height);
  var g = c.getContext('2d');
  g.globalCompositeOperation = 'destination-over';
  [[-2, 0], [2, 0], [0, -2], [0, 2]].forEach(function (o) { g.drawImage(tm[0], o[0], o[1]); });
  g.globalCompositeOperation = 'source-over';
  return c;
}
var DIRVIEW = [
  { v: 'S',  flip: false },   // 0 E
  { v: 'F1', flip: false },   // 1 SE
  { v: 'F0', flip: false },   // 2 S
  { v: 'F1', flip: true },    // 3 SW
  { v: 'S',  flip: true },    // 4 W
  { v: 'B1', flip: true },    // 5 NW
  { v: 'B0', flip: false },   // 6 N
  { v: 'B1', flip: false }    // 7 NE
];

/* ---------- joran kayu pemula (sprite horizontal; titik pegang = tengah gagang) ---------- */
function makeRod(st) {
  var Q = { w0: '#6e4020', w1: '#8c5a2c', w2: '#a06a35', wh0: '#9a6b3a', wh1: '#bf8d57', wd: '#47280f', wm: '#5a3418',
    m0: '#d9b45a', m1: '#fff0b0', m2: '#98721f', m3: '#c39a3e', b0: '#92462d', b1: '#d77a5c', b2: '#561f13', b3: '#7a3624', b4: '#6c2b1b',
    r0: '#e8c47a', r1: '#b9833a', r2: '#a7742f', r3: '#f6dc9c', r4: '#7d4f1d', r5: '#c9a35a', r6: '#f0d890', r7: '#8a6420' }, kq;
  st = st || {}; for (kq in st) Q[kq] = st[kq];                                   // resolusi 1 px (lebih halus) agar batang terlihat ramping
  var LW = 74, LH = 27, cv = mkCanvas(LW, LH), c = cv[0], g = cv[1], x, y, dx, dy, k;
  function R(a, b, w, h, col) { g.fillStyle = col; g.fillRect(a, b, w, h); }
  // senar tipis menyusuri ring pemandu (di belakang batang)
  function ln(x0, y0, x1, y1) { var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)), k; for (k = 0; k <= n; k++) R(Math.round(x0 + (x1 - x0) * k / n), Math.round(y0 + (y1 - y0) * k / n), 1, 1, '#f1eddb'); }
  ln(15, 14, 36, 12); ln(36, 12, 47, 12); ln(47, 12, 61, 10); ln(61, 10, 70, 9); ln(70, 9, 73, 7);
  // pantat gagang & gagang berlilit kulit
  R(0, 7, 4, 3, '#3a3026'); R(0, 6, 4, 1, '#5e5142'); R(1, 10, 3, 1, '#1f1812'); R(0, 7, 1, 3, '#2a2119');
  for (x = 4; x <= 25; x++) {
    var wrp = ((x + (x >> 3)) % 3);
    R(x, 6, 1, 5, wrp === 0 ? Q.w0 : (wrp === 1 ? Q.w1 : Q.w2));
    R(x, 6, 1, 1, wrp === 0 ? Q.wh0 : Q.wh1); R(x, 10, 1, 1, Q.wd);
    if (wrp === 0) { R(x, 8, 1, 1, Q.wm); }
  }
  R(26, 6, 3, 5, Q.m0); R(26, 6, 3, 1, Q.m1); R(26, 10, 3, 1, Q.m2); R(27, 7, 1, 3, Q.m3);       // cincin kuningan
  // batang bawah kayu merah-cokelat
  for (x = 29; x <= 52; x++) {
    var th = x < 42 ? 4 : 3;
    R(x, 7, 1, th, Q.b0); R(x, 7, 1, 1, Q.b1); R(x, 6 + th, 1, 1, Q.b2);
    if ((x * 5) % 11 === 2) R(x, 8, 1, 1, Q.b3); if ((x * 3) % 13 === 5) R(x, 9, 1, 1, Q.b4);
  }
  R(53, 7, 3, 3, Q.m0); R(53, 7, 3, 1, Q.m1); R(53, 9, 3, 1, Q.m2);                                     // sambungan
  for (x = 56; x <= 70; x++) {
    var t2 = x < 64 ? 2 : 1;
    R(x, 7, 1, t2, Q.b0); R(x, 7, 1, 1, Q.b1); if (t2 > 1) R(x, 8, 1, 1, Q.b2);
  }
  R(71, 6, 2, 3, Q.m0); R(71, 6, 2, 1, Q.m1); R(73, 7, 1, 1, Q.m0);                                       // ujung
  // ring pemandu kawat perak
  [[36, 11], [47, 11], [61, 9], [70, 8]].forEach(function (r) {
    var rx = r[0], ry = r[1];
    R(rx - 1, ry, 1, 3, '#e4e4ec'); R(rx + 1, ry, 1, 3, '#e4e4ec'); R(rx - 1, ry + 2, 3, 1, '#9a9aa8'); R(rx, ry, 1, 1, '#c8c8d2');
  });
  // reel perunggu berlubang (di bawah gagang), engkol, kaki
  R(12, 11, 5, 2, Q.r5); R(12, 11, 5, 1, Q.r6);
  for (dy = -6; dy <= 6; dy++) for (dx = -6; dx <= 6; dx++) {
    var d2 = dx * dx + dy * dy;
    if (d2 > 33) continue;
    var col = d2 > 24 ? Q.r0 : (d2 > 14 ? Q.r1 : Q.r2);
    if (dx + dy < -3 && d2 > 8) col = Q.r3; else if (dx + dy > 4 && d2 > 8) col = Q.r4;
    R(14 + dx, 19 + dy, 1, 1, col);
  }
  for (k = 0; k < 6; k++) { var an = k * Math.PI / 3 + 0.3; R(Math.round(14 + Math.cos(an) * 3.6), Math.round(19 + Math.sin(an) * 3.6), 2, 2, '#2f200e'); }
  R(13, 18, 3, 3, '#6a4720'); R(14, 19, 1, 1, Q.m1);
  R(20, 18, 5, 2, '#d4bf72'); R(20, 18, 5, 1, '#f6e39a'); R(24, 19, 2, 3, Q.r7); R(24, 19, 1, 1, '#d4bf72');
  R(9, 23, 3, 1, Q.r5); R(8, 24, 2, 1, Q.r7); R(7, 22, 2, 2, Q.r5);
  return { canvas: c, ox: 14 / LW, oy: 8.5 / LH };
}
function makeBait(id) {                                 // ikon umpan 16x16 (dikontur & dibesarkan lewat CSS pixelated)
  var cv = mkCanvas(16, 16), c = cv[0], g = cv[1], x, y, k;
  function R(a, b, w, h, col) { g.fillStyle = col; g.fillRect(a, b, w, h); }
  if (id === 'cacing') {
    for (x = 1; x <= 14; x++) {
      y = 7 + Math.round(2.6 * Math.sin(x * 0.8));
      R(x, y, 1, 3, (x % 3) ? '#e58a9a' : '#c4566c'); R(x, y, 1, 1, '#f9c2cd'); R(x, y + 2, 1, 1, '#a0405a');
    }
    R(14, 7 + Math.round(2.6 * Math.sin(14 * 0.8)) + 1, 1, 1, '#2a1018');
  } else if (id === 'udang') {
    for (k = 0; k <= 9; k++) {
      var a1 = 3.5 + k * 0.3, bx = Math.round(8 + Math.cos(a1) * 5.5), by = Math.round(8 + Math.sin(a1) * 4.5);
      R(bx - 1, by - 1, 3, 3, k % 2 ? '#ff8a4a' : '#ffa86a'); R(bx - 1, by - 1, 3, 1, '#ffd0a0');
    }
    R(1, 6, 3, 3, '#ff9a5a'); R(2, 7, 1, 1, '#111'); R(0, 4, 1, 3, '#ffb08a'); R(1, 3, 1, 2, '#ffb08a');
    R(12, 11, 3, 1, '#ff6a2a'); R(13, 12, 2, 2, '#ff6a2a'); R(11, 12, 1, 2, '#ff7a3a');
  } else if (id === 'larva') {
    R(0, 4, 16, 8, 'rgba(210,255,130,0.28)'); R(2, 3, 12, 10, 'rgba(210,255,130,0.22)');
    for (k = 0; k < 5; k++) { R(3 + k * 2, 6 + (k === 2 ? -1 : 0), 3, 5 + (k === 2 ? 1 : 0), k % 2 ? '#a8f04a' : '#d6ff7a'); }
    R(11, 7, 2, 2, '#111'); R(3, 6, 8, 1, '#f2ffb0'); R(4, 10, 6, 1, '#78c030');
  } else if (id === 'terib') {
    for (x = 3; x <= 13; x++) { var hh = Math.round(3 * Math.sqrt(Math.max(0, 1 - Math.pow((x - 8) / 5.6, 2)))); R(x, 8 - hh, 1, hh * 2, '#bcd0de'); R(x, 8, 1, Math.max(1, hh), '#eef6fb'); }
    for (x = 0; x <= 3; x++) R(x, 8 - (3 - x), 1, (3 - x) * 2 + 1, '#7f98a8');
    R(11, 7, 2, 2, '#fff'); R(12, 8, 1, 1, '#111'); R(7, 4, 3, 1, '#7f98a8');
  } else if (id === 'gelombang') {
    disc(g, 8, 8, 6, '#17609a', 1); disc(g, 8, 8, 5, '#2a8fd9', 1);
    R(4, 7, 3, 1, '#bfe6ff'); R(6, 6, 3, 1, '#ffffff'); R(9, 7, 3, 1, '#bfe6ff'); R(5, 10, 6, 1, '#7ac4f5'); R(4, 5, 2, 1, '#7ac4f5');
  } else if (id === 'emas') {
    for (x = 2; x <= 13; x++) { var hg = Math.round(3.4 * Math.sqrt(Math.max(0, 1 - Math.pow((x - 7.5) / 6, 2)))); R(x, 7 - hg, 1, hg * 2, '#e0a800'); R(x, 7 - hg, 1, Math.max(1, hg - 1), '#ffe27a'); }
    R(0, 4, 3, 7, '#c88a00'); R(12, 6, 2, 2, '#fff'); R(13, 7, 1, 1, '#111');
    R(7, 10, 1, 4, '#9aa3b0'); R(7, 14, 3, 1, '#9aa3b0'); R(9, 12, 1, 2, '#9aa3b0'); R(5, 4, 4, 1, '#fff6c0');
  } else {                                              // kosmik
    disc(g, 8, 8, 6, '#2a1470', 1); disc(g, 8, 8, 5, '#5a2fa0', 1); disc(g, 7, 7, 2, '#8a5cd8', 1);
    R(8, 2, 1, 5, '#fff'); R(6, 4, 5, 1, '#fff'); R(11, 9, 1, 3, '#e0d0ff'); R(10, 10, 3, 1, '#e0d0ff'); R(3, 10, 1, 1, '#fff'); R(5, 12, 1, 1, '#b48cff');
  }
  return { canvas: c, ox: 0.5, oy: 0.5 };
}
function makeFist() {                                   // kepalan tangan kecil (1 px) di atas gagang
  var cv = mkCanvas(6, 5), c = cv[0], g = cv[1];
  function R(a, b, w, h, col) { g.fillStyle = col; g.fillRect(a, b, w, h); }
  R(0, 0, 6, 4, '#f2c28b'); R(0, 0, 5, 1, '#ffe2bd'); R(0, 1, 1, 2, '#ffe2bd'); R(5, 3, 1, 1, '#d9a06c'); R(1, 3, 4, 1, '#d9a06c'); R(2, 1, 1, 2, '#d9a06c'); R(4, 1, 1, 2, '#d9a06c');
  return { canvas: c, ox: 0.5, oy: 0.5 };
}

/* ----- objek dunia ----- */
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
var ICON = {}, ICON_RODS = {}, ICON_BAITS = {};
function buildIcons() {
  FISH.forEach(function (f) { ICON[f.id] = makeFishCanvas(f).toDataURL(); });
  RODS.forEach(function (r) { ICON_RODS[r.id] = outlined(makeRod(r.style), '#2a1408', 1).canvas.toDataURL(); });
  BAITS.forEach(function (b) { ICON_BAITS[b.id] = outlined(makeBait(b.id), '#16121f', 1).canvas.toDataURL(); });
}

/* =====================================================================
   B. KONTROL & UI (DOM)
   ===================================================================== */
function $(id) { return document.getElementById(id); }
var scene = null;                     // diisi oleh scene Phaser
var view = { s: 1 };
var Ctl = { joyOn: false, joyX: 0, joyY: 0, keys: {}, modal: false, sprint: false };

var stageW = 1280, stageH = 720, gameRef = null;
function isFull() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
function fitStage() {
  var iw = window.innerWidth, ih = window.innerHeight, w = 1280, h = 720;
  if (isFull()) {                                   // layar penuh: isi seluruh layar tanpa bidang gelap & tanpa gepeng
    var asp = iw / ih;
    if (asp >= 16 / 9) w = Math.round(720 * asp); else h = Math.round(1280 / asp);
  }
  if (w !== stageW || h !== stageH) {
    stageW = w; stageH = h;
    var st = $('stage'), gm = $('game');
    st.style.width = w + 'px'; st.style.height = h + 'px'; gm.style.width = w + 'px'; gm.style.height = h + 'px';
    if (gameRef) gameRef.scale.resize(w, h);
  }
  view.s = Math.min(iw / w, ih / h) || 1;
  $('stage').style.transform = 'translate(-50%,-50%) scale(' + view.s + ')';
}

function totalFish() {
  var n = 0; for (var k in Save.data.inv) n += Save.data.inv[k]; return n;
}
function speciesValue(id) { var v = 0; Save.data.slots.forEach(function (s, i) { if (s === id) v += slotPrice(i); }); return v; }
function totalValue() {
  var v = 0; Save.data.slots.forEach(function (id, i) { if (id) v += slotPrice(i); }); return v;
}
function fmt(n) { return Math.floor(n).toLocaleString('id-ID'); }
function rarTag(r) { return '<span class="r-' + r + '" style="color:' + RARITY[r].color + '">' + RARITY[r].label + '</span>'; }
function fmtPct(v) { var d = v >= 10 ? 0 : (v >= 1 ? 1 : 2); return v.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%'; }

var UI = {
  cache: {},
  setCoins: function (pop) {
    $('coinText').textContent = fmt(Save.data.coins);
    if (pop) { var b = $('coinBox'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
  },
  setBag: function () { $('bagCount').textContent = totalFish(); },
  setZoomBtns: function () {
    $('btnZin').classList.toggle('off', Save.data.zoom >= ZOOM_MAX - 0.001);
    $('btnZout').classList.toggle('off', Save.data.zoom <= ZOOM_MIN + 0.001);
  },
  setLevel: function (pop) {
    var li = levelInfo(Save.data.xp);
    $('lvBadge').textContent = li.level;
    $('lvName').textContent = Save.data.name;
    $('lvBar').firstElementChild.style.width = Math.round(li.frac * 100) + '%';
    if (pop) { var b = $('btnProfile'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
    var sp = skillPoints(), sb = $('skillCount'); if (sb) { sb.textContent = sp; sb.style.display = sp > 0 ? '' : 'none'; }
    if (Modal.cur === 'skill') renderSkills();
  },
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
  setCastBar: function (on, frac, ok) {
    var b = $('castBar');
    if (this.cache.cast !== on) { this.cache.cast = on; b.className = on ? 'show' : ''; }
    if (!on) return;
    b.firstElementChild.style.width = Math.max(0, Math.min(1, frac)) * 100 + '%';
    var bad = !ok; if (this.cache.castBad !== bad) { this.cache.castBad = bad; b.classList.toggle('bad', bad); }
    var pk = frac >= 0.94; if (this.cache.castPk !== pk) { this.cache.castPk = pk; b.classList.toggle('peak', pk); }
    var tx = !ok ? 'ARAHKAN KE LAUT' : (pk ? 'PAS! LEPAS SEKARANG!' : 'LEPAS UNTUK MELEMPAR  ' + Math.round(CAST_MIN + (CAST_MAX - CAST_MIN) * frac) / 10 + ' m');
    if (this.cache.castTx !== tx) { this.cache.castTx = tx; b.lastElementChild.textContent = tx; }
  },
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
var IS_PC = !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);
if (IS_PC) document.documentElement.classList.add('pc');
var KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down' };
function initKeyboard() {
  window.addEventListener('keydown', function (e) {
    if (e.target && e.target.tagName === 'INPUT') return;          // sedang mengetik nama
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { Ctl.keys.sprint = true; return; }
    if (KEYMAP[e.code]) { Ctl.keys[KEYMAP[e.code]] = true; e.preventDefault(); return; }
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'KeyF') { if (scene) scene.fishDown(); e.preventDefault(); }
    else if (e.code === 'KeyE') { if (scene) scene.pressTalk(); }
    else if (e.code === 'KeyI' || e.code === 'KeyB') Modal.toggle('inv');
    else if (e.code === 'KeyP') Modal.toggle('profile');
    else if (e.code === 'KeyK') Modal.toggle('skill');
    else if (e.code === 'KeyN') Modal.toggle('book');
    else if (e.code === 'KeyM') { Snd.cycle(); updateSoundBtn(); }
    else if (e.code === 'KeyH' || e.code === 'F1' || (e.key === '?')) { Modal.toggle('help'); e.preventDefault(); }
    else if (e.code === 'KeyQ') { if (!Ctl.modal) cycleRod(); }
    else if (e.code === 'Equal' || e.code === 'NumpadAdd') { if (!Ctl.modal) changeZoom(ZOOM_STEP); }
    else if (e.code === 'Minus' || e.code === 'NumpadSubtract') { if (!Ctl.modal) changeZoom(-ZOOM_STEP); }
    else if (/^Digit[1-8]$/.test(e.code)) Hotbar.pick(+e.code.slice(5) - 1);
    else if (e.code === 'Escape') Modal.close();
  });
  window.addEventListener('keyup', function (e) { if (e.target && e.target.tagName === 'INPUT') return; if (e.code === 'Space' || e.code === 'KeyF') { if (scene) scene.fishUp(); } if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') Ctl.keys.sprint = false; if (KEYMAP[e.code]) Ctl.keys[KEYMAP[e.code]] = false; });
  window.addEventListener('blur', function () { Ctl.keys = {}; resetJoy(); });
}

/* ---------- Hotbar: tombol 1 = joran, tombol 2-7 = ikan dari kotak tas 1-6 ---------- */
var Equip = { sel: 0 };                      // 0 = joran, 1..6 = ikan di kotak tas (sel-1)
function heldFishId() { return Equip.sel >= 1 ? (Save.data.slots[Equip.sel - 1] || null) : null; }
var Hotbar = {
  els: [], name: null,
  build: function () {
    var h = $('hotbar'), self = this;
    h.innerHTML = ''; this.els = [];
    for (var i = 0; i <= NHOT + 1; i++) (function (i) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'hb';
      b.innerHTML = '<span class="hk">' + (i + 1) + '</span><img alt=""><i class="hr"></i><b class="hq"></b>';
      b.addEventListener('pointerdown', function (e) { e.preventDefault(); self.pick(i); });
      h.appendChild(b); self.els.push(b);
    })(i);
    this.name = $('hbName');
  },
  render: function () {
    if (!this.els.length) return;
    if (Equip.sel >= 1 && !Save.data.slots[Equip.sel - 1]) Equip.sel = 0;
    for (var i = 0; i <= NHOT + 1; i++) {
      var b = this.els[i], img = b.children[1];
      if (i === NHOT + 1) {                          // slot terakhir = umpan aktif (tekan 8 / ketuk untuk ganti)
        var ab = activeBait(), bcls = 'hb bait' + (ab ? ' has' : ' empty');
        if (b.className !== bcls) b.className = bcls;
        if (ab) {
          if (img.getAttribute('src') !== ICON_BAITS[ab.id]) img.setAttribute('src', ICON_BAITS[ab.id]);
          img.style.visibility = 'visible'; b.style.setProperty('--rc', ab.accent); b.children[3].textContent = baitCount(ab.id);
        } else { img.style.visibility = 'hidden'; b.children[3].textContent = ''; }
        continue;
      }
      var id = i === 0 ? 'rod' : Save.data.slots[i - 1];
      var cls = 'hb' + (i === 0 ? ' rod has' : (id ? ' has' : ' empty')) + (Equip.sel === i ? ' sel' : '');
      if (b.className !== cls) b.className = cls;
      if (id) {
        var src = i === 0 ? ICON_RODS[Save.data.rod] : ICON[id];
        if (img.getAttribute('src') !== src) img.setAttribute('src', src);
        img.style.visibility = 'visible';
        b.style.setProperty('--rc', i === 0 ? curRod().accent : (Save.data.muts[i - 1] ? MUT_BY_ID[Save.data.muts[i - 1]].color : RARITY[FISH_BY_ID[id].rarity].color));
      } else img.style.visibility = 'hidden';
    }
    var sid = heldFishId();
    var abn = activeBait();
    this.name.textContent = Equip.sel === 0 ? curRod().name + '  (Tenaga ' + curRod().power + ' | Hoki ' + fmtLuck(totalLuck()) + ' | Umpan: ' + (abn ? abn.name + ' x' + baitCount(abn.id) : 'tidak ada') + ')' : (sid ? (Save.data.muts[Equip.sel - 1] ? '[' + MUT_BY_ID[Save.data.muts[Equip.sel - 1]].name + '] ' : '') + FISH_BY_ID[sid].name + ' - ' + fmtKg(Save.data.kgs[Equip.sel - 1]) : '');
  },
  canSwitch: function () {
    var st = scene && scene.fish ? scene.fish.state : 'idle';
    return st === 'idle' || st === 'cooldown';
  },
  set: function (i) {                          // i = 0 joran, 1..6 ikan
    if (!this.canSwitch()) { UI.toast('<div>Selesaikan memancing dulu</div>', '#5fe0e6', false, 1100); return false; }
    if (i >= 1 && !Save.data.slots[i - 1]) return false;
    Equip.sel = (i === Equip.sel && i !== 0) ? 0 : i;
    this.render();
    return true;
  },
  pick: function (i) { if (Ctl.modal) return; if (i === NHOT + 1) { cycleBait(); return; } if (i === 0 && Equip.sel === 0 && Save.data.rods.length > 1 && this.canSwitch()) { cycleRod(); return; } this.set(i); }
};

/* ---------- Joran: beli (Coins + level), pakai, ganti ---------- */
var shopTab = 'fish', rodSel = null;
function ownsRod(id) { return Save.data.rods.indexOf(id) >= 0; }
function equipRod(id) {
  if (!ownsRod(id) || Save.data.rod === id) return true;
  if (!Hotbar.canSwitch()) { UI.toast('<div>Selesaikan memancing dulu</div>', '#5fe0e6', false, 1100); return false; }
  Save.data.rod = id; Save.write(); Hotbar.render();
  UI.toast('<div>' + RODS_BY_ID[id].name + ' dipakai<small>Tenaga ' + RODS_BY_ID[id].power + ' | Hoki +' + RODS_BY_ID[id].luck + '%</small><small>Kelangkaan tertinggi: ' + RARITY[maxRarity(RODS_BY_ID[id].power)].label + '</small></div>', RODS_BY_ID[id].accent, false, 1800);
  return true;
}
function cycleRod() {
  var own = RODS.filter(function (r) { return ownsRod(r.id); });
  if (own.length < 2) return;
  var i = own.indexOf(curRod());
  equipRod(own[(i + 1) % own.length].id);
}
function buyRod(id) {
  var r = RODS_BY_ID[id], d = Save.data;
  if (!r || ownsRod(id)) return;
  if (levelInfo(d.xp).level < r.lv) { UI.toast('<div>Butuh Tingkat ' + r.lv + '</div>', '#ff7b7b', false, 1500); return; }
  if (d.coins < r.price) { UI.toast('<div>Koin kurang ' + fmt(r.price - d.coins) + '</div>', '#ff7b7b', false, 1500); return; }
  d.coins -= r.price; d.rods.push(id); d.rod = Hotbar.canSwitch() ? id : d.rod;
  Save.write(); UI.setCoins(true); Hotbar.render();
  npcLine = 'Pilihan bagus! ' + r.name + ' sekarang milikmu.';
  Snd.play('buy');
  renderShop();
}
function renderRodShop() {
  var list = $('shopList'), detail = $('shopDetail'), d = Save.data, lv = levelInfo(d.xp).level;
  list.innerHTML = '';
  if (!rodSel || !RODS_BY_ID[rodSel]) rodSel = d.rod;
  RODS.forEach(function (r) {
    var own = ownsRod(r.id), eq = d.rod === r.id, lock = lv < r.lv && !own;
    var row = document.createElement('div');
    row.className = 'row' + (rodSel === r.id ? ' sel' : '') + (lock ? ' locked' : '');
    row.style.setProperty('--rc', r.accent);
    row.innerHTML = '<img class="ficon rodi" src="' + ICON_RODS[r.id] + '" alt=""><div class="fname"><b>' + r.name + '</b><span>Tenaga ' + r.power + ' | Hoki +' + r.luck + '%</span></div>' +
      '<div class="cnt">' + (eq ? 'Dipakai' : own ? 'Dimiliki' : lock ? 'Tk ' + r.lv : fmt(r.price)) + (!own && !lock ? '<small>Koin</small>' : '') + '</div>';
    row.addEventListener('click', function () { rodSel = r.id; renderShop(); });
    list.appendChild(row);
  });
  var r = RODS_BY_ID[rodSel], cur = curRod(), own = ownsRod(r.id), lock = lv < r.lv;
  function dif(a, b) { var x = a - b; return x === 0 ? '' : ' <small style="color:' + (x > 0 ? '#7dff8a' : '#ff8a8a') + '">(' + (x > 0 ? '+' : '') + x + ')</small>'; }
  var act;
  if (own) act = d.rod === r.id ? '<button class="btn" type="button" disabled>Sedang dipakai</button>' : '<button class="btn blue" type="button" id="rodEquip">Pakai</button>';
  else act = '<button class="btn" type="button" id="rodBuy"' + ((lock || d.coins < r.price) ? ' disabled' : '') + '>Beli (' + fmt(r.price) + ' Koin)</button>';
  detail.innerHTML = '<div class="npcSay">' + npcLine + '</div><img class="big rodbig" src="' + ICON_RODS[r.id] + '" alt=""><h3>' + r.name + '</h3>' +
    '<div class="tag" style="color:' + r.accent + '">' + (lock && !own ? 'Terkunci: butuh Tingkat ' + r.lv : 'Syarat Tingkat ' + r.lv) + '</div>' +
    '<div class="stat"><span>Tenaga tarik</span><b>' + r.power + (r !== cur ? dif(r.power, cur.power) : '') + '</b></div>' +
    '<div class="stat"><span>Hoki joran</span><b>+' + r.luck + '%' + (r !== cur ? dif(r.luck, cur.luck) : '') + '</b></div>' +
    '<div class="stat"><span>Kelangkaan tertinggi</span><b>' + rarTag(maxRarity(r.power)) + '</b></div>' +
    '<div class="stat"><span>Harga</span><b>' + (r.price ? fmt(r.price) + ' Koin' : 'Gratis') + '</b></div>' +
    '<p>' + r.desc + '</p><div class="btns">' + act + '</div>';
  if ($('rodBuy')) $('rodBuy').addEventListener('click', function () { buyRod(r.id); });
  if ($('rodEquip')) $('rodEquip').addEventListener('click', function () { if (equipRod(r.id)) renderShop(); });
  $('shopSummary').textContent = 'Koin kamu: ' + fmt(d.coins) + '  |  Tingkat ' + lv;
}

/* ---------- Umpan: pilih, ganti (hotbar 8), beli di toko ---------- */
var baitSel = null;
function setBait(id) { Save.data.bait = id; Save.write(); Hotbar.render(); }
function cycleBait() {
  var own = BAITS.filter(function (b) { return baitCount(b.id) > 0; }), cur = activeBait();
  if (!own.length) { UI.toast('<div>Belum punya umpan<small>Beli di toko Pak Marlin, tab Umpan</small></div>', '#5fe0e6', false, 1800); return; }
  var i = cur ? own.indexOf(cur) : -1, next = (i + 1 >= own.length) ? null : own[i + 1];   // urutan: umpan 1, 2, ... lalu tanpa umpan
  setBait(next ? next.id : null);
  if (next) UI.toast('<div>' + next.name + ' x' + baitCount(next.id) + '<small>' + baitSummary(next) + '</small></div>', next.accent, false, 1500);
  else UI.toast('<div>Tanpa umpan</div>', '#5fe0e6', false, 1200);
}
function buyBait(id, packs) {
  var b = BAITS_BY_ID[id], d = Save.data;
  if (!b) return;
  var n = BAIT_PACK * packs, cost = b.price * packs;
  if (levelInfo(d.xp).level < b.lv) { UI.toast('<div>Butuh Tingkat ' + b.lv + '</div>', '#ff7b7b', false, 1500); return; }
  if (baitCount(id) + n > BAIT_MAX) { UI.toast('<div>Umpan penuh (maks ' + BAIT_MAX + ')</div>', '#ff7b7b', false, 1500); return; }
  if (d.coins < cost) { UI.toast('<div>Koin kurang ' + fmt(cost - d.coins) + '</div>', '#ff7b7b', false, 1500); return; }
  d.coins -= cost; d.baits[id] = baitCount(id) + n;
  if (!activeBait()) d.bait = id;                    // belum ada umpan aktif => langsung dipakai
  Save.write(); UI.setCoins(true); Hotbar.render();
  npcLine = 'Terima kasih! ' + n + ' ' + b.name + ' masuk tasmu.';
  Snd.play('buy');
  renderShop();
}
function renderBaitShop() {
  var list = $('shopList'), detail = $('shopDetail'), d = Save.data, lv = levelInfo(d.xp).level;
  list.innerHTML = '';
  if (!baitSel || !BAITS_BY_ID[baitSel]) baitSel = BAITS[0].id;
  BAITS.forEach(function (b) {
    var lock = lv < b.lv, n = baitCount(b.id), row = document.createElement('div');
    row.className = 'row' + (baitSel === b.id ? ' sel' : '') + (lock ? ' locked' : '');
    row.style.setProperty('--rc', b.accent);
    row.innerHTML = '<img class="ficon baiti" src="' + ICON_BAITS[b.id] + '" alt=""><div class="fname"><b>' + b.name + '</b><span>' + baitSummary(b) + '</span></div>' +
      '<div class="cnt">' + (lock ? 'Tk ' + b.lv : (n ? 'x' + n : fmt(b.price)) ) + (!lock ? '<small>' + (n ? 'dimiliki' : 'Koin / ' + BAIT_PACK) + '</small>' : '') + '</div>';
    row.addEventListener('click', function () { baitSel = b.id; renderShop(); });
    list.appendChild(row);
  });
  var b = BAITS_BY_ID[baitSel], lock = lv < b.lv, n = baitCount(b.id), cur = activeBait(), on = cur === b;
  var buyDis = function (packs) { return (lock || d.coins < b.price * packs || n + BAIT_PACK * packs > BAIT_MAX) ? ' disabled' : ''; };
  detail.innerHTML = '<div class="npcSay">' + npcLine + '</div><img class="big baitbig" src="' + ICON_BAITS[b.id] + '" alt=""><h3>' + b.name + '</h3>' +
    '<div class="tag" style="color:' + b.accent + '">' + (lock ? 'Terkunci: butuh Tingkat ' + b.lv : 'Syarat Tingkat ' + b.lv) + '</div>' +
    '<div class="stat"><span>Hoki</span><b>' + (b.luck ? '+' + b.luck + '%' : '-') + '</b></div>' +
    '<div class="stat"><span>Peluang mutasi</span><b>' + (b.mut ? '+' + fmtP(b.mut) + '%' : '-') + '</b></div>' +
    '<div class="stat"><span>Peluang ikan jumbo</span><b>' + (b.big ? '+' + b.big + '%' : '-') + '</b></div>' +
    '<div class="stat"><span>Dimiliki</span><b>' + n + '</b></div>' +
    '<p>' + b.desc + ' Terpakai 1 per lemparan.</p><div class="btns">' +
    '<button class="btn" type="button" id="baitBuy1"' + buyDis(1) + '>Beli ' + BAIT_PACK + ' (' + fmt(b.price) + ')</button>' +
    '<button class="btn" type="button" id="baitBuy5"' + buyDis(5) + '>Beli ' + BAIT_PACK * 5 + ' (' + fmt(b.price * 5) + ')</button>' +
    (n > 0 ? '<button class="btn blue" type="button" id="baitUse">' + (on ? 'Lepas umpan' : 'Pakai') + '</button>' : '') + '</div>';
  $('baitBuy1').addEventListener('click', function () { buyBait(b.id, 1); });
  $('baitBuy5').addEventListener('click', function () { buyBait(b.id, 5); });
  if ($('baitUse')) $('baitUse').addEventListener('click', function () { setBait(on ? null : b.id); renderShop(); });
  $('shopSummary').textContent = 'Koin kamu: ' + fmt(d.coins) + '  |  Tingkat ' + lv + '  |  Umpan aktif: ' + (cur ? cur.name + ' x' + baitCount(cur.id) : 'tidak ada');
}

/* ---------- Panel Skill: 4 jalur, level tanpa batas, 1 poin per level ---------- */
function fmtChance(p) { return p >= 0.0001 ? fmtPct(p * 100) : '1 : ' + fmt(Math.round(1 / p)); }
function renderSkills() {
  var pts = skillPoints(), h = '';
  SKILL_ORDER.forEach(function (k) {
    var S = SKILLS[k], lv = skillLevel(k);
    h += '<div class="skCol" style="--sc:' + S.color + '"><div class="skHead"><b>' + S.name + ' - Lv. ' + fmt(lv) + '</b><span>' + S.eff(lv) + '</span><small>' + S.desc + '</small></div>';
    h += '<button class="btn small skBuy" type="button" data-k="' + k + '" data-n="1"' + (pts < 1 ? ' disabled' : '') + '>Tingkatkan (1 poin)</button>';
    h += '<button class="btn small skBuy" type="button" data-k="' + k + '" data-n="10"' + (pts < 10 ? ' disabled' : '') + '>+10 tingkat (10 poin)</button>';
    h += '<div class="skNodes">';
    [[lv, 'done', 'Sekarang', ''], [lv + 1, 'next', 'Berikutnya', 1], [lv + 10, 'lock', '+10 tingkat', 10]].forEach(function (n) {
      h += '<div class="skNode ' + n[1] + '"><i>' + fmt(n[0]) + '</i><div><b>' + n[2] + '</b><span>' + S.eff(n[0]) + '</span></div><em>' + n[3] + '</em></div>';
    });
    h += '</div></div>';
  });
  $('skillCols').innerHTML = h;
  $('skillPts').textContent = 'Poin keahlian: ' + fmt(pts);
  var ab = activeBait(), li = FCA.luckInfo(fishState(ab, 1)), ch = rarityChances(ab, 1);
  $('skillInfo').innerHTML = 'Hoki total ' + fmtLuck(li.totalLuck) + ' (dasar 100%, joran +' + curRod().luck + '%, keahlian +' + fmtP(r1(FCA.skillBonus('luck', skillLevel('luck')))) + '%, umpan +' + (ab ? ab.luck : 0) + '%)' +
    ' | Efektif x' + fmtP(Math.round(li.factor * 100) / 100) + ' | Tenaga ' + curRod().power +
    ' | Mutasi ' + fmtPct(mutChance()) + ' | Jumbo ' + fmtPct(jumboChance()) + '<br>Peluang lempar penuh: ' +
    ch.map(function (e) { return e.p > 0 ? '<span style="color:' + RARITY[e.r].color + '">' + RARITY[e.r].label + ' ' + fmtChance(e.p) + '</span>' : ''; }).filter(Boolean).join(' | ');
}
function buySkill(k, n) {
  n = Math.max(1, n | 0);
  if (!SKILLS[k] || skillPoints() < n) return;
  Save.data.skillLv[k] = skillLevel(k) + n; Save.write();
  Snd.play('skill');
  UI.setLevel(false); renderSkills();
}

/* ---------- Modal Inventory & Toko ---------- */
var invSel = null, shopSel = null, resetArm = 0;
var NPC_SAY = {
  hi: 'Halo, nelayan! Mau jual hasil tangkapanmu? Aku bayar sesuai harga.',
  thanks: function (n, c) { return 'Terima kasih! ' + n + ' ikan dibeli, kamu dapat ' + fmt(c) + ' Koin.'; },
  none: 'Kamu belum punya ikan. Pergilah memancing dulu, ya!'
};
var npcLine = NPC_SAY.hi;

var Modal = {
  cur: null,
  open: function (name) {
    Snd.play(this.cur ? 'tick' : 'open');
    this.cur = name;
    $('modal').classList.remove('hidden');
    $('panelInv').hidden = name !== 'inv';
    $('panelShop').hidden = name !== 'shop';
    $('panelProfile').hidden = name !== 'profile';
    $('panelSkill').hidden = name !== 'skill';
    $('panelHelp').hidden = name !== 'help';
    $('panelBook').hidden = name !== 'book';
    Ctl.modal = true; Ctl.sprint = false; resetJoy();
    if (name === 'inv') { resetArm = 0; moveFrom = null; $('btnReset').textContent = 'Hapus Data'; renderInventory(); }
    if (name === 'shop') { npcLine = NPC_SAY.hi; shopTab = 'fish'; renderShop(); }
    if (name === 'profile') renderProfile();
    if (name === 'skill') renderSkills();
    if (name === 'book') renderBook();
  },
  close: function () {
    if (!this.cur) return;
    Snd.play('close');
    this.cur = null;
    stopPortrait();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();   // simpan nama bila sedang diketik
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
  var n = Save.data.inv[f.id] || 0, caught = Save.data.caught[f.id] || 0, rec = Save.data.record[f.id];
  return '<img class="big" src="' + ICON[f.id] + '" alt=""><h3>' + f.name + '</h3>' +
    '<div class="tag">' + rarTag(f.rarity) + '</div>' +
    '<div class="stat"><span>Kisaran berat</span><b>' + fmtNum(f.kg[0]) + ' - ' + fmtKg(f.kg[1]) + '</b></div>' +
    '<div class="stat"><span>Rekor terberat</span><b>' + (rec ? fmtKg(rec) : '-') + '</b></div>' +
    '<div class="stat"><span>Jumlah dimiliki</span><b>' + n + '</b></div>' +
    '<div class="stat"><span>Nilai di tas</span><b>' + fmt(speciesValue(f.id)) + ' Koin</b></div>' +
    '<div class="stat"><span>Total tertangkap</span><b>' + caught + '</b></div>' +
    '<p>' + f.desc + '</p>' + (extra || '');
}


/* ---------- Buku Ikan: semua ikan di pulau; yang belum didapat tampil sebagai siluet, tetap menunjukkan kelangkaan & tenaga minimal ---------- */
var bookSel = null;
function bookNeed(f) { return RARITY[f.rarity].minPower; }
function renderBook() {
  var list = $('bookList'), detail = $('bookDetail'), d = Save.data, rp = curRod().power;
  var found = FISH.filter(function (f) { return d.caught[f.id] > 0; }).length;
  if (!bookSel || !FISH_BY_ID[bookSel]) bookSel = FISH[0].id;
  list.innerHTML = '';
  FISH.forEach(function (f) {
    var seen = (d.caught[f.id] || 0) > 0, ok = rp >= bookNeed(f);
    var row = document.createElement('div');
    row.className = 'row' + (bookSel === f.id ? ' sel' : '') + (seen ? '' : ' unknown');
    row.style.setProperty('--rc', RARITY[f.rarity].color);
    row.innerHTML = '<img class="ficon' + (seen ? '' : ' silh') + '" src="' + ICON[f.id] + '" alt="">' +
      '<div class="fname"><b>' + (seen ? f.name : '???') + '</b><span>' + rarTag(f.rarity) + '</span></div>' +
      '<div class="cnt' + (ok ? '' : ' bad') + '">Tenaga ' + bookNeed(f) + '<small>' + (ok ? 'cukup' : 'kurang') + '</small></div>';
    row.addEventListener('click', function () { bookSel = f.id; renderBook(); });
    list.appendChild(row);
  });
  var f = FISH_BY_ID[bookSel], seen = (d.caught[f.id] || 0) > 0, need = bookNeed(f), rec = d.record[f.id];
  detail.innerHTML = '<img class="big' + (seen ? '' : ' silh') + '" src="' + ICON[f.id] + '" alt=""><h3>' + (seen ? f.name : '???') + '</h3>' +
    '<div class="tag">' + rarTag(f.rarity) + '</div>' +
    '<div class="stat"><span>Tenaga joran minimal</span><b style="color:' + (rp >= need ? '#7dff9a' : '#ff7b7b') + '">' + need + '</b></div>' +
    '<div class="stat"><span>Joranmu sekarang</span><b>Tenaga ' + rp + (rp >= need ? ' (cukup)' : ' (belum cukup)') + '</b></div>' +
    '<div class="stat"><span>Kisaran berat</span><b>' + (seen ? fmtNum(f.kg[0]) + ' - ' + fmtKg(f.kg[1]) : '???') + '</b></div>' +
    '<div class="stat"><span>Harga dasar</span><b>' + (seen ? fmt(f.price) + ' Koin' : '???') + '</b></div>' +
    '<div class="stat"><span>Rekor terberat</span><b>' + (seen && rec ? fmtKg(rec) : '-') + '</b></div>' +
    '<div class="stat"><span>Total tertangkap</span><b>' + (d.caught[f.id] || 0) + '</b></div>' +
    '<p>' + (seen ? f.desc : 'Ikan ini belum pernah kamu tangkap. Pakai joran dengan tenaga minimal ' + need + ' lalu coba terus memancing!') + '</p>';
  $('bookSummary').textContent = 'Ditemukan: ' + found + '/' + FISH.length;
}

var invTab = 'bag', slotSel = null, moveFrom = null;
function renderCollection() {
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
}
function slotDetailHTML(i) {
  var id = Save.data.slots[i];
  if (!id) return '<div class="empty">Kotak ' + (i + 1) + ' kosong.<br>' + (moveFrom !== null ? 'Ketuk untuk memindahkan ikan ke sini.' : 'Ikan hasil tangkapan masuk ke kotak kosong pertama.') + '</div>';
  var f = FISH_BY_ID[id];
  return '<img class="big" src="' + ICON[id] + '" alt=""><h3>' + mutTag(Save.data.muts[i]) + f.name + '</h3><div class="tag">' + rarTag(f.rarity) + '</div>' +
    '<div class="stat"><span>Kotak</span><b>' + (i + 1) + (i < NHOT ? ' (bilah cepat ' + (i + 2) + ')' : '') + '</b></div>' +
    '<div class="stat"><span>Berat</span><b>' + fmtKg(Save.data.kgs[i]) + '</b></div>' +
    (Save.data.muts[i] ? '<div class="stat"><span>Mutasi</span><b>' + mutTag(Save.data.muts[i]) + 'x' + mutMult(Save.data.muts[i]).toString().replace('.', ',') + ' harga</b></div>' : '') +
    '<div class="stat"><span>Harga jual</span><b>' + fmt(slotPrice(i)) + ' Koin</b></div>' +
    '<div class="stat"><span>Rekor jenis ini</span><b>' + fmtKg(Save.data.record[id] || Save.data.kgs[i]) + '</b></div>' +
    '<div class="stat"><span>Total tertangkap</span><b>' + (Save.data.caught[id] || 0) + '</b></div>' +
    '<p>' + f.desc + '</p><div class="btns">' +
    (i < NHOT ? '<button class="btn blue" type="button" id="btnHold">Pegang</button>' : '') +
    '<button class="btn" type="button" id="btnMove">' + (moveFrom === i ? 'Batal pindah' : 'Pindahkan') + '</button></div>';
}
function renderBag() {
  var grid = $('slotGrid');
  grid.innerHTML = '';
  Save.data.slots.forEach(function (id, i) {
    var d = document.createElement('div');
    d.className = 'slot' + (i < NHOT ? ' hot' : '') + (id ? ' has' : '') + (slotSel === i ? ' sel' : '') + (moveFrom === i ? ' mv' : '');
    if (id) d.style.setProperty('--rc', Save.data.muts[i] ? MUT_BY_ID[Save.data.muts[i]].color : RARITY[FISH_BY_ID[id].rarity].color);
    d.innerHTML = (i < NHOT ? '<b class="sk">' + (i + 2) + '</b>' : '') + (id && Save.data.muts[i] ? '<b class="mt" style="color:' + MUT_BY_ID[Save.data.muts[i]].color + '">&#10022;</b>' : '') + (id ? '<img src="' + ICON[id] + '" alt=""><b class="kg">' + fmtNum(Save.data.kgs[i]) + '</b><i class="rb"></i>' : '');
    d.addEventListener('click', function () {
      if (moveFrom !== null) {
        var sl = Save.data.slots, kg = Save.data.kgs, mu = Save.data.muts, t = sl[moveFrom], tk = kg[moveFrom], tm = mu[moveFrom]; sl[moveFrom] = sl[i]; sl[i] = t; kg[moveFrom] = kg[i]; kg[i] = tk; mu[moveFrom] = mu[i]; mu[i] = tm;
        moveFrom = null; slotSel = i; Save.write(); Hotbar.render();
      } else slotSel = i;
      renderBag();
    });
    grid.appendChild(d);
  });
  $('slotHint').textContent = moveFrom !== null ? 'Pilih kotak tujuan untuk memindahkan ikan' : 'Ketuk kotak untuk melihat ikan  |  Kotak 1-6 muncul di bilah cepat';
  var det = $('slotDetail');
  if (slotSel === null) { for (var q = 0; q < NSLOT; q++) if (Save.data.slots[q]) { slotSel = q; break; } }
  det.innerHTML = slotSel === null ? '<div class="empty">Tas masih kosong.<br>Tangkap ikan untuk mengisinya!</div>' : slotDetailHTML(slotSel);
  var bh = $('btnHold'), bm = $('btnMove');
  if (bh) bh.addEventListener('click', function () { if (Hotbar.set(slotSel + 1)) Modal.close(); });
  if (bm) bm.addEventListener('click', function () { moveFrom = moveFrom === slotSel ? null : slotSel; renderBag(); });
  updateInvSummary();
}
function updateInvSummary() {
  var found = FISH.filter(function (f) { return Save.data.caught[f.id] > 0; }).length;
  $('invSummary').textContent = 'Tas: ' + totalFish() + '/' + NSLOT + '  |  Nilai: ' + fmt(totalValue()) + ' Koin  |  Koleksi: ' + found + '/' + FISH.length;
}
function renderInventory() {
  $('bagView').hidden = invTab !== 'bag'; $('colView').hidden = invTab !== 'col';
  $('tabBag').classList.toggle('on', invTab === 'bag'); $('tabCol').classList.toggle('on', invTab === 'col');
  if (invTab === 'bag') renderBag(); else { renderCollection(); updateInvSummary(); }
}

function changeZoom(delta) {
  var z = Math.round((Save.data.zoom + delta) * 100) / 100;
  z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
  if (z === Save.data.zoom) return;
  Save.data.zoom = z; Save.write(); UI.setZoomBtns();
}

function addXp(amount) {
  var before = levelInfo(Save.data.xp).level;
  Save.data.xp += amount;
  var after = levelInfo(Save.data.xp).level, coins = 0, l;
  for (l = before + 1; l <= after; l++) coins += levelReward(l);
  if (coins) { Save.data.coins += coins; UI.setCoins(true); }
  UI.setLevel(true);
  return { up: after > before, level: after, coins: coins, gained: after - before };
}

/* ---------- Profil karakter ---------- */
var PLAYER_SHEET = null, pfTimer = 0, pfFrame = 0, HERO_FRAME_BY_KEY = null;
function drawPortrait() {
  var cv = $('pfPortrait');
  if (!cv || !PLAYER_SHEET) return;
  if (!HERO_FRAME_BY_KEY) { HERO_FRAME_BY_KEY = {}; HERO_FRAMES.forEach(function (fr) { HERO_FRAME_BY_KEY[fr.key] = fr; }); }
  var fr = HERO_FRAME_BY_KEY['F0:idle:' + (pfFrame % 4)];
  if (!fr) return;
  var g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, cv.width, cv.height);
  g.drawImage(PLAYER_SHEET, fr.x, fr.y, HC_W * 2, HC_H * 2, 0, 0, cv.width, cv.height);
}
function startPortrait() {
  stopPortrait(); pfFrame = 0; drawPortrait();
  pfTimer = setInterval(function () { pfFrame++; drawPortrait(); }, 280);
}
function stopPortrait() { if (pfTimer) { clearInterval(pfTimer); pfTimer = 0; } }
function renderProfile() {
  var d = Save.data, li = levelInfo(d.xp), i;
  $('pfName').value = d.name;
  $('pfTitle').textContent = rankTitle(li.level);
  $('pfLevel').textContent = 'Tingkat ' + li.level;
  $('pfXpText').textContent = fmt(li.cur) + ' / ' + fmt(li.need) + ' Pengalaman';
  $('pfBar').firstElementChild.style.width = Math.round(li.frac * 100) + '%';
  $('pfNext').textContent = 'Naik ke Tingkat ' + (li.level + 1) + ' = hadiah ' + fmt(levelReward(li.level + 1)) + ' Koin';
  var total = 0, found = 0, best = null, heavy = null, perRar = {};
  RARITY_ORDER.forEach(function (r) { perRar[r] = 0; });
  FISH.forEach(function (f) {
    var n = d.caught[f.id] || 0;
    if (n > 0) {
      total += n; found++; perRar[f.rarity] += n;
      if (d.record[f.id] && (!heavy || d.record[f.id] > d.record[heavy.id])) heavy = f;
      if (!best || RARITY_ORDER.indexOf(f.rarity) > RARITY_ORDER.indexOf(best.rarity) || (f.rarity === best.rarity && f.price > best.price)) best = f;
    }
  });
  var h = '<div class="pfStat"><span>Total ikan tertangkap</span><b>' + fmt(total) + '</b></div>' +
    '<div class="pfStat"><span>Koleksi ikan</span><b>' + found + ' / ' + FISH.length + '</b></div>' +
    '<div class="pfStat"><span>Tangkapan terlangka</span><b>' + (best ? '<span class="r-' + best.rarity + '">' + best.name + '</span>' : '-') + '</b></div>' +
    '<div class="pfStat"><span>Ikan terberat</span><b>' + (heavy ? fmtKg(d.record[heavy.id]) + ' (' + heavy.name + ')' : '-') + '</b></div>' +
    '<div class="pfStat"><span>Koin</span><b>' + fmt(d.coins) + '</b></div>' +
    '<div class="pfStat"><span>Total Pengalaman</span><b>' + fmt(d.xp) + '</b></div>' +
    '<div class="pfRar">';
  for (i = 0; i < RARITY_ORDER.length; i++) {
    var rk = RARITY_ORDER[i];
    h += '<div style="--rc:' + RARITY[rk].color + '"><b>' + perRar[rk] + '</b><span class="r-' + rk + '">' + RARITY[rk].label + '</span></div>';
  }
  $('pfStats').innerHTML = h + '</div>';
  startPortrait();
}

function lightestIdx(id) {
  var sl = Save.data.slots, kg = Save.data.kgs, li = -1, i;
  for (i = 0; i < sl.length; i++) if (sl[i] === id && (li < 0 || kg[i] < kg[li])) li = i;
  return li;
}
function sellFish(id, all) {                          // jual 1 = ikan paling ringan dari jenis itu
  var sl = Save.data.slots, kg = Save.data.kgs, cnt = 0, earn = 0, i;
  if (all) { for (i = 0; i < sl.length; i++) if (sl[i] === id) { earn += slotPrice(i); sl[i] = null; kg[i] = null; Save.data.muts[i] = null; cnt++; } }
  else { var li = lightestIdx(id); if (li >= 0) { earn = slotPrice(li); sl[li] = null; kg[li] = null; Save.data.muts[li] = null; cnt = 1; } }
  if (!cnt) return;
  syncInv();
  Save.data.coins += earn;
  Save.write();
  UI.setCoins(true); UI.setBag(); Hotbar.render();
  npcLine = NPC_SAY.thanks(cnt, earn);
  Snd.play('coin', cnt);
  renderShop();
}
function sellEverything() {
  var cnt = 0, earn = 0;
  Save.data.slots.forEach(function (id, i) { if (id) { cnt++; earn += slotPrice(i); } });
  if (!cnt) return;
  Save.data.slots = cleanSlots(null); Save.data.kgs = blankKgs(); Save.data.muts = blankKgs(); syncInv();
  Save.data.coins += earn;
  Save.write();
  UI.setCoins(true); UI.setBag(); Hotbar.render();
  npcLine = NPC_SAY.thanks(cnt, earn);
  Snd.play('coin', cnt);
  renderShop();
}
function renderShop() {
  $('tabShopFish').classList.toggle('on', shopTab === 'fish'); $('tabShopRod').classList.toggle('on', shopTab === 'rod'); $('tabShopBait').classList.toggle('on', shopTab === 'bait');
  $('btnSellAll').style.display = shopTab === 'fish' ? '' : 'none';
  if (shopTab === 'rod') { renderRodShop(); return; }
  if (shopTab === 'bait') { renderBaitShop(); return; }
  var list = $('shopList'), detail = $('shopDetail');
  list.innerHTML = '';
  var owned = FISH.filter(function (f) { return (Save.data.inv[f.id] || 0) > 0; });
  if (!shopSel || !(Save.data.inv[shopSel] > 0)) shopSel = owned.length ? owned[0].id : null;
  owned.forEach(function (f) {
    var row = document.createElement('div');
    row.className = 'row' + (shopSel === f.id ? ' sel' : '');
    row.style.setProperty('--rc', RARITY[f.rarity].color);
    row.innerHTML = fishRowHTML(f, 'x' + Save.data.inv[f.id] + '<small>' + fmt(speciesValue(f.id)) + ' Koin</small>');
    row.addEventListener('click', function () { shopSel = f.id; renderShop(); });
    list.appendChild(row);
  });
  var say = '<div class="npcSay">' + (owned.length ? npcLine : (npcLine === NPC_SAY.hi ? NPC_SAY.none : npcLine)) + '</div>';
  if (shopSel) {
    var f = FISH_BY_ID[shopSel], li = lightestIdx(shopSel);
    detail.innerHTML = say + fishDetailHTML(f,
      '<div class="btns"><button class="btn blue" type="button" id="sell1">Jual Teringan (+' + fmt(slotPrice(li)) + ')</button>' +
      '<button class="btn" type="button" id="sellN">Jual Semua (+' + fmt(speciesValue(shopSel)) + ')</button></div>');
    $('sell1').addEventListener('click', function () { sellFish(shopSel, false); });
    $('sellN').addEventListener('click', function () { sellFish(shopSel, true); });
  } else {
    detail.innerHTML = say + '<div class="empty">Tidak ada ikan untuk dijual.</div>';
  }
  $('shopSummary').textContent = 'Koin kamu: ' + fmt(Save.data.coins) + '  |  Nilai semua ikan: ' + fmt(totalValue());
  $('btnSellAll').disabled = !owned.length;
  $('btnSellAll').textContent = 'Jual Semua Ikan' + (owned.length ? ' (+' + fmt(totalValue()) + ')' : '');
}

function initButtons() {
  function press(id, fn) {
    $(id).addEventListener('pointerdown', function (e) { e.preventDefault(); fn(); });
  }
  var fb = $('btnFish');                           // LEMPAR: tahan untuk mengisi tenaga, lepas untuk melempar
  fb.addEventListener('pointerdown', function (e) { e.preventDefault(); try { fb.setPointerCapture(e.pointerId); } catch (err) { /* abaikan */ } if (scene) scene.fishDown(); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) { fb.addEventListener(ev, function () { if (scene) scene.fishUp(); }); });
  fb.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  press('btnTalk', function () { if (scene) scene.pressTalk(); });
  press('btnBag', function () { Modal.toggle('inv'); });
  press('btnSound', function () { Snd.cycle(); updateSoundBtn(); });
  document.addEventListener('pointerdown', function (e) { var t = e.target; if (t && t.closest && t.closest('.tab,.btn,.row,.slot,.hb')) Snd.play('tick'); });
  press('btnProfile', function () { Modal.toggle('profile'); });
  press('btnZin', function () { if (!Ctl.modal) changeZoom(ZOOM_STEP); });
  press('btnZout', function () { if (!Ctl.modal) changeZoom(-ZOOM_STEP); });
  window.addEventListener('wheel', function (e) { if (!Ctl.modal && e.deltaY) changeZoom(e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP); }, { passive: true });
  var pn = $('pfName');
  pn.addEventListener('change', function () {
    Save.data.name = cleanName(pn.value); pn.value = Save.data.name;
    Save.write(); UI.setLevel(false);
  });
  pn.addEventListener('keydown', function (e) { if (e.key === 'Enter') pn.blur(); });
  pn.addEventListener('focus', function () { try { pn.select(); } catch (err) { /* abaikan */ } });
  $('tabShopFish').addEventListener('click', function () { shopTab = 'fish'; renderShop(); });
  $('tabShopRod').addEventListener('click', function () { shopTab = 'rod'; npcLine = 'Joran bagus bikin tangkapan lebih besar. Butuh tingkat dan Koin yang cukup, ya!'; renderShop(); });
  $('tabShopBait').addEventListener('click', function () { shopTab = 'bait'; npcLine = 'Umpan dibeli per ' + BAIT_PACK + ' biji dan terpakai 1 per lemparan. Pilih yang cocok dengan tujuanmu!'; renderShop(); });
  press('btnSkill', function () { Modal.toggle('skill'); });
  press('btnHelp', function () { Modal.toggle('help'); });
  press('btnBook', function () { Modal.toggle('book'); });
  $('skillCols').addEventListener('click', function (e) { var b = e.target.closest ? e.target.closest('.skBuy') : null; if (b) buySkill(b.getAttribute('data-k'), +b.getAttribute('data-n') || 1); });
  Array.prototype.forEach.call(document.querySelectorAll('button'), function (b) { b.addEventListener('mousedown', function (e) { e.preventDefault(); }); });   // tombol tidak menyimpan fokus => Spasi tidak menekan ulang tombol
  $('tabBag').addEventListener('click', function () { invTab = 'bag'; renderInventory(); });
  $('tabCol').addEventListener('click', function () { invTab = 'col'; renderInventory(); });
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
      setTimeout(function () { resetArm = 0; b.textContent = 'Hapus Data'; }, 3000);
      return;
    }
    Save.reset(); resetArm = 0; b.textContent = 'Hapus Data';
    invSel = null; shopSel = null; slotSel = null; moveFrom = null; Equip.sel = 0;
    UI.setCoins(false); UI.setBag(); UI.setLevel(false); UI.setZoomBtns(); Hotbar.render();
    if (scene) scene.resetPlayer();
    renderInventory();
    UI.toast('Data game direset', '#ff7b7b', false, 1800);
  });
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  window.addEventListener('resize', fitStage);
  window.addEventListener('orientationchange', function () { setTimeout(fitStage, 200); });
  document.addEventListener('fullscreenchange', function () { fitStage(); setTimeout(fitStage, 250); });
  document.addEventListener('webkitfullscreenchange', function () { fitStage(); setTimeout(fitStage, 250); });

  // tombol LARI: tahan untuk berlari, lepas untuk berjalan lagi (tidak mengganggu joystick / tombol pancing)
  var rb = $('btnRun');
  function runOff() { Ctl.sprint = false; rb.classList.remove('on'); }
  rb.addEventListener('pointerdown', function (e) { e.preventDefault(); Ctl.sprint = true; rb.classList.add('on'); try { rb.setPointerCapture(e.pointerId); } catch (err) { /* abaikan */ } });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) { rb.addEventListener(ev, runOff); });
  rb.addEventListener('contextmenu', function (e) { e.preventDefault(); });
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

/* =====================================================================
   WAKTU GAME, CUACA MUTASI, SUARA
   ===================================================================== */

/* ---------- Waktu game: 24 jam nyata = 4 hari game (1 hari game = 6 jam nyata) ----------
   Dihitung dari jam nyata (Date.now), jadi waktu tetap berjalan walau pemain keluar dari game. */
var DAY_REAL_MS = 6 * 3600 * 1000;
function gameClock(now) {
  now = now === undefined ? Date.now() : now;
  var hour = (now % DAY_REAL_MS) / DAY_REAL_MS * 24;
  return { hour: hour, h: Math.floor(hour), m: Math.floor((hour % 1) * 60), day: Math.floor(now / DAY_REAL_MS) };
}
/* warna pengali (multiply) untuk dunia + faktor malam n (0 = siang, 1 = malam pekat) */
var LIGHT_KEYS = [
  { h: 0,    c: [92, 108, 176],  n: 1 },
  { h: 4.8,  c: [96, 112, 180],  n: 1 },
  { h: 5.8,  c: [168, 140, 178], n: 0.75 },
  { h: 6.6,  c: [255, 200, 156], n: 0.35 },
  { h: 8,    c: [255, 242, 220], n: 0.05 },
  { h: 10,   c: [255, 255, 255], n: 0 },
  { h: 15.5, c: [255, 255, 255], n: 0 },
  { h: 17,   c: [255, 238, 205], n: 0.05 },
  { h: 18,   c: [255, 190, 130], n: 0.3 },
  { h: 19,   c: [226, 124, 116], n: 0.6 },
  { h: 20,   c: [140, 112, 172], n: 0.85 },
  { h: 21.3, c: [96, 112, 180],  n: 1 },
  { h: 24,   c: [92, 108, 176],  n: 1 }
];
function lightAt(hour) {
  var i = 0;
  while (i < LIGHT_KEYS.length - 2 && hour >= LIGHT_KEYS[i + 1].h) i++;
  var a = LIGHT_KEYS[i], b = LIGHT_KEYS[i + 1], t = Math.max(0, Math.min(1, (hour - a.h) / (b.h - a.h)));
  return { c: [a.c[0] + (b.c[0] - a.c[0]) * t, a.c[1] + (b.c[1] - a.c[1]) * t, a.c[2] + (b.c[2] - a.c[2]) * t], n: a.n + (b.n - a.n) * t };
}
function periodName(h) { return h < 5 ? 'Malam' : h < 10 ? 'Pagi' : h < 15 ? 'Siang' : h < 18.5 ? 'Sore' : 'Malam'; }

/* ---------- Cuaca mutasi: tiap cuaca MENAIKKAN PELUANG SATU MUTASI TERTENTU ----------
   Contoh: Hujan Emas -> ikan yang ditangkap punya peluang bermutasi Emas. Tiap kejadian berlangsung WX_DURATION_MS (5 menit).
   Dalam 1 hari nyata (jam lokal) ada WX_PER_DAY kejadian (1-4, minimal 1), tersebar rata: hari dibagi sebanyak itu bagian
   dan satu kejadian jatuh di waktu acak tiap bagian. Peluang mutasi tiap kejadian acak 25%-100% (kelipatan 5).
   Semua deterministik dari jam nyata (hash), jadi sama untuk semua perangkat dan tetap berjalan walau game ditutup. */
var WX_DURATION_MS = 5 * 60 * 1000, WX_MIN_CHANCE = 25, WX_MAX_CHANCE = 100, WX_STEP = 5;
var WX_PER_DAY = [{ n: 1, w: 30 }, { n: 2, w: 35 }, { n: 3, w: 20 }, { n: 4, w: 15 }];       // peluang jumlah kejadian per hari
var WEATHERS = [    // mutId = mutasi yang dinaikkan; w = bobot kemunculan; night = hanya muncul malam hari game
  { id: 'kabut',  mutId: 'albino',  name: 'Kabut Albino',   w: 30, rain: 0,   fog: 0.55, dark: 0.94, color: '#eef0ff' },
  { id: 'emas',   mutId: 'emas',    name: 'Hujan Emas',     w: 28, rain: 0.6, fog: 0.05, dark: 0.92, color: '#ffd54a', rainColor: 'rgba(255,214,90,0.7)' },
  { id: 'kristal',mutId: 'kristal', name: 'Hujan Kristal',  w: 20, rain: 0.5, fog: 0.1,  dark: 0.93, color: '#7ae8ff', rainColor: 'rgba(122,232,255,0.7)' },
  { id: 'neon',   mutId: 'neon',    name: 'Badai Neon',     w: 14, rain: 1,   fog: 0.12, dark: 0.76, color: '#ff5ee8', rainColor: 'rgba(255,94,232,0.65)', storm: true, flash: '#ff9af0' },
  { id: 'galaksi',mutId: 'kosmik',  name: 'Aurora Galaksi', w: 8,  night: true, aurora: 1, dark: 1, color: '#b48cff' }
];
var wxDayCache = { day: null, list: [] };
function wxEventsOfDay(day, dayStart) {
  if (wxDayCache.day === day) return wxDayCache.list;
  var r = hash(day, 31, 3) * 100, cnt = WX_PER_DAY[WX_PER_DAY.length - 1].n, i, k;
  for (i = 0; i < WX_PER_DAY.length; i++) { r -= WX_PER_DAY[i].w; if (r <= 0) { cnt = WX_PER_DAY[i].n; break; } }
  var seg = 24 * 3600 * 1000 / cnt, list = [];
  for (i = 0; i < cnt; i++) {
    var start = dayStart + i * seg + hash(day, 40 + i, 5) * (seg - WX_DURATION_MS);
    var night = lightAt(gameClock(start + WX_DURATION_MS / 2).hour).n >= 0.85;
    var pool = WEATHERS.filter(function (w) { return !w.night || night; }), tot = 0;
    pool.forEach(function (w) { tot += w.w; });
    var q = hash(day, 50 + i, 9) * tot, pick = pool[0];
    for (k = 0; k < pool.length; k++) { q -= pool[k].w; if (q <= 0) { pick = pool[k]; break; } }
    var steps = Math.floor((WX_MAX_CHANCE - WX_MIN_CHANCE) / WX_STEP) + 1;
    list.push({ type: pick, mutId: pick.mutId, chance: WX_MIN_CHANCE + WX_STEP * Math.min(steps - 1, Math.floor(hash(day, 60 + i, 2) * steps)), start: start, endsAt: start + WX_DURATION_MS });
  }
  wxDayCache = { day: day, list: list };
  return list;
}
function weatherAt(now) {            // kejadian cuaca yang sedang berlangsung, atau null
  now = now === undefined ? Date.now() : now;
  var off = -new Date(now).getTimezoneOffset() * 60000, DAY = 24 * 3600 * 1000;
  var day = Math.floor((now + off) / DAY), list = wxEventsOfDay(day, day * DAY - off);
  for (var i = 0; i < list.length; i++) if (now >= list[i].start && now < list[i].endsAt) return list[i];
  return null;
}
function weatherMut() { var w = weatherAt(); return w ? { id: w.mutId, chance: w.chance } : null; }   // mutasi yang sedang dinaikkan cuaca
function rarityIdx(r) { return Math.max(0, Object.keys(RARITY).indexOf(r)); }

/* ---------- Suara: sintesis WebAudio (tanpa file audio) ---------- */
var Snd = (function () {
  var ctx = null, master, sfxBus, musBus, ambBus, noiseBuf, rainG, mode = 0;       // mode 0 = semua, 1 = efek saja, 2 = senyap
  var env = { n: 0, rain: 0, storm: false }, nextMusic = 0, step = 0, melo = 3, nextBird = 0, nextCricket = 0, ticking = 0;
  try { mode = Math.max(0, Math.min(2, parseInt(localStorage.getItem('tf_snd'), 10) || 0)); } catch (e) { /* abaikan */ }

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function ready() { return ctx && ctx.state === 'running'; }

  function tone(f, t, dur, type, vol, o) {
    o = o || {};
    var osc = ctx.createOscillator(), g = ctx.createGain(), att = o.att || 0.005;
    osc.type = type || 'sine'; osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(o.bus || sfxBus); osc.start(t); osc.stop(t + dur + 0.05);
  }
  function noise(t, dur, vol, type, f0, f1, q, att, bus) {
    var src = ctx.createBufferSource(), flt = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; src.loop = true;
    flt.type = type; flt.frequency.setValueAtTime(f0, t); if (f1) flt.frequency.exponentialRampToValueAtTime(f1, t + dur); flt.Q.value = q || 1;
    att = att || 0.005;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt); flt.connect(g); g.connect(bus || sfxBus); src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }
  function shimmer(t, n, spread) { for (var k = 0; k < n; k++) tone(2000 + Math.random() * 2600, t + k * (spread / n), 0.25, 'sine', 0.035); }

  var PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19];
  var SFX = {
    tick:  function (t) { tone(1100, t, 0.04, 'square', 0.035, { to: 800 }); },
    open:  function (t) { tone(520, t, 0.12, 'triangle', 0.1, { to: 780 }); },
    close: function (t) { tone(700, t, 0.1, 'triangle', 0.08, { to: 440 }); },
    cast:  function (t) { noise(t, 0.3, 0.3, 'bandpass', 500, 2600, 1.2); tone(300, t, 0.2, 'sine', 0.05, { to: 700 }); },
    splash: function (t) { noise(t, 0.4, 0.32, 'lowpass', 3200, 500, 0.8); tone(380, t + 0.03, 0.1, 'sine', 0.1, { to: 900 }); tone(520, t + 0.1, 0.09, 'sine', 0.07, { to: 1100 }); },
    bite:  function (t) { tone(988, t, 0.12, 'square', 0.12); tone(1319, t + 0.11, 0.18, 'square', 0.12); tone(988, t + 0.28, 0.12, 'square', 0.09); tone(1319, t + 0.39, 0.2, 'square', 0.09); },
    reel:  function (t, p) { p = +p || 0; var f = 280 + 520 * p; tone(f, t, 0.07, 'triangle', 0.12, { to: f * 1.25 }); noise(t, 0.05, 0.07, 'highpass', 3000); },
    lose:  function (t) { tone(520, t, 0.45, 'sine', 0.16, { to: 160 }); noise(t, 0.3, 0.12, 'lowpass', 1200, 300); },
    coin:  function (t, n) { n = Math.max(1, Math.min(4, n | 0)); for (var k = 0; k < n; k++) { tone(1568, t + k * 0.07, 0.08, 'square', 0.07); tone(2093, t + k * 0.07 + 0.06, 0.2, 'square', 0.07); } },
    buy:   function (t) { tone(330, t, 0.1, 'triangle', 0.12); tone(1568, t + 0.08, 0.08, 'square', 0.07); tone(2093, t + 0.14, 0.22, 'square', 0.07); },
    skill: function (t) { [523, 659, 784, 1047].forEach(function (f, k) { tone(f, t + k * 0.07, 0.25, 'sine', 0.1); }); shimmer(t + 0.2, 4, 0.3); },
    error: function (t) { tone(160, t, 0.18, 'sawtooth', 0.08); },
    levelup: function (t) {
      [523, 659, 784, 1047].forEach(function (f, k) { tone(f, t + k * 0.12, k === 3 ? 0.7 : 0.2, 'triangle', 0.16); tone(f, t + k * 0.12, k === 3 ? 0.7 : 0.2, 'square', 0.04); });
      tone(262, t, 0.9, 'sine', 0.12); shimmer(t + 0.4, 8, 0.7);
    },
    catch: function (t, ri, mut, jumbo) {                // jingle makin panjang & megah untuk rarity tinggi
      ri = ri | 0;
      var n = Math.min(9, 3 + Math.round(ri * 1.3)), k, base = 523.25;
      for (k = 0; k < n; k++) {
        var f = base * Math.pow(2, PENTA[k] / 12), last = k === n - 1;
        tone(f, t + k * 0.075, last ? 0.5 : 0.14, 'triangle', 0.13); if (ri >= 2) tone(f * 2, t + k * 0.075, last ? 0.4 : 0.1, 'sine', 0.04);
      }
      if (ri >= 3) shimmer(t + 0.2, 6, 0.6);
      if (ri >= 4) { tone(131, t, 1, 'sine', 0.18); tone(196, t + 0.05, 1, 'sine', 0.12); shimmer(t + 0.3, 10, 1); }
      if (mut) { [1568, 2093, 2637, 3136].forEach(function (f, q) { tone(f, t + 0.1 + q * 0.06, 0.4, 'sine', 0.06); }); shimmer(t + 0.35, 6, 0.5); }
      if (jumbo) { tone(110, t, 0.35, 'sine', 0.2, { to: 55 }); noise(t, 0.35, 0.25, 'lowpass', 900, 200); }
    },
    step: function (t, surf, run) {
      var v = run ? 1.5 : 1;
      if (surf === 'wood') { tone(150, t, 0.09, 'sine', 0.1 * v, { to: 90 }); noise(t, 0.05, 0.05 * v, 'lowpass', 700, 300); }
      else if (surf === 'grass') noise(t, 0.06, 0.045 * v, 'bandpass', 1800, 1200, 1);
      else noise(t, 0.07, 0.05 * v, 'lowpass', 900, 400);
    },
    thunder: function (t) { noise(t, 2.8, 0.6, 'lowpass', 240, 45, 0.7, 0.25); tone(55, t + 0.1, 2, 'sine', 0.15, { to: 35, att: 0.4 }); }
  };

  /* ---------- musik generatif: pagi/siang riang, malam pelan ---------- */
  var DAY = { bpm: 84, mel: [60, 62, 64, 67, 69, 72, 74, 76], p: 0.5, ch: [[48, [0, 4, 7, 11]], [45, [0, 3, 7, 10]], [41, [0, 4, 7, 11]], [43, [0, 4, 7, 9]]] };
  var NIGHT = { bpm: 62, mel: [57, 60, 62, 64, 67, 69, 72, 76], p: 0.3, ch: [[45, [0, 3, 7, 10]], [41, [0, 4, 7, 11]], [48, [0, 4, 7, 11]], [43, [0, 4, 7, 9]]] };
  function scheduleStep(t, s) {
    var M = env.n > 0.6 ? NIGHT : DAY, bar = Math.floor(s / 8) % 4, pos = s % 8, ch = M.ch[bar], root = ch[0], notes = ch[1];
    var dur = 60 / M.bpm / 2, bus = musBus;
    if (pos === 0) {
      notes.slice(0, 3).forEach(function (iv) { tone(mtof(root + 12 + iv), t, dur * 8, 'sine', 0.035, { att: 0.7, bus: bus }); });
      tone(mtof(root), t, dur * 3.5, 'triangle', 0.1, { bus: bus });
    }
    if (pos === 4) tone(mtof(root + 7), t, dur * 3, 'triangle', 0.07, { bus: bus });
    var arp = [0, 1, 2, 3, 2, 1, 2, 1][pos];
    if (env.n <= 0.6 || pos % 2 === 0) tone(mtof(root + 12 + notes[arp] + 12), t, dur * 1.6, 'triangle', env.n > 0.6 ? 0.045 : 0.06, { bus: bus });
    if (pos % 2 === 0 && Math.random() < M.p) {
      melo = Math.max(0, Math.min(M.mel.length - 1, melo + (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.3 ? 2 : 1)));
      var f = mtof(M.mel[melo] + (env.n > 0.6 ? 12 : 0));
      tone(f, t, dur * 3, 'sine', 0.08, { bus: bus }); tone(f * 2, t, dur * 0.8, 'sine', 0.02, { bus: bus });
    }
  }

  function buildAmbient() {
    function loopSrc() { var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.start(0, Math.random() * 1.5); return s; }
    // ombak: derau lembut yang naik-turun pelan
    var w1 = loopSrc(), f1 = ctx.createBiquadFilter(), g1 = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    f1.type = 'lowpass'; f1.frequency.value = 650; g1.gain.value = 0.06; lfo.frequency.value = 0.11; lg.gain.value = 0.04;
    lfo.connect(lg); lg.connect(g1.gain); w1.connect(f1); f1.connect(g1); g1.connect(ambBus); lfo.start();
    var w2 = loopSrc(), f2 = ctx.createBiquadFilter(), g2 = ctx.createGain(), lfo2 = ctx.createOscillator(), lg2 = ctx.createGain();
    f2.type = 'bandpass'; f2.frequency.value = 2200; g2.gain.value = 0.012; lfo2.frequency.value = 0.17; lg2.gain.value = 0.01;
    lfo2.connect(lg2); lg2.connect(g2.gain); w2.connect(f2); f2.connect(g2); g2.connect(ambBus); lfo2.start();
    // hujan
    var r = loopSrc(), hp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 900; lp.type = 'lowpass'; lp.frequency.value = 6500;
    rainG = ctx.createGain(); rainG.gain.value = 0; r.connect(hp); hp.connect(lp); lp.connect(rainG); rainG.connect(ambBus);
  }

  function applyMode(instant) {
    if (!ctx) return;
    var t = ctx.currentTime, k = instant ? 0.001 : 0.15;
    sfxBus.gain.setTargetAtTime(mode < 2 ? 1 : 0, t, k);
    ambBus.gain.setTargetAtTime(mode < 2 ? 1 : 0, t, k);
    musBus.gain.setTargetAtTime(mode === 0 ? (env.storm ? 0.12 : 0.3) : 0, t, k * 4);
  }

  function tick() {
    if (!ready()) return;
    var now = ctx.currentTime;
    if (rainG) rainG.gain.setTargetAtTime(env.rain * 0.2, now, 1.5);
    if (mode === 0) {
      if (nextMusic < now) nextMusic = now + 0.1;
      var guard = 0;
      while (nextMusic < now + 0.9 && guard++ < 8) { scheduleStep(nextMusic, step++); nextMusic += 60 / (env.n > 0.6 ? NIGHT.bpm : DAY.bpm) / 2; }
    }
    if (mode < 2) {
      if (env.n < 0.3 && env.rain < 0.1 && now > nextBird) {
        nextBird = now + 3 + Math.random() * 6;
        var b0 = 2600 + Math.random() * 700, nb = 2 + Math.floor(Math.random() * 3);
        for (var k = 0; k < nb; k++) tone(b0 + k * 80, now + 0.05 + k * 0.1, 0.07, 'sine', 0.02, { to: b0 + 900, bus: ambBus });
      }
      if (env.n > 0.7 && env.rain < 0.3 && now > nextCricket) {
        nextCricket = now + 0.6 + Math.random() * 1.4;
        for (var q = 0; q < 3; q++) tone(4300, now + 0.05 + q * 0.055, 0.03, 'sine', 0.012, { bus: ambBus });
      }
    }
  }

  function init() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { ctx = null; return null; }
    var comp = ctx.createDynamicsCompressor();
    master = ctx.createGain(); master.gain.value = 0.8; master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); musBus = ctx.createGain(); ambBus = ctx.createGain();
    sfxBus.connect(master); musBus.connect(master); ambBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0), i;
    for (i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    buildAmbient(); applyMode(true);
    ticking = setInterval(tick, 200);
    return ctx;
  }
  function unlock() { init(); if (ctx && ctx.state === 'suspended') ctx.resume(); }
  ['pointerdown', 'keydown', 'touchend'].forEach(function (ev) { document.addEventListener(ev, unlock, { passive: true }); });
  document.addEventListener('visibilitychange', function () {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });

  return {
    play: function (name, a, b, c) {
      if (mode > 1 || !ready() || !SFX[name]) return;
      SFX[name](ctx.currentTime + 0.005, a, b, c);
    },
    env: function (n, rain, storm) {
      env.n = n; env.rain = rain; var was = env.storm; env.storm = !!storm;
      if (was !== env.storm) applyMode(false);
    },
    cycle: function () {
      mode = (mode + 1) % 3;
      try { localStorage.setItem('tf_snd', String(mode)); } catch (e) { /* abaikan */ }
      unlock(); applyMode(false);
      return mode;
    },
    mode: function () { return mode; }
  };
})();
var SND_LABEL = ['SUARA', 'EFEK', 'SENYAP'];
function updateSoundBtn() {
  var m = Snd.mode(), b = $('btnSound');
  if (!b) return;
  b.setAttribute('data-m', m);
  $('sndLbl').textContent = SND_LABEL[m];
}

/* ---------- HUD jam & cuaca ---------- */
var clkCache = '';
function updateClockHud(clk, n, wx) {
  var t = (clk.h < 10 ? '0' : '') + clk.h + ':' + (clk.m < 10 ? '0' : '') + clk.m + '|' + periodName(clk.hour) + '|' + (n > 0.5) + '|' + (wx ? wx.type.id + wx.start : '') + '|' + (wx ? Math.ceil((wx.endsAt - Date.now()) / 60000) : 0);
  if (t === clkCache) return;
  clkCache = t;
  $('clkTime').textContent = (clk.h < 10 ? '0' : '') + clk.h + ':' + (clk.m < 10 ? '0' : '') + clk.m;
  $('clkPeriod').textContent = periodName(clk.hour);
  $('clkIcon').className = n > 0.5 ? 'moon' : 'sun';
  var wc = $('wxChip');
  if (wx) {
    wc.hidden = false; wc.style.setProperty('--wc', wx.type.color);
    $('wxName').textContent = wx.type.name;
    $('wxInfo').textContent = 'Peluang ' + MUT_BY_ID[wx.mutId].name + ' ' + wx.chance + '% | sisa ' + Math.max(1, Math.ceil((wx.endsAt - Date.now()) / 60000)) + ' mnt';
  } else wc.hidden = true;
}


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
      this.textures.addCanvas('deep', makeDeep());
      this.textures.get('deep').setFilter(Phaser.Textures.FilterMode.LINEAR);
      var rd = outlined(makeRod(), '#2a1408', 1); this.textures.addCanvas('rod', rd.canvas); this.rodOrg = [rd.ox, rd.oy];
      var selfT = this; RODS.forEach(function (r) { selfT.textures.addCanvas('rod_' + r.id, outlined(makeRod(r.style), '#2a1408', 1).canvas); });
      this.textures.addCanvas('fist', outlined(makeFist(), '#5a3318', 1).canvas);
      this.textures.addCanvas('bobber', makeBobber());
      var isl = this.isl = makeIsland(M);
      this.textures.addCanvas('ground', isl.ground);
      isl.foam.forEach(function (c, k) { self.textures.addCanvas('foam' + k, c); });
      this.origins = {};
      PLAYER_SHEET = makePlayerSheet();
      var ps = this.textures.addCanvas('player', PLAYER_SHEET);
      HERO_FRAMES.forEach(function (fr) { ps.add(fr.key, 0, fr.x, fr.y, HC_W * 2, HC_H * 2); });
      var ns = this.textures.addCanvas('npc', makeNpcSheet());
      for (var nq = 0; nq < 4; nq++) ns.add('i' + nq, 0, nq * HC_W * 2, 0, HC_W * 2, HC_H * 2);
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

      // laut: 3 lapis tekstur halus bergerak + gradasi laut dalam, lalu pulau organik + buih ombak
      this.waves1 = this.add.tileSprite(0, 0, W, H, 'waves1').setOrigin(0, 0).setDepth(-100).setTileScale(AP, AP);
      this.waves2 = this.add.tileSprite(0, 0, W, H, 'waves2').setOrigin(0, 0).setDepth(-99).setAlpha(0.6).setTileScale(AP, AP);
      this.waves3 = this.add.tileSprite(0, 0, W, H, 'caustic').setOrigin(0, 0).setDepth(-98).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD).setTileScale(AP, AP);
      this.add.image(0, 0, 'deep').setOrigin(0, 0).setDisplaySize(W, H).setDepth(-97);
      this.add.image(isl.x, isl.y, 'ground').setOrigin(0, 0).setScale(AP).setDepth(-50);
      this.foamImg = this.add.image(isl.x, isl.y, 'foam0').setOrigin(0, 0).setScale(AP).setDepth(-49);
      var foamSeq = [0, 1, 2, 3, 2, 1], foamI = 0;
      this.time.addEvent({ delay: 240, loop: true, callback: function () { foamI = (foamI + 1) % foamSeq.length; self.foamImg.setTexture('foam' + foamSeq[foamI]); } });

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
            (self.nightLights = self.nightLights || []).push({ img: self.add.image(lp.x, lp.y - 38, 'glow').setBlendMode(Phaser.BlendModes.ADD).setScale(4.2).setAlpha(0).setDepth(9996), base: 0.55 });
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
      (this.nightLights = this.nightLights || []).push({ img: this.add.image(sp0.x, sp0.y - 46, 'glow').setBlendMode(Phaser.BlendModes.ADD).setScale(5).setAlpha(0).setDepth(9996), base: 0.45 });
      var np = this.gp(M.npc.gx, M.npc.gy, ELEV_LAND);
      this.shadowAt(np.x + 3, np.y, 28, 10, 1).setDepth(np.y - 1);
      this.npcSprite = this.add.sprite(np.x, np.y, 'npc', 'i0').setOrigin(0.5, HC_FOOT / HC_H).setDepth(np.y);
      this.add.text(np.x, np.y - 66, 'Pak Marlin', { fontFamily: 'Arial, sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#ffffff', stroke: '#06222c', strokeThickness: 4 })
        .setResolution(3).setOrigin(0.5, 1).setDepth(9000);
      var npcSeq = [0, 0, 1, 1, 2, 2, 3, 2, 2, 1, 1, 0], npcI = 0;
      this.time.addEvent({ delay: 330, loop: true, callback: function () { npcI = (npcI + 1) % npcSeq.length; self.npcSprite.setFrame('i' + npcSeq[npcI]); } });

      // penanda titik jatuh umpan (muncul saat menahan tombol LEMPAR)
      this.aimMark = this.add.ellipse(0, 0, 38, 17).setStrokeStyle(3, 0xffffff, 0.95).setDepth(9000).setVisible(false);

      // pemain
      this.dirIdx = 2; this.walkT = 0; this.curFrame = '';
      var sx0 = Save.data.px, sy0 = Save.data.py;
      this.gx = M.spawn.gx; this.gy = M.spawn.gy;
      if (typeof sx0 === 'number' && typeof sy0 === 'number' && this.canStand(sx0, sy0)) { this.gx = sx0; this.gy = sy0; }
      this.shadow = this.add.image(0, 0, 'shadow').setDisplaySize(26, 9);
      this.player = this.add.sprite(0, 0, 'player', 'F0:idle:0').setOrigin(0.5, HC_FOOT / HC_H);
      this.stride = 0;

      // pancing
      this.rodG = this.add.graphics();
      this.rod = this.add.image(0, 0, 'rod').setOrigin(this.rodOrg[0], this.rodOrg[1]).setVisible(false);
      this.held = this.add.image(0, 0, 'fish_' + FISH[0].id).setVisible(false);
      this.fist = this.add.image(0, 0, 'fist').setVisible(false);
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
      this.scale.on('resize', function (gs) { self.cameras.main.setSize(gs.width, gs.height); });
      cam.setBounds(0, 0, W, H);
      cam.roundPixels = true;
      cam.setZoom(Save.data.zoom);
      this.placePlayer();
      cam.centerOn(this.player.x, this.player.y - 20);
      cam.startFollow(this.player, true, 0.12, 0.12);

      // simpan posisi berkala
      this.time.addEvent({ delay: 4000, loop: true, callback: function () { self.savePos(); } });
      var saveNow = function () { self.savePos(); };
      document.addEventListener('visibilitychange', function () { if (document.hidden) saveNow(); });
      window.addEventListener('pagehide', saveNow);

      this.initEnv();
      UI.setCoins(false); UI.setBag();
      $('loading').classList.add('gone');
      if (IS_PC) UI.hint('PC: WASD / panah = jalan | Shift = lari | TAHAN Spasi lalu lepas = lempar | E = toko | K = keahlian | N = buku ikan | H = semua kontrol', 11000); else
      UI.hint('Geser joystick untuk berjalan. Hadap ke laut, TAHAN tombol LEMPAR: bar naik lalu turun lagi. Lepas tepat saat bar penuh untuk lemparan terjauh!', 9000);
    }

    /* ---------- siang-malam, cuaca, lampu malam ---------- */
    initEnv() {
      var self = this;
      this.dayRect = this.add.rectangle(0, 0, 9000, 7000, 0xffffff).setScrollFactor(0).setDepth(9995).setBlendMode(Phaser.BlendModes.MULTIPLY);
      var place = function () { self.dayRect.setPosition(self.scale.width / 2, self.scale.height / 2); };
      place(); this.scale.on('resize', place);
      // cahaya hangat di sekitar pemain saat malam
      this.playerGlow = this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setScale(3.4).setAlpha(0).setDepth(9996);
      // kunang-kunang di rumput (muncul malam)
      this.fireflies = [];
      var R = rng(77), tries = 0;
      while (this.fireflies.length < 16 && tries++ < 400) {
        var fi = Math.floor(R() * GRID), fj = Math.floor(R() * GRID);
        if (this.T[fj * GRID + fi] !== GRASS) continue;
        var p = this.gp(fi + R(), fj + R(), ELEV_LAND);
        var ff = this.add.image(p.x, p.y - 8 - R() * 14, 'glow').setBlendMode(Phaser.BlendModes.ADD).setScale(0.14).setTint(0xd6ff6a).setAlpha(0).setDepth(9996);
        this.tweens.add({ targets: ff, x: ff.x + (R() - 0.5) * 50, y: ff.y + (R() - 0.5) * 30, duration: 2500 + R() * 3000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.fireflies.push({ img: ff, ph: R() * 6 });
      }
      this.envNext = 0; this.envInit = false; this.wxLevel = 0; this.wxType = null; this.wxId = undefined; this.nextBolt = 0; this.nightN = 0;
      this.drops = [];
      this.rainCtx = $('wxRain').getContext('2d');
    }
    updateEnv(time, dt) {
      if (this.playerGlow) this.playerGlow.setPosition(this.player.x, this.player.y - 24);
      if (time >= this.envNext) {
        this.envNext = time + 350;
        var now = Date.now(), clk = gameClock(now), L = lightAt(clk.hour), wx = weatherAt(now), n = L.n;
        var id = wx ? wx.type.id + ':' + wx.start : null;
        if (id !== this.wxId) {
          var first = this.wxId === undefined;
          this.wxId = id;
          if (wx) {
            this.wxType = wx.type;
            if (first) this.wxLevel = 1;
            UI.toast('<div>' + wx.type.name + (first ? ' sedang berlangsung' : ' datang') + '<small>Ikan punya peluang ' + wx.chance + '% bermutasi ' + MUT_BY_ID[wx.mutId].name + ' (sisa ' + Math.max(1, Math.ceil((wx.endsAt - Date.now()) / 60000)) + ' mnt)</small></div>', wx.type.color, false, 4200);
          }
        }
        var target = wx ? 1 : 0, step = 0.35 / 10;
        this.wxLevel += Math.max(-step, Math.min(step, target - this.wxLevel));
        if (this.wxLevel <= 0.001 && !wx) { this.wxLevel = 0; this.wxType = null; }
        var T = this.wxType, lv = this.wxLevel, dk = T ? 1 + (T.dark - 1) * lv : 1;
        this.dayRect.setFillStyle(((Math.round(L.c[0] * dk) << 16) | (Math.round(L.c[1] * dk) << 8) | Math.round(L.c[2] * dk)));
        this.nightN = n;
        var storm = !!(T && T.storm);
        $('wxFog').style.opacity = T && T.fog ? (T.fog * lv).toFixed(2) : 0;
        $('wxAurora').style.filter = 'blur(18px) hue-rotate(70deg)'; $('wxAurora').style.opacity = T && T.aurora ? (lv * Math.min(1, n * 1.3)).toFixed(2) : 0;
        this.rainI = T && T.rain ? T.rain * lv : 0;
        if (storm && lv > 0.6 && time > this.nextBolt) {
          this.nextBolt = time + 5000 + Math.random() * 12000;
          var fl = $('wxFlash'); fl.style.background = (T && T.flash) || '#fff'; fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
          setTimeout(function () { Snd.play('thunder'); }, 350 + Math.random() * 1000);
        }
        // lampu malam: obor, kios, pemain, kunang-kunang
        var nl = this.nightLights || [], q;
        for (q = 0; q < nl.length; q++) nl[q].img.setAlpha(n * nl[q].base * (1 - 0.3 * (storm ? lv : 0)));
        this.playerGlow.setAlpha(n * 0.2);
        var ffOn = n > 0.45 && !(this.rainI > 0.3);
        for (q = 0; q < this.fireflies.length; q++) this.fireflies[q].on = ffOn;
        Snd.env(n, this.rainI || 0, storm && lv > 0.4);
        updateClockHud(clk, n, wx);
      }
      for (var k = 0; k < this.fireflies.length; k++) {
        var f = this.fireflies[k], tgt = f.on ? 0.55 + 0.4 * Math.sin(time * 0.004 + f.ph) : 0;
        f.img.setAlpha(f.img.alpha + (tgt - f.img.alpha) * 0.1);
      }
      this.drawRain(dt);
    }
    drawRain(dt) {
      var c = this.rainCtx, I = this.rainI || 0;
      if (!c) return;
      var cv = c.canvas, W0 = stageW, H0 = stageH;
      if (cv.width !== W0 || cv.height !== H0) { cv.width = W0; cv.height = H0; }
      if (I <= 0.01 && !this.drops.length) return;
      c.clearRect(0, 0, W0, H0);
      var want = Math.round(240 * I), d = this.drops, i;
      while (d.length < want) d.push({ x: Math.random() * (W0 + 200), y: Math.random() * H0, l: 10 + Math.random() * 14, v: 700 + Math.random() * 400 });
      if (d.length > want) d.length = Math.max(want, 0);
      if (!d.length) return;
      var slant = this.wxType && this.wxType.storm ? 0.35 : 0.15;
      c.strokeStyle = (this.wxType && this.wxType.rainColor) || (this.wxType && this.wxType.storm ? 'rgba(210,225,255,0.6)' : 'rgba(205,228,255,0.5)'); c.lineWidth = 1.5; c.beginPath();
      for (i = 0; i < d.length; i++) {
        var p = d[i];
        p.y += p.v * dt; p.x -= p.v * slant * dt;
        if (p.y > H0 + 20 || p.x < -40) { p.y = -20 - Math.random() * 60; p.x = Math.random() * (W0 + 200); }
        c.moveTo(p.x, p.y); c.lineTo(p.x + p.l * slant, p.y - p.l);
      }
      c.stroke();
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
    /* titik jatuh umpan di depan karakter: jarak ditentukan tenaga (0..1), arah = arah hadap */
    aimPoint(power) {
      var a = this.dirIdx * Math.PI / 4, dist = CAST_MIN + (CAST_MAX - CAST_MIN) * power;
      var sx = Math.cos(a) * dist, sy = Math.sin(a) * 0.5 * dist;
      return { gx: this.gx + (sx / 32 + sy / 16) / 2, gy: this.gy + (sy / 16 - sx / 32) / 2 };
    }
    waterAt(gx, gy) {
      var i = Math.floor(gx), j = Math.floor(gy);
      return i >= 0 && j >= 0 && i < GRID && j < GRID && this.T[j * GRID + i] === WATER;
    }
    autoAim() {                                  // bila arah hadap tidak mengenai air, putar ke arah laut terdekat
      var self = this, pw = [0.15, 0.4, 0.7, 1], offs = [0, 1, -1, 2, -2, 3, -3, 4], cur = this.dirIdx, k;
      function ok(d) { self.dirIdx = d; for (var q = 0; q < pw.length; q++) { var p = self.aimPoint(pw[q]); if (self.waterAt(p.gx, p.gy)) return true; } return false; }
      for (k = 0; k < offs.length; k++) { var d = (cur + offs[k] + 16) % 8; if (ok(d)) { this.dirIdx = d; return; } }
      this.dirIdx = cur;
    }
    fishDown() {
      if (Ctl.modal || !this.fish) return;
      var st = this.fish.state;
      if (st === 'idle') this.beginCharge();
      else if (st === 'casting' || st === 'waiting') this.cancelFish('Kail ditarik kembali');
      else if (st === 'bite') this.startReel();
      else if (st === 'reel') this.reelPull();
    }
    fishUp() { if (this.fish && this.fish.state === 'charge') this.releaseCast(); }
    pressFish() { this.fishDown(); }
    pressTalk() {
      if (Ctl.modal || !this.nearNpc) return;
      if (this.fish.state !== 'idle' && this.fish.state !== 'cooldown') return;
      Modal.open('shop');
    }
    /* Phaser: flipX memantulkan gambar terhadap TENGAH frame (titik asal tidak ikut berpindah).
       Agar titik pegang tetap di tangan saat menghadap kiri, titik asal dicerminkan juga. */
    placeRod(hand, ang, back) {
      var p = this.foot, left = Math.cos(ang) < 0, rk = 'rod_' + Save.data.rod;
      if (this.rodKey !== rk) { this.rodKey = rk; this.rod.setTexture(rk); }
      this.rod.setOrigin(left ? 1 - this.rodOrg[0] : this.rodOrg[0], this.rodOrg[1]).setFlipX(left)
        .setRotation(left ? ang - Math.PI : ang).setPosition(hand.x, hand.y).setDepth(back ? p.y + 0.2 : p.y + 2).setVisible(true);
      this.fist.setVisible(!back).setPosition(hand.x, hand.y).setDepth(p.y + 2.3);   // kepalan tangan menggenggam gagang
    }
    hideRod() { this.rod.setVisible(false); this.fist.setVisible(false); }
    /* titik pegang joran. Menghadap belakang: joran dipegang di DEPAN karakter (menjauhi kamera),
       jadi pangkalnya tersembunyi di balik badan dan hanya batangnya yang menjulur ke atas. */
    rodFrame() {
      var p = this.foot, dv = DIRVIEW[this.dirIdx], fl = dv.flip ? -1 : 1, back = dv.v[0] === 'B';
      var h = HERO_HAND[this.curFrame] || [10, 16, -0.9];
      var hand = back ? { x: p.x + fl * 3, y: p.y - 28 } : { x: p.x + (h[0] * 2 - HC_W) * fl, y: p.y + (h[1] * 2 - HC_FOOT * 2) };
      return { hand: hand, fl: fl, back: back, ang: (h[2] === null || h[2] === undefined) ? null : h[2] };
    }
    updateHeld(time) {
      var f = this.fish, p = this.foot, dv = DIRVIEW[this.dirIdx], fl = dv.flip ? -1 : 1, back = dv.v[0] === 'B';
      var fishing = f.state !== 'idle' && f.state !== 'cooldown', catching = f.state === 'cooldown' && f.caught;
      if (catching) {                                     // ikan diangkat tinggi dengan dua tangan
        this.hideRod();
        var cs = fishScale(f.caughtKg || 1);
        if (f.caughtId) this.held.setTexture('fish_' + f.caughtId).setVisible(true).setScale(cs).setFlipX(fl < 0)
          .setPosition(p.x + fl * 2, p.y - 60 - 7 * cs - Math.abs(Math.sin(f.t * 9)) * 3).setAngle(-8 * fl).setDepth(p.y + 3);
        return;
      }
      if (fishing) { this.held.setVisible(false); return; }
      var rf = this.rodFrame();
      if (Equip.sel === 0) {                              // joran dibawa miring ke depan-atas
        this.held.setVisible(false);
        var a = rf.ang === null ? -1.12 : rf.ang;
        if (rf.fl < 0) a = Math.PI - a;
        this.placeRod(rf.hand, a, rf.back);
      } else {
        this.hideRod();
        var id = heldFishId();
        if (!id) { this.held.setVisible(false); return; }
        var hs = fishScale(Save.data.kgs[Equip.sel - 1]);
        this.held.setTexture('fish_' + id).setVisible(true).setScale(hs).setFlipX(fl < 0)
          .setPosition(p.x + fl * 2, p.y - 60 - 7 * hs).setAngle(-8 * fl).setDepth(p.y + 3);
      }
    }
    rodGeometry() {
      var f = this.fish, p = this.foot;
      var tx = f.target ? (f.target.gx - f.target.gy) * 32 + W / 2 : p.x + 20;
      var ty = f.target ? (f.target.gx + f.target.gy) * 16 : p.y;
      var sgn = (tx - p.x) >= 0 ? 1 : -1;
      var rf = this.rodFrame(), hand = rf.hand;
      var ang = rf.ang === null ? -0.9 : rf.ang;
      if (f.state === 'bite') ang += Math.sin(this.time.now * 0.06) * 0.07;
      else if (f.state === 'reel') ang += (f.kick || 0) * 0.14;
      if (sgn < 0) ang = Math.PI - ang;
      var L = 59;
      return { hand: hand, tip: { x: hand.x + Math.cos(ang) * L, y: hand.y + Math.sin(ang) * L }, ang: ang, tx: tx, ty: ty, back: rf.back };
    }
    beginCharge() {                              // tekan & tahan: tenaga lempar mulai terisi
      if (freeSlots() === 0) { UI.toast('<div>Tas penuh (' + NSLOT + '/' + NSLOT + ')! Jual ikan ke Pak Marlin dulu.</div>', '#ff7b7b', false, 2400); return; }
      if (Equip.sel !== 0) { Equip.sel = 0; Hotbar.render(); }
      var f = this.fish;
      this.autoAim();
      f.state = 'charge'; f.t = 0; f.power = 0; f.peak = 0; f.castPower = 0; f.caught = false; f.launch = null; f.target = null; f.aimOK = null;
      this.curFrame = '';
      this.bobber.setVisible(false);
    }
    endCharge() {
      var f = this.fish;
      f.state = 'idle'; f.t = 0; f.target = null;
      this.aimMark.setVisible(false); this.hideFishing();
      UI.setCastBar(false, 0, true);
    }
    releaseCast() {                              // lepas: umpan terlempar sejauh tenaga yang terkumpul
      var f = this.fish, pt = this.aimPoint(f.power);
      if (!this.waterAt(pt.gx, pt.gy)) {
        UI.toast('<div>Umpan jatuh di darat! Arahkan ke laut atau tahan lebih lama.</div>', '#ff7b7b', false, 1900);
        this.endCharge(); return;
      }
      f.target = { gx: pt.gx, gy: pt.gy, spot: null }; f.spot = null; f.luck = f.power; f.castPower = f.power;
      f.baitId = null;
      var ub = activeBait();                               // umpan terpakai 1 tiap lemparan (di air)
      if (ub) {
        f.baitId = ub.id; Save.data.baits[ub.id] = baitCount(ub.id) - 1;
        if (Save.data.baits[ub.id] <= 0) { delete Save.data.baits[ub.id]; Save.data.bait = null; UI.toast('<div>' + ub.name + ' habis<small>Kembali tanpa umpan</small></div>', ub.accent, false, 2000); }
        Save.write(); Hotbar.render();
      }
      f.state = 'casting'; f.t = 0; f.launch = null; f.caught = false;
      Snd.play('cast');
      this.aimMark.setVisible(false); UI.setCastBar(false, 0, true);
      var g = this.rodGeometry();
      this.dirIdx = snapDir(g.tx - this.foot.x, (g.ty - this.foot.y) * 2);
      this.curFrame = '';
      f.tip = g.tip; f.bx = g.tx; f.by = g.ty;
      this.bobber.setVisible(true).setPosition(g.tip.x, g.tip.y);
    }
    splash(x, y) {
      var self = this;
      Snd.play('splash');
      for (var k = 0; k < 2; k++) {
        var e = this.add.ellipse(x, y, 30, 14).setStrokeStyle(3, 0xffffff, 0.95).setDepth(9400);
        this.tweens.add({ targets: e, scaleX: 2.6 + k, scaleY: 2.6 + k, alpha: 0, duration: 650 + k * 250, delay: k * 120, onComplete: function (tw, targets) { targets[0].destroy(); } });
      }
    }
    startBite() {
      var f = this.fish, bait = f.baitId ? BAITS_BY_ID[f.baitId] : null, cp = f.castPower || 0;
      var rc = rollCatch(bait, cp);                         // fishing-core: ikan di atas batas tenaga joran tidak pernah muncul
      f.def = rc.def; f.kg = rc.kg; f.mut = rc.mut;
      f.window = RARITY[f.def.rarity].window * FCA.reelWindowMultiplier(fishState(bait, cp));
      f.state = 'bite'; f.t = 0;
      Snd.play('bite');
      this.splash(f.bx, f.by);
      this.bang.setVisible(true);
    }
    hideFishing() {
      this.bobber.setVisible(false); this.ring.setVisible(false); this.bang.setVisible(false);
      this.rodG.clear(); this.hideRod(); this.held.setVisible(false);
    }
    cancelFish(msg) {
      var f = this.fish;
      if (f.state === 'idle') return;
      f.state = 'idle'; f.t = 0; f.def = null; f.caught = false;
      this.hideFishing();
      if (msg) UI.toast('<div>' + msg + '</div>', '#5fe0e6', false, 1400);
    }
    startReel() {
      var f = this.fish;
      f.state = 'reel'; f.t = 0; f.prog = 0.25; f.kick = 0; f.pulls = 0; var pw = curRod().power - 1, rb = reelOf(f.def.rarity);
      f.reel = { gain: rb.gain * (1 + 0.18 * pw), decay: rb.decay * (1 - 0.07 * pw) };      // power joran: tarikan lebih kuat, ikan lebih lambat menang
      this.bang.setVisible(false);
      this.reelPull();
    }
    reelPull() {
      var f = this.fish;
      f.prog = Math.min(1, f.prog + f.reel.gain);
      f.kick = 1; f.pulls++;
      Snd.play('reel', f.prog);
      if (f.pulls % 3 === 0) this.splash(f.bx, f.by);
      if (f.prog >= 1) this.landFish();
    }
    loseFish(msg) {
      var f = this.fish;
      f.state = 'cooldown'; f.t = 0; f.def = null; f.caught = false;
      this.hideFishing();
      Snd.play('lose');
      this.splash(f.bx, f.by);
      UI.toast('<div>' + (msg || 'Ikan lepas! Kamu terlambat menarik.') + '</div>', '#ff7b7b', false, 1900);
    }
    landFish() {
      var self = this, f = this.fish, def = f.def;
      if (!def) return;
      var first = !(Save.data.caught[def.id] > 0);
      var kg = f.kg || defaultKg(def), mut = f.mut || null, mm = mutMult(mut), price = Math.max(1, Math.round(priceOf(def.id, kg) * mm));
      if (addFishSlot(def.id, kg, mut) < 0) { Save.data.coins += price; UI.setCoins(true); }   // pengaman: tas penuh => otomatis terjual
      f.caughtId = def.id; f.caughtKg = kg;
      var isRec = kg > (Save.data.record[def.id] || 0), isJumbo = sizeT(def, kg) >= 0.85;
      if (isRec) Save.data.record[def.id] = kg;
      Save.data.caught[def.id] = (Save.data.caught[def.id] || 0) + 1;
      var gainXp = Math.round(xpOf(def, kg) * (1 + (mm - 1) * 0.5)) + (first ? XP_FIRST : 0), lvUp = addXp(gainXp);
      this.savePos();
      UI.setBag(); Hotbar.render();
      var rc = mut ? MUT_BY_ID[mut].color : RARITY[def.rarity].color, bx = f.bx, by = f.by, foot = this.foot;
      f.state = 'cooldown'; f.t = 0; f.def = null; f.caught = true;
      this.hideFishing();
      this.splash(bx, by);
      Snd.play('catch', rarityIdx(def.rarity), !!mut, isJumbo);

      // ikan melompat dari air ke pemain
      var jump = this.add.image(bx, by, 'fish_' + def.id).setScale(fishScale(kg)).setDepth(9600);
      if (mut) jump.setTint(parseInt(MUT_BY_ID[mut].color.slice(1), 16));
      this.tweens.addCounter({
        from: 0, to: 1, duration: 650,
        onUpdate: function (tw) {
          var v = tw.getValue();
          jump.setPosition(bx + (foot.x - bx) * v, by + (foot.y - 46 - by) * v - Math.sin(v * Math.PI) * 70);
          jump.setAngle(v * 360);
        },
        onComplete: function () { jump.destroy(); }
      });

      var r = RARITY[def.rarity];
      UI.toast(
        '<img src="' + ICON[def.id] + '" alt=""><div>' + (first ? 'BARU! ' : (isRec ? 'REKOR! ' : (isJumbo ? 'JUMBO! ' : ''))) + mutTag(mut) + def.name +
        '<small><span class="rar" style="color:' + rc + '">' + r.label + '</span> - ' + fmtKg(kg) + '</small>' +
        '<small>Jual ' + fmt(price) + ' Koin - +' + gainXp + ' Pengalaman</small></div>',
        rc, def.rarity === 'legendary' || def.rarity === 'epic', def.rarity === 'legendary' ? 4000 : 2800);
      if (lvUp.up) {                                   // pesan naik level muncul setelah pesan ikan selesai
        setTimeout(function () {
          Snd.play('levelup');
          UI.toast('<div>NAIK TINGKAT! Tingkat ' + lvUp.level + '<small>' + rankTitle(lvUp.level) + ' - hadiah +' + fmt(lvUp.coins) + ' Koin</small><small>+' + lvUp.gained + ' Poin Keahlian (tekan K)</small></div>', '#ffd54a', true, 3400);
        }, def.rarity === 'legendary' ? 4100 : 2900);
      }
    }

    /* ---------- loop utama ---------- */
    update(time, delta) {
      var dt = Math.min(delta, 50) / 1000;
      this.waves1.tilePositionX += 4.5 * dt; this.waves1.tilePositionY += 1.5 * dt;
      this.waves2.tilePositionX -= 3 * dt; this.waves2.tilePositionY += 2 * dt;
      this.waves3.tilePositionX += 2.5 * dt; this.waves3.tilePositionY += 1.2 * dt;

      var f = this.fish, paused = Ctl.modal;
      var mv = paused ? [0, 0] : readMove();
      this.mv = mv;
      var moving = Math.hypot(mv[0], mv[1]) > 0.28;

      // bergerak membatalkan pancingan yang masih menunggu
      if (moving && (f.state === 'waiting' || f.state === 'casting')) this.cancelFish('Kail ditarik kembali');
      var canMove = f.state === 'idle' || f.state === 'cooldown';
      var walking = false, wantRun = moving && !!(Ctl.sprint || Ctl.keys.sprint);

      if (moving && canMove) {
        this.dirIdx = snapDir(mv[0], mv[1]);
        var spd = wantRun ? RUN_SPEED : WALK_SPEED;
        var ang = this.dirIdx * Math.PI / 4;
        var vx = Math.cos(ang), vy = Math.sin(ang) * 0.5, l = Math.hypot(vx, vy);
        var sx = vx / l * spd * dt, sy = vy / l * spd * dt;
        var dgx = (sx / 32 + sy / 16) / 2, dgy = (sy / 16 - sx / 32) / 2;
        var ox = this.gx, oy = this.gy;
        if (this.canStand(this.gx + dgx, this.gy)) this.gx += dgx;
        if (this.canStand(this.gx, this.gy + dgy)) this.gy += dgy;
        walking = Math.abs(this.gx - ox) + Math.abs(this.gy - oy) > 1e-5;
        if (walking) { this.stride += spd * dt / (wantRun ? RUN_CYCLE : WALK_CYCLE); var sIx = Math.floor(this.stride * 2); if (sIx !== this.lastStep) { this.lastStep = sIx; var tt0 = this.typeAt(this.gx, this.gy); Snd.play('step', tt0 === DOCK ? 'wood' : (tt0 === GRASS ? 'grass' : 'sand'), wantRun); } }   // langkah mengikuti jarak tempuh => tidak meluncur
      }

      // pilih animasi: idle / walk / run / fish / cast / pull / catch
      var st0 = f.state, anim, k;
      if (st0 === 'charge') { anim = 'cast'; k = 0; }
      else if (st0 === 'casting') { anim = 'cast'; k = f.t < 0.14 ? 0 : (f.t < 0.26 ? 1 : (f.t < 0.4 ? 2 : 3)); }
      else if (st0 === 'waiting') { anim = 'fish'; k = Math.floor(time / 450) % 2; }
      else if (st0 === 'bite') { anim = 'fish'; k = Math.floor(time / 110) % 2; }
      else if (st0 === 'reel') { anim = 'pull'; k = f.kick > 0.45 ? 1 : 0; }
      else if (st0 === 'cooldown' && f.caught) { anim = 'catch'; k = Math.min(2, Math.floor(f.t / 0.2)); }
      else if (walking) { anim = (Equip.sel === 0 ? 'r' : 'f') + (wantRun ? 'run' : 'walk'); k = Math.floor(this.stride * 6) % 6; }
      else { anim = (Equip.sel === 0 ? 'r' : 'f') + 'idle'; k = IDLE_SEQ[Math.floor(time / 330) % IDLE_SEQ.length]; }
      var dv = DIRVIEW[this.dirIdx], key = dv.v + ':' + anim + ':' + k;
      if (key !== this.curFrame) { this.curFrame = key; this.player.setFrame(key); }
      if (this.player.flipX !== dv.flip) this.player.setFlipX(dv.flip);
      this.placePlayer();
      this.updateHeld(time);
      // kamera menjauh sedikit mengikuti jarak lemparan supaya umpan tetap terlihat
      var zb = Save.data.zoom, zt = zb, zk = 1.15 * zb / ZOOM_MAX;      // saat melempar, kamera menjauh sedikit dari zoom pilihan pemain
      if (st0 === 'charge') zt = Math.max(1.1, zb - zk * (f.peak || 0));      // zoom hanya menjauh saat menahan (tidak bolak-balik)
      else if (st0 === 'casting' || st0 === 'waiting' || st0 === 'bite' || st0 === 'reel') zt = Math.max(1.1, zb - zk * (f.castPower || 0));
      var cz = this.cameras.main;
      if (Math.abs(cz.zoom - zt) > 0.004) cz.setZoom(cz.zoom + (zt - cz.zoom) * Math.min(1, dt * 5)); else if (cz.zoom !== zt) cz.setZoom(zt);

      this.updateFishing(time, paused ? 0 : dt);
      this.updateHud();
      this.updateEnv(time, dt);
    }

    updateFishing(time, dt) {
      var f = this.fish, st = f.state;
      if (st === 'idle') return;
      if (st === 'charge' && Ctl.modal) { this.endCharge(); return; }
      if (st === 'charge') {
        f.t += dt;
        var ph = (f.t / CHARGE_TIME) % 2; f.power = ph <= 1 ? ph : 2 - ph;          // naik sampai penuh, lalu turun lagi (bolak-balik)
        if (f.power > (f.peak || 0)) f.peak = f.power;
        var mv0 = this.mv || [0, 0];
        if (Math.hypot(mv0[0], mv0[1]) > 0.35) this.dirIdx = snapDir(mv0[0], mv0[1]);     // geser joystick untuk membidik
        var pt = this.aimPoint(f.power), okw = this.waterAt(pt.gx, pt.gy);
        f.target = { gx: pt.gx, gy: pt.gy, spot: null };
        var ax = (pt.gx - pt.gy) * 32 + W / 2, ay = (pt.gx + pt.gy) * 16, pul = 1 + Math.sin(time * 0.012) * 0.08;
        if (f.aimOK !== okw) { f.aimOK = okw; this.aimMark.setStrokeStyle(3, okw ? 0xffffff : 0xff5252, 0.95); }
        this.aimMark.setVisible(true).setPosition(ax, ay).setScale(pul);
        UI.setCastBar(true, f.power, okw);
        var gc = this.rodGeometry();
        this.placeRod(gc.hand, gc.ang, gc.back);
        this.rodG.clear();
        return;
      }
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
        var T0 = 0.2;
        if (f.t < T0) { bx = g.tip.x; by = g.tip.y; sag = 2; }
        else {
          if (!f.launch) f.launch = { x: g.tip.x, y: g.tip.y };
          var pr = Math.min(1, (f.t - T0) / (0.55 - T0));
          bx = f.launch.x + (g.tx - f.launch.x) * pr;
          by = f.launch.y + (g.ty - f.launch.y) * pr - Math.sin(pr * Math.PI) * (30 + 55 * (f.castPower || 0));
          sag = 4;
          if (pr >= 1) {
            f.state = 'waiting'; f.t = 0; f.wait = FCA.biteDelay(2 + Math.random() * 3.5, fishState(f.baitId ? BAITS_BY_ID[f.baitId] : null, f.castPower || 0));
            this.splash(g.tx, g.ty);
          }
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
      this.placeRod(g.hand, g.ang, g.back);
      rg.lineStyle(0.7, (st === 'reel' && f.prog < 0.3) ? 0xff5252 : 0xffffff, 0.85); rg.beginPath(); rg.moveTo(g.tip.x, g.tip.y);
      for (var k = 1; k <= 14; k++) {
        var t = k / 14;
        rg.lineTo(g.tip.x + (bx - g.tip.x) * t, g.tip.y + (by - g.tip.y) * t + Math.sin(t * Math.PI) * sag);
      }
      rg.strokePath();
    }

    updateHud() {
      var f = this.fish, st = f.state, M = this.map;
      UI.setReel(st === 'reel', f.prog || 0);
      if (st === 'idle' || st === 'cooldown') {
        UI.setFishButton('LEMPAR', '', st === 'idle');
        UI.setBanner('', ''); UI.setSpot('');
      } else if (st === 'charge') {
        UI.setFishButton('LEPAS', 'bite', true); UI.setBanner('Lepas tepat saat bar PENUH untuk lemparan terjauh!', ''); UI.setSpot('');
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
  updateSoundBtn();
  resetJoy();
  UI.setCoins(false); UI.setBag(); UI.setLevel(false); UI.setZoomBtns();
  Hotbar.build(); Hotbar.render();
  if (Save.migrated > 0) UI.toast('<div>Tas ikan kini punya 50 kotak. ' + Save.migrated + ' ikan berlebih otomatis dijual.</div>', '#ffd54a', false, 3200);

  if (typeof Phaser === 'undefined') {
    $('loading').textContent = 'Phaser gagal dimuat. Periksa internet, atau taruh phaser.min.js di folder yang sama.';
    return;
  }
  gameRef = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: stageW, height: stageH,
    backgroundColor: '#1aa9c4',
    pixelArt: true,
    roundPixels: true,
    scale: { mode: Phaser.Scale.NONE },
    input: { mouse: false, touch: false, keyboard: false, gamepad: false },
    scene: [createSceneClass()]
  });
}

window.__TF = {
  gameClock: gameClock, lightAt: lightAt, weatherAt: weatherAt, weatherMut: weatherMut, WEATHERS: WEATHERS, Snd: Snd, fishState: fishState,
  rarityChances: rarityChances, mutChance: mutChance, jumboChance: jumboChance, FCA: FCA, skillLevel: skillLevel, rollCatch: rollCatch, BAITS: BAITS, buyBait: buyBait, cycleBait: cycleBait, setBait: setBait, activeBait: activeBait, maxRarity: maxRarity, MUTS: MUTS, renderSkills: renderSkills,
  Save: Save, levelInfo: levelInfo, skillPoints: skillPoints, buySkill: buySkill, buyRod: buyRod, equipRod: equipRod, totalLuck: totalLuck, slotPrice: slotPrice, renderShop: renderShop, setShopTab: function (t) { shopTab = t; }, RODS: RODS, SKILLS: SKILLS,
  buildMap: buildMap, makeIsland: makeIsland, makePlayerSheet: makePlayerSheet, makeNpcSheet: makeNpcSheet,
  makePalm: makePalm, makeBush: makeBush, makeRock: makeRock, makeStall: makeStall, makeWaves: makeWaves,
  makeFishCanvas: makeFishCanvas, Equip: Equip, Hotbar: Hotbar, addFishSlot: addFishSlot, freeSlots: freeSlots, sellFish: sellFish, sellEverything: sellEverything, renderInventory: renderInventory, Modal: Modal, syncInv: syncInv, getScene: function () { return scene; }, Ctl: Ctl, FISH: FISH, RARITY: RARITY, Save: Save, W: W, H: H, GRID: GRID, levelInfo: levelInfo, addXp: addXp, priceOf: priceOf, xpOf: xpOf, rollKg: rollKg
};

start();
})();
