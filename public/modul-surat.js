/* ============================================================
   BUAT SURAT (menu Persuratan): isi formulir -> pratinjau surat berkop -> cetak / simpan PDF.
   Surat yang disimpan otomatis tercatat di Surat keluar + Agenda surat (tabel surat, kolom isi).
   Dimuat SETELAH modul-staf.js (memakai MODUL, $, esc, sb, run, msg, today, opsi, tglID, tglPanjang, BLN).
   Tabel & aturan akses: supabase-surat-generator.sql.
   ============================================================ */
const SURAT_BAWAAN = {
  kop: {
    l1: 'YAYASAN MASJID AT-TAQWA KAMPUS RAWAMANGUN', l2: 'BIDANG PENDIDIKAN', l3: 'SEKOLAH DASAR ISLAM AT-TAQWA',
    alamat: 'Jl. Daksinapati Raya No. 2 Rawamangun Jakarta Timur, 13220\nTelp. (021) 47864568 Fax. (021) 47864568 website : www.sdi-attaqwa.sch.id'
  },
  kodeNomor: 'YMAKR/SD', kota: 'Jakarta',
  salamBuka: 'Assalamualaikum Wr.Wb', salamTutup: 'Wassalamualaikum Wr.Wb',
  pembuka: 'Puji syukur kita panjatkan kehadirat Allah SWT. atas segala rahmat, nikmat, dan karunia-Nya. Shalawat serta salam selalu tercurah kepada Nabi Muhammad SAW. para keluarga, sahabat serta pengikutnya yang setia. Semoga kita selalu diberikan kesehatan, kesuksesan, dan ketaatan dalam menjalankan aktifitas sehari-hari. Amin Yra.',
  penutup: 'Demikian surat ini kami sampaikan, semoga kita selalu dalam rahmat Allah SWT. Atas perhatiannya dan kerjasamanya kami haturkan banyak terima kasih.',
  ttd: { jabatan: 'Kepala Sekolah', nama: 'Nurbaiti, S.Pd', nip: '' },
  tembusan: 'Ketum YMAKR.\nKetua Bidang Pendidikan YMAKR.\nWakil Kepala Sekolah, Wali Kelas, dan para Guru.\nKetua JW/Komite Sekolah.\nSekretariat YMAKR.'
};
const SURAT_JENIS = {
  kegiatan: { label: 'Pemberitahuan kegiatan (butir bernomor)', hal: 'Pemberitahuan Kegiatan Bulan ', kepada: 'Orangtua/Wali Murid Kelas 1 – 6.\nSDS Islam At-Taqwa Rawamangun\ndi Tempat',
    pengantar: 'Berikutnya kami sampaikan untuk kegiatan sekolah di bulan ... sebagai berikut:', butir: [{ teks: '', sub: '' }], rincian: [], bukaTembusan: true },
  undangan: { label: 'Undangan (hari, waktu, tempat)', hal: 'Undangan ', kepada: 'Bapak/Ibu ...\ndi Tempat',
    pengantar: 'Dengan hormat, kami mengundang Bapak/Ibu untuk hadir pada acara ... yang akan dilaksanakan pada:',
    butir: [], rincian: [{ k: 'Hari/Tanggal', v: '' }, { k: 'Waktu', v: '' }, { k: 'Tempat', v: '' }, { k: 'Acara', v: '' }], bukaTembusan: false,
    penutup: 'Demikian undangan ini kami sampaikan. Atas kehadiran dan kerjasamanya kami haturkan banyak terima kasih.' },
  biasa: { label: 'Surat biasa (paragraf bebas)', hal: '', kepada: 'Yth. ...\ndi Tempat',
    pengantar: 'Isi surat ...', butir: [], rincian: [], bukaTembusan: false }
};
const ROMAWI = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

let _sr = null;    // { cfg, rows, D }
const tebalMiring = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>').replace(/\n/g, '<br>');
const baris = s => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);

