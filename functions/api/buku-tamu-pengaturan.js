// Cloudflare Worker route: GET/POST /api/buku-tamu-pengaturan
// Pengaturan Buku Tamu yang disimpan di server (tabel pengaturan_admin, key "buku_tamu"), jadi berlaku untuk semua perangkat:
//   aktif  : true = tamu bisa mengisi kehadiran, false = buku tamu ditutup
//   pesan  : teks yang tampil di halaman tamu saat ditutup (opsional)
//   menu   : menu mana saja yang tampil di panel admin buku tamu (rekap, bagi, doorprize)
//   acara  : detail acara {name, place, date} (opsional; kalau kosong dipakai isian bawaan halaman)
// GET  : terbuka untuk semua (hanya berisi pengaturan tampilan, tidak ada data rahasia).
// POST : khusus admin/panitia (token dari /api/admin-auth).
import { json, cfg, adminOk } from '../_lib/util.js';

const KEY = 'buku_tamu';
export const MENU = ['rekap', 'bagi', 'doorprize'];
const teks = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

export function rapikan(v) {
  v = v && typeof v === 'object' ? v : {};
  const menu = {}; MENU.forEach(k => { menu[k] = !v.menu || v.menu[k] !== false; });
  if (!MENU.some(k => menu[k])) MENU.forEach(k => { menu[k] = true; });
  let acara = null;
  if (v.acara && typeof v.acara === 'object') {
    const a = { name: teks(v.acara.name, 120), place: teks(v.acara.place, 120), date: teks(v.acara.date, 60) };
    if (a.name || a.place || a.date) acara = a;
  }
  return { aktif: v.aktif !== false, pesan: teks(v.pesan, 200), menu, acara };
}

// Dipakai juga oleh submit-attendance. Gagal membaca = dianggap sudah diatur sebelumnya (dibuka) agar buku tamu tidak mati karena gangguan.
export async function bacaBukuTamu(env) {
  const c = cfg(env);
  if (!c) return { ...rapikan({}), galat: true };
  try {
    const r = await fetch(`${c.REST}/pengaturan_admin?key=eq.${KEY}&select=value`, { headers: c.h });
    const d = await r.json();
    if (r.ok) return rapikan(d[0] && d[0].value);
  } catch (e) {}
  return { ...rapikan({}), galat: true };
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return json(200, await bacaBukuTamu(env));
  if (request.method !== 'POST') return json(405, { error: 'Metode tidak diizinkan.' });
  if (!(await adminOk(request, env))) return json(401, { error: 'Sesi admin tidak valid. Silakan login ulang.' });
  const c = cfg(env);
  if (!c) return json(500, { error: 'SUPABASE_SERVICE_ROLE_KEY belum diatur.' });
  const b = await request.json().catch(() => ({}));
  const cur = await bacaBukuTamu(env);
  if (cur.galat) return json(500, { error: 'Pengaturan lama tidak terbaca. Pastikan tabel pengaturan_admin ada di Supabase.' });
  const next = { aktif: cur.aktif, pesan: cur.pesan, menu: { ...cur.menu }, acara: cur.acara };
  if ('aktif' in b) next.aktif = b.aktif !== false;
  if ('pesan' in b) next.pesan = teks(b.pesan, 200);
  if (b.menu && typeof b.menu === 'object') MENU.forEach(k => { if (k in b.menu) next.menu[k] = !!b.menu[k]; });
  if (!MENU.some(k => next.menu[k])) return json(400, { error: 'Sisakan minimal satu menu agar panel admin buku tamu tetap bisa dipakai.' });
  if ('acara' in b) next.acara = b.acara;
  const bersih = rapikan(next);
  const r = await fetch(`${c.REST}/pengaturan_admin`, { method: 'POST', headers: { ...c.h, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ key: KEY, value: bersih }) });
  if (!r.ok) return json(500, { error: 'Gagal menyimpan pengaturan. Pastikan tabel pengaturan_admin sudah ada (supabase-update.sql).' });
  return json(200, bersih);
}
