const PAGES = {
  spmb: 'spmb.html',
  profil: 'profil.html',
  guru: 'guru.html',
  fasilitas: 'fasilitas.html',
  lulusan: 'lulusan.html',
  kalender: 'kalender.html',
  jurnal: 'jurnal.html',
  ekskul: 'kegiatan-sekolah.html?j=ekskul',
  club: 'kegiatan-sekolah.html?j=club',
  unggulan: 'kegiatan-sekolah.html?j=unggulan',
  info: 'info.html',
  galeri: 'galeri.html',
  'info-admin': 'info-admin.html',
  'buku-tamu': 'buku-tamu.html',
  kelas: 'kelas.html',
  kegiatan: 'kegiatan.html',
  ortu: 'ortu.html',
  'si-taqwa': 'si-taqwa.html'
};
const TITLES = {
  beranda: 'SDS Islam At-Taqwa Rawamangun',
  spmb: 'SPMB — Mau jadi siswa At-Taqwa?',
  profil: 'Profil Sekolah',
  guru: 'Guru & Staff',
  fasilitas: 'Fasilitas Sekolah',
  lulusan: 'Profil Lulusan',
  kalender: 'Kalender Pendidikan',
  jurnal: 'Jurnal Murid',
  ekskul: 'Ekstrakurikuler',
  club: 'Club',
  unggulan: 'Kegiatan Unggulan',
  info: 'Info Terbaru',
  galeri: 'Galeri Prestasi Siswa',
  'info-admin': 'Kelola Info Terbaru',
  'buku-tamu': 'Buku Tamu Sekolah',
  kelas: 'Administrasi Guru dan Staf',
  kegiatan: 'Kegiatan Sekolah (Panitia)',
  ortu: 'Pantau Belajar Anak',
  'si-taqwa': 'SI-TAQWA — Sistem Informasi Terpadu At-Taqwa'
};
// ===== Sinkronisasi ke SLiMS =====
const SLIMS_SYNC_URL = ''; // Isi dengan URL tunnel: https://<url>.trycloudflare.com/slims/slims_sync.php?pass=rahasia123

