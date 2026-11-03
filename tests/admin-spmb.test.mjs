import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/admin-spmb.js';

const ID = '47eb41a2-742f-468a-8f94-31562915d596';
const env = { SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test' };
const request = body => new Request('https://sekolah.test/api/admin-spmb', {
  method: body ? 'POST' : 'GET',
  headers: { Authorization: 'Bearer test.token.value', ...(body ? { 'Content-Type': 'application/json' } : {}) },
  body: body ? JSON.stringify(body) : undefined
});

test('admin SPMB melihat bukti pembayaran menunggu verifikasi dan dapat membuka tautannya', async t => {
  const asli = globalThis.fetch;
  t.after(() => { globalThis.fetch = asli; });
  globalThis.fetch = async (url, options = {}) => {
    url = String(url);
    if (url.endsWith('/auth/v1/user')) return Response.json({ id: ID });
    if (url.includes('/guru_staf?')) return Response.json([{ peran: 'spmb', peran_tambahan: [] }]);
    if (url.includes('/spmb_pendaftar?')) return Response.json([]);
    if (url.includes('/spmb_pengaturan?')) return Response.json([]);
    if (url.endsWith('/spmb_bukti_bayar?order=created_at.desc&limit=1000&select=id,nama,kontak,status,catatan,dipakai_oleh,created_at'))
      return Response.json([{ id: ID, nama: 'Calon Murid', kontak: '08123456789', status: 'menunggu', created_at: '2026-11-04' }]);
    if (url.includes(`/spmb_bukti_bayar?id=eq.${ID}&select=file_path`)) return Response.json([{ file_path: `${ID}/bukti.pdf` }]);
    if (url.includes('/storage/v1/object/sign/bukti-bayar/')) return Response.json({ signedURL: `/object/sign/bukti-bayar/${ID}/bukti.pdf?token=test` });
    throw new Error(`Permintaan tak terduga: ${url}`);
  };

  const list = await onRequest({ request: request(), env });
  assert.equal(list.status, 200);
  const data = await list.json();
  assert.equal(data.pembayaran[0].status, 'menunggu');
  assert.equal(data.pembayaran[0].nama, 'Calon Murid');
  assert.equal('file_path' in data.pembayaran[0], false);

  const proof = await onRequest({ request: request({ action: 'berkas_bayar', id: ID }), env });
  assert.equal(proof.status, 200);
  assert.match((await proof.json()).url, /\/storage\/v1\/object\/sign\/bukti-bayar\//);
});

test('admin SPMB dapat menerima bukti pembayaran yang masih menunggu', async t => {
  const asli = globalThis.fetch, panggilan = [];
  t.after(() => { globalThis.fetch = asli; });
  globalThis.fetch = async (url, options = {}) => {
    url = String(url);
    panggilan.push({ url, options });
    if (url.endsWith('/auth/v1/user')) return Response.json({ id: ID });
    if (url.includes('/guru_staf?')) return Response.json([{ peran: 'spmb', peran_tambahan: [] }]);
    if (url.includes(`/spmb_bukti_bayar?id=eq.${ID}&select=id,status,dipakai_oleh`))
      return Response.json([{ id: ID, status: 'menunggu', dipakai_oleh: null }]);
    if (url.includes(`/spmb_bukti_bayar?id=eq.${ID}&status=eq.menunggu&dipakai_oleh=is.null`))
      return Response.json([{ id: ID }], { status: 200 });
    throw new Error(`Permintaan tak terduga: ${url}`);
  };

  const response = await onRequest({ request: request({ action: 'verifikasi_bayar', id: ID, status: 'valid' }), env });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  const update = panggilan.find(x => x.options.method === 'PATCH');
  assert.equal(JSON.parse(update.options.body).status, 'valid');
});
