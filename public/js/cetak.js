/* ============================================================
   PENCETAK SERAGAM untuk semua tombol Cetak di portal admin (guru, staf, dan panitia).
   Hasilnya satu gaya: kop surat (kop-surat.png) + judul + isi, kertas A4, huruf Times New Roman.
   Dokumen tampil dulu sebagai pratinjau, lalu "Cetak / simpan PDF" mencetak dokumen itu apa adanya
   (iframe tersembunyi di luar dialog, tanpa scale, setelah kop surat termuat).
   Dipakai oleh: Data murid, Rekap kehadiran, Kas, Laporan keuangan, Agenda surat, Akun, Ekskul, BK (rekap & surat),
   Kegiatan Sekolah, Buku Tamu, dan Buat surat. Berdiri sendiri (tidak butuh $ atau esc dari halaman).
   Cara pakai:
     cetakPratinjau(judul, cetakDokumen(judul, cetakTabel([{ h: 'Nama', v: x => esc(x.nama) }], daftar) + cetakRingkas([['Jumlah', daftar.length]])));
   Semua teks yang dikirim ke fungsi di sini (h, v, sub, isi) adalah HTML: pemanggil wajib me-escape isian pengguna.
   ============================================================ */
const cetakEsc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cetakKopUrl = () => location.origin + '/kop-surat.png';

// Tabel berborder dengan baris judul yang diulang di tiap halaman.
// kolom: [{ h: 'Judul kolom', c: 'c' | 'n' | 'r' (opsional: tengah | tanpa pindah baris | rata kanan), v: (baris, urutan) => html sel }]
function cetakTabel(kolom, baris, kosong = 'Tidak ada data.') {
  const th = kolom.map(k => `<th>${k.h}</th>`).join('');
  const tr = baris.map((r, i) => `<tr>${kolom.map(k => `<td${k.c ? ` class="${k.c}"` : ''}>${k.v(r, i)}</td>`).join('')}</tr>`).join('');
  return `<table class="t"><thead><tr>${th}</tr></thead><tbody>${tr || `<tr><td colspan="${kolom.length}">${kosong}</td></tr>`}</tbody></table>`;
}
// Ringkasan "Label : nilai" di bawah tabel. pasang: [['Jumlah murid', 12], ...]
const cetakRingkas = pasang => `<table class="rk">${pasang.map(([a, b]) => `<tr><td>${a}</td><td>:</td><td>${b}</td></tr>`).join('')}</table>`;
// Judul bagian (mis. "Surat masuk") dengan keterangan kecil dan isinya.
const cetakBagian = (judul, ket, isi) => `<h2>${judul}</h2>${ket ? `<p class="ket">${ket}</p>` : ''}${isi}`;

