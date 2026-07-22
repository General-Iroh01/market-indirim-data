/**
 * CarrefourSA scraper — GERÇEK, canlı siteye bağlı.
 *
 * CarrefourSA'nın ana sayfası (https://www.carrefoursa.com/) sunucu tarafında
 * render ediliyor (SSR) — yani ürün kartları curl/fetch ile çekilen ham
 * HTML'in İÇİNDE geliyor, JS çalıştırmaya/headless browser'a gerek yok.
 *
 * Her ürün kartı (`.product-card`) içinde:
 *   - h3.item-name          -> ürün adı
 *   - a.product-return[href]-> ürün sayfası linki
 *   - img[src]              -> görsel
 *   - .priceLineThrough     -> SADECE indirimliyse var: eski fiyat
 *   - .item-price           -> güncel fiyat (indirimli ya da normal, her zaman var)
 *   - .dataLayerItemData    -> data-item_category / data-item_brand gibi
 *                              yapılandırılmış meta veri
 *
 * `.priceLineThrough` YOKSA ürün indirimli değildir — bu yüzden sadece
 * bu span'i olan kartlar alınır.
 *
 * Kampanya menüsündeki "/c/xxxx" linkleri (ör. "16-31-temmuz-...") ayrıca
 * incelendi ama bunlar GÜNCEL olmayan, yıllar öncesine ait kampanya
 * kategorilerinin de karıştığı bir menü ağacı olduğu için (tarih güveni
 * yok) KASITLI OLARAK kullanılmadı — sadece o an sitede gösterilen,
 * gerçekten indirimli ürün kartları alınıyor (Migros scraper'ıyla aynı
 * mantık: dateConfidence 'unknown', "şu an aktif" anlamına gelir).
 *
 * Keşif yöntemi: `curl` ile ham HTML indirilip cheerio ile canlı DOM
 * yapısı incelendi (tahmin değil, doğrulanmış).
 */
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { normalizeItem, makeId } = require('../util');

const URL_ = 'https://www.carrefoursa.com/';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
};

function parseTLNumber(text) {
  if (!text) return null;
  const cleaned = text.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

async function scrape() {
  const res = await fetch(URL_, { headers: HEADERS });
  if (!res.ok) throw new Error(`CarrefourSA HTTP ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const items = [];
  $('.product-card').each((_, el) => {
    const card = $(el);
    const origText = card.find('.priceLineThrough').first().text().replace(/\s+/g, ' ').trim();
    if (!origText) return; // indirimli değil, atla

    const title = card.find('h3.item-name').first().text().replace(/\s+/g, ' ').trim();
    if (!title) return;

    const curText = card.find('.item-price').first().text().replace(/\s+/g, ' ').trim();
    const href = card.find('a.product-return').first().attr('href');
    const img = card.find('img').first().attr('src');
    const dl = card.find('.dataLayerItemData').first();
    const category = dl.attr('data-item_category') || null;
    const itemId = dl.attr('data-item_id');

    const origPrice = parseTLNumber(origText);
    const curPrice = parseTLNumber(curText);
    const discountPercent = (origPrice && curPrice)
      ? Math.round(((origPrice - curPrice) / origPrice) * 100)
      : null;

    items.push(normalizeItem('carrefoursa', {
      id: makeId('carrefoursa', title, itemId || ''),
      title,
      discountPercent,
      price: curPrice,
      originalPrice: origPrice,
      priceText: curPrice != null
        ? `${curText}${origText ? ' (eski: ' + origText + ')' : ''}`
        : null,
      startDate: null,
      endDate: null,
      dateConfidence: 'unknown',
      imageUrl: img || null,
      sourceUrl: href ? new URL(href, URL_).toString() : URL_,
      category,
    }));
  });

  return items;
}

module.exports = { scrape };
