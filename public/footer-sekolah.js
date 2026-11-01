/* Footer identitas sekolah (sama dengan footer di halaman Profil Sekolah).
   Pakai di halaman mana pun: <script src="footer-sekolah.js"></script> di akhir <body>.
   Edit isi footer cukup di file ini. */
(() => {
  const st = document.createElement('style');
  st.textContent = `.idf{flex:none;background:var(--navy);color:#d9e6f2;border-radius:26px 26px 0 0;padding:clamp(26px,4vw,44px) clamp(18px,5vw,64px);box-shadow:0 -10px 40px #102a4318}
.idf .in{max-width:1100px;margin:0 auto}
.idf .copy{margin-top:28px;padding-top:18px;border-top:1px solid #ffffff22;font-size:13px;color:#9db4c9}
.idf .cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:clamp(22px,3vw,32px)}
.idf h3{margin:0 0 14px;color:#8fcbff;font-size:18px;letter-spacing:-.01em}
.idf .logo{display:flex;align-items:center;gap:12px}
.idf .logo img{width:56px;height:56px;background:#fff;border-radius:14px;padding:5px;object-fit:contain}
.idf .logo b{display:block;color:#fff;font-size:18px;letter-spacing:-.02em}
.idf .logo span{font-size:13px;color:#9db4c9}
.idf p{margin:0;line-height:1.7;font-size:15px}
.idf .desc{margin-top:16px;color:#c3d4e4}
.idf .lbl{display:block;margin:0 0 4px;font-size:12px;font-weight:800;letter-spacing:.08em;color:#8fcbff;text-transform:uppercase}
.idf .blk{margin-bottom:16px}.idf .blk b{display:block;color:#fff;margin-bottom:3px}
.idf a{color:#fff}
.idf .badge{display:block;margin-top:18px;padding:12px 14px;border:1px solid #ffffff30;border-radius:14px;background:#ffffff0d;font-size:14px}
.idf .badge b{display:block;color:#8fcbff}.idf .badge a{font-size:13px;color:#c3d4e4}
.idf .soc{display:flex;gap:10px;margin-top:18px}
.idf .soc a{width:42px;height:42px;display:grid;place-items:center;border:1px solid #ffffff30;border-radius:50%;background:#ffffff0d;transition:.18s}
.idf .soc a:hover{background:#ffffff26;transform:translateY(-2px)}
.idf .soc svg{width:20px;height:20px;fill:none;stroke:#fff;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.idf iframe.map{width:100%;height:190px;border:0;border-radius:16px;background:#1d3d5a;display:block}
.idf .pills{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.idf .pills a{text-decoration:none;font-weight:700;font-size:14px;padding:8px 14px;border:1px solid #ffffff30;border-radius:99px;background:#ffffff0d}
.idf .pills a:hover{background:#ffffff26}
.idf a:focus-visible{outline:3px solid #8fcbff80;outline-offset:2px}
.idf{margin-top:auto}`;
  document.head.appendChild(st);
  const html = (`<div class="in"><div class="cols">
  <div>
    <div class="logo"><img src="logo-at-taqwa.png" alt=""><div><b>SDS Islam At-Taqwa</b><span>Rawamangun, Jakarta Timur</span></div></div>
    <p class="desc">Belajar Nyaman, Perilaku Islami, Insan Bertaqwa</p>
    <div class="badge"><b>Izin &amp; Akreditasi</b>NPSN: 20109114 · Akreditasi: A (skor 98, BAN)<br><a href="https://ban-pdm.id/satuanpendidikan/20109114" target="_blank" rel="noopener">Cek Akreditasi →</a></div>
    <div class="soc">
      <a href="https://www.instagram.com/sdi_attaqwa/" target="_blank" rel="noopener" aria-label="Instagram"><svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".6"/></svg></a>
      <a href="https://bit.ly/facebook-attaqwa" target="_blank" rel="noopener" aria-label="Facebook"><svg viewBox="0 0 24 24"><path d="M14.5 21v-8h2.7l.5-3.2h-3.2V7.9c0-.9.4-1.6 1.7-1.6h1.6V3.5c-.3 0-1.3-.2-2.4-.2-2.4 0-4 1.4-4 4.1v2.4H8.3V13H11v8z"/></svg></a>
      <a href="https://www.youtube.com/@sdiattaqwa2688" target="_blank" rel="noopener" aria-label="YouTube"><svg viewBox="0 0 24 24"><rect x="2.8" y="5.8" width="18.4" height="12.4" rx="3.6"/><path d="M10 9.4v5.2l4.6-2.6z"/></svg></a>
    </div>
  </div>
  <div>
    <h3>Hubungi Kami</h3>
    <div class="blk"><span class="lbl">WhatsApp</span><a href="https://wa.me/6281220706200" target="_blank" rel="noopener">+62-812-2070-6200</a></div>
    <div class="blk"><span class="lbl">Email</span><a href="mailto:info@attaqwa.sch.id">info@attaqwa.sch.id</a></div>
    <div class="blk"><span class="lbl">Jam layanan</span><p>Senin – Jumat, 07:00 – 16:00</p></div>
  </div>
  <div>
    <h3>Alamat Sekolah</h3>
    <div class="blk"><b>SDS Islam At-Taqwa Rawamangun</b><p>Jl. Daksinapati Raya No. 2, Komp. UI/UNJ, RT.11/RW.14, Rawamangun, Kec. Pulogadung, Jakarta Timur, 13220</p></div>
    <div class="blk"><span class="lbl">Jenjang / Status</span><p>Sekolah Dasar (Swasta)</p></div>
    <div class="blk"><span class="lbl">Tahun Berdiri</span><p>2002</p></div>
    <div class="blk"><span class="lbl">Kepala Sekolah</span><p>Ibu Nurbaiti, S.Pd.</p></div>
  </div>
  <div>
    <h3>Lokasi Sekolah</h3>
    <iframe class="map" title="Peta lokasi sekolah" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=SDS+Islam+At-Taqwa+Rawamangun,+Jl.+Daksinapati+Raya+No.+2,+Jakarta+Timur&hl=id&z=16&output=embed" allowfullscreen></iframe>
    <div class="pills"><a href="https://www.google.com/maps/search/?api=1&query=SDS+Islam+At-Taqwa+Rawamangun" target="_blank" rel="noopener">Buka di Google Maps</a></div>
  </div>
</div>
<div class="copy">© ${new Date().getFullYear()} SDS Islam At-Taqwa Rawamangun. Seluruh layanan digital ini disiapkan untuk mendukung orang tua, guru, dan tamu sekolah.</div></div>`);
  let f = document.getElementById('foot');
  if (!f) { f = document.createElement('footer'); f.id = 'foot'; document.body.appendChild(f); }
  f.className = 'idf'; f.setAttribute('aria-label', 'Identitas Sekolah');
  f.innerHTML = html;
})();
