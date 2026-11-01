// Cloudflare Worker route: POST /api/guru-login   { username, pin }
// Memeriksa username + PIN di tabel Supabase "guru_staf". Bila cocok, akun login (Supabase Auth) untuk guru itu
// dibuat otomatis (kalau belum ada) dan kata sandinya disamakan dengan PIN, lalu alamat email akun dikembalikan.
// Halaman Administrasi Kelas kemudian masuk ke Supabase dengan email itu + PIN, sehingga semua aturan akses data
// (RLS) tetap berjalan seperti biasa.
// Variabel: SUPABASE_SERVICE_ROLE_KEY (sudah ada). Opsional: GURU_EMAIL_DOMAIN (domain email teknis, bawaan di bawah).
import { json, cfg, dbGet } from '../_lib/util.js';

const tries = new Map();
const MAX = 6, WINDOW = 10 * 60 * 1000, MAX_ALL = 120;

const sama = (a, b) => { a = String(a); b = String(b); let d = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return d === 0; };
const hit = (key, now) => { let t = tries.get(key); if (!t || now - t.start > WINDOW) t = { n: 0, start: now }; return t; };

async function authFetch(c, path, opt = {}) {
  return fetch(`${c.URL}/auth/v1${path}`, { ...opt, headers: { ...c.h, 'Content-Type': 'application/json' } });
}
async function cariEmail(c, email) {                       // cadangan: cari akun lewat email bila id belum tercatat
  for (let page = 1; page <= 10; page++) {
    const r = await authFetch(c, `/admin/users?page=${page}&per_page=200`);
    if (!r.ok) return null;
    const d = await r.json(), list = d.users || [];
    const u = list.find(x => String(x.email || '').toLowerCase() === email);
    if (u) return u;
    if (list.length < 200) break;
  }
  return null;
}

export async function onRequestPost({ request, env }) {
  const c = cfg(env);
  if (!c) return json(500, { error: 'SUPABASE_SERVICE_ROLE_KEY belum diatur.' });
  let username = '', pin = '';
  try { const b = await request.json(); username = String(b.username || '').trim().toLowerCase().replace(/\s+/g, '.'); pin = String(b.pin || '').trim(); } catch (e) {}

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown', now = Date.now();
  const tIp = hit(ip, now), tAll = hit('*', now), tUser = hit('u:' + username, now);
  if (tIp.n >= MAX || tUser.n >= MAX || tAll.n >= MAX_ALL) return json(429, { error: 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.' });

  try {
    let g = null;
    if (/^[a-z0-9.]{2,40}$/.test(username) && /^\d{6}$/.test(pin)) {
      const rows = await dbGet(c)(`/guru_staf?username=eq.${encodeURIComponent(username)}&aktif=eq.true&select=id,nama,username,pin,auth_user_id`);
      if (rows[0] && rows[0].pin && sama(rows[0].pin, pin)) g = rows[0];
    }
    if (!g) {
      tries.set(ip, { ...tIp, n: tIp.n + 1 }); tries.set('*', { ...tAll, n: tAll.n + 1 }); tries.set('u:' + username, { ...tUser, n: tUser.n + 1 });
      await new Promise(r => setTimeout(r, 700));
      return json(401, { error: 'Username atau PIN salah.' });
    }
    tries.delete(ip); tries.delete('u:' + username);

    // Pastikan akun Supabase Auth ada dan kata sandinya = PIN saat ini.
    let id = g.auth_user_id, email = '';
    if (id) {
      const r = await authFetch(c, `/admin/users/${id}`);
      if (r.ok) email = String((await r.json()).email || '').toLowerCase(); else id = null;
    }
    if (id) {
      const r = await authFetch(c, `/admin/users/${id}`, { method: 'PUT', body: JSON.stringify({ password: pin, email_confirm: true }) });
      if (!r.ok) return json(502, { error: 'Akun belum bisa disiapkan. Hubungi operator sekolah.' });
    } else {
      email = `${g.username}@${env.GURU_EMAIL_DOMAIN || 'guru.at-taqwa.sch.id'}`.toLowerCase();
      const r = await authFetch(c, '/admin/users', { method: 'POST', body: JSON.stringify({ email, password: pin, email_confirm: true, user_metadata: { nama: g.nama } }) });
      if (r.ok) id = (await r.json()).id;
      else {
        const u = await cariEmail(c, email);                   // akun sudah ada tetapi belum tertaut
        if (!u) return json(502, { error: 'Akun belum bisa dibuat. Hubungi operator sekolah.' });
        id = u.id;
        const p = await authFetch(c, `/admin/users/${id}`, { method: 'PUT', body: JSON.stringify({ password: pin, email_confirm: true }) });
        if (!p.ok) return json(502, { error: 'Akun belum bisa disiapkan. Hubungi operator sekolah.' });
      }
      await fetch(`${c.REST}/guru_staf?id=eq.${g.id}`, { method: 'PATCH', headers: { ...c.h, 'Content-Type': 'application/json' }, body: JSON.stringify({ auth_user_id: id }) });
    }
    return json(200, { email });
  } catch (e) {
    return json(500, { error: 'Login belum bisa diproses. Coba lagi.' });
  }
}
export const onRequest = () => json(405, { error: 'Metode tidak diizinkan.' });