function showLoading(show) {
  const btn = document.getElementById('syncSlimsBtn');
  if (show) {
    btn.disabled = true;
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" style="margin-right: 0.5rem;"><path d="M12 5.75v12.17l-3.21 2.06a1 1 0 0 1-1.63-.95l.93-2.86a1 1 0 0 1 1.52-.6l2.55 1.06a1 1 0 0 1 .81.41l-1.88 5.28a1 1 0 0 1-.55.87l-2.86-1.91a1 1 0 0 1-.98-.6l-.93 2.86a1 1 0 0 1-.6 1.52l-2.06 3.21a1 1 0 0 1-.41.81l-1.06 2.55a1 1 0 0 1-.6.81l-5.28-1.88a1 1 0 0 1-.87-.55l-1.91-2.86a1 1 0 0 1-.6-.98l-2.86 1.91a1 1 0 0 1-.98-.6l-2.86-1.91a1 1 0 0 1-1.52-.6l-.93 2.86a1 1 0 0 1-.41.81l-2.55-1.06a1 1 0 0 1-.81-.41l5.28 1.88a1 1 0 0 1 .41.81l1.91 2.86a1 1 0 0 1 .6.98l2.86-1.91a1 1 0 0 1 .6-.98l2.86 1.91a1 1 0 0 1 1.52.6l.93-2.86a1 1 0 0 1 1.52.6l2.06-3.21a1 1 0 0 1 .41-.81l1.06-2.55a1 1 0 0 1 .6-.81l5.28-1.88a1 1 0 0 1 .81-.41l1.91-2.86a1 1 0 0 1 .6-.98l2.86 1.91a1 1 0 0 1 1.52.6l.93-2.86a1 1 0 0 1 1.52.6l2.06-3.21a1 1 0 0 1 .41-.81l-1.06-2.55a1 1 0 0 1-.6-.81l-5.28 1.88a1 1 0 0 1-.81-.41l-1.91 2.86a1 1 0 0 1-.6.98l-2.86-1.91a1 1 0 0 1-.98-.6l-2.86 1.91a1 1 0 0 1-.6-.98l-2.86-1.91a1 1 0 0 1-1.52-.6l-.93 2.86a1 1 0 0 1-.41.81l-2.55 1.06a1 1 0 0 1-.81.41l5.28-1.88a1 1 0 0 1-.41-.81l-1.91-2.86a1 1 0 0 1-.6-.98l-2.86-1.91a1 1 0 0 1-1.52-.6l-.93-2.86a1 1 0 0 1-1.52-.6l-2.06 3.21a1 1 0 0 1-.41.81l1.06 2.55a1 1 0 0 1 .6.81l5.28 1.88a1 1 0 0 1 .81.41l1.91 2.86a1 1 0 0 1 .6.98l2.86-1.91a1 1 0 0 1 .6-.98l2.86 1.91a1 1 0 0 1 1.52.6l.93-2.86a1 1 0 0 1 1.52.6l2.06-3.21a1 1 0 0 1 .41-.81l-1.06-2.55a1 1 0 0 1-.6-.81l-5.28-1.88a1 1 0 0 1-.81-.41l-1.91 2.86a1 1 0 0 1-.6.98l-2.86-1.91a1 1 0 0 1-.98-.6l-2.86 1.91a1 1 0 0 1-.6-.98l-2.86-1.91a1 1 0 0 1-1.52-.6z';


// ===== Dropdown "Profil" dan "Kegiatan" (panel fixed agar tidak terpotong menu yang bisa digulir) =====
const DDS = [['ddBtnP', 'ddpP'], ['ddBtnK', 'ddpK']].map(([b, p]) => ({ btn: document.getElementById(b), pnl: document.getElementById(p) }));
// Dropdown SI-TAQWA baru dengan fitur Pantau Anak, Buku Tamu, Guru/Staff, Panitia Kegiatan
const DDSI = { btn: document.getElementById('siDropdown'), pnl: document.getElementById('ddpSI') };
function ddClose() { DDS.forEach(d => { d.pnl.hidden = true; d.btn.setAttribute('aria-expanded', 'false'); }); }
DDS.forEach(d => {
  d.btn.onclick = e => {
    e.stopPropagation();
    const buka = d.pnl.hidden;
    ddClose();
    if (!buka) return;
    d.pnl.hidden = false;
    const r = d.btn.getBoundingClientRect(), w = d.pnl.offsetWidth;
    d.pnl.style.top = (r.bottom + 6) + 'px';
    d.pnl.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px';
    d.btn.setAttribute('aria-expanded', 'true');
  };
});
DDSI.btn.onclick = e => {
  e.stopPropagation();
  const buka = DDSI.pnl.hidden;
  ddClose();
  if (!buka) return;
  DDSI.pnl.hidden = false;
  const r = DDSI.btn.getBoundingClientRect(), w = DDSI.pnl.offsetWidth;
  DDSI.pnl.style.top = (r.bottom + 6) + 'px';
  DDSI.pnl.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px';
  DDSI.btn.setAttribute('aria-expanded', 'true');
};
document.addEventListener('click', e => { if (!DDS.some(d => d.pnl.contains(e.target)) && !DDSI.btn.contains(e.target)) ddClose(); });
addEventListener('keydown', e => { if (e.key === 'Escape') { const o = DDS.find(d => !d.pnl.hidden); ddClose(); if (o) o.btn.focus(); } });
addEventListener('resize', ddClose);
addEventListener('blur', ddClose);
document.querySelector('.menu').addEventListener('scroll', ddClose);
  d.btn.onclick = e => {
    e.stopPropagation();
    const buka = d.pnl.hidden;
    ddClose();
    if (!buka) return;
    d.pnl.hidden = false;
    const r = d.btn.getBoundingClientRect(), w = d.pnl.offsetWidth;
    d.pnl.style.top = (r.bottom + 6) + 'px';
    d.pnl.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px';
    d.btn.setAttribute('aria-expanded', 'true');
  };
});
document.addEventListener('click', e => { if (!DDS.some(d => d.pnl.contains(e.target))) ddClose(); });
addEventListener('keydown', e => { if (e.key === 'Escape') { const o = DDS.find(d => !d.pnl.hidden); ddClose(); if (o) o.btn.focus(); } });
addEventListener('resize', ddClose);
addEventListener('blur', ddClose);                       // klik ke dalam iframe
document.querySelector('.menu').addEventListener('scroll', ddClose);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, KATS = ['pengumuman', 'agenda', 'surat', 'kegiatan', 'prestasi', 'lainnya'];
let adminMasuk = false, rAktif = '', pustakawanMasuk = false;
function terapkanAdmin() { document.body.classList.toggle('admin-penuh', adminMasuk && rAktif === 'kelas'); }
addEventListener('message', e => {
  if (e.origin !== location.origin || !e.data || typeof e.data.adminMode !== 'boolean') return;
  adminMasuk = e.data.adminMode; terapkanAdmin();
});
addEventListener('message', e => {
  if (e.origin !== location.origin || !e.data || typeof e.data.pustakawanMode !== 'boolean') return;
  pustakawanMasuk = e.data.pustakawanMode;
  toggleSlimsAkses();
});
function route() {
  const [r0, seg = '', mode = ''] = (location.hash.slice(1) || 'beranda').split('/');
  let r = r0;
  // #info/<id> membuka info tertentu, #info/prestasi membuka daftar berkategori prestasi
  const q = r === 'info' ? (UUID.test(seg) ? '?id=' + seg + (mode === 'saja' ? '&solo=1' : '') : KATS.includes(seg) ? '?kat=' + seg : '') : r === 'jurnal' && UUID.test(seg) ? '?id=' + seg : r === 'kalender' && /^\d{4}-\d{2}$/.test(seg) ? '?bulan=' + seg : '';
  const admin = r === 'admin';            // tautan lama /#admin tetap dikenali
  if (admin) r = 'buku-tamu';
  if (r !== 'beranda' && !PAGES[r]) r = 'beranda';

  document.querySelectorAll('.menu a, .ddp a').forEach(a => a.classList.toggle('on', a.dataset.r === (r === 'info-admin' ? 'info' : r)));
  document.querySelector('.menu a.si').classList.toggle('on', ['si-taqwa', 'ortu', 'buku-tamu', 'kelas', 'kegiatan'].includes(r));
  document.getElementById('ddBtnK').classList.toggle('on', ['jurnal', 'ekskul', 'club', 'unggulan'].includes(r));
  document.getElementById('ddBtnP').classList.toggle('on', ['profil', 'guru', 'fasilitas', 'lulusan', 'kalender'].includes(r));
  document.getElementById('ddpSI').hidden = !['si-taqwa', 'ortu', 'buku-tamu', 'guru', 'kegiatan'].includes(r);
  ddClose();
  document.getElementById('cta').classList.toggle('on', r === 'spmb');
  document.getElementById('beranda').hidden = r !== 'beranda';
  for (const k in PAGES) {
    const f = document.getElementById('f-' + k);
    f.hidden = k !== r;
    // halaman dimuat sekali saat pertama dibuka, lalu dipertahankan (login dan isian tidak hilang)
    const qk = k === r ? q : '';
    if (k === r && (!f.getAttribute('src') || admin || f.dataset.q !== qk)) { f.dataset.q = qk; f.src = PAGES[k] + qk + (admin ? '?t=' + Date.now() + '#admin' : ''); }
  }
  document.title = TITLES[r];
  rAktif = r; terapkanAdmin();
}
// Agenda terdekat dari kalender pendidikan (data-kalender.js). Disembunyikan bila tidak ada agenda ke depan.
(function () {
  const K = window.KALENDER; if (!K) return;
  const hari = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date());
  const BLP = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'], BLS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const p = s => { const [y, m, d] = s.split('-').map(Number); return { y, m, d }; };
  const label = (a, b) => { const x = p(a), y = p(b); return a === b ? `${x.d} ${BLP[x.m - 1]} ${x.y}` : x.m === y.m && x.y === y.y ? `${x.d}–${y.d} ${BLP[x.m - 1]} ${x.y}` : `${x.d} ${BLS[x.m - 1]} – ${y.d} ${BLS[y.m - 1]} ${y.y}`; };
  const kls = k => !k || k.length >= 6 ? 'Semua kelas' : (k.length > 1 && Math.max(...k) - Math.min(...k) === k.length - 1 ? `Kelas ${Math.min(...k)}–${Math.max(...k)}` : 'Kelas ' + k.join(', '));
  const nama = { libur: 'Libur', ujian: 'Ujian', rapor: 'Rapor', kegiatan: 'Kegiatan' };
  const next = K.acara.filter(e => e.selesai >= hari && e.jenis !== 'rapat').sort((a, b) => a.mulai.localeCompare(b.mulai) || a.selesai.localeCompare(b.selesai)).slice(0, 4);
  if (!next.length) return;
  document.getElementById('agdList').innerHTML = next.map(e => {
    const mulai = e.mulai < hari ? hari : e.mulai, d = p(mulai), bln = (e.mulai < hari ? hari : e.mulai).slice(0, 7);
    const judul = String(e.judul).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
    return `<a class="ai" href="#kalender/${bln}">
      <div class="ad"><b>${d.d}</b><span>${BLS[d.m - 1]}</span></div>
      <div class="ab">
        <span class="aj ${e.jenis}">${nama[e.jenis] || 'Kegiatan'}</span>
        <b>${judul}</b>
        <span class="at">${e.mulai <= hari ? 'Sedang berlangsung · ' : ''}${label(e.mulai, e.selesai)} · ${kls(e.kelas)}</span>
      </div>
    </a>`;
  }).join('');
  document.getElementById('agd').hidden = false;
})();
// Cuplikan info terbaru (daftar ke bawah, maksimal 3, dengan gambar lampiran bila ada) di beranda (diam-diam dilewati jika belum ada data / belum disiapkan)
fetch('/api/info?utama=1&limit=3').then(r => r.json()).then(d => {
  if (!d.info || !d.info.length) return;
  d.info = d.info.slice(0, 3);
  const KAT = { pengumuman: 'Pengumuman', agenda: 'Agenda', surat: 'Surat Edaran', kegiatan: 'Berita Kegiatan', prestasi: 'Prestasi', lainnya: 'Lainnya' };
  document.getElementById('latestList').innerHTML = d.info.map(x => {
    const u = /^https?:\/\//i.test(x.lampiran_url || '') && /\.(jpe?g|png|webp)(\?|$)/i.test(x.lampiran_url) ? x.lampiran_url : '';
    const ph = u ? `<div class="ph"><img src="${esc(u)}" alt="" loading="lazy"></div>` : `<div class="ph no"><img src="logo-at-taqwa.png" alt=""></div>`;
    return `<a class="li" href="#info${UUID.test(x.id) ? '/' + x.id : ''}">${ph}<div class="bd2"><span class="kt">${esc(KAT[x.kategori] || 'Info')}</span><b>${esc(x.judul)}</b><span class="tg">${new Date(x.tanggal_terbit + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div></a>`;
  }).join('');
  document.getElementById('latest').hidden = false;
}).catch(() => {});

