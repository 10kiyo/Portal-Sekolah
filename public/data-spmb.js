/* ============================================================
   ISI HALAMAN SPMB — bersumber dari Panduan SPMB 2027/2028 (TK Dalam & TK Luar, 7 Oktober 2026).
   Edit data di bawah ini saja. Bagian yang dikosongkan ("" atau []) otomatis tidak ditampilkan.
   Tanggal `mulai`/`selesai` hanya dipakai untuk label status pendaftaran di bagian atas; timeline jadwal tidak memakai status. Format 'TTTT-BB-HH'.

   Cara kerja tampilan baru:
   - Jadwal  : tiap item di `jadwal` jadi satu tahap di jalur berkelok (2 tahap per baris).
               Pakai `isi` untuk keterangan singkat di bawah tanggal.
   - Alur    : tiap item di `tahapan` jadi satu kartu langkah. `ringkas` = poin singkat yang selalu tampil,
               `poin` = isi lengkap yang muncul saat "Lihat detail lengkap" dibuka.
   ============================================================ */
/* Ikon langkah (SVG inline, gaya Lucide, mengikuti warna teks) */
const PANAH = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const IKON = {
  daftar: '<path d="M12 20h9"/><path d="M16.4 3.6a2.1 2.1 0 0 1 3 3L7.4 18.6a2 2 0 0 1-.9.5l-2.9.8a.5.5 0 0 1-.6-.6l.8-2.9a2 2 0 0 1 .5-.9z"/><path d="m15 5 3 3"/>',
  pantau: '<circle cx="10" cy="7" r="4"/><path d="M10.3 15H7a4 4 0 0 0-4 4v2"/><circle cx="17" cy="17" r="3"/><path d="m21 21-1.9-1.9"/>',
  bayar: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
  wawancara: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  seragam: '<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/>',
  tas: '<path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M8 21v-5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v5"/><path d="M8 10h8"/><path d="M8 18h8"/>'
};
const ikonSvg = k => IKON[k] ? `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false">${IKON[k]}</svg>` : '';

const KONTAK = [
  { nama: 'Ibu Zulmy',       wa: '6281220706200', tampil: '0812 2070 6200' },
  { nama: 'Ibu Sri Hartati', wa: '6285794994432', tampil: '0857 9499 4432' },
  { nama: 'Ibu Rika',        wa: '6281384097977', tampil: '0813 8409 7977' },
  { nama: 'Bapak Redi',      wa: '628999129690',  tampil: '0899 9129 690' }
];

// Bagian tahapan yang sama untuk kedua jalur
const PERSIAPAN = {
  label: 'Persiapan calon peserta didik',
  items: ['Memakai pakaian bebas sopan dan bersepatu.',
    'Membawa alat tulis (pensil, penghapus, pensil warna/krayon), gunting kecil, lem kecil, minum, dan makanan kecil.',
    'Sudah sarapan di rumah.', 'Tiba di tempat pemantauan paling lambat pukul 07.50 WIB.',
    'Lewat dari pukul 08.30 WIB dianggap mengundurkan diri.']
};
const MATERI = { label: 'Materi pemantauan', items: ['Kebahasaan, logika, motorik kasar dan halus', 'Kematangan belajar', 'Hafalan surat pendek, doa harian, dan membaca Iqra'] };
const BERKAS = { label: 'Berkas daftar ulang (dikumpulkan setelah SK Pengumuman SPMB TA 2027/2028)', items: [
  'Fotokopi akte kelahiran dan Kartu Keluarga (2 lembar).',
  'Fotokopi Buku Laporan Hasil Belajar TK B semester 1 atau sederajat yang telah dilegalisir (menyusul).'] };
const PEMBAYARAN = { label: 'Pembayaran (transfer dan sertakan nama peserta didik)', items: [
  'IPSP, IPP, dan SPP: Bank BNI a.n. Yayasan Masjid At-Taqwa Kampus Rawamangun, no. rek. 8888-21-0033.',
  'Uang seragam dan alat: Bank Mandiri a.n. Mundi Indriyadi / Efayanti, S.Pd, no. rek. 0060010547960.'] };
