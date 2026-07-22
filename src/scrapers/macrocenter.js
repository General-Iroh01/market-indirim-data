/**
 * Macrocenter scraper — GERÇEK, canlı API'ye bağlı.
 *
 * Macrocenter, Migros Ticaret'e ait olduğu için AYNI platformu (aynı
 * "screens" REST API şeması, assets.migrosone.com/macrocenter-web-app/...)
 * kullanıyor — sadece host farklı. Doğrulama: env.js ve ana sayfa HTML'i
 * incelenip assets.migrosone.com/macrocenter-web-app referansları görüldü,
 * ardından aynı /rest/search/screens/tum-indirimli-urunler-dt-0 uç noktası
 * macrocenter.com.tr üzerinde de test edilip çalıştığı doğrulandı.
 */
const { createMigrosFamilyScraper } = require('./_migrosPlatform');

module.exports = createMigrosFamilyScraper({ brand: 'macrocenter', host: 'www.macrocenter.com.tr' });
