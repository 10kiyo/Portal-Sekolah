// Pintu masuk Worker: mengarahkan /api/* ke fungsi-fungsi yang sudah ada,
// dan menyerahkan semua permintaan lain ke file statis (folder public/).
import * as adminAuth from '../functions/api/admin-auth.js';
import * as adminChecklist from '../functions/api/admin-checklist.js';
import * as getAttendance from '../functions/api/get-attendance.js';
import * as submitAttendance from '../functions/api/submit-attendance.js';
import * as ortuLookup from '../functions/api/ortu-lookup.js';
import * as ortuKegiatan from '../functions/api/ortu-kegiatan.js';
import * as adminKegiatan from '../functions/api/admin-kegiatan.js';
import * as info from '../functions/api/info.js';
import * as adminInfo from '../functions/api/admin-info.js';
import * as youtube from '../functions/api/youtube.js';
import * as guru from '../functions/api/guru.js';

const routes = {
  '/api/admin-auth': adminAuth,
  '/api/admin-checklist': adminChecklist,
  '/api/get-attendance': getAttendance,
  '/api/submit-attendance': submitAttendance,
  '/api/ortu-lookup': ortuLookup,
  '/api/ortu-kegiatan': ortuKegiatan,
  '/api/admin-kegiatan': adminKegiatan,
  '/api/info': info,
  '/api/admin-info': adminInfo,
  '/api/youtube': youtube,
  '/api/guru': guru
};
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    const mod = routes[pathname.replace(/\/+$/, '')];
    if (mod) {
      const handler = (request.method === 'POST' && mod.onRequestPost) || (request.method === 'GET' && mod.onRequestGet) || mod.onRequest;
      return handler ? handler({ request, env, ctx }) : json(405, { error: 'Metode tidak diizinkan.' });
    }
    if (pathname.startsWith('/api/')) return json(404, { error: 'Tidak ditemukan.' });
    return env.ASSETS.fetch(request);
  }
};
