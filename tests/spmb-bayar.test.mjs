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
  assert.deepEqual(await response.json(), { ok: true, token: 'token-pembayaran', status: 'menunggu' });
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

test('spmb-bayar: token hanya mengembalikan status dan alasan verifikasi', async t => {
  const asli = globalThis.fetch;
  t.after(() => { globalThis.fetch = asli; });
  globalThis.fetch = async url => {
    assert.match(String(url), /spmb_bukti_bayar\?token=eq\.[0-9a-f-]+&select=status,catatan,dipakai_oleh/);
    return Response.json([{ status: 'ditolak', catatan: 'Nominal belum sesuai.', dipakai_oleh: null }]);
  };
  const response = await worker.fetch(new Request('https://sekolah.test/api/spmb-bayar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.13' },
    body: JSON.stringify({ action: 'cek', token: '47eb41a2-742f-468a-8f94-31562915d596' })
  }), env(), {});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ditolak', catatan: 'Nominal belum sesuai.' });
});

test('spmb-daftar: pembayaran yang belum diverifikasi tidak dapat mengirim formulir', async t => {
  const asli = globalThis.fetch;
  t.after(() => { globalThis.fetch = asli; });
  globalThis.fetch = async url => {
    url = String(url);
    if (url.includes('/spmb_pengaturan?')) return Response.json([
      { jalur: 'dalam', aktif: true, buka: '2000-01-01', tutup: '2099-12-31' },
      { jalur: 'luar', aktif: true, buka: '2000-01-01', tutup: '2099-12-31' }
    ]);
    if (url.includes('/spmb_bukti_bayar?token=')) return Response.json([{ id: 'payment-id', status: 'menunggu', nama: 'Nama Calon Murid', kontak: '08123456789', dipakai_oleh: null }]);
    throw new Error(`Permintaan tak terduga: ${url}`);
  };
  const f = new FormData();
  for (const [k, v] of Object.entries({
    jalur: 'luar', nama: 'Nama Calon Murid', tempat_lahir: 'Jakarta', alamat: 'Alamat rumah',
    kelurahan: 'Rawamangun', kecamatan: 'Pulo Gadung', kota: 'Jakarta Timur', asal_tk: 'TK Contoh',
    alamat_tk: 'Alamat TK', nama_ayah: 'Ayah', jenis_kelamin: 'L', tanggal_lahir: '2021-01-01',
    nik: '1234567890123456', kontak: '08123456789', setuju: 'true',
    token_bayar: '47eb41a2-742f-468a-8f94-31562915d596'
  })) f.set(k, v);

  const response = await worker.fetch(new Request('https://sekolah.test/api/spmb-daftar', {
    method: 'POST', headers: { 'CF-Connecting-IP': '192.0.2.14' }, body: f
  }), env(), {});
  assert.equal(response.status, 403);
  assert.equal((await response.json()).kode, 'bayar');
});
