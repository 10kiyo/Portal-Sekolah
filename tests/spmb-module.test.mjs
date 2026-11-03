import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const baca = p => readFileSync(new URL('../public/' + p, import.meta.url), 'utf8');

test('modul SPMB membaca pendaftar lewat API database SPMB', async () => {
  const view = {};
  const requests = [];
  const payload = {
    tahun_ajaran: '2027/2028',
    pendaftar: [{
      id: 'id-1', no_daftar: 'SPMB27-D-0001', nama: 'Calon Murid', jalur: 'dalam',
      status: 'baru', created_at: '2026-11-04', tanggal_lahir: '2021-01-01'
    }]
  };
  const ctx = vm.createContext({
    MODUL: {},
    sb: { auth: { getSession: async () => ({ data: { session: { access_token: 'token' } }, error: null }) } },
    fetch: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, json: async () => payload };
    },
    $: selector => selector === '#view' ? view : {},
    esc: value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  });
  vm.runInContext(baca('modul-spmb.js'), ctx, { filename: 'modul-spmb.js' });

  await ctx.MODUL.spmbberanda();

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/api/admin-spmb');
  assert.equal(requests[0].options.headers.Authorization, 'Bearer token');
  assert.match(view.innerHTML, /Ringkasan SPMB 2027\/2028/);
  assert.match(view.innerHTML, /SPMB27-D-0001/);
  assert.match(view.innerHTML, /Calon Murid/);
  assert.equal(typeof ctx.MODUL.spmbdaftar, 'function');
  assert.equal(typeof ctx.MODUL.spmbhasil, 'function');
  assert.equal(typeof ctx.MODUL.spmbatur, 'function');
});
