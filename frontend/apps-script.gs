/**
 * BS Collection BD — Google Apps Script Webhook (UPDATED)
 * -------------------------------------------------------
 * ডেপ্লয় করার নিয়ম:
 *   1) https://script.google.com খুলুন → New Project
 *   2) নিচের পুরো কোডটি পেস্ট করুন। প্রয়োজনে OWNER_EMAIL পরিবর্তন করুন।
 *   3) Save → Deploy → New Deployment → Type: Web app
 *      - Execute as: Me
 *      - Who has access: Anyone
 *   4) Deploy চাপুন → authorize → Web app URL কপি করুন
 *   5) Render ড্যাশবোর্ড → Environment → APPS_SCRIPT_URL এ URL বসান
 *      এবং frontend/js/bs-app.js এর APPS_SCRIPT_URL এও বসান।
 *
 * সমর্থিত অ্যাকশন: sendOtp, newOrder, contact
 * ইমেইল বার্তায় কোনো ইমোজি ব্যবহার করা হয়নি।
 */

const OWNER_EMAIL = 'bscbd0786@gmail.com';
const SHOP_NAME   = 'BS Collection BD';
const BRAND       = { navy: '#14213D', orange: '#FCA311', bg: '#f8fafc', text: '#0f172a', muted: '#64748b' };

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');
    switch (data.action) {
      case 'sendOtp':  return sendOtp(data);
      case 'newOrder': return newOrder(data);
      case 'contact':      return contactMsg(data);
      case 'newContact':   return contactMsg(data);
      case 'replyContact': return replyContact(data);
      default:             return _json({ ok: false, msg: 'unknown action' });
    }
  } catch (err) {
    return _json({ ok: false, msg: String(err) });
  }
}
function doGet() { return _json({ ok: true, msg: SHOP_NAME + ' webhook alive', ts: Date.now() }); }

// ── OTP পাসওয়ার্ড রিসেট ──────────────────────────────────────────────────────
function sendOtp(d) {
  if (!d.email || !d.code) return _json({ ok: false, msg: 'missing fields' });
  const html = `
  <div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;background:${BRAND.bg};padding:0;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:${BRAND.navy};padding:22px 24px;color:#fff">
      <div style="font-size:20px;font-weight:700;letter-spacing:.3px">${SHOP_NAME}</div>
      <div style="font-size:13px;opacity:.85;margin-top:2px">পাসওয়ার্ড রিসেট রিকোয়েস্ট</div>
    </div>
    <div style="padding:26px 28px;color:${BRAND.text}">
      <p style="margin:0 0 14px;font-size:15px">প্রিয় গ্রাহক,</p>
      <p style="margin:0 0 14px;font-size:14px;line-height:1.7">
        আপনার অ্যাকাউন্টের পাসওয়ার্ড রিসেট করার জন্য নিচের ৬ ডিজিটের OTP কোডটি ব্যবহার করুন।
        কোডটি <b>১০ মিনিট</b> পর্যন্ত সক্রিয় থাকবে।
      </p>
      <div style="text-align:center;margin:18px 0">
        <div style="display:inline-block;font-size:34px;letter-spacing:12px;font-weight:800;color:${BRAND.orange};padding:16px 26px;background:#fff;border-radius:10px;border:1px dashed ${BRAND.orange}">${_esc(d.code)}</div>
      </div>
      <p style="margin:14px 0 0;font-size:13px;color:${BRAND.muted};line-height:1.7">
        আপনি যদি এই রিকোয়েস্টটি না করে থাকেন, দয়া করে এই ইমেইলটি উপেক্ষা করুন এবং কাউকে এই কোড শেয়ার করবেন না।
      </p>
    </div>
    <div style="background:#0f172a;color:#94a3b8;padding:14px 24px;font-size:12px;text-align:center">© ${new Date().getFullYear()} ${SHOP_NAME}</div>
  </div>`;
  MailApp.sendEmail({ to: d.email, subject: SHOP_NAME + ' — পাসওয়ার্ড রিসেট OTP', htmlBody: html });
  return _json({ ok: true });
}