// Dokumen HTML lengkap siap tampil di iframe / dicetak.
// opsi: sub (HTML di bawah judul, boleh beberapa baris dengan <br>), tanpaJudul (isi sudah punya judul sendiri, mis. surat),
//       margin (bawaan '12mm 15mm 14mm'), font (bawaan '10pt/1.3'), css (aturan tambahan khusus dokumen).
function cetakDokumen(judul, isi, o = {}) {
  const kop = cetakKopUrl(), margin = o.margin || '12mm 15mm 14mm';
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${cetakEsc(judul)}</title><style>
@page{size:A4;margin:${margin}}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}@media screen{body{padding:${margin};min-height:297mm}}
body{margin:0;background:#fff;color:#000;font:${o.font || '10pt/1.3'} "Times New Roman",Times,serif}
.kop{display:block;width:100%;height:auto;margin:0 0 4mm}
h1{margin:5mm 0 3mm;text-align:center;font-size:14pt;text-transform:uppercase;letter-spacing:.3px}.sub{margin:-1mm 0 3mm;text-align:center}
h2{margin:5mm 0 1.5mm;font-size:11pt;page-break-after:avoid}.ket{margin:0 0 2mm;font-size:9.5pt}
table.t{width:100%;border-collapse:collapse}table.t th,table.t td{border:1px solid #000;padding:3px 5px;vertical-align:top;text-align:left}
table.t th{background:#e8e8e8;text-align:center;font-weight:700}table.t thead{display:table-header-group}table.t tr{page-break-inside:avoid}
table.t .c{text-align:center;width:8mm}table.t .n{white-space:nowrap}table.t .r{text-align:right;white-space:nowrap}
table.rk{width:auto;margin:4mm 0 0;border-collapse:collapse;page-break-inside:avoid}table.rk td{padding:1px 6px 1px 0;vertical-align:top}
${o.css || ''}
</style></head><body>
<img class="kop" src="${kop}" alt="Kop surat SDS Islam At-Taqwa">
${o.tanpaJudul ? '' : `<h1>${cetakEsc(judul)}</h1>`}${o.sub ? `<p class="sub">${o.sub}</p>` : ''}
${isi}
</body></html>`;
}

function cetakTungguGambar(doc) {
  const imgs = [...(doc.images || [])];
  if (!imgs.length) return Promise.resolve();
  return Promise.all(imgs.map(img => (img.complete && img.naturalWidth) ? Promise.resolve() : new Promise(r => {
    const done = () => r(); img.addEventListener('load', done, { once: true }); img.addEventListener('error', done, { once: true });
  })));
}

// Cetak dokumen HTML yang sama dengan pratinjau. Iframe di luar <dialog> agar browser tidak mencetak panel admin / pratinjau yang di-scale.
function cetakKePdf(html) {
  let f = document.getElementById('cetakFramePrint');
  if (f) f.remove();
  f = document.createElement('iframe');
  f.id = 'cetakFramePrint';
  f.title = 'Dokumen cetak';
  f.setAttribute('aria-hidden', 'true');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:210mm;height:297mm;border:0;opacity:0;pointer-events:none;z-index:-1';
  document.body.appendChild(f);
  const selesai = () => { if (f && f.parentNode) f.remove(); };
  f.onload = () => {
    const w = f.contentWindow, doc = f.contentDocument;
    if (!doc || !doc.body || !doc.body.children.length) return;
    cetakTungguGambar(doc).then(() => {
      const after = () => { w.removeEventListener('afterprint', after); selesai(); };
      w.addEventListener('afterprint', after);
      setTimeout(() => { if (f.parentNode) selesai(); }, 180000);
      w.focus();
      w.print();
    });
  };
  f.srcdoc = html;
}

function cetakUkuranPratinjau(pv, box, cw) {
  const doc = pv.contentDocument;
  if (!doc) return;
  const z = Math.min(1, (box.clientWidth - 20) / 794);
  const h = Math.max(1123, Math.ceil(doc.documentElement.scrollHeight));
  pv.style.height = h + 'px';
  pv.style.transform = `scale(${z})`;
  cw.style.width = Math.round(794 * z) + 'px';
  cw.style.height = Math.round(h * z) + 'px';
}

// Dialog pratinjau cetak: dokumen tampil seperti kertas A4; tombol "Cetak / simpan PDF" mencetak dokumen itu (bukan halaman panel).
function cetakPratinjau(judul, html) {
  const BTN = 'min-height:42px;padding:10px 15px;border-radius:10px;font:inherit;font-weight:700;cursor:pointer;';
  let dlg = document.getElementById('dlgCetak'); if (dlg) dlg.remove();
  dlg = document.createElement('dialog'); dlg.id = 'dlgCetak';
  dlg.style.cssText = 'border:0;border-radius:18px;padding:16px;width:min(900px,calc(100% - 24px));max-height:calc(100vh - 24px);overflow:hidden';
  dlg.innerHTML = `<div style="display:flex;gap:8px;justify-content:space-between;align-items:center;flex-wrap:wrap;margin-bottom:10px"><b>Pratinjau cetak: ${cetakEsc(judul)}</b><span><button type="button" id="cBatal" style="${BTN}background:#fff;color:#102a43;border:1px solid #cbd8e6">Tutup</button> <button type="button" id="cPrint" style="${BTN}background:#1677c8;color:#fff;border:1px solid #1677c8">Cetak / simpan PDF</button></span></div>
    <div id="cbox" style="background:#e9eef3;border-radius:12px;padding:10px;overflow:auto;max-height:calc(100vh - 120px)"><div id="cw" style="margin:0 auto;overflow:hidden"><iframe id="cpv" title="Pratinjau cetak" style="display:block;width:794px;border:0;background:#fff;box-shadow:0 2px 10px #0002;transform-origin:top left"></iframe></div></div>`;
  document.body.appendChild(dlg); dlg.showModal();
  const pv = dlg.querySelector('#cpv'), box = dlg.querySelector('#cbox'), cw = dlg.querySelector('#cw');
  const ukur = () => cetakUkuranPratinjau(pv, box, cw);
  pv.onload = () => { cetakTungguGambar(pv.contentDocument).then(ukur); ukur(); };
  pv.srcdoc = html;
  new ResizeObserver(ukur).observe(box);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.querySelector('#cBatal').onclick = () => dlg.close();
  dlg.querySelector('#cPrint').onclick = () => cetakKePdf(html);
}
