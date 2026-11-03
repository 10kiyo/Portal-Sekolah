// Pembantu umum untuk halaman publik/guru. Dimuat sebelum skrip halaman, jadi halaman TIDAK boleh
// mendeklarasikan ulang `$` atau `esc` (akan error "already been declared").
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
