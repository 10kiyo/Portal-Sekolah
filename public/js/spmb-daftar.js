/* Formulir pendaftaran SPMB online. Satu skrip untuk dua halaman:
   spmb-daftar-dalam.html (murid dari TK At-Taqwa) dan spmb-daftar-luar.html (murid dari TK luar At-Taqwa); jalur dibaca dari <body data-jalur>.
   Syarat, jadwal, dan biaya diambil dari data-spmb.js (SPMB, KONTAK, BERKAS); periode dan batas usia dari GET /api/spmb-daftar.
   Pengiriman: multipart/form-data ke POST /api/spmb-daftar (berkas foto diperkecil dulu di browser). Dimuat setelah umum.js ($, esc). */
const JID = (document.body && document.body.dataset && document.body.dataset.jalur) === 'luar' ? 'luar' : 'dalam';
const J = SPMB.jalur.find(j => j.id === JID) || SPMB.jalur[0];
const LAIN = SPMB.jalur.find(j => j.id !== JID) || J;
const LUAR = JID === 'luar';
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const STATUS_PILL = {
  baru: ['warn', 'Menunggu verifikasi panitia'], perbaikan: ['bad', 'Perlu diperbaiki'], terverifikasi: ['ok', 'Berkas terverifikasi'],
  diterima: ['ok', 'Diterima'], tidak_diterima: ['bad', 'Belum dapat diterima'], mundur: ['', 'Mengundurkan diri']
};
const MAKS_BERKAS = 2.5 * 1024 * 1024;
let CFG = null;

const tglPanjang = d => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); return m ? `${+m[3]} ${BULAN[+m[2] - 1]} ${m[1]}` : ''; };
const kontakHtml = () => `<p class="mut" style="margin:10px 0 0">Ada kendala? Hubungi panitia SPMB: ${KONTAK.map(k => `<a href="https://wa.me/${esc(k.wa)}" target="_blank" rel="noopener">${esc(k.nama)}</a>`).join(', ')}.</p>`;

/* ---------- berkas: foto diperkecil di browser agar unggahan dari HP cepat dan hemat kuota ---------- */
async function kecilkan(file, label) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error(`${label}: berkas bukan foto yang bisa dibaca. Pakai JPG atau PNG.`)); i.src = url; });
    const sk = Math.min(1, 1600 / Math.max(img.width, img.height)), cv = document.createElement('canvas');
    cv.width = Math.round(img.width * sk); cv.height = Math.round(img.height * sk);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    const ke = q => new Promise(r => cv.toBlob(r, 'image/jpeg', q));
    let q = .82, blob = await ke(q);
    while (blob && blob.size > MAKS_BERKAS && q > .4) { q -= .12; blob = await ke(q); }
    if (!blob || blob.size > MAKS_BERKAS) throw new Error(`${label}: foto terlalu besar. Pilih foto lain.`);
    return blob;
  } finally { URL.revokeObjectURL(url); }
}
async function siapkan(file, label, bolehPdf) {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    if (!bolehPdf) throw new Error(`${label}: gunakan foto JPG atau PNG, bukan PDF.`);
    if (file.size > MAKS_BERKAS) throw new Error(`${label}: ukuran PDF maksimal 2,5 MB.`);
    return file;
  }
  return kecilkan(file, label);
}

/* ---------- Tahap 1 (khusus TK Luar): bukti pembayaran formulir ---------- */
const BAYAR_KEY = 'spmb_bayar_luar', BAYAR_TTL = 7 * 24 * 3600 * 1000;
let BAYAR = null;   // { token, nama, kontak, t }
function bayarMuat() {
  try {
    const o = JSON.parse(localStorage.getItem(BAYAR_KEY) || 'null');
    if (o && o.token && Date.now() - o.t < BAYAR_TTL) return o;
    localStorage.removeItem(BAYAR_KEY);
  } catch (e) {}
  return null;
}
const bayarSimpan = o => { try { localStorage.setItem(BAYAR_KEY, JSON.stringify(o)); } catch (e) {} };
const bayarHapus = () => { try { localStorage.removeItem(BAYAR_KEY); } catch (e) {} BAYAR = null; };

