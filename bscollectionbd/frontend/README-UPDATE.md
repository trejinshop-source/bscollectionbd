# BS Collection BD — আপডেট নোট (2026-07-18)

## যা যোগ করা হয়েছে
1. **সব পেজে shared core** — `js/bs-app.js` + `css/bs-app.css`
2. **কার্ট ড্রয়ার (sidebar)** — cart আইকনে ক্লিক করলে ডান দিক থেকে খুলবে
3. **চেকআউট মডাল** — Proceed to Checkout বাটনে ক্লিক করলে ফুল অর্ডার ফরম মডালে খুলবে (আলাদা পেজ না)
4. **লগইন/সাইনআপ/পাসওয়ার্ড রিসেট** — Google Apps Script এর মাধ্যমে ইমেইলে OTP
5. **রিভিউ ফ্লো** — রিভিউ লিখে সাবমিটে গেলে লগইন না থাকলে login modal, লগইন থাকলে সরাসরি save
6. **মোবাইল ন্যাভ** — hamburger থেকে full drawer, logo বামে + search/hamburger ডানে
7. **WhatsApp ফ্লোট বাটন** — `01344367630` নাম্বারে
8. **Topbar-এ ফোন নাম্বার** — `01344367630` tel: লিংক
9. **ক্যাটাগরি অনুযায়ী শপিং** — `shop.html?cat=...` URL থেকে ফিল্টার
10. **বাংলা ফন্ট** — Noto Sans Bengali + Hind Siliguri + Poppins
11. **ইউনিফায়েড localStorage** — পুরনো data auto-migrate

## Apps Script Deploy (OTP ইমেইল কাজ করার জন্য প্রয়োজনীয়)
`apps-script.gs` ফাইলটি খুলে ভেতরের নির্দেশনা অনুসরণ করুন। Deploy করার পর URL কপি করে `js/bs-app.js` এর ২১ নং লাইনে বসান:

```js
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
```

URL সেট না করা পর্যন্ত OTP alert box-এ দেখানো হবে (dev mode)।

## localStorage কী
- `bs_cart_v1` — কার্ট
- `bs_wish_v1` — উইশলিস্ট
- `bs_users_v1` — সব signup করা user (email+hashed pw)
- `bs_current_user_v1` — বর্তমান লগইন user
- `bs_orders_v1` — অর্ডার হিস্ট্রি
- `bs_reviews_v1` — প্রোডাক্ট রিভিউ
- `bs_otp_pending_v1` — OTP verification (১০ মিনিট)

## সীমাবদ্ধতা
- সব ডেটা প্রতি ডিভাইসে localStorage-এ থাকবে (কোনো central DB নেই)
- অন্য ডিভাইস থেকে লগইন করলে নতুন account লাগবে
- Apps Script URL সেট না করলে OTP ইমেইলে যাবে না