function nomorSurat(cfg, rows, tgl) {
  const thn = String(tgl || today()).slice(0, 4), m = +String(tgl || today()).slice(5, 7);
  const urut = rows.filter(r => r.jenis === 'keluar' && String(r.tanggal).startsWith(thn)).length + 1;
  return `${String(urut).padStart(3, '0')}/${cfg.kodeNomor}/${ROMAWI[m] || ''}/${thn}`;
}

function suratBaru(jenis) {
  const J = SURAT_JENIS[jenis], c = _sr.cfg, tgl = today();
  return { id: null, jenis, tanggal: tgl, nomor: nomorSurat(c, _sr.rows, tgl), nomorManual: false, kota: c.kota, lampiran: '-',
    hal: J.hal, kepada: J.kepada, salamBuka: true, pembuka: jenis === 'biasa' ? '' : c.pembuka, pengantar: J.pengantar,
    butir: JSON.parse(JSON.stringify(J.butir)), rincian: JSON.parse(JSON.stringify(J.rincian)),
    penutup: J.penutup || c.penutup, salamTutup: true, ttdJabatan: c.ttd.jabatan, ttdNama: c.ttd.nama, ttdNip: c.ttd.nip,
    ttdImg: '', stempelImg: '', tembusanOn: J.bukaTembusan, tembusan: c.tembusan };
}

