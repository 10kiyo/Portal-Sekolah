// Pembantu bersama untuk modul Kegiatan (bukan route).
export const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export function cfg(env) {
  const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!KEY) return null;
  const URL = (env.SUPABASE_URL || 'https://ejiivtioxouaeipmgsuq.supabase.co').replace(/\/+$/, '');
  const h = { apikey: KEY };
  if (!KEY.startsWith('sb_')) h.Authorization = `Bearer ${KEY}`;
  return { URL, REST: `${URL}/rest/v1`, h };
}
export const dbGet = c => async p => { const r = await fetch(c.REST + p, { headers: c.h }); if (!r.ok) throw new Error('db'); return r.json(); };

// Tanggal hari ini menurut WIB (UTC+7), format YYYY-MM-DD, dari jam server.
export const hariIni = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);

// Fase kegiatan: akan | dibuka | penuh | ditutup | selesai
export function fase(k, terpakai, today) {
  if (today > k.tanggal_kegiatan) return 'selesai';
  if (!k.aktif) return 'ditutup';
  if (today < k.buka_daftar) return 'akan';
  if (today > k.tutup_daftar) return 'ditutup';
  if (k.kuota != null && terpakai >= k.kuota) return 'penuh';
  return 'dibuka';
}

// ---- Tingkat kelas (1-6). Kegiatan boleh dibatasi untuk tingkat tertentu; kosong/null = semua kelas. ----
// "3A" -> 3; "Kelas 4B, 5A" -> [4, 5]
export const tingkatDari = kelas => [...new Set((String(kelas || '').match(/\d+/g) || []).map(Number).filter(n => n >= 1 && n <= 6))].sort();
export const tingkatKegiatan = k => (Array.isArray(k.tingkat) ? k.tingkat : []).map(Number).filter(n => n >= 1 && n <= 6).sort();
export const bolehTingkat = (k, anak) => { const t = tingkatKegiatan(k); return !t.length || (anak.tingkat || []).some(x => t.includes(x)); };
export const labelTingkat = k => { const t = tingkatKegiatan(k); return !t.length ? 'Semua kelas' : (t.length === 1 ? 'Kelas ' : 'Kelas ') + t.join(', '); };

// ---- Admin (token dari /api/admin-auth) ----
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
export async function adminOk(request, env) {
  const [exp, sig] = String(request.headers.get('authorization') || '').replace(/^Bearer /, '').split('.');
  const secret = env.ADMIN_SECRET || env.ADMIN_PIN;
  if (!exp || !sig || !secret || Number(exp) < Date.now()) return false;
  return same(sig, await hmac(secret, exp));
}

