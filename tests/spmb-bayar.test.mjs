import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

const env = () => ({
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test',
  PEMBATAS_KV: {
    async get() { return null; },
    async put() {},
    async delete() {}
  },
  ASSETS: { fetch: async () => new Response('asset') }
});

function form(jalur = 'luar', isiBukti = true) {
  const f = new FormData();
  f.set('jalur', jalur);
  f.set('nama', 'Nama Calon Murid');
  f.set('kontak', '081234567890');
  if (isiBukti) f.append('bukti', new Blob(['%PDF-1.7 bukti'], { type: 'application/pdf' }), 'bukti.pdf');
  return f;
}

test('spmb-bayar: unggah bukti pembayaran dan kembalikan token', async t => {
  const asli = globalThis.fetch, panggilan = [];
  t.after(() => { globalThis.fetch = asli; });
  globalThis.fetch = async (url, options = {}) => {
    panggilan.push({ url: String(url), options });
    if (String(url).includes('/spmb_pengaturan?')) {
      return Response.json([{ jalur: 'luar', aktif: true, buka: '2026-10-01', tutup: '2026-11-13' }]);
    }
    if (String(url).includes('/storage/v1/object/bukti-bayar/')) return new Response('', { status: 200 });
    if (String(url).endsWith('/spmb_bukti_bayar')) {
      return Response.json([{ token: 'token-pembayaran' }], { status: 201 });
    }
    throw new Error(`Permintaan tak terduga: ${url}`);
  };

  const response = await worker.fetch(new Request('https://sekolah.test/api/spmb-bayar', {
    method: 'POST',
    headers: { 'CF-Connecting-IP': '192.0.2.10' },
    body: form()
  }), env(), {});

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, token: 'token-pembayaran' });
  assert.ok(panggilan.some(x => x.url.includes('/storage/v1/object/bukti-bayar/')));
  const simpan = panggilan.find(x => x.url.endsWith('/spmb_bukti_bayar'));
  assert.ok(simpan);
  assert.equal(JSON.parse(simpan.options.body).nama, 'Nama Calon Murid');
  assert.equal(JSON.parse(simpan.options.body).kontak, '081234567890');
});

test('spmb-bayar: menolak jalur bukan TK Luar dan bukti yang tidak ada', async t => {
  const asli = globalThis.fetch;
  t.after(() => { globalThis.fetch = asli; });
  globalThis.fetch = async () => { throw new Error('Database tidak seharusnya dipanggil'); };

  const salahJalur = await worker.fetch(new Request('https://sekolah.test/api/spmb-bayar', {
    method: 'POST', headers: { 'CF-Connecting-IP': '192.0.2.11' }, body: form('dalam')
  }), env(), {});
  assert.equal(salahJalur.status, 400);

  const tanpaBukti = await worker.fetch(new Request('https://sekolah.test/api/spmb-bayar', {
    method: 'POST', headers: { 'CF-Connecting-IP': '192.0.2.12' }, body: form('luar', false)
  }), env(), {});
  assert.equal(tanpaBukti.status, 400);
  assert.match((await tanpaBukti.json()).error, /Unggah bukti transfer/);
});
