// Product review handler — reads product id from filename (product-<id>.html)
document.addEventListener("DOMContentLoaded", function(){
  var m = location.pathname.match(/product-([a-z0-9]+)\.html/i);
  if (!m) return;
  var pid = m[1];
  var btn = document.getElementById("submitReviewBtn");
  if (!btn) return;
  btn.onclick = function(){
    var container = btn.parentElement;
    var ta = container.querySelector("textarea");
    var text = (ta && ta.value || "").trim();
    if (!text) { window.bsToast("রিভিউ লিখুন", "err"); return; }
    var stars = container.querySelectorAll(".pd-rs-star.on, .pd-rs-star.active, .pd-rs-star.selected");
    var rating = stars.length || 5;
    var r = window.bsReviews.add(pid, text, rating);
    if (r.ok) {
      ta.value = "";
      window.bsToast("ধন্যবাদ, রিভিউ যোগ হয়েছে", "ok");
      var list = document.querySelector(".pd-rv-list") || document.querySelector(".reviews-list");
      if (list) {
        var div = document.createElement("div");
        div.className = "rv";
        div.style.cssText = "background:#fff;padding:14px;border-radius:10px;margin-bottom:10px;border:1px solid #e5e7eb";
        var u = window.bsAuth.get();
        div.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><b>' + u.name + '</b><small style="color:#64748b">এইমাত্র</small></div><div>' + text.replace(/</g,"&lt;") + '</div>';
        list.insertBefore(div, list.firstChild);
      }
    }
    // If needs auth, bsReviews.add already opens login modal
  };
});
