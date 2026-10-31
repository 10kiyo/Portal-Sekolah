// Cloudflare Worker route: GET /api/youtube  (publik)
// Mengambil 3 video terbaru dari kanal YouTube sekolah lewat RSS resmi YouTube, di-cache 30 menit.
// Kanal dibaca dari handle di bawah. Jika pencarian otomatis gagal, isi variabel YOUTUBE_CHANNEL_ID (UCxxxx...) di Cloudflare.
const HANDLE = 'sdiattaqwa2688';
const UA = 'Mozilla/5.0 (compatible; PortalSekolah/1.0)';
const out = (body, ttl) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${ttl}` } });
const dekode = t => t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

async function cariKanal(env) {
  if (/^UC[\w-]{22}$/.test(env.YOUTUBE_CHANNEL_ID || '')) return env.YOUTUBE_CHANNEL_ID;
  const r = await fetch(`https://www.youtube.com/@${HANDLE}`, { headers: { 'User-Agent': UA, 'Accept-Language': 'id-ID,id;q=0.9', Cookie: 'CONSENT=YES+1' } });
  const h = await r.text();
  const m = /<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/.exec(h)
    || /feeds\/videos\.xml\?channel_id=(UC[\w-]{22})/.exec(h)
    || /"externalId":"(UC[\w-]{22})"/.exec(h);
  return m ? m[1] : null;
}

export async function onRequestGet({ request, env, ctx }) {
  const cache = caches.default, key = new Request(new URL('/api/youtube', request.url).toString());
  const hit = await cache.match(key);
  if (hit) return hit;
  try {
    const id = await cariKanal(env);
    if (!id) return out({ videos: [] }, 300);
    const r = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`, { headers: { 'User-Agent': UA } });
    if (!r.ok) return out({ videos: [] }, 300);
    const xml = await r.text();
    const videos = xml.split('<entry>').slice(1, 4).map(e => ({
      id: (/<yt:videoId>([\w-]{11})<\/yt:videoId>/.exec(e) || [])[1],
      judul: dekode((/<title>([^<]*)<\/title>/.exec(e) || [, ''])[1]),
      tanggal: ((/<published>([^<]*)<\/published>/.exec(e) || [, ''])[1]).slice(0, 10)
    })).filter(v => v.id);
    const res = out({ videos }, 1800);
    ctx.waitUntil(cache.put(key, res.clone()));
    return res;
  } catch (e) {
    return out({ videos: [] }, 300);
  }
}
export const onRequest = () => new Response(JSON.stringify({ error: 'Metode tidak diizinkan.' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
