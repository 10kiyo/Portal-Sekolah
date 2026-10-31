/* ============================================================
   DATA GURU & STAF — satu sumber untuk halaman "Guru & Staff"
   dan (nanti) Administrasi Kelas. Tambah/ubah orang di sini saja.

   Kolom:
   id       : kode unik tanpa spasi (mis. 'nurbaiti'); dipakai untuk menghubungkan ke Administrasi Kelas
   nama     : nama lengkap beserta gelar
   jabatan  : jabatan tampil (mis. 'Guru Kelas 3A')
   kelompok : 'pimpinan' | 'guru' | 'staf'
   mapel    : daftar mata pelajaran yang diajar (boleh kosong [])
   walikelas: nama kelas bila wali kelas (mis. '3A'), kosong '' bila bukan
   foto     : nama file di folder public/guru/ (mis. 'guru/budi.jpg'), kosong '' = inisial nama
   ============================================================ */
window.GURU_STAF = [
  { id: 'nurbaiti', nama: 'Nurbaiti, S.Pd', jabatan: 'Kepala Sekolah', kelompok: 'pimpinan', mapel: [], walikelas: '', foto: 'guru/nurbaiti.jpg' },
  { id: 'nurlaila', nama: 'Nurlaila Ningrum, S.Pd', jabatan: 'Wakakur & Kesiswaan', kelompok: 'pimpinan', mapel: [], walikelas: '', foto: 'guru/nurlaila.jpg' },
  { id: 'mahidin', nama: 'Mahidin, S.S', jabatan: 'Waka SarPras', kelompok: 'pimpinan', mapel: [], walikelas: '', foto: 'guru/mahidin.jpg' }
  // Contoh guru:
  // { id: 'budi', nama: 'Budi Santoso, S.Pd', jabatan: 'Guru Kelas 3A', kelompok: 'guru', mapel: ['Matematika', 'IPAS'], walikelas: '3A', foto: 'guru/budi.jpg' },
  // Contoh staf:
  // { id: 'siti', nama: 'Siti Aminah, S.E', jabatan: 'Tata Usaha', kelompok: 'staf', mapel: [], walikelas: '', foto: '' },
];
