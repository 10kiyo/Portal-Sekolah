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
// Foto profil guru/staf: diunggah sendiri oleh orangnya ke bucket publik "foto-guru" (<uid>.jpg), lalu kolom guru_staf.foto-nya
// diisi lewat fungsi simpan_foto_saya() sehingga langsung tampil di halaman Guru & Staff. Lihat supabase-foto-guru.sql.
async function unggahFotoGuru(file) {
  const u = (await sb.auth.getUser()).data.user.id, path = u + '.jpg';
  const up = await sb.storage.from('foto-guru').upload(path, await resize(file, 600), { contentType: 'image/jpeg', upsert: true, cacheControl: '3600' });
  if (up.error) throw up.error;
  const url = sb.storage.from('foto-guru').getPublicUrl(path).data.publicUrl + '?v=' + Date.now();
  const rpc = await sb.rpc('simpan_foto_saya', { p_url: url });
  if (rpc.error) throw rpc.error;
  S.fotoGuru = url;
  return url;
}
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
const KARTU_SISTEM = ['guest_id', 'nama_ref', 'foto_path', 'created_at', 'updated_at', 'nama', 'kelas', 'jenis', 'nonaktif', 'sumber'];   // kolom murid_profil yang bukan bagian kartu
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
  // Tautan pendaftaran dibuat panitia (Kegiatan Sekolah > pilih jenis Ekskul/Club). Di sini pustakawan mengelola pendaftarnya:
  //   Ekskul = berbayar: periksa bukti transfer, konfirmasi jumlah   |   Club = gratis: seleksi (diterima / tidak).
  const [keg, rows] = await Promise.all([
    run(sb.from('kegiatan').select('*').in('jenis', ['ekskul', 'club']).order('tanggal_kegiatan', { ascending: false })),
    run(sb.from('ekskul_pendaftar').select('*').order('created_at', { ascending: false }).limit(5000))
  ]);
  const ST = { menunggu: ['Menunggu', '#a65f00', '#fdf0e3'], lunas: ['Lunas', '#19724d', '#eaf5ee'], diterima: ['Diterima', '#19724d', '#eaf5ee'], ditolak: ['Ditolak', '#bc3d33', '#fbeceb'] };
  const pill = (st, club) => { const x = ST[st] || ST.menunggu, t = club && st === 'ditolak' ? 'Tidak diterima' : x[0]; return `<span style="display:inline-block;padding:2px 9px;border-radius:99px;font-size:12px;font-weight:700;color:${x[1]};background:${x[2]}">${t}</span>`; };
  let jenis = 'ekskul', kid = '';
  const kegJ = () => keg.filter(k => k.jenis === jenis);
  const tampil = () => {
    const kl = kegJ(); if (!kl.find(k => k.id === kid)) kid = (kl[0] || {}).id || '';
    const k = kl.find(x => x.id === kid), club = jenis === 'club', ps = rows.filter(r => r.kegiatan_id === kid);
    const n = st => ps.filter(r => r.status === st).length;
    const stat = (a, b) => `<div style="background:var(--soft,#eef6fc);border-radius:12px;padding:10px;text-align:center"><b style="display:block;font-size:20px;color:var(--navy)">${a}</b><span class="mut">${b}</span></div>`;
    const dana = ps.reduce((a, r) => a + (r.status === 'lunas' ? Number(r.nominal_diterima || 0) : 0), 0);
    $('#view').innerHTML = `<h2>Ekskul & club</h2>
    <p class="mut">Tautan pendaftaran dibuat oleh panitia di menu Kegiatan Sekolah. Data pendaftar hanya bisa dilihat pustakawan.</p>
    <p><button class="${jenis === 'ekskul' ? 'p' : ''}" data-j="ekskul">Ekstrakurikuler (berbayar)</button> <button class="${jenis === 'club' ? 'p' : ''}" data-j="club">Club (seleksi)</button></p>
    ${kl.length ? `<label for="ekg">Kegiatan</label><select id="ekg" style="max-width:420px">${kl.map(x => `<option value="${x.id}" ${x.id === kid ? 'selected' : ''}>${esc(x.nama)} (${tglID(x.tanggal_kegiatan)})</option>`).join('')}</select>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin:12px 0">
      ${stat(ps.length, 'Pendaftar')}${club ? stat(n('diterima'), 'Diterima') + stat(n('menunggu'), 'Belum diseleksi') + stat(n('ditolak'), 'Tidak diterima') + (k.kuota ? stat(Math.max(0, k.kuota - n('diterima')), 'Sisa kuota') : '')
        : stat(n('lunas'), 'Lunas') + stat(n('menunggu'), 'Perlu diperiksa') + stat(n('ditolak'), 'Ditolak') + stat(rp(dana), 'Dana terkonfirmasi') + (k.kuota ? stat(Math.max(0, k.kuota - ps.filter(r => r.status !== 'ditolak').length), 'Sisa kuota') : '')}
    </div>
    <p><select id="efs" style="max-width:200px"><option value="">Semua status</option>${Object.keys(ST).filter(x => club ? x !== 'lunas' : x !== 'diterima').map(x => `<option value="${x}">${club && x === 'ditolak' ? 'Tidak diterima' : ST[x][0]}</option>`).join('')}</select> <button id="eCsv">Unduh CSV</button> <button onclick="print()">Cetak</button></p>
    <div id="et" style="overflow-x:auto"></div>` : `<p class="mut">Belum ada kegiatan ${club ? 'club' : 'ekskul'}. Minta panitia membuatnya di menu Kegiatan Sekolah (pilih jenis ${club ? 'Club' : 'Ekstrakurikuler'}).</p>`}
    <div id="msg" class="msg"></div>`;
    document.querySelectorAll('[data-j]').forEach(b => b.onclick = () => { jenis = b.dataset.j; kid = ''; tampil(); });
    if (!k) return;
    $('#ekg').onchange = e => { kid = e.target.value; tampil(); };
    const draw = () => {
      const f = $('#efs').value, l = ps.filter(r => !f || r.status === f);
      $('#et').innerHTML = l.length ? `<table><tr><th>Anak</th><th>Status</th><th>${club ? 'Alasan bergabung' : 'Transfer'}</th><th>Kontak</th>${club ? '<th>Nilai</th>' : ''}<th class="noprint"></th></tr>${l.map(r => `<tr>
        <td><b>${esc(r.nama_anak)}</b><div class="mut">${esc(r.kelas || '')}</div></td><td>${pill(r.status, club)}${r.catatan ? `<div class="mut">${esc(r.catatan)}</div>` : ''}</td>
        <td>${club ? esc((r.data || {}).motivasi || '-') : `${esc(r.nama_pengirim || '-')}<div class="mut">${tglID(r.tanggal_transfer)}${r.nominal_diterima != null ? ' · ' + rp(r.nominal_diterima) : ''}</div>`}</td>
        <td>${esc((r.data || {}).kontak || '-')}</td>${club ? `<td>${r.nilai_seleksi ?? '-'}</td>` : ''}
        <td class="noprint"><button data-p="${r.id}" class="${r.status === 'menunggu' ? 'p' : ''}">${r.status === 'menunggu' ? (club ? 'Seleksi' : 'Periksa') : 'Lihat'}</button></td></tr>`).join('')}</table>` : '<p class="mut">Belum ada pendaftar.</p>';
    };
    $('#efs').onchange = draw; draw();
    $('#et').onclick = e => { const b = e.target.closest('[data-p]'); if (b) periksa(rows.find(r => r.id === b.dataset.p), k); };
    $('#eCsv').onclick = () => csv('pendaftar-' + k.nama.replace(/[^\w]+/g, '-').toLowerCase() + '.csv',
      [club ? ['Nama', 'Kelas', 'Status', 'Alasan bergabung', 'Nilai seleksi', 'Kontak', 'Catatan', 'Waktu daftar'] : ['Nama', 'Kelas', 'Status', 'Pengirim', 'Tanggal transfer', 'Jumlah dikonfirmasi', 'Kontak', 'Catatan', 'Waktu daftar'],
       ...ps.map(r => club ? [r.nama_anak, r.kelas, r.status, (r.data || {}).motivasi, r.nilai_seleksi, (r.data || {}).kontak, r.catatan, r.created_at]
         : [r.nama_anak, r.kelas, r.status, r.nama_pengirim, r.tanggal_transfer, r.nominal_diterima, (r.data || {}).kontak, r.catatan, r.created_at])]);
  };
  async function periksa(r, k) {
    const club = k.jenis === 'club', d = r.data || {};
    let dlg = document.getElementById('dlgEC'); if (dlg) dlg.remove();
    dlg = document.createElement('dialog'); dlg.id = 'dlgEC'; dlg.style.cssText = 'border:0;border-radius:18px;padding:20px;width:min(520px,calc(100% - 24px));max-height:calc(100vh - 24px);overflow-y:auto';
    dlg.innerHTML = `<h3 style="margin:0">${esc(r.nama_anak)}</h3><div class="mut">${esc(r.kelas || '')} · ${esc(k.nama)}</div>
      ${club ? `<p style="margin:12px 0 4px"><b>Alasan bergabung</b></p><div style="white-space:pre-wrap">${esc(d.motivasi || '-')}</div>`
        : `<p style="margin:12px 0 4px">Pengirim: <b>${esc(r.nama_pengirim || '-')}</b> · ${tglID(r.tanggal_transfer)}<br>Biaya seharusnya: <b>${rp(k.biaya)}</b></p><div id="ebk" class="mut">Memuat bukti…</div>`}
      <p class="mut" style="margin:10px 0">Kontak darurat: ${esc(d.kontak || '-')}${d.kaos ? ' · Kaos: ' + esc(d.kaos) : ''}${d.kesehatan ? '<br>Kesehatan: ' + esc(d.kesehatan) : ''}</p>
      ${club ? `<label for="enl">Nilai seleksi (opsional)</label><input id="enl" type="number" step="0.1" min="0" max="100" value="${r.nilai_seleksi ?? ''}" style="max-width:160px">`
        : `<label for="enm">Jumlah yang Anda terima di rekening (Rp)</label><input id="enm" type="number" min="0" step="1000" value="${r.nominal_diterima ?? k.biaya}" style="max-width:220px">`}
      <label for="enc" style="margin-top:10px">Catatan untuk orang tua ${club ? '' : '(wajib jika ditolak)'}</label><textarea id="enc" rows="2" maxlength="300">${esc(r.catatan || '')}</textarea>
      <div id="eerr" style="color:#bc3d33;font-weight:650;margin-top:8px"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:12px"><button data-s="x">Tutup</button>
      ${r.status !== 'menunggu' ? '<button data-s="menunggu">Kembalikan ke menunggu</button>' : ''}<button data-s="ditolak">${club ? 'Tidak diterima' : 'Tolak'}</button><button class="p" data-s="${club ? 'diterima' : 'lunas'}">${club ? 'Terima' : 'Konfirmasi lunas'}</button></div>`;
    document.body.appendChild(dlg); dlg.showModal();
    if (!club) {
      if (!r.bukti_path) $('#ebk').textContent = 'Tidak ada bukti transfer.';
      else sb.storage.from('bukti').createSignedUrl(r.bukti_path, 600).then(({ data, error }) => {
        $('#ebk').innerHTML = error ? 'Bukti tidak dapat dimuat: ' + esc(error.message) : `<a href="${esc(data.signedUrl)}" target="_blank" rel="noopener"><img src="${esc(data.signedUrl)}" alt="Bukti transfer" style="max-width:100%;max-height:50vh;display:block;margin:6px auto;border-radius:12px;border:1px solid #cbd8e6"></a>`;
      });
    }
    dlg.onclick = async e => {
      const b = e.target.closest('[data-s]'); if (!b) return;
      const st = b.dataset.s; if (st === 'x') return dlg.close();
      const cat = $('#enc').value.trim(), err = $('#eerr'); err.textContent = '';
      if (st === 'ditolak' && !cat && !club) return err.textContent = 'Tulis alasan penolakan agar orang tua tahu apa yang perlu diperbaiki.';
      const upd = { status: st, catatan: cat || null, verified_at: st === 'menunggu' ? null : new Date().toISOString() };
      if (club) { const v = $('#enl').value; upd.nilai_seleksi = v === '' ? null : Number(v); if (st === 'diterima' && k.kuota && rows.filter(x => x.kegiatan_id === k.id && x.status === 'diterima' && x.id !== r.id).length >= k.kuota && !confirm('Kuota club sudah terpenuhi. Tetap terima anak ini?')) return; }
      else {
        const nom = $('#enm').value === '' ? null : Number($('#enm').value);
        if (st === 'lunas') {
          if (nom === null || nom < 0) return err.textContent = 'Isi jumlah yang Anda terima.';
          if (nom !== Number(k.biaya) && !confirm(`Jumlah diterima ${rp(nom)} berbeda dari biaya ${rp(k.biaya)}. Tetap tandai lunas?`)) return;
          upd.nominal_diterima = nom;
        } else upd.nominal_diterima = null;
      }
      b.disabled = true;
      const { error } = await sb.from('ekskul_pendaftar').update(upd).eq('id', r.id);
      if (error) { err.textContent = 'Gagal menyimpan: ' + error.message; b.disabled = false; return; }
      Object.assign(r, upd); dlg.close(); tampil();
    };
  }
  tampil();
};

