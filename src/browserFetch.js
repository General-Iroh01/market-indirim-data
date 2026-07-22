/**
 * LCW / Koton / Addax gibi ürün fiyatını CLIENT-SIDE JS ile hesaplayan
 * (SPA veya kişiselleştirme motoruyla fiyat enjekte eden) siteler için
 * ortak headless-Chrome yardımcı fonksiyonu. node-fetch ham HTML'i çektiğinde
 * bu sitelerde indirim verisi YOK — sadece gerçek bir tarayıcı JS'i
 * çalıştırdıktan sonra DOM'da görünüyor (bkz. lcw.js, addax.js başındaki not).
 *
 * `puppeteer` paketi kendi Chromium sürümünü indirir (`npm install` ile).
 */
const puppeteer = require('puppeteer');

let _browserPromise = null;
function getBrowser() {
  if (!_browserPromise) {
    _browserPromise = puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return _browserPromise;
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

/**
 * Bir URL'i headless Chrome ile açar, sayfa JS'i (fiyat/kişiselleştirme
 * motoru dahil) çalıştıktan sonra `extractFn` fonksiyonunu sayfa
 * bağlamında (`page.evaluate`) çalıştırıp sonucunu döner.
 *
 * @param {string} url
 * @param {Function} extractFn - page.evaluate içinde çalışır, DOM'dan veri çıkarır
 * @param {{waitForSelector?: string, timeoutMs?: number}} [opts]
 */
async function extractFromPage(url, extractFn, opts = {}) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setUserAgent(UA);
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'tr-TR,tr;q=0.9' });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: opts.timeoutMs || 30000 });
    if (opts.waitForSelector) {
      await page.waitForSelector(opts.waitForSelector, { timeout: 8000 }).catch(() => {});
    }
    return await page.evaluate(extractFn);
  } finally {
    await page.close();
  }
}

async function closeBrowser() {
  if (_browserPromise) {
    const browser = await _browserPromise;
    await browser.close();
    _browserPromise = null;
  }
}

module.exports = { extractFromPage, closeBrowser };
