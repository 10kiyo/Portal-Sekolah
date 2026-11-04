// Cloudflare Pages Function: POST /api/ortu-lookup
// Membaca data siswa & akademik untuk orang tua berdasarkan kode_akses_ortu di tabel murid.
import { json, cfg, dbGet } from '../_lib/util.js';
import { sudahBatas, catatGagal, hapusBatas } from '../_lib/pembatas.js';

const MAX = 5, WINDOW = 10 * 60 * 1000, MAX_ALL = 60;

export async function onRequestPost({ request, env }) {
  const c = cfg(env);
  if (!c) return json(500, { error: 'SUPABASE_SERVICE_ROLE_KEY belum diatur.' });
  const SUPABASE_URL = c.URL, h = c.h, get = dbGet(c);

  const ip = 'ortu:' + (request.headers.get('CF-Connecting-IP') || 'unknown'), semua = 'ortu:*';
  if (await sudahBatas(env, ip, MAX, WINDOW) || await sudahBatas(env, semua, MAX_ALL, WINDOW)) {
    return json(429, { error: 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.' });
  }

  let kode = '';
  try { kode = String((await request.json()).kode || '').trim().toUpperCase(); } catch (e) {}

  const inList = a => `in.(${a.join(',')})`;

  try {
    let rows = [];
    if (/^[A-Z0-9]{4,12}$/.test(kode)) {
      // Disesuaikan: query langsung ke tabel murid dengan kode_akses_ortu
      rows = await get(`/murid?kode_akses_ortu=eq.${encodeURIComponent(kode)}&is_active=eq.true&select=id,nama_lengkap,nisn,nis,kelas_id,kelas(id,nama_kelas,wali_kelas_id)`);
    }

    if (!rows.length) {
      await catatGagal(env, ip, WINDOW); 
      await catatGagal(env, semua, WINDOW);
      await new Promise(r => setTimeout(r, 700));
      return json(404, { error: 'Kode akses tidak ditemukan. Periksa kembali kode dari guru.' });
    }
    await hapusBatas(env, ip);

    const m = rows[0];
    const muridId = m.id;
    const kelasId = m.kelas_id;
    const waliKelasId = m.kelas ? m.kelas.wali_kelas_id : null;

    // Ambil info nama Wali Kelas jika ada
    let namaWalas = '';
    if (waliKelasId) {
      const walasRow = await get(`/guru_staf?id=eq.${waliKelasId}&select=nama_lengkap`);
      if (walasRow[0]) namaWalas = walasRow[0].nama_lengkap;
    }

    // Ambil data presensi & nilai dari skema 03_akademik.sql
    const [presensi, nilai] = await Promise.all([
      get(`/kehadiran?murid_id=eq.${muridId}&select=tanggal_presensi,status_kehadiran,keterangan&order=tanggal_presensi.desc&limit=100`),
      get(`/nilai?murid_id=eq.${muridId}&select=id,mata_pelajaran,jenis_penilaian,nilai,catatan,created_at&order=created_at.desc&limit=100`)
    ]);

    // Modul Kesiswaan: BK & Catatan Kedisiplinan (04_kesiswaan.sql)
    let disiplin = null;
    try {
      const hari = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10), y = +hari.slice(0, 4), month = +hari.slice(5, 7);
      const ganjil = month >= 7, sem = ganjil ? `${y}/${y + 1} Ganjil` : `${y - 1}/${y} Genap`;
      const a = ganjil ? `${y}-07-01` : `${y}-01-01`, b = ganjil ? `${y}-12-31` : `${y}-06-30`;

      const cs = await get(`/bk_catatan?murid_id=eq.${muridId}&tanggal=gte.${a}&tanggal=lte.${b}&select=tanggal,kategori,jenis_pelanggaran,poin,tindak_lanjut&order=tanggal.desc&limit=200`);
      
      if (cs && cs.length) {
        disiplin = {
          semester: sem,
          poin: cs.filter(c => c.kategori !== 'prestasi').reduce((t, c) => t + (c.poin || 0), 0),
          prestasi: cs.filter(c => c.kategori === 'prestasi').reduce((t, c) => t + (c.poin || 0), 0),
          riwayat: cs.map(c => ({ 
            tanggal: c.tanggal, 
            kategori: c.kategori, 
            jenis: c.jenis_pelanggaran || c.kategori, 
            poin: c.poin || 0,
            tindak: c.tindak_lanjut || '-'
          }))
        };
      }
    } catch (e) {}

    return json(200, {
      nama: m.nama_lengkap,
      nisn: m.nisn || '',
      nis: m.nis || '',
      kelas: m.kelas ? m.kelas.nama_kelas : '',
      kehadiran: presensi.map(p => ({ tanggal: p.tanggal_presensi, status: p.status_kehadiran, keterangan: p.keterangan || '' })),
      disiplin,
      adaWalas: Boolean(waliKelasId),
      walas: namaWalas,
      nilai: nilai.map(x => ({
        mapel: x.mata_pelajaran,
        jenis: x.jenis_penilaian,
        nilai: x.nilai,
        catatan: x.catatan || ''
      }))
    });
  } catch (e) {
    return json(500, { error: 'Terjadi kesalahan server saat membaca data murid.' });
  }
}

export const onRequest = () => json(405, { error: 'Metode tidak diizinkan.' });