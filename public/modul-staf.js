/* ============================================================
   MENU STAF PER PERAN untuk halaman Administrasi Guru dan Staf (kelas.html).
   Pustakawan: kartu pelajar (desain + PDF), ekskul & club, peminjaman buku.
   Keuangan  : kas masuk/keluar, laporan, proposal, LPJ.
   Persuratan: surat masuk, surat keluar, agenda surat.
   Operator  : akun guru & staf, data murid, daftar pekerjaan.
   Dimuat SEBELUM skrip utama kelas.html; memakai $, esc, sb, S, run, msg, csv, allGuests, today, resize dari sana.
   Tabel & aturan akses: supabase-peran.sql.
   ============================================================ */
const MODUL = {};
const rp = n => 'Rp ' + Math.round(Number(n || 0)).toLocaleString('id-ID');
const urut = (a, b) => String(a).localeCompare(String(b), 'id', { numeric: true });
const jumlah = l => l.reduce((a, x) => a + Number(x.jumlah || 0), 0);
const opsi = (list, sel) => list.map(v => `<option ${v === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');
const tglID = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
const tambahHari = (d, n) => new Date(new Date(d + 'T00:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10);
const akhirBulan = b => { const [y, m] = b.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const namaBulan = b => { const [y, m] = b.split('-').map(Number); return BLN[m - 1] + ' ' + y; };

// Murid = baris daftar tamu berjenis "Orang Tua/Wali Siswa" (nama = nama murid, instansi_kelas = kelas), sama seperti impor murid di menu Guru.
let _siswa = null;
async function dataSiswa() {
  if (!_siswa) _siswa = (await allGuests()).filter(x => x.guest_name && /siswa|murid|anak/i.test(x.jenis_undangan || ''));
  return _siswa;
}
const kelasDari = g => [...new Set(g.map(x => String(x.instansi_kelas || '').trim()).filter(Boolean))].sort(urut);
async function semua(f) {                     // ambil semua baris (lebih dari 1000 pun)
  let out = [];
  for (let a = 0; ; a += 1000) { const d = await run(f().range(a, a + 999)); out = out.concat(d); if (d.length < 1000) break; }
  return out;
}
const inputBulan = (id, v) => `<input id="${id}" type="month" value="${v}" style="max-width:190px">`;

/* ================= PUSTAKAWAN ================= */
/* ================= PUSTAKAWAN: KARTU PELAJAR =================
   Data dasar (nama, kelas, ID) dari daftar_tamu_gabungan; data tambahan (NIS, NISN, tempat/tanggal lahir, alamat, foto, dst)
   dari tabel murid_profil; tampilan kartu disimpan di kartu_desain. Semua tabel: supabase-kartu.sql.
   Kolom BARU di murid_profil otomatis muncul sebagai pilihan bagian kartu. PDF dibuat di browser (html2canvas + jsPDF). */
const KARTU_W = 85.6, KARTU_H = 54;                        // mm (ukuran CR80)
const KARTU_SISTEM = ['guest_id', 'nama_ref', 'foto_path', 'created_at', 'updated_at'];   // kolom murid_profil yang bukan bagian kartu
const KARTU_FIELD = [                                       // bagian bawaan; k = kunci, on = tampil di desain awal
  { k: 'kelas', label: 'Kelas', on: true }, { k: 'guest_id', label: 'No. ID', on: false },
  { k: 'nis', label: 'NIS', on: true }, { k: 'nisn', label: 'NISN', on: true },
  { k: 'ttl', label: 'TTL', on: true }, { k: 'alamat', label: 'Alamat', on: true }];
const KARTU_PAKAI = new Set([...KARTU_SISTEM, ...KARTU_FIELD.map(f => f.k), 'tempat_lahir', 'tanggal_lahir']);
const KARTU_BAWAAN = { judul: 'KARTU PELAJAR', sekolah: 'SDS Islam At-Taqwa Rawamangun', footer: 'Tahun ajaran {ta}',
  warna: '#102a43', warnaTeks: '#ffffff', font: 10, logo: true, foto: true, fotoKanan: false };
const LIB_H2C = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
const LIB_PDF = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';

let _profil = null, _kolom = [], _profilErr = '';
const _fotoUrl = new Map();                                 // foto_path -> alamat sementara (1 jam)
const kelasX = x => String(x.instansi_kelas || '').trim();
const profilX = x => (_profil && _profil.get(String(x.guest_id))) || {};
const warnaOk = (v, cad) => /^#[0-9a-f]{6}$/i.test(String(v || '')) ? v : cad;
const judulKolom = c => c.replace(/_/g, ' ').replace(/^\w/, s => s.toUpperCase());
const tglPanjang = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? `${+m[3]} ${BLN[+m[2] - 1]} ${m[1]}` : ''; };

async function muatProfil() {
  if (_profil) return _profil;
  const peta = new Map(); _profilErr = ''; _kolom = [];
  try {
    const rows = await semua(() => sb.from('murid_profil').select('*').order('guest_id'));
    if (rows[0]) _kolom = Object.keys(rows[0]);
    rows.forEach(r => peta.set(String(r.guest_id), r));
  } catch (e) { _profilErr = (e && e.message) || 'tabel murid_profil tidak bisa dibaca'; }
  return (_profil = peta);
}
async function muatDesain() {
  const { data, error } = await sb.from('kartu_desain').select('config').eq('id', 'utama').maybeSingle();
  return (!error && data && data.config) || {};
}
async function muatFoto(paths) {                            // mengembalikan jumlah alamat foto yang baru didapat
  const baru = [...new Set(paths.filter(p => p && !_fotoUrl.has(p)))]; let n = 0;
  for (let i = 0; i < baru.length; i += 100) {
    const { data } = await sb.storage.from('foto-murid').createSignedUrls(baru.slice(i, i + 100), 3600);
    (data || []).forEach(r => { if (r.signedUrl) { _fotoUrl.set(r.path, r.signedUrl); n++; } });
  }
  return n;
}
const fotoX = x => { const p = profilX(x).foto_path; return p ? _fotoUrl.get(p) || '' : ''; };

function fieldTersedia() {
  const extra = _kolom.filter(c => !KARTU_PAKAI.has(c)).map(c => ({ k: c, label: judulKolom(c), on: false }));
  return [...KARTU_FIELD.map(f => ({ ...f })), ...extra];
}
function susunDesain(saved) {
  saved = saved || {};
  const d = { ...KARTU_BAWAAN, ...saved }, tersedia = fieldTersedia(), ada = new Set();
  d.warna = warnaOk(d.warna, KARTU_BAWAAN.warna); d.warnaTeks = warnaOk(d.warnaTeks, KARTU_BAWAAN.warnaTeks);
  d.font = Math.min(13, Math.max(7, Number(d.font) || KARTU_BAWAAN.font));
  d.fields = [];
  (Array.isArray(saved.fields) ? saved.fields : []).forEach(f => {
    const t = tersedia.find(a => a.k === f.k);
    if (t && !ada.has(t.k)) { ada.add(t.k); d.fields.push({ k: t.k, label: String(f.label || t.label).slice(0, 24), on: !!f.on }); }
  });
  tersedia.forEach(t => { if (!ada.has(t.k)) d.fields.push(t); });
  return d;
}
function nilaiField(k, x, p) {
  if (k === 'kelas') return kelasX(x);
  if (k === 'guest_id') return String(x.guest_id ?? '');
  if (k === 'ttl') return [p.tempat_lahir, tglPanjang(p.tanggal_lahir)].filter(Boolean).join(', ');
  const v = p[k]; return v == null ? '' : (tglPanjang(v) || String(v)).trim();
}
function kartuHtml(x, p, d, ta, src) {
  const baris = d.fields.filter(f => f.on).map(f => { const v = nilaiField(f.k, x, p);
    return `<span class="kl">${esc(f.label)}</span><span class="kv${v ? '' : ' kosong'}">${v ? esc(v) : '-'}</span>`; }).join('');
  const foto = d.foto ? `<div class="kfoto${src.foto ? ' ada' : ''}"${src.foto ? ` style="background-image:url('${esc(src.foto)}')"` : ''}>${src.foto ? '' : 'FOTO'}</div>` : '';
  return `<div class="kartu" style="font-size:${d.font}px"><div class="kh" style="background:${d.warna};color:${d.warnaTeks}">${d.logo ? `<img src="${esc(src.logo)}" alt="">` : ''}<div><b>${esc(d.judul)}</b><span>${esc(d.sekolah)}</span></div></div>
  <div class="kb${d.fotoKanan ? ' rev' : ''}">${foto}<div class="ki"><b style="color:${d.warna}">${esc(x.guest_name)}</b><div class="kgrid">${baris}</div></div></div>
  <div class="kf">${esc(String(d.footer).split('{ta}').join(ta))}</div></div>`;
}
function kartuTerpotong(el) {                               // isi lebih tinggi dari ruang yang tersedia?
  const kb = el.querySelector('.kb'), ki = el.querySelector('.ki'); if (!kb || !ki) return false;
  const cs = getComputedStyle(kb);
  return ki.offsetHeight > kb.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) + 1;
}

const _skrip = {};
const muatSkrip = src => _skrip[src] || (_skrip[src] = new Promise((ok, gagal) => {
  const s = document.createElement('script'); s.src = src; s.onload = ok;
  s.onerror = () => { delete _skrip[src]; gagal(new Error('Pustaka PDF gagal dimuat dari internet. Periksa koneksi lalu coba lagi.')); };
  document.head.appendChild(s); }));
const keDataUrl = async url => {
  const r = await fetch(url); if (!r.ok) throw new Error('gagal mengambil gambar');
  const b = await r.blob();
  return new Promise((ok, no) => { const f = new FileReader(); f.onload = () => ok(f.result); f.onerror = no; f.readAsDataURL(b); });
};

// Membuat PDF dari daftar murid. mode: 'a4' (10 kartu per halaman, 2 x 5) atau 'kartu' (1 kartu per halaman seukuran kartu).
async function buatPdf(list, d, ta, mode, nama, status, dibatalkan) {
  await Promise.all([muatSkrip(LIB_H2C), muatSkrip(LIB_PDF)]);
  await muatFoto(list.map(x => profilX(x).foto_path));
  const logo = d.logo ? await keDataUrl('logo-at-taqwa.png') : '', a4 = mode === 'a4';
  const pdf = new window.jspdf.jsPDF(a4 ? { unit: 'mm', format: 'a4', orientation: 'portrait' } : { unit: 'mm', format: [KARTU_W, KARTU_H], orientation: 'landscape' });
  const host = document.createElement('div');               // di belakang layar penutup; html2canvas butuh elemen yang benar-benar terlayout
  host.style.cssText = 'position:absolute;left:0;top:0;z-index:-1;width:max-content;background:#fff';
  document.body.appendChild(host);
  let terpotong = 0, dibuat = 0;
  const gx = 4, gy = 2.5, mx = (210 - 2 * KARTU_W - gx) / 2, my = (297 - 5 * KARTU_H - 4 * gy) / 2;
  try {
    for (let i = 0; i < list.length; i++) {
      if (dibatalkan()) return { batal: true };
      status(`Membuat kartu ${i + 1} dari ${list.length}...`);
      const x = list[i]; let foto = '';
      const u = fotoX(x); if (u) { try { foto = await keDataUrl(u); } catch (e) { /* foto gagal: kartu tetap dibuat tanpa foto */ } }
      host.innerHTML = kartuHtml(x, profilX(x), d, ta, { logo, foto });
      const el = host.firstElementChild;
      if (kartuTerpotong(el)) terpotong++;
      const cv = await window.html2canvas(el, { scale: 3, backgroundColor: '#ffffff', logging: false });
      const img = cv.toDataURL('image/jpeg', 0.92);
      if (a4) {
        const n = i % 10; if (i > 0 && n === 0) pdf.addPage();
        pdf.addImage(img, 'JPEG', mx + (n % 2) * (KARTU_W + gx), my + Math.floor(n / 2) * (KARTU_H + gy), KARTU_W, KARTU_H);
      } else {
        if (i > 0) pdf.addPage([KARTU_W, KARTU_H], 'landscape');
        pdf.addImage(img, 'JPEG', 0, 0, KARTU_W, KARTU_H);
      }
      dibuat++;
    }
  } finally { host.remove(); }
  pdf.save(nama);
  return { dibuat, terpotong };
}

MODUL.kartu = async function (bawaan) {
  const rid = S.rid;
  $('#view').innerHTML = '<p>Memuat daftar murid...</p>';
  const [g, , saved] = await Promise.all([dataSiswa(), muatProfil(), bawaan === true ? {} : muatDesain()]);
  if (rid !== S.rid) return;
  const kls = kelasDari(g);
  if (!kls.length) { $('#view').innerHTML = '<p class="msg err">Data murid tidak ditemukan di database.</p>'; return; }
  const y = new Date().getFullYear(), ta = new Date().getMonth() >= 6 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
  let kel = kls[0], cari = '', d = susunDesain(saved), pilih = new Set(), tok = 0;
  const info = _profilErr
    ? `<p class="msg err">Data tambahan murid (NIS, NISN, tempat/tanggal lahir, alamat) belum bisa dibaca: ${esc(_profilErr)}. Jalankan <b>supabase-kartu.sql</b> di Supabase > SQL Editor, lalu klik "Muat ulang data".</p>`
    : !_profil.size ? '<p class="msg err">Tabel murid_profil masih kosong, atau akun ini tidak punya akses membacanya. Bagian selain nama, kelas, dan ID akan tampil "-".</p>' : '';

  $('#view').innerHTML = `<div class="noprint"><h2>Kartu pelajar</h2>
  <p class="mut">Data murid ditarik dari database. NIS, NISN, tempat/tanggal lahir, dan alamat dilengkapi admin utama di tabel <b>murid_profil</b> (Supabase). Ukuran kartu ${KARTU_W.toString().replace('.', ',')} x ${KARTU_H} mm.</p>${info}
  <details class="kpanel" open><summary>Atur tampilan &amp; isi kartu</summary>
  <div class="grid" id="kdes" style="margin-top:12px">
   <div><label for="d1">Judul kartu</label><input id="d1" data-d="judul" value="${esc(d.judul)}" maxlength="40"></div>
   <div><label for="d2">Nama sekolah</label><input id="d2" data-d="sekolah" value="${esc(d.sekolah)}" maxlength="60"></div>
   <div><label for="d3">Teks bawah kartu</label><input id="d3" data-d="footer" value="${esc(d.footer)}" maxlength="60"><span class="mut">{ta} diganti tahun ajaran</span></div>
   <div><label for="d4">Warna header</label><input id="d4" type="color" data-d="warna" value="${d.warna}"></div>
   <div><label for="d5">Warna teks header</label><input id="d5" type="color" data-d="warnaTeks" value="${d.warnaTeks}"></div>
   <div><label for="d6">Ukuran huruf: <span id="kfv">${d.font}</span> px</label><input id="d6" type="range" min="7" max="13" step="0.5" data-d="font" value="${d.font}"></div>
   <div class="kcb"><label class="chk"><input type="checkbox" data-d="logo" ${d.logo ? 'checked' : ''}> Tampilkan logo</label>
    <label class="chk"><input type="checkbox" data-d="foto" ${d.foto ? 'checked' : ''}> Tampilkan kotak foto</label>
    <label class="chk"><input type="checkbox" data-d="fotoKanan" ${d.fotoKanan ? 'checked' : ''}> Foto di sisi kanan</label></div>
  </div>
  <h3 style="color:var(--navy);margin:14px 0 4px">Bagian yang tampil di kartu</h3>
  <p class="mut">Centang untuk menampilkan, ubah nama labelnya, atur urutan dengan tombol panah. Nama murid selalu tampil. Kolom baru yang ditambahkan admin di tabel murid_profil otomatis muncul di daftar ini.</p>
  <div id="kfl"></div>
  <p><button class="p" id="kSave">Simpan tampilan</button> <button id="kReset">Kembalikan standar</button></p></details>
  <div class="grid" style="margin-top:14px">
   <div><label for="kk">Kelas</label><select id="kk"><option value="">Semua kelas</option>${kls.map(k => `<option>${esc(k)}</option>`).join('')}</select></div>
   <div><label for="kt">Tahun ajaran</label><input id="kt" value="${ta}"></div>
   <div><label for="kq">Cari nama</label><input id="kq" type="search" placeholder="Ketik nama murid"></div>
   <div><label for="kf">Format PDF</label><select id="kf"><option value="a4">A4, 10 kartu per halaman</option><option value="kartu">1 kartu per halaman (ukuran kartu)</option></select></div></div>
  <p><button id="kAll">Pilih semua</button> <button id="kNone">Kosongkan</button> <button id="kReload">Muat ulang data</button> <button class="p" id="kPdf">Unduh PDF</button></p>
  <p class="mut" id="kn"></p><div id="kl" class="chklist"></div><div id="msg" class="msg"></div></div>
  <h3 class="noprint" style="color:var(--navy)">Pratinjau</h3><p class="msg err noprint" id="kwarn"></p><div id="kp" class="kwrap"></div>`;
  $('#kk').value = kel;

  const kelasList = () => g.filter(x => !kel || kelasX(x) === kel).sort((a, b) => (kel ? 0 : urut(kelasX(a), kelasX(b))) || urut(a.guest_name, b.guest_name));
  const daftar = () => kelasList().filter(x => !cari || x.guest_name.toLowerCase().includes(cari));
  const terpilih = () => kelasList().filter(x => pilih.has(String(x.guest_id)));
  const pilihSemua = () => { pilih = new Set(kelasList().map(x => String(x.guest_id))); };
  const kurang = x => d.fields.filter(f => f.on && !nilaiField(f.k, x, profilX(x))).map(f => f.label);

  const gambar = () => {
    const t = ++tok, pil = terpilih(), tampil = pil.slice(0, 6);
    const render = () => {
      $('#kp').innerHTML = tampil.map(x => kartuHtml(x, profilX(x), d, $('#kt').value, { logo: 'logo-at-taqwa.png', foto: fotoX(x) })).join('');
      const n = [...document.querySelectorAll('#kp .kartu')].filter(kartuTerpotong).length;
      $('#kwarn').textContent = n ? `Isi ${n} kartu di pratinjau terpotong. Kecilkan ukuran huruf atau kurangi bagian yang tampil.` : '';
    };
    render();
    $('#kn').textContent = `${pil.length} dari ${kelasList().length} murid dipilih.` + (pil.length > 6 ? ' Pratinjau menampilkan 6 kartu pertama.' : '');
    muatFoto(tampil.map(x => profilX(x).foto_path)).then(n => { if (n && t === tok && rid === S.rid) render(); }).catch(() => {});
  };
  const isi = () => {
    const l = daftar(), lengkap = kelasList().filter(x => kurang(x).length).length;
    $('#kl').innerHTML = l.map(x => { const k = kurang(x);
      return `<label class="chk"><input type="checkbox" data-id="${esc(x.guest_id)}" ${pilih.has(String(x.guest_id)) ? 'checked' : ''}> ${esc(x.guest_name)}${kel ? '' : ` <span class="mut">(${esc(kelasX(x))})</span>`}${k.length ? ` <span class="kwarn" title="Data belum ada">belum ada: ${esc(k.join(', '))}</span>` : ''}</label>`; }).join('') || '<span class="mut">Tidak ada murid.</span>';
    gambar();
    if (lengkap) $('#kn').textContent += ` ${lengkap} murid datanya belum lengkap untuk bagian yang dicentang; minta admin utama melengkapinya di Supabase (tabel murid_profil), lalu klik "Muat ulang data".`;
  };
  const isiField = () => {
    $('#kfl').innerHTML = d.fields.map((f, i) => `<div class="kfrow"><input type="checkbox" data-fon="${i}" ${f.on ? 'checked' : ''} aria-label="Tampilkan ${esc(f.label)}">
      <input type="text" data-flab="${i}" value="${esc(f.label)}" maxlength="24" aria-label="Label ${esc(f.k)}">
      <button data-fup="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Naikkan">&uarr;</button><button data-fdn="${i}" ${i === d.fields.length - 1 ? 'disabled' : ''} aria-label="Turunkan">&darr;</button>
      <span class="mut">${esc(f.k === 'ttl' ? 'tempat_lahir + tanggal_lahir' : f.k === 'kelas' || f.k === 'guest_id' ? f.k + ' (daftar tamu)' : f.k)}</span></div>`).join('');
  };

  const desain = e => {
    const k = e.target.dataset.d; if (!k) return;
    d[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'range' ? Number(e.target.value) : e.target.value;
    if (k === 'font') $('#kfv').textContent = d.font;
    gambar();
  };
  $('#kdes').oninput = desain; $('#kdes').onchange = desain;
  $('#kfl').onchange = e => { const t = e.target.dataset; if (t.fon !== undefined) { d.fields[+t.fon].on = e.target.checked; isi(); } };
  $('#kfl').oninput = e => { const t = e.target.dataset; if (t.flab !== undefined) { d.fields[+t.flab].label = e.target.value; gambar(); } };
  $('#kfl').onclick = e => {
    const t = e.target.dataset, i = +(t.fup ?? t.fdn), j = t.fup !== undefined ? i - 1 : i + 1;
    if ((t.fup === undefined && t.fdn === undefined) || !d.fields[j]) return;
    [d.fields[i], d.fields[j]] = [d.fields[j], d.fields[i]]; isiField(); gambar();
  };
  $('#kSave').onclick = async () => {
    const { error } = await sb.from('kartu_desain').upsert({ id: 'utama', config: d, updated_at: new Date().toISOString() });
    msg(error ? `Gagal menyimpan: ${error.message}. Jalankan supabase-kartu.sql bila tabel kartu_desain belum ada.` : 'Tampilan kartu tersimpan dan dipakai semua pustakawan.', !!error);
  };
  $('#kReset').onclick = () => { if (confirm('Kembalikan tampilan kartu ke pengaturan standar? (Belum disimpan sampai Anda klik Simpan tampilan.)')) MODUL.kartu(true); };
  $('#kReload').onclick = () => { _siswa = null; _profil = null; _fotoUrl.clear(); MODUL.kartu(); };
  $('#kk').onchange = e => { kel = e.target.value; pilihSemua(); isi(); };
  $('#kt').oninput = gambar;
  $('#kq').oninput = e => { cari = e.target.value.trim().toLowerCase(); isi(); };
  $('#kl').onchange = e => { const id = e.target.dataset.id; if (!id) return; e.target.checked ? pilih.add(id) : pilih.delete(id); gambar(); };
  $('#kAll').onclick = () => { daftar().forEach(x => pilih.add(String(x.guest_id))); isi(); };
  $('#kNone').onclick = () => { daftar().forEach(x => pilih.delete(String(x.guest_id))); isi(); };
  $('#kPdf').onclick = async () => {
    const pil = terpilih(); if (!pil.length) return msg('Pilih minimal satu murid.', true);
    let batal = false; const ov = document.createElement('div'); ov.className = 'kov';
    ov.innerHTML = '<div><b id="kovt">Menyiapkan PDF...</b><p class="mut">Jangan tutup atau pindah halaman sampai selesai.</p><button id="kovb">Batalkan</button></div>';
    document.body.appendChild(ov); ov.querySelector('#kovb').onclick = () => { batal = true; };
    const nama = 'kartu-pelajar-' + (kel || 'semua-kelas').replace(/[^\w-]+/g, '-') + '.pdf';
    try {
      const h = await buatPdf(pil, d, $('#kt').value, $('#kf').value, nama, t => { ov.querySelector('#kovt').textContent = t; }, () => batal);
      msg(h.batal ? 'Pembuatan PDF dibatalkan.' : `PDF selesai: ${h.dibuat} kartu (${nama}).` + (h.terpotong ? ` ${h.terpotong} kartu isinya terpotong; kecilkan ukuran huruf atau kurangi bagian yang tampil.` : ''), !!(h.batal || h.terpotong));
    } catch (e) { msg('Gagal membuat PDF: ' + ((e && e.message) || e), true); }
    finally { ov.remove(); }
  };

  pilihSemua(); isiField(); isi();
};

MODUL.ekskul = async function () {
  const [g, rows] = await Promise.all([dataSiswa(), run(sb.from('pendaftaran_kegiatan').select('*').order('kegiatan').order('nama'))]);
  const kls = kelasDari(g); let kel = kls[0] || '', fj = '';
  const kegs = [...new Set(rows.map(r => r.kegiatan))].sort(urut);
  $('#view').innerHTML = `<h2>Pendaftaran ekstrakurikuler & club</h2>
  <div class="grid"><div><label for="ej">Jenis</label><select id="ej"><option value="ekskul">Ekstrakurikuler</option><option value="club">Club</option></select></div>
  <div><label for="ek">Nama kegiatan</label><input id="ek" list="ekl" placeholder="Contoh: Pramuka, Futsal, English Club"><datalist id="ekl">${kegs.map(k => `<option value="${esc(k)}">`).join('')}</datalist></div>
  <div><label for="ekls">Kelas</label><select id="ekls">${opsi(kls, kel)}</select></div></div>
  <label>Murid yang didaftarkan</label><div id="em" class="chklist"></div>
  <p><button class="p" id="eAdd">Daftarkan yang dicentang</button></p><div id="msg" class="msg"></div>
  <h2 style="margin-top:22px">Rekap peserta</h2>
  <p><select id="ef" style="max-width:220px"><option value="">Semua kegiatan</option>${kegs.map(k => `<option>${esc(k)}</option>`).join('')}</select> <button id="eCsv">Unduh CSV</button> <button onclick="print()">Cetak</button></p>
  <div id="er"></div>`;
  const daftarMurid = () => g.filter(x => String(x.instansi_kelas || '').trim() === kel).sort((a, b) => urut(a.guest_name, b.guest_name));
  const sudah = () => new Set(rows.filter(r => r.jenis === $('#ej').value && r.kegiatan === $('#ek').value.trim()).map(r => r.guest_id));
  const isiMurid = () => { const s = sudah(); $('#em').innerHTML = daftarMurid().map(x => `<label class="chk"><input type="checkbox" data-id="${esc(x.guest_id)}" ${s.has(String(x.guest_id)) ? 'disabled' : ''}> ${esc(x.guest_name)}${s.has(String(x.guest_id)) ? ' <span class="mut">(sudah terdaftar)</span>' : ''}</label>`).join('') || '<span class="mut">Tidak ada murid.</span>'; };
  const rekap = () => {
    const f = $('#ef').value, list = rows.filter(r => !f || r.kegiatan === f), by = {};
    list.forEach(r => (by[r.jenis + '|' + r.kegiatan] = by[r.jenis + '|' + r.kegiatan] || []).push(r));
    $('#er').innerHTML = Object.keys(by).sort(urut).map(k => `<h3 style="color:var(--navy);margin-bottom:6px">${esc(k.split('|')[1])} <span class="mut">(${k.startsWith('club') ? 'Club' : 'Ekskul'}, ${by[k].length} peserta)</span></h3>
      <table><tr><th>Nama</th><th>Kelas</th><th class="noprint"></th></tr>${by[k].map(r => `<tr><td>${esc(r.nama)}</td><td>${esc(r.kelas)}</td><td class="noprint"><button class="d" data-del="${r.id}">Keluarkan</button></td></tr>`).join('')}</table>`).join('') || '<p class="mut">Belum ada pendaftar.</p>';
  };
  $('#ej').onchange = $('#ek').oninput = isiMurid;
  $('#ekls').onchange = e => { kel = e.target.value; isiMurid(); };
  $('#ef').onchange = rekap;
  $('#eAdd').onclick = async () => {
    const keg = $('#ek').value.trim(), ids = [...document.querySelectorAll('#em input:checked')].map(i => i.dataset.id);
    if (!keg) return msg('Isi nama kegiatan.', true); if (!ids.length) return msg('Centang murid yang akan didaftarkan.', true);
    const byId = new Map(g.map(x => [String(x.guest_id), x]));
    await run(sb.from('pendaftaran_kegiatan').upsert(ids.map(id => ({ jenis: $('#ej').value, kegiatan: keg, guest_id: id, nama: byId.get(id).guest_name, kelas: String(byId.get(id).instansi_kelas || '').trim() })), { onConflict: 'jenis,kegiatan,guest_id', ignoreDuplicates: true }));
    MODUL.ekskul();
  };
  $('#eCsv').onclick = () => csv('peserta-kegiatan.csv', [['Jenis', 'Kegiatan', 'Nama', 'Kelas'], ...rows.filter(r => !$('#ef').value || r.kegiatan === $('#ef').value).map(r => [r.jenis, r.kegiatan, r.nama, r.kelas])]);
  $('#view').onclick = async e => { const id = e.target.dataset.del; if (id && confirm('Keluarkan murid ini dari kegiatan?')) { await run(sb.from('pendaftaran_kegiatan').delete().eq('id', id)); MODUL.ekskul(); } };
  isiMurid(); rekap();
};

MODUL.pinjam = async function () {
  const [g, rows] = await Promise.all([dataSiswa().catch(() => []), run(sb.from('perpus_pinjam').select('*').order('tgl_pinjam', { ascending: false }).limit(1000))]);
  const t = today(), telat = r => r.status === 'dipinjam' && r.tenggat && r.tenggat < t;
  $('#view').innerHTML = `<h2>Peminjaman buku</h2>
  <div class="grid"><div><label for="pb">Judul buku</label><input id="pb"></div>
  <div><label for="pp">Peminjam</label><input id="pp" list="ppl" placeholder="Nama (kelas)"><datalist id="ppl">${g.map(x => `<option value="${esc(x.guest_name)} (${esc(String(x.instansi_kelas || '').trim())})">`).join('')}</datalist></div>
  <div><label for="pt">Tanggal pinjam</label><input id="pt" type="date" value="${t}"></div>
  <div><label for="pd">Tenggat kembali</label><input id="pd" type="date" value="${tambahHari(t, 7)}"></div></div>
  <p><button class="p" id="pAdd">Catat peminjaman</button></p><div id="msg" class="msg"></div>
  <p class="mut">${rows.filter(r => r.status === 'dipinjam').length} buku sedang dipinjam, ${rows.filter(telat).length} melewati tenggat.</p>
  <p><select id="ps" style="max-width:200px"><option value="dipinjam">Sedang dipinjam</option><option value="">Semua</option><option value="kembali">Sudah kembali</option></select> <button id="pCsv">Unduh CSV</button></p>
  <div id="pl"></div>`;
  const tampil = () => {
    const f = $('#ps').value, l = rows.filter(r => !f || r.status === f);
    $('#pl').innerHTML = `<table><tr><th>Buku</th><th>Peminjam</th><th>Pinjam</th><th>Tenggat</th><th>Status</th><th></th></tr>${l.map(r => `<tr><td>${esc(r.judul)}</td><td>${esc(r.peminjam)}</td><td>${tglID(r.tgl_pinjam)}</td><td ${telat(r) ? 'style="color:var(--danger);font-weight:700"' : ''}>${tglID(r.tenggat)}</td><td>${r.status === 'kembali' ? 'Kembali ' + tglID(r.tgl_kembali) : telat(r) ? 'Terlambat' : 'Dipinjam'}</td><td>${r.status === 'dipinjam' ? `<button data-ret="${r.id}">Kembalikan</button> ` : ''}<button class="d" data-del="${r.id}">Hapus</button></td></tr>`).join('')}</table>`;
  };
  $('#ps').onchange = tampil;
  $('#pAdd').onclick = async () => {
    if (!$('#pb').value.trim() || !$('#pp').value.trim()) return msg('Isi judul buku dan peminjam.', true);
    await run(sb.from('perpus_pinjam').insert({ judul: $('#pb').value.trim(), peminjam: $('#pp').value.trim(), tgl_pinjam: $('#pt').value || t, tenggat: $('#pd').value || null })); MODUL.pinjam();
  };
  $('#pCsv').onclick = () => csv('peminjaman-buku.csv', [['Buku', 'Peminjam', 'Tgl pinjam', 'Tenggat', 'Status', 'Tgl kembali'], ...rows.map(r => [r.judul, r.peminjam, r.tgl_pinjam, r.tenggat, r.status, r.tgl_kembali])]);
  $('#view').onclick = async e => {
    const d = e.target.dataset;
    if (d.ret) { await run(sb.from('perpus_pinjam').update({ status: 'kembali', tgl_kembali: t }).eq('id', d.ret)); MODUL.pinjam(); }
    if (d.del && confirm('Hapus catatan ini?')) { await run(sb.from('perpus_pinjam').delete().eq('id', d.del)); MODUL.pinjam(); }
  };
  tampil();
};

/* ================= KEUANGAN ================= */
const KATEGORI = ['SPP', 'BOS', 'Donasi', 'Infak', 'Gaji', 'Operasional', 'ATK', 'Kegiatan', 'Sarpras', 'Lainnya'];
MODUL.transaksi = async function (bln) {
  bln = (typeof bln === 'string' && bln) || today().slice(0, 7);
  const rows = await run(sb.from('keuangan_transaksi').select('*').gte('tanggal', bln + '-01').lte('tanggal', akhirBulan(bln)).order('tanggal').order('created_at'));
  const m = jumlah(rows.filter(r => r.jenis === 'masuk')), k = jumlah(rows.filter(r => r.jenis === 'keluar'));
  $('#view').innerHTML = `<h2>Kas masuk & keluar</h2>
  <div class="grid"><div><label for="tt">Tanggal</label><input id="tt" type="date" value="${today()}"></div>
  <div><label for="tj">Jenis</label><select id="tj"><option value="masuk">Pemasukan</option><option value="keluar">Pengeluaran</option></select></div>
  <div><label for="tk">Kategori</label><input id="tk" list="tkl"><datalist id="tkl">${KATEGORI.map(x => `<option>${x}</option>`).join('')}</datalist></div>
  <div><label for="tn">Jumlah (Rp)</label><input id="tn" type="number" min="0" inputmode="numeric"></div>
  <div><label for="tr">No. bukti / referensi</label><input id="tr"></div></div>
  <label for="tu">Uraian</label><input id="tu">
  <p><button class="p" id="tAdd">Simpan transaksi</button></p><div id="msg" class="msg"></div>
  <h2 style="margin-top:22px">Transaksi ${namaBulan(bln)}</h2>
  <p>${inputBulan('tb', bln)} <button id="tCsv">Unduh CSV</button> <button onclick="print()">Cetak</button></p>
  <p><b>Pemasukan:</b> ${rp(m)} &nbsp; <b>Pengeluaran:</b> ${rp(k)} &nbsp; <b>Selisih bulan ini:</b> ${rp(m - k)}</p>
  <table><tr><th>Tanggal</th><th>Kategori</th><th>Uraian</th><th>Masuk</th><th>Keluar</th><th>Ref</th><th class="noprint"></th></tr>
  ${rows.map(r => `<tr><td>${tglID(r.tanggal)}</td><td>${esc(r.kategori)}</td><td>${esc(r.uraian)}</td><td>${r.jenis === 'masuk' ? rp(r.jumlah) : ''}</td><td>${r.jenis === 'keluar' ? rp(r.jumlah) : ''}</td><td>${esc(r.ref)}</td><td class="noprint"><button class="d" data-del="${r.id}">Hapus</button></td></tr>`).join('') || '<tr><td colspan="7" class="mut">Belum ada transaksi bulan ini.</td></tr>'}</table>`;
  $('#tb').onchange = e => e.target.value && MODUL.transaksi(e.target.value);
  $('#tAdd').onclick = async () => {
    const n = Number($('#tn').value);
    if (!(n > 0) || !$('#tu').value.trim()) return msg('Isi uraian dan jumlah.', true);
    await run(sb.from('keuangan_transaksi').insert({ tanggal: $('#tt').value || today(), jenis: $('#tj').value, kategori: $('#tk').value.trim() || null, uraian: $('#tu').value.trim(), jumlah: Math.round(n), ref: $('#tr').value.trim() || null }));
    MODUL.transaksi($('#tt').value ? $('#tt').value.slice(0, 7) : bln);
  };
  $('#tCsv').onclick = () => csv(`kas-${bln}.csv`, [['Tanggal', 'Jenis', 'Kategori', 'Uraian', 'Jumlah', 'Ref'], ...rows.map(r => [r.tanggal, r.jenis, r.kategori, r.uraian, r.jumlah, r.ref])]);
  $('#view').onclick = async e => { const id = e.target.dataset.del; if (id && confirm('Hapus transaksi ini?')) { await run(sb.from('keuangan_transaksi').delete().eq('id', id)); MODUL.transaksi(bln); } };
};

MODUL.laporan = async function (bln) {
  bln = (typeof bln === 'string' && bln) || today().slice(0, 7);
  const [awalRows, rows, dok] = await Promise.all([
    semua(() => sb.from('keuangan_transaksi').select('jenis,jumlah').lt('tanggal', bln + '-01').order('id')),
    semua(() => sb.from('keuangan_transaksi').select('*').gte('tanggal', bln + '-01').lte('tanggal', akhirBulan(bln)).order('id')),
    run(sb.from('keuangan_dokumen').select('jenis,status,nominal').gte('tanggal', bln + '-01').lte('tanggal', akhirBulan(bln)))]);
  const saldoAwal = jumlah(awalRows.filter(r => r.jenis === 'masuk')) - jumlah(awalRows.filter(r => r.jenis === 'keluar'));
  const per = j => { const o = {}; rows.filter(r => r.jenis === j).forEach(r => { const c = r.kategori || 'Tanpa kategori'; o[c] = (o[c] || 0) + Number(r.jumlah); }); return Object.entries(o).sort((a, b) => b[1] - a[1]); };
  const masuk = per('masuk'), keluar = per('keluar'), tm = jumlah(rows.filter(r => r.jenis === 'masuk')), tk = jumlah(rows.filter(r => r.jenis === 'keluar'));
  const baris = l => l.map(([c, v]) => `<tr><td>${esc(c)}</td><td style="text-align:right">${rp(v)}</td></tr>`).join('') || '<tr><td colspan="2" class="mut">-</td></tr>';
  $('#view').innerHTML = `<h2>Laporan keuangan ${namaBulan(bln)}</h2>
  <p class="noprint">${inputBulan('lb', bln)} <button onclick="print()">Cetak laporan</button></p>
  <table style="max-width:520px"><tr><td>Saldo awal</td><td style="text-align:right"><b>${rp(saldoAwal)}</b></td></tr>
  <tr><td>Total pemasukan</td><td style="text-align:right">${rp(tm)}</td></tr><tr><td>Total pengeluaran</td><td style="text-align:right">${rp(tk)}</td></tr>
  <tr><td><b>Saldo akhir</b></td><td style="text-align:right"><b>${rp(saldoAwal + tm - tk)}</b></td></tr></table>
  <div class="grid" style="margin-top:16px;align-items:start"><div><h3 style="color:var(--navy)">Pemasukan per kategori</h3><table>${baris(masuk)}</table></div>
  <div><h3 style="color:var(--navy)">Pengeluaran per kategori</h3><table>${baris(keluar)}</table></div></div>
  <p class="mut">Dokumen bulan ini: ${dok.filter(d => d.jenis === 'proposal').length} proposal, ${dok.filter(d => d.jenis === 'lpj').length} LPJ.</p>`;
  $('#lb').onchange = e => e.target.value && MODUL.laporan(e.target.value);
};

const STATUS_DOK = { proposal: ['draf', 'diajukan', 'disetujui', 'ditolak', 'dicairkan'], lpj: ['draf', 'dikumpulkan', 'diverifikasi', 'selesai'] };
async function dokumen(jenis) {
  const rows = await run(sb.from('keuangan_dokumen').select('*').eq('jenis', jenis).order('tanggal', { ascending: false }).limit(1000));
  const L = jenis === 'lpj' ? 'LPJ' : 'Proposal', st = STATUS_DOK[jenis];
  $('#view').innerHTML = `<h2>${L}</h2>
  <div class="grid"><div><label for="dj">Judul ${L}</label><input id="dj"></div><div><label for="dp">Pengaju / penanggung jawab</label><input id="dp"></div>
  <div><label for="dn">Nominal (Rp)</label><input id="dn" type="number" min="0" inputmode="numeric"></div><div><label for="dt">Tanggal</label><input id="dt" type="date" value="${today()}"></div>
  <div><label for="ds">Status</label><select id="ds">${opsi(st, st[0])}</select></div>
  ${jenis === 'lpj' ? '<div><label for="dk">Proposal terkait</label><input id="dk"></div>' : ''}
  <div><label for="dl">Tautan dokumen (opsional)</label><input id="dl" placeholder="https://..."></div></div>
  <label for="dc">Catatan</label><input id="dc"><p><button class="p" id="dAdd">Simpan ${L}</button> <button id="dCsv">Unduh CSV</button></p><div id="msg" class="msg"></div>
  <p class="mut">${rows.length} dokumen, total nominal ${rp(rows.reduce((a, r) => a + Number(r.nominal || 0), 0))}.</p>
  <table><tr><th>Tanggal</th><th>Judul</th>${jenis === 'lpj' ? '<th>Proposal</th>' : ''}<th>Nominal</th><th>Status</th><th></th></tr>
  ${rows.map(r => `<tr><td>${tglID(r.tanggal)}</td><td>${esc(r.judul)}<div class="mut">${esc(r.pengaju)}${r.catatan ? ' · ' + esc(r.catatan) : ''}</div></td>${jenis === 'lpj' ? `<td>${esc(r.terkait)}</td>` : ''}<td>${r.nominal != null ? rp(r.nominal) : '-'}</td>
  <td><select data-st="${r.id}">${opsi(st, r.status)}</select></td><td>${/^https?:\/\//i.test(r.link || '') ? `<a href="${esc(r.link)}" target="_blank" rel="noopener">Buka</a> ` : ''}<button class="d" data-del="${r.id}">Hapus</button></td></tr>`).join('') || `<tr><td colspan="6" class="mut">Belum ada ${L}.</td></tr>`}</table>`;
  $('#dAdd').onclick = async () => {
    if (!$('#dj').value.trim()) return msg('Isi judul.', true);
    await run(sb.from('keuangan_dokumen').insert({ jenis, judul: $('#dj').value.trim(), pengaju: $('#dp').value.trim() || null, nominal: $('#dn').value === '' ? null : Math.round(Number($('#dn').value)), tanggal: $('#dt').value || today(), status: $('#ds').value, terkait: jenis === 'lpj' ? ($('#dk').value.trim() || null) : null, link: $('#dl').value.trim() || null, catatan: $('#dc').value.trim() || null }));
    dokumen(jenis);
  };
  $('#dCsv').onclick = () => csv(`${jenis}.csv`, [['Tanggal', 'Judul', 'Pengaju', 'Nominal', 'Status', 'Terkait', 'Catatan'], ...rows.map(r => [r.tanggal, r.judul, r.pengaju, r.nominal, r.status, r.terkait, r.catatan])]);
  $('#view').onchange = async e => { if (e.target.dataset.st) { await run(sb.from('keuangan_dokumen').update({ status: e.target.value }).eq('id', e.target.dataset.st)); msg('Status diperbarui.'); } };
  $('#view').onclick = async e => { const id = e.target.dataset.del; if (id && confirm('Hapus dokumen ini?')) { await run(sb.from('keuangan_dokumen').delete().eq('id', id)); dokumen(jenis); } };
}
MODUL.proposal = () => dokumen('proposal');
MODUL.lpj = () => dokumen('lpj');

/* ================= PERSURATAN ================= */
const STATUS_SURAT = { masuk: ['baru', 'didisposisi', 'selesai'], keluar: ['draf', 'terkirim'] };
async function surat(jenis) {
  const thn = String(new Date().getFullYear());
  const rows = await run(sb.from('surat').select('*').eq('jenis', jenis).order('tanggal', { ascending: false }).order('created_at', { ascending: false }).limit(2000));
  const masuk = jenis === 'masuk', st = STATUS_SURAT[jenis], urutan = rows.filter(r => String(r.tanggal).startsWith(thn)).length + 1;
  $('#view').innerHTML = `<h2>Surat ${masuk ? 'masuk' : 'keluar'}</h2>
  <div class="grid"><div><label for="sn">Nomor surat</label><input id="sn" placeholder="${masuk ? 'Nomor dari pengirim' : 'Urutan berikutnya: ' + String(urutan).padStart(3, '0')}"></div>
  <div><label for="stg">Tanggal</label><input id="stg" type="date" value="${today()}"></div>
  <div><label for="sp">${masuk ? 'Asal surat' : 'Tujuan surat'}</label><input id="sp"></div>
  <div><label for="ss">${masuk ? 'Status / disposisi' : 'Status'}</label><select id="ss">${opsi(st, st[0])}</select></div></div>
  <label for="sf">Perihal</label><input id="sf"><label for="sc" style="margin-top:10px">Catatan / disposisi</label><input id="sc">
  <label for="sl" style="margin-top:10px">Tautan berkas surat (opsional)</label><input id="sl" placeholder="https://...">
  <p><button class="p" id="sAdd">Simpan surat</button></p><div id="msg" class="msg"></div>
  <p><input id="sq" type="search" placeholder="Cari nomor, pihak, atau perihal" style="max-width:320px"> <button id="sCsv">Unduh CSV</button></p><div id="sl2"></div>`;
  const tampil = () => {
    const q = $('#sq').value.trim().toLowerCase(), l = rows.filter(r => !q || [r.nomor, r.pihak, r.perihal].join(' ').toLowerCase().includes(q));
    $('#sl2').innerHTML = `<table><tr><th>Tanggal</th><th>Nomor</th><th>${masuk ? 'Asal' : 'Tujuan'}</th><th>Perihal</th><th>Status</th><th></th></tr>${l.map(r => `<tr><td>${tglID(r.tanggal)}</td><td>${esc(r.nomor)}</td><td>${esc(r.pihak)}</td><td>${esc(r.perihal)}${r.catatan ? `<div class="mut">${esc(r.catatan)}</div>` : ''}</td>
    <td><select data-st="${r.id}">${opsi(st, r.status || st[0])}</select></td><td>${/^https?:\/\//i.test(r.link || '') ? `<a href="${esc(r.link)}" target="_blank" rel="noopener">Buka</a> ` : ''}<button class="d" data-del="${r.id}">Hapus</button></td></tr>`).join('') || '<tr><td colspan="6" class="mut">Belum ada surat.</td></tr>'}</table>`;
  };
  $('#sq').oninput = tampil;
  $('#sAdd').onclick = async () => {
    if (!$('#sf').value.trim()) return msg('Isi perihal surat.', true);
    await run(sb.from('surat').insert({ jenis, nomor: $('#sn').value.trim() || null, tanggal: $('#stg').value || today(), pihak: $('#sp').value.trim() || null, perihal: $('#sf').value.trim(), status: $('#ss').value, catatan: $('#sc').value.trim() || null, link: $('#sl').value.trim() || null }));
    surat(jenis);
  };
  $('#sCsv').onclick = () => csv(`surat-${jenis}.csv`, [['Tanggal', 'Nomor', masuk ? 'Asal' : 'Tujuan', 'Perihal', 'Status', 'Catatan'], ...rows.map(r => [r.tanggal, r.nomor, r.pihak, r.perihal, r.status, r.catatan])]);
  $('#view').onchange = async e => { if (e.target.dataset.st) { await run(sb.from('surat').update({ status: e.target.value }).eq('id', e.target.dataset.st)); msg('Status diperbarui.'); } };
  $('#view').onclick = async e => { const id = e.target.dataset.del; if (id && confirm('Hapus surat ini?')) { await run(sb.from('surat').delete().eq('id', id)); surat(jenis); } };
  tampil();
}
MODUL.masuk = () => surat('masuk');
MODUL.keluar = () => surat('keluar');

MODUL.agenda = async function (bln) {
  bln = (typeof bln === 'string' && bln) || today().slice(0, 7);
  const rows = await run(sb.from('surat').select('*').gte('tanggal', bln + '-01').lte('tanggal', akhirBulan(bln)).order('tanggal').order('created_at'));
  const tabel = j => { const l = rows.filter(r => r.jenis === j); return `<h3 style="color:var(--navy)">Surat ${j} (${l.length})</h3><table><tr><th>No</th><th>Tanggal</th><th>Nomor</th><th>${j === 'masuk' ? 'Asal' : 'Tujuan'}</th><th>Perihal</th><th>Status</th></tr>${l.map((r, i) => `<tr><td>${i + 1}</td><td>${tglID(r.tanggal)}</td><td>${esc(r.nomor)}</td><td>${esc(r.pihak)}</td><td>${esc(r.perihal)}</td><td>${esc(r.status)}</td></tr>`).join('') || '<tr><td colspan="6" class="mut">Tidak ada.</td></tr>'}</table>`; };
  $('#view').innerHTML = `<h2>Agenda surat ${namaBulan(bln)}</h2><p class="noprint">${inputBulan('ab', bln)} <button onclick="print()">Cetak agenda</button></p>${tabel('masuk')}${tabel('keluar')}`;
  $('#ab').onchange = e => e.target.value && MODUL.agenda(e.target.value);
};

/* ================= OPERATOR ================= */
const PERAN = ['guru', 'pustakawan', 'keuangan', 'persuratan', 'operator', 'staf'];
MODUL.akun = async function () {
  const rows = await run(sb.from('guru_staf').select('id,nama,jabatan,kelompok,peran,username,pin,aktif,auth_user_id').order('nama'));
  let lihat = false;
  const gambar = () => {
    $('#al').innerHTML = `<table><tr><th>Nama</th><th>Jabatan</th><th>Peran menu</th><th>Username</th><th>PIN</th><th>Aktif</th><th class="noprint"></th></tr>
    ${rows.map(r => `<tr><td>${esc(r.nama)}</td><td>${esc(r.jabatan)}</td>
    <td><select data-peran="${r.id}" class="noprint">${opsi(r.peran === 'admin' ? [...PERAN, 'admin'] : PERAN, r.peran)}</select><span class="print-only">${esc(r.peran)}</span></td>
    <td><b>${esc(r.username)}</b></td><td><b>${lihat ? esc(r.pin) : '••••••'}</b></td>
    <td><input type="checkbox" style="width:auto" data-aktif="${r.id}" ${r.aktif ? 'checked' : ''}></td>
    <td class="noprint"><button data-jab="${r.id}">Ubah jabatan</button> <button data-pin="${r.id}">Reset PIN</button></td></tr>`).join('')}</table>`;
  };
  $('#view').innerHTML = `<h2>Akun guru & staf</h2>
  <p class="mut">Username dan PIN dibuat otomatis. Akun login aktif saat orangnya pertama kali masuk. Peran menentukan menu yang tampil di akunnya.</p>
  <div class="grid"><div><label for="an">Nama</label><input id="an" placeholder="Nama lengkap, boleh dengan gelar"></div><div><label for="aj">Jabatan</label><input id="aj"></div>
  <div><label for="ak">Kelompok</label><select id="ak"><option value="guru">Guru</option><option value="staf">Staf</option><option value="pimpinan">Pimpinan</option></select></div>
  <div><label for="ar">Peran menu</label><select id="ar"><option value="">Otomatis dari jabatan</option>${opsi(PERAN, '')}</select></div></div>
  <p><button class="p" id="aAdd">Tambah guru / staf</button></p><div id="msg" class="msg"></div>
  <p class="noprint"><label style="display:inline-flex;gap:6px;font-weight:600"><input type="checkbox" id="aLihat" style="width:auto"> Tampilkan PIN</label> <button onclick="print()">Cetak daftar akun</button> <button id="aCsv">Unduh CSV</button></p>
  <div id="al"></div>`;
  gambar();
  $('#aLihat').onchange = e => { lihat = e.target.checked; gambar(); };
  $('#aAdd').onclick = async () => {
    if (!$('#an').value.trim()) return msg('Isi nama.', true);
    const { error } = await sb.from('guru_staf').insert({ nama: $('#an').value.trim(), jabatan: $('#aj').value.trim() || null, kelompok: $('#ak').value, peran: $('#ar').value || null });
    if (error) return msg(error.message.includes('duplicate') ? 'Nama itu sudah ada.' : error.message, true);
    MODUL.akun();
  };
  $('#aCsv').onclick = () => csv('akun-guru-staf.csv', [['Nama', 'Jabatan', 'Peran', 'Username', 'PIN', 'Aktif'], ...rows.map(r => [r.nama, r.jabatan, r.peran, r.username, r.pin, r.aktif ? 'ya' : 'tidak'])]);
  $('#view').onchange = async e => {
    const d = e.target.dataset;
    if (d.peran) { await run(sb.from('guru_staf').update({ peran: e.target.value }).eq('id', d.peran)); rows.find(r => r.id === d.peran).peran = e.target.value; msg('Peran diperbarui. Berlaku saat orangnya membuka ulang halaman ini.'); }
    if (d.aktif) { await run(sb.from('guru_staf').update({ aktif: e.target.checked }).eq('id', d.aktif)); rows.find(r => r.id === d.aktif).aktif = e.target.checked; msg(e.target.checked ? 'Akun diaktifkan.' : 'Akun dinonaktifkan: tidak tampil di halaman Guru & Staff dan tidak bisa login baru.'); }
  };
  $('#view').onclick = async e => {
    const d = e.target.dataset, r = rows.find(x => x.id === (d.jab || d.pin));
    if (d.jab) { const j = prompt('Jabatan baru untuk ' + r.nama + ':', r.jabatan || ''); if (j !== null) { await run(sb.from('guru_staf').update({ jabatan: j.trim() || null }).eq('id', r.id)); MODUL.akun(); } }
    if (d.pin && confirm('Buat PIN baru untuk ' + r.nama + '? PIN lama tidak berlaku lagi.')) {
      const hasil = await run(sb.from('guru_staf').update({ pin: null }).eq('id', r.id).select('pin').single());
      msg('PIN baru ' + r.nama + ': ' + hasil.pin); r.pin = hasil.pin; gambar();
    }
  };
};

MODUL.data = async function () {
  $('#view').innerHTML = '<p>Memuat data murid...</p>';
  const g = (await dataSiswa()).slice().sort((a, b) => urut(a.instansi_kelas, b.instansi_kelas) || urut(a.guest_name, b.guest_name)), kls = kelasDari(g);
  const hitung = kls.map(k => `${esc(k)}: ${g.filter(x => String(x.instansi_kelas || '').trim() === k).length}`).join(' · ');
  $('#view').innerHTML = `<h2>Data murid (${g.length})</h2><p class="mut">${hitung}</p>
  <p><select id="dk" style="max-width:180px"><option value="">Semua kelas</option>${kls.map(k => `<option>${esc(k)}</option>`).join('')}</select> <input id="dq" type="search" placeholder="Cari nama" style="max-width:260px"> <button id="dCsv">Unduh CSV</button> <button onclick="print()">Cetak</button></p><div id="dl"></div>`;
  const saring = () => { const k = $('#dk').value, q = $('#dq').value.trim().toLowerCase(); return g.filter(x => (!k || String(x.instansi_kelas || '').trim() === k) && (!q || x.guest_name.toLowerCase().includes(q))); };
  const tampil = () => { const l = saring(); $('#dl').innerHTML = `<p class="mut">${l.length} murid</p><table><tr><th>No</th><th>Nama</th><th>Kelas</th><th>No. induk / ID</th></tr>${l.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.guest_name)}</td><td>${esc(String(x.instansi_kelas || '').trim())}</td><td>${esc(x.guest_id)}</td></tr>`).join('')}</table>`; };
  $('#dk').onchange = tampil; $('#dq').oninput = tampil;
  $('#dCsv').onclick = () => csv('data-murid.csv', [['Nama', 'Kelas', 'ID'], ...saring().map(x => [x.guest_name, String(x.instansi_kelas || '').trim(), x.guest_id])]);
  tampil();
};

