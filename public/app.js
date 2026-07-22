(() => {
  const BRAND_META = {
    migros:      { label: 'Migros',      color: '#f7941d' },
    carrefoursa: { label: 'CarrefourSA', color: '#004b93' },
    a101:        { label: 'A101',        color: '#e30613' },
    bim:         { label: 'BİM',         color: '#ff6600' },
    sok:         { label: 'Şok',         color: '#f39200' },
    watsons:     { label: 'Watsons',     color: '#00a19a' },
    gratis:      { label: 'Gratis',      color: '#e6007e' },
    macrocenter: { label: 'Macrocenter', color: '#2e7d32' },
    unknown:     { label: '?',           color: '#6b7280' },
  };

  let allItems = [];
  let categoryMeta = {};
  let activeBrand = '';
  let activeCategory = '';
  let sortMode = 'default';

  const $ = (sel) => document.querySelector(sel);
  const activeGrid = $('#active-grid');
  const upcomingGrid = $('#upcoming-grid');
  const activeEmpty = $('#active-empty');
  const upcomingEmpty = $('#upcoming-empty');
  const statsRow = $('#stats-row');
  const brandFiltersEl = $('#brand-filters');
  const categoryFiltersEl = $('#category-filters');
  const sortSelect = $('#sort-select');
  const refreshBtn = $('#refresh-btn');
  const toast = $('#toast');

  function showToast(msg, ms = 2600) {
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { toast.hidden = true; }, ms);
  }

  function formatDateRange(item) {
    if (item.dateConfidence === 'unknown' || (!item.startDate && !item.endDate)) {
      return { text: 'Şu an aktif', cls: 'unknown' };
    }
    if (item.status === 'upcoming') {
      return { text: `${item.startDate} tarihinde başlıyor`, cls: 'upcoming' };
    }
    if (item.endDate) {
      return { text: `${item.endDate} tarihine kadar`, cls: 'active' };
    }
    return { text: 'Şu an aktif', cls: 'active' };
  }

  function cardHtml(item) {
    const brand = BRAND_META[item.brand] || BRAND_META.unknown;
    const dateInfo = formatDateRange(item);
    const img = item.imageUrl
      ? `<img class="card-img" src="${escapeAttr(item.imageUrl)}" alt="" loading="lazy" onerror="this.style.display='none'">`
      : `<div class="card-img placeholder">🏷️</div>`;

    return `
      <a class="card" href="${escapeAttr(item.sourceUrl || '#')}" target="_blank" rel="noopener noreferrer">
        <div class="card-top">
          ${img}
          <div style="min-width:0">
            <p class="card-title">${escapeHtml(item.title)}</p>
          </div>
        </div>
        <div class="card-brand-row">
          <span class="brand-badge" style="background:${brand.color}">${escapeHtml(brand.label)}</span>
          ${item.discountPercent != null ? `<span class="discount-pill">%${Math.round(item.discountPercent)}</span>` : ''}
        </div>
        ${item.priceText ? `<p class="card-price">${escapeHtml(item.priceText)}</p>` : ''}
        <div class="card-date ${dateInfo.cls}">${dateInfo.text}</div>
      </a>`;
  }

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }
  function escapeAttr(str) { return escapeHtml(str); }

  function applySort(items) {
    const sorted = items.slice();
    switch (sortMode) {
      case 'discount_desc':
        return sorted.sort((a, b) => (b.discountPercent ?? -1) - (a.discountPercent ?? -1));
      case 'discount_asc':
        return sorted.sort((a, b) => (a.discountPercent ?? Infinity) - (b.discountPercent ?? Infinity));
      case 'price_asc':
        return sorted.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
      case 'price_desc':
        return sorted.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
      default:
        return sorted;
    }
  }

  function matchesFilters(item, { skipBrand = false, skipCategory = false } = {}) {
    if (!skipBrand && activeBrand && item.brand !== activeBrand) return false;
    if (!skipCategory && activeCategory && item.categoryGroup !== activeCategory) return false;
    return true;
  }

  function render() {
    const filtered = allItems.filter(i => matchesFilters(i));
    const active = applySort(filtered.filter(i => i.status === 'active'));
    let upcoming = filtered.filter(i => i.status === 'upcoming');
    upcoming = sortMode === 'default'
      ? upcoming.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''))
      : applySort(upcoming);

    activeGrid.innerHTML = active.map(cardHtml).join('');
    upcomingGrid.innerHTML = upcoming.map(cardHtml).join('');
    activeEmpty.hidden = active.length > 0;
    upcomingEmpty.hidden = upcoming.length > 0;

    renderStats(filtered, active, upcoming);
  }

  function renderStats(filtered, active, upcoming) {
    const withDiscount = active.filter(i => i.discountPercent != null);
    const avgDiscount = withDiscount.length
      ? Math.round(withDiscount.reduce((s, i) => s + i.discountPercent, 0) / withDiscount.length)
      : 0;
    const brandCount = new Set(filtered.map(i => i.brand)).size;

    statsRow.innerHTML = `
      <div class="stat-card"><div class="stat-value">${active.length}</div><div class="stat-label">Aktif İndirim</div></div>
      <div class="stat-card"><div class="stat-value">${upcoming.length}</div><div class="stat-label">Yakında Başlayacak</div></div>
      <div class="stat-card"><div class="stat-value">${Number.isFinite(avgDiscount) ? avgDiscount : 0}%</div><div class="stat-label">Ortalama İndirim</div></div>
      <div class="stat-card"><div class="stat-value">${brandCount}</div><div class="stat-label">Marka</div></div>
    `;
  }

  function renderBrandFilters(brandsMeta) {
    const scoped = allItems.filter(i => matchesFilters(i, { skipBrand: true }));
    const counts = {};
    for (const item of scoped) counts[item.brand] = (counts[item.brand] || 0) + 1;

    const allBrandKeys = Object.keys(BRAND_META).filter(k => k !== 'unknown');
    const chips = [`<button class="chip ${activeBrand === '' ? 'active' : ''}" data-brand="">Tümü <span class="chip-count">${scoped.length}</span></button>`];
    for (const key of allBrandKeys) {
      const meta = BRAND_META[key];
      const count = counts[key] || 0;
      const brandInfo = brandsMeta.find(b => b.key === key);
      const isStub = brandInfo && brandInfo.status === 'stub';
      chips.push(`
        <button class="chip ${activeBrand === key ? 'active' : ''}" data-brand="${key}" ${count === 0 ? 'disabled title="Henüz veri yok' + (isStub ? ' — scraper henüz yazılmadı' : '') + '"' : ''}>
          ${escapeHtml(meta.label)} <span class="chip-count">${count}</span>
        </button>`);
    }
    brandFiltersEl.innerHTML = chips.join('');

    brandFiltersEl.querySelectorAll('.chip').forEach(btn => {
      btn.addEventListener('click', () => {
        activeBrand = btn.dataset.brand;
        renderBrandFilters(brandsMeta);
        renderCategoryFilters();
        render();
      });
    });
  }

  function renderCategoryFilters() {
    const scoped = allItems.filter(i => matchesFilters(i, { skipCategory: true }));
    const counts = {};
    for (const item of scoped) counts[item.categoryGroup] = (counts[item.categoryGroup] || 0) + 1;

    const order = Object.keys(categoryMeta);
    const chips = [`<button class="chip ${activeCategory === '' ? 'active' : ''}" data-category="">Tüm Kategoriler <span class="chip-count">${scoped.length}</span></button>`];
    for (const key of order) {
      const meta = categoryMeta[key];
      const count = counts[key] || 0;
      if (count === 0) continue; // veri olmayan kategoriyi listede kirletmeyelim
      chips.push(`
        <button class="chip ${activeCategory === key ? 'active' : ''}" data-category="${key}">
          ${meta.icon} ${escapeHtml(meta.label)} <span class="chip-count">${count}</span>
        </button>`);
    }
    categoryFiltersEl.innerHTML = chips.join('');

    categoryFiltersEl.querySelectorAll('.chip').forEach(btn => {
      btn.addEventListener('click', () => {
        activeCategory = btn.dataset.category;
        renderCategoryFilters();
        renderBrandFilters(lastBrandsMeta);
        render();
      });
    });
  }

  let lastBrandsMeta = [];

  async function loadDiscounts() {
    const res = await fetch('/api/discounts');
    const data = await res.json();
    allItems = data.items;
  }

  async function loadCategories() {
    const res = await fetch('/api/categories');
    const data = await res.json();
    categoryMeta = data.categories;
  }

  async function loadBrandsAndRender() {
    const res = await fetch('/api/brands');
    const data = await res.json();
    lastBrandsMeta = data.brands;
    renderBrandFilters(lastBrandsMeta);
    renderCategoryFilters();
    render();
  }

  async function init() {
    await Promise.all([loadDiscounts(), loadCategories()]);
    await loadBrandsAndRender();
  }

  sortSelect.addEventListener('change', () => {
    sortMode = sortSelect.value;
    render();
  });

  refreshBtn.addEventListener('click', async () => {
    refreshBtn.disabled = true;
    const icon = refreshBtn.querySelector('.btn-icon');
    icon.classList.add('spin');
    showToast('Markalar taranıyor, bu birkaç saniye sürebilir…', 15000);
    try {
      const res = await fetch('/api/refresh', { method: 'POST' });
      const data = await res.json();
      await init();
      const okCount = data.result.filter(r => r.status === 'ok').length;
      showToast(`Tarama tamamlandı: ${okCount}/${data.result.length} marka güncellendi.`);
    } catch (e) {
      showToast('Tarama sırasında hata oluştu: ' + e.message);
    } finally {
      refreshBtn.disabled = false;
      icon.classList.remove('spin');
    }
  });

  init();
})();
