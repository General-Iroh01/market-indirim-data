/**
 * Scraper çalıştırma mantığı — hem CLI (src/runner.js) hem de
 * Express API'nin (/api/refresh, src/server.js) ortak kullandığı katman.
 */
const registry = require('./scrapers');
const db = require('./db');

async function runOne(brandKey) {
  const entry = registry[brandKey];
  if (!entry) {
    throw new Error(`Bilinmeyen marka: ${brandKey}. Geçerli markalar: ${Object.keys(registry).join(', ')}`);
  }

  const runId = db.recordScrapeStart(brandKey);
  const startedAt = Date.now();
  try {
    const items = await entry.module.scrape();
    if (!Array.isArray(items)) throw new Error('scrape() bir dizi döndürmedi');
    db.upsertBrandItems(brandKey, items);
    db.recordScrapeEnd(runId, { status: 'ok', itemCount: items.length });
    return { brand: brandKey, label: entry.label, status: 'ok', itemCount: items.length, ms: Date.now() - startedAt };
  } catch (e) {
    db.recordScrapeEnd(runId, { status: 'error', errorMessage: e.message });
    return { brand: brandKey, label: entry.label, status: 'error', errorMessage: e.message, ms: Date.now() - startedAt };
  }
}

async function runAll(brandKeys = Object.keys(registry)) {
  const results = [];
  for (const brandKey of brandKeys) {
    results.push(await runOne(brandKey));
  }
  return results;
}

module.exports = { runOne, runAll };
