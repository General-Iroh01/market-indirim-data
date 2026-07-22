/**
 * LCW (LC Waikiki) scraper — GERÇEK, canlı siteye bağlı, PUPPETEER gerektirir.
 *
 * https://www.lcw.com/kampanyalar/kadin-indirimli-urunler-lcw sayfası ham
 * HTML'de (`curl`/node-fetch ile) ürün kartlarını içeriyor (`.product-card`),
 * AMA indirim fiyatı (`.price-in-cart`, `.discount-rate-container__value`)
 * ham HTML'de YOK — sadece "current-price" (indirimsiz liste fiyatı) var.
 * İndirimli fiyat, sayfa yüklendikten sonra bir kişiselleştirme/pazarlama
 * script'i (Insider) tarafından CLIENT-SIDE hesaplanıp DOM'a ekleniyor.
 * Bu yüzden gerçek fiyatı görmek için gerçek bir tarayıcı (Puppeteer)
 * JS'i çalıştırmak şart — düz `fetch` ile indirim verisi elde edilemiyor.
 *
 * Doğrulanmış DOM yapısı (chrome ile canlı sayfa incelendi):
 *   .product-card                                  -> tek ürün kartı
 *     a.link                                        -> ürün linki (href, relative)
 *     img (ilk)                                     -> ürün görseli (src)
 *     .product-brand.product-card-info__brand        -> marka/alt-marka (LCW Jeans vb.)
 *     .product-description.product-card-info__description -> ürün adı
 *     .current-price                                -> liste fiyatı (indirimsiz)
 *     .price-in-cart                                -> SADECE indirimliyse var: sepet/indirim fiyatı
 *     .discount-rate-container__value                -> SADECE indirimliyse var: "−25%" gibi
 *
 * Sayfalama `?sayfa=N` query param'ı ile (site içi "Daha Fazla Ürün Gör"
 * linkinden doğrulandı: `/kampanyalar/kadin-indirimli-urunler-lcw?sayfa=2`).
 * Toplam ~142 sayfa (14000+ ürün) var; tam taramak çok yavaş/ağır olacağı
 * için MAX_PAGES ile sınırlandırıldı (ilk sayfalar en çok görüntülenen /
 * öne çıkan ürünleri içeriyor).
 *
 * Not: indirim fiyatı bir kişiselleştirme motoru tarafından hesaplandığı
 * için, scraper'ın çalıştığı oturuma göre hafif değişebilir — diğer
 * scraper'larla aynı mantık uygulanıyor: "şu an sitede gösterilen" fiyat
 * alınıyor, dateConfidence 'unknown'.
 *
 * Keşif yöntemi: Chrome DevTools ile canlı sayfa açılıp DOM class'ları
 * ve query-param sayfalama doğrulandı (tahmin değil).
 */
const { extractFromPage } = require('../browserFetch');
const { normalizeItem, makeId } = require('../util');

const BASE = 'https://www.lcw.com';
const LIST_PATH = '/kampanyalar/kadin-indirimli-urunler-lcw';
const MAX_PAGES = 8;

function extractCards() {
  const cards = Array.from(document.querySelectorAll('.product-card'));
  const out = [];
  for (const card of cards) {
    const priceInCartEl = card.querySelector('.price-in-cart');
    const rateEl = card.querySelector('.discount-rate-container__value');
    if (!priceInCartEl || !rateEl) continue; // gerçek indirimi olmayanları atla

    const a = card.querySelector('a.link');
    const titleEl = card.querySelector('.product-description.product-card-info__description');
    const brandEl = card.querySelector('.product-brand.product-card-info__brand');
    const listedEl = card.querySelector('.current-price');
    const img = card.querySelector('img');

    if (!a || !titleEl || !listedEl) continue;

    out.push({
      href: a.getAttribute('href') || '',
      title: titleEl.textContent.trim(),
      brand: brandEl ? brandEl.textContent.trim() : null,
      listedText: listedEl.textContent.trim(),
      discountedText: priceInCartEl.textContent.trim(),
      rateText: rateEl.textContent.trim(),
      img: img ? img.getAttribute('src') : null,
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
  const url = `${BASE}${LIST_PATH}${pageNum > 1 ? `?sayfa=${pageNum}` : ''}`;
  const raw = await extractFromPage(url, extractCards, { waitForSelector: '.product-card' });

  const items = [];
  for (const r of raw) {
    const listedPrice = parseTLNumber(r.listedText);
    const discountedPrice = parseTLNumber(r.discountedText);
    const rateMatch = r.rateText.match(/(\d+)/);
    const discountPercent = rateMatch ? parseInt(rateMatch[1], 10) : null;
    if (!discountPercent || !discountedPrice) continue;

    items.push(normalizeItem('lcw', {
      id: makeId('lcw', r.title, r.href),
      title: r.brand ? `${r.brand} ${r.title}` : r.title,
      discountPercent,
      price: discountedPrice,
      originalPrice: listedPrice,
      priceText: `${r.discountedText} (liste: ${r.listedText})`,
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
