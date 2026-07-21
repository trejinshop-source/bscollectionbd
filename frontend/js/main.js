// bscollectionbd — main.js: header, footer, cart, wishlist, search, utils
// -----------------------------------------------------------------------------
// English-only number formatting: force en-US locale everywhere.
function fmt(n){ return 'Tk ' + Number(n||0).toLocaleString('en-US'); }
function fmtNum(n){ return Number(n||0).toLocaleString('en-US'); }

// LocalStorage helpers
const LS = {
  get(k, d){ try{ const v = localStorage.getItem(k); return v?JSON.parse(v):d; }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
};
function getCart(){ return LS.get('bs_cart', []); }
function setCart(c){ LS.set('bs_cart', c); updateBadges(); }
function getWish(){ return LS.get('bs_wish', []); }
function setWish(w){ LS.set('bs_wish', w); updateBadges(); }
function getUsers(){ return LS.get('bs_users', []); }
function setUsers(u){ LS.set('bs_users', u); }
function getUser(){ return LS.get('bs_user', null); }
function setUser(u){ LS.set('bs_user', u); refreshAuthUI(); }
function logout(){ localStorage.removeItem('bs_user'); refreshAuthUI(); toast('Signed out','ok'); setTimeout(()=>location.href='index.html',600); }

// TOAST
function toast(msg, kind){
  let el = document.getElementById('toast');
  if(!el){ el = document.createElement('div'); el.id='toast'; document.body.appendChild(el); }
  el.textContent = msg; el.className = 'show ' + (kind||'');
  clearTimeout(toast._t); toast._t = setTimeout(()=>el.className='',2200);
}

// CART / WISHLIST OPS
function addToCart(id, qty){
  const p = findProduct(id);
  if(!p || !p.available){ toast('Product not available yet','err'); return; }
  qty = Math.max(1, parseInt(qty||1,10));
  const cart = getCart();
  const ex = cart.find(x => x.id === id);
  if(ex) ex.qty += qty; else cart.push({ id, qty });
  setCart(cart); toast('Added to cart','ok');
}
function removeFromCart(id){ setCart(getCart().filter(x=>x.id!==id)); }
function setCartQty(id, qty){
  qty = Math.max(1, parseInt(qty||1,10));
  const c = getCart(); const it = c.find(x=>x.id===id); if(it){ it.qty=qty; setCart(c); }
}
function toggleWish(id){
  const p = findProduct(id); if(!p || !p.available){ toast('Not available','err'); return; }
  let w = getWish();
  if(w.includes(id)){ w = w.filter(x=>x!==id); toast('Removed from wishlist'); }
  else{ w.push(id); toast('Added to wishlist','ok'); }
  setWish(w);
  document.querySelectorAll('[data-wish="'+id+'"]').forEach(b=>b.classList.toggle('on', w.includes(id)));
}

// BADGES
function updateBadges(){
  const cq = getCart().reduce((s,x)=>s+x.qty,0);
  const wq = getWish().length;
  document.querySelectorAll('[data-badge=cart]').forEach(el=>{ el.textContent = fmtNum(cq); el.style.display = cq?'grid':'none'; });
  document.querySelectorAll('[data-badge=wish]').forEach(el=>{ el.textContent = fmtNum(wq); el.style.display = wq?'grid':'none'; });
}

// PRODUCT CARD
function productCard(p){
  if(!p.available){
    return `<div class="card">
      <span class="cs-badge">COMING SOON</span>
      <div class="thumb" style="display:grid;place-items:center;background:#f3f4f6;color:#9ca3af"><i class="fas fa-fan" style="font-size:56px"></i></div>
      <div class="body">
        <h3>${p.name}</h3>
        <p class="muted" style="margin:0;font-size:13px">Coming Soon</p>
        <div class="actions"><a class="btn" href="coming-soon.html?id=${p.id}">Details</a></div>
      </div></div>`;
  }
  const onWish = getWish().includes(p.id);
  return `<div class="card">
    <button class="wish ${onWish?'on':''}" data-wish="${p.id}" onclick="toggleWish('${p.id}')" aria-label="Wishlist"><i class="fas fa-heart"></i></button>
    <a class="thumb" href="product-${p.id}.html"><img src="${p.image}" alt="${p.name}" loading="lazy"/></a>
    <div class="body">
      <h3><a href="product-${p.id}.html">${p.name}</a></h3>
      <div><span class="price">${fmt(p.price)}</span>${p.old?`<span class="old">${fmt(p.old)}</span>`:''}</div>
      <div class="actions">
        <a class="btn" href="product-${p.id}.html">Details</a>
        <button class="btn accent" onclick="addToCart('${p.id}',1)"><i class="fas fa-cart-plus"></i></button>
      </div>
    </div></div>`;
}

// SEARCH
function doSearch(e){
  e.preventDefault();
  const q = (e.target.querySelector('input[name=q]').value||'').trim();
  if(!q){ toast('Type something to search','err'); return false; }
  location.href = 'search.html?q=' + encodeURIComponent(q);
  return false;
}

// AUTH UI
function refreshAuthUI(){
  const u = getUser();
  document.querySelectorAll('[data-auth=user]').forEach(el=>{
    if(u){ el.innerHTML = `<a href="account.html" title="${u.name}"><i class="fas fa-user"></i></a>`; }
    else{ el.innerHTML = `<a href="login.html" title="Login"><i class="fas fa-user"></i></a>`; }
  });
}

// HEADER / FOOTER TEMPLATES
function renderHeader(){
  const page = document.body.dataset.page || '';
  const activeClass = (name) => page === name ? 'active' : '';
  const html = `
  <header class="site-header">
    <div class="container header-inner">
      <a class="brand" href="index.html">
        <img src="assets/logo.png" alt="bscollectionbd"/>
        <span>bscollectionbd</span>
      </a>
      <nav class="main-nav">
        <a class="${activeClass('home')}" href="index.html">Home</a>
        <a class="${activeClass('shop')}" href="shop.html">Shop</a>
        <a class="${activeClass('about')}" href="about.html">About</a>
        <a class="${activeClass('contact')}" href="contact.html">Contact</a>
      </nav>
      <form class="search-form" onsubmit="return doSearch(event)">
        <input type="search" name="q" placeholder="Search products..." autocomplete="off"/>
        <button type="submit" aria-label="Search"><i class="fas fa-search"></i></button>
      </form>
      <div class="header-icons">
        <span data-auth="user"><a href="login.html" title="Login"><i class="fas fa-user"></i></a></span>
        <a href="wishlist.html" title="Wishlist"><i class="fas fa-heart"></i><span class="badge" data-badge="wish" style="display:none">0</span></a>
        <a href="cart.html" title="Cart"><i class="fas fa-shopping-cart"></i><span class="badge" data-badge="cart" style="display:none">0</span></a>
        <button class="hamburger" aria-label="Menu" onclick="document.getElementById('mobileMenu').classList.toggle('open')"><i class="fas fa-bars"></i></button>
      </div>
    </div>
    <div class="mobile-menu" id="mobileMenu">
      <form class="search-form" onsubmit="return doSearch(event)">
        <input type="search" name="q" placeholder="Search products..."/>
        <button type="submit"><i class="fas fa-search"></i></button>
      </form>
      <a href="index.html">Home</a>
      <a href="shop.html">Shop</a>
      <a href="about.html">About</a>
      <a href="contact.html">Contact</a>
      <a href="wishlist.html">Wishlist</a>
      <a href="cart.html">Cart</a>
      <a href="login.html">Login / Register</a>
    </div>
  </header>`;
  const holder = document.getElementById('siteHeader');
  if(holder) holder.outerHTML = html;
}

function renderFooter(){
  const html = `
  <footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div>
          <h4>bscollectionbd</h4>
          <p style="color:#9ca3af;font-size:14px;margin:0 0 10px">Bangladesh's trusted store for rechargeable fans and home electrical appliances.</p>
          <p style="color:#9ca3af;font-size:13px;margin:0"><i class="fas fa-phone"></i> +880 1XXX-XXXXXX</p>
          <p style="color:#9ca3af;font-size:13px;margin:4px 0 0"><i class="fas fa-envelope"></i> support@bscollectionbd.com</p>
        </div>
        <div>
          <h4>Shop</h4>
          <a href="shop.html">All Products</a>
          <a href="product-jy2218.html">JY-2218</a>
          <a href="product-jy2570.html">JY-2570</a>
          <a href="wishlist.html">Wishlist</a>
          <a href="cart.html">Cart</a>
        </div>
        <div>
          <h4>Help</h4>
          <a href="about.html">About Us</a>
          <a href="contact.html">Contact</a>
          <a href="shipping-policy.html">Shipping Policy</a>
          <a href="return-refund-policy.html">Return & Refund</a>
        </div>
        <div>
          <h4>Legal</h4>
          <a href="privacy-policy.html">Privacy Policy</a>
          <a href="terms-of-service.html">Terms of Service</a>
          <a href="login.html">Login</a>
          <a href="register.html">Register</a>
        </div>
      </div>
      <div class="footer-bottom">&copy; ${new Date().getFullYear()} bscollectionbd. All rights reserved.</div>
    </div>
  </footer>`;
  const holder = document.getElementById('siteFooter');
  if(holder) holder.outerHTML = html;
}

document.addEventListener('DOMContentLoaded', ()=>{
  renderHeader();
  renderFooter();
  updateBadges();
  refreshAuthUI();
});
