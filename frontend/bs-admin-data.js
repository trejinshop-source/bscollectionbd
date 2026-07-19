/*!
 * bs-admin-data.js
 * ------------------------------------------------------------------
 * শেয়ার্ড ডেটা লেয়ার — index.html, shop.html, product-jy2218.html,
 * product-jy2570.html এবং admin_panel/admin.html সবাই এই একটি ফাইল
 * ব্যবহার করে ব্যাকএন্ড (MongoDB) থেকে প্রোডাক্ট/ক্যাটাগরি/অর্ডার
 * ডেটা আনা-নেওয়া করে।
 *
 * কীভাবে কাজ করে:
 *  - পেজ লোড হওয়ার সাথে সাথে ব্যাকএন্ড API থেকে ডেটা ফেচ করা হয়।
 *  - ব্যাকএন্ড থেকে উত্তর না আসা পর্যন্ত (বা ইন্টারনেট/সার্ভার ডাউন
 *    থাকলে) সাইট যেন ভেঙে না পড়ে, তাই কিছু ডিফল্ট ফলব্যাক ডেটা
 *    সাথে সাথেই সিঙ্ক্রোনাসভাবে রিটার্ন করা হয়।
 *  - আসল ডেটা এলে "bsdata:ready" ইভেন্ট ফায়ার হয় — পেজগুলো এই
 *    ইভেন্ট শুনে (listen করে) নিজেদের UI রিফ্রেশ করে নেয়।
 * ------------------------------------------------------------------
 */
(function (window) {
  "use strict";

  // ================= CONFIG =================
  // লোকাল হলে লোকাল ব্যাকএন্ড, লাইভ সাইটে হলে প্রোডাকশন ব্যাকএন্ড ব্যবহার হবে।
  // ডিপ্লয়ের পর নিচের PROD URL-টা নিজের Render/Railway ব্যাকএন্ড URL দিয়ে বদলে দিন।
  const PROD_API_BASE = "https://bscollectionbd.onrender.com/api";
  const LOCAL_API_BASE = "http://localhost:5000/api";

  const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const API_BASE = isLocal ? LOCAL_API_BASE : PROD_API_BASE;

  // ================= FALLBACK DATA (backend থেকে ডেটা না এলে ব্যবহৃত হবে) =================
  const FALLBACK_CATEGORIES = [
    { id: "c1", name: "Ceiling Fans", slug: "ceiling-fans", count: 0, img: "https://5.imimg.com/data5/TI/ES/TB/SELLER-93582485/bldc-ceiling-fan.jpg" },
    { id: "c2", name: "Table Fans", slug: "table-fans", count: 2, img: "assets/photo_2026-07-15_18-28-56.png" },
    { id: "c3", name: "Stand Fans", slug: "stand-fans", count: 0, img: "https://m.media-amazon.com/images/I/71X-Pth5ULS.jpg" },
    { id: "c4", name: "Industrial Fans", slug: "industrial-fans", count: 0, img: "" },
    { id: "c5", name: "Exhaust Fans", slug: "exhaust-fans", count: 0, img: "" },
    { id: "c6", name: "Rechargeable Fans", slug: "rechargeable-fans", count: 0, img: "assets/photo_2026-07-15_18-29-17.png" },
    { id: "c7", name: "LED Lights", slug: "led-lights", count: 0, img: "" },
    { id: "c8", name: "Home Appliances", slug: "home-appliances", count: 0, img: "" },
    { id: "c9", name: "Wall Fans", slug: "wall-fans", count: 0, img: "" },
    { id: "c10", name: "Accessories", slug: "accessories", count: 0, img: "" },
  ];

  const FALLBACK_PRODUCTS = [
    {
      id: 101, sku: "jy2570", cat: "Table Fan", categorySlug: "table-fans",
      name: "JY-2570 Rechargeable Fan", brand: "bscollectionbd", rating: 5,
      now: 2150, old: 2550, stock: 10, featured: true,
      img: "assets/photo_2026-07-15_18-29-17.png",
      gallery: ["assets/photo_2026-07-15_18-29-17.png"],
      description: "JY-2570 Rechargeable Fan-এ পাবেন শক্তিশালী বাতাসের সাথে আধুনিক সুবিধা।",
      detailPage: "product-jy2570.html",
    },
    {
      id: 102, sku: "jy2218", cat: "Table Fan", categorySlug: "table-fans",
      name: "JYSUPER JY-2218 Rechargeable Fan", brand: "bscollectionbd", rating: 4,
      now: 999, old: 1200, stock: 10, featured: true,
      img: "assets/photo_2026-07-15_18-28-56.png",
      gallery: ["assets/photo_2026-07-15_18-28-56.png", "assets/jy2218-grey.png"],
      description: "JYSUPER JY-2218 Rechargeable Fan-এ পাবেন শক্তিশালী বাতাসের সাথে আধুনিক সুবিধা।",
      detailPage: "product-jy2218.html",
    },
  ];

  // ================= STATE =================
  let _products = loadCache("bs_products_cache", FALLBACK_PRODUCTS);
  let _categories = loadCache("bs_categories_cache", FALLBACK_CATEGORIES);
  let _ready = false;

  function loadCache(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function saveCache(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* localStorage full/unavailable — ignore, in-memory cache still works */
    }
  }

  function fire(eventName, detail) {
    document.dispatchEvent(new CustomEvent(eventName, { detail }));
  }

  async function refresh() {
    try {
      const [prodRes, catRes] = await Promise.all([
        fetch(API_BASE + "/products"),
        fetch(API_BASE + "/categories"),
      ]);
      if (prodRes.ok) {
        _products = await prodRes.json();
        saveCache("bs_products_cache", _products);
      }
      if (catRes.ok) {
        _categories = await catRes.json();
        saveCache("bs_categories_cache", _categories);
      }
      _ready = true;
      fire("bsdata:ready", { products: _products, categories: _categories });
    } catch (err) {
      // ব্যাকএন্ড আনরিচেবল হলে fallback/cache ডেটাই থেকে যাবে, সাইট ভাঙবে না
      console.warn("bs-admin-data: backend unreachable, using cached/fallback data.", err.message);
      fire("bsdata:offline", { error: err.message });
    }
  }

  // ================= PUBLIC API =================
  const BSAdmin = {
    API_BASE,

    // --- সিঙ্ক্রোনাস গেটার (তাৎক্ষণিক রেন্ডারের জন্য; পরে bsdata:ready ইভেন্টে আপডেট হয়) ---
    getProducts() {
      return _products;
    },
    getCategories() {
      return _categories;
    },
    getProductBySku(sku) {
      return _products.find((p) => p.sku === sku) || null;
    },
    isReady() {
      return _ready;
    },

    // --- অ্যাডমিন প্যানেলের জন্য: লগইন / টোকেন ---
    async login(username, password) {
      const res = await fetch(API_BASE + "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "লগইন ব্যর্থ হয়েছে");
      localStorage.setItem("bs_admin_token", data.token);
      return data;
    },
    logout() {
      localStorage.removeItem("bs_admin_token");
    },
    getToken() {
      return localStorage.getItem("bs_admin_token");
    },
    authHeaders() {
      const token = this.getToken();
      return token ? { Authorization: "Bearer " + token } : {};
    },

    // --- CRUD: Products (অ্যাডমিন প্যানেল থেকে ব্যবহৃত হয়) ---
    async createProduct(product) {
      const res = await fetch(API_BASE + "/products", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...this.authHeaders() },
        body: JSON.stringify(product),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "পণ্য যোগ করা যায়নি");
      await refresh();
      return data;
    },
    async updateProduct(id, product) {
      const res = await fetch(API_BASE + "/products/id/" + id, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...this.authHeaders() },
        body: JSON.stringify(product),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "পণ্য আপডেট করা যায়নি");
      await refresh();
      return data;
    },
    async deleteProduct(id) {
      const res = await fetch(API_BASE + "/products/id/" + id, {
        method: "DELETE",
        headers: this.authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "পণ্য মুছে ফেলা যায়নি");
      await refresh();
      return data;
    },
    async uploadImage(file) {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch(API_BASE + "/products/upload", {
        method: "POST",
        headers: this.authHeaders(),
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ছবি আপলোড ব্যর্থ হয়েছে");
      return data.url;
    },

    // --- CRUD: Categories ---
    async createCategory(cat) {
      const res = await fetch(API_BASE + "/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...this.authHeaders() },
        body: JSON.stringify(cat),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ক্যাটাগরি যোগ করা যায়নি");
      await refresh();
      return data;
    },
    async updateCategory(id, cat) {
      const res = await fetch(API_BASE + "/categories/" + id, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...this.authHeaders() },
        body: JSON.stringify(cat),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ক্যাটাগরি আপডেট করা যায়নি");
      await refresh();
      return data;
    },
    async deleteCategory(id) {
      const res = await fetch(API_BASE + "/categories/" + id, {
        method: "DELETE",
        headers: this.authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ক্যাটাগরি মুছে ফেলা যায়নি");
      await refresh();
      return data;
    },

    // --- Orders ---
    async addOrder(order) {
      try {
        const res = await fetch(API_BASE + "/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(order),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "অর্ডার সাবমিট ব্যর্থ হয়েছে");
        return data;
      } catch (err) {
        // অফলাইন/ব্যর্থ হলেও localStorage-এ রেখে দিন যাতে অর্ডারটি হারিয়ে না যায়
        console.warn("addOrder: backend failed, saving locally.", err.message);
        const pending = loadCache("bs_pending_orders", []);
        pending.push({ ...order, _pendingSince: new Date().toISOString() });
        saveCache("bs_pending_orders", pending);
        throw err;
      }
    },
    async getOrders() {
      const res = await fetch(API_BASE + "/orders", { headers: this.authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "অর্ডার লোড করা যায়নি");
      return data;
    },
    async updateOrderStatus(id, status) {
      const res = await fetch(API_BASE + "/orders/" + id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...this.authHeaders() },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "অর্ডার স্ট্যাটাস আপডেট ব্যর্থ হয়েছে");
      return data;
    },

    refresh, // manual re-fetch, exposed for admin.html after edits elsewhere
  };

  window.BSAdmin = BSAdmin;

  // পেজ লোড হওয়ার সাথে সাথেই ব্যাকগ্রাউন্ডে আসল ডেটা আনা শুরু হয়
  refresh();
})(window);
