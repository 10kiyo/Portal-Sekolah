import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const baca = p => readFileSync(new URL('../public/' + p, import.meta.url), 'utf8');

// Elemen palsu: menyimpan properti yang di-set, metode apa pun mengembalikan elemen palsu lagi.
function elemen() {
  const simpan = {};
  const p = new Proxy(simpan, {
    get(t, k) {
      if (k in t) return t[k];
      if (typeof k === 'symbol') return undefined;
      if (k === 'classList') return { add() {}, remove() {}, toggle() {}, contains: () => false };
      if (k === 'dataset' || k === 'style') return {};
      if (k === 'querySelectorAll') return () => [];
      return () => p;
    },
    set(t, k, v) { t[k] = v; return true; }
  });
  return p;
}

test('spmb: data + kode tampilan berjalan dan mengisi halaman', () => {
  const els = new Map();
  const ambil = id => { if (!els.has(id)) els.set(id, elemen()); return els.get(id); };
  const ctx = vm.createContext({ console, setTimeout, location: { hash: '' }, navigator: {} });
  ctx.self = ctx; ctx.top = ctx; ctx.window = ctx;
  ctx.document = { getElementById: ambil, querySelectorAll: () => [], querySelector: () => elemen(), body: elemen(), addEventListener() {} };
  ctx.addEventListener = () => {};
  ctx.$ = () => { throw new Error('spmb tidak boleh memakai $ global'); };   // umum.js memuat $ = querySelector; spmb memakai byId
  ctx.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  vm.runInContext(baca('data-spmb.js'), ctx, { filename: 'data-spmb.js' });
  vm.runInContext(baca('js/spmb.js'), ctx, { filename: 'spmb.js' });
  assert.match(String(ambil('eyebrow').textContent), /^SPMB /);
  for (const id of ['facts', 'tabs', 'panel', 'kontak', 'catatan']) assert.ok(String(ambil(id).innerHTML).length > 20, `#${id} tidak terisi`);
});

test('spmb.html: memuat umum.js, data-spmb.js, lalu js/spmb.js dalam urutan itu', () => {
  const h = baca('spmb.html');
  const i = ['js/umum.js', 'data-spmb.js', 'js/spmb.js'].map(s => h.indexOf(`src="${s}"`));
  assert.ok(i.every(x => x > 0) && i[0] < i[1] && i[1] < i[2], 'urutan skrip salah: ' + i);
});
