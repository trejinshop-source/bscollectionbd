# আপডেট নোটস (এই সংস্করণ)

## Frontend
- ❌ Deleted: `frontend/js/bs-shared.js` এবং `frontend/js/auth-backend.js`
- ✂️ প্রতিটি HTML পেজ থেকে এই দুইটি স্ক্রিপ্টের `<script src="...">` ট্যাগ সরানো হয়েছে
  → index.html, account.html সহ সব পেজ এখন ঠিকমতো কাজ করবে
- বাকি js ফাইল অক্ষত: `data.js`, `bs-app.js`, `main.js`, `product-extras.js`, `override-*.js`
  (এগুলো cart / product / login logic এর জন্য দরকার)

## Admin Panel (admin_panel/admin-theme.css)
1. ✅ Font family সেট: `'Poppins','Hind Siliguri','Noto Sans Bengali',sans-serif`
   (product-jy2218.html এর সাথে ম্যাচ) — Google Fonts import সহ
2. ✅ পুরো admin panel এ `border-radius: 0 !important` — কোথাও গোল কর্নার নেই
3. ✅ Sidebar tab isolation:
   `.page:not(.active) { display: none !important }`
   → Dashboard এ ক্লিক করলে শুধু Dashboard, Orders এ ক্লিক করলে শুধু Orders দেখাবে

## Backend
- আগের version এর সাথে সম্পূর্ণ কম্প্যাটিবল, কোনো পরিবর্তন নেই

## যা এখনো manually করতে হবে
- **Default product cards**: Admin panel এর "পন্য" ট্যাব থেকে frontend পেজের কার্ডগুলো
  একবার add করে দিতে হবে (auto-seed করা হয়নি — কারণ 2MB+ HTML থেকে প্রতিটি কার্ড
  extract করা risky, ভুল ডাটা inject হতে পারে)
- **নতুন product detail page**: `product-jy2218.html` কে টেমপ্লেট হিসেবে ব্যবহার করে
  admin থেকে product create করলে ওই টেমপ্লেট auto load হবে
  (product-extras.js এই feature ইতিমধ্যেই handle করে)
