/**
 * Tüm scraper'ları çalıştırır, sonuçları yerel DB'ye (src/db.js) yazar.
 * Kullanım: `npm run scrape` veya `node src/runner.js` veya
 *           `node src/runner.js migros carrefoursa` (sadece belirli markalar).
 */
const registry = require('./scrapers');
const { runOne } = require('./scrapeService');
const { closeBrowser } = require('./browserFetch');

async function main() {
  const requested = process.argv.slice(2);
  const brandKeys = requested.length > 0 ? requested : Object.keys(registry);

  const unknown = brandKeys.filter(b => !registry[b]);
  if (unknown.length > 0) {
    console.error(`Bilinmeyen marka(lar): ${unknown.join(', ')}`);
    console.error(`Geçerli markalar: ${Object.keys(registry).join(', ')}`);
    process.exit(1);
  }

  console.log(`Taranacak markalar: ${brandKeys.join(', ')}\n`);

  const results = [];
  for (const brandKey of brandKeys) {
    const r = await runOne(brandKey);
    if (r.status === 'ok') {
      console.log(`[${r.label}] OK — ${r.itemCount} ürün (${r.ms}ms)`);
    } else {
      console.error(`[${r.label}] HATA — ${r.errorMessage}`);
    }
    results.push(r);
  }

  const okCount = results.filter(r => r.status === 'ok').length;
  const totalItems = results.reduce((sum, r) => sum + (r.itemCount || 0), 0);
  console.log(`\nTamamlandı: ${okCount}/${results.length} marka başarılı, toplam ${totalItems} ürün.`);

  const failed = results.filter(r => r.status === 'error');
  if (failed.length > 0) {
    console.log(`Başarısız: ${failed.map(r => r.brand).join(', ')} (henüz uygulanmamış scraper'lar olabilir — normal).`);
  }

  // Puppeteer (lcw/addax gibi) bir tarayıcı süreci açık bıraktıysa Node
  // process kapanmadan asılı kalır — bu yüzden burada açıkça kapatılıyor.
  await closeBrowser();
}

main().catch(async e => {
  console.error('Beklenmeyen hata:', e);
  await closeBrowser();
  process.exit(1);
});
