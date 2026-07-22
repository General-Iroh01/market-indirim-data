/**
 * Migros ve Macrocenter AYNI platformu kullanıyor (ikisi de Migros Ticaret'e
 * ait, aynı "screens" REST API şeması, sadece host farklı). Bu ortak fabrika
 * ikisi için de kullanılıyor (bkz. migros.js, macrocenter.js).
 *
 * Uç nokta kimlik doğrulama/cookie GEREKTİRMİYOR, doğrudan fetch ile erişilebiliyor:
 *   GET https://<host>/rest/search/screens/tum-indirimli-urunler-dt-0?page=N
 *
 * Tarih bilgisi bu ekranda YOK (Migros/Macrocenter kampanya başlangıç/bitişini
 * bu API'de göstermiyor) -> dateConfidence 'unknown'.
 */
const fetch = require('node-fetch');
const { normalizeItem, makeId } = require('../util');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  'Accept': 'application/json',
};

function tl(kurus) {
  if (typeof kurus !== 'number') return null;
  return (kurus / 100).toFixed(2).replace('.', ',') + ' TL';
}

function createMigrosFamilyScraper({ brand, host, pages = 6 }) {
  const base = `https://${host}/rest/search/screens/tum-indirimli-urunler-dt-0`;

  async function fetchPage(page) {
    const res = await fetch(`${base}?page=${page}`, { headers: HEADERS });
    if (!res.ok) throw new Error(`${host} API HTTP ${res.status} (sayfa ${page})`);
    const json = await res.json();
    if (!json.successful) throw new Error(`${host} API successful=false döndürdü`);
    return json.data?.searchInfo?.storeProductInfos || [];
  }

  function mapProduct(p) {
    return normalizeItem(brand, {
      id: makeId(brand, p.name, p.sku),
      title: p.name,
      discountPercent: typeof p.discountRate === 'number' ? p.discountRate : null,
      price: typeof p.shownPrice === 'number' ? p.shownPrice / 100 : null,
      originalPrice: typeof p.regularPrice === 'number' ? p.regularPrice / 100 : null,
      priceText: p.shownPrice != null
        ? `${tl(p.shownPrice)}${p.regularPrice != null ? ' (eski: ' + tl(p.regularPrice) + ')' : ''}`
        : null,
      startDate: null,
      endDate: null,
      dateConfidence: 'unknown',
      imageUrl: p.images?.[0]?.urls?.PRODUCT_LIST || null,
      sourceUrl: p.prettyName ? `https://${host}/${p.prettyName}` : `https://${host}/tum-indirimli-urunler-dt-0`,
      category: p.category?.name || null,
    });
  }

  async function scrape() {
    const seen = new Map();
    for (let page = 1; page <= pages; page++) {
      const products = await fetchPage(page);
      if (products.length === 0) break;
      for (const p of products) {
        // "Tüm İndirimli Ürünler" ekranı bazen discountRate=0 (regularPrice ===
        // shownPrice) ürünler de döndürüyor — bunlar sepet bazlı koşullu
        // kampanyalar (crmDiscountTags, ör. "Sepette 179,95 TL!") olup gerçek
        // fiyat indirimi YOK. Bu araç gerçek fiyat indirimini takip ettiği
        // için bunları atlıyoruz (yanıltıcı "%0 indirim" kartı göstermemek için).
        if (!p.discountRate || p.discountRate <= 0) continue;
        const item = mapProduct(p);
        seen.set(item.id, item);
      }
    }
    return Array.from(seen.values());
  }

  return { scrape };
}

module.exports = { createMigrosFamilyScraper };
