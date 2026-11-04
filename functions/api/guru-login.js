// Cloudflare Worker route: POST /api/guru-login { username, pin }
// Memeriksa username + PIN di tabel guru_staf yang juga dipakai modul administrasi.
// Bila cocok, akun Supabase Auth disamakan PIN-nya & email dikembalikan.
import { json, cfg, dbGet } from '../_lib/util.js';
import { sudahBatas, catatGagal, hapusBatas } from '../_lib/pembatas.js';

const MAX = 6, WINDOW = 10 * 60 * 1000, MAX_ALL = 120;

const sama = (a, b) => { 
  a = String(a); b = String(b); 
  let d = a.length ^ b.length; 
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); 
  return d === 0; 
};

async function authFetch(c, path, opt = {}) {
  return fetch(`${c.URL}/auth/v1${path}`, { ...opt, headers: { ...c.h, 'Content-Type': 'application/json' } });
}

async function cariEmail(c, email) {
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
  try {
    const b = await request.json();
    username = String(b.username || '').trim().toLowerCase().replace(/\s+/g, '.');
    pin = String(b.pin || '').trim();
  } catch (e) {}

  const kIp = 'guru:' + (request.headers.get('CF-Connecting-IP') || 'unknown'), kAll = 'guru:*', kUser = 'guru:u:' + username;
  const [bIp, bUser, bAll] = await Promise.all([
    sudahBatas(env, kIp, MAX, WINDOW), 
    sudahBatas(env, kUser, MAX, WINDOW), 
    sudahBatas(env, kAll, MAX_ALL, WINDOW)
  ]);
  if (bIp || bUser || bAll) return json(429, { error: 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.' });

  try {
    let g = null;
    if (/^[a-z0-9.]{2,40}$/.test(username) && /^\d{6}$/.test(pin)) {
      // Skema ini mengikuti modul administrasi yang membaca nama, pin, aktif, dan peran.
      const rows = await dbGet(c)(`/guru_staf?username=eq.${encodeURIComponent(username)}&aktif=eq.true&select=id,nama,jabatan,kelompok,username,pin,peran,peran_tambahan,auth_user_id`);
      if (rows[0] && rows[0].pin && sama(rows[0].pin, pin)) g = rows[0];
    }

    if (!g) {
      await Promise.all([catatGagal(env, kIp, WINDOW), catatGagal(env, kAll, WINDOW), catatGagal(env, kUser, WINDOW)]);
      await new Promise(r => setTimeout(r, 700));
      return json(401, { error: 'Username atau PIN salah.' });
    }
    await Promise.all([hapusBatas(env, kIp), hapusBatas(env, kUser)]);

    const roles = [...new Set([g.peran, ...(Array.isArray(g.peran_tambahan) ? g.peran_tambahan : [])].filter(Boolean))];

    // Pastikan akun Supabase Auth ada dan kata sandinya = PIN saat ini.
    let id = g.auth_user_id, email = '';
    if (id) {
      const r = await authFetch(c, `/admin/users/${id}`);
      if (r.ok) email = String((await r.json()).email || '').toLowerCase(); else id = null;
    }

    if (id) {
      const r = await authFetch(c, `/admin/users/${id}`, { 
        method: 'PUT', 
        body: JSON.stringify({ password: pin, email_confirm: true }) 
      });
      if (!r.ok) return json(502, { error: 'Akun belum bisa disiapkan. Hubungi operator sekolah.' });
    } else {
      email = `${g.username}@${env.GURU_EMAIL_DOMAIN || 'guru.at-taqwa.sch.id'}`.toLowerCase();
      const r = await authFetch(c, '/admin/users', { 
        method: 'POST', 
        body: JSON.stringify({ 
          email, 
          password: pin, 
          email_confirm: true, 
          user_metadata: { nama: g.nama, roles }
        }) 
      });
      
      if (r.ok) id = (await r.json()).id;
      else {
        const u = await cariEmail(c, email);
        if (!u) return json(502, { error: 'Akun belum bisa dibuat. Hubungi operator sekolah.' });
        id = u.id;
        const p = await authFetch(c, `/admin/users/${id}`, { 
          method: 'PUT', 
          body: JSON.stringify({ password: pin, email_confirm: true }) 
        });
        if (!p.ok) return json(502, { error: 'Akun belum bisa disiapkan. Hubungi operator sekolah.' });
      }

      const linked = await fetch(`${c.REST}/guru_staf?id=eq.${g.id}`, {
        method: 'PATCH', 
        headers: { ...c.h, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ auth_user_id: id }) 
      });
      if (!linked.ok) return json(502, { error: 'Akun berhasil dibuat, tetapi tautan akun staf belum tersimpan. Coba login lagi.' });
    }

    return json(200, { email, roles });
  } catch (e) {
    return json(500, { error: 'Login belum bisa diproses. Coba lagi.' });
  }
}

export const onRequest = () => json(405, { error: 'Metode tidak diizinkan.' });