const TAHAP_LANJUT = [
  { judul: 'Wawancara Orang Tua', ikon: 'wawancara', waktu: '12 – 13 Des 2026',
    ringkas: ['Wajib dihadiri Bapak dan Ibu', 'Syarat: administrasi keuangan sudah selesai', 'Pilih waktu sesuai tanggal tersebut'],
    poin: [
    'Wajib diikuti oleh orang tua (Bapak dan Ibu) peserta didik yang telah menyelesaikan administrasi keuangan.',
    'Dilaksanakan pada 12 – 13 Desember 2026. Orang tua dapat memilih waktu sesuai tanggal tersebut.'] },
  { judul: 'Pengukuran Seragam', ikon: 'seragam', waktu: '12 – 13 Des 2026',
    ringkas: ['Siswa wajib hadir', 'Orang tua mengisi surat pernyataan ukuran seragam', 'Tidak ada pengukuran atau penukaran di luar jadwal'],
    poin: [
    'Dilaksanakan pada 12 – 13 Desember 2026. Siswa wajib hadir.',
    'Orang tua wajib mengisi surat pernyataan ukuran seragam peserta didik dan akan menerima jadwal mengenakan seragam.',
    'Tidak ada pelayanan komplain/penukaran seragam di luar ukuran yang telah disepakati.',
    'Tidak ada pelayanan pengukuran di luar jadwal yang telah ditentukan.'] },
  { judul: 'Hari Pertama Tahun Ajaran 2027/2028', ikon: 'tas', waktu: 'Senin, 12 Juli 2027',
    ringkas: ['Tiba paling lambat 06.50 WIB, pulang 10.10 WIB', 'Orang tua wajib mengantar selama MPLS', 'Pekan pertama boleh menunggu; mulai pekan ke-2 mandiri'],
    poin: [
    'Seluruh peserta didik hadir pada Senin, 12 Juli 2027 dengan seragam sesuai ketentuan (jika ada perubahan, akan diberitahu melalui telepon dan web sekolah).',
    'Tiba di sekolah paling lambat pukul 06.50 WIB dan pulang pukul 10.10 WIB.',
    'Selama MPLS, orang tua (Bapak dan Ibu) wajib mengantar peserta didik ke sekolah.',
    'Selama satu pekan pertama, orang tua boleh mendampingi dan menunggu di tempat yang telah disediakan. Mulai pekan ke-2 peserta didik mandiri dan tidak lagi ditunggu.',
    'Jadwal pembelajaran dan kegiatan sekolah diberikan pada pertemuan orang tua/wali di awal tahun ajaran.'] }
];
const tahapan = (hariSabtu, tombol) => [
  { judul: 'Pendaftaran', ikon: 'daftar', waktu: '1 Okt – 13 Nov 2026', tombol,
    ringkas: ['Isi formulir online, lalu daftar di Tata Usaha', 'Senin – Jumat 07.30 – 14.00 WIB, Sabtu ' + hariSabtu, 'Usia minimal 5 tahun 10 bulan per Juli 2027'],
    poin: [
    'Tempat pendaftaran: Tata Usaha SDS Islam At-Taqwa Rawamangun.',
    'Pendaftaran setiap hari kerja (Senin – Jumat) pukul 07.30 – 14.00 WIB.',
    'Hari Sabtu pukul ' + hariSabtu + '.',
    'Usia calon peserta didik per Juli 2027 minimal 5 tahun 10 bulan.',
    'Isi formulir pendaftaran online melalui tombol di atas.'] },
  { judul: 'Pemantauan Calon Peserta Didik', ikon: 'pantau', waktu: '14 Nov 2026 · 08.00 – 11.00 WIB',
    ringkas: ['Tiba paling lambat 07.50 WIB; lewat 08.30 dianggap mundur', 'Bawa alat tulis, minum, dan makanan kecil', 'Dinilai: bahasa, logika, motorik, kematangan belajar, hafalan surat pendek, doa harian, Iqra', 'Pengumuman: Senin, 23 Nov 2026'],
    poin: [
    'Sabtu, 14 November 2026, pukul 08.00 – 11.00 WIB.', 'Pengumuman: Senin, 23 November 2026.', PERSIAPAN, MATERI] },
  { judul: 'Daftar Ulang', ikon: 'bayar', waktu: '23 Nov – 7 Des 2026',
    ringkas: ['Siapkan fotokopi akte, KK, dan rapor TK B yang dilegalisir', 'Transfer IPSP, IPP, SPP, serta seragam dan alat sampai lunas', 'Serahkan bukti transfer ke sekolah atau WhatsApp Ibu Zulmy', 'Lewat 7 Des belum lunas = dianggap mengundurkan diri'],
    poin: [
    BERKAS,
    'Daftar ulang dan penyerahan bukti pembayaran: hadir ke sekolah atau via WhatsApp ke Ibu Zulmy (0812 2070 6200), tanggal 23 November – 7 Desember 2026.',
    PEMBAYARAN,
    'Membayar lunas IPSP, IPP, SPP, serta uang seragam dan alat.',
    'Menandatangani surat pernyataan bekerja sama dengan pihak sekolah dan menentukan waktu wawancara orang tua.',
    'Jika sampai 7 Desember 2026 administrasi keuangan belum lunas dan bukti transfer belum diserahkan, dianggap mengundurkan diri.'] },
  ...TAHAP_LANJUT
];