// ── নতুন অর্ডার নোটিফিকেশন ────────────────────────────────────────────────────
function newOrder(d) {
  const o = d.order || {};
  const c = o.customer || {};
  const items = o.items || [];
  const rows = items.map(i => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0">${_esc(i.name || '')}<div style="color:${BRAND.muted};font-size:12px;margin-top:2px">${_esc(i.sku || '')}</div>${
        (i.color || i.size || i.weight) ? `<div style="margin-top:4px;font-size:11.5px;color:#334155">${
          [i.color ? 'কালার: <b>'+_esc(i.color)+'</b>' : '', i.size ? 'সাইজ: <b>'+_esc(i.size)+'</b>' : '', i.weight ? 'ওজন: <b>'+_esc(i.weight)+'</b>' : ''].filter(Boolean).join(' · ')
        }</div>` : ''
      }</td>
      <td align="center" style="padding:10px 12px;border-bottom:1px solid #e2e8f0">${_esc(String(i.qty || 1))}</td>
      <td align="right" style="padding:10px 12px;border-bottom:1px solid #e2e8f0">Tk ${_esc(String(i.price || 0))}</td>
      <td align="right" style="padding:10px 12px;border-bottom:1px solid #e2e8f0"><b>Tk ${_esc(String((i.price || 0) * (i.qty || 1)))}</b></td>
    </tr>`).join('');

  const fakeBanner = (o.fakeScore || 0) >= 50 ? `
    <div style="background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;padding:12px 16px;border-radius:8px;margin:16px 0;font-size:13px">
      <b>সতর্কতা:</b> স্বয়ংক্রিয় ফেক-অর্ডার স্কোর ${o.fakeScore}%। কারণ:
      <ul style="margin:6px 0 0;padding-left:18px">
        ${(o.fakeReasons || []).map(r => `<li>${_esc(r)}</li>`).join('')}
      </ul>
    </div>` : '';

  const html = `
  <div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:${BRAND.navy};padding:22px 24px;color:#fff">
      <div style="font-size:22px;font-weight:800">নতুন অর্ডার</div>
      <div style="font-size:14px;margin-top:4px;opacity:.85">অর্ডার নং: <b style="color:${BRAND.orange}">${_esc(o.id || '')}</b></div>
    </div>
    <div style="padding:22px 24px;color:${BRAND.text}">
      ${fakeBanner}
      <table style="width:100%;font-size:14px;line-height:1.7">
        <tr><td style="width:120px;color:${BRAND.muted}">গ্রাহকের নাম</td><td><b>${_esc(c.name || '')}</b></td></tr>
        <tr><td style="color:${BRAND.muted}">ফোন</td><td><a href="tel:${_esc(c.phone || '')}" style="color:${BRAND.navy};text-decoration:none"><b>${_esc(c.phone || '')}</b></a></td></tr>
        <tr><td style="color:${BRAND.muted}">ইমেইল</td><td>${_esc(c.email || '—')}</td></tr>
      </table>
      <table style="width:100%;font-size:14px;line-height:1.6;margin-top:10px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        <tr style="background:#f8fafc"><td colspan="2" style="padding:8px 12px;font-weight:700;color:${BRAND.navy};font-size:13px">ঠিকানা (বিস্তারিত)</td></tr>
        ${c.division ? `<tr><td style="width:140px;padding:6px 12px;color:${BRAND.muted};border-top:1px solid #e2e8f0">বিভাগ</td><td style="padding:6px 12px;border-top:1px solid #e2e8f0"><b>${_esc(c.division)}</b></td></tr>` : ''}
        ${c.district ? `<tr><td style="padding:6px 12px;color:${BRAND.muted};border-top:1px solid #e2e8f0">জেলা</td><td style="padding:6px 12px;border-top:1px solid #e2e8f0"><b>${_esc(c.district)}</b></td></tr>` : ''}
        ${c.upazila ? `<tr><td style="padding:6px 12px;color:${BRAND.muted};border-top:1px solid #e2e8f0">থানা/উপজেলা</td><td style="padding:6px 12px;border-top:1px solid #e2e8f0"><b>${_esc(c.upazila)}</b></td></tr>` : ''}
        ${c.union ? `<tr><td style="padding:6px 12px;color:${BRAND.muted};border-top:1px solid #e2e8f0">ইউনিয়ন</td><td style="padding:6px 12px;border-top:1px solid #e2e8f0"><b>${_esc(c.union)}</b></td></tr>` : ''}
        ${c.area ? `<tr><td style="padding:6px 12px;color:${BRAND.muted};border-top:1px solid #e2e8f0">বিস্তারিত এলাকা</td><td style="padding:6px 12px;border-top:1px solid #e2e8f0"><b>${_esc(c.area)}</b></td></tr>` : ''}
        ${(!c.division && !c.district && !c.upazila && c.address) ? `<tr><td style="padding:6px 12px;color:${BRAND.muted};border-top:1px solid #e2e8f0">ঠিকানা</td><td style="padding:6px 12px;border-top:1px solid #e2e8f0"><b>${_esc(c.address)}</b></td></tr>` : ''}
      </table>
      <table style="width:100%;margin-top:18px;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        <thead>
          <tr style="background:${BRAND.navy};color:#fff;font-size:13px">
            <th align="left" style="padding:10px 12px">পণ্য</th>
            <th style="padding:10px 12px">পরিমাণ</th>
            <th align="right" style="padding:10px 12px">দাম</th>
            <th align="right" style="padding:10px 12px">মোট</th>
          </tr>
        </thead>
        <tbody style="font-size:13.5px">${rows}</tbody>
      </table>
      <div style="margin-top:16px;text-align:right;font-size:14px;line-height:1.9">
        <div>সাবটোটাল: <b>Tk ${_esc(String(o.subtotal || 0))}</b></div>
        <div>ডেলিভারি চার্জ: <b>Tk ${_esc(String(o.shipping || 0))}</b></div>
        <div style="font-size:17px;margin-top:4px">মোট পরিশোধযোগ্য: <b style="color:${BRAND.orange}">Tk ${_esc(String(o.total || 0))}</b></div>
      </div>
    </div>
    <div style="background:#0f172a;color:#94a3b8;padding:12px 24px;font-size:12px;text-align:center">
      © ${new Date().getFullYear()} ${SHOP_NAME} — এডমিন প্যানেল থেকে অর্ডার প্রক্রিয়াজাত করুন
    </div>
  </div>`;

  MailApp.sendEmail({ to: OWNER_EMAIL, subject: 'নতুন অর্ডার — ' + (o.id || ''), htmlBody: html });
  if (c.email) {
    MailApp.sendEmail({
      to: c.email,
      subject: SHOP_NAME + ' — আপনার অর্ডার নিশ্চিত হয়েছে (' + (o.id || '') + ')',
      htmlBody: `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;padding:22px;background:${BRAND.bg};border-radius:12px;border:1px solid #e2e8f0">
        <h2 style="color:${BRAND.navy};margin:0 0 10px">${SHOP_NAME}</h2>
        <p>আসসালামু আলাইকুম ${_esc(c.name || '')},</p>
        <p>আপনার অর্ডার <b>${_esc(o.id || '')}</b> আমাদের কাছে পৌঁছেছে। মোট পরিশোধযোগ্য: <b style="color:${BRAND.orange}">Tk ${_esc(String(o.total || 0))}</b>। আমরা শীঘ্রই আপনার সাথে যোগাযোগ করব।</p>
        <p style="color:${BRAND.muted};font-size:13px">ধন্যবাদান্তে, ${SHOP_NAME}</p></div>`,
    });
  }
  return _json({ ok: true });
}

// ── Contact Form ──────────────────────────────────────────────────────────────
function contactMsg(d) {
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;padding:22px;background:${BRAND.bg};border-radius:12px;border:1px solid #e2e8f0">
    <h2 style="color:${BRAND.navy};margin:0 0 10px">Contact ফরম — ${SHOP_NAME}</h2>
    <p><b>নাম:</b> ${_esc(d.name || '')}<br><b>ইমেইল:</b> ${_esc(d.email || '')}<br><b>ফোন:</b> ${_esc(d.phone || '')}</p>
    <div style="background:#fff;padding:14px;border-radius:8px;border:1px solid #e2e8f0;white-space:pre-wrap">${_esc(d.message || '')}</div>
  </div>`;
  MailApp.sendEmail({ to: OWNER_EMAIL, subject: SHOP_NAME + ' — Contact ' + _esc(d.name || ''), htmlBody: html });
  return _json({ ok: true });
}


