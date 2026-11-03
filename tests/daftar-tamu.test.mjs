import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { onRequestGet, onRequest, gabungkanTamu, samarkanNomor } from '../functions/api/daftar-tamu.js';
import { hmac } from '../functions/_lib/util.js';

const env = { SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_uji', ADMIN_PIN: '123456', ADMIN_SECRET: 'rahasia-uji' };
const SISWA = 'Orang Tua/Wali Siswa';
const tamuDasar = () => [
  { guest_id: 'g1', guest_name: 'Budi', jenis_undangan: SISWA, instansi_kelas: '3A', nomor_whatsapp: '081234567890' },
  { guest_id: 'g2', guest_name: 'Siti', jenis_undangan: SISWA, instansi_kelas: '3A', nomor_whatsapp: null },
  { guest_id: 'g3', guest_name: 'Dewi', jenis_undangan: SISWA, instansi_kelas: '4B', nomor_whatsapp: '081200000000' },
  { guest_id: 'g4', guest_name: 'Pak Camat', jenis_undangan: 'Tamu Undangan', instansi_kelas: 'Kecamatan', nomor_whatsapp: '0812 3456 7777' }
];
const profilDasar = () => [
  { guest_id: 'OP-AAA111', nama: 'Rafi', kelas: '1A', jenis: SISWA, nonaktif: false, sumber: 'operator' },    // murid baru operator
  { guest_id: 'OP-BBB222', nama: 'Mati', kelas: '1A', jenis: SISWA, nonaktif: true, sumber: 'operator' },     // baru tapi nonaktif
  { guest_id: 'g2', nama: 'Siti Aisyah', kelas: '3B', jenis: null, nonaktif: false, sumber: 'database' },      // ganti nama + kelas
  { guest_id: 'g3', nama: null, kelas: null, jenis: null, nonaktif: true, sumber: 'database' },                // dinonaktifkan
  { guest_id: 'g1', nama: null, kelas: '  ', jenis: null, nonaktif: false, sumber: 'database' }                // kosong = tidak menimpa
];
const nama = l => l.map(x => x.guest_name);

// ---------- unit ----------
test('gabungkanTamu: murid baru operator muncul (bug utama)', () => {
  const l = gabungkanTamu(tamuDasar(), profilDasar());
  const rafi = l.find(x => x.guest_id === 'OP-AAA111');
  assert.deepEqual(rafi, { guest_id: 'OP-AAA111', guest_name: 'Rafi', jenis_undangan: SISWA, instansi_kelas: '1A', nomor_whatsapp: null });
});

test('gabungkanTamu: ganti nama/kelas menimpa, nonaktif disembunyikan, kolom kosong tidak menimpa', () => {
  const l = gabungkanTamu(tamuDasar(), profilDasar());
  assert.deepEqual(nama(l), ['Budi', 'Siti Aisyah', 'Pak Camat', 'Rafi']);
  assert.equal(l.find(x => x.guest_id === 'g2').instansi_kelas, '3B');
  assert.equal(l.find(x => x.guest_id === 'g1').instansi_kelas, '3A', 'kelas kosong/spasi tidak boleh menimpa');
  assert.ok(!l.some(x => x.guest_id === 'g3' || x.guest_id === 'OP-BBB222'), 'murid nonaktif tidak boleh tampil');
});

test('gabungkanTamu: tamu non-murid tetap; baris profil biasa (bukan operator) tanpa tamu dasar tidak ditambahkan', () => {
  const l = gabungkanTamu(tamuDasar(), [...profilDasar(), { guest_id: 'x9', nama: 'Hantu', kelas: '2A', nonaktif: false, sumber: 'database' }]);
  assert.ok(l.some(x => x.guest_name === 'Pak Camat'));
  assert.ok(!l.some(x => x.guest_name === 'Hantu'));
});

test('gabungkanTamu: guest_id angka disamakan menjadi teks; tanpa id atau tanpa nama dibuang', () => {
  const l = gabungkanTamu([{ guest_id: 7, guest_name: 'Angka', jenis_undangan: 'x', instansi_kelas: '1A' }, { guest_id: null, guest_name: 'Tanpa id' }, { guest_id: 8, guest_name: '  ' }],
    [{ guest_id: '7', nama: null, kelas: null, nonaktif: false, sumber: 'database' }]);
  assert.deepEqual(l.map(x => x.guest_id), ['7']);
});

test('samarkanNomor: 4 angka terakhir, spasi dibuang, kosong tetap kosong', () => {
  assert.equal(samarkanNomor('081234567890'), '********7890');
  assert.equal(samarkanNomor('0812 3456 7777'), '********7777');
  assert.equal(samarkanNomor('123'), '***');
  assert.equal(samarkanNomor(null), '');
  assert.equal(samarkanNomor(samarkanNomor('081234567890')), '********7890', 'idempoten, aman disamarkan lagi di browser');
});

// ---------- integrasi (endpoint dengan database palsu) ----------
let tabel = {}, urls = [];
globalThis.fetch = async url => {
  url = String(url); urls.push(url);
  const t = /\/rest\/v1\/([a-z_]+)\?/.exec(url)[1], rows = tabel[t];
  if (!Array.isArray(rows)) return new Response('{"message":"error"}', { status: rows === null ? 400 : 500 });
  const limit = +/limit=(\d+)/.exec(url)[1], offset = +/offset=(\d+)/.exec(url)[1];
  return new Response(JSON.stringify(rows.slice(offset, offset + limit)), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
const req = token => new Request('https://x/api/daftar-tamu', { headers: token ? { authorization: 'Bearer ' + token } : {} });
const tokenAdmin = async () => { const exp = Date.now() + 60_000; return `${exp}.${await hmac(env.ADMIN_SECRET, String(exp))}`; };
const siap = () => { urls = []; tabel = { daftar_tamu_gabungan: tamuDasar(), murid_profil: profilDasar() }; };

test('endpoint: murid baru operator tampil di daftar publik; nonaktif tidak', async () => {
  siap();
  const r = await onRequestGet({ request: req(), env });
  assert.equal(r.status, 200);
  assert.deepEqual(nama(await r.json()), ['Budi', 'Siti Aisyah', 'Pak Camat', 'Rafi']);
});

test('endpoint: publik hanya melihat nomor WhatsApp tersamar, admin melihat lengkap', async () => {
  siap();
  const teks = await (await onRequestGet({ request: req(), env })).text();
  assert.ok(!teks.includes('0812345'), 'nomor lengkap tidak boleh bocor ke publik');
  assert.ok(teks.includes('********7890'));
  siap();
  const admin = await (await onRequestGet({ request: req(await tokenAdmin()), env })).json();
  assert.equal(admin.find(x => x.guest_id === 'g1').nomor_whatsapp, '081234567890');
  siap();
  const palsu = await (await onRequestGet({ request: req('1.palsu'), env })).text();
  assert.ok(!palsu.includes('0812345'), 'token palsu diperlakukan sebagai publik, bukan error');
});

test('endpoint: bentuk respons sama seperti kolom yang dibaca frontend, tanpa kolom lain', async () => {
  siap();
  for (const x of await (await onRequestGet({ request: req(), env })).json())
    assert.deepEqual(Object.keys(x).sort(), ['guest_id', 'guest_name', 'instansi_kelas', 'jenis_undangan', 'nomor_whatsapp']);
});

test('endpoint: hanya meminta kolom yang perlu dari murid_profil (tanpa NIS, alamat, dst)', async () => {
  siap(); await onRequestGet({ request: req(), env });
  const u = urls.filter(x => x.includes('/murid_profil?')).join(' ');
  assert.ok(u.length > 0 && !u.includes('select=*'));
  for (const k of ['nis', 'nisn', 'alamat', 'tanggal_lahir', 'tempat_lahir', 'foto_path']) assert.ok(!new RegExp('[,=]' + k + '[,&]').test(u), k + ' tidak boleh diminta');
});

test('endpoint: lebih dari 1000 baris diambil per halaman tanpa duplikat atau terpotong', async () => {
  siap();
  tabel.daftar_tamu_gabungan = Array.from({ length: 2500 }, (_, i) => ({ guest_id: 'k' + i, guest_name: 'Nama ' + i, jenis_undangan: SISWA, instansi_kelas: '2A', nomor_whatsapp: null }));
  tabel.murid_profil = [];
  const l = await (await onRequestGet({ request: req(), env })).json();
  assert.equal(l.length, 2500);
  assert.equal(new Set(l.map(x => x.guest_id)).size, 2500);
  assert.equal(urls.filter(x => x.includes('/daftar_tamu_gabungan?')).length, 3);
});

test('endpoint: lapisan operator gagal dibaca -> daftar dasar tetap tampil (buku tamu tidak mati)', async () => {
  siap(); tabel.murid_profil = null;
  const orig = console.error; console.error = () => {};
  try {
    const r = await onRequestGet({ request: req(), env });
    assert.equal(r.status, 200);
    assert.deepEqual(nama(await r.json()), ['Budi', 'Siti', 'Dewi', 'Pak Camat']);
  } finally { console.error = orig; }
});

test('endpoint: daftar dasar gagal dibaca -> 500 generik, tanpa bocor detail internal', async () => {
  siap(); tabel.daftar_tamu_gabungan = 'rusak';
  const r = await onRequestGet({ request: req(), env });
  assert.equal(r.status, 500);
  assert.deepEqual(await r.json(), { error: 'Gagal memuat daftar tamu.' });
});

test('endpoint: tanpa kunci Supabase -> 500 jelas dan database tidak dipanggil; metode selain GET -> 405', async () => {
  siap();
  assert.equal((await onRequestGet({ request: req(), env: {} })).status, 500);
  assert.equal(urls.length, 0);
  assert.equal(onRequest().status, 405);
});

test('worker.js: route /api/daftar-tamu harus terdaftar', () => {
  const w = readFileSync(new URL('../src/worker.js', import.meta.url), 'utf8');
  assert.match(w, /import \* as daftarTamu from '\.\.\/functions\/api\/daftar-tamu\.js'/);
  assert.match(w, /'\/api\/daftar-tamu': daftarTamu/);
});