const SPMB = {
  tahunAjaran: '2027/2028',
  pengantar: 'Informasi penerimaan murid baru kelas I SDS Islam At-Taqwa Rawamangun. Pilih jalur pendaftaran sesuai asal TK calon peserta didik.',
  fakta: [
    { angka: '76', label: 'Daya tampung kelas I (3 rombel paralel)' },
    { angka: '5 th 10 bln', label: 'Usia minimal per Juli 2027' },
    { angka: '12 Juli 2027', label: 'Hari pertama tahun ajaran' },
    { angka: 'A Unggul', label: 'Akreditasi sekolah' }
  ],
  jalur: [
    {
      id: 'dalam', nama: 'Dari TK Islam At-Taqwa', label: 'Daftar dari TK At-Taqwa',
      daftarUrl: 'spmb-daftar-dalam.html',
      panduanUrl: 'PANDUAN-SPMB-TK-DALAM-2027-2028.pdf',
      periode: { mulai: '2026-10-01', selesai: '2026-11-13' },
      ringkas: [['Periode pendaftaran', '1 Oktober – 13 November 2026'], ['Biaya formulir', 'Gratis (sampai 31 Desember 2026)'], ['Tempat', 'Tata Usaha SDS Islam At-Taqwa']],
      jadwal: [
        { tanggal: '1 Okt - 13 Nov 2026', mulai: '2026-10-01', selesai: '2026-11-13', judul: 'Pendaftaran', isi: 'Formulir gratis. Senin – Jumat 07.30 – 14.00 WIB, Sabtu 08.00 – 12.00 WIB' },
        { tanggal: '14 Nov 2026', mulai: '2026-11-14', judul: 'Pemantauan calon peserta didik', isi: 'Pukul 08.00 – 11.00 WIB' },
        { tanggal: '23 Nov 2026', mulai: '2026-11-23', judul: 'Pengumuman hasil SPMB', isi: 'Hasil pemantauan calon peserta didik' },
        { tanggal: '23 Nov – 7 Des 2026', mulai: '2026-11-23', selesai: '2026-12-07', judul: 'Daftar ulang dan pelunasan', isi: 'Lunasi pembayaran dan serahkan bukti transfer' },
        { tanggal: '12 – 13 Des 2026', mulai: '2026-12-12', selesai: '2026-12-13', judul: 'Wawancara orang tua dan pengukuran seragam', isi: 'Wawancara wajib dihadiri Bapak dan Ibu; siswa hadir untuk ukur seragam' },
        { tanggal: '12 Juli 2027', mulai: '2027-07-12', judul: 'Hari pertama tahun ajaran 2027/２０２８', isi: 'Tiba paling lambat 06.５０ WIB, pulang １０.１０ WIB' }
      ],
      tahapan: tahapan('08.00 – 12.00 WIB', { teks: 'Isi formulir pendaftaran', url: 'spmb-daftar-dalam.html' }),
      biaya: {
        judul: 'Rincian Uang Masuk TK Dalam (berlaku 7 Oktober 2026)',
        kolom: ['Okt – Des 2026', 'Jan – Juni 2027'],
        baris: [['Infaq Pengembangan Sarana dan Prasarana (IPSP)', 9350000, 9850000], ['Infak Penguatan Pendidikan (IPP)', 20900000, 21400000], ['Alat dan Seragam', 4500000, 4500000], ['SPP per bulan', 1700000, 1700000]],
        catatan: ['Biaya formulir gratis sampai 31 Desember 2026. Mendaftar setelah 31 Desember 2026 mengikuti ketentuan TK Luar (formulir berbayar).',
          'Tidak ada biaya daftar ulang dari kelas 1 – 6.', 'Wakaf yang sudah dibayarkan tidak bisa dikembalikan.',
          'Wakaf yang dibayarkan dipergunakan untuk pengadaan dan peningkatan kualitas sarana dan prasarana sekolah.',
          'Peserta didik yang mengundurkan diri sebelum 1 Mei 2027: uang SPP dan infak pendidikan dikembalikan 5０%.',
          'Peserta didik yang mengundurkan diri pada 1 Juni 2027: dana tidak dapat dikembalikan seluruhnya.']
      }
    },
    {
      id: 'luar', nama: 'Dari TK Luar', label: 'Daftar dari TK Luar',
      daftarUrl: 'spmb-daftar-luar.html',
      panduanUrl: 'PANDUAN-SPMB-TK-LUAR-2027-2028.pdf',
      periode: { mulai: '2026-10-01', selesai: '2026-11-13' },
      ringkas: [['Periode pendaftaran', '1 Oktober – 13 November 2026'], ['Biaya formulir', 'Rp 375.000'], ['Tempat', 'Tata Usaha SDS Islam At-Taqwa']],
      jadwal: [
        { tanggal: '1 Okt - 13 Nov 2026', mulai: '2026-10-01', selesai: '2026-11-13', judul: 'Pendaftaran', isi: 'Formulir Rp 375.000. Senin – Jumat 07.30 – 14.00 WIB, Sabtu 08.00 – 12.00 WIB (dengan perjanjian)' },
        { tanggal: '14 Nov 2026', mulai: '2026-11-14', judul: 'Pemantauan calon peserta didik', isi: 'Pukul 08.00 – 11.00 WIB' },
        { tanggal: '23 Nov 2026', mulai: '2026-11-23', judul: 'Pengumuman hasil SPMB', isi: 'Hasil pemantauan calon peserta didik' },
        { tanggal: '23 Nov – 7 Des 2026', mulai: '2026-11-23', selesai: '2026-12-07', judul: 'Daftar ulang dan pelunasan', isi: 'Lunasi pembayaran dan serahkan bukti transfer' },
        { tanggal: '12 – 13 Des 2026', mulai: '2026-12-12', selesai: '2026-12-13', judul: 'Wawancara orang tua dan pengukuran seragam', isi: 'Wawancara wajib dihadiri Bapak dan Ibu; siswa hadir untuk ukur seragam' },
        { tanggal: '12 Juli 2027', mulai: '2027-07-12', judul: 'Hari pertama tahun ajaran 2027/２０２８', isi: 'Tiba paling lambat 06.５０ WIB, pulang １０.１０ WIB' }
      ],
      tahapan: tahapan('08.00 – 12.00 WIB (dengan perjanjian)', { teks: 'Isi formulir pendaftaran', url: 'spmb-daftar-luar.html' }),
      biaya: {
        judul: 'Rincian Uang Masuk TK Luar (berlaku 7 Oktober 2026)',
        kolom: ['Okt – Des 2026', 'Jan – Juni 2027'],
        baris: [['Infaq Pengembangan Sarana dan Prasarana (IPSP)', 10450000, 10950000], ['Infak Penguatan Pendidikan (IPP)', 21450000, 21950000], ['Alat dan Seragam', 4500000, 4500000], ['SPP per bulan', 1700000, 1700000]],
        catatan: ['Biaya formulir Rp 375.000.', 'Tidak ada biaya daftar ulang dari kelas 1 – 6.', 'Wakaf yang sudah dibayarkan tidak bisa dikembalikan.',
          'Wakaf yang dibayarkan dipergunakan untuk pengadaan dan peningkatan kualitas sarana dan prasarana sekolah.',
          'Peserta didik yang mengundurkan diri sebelum 1 Mei 2027: uang SPP dan infak pendidikan dikembalikan 25%.',
          'Peserta didik yang mengundurkan diri pada 1 Juni 2027: dana tidak dapat dikembalikan seluruhnya.']
      }
    }
  ],
  catatan: [
    'Gelombang kedua dibuka apabila masih ada kuota.',
    'Jika ada yang kurang jelas, dapat ditanyakan langsung ke bagian Tata Usaha sekolah.',
    'Hal-hal yang belum tercantum atau jika ada perubahan akan disampaikan selanjutnya.'
  ]
};
