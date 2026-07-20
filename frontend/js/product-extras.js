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

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
