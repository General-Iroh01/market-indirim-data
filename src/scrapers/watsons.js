const { makeStub } = require('./_stub');

// İNCELEME SONUCU: Watsons (SAP Commerce/Hybris tabanlı, api.watsons.com.tr
// OCC API) Akamai bot koruması kullanıyor — hem `curl` hem `node-fetch` her
// header kombinasyonuyla da HTTP 403 alıyor (TLS/istemci parmak izi bazlı
// engelleme, sadece User-Agent/Accept header'larıyla aşılamıyor). Ayrıca
// "Kampanyalar" sayfası genel ürün indirimi değil, WClub üyelerine özel
// kişiselleştirilmiş kupon kampanyalarını gösteriyor (herkes için aynı
// veri değil). Gerçek ürün bazlı indirimlere ulaşmak için gerçek bir
// tarayıcı motoruna (Playwright/Puppeteer + headless Chromium) ihtiyaç var
// — bu, projenin geri kalanından çok daha ağır bir bağımlılık (yüzlerce MB
// indirme) olduğu için şimdilik uygulanmadı.
module.exports = makeStub(
  'Watsons',
  'Akamai bot koruması curl/node-fetch\'i 403 ile engelliyor; gerçek ilerleme için Playwright/Puppeteer (headless Chromium) gerekiyor.'
);
