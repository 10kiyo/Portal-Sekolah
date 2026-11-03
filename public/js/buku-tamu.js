    const NAMA_ACARA_SEKARANG = "Pentas Seni dan Budaya"; 

    let guests = [];

    const $ = s => document.querySelector(s); 
    const storeKey = 'bukuTamuSekolah.v1'; 
    const eventStoreKey = 'bukuTamuSekolah.event.v1';
    const defaultEvent = { name:'Pentas Seni dan Budaya', place:'Aula Maftuchah UNJ', date:'12 Juli 2026' };
    
    // Pengaturan dari server (diatur panitia di menu "Atur buku tamu"): buka/tutup, menu admin, dan detail acara untuk semua perangkat.
    let BT = { aktif: true, pesan: '', menu: { acara: true, rekap: true, bagi: true, doorprize: true }, acara: null }, btAcara = null;
    const setBT = d => { BT = { ...BT, ...d }; btAcara = d.acara ? Object.fromEntries(Object.entries(d.acara).filter(([, v]) => v)) : null; };
    const eventInfo = () => ({...defaultEvent,...JSON.parse(localStorage.getItem(eventStoreKey)||'{}'),...(btAcara||{})});
    function terapkanTutup() {
      const tutup = BT.aktif === false;
      $('#tutupBox').classList.toggle('hidden', !tutup);
      $('#searchArea').classList.toggle('hidden', tutup);
      $('#guestHelp').classList.toggle('hidden', tutup);
      if (tutup) { $('#guest').classList.add('hidden'); $('#tutupPesan').textContent = BT.pesan || 'Silakan hubungi panitia atau petugas di lokasi.'; }
    }
    async function muatPengaturan() {
      try { const r = await fetch('/api/buku-tamu-pengaturan'); if (r.ok) { const d = await r.json(); if (!d.galat) setBT(d); } } catch (e) {}
      renderEventInfo(); terapkanTutup();
    }
    
    function renderEventInfo(){
      const info=eventInfo();
      $('#eventName').textContent=info.name;
      $('#eventPlace').textContent=info.place;
      $('#eventDate').textContent=info.date;
    }
    
    let selected, drawing = false, dirty = false, ctx;
    const saved = () => JSON.parse(localStorage.getItem(storeKey) || '{}');

    function normalizeAttendance(record) {
      const guestId = record.guestId || record.guest_id;
      const guest = guests.find(g => g.id === guestId);
      const invitation = guest?.invitation || record.invitation || record.jenisUndangan || record.jenis_undangan || 'Lainnya';
      const attendance = record.attendance || ((record.statusHadir ?? record.status_hadir) ? 'Hadir' : 'Tidak hadir');
      const origin = guest?.origin || record.origin || record.instansi_kelas || '—';

      const rawDate = record.confirmedAt || record.confirmed_at || new Date().toISOString();
      let formattedDate = rawDate;

      try {
        // Format yang sudah tersimpan: "DD/MM/YYYY, HH:MM" -> jangan di-parse dengan new Date()
        // (browser membacanya sebagai MM/DD sehingga hari & bulan tertukar).
        if (/^\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}$/.test(String(rawDate))) {
          formattedDate = rawDate;
        } else {
          // Format ISO (dari server atau dari form) -> ubah ke DD/MM/YYYY, HH:MM waktu lokal perangkat
          const d = new Date(rawDate);
          if (!isNaN(d.getTime())) {
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            formattedDate = `${day}/${month}/${year}, ${hours}:${minutes}`;
          }
        }
      } catch (e) {
        console.error(e);
      }

      return {
        guestId,
        name: guest?.name || record.name || record.guestName || record.guest_name || 'Tamu',
        invitation,
        origin,
        group: guest?.group || record.group || invitation,
        attendance,
        signature: record.signature || record.tandaTangan || record.tanda_tangandata || null,
        confirmedAt: formattedDate
      };
    }

    const save = async (id, entry) => {
      const all = saved();
      const normalizedEntry = normalizeAttendance(entry);
      all[id] = normalizedEntry;
      localStorage.setItem(storeKey, JSON.stringify(all));
      

      const currentEventInfo = eventInfo(); 

      try {
        const response = await fetch('/api/submit-attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId: id,
            guestName: normalizedEntry.name,
            statusHadir: normalizedEntry.attendance === 'Hadir',
            signature: normalizedEntry.signature,
            namaAcara: currentEventInfo.name,
            jenisUndangan: normalizedEntry.invitation
          })
        });

        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          if (response.status === 403) muatPengaturan();
          alert('Gagal sinkronisasi online: ' + (result.error || 'Terjadi kesalahan sistem.'));
        } else {
          alert('Sukses! Kehadiran ' + normalizedEntry.name + ' berhasil disimpan online.');
        }
      } catch (error) {
        console.error('Error saat submit online:', error);
        alert('Terjadi masalah jaringan. Data disimpan lokal pada browser.');
      }
    };
    
    const escapeHtml = s => String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
    
    renderEventInfo();
    
    $('#search').addEventListener('input', e => { 
      const q=e.target.value.trim().toLocaleLowerCase('id'); 
      const out=$('#matches'); 
      if(q.length<2) return out.innerHTML=''; 
      const result=guests.filter(g=>g.name.toLocaleLowerCase('id').includes(q)); 
      out.innerHTML = result.length ? result.map(g=>`<button class="match" type="button" data-id="${g.id}"><strong>${escapeHtml(g.name)}</strong><span>${escapeHtml(g.invitation)} · ${escapeHtml(g.origin)}</span></button>`).join('') : '<p class="hint">Nama belum ditemukan. Silakan hubungi petugas.</p>'; 
    });
    
    $('#matches').addEventListener('click', e => { 
      const btn=e.target.closest('[data-id]'); 
      if(btn) choose(guests.find(g=>g.id===btn.dataset.id)); 
    });
    
    // Nomor WhatsApp tamu hanya tampil 4 angka terakhir (bagian depan disamarkan dengan *).
    function samarkanNomor(n) {
      const s = String(n || '').replace(/\s+/g, '');
      if (!s) return '—';
      return s.length <= 4 ? '*'.repeat(s.length) : '*'.repeat(s.length - 4) + s.slice(-4);
    }
    function choose(g) { 
      selected=g; 
      $('#guestName').textContent=g.name; 
      $('#guestIntro').textContent='Periksa data di bawah sebelum menyimpan.'; 
      $('#guestInvitation').textContent=g.invitation; 
      $('#guestOrigin').textContent=g.origin; 
      $('#guestPhone').textContent=samarkanNomor(g.phone); 
      $('#guest').classList.remove('hidden'); 
      $('#notice').classList.add('hidden'); 
      $('#status').textContent=saved()[g.id]?'Sudah dikonfirmasi':'Belum dikonfirmasi'; 
      clearCanvas(); 
      setTimeout(initCanvas, 0); 
      $('#guest').scrollIntoView({behavior:'smooth',block:'start'}); 
    }
    
    function initCanvas() { 
      const c=$('#signature'), box=$('#signatureBox'); 
      const ratio=window.devicePixelRatio||1; 
      c.width=box.clientWidth*ratio; 
      c.height=c.clientHeight*ratio; 
      ctx=c.getContext('2d'); 
      ctx.scale(ratio,ratio); 
      ctx.lineCap='round'; 
      ctx.lineJoin='round'; 
      ctx.strokeStyle='#102a43'; 
      ctx.lineWidth=2.4; 
      dirty=false; 
    }
    
    function clearCanvas() { 
      if(!ctx) return; 
      const c=$('#signature'); 
      ctx.clearRect(0,0,c.width,c.height); 
      dirty=false; 
    }
    
    function point(e) { 
      const r=$('#signature').getBoundingClientRect(); 
      return {x:e.clientX-r.left,y:e.clientY-r.top}; 
    }
    
    const canvas=$('#signature'); 
    canvas.addEventListener('pointerdown',e=>{
      drawing=true; 
      dirty=true; 
      canvas.setPointerCapture(e.pointerId); 
      const p=point(e); 
      ctx.beginPath();
      ctx.moveTo(p.x,p.y);
    }); 
    canvas.addEventListener('pointermove',e=>{
      if(!drawing)return;
      const p=point(e);
      ctx.lineTo(p.x,p.y);
      ctx.stroke();
    }); 
    ['pointerup','pointercancel','pointerleave'].forEach(t=>canvas.addEventListener(t,()=>drawing=false));
    
    $('#clearSignature').addEventListener('click',clearCanvas);
    
    document.querySelectorAll('input[name="attendance"]').forEach(r=>r.addEventListener('change',e=>$('#signatureSection').classList.toggle('hidden',e.target.value==='Tidak hadir')));
    
    $('#attendanceForm').addEventListener('submit',async e=>{
      e.preventDefault(); 
      await muatPengaturan();
      if (BT.aktif === false) { alert('Buku tamu sedang ditutup.'); return; }
      
      const attendance=document.querySelector('input[name="attendance"]:checked').value; 
      if(attendance==='Hadir'&&!dirty){
        alert('Silakan bubuhkan tanda tangan terlebih dahulu.');
        return;
      } 
      const signature=attendance==='Hadir'?canvas.toDataURL('image/png'):null; 
      
      // Kirim waktu dalam format ISO; pemformatan DD/MM/YYYY dilakukan di normalizeAttendance
      const waktuISO = new Date().toISOString();

      save(selected.id,{guestId:selected.id,name:selected.name,invitation:selected.invitation,group:selected.group,attendance,signature,confirmedAt:waktuISO});
      
      alert('Terima kasih, konfirmasi kehadiran ' + selected.name + ' berhasil disimpan!');

      // 3. Sembunyikan kembali form detail tamu & kosongkan pencarian
      $('#guest').classList.add('hidden'); // Sembunyikan form tamu yang baru diisi
      $('#search').value = '';             // Kosongkan kolom pencarian
      $('#matches').innerHTML = '';        // Kosongkan hasil pencarian di bawahnya
      $('#search').focus();                // Kembalikan fokus kursor ke kolom pencarian
      
    });
    
    const loadOnlineData = async () => {
      try {
        const response = await fetch('/api/status-kehadiran');
        if (response.ok) {
          const dataOnline = await response.json();
          const all = {}; 

          dataOnline.forEach(item => {
            const entry = normalizeAttendance(item);
            if(entry.guestId) all[entry.guestId] = entry;
          });

          localStorage.setItem(storeKey, JSON.stringify(all));
        }
      } catch (error) {
        console.error('Gagal memuat data online:', error);
      }
    };

    const muatDaftarTamu = async () => {
      try {
        // Server menggabungkan daftar_tamu_gabungan dengan lapisan operator (murid baru, ganti nama/kelas, nonaktif).
        const response = await fetch('/api/daftar-tamu');
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const data = await response.json();

        if (Array.isArray(data)) {
          guests = data.map(item => ({
            id: item.guest_id,
            name: item.guest_name,
            invitation: item.jenis_undangan,
            origin: item.instansi_kelas,
            phone: item.nomor_whatsapp,
            group: item.jenis_undangan
          }));

          console.log(`Berhasil menarik ${guests.length} data tamu dari Supabase.`);
        }
      } catch (error) {
        console.error('Gagal memuat data tamu dari Supabase:', error);
      }
    };

    muatDaftarTamu();
    loadOnlineData();
    muatPengaturan();
  
