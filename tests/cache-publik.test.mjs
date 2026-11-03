import { test } from 'node:test';
import assert from 'node:assert/strict';
import { okCache, denganCache, TTL_CACHE } from '../functions/_lib/cache-publik.js';
import { UUID, TGL, headerTulis } from '../functions/_lib/util.js';

const minta = url => ({ request: new Request(url), ctx: {} });

// Cache API palsu (Map) yang dipasang sementara di globalThis.caches.
function pasangCachePalsu() {
  const simpan = new Map(), sebelum = globalThis.caches;
  globalThis.caches = { default: { async match(k) { const r = simpan.get(k.url); return r ? r.clone() : undefined; }, async put(k, r) { simpan.set(k.url, r); } } };
  return { simpan, pulihkan: () => { if (sebelum === undefined) delete globalThis.caches; else globalThis.caches = sebelum; } };
}

test('okCache(): status 200, JSON, dan Cache-Control publik selama TTL_CACHE detik', async () => {
  const r = okCache({ a: 1 });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('Content-Type'), 'application/json');
  assert.equal(r.headers.get('Cache-Control'), `public, max-age=${TTL_CACHE}`);
  assert.deepEqual(await r.json(), { a: 1 });
});

test('denganCache(): tanpa Cache API, ambil() tetap dipanggil dan hasilnya dikembalikan', async () => {
  const p = pasangCachePalsu(); p.pulihkan();   // pastikan caches tidak ada
  let n = 0;
  const r = await denganCache(minta('https://x/api/info'), ['limit'], async () => { n++; return okCache({ n }); });
  assert.equal(r.status, 200); assert.equal(n, 1);
});

test('denganCache(): permintaan kedua dilayani dari cache; parameter tak dikenal tidak membuat kunci baru', async () => {
  const p = pasangCachePalsu();
  try {
    let n = 0; const ambil = async () => okCache({ n: ++n });
    await denganCache(minta('https://x/api/info?limit=5'), ['limit'], ambil);
    const kedua = await denganCache(minta('https://x/api/info?limit=5&acak=123'), ['limit'], ambil);
    assert.equal(n, 1, 'ambil() hanya sekali');
    assert.deepEqual(await kedua.json(), { n: 1 });
    await denganCache(minta('https://x/api/info?limit=9'), ['limit'], ambil);
    assert.equal(n, 2, 'nilai limit berbeda = kunci berbeda');
  } finally { p.pulihkan(); }
});

test('denganCache(): respons bukan 200 tidak disimpan', async () => {
  const p = pasangCachePalsu();
  try {
    await denganCache(minta('https://x/api/galeri'), ['limit'], async () => new Response('{}', { status: 500 }));
    assert.equal(p.simpan.size, 0);
  } finally { p.pulihkan(); }
});

test('UUID dan TGL: hanya format yang benar', () => {
  assert.ok(UUID.test('123e4567-e89b-12d3-a456-426614174000'));
  assert.ok(!UUID.test('bukan-uuid'));
  assert.ok(!UUID.test('123e4567-e89b-12d3-a456-426614174000x'));
  assert.ok(TGL.test('2026-07-12'));
  assert.ok(!TGL.test('12-07-2026'));
});

test('headerTulis(): header Supabase + JSON + tanpa isi balasan, tanpa mengubah c.h', () => {
  const c = { h: { apikey: 'k' } };
  assert.deepEqual(headerTulis(c), { apikey: 'k', 'Content-Type': 'application/json', Prefer: 'return=minimal' });
  assert.deepEqual(c.h, { apikey: 'k' });
});
