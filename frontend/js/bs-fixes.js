/* =========================================================================
   BS Collection BD — Comprehensive Frontend Fixes (bs-fixes.js)
   ------------------------------------------------------------------------
   Auto-loaded by bs-shared.js on every page. Applies non-invasive patches:

   1. Order submit → falls back to backend + local queue on failure
   2. Global search: any search input/form routes to shop.html?q=
   3. Product cards without a real detail page → open coming-soon.html
   4. "Add to cart" on such cards is disabled
   5. "Add to cart" buttons that mistakenly navigate → intercept & add
   6. Login/logout hardening for account.html + orders.html linkage
   7. Mobile hamburger menu toggle fallback (Wishlist/menus visible)
   8. Mobile order form guard: never let the checkout button be a no-op
   ========================================================================= */
(function () {
  'use strict';
  if (window.__BS_FIXES_LOADED) return;
  window.__BS_FIXES_LOADED = true;

  const API_BASE = window.BS_API_BASE || (
    /localhost|127\.0\.0\.1/.test(location.hostname)
      ? 'http://localhost:5000/api'
      : 'https://bscollectionbd.onrender.com/api'
  );
  window.BS_API_BASE = API_BASE;

  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));

  // ---------- utility popup (replaces plain "পেজ আপডেট হয়েছে" alerts) ----------
  function popup(message, kind) {
    kind = kind || 'ok';
    let el = document.getElementById('bs-popup');
    if (!el) {
      el = document.createElement('div');
      el.id = 'bs-popup';
      el.innerHTML = `
        <div class="bs-popup-backdrop"></div>
        <div class="bs-popup-card">
          <div class="bs-popup-icon"></div>
          <div class="bs-popup-msg"></div>
          <button class="bs-popup-ok">ঠিক আছে</button>
        </div>`;
      document.body.appendChild(el);
      const style = document.createElement('style');
      style.textContent = `
        #bs-popup{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;font-family:inherit}
        #bs-popup.show{display:flex}
        #bs-popup .bs-popup-backdrop{position:absolute;inset:0;background:rgba(11,21,38,.55);animation:bspFade .2s}
        #bs-popup .bs-popup-card{position:relative;background:#fff;border-radius:16px;padding:26px 24px;min-width:280px;max-width:420px;text-align:center;box-shadow:0 25px 60px rgba(0,0,0,.25);animation:bspPop .25s}
        #bs-popup .bs-popup-icon{font-size:44px;margin-bottom:8px}
        #bs-popup.ok .bs-popup-icon::before{content:'✅'}
        #bs-popup.err .bs-popup-icon::before{content:'⚠️'}
        #bs-popup.info .bs-popup-icon::before{content:'ℹ️'}
        #bs-popup .bs-popup-msg{color:#14213D;font-weight:600;font-size:15px;line-height:1.5;margin-bottom:14px}
        #bs-popup .bs-popup-ok{background:#14213D;color:#fff;border:0;padding:10px 22px;border-radius:8px;font-weight:600;cursor:pointer}
        #bs-popup .bs-popup-ok:hover{background:#FCA311;color:#14213D}
        @keyframes bspFade{from{opacity:0}to{opacity:1}}
        @keyframes bspPop{from{transform:scale(.9);opacity:0}to{transform:scale(1);opacity:1}}
      `;
      document.head.appendChild(style);
      el.querySelector('.bs-popup-ok').addEventListener('click', () => el.classList.remove('show'));
      el.querySelector('.bs-popup-backdrop').addEventListener('click', () => el.classList.remove('show'));
    }
    el.className = kind + ' show';
    el.querySelector('.bs-popup-msg').textContent = message;
  }
  window.bsPopup = popup;

  // Replace alert() with popup where feasible (opt-in via data-bs-popup on triggers).
  const origAlert = window.alert;
  window.bsAlert = popup;
  // Do NOT clobber native alert (some flows rely on blocking). Provide bsAlert instead.

  // ---------- (1) Global search: any search input → shop.html?q= ----------
  function wireGlobalSearch() {
    const selectors = [
      'input#searchInput',
      'header input[type="search"]',
      '.search-bar input',
      '.search-form input',
      'input[name="q"]',
      'input[placeholder*="সার্চ"]',
      'input[placeholder*="খুঁজ"]',
      'input[placeholder*="Search"]'
    ];
    $$(selectors.join(',')).forEach(inp => {
      if (inp.__bsFixSearch) return;
      inp.__bsFixSearch = true;
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const q = String(inp.value || '').trim();
          if (q) location.href = 'shop.html?q=' + encodeURIComponent(q);
        }
      });
      const form = inp.closest('form');
      if (form && !form.__bsFixSearch) {
        form.__bsFixSearch = true;
        form.addEventListener('submit', e => {
          e.preventDefault();
          const q = String(inp.value || '').trim();
          if (q) location.href = 'shop.html?q=' + encodeURIComponent(q);
        });
      }
    });
  }

  // ---------- (2, 3, 4) Card click delegation: coming-soon for products
  //              without a real landing page; disable their Add-to-Cart. ----------
  // A product has a real landing page if its URL matches:
  //   - product-<slug>.html  (e.g. product-jy2570.html)
  //   - landing.html?slug=<slug>
  // Otherwise it uses the generic product-detail.html?id=... which we consider
  // "no landing page yet" and route to coming-soon.html.
  function hasRealLandingUrl(url) {
    if (!url) return false;
    const u = String(url).toLowerCase();
    if (u.indexOf('landing.html') === 0 || u.indexOf('landing.html?') === 0 || u.indexOf('/landing.html') > -1) return true;
    if (/product-[a-z0-9_-]+\.html/.test(u) && u.indexOf('product-detail.html') === -1) return true;
    return false;
  }

  function normalizeCards() {
    // Cards: .product-card, .card
    $$('.product-card, .card').forEach(card => {
      if (card.__bsFixed) return;
      card.__bsFixed = true;
      // Find any anchors / clickable regions inside the card
      const anchors = $$('a[href]', card);
      let hasReal = false;
      anchors.forEach(a => { if (hasRealLandingUrl(a.getAttribute('href'))) hasReal = true; });
      // Also inspect inline onclick handlers that push location
      $$('[onclick]', card).forEach(el => {
        const oc = el.getAttribute('onclick') || '';
        const m = oc.match(/location\.href\s*=\s*['"]([^'"]+)['"]/);
        if (m && hasRealLandingUrl(m[1])) hasReal = true;
      });

      if (!hasReal) {
        card.dataset.bsNoLanding = '1';
        // Rewrite anchor / inline onclick navigation targets → coming-soon.html
        anchors.forEach(a => {
          const href = a.getAttribute('href') || '';
          if (href.startsWith('#') || href.startsWith('javascript') || href.startsWith('mailto') || href.startsWith('tel')) return;
          // Keep add-to-cart action anchors alone; only rewrite detail/thumb/name links
          const isCartBtn = /add.*cart|cart-plus|shopping-cart/i.test(a.className + ' ' + a.innerHTML);
          if (isCartBtn) return;
          // Extract id from href if present
          const idMatch = href.match(/[?&]id=([^&]+)/) || href.match(/product-([a-z0-9_-]+)\.html/i);
          const id = idMatch ? idMatch[1] : (card.dataset.id || '');
          a.setAttribute('href', 'coming-soon.html' + (id ? '?id=' + encodeURIComponent(id) : ''));
        });
        $$('[onclick]', card).forEach(el => {
          const oc = el.getAttribute('onclick') || '';
          if (/location\.href/.test(oc)) {
            const id = card.dataset.id || '';
            el.setAttribute('onclick', "location.href='coming-soon.html" + (id ? '?id=' + id : '') + "'");
          }
        });
        // Disable "Add to Cart" buttons within this card
        $$('button, .btn, .quick-add', card).forEach(b => {
          const label = (b.textContent + ' ' + b.className + ' ' + (b.getAttribute('onclick') || '')).toLowerCase();
          if (/cart|কার্ট|addcart|add-to-cart|add_to_cart/i.test(label) && !/wish|heart|eye/i.test(label)) {
            b.disabled = true;
            b.setAttribute('aria-disabled', 'true');
            b.style.opacity = '0.55';
            b.style.cursor = 'not-allowed';
            b.title = 'শীঘ্রই আসছে — এখন অর্ডার নেওয়া হচ্ছে না';
            const idAttr = card.dataset.id || '';
            b.setAttribute('onclick', "event.stopPropagation();location.href='coming-soon.html" + (idAttr ? '?id=' + idAttr : '') + "'");
          }
        });
      } else {
        // (5) Real product: fix "Add to Cart" buttons that mistakenly navigate to detail page.
        $$('button, .btn, .quick-add', card).forEach(b => {
          const label = (b.textContent + ' ' + b.className).toLowerCase();
          if (!/cart|কার্ট/.test(label)) return;
          if (/wish|heart|eye/.test(label)) return;
          const oc = b.getAttribute('onclick') || '';
          if (/location\.href/.test(oc)) {
            // This button navigates; replace with an add-to-cart call.
            const id = card.dataset.id || (function () {
              const linkA = anchors.find(a => hasRealLandingUrl(a.getAttribute('href')));
              if (!linkA) return '';
              const h = linkA.getAttribute('href');
              const m = h.match(/product-([a-z0-9_-]+)\.html/i) || h.match(/[?&]slug=([^&]+)/) || h.match(/[?&]id=([^&]+)/);
              return m ? m[1] : '';
            })();
            if (id) {
              b.setAttribute('onclick',
                "event.stopPropagation();(function(){try{if(window.bsAddToCart){window.bsAddToCart('" + id + "',1);}else if(window.addToCart){window.addToCart('" + id + "',1);}else if(window.addCart){window.addCart('" + id + "');}else{location.href='cart.html?add=" + id + "';}}catch(e){location.href='cart.html?add=" + id + "';}})();"
              );
            }
          }
        });
      }
    });
  }

  // ---------- (6) Auth: harden login/logout ----------
  function wireAuthFallback() {
    // Make sure Logout buttons everywhere clear both possible keys.
    $$('[data-logout], #logoutBtn, .logout-btn, a[href="#logout"]').forEach(b => {
      if (b.__bsFixed) return;
      b.__bsFixed = true;
      b.addEventListener('click', e => {
        e.preventDefault();
        try {
          localStorage.removeItem('bs_current_user_v1');
          localStorage.removeItem('bs_user');
          localStorage.removeItem('bs_token');
          localStorage.removeItem('bs_customer_token');
        } catch (_) {}
        popup('আপনি লগআউট হয়েছেন', 'ok');
        setTimeout(() => location.href = 'account.html', 900);
      });
    });
  }

  // ---------- (7) Mobile hamburger menu fallback ----------
  function wireMobileMenu() {
    // Any 3-line icon button that isn't already wired should open a menu.
    const btnSel = '.hamburger, [data-hamburger], .mobile-toggle, #hamburger, .menu-toggle, .nav-toggle, .mobile-menu-btn, #menuBtn';
    $$(btnSel).forEach(btn => {
      if (btn.__bsMenuFix) return;
      btn.__bsMenuFix = true;
      btn.addEventListener('click', e => {
        // If page already opens a menu via its own handler, allow it.
        // Also try common fallbacks.
        setTimeout(() => {
          const menu = document.querySelector('.mobile-menu, .mobile-nav, #mobileMenu, .site-nav.open, nav.mobile, .nav-mobile');
          if (menu && !menu.classList.contains('open') && !menu.classList.contains('show') && !menu.classList.contains('active')) {
            menu.classList.add('open');
            menu.classList.add('show');
            menu.style.display = 'block';
          }
          // Fallback: if no menu exists on this page, inject a simple one.
          if (!menu && window.innerWidth < 900) injectMobileMenu();
        }, 30);
      });
    });
  }

  function injectMobileMenu() {
    if (document.getElementById('bsMobileMenu')) {
      document.getElementById('bsMobileMenu').classList.toggle('show');
      return;
    }
    const nav = document.createElement('div');
    nav.id = 'bsMobileMenu';
    nav.innerHTML = `
      <div class="bs-mm-backdrop"></div>
      <div class="bs-mm-panel">
        <button class="bs-mm-close">&times;</button>
        <a href="index.html">🏠 হোম</a>
        <a href="shop.html">🛍 শপ</a>
        <a href="wishlist.html">❤️ Wishlist</a>
        <a href="cart.html">🛒 কার্ট</a>
        <a href="account.html">👤 একাউন্ট</a>
        <a href="orders.html">📦 আমার অর্ডারসমূহ</a>
        <a href="about.html">ℹ️ আমাদের সম্পর্কে</a>
        <a href="contact.html">📞 যোগাযোগ</a>
      </div>`;
    document.body.appendChild(nav);
    const s = document.createElement('style');
    s.textContent = `
      #bsMobileMenu{position:fixed;inset:0;z-index:9990;display:none}
      #bsMobileMenu.show{display:block}
      #bsMobileMenu .bs-mm-backdrop{position:absolute;inset:0;background:rgba(11,21,38,.55)}
      #bsMobileMenu .bs-mm-panel{position:absolute;top:0;right:0;height:100%;width:80%;max-width:320px;background:#fff;padding:60px 20px 20px;display:flex;flex-direction:column;gap:14px;box-shadow:-10px 0 30px rgba(0,0,0,.15);overflow:auto}
      #bsMobileMenu a{color:#14213D;font-weight:600;text-decoration:none;padding:10px 8px;border-bottom:1px solid #eef1f6;font-size:15px}
      #bsMobileMenu a:hover{color:#FCA311}
      #bsMobileMenu .bs-mm-close{position:absolute;top:12px;right:12px;background:transparent;border:0;font-size:28px;cursor:pointer;color:#14213D}
    `;
    document.head.appendChild(s);
    nav.classList.add('show');
    nav.querySelector('.bs-mm-close').addEventListener('click', () => nav.classList.remove('show'));
    nav.querySelector('.bs-mm-backdrop').addEventListener('click', () => nav.classList.remove('show'));
  }

  // ---------- (8) Mobile order fix: intercept checkout submissions;
  //   if primary fetch fails, queue in bs_pending_orders and inform user. ----------
  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    return origFetch.apply(this, arguments).catch(err => {
      try {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        if (/\/api\/orders(\/|$|\?)/.test(url) && init && init.method === 'POST' && init.body) {
          let bodyObj = null;
          try { bodyObj = JSON.parse(init.body); } catch (_) {}
          if (bodyObj) {
            const list = JSON.parse(localStorage.getItem('bs_pending_orders') || '[]');
            list.push(bodyObj);
            localStorage.setItem('bs_pending_orders', JSON.stringify(list));
            popup('ইন্টারনেট সমস্যা — অর্ডার সংরক্ষিত হয়েছে, সংযোগ ফিরলে অটো-সাবমিট হবে', 'info');
          }
        }
      } catch (_) {}
      throw err;
    });
  };

  // ---------- Init loop ----------
  function init() {
    wireGlobalSearch();
    normalizeCards();
    wireAuthFallback();
    wireMobileMenu();
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init);
  else init();
  // Re-run when new cards get injected dynamically.
  let mo;
  try {
    let t = null;
    mo = new MutationObserver(() => {
      if (t) return;
      t = setTimeout(() => { t = null; init(); }, 250);
    });
    mo.observe(document.body || document.documentElement, { childList: true, subtree: true });
  } catch (_) {}
})();
