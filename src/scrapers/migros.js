/**
 * Migros scraper — GERÇEK, canlı API'ye bağlı.
 * Detaylar için bkz. _migrosPlatform.js (Migros ve Macrocenter aynı
 * platformu paylaşıyor, bu yüzden ortak fabrika kullanılıyor).
 *
 * Keşif yöntemi: Chrome network sekmesinde "Tüm İndirimli Ürünler" sayfası
 * açılıp gerçek XHR isteği izlendi — tahmin değil, doğrulanmış bir uç nokta.
 */
const { createMigrosFamilyScraper } = require('./_migrosPlatform');

module.exports = createMigrosFamilyScraper({ brand: 'migros', host: 'www.migros.com.tr' });