// ===== Hero: pita nilai berjalan + usia sekolah =====
(() => {
  const NILAI = ['Belajar Nyaman', 'Perilaku Islami', 'Insan Bertaqwa', 'Cerdas & Berakhlak Mulia', 'Sehat Rohani & Jasmani', 'Belajar Sepanjang Hayat'];   // ubah teks pita di sini
  const g = NILAI.map(t => `<span>${t.replace(/&/g, '&amp;')}<img src="logo-at-taqwa.png" alt=""></span>`).join('');
  const grup = `<div class="grp">${g}${g}</div>`;   // diulang agar cukup panjang, lalu digandakan agar putarannya mulus
  document.getElementById('hxMq').innerHTML = grup + grup;
})();

// ===== Sambutan Kepala Sekolah (hanya tampil di beranda) =====
const SAMBUTAN = { judul: 'Sambutan Kepala Sekolah', nama: 'Ibu Nurbaiti, S.Pd.', jabatan: 'Kepala Sekolah',
  isi: ['Semoga anak At-Taqwa menjadi anak yang cerdas, sehat, sukses bertaqwa'] };
(() => {
  document.getElementById('sbJudul').textContent = SAMBUTAN.judul;
  document.getElementById('sbIsi').innerHTML = SAMBUTAN.isi.map(t => `<p>“${esc(t)}”</p>`).join('');
  document.getElementById('sbBy').innerHTML = SAMBUTAN.nama ? `${esc(SAMBUTAN.nama)}<span>${esc(SAMBUTAN.jabatan)}</span>` : '';
  document.querySelector('.vs .qt').hidden = !SAMBUTAN.isi.length;
})();