MODUL.tugasop = async function () {
  const rows = await run(sb.from('tugas_operator').select('*').order('created_at', { ascending: false }).limit(1000));
  const KAT = ['Dapodik', 'EMIS', 'Data murid', 'Data guru & staf', 'Akun & PIN', 'Inventaris', 'Jaringan & perangkat', 'Lainnya'];
  $('#view').innerHTML = `<h2>Daftar pekerjaan operator</h2>
  <div class="grid"><div><label for="oj">Pekerjaan</label><input id="oj"></div><div><label for="ok">Kategori</label><input id="ok" list="okl"><datalist id="okl">${KAT.map(k => `<option>${k}</option>`).join('')}</datalist></div>
  <div><label for="ot">Tenggat</label><input id="ot" type="date"></div></div>
  <label for="oc">Catatan</label><input id="oc"><p><button class="p" id="oAdd">Tambah pekerjaan</button></p><div id="msg" class="msg"></div>
  <p class="mut">${rows.filter(r => r.status !== 'selesai').length} pekerjaan belum selesai.</p>
  <table><tr><th>Pekerjaan</th><th>Kategori</th><th>Tenggat</th><th>Status</th><th></th></tr>${rows.map(r => `<tr><td>${esc(r.judul)}${r.catatan ? `<div class="mut">${esc(r.catatan)}</div>` : ''}</td><td>${esc(r.kategori)}</td>
  <td ${r.status !== 'selesai' && r.tenggat && r.tenggat < today() ? 'style="color:var(--danger);font-weight:700"' : ''}>${tglID(r.tenggat)}</td>
  <td><select data-st="${r.id}">${opsi(['belum', 'proses', 'selesai'], r.status)}</select></td><td><button class="d" data-del="${r.id}">Hapus</button></td></tr>`).join('') || '<tr><td colspan="5" class="mut">Belum ada pekerjaan.</td></tr>'}</table>`;
  $('#oAdd').onclick = async () => {
    if (!$('#oj').value.trim()) return msg('Isi pekerjaan.', true);
    await run(sb.from('tugas_operator').insert({ judul: $('#oj').value.trim(), kategori: $('#ok').value.trim() || null, tenggat: $('#ot').value || null, catatan: $('#oc').value.trim() || null })); MODUL.tugasop();
  };
  $('#view').onchange = async e => { if (e.target.dataset.st) { await run(sb.from('tugas_operator').update({ status: e.target.value }).eq('id', e.target.dataset.st)); msg('Status diperbarui.'); } };
  $('#view').onclick = async e => { const id = e.target.dataset.del; if (id && confirm('Hapus pekerjaan ini?')) { await run(sb.from('tugas_operator').delete().eq('id', id)); MODUL.tugasop(); } };
};

