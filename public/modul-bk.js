/* ============================================================
   MENU GURU BK (Administrasi Guru dan Staf, kelas.html). Peran: bk (biasanya peran TAMBAHAN pada guru yang juga mengajar).
   Ringkasan | Catat kedisiplinan | Rekap & poin | Tindak lanjut & SP | Konseling (rahasia) | Orang tua & surat | Kelas saya | Pengaturan.
   Dimuat SETELAH modul-staf.js; memakai $, esc, sb, S, run, msg, csv, today, show dari kelas.html dan
   MODUL, dataSiswa, kelasDari, kelasX, semua, urut, opsi, tglID, tglPanjang, BLN, KARTU_BAWAAN dari modul-staf.js.
   Tabel & aturan akses: supabase-bk.sql.
   ============================================================ */
const BKS = { t: 0, guruId: null, nama: '', saya: new Set(), semua: false, pegangan: [], jenis: [], atur: {}, murid: [] };
const BK_KAT = { terlambat: 'Terlambat', atribut: 'Atribut tidak lengkap', pelanggaran: 'Pelanggaran', prestasi: 'Prestasi' };
const BK_WARNA = { terlambat: ['#a65f00', '#fdf0e3'], atribut: ['#8a5a00', '#fff6dc'], pelanggaran: ['#bc3d33', '#fbeceb'], prestasi: ['#19724d', '#eaf5ee'], netral: ['#627d98', '#eef2f6'], biru: ['#1677c8', '#eef6fc'] };
const BK_TINGKAT = { teguran: 'Teguran lisan', sp1: 'Surat Peringatan 1', sp2: 'Surat Peringatan 2', sp3: 'Surat Peringatan 3', panggil_ortu: 'Panggilan orang tua', skorsing: 'Skorsing', lainnya: 'Lainnya' };
const BK_URUT = ['teguran', 'sp1', 'sp2', 'sp3'];                    // tingkat berjenjang yang dihitung dari poin
const BK_AMBANG0 = { teguran: 5, sp1: 10, sp2: 20, sp3: 30 };
const BK_STATUS_K = { baru: ['Baru', 'biru'], diproses: ['Diproses', 'terlambat'], selesai: ['Selesai', 'prestasi'], rujukan: ['Rujukan', 'pelanggaran'] };
const BK_BENTUK_O = { panggilan: 'Panggilan orang tua', home_visit: 'Home visit', telepon: 'Telepon / WhatsApp', pertemuan: 'Pertemuan' };
const BK_BIDANG = { pribadi: 'Pribadi', sosial: 'Sosial', belajar: 'Belajar', keluarga: 'Keluarga', perilaku: 'Perilaku', lainnya: 'Lainnya' };
const BK_BENTUK_K = { individu: 'Individu', kelompok: 'Kelompok', orang_tua: 'Dengan orang tua' };

const bkPill = (t, w) => { const c = BK_WARNA[w] || BK_WARNA.netral; return `<span style="display:inline-block;padding:2px 9px;border-radius:99px;font-size:12px;font-weight:700;color:${c[0]};background:${c[1]}">${esc(t)}</span>`; };
const bkStat = (n, l, w) => `<div style="flex:1;min-width:120px;background:${(BK_WARNA[w] || BK_WARNA.biru)[1]};border-radius:14px;padding:12px 14px"><div style="font-size:24px;font-weight:800;color:${(BK_WARNA[w] || BK_WARNA.biru)[0]}">${esc(n)}</div><div class="mut">${esc(l)}</div></div>`;
const bkAman = f => async (...a) => { try { await f(...a); } catch (e) { if (e && e.message) msg(e.message, true); } };

/* ---------- semester (Jul-Des = Ganjil, Jan-Jun = Genap) ---------- */
const bkSem = d => { const [y, m] = String(d).split('-').map(Number); return m >= 7 ? `${y}/${y + 1} Ganjil` : `${y - 1}/${y} Genap`; };
const bkSemRange = s => { const [th, jn] = s.split(' '), [a, b] = th.split('/').map(Number); return jn === 'Ganjil' ? [`${a}-07-01`, `${a}-12-31`] : [`${b}-01-01`, `${b}-06-30`]; };
const bkSemSebelum = s => { const [th, jn] = s.split(' '), [a, b] = th.split('/').map(Number); return jn === 'Ganjil' ? `${a - 1}/${a} Genap` : `${a}/${b} Ganjil`; };
const bkSemDaftar = () => { const l = [bkSem(today())]; for (let i = 0; i < 5; i++) l.push(bkSemSebelum(l[l.length - 1])); return l; };

/* ---------- ambang poin -> tingkat tindak lanjut ---------- */
const bkAmbang = () => ({ ...BK_AMBANG0, ...(BKS.atur.ambang || {}) });
const bkAda = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const bkSaran = p => { const a = bkAmbang(); let r = null; BK_URUT.forEach(k => { if (bkAda(a[k]) && p >= Number(a[k])) r = k; }); return r; };
const bkTertinggi = list => Math.max(-1, ...list.map(t => BK_URUT.indexOf(t.tingkat)));   // indeks tingkat berjenjang tertinggi yang sudah diberikan
const bkHari = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long' }) : '';
const bkTgl = d => (typeof tglPanjang === 'function' ? tglPanjang(d) : d) || '';

/* ---------- data bersama ---------- */
async function bkInit(paksa) {
  if (!paksa && BKS.t && Date.now() - BKS.t < 300000) return;
  const u = (await sb.auth.getUser()).data.user;
  const g = u ? await run(sb.from('guru_staf').select('id,nama').eq('auth_user_id', u.id).maybeSingle()) : null;
  BKS.guruId = g ? g.id : null; BKS.nama = g ? g.nama : '';
  if (paksa) _siswa = null;
  const [saya, peg, jenis, atur, murid] = await Promise.all([
    BKS.guruId ? run(sb.from('bk_kelas').select('kelas').eq('guru_id', BKS.guruId)) : [],
    run(sb.rpc('bk_pegangan')),
    run(sb.from('bk_jenis').select('*').order('kategori').order('urut').order('nama')),
    run(sb.from('bk_pengaturan').select('kunci,nilai')),
    dataSiswa()
  ]);
  BKS.saya = new Set(saya.map(r => r.kelas)); BKS.pegangan = peg || []; BKS.jenis = jenis;
  BKS.atur = Object.fromEntries(atur.map(r => [r.kunci, r.nilai]));
  BKS.murid = murid.filter(x => x.guest_name).sort((a, b) => urut(kelasX(a), kelasX(b)) || String(a.guest_name).localeCompare(String(b.guest_name), 'id'));
  BKS.t = Date.now();
}
const bkJalan = f => async (...a) => {
  try { await bkInit(); await f(...a); }
  catch (e) { if (e && e.message) $('#view').innerHTML = `<p class="msg err">Gagal memuat: ${esc(e.message)}</p><p class="mut">Pastikan supabase-bk.sql sudah dijalankan di Supabase dan akunmu berperan bk (atau peran tambahan bk).</p>`; }
};
const bkMurid = () => BKS.murid.filter(x => BKS.semua || !BKS.saya.size || BKS.saya.has(kelasX(x)));
const bkKelasList = () => kelasDari(bkMurid());
const bkMuridOleh = id => BKS.murid.find(x => String(x.guest_id) === String(id));

