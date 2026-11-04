// Membuat akun Operator pertama setelah deploy; ditutup otomatis setelah akun Operator tersedia.
import { json, cfg, dbGet, same, headerTulis } from '../_lib/util.js';
import { terlaluSering } from '../_lib/pembatas.js';

const usernameAman = s => /^[a-z0-9.]{2,40}$/.test(s);

function usernameDasar(nama) {
  const dasar = nama.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '').slice(0, 34);
  return dasar.length >= 2 ? dasar : `${dasar || 'staf'}.op`;
}

function pinBaru() {
  const max = 900_000, batas = Math.floor(0x1_0000_0000 / max) * max;
  const acak = new Uint32Array(1);
  do crypto.getRandomValues(acak); while (acak[0] >= batas);
  return String(100_000 + (acak[0] % max));
}

export async function onRequestPost({ request, env }) {
  if (await terlaluSering(env, request, 'bootstrap-operator', 5)) {
    return json(429, { error: 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.' });
  }

  const adminPin = String(env.ADMIN_PIN || '').trim();
  if (!adminPin) return json(500, { error: 'ADMIN_PIN belum diatur di Cloudflare.' });
  const c = cfg(env);
  if (!c) return json(500, { error: 'SUPABASE_SERVICE_ROLE_KEY belum diatur.' });

  let body;
  try { body = await request.json(); } catch (e) { body = {}; }
  if (!body || typeof body !== 'object' || Array.isArray(body)) body = {};
  if (!(await same(String(body.pin || '').trim(), adminPin))) {
    return json(401, { error: 'PIN admin tidak valid.' });
  }

  const nama = String(body.nama || '').trim().replace(/\s+/g, ' ');
  if (!nama || nama.length > 100 || /[\u0000-\u001f\u007f]/.test(nama)) {
    return json(400, { error: 'Nama wajib diisi dan maksimal 100 karakter.' });
  }

  const get = dbGet(c);
  let operator;
  try {
    operator = await get('/guru_staf?peran=eq.operator&select=id,nama,jabatan,kelompok,peran,peran_tambahan,username,pin,aktif,auth_user_id,foto&limit=1');
  } catch (e) {
    return json(500, { error: 'Skema guru_staf belum cocok. Pastikan kolom nama, jabatan, kelompok, username, pin, aktif, peran, peran_tambahan, auth_user_id, dan foto tersedia.' });
  }
  if (operator.length) return json(409, { error: 'Operator aktif sudah tersedia. Setup awal sudah ditutup.' });

  let username = usernameDasar(nama);
  try {
    for (let nomor = 2; ; nomor++) {
      const ada = await get(`/guru_staf?username=eq.${encodeURIComponent(username)}&select=id&limit=1`);
      if (!ada.length) break;
      const akhiran = `.${nomor}`;
      username = `${usernameDasar(nama).slice(0, 40 - akhiran.length)}${akhiran}`;
      if (!usernameAman(username) || nomor > 1000) throw new Error('username');
    }

    const pin = pinBaru();
    const created = await fetch(`${c.REST}/guru_staf`, {
      method: 'POST',
      headers: { ...headerTulis(c), Prefer: 'return=representation' },
      body: JSON.stringify({
        nama,
        jabatan: 'Operator Sekolah',
        kelompok: 'staf',
        peran: 'operator',
        peran_tambahan: [],
        username,
        pin,
        aktif: true
      })
    });
    if (!created.ok) return json(500, { error: 'Akun Operator belum bisa dibuat. Periksa skema dan izin tabel guru_staf di Supabase.' });
    const rows = await created.json();
    const akun = rows[0];
    if (!akun || akun.username !== username || String(akun.pin) !== pin || akun.peran !== 'operator' || akun.aktif !== true) {
      if (akun && akun.id) {
        await fetch(`${c.REST}/guru_staf?id=eq.${encodeURIComponent(akun.id)}`, {
          method: 'DELETE',
          headers: headerTulis(c)
        });
      }
      return json(500, { error: 'Akun awal tidak dapat diverifikasi. Periksa trigger dan default tabel guru_staf di Supabase.' });
    }
    return json(201, { nama: akun.nama, username: akun.username, pin: String(akun.pin) });
  } catch (e) {
    return json(500, { error: 'Setup Operator gagal. Periksa koneksi dan skema tabel guru_staf.' });
  }
}

export const onRequest = () => json(405, { error: 'Metode tidak diizinkan.' });
