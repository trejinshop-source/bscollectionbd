document.addEventListener("DOMContentLoaded", function(){
  var f = document.getElementById("registerForm");
  if (!f) return;
  f.onsubmit = function(e){
    e.preventDefault();
    var fd = new FormData(f);
    var r = window.bsAuth.signup({
      name: fd.get("name"),
      email: fd.get("email"),
      phone: fd.get("phone"),
      password: fd.get("pw") || fd.get("password")
    });
    if (!r.ok) { window.bsToast(r.msg, "err"); return false; }
    window.bsToast("অ্যাকাউন্ট তৈরি হয়েছে", "ok");
    setTimeout(function(){ location.href = "account.html"; }, 600);
    return false;
  };
});
