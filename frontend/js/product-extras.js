/* ================================================================
   BS Collection BD — Product Detail Page Extras (product-extras.js)
   ----------------------------------------------------------------
   কার্যক্রম:
   1) রিভিউ/প্রশ্ন সাবমিট → লগইন থাকলে backend এ পাঠায়, না থাকলে
      login.html-এ redirect (return URL সহ)।
   2) "তুলনায় যোগ করুন" — localStorage-এ compare তালিকা যোগ/বাদ।
   3) "শেয়ার করুন" — navigator.share অথবা copy link fallback।
   4) "ক্যাশ অন ডেলিভারি" — কার্টে যোগ করে সরাসরি checkout খোলে।
   5) রিভিউ তালিকা backend থেকে fetch করে দেখায়।
   ================================================================ */
(function () {
  'use strict';

  const API = window.BS_API_BASE || 'https://bscollectionbd.onrender.com/api';

  /* ================================================================
     SHARED CART ENGINE (window.BSCart)
     ----------------------------------------------------------------
     Runs on EVERY page that loads this script (landing pages, shop,
     home, product pages) — must sit above the "product-<id>.html
     only" early-return below, since it was previously missing
     entirely, which is why "কার্টে যোগ করুন" did nothing anywhere
     that referenced window.BSCart (e.g. landing.html).
     Persists to localStorage so the cart survives page navigation
     and reloads.
     ================================================================ */
  const CART_KEY = 'bs_cart_v1';

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function fmtTk(n) { return 'Tk ' + Number(n || 0).toLocaleString('en-IN'); }

  function getCart() {
    try { const l = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); return Array.isArray(l) ? l : []; }
    catch (_) { return []; }
  }
  function persistCart(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    renderCartUI();
  }
  function cartAddToCart(item) {
    if (!item || !item.id) return;
    const cart = getCart();
    const addQty = Math.max(1, parseInt(item.qty, 10) || 1);
    const existing = cart.find(c => c.id === item.id);
    if (existing) existing.qty = Math.max(1, (parseInt(existing.qty, 10) || 1) + addQty);
    else cart.push({
      id: item.id,
      name: item.name || 'পণ্য',
      price: Number(item.price) || 0,
      img: item.img || item.image || '',
      icon: item.icon || 'fa-box',
      qty: addQty,
    });
    persistCart(cart);
  }
  function cartRemove(id) { persistCart(getCart().filter(c => c.id !== id)); }
  function cartUpdateQty(id, qty) {
    qty = Math.max(1, parseInt(qty, 10) || 1);
    const cart = getCart();
    const it = cart.find(c => c.id === id);
    if (it) { it.qty = qty; persistCart(cart); }
  }
  function cartClear() { persistCart([]); }
  function cartCount() { return getCart().reduce((s, c) => s + (parseInt(c.qty, 10) || 0), 0); }
  function cartTotal() { return getCart().reduce((s, c) => s + (parseInt(c.qty, 10) || 0) * (Number(c.price) || 0), 0); }

  function renderCartUI() {
    const items = getCart();
    const count = cartCount();
    document.querySelectorAll('.cart-badge').forEach(b => { b.textContent = count; });

    const body = document.getElementById('cartSidebarBody');
    const footer = document.getElementById('cartSidebarFooter');
    const totalEl = document.getElementById('cartSidebarTotal');
    if (!body) return; // this page has no cart sidebar markup

    if (!items.length) {
      body.innerHTML = '<div class="cart-empty"><i class="fas fa-cart-shopping"></i><p>No items in your cart!</p></div>';
      if (footer) footer.style.display = 'none';
      return;
    }
    body.innerHTML = items.map(it => `
        <div class="cart-item-row" data-id="${escapeHtml(it.id)}">
          <div class="cart-item-img">${it.img ? `<img src="${escapeHtml(it.img)}" alt="${escapeHtml(it.name)}">` : `<i class="fas ${escapeHtml(it.icon || 'fa-box')}"></i>`}</div>
          <div class="cart-item-info">
            <div class="ci-name">${escapeHtml(it.name)}</div>
            <div class="ci-meta">${fmtTk(it.price)} &times; <input type="number" min="1" value="${parseInt(it.qty, 10) || 1}" class="cart-qty-input" data-id="${escapeHtml(it.id)}" style="width:44px;border:1px solid #e5e7eb;border-radius:4px;padding:2px 4px"></div>
          </div>
          <div class="cart-item-price">${fmtTk((Number(it.price) || 0) * (parseInt(it.qty, 10) || 1))}</div>
          <button class="cart-item-remove" data-id="${escapeHtml(it.id)}" aria-label="মুছে ফেলুন"><i class="fas fa-xmark"></i></button>
        </div>`).join('');
    if (footer) footer.style.display = '';
    if (totalEl) totalEl.textContent = fmtTk(cartTotal());
  }

  // delegated events: remove item / change qty inside the sidebar
  document.addEventListener('click', function (e) {
    const rm = e.target.closest('.cart-item-remove');
    if (rm) cartRemove(rm.getAttribute('data-id'));
  });
  document.addEventListener('change', function (e) {
    if (e.target.classList && e.target.classList.contains('cart-qty-input')) {
      cartUpdateQty(e.target.getAttribute('data-id'), e.target.value);
    }
  });
  // checkout button inside the sidebar (landing.html doesn't wire this itself)
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('#cartSidebarCheckout');
    if (!btn) return;
    if (typeof window.openOrderForm === 'function') window.openOrderForm();
    else if (typeof window.bsOpenCheckout === 'function') window.bsOpenCheckout();
    else location.href = 'cart.html';
  });

  window.BSCart = {
    addToCart: cartAddToCart,
    removeFromCart: cartRemove,
    updateQty: cartUpdateQty,
    clearCart: cartClear,
    getCart: getCart,
    cartCount: cartCount,
    cartTotal: cartTotal,
  };

  function initCart() { renderCartUI(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initCart);
  else initCart();

  /* ================================================================
     Everything below this line is unchanged — product detail page
     (product-<id>.html) only: reviews, compare, share, COD.
     ================================================================ */

  // detect product id from URL: product-<id>.html
  const match = location.pathname.match(/product-([a-z0-9\-]+)\.html/i);
  if (!match) return;
  const PRODUCT_ID = match[1];

  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));

  function toast(msg, kind) {
    if (window.bsToast) return window.bsToast(msg, kind);
    alert(msg);
  }
  function getToken() {
    return localStorage.getItem('bs_customer_token') || '';
  }
  function getUser() {
    try { return JSON.parse(localStorage.getItem('bs_customer_user') || 'null'); } catch { return null; }
  }
  function redirectToLogin(pending) {
    if (pending) sessionStorage.setItem('bs_pending_review', JSON.stringify({ ...pending, from: location.href }));
    location.href = 'login.html?next=' + encodeURIComponent(location.pathname + location.search);
  }

  // ─── 1) REVIEWS ─────────────────────────────────────────────
  async function loadReviews() {
    const list = $('.pd-rv-list') || $('.reviews-list') || $('#reviewsList');
    if (!list) return;
    try {
      const res = await fetch(API + '/reviews/' + encodeURIComponent(PRODUCT_ID));
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) return;
      const html = data.map(r => `
        <div style="background:#fff;padding:14px;border-radius:10px;margin-bottom:10px;border:1px solid #e5e7eb">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <b style="color:#14213D">${escapeHtml(r.user)}</b>
            <small style="color:#64748b">${new Date(r.createdAt).toLocaleDateString('en-GB')}</small>
          </div>
          <div style="color:#FCA311;font-size:13px;margin-bottom:6px">${'★'.repeat(r.rating || 5)}${'☆'.repeat(5 - (r.rating || 5))}</div>
          <div style="color:#334155;font-size:14px;line-height:1.7">${escapeHtml(r.text)}</div>
        </div>`).join('');
      list.insertAdjacentHTML('afterbegin', html);
    } catch (_) {}
  }

  async function submitReview(text, rating, type) {
    const user = getUser(); const token = getToken();
    if (!user || !token) {
      redirectToLogin({ pid: PRODUCT_ID, text, rating, type });
      return { ok: false, needAuth: true };
    }
    try {
      const res = await fetch(API + '/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({
          productId: PRODUCT_ID,
          productName: document.title || PRODUCT_ID,
          text, rating: rating || 5, type: type || 'review',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'সাবমিট ব্যর্থ');
      toast(type === 'question' ? 'প্রশ্ন সাবমিট হয়েছে' : 'রিভিউ সাবমিট হয়েছে', 'ok');
      loadReviews();
      return { ok: true };
    } catch (err) { toast(err.message, 'err'); return { ok: false }; }
  }

  function wireReviewForm() {
    // Support multiple selectors used across the product page
    const btn = $('#submitReviewBtn') || $('.pd-rv-submit') || $('button[data-review-submit]');
    if (btn && !btn.__bsWired) {
      btn.__bsWired = true;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        const box = btn.closest('form, .pd-rv-form, .pd-rv-box, section, div') || document;
        const ta = box.querySelector('textarea');
        const text = (ta && ta.value || '').trim();
        if (!text) return toast('রিভিউ লিখুন', 'err');
        const stars = box.querySelectorAll('.pd-rs-star.on, .pd-rs-star.active, .pd-rs-star.selected, [data-star].on').length || 5;
        submitReview(text, stars, 'review').then(r => { if (r.ok && ta) ta.value = ''; });
      });
    }
    const qbtn = $('#submitQuestionBtn') || $('button[data-question-submit]');
    if (qbtn && !qbtn.__bsWired) {
      qbtn.__bsWired = true;
      qbtn.addEventListener('click', function (e) {
        e.preventDefault();
        const box = qbtn.closest('form, .pd-q-form, section, div') || document;
        const ta = box.querySelector('textarea');
        const text = (ta && ta.value || '').trim();
        if (!text) return toast('প্রশ্ন লিখুন', 'err');
        submitReview(text, 5, 'question').then(r => { if (r.ok && ta) ta.value = ''; });
      });
    }
  }

  // ─── 2) COMPARE ─────────────────────────────────────────────
  function getCompare() { try { return JSON.parse(localStorage.getItem('bs_compare_v1') || '[]'); } catch { return []; } }
  function saveCompare(l) { localStorage.setItem('bs_compare_v1', JSON.stringify(l)); }

  window.bsToggleCompare = function (id) {
    id = id || PRODUCT_ID;
    let list = getCompare();
    const i = list.indexOf(id);
    if (i > -1) { list.splice(i, 1); toast('তুলনা থেকে বাদ'); }
    else { if (list.length >= 4) return toast('সর্বোচ্চ ৪টি পণ্য তুলনা করা যাবে', 'err');
      list.push(id); toast('তুলনায় যোগ হয়েছে', 'ok'); }
    saveCompare(list);
    updateCompareUI();
  };
  function updateCompareUI() {
    const list = getCompare();
    $$('[data-compare], .compare-btn, button:has(.fa-balance-scale)').forEach(b => {
      const txt = (b.textContent || '').trim();
      if (/তুলনা/.test(txt) || b.hasAttribute('data-compare')) {
        b.classList.toggle('active', list.includes(PRODUCT_ID));
      }
    });
  }
  function wireCompare() {
    $$('button, a').forEach(el => {
      const t = (el.textContent || '').trim();
      if (/তুলনায় যোগ/.test(t) && !el.__bsWiredC) {
        el.__bsWiredC = true;
        el.addEventListener('click', e => { e.preventDefault(); window.bsToggleCompare(PRODUCT_ID); });
      }
    });
    updateCompareUI();
  }

  // ─── 3) SHARE ───────────────────────────────────────────────
  window.bsShareProduct = async function () {
    const shareData = { title: document.title, text: document.title, url: location.href };
    try {
      if (navigator.share) { await navigator.share(shareData); return; }
    } catch (_) {}
    try {
      await navigator.clipboard.writeText(location.href);
      toast('লিংক কপি হয়েছে', 'ok');
    } catch (_) {
      prompt('লিংক কপি করুন:', location.href);
    }
  };
  function wireShare() {
    $$('button, a').forEach(el => {
      const t = (el.textContent || '').trim();
      if (/শেয়ার/.test(t) && !el.__bsWiredS) {
        el.__bsWiredS = true;
        el.addEventListener('click', e => { e.preventDefault(); window.bsShareProduct(); });
      }
    });
  }

  // ─── 4) COD (Cash on Delivery) — Buy Now shortcut ───────────
  window.bsBuyCOD = function () {
    // Add current product to cart (qty 1) then open checkout
    try {
      if (typeof window.bsAddToCart === 'function') {
        // Prefer PRODUCTS lookup by matching id or sku
        const p = (window.PRODUCTS || []).find(x => x.id === PRODUCT_ID || x.sku === PRODUCT_ID);
        if (p) window.bsAddToCart(p.id || p.sku, 1);
        else {
          const name = (document.querySelector('.pd-name, .product-name, h1') || {}).textContent || PRODUCT_ID;
          const priceEl = document.querySelector('.pd-price-now, .price-now, .price');
          const price = priceEl ? Number((priceEl.textContent || '').replace(/[^\d]/g, '')) : 0;
          const img = (document.querySelector('.pd-main-img, .product-main-img, .thumb img') || {}).src || '';
          window.bsAddToCart({ id: PRODUCT_ID, name: name.trim(), price, image: img, qty: 1 });
        }
      }
      setTimeout(() => {
        if (typeof window.bsOpenCheckout === 'function') window.bsOpenCheckout();
        else if (typeof window.openOrderModal === 'function') window.openOrderModal();
        else location.href = 'cart.html';
      }, 200);
    } catch (err) { toast(err.message, 'err'); }
  };
  function wireCOD() {
    $$('button, a').forEach(el => {
      const t = (el.textContent || '').trim();
      if (/ক্যাশ অন ডেলিভারি|COD|Cash on Delivery/i.test(t) && !el.__bsWiredCOD) {
        el.__bsWiredCOD = true;
        el.addEventListener('click', e => { e.preventDefault(); window.bsBuyCOD(); });
      }
    });
  }

  function init() {
    loadReviews();
    wireReviewForm(); wireCompare(); wireShare(); wireCOD();
    // Re-wire after DOM mutations (some pages render UI late)
    new MutationObserver(() => { wireReviewForm(); wireCompare(); wireShare(); wireCOD(); })
      .observe(document.body, { childList: true, subtree: true });

    // Auto-resume pending review after login
    const pending = sessionStorage.getItem('bs_pending_review');
    if (pending && getUser()) {
      try {
        const p = JSON.parse(pending);
        if (p.pid === PRODUCT_ID) {
          sessionStorage.removeItem('bs_pending_review');
          submitReview(p.text, p.rating, p.type);
        }
      } catch (_) {}
    }
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init);
  else init();
})();   