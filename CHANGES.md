# BS Collection BD — আপডেট পরিবর্তনের তালিকা

তারিখ: ২০ জুলাই ২০২৫

---

## Fix 1 — Forgot Password / OTP (Backend ব্যবহারকারীদের জন্য)

**সমস্যা:** `account.html`-এর forgot password শুধু localStorage খুঁজত। MongoDB-তে রেজিস্টার করা ব্যবহারকারীরা "এই জিমেইলে কোন একাউন্ট নেই" এরর পেত।

**সমাধান:** `account.html`-এ `doForgot` ও `doReset` function override করা হয়েছে:
- Email দিয়ে forgot করলে backend API (`/api/customer/forgot`) call করে
- OTP verify করতে backend API (`/api/customer/reset`) call করে
- Phone number দিয়ে forgot করলে আগের local flow কাজ করে
- সফল OTP পাঠালে banner দেখায়: "আপনার email-এ OTP পাঠানো হয়েছে"

**পরিবর্তিত ফাইল:** `frontend/account.html`

---

## Fix 2 — Profile-এ Orders দেখানো (userId দিয়ে match)

**সমস্যা:** `/api/customer/orders` শুধু email ও phone দিয়ে খুঁজত। অনেক অর্ডারে email/phone ছিল না, তাই profile-এ দেখাত না।

**সমাধান:**
- `OrderSchema`-এ `userId` field যোগ করা হয়েছে (indexed)
- POST `/api/orders`-এ `optionalUser` middleware যোগ করা হয়েছে — লগইন থাকলে `userId` automatically অর্ডারে save হয়
- GET `/api/customer/orders`-এ `userId` দিয়েও match করে (`$or: [userId, email, phone]`)

**পরিবর্তিত ফাইল:** `backend/server.js`

---

## Fix 3 — Admin থেকে Landing Page তৈরি করা

**সমস্যা:** Admin থেকে নতুন product landing page তৈরির কোনো উপায় ছিল না। Static HTML file manually edit করতে হত।

**সমাধান:**

### backend/server.js
- নতুন `LandingPage` Mongoose schema যোগ করা হয়েছে:
  - `slug`, `title`, `metaDescription`, `active`
  - `hero` (headline, subheadline, image, priceNow, priceOld, ctaLabel, ctaLink)
  - `features[]`, `specs[]`, `gallery[]`, `reviews[]`, `faq[]`
- নতুন API routes:
  - `GET /api/landing-pages` — সব পেজের list (public)
  - `GET /api/landing-pages/:slug` — একটি পেজের data (public)
  - `POST /api/landing-pages` — নতুন পেজ তৈরি (admin only)
  - `PUT /api/landing-pages/:slug` — পেজ আপডেট (admin only, upsert)
  - `DELETE /api/landing-pages/:slug` — পেজ মুছে ফেলা (admin only)

### admin_panel/admin.html
- Sidebar-এ নতুন **"ল্যান্ডিং পেজ"** nav item যোগ করা হয়েছে
- নতুন **Landing Pages management page** (`#page-landingpages`):
  - সব পেজের table (নাম, headline, URL, status, তারিখ)
  - Copy URL বাটন (clipboard-এ কপি হয়)
  - Preview বাটন, Edit বাটন, Delete বাটন
  - ব্যবহারের নির্দেশনা (কিভাবে পণ্যের সাথে লিংক করবেন)
- নতুন **Landing Page Modal** (create/edit):
  - মূল তথ্য: Title, Slug, Meta Description
  - Hero সেকশন: Headline, Sub-headline, দাম, CTA বাটন, ছবি URL
  - বৈশিষ্ট্য (Features): dynamic add/remove
  - স্পেসিফিকেশন (Specs): label-value pairs
  - গ্যালারি: multi-line URL input
  - রিভিউ: নাম, rating, text
  - FAQ: প্রশ্ন-উত্তর pairs
  - Active toggle

### frontend/landing.html (নতুন ফাইল)
- Dynamic landing page renderer
- URL থেকে `?slug=` পড়ে backend থেকে data fetch করে
- Sections render করে: Hero, Features, Gallery, Specs, Reviews, FAQ, Bottom CTA
- Sticky order button (scroll করলে দেখা যায়)
- Image lightbox (gallery ছবি click করলে বড় হয়)
- Responsive design (mobile-friendly)
- Error handling (পেজ না পেলে friendly error)

---

## Landing Page ব্যবহারের নির্দেশনা

1. Admin panel-এ **"ল্যান্ডিং পেজ"** ট্যাবে যান
2. **"নতুন পেজ তৈরি করুন"** ক্লিক করুন
3. Slug দিন (যেমন: `product-jy2570`) — এটি URL-এ ব্যবহার হবে
4. Hero, features, specs ইত্যাদি পূরণ করুন → সেভ করুন
5. **Products** ট্যাবে গিয়ে সংশ্লিষ্ট পণ্য edit করুন
6. "বিস্তারিত পেজ" field-এ লিখুন: `landing.html?slug=product-jy2570`
7. "বিস্তারিত পেজ আছে" checkbox চেক করুন → সেভ করুন

এখন পণ্য কার্ডে click করলে `landing.html?slug=product-jy2570` পেজে যাবে।
