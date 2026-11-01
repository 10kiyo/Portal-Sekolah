// Cloudflare Pages Function: POST /api/ortu-lookup
// Satu kode akses -> data SATU anak dari SEMUA guru (digabung lewat guest_id). Kehadiran hanya dari wali kelas.
// Variabel: SUPABASE_SERVICE_ROLE_KEY (wajib, jadikan Secret), SUPABASE_URL (opsional).
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// Pembatas percobaan (best-effort: tersimpan di memori instance, bisa reset kapan saja).
const tries = new Map();
const MAX = 5, WINDOW = 10 * 60 * 1000, MAX_ALL = 60;
const COLS = 'id,nama,kelas_id,guru_id,guest_id,kelas_kelas(nama)';

export async function onRequestPost({ request, env }) {
  const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!KEY) return json(500, { error: 'SUPABASE_SERVICE_ROLE_KEY belum diatur.' });
  const SUPABASE_URL = (env.SUPABASE_URL || 'https://ejiivtioxouaeipmgsuq.supabase.co').replace(/\/+$/, '');
  const REST = `${SUPABASE_URL}/rest/v1`;

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Date.now();
  let t = tries.get(ip);
  if (!t || now - t.start > WINDOW) t = { n: 0, start: now };
  let gl = tries.get('*');
  if (!gl || now - gl.start > WINDOW) gl = { n: 0, start: now };
  if (t.n >= MAX || gl.n >= MAX_ALL) return json(429, { error: 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.' });

  let kode = '';
  try { kode = String((await request.json()).kode || '').trim().toUpperCase(); } catch (e) {}

  const h = { apikey: KEY };
  if (!KEY.startsWith('sb_')) h.Authorization = `Bearer ${KEY}`;
  const get = async p => { const r = await fetch(REST + p, { headers: h }); if (!r.ok) throw new Error('db'); return r.json(); };
  const inList = a => `in.(${a.join(',')})`;

  try {
    let rows = [];
    if (/^[A-Z0-9]{4,12}$/.test(kode)) {
      const cand = await get(`/kelas_murid?kode_akses=eq.${kode}&aktif=eq.true&select=id,guest_id`);
      const g = cand[0] && cand[0].guest_id;
      // Sah jika kode milik satu anak: satu baris, atau semua baris punya guest_id yang sama.
      if (cand.length === 1 || (g && cand.every(c => c.guest_id === g))) {
        rows = g
          ? await get(`/kelas_murid?guest_id=eq.${encodeURIComponent(g)}&aktif=eq.true&select=${COLS}`)
          : await get(`/kelas_murid?id=eq.${cand[0].id}&select=${COLS}`);
      }
    }
    if (!rows.length) {
      tries.set(ip, { ...t, n: t.n + 1 }); tries.set('*', { ...gl, n: gl.n + 1 });
      await new Promise(r => setTimeout(r, 700));
      return json(404, { error: 'Kode akses tidak ditemukan. Periksa kembali kode dari guru.' });
    }
    tries.delete(ip);

    const ids = rows.map(r => r.id);
    const kids = [...new Set(rows.map(r => r.kelas_id))], gids = [...new Set(rows.map(r => r.guru_id))];
    const prof = await get(`/kelas_profil?guru_id=${inList(gids)}&select=guru_id,nama,wali_kelas_id`);
    // Kehadiran untuk orang tua hanya dari wali kelas: guru yang menetapkan kelas anak ini sebagai kelas walinya.
    const wali = rows.filter(r => prof.some(p => p.guru_id === r.guru_id && p.wali_kelas_id === r.kelas_id));
    const [presensi, tugas, nilai] = await Promise.all([
      wali.length ? get(`/kelas_presensi?murid_id=${inList(wali.map(r => r.id))}&select=status,kelas_pertemuan(tanggal)&limit=5000`) : [],
      get(`/kelas_tugas?kelas_id=${inList(kids)}&select=id,judul,tenggat,guru_id,kelas_mapel(nama)&order=tenggat.desc.nullslast&limit=2000`),
      get(`/kelas_nilai?murid_id=${inList(ids)}&select=tugas_id,status,nilai,catatan&limit=5000`)
    ]);
    const gn = Object.fromEntries(prof.map(p => [p.guru_id, p.nama]));
    const nm = Object.fromEntries(nilai.map(x => [x.tugas_id, x]));

    // Foto karya yang diizinkan guru: tautan sementara (1 jam).
    let karya = [];
    try {
      const kr = await get(`/kelas_karya?murid_id=${inList(ids)}&tampil_ortu=eq.true&select=path,kelas_tugas(judul)&order=created_at.desc&limit=24`);
      karya = (await Promise.all(kr.map(async k => {
        const r = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/karya/${k.path}`, { method: 'POST', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 3600 }) });
        const d = await r.json().catch(() => ({}));
        return d.signedURL ? { judul: k.kelas_tugas && k.kelas_tugas.judul, url: `${SUPABASE_URL}/storage/v1${d.signedURL}` } : null;
      }))).filter(Boolean);
    } catch (e) {}

    // Ringkasan kedisiplinan dari modul BK (supabase-bk.sql). Hanya terlambat/atribut/pelanggaran/prestasi + tindak lanjut;
    // catatan konseling dan catatan orang tua TIDAK pernah dikirim. Dimatikan lewat BK > Pengaturan. Gagal/tabel belum ada = dilewati.
    let disiplin = null;
    try {
      const gid = (rows.find(r => r.guest_id) || {}).guest_id;
      const peng = gid ? await get('/bk_pengaturan?kunci=eq.ortu&select=nilai') : [];
      if (gid && (!peng[0] || !peng[0].nilai || peng[0].nilai.tampil !== false)) {
        const hari = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10), y = +hari.slice(0, 4), m = +hari.slice(5, 7);
        const ganjil = m >= 7, sem = ganjil ? `${y}/${y + 1} Ganjil` : `${y - 1}/${y} Genap`;
        const a = ganjil ? `${y}-07-01` : `${y}-01-01`, b = ganjil ? `${y}-12-31` : `${y}-06-30`, g = encodeURIComponent(gid);
        const [cs, ts] = await Promise.all([
          get(`/bk_catatan?guest_id=eq.${g}&tanggal=gte.${a}&tanggal=lte.${b}&select=tanggal,kategori,jenis_nama,poin&order=tanggal.desc&limit=200`),
          get(`/bk_tindak?guest_id=eq.${g}&semester=eq.${encodeURIComponent(sem)}&select=tanggal,tingkat&order=tanggal.desc`)
        ]);
        const LBL = { teguran: 'Teguran lisan', sp1: 'Surat Peringatan 1', sp2: 'Surat Peringatan 2', sp3: 'Surat Peringatan 3', panggil_ortu: 'Panggilan orang tua', skorsing: 'Skorsing', lainnya: 'Tindak lanjut' };
        disiplin = {
          semester: sem,
          poin: cs.filter(c => c.kategori !== 'prestasi').reduce((t, c) => t + c.poin, 0),
          prestasi: cs.filter(c => c.kategori === 'prestasi').reduce((t, c) => t + c.poin, 0),
          riwayat: cs.map(c => ({ tanggal: c.tanggal, kategori: c.kategori, jenis: c.jenis_nama, poin: c.poin })),
          tindak: ts.map(t => ({ tanggal: t.tanggal, tingkat: LBL[t.tingkat] || 'Tindak lanjut' }))
        };
      }
    } catch (e) {}

    return json(200, {
      nama: rows[0].nama,
      kelas: [...new Set(rows.map(r => r.kelas_kelas && r.kelas_kelas.nama).filter(Boolean))].join(', '),
      kehadiran: presensi.filter(p => p.kelas_pertemuan).map(p => ({ tanggal: p.kelas_pertemuan.tanggal, status: p.status }))
        .sort((a, b) => b.tanggal.localeCompare(a.tanggal)),
      disiplin,
      adaWalas: wali.length > 0, walas: wali.length ? gn[wali[0].guru_id] || '' : '',
      karya,
      tugas: tugas.map(x => ({
        judul: x.judul, mapel: (x.kelas_mapel || {}).nama || '', guru: gn[x.guru_id] || '', tenggat: x.tenggat,
        status: (nm[x.id] || {}).status || 'belum', nilai: (nm[x.id] || {}).nilai ?? null, catatan: (nm[x.id] || {}).catatan || null
      }))
    });
  } catch (e) {
    return json(500, { error: 'Terjadi kesalahan server.' });
  }
}
export const onRequest = () => json(405, { error: 'Metode tidak diizinkan.' });