/* ================= SARANA & PRASARANA: KELOLA FASILITAS (Waka SarPras) =================
   Data tabel "fasilitas" + foto di bucket publik "fasilitas". Tampil di halaman publik fasilitas.html lewat /api/fasilitas.
   Tabel & aturan akses: supabase-fasilitas.sql. */
const KAT_FAS = ['Ruang belajar', 'Ibadah', 'Olahraga & bermain', 'Perpustakaan & laboratorium', 'Kesehatan & sanitasi', 'Penunjang', 'Lainnya'];
const KOND_FAS = { baik: ['Baik', '#19724d', '#eaf5ee'], perlu_perbaikan: ['Perlu perbaikan', '#a65f00', '#fdf0e3'], dalam_perbaikan: ['Sedang diperbaiki', '#bc3d33', '#fbeceb'] };
const pathFasilitas = u => { const i = String(u).indexOf('/object/public/fasilitas/'); return i < 0 ? null : decodeURIComponent(String(u).slice(i + 25).split('?')[0]); };
MODUL.fasilitas = async function () {
  const rows = await run(sb.from('fasilitas').select('*').order('urutan', { ascending: true, nullsFirst: false }).order('nama'));
  const pill = (t, c, b) => `<span style="display:inline-block;padding:2px 9px;border-radius:99px;font-size:12px;font-weight:700;color:${c};background:${b}">${t}</span>`;
  $('#view').innerHTML = `<h2>Kelola fasilitas sekolah</h2>
  <p class="mut">Yang ditandai "Tampil" muncul di halaman publik Profil › Fasilitas. Kondisi hanya untuk catatan internal dan tidak tampil ke publik. Foto pertama menjadi sampul.</p>
  <p><button class="p" id="fTambah">+ Tambah fasilitas</button></p><div id="msg" class="msg"></div>
  <div id="fl">${rows.length ? rows.map((r, i) => {
    const k = KOND_FAS[r.kondisi] || KOND_FAS.baik, f0 = (r.foto || [])[0];
    return `<div style="display:flex;gap:12px;align-items:flex-start;border:1px solid #dbe8f2;border-radius:14px;padding:10px;margin-top:10px;background:#fff">
      <div style="width:96px;height:72px;flex:none;border-radius:10px;overflow:hidden;background:#e6eef6;display:grid;place-items:center;color:#9db4c9;font-size:12px">${f0 ? `<img src="${esc(f0)}" alt="" style="width:100%;height:100%;object-fit:cover">` : 'Tanpa foto'}</div>
      <div style="flex:1;min-width:0"><b style="color:var(--navy)">${esc(r.nama)}</b> ${r.tampil ? pill('Tampil', '#19724d', '#eaf5ee') : pill('Disembunyikan', '#627d98', '#eef2f6')} ${pill(k[0], k[1], k[2])}
        <div class="mut">${esc(r.kategori)}${r.lokasi ? ' · ' + esc(r.lokasi) : ''}${r.kapasitas ? ' · ' + esc(r.kapasitas) : ''}${r.jumlah != null ? ' · ' + r.jumlah + ' unit' : ''} · ${(r.foto || []).length} foto</div>
        <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap"><button data-e="${r.id}">Edit</button>
        <button data-t="${r.id}">${r.tampil ? 'Sembunyikan' : 'Tampilkan'}</button>
        <button data-u="${r.id}" ${i === 0 ? 'disabled' : ''} title="Naik">↑</button><button data-d="${r.id}" ${i === rows.length - 1 ? 'disabled' : ''} title="Turun">↓</button>
        <button data-x="${r.id}">Hapus</button></div></div></div>`;
  }).join('') : '<p class="mut">Belum ada fasilitas. Klik "Tambah fasilitas".</p>'}</div>`;

  const geser = async (id, arah) => {
    const ids = rows.map(r => r.id), i = ids.indexOf(id), j = i + arah; if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await Promise.all(ids.map((x, n) => sb.from('fasilitas').update({ urutan: (n + 1) * 10 }).eq('id', x)));
    MODUL.fasilitas();
  };
  $('#fTambah').onclick = () => form(null);
  $('#fl').onclick = async e => {
    const d = e.target.closest('button')?.dataset || {}, r = rows.find(x => x.id === (d.e || d.t || d.u || d.d || d.x)); if (!r) return;
    if (d.e) form(r);
    else if (d.t) { await run(sb.from('fasilitas').update({ tampil: !r.tampil }).eq('id', r.id)); MODUL.fasilitas(); }
    else if (d.u) await geser(r.id, -1);
    else if (d.d) await geser(r.id, 1);
    else if (d.x && confirm(`Hapus "${r.nama}" beserta fotonya? Tidak bisa dikembalikan.`)) {
      const ps = (r.foto || []).map(pathFasilitas).filter(Boolean);
      await run(sb.from('fasilitas').delete().eq('id', r.id));
      if (ps.length) await sb.storage.from('fasilitas').remove(ps);
      MODUL.fasilitas();
    }
  };

  function form(r) {
    let foto = [...((r && r.foto) || [])]; const hapus = [];
    let dlg = document.getElementById('dlgFas'); if (dlg) dlg.remove();
    dlg = document.createElement('dialog'); dlg.id = 'dlgFas'; dlg.style.cssText = 'border:0;border-radius:18px;padding:20px;width:min(600px,calc(100% - 24px));max-height:calc(100vh - 24px);overflow-y:auto';
    dlg.innerHTML = `<h3 style="margin:0 0 10px">${r ? 'Edit fasilitas' : 'Tambah fasilitas'}</h3>
      <div class="grid"><div style="grid-column:1/-1"><label for="fn">Nama fasilitas</label><input id="fn" maxlength="100" value="${esc(r ? r.nama : '')}" placeholder="mis. Perpustakaan, Musala, Lapangan Upacara"></div>
      <div><label for="fk">Kategori</label><select id="fk">${opsi(KAT_FAS, r ? r.kategori : KAT_FAS[0])}</select></div>
      <div><label for="fl2">Lokasi</label><input id="fl2" maxlength="100" value="${esc(r ? r.lokasi || '' : '')}" placeholder="mis. Gedung A lantai 1"></div>
      <div><label for="fc">Kapasitas</label><input id="fc" maxlength="60" value="${esc(r ? r.kapasitas || '' : '')}" placeholder="mis. 30 siswa"></div>
      <div><label for="fj">Jumlah unit (opsional)</label><input id="fj" type="number" min="0" value="${r && r.jumlah != null ? r.jumlah : ''}"></div>
      <div style="grid-column:1/-1"><label for="fd">Deskripsi</label><textarea id="fd" rows="4" maxlength="1500" placeholder="Fungsi, perlengkapan, dan keunggulan fasilitas">${esc(r ? r.deskripsi || '' : '')}</textarea></div>
      <div><label for="fo">Kondisi (internal)</label><select id="fo">${Object.keys(KOND_FAS).map(k => `<option value="${k}" ${r && r.kondisi === k ? 'selected' : ''}>${KOND_FAS[k][0]}</option>`).join('')}</select></div>
      <div><label for="fu">Urutan (angka kecil lebih dulu)</label><input id="fu" type="number" min="0" value="${r && r.urutan != null ? r.urutan : ''}"></div></div>
      <label class="chk" style="margin-top:10px"><input type="checkbox" id="ft" ${!r || r.tampil ? 'checked' : ''}> Tampilkan di halaman publik</label>
      <label style="margin-top:10px">Foto</label><div id="ff" style="display:flex;gap:8px;flex-wrap:wrap"></div>
      <input id="fup" type="file" accept="image/*" multiple style="margin-top:8px"><div class="mut">Boleh pilih beberapa foto sekaligus. Foto dikecilkan otomatis.</div>
      <div id="ferr" style="color:#bc3d33;font-weight:650;margin-top:8px"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button id="fBatal">Batal</button><button class="p" id="fSimpan">Simpan</button></div>`;
    document.body.appendChild(dlg); dlg.showModal();
    const gambarFoto = () => { $('#ff').innerHTML = foto.length ? foto.map((u, i) => `<div style="width:104px"><div style="height:78px;border-radius:10px;overflow:hidden;background:#e6eef6"><img src="${esc(u)}" alt="" style="width:100%;height:100%;object-fit:cover"></div>
      <div style="font-size:12px;margin-top:3px">${i === 0 ? '<b>Sampul</b>' : `<a href="#" data-cov="${i}">Jadikan sampul</a>`} · <a href="#" data-del="${i}" style="color:#bc3d33">Hapus</a></div></div>`).join('') : '<span class="mut">Belum ada foto.</span>'; };
    gambarFoto();
    $('#ff').onclick = e => {
      const a = e.target.closest('a'); if (!a) return; e.preventDefault();
      if (a.dataset.cov) { const [u] = foto.splice(Number(a.dataset.cov), 1); foto.unshift(u); }
      if (a.dataset.del) { const [u] = foto.splice(Number(a.dataset.del), 1); const p = pathFasilitas(u); if (p) hapus.push(p); }
      gambarFoto();
    };
    $('#fBatal').onclick = () => { dlg.close(); dlg.remove(); };
    $('#fSimpan').onclick = async () => {
      const err = $('#ferr'); err.textContent = '';
      const nama = $('#fn').value.trim(); if (!nama) return err.textContent = 'Isi nama fasilitas.';
      const num = id => { const v = $(id).value; return v === '' ? null : Number(v); };
      const rec = { nama, kategori: $('#fk').value, lokasi: $('#fl2').value.trim() || null, kapasitas: $('#fc').value.trim() || null, jumlah: num('#fj'),
        deskripsi: $('#fd').value.trim() || null, kondisi: $('#fo').value, urutan: num('#fu'), tampil: $('#ft').checked };
      const b = $('#fSimpan'); b.disabled = true; b.textContent = 'Menyimpan…';
      try {
        let id = r && r.id;
        if (id) await run(sb.from('fasilitas').update(rec).eq('id', id));
        else id = (await run(sb.from('fasilitas').insert(rec).select('id').single())).id;
        const baru = [];
        for (const f of [...$('#fup').files]) {
          const path = `${id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
          const up = await sb.storage.from('fasilitas').upload(path, await resize(f, 1400), { contentType: 'image/jpeg' });
          if (up.error) throw up.error;
          baru.push(sb.storage.from('fasilitas').getPublicUrl(path).data.publicUrl);
        }
        await run(sb.from('fasilitas').update({ foto: [...foto, ...baru] }).eq('id', id));
        if (hapus.length) await sb.storage.from('fasilitas').remove(hapus);
        dlg.close(); dlg.remove(); MODUL.fasilitas();
      } catch (ex) { err.textContent = 'Gagal menyimpan: ' + (ex.message || ex) + '. Pastikan supabase-fasilitas.sql sudah dijalankan dan akun berperan sarpras.'; b.disabled = false; b.textContent = 'Simpan'; }
    };
  }
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
const PERAN = ['guru', 'pustakawan', 'keuangan', 'persuratan', 'operator', 'sarpras', 'bk', 'info', 'staf'];
const PERAN_LABEL = { guru: 'Guru', pustakawan: 'Pustakawan', keuangan: 'Keuangan', persuratan: 'Persuratan', operator: 'Operator', sarpras: 'Sarpras', bk: 'Guru BK', info: 'Admin Info', staf: 'Staf', admin: 'Admin' };
const opsiPeran = (list, sel) => list.map(v => `<option value="${v}" ${v === sel ? 'selected' : ''}>${PERAN_LABEL[v] || v}</option>`).join('');
function cssAkun() {
  if (document.getElementById('akunCss')) return;
  const st = document.createElement('style'); st.id = 'akunCss';
  st.textContent = `
  .ak-add{background:var(--soft);border-radius:14px;padding:14px 14px 4px;margin:12px 0 4px}.ak-add .grid{margin-bottom:10px;align-items:end}
  .ak-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:16px 0 10px}.ak-bar .cari{flex:1 1 260px;max-width:360px}.ak-bar select{width:auto;min-width:150px}
  .ak-bar .sp{flex:1 1 0}.ak-bar button{padding:9px 14px}.ak-wrap{overflow-x:auto;border:1px solid #e6eef5;border-radius:14px}
  .ak-tbl{width:100%;border-collapse:collapse;min-width:900px}.ak-tbl td:first-child{min-width:210px}.ak-tbl th{background:#f6fafd;padding:10px 12px;font-size:12px;color:var(--mute);white-space:nowrap}
  .ak-tbl td{padding:11px 12px;vertical-align:middle;border-bottom:1px solid #eef3f8}.ak-tbl tr:last-child td{border-bottom:0}.ak-tbl tbody tr:hover{background:#fafcfe}
  .ak-nm b{display:block;color:var(--navy);line-height:1.3}.ak-nm span,.ak-ac span{display:block;font-size:13px;color:var(--mute)}.ak-ac b{display:block;color:var(--navy)}
  .ak-tbl select{width:auto;min-width:122px;padding:8px 10px;font-size:14px}.ak-off td{opacity:.5}.ak-off td.ak-keep{opacity:1}
  .ak-chip{position:relative;display:inline-block;margin:0 5px 5px 0;font-weight:400}.ak-chip input{position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0;opacity:0;cursor:pointer}
  .ak-chip span{display:inline-block;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:700;color:var(--mute);background:#fff;border:1px solid var(--line)}
  .ak-chip.on span{background:var(--soft);border-color:#b9d8f2;color:var(--blue)}.ak-chip.on:hover span{border-color:var(--danger);color:var(--danger);background:#fbeceb}.ak-tbl select.ak-add1{min-width:0;width:auto;padding:3px 8px;font-size:12px;font-weight:700;color:var(--mute);border-radius:99px;margin:0 5px 5px 0;vertical-align:top}.ak-chip input:focus-visible+span{outline:3px solid #1677c850}
  .ak-sw{position:relative;display:inline-block;width:40px;height:23px;margin:0;vertical-align:middle}.ak-sw input{position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0;opacity:0;cursor:pointer}
  .ak-sw i{position:absolute;inset:0;border-radius:99px;background:#cbd8e6;transition:.15s}.ak-sw i:after{content:"";position:absolute;top:3px;left:3px;width:17px;height:17px;border-radius:50%;background:#fff;transition:.15s}
  .ak-sw input:checked+i{background:var(--ok)}.ak-sw input:checked+i:after{left:20px}.ak-sw input:focus-visible+i{outline:3px solid #1677c850}
  @media(max-width:720px){.ak-wrap{border:0;overflow:visible}.ak-tbl{min-width:0}.ak-tbl thead{display:none}.ak-tbl,.ak-tbl tbody{display:block}.ak-tbl tr{display:block;border:1px solid #e6eef5;border-radius:14px;padding:10px 12px;margin-bottom:10px}.ak-tbl td{display:flex;justify-content:space-between;align-items:center;gap:12px;border:0;padding:6px 0;min-width:0!important}.ak-tbl td:first-child{display:block;padding-bottom:8px;border-bottom:1px solid #eef3f8;margin-bottom:4px}.ak-tbl td[data-l]:before{content:attr(data-l);font-size:12px;font-weight:700;color:var(--mute);flex:none}.ak-tbl td.ak-ac{text-align:right}.ak-tbl td[data-l="Peran tambahan"]{align-items:flex-start}.ak-tbl td[data-l="Peran tambahan"]>span{text-align:right}.ak-off td{opacity:.55}}.ak-sw2{display:inline-flex;gap:8px;align-items:center;font-weight:600;margin:0}.ak-cnt{font-size:13px;color:var(--mute);margin:0 0 8px}`;
  document.head.appendChild(st);
}
// Kelola Info Terbaru + Galeri Prestasi (peran info). Memuat info-admin.html dalam mode staf: tanpa PIN, memakai login akun guru.
MODUL.infoadmin = async function () {
  $('#view').innerHTML = `<h2>Kelola Info & Galeri</h2><p class="mut">Info Terbaru, Galeri Prestasi, Ekstrakurikuler, Club, dan Kegiatan Unggulan.</p>
  <iframe src="info-admin.html?staf=1" title="Kelola Info dan Galeri" style="display:block;width:100%;height:calc(100vh - 230px);min-height:680px;border:0;border-radius:14px;background:transparent"></iframe>`;
};
MODUL.akun = async function () {
  cssAkun();
  const rows = await run(sb.from('guru_staf').select('id,nama,jabatan,kelompok,peran,peran_tambahan,username,pin,aktif,auth_user_id').order('nama'));
  let lihat = false;
  const cocok = r => {
    const q = $('#aq').value.trim().toLowerCase(), f = $('#af').value;
    return (!q || (r.nama + ' ' + (r.jabatan || '') + ' ' + (r.username || '')).toLowerCase().includes(q)) && (!f || r.peran === f || (r.peran_tambahan || []).includes(f));
  };
  const gambar = () => {
    const l = rows.filter(cocok);
    $('#ac').textContent = l.length === rows.length ? rows.length + ' akun' : l.length + ' dari ' + rows.length + ' akun';
    $('#al').innerHTML = l.length ? `<div class="ak-wrap"><table class="ak-tbl"><thead><tr><th>Nama & jabatan</th><th>Akun login</th><th>Peran menu</th><th>Peran tambahan</th><th>Aktif</th><th class="noprint"></th></tr></thead><tbody>
    ${l.map(r => `<tr class="${r.aktif ? '' : 'ak-off'}"><td class="ak-nm"><b>${esc(r.nama)}</b><span>${esc(r.jabatan || '-')}</span></td>
    <td class="ak-ac" data-l="Akun login"><b>${esc(r.username)}</b><span>PIN ${lihat ? '<b style="display:inline;color:var(--ink)">' + esc(r.pin) + '</b>' : '••••••'}</span></td>
    <td data-l="Peran menu"><select data-peran="${r.id}" class="noprint">${opsiPeran(r.peran === 'admin' ? [...PERAN, 'admin'] : PERAN, r.peran)}</select><span class="print-only">${esc(PERAN_LABEL[r.peran] || r.peran)}</span></td>
    <td data-l="Peran tambahan"><span class="noprint">${(r.peran_tambahan || []).filter(x => x !== r.peran).map(x => `<label class="ak-chip on" title="Klik untuk mencabut"><input type="checkbox" data-tam="${r.id}" data-role="${x}" checked><span>${PERAN_LABEL[x] || x} ×</span></label>`).join('')}${PERAN.filter(x => x !== 'staf' && x !== r.peran && !(r.peran_tambahan || []).includes(x)).length ? `<select class="ak-add1" data-tamadd="${r.id}" aria-label="Tambah peran untuk ${esc(r.nama)}"><option value="">+ Tambah</option>${PERAN.filter(x => x !== 'staf' && x !== r.peran && !(r.peran_tambahan || []).includes(x)).map(x => `<option value="${x}">${PERAN_LABEL[x]}</option>`).join('')}</select>` : ''}</span><span class="print-only">${esc((r.peran_tambahan || []).map(x => PERAN_LABEL[x] || x).join(', ') || '-')}</span></td>
    <td class="ak-keep" data-l="Aktif"><label class="ak-sw noprint" title="${r.aktif ? 'Akun aktif' : 'Akun nonaktif'}"><input type="checkbox" data-aktif="${r.id}" ${r.aktif ? 'checked' : ''}><i></i></label><span class="print-only">${r.aktif ? 'ya' : 'tidak'}</span></td>
    <td class="noprint ak-keep" data-l="Aksi"><select data-aksi="${r.id}" aria-label="Aksi untuk ${esc(r.nama)}"><option value="">Aksi…</option><option value="nm">Ubah nama</option><option value="jab">Ubah jabatan</option><option value="pin">Reset PIN</option></select></td></tr>`).join('')}</tbody></table></div>` : '<p class="mut">Tidak ada akun yang cocok.</p>';
  };
  $('#view').innerHTML = `<h2>Akun guru & staf</h2>
  <p class="mut">Username dan PIN dibuat otomatis. Akun login aktif saat orangnya pertama kali masuk. Peran menentukan menu yang tampil di akunnya.</p>
  <div class="ak-add noprint"><div class="grid"><div><label for="an">Nama</label><input id="an" placeholder="Nama lengkap + gelar"></div><div><label for="aj">Jabatan</label><input id="aj" placeholder="Mis. Wali Kelas 4B"></div>
  <div><label for="ak">Kelompok</label><select id="ak"><option value="guru">Guru</option><option value="staf">Staf</option><option value="pimpinan">Pimpinan</option></select></div>
  <div><label for="ar">Peran menu</label><select id="ar"><option value="">Otomatis dari jabatan</option>${opsiPeran(PERAN, '')}</select></div>
  <div><button class="p" id="aAdd" style="width:100%">Tambah akun</button></div></div></div>
  <div id="msg" class="msg"></div>
  <div class="ak-bar noprint"><input class="cari" id="aq" type="search" placeholder="Cari nama, jabatan, username..." aria-label="Cari akun">
  <select id="af" aria-label="Filter peran"><option value="">Semua peran</option>${opsiPeran(PERAN, '')}</select>
  <span class="sp"></span><label class="ak-sw2"><span class="ak-sw"><input type="checkbox" id="aLihat"><i></i></span> Tampilkan PIN</label><button onclick="print()">Cetak</button><button id="aCsv">CSV</button></div>
  <div class="ak-cnt noprint" id="ac"></div><div id="al"></div>`;
  gambar();
  $('#aq').oninput = gambar;
  $('#aAdd').onclick = async () => {
    if (!$('#an').value.trim()) return msg('Isi nama.', true);
    const { error } = await sb.from('guru_staf').insert({ nama: $('#an').value.trim(), jabatan: $('#aj').value.trim() || null, kelompok: $('#ak').value, peran: $('#ar').value || null });
    if (error) return msg(error.message.includes('duplicate') ? 'Nama itu sudah ada.' : error.message, true);
    MODUL.akun();
  };
  $('#aCsv').onclick = () => csv('akun-guru-staf.csv', [['Nama', 'Jabatan', 'Peran', 'Peran tambahan', 'Username', 'PIN', 'Aktif'], ...rows.map(r => [r.nama, r.jabatan, r.peran, (r.peran_tambahan || []).join(' '), r.username, r.pin, r.aktif ? 'ya' : 'tidak'])]);
  const aksi = async (r, a) => {
    if (a === 'nm') { const n = prompt('Nama baru (boleh dengan gelar):', r.nama); if (n && n.trim() && n.trim() !== r.nama) { const { error } = await sb.from('guru_staf').update({ nama: n.trim() }).eq('id', r.id); if (error) return msg(error.message.includes('duplicate') ? 'Nama itu sudah ada.' : error.message, true); MODUL.akun(); } }
    if (a === 'jab') { const j = prompt('Jabatan baru untuk ' + r.nama + ':', r.jabatan || ''); if (j !== null) { await run(sb.from('guru_staf').update({ jabatan: j.trim() || null }).eq('id', r.id)); MODUL.akun(); } }
    if (a === 'pin' && confirm('Buat PIN baru untuk ' + r.nama + '? PIN lama tidak berlaku lagi.')) {
      const hasil = await run(sb.from('guru_staf').update({ pin: null }).eq('id', r.id).select('pin').single());
      msg('PIN baru ' + r.nama + ': ' + hasil.pin); r.pin = hasil.pin; gambar();
    }
  };
  $('#view').onchange = async e => {
    const d = e.target.dataset;
    if (e.target.id === 'aLihat') { lihat = e.target.checked; gambar(); }
    if (e.target.id === 'af') gambar();
    if (d.aksi) { const v = e.target.value; e.target.value = ''; if (v) await aksi(rows.find(r => r.id === d.aksi), v); }
    if (d.peran) { await run(sb.from('guru_staf').update({ peran: e.target.value }).eq('id', d.peran)); rows.find(r => r.id === d.peran).peran = e.target.value; gambar(); msg('Peran diperbarui. Berlaku saat orangnya membuka ulang halaman ini.'); }
    if (d.tam) {
      const r = rows.find(x => x.id === d.tam), set = new Set(r.peran_tambahan || []); e.target.checked ? set.add(d.role) : set.delete(d.role);
      await run(sb.from('guru_staf').update({ peran_tambahan: [...set] }).eq('id', r.id)); r.peran_tambahan = [...set];
      gambar(); msg('Peran tambahan ' + r.nama + ' diperbarui. Menunya muncul saat orangnya membuka ulang halaman ini.');
    }
    if (d.tamadd && e.target.value) {
      const r = rows.find(x => x.id === d.tamadd), set = new Set(r.peran_tambahan || []); set.add(e.target.value);
      await run(sb.from('guru_staf').update({ peran_tambahan: [...set] }).eq('id', r.id)); r.peran_tambahan = [...set];
      gambar(); msg('Peran tambahan ' + r.nama + ' diperbarui. Menunya muncul saat orangnya membuka ulang halaman ini.');
    }
    if (d.aktif) {
      await run(sb.from('guru_staf').update({ aktif: e.target.checked }).eq('id', d.aktif)); rows.find(r => r.id === d.aktif).aktif = e.target.checked;
      e.target.closest('tr').classList.toggle('ak-off', !e.target.checked);
      msg(e.target.checked ? 'Akun diaktifkan.' : 'Akun dinonaktifkan: tidak tampil di halaman Guru & Staff dan tidak bisa login baru.');
    }
  };
};

/* Data murid: operator dapat melihat, mengubah, menambah, menonaktifkan, dan menempel banyak murid sekaligus dari Excel.
   Perubahan disimpan sebagai lapisan di tabel murid_profil (supabase-kegiatan-tingkat.sql); daftar_tamu_gabungan tidak diubah.
   Guru menerima perubahan lewat sinkron murid otomatis di Administrasi Kelas: baris murid yang sama (guest_id) diperbarui di tempat,
   sehingga presensi, nilai, dan kode akses murid tidak hilang. Murid yang dinonaktifkan hanya disembunyikan, datanya tetap tersimpan. */
const kosongNull = v => { v = String(v ?? '').trim(); return v === '' ? null : v; };
const idBaru = () => 'OP-' + Array.from(crypto.getRandomValues(new Uint8Array(6)), b => (b % 36).toString(36)).join('').toUpperCase();
MODUL.data = async function () {
  $('#view').innerHTML = '<p>Memuat data murid...</p>';
  _siswa = null; _profil = null;
  let g, prof;
  try { [g, prof] = await Promise.all([dataSiswa(), semua(() => sb.from('murid_profil').select('*').order('guest_id'))]); }
  catch (e) { $('#view').innerHTML = `<p class="msg err">Data murid tidak bisa dibaca: ${esc((e && e.message) || e)}</p><p class="mut">Pastikan supabase-kartu.sql dan supabase-kegiatan-tingkat.sql sudah dijalankan.</p>`; return; }
  if (prof[0] && !('nonaktif' in prof[0])) { $('#view').innerHTML = '<p class="msg err">Kolom baru belum ada di tabel murid_profil. Jalankan supabase-kegiatan-tingkat.sql di Supabase SQL Editor, lalu muat ulang halaman ini.</p>'; return; }
  const pm = new Map(prof.map(p => [String(p.guest_id), p]));
  const aktif = g.map(x => ({ id: String(x.guest_id), nama: String(x.guest_name).trim(), kelas: String(x.instansi_kelas || '').trim(), jenis: x.jenis_undangan, p: pm.get(String(x.guest_id)) || {}, aktif: true }));
  const idAktif = new Set(aktif.map(x => x.id));
  const mati = prof.filter(p => p.nonaktif && !idAktif.has(String(p.guest_id))).map(p => ({ id: String(p.guest_id), nama: p.nama || p.nama_ref || '(tanpa nama)', kelas: p.kelas || '', jenis: p.jenis, p, aktif: false }));
  const semuaM = [...aktif, ...mati].sort((a, b) => urut(a.kelas, b.kelas) || urut(a.nama, b.nama));
  const kls = kelasDari(g), jenisList = [...new Set(g.map(x => x.jenis_undangan).filter(Boolean))];
  const jenisUtama = Object.entries(g.reduce((m, x) => (m[x.jenis_undangan] = (m[x.jenis_undangan] || 0) + 1, m), {})).sort((a, b) => b[1] - a[1]).map(e => e[0])[0] || '';
  const hitung = kls.map(k => `${esc(k)}: ${aktif.filter(x => x.kelas === k).length}`).join(' · ');
  let edit = null;

  const formHtml = () => {
    const m = edit && edit.id ? semuaM.find(x => x.id === edit.id) : null, p = m ? m.p : {};
    return `<div class="card" style="margin:12px 0;padding:14px;border:1px solid var(--line);border-radius:12px"><h3 style="margin:0 0 8px">${m ? 'Ubah data murid' : 'Tambah murid baru'}</h3>
    <div class="grid"><div><label for="mn">Nama murid</label><input id="mn" value="${esc(m ? m.nama : '')}" maxlength="100"></div>
    <div><label for="mk">Kelas</label><input id="mk" list="mkl" value="${esc(m ? m.kelas : '')}" placeholder="mis. 3A"><datalist id="mkl">${kls.map(k => `<option value="${esc(k)}">`).join('')}</datalist></div>
    ${m ? '' : `<div><label for="mj">Jenis data</label><select id="mj">${opsi(jenisList, jenisUtama)}</select></div>`}
    <div><label for="mnis">NIS</label><input id="mnis" value="${esc(p.nis || '')}"></div><div><label for="mnisn">NISN</label><input id="mnisn" value="${esc(p.nisn || '')}"></div>
    <div><label for="mtl">Tempat lahir</label><input id="mtl" value="${esc(p.tempat_lahir || '')}"></div><div><label for="mtg">Tanggal lahir</label><input id="mtg" type="date" value="${esc(p.tanggal_lahir || '')}"></div></div>
    <label for="mal">Alamat</label><input id="mal" value="${esc(p.alamat || '')}">
    <p><button class="p" id="mSimpan">Simpan</button> <button id="mBatal">Batal</button></p></div>`;
  };
  const tabel = () => {
    const k = $('#dk').value, q = $('#dq').value.trim().toLowerCase(), st = $('#ds').value;
    const l = semuaM.filter(x => (!k || x.kelas === k) && (!q || x.nama.toLowerCase().includes(q)) && (st === 'semua' || (st === 'nonaktif') === !x.aktif));
    $('#dl').innerHTML = `<p class="mut">${l.length} murid</p><table><tr><th>No</th><th>Nama</th><th>Kelas</th><th>NIS</th><th>NISN</th><th>Status</th><th class="noprint"></th></tr>${l.map((x, i) => `<tr${x.aktif ? '' : ' style="opacity:.6"'}><td>${i + 1}</td><td>${esc(x.nama)}${x.p.sumber === 'operator' ? ' <span class="mut">(input operator)</span>' : ''}</td><td>${esc(x.kelas)}</td><td>${esc(x.p.nis || '')}</td><td>${esc(x.p.nisn || '')}</td><td>${x.aktif ? 'Aktif' : 'Nonaktif'}</td>
      <td class="noprint"><button data-ed="${esc(x.id)}">Ubah</button> <button data-tg="${esc(x.id)}">${x.aktif ? 'Nonaktifkan' : 'Aktifkan'}</button></td></tr>`).join('') || '<tr><td colspan="7" class="mut">Tidak ada data.</td></tr>'}</table>`;
    return l;
  };
  const selesai = async (t) => { await MODUL.data(); msg(t + ' Guru menerimanya otomatis saat membuka Administrasi Kelas, atau lewat tombol "Sinkronkan Murid". Nilai & presensi yang sudah ada tidak berubah.'); };

  $('#view').innerHTML = `<h2>Data murid (${aktif.length} aktif${mati.length ? `, ${mati.length} nonaktif` : ''})</h2><p class="mut">${hitung}</p>
  <p class="noprint"><select id="dk" style="max-width:150px"><option value="">Semua kelas</option>${kls.map(k => `<option>${esc(k)}</option>`).join('')}</select> <select id="ds" style="max-width:150px"><option value="aktif">Aktif</option><option value="nonaktif">Nonaktif</option><option value="semua">Semua</option></select>
  <input id="dq" type="search" placeholder="Cari nama" style="max-width:220px"> <button class="p" id="dTambah">+ Tambah murid</button> <button id="dTempel">Tempel dari Excel</button> <button id="dCsv">Unduh CSV</button> <button onclick="print()">Cetak</button></p>
  <div id="msg" class="msg"></div><div id="dform"></div>
  <div id="dtempel" class="noprint" hidden><label for="dta">Tempel baris dari Excel: Nama, Kelas, NIS, NISN (dipisah tab atau koma; kolom NIS dan NISN boleh kosong)</label><textarea id="dta" rows="6" placeholder="Budi Santoso&#9;3A&#9;1234&#9;0012345678"></textarea><p><button class="p" id="dImpor">Impor murid</button> <span id="dprev" class="mut"></span></p></div>
  <div id="dl"></div>`;
  $('#dk').onchange = $('#ds').onchange = tabel; $('#dq').oninput = tabel; tabel();
  $('#dCsv').onclick = () => csv('data-murid.csv', [['Nama', 'Kelas', 'ID', 'NIS', 'NISN', 'Tempat lahir', 'Tanggal lahir', 'Alamat', 'Status'], ...tabel().map(x => [x.nama, x.kelas, x.id, x.p.nis, x.p.nisn, x.p.tempat_lahir, x.p.tanggal_lahir, x.p.alamat, x.aktif ? 'aktif' : 'nonaktif'])]);
  const bukaForm = id => { edit = { id }; $('#dform').innerHTML = formHtml(); $('#mn').focus(); $('#mBatal').onclick = () => { edit = null; $('#dform').innerHTML = ''; };
    $('#mSimpan').onclick = async () => {
      const nama = $('#mn').value.trim().replace(/\s+/g, ' '), kelas = $('#mk').value.trim();
      if (!nama || !kelas) return msg('Nama dan kelas wajib diisi.', true);
      const profil = { nis: kosongNull($('#mnis').value), nisn: kosongNull($('#mnisn').value), tempat_lahir: kosongNull($('#mtl').value), tanggal_lahir: kosongNull($('#mtg').value), alamat: kosongNull($('#mal').value) };
      $('#mSimpan').disabled = true;
      try {
        if (id) {
          const m = semuaM.find(x => x.id === id), row = { guest_id: id, ...profil };
          if (nama !== m.nama) row.nama = nama;          // hanya yang berubah yang disimpan sebagai penimpa
          if (kelas !== m.kelas) row.kelas = kelas;
          if (!m.p.guest_id) row.nama_ref = m.nama;
          await run(sb.from('murid_profil').upsert(row, { onConflict: 'guest_id' }));
          await selesai('Data murid tersimpan.');
        } else {
          if (semuaM.some(x => x.aktif && x.nama.toLowerCase() === nama.toLowerCase() && x.kelas === kelas)) { $('#mSimpan').disabled = false; return msg('Murid dengan nama dan kelas yang sama sudah ada.', true); }
          await run(sb.from('murid_profil').insert({ guest_id: idBaru(), nama_ref: nama, nama, kelas, jenis: $('#mj').value || jenisUtama, sumber: 'operator', ...profil }));
          await selesai('Murid baru ditambahkan.');
        }
      } catch (e) { $('#mSimpan').disabled = false; }
    }; };
  $('#dTambah').onclick = () => bukaForm(null);
  $('#dTempel').onclick = () => { const b = $('#dtempel'); b.hidden = !b.hidden; };
  const baca = () => $('#dta').value.split(/\r?\n/).map(r => r.split(/\t|,|;/).map(c => c.trim())).filter(r => r[0] && r[1]).map(r => ({ nama: r[0].replace(/\s+/g, ' '), kelas: r[1], nis: kosongNull(r[2]), nisn: kosongNull(r[3]) }));
  $('#dta').oninput = () => { const b = baca(); $('#dprev').textContent = b.length ? `${b.length} baris terbaca.` : ''; };
  $('#dImpor').onclick = async () => {
    const baris = baca(); if (!baris.length) return msg('Tidak ada baris yang terbaca. Pastikan kolom pertama nama dan kolom kedua kelas.', true);
    const ada = new Set(semuaM.filter(x => x.aktif).map(x => x.nama.toLowerCase() + '|' + x.kelas)), baru = [];
    baris.forEach(r => { const k = r.nama.toLowerCase() + '|' + r.kelas; if (!ada.has(k)) { ada.add(k); baru.push({ guest_id: idBaru(), nama_ref: r.nama, nama: r.nama, kelas: r.kelas, jenis: jenisUtama, sumber: 'operator', nis: r.nis, nisn: r.nisn }); } });
    if (!baru.length) return msg('Semua baris sudah ada di data murid.', true);
    if (!confirm(`Tambahkan ${baru.length} murid baru${baris.length - baru.length ? ` (${baris.length - baru.length} baris dilewati karena sudah ada)` : ''}?`)) return;
    $('#dImpor').disabled = true;
    try { for (let i = 0; i < baru.length; i += 200) await run(sb.from('murid_profil').insert(baru.slice(i, i + 200))); await selesai(`${baru.length} murid ditambahkan.`); }
    catch (e) { $('#dImpor').disabled = false; }
  };
  $('#dl').onclick = async e => {
    const d = e.target.dataset;
    if (d.ed) return bukaForm(d.ed);
    if (d.tg) {
      const m = semuaM.find(x => x.id === d.tg); if (!m) return;
      if (m.aktif && !confirm(`Nonaktifkan ${m.nama} (${m.kelas})?\nMurid disembunyikan dari daftar guru. Presensi dan nilainya tetap tersimpan dan kembali bila diaktifkan lagi.`)) return;
      const row = { guest_id: m.id, nonaktif: m.aktif }; if (!m.p.guest_id) row.nama_ref = m.nama;
      await run(sb.from('murid_profil').upsert(row, { onConflict: 'guest_id' }));
      await selesai(m.aktif ? 'Murid dinonaktifkan.' : 'Murid diaktifkan kembali.');
    }
  };
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
  const n = S.dnama || (S.prof && S.prof.nama) || '';
  $('#view').innerHTML = `<h2>Profil saya</h2>
  <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:14px"><div class="av" style="width:84px;height:84px;font-size:32px">${S.fotoUrl ? `<img src="${esc(S.fotoUrl)}" alt="">` : esc((n.trim()[0] || 'S').toUpperCase())}</div>
  <div><label for="pf">Ganti foto profil</label><input id="pf" type="file" accept="image/*"><div class="mut">Foto ini langsung tampil di halaman Guru & Staff.</div></div></div>
  <div class="grid"><div><label for="pn">Nama ${S.dnama ? '(diatur operator sekolah)' : '(tampil di sapaan)'}</label><input id="pn" value="${esc(n)}" ${S.dnama ? 'readonly' : ''}></div>
  <div><label>Jabatan</label><input value="${esc(S.jabatan)}" disabled></div><div><label>Username</label><input value="${esc(S.username)}" disabled></div></div>
  <p><button class="p" id="svP">Simpan profil</button></p><div id="msg" class="msg"></div>
  <p class="mut">Nama, jabatan, dan PIN diatur oleh operator sekolah. Foto hanya bisa diganti olehmu di sini. Nama, jabatan, dan foto tampil di halaman Guru & Staff.</p>`;
  $('#svP').onclick = async () => {
    const u = (await sb.auth.getUser()).data.user.id;
    await run(sb.from('kelas_profil').upsert({ guru_id: u, nama: S.dnama || $('#pn').value.trim() }, { onConflict: 'guru_id' }));
    await loadProfil(); msg('Profil tersimpan.');
  };
  $('#view').onchange = async e => {
    if (e.target.id !== 'pf' || !e.target.files[0]) return;
    try { await unggahFotoGuru(e.target.files[0]); } catch (err) { return msg('Foto gagal diunggah: ' + (err.message || err) + '. Pastikan supabase-foto-guru.sql sudah dijalankan.', true); }
    await loadProfil(); MODUL.profilStaf(); msg('Foto diganti dan langsung tampil di halaman Guru & Staff.');
  };
};
