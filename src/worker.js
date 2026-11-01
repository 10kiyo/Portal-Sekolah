// Pintu masuk Worker: mengarahkan /api/* ke fungsi-fungsi yang sudah ada,
// dan menyerahkan semua permintaan lain ke file statis (folder public/).
import * as adminAuth from '../functions/api/admin-auth.js';
import * as adminChecklist from '../functions/api/admin-checklist.js';
import * as getAttendance from '../functions/api/get-attendance.js';
import * as submitAttendance from '../functions/api/submit-attendance.js';
import * as ortuLookup from '../functions/api/ortu-lookup.js';
import * as ortuKegiatan from '../functions/api/ortu-kegiatan.js';
import * as adminKegiatan from '../functions/api/admin-kegiatan.js';
import * as umumKegiatan from '../functions/api/umum-kegiatan.js';
import * as info from '../functions/api/info.js';
import * as galeri from '../functions/api/galeri.js';
import * as adminInfo from '../functions/api/admin-info.js';
import * as youtube from '../functions/api/youtube.js';
import * as guru from '../functions/api/guru.js';
import * as fasilitas from '../functions/api/fasilitas.js';
import * as guruLogin from '../functions/api/guru-login.js';
import * as jurnal from '../functions/api/jurnal.js';
import * as muridJurnal from '../functions/api/murid-jurnal.js';
import * as adminJurnal from '../functions/api/admin-jurnal.js';
import { cfg, dbGet } from '../functions/_lib/util.js';

const routes = {
  '/api/admin-auth': adminAuth,
  '/api/admin-checklist': adminChecklist,
  '/api/get-attendance': getAttendance,
  '/api/submit-attendance': submitAttendance,
  '/api/ortu-lookup': ortuLookup,
  '/api/ortu-kegiatan': ortuKegiatan,
  '/api/admin-kegiatan': adminKegiatan,
  '/api/umum-kegiatan': umumKegiatan,
  '/api/info': info,
  '/api/galeri': galeri,
  '/api/admin-info': adminInfo,
  '/api/youtube': youtube,
  '/api/guru': guru,
  '/api/fasilitas': fasilitas,
  '/api/guru-login': guruLogin,
  '/api/jurnal': jurnal,
  '/api/murid-jurnal': muridJurnal,
  '/api/admin-jurnal': adminJurnal
};
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// Halaman pratinjau untuk dibagikan: /bagikan/<id>. Pembuat pratinjau (WhatsApp, Facebook, dll) membaca tag og: di sini;
// pengunjung langsung diarahkan ke /#info/<id>/saja (hanya info itu).
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
async function bagikan(id, request, env) {
  const asal = new URL(request.url).origin, tujuan = `${asal}/#info/${id}/saja`;
  let x = null; const c = cfg(env);
  if (c) { try { x = (await dbGet(c)(`/info_sekolah?id=eq.${id}&terbit=eq.true&select=judul,isi,tanggal_agenda,lokasi,lampiran_url&limit=1`))[0] || null; } catch (e) { /* tampilkan pratinjau umum */ } }
  const judul = x ? x.judul : 'Info Terbaru - SDS Islam At-Taqwa Rawamangun';
  let ket = 'Pengumuman, agenda, dan surat edaran dari SDS Islam At-Taqwa Rawamangun.';
  if (x) {
    const tgl = x.tanggal_agenda ? new Date(x.tanggal_agenda + 'T00:00:00Z').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '';
    const isi = String(x.isi || '').replace(/\s+/g, ' ').trim();
    ket = [tgl, x.lokasi, isi].filter(Boolean).join(' · ').slice(0, 200) || ket;
  }
  const lamp = x && /^https:\/\/.+\.(jpe?g|png|webp)(\?|$)/i.test(x.lampiran_url || '') ? x.lampiran_url : `${asal}/foto-sekolah.jpg`;
  const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(judul)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta property="og:type" content="article"><meta property="og:site_name" content="SDS Islam At-Taqwa Rawamangun">
<meta property="og:title" content="${esc(judul)}"><meta property="og:description" content="${esc(ket)}">
<meta property="og:image" content="${esc(lamp)}"><meta property="og:url" content="${esc(asal + '/bagikan/' + id)}">
<meta name="twitter:card" content="summary_large_image"><meta name="description" content="${esc(ket)}">
<script>location.replace(${JSON.stringify(tujuan).replace(/</g, '\\u003c')});</script>
<noscript><meta http-equiv="refresh" content="0;url=${esc(tujuan)}"></noscript></head>
<body><p><a href="${esc(tujuan)}">Buka info: ${esc(judul)}</a></p></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    const mod = routes[pathname.replace(/\/+$/, '')];
    if (mod) {
      const handler = (request.method === 'POST' && mod.onRequestPost) || (request.method === 'GET' && mod.onRequestGet) || mod.onRequest;
      return handler ? handler({ request, env, ctx }) : json(405, { error: 'Metode tidak diizinkan.' });
    }
    const b = /^\/bagikan\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i.exec(pathname);
    if (b && request.method === 'GET') return bagikan(b[1].toLowerCase(), request, env);
    if (pathname.startsWith('/api/')) return json(404, { error: 'Tidak ditemukan.' });
    return env.ASSETS.fetch(request);
  }
};
