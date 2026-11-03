// Pembantu SPMB online (bukan route): aturan pendaftaran, validasi isian, pembacaan berkas, dan izin panel panitia.
// Dipakai /api/spmb-daftar (publik) dan /api/admin-spmb (operator / admin).
import { adminOk, cfg, dbGet, UUID, TGL } from './util.js';

export const TAHUN_AJARAN = '2027/2028';
// Usia minimal 5 tahun 10 bulan per 1 Juli 2027  =>  lahir paling lambat 1 September 2021 (Panduan SPMB 2027/2028).
export const TGL_LAHIR_MAKS = '2021-09-01';
// Formulir gratis jalur TK At-Taqwa hanya sampai tanggal ini; setelahnya pendaftar dari TK At-Taqwa mengikuti ketentuan TK Luar.
export const DALAM_SAMPAI = '2026-12-31';
export const JALUR = ['dalam', 'luar'];
export const BAWAAN = { aktif: true, buka: '2026-10-01', tutup: '2026-11-13' };   // dipakai bila tabel spmb_pengaturan kosong/belum ada
export const STATUS = ['baru', 'perbaikan', 'terverifikasi', 'diterima', 'tidak_diterima', 'mundur'];
export const CHECKLIST = ['fotokopi', 'rapor', 'tata_usaha', 'lunas', 'pernyataan', 'wawancara', 'seragam'];
export const JENIS_BERKAS = { foto: 'foto_path', akte: 'akte_path', kk: 'kk_path', bukti: 'bukti_path' };

export const t = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

// ---- Periode pendaftaran ----
export async function pengaturan(get) {
  const p = { dalam: { ...BAWAAN }, luar: { ...BAWAAN } };
  try {
    (await get('/spmb_pengaturan?select=jalur,aktif,buka,tutup')).forEach(r => { if (p[r.jalur]) p[r.jalur] = { aktif: r.aktif !== false, buka: r.buka, tutup: r.tutup }; });
  } catch (e) { /* tabel belum dibuat: pakai bawaan */ }
  return p;
}
// dibuka | akan | ditutup | dialihkan (jalur TK At-Taqwa setelah formulir gratis berakhir)
export function fase(p, jalur, today) {
  if (!p.aktif) return 'ditutup';
  if (jalur === 'dalam' && today > DALAM_SAMPAI) return 'dialihkan';
  if (today < p.buka) return 'akan';
  if (today > p.tutup) return 'ditutup';
  return 'dibuka';
}

// ---- Validasi isian ----
// [kolom, label, panjang maksimal, wajib]
const TEKS = [
  ['nama', 'Nama lengkap calon murid', 80, true], ['nama_panggilan', 'Nama panggilan', 30, false], ['tempat_lahir', 'Tempat lahir', 60, true],
  ['alamat', 'Alamat tempat tinggal', 200, true], ['kelurahan', 'Kelurahan', 60, true], ['kecamatan', 'Kecamatan', 60, true], ['kota', 'Kota/kabupaten', 60, true],
  ['asal_tk', 'Nama TK/KB asal', 100, true], ['alamat_tk', 'Alamat TK/KB asal', 150, false],
  ['kondisi_khusus', 'Alergi/kondisi kesehatan', 300, false],
  ['nama_ayah', 'Nama ayah', 80, false], ['pekerjaan_ayah', 'Pekerjaan ayah', 60, false], ['hp_ayah', 'Nomor HP ayah', 40, false],
  ['nama_ibu', 'Nama ibu', 80, false], ['pekerjaan_ibu', 'Pekerjaan ibu', 60, false], ['hp_ibu', 'Nomor HP ibu', 40, false]
];
const bilangan = (v, min, max) => {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const x = Number(v); return Number.isInteger(x) && x >= min && x <= max ? x : NaN;
};
// Mengembalikan { row } (kolom tabel spmb_pendaftar yang siap disimpan) atau { err: pesan }.
export function bersihkan(b, jalur) {
  const row = {};
  for (const [k, label, n, wajib] of TEKS) {
    row[k] = t(b[k], n) || null;
    if (wajib && !row[k]) return { err: `Lengkapi ${label.toLowerCase()}.` };
  }
  if (jalur === 'luar' && !row.alamat_tk) return { err: 'Lengkapi alamat TK/KB asal.' };
  if (!row.nama_ayah && !row.nama_ibu) return { err: 'Isi nama ayah atau nama ibu.' };

  row.jenis_kelamin = String(b.jenis_kelamin || '').toUpperCase();
  if (!['L', 'P'].includes(row.jenis_kelamin)) return { err: 'Pilih jenis kelamin.' };

  const tgl = String(b.tanggal_lahir || '');
  if (!TGL.test(tgl) || new Date(tgl + 'T00:00:00Z').toISOString().slice(0, 10) !== tgl) return { err: 'Isi tanggal lahir dengan benar.' };
  if (tgl < '2012-01-01') return { err: 'Tanggal lahir tidak wajar. Periksa kembali.' };
  if (tgl > TGL_LAHIR_MAKS) return { err: 'Usia calon murid belum memenuhi syarat (minimal 5 tahun 10 bulan per Juli 2027). Hubungi panitia SPMB bila ada pertanyaan.' };
  row.tanggal_lahir = tgl;

  row.nik = String(b.nik || '').replace(/\D/g, '');
  if (!/^\d{16}$/.test(row.nik)) return { err: 'NIK calon murid harus 16 angka (lihat di Kartu Keluarga).' };

  row.anak_ke = bilangan(b.anak_ke, 1, 20); row.jumlah_saudara = bilangan(b.jumlah_saudara, 0, 20);
  if (Number.isNaN(row.anak_ke) || Number.isNaN(row.jumlah_saudara)) return { err: 'Isi "anak ke" dan "jumlah saudara" dengan angka yang benar.' };

  const hp = String(b.kontak || '').replace(/\D/g, '');
  if (hp.length < 9 || hp.length > 15) return { err: 'Isi nomor WhatsApp orang tua/wali dengan benar.' };
  row.kontak = t(b.kontak, 40);
  row.email = t(b.email, 80) || null;
  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) return { err: 'Alamat email tidak valid.' };
  return { row };
}
// Kunci pendaftar: nama + tanggal lahir yang sama = anak yang sama (mencegah pendaftaran ganda lintas jalur).
export async function kunciPendaftar(nama, tgl) {
  const n = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(n(nama) + '|' + tgl));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