function bayarHtml() {
  const R = SPMB.rekeningFormulir || {};
  return `<div class="card"><h2 style="font-size:18px">Langkah 1 dari 2 · Pembayaran formulir</h2>
  <p class="mut" style="margin:4px 0 12px">Biaya formulir <b>Rp 375.000</b>. Unggah bukti transfer untuk membuka formulir biodata.</p>
  ${R.no ? `<div class="box">Transfer ke ${esc(R.bank)} a.n. ${esc(R.an)}, no. rek. <b>${esc(R.no)}</b>. Sertakan nama calon murid pada berita transfer.</div>`
         : `<div class="box">Cara pembayaran formulir: tanyakan ke panitia SPMB.</div>`}
  <form id="fb" novalidate>
    <div class="hp" aria-hidden="true"><label>Jangan diisi<input name="website" tabindex="-1" autocomplete="off"></label></div>
    ${inp('nama', 'Nama lengkap calon murid', { w: 1, attr: 'autocomplete="off"' })}
    ${inp('kontak', 'Nomor WhatsApp yang bisa dihubungi', { w: 1, max: 40, attr: 'inputmode="tel" autocomplete="tel"' })}
    ${berkasInp('bukti', 'Bukti transfer', { w: 1, pdf: 1, hint: 'Foto atau PDF, maksimal 2,5 MB. Pastikan nominal dan tanggal terbaca.' })}
    <div><button type="submit" id="lanjut" disabled>Unggah dan lanjutkan</button><div id="errb" class="err" role="alert"></div></div>
  </form></div>`;
}

function bindBayar() {
  const f = $('#fb'); if (!f) return;
  const err = $('#errb'), btn = $('#lanjut');
  const cek = () => { btn.disabled = !(f.elements.nama.value.trim() && f.elements.kontak.value.trim() && f.elements.bukti.files.length); };
  f.addEventListener('input', cek); f.addEventListener('change', cek); cek();
  f.onsubmit = async e => {
    e.preventDefault(); err.textContent = '';
    const nama = f.elements.nama.value.trim(), kontak = f.elements.kontak.value.trim(), hp = kontak.replace(/\D/g, '');
    if (hp.length < 9 || hp.length > 15) { err.textContent = 'Isi nomor WhatsApp dengan benar.'; f.elements.kontak.focus(); return; }
    btn.disabled = true; btn.textContent = 'Mengunggah…';
    try {
      const berkas = await siapkan(f.elements.bukti.files[0], 'Bukti transfer', true);
      const fd = new FormData();
      fd.set('website', f.elements.website.value); fd.set('jalur', JID); fd.set('nama', nama); fd.set('kontak', kontak);
      fd.append('bukti', berkas, berkas.name || 'bukti.jpg');
      const r = await fetch('/api/spmb-bayar', { method: 'POST', body: fd }), d = await r.json().catch(() => ({}));
      if (!r.ok || !d.token) throw new Error(d.error || 'Gagal mengunggah bukti transfer.');
      BAYAR = { token: d.token, nama, kontak, t: Date.now() }; bayarSimpan(BAYAR);
      tampil(); window.scrollTo(0, 0);
    } catch (e2) {
      err.textContent = e2 instanceof TypeError ? 'Tidak bisa terhubung. Periksa koneksi internet lalu coba lagi.' : (e2.message || 'Gagal mengunggah.');
      btn.textContent = 'Unggah dan lanjutkan'; cek();
    }
  };
}

