/**
 * BS Collection BD — Google Apps Script Webhook
 * -----------------------------------------------
 * Steps to deploy:
 * 1. Go to https://script.google.com  →  New Project
 * 2. Delete default code, paste this entire file.
 * 3. Change OWNER_EMAIL below to your own gmail.
 * 4. Save (Ctrl+S), name project "BS Collection Mailer".
 * 5. Click Deploy → New deployment → Type: Web app.
 *      - Description: any
 *      - Execute as: Me
 *      - Who has access: Anyone
 *    Click Deploy → authorize → copy the Web app URL.
 * 6. Open js/bs-app.js and set:
 *       const APPS_SCRIPT_URL = 'PASTE_URL_HERE';
 * Done. OTP and order emails will now be sent from your Gmail.
 */

const OWNER_EMAIL = 'your-email@gmail.com';   // ← change this
const SHOP_NAME   = 'BS Collection BD';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');
    if (data.action === 'sendOtp')  return sendOtp(data);
    if (data.action === 'newOrder') return newOrder(data);
    if (data.action === 'contact')  return contactMsg(data);
    return _json({ ok:false, msg:'unknown action' });
  } catch (err) {
    return _json({ ok:false, msg: String(err) });
  }
}
function doGet() { return _json({ ok:true, msg:SHOP_NAME + ' webhook alive' }); }

function sendOtp(d) {
  if (!d.email || !d.code) return _json({ ok:false, msg:'missing fields' });
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:20px;border:1px solid #eee;border-radius:10px">
      <h2 style="color:#14213D;margin:0 0 10px">${SHOP_NAME}</h2>
      <p>আপনার পাসওয়ার্ড রিসেট করার জন্য OTP:</p>
      <div style="font-size:32px;letter-spacing:8px;font-weight:700;color:#FCA311;text-align:center;padding:20px;background:#f8fafc;border-radius:8px;margin:14px 0">${d.code}</div>
      <p style="color:#64748b;font-size:13px">এই কোড ১০ মিনিট পর্যন্ত সক্রিয় থাকবে। আপনি অনুরোধ না করলে এই ইমেইল উপেক্ষা করুন।</p>
    </div>`;
  MailApp.sendEmail({ to:d.email, subject:'আপনার OTP — '+SHOP_NAME, htmlBody:html });
  return _json({ ok:true });
}

function newOrder(d) {
  const o = d.order || {};
  const c = o.customer || {};
  const rows = (o.items||[]).map(i=>`<tr><td>${_esc(i.name)}</td><td align="center">${i.qty}</td><td align="right">Tk ${i.price}</td></tr>`).join('');
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px">
      <h2 style="color:#14213D">নতুন অর্ডার — ${_esc(o.id||'')}</h2>
      <p><b>নাম:</b> ${_esc(c.name)}<br><b>ফোন:</b> ${_esc(c.phone)}<br>
      <b>ঠিকানা:</b> ${_esc(c.address)}, ${_esc(c.district)}, ${_esc(c.division)}</p>
      <table width="100%" cellpadding="8" style="border-collapse:collapse;border:1px solid #eee">
        <tr style="background:#14213D;color:#fff"><th align="left">Product</th><th>Qty</th><th align="right">Price</th></tr>
        ${rows}
      </table>
      <p align="right">সাবটোটাল: Tk ${o.subtotal}<br>ডেলিভারি: Tk ${o.shipping}<br><b>মোট: Tk ${o.total}</b></p>
    </div>`;
  MailApp.sendEmail({ to:OWNER_EMAIL, subject:'নতুন অর্ডার '+_esc(o.id||''), htmlBody:html });
  if (c.email) {
    MailApp.sendEmail({ to:c.email, subject:'আপনার অর্ডার নিশ্চিত হয়েছে — '+SHOP_NAME,
      htmlBody:'<p>আপনার অর্ডার '+_esc(o.id||'')+' পেয়েছি। আমরা শীঘ্রই যোগাযোগ করব।</p>' });
  }
  return _json({ ok:true });
}

function contactMsg(d) {
  MailApp.sendEmail({ to:OWNER_EMAIL, subject:'যোগাযোগ ফরম — '+_esc(d.name||''),
    htmlBody:'<p><b>নাম:</b> '+_esc(d.name)+'<br><b>ইমেইল:</b> '+_esc(d.email)+
             '<br><b>ফোন:</b> '+_esc(d.phone||'')+'</p><p>'+_esc(d.message||'').replace(/\n/g,'<br>')+'</p>' });
  return _json({ ok:true });
}

function _esc(s){ return String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
function _json(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