function bkBar() {
  const n = BKS.saya.size;
  return `<div class="noprint" style="display:flex;gap:6px 16px;align-items:center;flex-wrap:wrap;margin:0 0 14px;padding:9px 13px;background:var(--soft);border-radius:12px">
  <span class="mut">${n ? 'Kelas saya: <b>' + [...BKS.saya].sort(urut).map(esc).join(', ') + '</b>' : 'Kamu belum memilih kelas, jadi semua kelas ditampilkan. <a href="#" data-gokelas="1">Atur kelas saya</a>'}</span>
  ${n ? `<label style="display:inline-flex;gap:6px;font-weight:600;margin:0"><input type="checkbox" id="bkAll" style="width:auto" ${BKS.semua ? 'checked' : ''}> Tampilkan semua kelas</label>` : ''}</div>`;
}
// Menyambungkan klik/ubah halaman + kotak "semua kelas" + tautan "Atur kelas saya".
function bkPasang(ulang, klik, ubah) {
  const v = $('#view');
  v.onclick = bkAman(async e => {
    if (e.target.dataset.gokelas) { e.preventDefault(); S.tab = 'bkkelas'; return show(); }
    if (e.target.dataset.go) { S.tab = e.target.dataset.go; return show(); }
    if (klik) await klik(e);
  });
  v.onchange = bkAman(async e => {
    if (e.target.id === 'bkAll') { BKS.semua = e.target.checked; return ulang(); }
    if (ubah) await ubah(e);
  });
}
// Pilih murid bertingkat: kelas lalu nama. p = awalan id (#<p>k, #<p>m).
function bkPilihHtml(p, label) {
  return `<div><label for="${p}k">Kelas</label><select id="${p}k"></select></div><div><label for="${p}m">${label || 'Murid'}</label><select id="${p}m"></select></div>`;
}
function bkPilihPasang(p, id) {
  const ms = bkMurid(), cur = id && bkMuridOleh(id), kls = kelasDari(cur && !ms.includes(cur) ? [...ms, cur] : ms);
  const ke = $('#' + p + 'k'), me = $('#' + p + 'm');
  ke.innerHTML = kls.map(k => `<option>${esc(k)}</option>`).join('');
  const isi = pilih => { me.innerHTML = BKS.murid.filter(x => kelasX(x) === ke.value).map(x => `<option value="${esc(x.guest_id)}" ${String(x.guest_id) === String(pilih) ? 'selected' : ''}>${esc(x.guest_name)}</option>`).join(''); };
  if (cur) ke.value = kelasX(cur);
  isi(id);
  ke.addEventListener('change', () => isi());
}
const bkPilihan = p => { const m = bkMuridOleh($('#' + p + 'm').value); return m ? { guest_id: String(m.guest_id), nama: m.guest_name, kelas: kelasX(m) } : null; };
const bkSemuaCatatan = (a, b) => semua(() => sb.from('bk_catatan').select('*').gte('tanggal', a).lte('tanggal', b).order('tanggal', { ascending: false }).order('id'));

