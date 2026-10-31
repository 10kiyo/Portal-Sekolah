/* ============================================================
   PENYESUAIAN DATA GURU & STAF (OPSIONAL)
   Daftar guru & staf ditarik otomatis dari Supabase (tabel daftar_tamu_gabungan, lewat /api/guru).
   File ini hanya untuk MENAMBAHKAN foto / jabatan / mapel / wali kelas pada orang tertentu,
   atau menampilkan orang yang belum ada di database. Tidak perlu diisi untuk semua guru.

   Kolom:
   nama      : nama (tanpa gelar pun boleh) — dipakai untuk mencocokkan dengan data Supabase
   jabatan   : jabatan tampil (menggantikan keterangan dari database)
   kelompok  : 'pimpinan' | 'guru' | 'staf'   (kosongkan untuk mengikuti database)
   mapel     : daftar mata pelajaran, mis. ['Matematika']
   walikelas : mis. '3A' bila wali kelas
   foto      : file di folder public/guru/, mis. 'guru/budi.jpg'
   ============================================================ */
window.GURU_STAF = [
  { nama: 'Nurbaiti, S.Pd', jabatan: 'Kepala Sekolah', kelompok: 'pimpinan', foto: 'guru/nurbaiti.jpg' },
  { nama: 'Nurlaila Ningrum, S.Pd', jabatan: 'Wakakur & Kesiswaan', kelompok: 'pimpinan', foto: 'guru/nurlaila.jpg' },
  { nama: 'Mahidin, S.S', jabatan: 'Waka SarPras', kelompok: 'pimpinan', foto: 'guru/mahidin.jpg' }
  // Contoh: { nama: 'Budi Santoso', mapel: ['Matematika', 'IPAS'], walikelas: '3A', foto: 'guru/budi.jpg' },
];
