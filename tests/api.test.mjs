import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as guruLogin } from '../functions/api/guru-login.js';
import { onRequestPost as ortuLookup } from '../functions/api/ortu-lookup.js';
import { onRequestPost as adminAuth } from '../functions/api/admin-auth.js';

const env = { SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_uji', PEMBATAS_KV: (() => { const m = new Map(); return { async get(k) { return m.has(k) ? JSON.parse(m.get(k)) : null; }, async put(k, v) { m.set(k, v); }, async delete(k) { m.delete(k); } }; })() };
const post = (body, ip) => new Request('https://x/api', { method: 'POST', headers: { 'CF-Connecting-IP': ip }, body: JSON.stringify(body) });
// Database palsu: tidak ada data apa pun (semua pencarian kosong).
globalThis.fetch = async () => new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });

test('guru-login: salah berulang -> 429 setelah 6 percobaan', async () => {
  const s = [];
  for (let i = 0; i < 8; i++) s.push((await guruLogin({ request: post({ username: 'budi', pin: '000000' }, '9.9.9.9'), env })).status);
  assert.deepEqual(s.slice(0, 6), [401, 401, 401, 401, 401, 401]);
  assert.deepEqual(s.slice(6), [429, 429]);
});

test('guru-login: tanpa kunci Supabase -> 500 yang jelas', async () => {
  const r = await guruLogin({ request: post({ username: 'a', pin: '1' }, '8.8.8.8'), env: {} });
  assert.equal(r.status, 500);
});

test('ortu-lookup: kode salah -> 404, lalu 429 setelah 5 percobaan', async () => {
  const s = [];
  for (let i = 0; i < 7; i++) s.push((await ortuLookup({ request: post({ kode: 'ABCD1234' }, '7.7.7.7'), env })).status);
  assert.deepEqual(s, [404, 404, 404, 404, 404, 429, 429]);
});

test('admin-auth: PIN salah 401, benar menghasilkan token', async () => {
  const e = { ADMIN_PIN: '654321' };
  assert.equal((await adminAuth({ request: post({ pin: '000000' }, '1.2.3.4'), env: e })).status, 401);
  const ok = await adminAuth({ request: post({ pin: '654321' }, '1.2.3.4'), env: e });
  assert.equal(ok.status, 200); assert.match((await ok.json()).token, /^\d+\.[0-9a-f]{64}$/);
});

test('wrangler.jsonc: binding KV pembatas harus ada (tanpa itu pembatas jatuh ke memori yang lemah)', async () => {
  const { readFileSync } = await import('node:fs');
  const teks = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  const cfgW = JSON.parse(teks);
  assert.ok((cfgW.kv_namespaces || []).some(k => k.binding === 'PEMBATAS_KV'), 'binding PEMBATAS_KV tidak ditemukan');
});
