require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

/* =========================================================================
   CLOUDINARY CONFIG + IMAGE UPLOAD
   ========================================================================= */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "bscollectionbd/products",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 1200, height: 1200, crop: "limit" }],
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

/* =========================================================================
   MODELS (Product / Category / Order)
   ========================================================================= */
const productSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, unique: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    cat: { type: String, required: true },
    categorySlug: { type: String, default: "" },
    brand: { type: String, default: "bscollectionbd" },
    now: { type: Number, required: true },
    old: { type: Number, default: 0 },
    rating: { type: Number, default: 5, min: 0, max: 5 },
    stock: { type: Number, default: 0 },
    description: { type: String, default: "" },
    img: { type: String, default: "" },
    gallery: { type: [String], default: [] },
    colors: { type: [String], default: [] },
    featured: { type: Boolean, default: false },
    detailPage: { type: String, default: "" },
    highlights: { type: [String], default: [] },
  },
  { timestamps: true }
);
productSchema.set("toJSON", { transform: (_d, ret) => { ret.id = ret._id; return ret; } });
const Product = mongoose.model("Product", productSchema);

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    img: { type: String, default: "" },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);
categorySchema.set("toJSON", { transform: (_d, ret) => { ret.id = ret._id; return ret; } });
const Category = mongoose.model("Category", categorySchema);

const orderSchema = new mongoose.Schema(
  {
    customer: {
      name: String, phone: String, division: String, district: String,
      upazila: String, union: String, area: String,
    },
    items: { type: Array, default: [] },
    deliveryFee: { type: Number, default: 70 },
    subtotal: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    source: { type: String, default: "site" },
    status: {
      type: String,
      enum: ["pending", "confirmed", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: true }
);
orderSchema.set("toJSON", { transform: (_d, ret) => { ret.id = ret._id; return ret; } });
const Order = mongoose.model("Order", orderSchema);

/* =========================================================================
   AUTH MIDDLEWARE
   ========================================================================= */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "লগইন প্রয়োজন (No token provided)" });
  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: "সেশন মেয়াদোত্তীর্ণ, আবার লগইন করুন" });
  }
}

/* =========================================================================
   SEED HELPER — প্রথমবার সার্ভার চালু হলে ডাটাবেস খালি থাকলে ডিফল্ট
   ক্যাটাগরি ও প্রোডাক্ট (JY-2570, JY-2218) বসিয়ে দেয়। আলাদা কোনো
   seed.js ফাইলের দরকার নেই — এটা সার্ভার স্টার্টআপেই চলে।
   ========================================================================= */
async function seedIfEmpty() {
  const catCount = await Category.countDocuments();
  if (catCount === 0) {
    await Category.insertMany([
      { name: "Ceiling Fans", slug: "ceiling-fans", img: "https://5.imimg.com/data5/TI/ES/TB/SELLER-93582485/bldc-ceiling-fan.jpg", order: 1 },
      { name: "Table Fans", slug: "table-fans", img: "assets/photo_2026-07-15_18-28-56.png", order: 2 },
      { name: "Stand Fans", slug: "stand-fans", img: "https://m.media-amazon.com/images/I/71X-Pth5ULS.jpg", order: 3 },
      { name: "Industrial Fans", slug: "industrial-fans", img: "", order: 4 },
      { name: "Exhaust Fans", slug: "exhaust-fans", img: "", order: 5 },
      { name: "Rechargeable Fans", slug: "rechargeable-fans", img: "assets/photo_2026-07-15_18-29-17.png", order: 6 },
      { name: "LED Lights", slug: "led-lights", img: "", order: 7 },
      { name: "Home Appliances", slug: "home-appliances", img: "", order: 8 },
      { name: "Wall Fans", slug: "wall-fans", img: "", order: 9 },
      { name: "Accessories", slug: "accessories", img: "", order: 10 },
    ]);
    console.log("✔ ডিফল্ট ক্যাটাগরি সিড করা হয়েছে");
  }

  const prodCount = await Product.countDocuments();
  if (prodCount === 0) {
    await Product.insertMany([
      {
        sku: "jy2570", name: "JY-2570 Rechargeable Fan", cat: "Table Fan",
        categorySlug: "table-fans", now: 2150, old: 2550, rating: 5, stock: 10,
        description: "JY-2570 Rechargeable Fan-এ পাবেন শক্তিশালী বাতাসের সাথে আধুনিক সুবিধা। বিল্ট-ইন রিচার্জেবল ব্যাটারি, LED লাইট ও USB চার্জিং পোর্ট সহ।",
        img: "assets/photo_2026-07-15_18-29-17.png",
        gallery: ["assets/photo_2026-07-15_18-29-17.png"],
        featured: true, detailPage: "product-jy2570.html",
      },
      {
        sku: "jy2218", name: "JYSUPER JY-2218 Rechargeable Fan", cat: "Table Fan",
        categorySlug: "table-fans", now: 999, old: 1200, rating: 4, stock: 10,
        description: "JYSUPER JY-2218 Rechargeable Fan-এ পাবেন শক্তিশালী বাতাসের সাথে আধুনিক সুবিধা। এতে রয়েছে বিল্ট-ইন রিচার্জেবল ব্যাটারি, LED লাইট ও USB চার্জিং পোর্ট।",
        img: "assets/photo_2026-07-15_18-28-56.png",
        gallery: ["assets/photo_2026-07-15_18-28-56.png", "assets/jy2218-grey.png"],
        featured: true, detailPage: "product-jy2218.html",
      },
    ]);
    console.log("✔ ডিফল্ট প্রোডাক্ট (jy2570, jy2218) সিড করা হয়েছে");
  }
}

