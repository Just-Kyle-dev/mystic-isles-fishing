/* fishing-core (build otomatis, jangan diedit; sumber: fishing-core/src) */
(function (root) {
"use strict";
var __defs = {}, __cache = {};
function __req(name) {
  var k = name.replace(/^\.\//, "");
  if (__cache[k]) return __cache[k].exports;
  if (!__defs[k]) throw new Error("fishing-core: modul tidak ada: " + name);
  var m = { exports: {} }; __cache[k] = m; __defs[k](m, m.exports, __req); return m.exports;
}
__defs["fishAvailability"] = function (module, exports, require) {
/**
 * Tahap 1: ikan mana yang BOLEH masuk undian. Ikan yang tidak tersedia tidak pernah muncul, berapa pun Luck-nya.
 *
 * Skema ikan (minimal; boleh ditambah field lain):
 *  { id, name, rarity, weight=1,              // weight = bobot individual dalam rarity-nya
 *    islandIds?: string[], locationIds?: string[],   // kosong/tidak ada = di mana saja
 *    time?: { fromHour, toHour },                    // jam game [from,to), boleh melewati tengah malam (22 -> 5)
 *    requiredEventIds?: string[],                    // SEMUA event ini harus aktif
 *    requirements?: [{ type, ... }],                 // syarat khusus via registerRequirement()
 *    enabled?: boolean, kg?: [min,max] }
 * Konteks: { islandId, locationId, gameTime:{hour}, activeEvents:[{id}], player, rod, ... }
 */
const requirementCheckers = new Map();

/** Daftarkan jenis syarat baru tanpa mengubah modul ini, mis. registerRequirement('minRodPower', (req, ctx) => ...). */
function registerRequirement(type, checker) {
  if (typeof type !== 'string' || typeof checker !== 'function') throw new Error('registerRequirement: argumen tidak valid');
  requirementCheckers.set(type, checker);
}

function inHourWindow(hour, from, to) {
  if (from === to) return true;
  return from < to ? hour >= from && hour < to : hour >= from || hour < to;
}

/** Mengembalikan null bila tersedia, atau string alasan bila tidak. */
function whyUnavailable(fish, ctx, opts) {
  const c = ctx || {};
  if (fish.enabled === false) return 'dinonaktifkan';
  if (fish.islandIds && fish.islandIds.length && !fish.islandIds.includes(c.islandId)) return 'pulau tidak cocok';
  if (fish.locationIds && fish.locationIds.length && !fish.locationIds.includes(c.locationId)) return 'lokasi tidak cocok';
  if (fish.time) {
    const h = c.gameTime && c.gameTime.hour;
    if (typeof h !== 'number') return 'jam game tidak diketahui';
    if (!inHourWindow(((h % 24) + 24) % 24, fish.time.fromHour, fish.time.toHour)) return 'di luar jam';
  }
  const activeIds = new Set((c.activeEvents || []).map((e) => e.id));
  const needed = fish.requiredEventIds || [];
  for (const id of needed) if (!activeIds.has(id)) return 'event "' + id + '" tidak aktif';
  // Pengaman: ikan rarity eventOnly (Limited) wajib punya event pemicu
  const onlyEvent = opts && opts.eventOnlyRarities;
  if (onlyEvent && onlyEvent.has(fish.rarity) && !needed.length) return 'rarity khusus event tanpa event pemicu';
  for (const req of fish.requirements || []) {
    const chk = requirementCheckers.get(req.type);
    if (!chk) return 'syarat tidak dikenal: ' + req.type;   // gagal-aman: tolak
    if (!chk(req, c)) return 'syarat "' + req.type + '" tidak terpenuhi';
  }
  return null;
}

function isFishAvailable(fish, ctx, opts) { return whyUnavailable(fish, ctx, opts) === null; }
function getAvailableFish(fishList, ctx, opts) { return fishList.filter((f) => isFishAvailable(f, ctx, opts)); }

module.exports = { registerRequirement, isFishAvailable, getAvailableFish, whyUnavailable };

};
__defs["fishSelector"] = function (module, exports, require) {
const { weightedPick } = require('./weightedPick');

/** Tahap 3: pilih ikan dari daftar tersedia dengan rarity terpilih. Bobot individual (fish.weight, bawaan 1). */
function selectFish(poolOfRarity, rng) {
  if (!poolOfRarity.length) return null;
  return weightedPick(poolOfRarity, (f) => (f.weight === undefined ? 1 : f.weight), rng);
}

module.exports = { selectFish };

};
__defs["fishSizeCalculator"] = function (module, exports, require) {
const { ModifierRegistry, sumBonus } = require('./modifierRegistry');
const { evaluateCurve } = require('./skillGrowth');

/**
 * Tahap 5: ukuran (kg). Dipengaruhi skill Big Fish + bonus relevan, TIDAK memengaruhi rarity.
 * Berat dasar condong ke kecil (t = u^skewExponent); "jumbo" (peluang dalam persen) mendekati batas atas jenisnya.
 * Kurva skill Big Fish belum ditentukan -> bawaan 0 per level sampai dikonfigurasi.
 */
const DEFAULT_SIZE_CONFIG = {
  skewExponent: 1.7,                               // eksponen dasar (dipakai bila skew tidak diisi)
  skew: null,                                      // { base, perPower, min }: eksponen = max(min, base - perPower * ctx.castPower)
  normalTMax: 1,                                   // batas atas t untuk ikan non-jumbo (jumbo mengisi sisanya)
  jumbo: { baseChance: 0.5, minT: 0.85 },
  skillCurve: { type: 'linear', perLevel: 0 }    // PLACEHOLDER (belum ditentukan)
};

function roundKg(kg) { return Math.max(0.01, kg < 10 ? Math.round(kg * 100) / 100 : Math.round(kg * 10) / 10); }

function createBigFishRegistry(skillCurve) {
  const r = new ModifierRegistry();
  r.register('skill', (ctx) => {
    const lv = ctx.player && ctx.player.skills && ctx.player.skills.bigFish;
    return typeof lv === 'number' ? evaluateCurve(skillCurve, lv) : 0;
  });
  r.register('equipment', (ctx) => sumBonus(ctx.equipment, 'bigFishBonus'));
  r.register('potion', (ctx) => sumBonus(ctx.potions, 'bigFishBonus', ctx.now));
  r.register('event', (ctx) => sumBonus(ctx.activeEvents, 'bigFishBonus'));
  return r;
}

function createFishSizeCalculator(config, registry) {
  const cfg = Object.assign({}, DEFAULT_SIZE_CONFIG, config || {});
  cfg.jumbo = Object.assign({}, DEFAULT_SIZE_CONFIG.jumbo, (config && config.jumbo) || {});
  cfg.skew = Object.assign({ base: cfg.skewExponent, perPower: 0, min: cfg.skewExponent }, (config && config.skew) || {});
  const reg = registry || createBigFishRegistry(cfg.skillCurve);
  return {
    registry: reg,
    jumboChance(ctx) {
      let pct = cfg.jumbo.baseChance;
      for (const m of reg.collect(ctx)) pct += m.value;
      return Math.min(1, Math.max(0, pct / 100));
    },
    roll(fish, ctx, rng) {
      const [lo, hi] = fish.kg || [1, 1];
      const jumbo = rng.next() < this.jumboChance(ctx);
      const cp = Math.max(0, Math.min(1, (ctx && ctx.castPower) || 0));
      const exp = Math.max(cfg.skew.min, cfg.skew.base - cfg.skew.perPower * cp);
      const t = jumbo ? cfg.jumbo.minT + (1 - cfg.jumbo.minT) * rng.next() : cfg.normalTMax * Math.pow(rng.next(), exp);
      return { kg: roundKg(lo + (hi - lo) * t), jumbo };
    }
  };
}

module.exports = { DEFAULT_SIZE_CONFIG, createBigFishRegistry, createFishSizeCalculator, roundKg };

};
__defs["fishingService"] = function (module, exports, require) {
const { RARITY_ORDER, DEFAULT_RARITY_CONFIG, validateRarityConfig } = require('./rarityConfig');
const { createLuckRegistry, createLuckCalculator } = require('./luckCalculator');
const { createLuckScaling } = require('./luckScaling');
const { calculateRarityWeights } = require('./rarityCalculator');
const { createRarityRoller } = require('./rarityRoll');
const { getAvailableFish } = require('./fishAvailability');
const { selectFish } = require('./fishSelector');
const { createMutationCalculator } = require('./mutationCalculator');
const { createFishSizeCalculator } = require('./fishSizeCalculator');
const { createServerRng } = require('./rng');
const { evaluateCurve } = require('./skillGrowth');

/** Penyimpanan idempoten bawaan (memori). Di produksi ganti dengan DB/Redis yang punya operasi atomik (set-if-absent). */
function createMemoryActionStore(maxEntries) {
  const m = new Map(), cap = maxEntries || 100000;
  return {
    get: (k) => m.get(k),
    set: (k, v) => { m.set(k, v); if (m.size > cap) m.delete(m.keys().next().value); }
  };
}

/**
 * Service memancing sisi SERVER. Seluruh konteks (skill, joran, potion, event, waktu game, pulau) HARUS diambil
 * server dari data tepercaya, bukan dari body request client. Client hanya boleh mengirim "aksi memancing" + actionId.
 *
 * Pipeline: 1) ketersediaan -> 2) undian rarity -> 3) pilih ikan -> 4) mutasi -> 5) ukuran -> 6) hasil.
 */
function createFishingService(opts) {
  const o = opts || {};
  const fishList = o.fishList || [];
  const rarityConfig = validateRarityConfig(o.rarityConfig || DEFAULT_RARITY_CONFIG);
  const ids = new Set();
  for (const f of fishList) {
    if (!f.id || ids.has(f.id)) throw new Error('fishingService: id ikan kosong/duplikat: ' + f.id);
    if (!RARITY_ORDER.includes(f.rarity)) throw new Error('fishingService: rarity tidak dikenal pada ikan ' + f.id + ': ' + f.rarity);
    ids.add(f.id);
  }
  const eventOnlyRarities = new Set(RARITY_ORDER.filter((id) => rarityConfig.rarities[id].eventOnly));
  const luck = createLuckCalculator({ registry: o.luckRegistry || createLuckRegistry({ skillCurve: o.skillLuckCurve }) });
  const scaling = createLuckScaling(o.luckScaling);
  const mutation = createMutationCalculator(o.mutationConfig);
  const size = createFishSizeCalculator(o.sizeConfig);
  const rng = o.rng || createServerRng();
  const store = o.actionStore || createMemoryActionStore();
  const tangkas = Object.assign({ waitReductionCurve: { type: 'linear', perLevel: 0 }, minMultiplier: 0.1 }, o.tangkasConfig || {}); // PLACEHOLDER

  function eventOverrides(ctx) {
    const merged = {};
    for (const e of ctx.activeEvents || []) Object.assign(merged, e.rarityBaseOverrides || {});
    return merged;
  }

  /** Tahap 1+2 tanpa mengundi: ikan tersedia, Luck, faktor, dan peluang tiap rarity (untuk UI/simulasi/debug). */
  function previewRarity(ctx) {
    const available = getAvailableFish(fishList, ctx, { eventOnlyRarities });
    const availableRarities = [...new Set(available.map((f) => f.rarity))];
    const l = luck.calculate(ctx);
    const factor = scaling(l.totalLuck);
    const { entries } = calculateRarityWeights({ availableRarities, factor, config: rarityConfig, baseOverrides: eventOverrides(ctx) });
    return { available, luck: l, factor, entries };
  }

  /** Skill Tangkas: hanya memengaruhi WAKTU TUNGGU gigitan, tidak menyentuh peluang rarity. */
  function getBiteDelay(baseSeconds, ctx) {
    const lv = ctx.player && ctx.player.skills && ctx.player.skills.tangkas;
    const red = typeof lv === 'number' ? evaluateCurve(tangkas.waitReductionCurve, lv) : 0;
    return baseSeconds * Math.max(tangkas.minMultiplier, 1 - red / 100);
  }

  function resolveCatch(ctx) {
    if (!ctx || !ctx.playerId || !ctx.actionId) throw new Error('resolveCatch: playerId dan actionId wajib');
    const key = ctx.playerId + ':' + ctx.actionId;
    const prev = store.get(key);
    if (prev) return Object.assign({}, prev, { duplicate: true });   // request berulang: hasil sama, TANPA hadiah ganda

    const pre = previewRarity(ctx);
    let result;
    if (!pre.available.length) {
      result = { status: 'no_fish', duplicate: false };
    } else {
      const rarity = createRarityRoller(pre.entries).roll(rng);                       // Tahap 2
      const fish = selectFish(pre.available.filter((f) => f.rarity === rarity), rng); // Tahap 3
      const mut = mutation.roll(ctx, rng);                                            // Tahap 4
      const sz = size.roll(fish, ctx, rng);                                           // Tahap 5
      result = {                                                                      // Tahap 6
        status: 'ok', duplicate: false,
        fishId: fish.id, rarity, mutation: mut, kg: sz.kg, jumbo: sz.jumbo,
        totalLuck: pre.luck.totalLuck, luckFactor: pre.factor
      };
    }
    store.set(key, result);
    return result;
  }

  return { resolveCatch, previewRarity, getBiteDelay, luck, scaling, mutation, size, rarityConfig, fishList };
}

module.exports = { createFishingService, createMemoryActionStore };

};
__defs["fishingSimulator"] = function (module, exports, require) {
const { RARITY_ORDER, DEFAULT_RARITY_CONFIG } = require('./rarityConfig');
const { calculateRarityWeights } = require('./rarityCalculator');
const { createRarityRoller } = require('./rarityRoll');
const { createLuckScaling } = require('./luckScaling');
const { createSeededRng } = require('./rng');

const DEFAULT_LUCK_LEVELS = [100, 200, 400, 500, 1000, 1100, 2000, 5000, 10000];
const NORMAL_RARITIES = RARITY_ORDER.filter((id) => !DEFAULT_RARITY_CONFIG.rarities[id].eventOnly);

/** P(X >= k) untuk Poisson(lambda), exact (lambda kecil). */
function poissonUpperTail(k, lambda) {
  if (k <= 0) return 1;
  let term = Math.exp(-lambda), cdf = term;
  for (let i = 1; i < k; i++) { term *= lambda / i; cdf += term; }
  return Math.max(0, 1 - cdf);
}
function poissonLowerTail(k, lambda) {            // P(X <= k)
  let term = Math.exp(-lambda), cdf = term;
  for (let i = 1; i <= k; i++) { term *= lambda / i; cdf += term; }
  return Math.min(1, cdf);
}

/**
 * Apakah hasil simulasi wajar terhadap peluang teoretis?
 * lambda >= 30: pendekatan normal (|z| <= zLimit). lambda kecil: ekor Poisson eksak (p-value dua sisi >= pLimit).
 */
function withinVariance(actual, expected, trials, p, opts) {
  const zLimit = (opts && opts.zLimit) || 5, pLimit = (opts && opts.pLimit) || 1e-6;
  if (expected >= 30) {
    const z = (actual - expected) / Math.sqrt(trials * p * (1 - p));
    return { ok: Math.abs(z) <= zLimit, z, method: 'normal' };
  }
  const pv = Math.min(1, 2 * Math.min(poissonUpperTail(actual, expected), poissonLowerTail(actual, expected)));
  return { ok: pv >= pLimit, z: null, pValue: pv, method: 'poisson' };
}

/** Simulasikan undian rarity (Tahap 2) untuk satu nilai Total Luck (persen). */
function simulateRarity(p) {
  const trials = p.trials || 100000;
  const rng = p.rng || createSeededRng(p.seed === undefined ? 12345 : p.seed);
  const config = p.config || DEFAULT_RARITY_CONFIG;
  const scaling = p.scaling || createLuckScaling({ mode: 'none' });
  const available = p.availableRarities || NORMAL_RARITIES;
  const factor = scaling(p.luck);
  const { entries } = calculateRarityWeights({ availableRarities: available, factor, config, baseOverrides: p.baseOverrides });
  const roller = createRarityRoller(entries);
  const counts = {};
  for (const e of entries) counts[e.id] = 0;
  for (let i = 0; i < trials; i++) counts[roller.roll(rng)]++;
  const rows = entries.map((e) => {
    const expected = e.probability * trials, actual = counts[e.id];
    return Object.assign({ id: e.id, theoretical: e.probability, actualRate: actual / trials, count: actual, expected },
      withinVariance(actual, expected, trials, e.probability, p.variance));
  });
  return { luck: p.luck, factor, trials, rows, ok: rows.every((r) => r.ok) };
}

function simulateSuite(p) {
  const levels = (p && p.luckLevels) || DEFAULT_LUCK_LEVELS;
  return levels.map((luck, i) => simulateRarity(Object.assign({}, p, { luck, seed: ((p && p.seed) || 12345) + i })));
}

const pct = (x) => (x * 100).toPrecision(4) + '%';
function formatReport(results) {
  const lines = [];
  for (const r of results) {
    lines.push('', 'Luck ' + r.luck.toLocaleString('id-ID') + '% (F=' + r.factor + ', ' + r.trials.toLocaleString('id-ID') + ' percobaan) -> ' + (r.ok ? 'WAJAR' : 'MENYIMPANG'));
    lines.push('  rarity     jumlah     aktual        teoretis      harapan   uji');
    for (const x of r.rows) {
      lines.push('  ' + x.id.padEnd(10) + String(x.count).padStart(8) + '   ' + pct(x.actualRate).padStart(11) + '   ' + pct(x.theoretical).padStart(11) +
        '   ' + x.expected.toFixed(1).padStart(9) + '   ' + (x.ok ? 'ok' : 'GAGAL') + (x.z !== null ? ' z=' + x.z.toFixed(2) : ' p=' + x.pValue.toExponential(1)));
    }
  }
  return lines.join('\n');
}

module.exports = { DEFAULT_LUCK_LEVELS, simulateRarity, simulateSuite, formatReport, withinVariance, poissonUpperTail, poissonLowerTail };

};
__defs["gameAdapter"] = function (module, exports, require) {
/**
 * Adapter untuk game: membungkus fishing-core dengan data sederhana milik game (joran, umpan, level skill),
 * sehingga game.js tidak perlu tahu detail ctx/modifier. Cara pakai sama untuk browser (bundle) maupun server.
 *
 * state = {
 *   rod:   { power, luck },                     luck = bonus persen joran
 *   bait:  { luck, mut, big } | null,           umpan dihitung seperti potion (persen / %-poin)
 *   skills:{ luck, mut, big, swift },           LEVEL skill (mulai 1, tanpa batas)
 *   castPower: 0..1                             1 = lempar penuh
 * }
 * PENTING keamanan: di browser, hasilnya hanya cocok untuk mode offline/single-player. Untuk multiplayer, jalankan
 * adapter/service yang sama di SERVER dan kirim hanya hasilnya ke client.
 */
const { createFishingService } = require('./fishingService');
const { createLuckRegistry } = require('./luckCalculator');
const { RECOMMENDED_LUCK_SCALING } = require('./luckScaling');
const { registerRequirement } = require('./fishAvailability');
const { evaluateCurve } = require('./skillGrowth');
const { createServerRng } = require('./rng');

// Syarat ikan: tenaga joran minimal (pengganti pembatas rarity lama; sekarang per ikan sesuai spesifikasi "syarat khusus ikan")
registerRequirement('minRodPower', (req, ctx) => !!ctx.rod && ctx.rod.power >= req.min);

/** Kurva awal (USULAN, ubah di sini setelah balancing). Luck mengikuti spesifikasi: Lv.1 = +10%, Lv.100 = +1.000%. */
const DEFAULT_SKILL_CURVES = {
  luck:     { type: 'linear', perLevel: 10 },                                   // % Luck per level
  mutation: { type: 'linear', perLevel: 0.2 },                                  // %-poin peluang mutasi (21 poin ~ +4,2%, setara tingkat 6 lama)
  bigFish:  { type: 'linear', perLevel: 1 },                                    // %-poin peluang ikan jumbo
  tangkas:  { type: 'custom', fn: (lv) => 60 * (1 - Math.exp(-lv / 39)) }       // % pengurangan waktu tunggu, menuju maks 60%
};
const SKILL_KEY = { luck: 'luck', mut: 'mutation', big: 'bigFish', swift: 'tangkas' };

function createGameAdapter(opts) {
  const o = opts || {};
  const island = o.islandId || 'pulau_pertama';
  const curves = Object.assign({}, DEFAULT_SKILL_CURVES, o.skillCurves || {});
  const castLuck = typeof o.castLuck === 'number' ? o.castLuck : 40;
  let counter = 0;

  const fishList = o.fish.map((f) => ({
    id: f.id, rarity: f.rarity, kg: f.kg, weight: f.weight === undefined ? 1 : f.weight, islandIds: [island],
    requirements: f.minPower ? [{ type: 'minRodPower', min: f.minPower }] : []
  }));

  const luckRegistry = createLuckRegistry({ skillCurve: curves.luck });
  luckRegistry.register('cast', (ctx) => (ctx.cast ? (ctx.cast.power - 1) * castLuck : 0));   // lempar penuh = 0, pendek mengurangi

  const service = createFishingService({
    fishList, luckRegistry,
    luckScaling: o.luckScaling || RECOMMENDED_LUCK_SCALING,
    mutationConfig: {
      baseChance: typeof o.mutationBase === 'number' ? o.mutationBase : 0.5, skillCurve: curves.mutation, mutations: o.mutations || [],
      rarerShift: { stepPercent: 0.5, cap: 8, factor: 0.12 }
    },
    sizeConfig: {
      skillCurve: curves.bigFish, jumbo: { baseChance: typeof o.jumboBase === 'number' ? o.jumboBase : 0.5, minT: 0.85 },
      normalTMax: 0.85, skew: { base: 2.4, perPower: 0.5, min: 1.6 }
    },
    tangkasConfig: { waitReductionCurve: curves.tangkas, minMultiplier: 0.1 },
    rng: o.rng || createServerRng(),
    actionStore: { get: () => undefined, set: () => {} }          // lokal: tanpa idempotensi (server nyata memakai store atomik)
  });

  function ctxFrom(s) {
    const sk = s.skills || {}, cp = s.castPower === undefined ? 1 : s.castPower;
    return {
      playerId: 'local', actionId: 'a' + (++counter), islandId: island, castPower: cp, cast: { power: cp },
      player: { skills: { luck: sk.luck || 1, mutation: sk.mut || 1, bigFish: sk.big || 1, tangkas: sk.swift || 1 } },
      rod: { luckBonus: s.rod ? s.rod.luck : 0, power: s.rod ? s.rod.power : 1 },
      potions: s.bait ? [{ luckBonus: s.bait.luck || 0, mutationBonus: s.bait.mut || 0, bigFishBonus: s.bait.big || 0 }] : []
    };
  }

  return {
    service,
    /** Tahap 1-6. Mengembalikan { status, fishId, rarity, mutation, kg, jumbo, totalLuck, luckFactor }. */
    rollCatch: (s) => service.resolveCatch(ctxFrom(s)),
    luckInfo(s) { const p = service.previewRarity(ctxFrom(s)); return { totalLuck: p.luck.totalLuck, baseLuck: p.luck.baseLuck, modifiers: p.luck.modifiers, factor: p.factor }; },
    rarityChances: (s) => service.previewRarity(ctxFrom(s)).entries.map((e) => ({ r: e.id, p: e.probability })),
    mutationChance: (s) => service.mutation.chance(ctxFrom(s)) * 100,
    jumboChance: (s) => service.size.jumboChance(ctxFrom(s)) * 100,
    biteDelay: (baseSeconds, s) => service.getBiteDelay(baseSeconds, ctxFrom(s)),
    /** Tangkas juga melonggarkan jendela reaksi: 1 + pengurangan tunggu (%). */
    reelWindowMultiplier: (s) => 1 + evaluateCurve(curves.tangkas, (s.skills && s.skills.swift) || 1) / 100,
    /** Nilai efek skill pada level tertentu (untuk UI): key = luck | mut | big | swift. */
    skillBonus: (key, level) => evaluateCurve(curves[SKILL_KEY[key]], level)
  };
}

module.exports = { createGameAdapter, DEFAULT_SKILL_CURVES };

};
__defs["index"] = function (module, exports, require) {
module.exports = Object.assign({},
  require('./rng'), require('./weightedPick'), require('./modifierRegistry'), require('./skillGrowth'),
  require('./rarityConfig'), require('./luckCalculator'), require('./luckScaling'), require('./rarityCalculator'),
  require('./rarityRoll'), require('./fishAvailability'), require('./fishSelector'), require('./mutationCalculator'),
  require('./fishSizeCalculator'), require('./fishingService'), require('./fishingSimulator'), require('./sampleData'));
Object.assign(module.exports, require('./gameAdapter'));

};
__defs["luckCalculator"] = function (module, exports, require) {
const { ModifierRegistry, sumBonus } = require('./modifierRegistry');
const { evaluateCurve } = require('./skillGrowth');

const BASE_LUCK = 100; // persen. 100% = faktor 1

/**
 * Kurva Skill Luck AWAL (ILUSTRASI dari spesifikasi, BUKAN kurva final): Lv.1=+10%, Lv.10=+100%, Lv.50=+500%, Lv.100=+1.000%.
 * Ganti lewat konfigurasi setelah balancing.
 */
const DEFAULT_SKILL_LUCK_CURVE = { type: 'linear', perLevel: 10 };

/**
 * Registri bawaan. Bentuk konteks yang dibaca (semua opsional; HARUS dirakit server dari data tepercaya):
 *   ctx.player.skills.luck   level skill Luck
 *   ctx.rod.luckBonus        bonus persen dari joran
 *   ctx.equipment[]          { luckBonus }
 *   ctx.potions[]            { luckBonus, expiresAt? }  (dilewati bila expiresAt <= ctx.now)
 *   ctx.activeEvents[]       { id, luckBonus }
 * Sumber baru: registry.register('namaSumber', (ctx) => bonusPersen)
 */
function createLuckRegistry(options) {
  const curve = (options && options.skillCurve) || DEFAULT_SKILL_LUCK_CURVE;
  const r = new ModifierRegistry();
  r.register('skill', (ctx) => {
    const lv = ctx.player && ctx.player.skills && ctx.player.skills.luck;
    return typeof lv === 'number' ? evaluateCurve(curve, lv) : 0;
  });
  r.register('rod', (ctx) => (ctx.rod && typeof ctx.rod.luckBonus === 'number' ? ctx.rod.luckBonus : 0));
  r.register('equipment', (ctx) => sumBonus(ctx.equipment, 'luckBonus'));
  r.register('potion', (ctx) => sumBonus(ctx.potions, 'luckBonus', ctx.now));
  r.register('event', (ctx) => sumBonus(ctx.activeEvents, 'luckBonus'));
  return r;
}

function createLuckCalculator(options) {
  const registry = (options && options.registry) || createLuckRegistry();
  const baseLuck = options && typeof options.baseLuck === 'number' ? options.baseLuck : BASE_LUCK;
  return {
    registry,
    /** Total Luck = Base Luck + seluruh bonus aktif (dalam persen; 100 = faktor 1). Nilai tampilan TIDAK dibatasi. */
    calculate(ctx) {
      const modifiers = registry.collect(ctx).filter((m) => m.value !== 0);   // rincian hanya sumber yang berkontribusi
      let bonusTotal = 0;
      for (const m of modifiers) bonusTotal += m.value;
      return { baseLuck, modifiers, bonusTotal, totalLuck: baseLuck + bonusTotal };
    }
  };
}

/** Format mudah dibaca pemain, mis. 1450 -> "1.450%". */
function formatLuck(totalLuck) {
  const rounded = Math.round(totalLuck * 100) / 100;
  const [intPart, frac] = String(Math.abs(rounded).toFixed(2)).split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const f = frac === '00' ? '' : ',' + frac.replace(/0$/, '');
  return (rounded < 0 ? '-' : '') + grouped + f + '%';
}

module.exports = { BASE_LUCK, DEFAULT_SKILL_LUCK_CURVE, createLuckRegistry, createLuckCalculator, formatLuck };

};
__defs["luckScaling"] = function (module, exports, require) {
/**
 * Fungsi scaling Luck -> faktor efektif F yang masuk rumus W = B * F^S.
 * Total Luck yang DITAMPILKAN tidak pernah dibatasi; hanya F efektif yang bisa diredam.
 *
 * Mode:
 *   { mode:'none' }                       F = Luck/100   (rumus referensi, BAWAAN)
 *   { mode:'power', knee, exponent }      F <= knee: F; di atasnya F = knee * (F/knee)^exponent   (0 < exponent < 1)
 *   { mode:'log',   knee, k }             F <= knee: F; di atasnya F = knee * (1 + k*ln(F/knee))  (k > 0)
 *   { mode:'asymptotic', knee, max }      F <= knee: F; di atasnya F mendekati max tanpa pernah melewatinya (mulus, kemiringan 1 di knee)
 * Soft cap SENGAJA nonaktif secara bawaan: aktifkan setelah simulasi balancing (lihat fishingSimulator).
 */
function createLuckScaling(config) {
  const cfg = config || { mode: 'none' };
  const mode = cfg.mode || 'none';
  if (mode === 'power') {
    if (!(cfg.knee > 0) || !(cfg.exponent > 0 && cfg.exponent < 1)) throw new Error('luckScaling power: knee > 0 dan 0 < exponent < 1');
  } else if (mode === 'log') {
    if (!(cfg.knee > 0) || !(cfg.k > 0)) throw new Error('luckScaling log: knee > 0 dan k > 0');
  } else if (mode === 'asymptotic') {
    if (!(cfg.knee > 0) || !(cfg.max > cfg.knee)) throw new Error('luckScaling asymptotic: knee > 0 dan max > knee');
  } else if (mode !== 'none') throw new Error('luckScaling: mode tidak dikenal: ' + mode);

  return function effectiveFactor(totalLuckPercent) {
    if (typeof totalLuckPercent !== 'number' || Number.isNaN(totalLuckPercent)) throw new Error('luckScaling: Luck tidak valid');
    const F = Math.max(0, totalLuckPercent) / 100;
    if (!Number.isFinite(F)) throw new Error('luckScaling: Luck tak hingga');
    if (mode === 'none' || F <= cfg.knee) return F;
    if (mode === 'power') return cfg.knee * Math.pow(F / cfg.knee, cfg.exponent);
    if (mode === 'asymptotic') { const span = cfg.max - cfg.knee; return cfg.knee + span * (1 - Math.exp(-(F - cfg.knee) / span)); }
    return cfg.knee * (1 + cfg.k * Math.log(F / cfg.knee));
  };
}

/**
 * REKOMENDASI (hasil simulasi, lihat README): knee F=100 (Luck 10.000%) -> seluruh rentang uji spesifikasi (sampai 10.000%) tidak berubah;
 * max F=200 (Luck 20.000%) -> pada Luck berapa pun Common tetap ~15%, Legendary ~22%, Hidden ~1 per 650.
 */
const RECOMMENDED_LUCK_SCALING = Object.freeze({ mode: 'asymptotic', knee: 100, max: 200 });

module.exports = { createLuckScaling, RECOMMENDED_LUCK_SCALING };

};
__defs["modifierRegistry"] = function (module, exports, require) {
/**
 * Registri modifier modular. Fitur baru (potion, equipment, event, dst.) cukup memanggil register()
 * tanpa mengubah sistem inti. Sebuah "resolver" menerima konteks dan mengembalikan:
 *   - angka (bonus persen), atau
 *   - array { id, value } (beberapa bonus sekaligus), atau null/undefined (tidak ada bonus).
 */
class ModifierRegistry {
  constructor() { this.sources = new Map(); }

  register(sourceId, resolver) {
    if (typeof sourceId !== 'string' || !sourceId) throw new Error('ModifierRegistry: sourceId wajib');
    if (typeof resolver !== 'function') throw new Error('ModifierRegistry: resolver harus fungsi');
    this.sources.set(sourceId, resolver);
    return this;
  }

  unregister(sourceId) { return this.sources.delete(sourceId); }

  collect(ctx) {
    const out = [];
    for (const [source, resolver] of this.sources) {
      const r = resolver(ctx || {});
      if (r === null || r === undefined) continue;
      const list = Array.isArray(r) ? r : [{ id: source, value: r }];
      for (const m of list) {
        const value = typeof m === 'number' ? m : m && m.value;
        if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('ModifierRegistry: nilai bonus tidak valid dari "' + source + '"');
        out.push({ source, id: (m && m.id) || source, value });
      }
    }
    return out;
  }
}

/** Jumlah bonus dari daftar item { [key]: number } yang masih aktif (expiresAt > now bila ada). */
function sumBonus(list, key, now) {
  let t = 0;
  for (const x of list || []) {
    if (!x || typeof x[key] !== 'number') continue;
    if (typeof x.expiresAt === 'number' && typeof now === 'number' && x.expiresAt <= now) continue;
    t += x[key];
  }
  return t;
}

module.exports = { ModifierRegistry, sumBonus };

};
__defs["mutationCalculator"] = function (module, exports, require) {
const { ModifierRegistry, sumBonus } = require('./modifierRegistry');
const { evaluateCurve } = require('./skillGrowth');
const { weightedPick } = require('./weightedPick');

/**
 * Tahap 4: mutasi. TERPISAH dari rarity (tidak memengaruhi peluang rarity).
 * Kurva skill Mutation belum ditentukan di spesifikasi -> bawaan 0 per level (tidak berefek) sampai dikonfigurasi.
 * baseChance dalam persen. mutations: [{ id, name, weight, valueMultiplier }]
 */
const DEFAULT_MUTATION_CONFIG = {
  baseChance: 0.5,
  skillCurve: { type: 'linear', perLevel: 0 },   // PLACEHOLDER (belum ditentukan)
  mutations: []
};

function createMutationRegistry(skillCurve) {
  const r = new ModifierRegistry();
  r.register('skill', (ctx) => {
    const lv = ctx.player && ctx.player.skills && ctx.player.skills.mutation;
    return typeof lv === 'number' ? evaluateCurve(skillCurve, lv) : 0;
  });
  r.register('equipment', (ctx) => sumBonus(ctx.equipment, 'mutationBonus'));
  r.register('potion', (ctx) => sumBonus(ctx.potions, 'mutationBonus', ctx.now));
  r.register('event', (ctx) => sumBonus(ctx.activeEvents, 'mutationBonus'));
  return r;
}

function createMutationCalculator(config, registry) {
  const cfg = Object.assign({}, DEFAULT_MUTATION_CONFIG, config || {});
  const reg = registry || createMutationRegistry(cfg.skillCurve);
  return {
    registry: reg,
    /** Total bonus (persen-poin) dari semua modifier, TANPA pemotongan 100% (dipakai juga untuk menggeser ke mutasi langka). */
    bonus(ctx) { let b = 0; for (const m of reg.collect(ctx)) b += m.value; return b; },
    /** Peluang mutasi sebagai probabilitas 0..1. */
    chance(ctx) { return Math.min(1, Math.max(0, (cfg.baseChance + this.bonus(ctx)) / 100)); },
    roll(ctx, rng) {
      const p = this.chance(ctx);
      if (!cfg.mutations.length || rng.next() >= p) return null;
      let shift = 0;
      const rs = cfg.rarerShift;       // opsional: bonus mutasi menggeser pilihan ke mutasi yang lebih langka (indeks lebih besar)
      if (rs) shift = Math.min(rs.cap, Math.max(0, Math.round(this.bonus(ctx) / rs.stepPercent)));
      const rows = cfg.mutations.map((m, i) => ({ m, w: m.weight * (1 + shift * (rs ? rs.factor : 0) * i) }));
      const pick = weightedPick(rows, (x) => x.w, rng);
      return pick ? pick.m.id : null;
    }
  };
}

module.exports = { DEFAULT_MUTATION_CONFIG, createMutationRegistry, createMutationCalculator };

};
__defs["rarityCalculator"] = function (module, exports, require) {
const { RARITY_ORDER, DEFAULT_RARITY_CONFIG, getBaseChances } = require('./rarityConfig');
const { sumAscending } = require('./weightedPick');

/**
 * Hitung bobot dan peluang tiap rarity: W_i = B_i * F^S_i, lalu normalisasi ke tepat 100%.
 * Dihitung di ruang logaritma (log-sum-exp) sehingga tahan untuk Luck sangat besar maupun peluang sangat kecil.
 *
 * @param {object}   p
 * @param {string[]} p.availableRarities  rarity yang punya ikan tersedia (hasil Tahap 1)
 * @param {number}   p.factor             F efektif (Total Luck / 100, setelah scaling)
 * @param {object}  [p.config]            konfigurasi rarity
 * @param {object}  [p.baseOverrides]     override peluang dasar (persen), mis. dari event: { limited: 2 }
 * @returns {{factor:number, entries:Array<{id,baseChance,sensitivity,weight,probability}>}}
 */
function calculateRarityWeights(p) {
  const config = p.config || DEFAULT_RARITY_CONFIG;
  const F = p.factor;
  if (typeof F !== 'number' || !(F >= 0) || !Number.isFinite(F)) throw new Error('rarityCalculator: faktor Luck tidak valid: ' + F);
  const base = getBaseChances(config, p.baseOverrides);
  const avail = new Set(p.availableRarities);
  for (const id of avail) if (!RARITY_ORDER.includes(id)) throw new Error('rarityCalculator: rarity tidak dikenal: ' + id);

  const rows = [];
  for (const id of RARITY_ORDER) {
    if (!avail.has(id)) continue;
    const B = base[id], S = config.rarities[id].sensitivity;
    let logW;
    if (!(B > 0)) logW = -Infinity;
    else if (S === 0) logW = Math.log(B);
    else if (F === 0) logW = -Infinity;
    else logW = Math.log(B) + S * Math.log(F);
    rows.push({ id, baseChance: B, sensitivity: S, logW });
  }
  const finite = rows.filter((r) => r.logW > -Infinity);
  if (!finite.length) return { factor: F, entries: rows.map((r) => ({ id: r.id, baseChance: r.baseChance, sensitivity: r.sensitivity, weight: 0, probability: 0 })) };

  const maxLog = Math.max(...finite.map((r) => r.logW));
  const rel = rows.map((r) => (r.logW > -Infinity ? Math.exp(r.logW - maxLog) : 0));
  const total = sumAscending(rel);
  const entries = rows.map((r, i) => {
    const w = r.logW > -Infinity ? Math.exp(r.logW) : 0;
    return { id: r.id, baseChance: r.baseChance, sensitivity: r.sensitivity, weight: Number.isFinite(w) ? w : null, probability: rel[i] / total };
  });
  return { factor: F, entries };
}

module.exports = { calculateRarityWeights };

};
__defs["rarityConfig"] = function (module, exports, require) {
/**
 * Konfigurasi rarity. Urutan TETAP (tidak boleh diubah). ID internal dibuat berbeda ('legendary' vs 'limited').
 * Nama tampilan memakai bahasa Indonesia (Genesis tetap Genesis).
 * baseChance dalam PERSEN. Common tidak dipakai langsung: Common = 100 - jumlah peluang rarity lain (sisa pembulatan).
 * sensitivity = eksponen S pada W = B * F^S.
 */
const RARITY_ORDER = Object.freeze([
  'common', 'uncommon', 'rare', 'epic', 'legendary', 'divine', 'exalted', 'limited', 'genesis', 'hidden'
]);

const DEFAULT_RARITY_CONFIG = {
  remainderTo: 'common',
  rarities: {
    common:    { name: 'Biasa',    baseChance: 70,       sensitivity: 0 },
    uncommon:  { name: 'Tidak Biasa',  baseChance: 20,       sensitivity: 0.1 },
    rare:      { name: 'Langka',      baseChance: 8,        sensitivity: 0.4 },
    epic:      { name: 'Epik',      baseChance: 1.8,      sensitivity: 0.8 },
    legendary: { name: 'Legendaris', baseChance: 0.18,     sensitivity: 1.2 },
    divine:    { name: 'Ilahi',    baseChance: 0.018,    sensitivity: 1.5 },
    exalted:   { name: 'Agung',   baseChance: 0.0018,   sensitivity: 1.7 },
    // Limited: HANYA saat event aktif. Peluang & sensitivitas belum ditentukan di spesifikasi -> placeholder netral:
    // peluang dasar 0 (diisi oleh event lewat rarityBaseOverrides) dan sensitivitas 0 (tidak terpengaruh Luck). UBAH di sini.
    limited:   { name: 'Terbatas',   baseChance: 0,        sensitivity: 0, eventOnly: true },
    genesis:   { name: 'Genesis',   baseChance: 0.00018,  sensitivity: 1.9 },
    hidden:    { name: 'Tersembunyi',    baseChance: 0.000018, sensitivity: 2.0 }
  }
};

function validateRarityConfig(cfg) {
  if (!cfg || !cfg.rarities) throw new Error('rarityConfig: rarities wajib');
  const keys = Object.keys(cfg.rarities);
  if (keys.length !== RARITY_ORDER.length || RARITY_ORDER.some((id) => !(id in cfg.rarities))) {
    throw new Error('rarityConfig: harus berisi tepat 10 rarity: ' + RARITY_ORDER.join(', '));
  }
  for (const id of RARITY_ORDER) {
    const r = cfg.rarities[id];
    if (!(r.baseChance >= 0) || !Number.isFinite(r.baseChance)) throw new Error('rarityConfig: baseChance "' + id + '" tidak valid');
    if (!(r.sensitivity >= 0) || !Number.isFinite(r.sensitivity)) throw new Error('rarityConfig: sensitivity "' + id + '" tidak valid');
  }
  if (!(cfg.remainderTo in cfg.rarities)) throw new Error('rarityConfig: remainderTo tidak dikenal');
  return cfg;
}

/**
 * Peluang dasar efektif (persen) tiap rarity.
 * Sisa dari 100 dimasukkan ke rarity penampung (Common). Override event dipakai apa adanya (mis. limited).
 */
function getBaseChances(cfg, overrides) {
  validateRarityConfig(cfg);
  const out = {};
  let others = 0;
  for (const id of RARITY_ORDER) {
    const r = cfg.rarities[id];
    if (id === cfg.remainderTo || r.eventOnly) continue;
    others += r.baseChance;
  }
  for (const id of RARITY_ORDER) {
    const r = cfg.rarities[id];
    if (id === cfg.remainderTo) out[id] = Math.max(0, 100 - others);
    else out[id] = r.baseChance;
  }
  if (overrides) {
    for (const id of Object.keys(overrides)) {
      if (!(id in out)) throw new Error('rarityConfig: override untuk rarity tidak dikenal: ' + id);
      if (!(overrides[id] >= 0) || !Number.isFinite(overrides[id])) throw new Error('rarityConfig: override tidak valid untuk ' + id);
      out[id] = overrides[id];
    }
  }
  return out;
}

module.exports = { RARITY_ORDER, DEFAULT_RARITY_CONFIG, validateRarityConfig, getBaseChances };

};
__defs["rarityRoll"] = function (module, exports, require) {
const { createPicker } = require('./weightedPick');

/**
 * Pembuat "roller" rarity: tabel kumulatif dihitung sekali (cepat untuk jutaan simulasi), dijumlahkan dari peluang
 * terkecil agar Genesis/Hidden tetap bisa terpilih (tidak hilang oleh pembulatan).
 */
function createRarityRoller(entries) {
  const picker = createPicker(entries.filter((e) => e.probability > 0), (e) => e.probability);
  if (!picker) throw new Error('rarityRoll: tidak ada rarity dengan peluang > 0');
  return { roll: (rng) => picker.pick(rng.next()).id, pickAt: (u) => picker.pick(u).id };
}

function rollRarity(entries, rng) { return createRarityRoller(entries).roll(rng); }

module.exports = { createRarityRoller, rollRarity };

};
__defs["rng"] = function (module, exports, require) {
/**
 * Sumber angka acak. Semua modul menerima objek { next(): number } yang mengembalikan double seragam di [0, 1)
 * dengan resolusi 53 bit (cukup untuk peluang sekecil 1e-8 seperti Hidden; resolusi 32 bit akan terlalu kasar).
 */
function randomUint32Pair() {
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (c && typeof c.getRandomValues === 'function') {            // browser & Node modern
    const a = new Uint32Array(2); c.getRandomValues(a); return [a[0], a[1]];
  }
  const b = require('crypto').randomBytes(8);                    // Node lama
  return [b.readUInt32BE(0), b.readUInt32BE(4)];
}

/** RNG untuk SERVER (kriptografis). Jangan pernah dipakai/dipercaya dari client. */
function createServerRng() {
  return {
    next() {
      const [hi, lo] = randomUint32Pair();
      return ((hi >>> 5) * 67108864 + (lo >>> 6)) / 9007199254740992;
    }
  };
}

/** RNG berbenih (xoshiro128**) untuk simulasi & unit test yang bisa diulang. BUKAN untuk hasil tangkapan sungguhan. */
function createSeededRng(seed) {
  let a = seed | 0;
  const sm = () => {
    a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad); t ^= t >>> 15;
    t = Math.imul(t, 0x735a2d97); t ^= t >>> 15;
    return t | 0;
  };
  let s0 = sm(), s1 = sm(), s2 = sm(), s3 = sm();
  const rotl = (x, k) => (x << k) | (x >>> (32 - k));
  const next32 = () => {
    const r = Math.imul(rotl(Math.imul(s1, 5), 7), 9) >>> 0;
    const t = s1 << 9;
    s2 ^= s0; s3 ^= s1; s1 ^= s2; s0 ^= s3; s2 ^= t; s3 = rotl(s3, 11);
    return r;
  };
  return { next() { return ((next32() >>> 5) * 67108864 + (next32() >>> 6)) / 9007199254740992; } };
}

/** RNG untuk tes: mengembalikan nilai yang ditentukan satu per satu. */
function createSequenceRng(values) {
  let i = 0;
  return { next() { if (i >= values.length) throw new Error('createSequenceRng: nilai habis'); return values[i++]; } };
}

module.exports = { createServerRng, createSeededRng, createSequenceRng };

};
__defs["sampleData"] = function (module, exports, require) {
/**
 * DATA CONTOH: 10 ikan yang sudah ada di game saat ini (satu pulau, rarity common..legendary) + mutasi yang ada.
 * Rarity Divine..Hidden belum punya ikan: isi sendiri (nama, pulau, lokasi, bobot) saat kontennya siap.
 */
const SAMPLE_FISH = [
  { id: 'teri',     name: 'Teri Pantai',       rarity: 'common',    weight: 1, kg: [0.02, 0.12], islandIds: ['pulau_pertama'] },
  { id: 'kembung',  name: 'Kembung Biru',      rarity: 'common',    weight: 1, kg: [0.2, 0.8],   islandIds: ['pulau_pertama'] },
  { id: 'bandeng',  name: 'Bandeng Laguna',    rarity: 'common',    weight: 1, kg: [0.5, 2.5],   islandIds: ['pulau_pertama'] },
  { id: 'kakap',    name: 'Kakap Merah',       rarity: 'uncommon',  weight: 1, kg: [1, 6],       islandIds: ['pulau_pertama'] },
  { id: 'badut',    name: 'Ikan Badut Jingga', rarity: 'uncommon',  weight: 1, kg: [0.1, 0.5],   islandIds: ['pulau_pertama'] },
  { id: 'baronang', name: 'Baronang Tropis',   rarity: 'uncommon',  weight: 1, kg: [0.5, 2.5],   islandIds: ['pulau_pertama'] },
  { id: 'kerapu',   name: 'Kerapu Macan',      rarity: 'rare',      weight: 1, kg: [3, 25],      islandIds: ['pulau_pertama'] },
  { id: 'tenggiri', name: 'Tenggiri Emas',     rarity: 'rare',      weight: 1, kg: [2, 15],      islandIds: ['pulau_pertama'] },
  { id: 'tuna',     name: 'Tuna Sirip Kuning', rarity: 'epic',      weight: 1, kg: [20, 180],    islandIds: ['pulau_pertama'] },
  { id: 'naga',     name: 'Naga Laut Pelangi', rarity: 'legendary', weight: 1, kg: [40, 400],    islandIds: ['pulau_pertama'] }
];
const SAMPLE_MUTATIONS = [
  { id: 'albino',  name: 'Albino',  weight: 40, valueMultiplier: 1.5 },
  { id: 'emas',    name: 'Emas',    weight: 28, valueMultiplier: 2.5 },
  { id: 'kristal', name: 'Kristal', weight: 16, valueMultiplier: 4 },
  { id: 'neon',    name: 'Neon',    weight: 9,  valueMultiplier: 6 },
  { id: 'kosmik',  name: 'Kosmik',  weight: 3,  valueMultiplier: 12 }
];
module.exports = { SAMPLE_FISH, SAMPLE_MUTATIONS };

};
__defs["skillGrowth"] = function (module, exports, require) {
/**
 * Kurva pertumbuhan bonus skill terhadap level (dipisah agar mudah diubah setelah balancing).
 * Kurva: { type:'linear', perLevel }                    -> bonus = level * perLevel
 *        { type:'table', points:[[level,nilai],...] }   -> interpolasi linear, lanjut dengan kemiringan segmen terakhir
 *        { type:'custom', fn: (level) => nilai }        -> fungsi sendiri
 */
function evaluateCurve(curve, level) {
  if (!Number.isFinite(level) || level < 0) throw new Error('skillGrowth: level tidak valid: ' + level);
  if (!curve) return 0;
  switch (curve.type) {
    case 'linear': return level * curve.perLevel;
    case 'custom': return curve.fn(level);
    case 'table': {
      const p = curve.points.slice().sort((a, b) => a[0] - b[0]);
      if (!p.length) return 0;
      if (level <= p[0][0]) return p[0][1] * (p[0][0] ? level / p[0][0] : 1);
      for (let i = 1; i < p.length; i++) {
        if (level <= p[i][0]) { const [x0, y0] = p[i - 1], [x1, y1] = p[i]; return y0 + (y1 - y0) * (level - x0) / (x1 - x0); }
      }
      if (p.length === 1) return p[0][1];
      const [x0, y0] = p[p.length - 2], [x1, y1] = p[p.length - 1];
      return y1 + (y1 - y0) / (x1 - x0) * (level - x1);
    }
    default: throw new Error('skillGrowth: tipe kurva tidak dikenal: ' + curve.type);
  }
}

module.exports = { evaluateCurve };

};
__defs["weightedPick"] = function (module, exports, require) {
/**
 * Undian berbobot yang tahan masalah floating-point.
 * - Bobot diurutkan dari yang TERKECIL dan dijumlahkan dengan Kahan, sehingga bobot sangat kecil (Genesis/Hidden)
 *   tidak hilang tertelan bobot besar (Common).
 * - Pemilihan memakai jumlah kumulatif dari bobot terkecil; item terbesar menjadi penampung sisa.
 */
function sumAscending(values) {
  const s = values.slice().sort((a, b) => a - b);
  let total = 0, c = 0;
  for (let i = 0; i < s.length; i++) {
    const y = s[i] - c, t = total + y;
    c = (t - total) - y; total = t;
  }
  return total;
}

function createPicker(items, getWeight) {
  const entries = [];
  for (const item of items) {
    const w = getWeight(item);
    if (typeof w !== 'number' || !Number.isFinite(w) || w < 0) throw new Error('weightedPick: bobot tidak valid (' + w + ')');
    if (w > 0) entries.push({ item, w });
  }
  if (!entries.length) return null;
  entries.sort((a, b) => a.w - b.w);
  const total = sumAscending(entries.map((e) => e.w));
  const cum = [];
  let acc = 0;
  for (const e of entries) { acc += e.w; cum.push(acc); }
  return {
    size: entries.length,
    total,
    pick(u) {
      if (!(u >= 0 && u < 1)) throw new Error('weightedPick: nilai acak di luar [0,1): ' + u);
      const target = u * total;
      for (let i = 0; i < cum.length; i++) if (target < cum[i]) return entries[i].item;
      return entries[entries.length - 1].item;
    }
  };
}

function weightedPick(items, getWeight, rng) {
  const p = createPicker(items, getWeight);
  return p ? p.pick(rng.next()) : null;
}

module.exports = { sumAscending, createPicker, weightedPick };

};
root.FishingCore = __req("index");
})(typeof window !== "undefined" ? window : globalThis);
