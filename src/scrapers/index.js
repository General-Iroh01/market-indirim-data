/**
 * Scraper Registry
 *
 * Her scraper aynı arayüzü uygular: `async function scrape() -> DiscountItem[]`
 * (bkz. src/util.js normalizeItem). Yeni bir marka eklemek için:
 *   1. src/scrapers/<brand>.js dosyasında bu arayüze uyan bir modül yaz.
 *   2. Aşağıdaki registry'ye ekle.
 *
 * status: 'live'  -> gerçek, canlı siteden veri çeken, test edilmiş scraper.
 *         'stub'   -> arayüz hazır ama henüz gerçek DOM/veri kaynağına bağlanmadı.
 */
module.exports = {
  migros:      { label: 'Migros',      status: 'live', module: require('./migros') },
  carrefoursa: { label: 'CarrefourSA', status: 'live', module: require('./carrefoursa') },
  a101:        { label: 'A101',        status: 'live', module: require('./a101') },
  bim:         { label: 'BİM',         status: 'live', module: require('./bim') },
  sok:         { label: 'Şok',         status: 'live', module: require('./sok') },
  watsons:     { label: 'Watsons',     status: 'stub', module: require('./watsons') },
  gratis:      { label: 'Gratis',      status: 'live', module: require('./gratis') },
  macrocenter: { label: 'Macrocenter', status: 'live', module: require('./macrocenter') },
  vatanbilgisayar: { label: 'Vatan Bilgisayar', status: 'live', module: require('./vatanbilgisayar') },
  lcw:         { label: 'LCW',         status: 'live', module: require('./lcw') },
  addax:       { label: 'Addax',       status: 'live', module: require('./addax') },
};