// -- Admin Reply to Contact Message
function replyContact(d) {
  if (!d.to) return _json({ ok: false, msg: 'missing recipient email' });
  const html = '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;background:' + BRAND.bg + ';border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">'
    + '<div style="background:' + BRAND.navy + ';padding:22px 24px;color:#fff"><div style="font-size:20px;font-weight:700">' + SHOP_NAME + '</div><div style="font-size:13px;opacity:.85;margin-top:2px">আপনার বার্তার উত্তর</div></div>'
    + '<div style="padding:26px 28px;color:' + BRAND.text + '">'
    + '<p style="margin:0 0 14px;font-size:15px">প্রিয় ' + _esc(d.name || 'গ্রাহক') + ',</p>'
    + '<p style="margin:0 0 14px;font-size:14px;line-height:1.7">আপনার বার্তার উত্তরে আমরা জানাচ্ছি:</p>'
    + '<div style="background:#fff;border:1px solid #e2e8f0;border-left:4px solid ' + BRAND.orange + ';padding:16px;border-radius:6px;margin-bottom:18px;font-size:14px;line-height:1.8;white-space:pre-wrap">' + _esc(d.replyText || '') + '</div>'
    + (d.originalMessage ? '<div style="margin-top:16px;padding:12px;background:#f1f5f9;border-radius:6px;font-size:12.5px;color:' + BRAND.muted + '"><b>আপনার মূল বার্তা:</b><br><div style="margin-top:6px;white-space:pre-wrap">' + _esc(d.originalMessage) + '</div></div>' : '')
    + '<p style="margin:18px 0 0;font-size:13px;color:' + BRAND.muted + '">আরো সহায়তার জন্য যোগাযোগ করুন।</p>'
    + '</div>'
    + '<div style="background:#0f172a;color:#94a3b8;padding:14px 24px;font-size:12px;text-align:center">© ' + new Date().getFullYear() + ' ' + SHOP_NAME + '</div></div>';
  const subj = d.subject ? (SHOP_NAME + ' — ' + d.subject + ' (উত্তর)') : (SHOP_NAME + ' — আপনার বার্তার উত্তর');
  MailApp.sendEmail({ to: d.to, subject: subj, htmlBody: html });
  return _json({ ok: true });
}

function _esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function _json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