/* ---------- surat (dicetak lewat jendela baru; "Simpan sebagai PDF" dari dialog cetak) ---------- */
function bkCetak(judul, isi) {
  const sekolah = (typeof KARTU_BAWAAN !== 'undefined' && KARTU_BAWAAN.sekolah) || 'Sekolah', s = BKS.atur.surat || {};
  const w = window.open('', '_blank');
  if (!w) return msg('Jendela cetak diblokir browser. Izinkan pop-up untuk situs ini, lalu coba lagi.', true);
  w.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(judul)}</title><style>
  @page{size:A4;margin:18mm 20mm}body{font:12pt/1.5 "Times New Roman",serif;color:#000;margin:0}
  .kop{display:flex;align-items:center;gap:14px;border-bottom:3px double #000;padding-bottom:8px;margin-bottom:14px}.kop img{width:70px;height:70px;object-fit:contain}
  .kop b{font-size:15pt;display:block}.kop span{font-size:10pt}h1{font-size:13pt;text-align:center;text-decoration:underline;margin:14px 0 2px}.no{text-align:center;margin:0 0 14px}
  table.i td{padding:1px 8px 1px 0;vertical-align:top}table.b{border-collapse:collapse;width:100%;margin:8px 0}table.b td,table.b th{border:1px solid #000;padding:3px 6px;font-size:11pt;text-align:left}
  .ttd{display:flex;justify-content:space-between;gap:20px;margin-top:26px;text-align:center}.ttd div{flex:1}.sp{height:64px}p{margin:8px 0;text-align:justify}
  </style></head><body><div class="kop"><img src="${esc(location.origin)}/logo-at-taqwa.png" alt=""><div><b>${esc(sekolah)}</b>${s.alamat ? `<span>${esc(s.alamat)}</span>` : ''}</div></div>${isi}
  <script>onload=()=>setTimeout(()=>print(),400)<\/script></body></html>`);
  w.document.close();
}
function bkTtd(kiri, tengahKepsek) {
  const s = BKS.atur.surat || {}, kota = s.kota || 'Jakarta';
  return `<div class="ttd"><div>${kiri}</div><div>${esc(kota)}, ${esc(bkTgl(today()))}<br>Guru BK<div class="sp"></div><u>${esc(BKS.nama || '................')}</u></div></div>
  ${tengahKepsek ? `<div class="ttd"><div></div><div>Mengetahui,<br>Kepala Sekolah<div class="sp"></div><u>${esc(s.kepsek || '................')}</u>${s.nip ? '<br>NIP ' + esc(s.nip) : ''}</div><div></div></div>` : ''}`;
}
const bkOrtuKpd = r => `<p>Kepada Yth.<br>Bapak/Ibu Orang Tua/Wali dari <b>${esc(r.nama)}</b> (Kelas ${esc(r.kelas || '-')})<br>di tempat</p>`;
function bkSuratPanggilan(r) {
  const sekolah = KARTU_BAWAAN.sekolah;
  bkCetak('Surat panggilan orang tua', `<h1>SURAT PANGGILAN ORANG TUA/WALI</h1><p class="no">Nomor: ......... / BK / ......... / ${new Date().getFullYear()}</p>${bkOrtuKpd(r)}
  <p>Assalamu'alaikum Wr. Wb.</p><p>Dengan hormat, sehubungan dengan <b>${esc(r.perihal)}</b>, kami mengundang Bapak/Ibu untuk hadir ke sekolah pada:</p>
  <table class="i"><tr><td>Hari/Tanggal</td><td>:</td><td>${r.tgl_hadir ? esc(bkHari(r.tgl_hadir) + ', ' + bkTgl(r.tgl_hadir)) : '.................................'}</td></tr>
  <tr><td>Pukul</td><td>:</td><td>${esc(r.jam_hadir || '.................')}</td></tr><tr><td>Tempat</td><td>:</td><td>Ruang BK ${esc(sekolah)}</td></tr>
  <tr><td>Acara</td><td>:</td><td>Konsultasi mengenai perkembangan ananda</td></tr></table>
  <p>Mengingat pentingnya hal tersebut, kami mohon Bapak/Ibu dapat hadir tepat waktu. Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.</p><p>Wassalamu'alaikum Wr. Wb.</p>${bkTtd('', true)}`);
}
function bkSuratSP(t, rincian) {
  const n = { sp1: '1', sp2: '2', sp3: '3' }[t.tingkat] || '';
  bkCetak('Surat peringatan', `<h1>SURAT PERINGATAN ${n}</h1><p class="no">Nomor: ......... / BK / ......... / ${new Date().getFullYear()}</p>${bkOrtuKpd(t)}
  <p>Assalamu'alaikum Wr. Wb.</p><p>Dengan hormat, melalui surat ini kami memberitahukan bahwa ananda <b>${esc(t.nama)}</b> (Kelas ${esc(t.kelas || '-')}) pada semester ${esc(t.semester)} telah mengakumulasi <b>${esc(t.total_poin ?? '-')} poin</b> pelanggaran tata tertib sekolah, dengan rincian:</p>
  <table class="b"><tr><th>No</th><th>Tanggal</th><th>Jenis</th><th>Poin</th></tr>${rincian.slice(0, 25).map((c, i) => `<tr><td>${i + 1}</td><td>${esc(tglID(c.tanggal))}</td><td>${esc(c.jenis_nama)}${c.keterangan ? ' (' + esc(c.keterangan) + ')' : ''}</td><td>${c.poin}</td></tr>`).join('') || '<tr><td colspan="4">-</td></tr>'}</table>
  ${rincian.length > 25 ? `<p>...dan ${rincian.length - 25} catatan lainnya.</p>` : ''}
  <p>Kami berharap Bapak/Ibu dapat bekerja sama membimbing ananda agar lebih disiplin dan menaati tata tertib sekolah. Bila diperlukan, Bapak/Ibu dapat berkonsultasi dengan guru BK.</p><p>Wassalamu'alaikum Wr. Wb.</p>
  ${bkTtd('Orang tua/wali murid<div class="sp"></div>( ........................ )', true)}`);
}
function bkSuratKesepakatan(r) {
  bkCetak('Surat kesepakatan', `<h1>SURAT KESEPAKATAN</h1><p class="no">Orang Tua/Wali dan Sekolah</p>
  <p>Pada hari ${esc(bkHari(r.tanggal))}, tanggal ${esc(bkTgl(r.tanggal))}, telah dilakukan pertemuan mengenai ananda <b>${esc(r.nama)}</b> (Kelas ${esc(r.kelas || '-')}) dengan perihal <b>${esc(r.perihal)}</b>${r.peserta ? ', dihadiri oleh ' + esc(r.peserta) : ''}.</p>
  <p>Hasil pertemuan: ${esc(r.hasil || '-')}</p><p>Kedua belah pihak menyepakati hal-hal berikut:</p><p style="white-space:pre-wrap">${esc(r.perjanjian || '1. ........................................')}</p>
  <p>Demikian kesepakatan ini dibuat untuk dilaksanakan dengan penuh tanggung jawab.</p>
  <div class="ttd"><div>Orang tua/wali murid<div class="sp"></div>( ........................ )</div><div>Siswa<div class="sp"></div><u>${esc(r.nama)}</u></div></div>${bkTtd('', true)}`);
}

/* ---------- cek ambang setelah mencatat: siswa yang kini perlu tindak lanjut ---------- */
async function bkCekAmbang(ids, tgl) {
  const sem = bkSem(tgl), [a, b] = bkSemRange(sem);
  const [cs, ts] = await Promise.all([
    run(sb.from('bk_catatan').select('guest_id,nama,poin,kategori').in('guest_id', ids).gte('tanggal', a).lte('tanggal', b).limit(5000)),
    run(sb.from('bk_tindak').select('guest_id,tingkat').in('guest_id', ids).eq('semester', sem))
  ]);
  const poin = {}, nama = {};
  cs.forEach(c => { nama[c.guest_id] = c.nama; if (c.kategori !== 'prestasi') poin[c.guest_id] = (poin[c.guest_id] || 0) + c.poin; });
  return ids.filter(id => { const s = bkSaran(poin[id] || 0); return s && BK_URUT.indexOf(s) > bkTertinggi(ts.filter(t => t.guest_id === id)); })
    .map(id => `${nama[id]}: ${poin[id]} poin, disarankan ${BK_TINGKAT[bkSaran(poin[id])]}`);
}

/* ================= RINGKASAN ================= */
MODUL.bkberanda = bkJalan(async function () {
  const t = today(), sem = bkSem(t), [a, b] = bkSemRange(sem), ids = new Set(bkMurid().map(x => String(x.guest_id)));
  const [cs, ts, ks, os] = await Promise.all([
    bkSemuaCatatan(a, b),
    run(sb.from('bk_tindak').select('guest_id,tingkat').eq('semester', sem)),
    run(sb.from('bk_konseling').select('id,guest_id,nama,kelas,tanggal,status,jadwal_lanjut,bidang').in('status', ['baru', 'diproses', 'rujukan']).order('tanggal', { ascending: false }).limit(300)),
    run(sb.from('bk_ortu').select('id,guest_id,nama,kelas,perihal,tgl_hadir,jam_hadir').eq('status', 'direncanakan').order('tgl_hadir', { ascending: true, nullsFirst: false }).limit(100))
  ]);
  const mine = c => ids.has(c.guest_id), pg = x => ids.has(x.guest_id);
  const c1 = cs.filter(mine), k1 = ks.filter(pg), o1 = os.filter(pg);
  const jml = k => c1.filter(c => c.kategori === k).length, minggu = tambahHari(t, -6);
  const poin = new Map(); c1.forEach(c => { if (c.kategori !== 'prestasi') { const x = poin.get(c.guest_id) || { nama: c.nama, kelas: c.kelas, p: 0 }; x.p += c.poin; poin.set(c.guest_id, x); } });
  const perlu = [...poin].filter(([id, x]) => { const s = bkSaran(x.p); return s && BK_URUT.indexOf(s) > bkTertinggi(ts.filter(z => z.guest_id === id)); });
  const bln = tambahHari(t, -30), sering = new Map();
  c1.filter(c => c.kategori === 'terlambat' && c.tanggal >= bln).forEach(c => { const x = sering.get(c.guest_id) || { nama: c.nama, kelas: c.kelas, n: 0 }; x.n++; sering.set(c.guest_id, x); });
  const top = [...poin.values()].sort((x, y) => y.p - x.p).slice(0, 5);
  const lanjut = k1.filter(k => k.jadwal_lanjut && k.jadwal_lanjut <= tambahHari(t, 7)).sort((x, y) => x.jadwal_lanjut.localeCompare(y.jadwal_lanjut));
  $('#view').innerHTML = `<h2>Bimbingan Konseling</h2>${bkBar()}<p class="mut">Semester ${esc(sem)}</p>
  <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">${bkStat(jml('terlambat'), 'Terlambat', 'terlambat')}${bkStat(jml('atribut'), 'Atribut tidak lengkap', 'atribut')}${bkStat(jml('pelanggaran'), 'Pelanggaran', 'pelanggaran')}${bkStat(jml('prestasi'), 'Prestasi', 'prestasi')}</div>
  <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:6px">${bkStat(perlu.length, 'Perlu tindak lanjut', perlu.length ? 'pelanggaran' : 'netral')}${bkStat(k1.length, 'Kasus konseling aktif', 'biru')}${bkStat(o1.length, 'Panggilan ortu terjadwal', 'biru')}${bkStat(c1.filter(c => c.tanggal >= minggu).length, 'Catatan 7 hari terakhir', 'netral')}</div>
  <p><button class="p" data-go="bkcatat">Catat kedisiplinan</button> <button data-go="bktindak">Tindak lanjut & SP</button> <button data-go="bkkonsel">Konseling</button></p>
  <h3 style="color:var(--navy)">Perlu tindak lanjut</h3>${perlu.length ? `<table><tr><th>Nama</th><th>Kelas</th><th>Poin</th><th>Disarankan</th></tr>${perlu.map(([, x]) => `<tr><td>${esc(x.nama)}</td><td>${esc(x.kelas)}</td><td><b>${x.p}</b></td><td>${bkPill(BK_TINGKAT[bkSaran(x.p)], 'pelanggaran')}</td></tr>`).join('')}</table>` : '<p class="mut">Tidak ada. Semua siswa di bawah ambang poin atau sudah ditindaklanjuti.</p>'}
  <h3 style="color:var(--navy)">Poin pelanggaran tertinggi</h3>${top.length ? `<table><tr><th>Nama</th><th>Kelas</th><th>Poin</th></tr>${top.map(x => `<tr><td>${esc(x.nama)}</td><td>${esc(x.kelas)}</td><td><b>${x.p}</b></td></tr>`).join('')}</table>` : '<p class="mut">Belum ada catatan semester ini.</p>'}
  <h3 style="color:var(--navy)">Sering terlambat (3 kali atau lebih dalam 30 hari)</h3>${[...sering.values()].filter(x => x.n >= 3).length ? `<table><tr><th>Nama</th><th>Kelas</th><th>Terlambat</th></tr>${[...sering.values()].filter(x => x.n >= 3).sort((x, y) => y.n - x.n).map(x => `<tr><td>${esc(x.nama)}</td><td>${esc(x.kelas)}</td><td><b>${x.n}x</b></td></tr>`).join('')}</table>` : '<p class="mut">Tidak ada.</p>'}
  <h3 style="color:var(--navy)">Jadwal lanjutan konseling (7 hari ke depan atau terlewat)</h3>${lanjut.length ? `<table><tr><th>Tanggal</th><th>Nama</th><th>Kelas</th></tr>${lanjut.map(k => `<tr><td ${k.jadwal_lanjut < t ? 'style="color:var(--danger);font-weight:700"' : ''}>${tglID(k.jadwal_lanjut)}</td><td>${esc(k.nama)}</td><td>${esc(k.kelas)}</td></tr>`).join('')}</table>` : '<p class="mut">Tidak ada.</p>'}
  <h3 style="color:var(--navy)">Panggilan orang tua terjadwal</h3>${o1.length ? `<table><tr><th>Tanggal hadir</th><th>Nama</th><th>Kelas</th><th>Perihal</th></tr>${o1.map(o => `<tr><td>${o.tgl_hadir ? tglID(o.tgl_hadir) + (o.jam_hadir ? ', ' + esc(o.jam_hadir) : '') : '-'}</td><td>${esc(o.nama)}</td><td>${esc(o.kelas)}</td><td>${esc(o.perihal)}</td></tr>`).join('')}</table>` : '<p class="mut">Tidak ada.</p>'}`;
  bkPasang(MODUL.bkberanda);
});

/* ================= CATAT KEDISIPLINAN ================= */
MODUL.bkcatat = bkJalan(async function (kat0) {
  const ms = bkMurid(), kls = kelasDari(ms), t = today(), aktif = BKS.jenis.filter(j => j.aktif);
  const pilih = new Set();
  let kat = typeof kat0 === 'string' ? kat0 : (MODUL.bkcatat._kat || 'terlambat');
  const rec = await run(sb.from('bk_catatan').select('*').order('created_at', { ascending: false }).limit(40));
  $('#view').innerHTML = `<h2>Catat kedisiplinan</h2>${bkBar()}
  <div class="grid"><div><label for="cTgl">Tanggal</label><input id="cTgl" type="date" value="${t}"></div><div><label for="cJam">Jam (opsional)</label><input id="cJam" type="time"></div>
  <div><label for="cKat">Kategori</label><select id="cKat">${Object.entries(BK_KAT).map(([k, v]) => `<option value="${k}" ${k === kat ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
  <div><label for="cKls">Kelas</label><select id="cKls">${kls.map(k => `<option>${esc(k)}</option>`).join('')}</select></div></div>
  <label>Jenis (boleh lebih dari satu)</label><div id="cJenis" style="margin-bottom:12px"></div>
  <label for="cCari">Murid</label>
  <p style="display:flex;gap:8px;flex-wrap:wrap;margin:0 0 8px"><input id="cCari" placeholder="Cari nama..." style="flex:1;min-width:160px"><button id="cSemua">Pilih semua</button><button id="cKosong">Kosongkan</button></p>
  <div id="cMurid" style="max-height:300px;overflow:auto;border:1px solid var(--line);border-radius:12px;padding:6px 10px;margin-bottom:12px"></div>
  <p class="mut" id="cJml"></p><div><label for="cKet">Keterangan (opsional)</label><input id="cKet" placeholder="Mis. terlambat 20 menit karena macet"></div>
  <p><button class="p" id="cSimpan">Simpan catatan</button></p><div id="msg" class="msg"></div>
  <h3 style="color:var(--navy)">Catatan terbaru</h3><div id="cList"></div>`;
  const gJenis = () => {
    const l = aktif.filter(j => j.kategori === $('#cKat').value);
    $('#cJenis').innerHTML = l.length ? l.map(j => `<label style="display:inline-flex;gap:6px;font-weight:500;margin:0 16px 6px 0"><input type="checkbox" style="width:auto" value="${j.id}"> ${esc(j.nama)} <span class="mut">(${j.kategori === 'prestasi' ? '+' : ''}${j.poin})</span></label>`).join('') : '<span class="mut">Belum ada jenis untuk kategori ini. Tambahkan di menu Pengaturan.</span>';
  };
  const gMurid = () => {
    const q = $('#cCari').value.trim().toLowerCase(), k = $('#cKls').value;
    const l = ms.filter(x => kelasX(x) === k && (!q || String(x.guest_name).toLowerCase().includes(q)));
    $('#cMurid').innerHTML = l.length ? l.map(x => `<label style="display:flex;gap:8px;font-weight:500;margin:0;padding:5px 0;align-items:center"><input type="checkbox" style="width:auto" data-m="${esc(x.guest_id)}" ${pilih.has(String(x.guest_id)) ? 'checked' : ''}> ${esc(x.guest_name)}</label>`).join('') : '<span class="mut">Tidak ada murid.</span>';
    $('#cJml').textContent = pilih.size + ' murid dipilih.';
  };
  const gList = () => {
    $('#cList').innerHTML = rec.length ? `<table><tr><th>Tanggal</th><th>Nama</th><th>Kelas</th><th>Jenis</th><th>Poin</th><th></th></tr>${rec.map(c => `<tr><td>${tglID(c.tanggal)}${c.jam ? ' ' + esc(String(c.jam).slice(0, 5)) : ''}</td><td>${esc(c.nama)}</td><td>${esc(c.kelas)}</td><td>${bkPill(BK_KAT[c.kategori], c.kategori)} ${esc(c.jenis_nama)}</td><td>${c.kategori === 'prestasi' ? '+' : ''}${c.poin}</td><td><button class="d" data-del="${c.id}">Hapus</button></td></tr>`).join('')}</table>` : '<p class="mut">Belum ada catatan.</p>';
  };
  gJenis(); gMurid(); gList();
  $('#cCari').oninput = gMurid;
  $('#cSemua').onclick = () => { ms.filter(x => kelasX(x) === $('#cKls').value).forEach(x => pilih.add(String(x.guest_id))); gMurid(); };
  $('#cKosong').onclick = () => { pilih.clear(); gMurid(); };
  $('#cSimpan').onclick = bkAman(async () => {
    const js = [...document.querySelectorAll('#cJenis input:checked')].map(i => aktif.find(j => j.id === i.value)).filter(Boolean);
    const pm = ms.filter(x => pilih.has(String(x.guest_id)));
    if (!js.length || !pm.length) return msg('Pilih minimal satu jenis dan satu murid.', true);
    const tgl = $('#cTgl').value || t, jam = $('#cJam').value || null, ket = $('#cKet').value.trim() || null;
    $('#cSimpan').disabled = true;
    try {
      await run(sb.from('bk_catatan').insert(pm.flatMap(m => js.map(j => ({ guest_id: String(m.guest_id), nama: m.guest_name, kelas: kelasX(m), tanggal: tgl, jam, jenis_id: j.id, kategori: j.kategori, jenis_nama: j.nama, poin: j.poin, keterangan: ket, dicatat_oleh: BKS.guruId })))));
      const warn = js.some(j => j.kategori !== 'prestasi') ? await bkCekAmbang(pm.map(m => String(m.guest_id)), tgl) : [];
      MODUL.bkcatat._kat = $('#cKat').value;
      await MODUL.bkcatat(MODUL.bkcatat._kat);
      msg(`${pm.length * js.length} catatan tersimpan.` + (warn.length ? ' Perlu tindak lanjut: ' + warn.join('; ') + '. Buka menu Tindak lanjut & SP.' : ''));
    } finally { const b = $('#cSimpan'); if (b) b.disabled = false; }
  });
  bkPasang(() => MODUL.bkcatat($('#cKat') ? $('#cKat').value : undefined), async e => {
    if (e.target.dataset.del && confirm('Hapus catatan ini?')) { await run(sb.from('bk_catatan').delete().eq('id', e.target.dataset.del)); MODUL.bkcatat($('#cKat').value); }
  }, e => {
    if (e.target.id === 'cKat') { MODUL.bkcatat._kat = e.target.value; gJenis(); }
    if (e.target.id === 'cKls') gMurid();
    if (e.target.dataset.m) { e.target.checked ? pilih.add(e.target.dataset.m) : pilih.delete(e.target.dataset.m); $('#cJml').textContent = pilih.size + ' murid dipilih.'; }
  });
});

/* ================= REKAP & POIN SISWA ================= */
MODUL.bkrekap = bkJalan(async function (sem0) {
  const sem = typeof sem0 === 'string' ? sem0 : bkSem(today()), [a, b] = bkSemRange(sem), ms = bkMurid();
  const [cs, ts] = await Promise.all([bkSemuaCatatan(a, b), run(sb.from('bk_tindak').select('guest_id,tingkat').eq('semester', sem))]);
  const agg = new Map(ms.map(m => [String(m.guest_id), { m, t: 0, a: 0, p: 0, poin: 0, pres: 0 }]));
  cs.forEach(c => { const x = agg.get(c.guest_id); if (!x) return; if (c.kategori === 'prestasi') x.pres += c.poin; else x.poin += c.poin; if (c.kategori === 'terlambat') x.t++; else if (c.kategori === 'atribut') x.a++; else if (c.kategori === 'pelanggaran') x.p++; });
  const kls = bkKelasList();
  $('#view').innerHTML = `<h2>Rekap & poin siswa</h2>${bkBar()}
  <div class="grid"><div><label for="rSem">Semester</label><select id="rSem">${bkSemDaftar().map(s => `<option ${s === sem ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
  <div><label for="rKls">Kelas</label><select id="rKls"><option value="">Semua</option>${kls.map(k => `<option>${esc(k)}</option>`).join('')}</select></div>
  <div><label for="rCari">Cari nama</label><input id="rCari"></div></div>
  <p class="noprint"><label style="display:inline-flex;gap:6px;font-weight:600"><input type="checkbox" id="rSemua" style="width:auto"> Tampilkan juga murid tanpa catatan</label> <button id="rCsv">Unduh CSV</button> <button onclick="print()">Cetak</button></p>
  <div id="rTab" style="overflow-x:auto"></div><div id="rDet"></div><div id="msg" class="msg"></div>`;
  let tampilRows = [];
  const gambar = () => {
    const k = $('#rKls').value, q = $('#rCari').value.trim().toLowerCase(), semuaM = $('#rSemua').checked;
    tampilRows = [...agg.values()].filter(x => (semuaM || x.t + x.a + x.p + x.pres) && (!k || kelasX(x.m) === k) && (!q || String(x.m.guest_name).toLowerCase().includes(q))).sort((x, y) => y.poin - x.poin || String(x.m.guest_name).localeCompare(String(y.m.guest_name), 'id'));
    $('#rTab').innerHTML = tampilRows.length ? `<table><tr><th>Nama</th><th>Kelas</th><th>Terlambat</th><th>Atribut</th><th>Pelanggaran</th><th>Poin</th><th>Prestasi</th><th>Status</th><th class="noprint"></th></tr>${tampilRows.map(x => {
      const id = String(x.m.guest_id), sr = bkSaran(x.poin), sdh = bkTertinggi(ts.filter(z => z.guest_id === id)), st = sr && BK_URUT.indexOf(sr) > sdh ? bkPill('Perlu ' + BK_TINGKAT[sr], 'pelanggaran') : (sdh >= 0 ? bkPill(BK_TINGKAT[BK_URUT[sdh]] + ' diberikan', 'terlambat') : '');
      return `<tr><td>${esc(x.m.guest_name)}</td><td>${esc(kelasX(x.m))}</td><td>${x.t}</td><td>${x.a}</td><td>${x.p}</td><td><b>${x.poin}</b></td><td>${x.pres ? '+' + x.pres : 0}</td><td>${st}</td><td class="noprint"><button data-det="${esc(id)}">Riwayat</button></td></tr>`;
    }).join('')}</table>` : '<p class="mut">Tidak ada data untuk filter ini.</p>';
  };
  gambar();
  $('#rCsv').onclick = () => csv(`rekap-bk-${sem.replace(/[^0-9A-Za-z]+/g, '-')}.csv`, [['Nama', 'Kelas', 'Terlambat', 'Atribut', 'Pelanggaran', 'Poin pelanggaran', 'Poin prestasi'], ...tampilRows.map(x => [x.m.guest_name, kelasX(x.m), x.t, x.a, x.p, x.poin, x.pres])]);
  $('#rCari').oninput = gambar;
  bkPasang(() => MODUL.bkrekap($('#rSem') ? $('#rSem').value : undefined), async e => {
    if (e.target.dataset.det) await bkRiwayat(e.target.dataset.det, '#rDet');
    if (e.target.dataset.hc && confirm('Hapus catatan ini?')) { await run(sb.from('bk_catatan').delete().eq('id', e.target.dataset.hc)); MODUL.bkrekap($('#rSem').value); }
  }, e => {
    if (e.target.id === 'rSem') MODUL.bkrekap(e.target.value);
    if (e.target.id === 'rKls' || e.target.id === 'rSemua') gambar();
  });
});

// Riwayat lengkap satu siswa (semua semester): kedisiplinan, tindak lanjut, konseling, orang tua.
async function bkRiwayat(id, target) {
  const m = bkMuridOleh(id), box = $(target);
  box.innerHTML = '<p class="mut">Memuat riwayat...</p>';
  const [cs, ts, ks, os] = await Promise.all([
    run(sb.from('bk_catatan').select('*').eq('guest_id', id).order('tanggal', { ascending: false }).limit(500)),
    run(sb.from('bk_tindak').select('*').eq('guest_id', id).order('tanggal', { ascending: false })),
    run(sb.from('bk_konseling').select('*').eq('guest_id', id).order('tanggal', { ascending: false })),
    run(sb.from('bk_ortu').select('*').eq('guest_id', id).order('tanggal', { ascending: false }))
  ]);
  const ev = [
    ...cs.map(c => ({ d: c.tanggal, j: bkPill(BK_KAT[c.kategori], c.kategori), t: `${esc(c.jenis_nama)} (${c.kategori === 'prestasi' ? '+' : ''}${c.poin} poin)${c.keterangan ? ' · ' + esc(c.keterangan) : ''}`, hc: c.id })),
    ...ts.map(c => ({ d: c.tanggal, j: bkPill('Tindak lanjut', 'terlambat'), t: `${esc(BK_TINGKAT[c.tingkat])}${c.total_poin != null ? ' (' + c.total_poin + ' poin)' : ''}${c.alasan ? ' · ' + esc(c.alasan) : ''}` })),
    ...ks.map(c => ({ d: c.tanggal, j: bkPill('Konseling (rahasia)', 'biru'), t: `${esc(BK_BIDANG[c.bidang])}: ${esc(c.masalah)} · ${esc(BK_STATUS_K[c.status][0])}` })),
    ...os.map(c => ({ d: c.tanggal, j: bkPill(BK_BENTUK_O[c.bentuk], 'netral'), t: `${esc(c.perihal)}${c.hasil ? ' · ' + esc(c.hasil) : ''}` }))
  ].sort((x, y) => y.d.localeCompare(x.d));
  box.innerHTML = `<h3 style="color:var(--navy);margin-top:18px">Riwayat ${esc(m ? m.guest_name : id)} ${m ? '<span class="mut">(Kelas ' + esc(kelasX(m)) + ')</span>' : ''}</h3>
  ${ev.length ? `<table><tr><th>Tanggal</th><th>Jenis</th><th>Keterangan</th><th class="noprint"></th></tr>${ev.map(x => `<tr><td>${tglID(x.d)}</td><td>${x.j}</td><td>${x.t}</td><td class="noprint">${x.hc ? `<button class="d" data-hc="${x.hc}">Hapus</button>` : ''}</td></tr>`).join('')}</table>` : '<p class="mut">Belum ada riwayat.</p>'}`;
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ================= TINDAK LANJUT & SP ================= */
MODUL.bktindak = bkJalan(async function (sem0) {
  const sem = typeof sem0 === 'string' ? sem0 : bkSem(today()), [a, b] = bkSemRange(sem), ms = bkMurid(), ids = new Set(ms.map(x => String(x.guest_id)));
  const [cs, ts] = await Promise.all([bkSemuaCatatan(a, b), run(sb.from('bk_tindak').select('*').eq('semester', sem).order('tanggal', { ascending: false }).order('created_at', { ascending: false }))]);
  const poin = new Map();
  cs.forEach(c => { if (c.kategori === 'prestasi' || !ids.has(c.guest_id)) return; const x = poin.get(c.guest_id) || { nama: c.nama, kelas: c.kelas, p: 0 }; x.p += c.poin; poin.set(c.guest_id, x); });
  const perlu = [...poin].map(([id, x]) => ({ id, ...x, s: bkSaran(x.p) })).filter(x => x.s && BK_URUT.indexOf(x.s) > bkTertinggi(ts.filter(z => z.guest_id === x.id))).sort((x, y) => y.p - x.p);
  const rincian = id => cs.filter(c => c.guest_id === id && c.kategori !== 'prestasi').sort((x, y) => x.tanggal.localeCompare(y.tanggal));
  const ambang = bkAmbang();
  $('#view').innerHTML = `<h2>Tindak lanjut & SP</h2>${bkBar()}
  <p class="mut">Ambang poin per semester: ${BK_URUT.filter(k => bkAda(ambang[k])).map(k => `${BK_TINGKAT[k]} ${ambang[k]}`).join(' · ')}. Bisa diubah di Pengaturan.</p>
  <p><select id="tSem" style="max-width:220px">${bkSemDaftar().map(s => `<option ${s === sem ? 'selected' : ''}>${s}</option>`).join('')}</select></p>
  <h3 style="color:var(--navy)">Perlu tindak lanjut (${perlu.length})</h3>
  ${perlu.length ? `<table><tr><th>Nama</th><th>Kelas</th><th>Poin</th><th>Disarankan</th><th></th></tr>${perlu.map(x => `<tr><td>${esc(x.nama)}</td><td>${esc(x.kelas)}</td><td><b>${x.p}</b></td><td>${bkPill(BK_TINGKAT[x.s], 'pelanggaran')}</td><td><button class="p" data-buat="${esc(x.id)}">Catat ${esc(BK_TINGKAT[x.s])}</button></td></tr>`).join('')}</table>` : '<p class="mut">Tidak ada siswa yang perlu tindak lanjut.</p>'}
  <h3 style="color:var(--navy)">Catat tindak lanjut manual</h3>
  <div class="grid">${bkPilihHtml('tm')}<div><label for="tTingkat">Tindakan</label><select id="tTingkat">${Object.entries(BK_TINGKAT).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
  <div><label for="tAlasan">Alasan</label><input id="tAlasan"></div></div>
  <p><button id="tAdd">Catat</button></p><div id="msg" class="msg"></div>
  <h3 style="color:var(--navy)">Riwayat semester ${esc(sem)} (${ts.length})</h3>
  ${ts.length ? `<table><tr><th>Tanggal</th><th>Nama</th><th>Kelas</th><th>Tindakan</th><th>Poin</th><th>Status</th><th></th></tr>${ts.map(t => `<tr><td>${tglID(t.tanggal)}</td><td>${esc(t.nama)}</td><td>${esc(t.kelas)}</td><td>${esc(BK_TINGKAT[t.tingkat])}</td><td>${t.total_poin ?? '-'}</td>
    <td><select data-st="${t.id}" style="min-width:120px">${[['dicatat', 'Dicatat'], ['diserahkan', 'Surat diserahkan'], ['selesai', 'Selesai']].map(([k, v]) => `<option value="${k}" ${t.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></td>
    <td>${['sp1', 'sp2', 'sp3'].includes(t.tingkat) ? `<button data-cetak="${t.id}">Cetak surat</button> ` : ''}<button class="d" data-del="${t.id}">Hapus</button></td></tr>`).join('')}</table>` : '<p class="mut">Belum ada tindak lanjut semester ini.</p>'}`;
  bkPilihPasang('tm');
  const simpan = async (p, tingkat, alasan, poinTotal) => {
    const baris = { guest_id: p.guest_id, nama: p.nama, kelas: p.kelas, tanggal: today(), tingkat, semester: sem, total_poin: poinTotal ?? null, alasan: alasan || null, dicatat_oleh: BKS.guruId };
    const r = await run(sb.from('bk_tindak').insert(baris).select().single());
    return r;
  };
  $('#tAdd').onclick = bkAman(async () => {
    const p = bkPilihan('tm'); if (!p) return msg('Pilih murid.', true);
    const x = poin.get(p.guest_id);
    await simpan(p, $('#tTingkat').value, $('#tAlasan').value.trim(), x ? x.p : 0); await MODUL.bktindak(sem); msg('Tindak lanjut dicatat.');
  });
  bkPasang(() => MODUL.bktindak(sem), async e => {
    const d = e.target.dataset;
    if (d.buat) {
      const x = perlu.find(z => z.id === d.buat), p = { guest_id: x.id, nama: x.nama, kelas: x.kelas };
      const r = await simpan(p, x.s, `Akumulasi ${x.p} poin pelanggaran pada semester ${sem}`, x.p);
      await MODUL.bktindak(sem); msg(BK_TINGKAT[x.s] + ' untuk ' + x.nama + ' dicatat.');
      if (['sp1', 'sp2', 'sp3'].includes(x.s) && confirm('Cetak surat peringatan untuk ' + x.nama + ' sekarang?')) bkSuratSP(r, rincian(x.id));
    }
    if (d.cetak) { const t = ts.find(z => z.id === d.cetak); bkSuratSP(t, rincian(t.guest_id)); }
    if (d.del && confirm('Hapus catatan tindak lanjut ini?')) { await run(sb.from('bk_tindak').delete().eq('id', d.del)); MODUL.bktindak(sem); }
  }, async e => {
    if (e.target.id === 'tSem') return MODUL.bktindak(e.target.value);
    if (e.target.dataset.st) { await run(sb.from('bk_tindak').update({ status: e.target.value }).eq('id', e.target.dataset.st)); msg('Status diperbarui.'); }
  });
});

/* ================= KONSELING (RAHASIA) ================= */
MODUL.bkkonsel = bkJalan(async function (editId) {
  const rows = await run(sb.from('bk_konseling').select('*').order('tanggal', { ascending: false }).order('created_at', { ascending: false }).limit(1000));
  const ids = new Set(bkMurid().map(x => String(x.guest_id))), t = today();
  const lihat = rows.filter(r => ids.has(r.guest_id));
  const sedit = typeof editId === 'string' ? rows.find(r => r.id === editId) : null;
  $('#view').innerHTML = `<h2>Konseling</h2>${bkBar()}
  <p class="mut"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true" style="width:1.1em;height:1.1em;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-.18em"><rect x="5" y="10.5" width="14" height="9.5" rx="2.2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></svg> Catatan konseling bersifat <b>rahasia</b>: hanya akun guru BK yang bisa membukanya. Wali kelas, guru lain, operator, dan orang tua tidak bisa melihatnya.</p>
  <p class="noprint"><button class="p" id="kBaru">Catatan konseling baru</button></p><div id="kForm"></div><div id="msg" class="msg"></div>
  <div class="grid"><div><label for="kFs">Status</label><select id="kFs"><option value="">Semua</option>${Object.entries(BK_STATUS_K).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select></div><div><label for="kFc">Cari nama / masalah</label><input id="kFc"></div></div>
  <div id="kList" style="overflow-x:auto"></div>`;
  const gList = () => {
    const s = $('#kFs').value, q = $('#kFc').value.trim().toLowerCase();
    const l = lihat.filter(r => (!s || r.status === s) && (!q || (r.nama + ' ' + r.masalah).toLowerCase().includes(q)));
    $('#kList').innerHTML = l.length ? `<table><tr><th>Tanggal</th><th>Murid</th><th>Bidang</th><th>Masalah</th><th>Status</th><th>Lanjutan</th><th></th></tr>${l.map(r => `<tr><td>${tglID(r.tanggal)}</td><td>${esc(r.nama)} <span class="mut">${esc(r.kelas)}</span></td><td>${esc(BK_BIDANG[r.bidang])}</td><td>${esc(String(r.masalah).slice(0, 70))}${r.masalah.length > 70 ? '…' : ''}</td><td>${bkPill(BK_STATUS_K[r.status][0], BK_STATUS_K[r.status][1])}</td><td ${r.jadwal_lanjut && r.jadwal_lanjut < t && r.status !== 'selesai' ? 'style="color:var(--danger);font-weight:700"' : ''}>${r.jadwal_lanjut ? tglID(r.jadwal_lanjut) : '-'}</td><td><button data-buka="${r.id}">Buka</button> <button class="d" data-del="${r.id}">Hapus</button></td></tr>`).join('')}</table>` : '<p class="mut">Belum ada catatan konseling.</p>';
  };
  const form = r => {
    $('#kForm').innerHTML = `<div class="card" style="margin:0 0 14px;border-color:var(--blue)"><h3 style="color:var(--navy);margin-top:0">${r ? 'Ubah catatan konseling' : 'Catatan konseling baru'}</h3>
    <div class="grid">${bkPilihHtml('km')}<div><label for="kTgl">Tanggal</label><input id="kTgl" type="date" value="${r ? r.tanggal : t}"></div>
    <div><label for="kBentuk">Bentuk</label><select id="kBentuk">${Object.entries(BK_BENTUK_K).map(([k, v]) => `<option value="${k}" ${r && r.bentuk === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    <div><label for="kBidang">Bidang</label><select id="kBidang">${Object.entries(BK_BIDANG).map(([k, v]) => `<option value="${k}" ${r && r.bidang === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    <div><label for="kStatus">Status</label><select id="kStatus">${Object.entries(BK_STATUS_K).map(([k, v]) => `<option value="${k}" ${r && r.status === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></div></div>
    <label for="kMasalah">Masalah / keluhan</label><textarea id="kMasalah">${esc(r ? r.masalah : '')}</textarea>
    <label for="kTangani" style="margin-top:10px">Penanganan</label><textarea id="kTangani">${esc(r ? r.penanganan : '')}</textarea>
    <label for="kHasil" style="margin-top:10px">Hasil / tindak lanjut</label><textarea id="kHasil">${esc(r ? r.hasil : '')}</textarea>
    <div class="grid" style="margin-top:10px"><div><label for="kRuj">Dirujuk ke (bila ada)</label><input id="kRuj" value="${esc(r ? r.rujukan_ke : '')}" placeholder="Mis. psikolog, puskesmas"></div><div><label for="kLanjut">Jadwal lanjutan</label><input id="kLanjut" type="date" value="${r && r.jadwal_lanjut ? r.jadwal_lanjut : ''}"></div></div>
    <p><button class="p" id="kSimpan">Simpan</button> <button id="kBatal">Batal</button></p></div>`;
    bkPilihPasang('km', r && r.guest_id);
    if (r && !bkMuridOleh(r.guest_id)) msg('Murid pada catatan ini tidak ada di daftar saat ini; pilih murid bila ingin mengubahnya.', true);
    $('#kBatal').onclick = () => { $('#kForm').innerHTML = ''; };
    $('#kSimpan').onclick = bkAman(async () => {
      const p = bkPilihan('km'), masalah = $('#kMasalah').value.trim();
      if ((!p && !r) || !masalah) return msg('Pilih murid dan isi masalah.', true);
      const isi = { tanggal: $('#kTgl').value || t, bentuk: $('#kBentuk').value, bidang: $('#kBidang').value, masalah, penanganan: $('#kTangani').value.trim() || null, hasil: $('#kHasil').value.trim() || null, status: $('#kStatus').value, rujukan_ke: $('#kRuj').value.trim() || null, jadwal_lanjut: $('#kLanjut').value || null };
      if (p) Object.assign(isi, p);
      if (r) await run(sb.from('bk_konseling').update(isi).eq('id', r.id)); else await run(sb.from('bk_konseling').insert({ ...isi, dicatat_oleh: BKS.guruId }));
      await MODUL.bkkonsel(); msg('Catatan konseling tersimpan.');
    });
    $('#kForm').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  gList();
  if (sedit) form(sedit);
  $('#kBaru').onclick = () => form(null);
  $('#kFc').oninput = gList;
  bkPasang(() => MODUL.bkkonsel(), async e => {
    const d = e.target.dataset;
    if (d.buka) form(rows.find(r => r.id === d.buka));
    if (d.del && confirm('Hapus catatan konseling ini? Tindakan ini tidak bisa dibatalkan.')) { await run(sb.from('bk_konseling').delete().eq('id', d.del)); MODUL.bkkonsel(); }
  }, e => { if (e.target.id === 'kFs') gList(); });
});

/* ================= ORANG TUA & SURAT PANGGILAN ================= */
MODUL.bkortu = bkJalan(async function (editId) {
  const rows = await run(sb.from('bk_ortu').select('*').order('tanggal', { ascending: false }).order('created_at', { ascending: false }).limit(1000));
  const ids = new Set(bkMurid().map(x => String(x.guest_id))), t = today(), lihat = rows.filter(r => ids.has(r.guest_id));
  const sedit = typeof editId === 'string' ? rows.find(r => r.id === editId) : null;
  $('#view').innerHTML = `<h2>Orang tua & surat panggilan</h2>${bkBar()}
  <p class="mut">Catat panggilan orang tua, home visit, telepon, dan pertemuan. Untuk panggilan, surat siap cetak dibuat otomatis; bila ada kesepakatan, surat kesepakatan juga bisa dicetak.</p>
  <p class="noprint"><button class="p" id="oBaru">Catatan baru</button></p><div id="oForm"></div><div id="msg" class="msg"></div><div id="oList" style="overflow-x:auto"></div>`;
  const gList = () => {
    $('#oList').innerHTML = lihat.length ? `<table><tr><th>Tanggal</th><th>Murid</th><th>Bentuk</th><th>Perihal</th><th>Hadir</th><th>Status</th><th></th></tr>${lihat.map(r => `<tr><td>${tglID(r.tanggal)}</td><td>${esc(r.nama)} <span class="mut">${esc(r.kelas)}</span></td><td>${esc(BK_BENTUK_O[r.bentuk])}</td><td>${esc(r.perihal)}</td><td>${r.tgl_hadir ? tglID(r.tgl_hadir) + (r.jam_hadir ? ', ' + esc(r.jam_hadir) : '') : '-'}</td><td>${bkPill(r.status === 'selesai' ? 'Selesai' : 'Direncanakan', r.status === 'selesai' ? 'prestasi' : 'terlambat')}</td>
    <td><button data-ubah="${r.id}">Ubah</button> ${r.bentuk === 'panggilan' ? `<button data-sp="${r.id}">Surat panggilan</button> ` : ''}${r.perjanjian ? `<button data-sk="${r.id}">Surat kesepakatan</button> ` : ''}<button class="d" data-del="${r.id}">Hapus</button></td></tr>`).join('')}</table>` : '<p class="mut">Belum ada catatan.</p>';
  };
  const form = r => {
    $('#oForm').innerHTML = `<div class="card" style="margin:0 0 14px;border-color:var(--blue)"><h3 style="color:var(--navy);margin-top:0">${r ? 'Ubah catatan' : 'Catatan orang tua baru'}</h3>
    <div class="grid">${bkPilihHtml('om')}<div><label for="oTgl">Tanggal catatan</label><input id="oTgl" type="date" value="${r ? r.tanggal : t}"></div>
    <div><label for="oBentuk">Bentuk</label><select id="oBentuk">${Object.entries(BK_BENTUK_O).map(([k, v]) => `<option value="${k}" ${r && r.bentuk === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    <div><label for="oStatus">Status</label><select id="oStatus"><option value="direncanakan" ${r && r.status === 'direncanakan' ? 'selected' : ''}>Direncanakan</option><option value="selesai" ${r && r.status === 'selesai' ? 'selected' : ''}>Selesai</option></select></div></div>
    <label for="oPerihal">Perihal</label><input id="oPerihal" value="${esc(r ? r.perihal : '')}" placeholder="Mis. keterlambatan yang berulang">
    <div class="grid" style="margin-top:10px"><div><label for="oHadir">Tanggal hadir (panggilan)</label><input id="oHadir" type="date" value="${r && r.tgl_hadir ? r.tgl_hadir : ''}"></div><div><label for="oJam">Jam hadir</label><input id="oJam" value="${esc(r ? r.jam_hadir : '')}" placeholder="Mis. 08.00 WIB"></div><div><label for="oPeserta">Orang tua/wali yang hadir</label><input id="oPeserta" value="${esc(r ? r.peserta : '')}"></div></div>
    <label for="oHasil">Hasil pertemuan</label><textarea id="oHasil">${esc(r ? r.hasil : '')}</textarea>
    <label for="oJanji" style="margin-top:10px">Kesepakatan (bila ada, tiap poin satu baris)</label><textarea id="oJanji">${esc(r ? r.perjanjian : '')}</textarea>
    <p><button class="p" id="oSimpan">Simpan</button> <button id="oBatal">Batal</button></p></div>`;
    bkPilihPasang('om', r && r.guest_id);
    $('#oBatal').onclick = () => { $('#oForm').innerHTML = ''; };
    $('#oSimpan').onclick = bkAman(async () => {
      const p = bkPilihan('om'), perihal = $('#oPerihal').value.trim();
      if ((!p && !r) || !perihal) return msg('Pilih murid dan isi perihal.', true);
      const isi = { tanggal: $('#oTgl').value || t, bentuk: $('#oBentuk').value, status: $('#oStatus').value, perihal, tgl_hadir: $('#oHadir').value || null, jam_hadir: $('#oJam').value.trim() || null, peserta: $('#oPeserta').value.trim() || null, hasil: $('#oHasil').value.trim() || null, perjanjian: $('#oJanji').value.trim() || null };
      if (p) Object.assign(isi, p);
      if (r) await run(sb.from('bk_ortu').update(isi).eq('id', r.id)); else await run(sb.from('bk_ortu').insert({ ...isi, dicatat_oleh: BKS.guruId }));
      await MODUL.bkortu(); msg('Catatan tersimpan.');
    });
    $('#oForm').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  gList();
  if (sedit) form(sedit);
  $('#oBaru').onclick = () => form(null);
  bkPasang(() => MODUL.bkortu(), async e => {
    const d = e.target.dataset;
    if (d.ubah) form(rows.find(r => r.id === d.ubah));
    if (d.sp) bkSuratPanggilan(rows.find(r => r.id === d.sp));
    if (d.sk) bkSuratKesepakatan(rows.find(r => r.id === d.sk));
    if (d.del && confirm('Hapus catatan ini?')) { await run(sb.from('bk_ortu').delete().eq('id', d.del)); MODUL.bkortu(); }
  });
});

/* ================= KELAS SAYA ================= */
MODUL.bkkelas = bkJalan(async function () {
  const semuaKelas = kelasDari(BKS.murid), lain = {};
  BKS.pegangan.filter(p => p.guru_id !== BKS.guruId).forEach(p => (lain[p.kelas] = lain[p.kelas] || []).push(p.nama));
  const tingkat = {}; semuaKelas.forEach(k => { const n = (/\d+/.exec(k) || ['Lainnya'])[0]; (tingkat[n] = tingkat[n] || []).push(k); });
  const jmlMurid = k => BKS.murid.filter(x => kelasX(x) === k).length;
  $('#view').innerHTML = `<h2>Kelas saya</h2>
  <p class="mut">Pilih kelas yang kamu tangani sebagai guru BK. Menu BK lainnya akan menampilkan murid dari kelas ini saja (bisa dilihat semua kelas lewat kotak "Tampilkan semua kelas"). Satu kelas boleh dipegang dua guru BK; kelas yang sudah dipilih rekanmu diberi tanda.</p>
  ${!BKS.guruId ? '<p class="msg err">Akunmu belum terhubung ke daftar Guru & Staf, jadi pilihan kelas tidak bisa disimpan. Hubungi operator.</p>' : ''}
  ${Object.keys(tingkat).sort(urut).map(n => `<div style="margin-bottom:12px"><b style="color:var(--navy)">${/^\d+$/.test(n) ? 'Kelas ' + n : n}</b> <button class="noprint" data-semua="${esc(n)}" style="padding:3px 9px;font-size:12px">Pilih semua</button><div style="margin-top:6px">${tingkat[n].map(k => `<label style="display:inline-flex;gap:6px;align-items:center;font-weight:600;margin:0 18px 8px 0"><input type="checkbox" style="width:auto" data-k="${esc(k)}" data-t="${esc(n)}" ${BKS.saya.has(k) ? 'checked' : ''}> ${esc(k)} <span class="mut" style="font-weight:400">${jmlMurid(k)} murid${lain[k] ? ' · juga dipegang ' + esc(lain[k].join(', ')) : ''}</span></label>`).join('')}</div></div>`).join('') || '<p class="mut">Belum ada data murid.</p>'}
  <p><button class="p" id="kkSimpan" ${BKS.guruId ? '' : 'disabled'}>Simpan kelas saya</button></p><div id="msg" class="msg"></div>`;
  $('#kkSimpan').onclick = bkAman(async () => {
    const baru = new Set([...document.querySelectorAll('#view [data-k]:checked')].map(i => i.dataset.k));
    const hapus = [...BKS.saya].filter(k => !baru.has(k)), tambah = [...baru].filter(k => !BKS.saya.has(k));
    if (hapus.length) await run(sb.from('bk_kelas').delete().eq('guru_id', BKS.guruId).in('kelas', hapus));
    if (tambah.length) await run(sb.from('bk_kelas').insert(tambah.map(k => ({ guru_id: BKS.guruId, kelas: k }))));
    await bkInit(true); await MODUL.bkkelas(); msg('Kelas tersimpan: ' + (baru.size ? [...baru].sort(urut).join(', ') : 'tidak ada (semua kelas ditampilkan)') + '.');
  });
  $('#view').onclick = e => { if (e.target.dataset.semua) document.querySelectorAll(`#view [data-t="${CSS.escape(e.target.dataset.semua)}"]`).forEach(i => { i.checked = true; }); };
});

/* ================= PENGATURAN ================= */
MODUL.bkatur = bkJalan(async function () {
  const amb = bkAmbang(), s = { kepsek: '', nip: '', kota: 'Jakarta', alamat: '', ...(BKS.atur.surat || {}) }, tampilOrtu = !BKS.atur.ortu || BKS.atur.ortu.tampil !== false;
  const sj = BKS.jenis;
  $('#view').innerHTML = `<h2>Pengaturan BK</h2><p class="mut">Pengaturan ini dipakai bersama oleh semua guru BK.</p><div id="msg" class="msg"></div>
  <h3 style="color:var(--navy)">Ambang poin tindak lanjut (per semester)</h3>
  <p class="mut">Siswa yang poin pelanggarannya (terlambat + atribut + pelanggaran) mencapai angka ini akan muncul di "Perlu tindak lanjut". Kosongkan untuk menonaktifkan satu tingkat.</p>
  <div class="grid">${BK_URUT.map(k => `<div><label for="a_${k}">${BK_TINGKAT[k]}</label><input id="a_${k}" type="number" min="1" value="${bkAda(amb[k]) ? amb[k] : ''}"></div>`).join('')}</div>
  <p><button class="p" id="aSimpan">Simpan ambang</button></p>
  <h3 style="color:var(--navy)">Surat</h3>
  <div class="grid"><div><label for="sKepsek">Nama kepala sekolah</label><input id="sKepsek" value="${esc(s.kepsek)}"></div><div><label for="sNip">NIP kepala sekolah</label><input id="sNip" value="${esc(s.nip)}"></div><div><label for="sKota">Kota (tanda tangan)</label><input id="sKota" value="${esc(s.kota)}"></div><div><label for="sAlamat">Alamat di kop surat</label><input id="sAlamat" value="${esc(s.alamat)}"></div></div>
  <p><button class="p" id="sSimpan">Simpan data surat</button></p>
  <h3 style="color:var(--navy)">Halaman orang tua</h3>
  <p><label style="display:inline-flex;gap:8px;font-weight:600"><input type="checkbox" id="oTampil" style="width:auto" ${tampilOrtu ? 'checked' : ''}> Tampilkan ringkasan kedisiplinan (terlambat, atribut, pelanggaran, prestasi, tindak lanjut) di Pantau Belajar Anak</label></p>
  <p class="mut">Catatan konseling dan catatan orang tua tidak pernah ditampilkan di halaman orang tua.</p>
  <h3 style="color:var(--navy)">Jenis kedisiplinan & bobot poin</h3>
  <div class="grid"><div><label for="jKat">Kategori</label><select id="jKat">${Object.entries(BK_KAT).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div><div><label for="jNama">Nama jenis</label><input id="jNama"></div><div><label for="jPoin">Poin</label><input id="jPoin" type="number" min="0" value="1"></div></div>
  <p><button id="jAdd">Tambah jenis</button></p>
  <table><tr><th>Kategori</th><th>Nama</th><th style="width:90px">Poin</th><th>Aktif</th><th></th></tr>${sj.map(j => `<tr><td>${bkPill(BK_KAT[j.kategori], j.kategori)}</td><td>${esc(j.nama)}</td><td><input type="number" min="0" data-poin="${j.id}" value="${j.poin}" style="padding:6px 8px"></td><td><input type="checkbox" style="width:auto" data-aktif="${j.id}" ${j.aktif ? 'checked' : ''}></td><td><button class="d" data-del="${j.id}">Hapus</button></td></tr>`).join('')}</table>
  <p class="mut">Jenis yang sudah dipakai sebaiknya dinonaktifkan, bukan dihapus. Riwayat lama tetap menyimpan nama dan poin saat dicatat.</p>`;
  const simpanKunci = async (kunci, nilai) => { await run(sb.from('bk_pengaturan').upsert({ kunci, nilai, updated_at: new Date().toISOString() }, { onConflict: 'kunci' })); BKS.atur[kunci] = nilai; };
  $('#aSimpan').onclick = bkAman(async () => {
    const n = {}; BK_URUT.forEach(k => { const v = $('#a_' + k).value.trim(); n[k] = v === '' ? null : Number(v); });
    const aktif = BK_URUT.filter(k => n[k] !== null), nilai = aktif.map(k => n[k]);
    if (nilai.some((v, i) => !(v >= 1) || (i && v <= nilai[i - 1]))) return msg('Ambang harus angka positif dan makin besar untuk tingkat yang lebih tinggi.', true);
    await simpanKunci('ambang', n); msg('Ambang poin tersimpan.');
  });
  $('#sSimpan').onclick = bkAman(async () => { await simpanKunci('surat', { kepsek: $('#sKepsek').value.trim(), nip: $('#sNip').value.trim(), kota: $('#sKota').value.trim() || 'Jakarta', alamat: $('#sAlamat').value.trim() }); msg('Data surat tersimpan.'); });
  $('#jAdd').onclick = bkAman(async () => {
    const nama = $('#jNama').value.trim(), poin = Number($('#jPoin').value);
    if (!nama || !(poin >= 0)) return msg('Isi nama jenis dan poin.', true);
    const { error } = await sb.from('bk_jenis').insert({ kategori: $('#jKat').value, nama, poin, urut: 500 });
    if (error) return msg(error.message.includes('duplicate') ? 'Jenis itu sudah ada.' : error.message, true);
    await bkInit(true); await MODUL.bkatur(); msg('Jenis ditambahkan.');
  });
  bkPasang(() => MODUL.bkatur(), async e => {
    const d = e.target.dataset;
    if (d.del && confirm('Hapus jenis ini? Catatan lama tetap tersimpan.')) { await run(sb.from('bk_jenis').delete().eq('id', d.del)); await bkInit(true); MODUL.bkatur(); }
  }, async e => {
    const d = e.target.dataset;
    if (e.target.id === 'oTampil') { await simpanKunci('ortu', { tampil: e.target.checked }); msg(e.target.checked ? 'Ringkasan kedisiplinan tampil di halaman orang tua.' : 'Ringkasan kedisiplinan disembunyikan dari halaman orang tua.'); }
    if (d.poin) { const v = Number(e.target.value); if (!(v >= 0)) return msg('Poin tidak valid.', true); await run(sb.from('bk_jenis').update({ poin: v }).eq('id', d.poin)); sj.find(j => j.id === d.poin).poin = v; msg('Poin diperbarui. Berlaku untuk catatan baru.'); }
    if (d.aktif) { await run(sb.from('bk_jenis').update({ aktif: e.target.checked }).eq('id', d.aktif)); sj.find(j => j.id === d.aktif).aktif = e.target.checked; msg(e.target.checked ? 'Jenis diaktifkan.' : 'Jenis dinonaktifkan: tidak muncul di form baru.'); }
  });
});