// ===== Video terbaru YouTube (otomatis dari /api/youtube) =====
// Tampil sebagai thumbnail; diputar di tempat saat diklik. Judul tertaut ke YouTube bila embed diblokir.
fetch('/api/youtube').then(r => r.json()).then(d => {
  const v = (d.videos || []).filter(x => /^[\w-]{11}$/.test(x.id));
  if (!v.length) {
    console.warn('Video YouTube kosong:', d.alasan || '(tanpa keterangan)');
    if (!/^UU[\w-]{22}$/.test(d.playlist || '')) return;
    // Cadangan: pemutar daftar unggahan kanal (tidak butuh feed)
    document.getElementById('ytList').innerHTML = `
      <div class="v" style="grid-column:1/-1">
        <div class="fr">
          <iframe
            src="https://www.youtube.com/embed/videoseries?list=${d.playlist}"
            title="Video terbaru SDS Islam At-Taqwa"
            loading="lazy"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerpolicy="strict-origin-when-cross-origin"
            allowfullscreen>
          </iframe>
        </div>
      </div>`;
    document.getElementById('video').hidden = false;
    return;
  }
  document.getElementById('ytList').innerHTML = v.map(x => `
    <div class="v">
      <div class="fr">
        <button type="button" class="play" data-id="${x.id}" aria-label="Putar: ${esc(x.judul)}"
          style="background-image:url(https://i.ytimg.com/vi/${x.id}/hqdefault.jpg)">
        </button>
      </div>
      <div class="t">
        <a href="https://www.youtube.com/watch?v=${x.id}" target="_blank" rel="noopener">${esc(x.judul)}</a>
      </div>
    </div>`).join('');
  document.getElementById('ytList').onclick = e => {
    const b = e.target.closest('.play'); if (!b) return;
    b.parentNode.innerHTML = `
      <iframe
        src="https://www.youtube.com/embed/${b.dataset.id}?autoplay=1&rel=0"
        title="Video sekolah"
        allow="autoplay; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerpolicy="strict-origin-when-cross-origin"
        allowfullscreen>
      </iframe>`;
  };
  document.getElementById('video').hidden = false;
}).catch(e => console.warn('Video YouTube gagal dimuat', e));