/* ---------- tampilan ---------- */
function ringkasan() {
  const mk = tglPanjang(CFG.tgl_lahir_maks);
  return `<div class="card"><h2>SPMB ${esc(SPMB.tahunAjaran)} · ${esc(J.nama)}</h2>
  <p class="mut" style="margin:4px 0 0">${LUAR ? 'Untuk calon murid kelas I yang berasal dari TK/RA di luar At-Taqwa.' : 'Untuk calon murid kelas I yang berasal dari TK/KB Islam At-Taqwa.'}</p>
  <p class="alih">${LUAR ? 'Calon murid berasal dari TK/KB Islam At-Taqwa?' : 'Calon murid berasal dari TK di luar At-Taqwa?'} <a href="${esc(LAIN.daftarUrl)}">Gunakan formulir ${esc(LAIN.nama)}</a>.</p>
  <div class="sum">${J.ringkas.map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>
  <h3>Syarat dan ketentuan</h3>
  <ul class="pts">
    <li>Usia calon murid minimal 5 tahun 10 bulan per Juli 2027 (lahir paling lambat ${esc(mk)}).</li>
    ${J.tahapan[0].ringkas.slice(0, 2).map(x => `<li>${esc(x)}</li>`).join('')}
    <li>${LUAR ? 'Langkah 1: unggah bukti transfer biaya formulir. Langkah 2: isi biodata dan unggah foto calon murid, akte kelahiran, dan Kartu Keluarga' : 'Unggah di formulir ini: foto calon murid, akte kelahiran, dan Kartu Keluarga'} (foto atau PDF, maksimal 2,5 MB per berkas).</li>
  </ul>
  <details class="det"><summary>Berkas yang dibawa saat daftar ulang</summary><div class="mut" style="margin-top:6px">${esc(BERKAS.label)}</div><ul class="pts">${BERKAS.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>
  <details class="det"><summary>Jadwal SPMB</summary><ul class="pts">${J.jadwal.map(x => `<li><b>${esc(x.tanggal)}</b> — ${esc(x.judul)}</li>`).join('')}</ul></details>
  ${J.panduanUrl ? `<p class="mut" style="margin:10px 0 0"><a href="${esc(J.panduanUrl)}" target="_blank" rel="noopener">Unduh buku panduan (PDF)</a></p>` : ''}
  </div>`;
}

const WAJIB = ' <b class="req" aria-hidden="true">*</b>';
// Satu kolom isian. o: w = wajib, max = panjang maksimal, tipe = type input, attr = atribut tambahan, hint = keterangan di bawah kolom.
const inp = (nama, label, o = {}) => `<div><label for="f_${nama}">${label}${o.w ? WAJIB : ''}</label><input id="f_${nama}" name="${nama}" maxlength="${o.max || 80}"${o.w ? ' required' : ''}${o.tipe ? ` type="${o.tipe}"` : ''}${o.attr ? ' ' + o.attr : ''}>${o.hint ? `<div class="hint">${o.hint}</div>` : ''}</div>`;
const berkasInp = (nama, label, o) => `<div><label for="f_${nama}">${label}${o.w ? WAJIB : ''}</label><input id="f_${nama}" name="${nama}" type="file" accept="${o.pdf ? 'image/*,application/pdf' : 'image/*'}"${o.w ? ' required' : ''}><div class="hint">${o.hint}</div></div>`;

