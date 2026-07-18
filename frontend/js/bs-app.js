/* ============================================================
   BS Collection BD — Unified App Core (bs-app.js)
   Handles: auth (Google Apps Script OTP), cart drawer, checkout
   modal, reviews, mobile nav, WhatsApp float, category filter,
   digit normalization, Bengali/English language.
   ============================================================ */
(function () {
  'use strict';

  // ============ CONFIG ============
  // Google Apps Script Web App URL — deploy the provided apps-script.gs and paste URL here.
  // Until set, OTPs are shown in an alert (dev fallback).
  const APPS_SCRIPT_URL = ''; // e.g. 'https://script.google.com/macros/s/AKfycb.../exec'
  const CONTACT_PHONE = '01344367630';
  const WHATSAPP_NUMBER = '8801344367630';
  const DELIVERY_DHAKA = 70;
  const DELIVERY_OTHER = 130;

  // ============ STORAGE KEYS (unified) ============
  const K = {
    cart:    'bs_cart_v1',
    wish:    'bs_wish_v1',
    users:   'bs_users_v1',
    curUser: 'bs_current_user_v1',
    orders:  'bs_orders_v1',
    reviews: 'bs_reviews_v1',
    otp:     'bs_otp_pending_v1',
    pendingReview: 'bs_pending_review_v1'
  };

  // migrate old keys
  try {
    if (!localStorage.getItem(K.cart) && localStorage.getItem('bs_cart')) {
      const old = JSON.parse(localStorage.getItem('bs_cart') || '[]');
      const migrated = old.map(x => ({ id: x.id, qty: x.qty, name: '', price: 0, image: '' }));
      localStorage.setItem(K.cart, JSON.stringify(migrated));
    }
    if (!localStorage.getItem(K.curUser) && localStorage.getItem('bs_user')) {
      localStorage.setItem(K.curUser, localStorage.getItem('bs_user'));
    }
  } catch (e) {}

  // ============ HELPERS ============
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch(e){ return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
  };
  const fmt = n => 'Tk ' + Number(n||0).toLocaleString('en-US');
  const $ = (s, ctx) => (ctx || document).querySelector(s);
  const $$ = (s, ctx) => Array.from((ctx || document).querySelectorAll(s));
  function bnToEn(str){ return String(str).replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d)); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

  function toast(msg, kind) {
    let el = document.getElementById('bs-toast');
    if (!el) { el = document.createElement('div'); el.id = 'bs-toast'; document.body.appendChild(el); }
    el.className = 'bs-toast show ' + (kind || '');
    el.textContent = msg;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.className = 'bs-toast', 2400);
  }
  window.bsToast = toast;

  // ============ PRODUCT LOOKUP ============
  function findProduct(id) {
    if (typeof PRODUCTS !== 'undefined') return PRODUCTS.find(p => p.id === id);
    return null;
  }

  // ============ CART ============
  function getCart(){ return LS.get(K.cart, []); }
  function saveCart(c){ LS.set(K.cart, c); updateBadges(); if (isDrawerOpen()) renderDrawer(); }
  function cartCount(){ return getCart().reduce((s,i)=>s+(+i.qty||0),0); }
  function cartSubtotal(){ return getCart().reduce((s,i)=>s+(+i.price||0)*(+i.qty||0),0); }
  function addToCart(item, qty) {
    qty = Math.max(1, parseInt(qty||1,10));
    let it = item;
    if (typeof item === 'string') {
      const p = findProduct(item);
      if (!p || !p.available) { toast('পণ্যটি এখন স্টকে নেই', 'err'); return; }
      it = { id:p.id, name:p.name, price:p.price, image:p.image, qty };
    } else if (item && item.id) {
      it = { id:item.id, name:item.name||'', price:+item.price||0, image:item.image||'', qty:+item.qty||qty };
    } else return;
    const cart = getCart();
    const idx = cart.findIndex(x => x.id === it.id);
    if (idx > -1) cart[idx].qty += it.qty;
    else cart.push(it);
    saveCart(cart);
    toast('কার্টে যোগ হয়েছে — ' + (it.name || 'পণ্য'), 'ok');
    openDrawer();
  }
  function removeItem(id){ saveCart(getCart().filter(x=>x.id!==id)); toast('মুছে ফেলা হয়েছে'); }
  function setQty(id, qty){
    qty = Math.max(1, parseInt(qty||1,10));
    const cart = getCart(); const it = cart.find(x=>x.id===id);
    if (it) { it.qty = qty; saveCart(cart); }
  }
  window.bsAddToCart = addToCart;
  window.bsCart = { get: getCart, add: addToCart, remove: removeItem, setQty, count: cartCount, subtotal: cartSubtotal };

  // ============ WISHLIST ============
  function getWish(){ return LS.get(K.wish, []); }
  function saveWish(w){ LS.set(K.wish, w); updateBadges(); }
  function toggleWish(item){
    let w = getWish();
    let it = item;
    if (typeof item === 'string') {
      const p = findProduct(item); if (!p) return;
      it = { id:p.id, name:p.name, price:p.price, image:p.image };
    }
    const i = w.findIndex(x=>x.id===it.id);
    if (i>-1){ w.splice(i,1); saveWish(w); toast('উইশলিস্ট থেকে বাদ'); }
    else { w.push(it); saveWish(w); toast('উইশলিস্টে যোগ হয়েছে','ok'); }
  }
  window.bsToggleWish = toggleWish;

  // ============ AUTH ============
  function getUsers(){ return LS.get(K.users, []); }
  function saveUsers(u){ LS.set(K.users, u); }
  function getUser(){ return LS.get(K.curUser, null); }
  function setUser(u){ LS.set(K.curUser, u); updateBadges(); refreshAuthUI(); }
  function logout(){ localStorage.removeItem(K.curUser); refreshAuthUI(); toast('লগআউট হয়েছে','ok'); setTimeout(()=>location.href='index.html',600); }
  // simple hash (not cryptographic — client-side only demo)
  function hashPw(s){ let h=0; for(let i=0;i<s.length;i++){ h=((h<<5)-h+s.charCodeAt(i))|0; } return String(h); }

  function signup({ name, email, phone, password }) {
    email = (email||'').trim().toLowerCase();
    if (!name || !email || !password) return { ok:false, msg:'সব ঘর পূরণ করুন' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok:false, msg:'সঠিক ইমেইল দিন' };
    if (password.length < 6) return { ok:false, msg:'পাসওয়ার্ড কমপক্ষে ৬ অক্ষর' };
    const users = getUsers();
    if (users.find(u=>u.email===email)) return { ok:false, msg:'এই ইমেইলে আগেই অ্যাকাউন্ট আছে' };
    const u = { id:uid(), name, email, phone:phone||'', pw:hashPw(password), createdAt:Date.now() };
    users.push(u); saveUsers(users);
    setUser({ id:u.id, name:u.name, email:u.email, phone:u.phone });
    return { ok:true };
  }
  function login({ email, password }) {
    email = (email||'').trim().toLowerCase();
    const users = getUsers();
    const u = users.find(x=>x.email===email);
    if (!u) return { ok:false, msg:'ইমেইল খুঁজে পাওয়া যায়নি' };
    if (u.pw !== hashPw(password||'')) return { ok:false, msg:'পাসওয়ার্ড ভুল' };
    setUser({ id:u.id, name:u.name, email:u.email, phone:u.phone });
    return { ok:true };
  }
  async function sendOtp(email) {
    email = (email||'').trim().toLowerCase();
    const users = getUsers();
    if (!users.find(u=>u.email===email)) return { ok:false, msg:'এই ইমেইলে অ্যাকাউন্ট নেই' };
    const code = String(Math.floor(100000 + Math.random()*900000));
    LS.set(K.otp, { email, code, exp: Date.now()+10*60*1000 });
    if (APPS_SCRIPT_URL) {
      try {
        await fetch(APPS_SCRIPT_URL, {
          method:'POST', mode:'no-cors',
          headers:{'Content-Type':'text/plain;charset=utf-8'},
          body: JSON.stringify({ action:'sendOtp', email, code })
        });
        return { ok:true, msg:'OTP আপনার ইমেইলে পাঠানো হয়েছে' };
      } catch(e){ return { ok:false, msg:'OTP পাঠানো যায়নি' }; }
    } else {
      // dev fallback
      alert('DEV MODE — আপনার OTP: ' + code + '\n(Apps Script URL সেট করলে ইমেইলে যাবে)');
      return { ok:true, msg:'OTP তৈরি হয়েছে (dev mode)' };
    }
  }
  function verifyOtp(email, code) {
    const p = LS.get(K.otp, null);
    if (!p || p.email !== (email||'').toLowerCase()) return { ok:false, msg:'OTP পাঠানো হয়নি' };
    if (Date.now() > p.exp) return { ok:false, msg:'OTP মেয়াদ শেষ' };
    if (p.code !== String(code||'').trim()) return { ok:false, msg:'ভুল OTP' };
    return { ok:true };
  }
  function resetPassword(email, code, newPw) {
    const v = verifyOtp(email, code);
    if (!v.ok) return v;
    if (!newPw || newPw.length < 6) return { ok:false, msg:'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষর' };
    const users = getUsers();
    const u = users.find(x=>x.email===email.toLowerCase());
    if (!u) return { ok:false, msg:'ইউজার নেই' };
    u.pw = hashPw(newPw); saveUsers(users);
    localStorage.removeItem(K.otp);
    return { ok:true };
  }
  window.bsAuth = { get:getUser, signup, login, logout, sendOtp, verifyOtp, resetPassword };

  // ============ ORDERS ============
  function getOrders(){ return LS.get(K.orders, []); }
  function saveOrder(o){ const a=getOrders(); a.unshift(o); LS.set(K.orders, a); }
  window.bsOrders = { list:getOrders };

  // ============ REVIEWS ============
  function getReviews(pid){ return LS.get(K.reviews, {})[pid] || []; }
  function addReview(pid, text, rating){
    const u = getUser();
    if (!u) {
      LS.set(K.pendingReview, { pid, text, rating, at:Date.now() });
      openLoginModal('রিভিউ জমা দিতে লগইন করুন');
      return { ok:false, needAuth:true };
    }
    if (!text || !text.trim()) return { ok:false, msg:'রিভিউ লিখুন' };
    const all = LS.get(K.reviews, {});
    all[pid] = all[pid] || [];
    all[pid].unshift({ id:uid(), user:u.name, email:u.email, text:text.trim(), rating:+rating||5, at:Date.now() });
    LS.set(K.reviews, all);
    toast('রিভিউ জমা হয়েছে','ok');
    return { ok:true };
  }
  function flushPendingReview(){
    const p = LS.get(K.pendingReview, null);
    if (!p) return;
    localStorage.removeItem(K.pendingReview);
    if (getUser()) addReview(p.pid, p.text, p.rating);
  }
  window.bsReviews = { list:getReviews, add:addReview };

  // ============ BADGES / AUTH UI ============
  function updateBadges(){
    const c = cartCount(), w = getWish().length;
    $$('[data-badge=cart], #cartBadge, [data-cart-count]').forEach(el=>{ el.textContent=c; el.style.display = c?'grid':'none'; });
    $$('[data-badge=wish], #wishlistBadge, [data-wish-count]').forEach(el=>{ el.textContent=w; el.style.display = w?'grid':'none'; });
  }
  function refreshAuthUI(){
    const u = getUser();
    $$('[data-auth=user], [data-user-name]').forEach(el=>{
      if (el.dataset.userName !== undefined) el.textContent = u ? u.name : 'লগইন';
      else el.innerHTML = u
        ? `<a href="account.html" title="${esc(u.name)}"><i class="fas fa-user-check"></i></a>`
        : `<a href="login.html" title="লগইন"><i class="fas fa-user"></i></a>`;
    });
  }

  // ============ CART DRAWER ============
  function isDrawerOpen(){ return document.body.classList.contains('bs-drawer-open'); }
  function openDrawer(){ ensureDrawer(); document.body.classList.add('bs-drawer-open'); renderDrawer(); }
  function closeDrawer(){ document.body.classList.remove('bs-drawer-open'); }
  function ensureDrawer(){
    if (document.getElementById('bs-drawer')) return;
    const d = document.createElement('div');
    d.id = 'bs-drawer-root';
    d.innerHTML = `
      <div class="bs-drawer-backdrop" onclick="bsCloseDrawer()"></div>
      <aside id="bs-drawer" class="bs-drawer" role="dialog" aria-label="Cart">
        <header class="bs-drawer-head">
          <h3><i class="fas fa-shopping-cart"></i> আপনার কার্ট</h3>
          <button class="bs-icon-btn" onclick="bsCloseDrawer()" aria-label="Close"><i class="fas fa-times"></i></button>
        </header>
        <div class="bs-drawer-body" id="bs-drawer-body"></div>
        <footer class="bs-drawer-foot" id="bs-drawer-foot"></footer>
      </aside>`;
    document.body.appendChild(d);
  }
  function renderDrawer(){
    const items = getCart();
    const body = $('#bs-drawer-body'), foot = $('#bs-drawer-foot');
    if (!body) return;
    if (!items.length) {
      body.innerHTML = `<div class="bs-empty"><i class="fas fa-cart-arrow-down"></i><p>কার্ট খালি</p><a href="shop.html" class="bs-btn" onclick="bsCloseDrawer()">শপিং করুন</a></div>`;
      foot.innerHTML = '';
      return;
    }
    body.innerHTML = items.map(i => `
      <div class="bs-cart-item">
        <img src="${esc(i.image)}" alt="" onerror="this.style.visibility='hidden'"/>
        <div class="bs-cart-info">
          <div class="bs-cart-name">${esc(i.name)}</div>
          <div class="bs-cart-price">${fmt(i.price)}</div>
          <div class="bs-qty">
            <button onclick="bsCart.setQty('${i.id}', ${i.qty-1})" ${i.qty<=1?'disabled':''}>−</button>
            <span>${i.qty}</span>
            <button onclick="bsCart.setQty('${i.id}', ${i.qty+1})">+</button>
          </div>
        </div>
        <button class="bs-remove" onclick="bsCart.remove('${i.id}')" aria-label="Remove"><i class="fas fa-trash"></i></button>
      </div>`).join('');
    const sub = cartSubtotal();
    foot.innerHTML = `
      <div class="bs-row"><span>সাবটোটাল</span><strong>${fmt(sub)}</strong></div>
      <button class="bs-btn bs-btn-primary bs-full" onclick="bsOpenCheckout()">Proceed to Checkout <i class="fas fa-arrow-right"></i></button>
      <button class="bs-btn bs-full bs-btn-ghost" onclick="bsCloseDrawer()">শপিং চালিয়ে যান</button>`;
  }
  window.bsOpenDrawer = openDrawer;
  window.bsCloseDrawer = closeDrawer;

  // ============ CHECKOUT MODAL ============
  function openCheckout(){
    const cart = getCart();
    if (!cart.length) { toast('কার্ট খালি','err'); return; }
    ensureCheckout();
    document.body.classList.add('bs-modal-open');
    renderCheckout();
  }
  function closeCheckout(){ document.body.classList.remove('bs-modal-open'); }
  function ensureCheckout(){
    if (document.getElementById('bs-checkout')) return;
    const m = document.createElement('div');
    m.id = 'bs-modal-root';
    m.innerHTML = `
      <div class="bs-modal-backdrop" onclick="bsCloseCheckout()"></div>
      <div id="bs-checkout" class="bs-modal" role="dialog">
        <header class="bs-modal-head">
          <h3><i class="fas fa-truck"></i> অর্ডার সম্পূর্ণ করুন</h3>
          <button class="bs-icon-btn" onclick="bsCloseCheckout()"><i class="fas fa-times"></i></button>
        </header>
        <div class="bs-modal-body" id="bs-checkout-body"></div>
      </div>`;
    document.body.appendChild(m);
  }
  function renderCheckout(){
    const cart = getCart();
    const u = getUser() || {};
    const items = cart.map(i=>`
      <div class="bs-co-item">
        <img src="${esc(i.image)}" onerror="this.style.visibility='hidden'"/>
        <div><div class="bs-co-name">${esc(i.name)}</div>
        <div class="bs-muted">${fmt(i.price)} × ${i.qty}</div></div>
        <div class="bs-co-sub">${fmt(i.price*i.qty)}</div>
      </div>`).join('');
    const sub = cartSubtotal();
    $('#bs-checkout-body').innerHTML = `
      <div class="bs-co-grid">
        <div class="bs-co-items">
          <h4>আপনার পণ্য</h4>
          ${items}
        </div>
        <form class="bs-co-form" id="bs-co-form">
          <h4>ডেলিভারি তথ্য</h4>
          <label>নাম <input required name="name" value="${esc(u.name||'')}"/></label>
          <label>মোবাইল নাম্বার <input required name="phone" type="tel" pattern="[0-9+]{6,}" value="${esc(u.phone||'')}"/></label>
          <label>সম্পূর্ণ ঠিকানা <textarea required name="address" rows="2" placeholder="বাসা/রোড/এলাকা, থানা, জেলা"></textarea></label>
          <label>ডেলিভারি এলাকা
            <select name="area" required onchange="bsUpdateShip(this)">
              <option value="">-- নির্বাচন করুন --</option>
              <option value="Dhaka">ঢাকার ভিতরে (৭০ টাকা)</option>
              <option value="Outside">ঢাকার বাইরে (১৩০ টাকা)</option>
            </select>
          </label>
          <div class="bs-co-summary">
            <div class="bs-row"><span>সাবটোটাল</span><span>${fmt(sub)}</span></div>
            <div class="bs-row"><span>ডেলিভারি চার্জ <small id="bs-ship-note">(এলাকা নির্বাচন করুন)</small></span><span id="bs-ship-amt">${fmt(0)}</span></div>
            <div class="bs-row bs-total"><span>মোট</span><strong id="bs-total-amt">${fmt(sub)}</strong></div>
          </div>
          <button type="submit" class="bs-btn bs-btn-primary bs-full">অর্ডার নিশ্চিত করুন <i class="fas fa-check"></i></button>
        </form>
      </div>`;
    $('#bs-co-form').addEventListener('submit', onCheckoutSubmit);
  }
  window.bsUpdateShip = function(sel){
    const area = sel.value;
    const ship = area==='Dhaka' ? DELIVERY_DHAKA : (area?DELIVERY_OTHER:0);
    $('#bs-ship-amt').textContent = fmt(ship);
    $('#bs-ship-note').textContent = area==='Dhaka' ? '(ঢাকার ভিতরে)' : (area ? '(ঢাকার বাইরে)' : '(এলাকা নির্বাচন করুন)');
    $('#bs-total-amt').textContent = fmt(cartSubtotal()+ship);
  };
  async function onCheckoutSubmit(e){
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    const cart = getCart();
    const sub = cartSubtotal();
    const ship = data.area==='Dhaka' ? DELIVERY_DHAKA : DELIVERY_OTHER;
    const order = {
      id: 'ORD-' + uid().toUpperCase(),
      at: Date.now(),
      customer: data,
      items: cart,
      subtotal: sub, shipping: ship, total: sub+ship,
      status: 'Pending',
      user: getUser()?.email || null
    };
    saveOrder(order);
    if (APPS_SCRIPT_URL) {
      try { await fetch(APPS_SCRIPT_URL, { method:'POST', mode:'no-cors',
        headers:{'Content-Type':'text/plain;charset=utf-8'},
        body: JSON.stringify({ action:'newOrder', order }) }); } catch(e){}
    }
    saveCart([]);
    closeCheckout(); closeDrawer();
    showSuccess(order);
  }
  window.bsOpenCheckout = openCheckout;
  window.bsCloseCheckout = closeCheckout;

  function showSuccess(o){
    let m = document.getElementById('bs-success-root');
    if (m) m.remove();
    m = document.createElement('div'); m.id='bs-success-root';
    m.innerHTML = `
      <div class="bs-modal-backdrop" onclick="this.parentNode.remove()"></div>
      <div class="bs-modal bs-modal-sm">
        <div class="bs-success">
          <div class="bs-check"><i class="fas fa-check"></i></div>
          <h3>অর্ডার সফল হয়েছে!</h3>
          <p>অর্ডার আইডি: <b>${o.id}</b></p>
          <p>মোট: <b>${fmt(o.total)}</b></p>
          <p class="bs-muted">আমরা শীঘ্রই ${esc(o.customer.phone)} নাম্বারে যোগাযোগ করব।</p>
          <button class="bs-btn bs-btn-primary" onclick="document.getElementById('bs-success-root').remove()">ঠিক আছে</button>
        </div>
      </div>`;
    document.body.appendChild(m);
  }

  // ============ LOGIN MODAL (for review flow) ============
  function openLoginModal(title){
    let m = document.getElementById('bs-login-modal');
    if (m) m.remove();
    m = document.createElement('div'); m.id='bs-login-modal';
    m.innerHTML = `
      <div class="bs-modal-backdrop" onclick="this.parentNode.remove()"></div>
      <div class="bs-modal bs-modal-sm">
        <header class="bs-modal-head"><h3>${esc(title||'লগইন')}</h3>
          <button class="bs-icon-btn" onclick="document.getElementById('bs-login-modal').remove()"><i class="fas fa-times"></i></button></header>
        <div class="bs-modal-body">
          <form id="bs-mini-login">
            <label>ইমেইল <input required name="email" type="email"/></label>
            <label>পাসওয়ার্ড <input required name="password" type="password"/></label>
            <button class="bs-btn bs-btn-primary bs-full" type="submit">লগইন</button>
          </form>
          <p class="bs-muted" style="text-align:center;margin-top:12px">
            অ্যাকাউন্ট নেই? <a href="register.html">Sign up</a> ·
            <a href="login.html?forgot=1">পাসওয়ার্ড ভুলে গেছেন?</a>
          </p>
        </div>
      </div>`;
    document.body.appendChild(m);
    $('#bs-mini-login').addEventListener('submit', e=>{
      e.preventDefault();
      const fd = new FormData(e.target);
      const r = login({ email: fd.get('email'), password: fd.get('password') });
      if (!r.ok) { toast(r.msg,'err'); return; }
      toast('লগইন সফল','ok');
      document.getElementById('bs-login-modal').remove();
      flushPendingReview();
    });
  }
  window.bsOpenLogin = openLoginModal;

  // ============ MOBILE NAV DRAWER ============
  function ensureMobileNav(){
    if (document.getElementById('bs-mnav')) return;
    const el = document.createElement('div');
    el.id = 'bs-mnav-root';
    el.innerHTML = `
      <div class="bs-mnav-backdrop" onclick="bsCloseMNav()"></div>
      <aside id="bs-mnav" class="bs-mnav">
        <header><span>মেনু</span><button class="bs-icon-btn" onclick="bsCloseMNav()"><i class="fas fa-times"></i></button></header>
        <nav>
          <a href="index.html"><i class="fas fa-home"></i> হোম</a>
          <a href="shop.html"><i class="fas fa-store"></i> শপ</a>
          <a href="shop.html?cat=Rechargeable Fan"><i class="fas fa-fan"></i> রিচার্জেবল ফ্যান</a>
          <a href="wishlist.html"><i class="fas fa-heart"></i> উইশলিস্ট</a>
          <a href="account.html"><i class="fas fa-user"></i> আমার অ্যাকাউন্ট</a>
          <a href="about.html"><i class="fas fa-info-circle"></i> আমাদের সম্পর্কে</a>
          <a href="contact.html"><i class="fas fa-phone"></i> যোগাযোগ</a>
          <a href="tel:${CONTACT_PHONE}"><i class="fas fa-headset"></i> কল ${CONTACT_PHONE}</a>
        </nav>
      </aside>`;
    document.body.appendChild(el);
  }
  window.bsOpenMNav = function(){ ensureMobileNav(); document.body.classList.add('bs-mnav-open'); };
  window.bsCloseMNav = function(){ document.body.classList.remove('bs-mnav-open'); };

  // ============ WHATSAPP FLOAT ============
  function ensureWhatsApp(){
    if (document.getElementById('bs-wa')) return;
    const a = document.createElement('a');
    a.id = 'bs-wa'; a.href = 'https://wa.me/'+WHATSAPP_NUMBER;
    a.target = '_blank'; a.rel = 'noopener';
    a.title = 'WhatsApp';
    a.innerHTML = '<i class="fab fa-whatsapp"></i>';
    document.body.appendChild(a);
  }

  // ============ HEADER/PAGE INTERCEPTORS ============
  function interceptCartLinks(){
    // Any header/nav cart icon → open drawer instead of navigating
    $$('a[href$="cart.html"], a[href="cart.html"]').forEach(a=>{
      if (a.dataset.bsIntercepted) return;
      a.dataset.bsIntercepted = '1';
      // still allow direct visit from menu? keep icon-only intercept:
      a.addEventListener('click', e=>{ e.preventDefault(); openDrawer(); });
    });
  }
  function interceptCheckoutButtons(){
    $$('a[href$="checkout.html"], a[href="checkout.html"], [data-checkout]').forEach(a=>{
      if (a.dataset.bsIntercepted) return;
      a.dataset.bsIntercepted='1';
      a.addEventListener('click', e=>{ e.preventDefault(); openCheckout(); });
    });
  }
  function interceptHamburger(){
    // common hamburger classes in the site
    $$('.hamburger, [data-hamburger], .mobile-toggle, #hamburger, .menu-toggle').forEach(b=>{
      if (b.dataset.bsIntercepted) return;
      b.dataset.bsIntercepted='1';
      b.addEventListener('click', e=>{ e.preventDefault(); window.bsOpenMNav(); });
    });
    // if no hamburger exists on mobile, add one
    if (window.innerWidth < 900 && !$('.hamburger, [data-hamburger], #bs-inject-hamburger')) {
      const header = $('header .container, header .header-inner, header .main-header .container, header');
      if (header && !header.querySelector('#bs-inject-hamburger')) {
        const h = document.createElement('button');
        h.id = 'bs-inject-hamburger'; h.className='bs-hamburger';
        h.innerHTML = '<i class="fas fa-bars"></i>';
        h.addEventListener('click', ()=>window.bsOpenMNav());
        header.appendChild(h);
      }
    }
  }

  // ============ CATEGORY FILTER (shop page) ============
  function applyCategoryFilter(){
    const params = new URLSearchParams(location.search);
    const cat = params.get('cat');
    if (!cat) return;
    // Try common product-grid selectors
    setTimeout(()=>{
      const cards = $$('.card, .product-card, [data-category]');
      cards.forEach(c=>{
        const t = (c.dataset.category || c.textContent || '').toLowerCase();
        c.style.display = t.includes(cat.toLowerCase()) ? '' : 'none';
      });
      const h = $('h1, .page-title');
      if (h) h.textContent = 'ক্যাটাগরি: ' + cat;
    }, 300);
  }

  // Wire category tiles on homepage (elements with data-cat or href*=?cat=)
  function wireCategoryTiles(){
    $$('[data-cat]').forEach(el=>{
      if (el.dataset.bsIntercepted) return;
      el.dataset.bsIntercepted='1';
      el.style.cursor='pointer';
      el.addEventListener('click', ()=>{ location.href = 'shop.html?cat=' + encodeURIComponent(el.dataset.cat); });
    });
  }

  // ============ DIGIT NORMALIZATION (product name/price only stays English via CSS-safe walker) ============
  function normalizeDigitsIn(root){
    try{
      const walker = document.createTreeWalker(root||document.body, NodeFilter.SHOW_TEXT, null);
      const toFix = []; let n;
      while (n = walker.nextNode()) if (/[০-৯]/.test(n.nodeValue)) toFix.push(n);
      toFix.forEach(n=>n.nodeValue = bnToEn(n.nodeValue));
    }catch(e){}
  }

  // ============ TOPBAR PHONE INJECT ============
  function injectTopbarPhone(){
    const tb = $('.topbar');
    if (!tb) return;
    if (tb.querySelector('[data-bs-phone]')) return;
    const a = document.createElement('a');
    a.href = 'tel:'+CONTACT_PHONE; a.dataset.bsPhone='1';
    a.innerHTML = '<i class="fas fa-phone"></i> '+CONTACT_PHONE;
    a.style.marginRight='12px';
    const c = tb.querySelector('.container') || tb;
    c.insertBefore(a, c.firstChild);
  }

  // ============ INIT ============
  function init(){
    injectTopbarPhone();
    ensureWhatsApp();
    updateBadges();
    refreshAuthUI();
    interceptCartLinks();
    interceptCheckoutButtons();
    interceptHamburger();
    wireCategoryTiles();
    applyCategoryFilter();
    normalizeDigitsIn(document.body);
    flushPendingReview();
    // rebind after dynamic content loads
    setTimeout(()=>{ interceptCartLinks(); interceptCheckoutButtons(); interceptHamburger(); updateBadges(); refreshAuthUI(); }, 800);
    setTimeout(()=>{ interceptCartLinks(); interceptCheckoutButtons(); updateBadges(); }, 2000);
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // Escape key closes overlays
  document.addEventListener('keydown', e=>{
    if (e.key==='Escape'){ closeDrawer(); closeCheckout(); window.bsCloseMNav(); }
  });
})();