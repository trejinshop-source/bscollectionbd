/* ============================================================
   BS Collection BD — Shared Cart, Wishlist, Search & Checkout
   (localStorage based, English numbers, dynamic divisions/districts)
   ============================================================ */
(function(){
  const LSK   = 'bs_cart_v1';
  const WLKEY = 'bs_wish_v1';
  const UKEY  = 'bs_users_v1';
  const CURU  = 'bs_current_user_v1';
  const OKEY  = 'bs_orders_v1';

  /* ============ NUMBER FORMAT (always English digits) ============ */
  const fmt = n => 'Tk ' + Number(n||0).toLocaleString('en-US');
  const parsePrice = txt => {
    if(!txt) return 0;
    const s = String(txt).replace(/,/g,'')
      .replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d));
    const m = s.match(/(\d+(\.\d+)?)/);
    return m ? parseFloat(m[1]) : 0;
  };

  /* Convert any Bengali digits in DOM text to English (site-wide) */
  function bnToEn(str){ return String(str).replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d)); }
  function normalizeDigits(){
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    let node; const toFix = [];
    while(node = walker.nextNode()){
      if(/[০-৯]/.test(node.nodeValue)) toFix.push(node);
    }
    toFix.forEach(n => n.nodeValue = bnToEn(n.nodeValue));
  }

  /* ============ CART ============ */
  function getCart(){ try{ return JSON.parse(localStorage.getItem(LSK))||[]; }catch(e){ return []; } }
  function saveCart(c){ localStorage.setItem(LSK, JSON.stringify(c)); updateBadges(); }
  function clearCart(){ localStorage.removeItem(LSK); updateBadges(); }
  function cartCount(){ return getCart().reduce((s,i)=>s+i.qty,0); }
  function cartSubtotal(){ return getCart().reduce((s,i)=>s + i.price*i.qty, 0); }

  function addToCart(item){
    const cart = getCart();
    const idx = cart.findIndex(x => x.id === item.id);
    if(idx>-1) cart[idx].qty += item.qty||1;
    else cart.push({...item, qty: item.qty||1});
    saveCart(cart);
    toast('Added to cart — ' + item.name);
  }
  function setQty(id, qty){
    let cart = getCart();
    cart = cart.map(i => i.id===id ? {...i, qty: Math.max(1,qty)} : i);
    saveCart(cart); renderCartPage();
  }
  function removeItem(id){
    let cart = getCart().filter(i => i.id !== id);
    saveCart(cart); renderCartPage();
    toast('Item removed');
  }

  /* ============ WISHLIST ============ */
  function getWish(){ try{ return JSON.parse(localStorage.getItem(WLKEY))||[]; }catch(e){ return []; } }
  function saveWish(w){ localStorage.setItem(WLKEY, JSON.stringify(w)); updateBadges(); }
  function toggleWish(item){
    const w = getWish();
    const i = w.findIndex(x => x.id === item.id);
    if(i>-1){ w.splice(i,1); saveWish(w); toast('Removed from wishlist'); return false; }
    w.push(item); saveWish(w); toast('Added to wishlist — ' + item.name); return true;
  }
  function inWish(id){ return getWish().some(x => x.id === id); }

  /* ============ USERS / AUTH ============ */
  function getUsers(){ try{ return JSON.parse(localStorage.getItem(UKEY))||[]; }catch(e){ return []; } }
  function setUsers(u){ localStorage.setItem(UKEY, JSON.stringify(u)); }
  function getUser(){ try{ return JSON.parse(localStorage.getItem(CURU)); }catch(e){ return null; } }
  function setUser(u){ localStorage.setItem(CURU, JSON.stringify(u)); updateBadges(); }
  function logout(){ localStorage.removeItem(CURU); updateBadges(); toast('Logged out'); setTimeout(()=>location.href='index.html', 500); }

  /* ============ BADGES ============ */
  function updateBadges(){
    const c = cartCount(), w = getWish().length;
    document.querySelectorAll('#cartBadge').forEach(el => el.textContent = c);
    document.querySelectorAll('#wishlistBadge').forEach(el => el.textContent = w);
    const u = getUser();
    document.querySelectorAll('[data-user-name]').forEach(el => el.textContent = u ? u.name : 'Login');
  }

  /* ============ TOAST ============ */
  function toast(msg, type){
    let t = document.createElement('div');
    t.textContent = msg;
    const bg = type==='err' ? '#DC2626' : (type==='ok' ? '#16A34A' : '#14213D');
    Object.assign(t.style,{position:'fixed',bottom:'80px',left:'50%',transform:'translateX(-50%)',
      background:bg,color:'#fff',padding:'12px 24px',fontSize:'14px',fontWeight:'600',
      zIndex:'99999',boxShadow:'0 10px 30px rgba(0,0,0,.25)',opacity:'0',transition:'.3s',
      maxWidth:'90%',textAlign:'center',borderRadius:'8px',
      fontFamily:"'Poppins','Inter','Hind Siliguri',sans-serif"});
    document.body.appendChild(t);
    requestAnimationFrame(()=>{t.style.opacity='1';t.style.bottom='90px';});
    setTimeout(()=>{t.style.opacity='0';setTimeout(()=>t.remove(),300);},2000);
  }
  window.bsToast = toast;
  window.toast = window.toast || toast;

  /* ============ PRODUCT PAGE ROUTING ============ */
  /* Map product name -> product page. Others go to coming-soon. */
  const PRODUCT_PAGES = {
    'JYSUPER JY-2218 Rechargeable Fan': 'product-jy2218.html',
    'JY-2570 Rechargeable Fan': 'product-jy2570.html'
  };
  function productPageFor(name){
    if(!name) return 'coming-soon.html';
    const clean = String(name).replace(/["“”]/g,'').trim();
    for(const key in PRODUCT_PAGES){
      if(clean.toLowerCase().includes(key.toLowerCase())) return PRODUCT_PAGES[key];
    }
    return 'coming-soon.html?product=' + encodeURIComponent(clean);
  }
  window.productPageFor = productPageFor;

  /* ============ DELEGATED CLICKS on product cards ============ */
  function extractProduct(card){
    if(!card) return null;
    const nameEl = card.querySelector('h4, .cart-name, .product-info h4');
    const priceEl = card.querySelector('.p-price, .price .now, .now');
    const iconEl = card.querySelector('.p-img i, .product-img i');
    const imgEl = card.querySelector('.p-img img, .product-img img, img');
    const name = nameEl ? nameEl.childNodes[0].textContent.replace(/["“”]/g,'').trim() : 'Product';
    const price = parsePrice(priceEl ? priceEl.textContent : '0');
    const icon = iconEl ? iconEl.className : '';
    const img  = imgEl ? imgEl.getAttribute('src') : '';
    const id = 'p_' + btoa(unescape(encodeURIComponent(name))).replace(/=/g,'').slice(0,24);
    return { id, name, price, icon, img };
  }

  document.addEventListener('click', function(e){
    /* Add to cart button */
    const addBtn = e.target.closest('.p-add, .quick-add, .add-to-cart, [data-add-to-cart]');
    if(addBtn){
      e.preventDefault(); e.stopPropagation();
      const card = addBtn.closest('.product-card, .p-card, [data-product]');
      const p = extractProduct(card);
      if(!p){ toast('Could not add product', 'err'); return; }
      /* For products without a real page, still allow cart if price>0 */
      if(p.price>0){ addToCart(p); }
      else { toast('Product coming soon', 'err'); }
      return;
    }
    /* Wishlist button on product card */
    const wishBtn = e.target.closest('.product-actions button[aria-label="Wishlist"], .wish-btn, [data-wish]');
    if(wishBtn && !wishBtn.closest('.detail-actions')){
      e.preventDefault(); e.stopPropagation();
      const card = wishBtn.closest('.product-card, .p-card, [data-product]');
      const p = extractProduct(card);
      if(!p) return;
      const on = toggleWish(p);
      const icon = wishBtn.querySelector('i');
      if(icon){
        if(on){ icon.classList.remove('far'); icon.classList.add('fas'); icon.style.color='#FCA311'; }
        else { icon.classList.remove('fas'); icon.classList.add('far'); icon.style.color=''; }
      }
      return;
    }
    /* Quick view -> open product page */
    const viewBtn = e.target.closest('.product-actions button[aria-label="Quick view"], [data-quick-view]');
    if(viewBtn){
      e.preventDefault(); e.stopPropagation();
      const card = viewBtn.closest('.product-card, .p-card, [data-product]');
      const p = extractProduct(card);
      if(p) location.href = productPageFor(p.name);
      return;
    }
    /* Click on product image / title -> product page */
    const cardClick = e.target.closest('.product-card .product-img img, .product-card .product-info h4, .product-card .product-info .cat');
    if(cardClick){
      const card = cardClick.closest('.product-card');
      const p = extractProduct(card);
      if(p) location.href = productPageFor(p.name);
    }
  });

  /* Mark wishlist icons on load */
  function paintWishIcons(){
    document.querySelectorAll('.product-card').forEach(card => {
      const p = extractProduct(card); if(!p) return;
      const btn = card.querySelector('.product-actions button[aria-label="Wishlist"], .wish-btn');
      if(!btn) return;
      const i = btn.querySelector('i');
      if(inWish(p.id) && i){ i.classList.remove('far'); i.classList.add('fas'); i.style.color='#FCA311'; }
    });
  }

  /* ============ SEARCH (global override) ============ */
  window.doSearch = function(){
    const el = document.getElementById('searchInput');
    if(!el){ return; }
    const q = el.value.trim();
    if(!q){ toast('Please enter a search term','err'); return; }
    location.href = 'shop.html?q=' + encodeURIComponent(q);
  };
  function wireSearchEnter(){
    const el = document.getElementById('searchInput');
    if(el){ el.addEventListener('keypress', e => { if(e.key==='Enter'){ e.preventDefault(); window.doSearch(); } }); }
  }

  /* ============ DIVISIONS & DISTRICTS ============ */
  const DIVISIONS = {
    "Dhaka": ["Dhaka","Faridpur","Gazipur","Gopalganj","Kishoreganj","Madaripur","Manikganj","Munshiganj","Narayanganj","Narsingdi","Rajbari","Shariatpur","Tangail"],
    "Chattogram": ["Bandarban","Brahmanbaria","Chandpur","Chattogram","Cumilla","Cox's Bazar","Feni","Khagrachari","Lakshmipur","Noakhali","Rangamati"],
    "Rajshahi": ["Bogura","Chapainawabganj","Joypurhat","Naogaon","Natore","Pabna","Rajshahi","Sirajganj"],
    "Khulna": ["Bagerhat","Chuadanga","Jashore","Jhenaidah","Khulna","Kushtia","Magura","Meherpur","Narail","Satkhira"],
    "Barishal": ["Barguna","Barishal","Bhola","Jhalokati","Patuakhali","Pirojpur"],
    "Sylhet": ["Habiganj","Moulvibazar","Sunamganj","Sylhet"],
    "Rangpur": ["Dinajpur","Gaibandha","Kurigram","Lalmonirhat","Nilphamari","Panchagarh","Rangpur","Thakurgaon"],
    "Mymensingh": ["Jamalpur","Mymensingh","Netrokona","Sherpur"]
  };

  function deliveryCharge(division, district){
    if(!division) return 0;
    if(division === 'Dhaka' && district === 'Dhaka') return 70;
    return 130;
  }

  /* ============ CART PAGE ============ */
  function renderCartPage(){
    const wrap = document.getElementById('cartItemsWrap');
    if(!wrap) return;
    const cart = getCart();
    const empty = document.getElementById('cartEmpty');
    const layout = document.getElementById('cartLayout');
    if(cart.length===0){
      if(empty) empty.style.display='block';
      if(layout) layout.style.display='none';
      updateBadges();
      return;
    }
    if(empty) empty.style.display='none';
    if(layout) layout.style.display='';

    wrap.innerHTML = cart.map(i => {
      const thumb = i.img ? `<img src="${i.img}" alt="" style="width:100%;height:100%;object-fit:cover"/>`
                          : `<i class="fas ${i.icon||'fa-box'}"></i>`;
      return `<div class="cart-row" data-id="${i.id}">
        <div class="cart-thumb">${thumb}</div>
        <div><div class="cart-name">${i.name}<small>Unit: ${fmt(i.price)}</small></div></div>
        <div class="qty">
          <button data-act="dec">−</button>
          <span>${i.qty}</span>
          <button data-act="inc">+</button>
        </div>
        <div class="cart-price">${fmt(i.price*i.qty)}</div>
        <button class="cart-remove" data-act="rm" aria-label="Remove"><i class="fas fa-times"></i></button>
      </div>`;
    }).join('');

    wrap.querySelectorAll('.cart-row').forEach(row=>{
      const id = row.dataset.id;
      row.querySelectorAll('[data-act]').forEach(b=>{
        b.addEventListener('click', ()=>{
          const cur = getCart().find(x=>x.id===id);
          if(!cur) return;
          if(b.dataset.act==='inc') setQty(id, cur.qty+1);
          else if(b.dataset.act==='dec') setQty(id, cur.qty-1);
          else if(b.dataset.act==='rm') removeItem(id);
        });
      });
    });

    const sub = cartSubtotal();
    /* Default shipping preview on cart page = Inside Dhaka rate (real charge set at checkout) */
    const ship = sub > 0 ? 70 : 0;
    const total = sub + ship;
    const set = (id,v)=>{ const el=document.getElementById(id); if(el) el.innerHTML = v; };
    set('sumCount', cart.length + ' items');
    set('sumSubtotal', fmt(sub));
    set('sumShipping', ship===0 ? '<span style="color:#16a34a;font-weight:700">FREE</span>' : fmt(ship) + ' (from)');
    set('sumTotal', fmt(total));
    updateBadges();
  }

  /* ============ CHECKOUT PAGE (dynamic form) ============ */
  function renderCheckoutPage(){
    const box = document.getElementById('checkoutBox');
    if(!box) return;
    const cart = getCart();
    if(cart.length===0){
      box.innerHTML = `<div style="text-align:center;padding:60px 20px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.06)">
          <i class="fas fa-shopping-bag" style="font-size:48px;color:#cbd5e1;margin-bottom:14px"></i>
          <h3 style="color:#14213D;margin-bottom:8px">Your cart is empty</h3>
          <p style="color:#64748B;margin-bottom:18px">Please add at least one product to place an order.</p>
          <a href="shop.html" class="btn btn-primary"><i class="fas fa-store"></i> Go to Shop</a>
        </div>`;
      return;
    }

    /* Rebuild the checkout layout with only the fields we need */
    const divOpts = Object.keys(DIVISIONS).map(d => `<option value="${d}">${d}</option>`).join('');
    box.innerHTML = `
      <div style="background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.06);padding:28px">
        <h3 style="color:#14213D;font-size:20px;margin-bottom:6px;font-weight:800">Billing &amp; Shipping</h3>
        <p style="color:#64748B;font-size:13px;margin-bottom:18px">Please fill in the details below to complete your order.</p>
        <form id="checkoutForm" novalidate>
          <div class="field" style="margin-bottom:14px">
            <label style="display:block;font-size:13px;font-weight:600;color:#14213D;margin-bottom:6px">Name *</label>
            <input name="name" required placeholder="Full name" style="width:100%;padding:11px 14px;border:1px solid #e2e8f0;font-family:inherit;font-size:14px;outline:none"/>
          </div>
          <div class="field" style="margin-bottom:14px">
            <label style="display:block;font-size:13px;font-weight:600;color:#14213D;margin-bottom:6px">Phone Number *</label>
            <input name="phone" required pattern="[0-9+\\- ]{7,}" placeholder="01XXXXXXXXX" style="width:100%;padding:11px 14px;border:1px solid #e2e8f0;font-family:inherit;font-size:14px;outline:none"/>
          </div>
          <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            <div class="field" style="margin-bottom:14px">
              <label style="display:block;font-size:13px;font-weight:600;color:#14213D;margin-bottom:6px">Division *</label>
              <select name="division" id="divisionSel" required style="width:100%;padding:11px 14px;border:1px solid #e2e8f0;font-family:inherit;font-size:14px;outline:none;background:#fff">
                <option value="">-- Select Division --</option>
                ${divOpts}
              </select>
            </div>
            <div class="field" style="margin-bottom:14px">
              <label style="display:block;font-size:13px;font-weight:600;color:#14213D;margin-bottom:6px">District *</label>
              <select name="district" id="districtSel" required disabled style="width:100%;padding:11px 14px;border:1px solid #e2e8f0;font-family:inherit;font-size:14px;outline:none;background:#fff">
                <option value="">-- Select Division first --</option>
              </select>
            </div>
          </div>
          <div class="field" style="margin-bottom:14px">
            <label style="display:block;font-size:13px;font-weight:600;color:#14213D;margin-bottom:6px">Address *</label>
            <textarea name="address" required placeholder="House, Road, Area" rows="2" style="width:100%;padding:11px 14px;border:1px solid #e2e8f0;font-family:inherit;font-size:14px;outline:none;resize:vertical"></textarea>
          </div>

          <h3 style="color:#14213D;font-size:17px;margin:14px 0 10px;padding-bottom:6px;border-bottom:2px solid #FCA311">Payment Method</h3>
          <div style="display:grid;gap:10px">
            <label style="display:flex;gap:10px;align-items:center;padding:12px;border:1px solid #e2e8f0;background:#F5F7FA;cursor:pointer"><input type="radio" name="payment" value="Cash on Delivery" required checked/> <i class="fas fa-truck" style="color:#FCA311"></i> Cash on Delivery (COD)</label>
            <label style="display:flex;gap:10px;align-items:center;padding:12px;border:1px solid #e2e8f0;background:#F5F7FA;cursor:pointer"><input type="radio" name="payment" value="bKash"/> <i class="fas fa-mobile-alt" style="color:#e2136e"></i> bKash</label>
            <label style="display:flex;gap:10px;align-items:center;padding:12px;border:1px solid #e2e8f0;background:#F5F7FA;cursor:pointer"><input type="radio" name="payment" value="Nagad"/> <i class="fas fa-wallet" style="color:#ef4444"></i> Nagad</label>
            <label style="display:flex;gap:10px;align-items:center;padding:12px;border:1px solid #e2e8f0;background:#F5F7FA;cursor:pointer"><input type="radio" name="payment" value="Bank Transfer"/> <i class="fas fa-university" style="color:#14213D"></i> Bank Transfer</label>
          </div>

          <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;margin-top:20px;padding:16px;background:#14213D;color:#fff;font-weight:700;border:none;cursor:pointer;font-size:15px"><i class="fas fa-check-circle"></i> Place Order</button>
          <p style="text-align:center;color:#64748B;font-size:12px;margin-top:12px"><i class="fas fa-shield-alt" style="color:#FCA311"></i> Your information is fully secure.</p>
        </form>
      </div>

      <aside class="summary" style="background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.06);padding:28px;align-self:flex-start">
        <h3 style="color:#14213D;font-size:18px;margin-bottom:14px">Order Summary</h3>
        <div id="checkoutSummaryItems" style="margin-bottom:12px"></div>
        <div class="sum-row" style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px"><span>Subtotal</span><span id="coSubtotal">Tk 0</span></div>
        <div class="sum-row" style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px"><span>Delivery Charge</span><span id="coShipping">—</span></div>
        <div class="sum-row total" style="display:flex;justify-content:space-between;padding:12px 0;margin-top:8px;border-top:1px dashed #e2e8f0;font-weight:800;font-size:18px;color:#14213D"><span>Total</span><span id="coTotal" style="color:#FCA311">Tk 0</span></div>
        <p style="font-size:12px;color:#64748B;margin-top:12px"><i class="fas fa-info-circle" style="color:#FCA311"></i> Inside Dhaka: Tk 70 · Outside Dhaka: Tk 130</p>
      </aside>`;

    /* Items */
    const wrap = document.getElementById('checkoutSummaryItems');
    wrap.innerHTML = cart.map(i=>`
      <div style="display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px dashed #eef1f5;font-size:13px">
        <span style="flex:1">${i.name} <b style="color:#64748B">×${i.qty}</b></span>
        <span style="font-weight:700;color:#14213D">${fmt(i.price*i.qty)}</span>
      </div>`).join('');

    const sub = cartSubtotal();
    let ship = 0, total = sub;
    const set = (id,v)=>{ const el=document.getElementById(id); if(el) el.innerHTML=v; };
    set('coSubtotal', fmt(sub));
    set('coShipping', '<span style="color:#64748B">Select division</span>');
    set('coTotal', fmt(sub));

    const divSel = document.getElementById('divisionSel');
    const distSel = document.getElementById('districtSel');
    function updateDistricts(){
      const d = divSel.value;
      distSel.innerHTML = '<option value="">-- Select District --</option>';
      if(d && DIVISIONS[d]){
        DIVISIONS[d].forEach(x => {
          const o = document.createElement('option'); o.value = x; o.textContent = x;
          distSel.appendChild(o);
        });
        distSel.disabled = false;
      } else {
        distSel.disabled = true;
        distSel.innerHTML = '<option value="">-- Select Division first --</option>';
      }
      updateShip();
    }
    function updateShip(){
      ship = deliveryCharge(divSel.value, distSel.value);
      total = sub + ship;
      set('coShipping', ship ? fmt(ship) : '<span style="color:#64748B">Select division</span>');
      set('coTotal', fmt(total));
    }
    divSel.addEventListener('change', updateDistricts);
    distSel.addEventListener('change', updateShip);

    /* Prefill from logged-in user */
    const u = getUser();
    if(u){
      const nEl = document.querySelector('input[name="name"]');
      const pEl = document.querySelector('input[name="phone"]');
      if(nEl && u.name) nEl.value = u.name;
      if(pEl && u.phone) pEl.value = u.phone;
    }

    const form = document.getElementById('checkoutForm');
    form.addEventListener('submit', function(e){
      e.preventDefault();
      const fd = new FormData(form);
      if(!fd.get('division') || !fd.get('district')){ toast('Please select division and district','err'); return; }
      ship = deliveryCharge(fd.get('division'), fd.get('district'));
      total = sub + ship;
      const order = {
        id: 'BSC' + Date.now().toString().slice(-8),
        date: new Date().toISOString(),
        customer: {
          name: fd.get('name'), phone: fd.get('phone'),
          division: fd.get('division'), district: fd.get('district'),
          address: fd.get('address')
        },
        payment: fd.get('payment'),
        items: getCart(),
        subtotal: sub, shipping: ship, total: total
      };
      try{
        const list = JSON.parse(localStorage.getItem(OKEY)||'[]');
        list.unshift(order);
        localStorage.setItem(OKEY, JSON.stringify(list.slice(0,50)));
        localStorage.setItem('bs_last_order', JSON.stringify(order));
      }catch(err){}
      clearCart();
      window.location.href = 'order-success.html?id=' + encodeURIComponent(order.id);
    });
  }

  /* ============ ORDER SUCCESS ============ */
  function renderOrderSuccess(){
    const wrap = document.getElementById('orderSuccessBox');
    if(!wrap) return;
    let order = null;
    try{ order = JSON.parse(localStorage.getItem('bs_last_order')); }catch(e){}
    if(!order){
      wrap.innerHTML = `<div style="text-align:center;padding:60px 20px">
        <h2 style="color:#14213D">No recent order found</h2>
        <p style="color:#64748B;margin:10px 0 20px">Would you like to shop first?</p>
        <a href="shop.html" class="btn btn-primary">Go to Shop</a>
      </div>`;
      return;
    }
    const c = order.customer;
    wrap.innerHTML = `
      <div style="text-align:center;margin-bottom:26px">
        <div style="width:80px;height:80px;background:#dcfce7;color:#16a34a;display:inline-flex;align-items:center;justify-content:center;font-size:38px;margin-bottom:14px;border-radius:50%">
          <i class="fas fa-check"></i>
        </div>
        <h2 style="color:#14213D;font-size:26px;margin-bottom:6px">Thank you, ${c.name}!</h2>
        <p style="color:#64748B">Your order has been received. Our representative will contact you soon.</p>
      </div>
      <div style="background:#F5F7FA;padding:18px;margin-bottom:22px">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px">
          <div><b style="color:#14213D">Order ID:</b> <span style="color:#FCA311;font-weight:700">${order.id}</span></div>
          <div><b style="color:#14213D">Date:</b> ${new Date(order.date).toLocaleString('en-GB')}</div>
          <div><b style="color:#14213D">Payment:</b> ${order.payment}</div>
        </div>
      </div>
      <h3 style="color:#14213D;margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid #FCA311">Order Items</h3>
      ${order.items.map(i=>`<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px dashed #eef1f5">
        <span>${i.name} <b style="color:#64748B">×${i.qty}</b></span>
        <span style="font-weight:700;color:#14213D">${fmt(i.price*i.qty)}</span>
      </div>`).join('')}
      <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:14px;color:#374151"><span>Subtotal</span><span>${fmt(order.subtotal)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:14px;color:#374151"><span>Delivery Charge</span><span>${fmt(order.shipping)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:12px 0;border-top:1px dashed #e2e8f0;margin-top:6px;font-size:19px;font-weight:800;color:#14213D"><span>Total</span><span style="color:#FCA311">${fmt(order.total)}</span></div>
      <h3 style="color:#14213D;margin:22px 0 10px;padding-bottom:8px;border-bottom:2px solid #FCA311">Delivery Info</h3>
      <p style="font-size:14px;line-height:1.9"><b>${c.name}</b> · ${c.phone}<br/>${c.address}, ${c.district}, ${c.division}</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:24px;justify-content:center">
        <a href="shop.html" class="btn btn-primary"><i class="fas fa-store"></i> Continue Shopping</a>
        <button class="btn btn-outline" onclick="window.print()"><i class="fas fa-print"></i> Print Receipt</button>
      </div>`;
  }

  /* ============ WISHLIST PAGE ============ */
  function renderWishlistPage(){
    const box = document.getElementById('wishlistBox');
    if(!box) return;
    const items = getWish();
    if(items.length===0){
      box.innerHTML = `<div style="text-align:center;padding:60px 20px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.06)">
        <i class="far fa-heart" style="font-size:48px;color:#cbd5e1;margin-bottom:14px"></i>
        <h3 style="color:#14213D;margin-bottom:8px">Your wishlist is empty</h3>
        <p style="color:#64748B;margin-bottom:18px">Save your favorite products to see them here.</p>
        <a href="shop.html" class="btn btn-primary"><i class="fas fa-store"></i> Browse Shop</a>
      </div>`;
      return;
    }
    box.innerHTML = `<div class="product-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:22px">` +
      items.map(p => `
        <div class="product-card" data-product style="background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.06);overflow:hidden;display:flex;flex-direction:column">
          <div class="product-img" style="position:relative;background:#F8FAFC;aspect-ratio:1;overflow:hidden">
            <img loading="lazy" src="${p.img}" alt="${p.name}" style="width:100%;height:100%;object-fit:contain;padding:12px;cursor:pointer"/>
            <button class="quick-add" style="position:absolute;bottom:10px;left:10px;right:10px;background:#14213D;color:#fff;padding:8px;border:none;font-weight:600;cursor:pointer"><i class="fas fa-shopping-cart"></i> Add to Cart</button>
          </div>
          <div class="product-info" style="padding:14px;display:flex;flex-direction:column;flex:1">
            <h4 style="font-size:14px;color:#14213D;margin-bottom:8px;cursor:pointer">${p.name}</h4>
            <div class="price"><span class="now" style="color:#14213D;font-weight:800;font-size:16px">${fmt(p.price)}</span></div>
            <button data-remove-wish="${p.id}" style="margin-top:8px;background:#fff;color:#DC2626;border:1px solid #DC2626;padding:6px;cursor:pointer;font-weight:600"><i class="fas fa-trash"></i> Remove</button>
          </div>
        </div>`).join('') +
      `</div>`;
    box.querySelectorAll('[data-remove-wish]').forEach(b => {
      b.addEventListener('click', e => {
        e.stopPropagation();
        const id = b.dataset.removeWish;
        const w = getWish().filter(x => x.id !== id);
        saveWish(w); renderWishlistPage();
        toast('Removed from wishlist');
      });
    });
  }

  /* ============ SHOP SEARCH from URL ?q= ============ */
  function applyShopSearch(){
    const grid = document.getElementById('featuredGrid') || document.getElementById('shopGrid');
    if(!grid) return;
    const params = new URLSearchParams(location.search);
    const q = (params.get('q')||'').trim().toLowerCase();
    if(!q) return;
    /* Wait a tick for inline script to render products, then filter */
    setTimeout(()=>{
      const cards = grid.querySelectorAll('.product-card');
      let shown = 0;
      cards.forEach(c => {
        const name = (c.querySelector('h4')?.textContent || '').toLowerCase();
        const cat = (c.querySelector('.cat')?.textContent || '').toLowerCase();
        const match = name.includes(q) || cat.includes(q);
        c.style.display = match ? '' : 'none';
        if(match) shown++;
      });
      if(shown === 0) toast('No products found for: ' + q, 'err');
      else toast(shown + ' product(s) found');
      /* Add banner */
      if(!document.getElementById('searchBanner')){
        const banner = document.createElement('div');
        banner.id = 'searchBanner';
        banner.innerHTML = `<div style="max-width:1200px;margin:20px auto;padding:12px 20px;background:#FFF7EC;border-left:4px solid #FCA311;font-size:14px">
          Search results for "<b>${q}</b>" — <a href="shop.html" style="color:#14213D;font-weight:700">Clear</a></div>`;
        grid.parentNode.insertBefore(banner, grid);
      }
    }, 100);
  }



  /* ============ INIT ============ */
  function init(){
    fixHeaderLayout();
    normalizeDigits();
    updateBadges();
    wireSearchEnter();
    paintWishIcons();
    renderCartPage();
    renderCheckoutPage();
    renderOrderSuccess();
    renderWishlistPage();
    applyShopSearch();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  /* Public API */
  window.BSCart = { addToCart, getCart, clearCart, cartCount, cartSubtotal,
                    getWish, toggleWish, inWish,
                    getUsers, setUsers, getUser, setUser, logout,
                    productPageFor, DIVISIONS, deliveryCharge, fmt };
})();