// ---- Orang tua: kode akses -> satu anak ----
const tries = new Map();
const MAX = 5, WINDOW = 10 * 60 * 1000, MAX_ALL = 60;
// Mengembalikan { anak: {key, nama, kelas} } atau { err: Response }.
// Boleh mengelola Info & Galeri: (1) PIN admin (token lama) ATAU (2) akun guru/staf yang sedang login (token Supabase)
// dengan peran 'info' / peran tambahan 'info' / admin. Token guru diperiksa ke Supabase Auth setiap permintaan.
export async function infoOk(request, env) {
  if (await adminOk(request, env)) return true;
  const tok = String(request.headers.get('authorization') || '').replace(/^Bearer /, '');
  const c = cfg(env);
  if (!c || tok.split('.').length !== 3) return false;
  try {
    const u = await fetch(`${c.URL}/auth/v1/user`, { headers: { apikey: c.h.apikey, Authorization: 'Bearer ' + tok } });
    if (!u.ok) return false;
    const uid = String((await u.json()).id || '');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uid)) return false;
    const r = (await dbGet(c)(`/guru_staf?auth_user_id=eq.${uid}&aktif=eq.true&select=peran,peran_tambahan&limit=1`))[0];
    return !!r && (r.peran === 'admin' || r.peran === 'info' || (r.peran_tambahan || []).includes('info'));
  } catch (e) { return false; }
}
export async function cariAnak(request, kode, c) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown', now = Date.now();
  let t = tries.get(ip); if (!t || now - t.start > WINDOW) t = { n: 0, start: now };
  let gl = tries.get('*'); if (!gl || now - gl.start > WINDOW) gl = { n: 0, start: now };
  if (t.n >= MAX || gl.n >= MAX_ALL) return { err: json(429, { error: 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.' }) };
  kode = String(kode || '').trim().toUpperCase();
  let anak = null;
  if (/^[A-Z0-9]{4,12}$/.test(kode)) {
    const cand = await dbGet(c)(`/kelas_murid?kode_akses=eq.${kode}&aktif=eq.true&select=id,guest_id,nama,kelas_kelas(nama)`);
    const g = cand[0] && cand[0].guest_id;
    if (cand.length === 1 || (g && cand.every(x => x.guest_id === g))) {
      const kelas = [...new Set(cand.map(x => x.kelas_kelas && x.kelas_kelas.nama).filter(Boolean))].join(', ');
      anak = { key: g || 'm:' + cand[0].id, nama: cand[0].nama, kelas, tingkat: tingkatDari(kelas) };
    }
  }
  if (!anak) {
    tries.set(ip, { ...t, n: t.n + 1 }); tries.set('*', { ...gl, n: gl.n + 1 });
    await new Promise(r => setTimeout(r, 700));
    return { err: json(404, { error: 'Kode akses tidak ditemukan. Periksa kembali kode dari guru.' }) };
  }
  tries.delete(ip);
  return { anak };
}

// ---- Foto kiriman (data URL) -> { bytes, mime, ext } atau { err: pesan }. Hanya JPEG/PNG/WEBP, maks ~2 MB, dicek dari byte awal. ----
export function bacaFoto(s, maxB64 = 2_800_000) {
  s = String(s || ''); const i = s.indexOf(','), mt = /^data:image\/(jpeg|png|webp);base64$/.exec(s.slice(0, i));
  if (i < 0 || !mt) return { err: 'Foto harus berupa JPG, PNG, atau WEBP.' };
  if (s.length - i > maxB64) return { err: 'Ukuran foto terlalu besar. Coba pilih foto lain.' };
  let bytes; try { bytes = Uint8Array.from(atob(s.slice(i + 1)), ch => ch.charCodeAt(0)); } catch (e) { return { err: 'Foto tidak terbaca.' }; }
  const ok = (mt[1] === 'jpeg' && bytes[0] === 0xFF && bytes[1] === 0xD8) || (mt[1] === 'png' && bytes[0] === 0x89 && bytes[1] === 0x50) ||
             (mt[1] === 'webp' && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57);
  return ok ? { bytes, mime: 'image/' + mt[1], ext: mt[1] === 'jpeg' ? 'jpg' : mt[1] } : { err: 'Berkas bukan foto yang valid.' };
}
// URL sementara (1 jam) untuk foto di bucket privat "jurnal"
export async function urlFoto(c, path) {
  if (!path) return null;
  try {
    const r = await fetch(`${c.URL}/storage/v1/object/sign/jurnal/${path}`, { method: 'POST', headers: { ...c.h, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 3600 }) });
    const d = await r.json();
    return d.signedURL ? `${c.URL}/storage/v1${d.signedURL}` : null;
  } catch (e) { return null; }
}

// ---- Pendaftaran umum (peserta dari luar sekolah, tanpa kode akses) ----
// Jumlah pendaftar yang memakai kuota (status selain "ditolak") per kegiatan.
export async function terpakaiMap(get, ids) {
  if (!ids.length) return {};
  const rows = await get(`/pendaftaran_kegiatan?kegiatan_id=in.(${ids.join(',')})&status=neq.ditolak&select=kegiatan_id&limit=10000`);
  const m = {}; rows.forEach(r => m[r.kegiatan_id] = (m[r.kegiatan_id] || 0) + 1);
  return m;
}
// Pembatas permintaan per alamat IP (dalam memori Worker; cukup untuk menahan pengiriman beruntun dari satu perangkat).
const batas = new Map();
export function terlaluSering(request, nama, maks, jendelaMs = 10 * 60 * 1000) {
  const k = nama + ':' + (request.headers.get('CF-Connecting-IP') || 'unknown'), now = Date.now();
  let t = batas.get(k); if (!t || now - t.start > jendelaMs) t = { n: 0, start: now };
  t.n++; batas.set(k, t);
  if (batas.size > 5000) for (const [kk, v] of batas) if (now - v.start > jendelaMs) batas.delete(kk);
  return t.n > maks;
}
// Kunci peserta umum: sama nama + sama sekolah = orang yang sama (mencegah daftar ganda).
export async function kunciUmum(nama, asal) {
  const n = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(n(nama) + '|' + n(asal)));
  return 'u:' + [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 24);
}
