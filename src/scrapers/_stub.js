/**
 * Henüz canlı siteye bağlanmamış scraper'lar için ortak iskelet.
 * Gerçek scraper yazılırken bu dosyadaki `makeStub` yerine gerçek
 * fetch/parse mantığı konur (bkz. migros.js / carrefoursa.js örnek olarak).
 */
function makeStub(brandLabel, note) {
  return {
    async scrape() {
      throw new Error(
        `[${brandLabel}] scraper henüz uygulanmadı. ${note || ''}`.trim()
      );
    },
  };
}

module.exports = { makeStub };
