/* ---------------- Kode tampilan (tidak perlu diubah) ---------------- */
const https = u => /^https?:\/\//i.test(u || '') ? u : '';
const byId = id => document.getElementById(id);
const rp = n => 'Rp ' + Number(n).toLocaleString('id-ID');
const TODAY = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);   // WIB
const BLN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const tglS = d => { const [y, m, dd] = d.split('-'); return `${+dd} ${BLN[+m - 1]} ${y}`; };
const S = SPMB;
if (self !== top) document.body.classList.add('emb');

byId('eyebrow').textContent = 'SPMB ' + S.tahunAjaran + ' · Penerimaan Murid Baru';
byId('pengantar').textContent = S.pengantar;

// Status pendaftaran (dari jalur pertama)
const P0 = S.jalur[0].periode;
byId('status').classList.toggle('off', !(TODAY >= P0.mulai && TODAY <= P0.selesai));
byId('status').innerHTML = '<i></i>' + (TODAY < P0.mulai ? 'Pendaftaran dibuka mulai ' + tglS(P0.mulai)
  : TODAY <= P0.selesai ? 'Pendaftaran dibuka sampai ' + tglS(P0.selesai)
  : 'Pendaftaran tahap pertama ditutup · Gelombang kedua dibuka jika masih ada kuota');

const wa = 'https://wa.me/6281220706200?text=' + encodeURIComponent("Assalamu'alaikum, saya ingin menanyakan informasi SPMB SDS Islam At-Taqwa tahun ajaran " + S.tahunAjaran + '.');
byId('btns').innerHTML = S.jalur.map((j, i) => https(j.daftarUrl)
  ? `<a class="btn ${i ? '' : 'gold'}" href="${esc(j.daftarUrl)}" target="_blank" rel="noopener">${esc(j.label)} ${PANAH}</a>` : '').join('')
  + `<a class="btn" href="${wa}" target="_blank" rel="noopener">Tanya via WhatsApp</a>`;

byId('facts').innerHTML = S.fakta.map(f => `<div><b>${esc(f.angka)}</b><span>${esc(f.label)}</span></div>`).join('');

function poin(p) {
  if (typeof p === 'string') return `<li>${esc(p)}</li>`;
  return `<li><span class="lb">${esc(p.label)}</span><ul>${p.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul></li>`;
}

// Jadwal: jalur berkelok, 2 tahap per baris (baris genap ke kanan, baris ganjil ke kiri)
const PER = 2;
const WARNA = i => i % 2 === 0 ? ['var(--navy)', '#fff'] : ['var(--gold)', 'var(--navy)'];
function jadwal(list) {
  const n = list.length, rows = Math.ceil(n / PER);
  let h = '';
  for (let r = 0; r < rows - 1; r++) {
    h += `<i class="arc ${r % 2 ? 'lf' : 'rt'}" style="--ra:${r * 3 + 2} / ${r * 3 + 6};--ca:${WARNA((r + 1) * PER - 1)[0]};--cb:${WARNA((r + 1) * PER)[0]}"></i>`;
  }
  list.forEach((x, i) => {
    const r = Math.floor(i / PER), j = i % PER, rev = r % 2 === 1;
    const [bc, fg] = WARNA(i);
    const cls = [rev ? 'rtl' : 'ltr', j > 0 ? 'ov' : '', (j < PER - 1 || i === n - 1) ? 'tip' : ''].filter(Boolean).join(' ');
    h += `<div class="st ${cls}" style="--c:${rev ? 3 - j : 2 + j};--rt:${r * 3 + 1};--rb:${r * 3 + 2};--rd:${r * 3 + 3};--bc:${bc};--fg:${fg};--z:${60 - i}">
      <div class="st-t"><span class="num">${String(i + 1).padStart(2, '0')}</span><div class="tt"><b>${esc(x.judul)}</b></div></div>
      <div class="st-b">${esc(x.tanggal)}</div>
      <div class="st-d">${x.isi ? esc(x.isi) : ''}</div></div>`;
  });
  const gutter = (rows > 2 ? '' : '--gl:0px;') + (rows > 1 ? '' : '--gr:0px;');
  return `<div class="snake" style="${gutter}">${h}</div>`;
}

