/* ============================================================
   DATA SEKOLAH TERPUSAT — ubah angka/daftar DI SINI SAJA.
   Semua halaman (beranda, profil sekolah, profil lulusan, ekskul & club,
   footer) membaca file ini, jadi sekali ubah langsung tersinkron.
   ============================================================ */
(function () {
  const D = {
    // ---- Identitas & akreditasi ----
    tahunBerdiri: 2002,
    tahunAjaran: '2025/2026',          // tahun ajaran terakhir yang dihitung di teks sejarah
    akreditasiPredikat: 'A',
    akreditasiNilai: 98,
    akreditasiNilaiPertama: '95,58',   // akreditasi pertama
    akreditasiNilaiKedua: 97,          // perpanjangan 2010
    akreditasiTahunTerbaru: 2021,

    // ---- Lulusan ----
    angkatan: 18,                      // jumlah angkatan yang sudah diluluskan
    totalLulusan: 745,                 // angka pasti (dipakai di teks sejarah)
    lulusanBeranda: 700,               // angka bulat untuk beranda, tampil "700+"
    rataUN: '> 80',                    // kosongkan ('') bila tidak ingin ditampilkan di Profil Lulusan

    // ---- SDM & rombel ----
    guruPegawaiMin: 45,                // teks sejarah: "lebih dari 45 orang"
    guruTendikBeranda: 50,             // angka bulat untuk beranda, tampil "50+"
    rombelPerTingkat: 3,
    muridPerKelas: 25,

    // ---- Ekstrakurikuler & Club (jumlahnya otomatis dihitung) ----
    ekskul: ['Iqro', 'KPPC', 'Tari', 'Bahasa Inggris', 'Lukis', 'Sains', 'Coding', 'Robotik', 'Musik', 'Panahan', 'Basket', 'Pencak Silat', 'Renang', 'Taekwondo'],
    club: ['Tahfidz', 'Marawis', 'PMR', 'Paduan Suara', 'MIPAS', 'English Club', 'Pramuka', 'Dokter Kecil']
  };
  D.jumlahEkskul = D.ekskul.length;
  D.jumlahClub = D.club.length;
  window.DATA_SEKOLAH = D;

  // Isi otomatis elemen bertanda data-s="namaKunci" (mis. <data data-s="akreditasiNilai">98</data>).
  function bind() {
    document.querySelectorAll('[data-s]').forEach(function (el) {
      var v = D[el.dataset.s];
      if (v !== undefined && !Array.isArray(v)) el.textContent = v;
    });
  }
  window.DATA_SEKOLAH_BIND = bind;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();
})();
