/*
 * BS Collection BD — Express Backend — FULL UPDATE
 * Adds: ContactMessage model + routes, filter-tabs, seed route,
 *       customer profile/orders, about page settings, all previous features.
 */
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const https = require("https");

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Cloudinary ───────────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",").map(s => s.trim()).filter(Boolean);
app.use(cors({
  // F1 fix: landing pages might be hosted on any domain (custom domain,
  // vercel preview, netlify, GitHub Pages, etc). If the explicit list does
  // not match, still allow *.vercel.app / *.netlify.app / *.pages.dev /
  // *.onrender.com / *.lovable.app / *.github.io and localhost so that
  // orders always reach the admin panel. credentials:false lets us safely
  // reflect any origin without wildcard/credential clash.
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    try {
      if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) return cb(null, true);
      const host = new URL(origin).hostname;
      const okHost = /(^|\.)(vercel\.app|netlify\.app|pages\.dev|onrender\.com|lovable\.app|github\.io|bscollectionbd\.com)$/i.test(host)
        || /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(host);
      if (okHost) return cb(null, true);
    } catch (_) {}
    // last-resort: allow (log for review) instead of blocking a real customer order
    console.warn("CORS: allowing unlisted origin →", origin);
    cb(null, true);
  },
  credentials: false,
}));
app.use(express.json({ limit: "5mb" }));

// ─── MongoDB ──────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log("✅ MongoDB connected");
    // স্টার্টআপে অটো-সিড: প্রতিটি ক্যাটাগরিতে ডিফল্ট ৫টি করে পণ্য নিশ্চিত করে
    try {
      const r = await runSeed();
      if (r.categories || r.products) console.log(`🌱 Auto-seed: +${r.categories} categories, +${r.products} products`);
    } catch (e) { console.error("Auto-seed error:", e.message); }
  })
  .catch(err => console.error("MongoDB error:", err.message));

// ─── Schemas ──────────────────────────────────────────────────────────────────
const ProductSchema = new mongoose.Schema({
  sku: { type: String, unique: true, sparse: true },
  name: { type: String, required: true },
  cat: String,
  categorySlug: String,
  brand: { type: String, default: "bscollectionbd" },
  now: { type: Number, required: true },
  old: Number,
  stock: { type: Number, default: 0 },
  featured: { type: Boolean, default: false },
  img: String,
  gallery: [String],
  description: String,
  shortDescription: String,
  detailPage: String,
  hasDetailPage: { type: Boolean, default: false },
  rating: { type: Number, default: 0 },
  tags: [String],
  // SEO
  seoTitle: String,
  seoDescription: String,
  seoKeywords: String,
  specs: [{ label: String, value: String }],
  features: [String],
  colors: [String],
  sizes: [String],
  weight: String,
  // Mixed টাইপ ব্যবহার করা হয়েছে যাতে "শপ পেজ", "হোম — ফিচার্ড পণ্য" (homeProduct)
  // ছাড়াও অ্যাডমিন প্যানেলের "Filter Tabs" থেকে ডাইনামিকভাবে যোগ করা যেকোনো
  // কাস্টম ট্যাব-কী (placements.<filterKey>) নিরাপদে সেভ/আপডেট হয় — আগে এখানে
  // ফিক্সড কয়েকটি ফিল্ড ছাড়া বাকি সব কী সাইলেন্টলি বাদ পড়ে যেত।
  placements: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({ shop: true, homeProduct: false, homePopular: false, homeBestseller: false, homeNew: false }),
  },
}, { timestamps: true });

const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, unique: true, required: true },
  img: String,
  count: { type: Number, default: 0 },
}, { timestamps: true });

const OrderSchema = new mongoose.Schema({
  orderId: String,
  customer: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    address: String,
    email: String,
    division: String,
    district: String,
    upazila: String,
    union: String,
    area: String,
  },
  items: [{
    productId: String,
    sku: String,
    name: String,
    price: Number,
    qty: { type: Number, default: 1 },
    img: String,
    color: String,
    size: String,
    weight: String,
  }],
  subtotal: Number,
  deliveryCharge: { type: Number, default: 70 },
  deliveryFee: Number,
  total: Number,
  paymentMethod: { type: String, default: "COD" },
  source: String,
  status: {
    type: String,
    enum: ["Pending", "Verified", "Processing", "Shipped", "Completed", "Cancelled", "Fake"],
    default: "Pending",
  },
  note: String,
  meta: {
    ip: String,
    userAgent: String,
    referer: String,
    duplicateCount: { type: Number, default: 0 },
  },
  userId: { type: String, index: true },
  fakeScore: { type: Number, default: 0 },
  fakeReasons: [String],
  isFake: { type: Boolean, default: false },
}, { timestamps: true });

OrderSchema.pre("save", async function (next) {
  if (!this.orderId) {
    const count = await mongoose.model("Order").countDocuments();
    this.orderId = "BS-" + String(count + 1001).padStart(5, "0");
  }
  // normalize deliveryCharge
  if (!this.deliveryCharge && this.deliveryFee) this.deliveryCharge = this.deliveryFee;
  next();
});

const ReviewSchema = new mongoose.Schema({
  productId: { type: String, required: true, index: true },
  productName: String,
  user: { type: String, required: true },
  email: String,
  userId: String,
  type: { type: String, enum: ["review", "question"], default: "review" },
  text: { type: String, required: true },
  rating: { type: Number, min: 1, max: 5, default: 5 },
  visible: { type: Boolean, default: true },
  reply: String,
}, { timestamps: true });

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: String,
  passwordHash: { type: String, required: true },
  otp: { code: String, expires: Date },
}, { timestamps: true });

const PageSettingSchema = new mongoose.Schema({
  page: { type: String, required: true, unique: true },
  title: String,
  metaDescription: String,
  metaKeywords: String,
  hero: { headline: String, subheadline: String, image: String, ctaLabel: String, ctaHref: String },
  sections: [{ key: String, label: String, visible: Boolean, order: Number, data: mongoose.Schema.Types.Mixed }],
  content: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

// NEW: ContactMessage model
const ContactMessageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: String,
  phone: String,
  subject: String,
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  replied: { type: Boolean, default: false },
  replyText: String,
  repliedAt: Date,
}, { timestamps: true });