function formHtml() {
  return `<div class="card"><h2 style="font-size:18px">${LUAR ? 'Langkah 2 dari 2 · ' : ''}Formulir pendaftaran</h2>
  ${LUAR && BAYAR ? `<div class="box">Bukti transfer diterima (${esc(BAYAR.nama)}) dan akan diverifikasi panitia. <a href="#" id="ulangBayar">Unggah ulang bukti</a></div>` : ''}
  <p class="mut" style="margin:4px 0 12px">Kolom bertanda <span class="req">*</span> wajib diisi.</p>
  <form id="f" novalidate>
    <div class="hp" aria-hidden="true"><label>Jangan diisi<input name="website" tabindex="-1" autocomplete="off"></label></div>

    <fieldset><legend>Data calon murid</legend>
      ${inp('nama', 'Nama lengkap (sesuai akte kelahiran)', { w: 1, attr: 'autocomplete="off"' })}
      <div class="g2">${inp('nama_panggilan', 'Nama panggilan', { max: 30 })}
        <div><label for="f_jenis_kelamin">Jenis kelamin${WAJIB}</label><select id="f_jenis_kelamin" name="jenis_kelamin" required><option value="">Pilih…</option><option value="L">Laki-laki</option><option value="P">Perempuan</option></select></div></div>
      <div class="g2">${inp('tempat_lahir', 'Tempat lahir', { w: 1, max: 60 })}
        ${inp('tanggal_lahir', 'Tanggal lahir', { w: 1, tipe: 'date', attr: `max="${esc(CFG.tgl_lahir_maks)}"`, hint: `Lahir paling lambat ${esc(tglPanjang(CFG.tgl_lahir_maks))}.` })}</div>
      ${inp('nik', 'NIK calon murid', { w: 1, max: 16, attr: 'inputmode="numeric" autocomplete="off"', hint: '16 angka, tertera di Kartu Keluarga.' })}
      <div class="g2">${inp('anak_ke', 'Anak ke-', { tipe: 'number', attr: 'min="1" max="20" inputmode="numeric"' })}
        ${inp('jumlah_saudara', 'Jumlah saudara kandung', { tipe: 'number', attr: 'min="0" max="20" inputmode="numeric"' })}</div>
      <div><label for="f_alamat">Alamat tempat tinggal${WAJIB}</label><textarea id="f_alamat" name="alamat" maxlength="200" rows="2" required placeholder="Jalan, nomor, RT/RW"></textarea></div>
      <div class="g3">${inp('kelurahan', 'Kelurahan', { w: 1, max: 60 })}${inp('kecamatan', 'Kecamatan', { w: 1, max: 60 })}${inp('kota', 'Kota/kabupaten', { w: 1, max: 60 })}</div>
      <div><label for="f_kondisi_khusus">Alergi atau kondisi kesehatan</label><textarea id="f_kondisi_khusus" name="kondisi_khusus" maxlength="300" rows="2" placeholder="Kosongkan jika tidak ada"></textarea></div>
    </fieldset>

    <fieldset><legend>Asal sekolah</legend>
      ${inp('asal_tk', LUAR ? 'Nama TK/RA asal' : 'Nama TK/KB At-Taqwa asal', { w: 1, max: 100, attr: LUAR ? '' : 'placeholder="mis. TK Islam At-Taqwa"' })}
      ${LUAR ? inp('alamat_tk', 'Alamat TK/RA asal', { w: 1, max: 150 }) : ''}
      <div class="hint">Rapor TK B semester 1 yang dilegalisir menyusul, diserahkan saat daftar ulang.</div>
    </fieldset>

    <fieldset><legend>Orang tua / wali</legend>
      <div class="g2">${inp('nama_ayah', 'Nama ayah')}${inp('pekerjaan_ayah', 'Pekerjaan ayah', { max: 60 })}</div>
      <div class="g2">${inp('nama_ibu', 'Nama ibu')}${inp('pekerjaan_ibu', 'Pekerjaan ibu', { max: 60 })}</div>
      <div class="g2">${inp('hp_ayah', 'Nomor HP ayah', { max: 40, attr: 'inputmode="tel"' })}${inp('hp_ibu', 'Nomor HP ibu', { max: 40, attr: 'inputmode="tel"' })}</div>
      <div class="hint">Isi minimal nama ayah atau nama ibu.</div>
      <div class="g2">${inp('kontak', 'Nomor WhatsApp yang bisa dihubungi', { w: 1, max: 40, attr: 'inputmode="tel" autocomplete="tel"', hint: 'Dipakai panitia untuk menghubungi Anda dan untuk cek status.' })}
        ${inp('email', 'Email (opsional)', { tipe: 'email', attr: 'autocomplete="email"' })}</div>
    </fieldset>

    <fieldset><legend>Unggah berkas</legend>
      ${berkasInp('foto', 'Foto calon murid', { w: 1, hint: 'Foto berwarna, wajah terlihat jelas (JPG atau PNG).' })}
      ${berkasInp('akte', 'Akte kelahiran', { w: 1, pdf: 1, hint: 'Foto atau PDF, maksimal 2,5 MB. Pastikan tulisan terbaca.' })}
      ${berkasInp('kk', 'Kartu Keluarga', { w: 1, pdf: 1, hint: 'Foto atau PDF, maksimal 2,5 MB. Pastikan NIK dan nama terbaca.' })}
    </fieldset>

    <label class="chk"><input type="checkbox" name="setuju" required> <span>Saya orang tua/wali calon murid. Data yang saya isi benar dan saya bersedia mengikuti ketentuan SPMB SDS Islam At-Taqwa.</span></label>
    <div><button type="submit" id="kirim">Kirim pendaftaran</button><div id="err" class="err" role="alert"></div></div>
  </form></div>`;
}

