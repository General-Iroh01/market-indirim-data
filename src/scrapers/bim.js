/**
 * BİM scraper — GERÇEK, canlı siteye bağlı.
 *
 * BİM'in web sitesi (bim.com.tr) klasik ASP.NET WebForms — sunucu tarafında
 * tamamen render ediliyor, JS'e gerek yok. "Aktüel Ürünler" sayfası
 * (/Categories/100/aktuel-urunler.aspx) BİM'in o haftaki özel/sınırlı süreli
 * kampanya ürünlerini listeliyor.
 *
 * ÖNEMLİ FARK: Migros/CarrefourSA/A101/Şok'un aksine BİM burada "eski fiyat
 * / yeni fiyat" karşılaştırması GÖSTERMİYOR — her ürün zaten kendi başına
 * o haftaya özel bir kampanya ürünü (ör. bir buzdolabı modeli, mevsimlik bir
 * ürün) ve tek bir fiyatı var. Bu yüzden discountPercent hesaplanamıyor
 * (null bırakılıyor); bu sayfadaki her ürünün VARLIĞININ KENDİSİ kampanya
 * anlamına geliyor. Tarih de sayfada yok -> dateConfidence 'unknown'
 * ("bu haftanın aktüel kataloğu" anlamında "şu an aktif").
 *
 * Sayfada infinite-scroll/AJAX ile daha fazla ürün yükleniyor olabilir
 * (`LoadGroup0` class'ı görüldü) ama bunu tetikleyen ayrı bir REST uç
 * noktası curl/HTML incelemesinde bulunamadı — bu yüzden şimdilik sadece
 * ilk statik sayfadaki ürünler alınıyor (ilerisi için not: gerekirse
 * headless browser ile scroll tetiklenip ek istekler yakalanabilir).
 *
 * Keşif yöntemi: Ana sayfa HTML'i indirilip "aktuel-urunler" linki bulundu,
 * hedef sayfa curl ile çekilip cheerio ile gerçek DOM yapısı incelendi.
 */
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { normalizeItem, makeId } = require('../util');

const URL_ = 'https://www.bim.com.tr/Categories/100/aktuel-urunler.aspx';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'tr-TR,tr;q=0.9',
};

async function scrape() {
  const res = await fetch(URL_, { headers: HEADERS });
  if (!res.ok) throw new Error(`BİM HTTP ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const items = [];
  $('.product').each((_, el) => {
    const card = $(el);
    const title = card.find('h2.title').first().text().trim();
    if (!title) return;

    const subTitle = card.find('h2.subTitle').first().text().trim();
    const href = card.find('.imageArea a').first().attr('href');
    const img = card.find('.imageArea img').first().attr('src');

    const whole = card.find('.buttonArea .quantify').first().text().replace(/\s+/g, ' ').trim();
    const decimals = card.find('.buttonArea .kusurArea .number').first().text().trim();
    const currency = card.find('.buttonArea .curr').first().text().trim() || '₺';

    const priceNum = whole
      ? parseFloat(`${whole}${decimals}`.replace(/\./g, '').replace(',', '.'))
      : null;

    items.push(normalizeItem('bim', {
      id: makeId('bim', title, href || ''),
      title,
      discountPercent: null,
      price: Number.isFinite(priceNum) ? priceNum : null,
      priceText: whole ? `${whole}${decimals} ${currency}` : null,
      startDate: null,
      endDate: null,
      dateConfidence: 'unknown',
      imageUrl: img || null,
      sourceUrl: href ? new URL(href, URL_).toString() : URL_,
      category: subTitle || null,
    }));
  });

  return items;
}

module.exports = { scrape };
