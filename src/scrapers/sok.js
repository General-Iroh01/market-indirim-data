/**
 * Şok scraper — GERÇEK, canlı siteye bağlı.
 *
 * Şok (sokmarket.com.tr) da A101 gibi Next.js App Router RSC streaming
 * kullanıyor, ama farklı bir şema: `initialSearchResult.results[]` altında
 * her ürün `product` (id, name, images, path) ve `prices.discounted` /
 * `prices.original` ({value, text}) alanlarını içeriyor. Sayfalama
 * `?page=N` ile çalışıyor (0-indexed `page.number` içeride, dışarıdan
 * 1-indexed veriliyor — curl ile page=2 verilince page.number:1 döndüğü
 * doğrulandı).
 *
 * Taranan listeler:
 *   /haftanin-firsatlari-market-sgrp-146401           (Haftanın Fırsatları)
 *   /50-tl-ve-uzeri-indirimli-urunler-pgrp-11d42a6b-df28-4fe6-b1a3-7ad6b8d7f9a0
 *
 * Tarih bilgisi bu listelerde YOK -> dateConfidence 'unknown'.
 *
 * Keşif yöntemi: Ana sayfa ham HTML'i indirilip indirim/kampanya
 * linkleri bulundu, hedef sayfa curl ile çekilip RSC chunk'ları
 * JSON.parse ile ayrıştırılarak gerçek şema doğrulandı.
 */
const fetch = require('node-fetch');
const { normalizeItem, makeId } = require('../util');

const LISTS = [
  'haftanin-firsatlari-market-sgrp-146401',
  '50-tl-ve-uzeri-indirimli-urunler-pgrp-11d42a6b-df28-4fe6-b1a3-7ad6b8d7f9a0',
];
const MAX_PAGES_PER_LIST = 6;
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'tr-TR,tr;q=0.9',
};

function extractInitialSearchResult(html) {
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
        if (!Array.isArray(node) && node.initialSearchResult) return node.initialSearchResult;
        for (const key of Object.keys(node)) stack.push(node[key]);
      }
    }
  }
  return null;
}

function mapProduct(entry) {
  const p = entry.product;
  const discounted = entry.prices?.discounted;
  const original = entry.prices?.original;
  const hasDiscount = discounted && original && discounted.value < original.value;
  if (!hasDiscount) return null;

  const discountPercent = Math.round(((original.value - discounted.value) / original.value) * 100);
  const category = p.variant?.path ? null : null; // breadCrumbs kategorisi entry.sku.breadCrumbs'ta
  const lastCrumb = entry.sku?.breadCrumbs?.[entry.sku.breadCrumbs.length - 1];

  return normalizeItem('sok', {
    id: makeId('sok', p.name, p.id),
    title: p.name,
    discountPercent,
    price: discounted.value,
    originalPrice: original.value,
    priceText: `${discounted.symbol}${discounted.text} (eski: ${original.symbol}${original.text})`,
    startDate: null,
    endDate: null,
    dateConfidence: 'unknown',
    imageUrl: p.images?.[0] ? `${p.images[0].host}/${p.images[0].path}` : null,
    sourceUrl: p.path ? `https://www.sokmarket.com.tr/${p.path}` : 'https://www.sokmarket.com.tr/',
    category: lastCrumb?.label || category,
  });
}

async function scrapeList(slug) {
  const items = [];
  for (let page = 1; page <= MAX_PAGES_PER_LIST; page++) {
    const url = `https://www.sokmarket.com.tr/${slug}${page > 1 ? `?page=${page}` : ''}`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`Şok HTTP ${res.status} (${slug}, sayfa ${page})`);
    const html = await res.text();
    const isr = extractInitialSearchResult(html);
    if (!isr || !Array.isArray(isr.results) || isr.results.length === 0) break;
    for (const entry of isr.results) {
      const item = mapProduct(entry);
      if (item) items.push(item);
    }
    if (isr.page && isr.page.number + 1 >= isr.page.totalPages) break;
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
