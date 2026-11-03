import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sudahBatas, catatGagal, hapusBatas, terlaluSering } from '../functions/_lib/pembatas.js';

// KV palsu yang meniru get(json)/put/delete Cloudflare KV.
const kvPalsu = () => { const m = new Map(); return { m, async get(k) { return m.has(k) ? JSON.parse(m.get(k)) : null; }, async put(k, v) { m.set(k, v); }, async delete(k) { m.delete(k); } }; };

for (const [nama, buatEnv] of [['memori (cadangan)', () => ({})], ['KV', () => ({ PEMBATAS_KV: kvPalsu() })]]) {
  test(`pembatas [${nama}]: terkunci setelah N kegagalan, terbuka lagi setelah dihapus`, async () => {
    const env = buatEnv(), k = 'uji:' + nama;
    for (let i = 0; i < 3; i++) { assert.equal(await sudahBatas(env, k, 3), false); await catatGagal(env, k); }
    assert.equal(await sudahBatas(env, k, 3), true);
    await hapusBatas(env, k);
    assert.equal(await sudahBatas(env, k, 3), false);
  });
  test(`pembatas [${nama}]: jendela waktu kedaluwarsa`, async () => {
    const env = buatEnv(), k = 'jendela:' + nama;
    await catatGagal(env, k, 20); await catatGagal(env, k, 20);
    assert.equal(await sudahBatas(env, k, 2, 20), true);
    await new Promise(r => setTimeout(r, 40));
    assert.equal(await sudahBatas(env, k, 2, 20), false);
  });
  test(`terlaluSering [${nama}]: hitung tiap permintaan per IP`, async () => {
    const env = buatEnv(), req = ip => new Request('https://x', { headers: { 'CF-Connecting-IP': ip } });
    for (let i = 0; i < 3; i++) assert.equal(await terlaluSering(env, req('1.1.1.' + nama.length), 'daftar', 3), false);
    assert.equal(await terlaluSering(env, req('1.1.1.' + nama.length), 'daftar', 3), true);
    assert.equal(await terlaluSering(env, req('2.2.2.2'), 'daftar', 3), false, 'IP lain tidak terpengaruh');
  });
}

test('pembatas: KV yang error tidak memblokir pengguna', async () => {
  const rusak = { async get() { throw new Error('kv mati'); }, async put() { throw new Error('kv mati'); }, async delete() { throw new Error('kv mati'); } };
  const env = { PEMBATAS_KV: rusak };
  assert.equal(await sudahBatas(env, 'x', 1), false);
  await catatGagal(env, 'x'); await hapusBatas(env, 'x');
});
