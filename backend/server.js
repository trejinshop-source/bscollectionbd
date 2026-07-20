/*
 * BS Collection BD — Express Backend (sarver.js) — UPDATED
 * ----------------------------------------------------------
 * Adds: Reviews (with admin moderation), Customer accounts + OTP forgot-password,
 * Page settings, Card-placement (home popular / bestseller / shop), Fake-order
 * detection heuristics, Auto-generated detail pages for new products, and
 * Google Apps Script mail notifications for new orders and OTP.
 */
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = null; // optional; we use simple sha256 to avoid extra dep
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
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) return cb(null, true);
    cb(new Error("Not allowed by CORS: " + origin));
  },
  credentials: true,
}));
app.use(express.json({ limit: "5mb" }));

// ─── MongoDB ──────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
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
  detailPage: String,
  hasDetailPage: { type: Boolean, default: false },
  rating: { type: Number, default: 0 },
  specs: [{ label: String, value: String }],
  // Placement — where the card is visible in the storefront
  placements: {
    shop: { type: Boolean, default: true },
    homePopular: { type: Boolean, default: false },
    homeBestseller: { type: Boolean, default: false },
    homeNew: { type: Boolean, default: false },
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
    address: { type: String, required: true },
    email: String,
    division: String,
    district: String,
  },
  items: [{
    productId: String,
    sku: String,
    name: String,
    price: Number,
    qty: { type: Number, default: 1 },
    img: String,
  }],
  subtotal: Number,
  deliveryCharge: { type: Number, default: 60 },
  total: Number,
  paymentMethod: { type: String, default: "COD" },
  status: {
    type: String,
    enum: ["Pending", "Verified", "Processing", "Shipped", "Completed", "Cancelled", "Fake"],
    default: "Pending",
  },
  note: String,
  // Fake-order detection metadata
  meta: {
    ip: String,
    userAgent: String,
    referer: String,
    duplicateCount: { type: Number, default: 0 },
  },
  fakeScore: { type: Number, default: 0 }, // 0-100
  fakeReasons: [String],
  isFake: { type: Boolean, default: false },
}, { timestamps: true });

OrderSchema.pre("save", async function (next) {
  if (!this.orderId) {
    const count = await mongoose.model("Order").countDocuments();
    this.orderId = "BS-" + String(count + 1001).padStart(5, "0");
  }
  next();
});

const ReviewSchema = new mongoose.Schema({
  productId: { type: String, required: true, index: true }, // sku or product _id string
  productName: String,
  user: { type: String, required: true }, // display name
  email: String,
  userId: String,
  type: { type: String, enum: ["review", "question"], default: "review" },
  text: { type: String, required: true },
  rating: { type: Number, min: 1, max: 5, default: 5 },
  visible: { type: Boolean, default: true },
  reply: String, // admin reply (for questions)
}, { timestamps: true });

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: String,
  passwordHash: { type: String, required: true },
  otp: { code: String, expires: Date },
}, { timestamps: true });

const PageSettingSchema = new mongoose.Schema({
  page: { type: String, required: true, unique: true }, // e.g. "home", "shop", "about"
  title: String,
  metaDescription: String,
  hero: { headline: String, subheadline: String, image: String, ctaLabel: String, ctaHref: String },
  sections: [{ key: String, label: String, visible: Boolean, order: Number, data: mongoose.Schema.Types.Mixed }],
  content: mongoose.Schema.Types.Mixed, // free-form key/value
}, { timestamps: true });

