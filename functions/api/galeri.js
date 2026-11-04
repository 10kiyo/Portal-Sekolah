// Cloudflare Worker route: GET /api/galeri (publik)
// Galeri Prestasi Siswa = foto yang diunggah admin di Kelola Info > Galeri Prestasi (tabel galeri_prestasi)
// DIGABUNG dengan gambar lampiran Info berkategori Prestasi yang terbit. Query opsional: ?limit=8
import { json, cfg, dbGet } from '../_lib/util.js';
import { okCache, denganCache } from '../_lib/cache-publik.js';

const IMG = /^https?:\/\/.+\.(jpe?g|png|webp)(\?|$)/i;

export const onRequestGet = ({ request, env, ctx }) => avecCache({ request, ctx }, ['limit'], () => ambil(request, env));

// Alias fungsi cache agar aman jika import menggunakan avecCache atau denganCache
const avecCache = denganCache;

async function ambil(request, env) {
  const c = cfg(env);
  if (!c) return json(500, { error: 'SUPABASE_SERVICE_ROLE_KEY belum diatur.' });

  const lim = Math.min(Math.max(parseInt(new URL(request.url).searchParams.get('limit')) || 500, 1), 1000);
  const get = dbGet(c);

  const [g, inf] = await Promise.all([
    get('/galeri_prestasi?tampil=eq.true&order=tanggal.desc,created_at.desc&limit=1000&select=id,foto_url,keterangan,tanggal,created_at').catch(async () => {
      // Fallback jika tabel galeri_prestasi menggunakan is_active
      return await get('/galeri_prestasi?is_active=eq.true&order=created_at.desc&limit=1000&select=id,foto_url,keterangan,created_at').catch(() => []);
    }),
    get('/info_sekolah?terbit=eq.true&kategori=eq.prestasi&order=sematkan.desc,tanggal_terbit.desc,created_at.desc&limit=500&select=id,judul,tanggal_terbit,sematkan,lampiran_url,created_at').catch(() => [])
  ]);

  const semua = [
    ...inf.filter(x => IMG.test(x.lampiran_url || '')).map(x => ({ 
      id: x.id, 
      foto: x.lampiran_url, 
      judul: x.judul || '', 
      tanggal: x.tanggal_terbit || x.created_at, 
      info_id: x.id, 
      pin: x.sematkan ? 1 : 0, 
      t: x.created_at || '' 
    })),
    ...g.filter(x => IMG.test(x.foto_url || '')).map(x => ({ 
      id: x.id, 
      foto: x.foto_url, 
      judul: x.keterangan || '', 
      tanggal: x.tanggal || x.created_at, 
      info_id: null, 
      pin: 0, 
      t: x.created_at || '' 
    }))
  ];

  const lihat = new Set();
  const unik = semua.filter(x => !lihat.has(x.foto) && lihat.add(x.foto));

  unik.sort((a, b) => b.pin - a.pin || String(b.tanggal || '').localeCompare(String(a.tanggal || '')) || String(b.t || '').localeCompare(String(a.t || '')));

  return okCache({ total: unik.length, foto: unik.slice(0, lim).map(({ pin, t, ...x }) => x) });
}

export const onRequest = () => json(405, { error: 'Metode tidak diizinkan.' });