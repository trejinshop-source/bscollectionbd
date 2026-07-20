/* ================================================================
   BS Collection BD — Customer Auth Backend Bridge (auth-backend.js)
   ----------------------------------------------------------------
   login.html / register.html / forgot-password.html / reset-password.html
   এর ফরমগুলো MongoDB backend এর সাথে সংযুক্ত করে। সাথে বিদ্যমান
   window.bsAuth কে backend-ভিত্তিক করে override করে।
   ================================================================ */
(function () {
  'use strict';
  const API = window.BS_API_BASE || 'https://bscollectionbd.onrender.com/api';
  const TK = 'bs_customer_token', UK = 'bs_customer_user';

  function toast(m, k) { if (window.bsToast) window.bsToast(m, k); else alert(m); }
  function saveSession(token, user) {
    localStorage.setItem(TK, token);
    localStorage.setItem(UK, JSON.stringify(user));
    // sync with existing bsAuth for pages relying on it
    localStorage.setItem('bs_current_user_v1', JSON.stringify(user));
  }
  function currentUser() { try { return JSON.parse(localStorage.getItem(UK) || 'null'); } catch { return null; } }
  function token() { return localStorage.getItem(TK) || ''; }
  function logout() {
    localStorage.removeItem(TK); localStorage.removeItem(UK);
    localStorage.removeItem('bs_current_user_v1');
    toast('লগআউট হয়েছে', 'ok');
    setTimeout(() => location.href = 'index.html', 500);
  }

  async function post(path, body) {
    const res = await fetch(API + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'ব্যর্থ হয়েছে');
    return data;
  }

  // ---- override window.bsAuth ----
  window.bsAuth = {
    get: currentUser,
    logout,
    async signup({ name, email, phone, password }) {
      try {
        const d = await post('/customer/signup', { name, email, phone, password });
        saveSession(d.token, d.user); return { ok: true };
      } catch (e) { return { ok: false, msg: e.message }; }
    },
    async login({ email, phone, password }) {
      try {
        // Auto-detect: phone number vs email
        const id = email || phone || '';
        const looksLikePhone = /^[+]?[0-9]{10,15}$/.test(id) || /^01[3-9][0-9]{8}$/.test(id);
        const payload = looksLikePhone ? { phone: id, password } : { email: id, password };
        const d = await post('/customer/login', payload);
        saveSession(d.token, d.user); return { ok: true };
      } catch (e) { return { ok: false, msg: e.message }; }
    },
    async sendOtp(email) {
      try { const d = await post('/customer/forgot', { email }); return { ok: true, msg: d.msg }; }
      catch (e) { return { ok: false, msg: e.message }; }
    },
    async resetPassword(email, code, newPassword) {
      try { const d = await post('/customer/reset', { email, code, newPassword }); return { ok: true, msg: d.msg }; }
      catch (e) { return { ok: false, msg: e.message }; }
    },
    token,
  };

  // ---- wire pages ----
  document.addEventListener('DOMContentLoaded', function () {
    // register.html
    const rf = document.getElementById('registerForm');
    if (rf) rf.onsubmit = async function (e) {
      e.preventDefault(); const fd = new FormData(rf);
      const r = await window.bsAuth.signup({
        name: fd.get('name'), email: fd.get('email'),
        phone: fd.get('phone'), password: fd.get('pw') || fd.get('password'),
      });
      if (!r.ok) return toast(r.msg, 'err');
      toast('অ্যাকাউন্ট তৈরি হয়েছে', 'ok');
      setTimeout(() => location.href = 'account.html', 600);
    };

    // login.html
    const lf = document.getElementById('loginForm');
    if (lf) lf.onsubmit = async function (e) {
      e.preventDefault(); const fd = new FormData(lf);
      const r = await window.bsAuth.login({
        email: fd.get('email'), password: fd.get('pw') || fd.get('password'),
      });
      if (!r.ok) return toast(r.msg, 'err');
      toast('লগইন সফল', 'ok');
      const next = new URLSearchParams(location.search).get('next');
      setTimeout(() => location.href = next || 'account.html', 500);
    };

    // forgot-password.html
    const ff = document.getElementById('forgotForm');
    if (ff) ff.onsubmit = async function (e) {
      e.preventDefault(); const fd = new FormData(ff);
      const r = await window.bsAuth.sendOtp(fd.get('email'));
      if (!r.ok) return toast(r.msg, 'err');
      toast(r.msg || 'OTP পাঠানো হয়েছে', 'ok');
      sessionStorage.setItem('bs_reset_email', fd.get('email'));
      setTimeout(() => location.href = 'reset-password.html', 700);
    };

    // reset-password.html
    const rp = document.getElementById('resetForm');
    if (rp) {
      const emailInput = rp.querySelector('input[name=email]');
      if (emailInput && !emailInput.value) emailInput.value = sessionStorage.getItem('bs_reset_email') || '';
      rp.onsubmit = async function (e) {
        e.preventDefault(); const fd = new FormData(rp);
        if (fd.get('newPassword') !== fd.get('confirmPassword')) return toast('পাসওয়ার্ড মিলছে না', 'err');
        const r = await window.bsAuth.resetPassword(fd.get('email'), fd.get('code'), fd.get('newPassword'));
        if (!r.ok) return toast(r.msg, 'err');
        toast('পাসওয়ার্ড পরিবর্তন হয়েছে', 'ok');
        sessionStorage.removeItem('bs_reset_email');
        setTimeout(() => location.href = 'login.html', 700);
      };
    }

    // account.html — show logout if logged in
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.onclick = logout;
  });
})();
