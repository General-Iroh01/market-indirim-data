/**
 * Gratis scraper — GERÇEK, canlı siteye bağlı.
 *
 * Gratis (gratis.com), A101/Şok gibi Next.js App Router RSC streaming
 * kullanıyor. Kategori sayfalarının (`/<slug>-c-<id>`) ilk SSR render'ında
 * `products[]` dizisi geliyor; her ürün `prices.discountRate` /
 * `discountedPriceLabel` / `normalPriceLabel` alanlarını içeriyor
 * ("Gratis Kart ile" adı verilen, sadakat kartıyla geçerli kalıcı indirim
 * dahil — CarrefourSA'daki "CarrefourSA Kart ile" ile aynı mantık, gerçek
 * ve görünür bir indirimli fiyat olduğu için dahil ediliyor).
 *
 * NOT: Kategori sayfası tek bir GET isteğiyle sadece ilk 24 ürünü
 * döndürüyor (`baseQuery.size=24`); sonraki sayfalar muhtemelen client-side
 * bir API çağrısıyla yükleniyor ve bu çağrının URL'i statik HTML
 * incelemesiyle bulunamadı. Bu yüzden şimdilik her kategoriden sadece ilk
 * sayfa (24 ürün) alınıyor — birkaç farklı ana kategori taranarak makul bir
 * kapsam elde ediliyor. Tarih bilgisi yok -> dateConfidence 'unknown'.
 *
 * Keşif yöntemi: Ana sayfa ve kategori sayfası ham HTML olarak indirilip
 * `self.__next_f.push(...)` RSC chunk'ları JSON.parse ile ayrıştırılarak
 * gerçek ürün şeması doğrulandı.
 */
const fetch = require('node-fetch');
const { normalizeItem, makeId } = require('../util');

const CATEGORIES = [
  'makyaj-c-501',
  'cilt-bakim-c-502',
  'sac-bakim-c-503',
  'kisisel-bakim-c-506',
  'parfum-deodorant-c-504',
];
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'tr-TR,tr;q=0.9',
};

function extractProducts(html) {
  const re = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g;
  let m;
  const rawChunks = [];
  while ((m = re.exec(html))) rawChunks.push(m[1]);

  for (const raw of rawChunks) {
    let str;
    try { str = JSON.parse(raw); } catch (e) { continue; }
    const colonIdx = str.indexOf(':');
    if (colonIdx <= 0) continue;
    let parsed;
    try { parsed = JSON.parse(str.slice(colonIdx + 1)); } catch (e) { continue; }
    const stack = [parsed];
    while (stack.length) {
      const node = stack.pop();
      if (node && typeof node === 'object') {
        if (!Array.isArray(node) && Array.isArray(node.products)) return node.products;
        for (const key of Object.keys(node)) stack.push(node[key]);
      }
    }
  }
  return null;
}

function mapProduct(p) {
  const rate = p.prices?.discountRate;
  const categories = p.attributes?.categories || [];
  return normalizeItem('gratis', {
    id: makeId('gratis', p.attributes?.displayName || p.id, p.id),
    title: p.attributes?.displayName || '',
    discountPercent: typeof rate === 'number' ? rate : null,
    price: typeof p.prices?.discountedPrice === 'number' ? p.prices.discountedPrice / 100 : null,
    originalPrice: typeof p.prices?.normalPrice === 'number' ? p.prices.normalPrice / 100 : null,
    priceText: p.prices?.discountedPriceLabel
      ? `${p.prices.discountedPriceLabel}${p.prices.normalPriceLabel && p.prices.normalPriceLabel !== p.prices.discountedPriceLabel ? ' (eski: ' + p.prices.normalPriceLabel + ')' : ''}`
      : null,
    startDate: null,
    endDate: null,
    dateConfidence: 'unknown',
    imageUrl: p.imageUrls?.[0]?.fileUrl || null,
    sourceUrl: p.shareLink || 'https://www.gratis.com/',
    category: categories[categories.length - 1] || categories[0] || null,
  });
}

async function scrapeCategory(slug) {
  const res = await fetch(`https://www.gratis.com/${slug}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`Gratis HTTP ${res.status} (${slug})`);
  const html = await res.text();
  const products = extractProducts(html);
  if (!products) return [];
  return products
    .filter(p => typeof p.prices?.discountRate === 'number' && p.prices.discountRate > 0)
    .map(mapProduct);
}

async function scrape() {
  const seen = new Map();
  for (const slug of CATEGORIES) {
    const items = await scrapeCategory(slug);
    for (const item of items) seen.set(item.id, item);
  }
  return Array.from(seen.values());
}

module.exports = { scrape };
