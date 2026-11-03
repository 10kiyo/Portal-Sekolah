import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet as rekapAdmin } from '../functions/api/get-attendance.js';
import { onRequestGet as statusPublik } from '../functions/api/status-kehadiran.js';
import { hmac } from '../functions/_lib/util.js';

const env = { SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_uji', ADMIN_PIN: '123456', ADMIN_SECRET: 'rahasia-uji' };
const baris = [{ guest_id: 'g1', guest_name: 'Budi', status_hadir: true, confirmed_at: '2026-07-12T01:00:00Z', tanda_tangandata: 'data:image/png;base64,AAAA' }];
let urlTerakhir = '';
globalThis.fetch = async url => { urlTerakhir = String(url); return new Response(JSON.stringify(baris), { status: 200, headers: { 'Content-Type': 'application/json' } }); };
const req = token => new Request('https://x/api', { headers: token ? { authorization: 'Bearer ' + token } : {} });

test('get-attendance: tanpa token ditolak (401) dan tidak menyentuh database', async () => {
  urlTerakhir = '';
  assert.equal((await rekapAdmin({ request: req(), env })).status, 401);
  assert.equal((await rekapAdmin({ request: req('1.palsu'), env })).status, 401);
  assert.equal(urlTerakhir, '', 'database tidak boleh dipanggil sebelum token valid');
});

test('get-attendance: token admin valid -> rekap lengkap termasuk tanda tangan', async () => {
  const exp = Date.now() + 60_000, token = `${exp}.${await hmac(env.ADMIN_SECRET, String(exp))}`;
  const r = await rekapAdmin({ request: req(token), env });
  assert.equal(r.status, 200);
  assert.equal((await r.json())[0].tanda_tangandata, 'data:image/png;base64,AAAA');
});

test('status-kehadiran: publik, dan TIDAK pernah meminta kolom tanda tangan', async () => {
  const r = await statusPublik({ env });
  assert.equal(r.status, 200);
  assert.ok(!urlTerakhir.includes('tanda_tangandata'), 'kolom tanda tangan tidak boleh diminta');
  assert.ok(!urlTerakhir.includes('select=*'), 'tidak boleh select *');
  assert.ok(urlTerakhir.includes('guest_id') && urlTerakhir.includes('status_hadir'));
});
