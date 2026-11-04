import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/bootstrap-operator.js';
import worker from '../src/worker.js';

const kv = () => {
  const data = new Map();
  return {
    async get(k) { return data.has(k) ? JSON.parse(data.get(k)) : null; },
    async put(k, v) { data.set(k, v); },
    async delete(k) { data.delete(k); }
  };
};
const makeRequest = (body, ip) => new Request('https://sekolah.test/api/bootstrap-operator', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
  body: JSON.stringify(body)
});

test('bootstrap Operator pertama membuat akun legacy yang dipakai login dan modul staf', async t => {
  const asli = globalThis.fetch, panggilan = [];
  t.after(() => { globalThis.fetch = asli; });
  globalThis.fetch = async (url, options = {}) => {
    url = String(url);
    panggilan.push({ url, options });
    if (url.includes('/guru_staf?peran=eq.operator')) return Response.json([]);
    if (url.includes('/guru_staf?username=eq.')) return Response.json([]);
    if (url.endsWith('/rest/v1/guru_staf') && options.method === 'POST') {
      const akun = JSON.parse(options.body);
      return Response.json([{ id: 'akun-1', ...akun }], { status: 201 });
    }
    throw new Error(`Permintaan tak terduga: ${url}`);
  };

  const env = { ADMIN_PIN: '654321', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test', PEMBATAS_KV: kv() };
  const response = await onRequestPost({ request: makeRequest({ nama: 'Nina Sari', pin: '654321' }, '10.0.0.1'), env });
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.nama, 'Nina Sari');
  assert.equal(result.username, 'nina.sari');
  assert.match(result.pin, /^\d{6}$/);

  const created = panggilan.find(x => x.options.method === 'POST');
  assert.deepEqual(JSON.parse(created.options.body), {
    nama: 'Nina Sari',
    jabatan: 'Operator Sekolah',
    kelompok: 'staf',
    peran: 'operator',
    peran_tambahan: [],
    username: result.username,
    pin: result.pin,
    aktif: true
  });
});

test('Worker meneruskan route bootstrap Operator ke endpoint setup', async () => {
  const response = await worker.fetch(new Request('https://sekolah.test/api/bootstrap-operator', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nama: 'Nina', pin: '123456' })
  }), { SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test' }, {});
  assert.equal(response.status, 500);
  assert.match((await response.json()).error, /ADMIN_PIN/);
});

test('bootstrap Operator menolak PIN admin salah dan menutup setup jika operator aktif sudah ada', async t => {
  const asli = globalThis.fetch;
  t.after(() => { globalThis.fetch = asli; });
  let operatorAda = true;
  globalThis.fetch = async url => {
    if (String(url).includes('/guru_staf?peran=eq.operator')) return Response.json(operatorAda ? [{ id: 'ada' }] : []);
    throw new Error(`Permintaan tak terduga: ${url}`);
  };
  const env = { ADMIN_PIN: '654321', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test', PEMBATAS_KV: kv() };

  const salah = await onRequestPost({ request: makeRequest({ nama: 'Nina', pin: '000000' }, '10.0.0.2'), env });
  assert.equal(salah.status, 401);
  const sudahAda = await onRequestPost({ request: makeRequest({ nama: 'Nina', pin: '654321' }, '10.0.0.4'), env });
  assert.equal(sudahAda.status, 409);
});