/* ================= PROFIL STAF (nama + foto) ================= */
MODUL.profilStaf = async function () {
  const n = (S.prof && S.prof.nama) || S.dnama || '';
  $('#view').innerHTML = `<h2>Profil saya</h2>
  <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:14px"><div class="av" style="width:84px;height:84px;font-size:32px">${S.fotoUrl ? `<img src="${esc(S.fotoUrl)}" alt="">` : esc((n.trim()[0] || 'S').toUpperCase())}</div>
  <div><label for="pf">Ganti foto profil</label><input id="pf" type="file" accept="image/*"></div></div>
  <div class="grid"><div><label for="pn">Nama (tampil di sapaan)</label><input id="pn" value="${esc(n)}"></div>
  <div><label>Jabatan</label><input value="${esc(S.jabatan)}" disabled></div><div><label>Username</label><input value="${esc(S.username)}" disabled></div></div>
  <p><button class="p" id="svP">Simpan profil</button></p><div id="msg" class="msg"></div>
  <p class="mut">Jabatan dan PIN diatur oleh operator sekolah. Jabatan juga tampil di halaman Guru & Staff.</p>`;
  $('#svP').onclick = async () => {
    const u = (await sb.auth.getUser()).data.user.id;
    await run(sb.from('kelas_profil').upsert({ guru_id: u, nama: $('#pn').value.trim() }, { onConflict: 'guru_id' }));
    await loadProfil(); msg('Profil tersimpan.');
  };
  $('#view').onchange = async e => {
    if (e.target.id !== 'pf' || !e.target.files[0]) return;
    const u = (await sb.auth.getUser()).data.user.id, path = `${u}/profil/foto.jpg`;
    const { error } = await sb.storage.from('karya').upload(path, await resize(e.target.files[0], 400), { contentType: 'image/jpeg', upsert: true });
    if (error) return msg(error.message, true);
    await run(sb.from('kelas_profil').upsert({ guru_id: u, nama: $('#pn').value.trim(), foto_path: path }, { onConflict: 'guru_id' }));
    await loadProfil(); MODUL.profilStaf(); msg('Foto diganti.');
  };
};
