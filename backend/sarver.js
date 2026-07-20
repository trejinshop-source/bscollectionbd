/*
 * BS Collection BD — Express Backend (sarver.js)
 * Routes: /api/auth, /api/products, /api/categories, /api/orders
 */
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const https = require("https");

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Cloudinary config ────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl / same-origin
      if (allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error("Not allowed by CORS: " + origin));
    },
    credentials: true,
  })
);
app.use(express.json());

// ─── MongoDB connect ──────────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err.message));

// ─── Mongoose Schemas ─────────────────────────────────────────────────────────
const ProductSchema = new mongoose.Schema(
  {
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
    rating: { type: Number, default: 0 },
    specs: [{ label: String, value: String }],
  },
  { timestamps: true }
);

const CategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, unique: true, required: true },
    img: String,
    count: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const OrderSchema = new mongoose.Schema(
  {
    orderId: String,
    customer: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      address: { type: String, required: true },
      email: String,
    },
    items: [
      {
        productId: String,
        sku: String,
        name: String,
        price: Number,
        qty: { type: Number, default: 1 },
        img: String,
      },
    ],
    subtotal: Number,
    deliveryCharge: { type: Number, default: 60 },
    total: Number,
    paymentMethod: { type: String, default: "COD" },
    status: {
      type: String,
      enum: ["Pending", "Processing", "Shipped", "Completed", "Cancelled"],
      default: "Pending",
    },
    note: String,
  },
  { timestamps: true }
);

// Auto-generate orderId before save
OrderSchema.pre("save", async function (next) {
  if (!this.orderId) {
    const count = await mongoose.model("Order").countDocuments();
    this.orderId = "BS-" + String(count + 1001).padStart(5, "0");
  }
  next();
});

const Product = mongoose.model("Product", ProductSchema);
const Category = mongoose.model("Category", CategorySchema);
const Order = mongoose.model("Order", OrderSchema);

// ─── Auth Middleware ──────────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "টোকেন প্রয়োজন" });
  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "টোকেন অবৈধ বা মেয়াদ শেষ" });
  }
}

