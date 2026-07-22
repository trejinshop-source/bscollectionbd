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

  // ============================================================
  // ============  ভ্যারিয়েন্ট এডিটর (Color+Size+Weight+Thumb) ============
  // ============================================================
  // Injects a redesigned unified variant editor into #productModal.
  // Colors are rows with (name + hex swatch + thumbnail upload).
  // Sizes and Weights are chip inputs. A combination matrix is auto
  // generated with per-combo price/stock/SKU. Data is merged into the
  // request body when the Save button posts to /products.

  const VE_STYLE = `
  .bs-ve-section{margin-top:14px;padding:14px;border:1px solid #e2e8f0;border-radius:12px;background:#F8FAFC}
  .bs-ve-section h4{margin:0 0 4px;font-size:14px;font-weight:800;color:#14213D;display:flex;align-items:center;gap:8px}
  .bs-ve-section h4 .bs-ve-pill{background:#FCA311;color:#14213D;font-size:10px;padding:2px 8px;border-radius:999px;font-weight:800}
  .bs-ve-hint{color:#64748b;font-size:11.5px;margin:0 0 10px}
  .bs-ve-tabs{display:flex;gap:6px;margin-bottom:10px;border-bottom:1px solid #e2e8f0}
  .bs-ve-tab{padding:8px 14px;border:0;background:transparent;font-weight:700;color:#64748b;cursor:pointer;border-bottom:2px solid transparent;font-family:inherit;font-size:13px}
  .bs-ve-tab.active{color:#14213D;border-color:#FCA311}
  .bs-ve-pane{display:none}
  .bs-ve-pane.active{display:block}
  .bs-ve-colrow{display:grid;grid-template-columns:64px 1fr 130px 90px 32px;gap:8px;align-items:center;margin-bottom:8px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px}
  .bs-ve-thumb{width:56px;height:56px;border-radius:8px;border:1px dashed #cbd5e1;background:#F8FAFC center/cover no-repeat;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px;cursor:pointer;position:relative;overflow:hidden}
  .bs-ve-thumb input[type=file]{position:absolute;inset:0;opacity:0;cursor:pointer}
  .bs-ve-thumb .bs-ve-thumb-lbl{pointer-events:none;text-align:center;line-height:1.1;padding:2px}
  .bs-ve-name{border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;font-size:13px;font-family:inherit;width:100%}
  .bs-ve-hex{display:flex;align-items:center;gap:6px;border:1px solid #e2e8f0;border-radius:8px;padding:4px 8px;background:#fff}
  .bs-ve-hex input[type=color]{width:28px;height:28px;border:0;background:transparent;cursor:pointer;padding:0}
  .bs-ve-hex input[type=text]{border:0;outline:none;font-size:12px;width:80px;font-family:monospace}
  .bs-ve-stock{border:1px solid #e2e8f0;border-radius:8px;padding:8px;font-size:13px;text-align:center;font-family:inherit}
  .bs-ve-del{background:#FEE2E2;color:#DC2626;border:0;border-radius:8px;height:32px;font-weight:800;cursor:pointer}
  .bs-ve-addbtn{background:#14213D;color:#fff;border:0;padding:8px 14px;border-radius:8px;font-weight:700;cursor:pointer;font-family:inherit;font-size:12.5px;display:inline-flex;align-items:center;gap:6px}
  .bs-ve-addbtn:hover{background:#FCA311;color:#14213D}
  .bs-ve-chips{display:flex;flex-wrap:wrap;gap:6px;padding:8px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;min-height:46px}
  .bs-ve-chip{display:inline-flex;align-items:center;gap:6px;background:#FFF3C4;color:#14213D;padding:5px 10px;border-radius:999px;font-size:12.5px;font-weight:700}
  .bs-ve-chip .x{cursor:pointer;color:#DC2626;font-weight:900}
  .bs-ve-chipinput{border:0;outline:none;font-size:13px;padding:4px;font-family:inherit;min-width:120px;flex:1}
  .bs-ve-matrix{width:100%;border-collapse:collapse;font-size:12.5px;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0}
  .bs-ve-matrix th,.bs-ve-matrix td{padding:6px 8px;border-bottom:1px solid #f1f5f9;text-align:left}
  .bs-ve-matrix th{background:#F1F5F9;font-weight:700;color:#14213D;font-size:11.5px;text-transform:uppercase;letter-spacing:.03em}
  .bs-ve-matrix input{border:1px solid #e2e8f0;border-radius:6px;padding:5px 7px;width:100%;font-family:inherit;font-size:12.5px}
  .bs-ve-swatch{width:14px;height:14px;border-radius:50%;display:inline-block;border:1px solid rgba(0,0,0,.15);vertical-align:middle;margin-right:4px}
  .bs-ve-empty{color:#94a3b8;font-size:12px;padding:14px;text-align:center;font-style:italic}
  `;

  function ensureVeStyle(){
    if(document.getElementById('bs-ve-style')) return;
    const s = document.createElement('style'); s.id='bs-ve-style'; s.textContent = VE_STYLE;
    document.head.appendChild(s);
  }

  function buildVariantSection(){
    const sec = document.createElement('div');
    sec.className = 'bs-ve-section';
    sec.id = 'bsVariantEditor';
    sec.innerHTML = `
      <h4>ভ্যারিয়েন্ট এডিটর <span class="bs-ve-pill">নতুন</span></h4>
      <p class="bs-ve-hint">কালার, সাইজ ও ওজন একসাথে সিলেক্ট করুন এবং প্রতিটি কালারের জন্য থাম্বনেইল আপলোড করুন। কম্বিনেশন ম্যাট্রিক্সে প্রতি ভ্যারিয়েন্টের দাম/স্টক আলাদাভাবে দিতে পারবেন।</p>
      <div class="bs-ve-tabs">
        <button type="button" class="bs-ve-tab active" data-vt="colors">🎨 কালার</button>
        <button type="button" class="bs-ve-tab" data-vt="sizes">📏 সাইজ</button>
        <button type="button" class="bs-ve-tab" data-vt="weights">⚖️ ওজন</button>
        <button type="button" class="bs-ve-tab" data-vt="matrix">🧩 কম্বিনেশন</button>
      </div>

      <div class="bs-ve-pane active" data-vp="colors">
        <div id="bsVeColorList"></div>
        <button type="button" class="bs-ve-addbtn" id="bsVeAddColor">+ নতুন কালার যোগ করুন</button>
      </div>

      <div class="bs-ve-pane" data-vp="sizes">
        <div class="bs-ve-chips" id="bsVeSizeChips">
          <input type="text" class="bs-ve-chipinput" id="bsVeSizeInput" placeholder="যেমন: S, M, L, XL — Enter চাপুন">
        </div>
      </div>

      <div class="bs-ve-pane" data-vp="weights">
        <div class="bs-ve-chips" id="bsVeWeightChips">
          <input type="text" class="bs-ve-chipinput" id="bsVeWeightInput" placeholder="যেমন: 500g, 1kg, 2kg — Enter চাপুন">
        </div>
      </div>

      <div class="bs-ve-pane" data-vp="matrix">
        <p class="bs-ve-hint">কালার/সাইজ/ওজন যোগ করার পর নিচে স্বয়ংক্রিয়ভাবে কম্বিনেশন তৈরি হবে। খালি ঘর রাখলে ডিফল্ট দাম/স্টক ব্যবহার হবে।</p>
        <div id="bsVeMatrixWrap"><div class="bs-ve-empty">কোনো ভ্যারিয়েন্ট এখনো যোগ করা হয়নি।</div></div>
      </div>
    `;
    return sec;
  }

  // ---------- State on window so save-hook can read it ----------
  window.__bsVeState = { colors: [], sizes: [], weights: [], matrix: {} };

  async function uploadThumb(file){
    if(!file) return '';
    const fd = new FormData(); fd.append('image', file);
    const fn = window.apiFetch || window.fetch;
    // Try to reuse admin apiFetch (adds base URL + auth)
    const url = (window.API_BASE ? window.API_BASE : '') + '/products/upload';
    const r = await (window.apiFetch ? window.apiFetch('/products/upload', { method:'POST', body:fd })
                                     : fetch(url, { method:'POST', body:fd }));
    const d = await r.json();
    if(!r.ok) throw new Error(d.error||'upload failed');
    return d.url;
  }

  function renderColorRows(){
    const list = document.getElementById('bsVeColorList');
    if(!list) return;
    const st = window.__bsVeState;
    if(!st.colors.length){ list.innerHTML = `<div class="bs-ve-empty">কোনো কালার যোগ করা হয়নি — নিচের বাটন চাপুন।</div>`; return; }
    list.innerHTML = '';
    st.colors.forEach((c, i) => {
      const row = document.createElement('div');
      row.className = 'bs-ve-colrow';
      row.innerHTML = `
        <label class="bs-ve-thumb" style="${c.img ? `background-image:url('${c.img}')` : ''}">
          <span class="bs-ve-thumb-lbl">${c.img ? '' : '📷 থাম্ব'}</span>
          <input type="file" accept="image/*" data-idx="${i}" class="bs-ve-thumb-file">
        </label>
        <input type="text" class="bs-ve-name" data-idx="${i}" data-k="name" placeholder="কালারের নাম (যেমন: লাল)" value="${(c.name||'').replace(/"/g,'&quot;')}">
        <div class="bs-ve-hex">
          <input type="color" data-idx="${i}" data-k="hex" value="${c.hex||'#000000'}">
          <input type="text" data-idx="${i}" data-k="hex" value="${c.hex||'#000000'}" maxlength="7">
        </div>
        <input type="number" class="bs-ve-stock" data-idx="${i}" data-k="stock" min="0" placeholder="স্টক" value="${c.stock ?? ''}">
        <button type="button" class="bs-ve-del" data-idx="${i}" title="মুছুন">✕</button>
      `;
      list.appendChild(row);
    });

    list.querySelectorAll('.bs-ve-thumb-file').forEach(inp => {
      inp.addEventListener('change', async (e) => {
        const idx = +inp.dataset.idx;
        const file = inp.files[0]; if(!file) return;
        const lbl = inp.parentElement.querySelector('.bs-ve-thumb-lbl');
        lbl.textContent = '⏳';
        try{
          const url = await uploadThumb(file);
          window.__bsVeState.colors[idx].img = url;
          renderColorRows();
          popup('থাম্বনেইল আপলোড হয়েছে','ok');
        } catch(err){ lbl.textContent = '⚠️'; popup('আপলোড ব্যর্থ: '+err.message,'err'); }
      });
    });
    list.querySelectorAll('input[data-k]').forEach(inp => {
      inp.addEventListener('input', () => {
        const idx = +inp.dataset.idx, k = inp.dataset.k;
        const v = inp.type === 'number' ? (inp.value === '' ? '' : +inp.value) : inp.value;
        window.__bsVeState.colors[idx][k] = v;
        if(k === 'hex'){
          // sync sibling picker/text
          const row = inp.closest('.bs-ve-colrow');
          row.querySelectorAll(`input[data-k="hex"][data-idx="${idx}"]`).forEach(el => { if(el !== inp) el.value = v; });
        }
        if(k === 'name') renderMatrix();
      });
    });
    list.querySelectorAll('.bs-ve-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = +btn.dataset.idx;
        window.__bsVeState.colors.splice(idx,1);
        renderColorRows(); renderMatrix();
      });
    });
  }

  function renderChips(kind){
    const st = window.__bsVeState;
    const arr = kind === 'sizes' ? st.sizes : st.weights;
    const wrap = document.getElementById(kind === 'sizes' ? 'bsVeSizeChips' : 'bsVeWeightChips');
    const input = document.getElementById(kind === 'sizes' ? 'bsVeSizeInput' : 'bsVeWeightInput');
    if(!wrap || !input) return;
    // Remove old chips (keep input at end)
    wrap.querySelectorAll('.bs-ve-chip').forEach(c => c.remove());
    arr.forEach((v, i) => {
      const chip = document.createElement('span');
      chip.className = 'bs-ve-chip';
      chip.innerHTML = `${v} <span class="x" data-i="${i}">✕</span>`;
      chip.querySelector('.x').addEventListener('click', () => {
        arr.splice(i,1); renderChips(kind); renderMatrix();
      });
      wrap.insertBefore(chip, input);
    });
  }

  function wireChipInput(kind){
    const input = document.getElementById(kind === 'sizes' ? 'bsVeSizeInput' : 'bsVeWeightInput');
    if(!input || input.__wired) return; input.__wired = true;
    const commit = () => {
      const raw = input.value.trim();
      if(!raw) return;
      const st = window.__bsVeState;
      const arr = kind === 'sizes' ? st.sizes : st.weights;
      raw.split(/[,\n]/).map(s=>s.trim()).filter(Boolean).forEach(v => {
        if(!arr.includes(v)) arr.push(v);
      });
      input.value = '';
      renderChips(kind); renderMatrix();
    };
    input.addEventListener('keydown', e => {
      if(e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); }
      else if(e.key === 'Backspace' && !input.value){
        const st = window.__bsVeState;
        const arr = kind === 'sizes' ? st.sizes : st.weights;
        arr.pop(); renderChips(kind); renderMatrix();
      }
    });
    input.addEventListener('blur', commit);
  }

  function renderMatrix(){
    const wrap = document.getElementById('bsVeMatrixWrap');
    if(!wrap) return;
    const st = window.__bsVeState;
    const colors = st.colors.length ? st.colors : [{name:'', hex:''}];
    const sizes = st.sizes.length ? st.sizes : [''];
    const weights = st.weights.length ? st.weights : [''];
    const combos = [];
    colors.forEach(c => sizes.forEach(s => weights.forEach(w => {
      if(!c.name && !s && !w) return;
      combos.push({ color: c.name || '', hex: c.hex || '', size: s, weight: w });
    })));
    if(!combos.length){ wrap.innerHTML = `<div class="bs-ve-empty">কোনো ভ্যারিয়েন্ট এখনো যোগ করা হয়নি।</div>`; return; }
    let html = `<table class="bs-ve-matrix"><thead><tr>
      <th>কালার</th><th>সাইজ</th><th>ওজন</th><th>দাম (৳)</th><th>স্টক</th><th>SKU</th>
    </tr></thead><tbody>`;
    combos.forEach(c => {
      const key = `${c.color}||${c.size}||${c.weight}`;
      const cur = st.matrix[key] || {};
      html += `<tr data-key="${key.replace(/"/g,'&quot;')}">
        <td>${c.hex ? `<span class="bs-ve-swatch" style="background:${c.hex}"></span>` : ''}${c.color || '<i style="color:#94a3b8">—</i>'}</td>
        <td>${c.size || '<i style="color:#94a3b8">—</i>'}</td>
        <td>${c.weight || '<i style="color:#94a3b8">—</i>'}</td>
        <td><input type="number" data-mk="price" min="0" placeholder="ডিফল্ট" value="${cur.price ?? ''}"></td>
        <td><input type="number" data-mk="stock" min="0" placeholder="0" value="${cur.stock ?? ''}"></td>
        <td><input type="text" data-mk="sku" placeholder="auto" value="${(cur.sku||'').replace(/"/g,'&quot;')}"></td>
      </tr>`;
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;
    wrap.querySelectorAll('tr[data-key]').forEach(tr => {
      const key = tr.dataset.key;
      tr.querySelectorAll('input[data-mk]').forEach(inp => {
        inp.addEventListener('input', () => {
          st.matrix[key] = st.matrix[key] || {};
          const k = inp.dataset.mk;
          st.matrix[key][k] = inp.type === 'number' ? (inp.value === '' ? '' : +inp.value) : inp.value;
        });
      });
    });
  }

  function wireVariantEditor(){
    ensureVeStyle();
    const modal = document.getElementById('productModal');
    if(!modal || modal.__bsVeWired) return;
    const body = modal.querySelector('.modal-body');
    if(!body) return;
    modal.__bsVeWired = true;
    const sec = buildVariantSection();
    body.appendChild(sec);

    // Tab switching
    sec.querySelectorAll('.bs-ve-tab').forEach(t => t.addEventListener('click', () => {
      sec.querySelectorAll('.bs-ve-tab').forEach(x => x.classList.remove('active'));
      sec.querySelectorAll('.bs-ve-pane').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      sec.querySelector(`.bs-ve-pane[data-vp="${t.dataset.vt}"]`).classList.add('active');
      if(t.dataset.vt === 'matrix') renderMatrix();
    }));

    document.getElementById('bsVeAddColor').addEventListener('click', () => {
      window.__bsVeState.colors.push({ name:'', hex:'#000000', img:'', stock:'' });
      renderColorRows(); renderMatrix();
    });

    wireChipInput('sizes'); wireChipInput('weights');
    renderColorRows(); renderChips('sizes'); renderChips('weights'); renderMatrix();
  }

  function loadVariantsFromProduct(p){
    const st = { colors: [], sizes: [], weights: [], matrix: {} };
    if(p){
      if(Array.isArray(p.colorOptions) && p.colorOptions.length){
        st.colors = p.colorOptions.map(c => ({ name:c.name||'', hex:c.hex||'#000000', img:c.img||'', stock:c.stock ?? '' }));
      } else if(Array.isArray(p.colors)){
        st.colors = p.colors.map(n => ({ name:String(n), hex:'#000000', img:'', stock:'' }));
      }
      st.sizes = Array.isArray(p.sizeOptions) && p.sizeOptions.length ? p.sizeOptions.slice() : (p.sizes||[]).slice();
      st.weights = Array.isArray(p.weightOptions) ? p.weightOptions.slice() : (p.weight ? [p.weight] : []);
      if(Array.isArray(p.variants)){
        p.variants.forEach(v => {
          const key = `${v.color||''}||${v.size||''}||${v.weight||''}`;
          st.matrix[key] = { price: v.price ?? '', stock: v.stock ?? '', sku: v.sku || '' };
        });
      }
    }
    window.__bsVeState = st;
    renderColorRows(); renderChips('sizes'); renderChips('weights'); renderMatrix();
  }

  // Hook: when Add Product modal opens, load state; on edit, populate from product.
  function hookProductModalOpen(){
    const addBtn = document.getElementById('addProductBtn');
    if(addBtn && !addBtn.__veHook){
      addBtn.__veHook = true;
      addBtn.addEventListener('click', () => setTimeout(() => { wireVariantEditor(); loadVariantsFromProduct(null); }, 30), true);
    }
    // Patch openEditProduct to preload
    if(window.openEditProduct && !window.openEditProduct.__veHook){
      const orig = window.openEditProduct;
      window.openEditProduct = function(id){
        const r = orig.apply(this, arguments);
        setTimeout(() => {
          wireVariantEditor();
          const p = (window.allProducts || []).find(x => x._id === id);
          loadVariantsFromProduct(p);
        }, 40);
        return r;
      };
      window.openEditProduct.__veHook = true;
    }
  }

  // Collect current variant payload
  function collectVariantPayload(){
    const st = window.__bsVeState || {};
    const colorOptions = (st.colors||[]).filter(c => c.name || c.img).map(c => ({
      name: c.name||'', hex: c.hex||'', img: c.img||'', stock: c.stock === '' ? undefined : c.stock
    }));
    const sizeOptions = (st.sizes||[]).slice();
    const weightOptions = (st.weights||[]).slice();
    const variants = [];
    Object.keys(st.matrix||{}).forEach(k => {
      const [color, size, weight] = k.split('||');
      const v = st.matrix[k] || {};
      if(v.price === '' && v.stock === '' && !v.sku) return;
      variants.push({
        color, size, weight,
        price: v.price === '' ? undefined : v.price,
        stock: v.stock === '' ? undefined : v.stock,
        sku: v.sku || undefined,
      });
    });
    return {
      colorOptions, sizeOptions, weightOptions, variants,
      // Backward-compat flat arrays consumed by existing frontend detail pages
      colors: colorOptions.map(c => c.name).filter(Boolean),
      sizes: sizeOptions,
      weight: weightOptions[0] || undefined,
    };
  }

  // Monkey-patch window.fetch to inject variant fields into product save requests
  (function patchFetch(){
    if(window.fetch.__bsVePatched) return;
    const orig = window.fetch.bind(window);
    const patched = function(input, init){
      try{
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        const method = (init && init.method || (input && input.method) || 'GET').toUpperCase();
        const isProd = /\/products(\/id\/[^/]+)?(\?|$)/.test(url) && (method === 'POST' || method === 'PUT');
        if(isProd && init && init.body && typeof init.body === 'string'){
          try{
            const b = JSON.parse(init.body);
            const extra = collectVariantPayload();
            Object.assign(b, extra);
            init = Object.assign({}, init, { body: JSON.stringify(b) });
          } catch(_){}
        }
      } catch(_){}
      return orig(input, init);
    };
    patched.__bsVePatched = true;
    window.fetch = patched;
  })();

  // ---------- Init ----------
  function init() {
    injectAutoSEOButtons();
    injectSearchDropdown();
    highlightNoLandingProducts();
    enhanceOrderDetail();
    fixFakeOrderButtons();
    hookProductModalOpen();
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
