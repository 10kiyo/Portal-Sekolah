// Cloudflare Worker route: GET /api/galeri  (publik)
// Galeri Prestasi Siswa = foto yang diunggah admin di Kelola Info > Galeri Prestasi (tabel galeri_prestasi)
// DIGABUNG dengan gambar lampiran Info berkategori Prestasi yang terbit. Query opsional: ?limit=8
// Cache 60 detik (browser + Cloudflare), sama seperti /api/info. Tabel galeri belum dibuat = hanya foto dari Info.
import { json, cfg, dbGet } from '../_lib/util.js';

const TTL = 60, IMG = /^https?:\/\/.+\.(jpe?g|png|webp)(\?|$)/i;
const ok = body => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${TTL}` } });

export async function onRequestGet({ request, env, ctx }) {
  const u = new URL(request.url), kunci = new URL(u.origin + u.pathname);
  if (u.searchParams.get('limit')) kunci.searchParams.set('limit', u.searchParams.get('limit'));
  const cache = typeof caches !== 'undefined' ? caches.default : null, key = new Request(kunci.toString(), { method: 'GET' });
  if (cache) { try { const hit = await cache.match(key); if (hit) return hit; } catch (e) { /* lanjut tanpa cache */ } }
  const res = await ambil(request, env);
  if (cache && res.status === 200) { try { const p = cache.put(key, res.clone()); ctx && ctx.waitUntil ? ctx.waitUntil(p) : await p; } catch (e) { /* abaikan */ } }
  return res;
}

async function ambil(request, env) {
  const c = cfg(env);
  if (!c) return json(500, { error: 'SUPABASE_SERVICE_ROLE_KEY belum diatur.' });
  const lim = Math.min(Math.max(parseInt(new URL(request.url).searchParams.get('limit')) || 500, 1), 1000), get = dbGet(c);
  const [g, inf] = await Promise.all([
    get('/galeri_prestasi?tampil=eq.true&order=tanggal.desc,created_at.desc&limit=1000&select=id,foto_url,keterangan,tanggal,created_at').catch(() => []),
    get('/info_sekolah?terbit=eq.true&kategori=eq.prestasi&order=sematkan.desc,tanggal_terbit.desc,created_at.desc&limit=500&select=id,judul,tanggal_terbit,sematkan,lampiran_url,created_at').catch(() => [])
  ]);
  const semua = [
    ...inf.filter(x => IMG.test(x.lampiran_url || '')).map(x => ({ id: x.id, foto: x.lampiran_url, judul: x.judul || '', tanggal: x.tanggal_terbit, info_id: x.id, pin: x.sematkan ? 1 : 0, t: x.created_at || '' })),
    ...g.filter(x => IMG.test(x.foto_url || '')).map(x => ({ id: x.id, foto: x.foto_url, judul: x.keterangan || '', tanggal: x.tanggal, info_id: null, pin: 0, t: x.created_at || '' }))
  ];
  const lihat = new Set(), unik = semua.filter(x => !lihat.has(x.foto) && lihat.add(x.foto));
  unik.sort((a, b) => b.pin - a.pin || String(b.tanggal).localeCompare(String(a.tanggal)) || b.t.localeCompare(a.t));
  return ok({ total: unik.length, foto: unik.slice(0, lim).map(({ pin, t, ...x }) => x) });
}
export const onRequest = () => json(405, { error: 'Metode tidak diizinkan.' });
