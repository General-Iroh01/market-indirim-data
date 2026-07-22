/**
 * Addax scraper — GERÇEK, canlı siteye bağlı, PUPPETEER gerektirir.
 *
 * https://www.addax.com.tr/super-fiyat sayfası ("Süper Fiyat" — sabit
 * indirimli outlet koleksiyonu) ürünleri client-side (React/Next benzeri
 * SPA) render ediyor; ham HTML'de (node-fetch) ürün/fiyat verisi YOK,
 * bu yüzden Puppeteer ile gerçek tarayıcı JS'i çalıştırılması gerekiyor.
 *
 * Doğrulanmış DOM yapısı (chrome ile canlı sayfa incelendi):
 *   .productCard                              -> tek ürün kartı
 *     a (ilk)                                  -> ürün linki (href)
 *     img (ilk)                                -> ürün görseli (src)
 *     .name.product_productName__eAU2G         -> ürün adı (hash class'lı, [class*="product_productName"] ile hedeflendi)
 *     .salePriceValue                          -> indirimli fiyat (ör. "399,50 TL")
 *     .oldPrice                                -> eski fiyat (ör. "1.099,50 TL"); YOKSA ürün indirimli değildir
 *
 * Sayfalama `?page=N` query param'ı ile (adres çubuğunda doğrulandı,
 * scroll sırasında `?page=2` oluştu). MAX_PAGES ile sınırlandırıldı.
 *
 * Keşif yöntemi: Chrome DevTools ile canlı sayfa açılıp DOM class'ları ve
 * query-param sayfalama doğrulandı (tahmin değil). Not: bu class isimleri
 * CSS-modül hash'i içeriyor (`__eAU2G` gibi) — Addax bir deploy yapıp
 * hash'i değiştirirse selector kırılabilir, bu normal/beklenen bir durum.
 */
const { extractFromPage } = require('../browserFetch');
const { normalizeItem, makeId } = require('../util');

const BASE = 'https://www.addax.com.tr';
const LIST_PATH = '/super-fiyat';
const MAX_PAGES = 8;

function extractCards() {
  const cards = Array.from(document.querySelectorAll('.productCard'));
  const out = [];
  for (const card of cards) {
    const saleEl = card.querySelector('.salePriceValue');
    const oldEl = card.querySelector('.oldPrice');
    if (!saleEl || !oldEl) continue; // gerçek indirimi olmayanları atla

    const a = card.querySelector('a');
    const nameEl = card.querySelector('[class*="product_productName"]');
    const img = card.querySelector('img');

    if (!a || !nameEl) continue;

    out.push({
      href: a.getAttribute('href') || '',
      title: nameEl.textContent.trim(),
      saleText: saleEl.textContent.trim(),
      oldText: oldEl.textContent.trim(),
      img: img ? (img.getAttribute('src') || img.getAttribute('data-src')) : null,
    });
  }
  return out;
}

function parseTLNumber(text) {
  if (!text) return null;
  const cleaned = String(text).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

async function scrapePage(pageNum) {
  const url = `${BASE}${LIST_PATH}${pageNum > 1 ? `?page=${pageNum}` : ''}`;
  const raw = await extractFromPage(url, extractCards, { waitForSelector: '.productCard' });

  const items = [];
  for (const r of raw) {
    const salePrice = parseTLNumber(r.saleText);
    const oldPrice = parseTLNumber(r.oldText);
    if (!salePrice || !oldPrice || salePrice >= oldPrice) continue;
    const discountPercent = Math.round(((oldPrice - salePrice) / oldPrice) * 100);

    items.push(normalizeItem('addax', {
      id: makeId('addax', r.title, r.href),
      title: r.title,
      discountPercent,
      price: salePrice,
      originalPrice: oldPrice,
      priceText: `${r.saleText} (eski: ${r.oldText})`,
      startDate: null,
      endDate: null,
      dateConfidence: 'unknown',
      imageUrl: r.img || null,
      sourceUrl: r.href ? new URL(r.href, BASE).toString() : BASE,
      category: null,
    }));
  }
  return items;
}

async function scrape() {
  const seen = new Map();
  for (let p = 1; p <= MAX_PAGES; p++) {
    const items = await scrapePage(p);
    if (items.length === 0) break;
    for (const item of items) seen.set(item.id, item);
  }
  return Array.from(seen.values());
}

module.exports = { scrape };
