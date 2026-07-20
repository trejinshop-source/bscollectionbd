document.addEventListener("DOMContentLoaded", function(){
  var f = document.getElementById("loginForm");
  if (f) {
    f.onsubmit = async function(e){
      e.preventDefault();
      var fd = new FormData(f);
      var r = await window.bsAuth.login({ email: fd.get("email"), password: fd.get("pw") || fd.get("password") });
      if (!r.ok) { window.bsToast(r.msg, "err"); return false; }
      window.bsToast("লগইন সফল", "ok");
      setTimeout(function(){ location.reload(); }, 500);
      return false;
    };
  }
  if (window.bsAuth && window.bsAuth.get()) {
    var u = window.bsAuth.get();
    var orders = (window.bsOrders ? window.bsOrders.list() : []).filter(function(o){ return o.user === u.email; });
    var wrap = document.createElement("div");
    wrap.style.cssText = "max-width:820px;margin:30px auto;padding:0 16px;";
    var html = '<div style="background:#fff;border-radius:12px;padding:24px;box-shadow:0 4px 14px rgba(0,0,0,.08)">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:10px">';
    html += '<div><h2 style="margin:0;color:#14213D">স্বাগতম, ' + u.name + '</h2>';
    html += '<p style="color:#64748b;margin:4px 0 0;font-size:13px">' + u.email + (u.phone ? ' · ' + u.phone : '') + '</p></div>';
    html += '<button onclick="window.bsAuth.logout()" style="padding:8px 16px;background:#DC2626;color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:inherit"><i class="fas fa-sign-out-alt"></i> লগআউট</button>';
    html += '</div>';
    html += '<h3 style="margin:22px 0 10px;color:#14213D;font-size:16px">আপনার অর্ডারসমূহ (' + orders.length + ')</h3>';
    if (orders.length) {
      html += orders.map(function(o){
        var items = o.items.map(function(i){ return '<div style="display:flex;gap:10px;padding:6px 0;font-size:13px;color:#334155"><img src="' + (i.image||'') + '" style="width:36px;height:36px;object-fit:cover;border-radius:6px;background:#f3f4f6" onerror="this.style.visibility=&quot;hidden&quot;"/><div>' + i.name + ' <span style="color:#64748b">× ' + i.qty + '</span></div></div>'; }).join('');
        return '<div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px;margin-bottom:10px">' +
          '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:6px"><b style="color:#14213D">' + o.id + '</b><span style="color:#FCA311;font-weight:700">Tk ' + o.total + '</span></div>' +
          '<div style="color:#64748b;font-size:13px;margin-bottom:8px">' + new Date(o.at).toLocaleString('en-GB') + ' · <span style="color:#16A34A;font-weight:600">' + o.status + '</span></div>' +
          items +
          '</div>';
      }).join('');
    } else {
      html += '<p style="color:#94a3b8">এখনও কোনো অর্ডার নেই। <a href="shop.html" style="color:#14213D;font-weight:600">শপিং শুরু করুন</a></p>';
    }
    html += '</div>';
    wrap.innerHTML = html;
    var main = document.querySelector("main") || document.body;
    main.insertBefore(wrap, main.firstChild);
    // Hide the login form section
    if (f) { var sec = f.closest("section") || f.closest(".container") || f.parentElement; if (sec) sec.style.display = "none"; }
  }
});