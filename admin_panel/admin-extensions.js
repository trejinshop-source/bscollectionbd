/* ================================================================
   BS Collection BD — Admin Panel Extensions (admin-extensions.js)
   ----------------------------------------------------------------
   বিদ্যমান admin.html-এ নিচের নতুন সেকশন যোগ করে:
   1) রিভিউ ব্যবস্থাপনা (দেখানো/লুকানো/মুছে ফেলা)
   2) ফেক অর্ডার সতর্কতা (এবং তালিকা)
   3) পন্য কার্ডের placement (Home Popular / Bestseller / Shop)
   4) নতুন পন্যের জন্য "product-<sku>.html" এর মত বিস্তারিত পেজ
      স্বয়ংক্রিয় তৈরির টগল
   5) পেজ সেটিংস (frontend এর প্রতিটা পেজের জন্য মেনু)
   6) ব্যবহারকারী তালিকা
   ================================================================ */
(function () {
  'use strict';

  const API = window.API_BASE || 'https://bscollectionbd.onrender.com/api';
  function token() { return localStorage.getItem('bs_admin_token') || localStorage.getItem('adminToken') || ''; }
  function h() { return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() }; }

  async function fetchJSON(path, opts) {
    const res = await fetch(API + path, Object.assign({ headers: h() }, opts || {}));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function toast(m, k) {
    let el = document.getElementById('bs-ext-toast');
    if (!el) {
      el = document.createElement('div'); el.id = 'bs-ext-toast';
      el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#14213D;color:#fff;padding:10px 20px;border-radius:8px;font-size:14px;z-index:99999;opacity:0;transition:.3s;pointer-events:none';
      document.body.appendChild(el);
    }
    el.textContent = m;
    el.style.background = k === 'err' ? '#dc2626' : k === 'ok' ? '#059669' : '#14213D';
    el.style.opacity = '1';
    clearTimeout(toast._t); toast._t = setTimeout(() => el.style.opacity = '0', 2500);
  }
  window.bsExtToast = toast;

  // ── Build container UI ─────────────────────────────────────
  function buildUI() {
    if (document.getElementById('bs-ext-root')) return;
    const root = document.createElement('div');
    root.id = 'bs-ext-root';
    root.innerHTML = `
      <div style="padding:0 20px;margin-top:24px">
        <h2 style="color:#14213D;font-size:20px;margin:0 0 4px">
          <i class="fas fa-cogs" style="color:#FCA311"></i> এডভান্সড অপশন
        </h2>
        <p style="color:#64748b;font-size:13px;margin:0 0 8px">রিভিউ, ফেক অর্ডার, প্লেসমেন্ট, পেজ সেটিংস</p>
      </div>
      <div class="bs-ext-tabs" id="bsExtTabs">
        <button data-tab="reviews"><i class="fas fa-star"></i> রিভিউ (<span data-count="reviews">0</span>)</button>
        <button data-tab="fake"><i class="fas fa-exclamation-triangle"></i> ফেক অর্ডার (<span data-count="fake">0</span>)</button>
        <button data-tab="products"><i class="fas fa-box"></i> এডভান্সড পন্য</button>
        <button data-tab="settings"><i class="fas fa-sliders-h"></i> পেজ সেটিংস</button>
        <button data-tab="users"><i class="fas fa-users"></i> গ্রাহক</button>
      </div>
      <div id="bsExtBody"></div>
      <div class="bs-ext-modal" id="bsExtModal"><div class="box" id="bsExtModalBody"></div></div>
    `;

    // Try to append after the main content area
    const mount = document.querySelector('main, #main, .content, .main-content') || document.body;
    mount.appendChild(root);

    root.querySelectorAll('.bs-ext-tabs button').forEach(b => {
      b.addEventListener('click', () => {
        root.querySelectorAll('.bs-ext-tabs button').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        loadTab(b.dataset.tab);
      });
    });
  }

  const modalEl = () => document.getElementById('bsExtModal');
  function openModal(html) {
    const m = modalEl(); if (!m) return;
    document.getElementById('bsExtModalBody').innerHTML = '<button class="close" onclick="document.getElementById(\'bsExtModal\').classList.remove(\'show\')">×</button>' + html;
    m.classList.add('show');
  }
  window.bsExtCloseModal = () => modalEl()?.classList.remove('show');

  // ── TAB: Reviews ───────────────────────────────────────────
  async function loadReviews() {
    try {
      const list = await fetchJSON('/admin/reviews');
      document.querySelector('[data-count=reviews]').textContent = list.length;
      const rows = list.map(r => `
        <tr>
          <td><b>${esc(r.productName || r.productId)}</b><br><small style="color:#64748b">${esc(r.productId)}</small></td>
          <td>${esc(r.user)}<br><small style="color:#64748b">${esc(r.email || '')}</small></td>
          <td><span style="color:#FCA311">${'★'.repeat(r.rating || 5)}</span><br><small>${new Date(r.createdAt).toLocaleString('en-GB')}</small></td>
          <td>${r.type === 'question' ? '<span class="bs-ext-badge warn">প্রশ্ন</span>' : '<span class="bs-ext-badge ok">রিভিউ</span>'}<br><span class="bs-ext-badge ${r.visible ? 'ok' : 'hide'}">${r.visible ? 'দৃশ্যমান' : 'লুকানো'}</span></td>
          <td style="max-width:300px">${esc(r.text)}</td>
          <td>
            <button class="bs-ext-btn ${r.visible ? 'ghost' : 'orange'}" onclick="bsExtToggleReview('${r._id}',${!r.visible})">${r.visible ? 'লুকান' : 'দেখান'}</button>
            <button class="bs-ext-btn danger" onclick="bsExtDeleteReview('${r._id}')">মুছুন</button>
          </td>
        </tr>`).join('');
      const html = `<div class="bs-ext-panel">
        <table class="bs-ext-table">
          <thead><tr><th>পন্য</th><th>ব্যবহারকারী</th><th>রেটিং/তারিখ</th><th>স্ট্যাটাস</th><th>বিস্তারিত</th><th>অ্যাকশন</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:30px">কোনো রিভিউ নেই</td></tr>'}</tbody>
        </table>
      </div>`;
      document.getElementById('bsExtBody').innerHTML = html;
    } catch (e) { toast(e.message, 'err'); }
  }
  window.bsExtToggleReview = async (id, visible) => {
    try { await fetchJSON('/admin/reviews/' + id, { method: 'PATCH', body: JSON.stringify({ visible }) }); toast('আপডেট সম্পন্ন', 'ok'); loadReviews(); }
    catch (e) { toast(e.message, 'err'); }
  };
  window.bsExtDeleteReview = async (id) => {
    if (!confirm('রিভিউটি মুছে ফেলবেন?')) return;
    try { await fetchJSON('/admin/reviews/' + id, { method: 'DELETE' }); toast('মুছে ফেলা হয়েছে', 'ok'); loadReviews(); }
    catch (e) { toast(e.message, 'err'); }
  };

  // ── TAB: Fake Orders ───────────────────────────────────────
  async function loadFake() {
    try {
      const { orders } = await fetchJSON('/orders?fake=true&limit=100');
      document.querySelector('[data-count=fake]').textContent = orders.length;
      const rows = orders.map(o => `
        <tr class="bs-ext-fake-row">
          <td><b>${esc(o.orderId)}</b><br><small>${new Date(o.createdAt).toLocaleString('en-GB')}</small></td>
          <td>${esc(o.customer.name)}<br><small>${esc(o.customer.phone)}</small></td>
          <td><b style="color:#dc2626">${o.fakeScore}%</b><br><small style="color:#64748b">${(o.fakeReasons || []).map(esc).join('<br>')}</small></td>
          <td><span class="bs-ext-badge warn">${esc(o.status)}</span></td>
          <td>Tk ${o.total || 0}</td>
          <td>
            <button class="bs-ext-btn primary" onclick="bsExtOrderStatus('${o._id}','Verified')">যাচাই ঠিক</button>
            <button class="bs-ext-btn danger" onclick="bsExtOrderStatus('${o._id}','Cancelled')">বাতিল</button>
          </td>
        </tr>`).join('');
      document.getElementById('bsExtBody').innerHTML = `
        <div class="bs-ext-panel">
          <p style="color:#64748b;font-size:13px;margin-bottom:12px">
            স্বয়ংক্রিয়ভাবে ফ্ল্যাগ করা সন্দেহজনক অর্ডারসমূহ। কারণসমূহে আছে: একই ফোন/IP থেকে বহু অর্ডার, অবৈধ ফোন, অস্থায়ী ইমেইল ইত্যাদি।
          </p>
          <table class="bs-ext-table">
            <thead><tr><th>অর্ডার</th><th>গ্রাহক</th><th>ফেক স্কোর ও কারণ</th><th>স্ট্যাটাস</th><th>টোটাল</th><th>অ্যাকশন</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:30px">কোনো ফেক অর্ডার নেই</td></tr>'}</tbody>
          </table>
        </div>`;
    } catch (e) { toast(e.message, 'err'); }
  }
  window.bsExtOrderStatus = async (id, status) => {
    try { await fetchJSON('/orders/' + id, { method: 'PATCH', body: JSON.stringify({ status }) }); toast('স্ট্যাটাস আপডেট', 'ok'); loadFake(); }
    catch (e) { toast(e.message, 'err'); }
  };

  // ── TAB: Advanced Products (with placement + detail page) ──
  async function loadProducts() {
    try {
      const list = await fetchJSON('/products?limit=200');
      const rows = list.map(p => `
        <tr>
          <td><img src="${esc(p.img || '')}" style="width:44px;height:44px;object-fit:cover;border-radius:6px;background:#f1f5f9" onerror="this.style.visibility='hidden'"/></td>
          <td><b>${esc(p.name)}</b><br><small style="color:#64748b">${esc(p.sku || '')}</small></td>
          <td>Tk ${p.now}${p.old ? ' <s style="color:#94a3b8">Tk ' + p.old + '</s>' : ''}</td>
          <td><span class="bs-ext-badge ${p.stock > 5 ? 'ok' : p.stock > 0 ? 'warn' : 'hide'}">${p.stock}</span></td>
          <td>
            ${p.placements?.shop ? '<span class="bs-ext-badge ok">Shop</span> ' : ''}
            ${p.placements?.homePopular ? '<span class="bs-ext-badge warn">Popular</span> ' : ''}
            ${p.placements?.homeBestseller ? '<span class="bs-ext-badge warn">Bestseller</span> ' : ''}
            ${p.placements?.homeNew ? '<span class="bs-ext-badge warn">New</span>' : ''}
          </td>
          <td>${p.hasDetailPage ? '<span class="bs-ext-badge ok">' + esc(p.detailPage) + '</span>' : '<span class="bs-ext-badge hide">নেই</span>'}</td>
          <td>
            <button class="bs-ext-btn primary" onclick="bsExtEditProduct('${p._id}')">এডিট</button>
          </td>
        </tr>`).join('');
      document.getElementById('bsExtBody').innerHTML = `
        <div class="bs-ext-panel">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <h3 style="margin:0;color:#14213D">এডভান্সড পন্য ব্যবস্থাপনা</h3>
            <button class="bs-ext-btn orange" onclick="bsExtEditProduct()">
              <i class="fas fa-plus"></i> নতুন পন্য (বিস্তারিত পেজ সহ)
            </button>
          </div>
          <table class="bs-ext-table">
            <thead><tr><th></th><th>নাম / SKU</th><th>দাম</th><th>স্টক</th><th>দৃশ্যমান</th><th>বিস্তারিত পেজ</th><th></th></tr></thead>
            <tbody>${rows || '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:30px">কোনো পন্য নেই</td></tr>'}</tbody>
          </table>
        </div>`;
    } catch (e) { toast(e.message, 'err'); }
  }

  window.bsExtEditProduct = async (id) => {
    let p = { placements: { shop: true }, specs: [], gallery: [] };
    if (id) p = await fetchJSON('/products/id/' + id);
    p.placements = p.placements || { shop: true };
    p.specs = p.specs || []; p.gallery = p.gallery || [];
    const specsRows = (p.specs || []).map((s, i) => `
      <div class="row" style="margin-bottom:8px" data-spec-row="${i}">
        <input placeholder="লেবেল (যেমন: Battery)" value="${esc(s.label || '')}" data-spec-label="${i}"/>
        <input placeholder="ভ্যালু (যেমন: 6V/4.5Ah)" value="${esc(s.value || '')}" data-spec-value="${i}"/>
      </div>`).join('');

    openModal(`
      <h3 style="color:#14213D;margin:0 0 20px"><i class="fas fa-box"></i> ${id ? 'পন্য এডিট' : 'নতুন পন্য যোগ'}</h3>
      <form class="bs-ext-form" id="bsExtProdForm">
        <div class="row">
          <label>SKU * <input required name="sku" value="${esc(p.sku || '')}" placeholder="যেমন: jy2218"/></label>
          <label>পন্যের নাম * <input required name="name" value="${esc(p.name || '')}" placeholder="JYSUPER JY-2218"/></label>
        </div>
        <div class="row-3">
          <label>ক্যাটাগরি <input name="cat" value="${esc(p.cat || '')}"/></label>
          <label>ব্র্যান্ড <input name="brand" value="${esc(p.brand || 'bscollectionbd')}"/></label>
          <label>ক্যাটাগরি স্লাগ <input name="categorySlug" value="${esc(p.categorySlug || '')}"/></label>
        </div>
        <div class="row-3">
          <label>দাম (Now) * <input required type="number" name="now" value="${p.now || ''}"/></label>
          <label>পূর্ব দাম (Old) <input type="number" name="old" value="${p.old || ''}"/></label>
          <label>স্টক * <input required type="number" name="stock" value="${p.stock || 0}"/></label>
        </div>
        <label>বর্ণনা <textarea name="description" rows="4">${esc(p.description || '')}</textarea></label>

        <label>ছবি (ড্র্যাগ করে ছেড়ে দিন — একাধিক):</label>
        <div class="bs-ext-dropzone" id="bsExtDropzone">
          <i class="fas fa-cloud-upload-alt" style="font-size:32px;color:#FCA311"></i>
          <p style="margin:8px 0 0;color:#64748b;font-size:13px">এখানে ফাইল টেনে ছাড়ুন অথবা ক্লিক করুন</p>
          <input type="file" id="bsExtFileInput" accept="image/*" multiple style="display:none"/>
        </div>
        <div class="bs-ext-thumbs" id="bsExtThumbs">
          ${(p.gallery || []).map((u, i) => `<div class="thumb" data-url="${esc(u)}"><img src="${esc(u)}"/><button type="button" onclick="this.parentElement.remove()">×</button></div>`).join('')}
          ${p.img && !(p.gallery || []).includes(p.img) ? `<div class="thumb" data-url="${esc(p.img)}"><img src="${esc(p.img)}"/><button type="button" onclick="this.parentElement.remove()">×</button></div>` : ''}
        </div>

        <label style="margin-top:14px">কোথায় দেখাবে (placement):</label>
        <div class="bs-ext-placements">
          <label><input type="checkbox" name="pl_shop" ${p.placements.shop ? 'checked' : ''}/> শপ পেজ</label>
          <label><input type="checkbox" name="pl_pop" ${p.placements.homePopular ? 'checked' : ''}/> হোম — জনপ্রিয় পন্য</label>
          <label><input type="checkbox" name="pl_best" ${p.placements.homeBestseller ? 'checked' : ''}/> হোম — সেরা বিক্রিত</label>
          <label><input type="checkbox" name="pl_new" ${p.placements.homeNew ? 'checked' : ''}/> হোম — নতুন পন্য</label>
          <label><input type="checkbox" name="featured" ${p.featured ? 'checked' : ''}/> Featured</label>
        </div>

        <label style="margin-top:14px">Specs (label + value):
          <div id="bsExtSpecs">${specsRows}</div>
          <button type="button" class="bs-ext-btn ghost" onclick="bsExtAddSpec()"><i class="fas fa-plus"></i> নতুন স্পেক যোগ</button>
        </label>

        <div class="row" style="margin-top:14px">
          <label>বিস্তারিত পেজের ফাইলনেম <input name="detailPage" value="${esc(p.detailPage || '')}" placeholder="product-jy2218.html"/></label>
          <label style="align-self:end">
            <input type="checkbox" name="hasDetailPage" ${p.hasDetailPage ? 'checked' : ''} style="width:auto;margin-right:6px"/>
            বিস্তারিত পেজ আছে
          </label>
        </div>
        <p style="color:#64748b;font-size:12px;margin:-10px 0 14px">খালি রাখলে SKU থেকে <code>product-&lt;sku&gt;.html</code> স্বয়ংক্রিয়ভাবে তৈরি হবে</p>

        <div style="text-align:right;margin-top:20px;display:flex;gap:8px;justify-content:flex-end">
          <button type="button" class="bs-ext-btn ghost" onclick="bsExtCloseModal()">বাতিল</button>
          ${id ? `<button type="button" class="bs-ext-btn danger" onclick="bsExtDeleteProduct('${id}')">মুছে ফেলুন</button>` : ''}
          <button type="submit" class="bs-ext-btn primary"><i class="fas fa-save"></i> সেভ করুন</button>
        </div>
      </form>
    `);

    // dropzone wiring
    const dz = document.getElementById('bsExtDropzone');
    const fi = document.getElementById('bsExtFileInput');
    const th = document.getElementById('bsExtThumbs');
    dz.onclick = () => fi.click();
    dz.ondragover = (e) => { e.preventDefault(); dz.classList.add('dragover'); };
    dz.ondragleave = () => dz.classList.remove('dragover');
    dz.ondrop = (e) => { e.preventDefault(); dz.classList.remove('dragover'); handleFiles(e.dataTransfer.files); };
    fi.onchange = () => handleFiles(fi.files);
    async function handleFiles(files) {
      if (!files || !files.length) return;
      const fd = new FormData();
      Array.from(files).forEach(f => fd.append('images', f));
      try {
        const res = await fetch(API + '/products/upload', { method: 'POST', headers: { Authorization: 'Bearer ' + token() }, body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'আপলোড ব্যর্থ');
        (data.urls || []).forEach(u => {
          const d = document.createElement('div'); d.className = 'thumb'; d.dataset.url = u;
          d.innerHTML = `<img src="${u}"/><button type="button" onclick="this.parentElement.remove()">×</button>`;
          th.appendChild(d);
        });
        toast('ছবি আপলোড হয়েছে', 'ok');
      } catch (e) { toast(e.message, 'err'); }
    }

    // submit
    document.getElementById('bsExtProdForm').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const gallery = Array.from(th.querySelectorAll('.thumb')).map(t => t.dataset.url).filter(Boolean);
      const specs = [];
      document.querySelectorAll('#bsExtSpecs [data-spec-row]').forEach(r => {
        const i = r.dataset.specRow;
        const label = r.querySelector(`[data-spec-label="${i}"]`)?.value.trim();
        const value = r.querySelector(`[data-spec-value="${i}"]`)?.value.trim();
        if (label && value) specs.push({ label, value });
      });
      const body = {
        sku: fd.get('sku'), name: fd.get('name'), cat: fd.get('cat'), brand: fd.get('brand'),
        categorySlug: fd.get('categorySlug'), now: +fd.get('now'), old: +fd.get('old') || undefined,
        stock: +fd.get('stock'), description: fd.get('description'),
        detailPage: fd.get('detailPage') || undefined,
        hasDetailPage: fd.get('hasDetailPage') === 'on',
        featured: fd.get('featured') === 'on',
        img: gallery[0] || '', gallery, specs,
        placements: {
          shop: fd.get('pl_shop') === 'on',
          homePopular: fd.get('pl_pop') === 'on',
          homeBestseller: fd.get('pl_best') === 'on',
          homeNew: fd.get('pl_new') === 'on',
        },
      };
      try {
        if (id) await fetchJSON('/products/id/' + id, { method: 'PUT', body: JSON.stringify(body) });
        else await fetchJSON('/products', { method: 'POST', body: JSON.stringify(body) });
        toast('সেভ হয়েছে', 'ok'); bsExtCloseModal(); loadProducts();
      } catch (err) { toast(err.message, 'err'); }
    };
  };
  window.bsExtAddSpec = () => {
    const wrap = document.getElementById('bsExtSpecs');
    const i = wrap.querySelectorAll('[data-spec-row]').length;
    const div = document.createElement('div');
    div.className = 'row'; div.style.marginBottom = '8px'; div.dataset.specRow = i;
    div.innerHTML = `<input placeholder="লেবেল" data-spec-label="${i}"/><input placeholder="ভ্যালু" data-spec-value="${i}"/>`;
    wrap.appendChild(div);
  };
  window.bsExtDeleteProduct = async (id) => {
    if (!confirm('পন্য মুছে ফেলবেন?')) return;
    try { await fetchJSON('/products/id/' + id, { method: 'DELETE' }); toast('মুছে ফেলা হয়েছে', 'ok'); bsExtCloseModal(); loadProducts(); }
    catch (e) { toast(e.message, 'err'); }
  };

  // ── TAB: Page Settings ─────────────────────────────────────
  async function loadSettings() {
    try {
      const pages = await fetchJSON('/page-settings');
      const html = `
        <div class="bs-ext-panel">
          <p style="color:#64748b;font-size:13px;margin-bottom:16px">
            প্রতিটি পেজের টাইটেল, মেটা ডেসক্রিপশন, হিরো সেকশন এবং কাস্টম কন্টেন্ট এখান থেকে পরিবর্তন করা যাবে।
            পরিবর্তনগুলো ডেটাবেজে সেভ হয় এবং frontend থেকে API-এর মাধ্যমে fetch হয়।
          </p>
          <div style="display:grid;grid-template-columns:220px 1fr;gap:16px">
            <div id="bsExtPageList" style="border-right:1px solid #e2e8f0;padding-right:16px">
              ${pages.map(p => `
                <button class="bs-ext-btn ghost" data-page="${p.page}" style="display:block;width:100%;text-align:left;margin-bottom:6px">
                  <i class="fas fa-file"></i> ${esc(p.label || p.page)}
                </button>`).join('')}
            </div>
            <div id="bsExtPageEditor"><p style="color:#94a3b8">বাম দিক থেকে একটি পেজ নির্বাচন করুন</p></div>
          </div>
        </div>`;
      document.getElementById('bsExtBody').innerHTML = html;
      document.querySelectorAll('#bsExtPageList [data-page]').forEach(b => {
        b.onclick = () => editPage(b.dataset.page, pages.find(x => x.page === b.dataset.page));
      });
    } catch (e) { toast(e.message, 'err'); }
  }

  function editPage(pageKey, current) {
    const c = current || {};
    const hero = c.hero || {};
    document.getElementById('bsExtPageEditor').innerHTML = `
      <form class="bs-ext-form" id="bsExtPageForm">
        <h3 style="margin:0 0 16px;color:#14213D"><i class="fas fa-file-alt"></i> ${esc(c.label || pageKey)} — পেজ সেটিংস</h3>
        <label>Page Title <input name="title" value="${esc(c.title || '')}"/></label>
        <label>Meta Description <textarea name="metaDescription" rows="2">${esc(c.metaDescription || '')}</textarea></label>
        <h4 style="color:#14213D;margin:16px 0 10px;font-size:14px">Hero Section</h4>
        <label>Hero Headline <input name="hero_headline" value="${esc(hero.headline || '')}"/></label>
        <label>Hero Subheadline <input name="hero_subheadline" value="${esc(hero.subheadline || '')}"/></label>
        <label>Hero Image URL <input name="hero_image" value="${esc(hero.image || '')}"/></label>
        <div class="row">
          <label>CTA Label <input name="hero_ctaLabel" value="${esc(hero.ctaLabel || '')}"/></label>
          <label>CTA Link <input name="hero_ctaHref" value="${esc(hero.ctaHref || '')}"/></label>
        </div>
        <label>Custom Content (JSON — free-form key/value):
          <textarea name="content" rows="6" style="font-family:monospace;font-size:12px">${esc(JSON.stringify(c.content || {}, null, 2))}</textarea>
        </label>
        <button type="submit" class="bs-ext-btn primary"><i class="fas fa-save"></i> এই পেজ সেভ করুন</button>
      </form>
    `;
    document.getElementById('bsExtPageForm').onsubmit = async (e) => {
      e.preventDefault(); const fd = new FormData(e.target);
      let content = {}; try { content = JSON.parse(fd.get('content') || '{}'); } catch { return toast('JSON invalid', 'err'); }
      const body = {
        title: fd.get('title'), metaDescription: fd.get('metaDescription'),
        hero: {
          headline: fd.get('hero_headline'), subheadline: fd.get('hero_subheadline'),
          image: fd.get('hero_image'), ctaLabel: fd.get('hero_ctaLabel'), ctaHref: fd.get('hero_ctaHref'),
        },
        content,
      };
      try {
        await fetchJSON('/page-settings/' + pageKey, { method: 'PUT', body: JSON.stringify(body) });
        toast('পেজ সেটিংস সেভ হয়েছে', 'ok');
      } catch (err) { toast(err.message, 'err'); }
    };
  }

  // ── TAB: Users ─────────────────────────────────────────────
  async function loadUsers() {
    try {
      const list = await fetchJSON('/users');
      const rows = list.map(u => `
        <tr>
          <td><b>${esc(u.name)}</b></td>
          <td>${esc(u.email)}</td>
          <td>${esc(u.phone || '')}</td>
          <td>${new Date(u.createdAt).toLocaleDateString('en-GB')}</td>
          <td><button class="bs-ext-btn danger" onclick="bsExtDelUser('${u._id}')">মুছুন</button></td>
        </tr>`).join('');
      document.getElementById('bsExtBody').innerHTML = `
        <div class="bs-ext-panel">
          <table class="bs-ext-table">
            <thead><tr><th>নাম</th><th>ইমেইল</th><th>ফোন</th><th>রেজিস্টার</th><th></th></tr></thead>
            <tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:30px">কোনো গ্রাহক নেই</td></tr>'}</tbody>
          </table>
        </div>`;
    } catch (e) { toast(e.message, 'err'); }
  }
  window.bsExtDelUser = async (id) => {
    if (!confirm('গ্রাহক মুছে ফেলবেন?')) return;
    try { await fetchJSON('/users/' + id, { method: 'DELETE' }); toast('মুছে ফেলা হয়েছে', 'ok'); loadUsers(); }
    catch (e) { toast(e.message, 'err'); }
  };

  // ── Router ─────────────────────────────────────────────────
  function loadTab(tab) {
    switch (tab) {
      case 'reviews': return loadReviews();
      case 'fake': return loadFake();
      case 'products': return loadProducts();
      case 'settings': return loadSettings();
      case 'users': return loadUsers();
    }
  }

  // ── init after admin login ────────────────────────────────
  function init() {
    buildUI();
    // preload badges
    fetchJSON('/admin/reviews').then(l => { document.querySelector('[data-count=reviews]').textContent = l.length; }).catch(() => {});
    fetchJSON('/orders?fake=true&limit=1').then(r => { document.querySelector('[data-count=fake]').textContent = r.total || 0; }).catch(() => {});
    // Auto-open first tab
    const first = document.querySelector('.bs-ext-tabs button');
    if (first) first.click();
  }

  // Wait for admin login: poll every second until token exists
  function boot() {
    if (token()) return init();
    setTimeout(boot, 1000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
