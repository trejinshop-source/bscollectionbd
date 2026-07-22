/* ================================================================
   BS Collection BD — Shared UI Injector (bs-shared.js)
   ----------------------------------------------------------------
   এই স্ক্রিপ্টটি সব পেজে (index / shop / product / about / contact
   / policy / account / wishlist) অটোমেটিক নিচের UI ব্লকগুলো ইনজেক্ট
   করে দেয় (যদি ইতিমধ্যে না থাকে) — যেন index.html-এর মতো একই
   floating-cart, main-header, cart-sidebar-overlay, order-modal-overlay
   সব পেজে থাকে।
   সাথে: হেডারের সার্চবার globally কার্যকর, active menu highlight,
   এবং API_BASE সব পেজে shared।
   ================================================================ */
(function () {
  'use strict';

  window.BS_API_BASE = window.BS_API_BASE || (
    /localhost|127\.0\.0\.1/.test(location.hostname)
      ? 'http://localhost:5000/api'
      : 'https://bscollectionbd.onrender.com/api'
  );

  // ---------- helpers ----------
  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const currentPage = (() => {
    const p = location.pathname.split('/').pop() || 'index.html';
    return p.toLowerCase();
  })();

  // ---------- (1) inject minimal CSS if not present ----------
  function injectCSS() {
    if (document.getElementById('bs-shared-css')) return;
    const css = `
      .floating-cart{position:fixed;top:50%;right:0;transform:translateY(-50%);z-index:150;background:#14213D;color:#fff;display:flex;flex-direction:column;align-items:center;gap:4px;padding:16px 12px;box-shadow:0 10px 30px rgba(0,0,0,.15);transition:.25s;text-decoration:none;border-radius:14px 0 0 14px;cursor:pointer}
      .floating-cart:hover{background:#FCA311;color:#0b1526}
      .floating-cart i{font-size:20px}
      .floating-cart .label{font-size:10px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;writing-mode:vertical-rl}
      .floating-cart .cart-count{position:absolute;top:-6px;left:-6px;background:#DC2626;color:#fff;border-radius:999px;min-width:20px;height:20px;display:grid;place-items:center;font-size:11px;font-weight:700;padding:0 5px}
      .cart-sidebar-overlay{position:fixed;inset:0;background:rgba(11,21,38,.55);opacity:0;pointer-events:none;transition:.3s;z-index:300}
      .cart-sidebar-overlay.show{opacity:1;pointer-events:auto}
      .order-modal-overlay{position:fixed;inset:0;background:rgba(11,21,38,.6);opacity:0;pointer-events:none;transition:.25s;z-index:310;display:flex;align-items:center;justify-content:center;padding:20px}
      .order-modal-overlay.show{opacity:1;pointer-events:auto}
      .bs-shared-search-open{position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:400;width:min(560px,92vw);background:#fff;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.25);padding:10px;display:none}
      .bs-shared-search-open.show{display:flex;gap:8px;align-items:center}
      .bs-shared-search-open input{flex:1;border:1px solid #e5e7eb;padding:10px 12px;border-radius:8px;font-size:14px;font-family:inherit;outline:none}
      .bs-shared-search-open input:focus{border-color:#FCA311}
      .bs-shared-search-open button{background:#14213D;color:#fff;border:0;padding:10px 16px;border-radius:8px;cursor:pointer;font-weight:600}
      /* active menu marker */
      .main-header .main-nav a.active,.main-header a.nav-active,.site-header a.active,.mobile-menu a.active,
      nav a[data-page].active,nav a.active{color:#FCA311!important;position:relative}
      nav a[data-page].active::after,nav a.active::after{content:'';position:absolute;left:0;right:0;bottom:-6px;height:2px;background:#FCA311;border-radius:2px}
    `;
    const st = document.createElement('style');
    st.id = 'bs-shared-css'; st.textContent = css;
    document.head.appendChild(st);
  }

  // ---------- (2) floating cart button ----------
  function ensureFloatingCart() {
    if (document.getElementById('cartIcon') || document.querySelector('.floating-cart')) return;
    const a = document.createElement('a');
    a.href = 'javascript:void(0)';
    a.className = 'floating-cart';
    a.id = 'cartIcon';
    a.title = 'Cart';
    a.innerHTML = '<i class="fas fa-shopping-cart"></i><span class="label">Cart</span><span class="cart-count" data-badge="cart" style="display:none">0</span>';
    a.addEventListener('click', function (e) {
      e.preventDefault();
      if (typeof window.bsOpenDrawer === 'function') return window.bsOpenDrawer();
      if (typeof window.openCartSidebar === 'function') return window.openCartSidebar();
      location.href = 'cart.html';
    });
    document.body.appendChild(a);
  }

  // ---------- (3) cart-sidebar-overlay / order-modal-overlay ----------
  function ensureOverlays() {
    if (!document.getElementById('cartSidebarOverlay')) {
      const o = document.createElement('div');
      o.className = 'cart-sidebar-overlay';
      o.id = 'cartSidebarOverlay';
      o.addEventListener('click', () => {
        o.classList.remove('show');
        if (typeof window.bsCloseDrawer === 'function') window.bsCloseDrawer();
        if (typeof window.closeCartSidebar === 'function') window.closeCartSidebar();
      });
      document.body.appendChild(o);
    }
    if (!document.getElementById('orderModalOverlay')) {
      const m = document.createElement('div');
      m.className = 'order-modal-overlay';
      m.id = 'orderModalOverlay';
      m.addEventListener('click', function (e) {
        if (e.target === m) {
          m.classList.remove('show');
          if (typeof window.bsCloseCheckout === 'function') window.bsCloseCheckout();
        }
      });
      document.body.appendChild(m);
    }
  }

  // ---------- (4) main-header fallback ----------
  // If page doesn't have a header, insert a lightweight one.
  function ensureHeader() {
    if (document.querySelector('.main-header, .site-header, header#mainHeader, header.site-header')) return;
    const hdr = document.createElement('div');
    hdr.className = 'main-header';
    hdr.innerHTML = `
      <div class="container" style="max-width:1200px;margin:0 auto;padding:14px 16px;display:flex;align-items:center;gap:20px">
        <a href="index.html" style="display:flex;align-items:center;gap:8px;text-decoration:none;color:#14213D;font-weight:800;font-size:18px">
          <i class="fas fa-bolt" style="color:#FCA311"></i> BS Collection BD
        </a>
        <nav class="main-nav" style="margin-left:auto;display:flex;gap:18px;flex-wrap:wrap">
          <a href="index.html" data-page="index.html">Home</a>
          <a href="shop.html" data-page="shop.html">Shop</a>
          <a href="about.html" data-page="about.html">About</a>
          <a href="contact.html" data-page="contact.html">Contact</a>
          <a href="wishlist.html" data-page="wishlist.html">Wishlist</a>
          <a href="account.html" data-page="account.html">Account</a>
        </nav>
        <form class="search-form" role="search" style="display:flex;gap:6px" onsubmit="event.preventDefault();window.bsSharedSearch(this.querySelector('input').value)">
          <input type="search" placeholder="Search..." style="padding:8px 12px;border:1px solid #e5e7eb;border-radius:8px;font-family:inherit;outline:none"/>
          <button type="submit" style="background:#14213D;color:#fff;border:0;padding:8px 12px;border-radius:8px;cursor:pointer"><i class="fas fa-search"></i></button>
        </form>
      </div>`;
    document.body.insertBefore(hdr, document.body.firstChild);
  }

  // ---------- (5) global search — wires ALL search inputs ----------
  window.bsSharedSearch = function (q) {
    q = String(q || '').trim();
    if (!q) return;
    location.href = 'shop.html?q=' + encodeURIComponent(q);
  };
  function wireSearchInputs() {
    // Wire any input with id=searchInput or type=search inside header/nav/search-bar
    $$('input#searchInput, header input[type=search], .search-bar input, .search-form input[type=search], input[name=q]').forEach(inp => {
      if (inp.__bsWired) return;
      inp.__bsWired = true;
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); window.bsSharedSearch(inp.value); }
      });
    });
    $$('form.search-form, form[role=search], .search-bar form').forEach(f => {
      if (f.__bsWired) return;
      f.__bsWired = true;
      f.addEventListener('submit', e => {
        e.preventDefault();
        const inp = f.querySelector('input');
        window.bsSharedSearch(inp ? inp.value : '');
      });
    });
    // header search toggle button
    const toggle = document.getElementById('searchToggle');
    const bar = document.getElementById('searchBar');
    if (toggle && bar && !toggle.__bsWired) {
      toggle.__bsWired = true;
      toggle.addEventListener('click', () => {
        bar.classList.toggle('show');
        const i = bar.querySelector('input'); if (i) i.focus();
      });
    }
  }

  // ---------- (6) Active menu highlight ----------
  function markActiveMenu() {
    $$('nav a, .main-nav a, .mobile-menu a, .site-header a, header a').forEach(a => {
      try {
        const href = (a.getAttribute('href') || '').split('#')[0].split('?')[0].toLowerCase();
        if (!href || href.startsWith('http') || href.startsWith('javascript')) return;
        const target = href.split('/').pop();
        if (target === currentPage || (currentPage === 'index.html' && (target === '' || target === '/'))) {
          a.classList.add('active');
        }
      } catch (_) {}
    });
  }

  // ---------- (7) badge sync from localStorage cart ----------
  function syncBadges() {
    try {
      const cart = JSON.parse(localStorage.getItem('bs_cart_v1') || localStorage.getItem('bs_cart') || '[]');
      const cnt = cart.reduce((s, i) => s + (+i.qty || 0), 0);
      $$('[data-badge=cart], #cartBadge, .cart-count').forEach(el => {
        el.textContent = cnt; el.style.display = cnt ? 'grid' : 'none';
      });
    } catch (_) {}
    try {
      const w = JSON.parse(localStorage.getItem('bs_wish_v1') || localStorage.getItem('bs_wish') || '[]');
      $$('[data-badge=wish]').forEach(el => {
        el.textContent = w.length; el.style.display = w.length ? 'grid' : 'none';
      });
    } catch (_) {}
  }

  // ---------- (8) If URL has ?q=, prefill search inputs on shop page ----------
  function prefillSearch() {
    const q = new URLSearchParams(location.search).get('q');
    if (!q) return;
    $$('input[type=search], input[name=q], #searchInput').forEach(i => { if (!i.value) i.value = q; });
    // Notify shop page listeners
    window.dispatchEvent(new CustomEvent('bs:search', { detail: { q } }));
  }

  // ---------- init ----------
  function init() {
    injectCSS();
    ensureHeader();
    ensureFloatingCart();
    ensureOverlays();
    wireSearchInputs();
    markActiveMenu();
    syncBadges();
    prefillSearch();
    flushPendingOrders();
    setTimeout(flushPendingOrders, 8000);
    window.addEventListener('online', flushPendingOrders);
    // Observe DOM changes so late-rendered headers still get wired.
    // IMPORTANT: wireSearchInputs/markActiveMenu/syncBadges themselves modify the DOM
    // (e.g. syncBadges sets el.textContent). Without disconnecting first, those writes
    // are picked up by this same observer, re-triggering the callback forever and
    // freezing the tab ("Page Unresponsive"). Disconnect during our own writes, and
    // debounce so bursts of unrelated mutations only run the handlers once.
    let moTimer = null;
    const mo = new MutationObserver(() => {
      if (moTimer) return;
      moTimer = setTimeout(() => {
        moTimer = null;
        mo.disconnect();
        wireSearchInputs(); markActiveMenu(); syncBadges();
        mo.observe(document.body, { childList: true, subtree: true });
      }, 50);
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  // Retry pending orders that were saved locally when backend was unreachable.
  // Fixes: "landing page থেকে অর্ডার করলে admin panel-এ যাচ্ছে না" — অর্ডার হারায় না,
  // সংযোগ ফিরে এলে অটো-সাবমিট হয়ে যায়।
  async function flushPendingOrders() {
    try {
      const raw = localStorage.getItem('bs_pending_orders');
      if (!raw) return;
      const list = JSON.parse(raw);
      if (!Array.isArray(list) || !list.length) return;
      const remaining = [];
      for (const o of list) {
        try {
          const res = await fetch(window.BS_API_BASE + '/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(o),
          });
          if (!res.ok) { remaining.push(o); }
        } catch (_) { remaining.push(o); }
      }
      if (remaining.length) localStorage.setItem('bs_pending_orders', JSON.stringify(remaining));
      else localStorage.removeItem('bs_pending_orders');
    } catch (_) { /* ignore */ }
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init);
  else init();
})();
/* ---- Auto-load bs-fixes.js (comprehensive frontend fixes) ---- */
(function(){
  try {
    if (document.querySelector('script[data-bs-fixes]')) return;
    var s = document.createElement('script');
    s.src = (document.currentScript && document.currentScript.src ? document.currentScript.src.replace(/bs-shared\.js.*/, 'bs-fixes.js') : 'js/bs-fixes.js');
    s.defer = true;
    s.setAttribute('data-bs-fixes','1');
    document.head.appendChild(s);
  } catch(e){}
})();
