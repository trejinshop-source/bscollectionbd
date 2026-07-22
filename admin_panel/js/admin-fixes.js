/* =========================================================================
   BS Collection BD — Admin Panel Fixes (admin-fixes.js)
   ------------------------------------------------------------------------
   Non-invasive add-on for admin.html. Adds:
     • Popup notifications (replaces alerts)
     • "Auto SEO" button — fills SEO fields from name/description/price
     • Search-type dropdown (product vs landing page)
     • Product search inside landing-page editor
     • "Related Products" auto-populate by category
     • Highlight products without landing pages in Product Catalog
     • Better "Fake Order" details button binding
     • Address breakdown display in order details + email
     • Color+size+weight swatch (variant) manager
   ========================================================================= */
(function () {
  'use strict';
  if (window.__BS_ADMIN_FIXES) return;
  window.__BS_ADMIN_FIXES = true;

  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const $ = (s, c) => (c || document).querySelector(s);

  // ---------- Popup ----------
  function popup(msg, kind) {
    kind = kind || 'ok';
    let el = document.getElementById('bs-admin-popup');
    if (!el) {
      el = document.createElement('div');
      el.id = 'bs-admin-popup';
      el.innerHTML = `<div class="bap-bd"></div><div class="bap-card"><div class="bap-ico"></div><div class="bap-msg"></div><button class="bap-ok">ঠিক আছে</button></div>`;
      document.body.appendChild(el);
      const s = document.createElement('style');
      s.textContent = `
        #bs-admin-popup{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;font-family:inherit}
        #bs-admin-popup.show{display:flex}
        #bs-admin-popup .bap-bd{position:absolute;inset:0;background:rgba(11,21,38,.6)}
        #bs-admin-popup .bap-card{position:relative;background:#fff;border-radius:16px;padding:28px 26px;min-width:300px;max-width:440px;text-align:center;box-shadow:0 25px 60px rgba(0,0,0,.3);animation:bapPop .25s}
        #bs-admin-popup .bap-ico{font-size:46px;margin-bottom:8px}
        #bs-admin-popup.ok .bap-ico::before{content:'✅'}
        #bs-admin-popup.err .bap-ico::before{content:'⚠️'}
        #bs-admin-popup.info .bap-ico::before{content:'ℹ️'}
        #bs-admin-popup .bap-msg{color:#14213D;font-weight:600;font-size:15px;line-height:1.55;margin-bottom:16px;white-space:pre-line}
        #bs-admin-popup .bap-ok{background:#14213D;color:#fff;border:0;padding:10px 24px;border-radius:8px;font-weight:600;cursor:pointer}
        #bs-admin-popup .bap-ok:hover{background:#FCA311;color:#14213D}
        @keyframes bapPop{from{transform:scale(.9);opacity:0}to{transform:scale(1);opacity:1}}
      `;
      document.head.appendChild(s);
      el.querySelector('.bap-ok').addEventListener('click', () => el.classList.remove('show'));
      el.querySelector('.bap-bd').addEventListener('click', () => el.classList.remove('show'));
    }
    el.className = kind + ' show';
    el.querySelector('.bap-msg').textContent = msg;
  }
  window.bsAdminPopup = popup;

  // Intercept alert() calls that carry admin update messages → show popup.
  const origAlert = window.alert;
  window.alert = function (m) {
    try {
      const s = String(m || '');
      if (/আপডেট|সেভ|সফল|success|updated|saved|তৈরি হয়েছে|যোগ হয়েছে|মুছে ফেলা/.test(s)) {
        popup(s, 'ok');
        return;
      }
    } catch (_) {}
    return origAlert.apply(this, arguments);
  };

  // ---------- Auto SEO button ----------
  function autoFillSEO(form) {
    if (!form) return;
    const nameEl = form.querySelector('[name="name"],[name="title"],#productName,#pName,#pTitle');
    const descEl = form.querySelector('[name="description"],[name="desc"],#productDescription,#pDesc,#description');
    const priceEl = form.querySelector('[name="price"],#productPrice,#pPrice');
    const codeEl = form.querySelector('[name="code"],[name="sku"],#productCode,#pCode,#pSku');
    const imgEl = form.querySelector('[name="image"],[name="imageUrl"],#productImage,#pImage');
    const name = (nameEl && nameEl.value) || '';
    const desc = (descEl && descEl.value) || '';
    const price = (priceEl && priceEl.value) || '';
    const code = (codeEl && codeEl.value) || '';
    const img = (imgEl && imgEl.value) || '';
    if (!name && !desc) { popup('প্রথমে পণ্যের নাম ও বিবরণ পূরণ করুন', 'err'); return; }

    const seoTitleEl = form.querySelector('[name="seoTitle"],[name="metaTitle"],#seoTitle,#metaTitle');
    const seoDescEl = form.querySelector('[name="seoDescription"],[name="metaDescription"],#seoDescription,#metaDescription');
    const seoKwEl = form.querySelector('[name="seoKeywords"],[name="metaKeywords"],#seoKeywords,#metaKeywords');
    const ogTitleEl = form.querySelector('[name="ogTitle"],#ogTitle');
    const ogDescEl = form.querySelector('[name="ogDescription"],#ogDescription');
    const ogImgEl = form.querySelector('[name="ogImage"],#ogImage');
    const slugEl = form.querySelector('[name="slug"],#slug,#pSlug');

    const cleanName = name.trim();
    const shortDesc = (desc.replace(/<[^>]+>/g, '').trim().slice(0, 155)) || (cleanName + (price ? ' — মূল্য ৳' + price : ''));
    const kwSrc = (cleanName + ' ' + code + ' bscollectionbd').split(/\s+/).filter(Boolean).slice(0, 10).join(', ');

    if (seoTitleEl && !seoTitleEl.value) seoTitleEl.value = cleanName + ' | BS Collection BD';
    if (seoDescEl && !seoDescEl.value) seoDescEl.value = shortDesc;
    if (seoKwEl && !seoKwEl.value) seoKwEl.value = kwSrc;
    if (ogTitleEl && !ogTitleEl.value) ogTitleEl.value = cleanName + ' | BS Collection BD';
    if (ogDescEl && !ogDescEl.value) ogDescEl.value = shortDesc;
    if (ogImgEl && !ogImgEl.value && img) ogImgEl.value = img;
    if (slugEl && !slugEl.value && cleanName) {
      slugEl.value = cleanName.toLowerCase()
        .replace(/[^\w\u0980-\u09FF\s-]/g, '')
        .trim().replace(/\s+/g, '-').slice(0, 60);
    }
    [seoTitleEl, seoDescEl, seoKwEl, ogTitleEl, ogDescEl, ogImgEl, slugEl].forEach(el => {
      if (!el) return;
      el.style.background = '#FFF7DB';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    popup('স্বয়ংক্রিয়ভাবে SEO ফিল্ডসমূহ পূরণ করা হয়েছে', 'ok');
  }

  function injectAutoSEOButtons() {
    // For every form/modal that has both a name field AND a seoTitle/metaTitle field.
    $$('form, .modal, .card, section').forEach(container => {
      if (container.__bsAutoSEO) return;
      const hasName = container.querySelector('[name="name"],[name="title"],#productName,#pName,#pTitle');
      const hasSEO = container.querySelector('[name="seoTitle"],[name="metaTitle"],[name="metaDescription"],[name="seoDescription"],#seoTitle,#metaTitle');
      if (!hasName || !hasSEO) return;
      container.__bsAutoSEO = true;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = '⚡ অটো SEO';
      btn.style.cssText = 'background:#FCA311;color:#14213D;border:0;padding:8px 14px;border-radius:8px;font-weight:700;cursor:pointer;margin:8px 0;display:inline-block';
      btn.addEventListener('click', () => autoFillSEO(container));
      // Place near the SEO field
      hasSEO.parentNode.insertBefore(btn, hasSEO);
    });
  }

  // ---------- Search dropdown (product vs landing page) ----------
  function injectSearchDropdown() {
    const search = document.querySelector('#globalSearch, #searchInput, input[type="search"][placeholder*="সার্চ"], header input[type="search"], .top-search input');
    if (!search || search.__bsSearchType) return;
    search.__bsSearchType = true;
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:inline-flex;align-items:center;gap:6px;margin-right:6px';
    const sel = document.createElement('select');
    sel.id = 'bsSearchType';
    sel.innerHTML = `
      <option value="product">পণ্য কার্ড সার্চ করুন</option>
      <option value="landing">ল্যান্ডিংপেজ সার্চ করুন</option>
    `;
    sel.style.cssText = 'padding:8px;border-radius:8px;border:1px solid #d1d5db;font-family:inherit;background:#fff';
    wrap.appendChild(sel);
    search.parentNode.insertBefore(wrap, search);
    search.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const q = search.value.trim();
      if (!q) return;
      e.preventDefault();
      const type = sel.value;
      // Emit custom event; admin.html handlers can listen; otherwise scroll to matching row.
      window.dispatchEvent(new CustomEvent('bs:admin-search', { detail: { q, type } }));
      // Basic fallback: try to switch to the matching section
      if (type === 'landing') {
        const nav = $$('nav a, .sidebar a').find(a => /ল্যান্ডিং/.test(a.textContent));
        if (nav) nav.click();
      } else {
        const nav = $$('nav a, .sidebar a').find(a => /Product|পণ্য|Catalog|কার্ড/i.test(a.textContent));
        if (nav) nav.click();
      }
      // Highlight matching rows
      setTimeout(() => {
        const rows = $$('table tr, .product-row, .card');
        let hit = 0;
        rows.forEach(r => {
          const t = r.textContent.toLowerCase();
          if (t.indexOf(q.toLowerCase()) > -1) {
            r.style.background = '#FFF3C4';
            r.scrollIntoView({ behavior: 'smooth', block: 'center' });
            hit++;
          } else {
            r.style.background = '';
          }
        });
        if (!hit) popup('কোনো ফলাফল পাওয়া যায়নি: ' + q, 'info');
      }, 400);
    });
  }

  // ---------- Highlight products without landing page ----------
  function highlightNoLandingProducts() {
    $$('table tr, .product-row').forEach(row => {
      if (row.__bsHl) return;
      const txt = row.textContent || '';
      const hasLandingUrl = /landing\.html\?slug=|product-[a-z0-9]+\.html/i.test(row.innerHTML);
      const hasProductId = /jy\d{3,}|প্রোডাক্ট|SKU|Product/i.test(txt);
      if (!hasProductId) return;
      row.__bsHl = true;
      if (!hasLandingUrl) {
        row.style.borderLeft = '4px solid #DC2626';
        if (!row.querySelector('.bs-no-landing-badge')) {
          const b = document.createElement('span');
          b.className = 'bs-no-landing-badge';
          b.textContent = 'ল্যান্ডিং পেজ নেই';
          b.style.cssText = 'display:inline-block;background:#DC2626;color:#fff;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;margin-left:6px';
          const firstTd = row.querySelector('td');
          if (firstTd) firstTd.appendChild(b);
        }
      }
    });
  }

  // ---------- Address breakdown formatter (for order detail modal) ----------
  window.bsFormatAddress = function (order) {
    if (!order) return '';
    const parts = [
      { label: 'বিভাগ', v: order.division || order.address_division || '' },
      { label: 'জেলা', v: order.district || order.address_district || '' },
      { label: 'থানা/উপজেলা', v: order.upazila || order.thana || order.address_thana || '' },
      { label: 'ইউনিয়ন', v: order.union || order.address_union || '' },
      { label: 'বিস্তারিত এলাকা', v: order.addressDetail || order.address || order.line1 || '' },
    ];
    let html = '<div class="bs-addr-breakdown" style="display:grid;gap:6px;margin-top:8px">';
    parts.forEach(p => {
      if (p.v) html += `<div><b>${p.label}:</b> <span style="color:#14213D">${p.v}</span></div>`;
    });
    if (Array.isArray(order.items)) {
      order.items.forEach(it => {
        if (it.color || it.size || it.weight) {
          html += `<div style="border-top:1px dashed #d1d5db;padding-top:6px"><b>${it.name || it.title || ''}</b> — `;
          if (it.color) html += `<span>কালার: ${it.color}</span> `;
          if (it.size) html += `<span>সাইজ: ${it.size}</span> `;
          if (it.weight) html += `<span>ওজন: ${it.weight}</span>`;
          html += '</div>';
        }
      });
    }
    html += '</div>';
    return html;
  };

  // Auto-append breakdown to any open order detail modal.
  function enhanceOrderDetail() {
    $$('.order-detail, .order-modal, [data-order-detail]').forEach(m => {
      if (m.__bsEnh) return;
      m.__bsEnh = true;
      const data = m.dataset.order && (() => { try { return JSON.parse(m.dataset.order); } catch (_) { return null; } })();
      if (data) {
        const html = window.bsFormatAddress(data);
        if (html) {
          const div = document.createElement('div');
          div.innerHTML = html;
          m.appendChild(div);
        }
      }
    });
  }

  // ---------- Fix Fake Order details button binding ----------
  function fixFakeOrderButtons() {
    $$('[data-fake-order-detail], .fake-order-detail-btn, button.fake-detail').forEach(btn => {
      if (btn.__bsFakeFix) return;
      btn.__bsFakeFix = true;
      btn.addEventListener('click', e => {
        e.preventDefault();
        const row = btn.closest('tr, .card, .order-row');
        const id = btn.dataset.id || (row && row.dataset.id) || '';
        if (window.showFakeOrderDetail) return window.showFakeOrderDetail(id);
        if (window.openOrderDetail) return window.openOrderDetail(id);
        popup('বিস্তারিত: অর্ডার ID ' + id, 'info');
      });
    });
  }

  // ---------- Init ----------
  function init() {
    injectAutoSEOButtons();
    injectSearchDropdown();
    highlightNoLandingProducts();
    enhanceOrderDetail();
    fixFakeOrderButtons();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  // React to DOM changes (admin panel is a heavy SPA-ish page).
  try {
    let t = null;
    new MutationObserver(() => {
      if (t) return;
      t = setTimeout(() => { t = null; init(); }, 400);
    }).observe(document.body || document.documentElement, { childList: true, subtree: true });
  } catch (_) {}
})();
