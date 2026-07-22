/**
 * Vatan Bilgisayar scraper — GERÇEK, canlı siteye bağlı.
 *
 * https://www.vatanbilgisayar.com/kampanyalar/ sunucu tarafında render
 * ediliyor (SSR) — ürün kartları curl/fetch ile çekilen ham HTML'in
 * İÇİNDE geliyor, JS çalıştırmaya/headless browser'a gerek yok.
 *
 * Her ürün kartı (`.product-list`) içinde:
 *   - .product-list__product-name h3  -> ürün adı
 *   - a.product-list__link[href]      -> ürün sayfası linki
 *   - .product-list__product-code     -> ürün kodu (id için kullanılır)
 *   - img[data-src]                   -> görsel (lazy-load, gerçek url data-src'de)
 *   - .web-ozel-fiyat                 -> SADECE "Web'e Özel" kampanyalı üründe var:
 *                                        indirimli/kampanya fiyatı (ör. "38.069 TL ")
 *   - .product-list__price            -> sitede listelenen (kampanyasız) fiyat,
 *                                        her zaman var
 *
 * `.web-ozel-fiyat` YOKSA ürün bu kampanya kapsamında değildir — bu yüzden
 * sadece bu span'i olan kartlar alınır (aynı mantık: CarrefourSA scraper'ında
 * `.priceLineThrough` şartı).
 *
 * robots.txt kontrol edildi: `/kampanyalar/` ve genel ürün sayfaları
 * disallow edilmemiş (sadece /arama, /login, /uyeBilgi, query filtreleri
 * disallow) — taranması yasak değil.
 *
 * Keşif yöntemi: curl ile ham HTML indirilip DOM yapısı incelendi (tahmin
 * değil, doğrulanmış). Sayfalama JS ile dolduruluyor (`.classic-pagination`
 * boş geliyor) ama tüm "Web'e Özel" ürünler tek sayfada zaten sunucu
 * tarafından render ediliyor — ek sayfa isteği gerekmiyor.
 */
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { normalizeItem, makeId } = require('../util');

const URL_ = 'https://www.vatanbilgisayar.com/kampanyalar/';
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
  if (!res.ok) throw new Error(`Vatan Bilgisayar HTTP ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const items = [];
  $('.product-list').each((_, el) => {
    const card = $(el);
    const campaignText = card.find('.web-ozel-fiyat').first().text().replace(/\s+/g, ' ').trim();
    if (!campaignText) return; // "Web'e Özel" kampanyalı değil, atla

    const title = card.find('.product-list__product-name h3').first().text().replace(/\s+/g, ' ').trim();
    if (!title) return;

    const listedText = card.find('.product-list__price').first().text().replace(/\s+/g, ' ').trim();
    const href = card.find('a.product-list__link, a.product-list__image-safe-link').first().attr('href');
    const img = card.find('img').first().attr('data-src') || card.find('img').first().attr('src');
    const code = card.find('.product-list__product-code').first().text().replace(/\s+/g, ' ').trim();

    const campaignPrice = parseTLNumber(campaignText);
    const listedPrice = parseTLNumber(listedText);
    const discountPercent = (listedPrice && campaignPrice && campaignPrice < listedPrice)
      ? Math.round(((listedPrice - campaignPrice) / listedPrice) * 100)
      : null;
    if (!discountPercent) return; // fiyat okunamadıysa ya da indirim yoksa atla

    items.push(normalizeItem('vatanbilgisayar', {
      id: makeId('vatanbilgisayar', title, code || ''),
      title,
      discountPercent,
      price: campaignPrice,
      originalPrice: listedPrice,
      priceText: `${campaignPrice} TL (liste: ${listedPrice} TL)`,
      startDate: null,
      endDate: null,
      dateConfidence: 'unknown',
      imageUrl: img || null,
      sourceUrl: href ? new URL(href, URL_).toString() : URL_,
      category: null,
    }));
  });

  return items;
}

module.exports = { scrape };
