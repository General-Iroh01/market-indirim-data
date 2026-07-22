/**
 * Express API + AkademiYonetici-web statik dosya sunucusu — TEK süreç.
 *
 * Bu dosya `AkademiYonetici-web/market-server/src/` altında yaşıyor ve
 * PWA'nın kök klasörünü (`AkademiYonetici-web/`) statik olarak servis
 * ediyor, AYNI PORT üzerinden `/api/discounts` gibi uçları da sunuyor.
 * Böylece `market.js` aynı origin'den (`/api/discounts`) canlı veri
 * çekebiliyor — CORS derdi yok, ayrı sunucu/port yönetmeye gerek yok.
 *
 * Kullanım: AkademiYonetici-web kökünden `npm start`
 *           (kök package.json bu dosyayı çalıştırır) -> http://localhost:4141
 *
 * ⚠️ ÖNEMLİ SINIR: Bu, sadece MASAÜSTÜNDE GELİŞTİRME/TEST içindir. Android/iOS
 * paketlemesinde (Capacitor) telefonun içinde Node/Puppeteer ÇALIŞMAZ — o
 * yüzden mobil derlemede uygulama bu sunucuya ulaşamaz ve otomatik olarak
 * `data/market-discounts.json` (donmuş snapshot) üzerinden çalışır
 * (bkz. modules/market.js `_load`). Telefonda GERÇEKTEN canlı veri
 * istiyorsan bu sunucunun bir yerde (Render/Railway/kendi VPS'in) sürekli
 * açık kalması ve `market.js`'teki API_URL'in o adrese ayarlanması gerekir.
 */
const path = require('path');
const express = require('express');
const db = require('./db');
const registry = require('./scrapers');
const { runAll, runOne } = require('./scrapeService');
const { categorize, CATEGORY_LABELS } = require('./util');
const { closeBrowser } = require('./browserFetch');

const app = express();
const PORT = process.env.PORT || 4141;

// AkademiYonetici-web kökü = market-server/src/../..
const WEB_ROOT = path.join(__dirname, '..', '..');
// market-server'ın kendi kaynak kodu/DB'si WEB_ROOT içinde yaşıyor ama
// dışarıya statik dosya olarak servis edilmemeli (kaynak kod + iç veritabanı
// sızıntısı olur) — /api/* uçları zaten ayrıca tanımlı, geri kalan her şeyi engelle.
app.use('/market-server', (req, res) => res.status(404).end());
app.use(express.static(WEB_ROOT));

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// 'active'   : şu an geçerli (startDate yok/geçmiş, endDate yok/gelecek)
// 'upcoming' : startDate bugünden ileride
// 'expired'  : endDate bugünden geride
function computeStatus(item) {
  const today = todayStr();
  if (item.startDate && item.startDate > today) return 'upcoming';
  if (item.endDate && item.endDate < today) return 'expired';
  return 'active';
}

app.get('/api/brands', (req, res) => {
  const lastRuns = db.getLastScrapeRuns();
  const runByBrand = Object.fromEntries(lastRuns.map(r => [r.brand, r]));
  const brands = Object.entries(registry).map(([key, entry]) => ({
    key,
    label: entry.label,
    status: entry.status, // 'live' | 'stub'
    lastRun: runByBrand[key] || null,
  }));
  res.json({ brands });
});

app.get('/api/categories', (req, res) => {
  res.json({ categories: CATEGORY_LABELS });
});

app.get('/api/discounts', (req, res) => {
  const brand = req.query.brand || null;
  const all = brand ? db.getDiscountsByBrand(brand) : db.getAllDiscounts();
  const withStatus = all
    .map(item => ({
      ...item,
      status: computeStatus(item),
      // Kategori kuralları zamanla iyileşebilir — her istekte yeniden
      // hesaplanır ki eski taranmış veri de güncel kurallardan faydalansın.
      categoryGroup: categorize(item.category, item.title),
    }))
    .filter(item => item.status !== 'expired');
  res.json({ items: withStatus, count: withStatus.length, generatedAt: new Date().toISOString() });
});

// Manuel tazeleme: ilerleme durumu görmek için bekleyen bir istek —
// scraping birkaç saniye sürebilir, bu yüzden basit senkron bir POST yeterli.
app.post('/api/refresh', async (req, res) => {
  const brand = req.query.brand || null;
  try {
    const result = brand ? await runOne(brand) : await runAll();
    res.json({ ok: true, result });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 saatte bir arka planda yenile

function backgroundScrapeAll(reason) {
  console.log(`[market-server] Arka planda tarama başlıyor (${reason})...`);
  runAll()
    .then(results => {
      const ok = results.filter(r => r.status === 'ok').length;
      const total = results.reduce((s, r) => s + (r.itemCount || 0), 0);
      console.log(`[market-server] Tarama bitti: ${ok}/${results.length} marka, ${total} ürün.`);
    })
    .catch(e => console.error('[market-server] Arka plan tarama hatası:', e));
}

app.listen(PORT, () => {
  console.log(`Akademi Yönetici (+ Market API) -> http://localhost:${PORT}`);

  // İlk açılışta veri hiç yoksa (temiz kurulum) otomatik tara — kullanıcı
  // elle "npm run scrape" çalıştırmak zorunda kalmasın diye. Sunucu bu
  // taramayı BEKLEMEDEN açılır; ilk saniyelerde /api/discounts boş dönebilir,
  // frontend zaten statik snapshot'a düşecek şekilde tasarlandı (market.js).
  const existing = db.getAllDiscounts();
  if (existing.length === 0) {
    backgroundScrapeAll('ilk kurulum, veri boş');
  }
  setInterval(() => backgroundScrapeAll('periyodik yenileme'), REFRESH_INTERVAL_MS);
});

// Puppeteer (lcw/addax) açık bir tarayıcı süreci bırakmışsa, sunucu
// kapatılırken (Ctrl+C) düzgünce kapat — yoksa arka planda asılı chrome.exe kalır.
async function shutdown() {
  console.log('\n[market-server] Kapatılıyor...');
  await closeBrowser().catch(() => {});
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
