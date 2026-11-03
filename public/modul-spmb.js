const SPMB_STATUS = [
  ['baru', 'Pendaftar baru'],
  ['perbaikan', 'Perlu perbaikan'],
  ['terverifikasi', 'Terverifikasi'],
  ['diterima', 'Diterima'],
  ['tidak_diterima', 'Tidak diterima'],
  ['mundur', 'Mengundurkan diri']
];
const SPMB_CHECKLIST = [
  ['fotokopi', 'Fotokopi berkas'],
  ['rapor', 'Rapor TK'],
  ['tata_usaha', 'Daftar di Tata Usaha'],
  ['lunas', 'Pembayaran lunas'],
  ['pernyataan', 'Surat pernyataan'],
  ['wawancara', 'Wawancara'],
  ['seragam', 'Pengukuran seragam']
];
const SPMB_BERKAS = [['foto', 'Foto'], ['akte', 'Akta kelahiran'], ['kk', 'Kartu Keluarga'], ['bukti', 'Bukti pembayaran']];
const spmbLabelStatus = status => (SPMB_STATUS.find(([id]) => id === status) || [status || '', status || '-'])[1];
const spmbTgl = value => value ? new Date(value + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
let spmbTabAktif = 'spmbdaftar';
let spmbPreview;

function spmbBukaPreview(file, judul) {
  if (!spmbPreview) {
    spmbPreview = document.createElement('dialog');
    spmbPreview.setAttribute('aria-labelledby', 'spmbPreviewTitle');
    spmbPreview.style.cssText = 'border:0;border-radius:18px;padding:0;width:min(760px,calc(100% - 24px));max-height:calc(100dvh - 24px);overflow:hidden;box-shadow:0 20px 60px #102a4350;color:var(--ink,#243b53)';
    spmbPreview.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:16px 18px">
      <h2 id="spmbPreviewTitle" style="margin:0;color:var(--navy,#102a43);font-size:20px"></h2>
      <button type="button" aria-label="Tutup pratinjau" data-spmb-preview-close style="flex:none;border:0;border-radius:50%;width:36px;height:36px;font-size:22px;cursor:pointer">×</button>
    </div><div data-spmb-preview-body style="overflow:auto;max-height:calc(100dvh - 150px);background:#e6eef6;text-align:center"></div>
    <div style="padding:12px 18px;border-top:1px solid #dbe8f2"><a data-spmb-preview-open target="_blank" rel="noopener">Buka file di tab baru / unduh</a></div>`;
    document.body.appendChild(spmbPreview);
    spmbPreview.querySelector('[data-spmb-preview-close]').onclick = () => spmbPreview.close();
    spmbPreview.addEventListener('click', e => { if (e.target === spmbPreview) spmbPreview.close(); });
  }
  spmbPreview.querySelector('#spmbPreviewTitle').textContent = judul;
  const body = spmbPreview.querySelector('[data-spmb-preview-body]');
  body.replaceChildren();
  const url = String(file.url || '');
  if (file.pdf) {
    const frame = document.createElement('iframe');
    frame.src = url;
    frame.title = judul;
    frame.style.cssText = 'display:block;width:100%;height:min(75dvh,800px);border:0;background:#fff';
    body.appendChild(frame);
  } else {
    const image = document.createElement('img');
    image.src = url;
    image.alt = judul;
    image.style.cssText = 'display:block;margin:auto;max-width:100%;max-height:calc(100dvh - 180px);object-fit:contain';
    body.appendChild(image);
  }
  spmbPreview.querySelector('[data-spmb-preview-open]').href = url;
  spmbPreview.showModal();
}

async function spmbRequest(body) {
  const { data, error } = await sb.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error('Sesi login tidak ditemukan. Silakan login ulang.');
  const options = { headers: { Authorization: `Bearer ${token}` } };
  if (body) {
    options.method = 'POST';
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const response = await fetch('/api/admin-spmb', options);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Permintaan SPMB gagal (${response.status}).`);
  return result;
}

function spmbGagal(error) {
  const view = $('#view');
  view.innerHTML = `<h2>Data SPMB tidak dapat dimuat</h2><p class="msg err">${esc(error.message || String(error))}</p>`;
}

function spmbTabel(pendaftar) {
  return `<div style="overflow:auto"><table><tr><th>No. daftar</th><th>Calon murid</th><th>Jalur</th><th>Orang tua / kontak</th><th>Status</th></tr>
  ${pendaftar.map(r => `<tr><td><b>${esc(r.no_daftar || '-')}</b><div class="mut">${esc(spmbTgl(r.created_at))}</div></td>
    <td><b>${esc(r.nama)}</b><div class="mut">TTL: ${esc(r.tempat_lahir || '-')}, ${esc(spmbTgl(r.tanggal_lahir))}</div></td>
    <td>${r.jalur === 'dalam' ? 'TK At-Taqwa' : 'TK Luar'}</td>
    <td>${esc(r.nama_ayah || r.nama_ibu || '-')}<div class="mut">${esc(r.kontak || '-')}</div></td>
    <td>${esc(spmbLabelStatus(r.status))}</td></tr>`).join('') || '<tr><td colspan="5" class="mut">Belum ada data pendaftaran.</td></tr>'}</table></div>`;
}

function spmbRincian(r) {
  const fields = [
    ['Nama lengkap', r.nama], ['Nama panggilan', r.nama_panggilan], ['Jenis kelamin', r.jenis_kelamin],
    ['Tempat, tanggal lahir', [r.tempat_lahir, spmbTgl(r.tanggal_lahir)].filter(Boolean).join(', ')],
    ['NIK', r.nik], ['Anak ke', r.anak_ke], ['Jumlah saudara', r.jumlah_saudara],
    ['Alamat', [r.alamat, r.kelurahan, r.kecamatan, r.kota].filter(Boolean).join(', ')],
    ['Asal TK/KB', r.asal_tk], ['Alamat TK/KB', r.alamat_tk], ['Kondisi khusus', r.kondisi_khusus],
    ['Nama ayah', r.nama_ayah], ['Pekerjaan ayah', r.pekerjaan_ayah], ['HP ayah', r.hp_ayah],
    ['Nama ibu', r.nama_ibu], ['Pekerjaan ibu', r.pekerjaan_ibu], ['HP ibu', r.hp_ibu],
    ['Kontak utama', r.kontak], ['Email', r.email]
  ];
  return `<details class="card" style="margin:10px 0"><summary><b>${esc(r.no_daftar || '-')} · ${esc(r.nama)}</b> — ${esc(spmbLabelStatus(r.status))}</summary>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px;margin:14px 0">
      ${fields.map(([label, value]) => `<div><span class="mut">${esc(label)}</span><br><b>${esc(value ?? '') || '-'}</b></div>`).join('')}
    </div>
    <h3>Berkas</h3><div style="display:flex;gap:8px;flex-wrap:wrap">
      ${SPMB_BERKAS.map(([key, label]) => r['ada_' + key] ? `<span><button type="button" data-spmb-doc="${esc(r.id)}" data-kind="${key}">${label}</button><span class="spmb-doc-url"></span></span>` : `<span class="mut">${label}: belum ada</span>`).join('')}
    </div>
    <h3>Verifikasi</h3>
    <div class="grid"><div><label>Status</label><select data-spmb-status>${SPMB_STATUS.map(([id, label]) => `<option value="${id}" ${r.status === id ? 'selected' : ''}>${label}</option>`).join('')}</select></div>
      <div><label>Catatan untuk orang tua</label><input data-spmb-note value="${esc(r.catatan_panitia || '')}" maxlength="300"></div></div>
    <p><button type="button" class="p" data-spmb-save-status="${esc(r.id)}">Simpan status</button></p>
    <h3>Kelengkapan dan tahapan</h3>
    <div style="display:flex;gap:12px;flex-wrap:wrap">${SPMB_CHECKLIST.map(([key, label]) => `<label><input type="checkbox" data-spmb-check="${key}" ${r.checklist?.[key] ? 'checked' : ''}> ${label}</label>`).join('')}</div>
    <p><button type="button" data-spmb-save-check="${esc(r.id)}">Simpan checklist</button></p>
  </details>`;
}

function spmbDaftar(data, hanyaHasil = false) {
  const jalur = $('#spmbFilterJalur')?.value || '';
  const statusInput = $('#spmbFilterStatus');
  const status = statusInput ? statusInput.value : (hanyaHasil ? 'diterima' : '');
  const q = ($('#spmbCari')?.value || '').trim().toLowerCase();
  const hasil = data.pendaftar.filter(r =>
    (!jalur || r.jalur === jalur) && (!status || r.status === status) &&
    (!q || [r.no_daftar, r.nama, r.nama_ayah, r.nama_ibu, r.kontak].some(v => String(v || '').toLowerCase().includes(q)))
  );
  $('#spmbList').innerHTML = spmbTabel(hasil) + hasil.map(spmbRincian).join('');
}

function spmbPembayaran(pembayaran = []) {
  const menunggu = pembayaran.filter(p => p.status === 'menunggu');
  const selesai = pembayaran.filter(p => p.status !== 'menunggu');
  return `<section class="card" style="margin:12px 0">
    <h3 style="margin-top:0">Verifikasi pembayaran formulir TK Luar (${menunggu.length} menunggu)</h3>
    <p class="mut">Periksa bukti transfer dan pastikan nominal formulir Rp 375.000 sebelum menerima.</p>
    ${menunggu.length ? menunggu.map(p => `<div class="card" data-spmb-payment="${esc(p.id)}" style="margin:10px 0">
      <b>${esc(p.nama)}</b><div class="mut">WhatsApp ${esc(p.kontak)} · Dikirim ${esc(spmbTgl(p.created_at))}</div>
      <p><button type="button" data-spmb-payment-doc="${esc(p.id)}">Lihat bukti transfer</button> <span class="spmb-payment-url"></span></p>
      <label>Catatan jika ditolak</label><input data-spmb-payment-note maxlength="300" placeholder="Contoh: Nominal tidak sesuai atau bukti tidak terbaca">
      <p><button type="button" class="p" data-spmb-payment-accept="${esc(p.id)}">Terima (nominal sesuai)</button>
      <button type="button" data-spmb-payment-reject="${esc(p.id)}">Tolak bukti</button></p>
    </div>`).join('') : '<p class="mut">Tidak ada bukti pembayaran yang menunggu verifikasi.</p>'}
    ${selesai.length ? `<details><summary>Riwayat verifikasi (${selesai.length})</summary><div style="overflow:auto"><table>
      <tr><th>Calon murid</th><th>Kontak</th><th>Status</th><th>Catatan</th><th>Dikirim</th></tr>
      ${selesai.map(p => `<tr><td>${esc(p.nama)}</td><td>${esc(p.kontak)}</td><td>${p.status === 'valid' ? 'Diterima' : p.status === 'ditolak' ? 'Ditolak' : 'Sudah dipakai'}</td><td>${esc(p.catatan || '-')}</td><td>${esc(spmbTgl(p.created_at))}</td></tr>`).join('')}
    </table></div></details>` : ''}
  </section>`;
}

async function spmbTampil(tab) {
  spmbTabAktif = tab;
  try {
    const data = await spmbRequest();
    const rows = data.pendaftar || [];
    if (tab === 'spmbberanda') {
      const jumlah = status => rows.filter(r => r.status === status).length;
      const menungguBayar = (data.pembayaran || []).filter(p => p.status === 'menunggu').length;
      $('#view').innerHTML = `<h2>Ringkasan SPMB ${esc(data.tahun_ajaran)}</h2>
        <p class="mut">Data pendaftar dimuat dari database SPMB.</p>
        <div class="grid">${[['Total pendaftar', rows.length], ...SPMB_STATUS.map(([id, label]) => [label, jumlah(id)])].map(([label, n]) => `<div class="card"><b>${esc(n)}</b><div>${esc(label)}</div></div>`).join('')}</div>
        <p><b>${menungguBayar}</b> bukti pembayaran menunggu verifikasi.</p>
        <h3>Data terbaru</h3>${spmbTabel(rows.slice(0, 10))}`;
    } else if (tab === 'spmbatur') {
      $('#view').innerHTML = `<h2>Pengaturan periode SPMB</h2><p class="mut">Pengaturan setiap jalur tersimpan di database SPMB.</p><div id="spmbMsg" class="msg"></div>
        ${['dalam', 'luar'].map(jalur => {
          const p = data.pengaturan?.[jalur] || {};
          return `<section class="card" style="margin:12px 0"><h3>${jalur === 'dalam' ? 'TK At-Taqwa' : 'TK Luar'}</h3>
            <label><input type="checkbox" data-spmb-active="${jalur}" ${p.aktif !== false ? 'checked' : ''}> Pendaftaran aktif</label>
            <div class="grid"><div><label>Tanggal dibuka</label><input type="date" data-spmb-open="${jalur}" value="${esc(p.buka || '')}"></div>
            <div><label>Tanggal ditutup</label><input type="date" data-spmb-close="${jalur}" value="${esc(p.tutup || '')}"></div></div></section>`;
        }).join('')}
        <button class="p" id="spmbSaveSettings">Simpan pengaturan</button>`;
      $('#spmbSaveSettings').onclick = async () => {
        try {
          for (const jalur of ['dalam', 'luar']) {
            await spmbRequest({ action: 'pengaturan', jalur, aktif: $(`[data-spmb-active="${jalur}"]`).checked,
              buka: $(`[data-spmb-open="${jalur}"]`).value, tutup: $(`[data-spmb-close="${jalur}"]`).value });
          }
          $('#spmbMsg').textContent = 'Pengaturan berhasil disimpan.';
        } catch (error) { $('#spmbMsg').textContent = error.message || String(error); $('#spmbMsg').classList.add('err'); }
      };
    } else {
      const judul = tab === 'spmbhasil' ? 'Hasil seleksi SPMB' : 'Daftar pendaftar SPMB';
      $('#view').innerHTML = `<h2>${judul} (${rows.length})</h2><div id="spmbMsg" class="msg"></div>
        ${tab === 'spmbdaftar' ? spmbPembayaran(data.pembayaran) : ''}
        <div class="grid"><div><label>Jalur</label><select id="spmbFilterJalur"><option value="">Semua jalur</option><option value="dalam">TK At-Taqwa</option><option value="luar">TK Luar</option></select></div>
        <div><label>Status</label><select id="spmbFilterStatus"><option value="">Semua status</option>${SPMB_STATUS.map(([id, label]) => `<option value="${id}" ${tab === 'spmbhasil' && id === 'diterima' ? 'selected' : ''}>${label}</option>`).join('')}</select></div>
        <div><label>Cari pendaftar</label><input id="spmbCari" placeholder="Nomor, nama, atau kontak"></div></div><div id="spmbList"></div>`;
      const redraw = () => spmbDaftar(data, tab === 'spmbhasil');
      $('#spmbFilterJalur').onchange = redraw;
      $('#spmbFilterStatus').onchange = redraw;
      $('#spmbCari').oninput = redraw;
      redraw();
    }
    $('#view').onclick = async e => {
      const button = e.target.closest('button');
      if (!button) return;
      const errorBox = $('#spmbMsg');
      try {
        if (button.dataset.spmbDoc) {
          const result = await spmbRequest({ action: 'berkas', id: button.dataset.spmbDoc });
          const file = result.berkas?.[button.dataset.kind];
          if (!file?.url) throw new Error('Tautan berkas tidak tersedia.');
          spmbBukaPreview(file, SPMB_BERKAS.find(([key]) => key === button.dataset.kind)?.[1] || 'Berkas pendaftaran');
        } else if (button.dataset.spmbPaymentDoc) {
          const result = await spmbRequest({ action: 'berkas_bayar', id: button.dataset.spmbPaymentDoc });
          if (!result.url) throw new Error('Tautan bukti pembayaran tidak tersedia.');
          spmbBukaPreview(result, 'Bukti transfer formulir');
        } else if (button.dataset.spmbPaymentAccept || button.dataset.spmbPaymentReject) {
          const id = button.dataset.spmbPaymentAccept || button.dataset.spmbPaymentReject;
          const ditolak = !!button.dataset.spmbPaymentReject;
          const catatan = button.closest('[data-spmb-payment]').querySelector('[data-spmb-payment-note]').value.trim();
          if (ditolak && !catatan) throw new Error('Tulis alasan penolakan terlebih dahulu.');
          await spmbRequest({ action: 'verifikasi_bayar', id, status: ditolak ? 'ditolak' : 'valid', catatan });
          await spmbTampil(spmbTabAktif);
        } else if (button.dataset.spmbSaveStatus) {
          const detail = button.closest('details');
          await spmbRequest({ action: 'status', id: button.dataset.spmbSaveStatus,
            status: detail.querySelector('[data-spmb-status]').value, catatan: detail.querySelector('[data-spmb-note]').value });
          if (errorBox) errorBox.textContent = 'Status pendaftar berhasil disimpan.';
          await spmbTampil(spmbTabAktif);
        } else if (button.dataset.spmbSaveCheck) {
          const detail = button.closest('details'), checklist = {};
          detail.querySelectorAll('[data-spmb-check]').forEach(input => { checklist[input.dataset.spmbCheck] = input.checked; });
          await spmbRequest({ action: 'checklist', id: button.dataset.spmbSaveCheck, checklist });
          if (errorBox) errorBox.textContent = 'Checklist berhasil disimpan.';
          await spmbTampil(spmbTabAktif);
        }
      } catch (error) {
        const box = $('#spmbMsg');
        if (box) { box.textContent = error.message || String(error); box.classList.add('err'); }
        else spmbGagal(error);
      }
    };
  } catch (error) { spmbGagal(error); }
}

MODUL.spmb = () => spmbTampil('spmbdaftar');
MODUL.spmbberanda = () => spmbTampil('spmbberanda');
MODUL.spmbdaftar = () => spmbTampil('spmbdaftar');
MODUL.spmbhasil = () => spmbTampil('spmbhasil');
MODUL.spmbatur = () => spmbTampil('spmbatur');
