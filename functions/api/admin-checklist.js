// Cloudflare Pages Function: GET/POST /api/admin-checklist
// Checklist pembagian + pemenang doorprize. Hanya admin (butuh token dari /api/admin-auth).
// Variabel: SUPABASE_SERVICE_ROLE_KEY (wajib, jadikan Secret), SUPABASE_URL (opsional), ADMIN_PIN / ADMIN_SECRET.
import { json, cfg, adminOk } from '../_lib/util.js';

const KEY_RE = /^[a-z0-9_]{1,40}$/;
const DEFAULT_ITEMS = [{ key: 'bingkisan', label: 'Bingkisan' }, { key: 'snack', label: 'Snack' }];
export async function onRequest({ request, env }) {
  if (!(await adminOk(request, env))) return json(401, { error: 'Sesi admin tidak valid. Silakan login ulang.' });
  const c = cfg(env);
  if (!c) return json(500, { error: 'SUPABASE_SERVICE_ROLE_KEY belum diatur.' });
  const REST = c.REST, h = { ...c.h, 'Content-Type': 'application/json' };

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
      // Kolom "catatan" ditambahkan belakangan; kalau belum ada di database, baca tanpa kolom itu.
      let r = await fetch(`${REST}/distribusi_tamu?select=guest_id,item,given_at,catatan&limit=10000`, { headers: h });
      if (!r.ok) r = await fetch(`${REST}/distribusi_tamu?select=guest_id,item,given_at&limit=10000`, { headers: h });
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

      if (body.action === 'setNote') {
        const gid = String(body.guestId || ''), catatan = String(body.catatan || '').trim().slice(0, 200);
        if (!gid) return json(400, { error: 'Data tidak valid.' });
        const r = await fetch(`${REST}/distribusi_tamu?guest_id=eq.${encodeURIComponent(gid)}&item=eq.doorprize`, { method: 'PATCH', headers: h, body: JSON.stringify({ catatan: catatan || null }) });
        if (!r.ok) return json(500, { error: 'Gagal menyimpan catatan. Pastikan kolom "catatan" sudah dibuat di Supabase (lihat petunjuk SQL).' });
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
