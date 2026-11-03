import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fase, tingkatDari, bolehTingkat, bacaFoto, hmac, same, adminOk, cfg, supabaseUrl, SUPABASE_URL_BAWAAN, kunciUmum, json } from '../functions/_lib/util.js';

test('fase(): urutan aturan pendaftaran kegiatan', () => {
  const k = { aktif: true, buka_daftar: '2026-07-01', tutup_daftar: '2026-07-10', tanggal_kegiatan: '2026-07-12', kuota: 10 };
  assert.equal(fase(k, 0, '2026-06-30'), 'akan');
  assert.equal(fase(k, 0, '2026-07-05'), 'dibuka');
  assert.equal(fase(k, 10, '2026-07-05'), 'penuh');
  assert.equal(fase(k, 0, '2026-07-11'), 'ditutup');
  assert.equal(fase(k, 0, '2026-07-13'), 'selesai');
  assert.equal(fase({ ...k, aktif: false }, 0, '2026-07-05'), 'ditutup');
  assert.equal(fase({ ...k, kuota: null }, 999, '2026-07-05'), 'dibuka');
});

test('tingkatDari(): ambil angka tingkat 1-6 dari nama kelas', () => {
  assert.deepEqual(tingkatDari('4A'), [4]);
  assert.deepEqual(tingkatDari('Kelas 5 dan 6'), [5, 6]);
  assert.deepEqual(tingkatDari('7B'), []);
  assert.deepEqual(tingkatDari(null), []);
});

test('bolehTingkat(): kegiatan tanpa batas tingkat terbuka untuk semua', () => {
  assert.equal(bolehTingkat({ tingkat: [] }, { tingkat: [3] }), true);
  assert.equal(bolehTingkat({ tingkat: [4, 5] }, { tingkat: [5] }), true);
  assert.equal(bolehTingkat({ tingkat: [4, 5] }, { tingkat: [2] }), false);
});

const b64 = bytes => 'data:image/%s;base64,' + Buffer.from(bytes).toString('base64');
test('bacaFoto(): hanya menerima foto asli (cek byte awal)', () => {
  const jpg = bacaFoto(b64([0xFF, 0xD8, 0xFF, 0xE0, 1, 2]).replace('%s', 'jpeg'));
  assert.equal(jpg.mime, 'image/jpeg'); assert.equal(jpg.ext, 'jpg');
  assert.ok(bacaFoto(b64([1, 2, 3, 4]).replace('%s', 'jpeg')).err, 'jpeg palsu ditolak');
  assert.ok(bacaFoto('data:image/gif;base64,AAAA').err, 'gif ditolak');
  assert.ok(bacaFoto('bukan foto').err);
  assert.ok(bacaFoto(b64(new Array(100).fill(0xFF)).replace('%s', 'jpeg'), 10).err, 'terlalu besar ditolak');
});

test('cfg(): kunci sb_ hanya lewat apikey, kunci JWT juga dikirim sebagai Bearer', () => {
  assert.equal(cfg({}), null);
  const baru = cfg({ SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_x' });
  assert.equal(baru.h.Authorization, undefined);
  const lama = cfg({ SUPABASE_SERVICE_ROLE_KEY: 'eyJabc' });
  assert.equal(lama.h.Authorization, 'Bearer eyJabc');
  assert.equal(baru.REST, SUPABASE_URL_BAWAAN + '/rest/v1');
});

test('supabaseUrl(): bawaan dipakai bila variabel kosong, garis miring akhir dibuang', () => {
  assert.equal(supabaseUrl({}), SUPABASE_URL_BAWAAN);
  assert.equal(supabaseUrl({ SUPABASE_URL: 'https://x.supabase.co//' }), 'https://x.supabase.co');
});

test('same()/hmac(): perbandingan benar & tanda tangan stabil', async () => {
  assert.equal(await same('abc', 'abc'), true);
  assert.equal(await same('abc', 'abd'), false);
  assert.equal(await same('abc', 'abcd'), false);
  assert.equal(await hmac('k', 'pesan'), await hmac('k', 'pesan'));
  assert.notEqual(await hmac('k', 'pesan'), await hmac('k2', 'pesan'));
});

test('adminOk(): token valid, kedaluwarsa, dan palsu', async () => {
  const env = { ADMIN_PIN: '123456', ADMIN_SECRET: 'rahasia-panjang' };
  const req = t => new Request('https://x/api', { headers: { authorization: 'Bearer ' + t } });
  const exp = Date.now() + 60_000, ok = `${exp}.${await hmac(env.ADMIN_SECRET, String(exp))}`;
  assert.equal(await adminOk(req(ok), env), true);
  const lewat = Date.now() - 1000, kadaluarsa = `${lewat}.${await hmac(env.ADMIN_SECRET, String(lewat))}`;
  assert.equal(await adminOk(req(kadaluarsa), env), false);
  assert.equal(await adminOk(req(`${exp}.palsu`), env), false);
  assert.equal(await adminOk(new Request('https://x/api'), env), false);
});

test('kunciUmum(): nama+sekolah yang sama (beda huruf/spasi) = kunci sama', async () => {
  assert.equal(await kunciUmum('Budi  Santoso', 'SDI At-Taqwa'), await kunciUmum('budi santoso', 'sdi at taqwa'));
  assert.notEqual(await kunciUmum('Budi', 'A'), await kunciUmum('Budi', 'B'));
});

test('json(): status, tipe, dan tanpa cache', async () => {
  const r = json(418, { a: 1 });
  assert.equal(r.status, 418); assert.equal(r.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await r.json(), { a: 1 });
});