// Alur pendaftaran: kartu langkah (ringkas + detail lengkap yang bisa dibuka)
const WARNA_LANGKAH = ['var(--navy)', 'var(--blue)', '#c98a0a'];
function alur(list) {
  return `<ol class="flow">${list.map((t, i) => `<li class="fs" style="--bc:${WARNA_LANGKAH[i % 3]}">
    <div class="fs-top"><span class="fs-ic" aria-hidden="true">${ikonSvg(t.ikon)}</span><span class="fs-n">Langkah ${i + 1}</span></div>
    <h3>${esc(t.judul)}</h3>
    ${t.waktu ? `<div class="fs-w">${esc(t.waktu)}</div>` : ''}
    ${t.ringkas && t.ringkas.length ? `<ul class="fs-l">${t.ringkas.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
    ${t.tombol && https(t.tombol.url) ? `<a class="btn dark sm" href="${esc(t.tombol.url)}" target="_blank" rel="noopener">${esc(t.tombol.teks)} ${PANAH}</a>` : ''}
    ${t.poin && t.poin.length ? `<details class="fs-more"><summary>Lihat detail lengkap</summary><ul class="pts">${t.poin.map(poin).join('')}</ul></details>` : ''}
  </li>`).join('')}</ol>`;
}

function panel(j) {
  const out = [];
  out.push(`<section class="card"><h2>Pendaftaran — ${esc(j.nama)}</h2><div class="sum">${j.ringkas.map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>
    <div class="btns">${https(j.daftarUrl) ? `<a class="btn dark" href="${esc(j.daftarUrl)}" target="_blank" rel="noopener">Isi formulir pendaftaran ${PANAH}</a>` : ''}${https(j.panduanUrl) || j.panduanUrl ? `<a class="btn line" href="${esc(j.panduanUrl)}" target="_blank" rel="noopener">Unduh buku panduan (PDF)</a>` : ''}</div></section>`);
  out.push(`<section class="card"><h2>Jadwal SPMB</h2>${jadwal(j.jadwal)}</section>`);
  out.push(`<section class="card"><h2>Alur Pendaftaran</h2><p class="mut" style="margin:-6px 0 18px">Ikuti langkahnya secara berurutan. Buka Lihat detail lengkap pada tiap kartu untuk aturan selengkapnya.</p>${alur(j.tahapan)}</section>`);
  const b = j.biaya, tot = b.kolom.map((_, i) => b.baris.reduce((s, r) => s + r[i + 1], 0));
  out.push(`<section class="card"><h2>${esc(b.judul)}</h2><div class="scroll"><table><thead><tr><th>Keterangan</th>${b.kolom.map(k => `<th class="n">${esc(k)}</th>`).join('')}</tr></thead><tbody>
    ${b.baris.map(r => `<tr><td>${esc(r[0])}</td>${r.slice(1).map(v => `<td class="n">${rp(v)}</td>`).join('')}</tr>`).join('')}
    <tr class="tot"><td>Total</td>${tot.map(v => `<td class="n">${rp(v)}</td>`).join('')}</tr></tbody></table></div>
    <h3 style="margin-top:18px">Keterangan</h3><ul class="notes">${b.catatan.map(c => `<li>${esc(c)}</li>`).join('')}</ul></section>`);
  return out.join('');
}

let aktif = S.jalur[0].id;
function render() {
  byId('tabs').innerHTML = S.jalur.map(j => `<button role="tab" aria-selected="${j.id === aktif}" data-id="${j.id}">${esc(j.nama)}</button>`).join('');
  byId('panel').innerHTML = panel(S.jalur.find(j => j.id === aktif));
  document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => { aktif = b.dataset.id; render(); });
}
render();

byId('kontak').innerHTML = `<h2>Hubungi Panitia SPMB</h2><div class="kontak">${KONTAK.map(k =>
  `<a href="https://wa.me/${esc(k.wa)}" target="_blank" rel="noopener"><b>${esc(k.nama)}</b><span>WhatsApp ${esc(k.tampil)}</span></a>`).join('')}</div>`;
byId('catatan').innerHTML = `<h2>Catatan</h2><ul class="notes">${S.catatan.map(c => `<li>${esc(c)}</li>`).join('')}</ul>`;