const Product = mongoose.model("Product", ProductSchema);
const Category = mongoose.model("Category", CategorySchema);
const Order = mongoose.model("Order", OrderSchema);
const Review = mongoose.model("Review", ReviewSchema);
const User = mongoose.model("User", UserSchema);
const PageSetting = mongoose.model("PageSetting", PageSettingSchema);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sha256(s) { return crypto.createHash("sha256").update(String(s)).digest("hex"); }
function signToken(payload, exp = "7d") {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: exp });
}
function authAdmin(req, res, next) {
  const h = req.headers.authorization || "";
  const tk = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!tk) return res.status(401).json({ error: "টোকেন প্রয়োজন" });
  try {
    const d = jwt.verify(tk, process.env.JWT_SECRET);
    if (d.role !== "admin") return res.status(403).json({ error: "Admin only" });
    req.admin = d; next();
  } catch { res.status(401).json({ error: "টোকেন অবৈধ" }); }
}
function authUser(req, res, next) {
  const h = req.headers.authorization || "";
  const tk = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!tk) return res.status(401).json({ error: "লগইন প্রয়োজন" });
  try {
    const d = jwt.verify(tk, process.env.JWT_SECRET);
    if (!d.userId) return res.status(403).json({ error: "User token required" });
    req.user = d; next();
  } catch { res.status(401).json({ error: "টোকেন অবৈধ" }); }
}
// Optional auth: attach req.user if token is valid, otherwise proceed
function optionalUser(req, res, next) {
  const h = req.headers.authorization || "";
  const tk = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (tk) { try { req.user = jwt.verify(tk, process.env.JWT_SECRET); } catch {} }
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
// CUSTOMER AUTH (signup / login / forgot / reset)
// ═════════════════════════════════════════════════════════════════════════════
app.post("/api/customer/signup", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ error: "সব ঘর পূরণ করুন" });
    if (String(password).length < 6) return res.status(400).json({ error: "পাসওয়ার্ড কমপক্ষে ৬ অক্ষর" });
    const exists = await User.findOne({ email: String(email).toLowerCase() });
    if (exists) return res.status(400).json({ error: "এই ইমেইলে অ্যাকাউন্ট আছে" });
    const user = await User.create({ name, email, phone, passwordHash: sha256(password) });
    const token = signToken({ userId: user._id, email: user.email, name: user.name });
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email, phone: user.phone } });
  } catch (err) { res.status(400).json({ error: err.message }); }
});
app.post("/api/customer/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const user = await User.findOne({ email: String(email || "").toLowerCase() });
    if (!user || user.passwordHash !== sha256(password || ""))
      return res.status(401).json({ error: "ইমেইল বা পাসওয়ার্ড ভুল" });
    const token = signToken({ userId: user._id, email: user.email, name: user.name });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, phone: user.phone } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/customer/forgot", async (req, res) => {
  try {
    const email = String(req.body?.email || "").toLowerCase();
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "এই ইমেইলে অ্যাকাউন্ট নেই" });
    const code = String(Math.floor(100000 + Math.random() * 900000));
    user.otp = { code, expires: new Date(Date.now() + 10 * 60 * 1000) };
    await user.save();
    appsScriptPost({ action: "sendOtp", email, code });
    res.json({ ok: true, msg: "OTP আপনার ইমেইলে পাঠানো হয়েছে" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/customer/reset", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body || {};
    const user = await User.findOne({ email: String(email || "").toLowerCase() });
    if (!user || !user.otp?.code) return res.status(400).json({ error: "OTP পাঠানো হয়নি" });
    if (user.otp.code !== String(code || "").trim())
      return res.status(400).json({ error: "OTP ভুল" });
    if (!user.otp.expires || user.otp.expires < new Date())
      return res.status(400).json({ error: "OTP মেয়াদ শেষ" });
    if (!newPassword || String(newPassword).length < 6)
      return res.status(400).json({ error: "নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষর" });
    user.passwordHash = sha256(newPassword);
    user.otp = undefined;
    await user.save();
    res.json({ ok: true, msg: "পাসওয়ার্ড পরিবর্তন সফল" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.get("/api/customer/me", authUser, async (req, res) => {
  const user = await User.findById(req.user.userId).select("-passwordHash -otp");
  res.json(user);
});

// Admin: list / delete users
app.get("/api/users", authAdmin, async (req, res) => {
  const users = await User.find().select("-passwordHash -otp").sort({ createdAt: -1 });
  res.json(users);
});
app.delete("/api/users/:id", authAdmin, async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// ═════════════════════════════════════════════════════════════════════════════
// PRODUCTS
// ═════════════════════════════════════════════════════════════════════════════
function slugifyForFile(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

app.get("/api/products", async (req, res) => {
  try {
    const { cat, featured, limit, search, placement } = req.query;
    const filter = {};
    if (cat) filter.categorySlug = cat;
    if (featured === "true") filter.featured = true;
    if (placement) filter["placements." + placement] = true;
    if (search) filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { sku: { $regex: search, $options: "i" } },
      { cat: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
    let q = Product.find(filter).sort({ createdAt: -1 });
    if (limit) q = q.limit(parseInt(limit));
    res.json(await q);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/products/id/:id", async (req, res) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ error: "পণ্য পাওয়া যায়নি" });
    res.json(p);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.get("/api/products/sku/:sku", async (req, res) => {
  try {
    const p = await Product.findOne({ sku: req.params.sku });
    if (!p) return res.status(404).json({ error: "পণ্য পাওয়া যায়নি" });
    res.json(p);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Create product — auto-generates detail-page path if not provided
app.post("/api/products", authAdmin, async (req, res) => {
  try {
    const body = { ...req.body };
    if (!body.detailPage && body.sku) body.detailPage = "product-" + slugifyForFile(body.sku) + ".html";
    body.hasDetailPage = Boolean(body.detailPage);
    const p = new Product(body);
    await p.save();
    if (p.categorySlug) await Category.findOneAndUpdate({ slug: p.categorySlug }, { $inc: { count: 1 } });
    res.status(201).json(p);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.put("/api/products/id/:id", authAdmin, async (req, res) => {
  try {
    const u = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!u) return res.status(404).json({ error: "পণ্য পাওয়া যায়নি" });
    res.json(u);
  } catch (err) { res.status(400).json({ error: err.message }); }
});
app.delete("/api/products/id/:id", authAdmin, async (req, res) => {
  try {
    const d = await Product.findByIdAndDelete(req.params.id);
    if (!d) return res.status(404).json({ error: "পণ্য পাওয়া যায়নি" });
    if (d.categorySlug) await Category.findOneAndUpdate({ slug: d.categorySlug }, { $inc: { count: -1 } });
    res.json({ message: "মুছে ফেলা হয়েছে", id: req.params.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Decrement stock (frontend triggers on delivery/completion — admin-only)
app.post("/api/products/:id/decrement-stock", authAdmin, async (req, res) => {
  const qty = Math.max(1, parseInt(req.body?.qty || 1, 10));
  const p = await Product.findByIdAndUpdate(req.params.id, { $inc: { stock: -qty } }, { new: true });
  if (!p) return res.status(404).json({ error: "পণ্য নেই" });
  res.json(p);
});

// Image upload (single or multi via ?field=images)
app.post("/api/products/upload", authAdmin, upload.array("images", 10), (req, res) => {
  const files = req.files || [];
  if (!files.length && req.file) files.push(req.file);
  if (!files.length) return res.status(400).json({ error: "কোনো ছবি পাওয়া যায়নি" });
  res.json({ urls: files.map(f => f.path) });
});

// ═════════════════════════════════════════════════════════════════════════════
// CATEGORIES
// ═════════════════════════════════════════════════════════════════════════════
app.get("/api/categories", async (req, res) => {
  try { res.json(await Category.find().sort({ name: 1 })); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/categories", authAdmin, async (req, res) => {
  try { const c = new Category(req.body); await c.save(); res.status(201).json(c); }
  catch (err) { res.status(400).json({ error: err.message }); }
});
app.put("/api/categories/:id", authAdmin, async (req, res) => {
  try {
    const u = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!u) return res.status(404).json({ error: "ক্যাটাগরি পাওয়া যায়নি" });
    res.json(u);
  } catch (err) { res.status(400).json({ error: err.message }); }
});
app.delete("/api/categories/:id", authAdmin, async (req, res) => {
  try {
    const d = await Category.findByIdAndDelete(req.params.id);
    if (!d) return res.status(404).json({ error: "ক্যাটাগরি পাওয়া যায়নি" });
    res.json({ message: "মুছে ফেলা হয়েছে" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═════════════════════════════════════════════════════════════════════════════
// ORDERS  (with Fake-Order Detection)
// ═════════════════════════════════════════════════════════════════════════════
async function computeFakeScore(order, req) {
  let score = 0; const reasons = [];
  const phone = String(order.customer?.phone || "").replace(/\D/g, "");
  const email = String(order.customer?.email || "").toLowerCase();
  const ip = order.meta?.ip || "";

  // 1) Same phone recently used
  if (phone) {
    const recent = await Order.countDocuments({
      "customer.phone": order.customer.phone,
      createdAt: { $gte: new Date(Date.now() - 24 * 3600 * 1000) },
    });
    if (recent > 3) { score += 30; reasons.push("গত ২৪ ঘন্টায় একই ফোন থেকে " + recent + "টি অর্ডার"); }
    if (recent > 0) order.meta.duplicateCount = recent;
  }
  // 2) Same IP many orders
  if (ip) {
    const ipCount = await Order.countDocuments({ "meta.ip": ip, createdAt: { $gte: new Date(Date.now() - 24 * 3600 * 1000) } });
    if (ipCount > 5) { score += 25; reasons.push("একই IP থেকে অনেক অর্ডার"); }
  }
  // 3) Invalid BD phone
  if (phone && !/^(?:88)?01[0-9]{9}$/.test(phone)) { score += 20; reasons.push("অবৈধ বাংলাদেশী ফোন নাম্বার"); }
  // 4) Very short name / address
  if (String(order.customer?.name || "").trim().length < 3) { score += 15; reasons.push("খুবই ছোট নাম"); }
  if (String(order.customer?.address || "").trim().length < 10) { score += 15; reasons.push("খুবই ছোট ঠিকানা"); }
  // 5) Disposable / suspicious email
  if (email && /(mailinator|tempmail|guerrillamail|10minutemail|throwaway)/i.test(email)) { score += 15; reasons.push("অস্থায়ী ইমেইল"); }
  // 6) Abnormally huge quantity
  const totalQty = (order.items || []).reduce((s, i) => s + (+i.qty || 0), 0);
  if (totalQty > 20) { score += 15; reasons.push("অস্বাভাবিক বড় পরিমাণ (" + totalQty + ")"); }
  // 7) Very large amount
  if ((order.total || 0) > 100000) { score += 10; reasons.push("অস্বাভাবিক বড় অ্যামাউন্ট"); }

  order.fakeScore = Math.min(100, score);
  order.fakeReasons = reasons;
  order.isFake = score >= 50;
  return order;
}

app.get("/api/orders", authAdmin, async (req, res) => {
  try {
    const { status, limit, page = 1, fake, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (fake === "true") filter.isFake = true;
    if (fake === "false") filter.isFake = false;
    if (search) filter.$or = [
      { orderId: { $regex: search, $options: "i" } },
      { "customer.name": { $regex: search, $options: "i" } },
      { "customer.phone": { $regex: search, $options: "i" } },
      { "customer.email": { $regex: search, $options: "i" } },
    ];
    const per = parseInt(limit) || 50;
    const orders = await Order.find(filter).sort({ createdAt: -1 }).skip((parseInt(page) - 1) * per).limit(per);
    const total = await Order.countDocuments(filter);
    res.json({ orders, total, page: parseInt(page), perPage: per });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/orders", optionalUser, async (req, res) => {
  try {
    const body = { ...req.body };
    body.meta = body.meta || {};
    body.meta.ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
    body.meta.userAgent = req.headers["user-agent"] || "";
    body.meta.referer = req.headers["referer"] || "";
    const order = new Order(body);
    await computeFakeScore(order, req);
    await order.save();
    // Fire-and-forget Apps Script notification
    appsScriptPost({
      action: "newOrder",
      order: {
        id: order.orderId,
        customer: order.customer,
        items: order.items,
        subtotal: order.subtotal,
        shipping: order.deliveryCharge,
        total: order.total,
        fakeScore: order.fakeScore,
        fakeReasons: order.fakeReasons,
      },
    });
    res.status(201).json(order);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.patch("/api/orders/:id", authAdmin, async (req, res) => {
  try {
    const { status, note } = req.body || {};
    const upd = {}; if (status) upd.status = status; if (note !== undefined) upd.note = note;
    const u = await Order.findByIdAndUpdate(req.params.id, upd, { new: true });
    if (!u) return res.status(404).json({ error: "অর্ডার নেই" });
    // On completion → decrement stock
    if (status === "Completed") {
      for (const it of u.items || []) {
        if (it.productId) await Product.findByIdAndUpdate(it.productId, { $inc: { stock: -(it.qty || 1) } });
      }
    }
    res.json(u);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post("/api/orders/:id/mark-fake", authAdmin, async (req, res) => {
  const u = await Order.findByIdAndUpdate(req.params.id, { isFake: true, status: "Fake" }, { new: true });
  if (!u) return res.status(404).json({ error: "অর্ডার নেই" });
  res.json(u);
});

app.delete("/api/orders/:id", authAdmin, async (req, res) => {
  const d = await Order.findByIdAndDelete(req.params.id);
  if (!d) return res.status(404).json({ error: "অর্ডার নেই" });
  res.json({ message: "মুছে ফেলা হয়েছে" });
});

// ═════════════════════════════════════════════════════════════════════════════
// REVIEWS (+ Questions)
// ═════════════════════════════════════════════════════════════════════════════
// Public: list visible reviews for a product
app.get("/api/reviews/:productId", async (req, res) => {
  const list = await Review.find({ productId: req.params.productId, visible: true }).sort({ createdAt: -1 });
  res.json(list);
});
// Customer: submit review (requires login)
app.post("/api/reviews", authUser, async (req, res) => {
  try {
    const { productId, productName, text, rating, type } = req.body || {};
    if (!productId || !text) return res.status(400).json({ error: "প্রয়োজনীয় তথ্য নেই" });
    const r = await Review.create({
      productId, productName,
      user: req.user.name, email: req.user.email, userId: req.user.userId,
      text: String(text).slice(0, 1000),
      rating: rating || 5,
      type: type === "question" ? "question" : "review",
      visible: true,
    });
    res.status(201).json(r);
  } catch (err) { res.status(400).json({ error: err.message }); }
});
// Admin
app.get("/api/admin/reviews", authAdmin, async (req, res) => {
  const list = await Review.find().sort({ createdAt: -1 });
  res.json(list);
});
app.patch("/api/admin/reviews/:id", authAdmin, async (req, res) => {
  const u = await Review.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!u) return res.status(404).json({ error: "রিভিউ নেই" });
  res.json(u);
});
app.delete("/api/admin/reviews/:id", authAdmin, async (req, res) => {
  await Review.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// ═════════════════════════════════════════════════════════════════════════════
// PAGE SETTINGS  (per frontend page)
// ═════════════════════════════════════════════════════════════════════════════
const DEFAULT_PAGES = [
  { page: "home", label: "হোম" },
  { page: "shop", label: "শপ" },
  { page: "about", label: "About" },
  { page: "contact", label: "Contact" },
  { page: "wishlist", label: "Wishlist" },
  { page: "account", label: "Account" },
  { page: "privacy-policy", label: "Privacy Policy" },
  { page: "terms-of-service", label: "Terms of Service" },
  { page: "return-refund-policy", label: "Return / Refund" },
  { page: "shipping-policy", label: "Shipping Policy" },
];

app.get("/api/page-settings", async (req, res) => {
  const all = await PageSetting.find();
  const map = {}; all.forEach(p => { map[p.page] = p; });
  const merged = DEFAULT_PAGES.map(d => ({ ...d, ...(map[d.page]?.toObject() || {}) }));
  res.json(merged);
});
app.get("/api/page-settings/:page", async (req, res) => {
  const p = await PageSetting.findOne({ page: req.params.page });
  res.json(p || { page: req.params.page });
});
app.put("/api/page-settings/:page", authAdmin, async (req, res) => {
  const p = await PageSetting.findOneAndUpdate(
    { page: req.params.page },
    { ...req.body, page: req.params.page },
    { new: true, upsert: true, runValidators: true }
  );
  res.json(p);
});

// ═════════════════════════════════════════════════════════════════════════════
// STATS
// ═════════════════════════════════════════════════════════════════════════════
app.get("/api/stats", authAdmin, async (req, res) => {
  try {
    const [totalProducts, totalOrders, pendingOrders, completedOrders, cancelledOrders,
           fakeOrders, totalCategories, totalUsers, totalReviews] = await Promise.all([
      Product.countDocuments(), Order.countDocuments(),
      Order.countDocuments({ status: "Pending" }),
      Order.countDocuments({ status: "Completed" }),
      Order.countDocuments({ status: "Cancelled" }),
      Order.countDocuments({ isFake: true }),
      Category.countDocuments(), User.countDocuments(),
      Review.countDocuments(),
    ]);
    const revenueAgg = await Order.aggregate([
      { $match: { status: { $in: ["Completed", "Shipped"] } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]);
    const inStock = await Product.countDocuments({ stock: { $gt: 5 } });
    const lowStock = await Product.countDocuments({ stock: { $gt: 0, $lte: 5 } });
    const outOfStock = await Product.countDocuments({ stock: 0 });
    res.json({
      totalProducts, totalOrders, pendingOrders, completedOrders, cancelledOrders,
      fakeOrders, totalCategories, totalUsers, totalReviews,
      totalRevenue: revenueAgg[0]?.total || 0,
      inStock, lowStock, outOfStock,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: "Route not found" }));
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