function tutupHtml(fs) {
  const f = CFG.jalur[JID];
  const pesan = {
    akan: `Pendaftaran dibuka mulai ${tglPanjang(f.buka)}.`,
    ditutup: `Pendaftaran jalur ini sudah ditutup (periode ${tglPanjang(f.buka)} – ${tglPanjang(f.tutup)}). Gelombang kedua dibuka jika masih ada kuota; hubungi panitia SPMB.`,
    dialihkan: 'Mulai 1 Januari 2027 pendaftar dari TK At-Taqwa mengikuti ketentuan jalur TK Luar.'
  }[fs] || 'Pendaftaran tidak sedang dibuka.';
  return `<div class="card"><span class="pill warn">${esc(pesan)}</span>${fs === 'dialihkan' ? `<p><a href="${esc(LAIN.daftarUrl)}">Buka formulir ${esc(LAIN.nama)}</a></p>` : ''}${kontakHtml()}</div>`;
}

function cekHtml() {
  return `<div class="card"><details id="cekBox"><summary style="cursor:pointer;color:var(--blue);font-weight:700">Sudah mendaftar? Cek status pendaftaran</summary>
  <form id="fc" novalidate style="margin-top:12px">
    <div class="mut">Isi sama persis seperti saat mendaftar.</div>
    <div><label for="cn">Nama lengkap calon murid</label><input id="cn" name="nama" required></div>
    <div class="g2"><div><label for="ct">Tanggal lahir</label><input id="ct" name="tanggal_lahir" type="date" required></div>
      <div><label for="ck">Nomor WhatsApp</label><input id="ck" name="kontak" inputmode="tel" required></div></div>
    <div><button type="submit" class="ghost" id="cekBtn">Cek status</button></div><div id="cekHasil" role="status"></div>
  </form></details></div>`;
}

function sukses(d) {
  bayarHapus();
  $('#isi').innerHTML = ringkasan() + `<div class="card"><h2 class="ok">${d.diperbaiki ? 'Perbaikan pendaftaran terkirim' : 'Pendaftaran terkirim'}</h2>
    ${d.no_daftar ? `<div class="mut" style="margin-top:8px">Nomor pendaftaran</div><div class="nomor">${esc(d.no_daftar)}</div>` : ''}
    <p>Data dan berkas sudah kami terima dan akan diperiksa panitia. Informasi lanjutan disampaikan lewat WhatsApp. Simpan nomor pendaftaran di atas.</p>
    <h3>Langkah berikutnya</h3>
    <ol class="langkah"><li>Lanjutkan pendaftaran di Tata Usaha sekolah: ${esc(J.tahapan[0].ringkas[1] || '')}.</li>
      ${J.jadwal.slice(1, 4).map(x => `<li><b>${esc(x.tanggal)}</b> — ${esc(x.judul)}</li>`).join('')}</ol>
    ${kontakHtml()}</div>` + cekHtml();
  bindCek(); window.scrollTo(0, 0);
}

/* ---------- aksi ---------- */
function bindCek() {
  const f = $('#fc'); if (!f) return;
  f.onsubmit = async e => {
    e.preventDefault(); const b = $('#cekBtn'), out = $('#cekHasil'); out.innerHTML = ''; b.disabled = true;
    try {
      const r = await fetch('/api/spmb-daftar', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cek', nama: f.elements.nama.value, tanggal_lahir: f.elements.tanggal_lahir.value, kontak: f.elements.kontak.value }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal memeriksa status.');
      const s = STATUS_PILL[d.status] || ['', d.status], jalur = SPMB.jalur.find(j => j.id === d.jalur) || J;
      out.innerHTML = `<p><span class="pill ${s[0]}">${esc(s[1])}</span> <span class="mut">No. ${esc(d.no_daftar || '-')} · jalur ${esc(jalur.nama)}</span></p>`
        + (d.catatan ? `<div class="box">${esc(d.catatan)}</div>` : '')
        + (d.status === 'perbaikan' ? `<p class="mut">Kirim ulang pendaftaran lewat <a href="${esc(jalur.daftarUrl)}">formulir ${esc(jalur.nama)}</a> dengan nama dan tanggal lahir yang sama setelah memperbaiki hal di atas.</p>` : '');
    } catch (err) { out.innerHTML = `<div class="err">${esc(err.message)}</div>`; } finally { b.disabled = false; }
  };
}

