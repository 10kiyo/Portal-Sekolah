// Cache publik 60 detik untuk endpoint GET yang boleh dibaca siapa saja (/api/info, /api/galeri).
// Dua lapis: di browser (Cache-Control) dan bersama di Cloudflare (Cache API). Ramai pengunjung hanya memicu
// ~1 permintaan ke Supabase per menit per variasi query. Konten baru muncul paling lambat TTL_CACHE detik kemudian.
export const TTL_CACHE = 60;

export const okCache = body => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${TTL_CACHE}` } });

// Menjalankan `ambil()` lewat cache. Kunci cache hanya memakai parameter di `paramKunci` (parameter acak tidak bisa menembus cache).
// Hanya respons berstatus 200 yang disimpan. Bila Cache API tidak ada atau gagal, permintaan tetap dilayani tanpa cache.
export async function denganCache({ request, ctx }, paramKunci, ambil) {
  const u = new URL(request.url), kunci = new URL(u.origin + u.pathname);
  paramKunci.forEach(k => { if (u.searchParams.get(k)) kunci.searchParams.set(k, u.searchParams.get(k)); });
  const cache = typeof caches !== 'undefined' ? caches.default : null, key = new Request(kunci.toString(), { method: 'GET' });
  if (cache) { try { const hit = await cache.match(key); if (hit) return hit; } catch (e) { /* lanjut tanpa cache */ } }
  const res = await ambil();
  if (cache && res.status === 200) { try { const p = cache.put(key, res.clone()); ctx && ctx.waitUntil ? ctx.waitUntil(p) : await p; } catch (e) { /* abaikan */ } }
  return res;
}
