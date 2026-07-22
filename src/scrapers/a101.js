/**
 * A101 scraper — GERÇEK, canlı siteye bağlı.
 *
 * A101'in ürün listeleme sayfaları (/liste/<slug>) Next.js App Router ile
 * sunucu tarafında render ediliyor (RSC streaming): ürün verisi ham HTML
 * içine `self.__next_f.push([1,"..."])` script çağrıları olarak gömülü
 * geliyor (klasik __NEXT_DATA__ script tag'i değil — App Router'ın kendi
 * streaming formatı). Bu yüzden JS çalıştırmaya gerek yok, ama veriyi
 * çıkarmak için bu chunk'ları JSON.parse ile ayrıştırmak gerekiyor.
 *
 * Sayfalama `?page=N` query param'ı ile çalışıyor (curl ile doğrulandı:
 * sayfa 1 -> 60 ürün, sayfa 2 -> 30 ürün, total_item_count: 90).
 *
 * Taranan listeler ("Aldın Aldın" kampanya grupları — A101'in kendi
 * kampanya sayfasında bu isimle gruplanıyor):
 *   /liste/aldin-aldin, /liste/aldin-aldin-ekstra, /liste/aldin-aldin-elektronik
 *
 * Bu listelerde net başlangıç/bitiş tarihi YOK (ürün bazında) — bu yüzden
 * dateConfidence 'unknown'. Sadece gerçekten indirimli olanlar
 * (price.discountRate dolu) alınıyor.
 *
 * Keşif yöntemi: Chrome'da ana sayfadaki "Tümünü Gör" linkleri bulunup
 * hedef URL'ler çıkarıldı, sonra curl ile ham HTML indirilip RSC
 * chunk'ları parse edilerek gerçek şema doğrulandı (tahmin değil).
 */
const fetch = require('node-fetch');
const { normalizeItem, makeId } = require('../util');

const LISTS = ['aldin-aldin', 'aldin-aldin-ekstra', 'aldin-aldin-elektronik'];
const MAX_PAGES_PER_LIST = 5;
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'tr-TR,tr;q=0.9',
};

// self.__next_f.push([1,"28:[...]"]) parçalarını ayıklayıp içindeki
// "searchData" alanını (ürün listesi + toplam sayı) bulur.
function extractSearchData(html) {
  const re = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g;
  let m;
  const rawChunks = [];
  while ((m = re.exec(html))) rawChunks.push(m[1]);

  function findSearchData(node) {
    if (node && typeof node === 'object') {
      if (!Array.isArray(node) && node.searchData) return node.searchData;
      for (const key of Object.keys(node)) {
        const found = findSearchData(node[key]);
        if (found) return found;
      }
    }
    return null;
  }

  for (const raw of rawChunks) {
    let str;
    try { str = JSON.parse(raw); } catch (e) { continue; }
    const colonIdx = str.indexOf(':');
    if (colonIdx <= 0) continue;
    let parsed;
    try { parsed = JSON.parse(str.slice(colonIdx + 1)); } catch (e) { continue; }
    const sd = findSearchData(parsed);
    if (sd) return sd;
  }
  return null;
}

function mapProduct(p) {
  const rate = p.price?.discountRate ? parseFloat(p.price.discountRate) : null;
  return normalizeItem('a101', {
    id: makeId('a101', p.name, p.id),
    title: p.name,
    discountPercent: rate,
    price: typeof p.price?.discounted === 'number' ? p.price.discounted / 100 : null,
    originalPrice: typeof p.price?.normal === 'number' ? p.price.normal / 100 : null,
    priceText: p.price?.discountedText
      ? `${p.price.discountedText}${p.price.normalText && p.price.normalText !== p.price.discountedText ? ' (eski: ' + p.price.normalText + ')' : ''}`
      : null,
    startDate: null,
    endDate: null,
    dateConfidence: 'unknown',
    imageUrl: p.images?.[0]?.url || null,
    sourceUrl: p.attributes?.url || 'https://www.a101.com.tr/',
    category: p.category || null,
  });
}

async function scrapeList(slug) {
  const items = [];
  for (let page = 1; page <= MAX_PAGES_PER_LIST; page++) {
    const url = `https://www.a101.com.tr/liste/${slug}${page > 1 ? `?page=${page}` : ''}`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`A101 HTTP ${res.status} (${slug}, sayfa ${page})`);
    const html = await res.text();
    const sd = extractSearchData(html);
    if (!sd || !Array.isArray(sd.res) || sd.res.length === 0) break;
    for (const p of sd.res) {
      if (!p.price?.discountRate) continue; // gerçek indirimi olmayanları atla
      items.push(mapProduct(p));
    }
    const seenSoFar = page * 60; // ilk sayfa 60, sonrakiler değişken olabilir ama kaba bir üst sınır kontrolü
    if (sd.total_item_count != null && seenSoFar >= sd.total_item_count) break;
  }
  return items;
}

async function scrape() {
  const seen = new Map();
  for (const slug of LISTS) {
    const items = await scrapeList(slug);
    for (const item of items) seen.set(item.id, item);
  }
  return Array.from(seen.values());
}

module.exports = { scrape };
