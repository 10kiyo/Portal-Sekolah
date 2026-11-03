// Pembantu bersama untuk panel admin (info-admin.html dan kegiatan.html).
// Dimuat setelah umum.js dan sebelum skrip halaman, jadi halaman TIDAK boleh mendeklarasikan ulang
// TOKEN_KEY, tgl, atau panggilAdmin (akan error "already been declared").

const TOKEN_KEY = 'bukuTamuSekolah.adminToken';   // sama dengan panel lain: sekali login berlaku untuk semua
const tgl = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
if (self !== top) document.body.classList.add('emb');   // dibuka di dalam bingkai (iframe) halaman induk

// Panggilan API admin dengan token Bearer. Tanpa `body` = GET, dengan `body` = POST JSON.
// opsi.token  : fungsi (boleh async) yang memberi token; bawaan token PIN admin di sessionStorage.
// opsi.saat401: dipanggil saat server menjawab 401 (mis. hapus token lalu tampilkan login); galat tetap dilempar.
// opsi.galat  : pesan bila respons gagal tanpa pesan dari server; bawaan 'HTTP <status>'.
async function panggilAdmin(url, body, opsi = {}) {
  const token = opsi.token ? await opsi.token() : sessionStorage.getItem(TOKEN_KEY);
  const h = { Authorization: 'Bearer ' + token };
  if (body) h['Content-Type'] = 'application/json';
  const r = await fetch(url, body ? { method: 'POST', headers: h, body: JSON.stringify(body) } : { headers: h });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401) { if (opsi.saat401) opsi.saat401(); throw new Error(d.error || 'Sesi berakhir.'); }
  if (!r.ok) throw new Error(d.error || opsi.galat || 'HTTP ' + r.status);
  return d;
}