/* =========================================================================
   APP + MIDDLEWARE
   ========================================================================= */
const app = express();
app.use(express.json({ limit: "10mb" }));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",").map((o) => o.trim()).filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS: " + origin));
    },
    credentials: true,
  })
);

/* =========================================================================
   ROUTES — AUTH
   ========================================================================= */
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "ইউজারনেম ও পাসওয়ার্ড দিন" });
  }
  if (username !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "ভুল ইউজারনেম বা পাসওয়ার্ড" });
  }
  const token = jwt.sign({ username, role: "admin" }, process.env.JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, username });
});

app.get("/api/auth/verify", (req, res) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ valid: false });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ valid: true, username: payload.username });
  } catch {
    res.status(401).json({ valid: false });
  }
});

/* =========================================================================
   ROUTES — PRODUCTS
   ========================================================================= */
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: "পণ্য লোড করতে সমস্যা হয়েছে" });
  }
});

app.get("/api/products/:sku", async (req, res) => {
  try {
    const product = await Product.findOne({ sku: req.params.sku.toLowerCase() });
    if (!product) return res.status(404).json({ error: "পণ্য পাওয়া যায়নি" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: "পণ্য লোড করতে সমস্যা হয়েছে" });
  }
});

app.post("/api/products", requireAuth, async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "এই SKU দিয়ে আগে থেকেই একটি পণ্য আছে" });
    res.status(400).json({ error: err.message });
  }
});

app.put("/api/products/id/:id", requireAuth, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ error: "পণ্য পাওয়া যায়নি" });
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/products/id/:id", requireAuth, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: "পণ্য পাওয়া যায়নি" });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/products/upload", requireAuth, upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "কোনো ছবি পাওয়া যায়নি" });
  res.json({ url: req.file.path });
});

/* =========================================================================
   ROUTES — CATEGORIES
   ========================================================================= */
app.get("/api/categories", async (req, res) => {
  try {
    const categories = await Category.find().sort({ order: 1, createdAt: 1 });
    const withCounts = await Promise.all(
      categories.map(async (c) => {
        const count = await Product.countDocuments({ categorySlug: c.slug });
        return { ...c.toJSON(), count };
      })
    );
    res.json(withCounts);
  } catch (err) {
    res.status(500).json({ error: "ক্যাটাগরি লোড করতে সমস্যা হয়েছে" });
  }
});

app.post("/api/categories", requireAuth, async (req, res) => {
  try {
    const category = await Category.create(req.body);
    res.status(201).json(category);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "এই slug দিয়ে আগে থেকেই একটি ক্যাটাগরি আছে" });
    res.status(400).json({ error: err.message });
  }
});

app.put("/api/categories/:id", requireAuth, async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!category) return res.status(404).json({ error: "ক্যাটাগরি পাওয়া যায়নি" });
    res.json(category);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/categories/:id", requireAuth, async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ error: "ক্যাটাগরি পাওয়া যায়নি" });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* =========================================================================
   ROUTES — ORDERS
   ========================================================================= */
app.post("/api/orders", async (req, res) => {
  try {
    const order = await Order.create(req.body);
    if (process.env.APPS_SCRIPT_URL) {
      fetch(process.env.APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(order),
      }).catch(() => {});
    }
    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/orders", requireAuth, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: "অর্ডার লোড করতে সমস্যা হয়েছে" });
  }
});

app.patch("/api/orders/:id", requireAuth, async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!order) return res.status(404).json({ error: "অর্ডার পাওয়া যায়নি" });
    res.json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/orders/:id", requireAuth, async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ error: "অর্ডার পাওয়া যায়নি" });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* =========================================================================
   HEALTH + 404 + ERROR HANDLER
   ========================================================================= */
app.get("/", (req, res) => {
  res.json({ ok: true, service: "bscollectionbd-backend", time: new Date().toISOString() });
});
app.get("/api/health", (req, res) => {
  res.json({ ok: true, dbState: mongoose.connection.readyState });
});

app.use((req, res) => {
  res.status(404).json({ error: "Route পাওয়া যায়নি" });
});

app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(err.status || 500).json({ error: err.message || "সার্ভার ত্রুটি" });
});

/* =========================================================================
   START
   ========================================================================= */
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log("✅ MongoDB connected");
    await seedIfEmpty();
    app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });
