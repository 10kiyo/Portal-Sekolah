/* ============================================================
   MENU STAF PER PERAN untuk halaman Administrasi Guru dan Staf (kelas.html).
   Pustakawan: kartu pelajar, ekskul & club, peminjaman buku.
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

let _siswa = null;
async function dataSiswa() {
  if (!_siswa) _siswa = (await allGuests()).filter(x => x.guest_name && /siswa|murid|anak/i.test(x.jenis_undangan || '') && !/orang ?tua|wali/i.test(x.jenis_undangan || ''));
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
MODUL.kartu = async function () {
  $('#view').innerHTML = '<p>Memuat daftar murid...</p>';
  const g = await dataSiswa(), kls = kelasDari(g);
  if (!kls.length) { $('#view').innerHTML = '<p class="msg err">Data murid tidak ditemukan di database.</p>'; return; }
  const y = new Date().getFullYear(), ta = new Date().getMonth() >= 6 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
  let kel = kls[0];
  $('#view').innerHTML = `<div class="noprint"><h2>Kartu pelajar</h2>
  <p class="mut">Pilih kelas dan murid, lalu cetak. Ukuran kartu 85,6 x 54 mm; atur kertas A4 dan skala 100% saat mencetak. Foto murid ditempel setelah dicetak.</p>
  <div class="grid"><div><label for="kk">Kelas</label><select id="kk">${opsi(kls, kel)}</select></div>
  <div><label for="kt">Tahun ajaran</label><input id="kt" value="${ta}"></div></div>
  <p><button id="kAll">Pilih semua</button> <button id="kNone">Kosongkan</button> <button class="p" id="kPrint">Cetak kartu</button></p>
  <div id="kl" class="chklist"></div></div><div id="kp" class="kwrap"></div>`;
  const daftar = () => g.filter(x => String(x.instansi_kelas || '').trim() === kel).sort((a, b) => urut(a.guest_name, b.guest_name));
  const kartu = x => `<div class="kartu"><div class="kh"><img src="logo-at-taqwa.png" alt=""><div><b>KARTU PELAJAR</b><span>SDS Islam At-Taqwa Rawamangun</span></div></div>
    <div class="kb"><div class="kfoto">FOTO</div><div class="ki"><b>${esc(x.guest_name)}</b><div>Kelas ${esc(kel)}</div><div>No. ${esc(x.guest_id)}</div></div></div>
    <div class="kf">Tahun ajaran ${esc($('#kt').value)}</div></div>`;
  const gambar = () => { const ids = new Set([...document.querySelectorAll('#kl input:checked')].map(i => i.dataset.id)); $('#kp').innerHTML = daftar().filter(x => ids.has(String(x.guest_id))).map(kartu).join(''); };
  const isi = () => { $('#kl').innerHTML = daftar().map(x => `<label class="chk"><input type="checkbox" data-id="${esc(x.guest_id)}" checked> ${esc(x.guest_name)}</label>`).join('') || '<span class="mut">Tidak ada murid.</span>'; gambar(); };
  $('#kk').onchange = e => { kel = e.target.value; isi(); };
  $('#kt').oninput = gambar;
  $('#kl').onchange = gambar;
  $('#kAll').onclick = () => { document.querySelectorAll('#kl input').forEach(i => i.checked = true); gambar(); };
  $('#kNone').onclick = () => { document.querySelectorAll('#kl input').forEach(i => i.checked = false); gambar(); };
  $('#kPrint').onclick = () => print();
  isi();
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