// ---- Berkas unggahan (multipart): jenis ditentukan dari byte awal, bukan dari nama/tipe kiriman ----
const MB = 1024 * 1024;
export async function bacaBerkas(f, { pdf = false, maks = 2.5 * MB } = {}) {
  if (!f || typeof f !== 'object' || typeof f.arrayBuffer !== 'function' || !f.size) return { kosong: true };
  if (f.size > maks) return { err: `ukuran terlalu besar (maksimal ${String(maks / MB).replace('.', ',')} MB).` };
  const b = new Uint8Array(await f.slice(0, 12).arrayBuffer()), is = (...a) => a.every((v, i) => b[i] === v);
  if (is(0xFF, 0xD8)) return { file: f, mime: 'image/jpeg', ext: 'jpg' };
  if (is(0x89, 0x50, 0x4E, 0x47)) return { file: f, mime: 'image/png', ext: 'png' };
  if (is(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { file: f, mime: 'image/webp', ext: 'webp' };
  if (pdf && is(0x25, 0x50, 0x44, 0x46)) return { file: f, mime: 'application/pdf', ext: 'pdf' };
  return { err: pdf ? 'harus berupa foto (JPG/PNG/WEBP) atau PDF.' : 'harus berupa foto JPG, PNG, atau WEBP.' };
}
export const simpanBerkas = async (c, path, b) =>
  (await fetch(`${c.URL}/storage/v1/object/spmb/${path}`, { method: 'POST', headers: { ...c.h, 'Content-Type': b.mime }, body: b.file })).ok;
export const hapusBerkas = (c, paths) => Promise.all(paths.filter(Boolean).map(p =>
  fetch(`${c.URL}/storage/v1/object/spmb/${p}`, { method: 'DELETE', headers: c.h }).catch(() => {})));
// Tautan sementara (10 menit) ke berkas di bucket privat
export async function urlBerkas(c, path) {
  if (!path) return null;
  try {
    const r = await fetch(`${c.URL}/storage/v1/object/sign/spmb/${path}`, { method: 'POST', headers: { ...c.h, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 600 }) });
    const d = await r.json();
    return d.signedURL ? `${c.URL}/storage/v1${d.signedURL}` : null;
  } catch (e) { return null; }
}

// ---- Izin panel panitia SPMB: PIN admin (token lama) ATAU akun guru/staf berperan SPMB / operator / admin ----
// Token akun guru (Supabase Auth) diperiksa ke Supabase setiap permintaan; peran dibaca dari tabel guru_staf.
export async function spmbOk(request, env) {
  if (await adminOk(request, env)) return true;
  const tok = String(request.headers.get('authorization') || '').replace(/^Bearer /, '');
  const c = cfg(env);
  if (!c || tok.split('.').length !== 3) return false;
  try {
    const u = await fetch(`${c.URL}/auth/v1/user`, { headers: { apikey: c.h.apikey, Authorization: 'Bearer ' + tok } });
    if (!u.ok) return false;
    const uid = String((await u.json()).id || '');
    if (!UUID.test(uid)) return false;
    const r = (await dbGet(c)(`/guru_staf?auth_user_id=eq.${uid}&aktif=eq.true&select=peran,peran_tambahan&limit=1`))[0];
    return !!r && (['admin', 'operator', 'spmb'].includes(r.peran) || (r.peran_tambahan || []).some(p => ['operator', 'spmb'].includes(p)));
  } catch (e) { return false; }
}
