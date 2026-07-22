function slugify(str) {
  return String(str)
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Aynı ürün tekrar tarandığında aynı id'yi üretir (upsert için kararlı anahtar). */
function makeId(brand, title, extra = '') {
  return `${brand}__${slugify(title)}${extra ? '__' + slugify(extra) : ''}`;
}

// Marka bazlı ham kategori metinlerini (ör. "Salam", "Likit Ruj", "Televizyon")
// birkaç geniş, filtrelenebilir üst kategoriye eşler. Sıra önemli — daha
// spesifik gruplar (pet, bebek, elektronik...) gıda/genel gruplardan ÖNCE
// kontrol edilir ki "Kedi Maması" gibi kelimeler yanlışlıkla "gıda"ya düşmesin.
const CATEGORY_RULES = [
  ['pet', ['pet ', 'kedi', 'köpek', 'kuş yemi', 'akvaryum', 'evcil']],
  ['bebek', ['bebek', 'bebe ', 'biberon', 'emzik', 'bez ', 'mama sandalyesi']],
  ['kiyafet', [
    'giyim', 'kıyafet', 'tişört', 't-shirt', 'tshirt', 'gömlek', 'pantolon',
    'elbise', 'etek', 'ceket', 'mont', 'kaban', 'ayakkabı', 'bot ', 'çizme', 'sneaker',
    'çorap', 'iç çamaşır', 'sütyen', 'pijama', 'eşofman', 'şort', 'kazak', 'hırka',
    'atlet', 'terlik', 'sandalet', 'bere', 'şapka', 'atkı', 'mayo', 'bikini', 'tayt',
    'sweatshirt', 'sweat', 'jean', 'kot ', 'gecelik', 'bornoz',
  ]],
  ['elektronik', [
    'elektronik', 'televizyon', ' tv', 'klima', 'buzdolabı', 'dondurucu',
    'süpürge', 'blender', 'tost makinesi', 'çay makinesi', 'telefon',
    'bilgisayar', 'moped', 'elektrikli motor', 'elektrikli bisiklet', 'ütü',
    'kablo', 'priz', 'adaptör', 'pil ',
  ]],
  ['temizlik', [
    'temizlik', 'deterjan', 'yumuşatıcı', 'çamaşır', 'bulaşık', 'yüzey',
    'kağıt havlu', 'islak mendil', 'kağıt mendil', 'peçete', 'tuvalet kağıdı',
    'wc ', 'çöp poşeti', 'eldiven',
  ]],
  ['kozmetik', [
    'makyaj', 'cilt bakım', 'saç bakım', 'parfüm', 'deodorant', 'kolonya',
    'kişisel bakım', 'ruj', 'kapatıcı', 'far', 'fondöten', 'allık', 'oje',
    'tırnak', 'dudak', 'göz makyajı', 'şampuan', 'krem', 'serum', 'tıraş',
    'erkek bakım', 'güneş ürünleri', 'güneş koruyucu', 'hijyen', 'duş jeli',
    'aydınlatıcı', 'tonik', 'wax', 'jöle', 'saç maske', 'kaş', 'kirpik',
    'manikür', 'pedikür', 'set boya', 'ped ',
  ]],
  ['ev-yasam', [
    'ev, yaşam', 'ev & yaşam', 'züccaciye', 'borcam', 'tabak', 'bardak',
    'tencere', 'saklama kabı', 'mobilya', 'tekstil', 'dekor', 'mutfak',
  ]],
  ['gida', [
    'gıda', 'yağ', 'süt', 'kahvaltı', 'içecek', 'atıştırmalık', 'dondurma',
    'fırın', 'pastane', 'hazır yemek', 'meze', 'dondurulmuş', 'bakliyat',
    'makarna', 'mantı', 'pirinç', ' un', 'şeker', 'çay', 'kahve', 'baharat',
    'konserve', 'et, tavuk', 'et ve tavuk', 'şarküteri', 'sucuk', 'salam',
    'sosis', 'pastırma', 'meyve', 'sebze', 'kuruyemiş', 'ceviz', 'kaju',
    'fındık', 'yumurta', 'peynir', 'tereyağ', 'yoğurt', 'zeytin', 'reçel',
    'bal', 'tuz', 'su ', 'kola', 'gazoz', 'salça', 'bisküvi', 'çikolata',
    'mısır gevreği', 'piliç', 'hindi', 'soslar', 'gofret',
  ]],
];

const CATEGORY_LABELS = {
  gida: { label: 'Gıda', icon: '🍽️' },
  kozmetik: { label: 'Kozmetik & Kişisel Bakım', icon: '💄' },
  kiyafet: { label: 'Giyim & Ayakkabı', icon: '👕' },
  temizlik: { label: 'Temizlik', icon: '🧽' },
  elektronik: { label: 'Elektronik', icon: '📺' },
  'ev-yasam': { label: 'Ev & Yaşam', icon: '🏠' },
  bebek: { label: 'Bebek', icon: '🍼' },
  pet: { label: 'Evcil Hayvan', icon: '🐾' },
  diger: { label: 'Diğer', icon: '🏷️' },
};

function categorize(rawCategory, title) {
  const haystack = ` ${(rawCategory || '')} ${(title || '')} `.toLocaleLowerCase('tr-TR');
  for (const [group, keywords] of CATEGORY_RULES) {
    if (keywords.some(kw => haystack.includes(kw))) return group;
  }
  return 'diger';
}

/** Ham bir DiscountItem'ı normalize eder — tüm scraper'lar bunun üzerinden geçmeli. */
function normalizeItem(brand, raw) {
  return {
    id: raw.id || makeId(brand, raw.title, raw.category || ''),
    brand,
    title: (raw.title || '').trim(),
    discountPercent: raw.discountPercent ?? null,
    price: typeof raw.price === 'number' ? raw.price : null,
    originalPrice: typeof raw.originalPrice === 'number' ? raw.originalPrice : null,
    priceText: raw.priceText || null,
    startDate: raw.startDate || null,
    endDate: raw.endDate || null,
    dateConfidence: raw.dateConfidence || 'unknown', // 'exact' | 'inferred' | 'unknown'
    imageUrl: raw.imageUrl || null,
    sourceUrl: raw.sourceUrl || '',
    category: raw.category || null,
    categoryGroup: categorize(raw.category, raw.title),
    scrapedAt: new Date().toISOString(),
  };
}

function todayStr(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Haftalık broşür döngüsü olan marketler için (A101/Şok/BİM), broşürün
 * sitede yayınlandığı ama içinde net tarih olmadığı durumda, bilinen
 * haftalık başlangıç gününden bir startDate/endDate türetir.
 * weekday: 0=Pazar..6=Cumartesi (JS Date.getDay ile aynı). */
function inferWeeklyCycle(weekday, referenceDate = new Date()) {
  const ref = new Date(Date.UTC(
    referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate()
  ));
  const diff = (ref.getUTCDay() - weekday + 7) % 7;
  const start = new Date(ref);
  start.setUTCDate(ref.getUTCDate() - diff);
  const startDate = start.toISOString().slice(0, 10);
  const endDate = addDays(startDate, 6);
  return { startDate, endDate };
}

module.exports = {
  slugify, makeId, normalizeItem, todayStr, addDays, inferWeeklyCycle,
  categorize, CATEGORY_LABELS,
};