function bindForm() {
  const f = $('#f'); if (!f) return;
  if (LUAR && BAYAR) { f.elements.nama.value = BAYAR.nama; f.elements.kontak.value = BAYAR.kontak; }
  const u = $('#ulangBayar'); if (u) u.onclick = e => { e.preventDefault(); bayarHapus(); tampil(); };
  f.onsubmit = async e => {
    e.preventDefault(); const err = $('#err'), btn = $('#kirim'); err.textContent = '';
    const gagal = (teks, el) => { err.textContent = teks; if (el) el.focus(); };
    for (const el of f.querySelectorAll('[required]')) {
      if (el.type === 'checkbox' ? !el.checked : el.type === 'file' ? !el.files.length : !String(el.value).trim())
        return gagal(el.type === 'checkbox' ? 'Centang pernyataan orang tua/wali terlebih dahulu.' : 'Lengkapi semua kolom yang wajib diisi (bertanda *).', el);
    }
    const v = k => f.elements[k].value.trim();
    if (v('tanggal_lahir') > CFG.tgl_lahir_maks) return gagal(`Usia calon murid belum memenuhi syarat: lahir paling lambat ${tglPanjang(CFG.tgl_lahir_maks)}.`, f.elements.tanggal_lahir);
    if (!/^\d{16}$/.test(v('nik').replace(/\D/g, ''))) return gagal('NIK calon murid harus 16 angka (lihat di Kartu Keluarga).', f.elements.nik);
    if (!v('nama_ayah') && !v('nama_ibu')) return gagal('Isi nama ayah atau nama ibu.', f.elements.nama_ayah);
    const hp = v('kontak').replace(/\D/g, ''); if (hp.length < 9 || hp.length > 15) return gagal('Isi nomor WhatsApp dengan benar.', f.elements.kontak);

    btn.disabled = true; btn.textContent = 'Mengirim…';
    try {
      const fd = new FormData(f);
      for (const [k, label, pdf] of [['foto', 'Foto calon murid', false], ['akte', 'Akte kelahiran', true], ['kk', 'Kartu Keluarga', true]]) {
        fd.delete(k);
        const el = f.elements[k]; if (!el || !el.files[0]) continue;
        const berkas = await siapkan(el.files[0], label, pdf);
        fd.append(k, berkas, berkas.name || k + '.jpg');
      }
      fd.set('jalur', JID); fd.set('setuju', f.elements.setuju.checked ? 'true' : '');
      if (LUAR) fd.set('token_bayar', BAYAR.token);
      const r = await fetch('/api/spmb-daftar', { method: 'POST', body: fd }), d = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (LUAR && d.kode === 'bayar') { bayarHapus(); tampil(); $('#errb').textContent = d.error || 'Bukti pembayaran tidak valid. Unggah ulang bukti transfer.'; return; }
        throw new Error(d.error || 'Gagal mengirim pendaftaran.');
      }
      sukses(d);
    } catch (e2) {
      err.textContent = e2 instanceof TypeError ? 'Tidak bisa terhubung. Periksa koneksi internet lalu coba lagi.' : (e2.message || 'Gagal mengirim.');
      btn.disabled = false; btn.textContent = 'Kirim pendaftaran';
    }
  };
}

function tampil() {
  const fs = CFG.jalur[JID].fase;
  const isi = fs !== 'dibuka' ? tutupHtml(fs) : (LUAR && !BAYAR ? bayarHtml() : formHtml());
  $('#isi').innerHTML = ringkasan() + isi + cekHtml();
  bindBayar(); bindForm(); bindCek();
}

(async () => {
  $('#judul').textContent = `Pendaftaran SPMB ${SPMB.tahunAjaran} — ${J.nama}`;
  try {
    const r = await fetch('/api/spmb-daftar'), d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Gagal memuat.');
    CFG = d;
  } catch (e) { $('#isi').innerHTML = `<div class="card">${esc(e.message || 'Gagal memuat.')}${kontakHtml()}</div>`; return; }
  if (LUAR) BAYAR = bayarMuat();
  tampil();
})();
