// Cloudflare Pages Function: GET/POST /api/admin-checklist
// Checklist pembagian + pemenang doorprize. Hanya admin (butuh token dari /api/admin-auth).
// Variabel: SUPABASE_SERVICE_ROLE_KEY (wajib, jadikan Secret), SUPABASE_URL (opsional), ADMIN_PIN / ADMIN_SECRET.
const KEY_RE = /^[a-z0-9_]{1,40}$/;
const DEFAULT_ITEMS = [{ key: 'bingkisan', label: 'Bingkisan' }, { key: 'snack', label: 'Snack' }];
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
async function hmac(secret, msg) {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
}
async function same(a, b) {
  const [x, y] = await Promise.all([hmac('cmp', a), hmac('cmp', b)]);
  let d = 0; for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}
async function authorized(request, env) {
  const [exp, sig] = String(request.headers.get('authorization') || '').replace(/^Bearer /, '').split('.');
  const secret = env.ADMIN_SECRET || env.ADMIN_PIN;
  if (!exp || !sig || !secret || Number(exp) < Date.now()) return false;
  return same(sig, await hmac(secret, exp));
}

export async function onRequest({ request, env }) {
  if (!(await authorized(request, env))) return json(401, { error: 'Sesi admin tidak valid. Silakan login ulang.' });
  const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!KEY) return json(500, { error: 'SUPABASE_SERVICE_ROLE_KEY belum diatur.' });
  const REST = `${(env.SUPABASE_URL || 'https://ejiivtioxouaeipmgsuq.supabase.co').replace(/\/+$/, '')}/rest/v1`;
  // Key format baru (sb_secret_...) cukup lewat header apikey; key lama (JWT) juga dikirim sebagai Bearer.
  const h = { apikey: KEY, 'Content-Type': 'application/json' };
  if (!KEY.startsWith('sb_')) h.Authorization = `Bearer ${KEY}`;

  const getItems = async () => {
    try {
      const r = await fetch(`${REST}/pengaturan_admin?key=eq.distribusi_items&select=value`, { headers: h });
      const d = await r.json();
      if (r.ok && d[0] && Array.isArray(d[0].value)) return d[0].value;
    } catch (e) {}
    return DEFAULT_ITEMS;
  };

  try {
    if (request.method === 'GET') {
      const r = await fetch(`${REST}/distribusi_tamu?select=guest_id,item,given_at&limit=10000`, { headers: h });
      const rows = await r.json();
      if (!r.ok) return json(500, { error: rows.message || 'Gagal membaca tabel distribusi_tamu.' });
      return json(200, { rows, items: await getItems() });
    }

    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}));

      if (body.action === 'setItems') {
        const items = Array.isArray(body.items) ? body.items : null;
        if (!items || items.length > 12) return json(400, { error: 'Daftar item tidak valid (maksimal 12).' });
        const clean = [], seen = new Set();
        for (const it of items) {
          const key = String(it.key || ''), label = String(it.label || '').trim().slice(0, 40);
          if (!KEY_RE.test(key) || key === 'doorprize' || seen.has(key) || !label) return json(400, { error: 'Item tidak valid.' });
          seen.add(key); clean.push({ key, label });
        }
        const old = await getItems();
        const r = await fetch(`${REST}/pengaturan_admin`, { method: 'POST', headers: { ...h, Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ key: 'distribusi_items', value: clean }) });
        if (!r.ok) return json(500, { error: 'Gagal menyimpan. Pastikan SQL terbaru (supabase-update.sql) sudah dijalankan.' });
        const removed = old.map(x => x.key).filter(k => !seen.has(k) && KEY_RE.test(k));
        if (removed.length) await fetch(`${REST}/distribusi_tamu?item=in.(${removed.join(',')})`, { method: 'DELETE', headers: h });
        return json(200, { ok: true });
      }

      const { guestId, item, value } = body;
      if (!guestId || !KEY_RE.test(String(item || ''))) return json(400, { error: 'Data tidak valid.' });
      const r = value
        ? await fetch(`${REST}/distribusi_tamu`, { method: 'POST', headers: { ...h, Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ guest_id: String(guestId), item, given_at: new Date().toISOString() }) })
        : await fetch(`${REST}/distribusi_tamu?guest_id=eq.${encodeURIComponent(guestId)}&item=eq.${item}`, { method: 'DELETE', headers: h });
      if (!r.ok) { const d = await r.json().catch(() => ({})); return json(500, { error: d.message || 'Gagal menyimpan.' }); }
      return json(200, { ok: true });
    }
    return json(405, { error: 'Metode tidak diizinkan.' });
  } catch (e) {
    return json(500, { error: 'Kesalahan server.' });
  }
}