// ===== Prestasi siswa: foto yang diunggah admin (Kelola Info > Galeri Prestasi) DIGABUNG dengan gambar lampiran Info berkategori Prestasi =====
let PRF = [], prI = 0;
fetch('/api/galeri?limit=24').then(r => r.json()).then(d => {
  PRF = (d.foto || []).filter(x => /^https?:\/\//i.test(x.foto || ''));
  if (!PRF.length) return;
  // Galeri berjalan otomatis (marquee): satu kelompok diulang sampai cukup panjang, lalu digandakan agar putarannya mulus tanpa putus.
  const ulang = Math.max(1, Math.ceil(10 / PRF.length));
  const kartu = (i, dup) => `<a href="#galeri" data-i="${i}" ${dup ? 'aria-hidden="true" tabindex="-1"' : ''} aria-label="${esc(PRF[i].judul || 'Foto prestasi')}"><img src="${esc(PRF[i].foto)}" alt="${dup ? '' : esc(PRF[i].judul || 'Foto prestasi siswa')}" loading="lazy" draggable="false"></a>`;
  const grup = dup => `<div class="grp">${Array.from({ length: ulang }, () => PRF.map((_, i) => kartu(i, dup)).join('')).join('')}</div>`;
  const el = document.getElementById('prList');
  el.innerHTML = `<div class="trk">${grup(false)}${grup(true)}</div>`;
  el.style.setProperty('--dur', Math.max(30, PRF.length * ulang * 4) + 's');   // ~4 detik per foto
  el.addEventListener('touchstart', () => el.classList.add('tahan'), { passive: true });
  el.addEventListener('touchend', () => setTimeout(() => el.classList.remove('tahan'), 2500), { passive: true });
  if (d.total > PRF.length) document.getElementById('prAll').textContent = `Lihat semua (${d.total} foto) →`;
  document.getElementById('prestasi').hidden = false;
}).catch(() => {});
// Lightbox sederhana untuk foto di beranda; foto dari Info punya tautan "Baca beritanya".
const $lb = id => document.getElementById(id);
function prBuka(i) {
  prI = (i + PRF.length) % PRF.length; const x = PRF[prI], esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  $lb('lbI').src = x.foto; $lb('lbI').alt = x.judul || 'Foto prestasi siswa';
  $lb('lbT').innerHTML = (x.judul ? `<div>${esc(x.judul)}</div>` : '') + (x.info_id && UUID.test(x.info_id) ? `<a href="#info/${x.info_id}" id="lbA">Baca beritanya →</a>` : '');
  $lb('lbP').hidden = $lb('lbN').hidden = PRF.length < 2;
  if ($lb('lb').hidden) { $lb('lb').hidden = false; $lb('lbX').focus(); }
}
const prTutup = () => { $lb('lb').hidden = true; $lb('lbI').src = ''; };
$lb('prList').onclick = e => { const a = e.target.closest('a[data-i]'); if (!a) return; e.preventDefault(); prBuka(+a.dataset.i); };
$lb('lbX').onclick = prTutup; $lb('lbP').onclick = () => prBuka(prI - 1); $lb('lbN').onclick = () => prBuka(prI + 1);
$lb('lb').onclick = e => { if (e.target.id === 'lb' || e.target.id === 'lbA') prTutup(); };
addEventListener('keydown', e => { if ($lb('lb').hidden) return; if (e.key === 'Escape') prTutup(); if (e.key === 'ArrowLeft') prBuka(prI - 1); if (e.key === 'ArrowRight') prBuka(prI + 1); });
addEventListener('hashchange', route);
route();

/* Hitung bergerak untuk angka di beranda (berhenti di angka akhir). */
(function () {
  var els = document.querySelectorAll('.hx .st .cnt');
  if (!els.length) return;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function run(el) {
    var DS = window.DATA_SEKOLAH || {}, to = +(DS[el.dataset.s] != null ? DS[el.dataset.s] : el.dataset.to), dur = 1800, t0 = null;
    if (reduce) { el.textContent = to; return; }
    el.textContent = '0';
    function tick(t) {
      if (t0 === null) t0 = t;
      var p = Math.min((t - t0) / dur, 1), e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(to * e);
      if (p < 1) requestAnimationFrame(tick); else el.textContent = to;
    }
    requestAnimationFrame(tick);
  }
  function go() { els.forEach(run); }
  if ('IntersectionObserver' in window) {
    var started = false, io = new IntersectionObserver(function (en) {
      if (!started && en.some(function (x) { return x.isIntersecting; })) { started = true; io.disconnect(); go(); }
    }, { threshold: .3 });
    io.observe(document.querySelector('.hx .st'));
  } else go();
})();
// ===== Sinkronisasi ke SLiMS =====
const SLIMS_SYNC_URL = ''; // Isi dengan URL tunnel: https://<url>.trycloudflare.com/slims/slims_sync.php?pass=rahasia123

const syncSlimsBtn = document.getElementById('syncSlimsBtn');

syncSlimsBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  if (!confirm('Yakin ingin melakukan sinkronisasi data ke SLiMS?')) return;
  
  showLoading(true);
  try {
    const response = await fetch(SLIMS_SYNC_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      alert('Sinkronisasi berhasil!\n\n' + (data.message || 'Data berhasil disinkronkan ke SLiMS'));
    } else {
      alert('Error: ' + (data.error || data.message || 'Gagal sinkronisasi'));
    }
  } catch (error) {
    alert('Terjadi error: ' + error.message);
  } finally {
    showLoading(false);
  }
});

