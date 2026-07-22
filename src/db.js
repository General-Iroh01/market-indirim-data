/**
 * Yerel veritabanı katmanı — bağımlılıksız JSON dosya deposu.
 *
 * Not: better-sqlite3 gibi native (derleme gerektiren) paketler bu makinede
 * Visual Studio Build Tools istediği için kasıtlı olarak KULLANILMADI —
 * bu ölçekte (birkaç yüz kayıt) düz JSON dosyası hem yeterince hızlı hem de
 * sıfır kurulum riski taşıyor. Firebase/cloud'a bağımlı değil, tamamen
 * ücretsiz ve offline çalışır.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'discounts.json');

function loadRaw() {
  if (!fs.existsSync(DB_PATH)) {
    return { discounts: [], scrapeRuns: [] };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    return {
      discounts: Array.isArray(raw.discounts) ? raw.discounts : [],
      scrapeRuns: Array.isArray(raw.scrapeRuns) ? raw.scrapeRuns : [],
    };
  } catch (e) {
    console.warn('[db] discounts.json okunamadı/bozuk, sıfırdan başlanıyor:', e.message);
    return { discounts: [], scrapeRuns: [] };
  }
}

function saveRaw(data) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  // Atomik yazım: önce .tmp'ye yaz, sonra rename — yazma sırasında kesinti
  // olursa dosya yarım/bozuk kalmaz.
  const tmpPath = DB_PATH + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, DB_PATH);
}

/** Bir markanın taradığı ürünleri upsert eder ve o markada artık görünmeyen
 * (yani bu taramada gelmeyen) eski kayıtları siler — böylece kalkan
 * kampanyalar listede asılı kalmaz. */
function upsertBrandItems(brand, items) {
  const data = loadRaw();
  const keepIds = new Set(items.map(i => i.id));
  const others = data.discounts.filter(d => d.brand !== brand);
  const kept = data.discounts.filter(d => d.brand === brand && keepIds.has(d.id));
  const keptIds = new Set(kept.map(d => d.id));

  const merged = [...others, ...kept];
  for (const item of items) {
    const idx = merged.findIndex(d => d.id === item.id);
    if (idx >= 0) merged[idx] = item;
    else merged.push(item);
  }
  data.discounts = merged;
  saveRaw(data);
}

function getAllDiscounts() {
  const { discounts } = loadRaw();
  return [...discounts].sort((a, b) => {
    if (!a.startDate && !b.startDate) return 0;
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    return a.startDate.localeCompare(b.startDate);
  });
}

function getDiscountsByBrand(brand) {
  return getAllDiscounts().filter(d => d.brand === brand);
}

function recordScrapeStart(brand) {
  const data = loadRaw();
  const run = {
    id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    brand,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    status: 'running',
    itemCount: null,
    errorMessage: null,
  };
  data.scrapeRuns.push(run);
  saveRaw(data);
  return run.id;
}

function recordScrapeEnd(runId, { status, itemCount, errorMessage }) {
  const data = loadRaw();
  const run = data.scrapeRuns.find(r => r.id === runId);
  if (!run) return;
  run.finishedAt = new Date().toISOString();
  run.status = status;
  run.itemCount = itemCount ?? null;
  run.errorMessage = errorMessage ?? null;
  saveRaw(data);
}

function getLastScrapeRuns() {
  const { scrapeRuns } = loadRaw();
  const byBrand = {};
  for (const run of scrapeRuns) {
    const prev = byBrand[run.brand];
    if (!prev || run.startedAt > prev.startedAt) byBrand[run.brand] = run;
  }
  return Object.values(byBrand).sort((a, b) => a.brand.localeCompare(b.brand));
}

module.exports = {
  upsertBrandItems,
  getAllDiscounts,
  getDiscountsByBrand,
  recordScrapeStart,
  recordScrapeEnd,
  getLastScrapeRuns,
};
