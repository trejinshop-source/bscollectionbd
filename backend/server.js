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
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (!allowedOrigins.length || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) return cb(null, true);
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
    const { name, email, phone, password } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ error: "সব ঘর পূরণ করুন" });
    if (String(password).length < 6) return res.status(400).json({ error: "পাসওয়ার্ড কমপক্ষে ৬ অক্ষর" });
    const exists = await User.findOne({ email: String(email).toLowerCase() });
    if (exists) return res.status(400).json({ error: "এই ইমেইলে অ্যাকাউন্ট আছে" });
    const user = await User.create({ name, email, phone, passwordHash: sha256(password) });
    const token = signToken({ userId: user._id, email: user.email, name: user.name, role: "customer" });
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email, phone: user.phone } });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post("/api/customer/login", async (req, res) => {
  try {
    const { email, phone, password } = req.body || {};
    const identifier = String(email || phone || "").trim();
    const isPhone = !email && phone;
    const user = isPhone
      ? await User.findOne({ phone: identifier })
      : await User.findOne({ email: identifier.toLowerCase() });
    if (!user || user.passwordHash !== sha256(password || ""))
      return res.status(401).json({ error: "ইমেইল বা পাসওয়ার্ড ভুল" });
    const token = signToken({ userId: user._id, email: user.email, name: user.name, role: "customer" });
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
    res.json({ msg: "OTP পাঠানো হয়েছে। ১০ মিনিটের মধ্যে ব্যবহার করুন।" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/customer/reset", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body || {};
    const user = await User.findOne({ email: String(email || "").toLowerCase() });
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
    const user = await User.findById(req.user.userId);
    // Match orders by email or phone
    const query = [];
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
    const p = await Product.create(req.body);
    // update category count
    if (p.categorySlug) await Category.updateOne({ slug: p.categorySlug }, { $inc: { count: 1 } });
    res.status(201).json(p);
  } catch (err) { res.status(400).json({ error: err.message }); }
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
app.post("/api/orders", async (req, res) => {
  try {
    const body = req.body || {};
    const { customer, items, subtotal, deliveryCharge, deliveryFee, total, paymentMethod, source, note } = body;
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
      })),
      subtotal: Number(subtotal) || 0,
      deliveryCharge: Number(deliveryCharge || deliveryFee) || 70,
      deliveryFee: Number(deliveryFee || deliveryCharge) || 70,
      total: Number(total) || 0,
      paymentMethod: paymentMethod || "COD",
      source: source || "site",
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
        { icon: "fa-money-bill-wave", title: "Cash on Delivery", text: "আগে পণ্য হাতে নিন, তারপর মূল্য পরিশোধ করুন।" },
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
  { id: "table-fan", label: "Table Fan", filter: "cat:table-fans", order: 4, visible: true },
  { id: "rechargeable", label: "Rechargeable Fan", filter: "cat:rechargeable-fans", order: 5, visible: true },
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
app.post("/api/seed", authAdmin, async (req, res) => {
  try {
    const results = { categories: 0, products: 0, skipped: 0 };

    const defaultCategories = [
      { name: "Ceiling Fans", slug: "ceiling-fans", img: "https://5.imimg.com/data5/TI/ES/TB/SELLER-93582485/bldc-ceiling-fan.jpg", count: 0 },
      { name: "Table Fans", slug: "table-fans", img: "https://bscollectionbd.onrender.com/placeholder-fan.jpg", count: 2 },
      { name: "Stand Fans", slug: "stand-fans", img: "https://m.media-amazon.com/images/I/71X-Pth5ULS.jpg", count: 0 },
      { name: "Industrial Fans", slug: "industrial-fans", img: "", count: 0 },
      { name: "Exhaust Fans", slug: "exhaust-fans", img: "", count: 0 },
      { name: "Rechargeable Fans", slug: "rechargeable-fans", img: "", count: 2 },
      { name: "LED Lights", slug: "led-lights", img: "", count: 0 },
      { name: "Wall Fans", slug: "wall-fans", img: "", count: 0 },
      { name: "Accessories", slug: "accessories", img: "", count: 0 },
    ];

    for (const cat of defaultCategories) {
      const exists = await Category.findOne({ slug: cat.slug });
      if (!exists) { await Category.create(cat); results.categories++; }
    }

    const defaultProducts = [
      {
        sku: "jy2570", name: "JY-2570 Rechargeable Fan",
        cat: "Rechargeable Fan", categorySlug: "rechargeable-fans",
        brand: "JYSUPER", now: 2150, old: 2550, stock: 10, featured: true, rating: 5,
        img: "assets/photo_2026-07-15_18-29-17.png",
        gallery: ["assets/photo_2026-07-15_18-29-17.png"],
        description: "Premium rechargeable fan with high-capacity battery, remote control and dual LED light bar.",
        shortDescription: "Premium rechargeable fan with remote control",
        detailPage: "product-jy2570.html", hasDetailPage: true,
        tags: ["rechargeable", "fan", "LED", "remote control", "battery"],
        seoTitle: "JY-2570 Rechargeable Fan - Buy Online in Bangladesh | BS Collection BD",
        seoDescription: "Buy JY-2570 Rechargeable Fan at best price in Bangladesh. 14-inch, 12-hour backup, remote control, dual LED. Fast delivery nationwide.",
        seoKeywords: "JY-2570, rechargeable fan, battery fan bangladesh, LED fan",
        specs: [
          { label: "Model", value: "JY-2570" },
          { label: "Blade Size", value: "14 inch" },
          { label: "Battery", value: "6V / 7Ah" },
          { label: "Backup Time", value: "Up to 12 hours" },
          { label: "LED Light", value: "Dual LED bar" },
          { label: "Remote Control", value: "Included" },
          { label: "Warranty", value: "6 months" },
        ],
        features: ["14-inch wide blade", "12-hour battery backup", "Wireless remote control", "Dual LED light bar", "Solar compatible"],
        placements: { shop: true, homePopular: true, homeBestseller: false, homeNew: false },
      },
      {
        sku: "jy2218", name: "JYSUPER JY-2218 Rechargeable Fan",
        cat: "Rechargeable Fan", categorySlug: "rechargeable-fans",
        brand: "JYSUPER", now: 999, old: 1200, stock: 10, featured: true, rating: 4,
        img: "assets/photo_2026-07-15_18-28-56.png",
        gallery: ["assets/photo_2026-07-15_18-28-56.png"],
        description: "12-inch high-airflow rechargeable table & stand fan with LED light, USB charging and long backup.",
        shortDescription: "12-inch rechargeable fan with LED light",
        detailPage: "product-jy2218.html", hasDetailPage: true,
        tags: ["rechargeable", "fan", "LED", "USB", "table fan"],
        seoTitle: "JYSUPER JY-2218 Rechargeable Fan - Buy in Bangladesh | BS Collection BD",
        seoDescription: "Buy JYSUPER JY-2218 Rechargeable Fan at Tk 999. 12-inch blade, 8-hour backup, built-in LED. Best price in Bangladesh.",
        seoKeywords: "JY-2218, JYSUPER fan, rechargeable fan price, LED fan bangladesh",
        specs: [
          { label: "Model", value: "JY-2218" },
          { label: "Blade Size", value: "12 inch" },
          { label: "Battery", value: "6V / 4.5Ah" },
          { label: "Backup Time", value: "Up to 8 hours" },
          { label: "LED Light", value: "Built-in LED panel" },
          { label: "Warranty", value: "6 months" },
        ],
        features: ["12-inch blade", "8-hour battery backup", "Built-in LED panel", "USB charging compatible"],
        placements: { shop: true, homePopular: false, homeBestseller: true, homeNew: false },
      },
    ];

    for (const prod of defaultProducts) {
      const exists = await Product.findOne({ sku: prod.sku });
      if (!exists) { await Product.create(prod); results.products++; }
      else { results.skipped++; }
    }

    // Also seed about page settings
    const aboutExists = await PageSetting.findOne({ page: "about" });
    if (!aboutExists) {
      await PageSetting.create(DEFAULT_PAGES.find(d => d.page === "about"));
    }

    res.json({ ok: true, ...results, message: `Seeded: ${results.categories} categories, ${results.products} products (${results.skipped} skipped)` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═════════════════════════════════════════════════════════════════════════════
// STATS
// ═════════════════════════════════════════════════════════════════════════════
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

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: "Route not found" }));
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));