function showLoading(show) {
  const btn = document.getElementById('syncSlimsBtn');
  if (show) {
    btn.disabled = true;
    btn.innerHTML = 'Loading <span class="spinner"></span>';
  } else {
    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" style="margin-right: 0.5rem;"><path d="M2 3h20v2H2V3zm2-1h16v11H4V2zm4 5c5.523 0 10 4.477 10 10s-4.477 10-10 10S4 18.523 4 13s4.477-10 10-10zm-2.1 6.1l1.415 1.415 1.722-1.722-1.415-1.415-1.722 1.722zM 9.984 9.984l1.414 1.414 2.125-2.125-1.414-1.414L9.984 7.868 8.262 6.146z"/></svg> Sinkronkan SLiMS';
  }
}

function toggleSlimsAkses() {
  const slimsLink = document.querySelector('a[href="http://localhost:8888/slims/"]');
  const syncBtn = document.getElementById('syncSlimsBtn');
  if (pustakawanMasuk) {
    // Show SLiMS access for Pustakawan
    if (slimsLink) slimsLink.hidden = false;
    if (syncBtn) syncBtn.hidden = false;
    // Enable the sync button
    syncBtn.disabled = false;
  } else {
    // Hide SLiMS access for non-Pustakawan
    if (slimsLink) slimsLink.hidden = true;
    if (syncBtn) syncBtn.hidden = true;
    syncBtn.disabled = true;
  }
}

// Initialize
showLoading(false);
toggleSlimsAkses();
}
