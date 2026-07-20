# BS Collection BD — এই প্যাকেজের পরিবর্তনসমূহ

## Backend (backend/sarver.js) — সম্পূর্ণ রিরাইট
নতুন এন্ডপয়েন্ট:
- `/api/customer/{signup,login,forgot,reset,me}` — গ্রাহক অ্যাকাউন্ট (OTP পাসওয়ার্ড রিসেট)
- `/api/reviews/:productId` (GET) — পাবলিক রিভিউ তালিকা
- `/api/reviews` (POST, auth) — রিভিউ/প্রশ্ন সাবমিট
- `/api/admin/reviews` (GET/PATCH/DELETE) — রিভিউ মডারেশন
- `/api/products` — placement (shop/homePopular/homeBestseller/homeNew) সাপোর্ট + auto detailPage
- `/api/products/upload` — মাল্টি-ইমেজ আপলোড
- `/api/products/:id/decrement-stock` — ডেলিভারিতে স্টক কমানো
- `/api/orders` — **ফেক অর্ডার ডিটেকশন** (ফোন/IP/ইমেইল/অ্যামাউন্ট heuristics; fakeScore + reasons)
- `/api/orders/:id/mark-fake`
- `/api/page-settings` (per-page CMS)
- `/api/users` (admin)
- সব নতুন অর্ডারে Apps Script → জিমেইলে নোটিফিকেশন

## Frontend
নতুন ফাইল:
- `js/bs-shared.js` — সব পেজে floating-cart, cart-sidebar-overlay, order-modal-overlay, main-header (fallback), গ্লোবাল সার্চ, active menu হাইলাইট অটো ইনজেক্ট
- `js/product-extras.js` — রিভিউ/প্রশ্ন সাবমিট (লগইন না থাকলে redirect), তুলনা, শেয়ার, ক্যাশ অন ডেলিভারি
- `js/auth-backend.js` — signup/login/forgot/reset → MongoDB backend
- `forgot-password.html`, `reset-password.html` — OTP flow পেজ
- `apps-script.gs` — ইমোজি-মুক্ত সুন্দর HTML ইমেইল টেমপ্লেট (OTP + newOrder + contact)

সব ১৫টি HTML পেজে ইনজেক্ট: `bs-shared.js` + `auth-backend.js` (এবং product পেজে `product-extras.js`)।
`bs-app.js`-এ APPS_SCRIPT_URL সেট করা হয়েছে।

## Admin Panel (admin_panel/)
- `admin-theme.css` — Navy (#14213D) + Orange (#FCA311) রিথিম, frontend এর সাথে ম্যাচ
- `admin-extensions.js` — নতুন ট্যাব:
  1. **রিভিউ** — দেখানো/লুকানো/মুছুন
  2. **ফেক অর্ডার** — অটো-স্কোর সহ সন্দেহজনক অর্ডার
  3. **এডভান্সড পন্য** — ড্র্যাগ-অ্যান্ড-ড্রপ মাল্টি ইমেজ, placement checkbox (Shop/Popular/Bestseller/New), specs, auto detail page
  4. **পেজ সেটিংস** — প্রতিটি frontend পেজের জন্য title/meta/hero/content
  5. **গ্রাহক** — user তালিকা ও ডিলিট

## ⚠️ ডেপ্লয়ের আগে যা করতে হবে
1. **Apps Script deploy**: `frontend/apps-script.gs` কপি করে script.google.com এ পেস্ট করে Deploy → Web app → URL কপি করুন → Render Environment এ `APPS_SCRIPT_URL` সেট করুন। (বর্তমান .env এর URL ব্যবহার করা হয়েছে; নতুন করে deploy করলে URL আপডেট করুন)
2. **Render redeploy**: backend/sarver.js নতুন কোড push করার পর Render থেকে redeploy। নতুন Mongoose collections (users, reviews, pagesettings) অটো তৈরি হবে।
3. **Cloudinary**: বিদ্যমান credentials ব্যবহৃত।
4. **Node package**: sarver.js নতুন dependency ছাড়াই চলবে (bcrypt বাদ দিয়ে built-in crypto ব্যবহার)।

## নোট (যা আপনি বলেননি কিন্তু যোগ করা হয়েছে)
- ফেক অর্ডার হিউরিস্টিকস: ফোন/IP duplicate, invalid BD phone, temp email, বড় qty/amount → fakeScore + reasons
- OTP 10 মিনিটের জন্য valid
- গ্রাহক টোকেন `bs_customer_token`, admin টোকেন আগের মতোই
- ছবি আপলোড 5MB পর্যন্ত, একসাথে 10টি পর্যন্ত
