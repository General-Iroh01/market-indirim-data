# Market İndirim Takip

Watsons, Migros, Gratis, A101, BİM, Şok, CarrefourSA ve Macrocenter
indirimlerini tek yerden takip eden, tamamen ücretsiz ve bağımsız çalışan
bir sistem. Kendi başına çalışır — hiçbir uygulamaya entegre edilmemiştir;
istersen daha sonra kendi projene sen entegre edersin.

## Şu an neler çalışıyor

| Marka        | Durum  | Not |
|--------------|--------|-----|
| Migros       | ✅ Canlı | `rest/search/screens/...` genel API'si üzerinden gerçek ürün/fiyat/indirim verisi (~150 ürün). Tarih bilgisi yok → "şu an aktif". |
| Macrocenter  | ✅ Canlı | Migros ile aynı platform/API'yi paylaşıyor (~114 ürün). Tarih bilgisi yok. |
| CarrefourSA  | ✅ Canlı | Ana sayfa sunucu tarafında render edildiği için ham HTML'den (cheerio) gerçek veri çekilir (~66 ürün). Tarih bilgisi yok. |
| A101         | ✅ Canlı | Next.js RSC streaming verisinden ("Aldın Aldın" listeleri) çekiliyor (~29 ürün). Tarih bilgisi yok. |
| Şok          | ✅ Canlı | Next.js RSC streaming verisinden (haftanın fırsatları + 50TL+ indirim listesi) çekiliyor (~17 ürün). Tarih bilgisi yok. |
| Gratis       | ✅ Canlı | Next.js RSC streaming verisinden, birkaç ana kategori sayfasının ilk sayfası taranıyor (~116 ürün, "Gratis Kart ile" fiyatları dahil). Tarih bilgisi yok. |
| BİM          | ✅ Canlı | Klasik ASP.NET sayfası (aktuel-urunler.aspx), cheerio ile parse ediliyor (~22 ürün). BİM'de "eski fiyat/yeni fiyat" karşılaştırması YOK — her ürün zaten o haftaya özel bir kampanya ürünü, bu yüzden `discountPercent: null`. |
| Watsons      | ⏳ Engellendi | Akamai bot koruması hem `curl` hem `node-fetch`'i (her header kombinasyonuyla) HTTP 403 ile engelliyor — TLS/istemci parmak izi bazlı bir engelleme, basit bir HTTP isteğiyle aşılamıyor. Gerçek ilerleme için Playwright/Puppeteer (headless Chromium) gerekiyor; bu, projenin geri kalanından çok daha ağır bir bağımlılık olduğu için şimdilik eklenmedi. Ayrıca "Kampanyalar" sayfası genel ürün indirimi değil, WClub üyelerine özel kişiselleştirilmiş kupon kampanyalarını gösteriyor. |

Watsons `npm run scrape` çalıştırıldığında hata verir (beklenen davranış) —
diğer markaları etkilemez, dashboard'da sadece "0 ürün" olarak görünür.

## Kurulum

```bash
npm install
```

(Not: `better-sqlite3` gibi derleme gerektiren native paketler KASITLI
OLARAK kullanılmadı — bu makinede Visual Studio Build Tools kurulu değil.
Veri `data/discounts.json` dosyasında düz JSON olarak tutuluyor; bu ölçek
için performans sorunu yaratmaz.)

## Çalıştırma

```bash
npm start
```

Tarayıcıda **http://localhost:4141** adresini aç. Dashboard'da:
- Marka bazlı filtre çipleri (ürün sayısı ile)
- "Şu An Aktif" ve "Yakında Başlayacak" (tarihi bilinen kampanyalar için)
  bölümleri
- Sağ üstteki **"Şimdi Tara"** butonuyla tüm scraper'ları anında yeniden
  çalıştırabilirsin (birkaç saniye sürer)

## Sadece scraper'ı çalıştırmak istersen (dashboard açmadan)

```bash
npm run scrape                    # tüm markalar
node src/runner.js migros         # sadece Migros
node src/runner.js migros carrefoursa
```

## Periyodik otomatik tarama (opsiyonel, sonraki adım)

Şu an tarama sadece "Şimdi Tara" butonuyla veya `npm run scrape` ile
manuel tetikleniyor. Bilgisayarını 7/24 açık tutmadan otomatik
periyodik tarama istersen iki seçenek var:

1. **Windows Görev Zamanlayıcı** (en basit, yerel): Task Scheduler'da
   `node src/runner.js` komutunu her N saatte bir çalıştıracak bir görev
   oluştur (bilgisayar açık olmalı).
2. **GitHub Actions cron** (bilgisayar kapalıyken de çalışır, ücretsiz):
   Bunun çalışması için tarama sonucunun bir yere (repo'ya commit, ya da
   ücretsiz bir bulut veritabanı) yazılması gerekir — şu anki yerel JSON
   dosyası GitHub Actions runner'ında kalıcı olmaz. İstersen bu adımı
   birlikte kurabiliriz.

## Yeni bir marka eklemek

1. `src/scrapers/<brand>.js` içinde `async function scrape()` yaz —
   `src/scrapers/migros.js` veya `carrefoursa.js`'i örnek al.
2. `src/scrapers/index.js`'e ekle, `status: 'live'` yap.
3. `src/util.js` içindeki `normalizeItem`/`makeId` yardımcılarını kullan.

## Proje yapısı

```
src/
  db.js            yerel JSON veri katmanı
  util.js          normalizeItem, slugify, tarih yardımcıları
  scrapers/        her marka için bir dosya + registry (index.js)
  scrapeService.js runOne/runAll — hem CLI hem API kullanıyor
  runner.js         CLI: node src/runner.js [marka...]
  server.js         Express API + dashboard sunucusu
public/
  index.html, styles.css, app.js   standalone dashboard arayüzü
data/
  discounts.json    (gitignore'da — ilk çalıştırmada oluşur)
```