// HTML surat siap cetak (dipakai pratinjau & cetak). Ukuran A4, margin diatur di @page.
function htmlSurat(D, cfg) {
  const k = cfg.kop, logo = location.origin + '/logo-at-taqwa.png';
  const butir = D.butir.filter(b => (b.teks || '').trim()).map(b => {
    const sub = baris(b.sub);
    return `<li>${tebalMiring(b.teks)}${sub.length ? `<ol type="a">${sub.map(s => `<li>${tebalMiring(s)}</li>`).join('')}</ol>` : ''}</li>`;
  }).join('');
  const rinci = D.rincian.filter(r => (r.k || '').trim() || (r.v || '').trim()).map(r => `<tr><td>${esc(r.k)}</td><td>:</td><td>${tebalMiring(r.v)}</td></tr>`).join('');
  const tem = baris(D.tembusan);
  const tgl = tglPanjang(D.tanggal);
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc((D.nomor || 'Surat').replace(/\//g, '-'))}</title><style>
@page{size:A4;margin:14mm 20mm 16mm}*{box-sizing:border-box}@media screen{body{padding:14mm 20mm 16mm;min-height:297mm}}
body{margin:0;background:#fff;color:#000;font:12pt/1.35 "Times New Roman",Times,serif}
.kop{display:flex;align-items:center;gap:10px;padding-bottom:4px;border-bottom:4px double #222;margin-bottom:12px}
.kop img{width:78px;height:78px;object-fit:contain;flex:none}.kt{flex:1;text-align:center;line-height:1.2}
.k1{font-weight:700;font-size:15pt;color:#7a1f1f;letter-spacing:.2px}.k2,.k3{font-weight:700;font-size:13pt}.k3{color:#1f3d7a}.ka{font-size:9.5pt;margin-top:2px}
.hd{display:flex;justify-content:space-between;gap:10px;margin-bottom:10px}.hd table{border-collapse:collapse}.hd td{padding:0 4px 0 0;vertical-align:top}
p{margin:0 0 8px;text-align:justify}.ind{text-indent:1.1cm}.salam{font-style:italic;font-weight:700;margin:0 0 6px}
ol{margin:2px 0 6px;padding-left:1.1cm;text-align:justify}ol li{margin-bottom:4px;padding-left:4px}ol ol{margin:2px 0 2px;padding-left:.9cm}
.rin{border-collapse:collapse;margin:0 0 8px 1.1cm}.rin td{padding:1px 6px 1px 0;vertical-align:top}.rin td:first-child{white-space:nowrap}
.ttd{margin:14px 0 0 auto;width:7.2cm;text-align:left;page-break-inside:avoid}.ttd .ruang{position:relative;height:2.4cm}
.ttd .ruang img{position:absolute;max-height:2.4cm;max-width:6.4cm}.ttd .ruang .st{left:0;top:0;opacity:.85}.ttd .ruang .tt{left:1.6cm;top:.1cm}
.tem{margin-top:6px;font-size:10pt;page-break-inside:avoid}.tem ol{padding-left:.7cm;margin:0}.tem li{margin:0;padding-left:2px}
</style></head><body>
<div class="kop"><img src="${logo}" alt=""><div class="kt"><div class="k1">${esc(k.l1)}</div><div class="k2">${esc(k.l2)}</div><div class="k3">${esc(k.l3)}</div><div class="ka">${baris(k.alamat).map(esc).join('<br>')}</div></div></div>
<div class="hd"><table><tr><td>Nomor</td><td>:</td><td>${esc(D.nomor)}</td></tr><tr><td>Lamp</td><td>:</td><td>${esc(D.lampiran || '-')}</td></tr><tr><td>Hal</td><td>:</td><td>${esc(D.hal)}</td></tr></table><div>${esc(D.kota)}, ${esc(tgl)}</div></div>
<p>Kepada Yth.<br>${baris(D.kepada).map((x, i) => i === 0 ? `<b>${tebalMiring(x)}</b>` : tebalMiring(x)).join('<br>')}</p>
${D.salamBuka ? `<p class="salam">${esc(cfg.salamBuka)}</p>` : ''}
${(D.pembuka || '').trim() ? `<p class="ind">${tebalMiring(D.pembuka)}</p>` : ''}
${(D.pengantar || '').trim() ? `<p class="ind">${tebalMiring(D.pengantar)}</p>` : ''}
${rinci ? `<table class="rin">${rinci}</table>` : ''}
${butir ? `<ol>${butir}</ol>` : ''}
${(D.penutup || '').trim() ? `<p class="ind">${tebalMiring(D.penutup)}</p>` : ''}
${D.salamTutup ? `<p class="salam">${esc(cfg.salamTutup)}</p>` : ''}
<div class="ttd"><div>${esc(D.ttdJabatan)},</div><div class="ruang">${D.stempelImg ? `<img class="st" src="${D.stempelImg}" alt="">` : ''}${D.ttdImg ? `<img class="tt" src="${D.ttdImg}" alt="">` : ''}</div>
<div><b>${esc(D.ttdNama)}</b></div>${D.ttdNip ? `<div>NIP/NIY. ${esc(D.ttdNip)}</div>` : ''}</div>
${D.tembusanOn && tem.length ? `<div class="tem"><i>Tembusan :</i><ol>${tem.map(t => `<li><i>${esc(t)}</i></li>`).join('')}</ol></div>` : ''}
</body></html>`;
}

// Gambar tanda tangan / stempel: dikecilkan lalu disimpan sebagai PNG (latar transparan tetap).
function gambarKecil(file, max = 420) {
  return new Promise((ok, gagal) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const s = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url); ok(c.toDataURL('image/png'));
    };
    im.onerror = () => { URL.revokeObjectURL(url); gagal(new Error('Gambar tidak bisa dibaca.')); };
    im.src = url;
  });
}

function cssSurat() {
  if (document.getElementById('suratCss')) return;
  const st = document.createElement('style'); st.id = 'suratCss';
  st.textContent = `.sr-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;align-items:start}
  .sr-form h3{color:var(--navy);margin:18px 0 8px;font-size:15px}.sr-form h3:first-child{margin-top:0}.sr-form textarea{width:100%;min-height:64px;resize:vertical;font:inherit}
  .sr-b{background:var(--soft);border-radius:14px;padding:10px 12px;margin:0 0 10px}.sr-b .bar{display:flex;gap:8px;align-items:center;justify-content:space-between;margin-bottom:6px;font-weight:700;color:var(--navy);font-size:13px}
  .sr-b button{padding:4px 10px;font-size:12px}.sr-r{display:grid;grid-template-columns:150px 1fr auto;gap:8px;margin-bottom:6px}
  .sr-pv{position:sticky;top:10px}.sr-box{border:1px solid #d7e2ec;border-radius:14px;background:#e9eef3;padding:10px;overflow:auto;max-height:calc(100vh - 150px)}
  .sr-box iframe{display:block;width:794px;border:0;background:#fff;margin:0 auto;box-shadow:0 2px 10px #0002}.sr-act{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 10px}
  .sr-sw{display:flex;gap:8px;align-items:center;font-weight:600;margin:6px 0}.sr-sw input{width:auto}
  @media(max-width:1000px){.sr-grid{grid-template-columns:1fr}.sr-pv{position:static}.sr-box{max-height:none}.sr-r{grid-template-columns:1fr auto}.sr-r input:first-child{grid-column:1/-1}}
  @media print{.sr-form,.sr-act,.sr-hist{display:none!important}}`;
  document.head.appendChild(st);
}

async function suratMuat() {
  if (_sr) return;
  let cfg = JSON.parse(JSON.stringify(SURAT_BAWAAN)), rows = [];
  const { data } = await sb.from('surat_pengaturan').select('config').eq('id', 'utama').maybeSingle();
  if (data && data.config) { const c = data.config; cfg = { ...cfg, ...c, kop: { ...cfg.kop, ...(c.kop || {}) }, ttd: { ...cfg.ttd, ...(c.ttd || {}) } }; }
  rows = await run(sb.from('surat').select('id,jenis,nomor,tanggal,pihak,perihal,status,isi,created_at').eq('jenis', 'keluar').order('tanggal', { ascending: false }).order('created_at', { ascending: false }).limit(2000));
  _sr = { cfg, rows, D: null };
}

MODUL.buatsurat = async function (jenisBaru) {
  cssSurat();
  await suratMuat();
  const R = _sr, c = R.cfg;
  if (!R.D || jenisBaru) R.D = suratBaru(typeof jenisBaru === 'string' ? jenisBaru : 'kegiatan');
  const D = R.D;
  const draf = R.rows.filter(r => r.isi).slice(0, 30);
  const butirHtml = () => D.butir.map((b, i) => `<div class="sr-b"><div class="bar"><span>Butir ${i + 1}</span><button type="button" data-hapusb="${i}">Hapus</button></div>
    <textarea data-b="${i}" data-s="teks" placeholder="Isi butir. Gunakan **tebal** dan *miring* bila perlu.">${esc(b.teks)}</textarea>
    <label>Sub-butir (a, b, c; satu baris satu butir, boleh kosong)</label><textarea data-b="${i}" data-s="sub">${esc(b.sub)}</textarea></div>`).join('');
  const rinciHtml = () => D.rincian.map((r, i) => `<div class="sr-r"><input data-r="${i}" data-rk="k" value="${esc(r.k)}" placeholder="Label (mis. Waktu)"><input data-r="${i}" data-rk="v" value="${esc(r.v)}" placeholder="Isi"><button type="button" data-hapusr="${i}">×</button></div>`).join('');

  $('#view').innerHTML = `<h2>Buat surat</h2>
  <p class="mut">Isi data di kiri, hasil surat langsung tampil di kanan. Cetak atau simpan sebagai PDF, lalu surat tercatat di Surat keluar dan Agenda surat.</p>
  <div class="sr-act"><label style="margin:0">Jenis surat</label><select id="sjenis" style="width:auto;min-width:260px">${Object.entries(SURAT_JENIS).map(([k, v]) => `<option value="${k}" ${k === D.jenis ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select>
    <button type="button" id="sbaru">Surat baru</button></div>
  <div id="msg" class="msg"></div>
  <div class="sr-grid"><div class="sr-form">
    <h3>1. Identitas surat</h3>
    <div class="grid"><div><label for="f-nomor">Nomor surat</label><input id="f-nomor" data-f="nomor" value="${esc(D.nomor)}"></div>
      <div><label for="f-tanggal">Tanggal surat</label><input id="f-tanggal" type="date" data-f="tanggal" value="${esc(D.tanggal)}"></div>
      <div><label for="f-kota">Kota</label><input id="f-kota" data-f="kota" value="${esc(D.kota)}"></div>
      <div><label for="f-lampiran">Lampiran</label><input id="f-lampiran" data-f="lampiran" value="${esc(D.lampiran)}" placeholder="- atau 1 berkas"></div></div>
    <label for="f-hal">Hal / perihal</label><input id="f-hal" data-f="hal" value="${esc(D.hal)}">
    <h3>2. Tujuan surat</h3>
    <label for="f-kepada">Kepada Yth. (satu baris satu bagian; baris pertama dicetak tebal)</label><textarea id="f-kepada" data-f="kepada">${esc(D.kepada)}</textarea>
    <h3>3. Isi surat</h3>
    <label class="sr-sw"><input type="checkbox" data-f="salamBuka" ${D.salamBuka ? 'checked' : ''}> Salam pembuka (${esc(c.salamBuka)})</label>
    <label for="f-pembuka">Paragraf pembuka (kosongkan bila tidak perlu)</label><textarea id="f-pembuka" data-f="pembuka" style="min-height:96px">${esc(D.pembuka)}</textarea>
    <label for="f-pengantar" style="margin-top:8px">Kalimat pengantar isi</label><textarea id="f-pengantar" data-f="pengantar">${esc(D.pengantar)}</textarea>
    <div style="margin-top:10px"><div style="display:flex;justify-content:space-between;align-items:center"><b style="color:var(--navy)">Rincian (hari, waktu, tempat)</b><button type="button" id="addR">+ Baris</button></div><div id="rincian">${rinciHtml()}</div></div>
    <div style="margin-top:10px"><div style="display:flex;justify-content:space-between;align-items:center"><b style="color:var(--navy)">Butir bernomor</b><button type="button" id="addB">+ Butir</button></div><div id="butir" style="margin-top:6px">${butirHtml()}</div></div>
    <label for="f-penutup" style="margin-top:8px">Paragraf penutup</label><textarea id="f-penutup" data-f="penutup">${esc(D.penutup)}</textarea>
    <label class="sr-sw"><input type="checkbox" data-f="salamTutup" ${D.salamTutup ? 'checked' : ''}> Salam penutup (${esc(c.salamTutup)})</label>
    <h3>4. Penandatangan</h3>
    <div class="grid"><div><label for="f-tj">Jabatan</label><input id="f-tj" data-f="ttdJabatan" value="${esc(D.ttdJabatan)}"></div><div><label for="f-tn">Nama (beserta gelar)</label><input id="f-tn" data-f="ttdNama" value="${esc(D.ttdNama)}"></div>
      <div><label for="f-tp">NIP/NIY (opsional)</label><input id="f-tp" data-f="ttdNip" value="${esc(D.ttdNip)}"></div></div>
    <div class="grid" style="margin-top:8px"><div><label for="f-img">Gambar tanda tangan (PNG, opsional)</label><input id="f-img" type="file" accept="image/*" data-img="ttdImg"></div>
      <div><label for="f-stp">Gambar stempel (PNG, opsional)</label><input id="f-stp" type="file" accept="image/*" data-img="stempelImg"></div></div>
    <p class="mut" style="margin:4px 0 0">${D.ttdImg || D.stempelImg ? 'Gambar terpasang. ' : ''}<a href="#" id="hapusImg">Hapus gambar</a></p>
    <h3>5. Tembusan</h3>
    <label class="sr-sw"><input type="checkbox" data-f="tembusanOn" ${D.tembusanOn ? 'checked' : ''}> Cantumkan tembusan</label>
    <textarea data-f="tembusan" style="min-height:96px" aria-label="Daftar tembusan">${esc(D.tembusan)}</textarea>
    <details style="margin-top:16px"><summary style="cursor:pointer;font-weight:700;color:var(--navy)">Pengaturan kop surat & bawaan</summary>
      <div class="grid" style="margin-top:8px"><div><label for="k1">Baris kop 1</label><input id="k1" value="${esc(c.kop.l1)}"></div><div><label for="k2">Baris kop 2</label><input id="k2" value="${esc(c.kop.l2)}"></div>
        <div><label for="k3">Baris kop 3</label><input id="k3" value="${esc(c.kop.l3)}"></div><div><label for="kk">Kode nomor surat</label><input id="kk" value="${esc(c.kodeNomor)}" placeholder="YMAKR/SD"></div></div>
      <label for="ka" style="margin-top:8px">Alamat & kontak kop</label><textarea id="ka">${esc(c.kop.alamat)}</textarea>
      <p class="mut">Format nomor: urutan/${esc(c.kodeNomor)}/bulan romawi/tahun. Urutan dihitung dari surat keluar tahun itu.</p>
      <p><button type="button" id="simpanCfg">Simpan sebagai bawaan (kop, kode, penandatangan, tembusan)</button></p></details>
  </div>
  <div class="sr-pv"><div class="sr-act"><button class="p" type="button" id="cetak">Cetak / simpan PDF</button><button type="button" id="simpan">Simpan & catat di Surat keluar</button></div>
    <div class="sr-box" id="box"><iframe id="pv" title="Pratinjau surat"></iframe></div></div></div>
  <div class="sr-hist" style="margin-top:22px"><h3 style="color:var(--navy)">Surat yang pernah dibuat (${draf.length})</h3>
  <table><tr><th>Tanggal</th><th>Nomor</th><th>Perihal</th><th></th></tr>${draf.map(r => `<tr><td>${tglID(r.tanggal)}</td><td>${esc(r.nomor)}</td><td>${esc(r.perihal)}</td><td><button type="button" data-buka="${r.id}">Buka</button> <button type="button" data-salin="${r.id}">Salin</button></td></tr>`).join('') || '<tr><td colspan="4" class="mut">Belum ada.</td></tr>'}</table></div>`;

  const pv = $('#pv'), box = $('#box');
  let tm = null;
  const gambar = () => {
    pv.srcdoc = htmlSurat(D, c);
    pv.onload = () => { const z = Math.min(1, (box.clientWidth - 20) / 794); pv.style.zoom = z; pv.style.height = Math.max(1123, pv.contentDocument.documentElement.scrollHeight) + 'px'; };
  };
  const tunda = () => { clearTimeout(tm); tm = setTimeout(gambar, 200); };
  const segarNomor = () => { if (!D.nomorManual) { D.nomor = nomorSurat(c, R.rows.filter(r => r.id !== D.id), D.tanggal); $('#f-nomor').value = D.nomor; } };

  const v = $('#view');
  v.oninput = v.onchange = async e => {
    const t = e.target;
    if (t.id === 'sjenis') return e.type === 'change' ? MODUL.buatsurat(t.value) : undefined;
    if (t.dataset.f) {
      const k = t.dataset.f; D[k] = t.type === 'checkbox' ? t.checked : t.value;
      if (k === 'nomor') D.nomorManual = true;
      if (k === 'tanggal' && !D.id) segarNomor();
      return tunda();
    }
    if (t.dataset.b != null) { D.butir[+t.dataset.b][t.dataset.s] = t.value; return tunda(); }
    if (t.dataset.r != null) { D.rincian[+t.dataset.r][t.dataset.rk] = t.value; return tunda(); }
    if (t.dataset.img && e.type === 'change' && t.files && t.files[0]) {
      try { D[t.dataset.img] = await gambarKecil(t.files[0]); msg('Gambar dipasang. Ingat: simpan surat agar gambar ikut tersimpan.'); gambar(); } catch (er) { msg(er.message, true); }
    }
  };
  v.onclick = async e => {
    const t = e.target.closest('button,a'); if (!t) return;
    const d = t.dataset;
    if (t.id === 'hapusImg') { e.preventDefault(); D.ttdImg = D.stempelImg = ''; return gambar(); }
    if (t.id === 'sbaru') return MODUL.buatsurat(D.jenis);
    if (t.id === 'addB') { D.butir.push({ teks: '', sub: '' }); $('#butir').innerHTML = butirHtml(); return tunda(); }
    if (t.id === 'addR') { D.rincian.push({ k: '', v: '' }); $('#rincian').innerHTML = rinciHtml(); return tunda(); }
    if (d.hapusb != null) { D.butir.splice(+d.hapusb, 1); $('#butir').innerHTML = butirHtml(); return tunda(); }
    if (d.hapusr != null) { D.rincian.splice(+d.hapusr, 1); $('#rincian').innerHTML = rinciHtml(); return tunda(); }
    if (t.id === 'cetak') { clearTimeout(tm); pv.srcdoc = htmlSurat(D, c); pv.onload = () => { pv.contentWindow.focus(); pv.contentWindow.print(); }; return; }
    if (d.buka || d.salin) {
      const r = R.rows.find(x => x.id === (d.buka || d.salin)); if (!r || !r.isi) return;
      R.D = { ...suratBaru(r.isi.jenis || 'kegiatan'), ...JSON.parse(JSON.stringify(r.isi)), id: d.buka ? r.id : null };
      if (d.salin) { R.D.tanggal = today(); R.D.nomorManual = false; R.D.nomor = nomorSurat(c, R.rows, R.D.tanggal); }
      return MODUL.buatsurat();
    }
    if (t.id === 'simpanCfg') {
      const cfg = { ...c, kop: { l1: $('#k1').value.trim(), l2: $('#k2').value.trim(), l3: $('#k3').value.trim(), alamat: $('#ka').value }, kodeNomor: $('#kk').value.trim() || c.kodeNomor,
        kota: D.kota, ttd: { jabatan: D.ttdJabatan, nama: D.ttdNama, nip: D.ttdNip }, tembusan: D.tembusan };
      const { error } = await sb.from('surat_pengaturan').upsert({ id: 'utama', config: cfg, updated_at: new Date().toISOString() });
      if (error) return msg(error.message, true);
      R.cfg = cfg; msg('Pengaturan bawaan disimpan.'); return gambar();
    }
    if (t.id === 'simpan') {
      if (!D.hal.trim()) return msg('Isi hal / perihal surat.', true);
      if (!D.nomor.trim()) return msg('Isi nomor surat.', true);
      if (R.rows.some(r => r.id !== D.id && r.nomor === D.nomor.trim() && String(r.tanggal).slice(0, 4) === D.tanggal.slice(0, 4)) && !confirm('Nomor ' + D.nomor + ' sudah dipakai surat lain. Tetap simpan?')) return;
      const rec = { jenis: 'keluar', nomor: D.nomor.trim(), tanggal: D.tanggal, pihak: baris(D.kepada)[0] || null, perihal: D.hal.trim(), status: 'draf', isi: D };
      const q = D.id ? sb.from('surat').update(rec).eq('id', D.id).select().single() : sb.from('surat').insert(rec).select().single();
      const { data, error } = await q;
      if (error) return msg(error.message.includes('isi') ? 'Kolom "isi" belum ada. Jalankan supabase-surat-generator.sql di Supabase.' : error.message, true);
      D.id = data.id; _sr = null; await suratMuat(); _sr.D = D;
      return MODUL.buatsurat().then(() => msg('Surat tersimpan dan tercatat di Surat keluar.'));
    }
  };
  gambar();
};
