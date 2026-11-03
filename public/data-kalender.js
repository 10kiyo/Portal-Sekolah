/* ============================================================
   DATA KALENDER PENDIDIKAN — ubah tanggal/kegiatan DI SINI SAJA.
   Dipakai oleh halaman Kalender Pendidikan (kalender.html), tombol di Info Terbaru,
   dan kartu "Agenda terdekat" di Beranda. Sumber: PDF resmi sekolah (public/kalender-pendidikan-2026-2027.pdf).

   Cara menambah kegiatan: tambah satu baris E(...) di daftar `acara`:
     E('tanggal mulai', 'tanggal selesai atau null', 'jenis', 'Judul kegiatan', [kelas yang ikut] atau null, 'catatan (opsional)')
   - Tanggal format 'TTTT-BB-HH', mis. '2026-07-13'.
   - jenis : 'libur' | 'ujian' | 'rapor' | 'kegiatan' | 'rapat'  (rapat = khusus guru)
   - kelas : [1,2] = hanya kelas 1-2; null = semua kelas.
   Untuk tahun ajaran baru: ganti `tahunAjaran`, `pdf`, `bulan`, `hbe`, dan isi ulang daftar `acara`.
   ============================================================ */
(function () {
  const E = (mulai, selesai, jenis, judul, kelas, ket) => ({ mulai, selesai: selesai || mulai, jenis, judul, kelas: kelas || null, ket: ket || '' });
  const K = {
    tahunAjaran: '2026/2027',
    pdf: 'kalender-pendidikan-2026-2027.pdf',
    ditetapkan: 'Jakarta, 30 Juni 2026',
    kepala: 'Nurbaiti, S.Pd',
    // Bulan yang bisa dibuka di kalender (urut). Bulan terakhir hanya memuat libur akhir semester dan awal tahun ajaran berikutnya.
    bulan: ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05', '2027-06', '2027-07'],
    semester: { '2026-07': 'Ganjil', '2026-08': 'Ganjil', '2026-09': 'Ganjil', '2026-10': 'Ganjil', '2026-11': 'Ganjil', '2026-12': 'Ganjil', '2027-01': 'Genap', '2027-02': 'Genap', '2027-03': 'Genap', '2027-04': 'Genap', '2027-05': 'Genap', '2027-06': 'Genap' },
    // Hari Belajar Efektif per bulan (sesuai PDF)
    hbe: { '2026-07': 15, '2026-08': 19, '2026-09': 22, '2026-10': 22, '2026-11': 21, '2026-12': 13, '2027-01': 19, '2027-02': 17, '2027-03': 12, '2027-04': 22, '2027-05': 18, '2027-06': 18 },
    jenis: {
      libur: 'Libur', ujian: 'Ujian & asesmen', rapor: 'Rapor', kegiatan: 'Kegiatan', rapat: 'Rapat guru'
    },
    acara: [
      // ---------- Juli 2026 ----------
      E('2026-07-13', null, 'kegiatan', 'Hari pertama sekolah'),
      E('2026-07-13', '2026-07-17', 'kegiatan', 'MPLS Ramah', [1, 2]),
      E('2026-07-17', null, 'kegiatan', 'Peresmian Tahun Ajaran 2026/2027 (gabungan)'),
      E('2026-07-20', '2026-07-31', 'kegiatan', 'Informasi pendaftaran Ekskul/Club 2026/2027'),
      E('2026-07-25', null, 'kegiatan', 'Penjelasan program sekolah kelas 1-6 dan pemilihan WOK'),
      // ---------- Agustus 2026 ----------
      E('2026-08-14', null, 'kegiatan', 'Peringatan Hari Pramuka'),
      E('2026-08-17', null, 'libur', 'Hari Kemerdekaan RI'),
      E('2026-08-17', null, 'kegiatan', 'Upacara peringatan HUT RI', [4, 5, 6]),
      E('2026-08-18', null, 'kegiatan', 'Lomba-lomba HUT RI'),
      E('2026-08-24', null, 'kegiatan', 'Peringatan Maulid Nabi Muhammad SAW'),
      E('2026-08-25', null, 'libur', 'Libur Maulid Nabi'),
      // ---------- September 2026 ----------
      E('2026-09-14', '2026-09-18', 'ujian', 'STS Semester Ganjil'),
      E('2026-09-28', null, 'kegiatan', 'Market Day', [6]),
      E('2026-09-29', null, 'kegiatan', 'Market Day', [5]),
      E('2026-09-30', null, 'kegiatan', 'Market Day', [4]),
      // ---------- Oktober 2026 ----------
      E('2026-10-05', null, 'rapor', 'Pembagian hasil belajar tengah Semester 1'),
      E('2026-10-06', '2026-10-15', 'kegiatan', 'Outing Class'),
      E('2026-10-16', null, 'kegiatan', 'Peringatan Milad YMAKR'),
      E('2026-10-31', null, 'kegiatan', 'Open House TK Luar dan SD', [1, 2, 3]),
      // ---------- November 2026 ----------
      E('2026-11-07', null, 'kegiatan', 'Persari', [1, 2, 3]),
      E('2026-11-10', null, 'kegiatan', 'Puncak Bulan Bahasa & Peringatan Hari Pahlawan'),
      E('2026-11-20', '2026-11-21', 'kegiatan', 'Perjusa', [4, 5, 6]),
      E('2026-11-23', '2026-11-27', 'kegiatan', 'Delapan Dimensi Profil Lulusan'),
      E('2026-11-30', '2026-12-04', 'ujian', 'Asesmen Sumatif Akhir Semester Ganjil (ASAS)'),
      // ---------- Desember 2026 ----------
      E('2026-12-08', '2026-12-12', 'kegiatan', 'Kreativitas Peserta Didik (Class Meeting)'),
      E('2026-12-18', null, 'rapor', 'Tanggal penulisan rapor'),
      E('2026-12-21', '2026-12-31', 'libur', 'Libur akhir Semester Ganjil'),
      E('2026-12-21', '2026-12-23', 'rapat', 'Rapat kerja persiapan Semester II'),
      E('2026-12-25', null, 'libur', 'Libur umum'),
      E('2026-12-29', null, 'rapor', 'Pembagian hasil belajar Semester Ganjil (rapor)'),
      // ---------- Januari 2027 ----------
      E('2027-01-01', null, 'libur', 'Libur Tahun Baru Masehi & libur semester'),
      E('2027-01-04', null, 'kegiatan', 'Hari pertama masuk sekolah', null, 'Layanan ekskul dan club Semester II dimulai.'),
      E('2027-01-05', null, 'libur', 'Libur Isra Miraj'),
      E('2027-01-15', null, 'kegiatan', 'Peringatan Isra Miraj Nabi Muhammad SAW'),
      E('2027-01-25', '2027-01-27', 'kegiatan', 'Market Day', [1, 2, 3]),
      // ---------- Februari 2027 ----------
      E('2027-02-05', null, 'kegiatan', 'Tarhib Ramadhan 1448 H'),
      E('2027-02-08', '2027-02-10', 'libur', 'Libur awal Ramadhan 1448 H'),
      // ---------- Maret 2027 ----------
      E('2027-03-05', null, 'kegiatan', 'Sanlat dan buka puasa bersama', [4, 5, 6]),
      E('2027-03-08', '2027-03-19', 'libur', 'Libur Ramadhan dan lebaran'),
      E('2027-03-22', null, 'kegiatan', 'Halal Bihalal'),
      E('2027-03-26', null, 'libur', 'Libur umum: Wafat Yesus Kristus'),
      E('2027-03-29', '2027-04-02', 'ujian', 'STS kelas 1-5 dan ASAT kelas 6'),
      // ---------- April 2027 ----------
      E('2027-04-12', null, 'rapor', 'Pembagian hasil belajar tengah Semester 2'),
      E('2027-04-12', '2027-04-20', 'kegiatan', 'Outing Class'),
      E('2027-04-21', null, 'kegiatan', 'Peringatan Hari Kartini dan Hardiknas'),
      E('2027-04-23', null, 'kegiatan', 'Doa Bersama TKA, Uprak, dan PSKA'),
      E('2027-04-26', '2027-04-30', 'ujian', 'Perkiraan TKA Utama SD'),
      // ---------- Mei 2027 ----------
      E('2027-05-01', null, 'libur', 'Libur Hari Buruh Internasional'),
      E('2027-05-03', '2027-05-10', 'ujian', 'Ujian Praktik PSKA', [6]),
      E('2027-05-06', null, 'libur', 'Libur Kenaikan Yesus Kristus'),
      E('2027-05-08', null, 'kegiatan', 'Resital Musik'),
      E('2027-05-15', null, 'kegiatan', 'Manasik Haji'),
      E('2027-05-17', null, 'libur', 'Libur Hari Raya Idul Adha'),
      E('2027-05-19', null, 'kegiatan', 'Pembelajaran Qurban 1448 H'),
      E('2027-05-24', '2027-05-28', 'ujian', 'Perkiraan PSKA tertulis', [6]),
      E('2027-05-24', '2027-05-28', 'kegiatan', 'Delapan Dimensi Profil Lulusan', [1, 2, 3, 4, 5]),
      // ---------- Juni 2027 ----------
      E('2027-06-01', null, 'libur', 'Libur Hari Lahir Pancasila'),
      E('2027-06-05', null, 'kegiatan', 'Wisuda / Pelepasan kelas 6', [6]),
      E('2027-06-07', '2027-06-11', 'ujian', 'ASAT', [1, 2, 3, 4, 5]),
      E('2027-06-19', null, 'kegiatan', 'Pensi - Tema Papua', [1, 2, 3, 4, 5]),
      E('2027-06-21', '2027-06-24', 'kegiatan', 'Class Meeting'),
      E('2027-06-26', null, 'rapor', 'Pembagian rapor', [1, 2, 3, 4, 5]),
      E('2027-06-28', '2027-06-30', 'rapat', 'Rapat kerja Gukar'),
      E('2027-06-28', '2027-07-10', 'libur', 'Libur akhir Semester Genap'),
      // ---------- Juli 2027 ----------
      E('2027-07-12', null, 'kegiatan', 'Awal Tahun Ajaran 2027/2028')
    ]
  };
  window.KALENDER = K;
})();