// ─── Cloudinary Multer Storage ────────────────────────────────────────────────
const storage = new CloudinaryStorage({
  cloudinary,
  params: { folder: "bscollectionbd", allowed_formats: ["jpg", "jpeg", "png", "webp"] },
});
const upload = multer({ storage });

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════════════════════
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (
    username !== process.env.ADMIN_USERNAME ||
    password !== process.env.ADMIN_PASSWORD
  ) {
    return res.status(401).json({ error: "ব্যবহারকারী নাম বা পাসওয়ার্ড ভুল" });
  }
  const token = jwt.sign(
    { username, role: "admin" },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
  res.json({ token, username, role: "admin" });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTS
// ═══════════════════════════════════════════════════════════════════════════════
// GET all products
app.get("/api/products", async (req, res) => {
  try {
    const { cat, featured, limit, search } = req.query;
    const filter = {};
    if (cat) filter.categorySlug = cat;
    if (featured === "true") filter.featured = true;
    if (search) filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { sku: { $regex: search, $options: "i" } },
      { cat: { $regex: search, $options: "i" } },
    ];
    let query = Product.find(filter).sort({ createdAt: -1 });
    if (limit) query = query.limit(parseInt(limit));
    const products = await query;
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET product by ID
app.get("/api/products/id/:id", async (req, res) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ error: "পণ্য পাওয়া যায়নি" });
    res.json(p);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET product by SKU
app.get("/api/products/sku/:sku", async (req, res) => {
  try {
    const p = await Product.findOne({ sku: req.params.sku });
    if (!p) return res.status(404).json({ error: "পণ্য পাওয়া যায়নি" });
    res.json(p);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create product (admin)
app.post("/api/products", authMiddleware, async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    // Update category count
    if (product.categorySlug) {
      await Category.findOneAndUpdate(
        { slug: product.categorySlug },
        { $inc: { count: 1 } }
      );
    }
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update product (admin)
app.put("/api/products/id/:id", authMiddleware, async (req, res) => {
  try {
    const updated = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updated) return res.status(404).json({ error: "পণ্য পাওয়া যায়নি" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE product (admin)
app.delete("/api/products/id/:id", authMiddleware, async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "পণ্য পাওয়া যায়নি" });
    if (deleted.categorySlug) {
      await Category.findOneAndUpdate(
        { slug: deleted.categorySlug },
        { $inc: { count: -1 } }
      );
    }
    res.json({ message: "পণ্য মুছে ফেলা হয়েছে", id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST upload image to Cloudinary (admin)
app.post("/api/products/upload", authMiddleware, upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "কোনো ছবি পাওয়া যায়নি" });
  res.json({ url: req.file.path });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/api/categories", async (req, res) => {
  try {
    const cats = await Category.find().sort({ name: 1 });
    res.json(cats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/categories", authMiddleware, async (req, res) => {
  try {
    const cat = new Category(req.body);
    await cat.save();
    res.status(201).json(cat);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put("/api/categories/:id", authMiddleware, async (req, res) => {
  try {
    const updated = await Category.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updated) return res.status(404).json({ error: "ক্যাটাগরি পাওয়া যায়নি" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/categories/:id", authMiddleware, async (req, res) => {
  try {
    const deleted = await Category.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "ক্যাটাগরি পাওয়া যায়নি" });
    res.json({ message: "ক্যাটাগরি মুছে ফেলা হয়েছে" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ORDERS
// ═══════════════════════════════════════════════════════════════════════════════
// GET all orders (admin)
app.get("/api/orders", authMiddleware, async (req, res) => {
  try {
    const { status, limit, page = 1 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const perPage = parseInt(limit) || 50;
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * perPage)
      .limit(perPage);
    const total = await Order.countDocuments(filter);
    res.json({ orders, total, page: parseInt(page), perPage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new order (customer)
app.post("/api/orders", async (req, res) => {
  try {
    const order = new Order(req.body);
    await order.save();
    // Optional: notify via Google Apps Script
    if (process.env.APPS_SCRIPT_URL) {
      try {
        const url = new URL(process.env.APPS_SCRIPT_URL);
        const postData = JSON.stringify({
          orderId: order.orderId,
          customer: order.customer,
          total: order.total,
          items: order.items,
        });
        const opts = {
          hostname: url.hostname,
          path: url.pathname + url.search,
          method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(postData) },
        };
        const reqOut = https.request(opts);
        reqOut.write(postData);
        reqOut.end();
      } catch (_) { /* notification failure shouldn't break the order */ }
    }
    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH update order status (admin)
app.patch("/api/orders/:id", authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const updated = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: "অর্ডার পাওয়া যায়নি" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE order (admin)
app.delete("/api/orders/:id", authMiddleware, async (req, res) => {
  try {
    const deleted = await Order.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "অর্ডার পাওয়া যায়নি" });
    res.json({ message: "অর্ডার মুছে ফেলা হয়েছে" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// STATS (admin dashboard summary)
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/api/stats", authMiddleware, async (req, res) => {
  try {
    const [totalProducts, totalOrders, pendingOrders, completedOrders, cancelledOrders, totalCategories] =
      await Promise.all([
        Product.countDocuments(),
        Order.countDocuments(),
        Order.countDocuments({ status: "Pending" }),
        Order.countDocuments({ status: "Completed" }),
        Order.countDocuments({ status: "Cancelled" }),
        Category.countDocuments(),
      ]);
    const revenueAgg = await Order.aggregate([
      { $match: { status: { $in: ["Completed", "Shipped"] } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]);
    const totalRevenue = revenueAgg[0]?.total || 0;

    const inStock = await Product.countDocuments({ stock: { $gt: 5 } });
    const lowStock = await Product.countDocuments({ stock: { $gt: 0, $lte: 5 } });
    const outOfStock = await Product.countDocuments({ stock: 0 });

    res.json({
      totalProducts, totalOrders, pendingOrders, completedOrders, cancelledOrders,
      totalCategories, totalRevenue, inStock, lowStock, outOfStock,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 404 fallback ─────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: "Route not found" }));

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