const Product = mongoose.model("Product", ProductSchema);
const Category = mongoose.model("Category", CategorySchema);
const Order = mongoose.model("Order", OrderSchema);
const Review = mongoose.model("Review", ReviewSchema);
const User = mongoose.model("User", UserSchema);
const PageSetting = mongoose.model("PageSetting", PageSettingSchema);
const ContactMessage = mongoose.model("ContactMessage", ContactMessageSchema);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sha256(s) { return crypto.createHash("sha256").update(String(s)).digest("hex"); }
function signToken(payload, exp = "7d") {
  return jwt.sign(payload, process.env.JWT_SECRET || "bs_secret_key_2024", { expiresIn: exp });
}
function authAdmin(req, res, next) {
  const h = req.headers.authorization || "";
  const tk = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!tk) return res.status(401).json({ error: "টোকেন প্রয়োজন" });
  try {
    const d = jwt.verify(tk, process.env.JWT_SECRET || "bs_secret_key_2024");
    if (d.role !== "admin") return res.status(403).json({ error: "Admin only" });
    req.admin = d; next();
  } catch { res.status(401).json({ error: "টোকেন অবৈধ" }); }
}
function authUser(req, res, next) {
  const h = req.headers.authorization || "";
  const tk = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!tk) return res.status(401).json({ error: "লগইন প্রয়োজন" });
  try {
    const d = jwt.verify(tk, process.env.JWT_SECRET || "bs_secret_key_2024");
    if (!d.userId) return res.status(403).json({ error: "User token required" });
    req.user = d; next();
  } catch { res.status(401).json({ error: "টোকেন অবৈধ" }); }
}
function optionalUser(req, res, next) {
  const h = req.headers.authorization || "";
  const tk = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (tk) { try { req.user = jwt.verify(tk, process.env.JWT_SECRET || "bs_secret_key_2024"); } catch {} }
  next();
}

// Post to Google Apps Script (fire & forget)
function appsScriptPost(payload) {
  if (!process.env.APPS_SCRIPT_URL) return;
  try {
    const url = new URL(process.env.APPS_SCRIPT_URL);
    const data = JSON.stringify(payload);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
    });
    req.on("error", () => {});
    req.write(data); req.end();
  } catch (_) {}
}

// ─── Multer / Cloudinary storage ──────────────────────────────────────────────
const storage = new CloudinaryStorage({
  cloudinary,
  params: { folder: "bscollectionbd", allowed_formats: ["jpg", "jpeg", "png", "webp"] },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ═════════════════════════════════════════════════════════════════════════════
// HEALTH
// ═════════════════════════════════════════════════════════════════════════════
app.get("/", (req, res) => res.json({ ok: true, name: "BS Collection BD API", ts: Date.now() }));
app.get("/api/health", (req, res) => res.json({ ok: true }));

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN AUTH
// ═════════════════════════════════════════════════════════════════════════════
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body || {};
  if (username !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD)
    return res.status(401).json({ error: "ব্যবহারকারী নাম বা পাসওয়ার্ড ভুল" });
  const token = signToken({ username, role: "admin" });
  res.json({ token, username, role: "admin" });
});

// ═════════════════════════════════════════════════════════════════════════════
// CUSTOMER AUTH (signup / login / forgot / reset / profile / orders)
// ═════════════════════════════════════════════════════════════════════════════
app.post("/api/customer/signup", async (req, res) => {
  try {
    const { name, password } = req.body || {};
    let email = String(req.body.email || "").trim().toLowerCase();
    let phone = String(req.body.phone || "").trim();
    if (!name || (!email && !phone) || !password) return res.status(400).json({ error: "নাম, ইমেইল বা মোবাইল নম্বর এবং পাসওয়ার্ড দিন" });
    if (String(password).length < 6) return res.status(400).json({ error: "পাসওয়ার্ড কমপক্ষে ৬ অক্ষর" });
    const query = [];
    if (email) query.push({ email });
    if (phone) query.push({ phone });
    const exists = query.length ? await User.findOne({ $or: query }) : null;
    if (exists) {
      if (email && exists.email === email) return res.status(400).json({ error: "এই ইমেইলে অ্যাকাউন্ট আছে" });
      if (phone && exists.phone === phone) return res.status(400).json({ error: "এই মোবাইল নম্বরে অ্যাকাউন্ট আছে" });
    }
    if (!email && phone) email = phone + "@phone.bscbd.local";
    const user = await User.create({ name, email, phone, passwordHash: sha256(password) });
    const token = signToken({ userId: user._id, email: user.email, name: user.name, role: "customer" });
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email, phone: user.phone } });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post("/api/customer/login", async (req, res) => {
  try {
    const { email, phone, password } = req.body || {};
    const raw = String(email || phone || "").trim();
    // Auto-detect: phone numbers start with digits or +
    const looksLikePhone = /^[+]?[0-9]{10,15}$/.test(raw) || /^01[3-9][0-9]{8}$/.test(raw);
    let user;
    if (looksLikePhone) {
      user = await User.findOne({ phone: raw });
      if (!user) user = await User.findOne({ email: raw + "@phone.bscbd.local" });
    } else {
      user = await User.findOne({ email: raw.toLowerCase() });
    }
    if (!user || user.passwordHash !== sha256(password || ""))
      return res.status(401).json({ error: "ইমেইল/মোবাইল বা পাসওয়ার্ড ভুল" });
    const token = signToken({ userId: user._id, email: user.email, name: user.name, role: "customer" });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, phone: user.phone } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/customer/forgot", async (req, res) => {
  try {
    const raw = String(req.body?.email || req.body?.identifier || "").trim();
    if (!raw) return res.status(400).json({ error: "ইমেইল বা মোবাইল নম্বর দিন" });
    const looksLikePhone = /^[+]?[0-9]{10,15}$/.test(raw) || /^01[3-9][0-9]{8}$/.test(raw);
    let user;
    if (looksLikePhone) {
      user = await User.findOne({ phone: raw });
      if (!user) user = await User.findOne({ email: raw + "@phone.bscbd.local" });
    } else {
      user = await User.findOne({ email: raw.toLowerCase() });
    }
    if (!user) return res.status(404).json({ error: "এই ইমেইল/মোবাইলে কোনো অ্যাকাউন্ট নেই" });
    const code = String(Math.floor(100000 + Math.random() * 900000));
    user.otp = { code, expires: new Date(Date.now() + 10 * 60 * 1000) };
    await user.save();
    const emailForOtp = looksLikePhone ? null : raw.toLowerCase();
    if (emailForOtp) {
      appsScriptPost({ action: "sendOtp", email: emailForOtp, code, name: user.name });
    }
    const msg = emailForOtp
      ? "OTP আপনার ইমেইলে ���াঠানো হয়েছে। ১০ মিনিটের মধ্যে ব্যবহার করুন।"
      : "OTP তৈরি হয়েছে। অ্যাডমিনের সাথে ���োগাযোগ করুন।";
    res.json({ msg });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/customer/reset", async (req, res) => {
  try {
    const { email, phone, code, newPassword } = req.body || {};
    const raw = String(email || phone || "").trim();
    const looksLikePhone = /^[+]?[0-9]{10,15}$/.test(raw) || /^01[3-9][0-9]{8}$/.test(raw);
    let user;
    if (looksLikePhone) {
      user = await User.findOne({ phone: raw });
      if (!user) user = await User.findOne({ email: raw + "@phone.bscbd.local" });
    } else {
      user = await User.findOne({ email: raw.toLowerCase() });
    }
    if (!user) return res.status(404).json({ error: "অ্যাকাউন্ট পাওয়া যায়নি" });
    if (!user.otp?.code || user.otp.code !== code || new Date() > user.otp.expires)
      return res.status(400).json({ error: "OTP অবৈধ বা মেয়াদোত্তীর্ণ" });
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: "পাসওয়ার্ড কমপক্ষে ৬ অক্ষর" });
    user.passwordHash = sha256(newPassword);
    user.otp = undefined;
    await user.save();
    res.json({ msg: "পাসওয়ার্ড পরিবর্তন সফল হয়েছে।" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Customer profile
app.get("/api/customer/profile", authUser, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-passwordHash -otp");
    if (!user) return res.status(404).json({ error: "ব্যবহারকারী পাওয়া যায়নি" });
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Customer update profile
app.put("/api/customer/profile", authUser, async (req, res) => {
  try {
    const { name, phone } = req.body || {};
    const update = {};
    if (name) update.name = name;
    if (phone) update.phone = phone;
    const user = await User.findByIdAndUpdate(req.user.userId, update, { new: true }).select("-passwordHash -otp");
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Customer orders
app.get("/api/customer/orders", authUser, async (req, res) => {
  try {
    const email = req.user.email;
    const userId = req.user.userId;
    const user = await User.findById(userId);
    // Match orders by userId, email, or phone
    const query = [];
    if (userId) query.push({ userId });
    if (email) query.push({ "customer.email": email });
    if (user?.phone) query.push({ "customer.phone": user.phone });
    const orders = await Order.find(query.length ? { $or: query } : { _id: null })
      .sort({ createdAt: -1 }).limit(50);
    res.json(orders);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═════════════════════════════════════════════════════════════════════════════
// CONTACT MESSAGES
// ═════════════════════════════════════════════════════════════════════════════
// Public: submit contact form
app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body || {};
    if (!name || !message) return res.status(400).json({ error: "নাম ও বার্তা আবশ্যক" });
    const msg = await ContactMessage.create({ name, email, phone, subject, message });
    // notify via Apps Script
    appsScriptPost({ action: "newContact", name, email, phone, subject, message });
    res.status(201).json({ ok: true, id: msg._id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin: list all contact messages
app.get("/api/contacts", authAdmin, async (req, res) => {
  try {
    const msgs = await ContactMessage.find().sort({ createdAt: -1 }).limit(200);
    res.json(msgs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin: get single contact message
app.get("/api/contacts/:id", authAdmin, async (req, res) => {
  try {
    const msg = await ContactMessage.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
    if (!msg) return res.status(404).json({ error: "পাওয়া যায়নি" });
    res.json(msg);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin: reply to contact message
app.patch("/api/contacts/:id", authAdmin, async (req, res) => {
  try {
    const { replyText, read, replied } = req.body || {};
    const update = { read: true };
    if (replyText !== undefined) { update.replyText = replyText; update.replied = true; update.repliedAt = new Date(); }
    if (read !== undefined) update.read = read;
    if (replied !== undefined) update.replied = replied;
    const msg = await ContactMessage.findByIdAndUpdate(req.params.id, update, { new: true });
    if (replyText && msg && msg.email) {
      appsScriptPost({
        action: "replyContact",
        to: msg.email,
        name: msg.name || "",
        subject: msg.subject || "আপনার বার্তার উত্তর",
        originalMessage: msg.message || "",
        replyText,
      });
    }
    res.json(msg);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin: delete contact message
app.delete("/api/contacts/:id", authAdmin, async (req, res) => {
  try {
    await ContactMessage.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═════════════════════════════════════════════════════════════════════════════
// PRODUCTS
// ═════════════════════════════════════════════════════════════════════════════
app.get("/api/products", async (req, res) => {
  try {
    const { placement, cat, featured, search, limit = 100 } = req.query;
    const q = {};
    if (placement === "homePopular") q["placements.homePopular"] = true;
    else if (placement === "homeBestseller") q["placements.homeBestseller"] = true;
    else if (placement === "homeNew") q["placements.homeNew"] = true;
    else if (placement === "shop") q["placements.shop"] = true;
    if (cat) q.categorySlug = cat;
    if (featured === "true") q.featured = true;
    if (search) q.name = { $regex: search, $options: "i" };
    const products = await Product.find(q).sort({ createdAt: -1 }).limit(Number(limit));
    res.json(products);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/products", authAdmin, async (req, res) => {
  try {
    // "শপ পেজ" আর ম্যানুয়াল টগল নয় — সব পণ্য ডিফল্টভাবেই শপ পেজে দেখাবে।
    req.body.placements = Object.assign({}, req.body.placements, { shop: true });
    const p = await Product.create(req.body);
    // update category count
    if (p.categorySlug) await Category.updateOne({ slug: p.categorySlug }, { $inc: { count: 1 } });
    res.status(201).json(p);
  } catch (err) { res.status(400).json({ error: err.message }); }
});


// ── Product by SKU ──────────────────────────────────────────────────
app.get("/api/products/sku/:sku", async (req, res) => {
  try {
    const p = await Product.findOne({ sku: req.params.sku });
    if (!p) return res.status(404).json({ error: "পণ্য পাওয়া যায়নি" });
    res.json(p);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/products/id/:id", async (req, res) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ error: "পণ্য পাওয়া যায়নি" });
    res.json(p);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/products/id/:id", authAdmin, async (req, res) => {
  try {
    // "শপ পেজ" আর ম্যানুয়াল টগল নয় — সব পণ্য ডিফল্টভাবেই শপ পেজে দেখাবে।
    if (req.body.placements) req.body.placements = Object.assign({}, req.body.placements, { shop: true });
    const p = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!p) return res.status(404).json({ error: "পণ্য পাওয়া যায়নি" });
    res.json(p);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete("/api/products/id/:id", authAdmin, async (req, res) => {
  try {
    const p = await Product.findByIdAndDelete(req.params.id);
    if (!p) return res.status(404).json({ error: "পণ্য পাওয়া যায়নি" });
    if (p.categorySlug) await Category.updateOne({ slug: p.categorySlug }, { $inc: { count: -1 } });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Image upload
app.post("/api/products/upload", authAdmin, upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "ছবি পাওয়া যায়নি" });
  res.json({ url: req.file.path });
});

// About page image upload (public but with basic check)
app.post("/api/upload/about-image", authAdmin, upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "ছবি পাওয়া যায়নি" });
  res.json({ url: req.file.path });
});

// ═════════════════════════════════════════════════════════════════════════════
// CATEGORIES
// ═════════════════════════════════════════════════════════════════════════════
app.get("/api/categories", async (req, res) => {
  try {
    const cats = await Category.find().sort({ name: 1 });
    res.json(cats);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/categories", authAdmin, async (req, res) => {
  try {
    const cat = await Category.create(req.body);
    res.status(201).json(cat);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.put("/api/categories/:id", authAdmin, async (req, res) => {
  try {
    const cat = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!cat) return res.status(404).json({ error: "ক্যাটাগরি পাওয়া যায়নি" });
    res.json(cat);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete("/api/categories/:id", authAdmin, async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═════════════════════════════════════════════════════════════════════════════

// Category image upload
app.post("/api/categories/upload", authAdmin, upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "ছবি পাওয়া যায়নি" });
  res.json({ url: req.file.path });
});

// ORDERS
// ═════════════════════════════════════════════════════════════════════════════
app.post("/api/orders", optionalUser, async (req, res) => {
  try {
    const body = req.body || {};
    let { customer, items, subtotal, deliveryCharge, deliveryFee, total, paymentMethod, source, note } = body;
    // Backward-compat: accept flat landing-page payloads
    // { customerName, phone, address:{division,district,upazila,union,detail}, totalAmount, ... }
    if (!customer || typeof customer !== "object") customer = {};
    if (!customer.name && body.customerName) customer.name = body.customerName;
    if (!customer.phone && body.phone) customer.phone = body.phone;
    if (!customer.email && body.email) customer.email = body.email;
    if (body.address && typeof body.address === "object") {
      customer.division = customer.division || body.address.division || "";
      customer.district = customer.district || body.address.district || "";
      customer.upazila  = customer.upazila  || body.address.upazila  || "";
      customer.union    = customer.union    || body.address.union    || "";
      customer.area     = customer.area     || body.address.detail   || body.address.area || "";
    } else if (typeof body.address === "string" && !customer.address) {
      customer.address = body.address;
    }
    if (total == null && body.totalAmount != null) total = body.totalAmount;
    if (!customer?.name || !customer?.phone)
      return res.status(400).json({ error: "নাম ও ফোন নম্বর আবশ্যক" });

    // Build order
    const orderData = {
      customer: {
        name: customer.name,
        phone: customer.phone,
        address: customer.address || [customer.area, customer.upazila, customer.district, customer.division].filter(Boolean).join(", "),
        email: customer.email || "",
        division: customer.division || "",
        district: customer.district || "",
        upazila: customer.upazila || "",
        union: customer.union || "",
        area: customer.area || "",
      },
      items: (items || []).map(i => ({
        productId: i.id || i.productId || "",
        sku: i.sku || i.id || "",
        name: i.name || "",
        price: Number(i.price) || 0,
        qty: Number(i.qty) || 1,
        img: i.img || "",
        color: i.color || "",
        size: i.size || "",
        weight: i.weight || "",
      })),
      subtotal: Number(subtotal) || 0,
      deliveryCharge: Number(deliveryCharge || deliveryFee) || 70,
      deliveryFee: Number(deliveryFee || deliveryCharge) || 70,
      total: Number(total) || 0,
      paymentMethod: paymentMethod || "COD",
      source: source || "site",
      userId: req.user?.userId || "",
      note: note || "",
      meta: {
        ip: req.ip,
        userAgent: req.headers["user-agent"] || "",
        referer: req.headers.referer || "",
      },
    };

    // Simple fake-order detection
    const recentSamePhone = await Order.countDocuments({
      "customer.phone": customer.phone,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });
    let fakeScore = 0;
    const fakeReasons = [];
    if (recentSamePhone > 1) { fakeScore += 60; fakeReasons.push("Same phone used more than once in 24h"); }
    if (customer.phone && !/^01[3-9]\d{8}$/.test(customer.phone)) { fakeScore += 30; fakeReasons.push("Invalid BD phone number"); }
    orderData.fakeScore = fakeScore;
    orderData.fakeReasons = fakeReasons;
    orderData.isFake = fakeScore >= 60;

    const order = await Order.create(orderData);

    // Decrement stock
    for (const item of order.items) {
      if (item.sku) await Product.updateOne({ sku: item.sku }, { $inc: { stock: -item.qty } });
    }

    // Notify
    appsScriptPost({
      action: "newOrder",
      order: {
        id: order.orderId,
        customer: order.customer,
        items: order.items.map(i => ({
          name: i.name,
          sku: i.sku,
          qty: i.qty,
          price: i.price,
          total: i.price * i.qty,
          color: i.color || "",
          size: i.size || "",
          weight: i.weight || "",
          img: i.img || "",
        })),
        subtotal: order.subtotal,
        shipping: order.deliveryCharge || order.deliveryFee,
        total: order.total,
        status: order.status,
      },
    });

    res.status(201).json({ ok: true, orderId: order.orderId, _id: order._id });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.get("/api/orders", authAdmin, async (req, res) => {
  try {
    const { status, fake, limit = 50, skip = 0, search } = req.query;
    const q = {};
    if (status) q.status = status;
    if (fake === "true") q.isFake = true;
    if (search) q.$or = [
      { "customer.name": { $regex: search, $options: "i" } },
      { "customer.phone": { $regex: search, $options: "i" } },
      { orderId: { $regex: search, $options: "i" } },
    ];
    const [orders, total] = await Promise.all([
      Order.find(q).sort({ createdAt: -1 }).skip(Number(skip)).limit(Number(limit)),
      Order.countDocuments(q),
    ]);
    res.json({ orders, total });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/orders/:id", authAdmin, async (req, res) => {
  try {
    const o = await Order.findById(req.params.id);
    if (!o) return res.status(404).json({ error: "অর্ডার পাওয়া যায়নি" });
    res.json(o);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch("/api/orders/:id", authAdmin, async (req, res) => {
  try {
    const { status, note } = req.body || {};
    const update = {};
    if (status) update.status = status;
    if (note !== undefined) update.note = note;
    const o = await Order.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!o) return res.status(404).json({ error: "অর্ডার পাওয়া যায়নি" });
    res.json(o);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete("/api/orders/:id", authAdmin, async (req, res) => {
  try {
    await Order.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═════════════════════════════════════════════════════════════════════════════
// REVIEWS
// ═════════════════════════════════════════════════════════════════════════════
app.get("/api/reviews", async (req, res) => {
  try {
    const { productId, visible = "true" } = req.query;
    const q = {};
    if (productId) q.productId = productId;
    if (visible !== "all") q.visible = visible === "true";
    const reviews = await Review.find(q).sort({ createdAt: -1 }).limit(100);
    res.json(reviews);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/reviews", optionalUser, async (req, res) => {
  try {
    const { productId, productName, user, email, type, text, rating } = req.body || {};
    if (!productId || !user || !text) return res.status(400).json({ error: "সব তথ্য দিন" });
    const review = await Review.create({
      productId, productName, user, email,
      userId: req.user?.userId,
      type: type || "review",
      text, rating: Number(rating) || 5,
      visible: true,
    });
    // update product rating
    const allReviews = await Review.find({ productId, visible: true, type: "review" });
    if (allReviews.length) {
      const avg = allReviews.reduce((s, r) => s + (r.rating || 5), 0) / allReviews.length;
      await Product.updateOne({ $or: [{ sku: productId }, { _id: productId }] }, { rating: Math.round(avg * 10) / 10 });
    }
    res.status(201).json(review);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.get("/api/admin/reviews", authAdmin, async (req, res) => {
  try {
    const reviews = await Review.find().sort({ createdAt: -1 }).limit(200);
    res.json(reviews);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch("/api/admin/reviews/:id", authAdmin, async (req, res) => {
  try {
    const { visible, reply } = req.body || {};
    const update = {};
    if (visible !== undefined) update.visible = visible;
    if (reply !== undefined) update.reply = reply;
    const r = await Review.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json(r);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete("/api/admin/reviews/:id", authAdmin, async (req, res) => {
  try {
    await Review.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═════════════════════════════════════════════════════════════════════════════
// USERS (admin)
// ═════════════════════════════════════════════════════════════════════════════
app.get("/api/users", authAdmin, async (req, res) => {
  try {
    const users = await User.find().select("-passwordHash -otp").sort({ createdAt: -1 }).limit(200);
    res.json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/users/:id", authAdmin, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═════════════════════════════════════════════════════════════════════════════
// PAGE SETTINGS (About, Home, Shop, Contact, etc.)
// ═════════════════════════════════════════════════════════════════════════════
const DEFAULT_PAGES = [
  {
    page: "home",
    title: "BS Collection BD — Premium Fans & Electrical Appliances",
    metaDescription: "Bangladesh's trusted online store for premium fans & electrical appliances. Quality products, fast delivery nationwide.",
    metaKeywords: "fan bangladesh, ceiling fan, rechargeable fan, table fan, electrical appliances",
    content: {
      heroHeadline: "বাংলাদেশের সেরা ফ্যান কালেকশন",
      heroSubheadline: "প্রিমিয়াম মানের ফ্যান ও ইলেকট্রিক্যাল পণ্য",
      promoBanners: [
        { style: "amber", tag: "Home Collection — ঘরের জন্য সেরা", title: "প্রিমিয়াম সিলিং ফ্যানে আধুনিক ঘর কুলিং", text: "সেরা মানের সিলিং ফ্যান এখন সাশ্রয়ী মূল্যে পাচ্ছেন।", btnText: "Shop Now", btnLink: "shop.html", img: "assets/photo_2026-07-15_18-28-56.png" },
        { style: "dark", tag: "Industrial — শিল্প পণ্য", title: "ভারী শিল্পের জন্য টেকসই কুলিং সমাধান", text: "গোডাউন ও কারখানার জন্য টেকসই ইন্ডাস্ট্রিয়াল ফ্যান।", btnText: "Shop Now", btnLink: "shop.html", img: "assets/photo_2026-07-15_18-29-17.png" },
      ],
      dealOfMonth: {
        tag: "মাসের সেরা অফার",
        title: "Premium Smart BLDC Fan",
        highlight: "45% OFF",
        text: "অ্যাপ কন্ট্রোল, স্লিপ টাইমার এবং আল্ট্রা-সাইলেন্ট মোটরসহ আমাদের টপ-রেটেড স্মার্ট সিলিং ফ্যানটি সংগ্রহ করুন। সীমিত স্টক — এখনই অর্ডার করুন!",
        btnText: "Buy Now", btnLink: "shop.html",
        img: "https://5.imimg.com/data5/TI/ES/TB/SELLER-93582485/bldc-ceiling-fan.jpg",
        days: 8,
      },
      whyChooseUs: [
        { icon: "fa-award", title: "Quality Products", text: "যাচাই করা পণ্যই আপনার হাতে পৌঁছে দেওয়ার চেষ্টা করি।" },
        { icon: "fa-truck-fast", title: "Nationwide Delivery", text: "সারা বাংলাদেশে দ্রুত ও নিরাপদে আপনার ঠিকানায় পৌঁছে দেওয়া হয়।" },
        { icon: "fa-money-bill-wave", title: "Cash on Delivery", text: "আগে পণ্�� হাতে নিন, তারপর মূল্য পরিশোধ করুন।" },
        { icon: "fa-lock", title: "No Advance Payment", text: "কোনো অগ্রিম প্রয়োজন নেই, নিশ্চিন্তে অর্ডার করুন।" },
        { icon: "fa-headset", title: "Customer Support", text: "অর্ডারের আগে ও পরে প্রয়োজনীয় সহায়তা পেতে আমাদের সাথে যোগাযোগ করতে পারবেন।" },
        { icon: "fa-heart", title: "Customer Satisfaction", text: "আপনার আস্থা ও সন্তুষ্টি অর্জনই আমাদের লক্ষ্য।" },
      ],
      reviews: [
        { name: "Rahim Uddin", initial: "R", rating: 5, text: "BLDC ceiling fan-টি অসাধারণ শান্ত এবং স্টাইলিশ। আমার বিদ্যুৎ বিল অনেক কমেছে। হাইলি রেকমেন্ডেড!" },
        { name: "Farhana Akter", initial: "F", rating: 5, text: "দ্রুত ডেলিভারি এবং প্রিমিয়াম কোয়ালিটির প্রোডাক্ট। ইন্ডাস্ট্রিয়াল ফ্যানটি আমার গোডাউনে দারুণ কাজ করছে।" },
        { name: "Tanvir Hasan", initial: "T", rating: 4, text: "চমৎকার কাস্টমার সাপোর্ট। তারা আমাকে অফিসের জন্য সঠিক টেবিল ফ্যান বেছে নিতে সাহায্য করেছে।" },
      ],
      newsletter: {
        title: "আপনার প্রথম অর্ডারে পান",
        highlight: "10% OFF",
        text: "এক্সক্লুসিভ অফার, নতুন পণ্য ও প্রোডাক্ট টিপস পেতে আমাদের নিউজলেটার সাবস্ক্রাইব করুন।",
        placeholder: "Enter your email address",
        btnText: "Subscribe",
      },
    },
  },
  {
    page: "about",
    title: "About Us — BS Collection BD",
    metaDescription: "Learn about BS Collection BD — Bangladesh's trusted store for premium fans and electrical appliances since 2020.",
    metaKeywords: "about bscollectionbd, fan store bangladesh, electrical appliances",
    content: {
      heading: "আমাদের সম্পর্কে",
      subheading: "About BS Collection BD",
      intro: "বিএস কালেকশন বিডি বাংলাদেশের একটি বিশ্বস্ত অনলাইন স্টোর যা প্রিমিয়াম মানের ফ্যান ও ইলেকট্রিক্যাল যন্ত্রপাতি বিক্রি করে। আমরা ২০২০ সাল থেকে সারা বাংলাদেশে মানসম্পন্ন পণ্য সরবরাহ করে আসছি।",
      mission: "আমাদের লক্ষ্য হলো বাংলাদেশের প্রতিটি ঘরে ও অফিসে সর্বোচ্চ মানের কুলিং সমাধান পৌঁছে দেওয়া। আমরা বিশ্বাস করি যে মানসম্পন্ন পণ্য সাশ্রয়ী মূল্যে পাওয়া সবার অধিকার।",
      visionHeading: "আমাদের দৃষ্টিভঙ্গি",
      visionText: "বাংলাদেশের সবচেয়ে বিশ্বস্ত ইলেকট্রিক্যাল পণ্যের অনলাইন স্টোর হওয়া এবং গ্রাহকদের সর্বোত্তম সেবা প্রদান করা।",
      whyUs: "আমরা শুধু পণ্য বিক্রি করি না — আমরা আপনার জীবনকে আরামদায়ক করার চেষ্টা করি। প্রতিটি পণ্য যাচাই করে, দ্রুত ডেলিভারি দিয়ে এবং সেরা গ্রাহক সেবা দিয়ে আমরা আপনার পাশে থাকি।",
      teamText: "আমাদের দলে রয়েছে অভিজ্ঞ প্রকৌশলী, বিক্রয় বিশেষজ্ঞ এবং গ্রাহক সেবা প্রতিনিধি যারা সর্বদা আপনার সেবায় প্রস্তুত।",
      address: "Mirpur 10, Dhaka 1216, Bangladesh",
      phone: "+880 1344-367630",
      email: "support@bscollectionbd.com",
      hours: "Sat – Thu: 9:00 AM – 9:00 PM",
      aboutImg: "",
      stats: [
        { label: "Happy Customers", value: "5000+" },
        { label: "Products", value: "50+" },
        { label: "Years Experience", value: "4+" },
        { label: "Cities Covered", value: "64+" },
      ],
    },
  },
  {
    page: "shop",
    title: "Shop — BS Collection BD",
    metaDescription: "Browse our complete collection of premium fans and electrical appliances. Fast delivery across Bangladesh.",
    metaKeywords: "shop fans bangladesh, buy ceiling fan, table fan price bangladesh",
    content: {},
  },
  {
    page: "contact",
    title: "Contact Us — BS Collection BD",
    metaDescription: "Get in touch with BS Collection BD. We are here to help with your orders and queries.",
    metaKeywords: "contact bscollectionbd, fan store contact, electrical appliances support",
    content: {
      heading: "যোগাযোগ করুন",
      subheading: "Contact BS Collection BD",
      intro: "আমাদের সাথে যোগাযোগ করুন। আমরা আপনার যেকোনো প্রশ্ন ও সমস্যার সমাধান করতে সর্বদা প্রস্তুত।",
      address: "Mirpur 10, Dhaka 1216, Bangladesh",
      phone: "+880 1344-367630",
      email: "support@bscollectionbd.com",
      hours: "শনি – বৃহস্পতি: সকাল ৯টা – রাত ৯টা",
    },
  },
];

app.get("/api/page-settings", async (req, res) => {
  try {
    const all = await PageSetting.find();
    const map = {};
    all.forEach(p => { map[p.page] = p; });
    const merged = DEFAULT_PAGES.map(d => {
      const saved = map[d.page];
      if (saved) {
        const obj = saved.toObject();
        // deep merge content
        if (d.content && obj.content) {
          obj.content = { ...d.content, ...obj.content };
        }
        return { ...d, ...obj };
      }
      return d;
    });
    res.json(merged);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/page-settings/:page", async (req, res) => {
  try {
    const p = await PageSetting.findOne({ page: req.params.page });
    const def = DEFAULT_PAGES.find(d => d.page === req.params.page) || { page: req.params.page };
    if (p) {
      const obj = p.toObject();
      if (def.content && obj.content) obj.content = { ...def.content, ...obj.content };
      res.json({ ...def, ...obj });
    } else {
      res.json(def);
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/page-settings/:page", authAdmin, async (req, res) => {
  try {
    const p = await PageSetting.findOneAndUpdate(
      { page: req.params.page },
      { ...req.body, page: req.params.page },
      { new: true, upsert: true, runValidators: true }
    );
    res.json(p);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ═════════════════════════════════════════════════════════════════════════════
// FILTER TABS (for storefront filter tabs management)
// ═════════════════════════════════════════════════════════════════════════════
const DEFAULT_FILTER_TABS = [
  { id: "all", label: "সকল পন্য", filter: "all", order: 0, visible: true },
  { id: "popular", label: "জনপ্রিয়", filter: "homePopular", order: 1, visible: true },
  { id: "bestseller", label: "সেরা বিক্রিত", filter: "homeBestseller", order: 2, visible: true },
  { id: "new", label: "নতুন পন্য", filter: "homeNew", order: 3, visible: true },
  { id: "table-fan", label: "টেবিল ফ্যান", filter: "cat:table-fans", order: 4, visible: true },
  { id: "rechargeable", label: "রিচার্জেবল ফ্যান", filter: "cat:rechargeable-fans", order: 5, visible: true },
];

app.get("/api/filter-tabs", async (req, res) => {
  try {
    const setting = await PageSetting.findOne({ page: "_filter_tabs" });
    res.json(setting?.content?.tabs || DEFAULT_FILTER_TABS);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/filter-tabs", authAdmin, async (req, res) => {
  try {
    const tabs = req.body;
    if (!Array.isArray(tabs)) return res.status(400).json({ error: "tabs must be an array" });
    await PageSetting.findOneAndUpdate(
      { page: "_filter_tabs" },
      { page: "_filter_tabs", content: { tabs } },
      { upsert: true, new: true }
    );
    res.json(tabs);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ═════════════════════════════════════════════════════════════════════════════
// SEED — default products & categories (admin only)
// ═════════════════════════════════════════════════════════════════════════════
// ডিফল্ট ক্যাটাগরি তালিকা
const DEFAULT_CATEGORIES = [
  { name: "সিলিং ফ্যান", slug: "ceiling-fans", img: "https://5.imimg.com/data5/TI/ES/TB/SELLER-93582485/bldc-ceiling-fan.jpg" },
  { name: "টেবিল ফ্যান", slug: "table-fans", img: "https://m.media-amazon.com/images/I/71X-Pth5ULS.jpg" },
  { name: "স্ট্যান্ড ফ্যান", slug: "stand-fans", img: "https://m.media-amazon.com/images/I/71X-Pth5ULS.jpg" },
  { name: "ইন্ডাস্ট্রিয়াল ফ্যান", slug: "industrial-fans", img: "" },
  { name: "এক্সহস্ট ফ্যান", slug: "exhaust-fans", img: "" },
  { name: "রিচার্জেবল ফ্যান", slug: "rechargeable-fans", img: "" },
  { name: "এলইডি লাইট", slug: "led-lights", img: "" },
  { name: "ওয়াল ফ্যান", slug: "wall-fans", img: "" },
  { name: "এক্সেসরিজ", slug: "accessories", img: "" },
];

// প্রতিটি ক্যাটাগরির জন্য ৫টি করে ডিফল্ট পণ্য তৈরি করে (মোট ৪৫টি)
function buildDefaultProducts() {
  const templates = {
    "ceiling-fans":     { cat: "Ceiling Fan",     brand: "BS Collection", base: 3200, unit: "সিলিং ফ্যান" },
    "table-fans":       { cat: "Table Fan",       brand: "BS Collection", base: 1800, unit: "টেবিল ফ্যান" },
    "stand-fans":       { cat: "Stand Fan",       brand: "BS Collection", base: 2600, unit: "স্ট্যান্ড ফ্যান" },
    "industrial-fans":  { cat: "Industrial Fan",  brand: "BS Collection", base: 5500, unit: "ইন্ডাস্ট্রিয়াল ফ্যান" },
    "exhaust-fans":     { cat: "Exhaust Fan",     brand: "BS Collection", base: 1400, unit: "এক্সহস্ট ফ্যান" },
    "rechargeable-fans":{ cat: "Rechargeable Fan",brand: "JYSUPER",       base: 999,  unit: "রিচার্জেবল ফ্যান" },
    "led-lights":       { cat: "LED Light",       brand: "BS Collection", base: 350,  unit: "এলইডি লাইট" },
    "wall-fans":        { cat: "Wall Fan",        brand: "BS Collection", base: 2200, unit: "ওয়াল ফ্যান" },
    "accessories":      { cat: "Accessory",       brand: "BS Collection", base: 250,  unit: "এক্সেসরিজ" },
  };
  const products = [];
  DEFAULT_CATEGORIES.forEach(c => {
    const t = templates[c.slug];
    if (!t) return;
    for (let i = 1; i <= 5; i++) {
      const now = t.base + (i - 1) * Math.round(t.base * 0.12);
      const old = Math.round(now * 1.2);
      products.push({
        sku: `${c.slug}-${i}`,
        name: `${t.cat} Model ${i}`,
        cat: t.cat,
        categorySlug: c.slug,
        brand: t.brand,
        now, old,
        stock: 15,
        featured: i === 1,
        rating: 5,
        img: c.img || "",
        gallery: c.img ? [c.img] : [],
        description: `${t.cat} Model ${i} — ${t.unit}, উন্নত মান ও দীর্ঘস্থায়ী পারফরম্যান্স। BS Collection BD থেকে সেরা দামে কিনুন।`,
        shortDescription: `${t.cat} Model ${i} — ${t.unit}`,
        tags: [t.cat.toLowerCase(), c.slug, "bangladesh"],
        seoTitle: `${t.cat} Model ${i} - Buy Online in Bangladesh | BS Collection BD`,
        seoDescription: `${t.cat} Model ${i} best price in Bangladesh. Fast delivery nationwide from BS Collection BD.`,
        seoKeywords: `${t.cat}, ${c.slug}, ${t.unit}, bangladesh`,
        specs: [
          { label: "Model", value: `${t.cat} Model ${i}` },
          { label: "Brand", value: t.brand },
          { label: "Warranty", value: "6 months" },
        ],
        features: ["উন্নত মান", "দীর্ঘস্থায়ী", "কম বিদ্যুৎ খরচ"],
        placements: {
          shop: true,
          homePopular: i <= 2,
          homeBestseller: i === 3,
          homeNew: i >= 4,
        },
      });
    }
  });
  return products;
}

// ক্যাটাগরি ও পণ্য সিড করার শেয়ারড ফাংশন (স্টার্টআপ + অ্যাডমিন উভয় ক্ষেত্রে)
async function runSeed() {
  const results = { categories: 0, products: 0, skipped: 0 };

  for (const cat of DEFAULT_CATEGORIES) {
    const exists = await Category.findOne({ slug: cat.slug });
    if (!exists) { await Category.create({ ...cat, count: 0 }); results.categories++; }
  }

  const defaultProducts = buildDefaultProducts();
  for (const prod of defaultProducts) {
    const exists = await Product.findOne({ sku: prod.sku });
    if (!exists) {
      await Product.create(prod);
      results.products++;
      if (prod.categorySlug) await Category.updateOne({ slug: prod.categorySlug }, { $inc: { count: 1 } });
    } else { results.skipped++; }
  }

  const aboutExists = await PageSetting.findOne({ page: "about" });
  if (!aboutExists) {
    const ap = DEFAULT_PAGES.find(d => d.page === "about");
    if (ap) await PageSetting.create(ap);
  }

  return results;
}

// ═════════════════════════════════════════════════════════════════════════════
// SEED — প্রতিটি ক্যাটাগরিতে ডিফল্ট ৫টি করে পণ্য (admin only)
// ═════════════════════════════════════════════════════════════════════════════
app.post("/api/seed", authAdmin, async (req, res) => {
  try {
    const results = await runSeed();
    res.json({ ok: true, ...results, message: `Seeded: ${results.categories} categories, ${results.products} products (${results.skipped} skipped)` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═════════════════════════════════════════════════════════════════════════════
// STATS
// ════════════════════════════════��════════════════════════════════════════════
app.get("/api/stats", authAdmin, async (req, res) => {
  try {
    const [totalProducts, totalOrders, pendingOrders, completedOrders, cancelledOrders,
           fakeOrders, totalCategories, totalUsers, totalReviews, totalContacts, unreadContacts] = await Promise.all([
      Product.countDocuments(), Order.countDocuments(),
      Order.countDocuments({ status: "Pending" }),
      Order.countDocuments({ status: "Completed" }),
      Order.countDocuments({ status: "Cancelled" }),
      Order.countDocuments({ isFake: true }),
      Category.countDocuments(), User.countDocuments(),
      Review.countDocuments(),
      ContactMessage.countDocuments(),
      ContactMessage.countDocuments({ read: false }),
    ]);
    const revenueAgg = await Order.aggregate([
      { $match: { status: "Completed" } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]);
    const inStock = await Product.countDocuments({ stock: { $gt: 5 } });
    const lowStock = await Product.countDocuments({ stock: { $gt: 0, $lte: 5 } });
    const outOfStock = await Product.countDocuments({ stock: 0 });
    res.json({
      totalProducts, totalOrders, pendingOrders, completedOrders, cancelledOrders,
      fakeOrders, totalCategories, totalUsers, totalReviews,
      totalContacts, unreadContacts,
      totalRevenue: revenueAgg[0]?.total || 0,
      inStock, lowStock, outOfStock,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ─── Landing Page Schema ──────────────────────────────────────────────────────
const LandingPageSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  title: String,
  metaDescription: String,
  metaKeywords: String,
  active: { type: Boolean, default: true },
  category: String,
  categorySlug: String,
  rating: { type: Number, default: 5 },
  ratingCount: { type: Number, default: 0 },
  stock: { type: Number, default: 0 },
  highlightColor: String,
  highlightCharge: String,
  description: String,
  priceStripText: String,
  linkedProduct: String,
  hero: {
    headline: String,
    subheadline: String,
    image: String,
    priceNow: Number,
    priceOld: Number,
    ctaLabel: { type: String, default: 'এখনই অর্ডার করুন' },
    ctaLink: String,
    productId: String,
  },
  thumbImages: [{ url: String, alt: String }],
  colors: [{ name: String, hex: String, thumb: Number }],
  descFeatures: [String],
  features: [String],
  specs: [{ label: String, value: String }],
  gallery: [String],
  reviews: [{
    name: String,
    rating: Number,
    title: String,
    text: String,
    date: String,
  }],
  faq: [{ q: String, a: String }],
  sidebarRelated: [{
    name: String,
    price: Number,
    oldPrice: Number,
    image: String,
    link: String,
    rating: Number,
    ratingCount: Number,
  }],
  relatedGrid: [{
    cat: String,
    name: String,
    price: Number,
    oldPrice: Number,
    badge: Number,
    image: String,
    link: String,
    rating: Number,
    ratingCount: Number,
  }],
  extraHtml: String,
}, { timestamps: true });
const LandingPage = mongoose.model("LandingPage", LandingPageSchema);

// ═════════════════════════════════════════════════════════════════════════════
// LANDING PAGES
// ═════════════════════════════════════════════════════════════════════════════
app.get("/api/landing-pages", async (req, res) => {
  try {
    const pages = await LandingPage.find().sort({ createdAt: -1 });
    res.json(pages);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/landing-pages", authAdmin, async (req, res) => {
  try {
    const page = await LandingPage.create(req.body);
    res.status(201).json(page);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.get("/api/landing-pages/:slug", async (req, res) => {
  try {
    const page = await LandingPage.findOne({ slug: req.params.slug });
    if (!page) return res.status(404).json({ error: "পেজ পাওয়া যায়নি" });
    res.json(page);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/landing-pages/:slug", authAdmin, async (req, res) => {
  try {
    const page = await LandingPage.findOneAndUpdate(
      { slug: req.params.slug },
      { ...req.body, slug: req.params.slug },
      { new: true, upsert: true, runValidators: true }
    );
    res.json(page);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete("/api/landing-pages/:slug", authAdmin, async (req, res) => {
  try {
    await LandingPage.findOneAndDelete({ slug: req.params.slug });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: "Route not found" }));
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));