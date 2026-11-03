(function(){

const $=s=>document.querySelector(s);
const TOKEN_KEY='bukuTamuSekolah.adminToken';
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let guests=[], recs={}, view=[], dist={}, notes={}, distErr="", mode="rekap", pending=null;
const FN="/api/admin-checklist", DEFAULT_ITEMS=[{key:"bingkisan",label:"Bingkisan"},{key:"snack",label:"Snack"}];
let items=DEFAULT_ITEMS.slice();

/* ---------- Login ---------- */
const tokenValid=()=>{const t=sessionStorage.getItem(TOKEN_KEY);return !!t&&Number(t.split('.')[0])>Date.now()};
function enter(){$('#login').classList.add('hidden');$('#app').classList.remove('hidden');renderEvent();loadAll();terapkanMenu()}
/* Menu panel admin mengikuti pengaturan panitia (menu yang dimatikan disembunyikan) */
async function terapkanMenu(){
  await muatPengaturan();renderEvent();
  const tabs=[...document.querySelectorAll('.tabs [data-mode]')];
  tabs.forEach(b=>b.classList.toggle('hidden',BT.menu&&BT.menu[b.dataset.mode]===false));
  const on=tabs.find(b=>b.classList.contains('on'));
  if(!on||on.classList.contains('hidden')){const first=tabs.find(b=>!b.classList.contains('hidden'));if(first)first.click()}
}
$('#loginForm').addEventListener('submit',async e=>{
  e.preventDefault();$('#loginErr').textContent='';
  try{
    const r=await fetch('/api/admin-auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:$('#pin').value})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d.token){$('#loginErr').textContent=d.error||'Login gagal. Pastikan fungsi admin-auth sudah ter-deploy.';return}
    sessionStorage.setItem(TOKEN_KEY,d.token);$('#pin').value='';enter();
  }catch{$('#loginErr').textContent='Tidak dapat terhubung ke server.'}
});
const guestView=document.querySelector('#guestView');
function openAdmin(){
  guestView.classList.add('hidden');$('#adminRoot').classList.remove('hidden');window.scrollTo(0,0);
  if(tokenValid())enter();else{$('#login').classList.remove('hidden');$('#app').classList.add('hidden');setTimeout(()=>$('#pin').focus(),0)}
}
function closeAdmin(){
  sessionStorage.removeItem(TOKEN_KEY);
  $('#adminRoot').classList.add('hidden');guestView.classList.remove('hidden');
  $('#login').classList.remove('hidden');$('#app').classList.add('hidden');
  if(location.hash==='#admin')history.replaceState(null,'',location.pathname);
  document.querySelector('#search').focus();
}
$('#logout').addEventListener('click',closeAdmin);
// Kembali ke Panel Panitia tanpa keluar: token login dipakai bersama, jadi tidak perlu PIN lagi.
$('#toPanitia').addEventListener('click',()=>{(window.top||window).location.href='/#kegiatan'});
$('#backGuest').addEventListener('click',closeAdmin);
// Tidak ada tombol Admin di halaman tamu. Panel admin dibuka panitia lewat Panel Panitia (tautan /#admin) dan tetap butuh PIN.
if(location.hash==='#admin')openAdmin();

/* ---------- Detail acara ---------- */
function renderEvent(){
  const i=eventInfo();
  $('#evLine').textContent=`${i.name} · ${i.place} · ${i.date}`;
  $('#phInfo').textContent=`Acara: ${i.name}   |   Tempat: ${i.place}   |   Tanggal: ${i.date}`;
}

/* ---------- Data ---------- */
const p2=n=>String(n).padStart(2,'0');
function fmt(raw){
  if(!raw)return'—';
  if(/^\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}$/.test(raw))return raw;
  const d=new Date(raw);
  return isNaN(d)?String(raw):`${p2(d.getDate())}/${p2(d.getMonth()+1)}/${d.getFullYear()}, ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}
async function fetchGuests(){
  // Server menggabungkan daftar tamu dengan lapisan operator (murid baru, ganti nama/kelas, nonaktif). Token admin = nomor WhatsApp lengkap untuk CSV.
  const r=await fetch('/api/daftar-tamu',{headers:{Authorization:'Bearer '+sessionStorage.getItem(TOKEN_KEY)}});
  if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||('HTTP '+r.status));
  return (await r.json()).map(x=>({id:x.guest_id,name:x.guest_name,type:x.jenis_undangan||'Lainnya',origin:x.instansi_kelas||'—',phone:x.nomor_whatsapp||''}));
}
async function fetchDist(){
  const r=await fetch(FN,{headers:{Authorization:'Bearer '+sessionStorage.getItem(TOKEN_KEY)}});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.error||('HTTP '+r.status));
  const rows=Array.isArray(d)?d:(d.rows||[]),m={};
  const nt={};
  rows.forEach(x=>{m[x.guest_id+'|'+x.item]=fmt(x.given_at);if(x.item==='doorprize'&&x.catatan)nt[x.guest_id]=x.catatan});
  return{map:m,notes:nt,items:Array.isArray(d.items)?d.items:null};
}
async function fetchAttendance(){
  const r=await fetch('/api/get-attendance',{headers:{Authorization:'Bearer '+sessionStorage.getItem(TOKEN_KEY)}});
  if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.error||('get-attendance: '+r.status))}
  return r.json();
}
async function loadAll(){
  $('#state').textContent='Memuat data…';
  try{
    distErr='';
    const[g,a,m]=await Promise.all([fetchGuests(),fetchAttendance(),fetchDist().catch(e=>{distErr=e.message;return{map:{},items:null}})]);
    guests=g;recs={};dist=m.map;notes=m.notes||{};if(m.items)items=m.items;renderManage();
    a.forEach(x=>{
      const id=x.guestId||x.guest_id;if(!id)return;
      recs[id]={status:x.attendance||((x.statusHadir??x.status_hadir)?'Hadir':'Tidak hadir'),sig:x.signature||x.tandaTangan||x.tanda_tangandata||null,at:fmt(x.confirmedAt||x.confirmed_at)};
    });
    const types=[...new Set(guests.map(x=>x.type))].sort((a,b)=>a.localeCompare(b,'id'));
    const cur=$('#fType').value;
    $('#fType').innerHTML='<option value="">Semua</option>'+types.map(t=>`<option>${esc(t)}</option>`).join('');
    $('#fType').value=types.includes(cur)?cur:'';
    fillOrg();render();
    $('#state').textContent='Diperbarui '+p2(new Date().getHours())+':'+p2(new Date().getMinutes());
  }catch(e){$('#state').textContent='Gagal memuat data: '+(e.message||e)}
}
$('#reload').addEventListener('click',loadAll);

/* ---------- Tampilan ---------- */
const has=(id,i)=>dist[id+'|'+i];
const sumItem=list=>items.map(it=>`${esc(it.label)} ${list.filter(x=>has(x.id,it.key)).length}/${list.length}`).join(' · ');
async function api(body){
  const r=await fetch(FN,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+sessionStorage.getItem(TOKEN_KEY)},body:JSON.stringify(body)});
  if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||('HTTP '+r.status));
}
async function setItem(id,item,val){
  const k=id+'|'+item,old=dist[k];
  if(val)dist[k]=fmt(new Date().toISOString());else{delete dist[k];if(item==='doorprize')delete notes[id]}
  render();
  try{await api({guestId:id,item,value:val})}
  catch(e){if(old)dist[k]=old;else delete dist[k];render();alert('Gagal menyimpan: '+e.message)}
}
async function saveItems(next){
  const prev=items;items=next;renderManage();render();
  try{
    await api({action:'setItems',items:next});
    const keys=new Set(next.map(x=>x.key));
    Object.keys(dist).forEach(k=>{const i=k.split('|')[1];if(i!=='doorprize'&&!keys.has(i))delete dist[k]});render();
  }catch(e){items=prev;renderManage();render();alert('Gagal menyimpan item: '+e.message)}
}
function renderManage(){
  $('#itemCount').textContent=items.length+' item';
  $('#itemList').innerHTML=items.length?items.map(x=>`<div class="irow"><input data-k="${esc(x.key)}" value="${esc(x.label)}" maxlength="40"><button class="secondary" data-del="${esc(x.key)}" type="button">Hapus</button></div>`).join(''):'<p class="state">Belum ada item. Tambahkan di bawah.</p>';
}
function fillOrg(){
  const type=$('#fType').value,cur=$('#fOrg').value;
  const os=[...new Set(guests.filter(g=>!type||g.type===type).map(g=>g.origin))].sort((a,b)=>a.localeCompare(b,'id',{numeric:true}));
  $('#fOrg').innerHTML='<option value="">Semua</option>'+os.map(o=>`<option>${esc(o)}</option>`).join('');
  $('#fOrg').value=os.includes(cur)?cur:'';
}
function render(){
  const type=$('#fType').value,st=$('#fStatus').value,q=$('#fSearch').value.trim().toLocaleLowerCase('id');
  const org=$('#fOrg').value;
  const base=guests.filter(g=>(!type||g.type===type)&&(!org||g.origin===org)).map(g=>{const r=recs[g.id];return{...g,status:r?r.status:'Belum konfirmasi',sig:r?.sig||null,at:r?r.at:'—'}});
  $('#sTotal').textContent=base.length;
  $('#sHadir').textContent=base.filter(x=>x.status==='Hadir').length;
  $('#sTidak').textContent=base.filter(x=>x.status==='Tidak hadir').length;
  $('#sBelum').textContent=base.filter(x=>x.status==='Belum konfirmasi').length;
  view=base.filter(x=>(!st||x.status===st)&&(!q||x.name.toLocaleLowerCase('id').includes(q)));
  const bagi=mode==='bagi',door=mode==='doorprize';
  const hadir=base.filter(x=>x.status==='Hadir');
  const sum=sumItem;
  const types=[...new Set(guests.map(g=>g.type))].sort((a,b)=>a.localeCompare(b,'id')).filter(t=>!type||t===type);
  const cnt=t=>{const l=guests.filter(g=>g.type===t&&(!org||g.origin===org)),h=l.filter(g=>recs[g.id]?.status==='Hadir').length,n=l.filter(g=>recs[g.id]?.status==='Tidak hadir').length;return[l.length,h,n,l.length-h-n]};
  const tot=[0,0,0,0],pc=(h,t)=>(t?Math.round(h/t*100):0)+'%';
  const srows=types.map(t=>{const c=cnt(t);c.forEach((v,i)=>tot[i]+=v);return`<tr><td>${esc(t)}</td><td>${c[0]}</td><td>${c[1]}</td><td>${c[2]}</td><td>${c[3]}</td><td>${pc(c[1],c[0])}</td></tr>`}).join('');
  $('#phSum').innerHTML=mode==='rekap'&&types.length?`<table class="sumt"><thead><tr><th>Jenis undangan</th><th>Undangan</th><th>Hadir</th><th>Tidak hadir</th><th>Belum konfirmasi</th><th>% Hadir</th></tr></thead><tbody>${srows}</tbody>${types.length>1?`<tfoot><tr><td>Total</td><td>${tot[0]}</td><td>${tot[1]}</td><td>${tot[2]}</td><td>${tot[3]}</td><td>${pc(tot[1],tot[0])}</td></tr></tfoot>`:''}</table>`:'';
  $('#door').classList.toggle('hidden',!door);
  $('#itemBox').classList.toggle('hidden',!bagi);
  $('#phTitle').textContent=bagi?'Checklist Pembagian':door?'Pemenang Doorprize':'Rekap Kehadiran Buku Tamu Sekolah';
  $('#prog').innerHTML=mode==='rekap'?'':distErr?'Checklist belum aktif: '+esc(distErr):bagi?(items.length?'Tamu hadir yang sudah menerima — '+sum(hadir):'Belum ada item pembagian. Buka "Kelola item" untuk menambahkan.'):'';
  if(door){
    const pool=hadir.filter(x=>!has(x.id,'doorprize')),win=view.filter(x=>has(x.id,'doorprize'));
    $('#doorInfo').textContent=`Peserta layak undi: ${pool.length} (hadir dan belum menang) · Pemenang: ${base.filter(x=>has(x.id,'doorprize')).length}`;
    $('#list').innerHTML=win.length?`<div class="scroll"><table><thead><tr><th>Pemenang</th><th>Instansi / Kelas</th><th>Waktu</th><th>Hadiah / catatan</th><th class="noprint"></th></tr></thead><tbody>${win.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.origin)}</td><td class="t">${esc(has(x.id,'doorprize'))}</td><td><input class="note" data-note="${esc(x.id)}" value="${esc(notes[x.id]||'')}" maxlength="200" placeholder="mis. Sepeda, voucher…" aria-label="Hadiah untuk ${esc(x.name)}"></td><td class="noprint"><button class="secondary" data-undo="${esc(x.id)}" type="button">Batalkan</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="state">Belum ada pemenang.</p>';
    return;
  }
  if(bagi&&!items.length){$('#list').innerHTML='';return}
  if(!view.length){$('#list').innerHTML='<p class="state">Tidak ada data yang cocok.</p>';return}
  const groups={};view.forEach(x=>(groups[x.origin]??=[]).push(x));
  const badge=x=>`<span class="badge ${x.status==='Hadir'?'b-h':x.status==='Tidak hadir'?'b-t':'b-b'}">${esc(x.status)}</span>`;
  const cols=bagi?'<col class="c-no"><col><col class="c-st">'+items.map(()=>'<col class="c-it">').join('')
    :'<col class="c-no"><col><col class="c-st"><col class="c-sg"><col class="c-wk">';
  const minW=bagi?44+220+130+items.length*150:44+220+130+190+140;
  const head='<th class="nm">No</th>'+(bagi?'<th>Nama</th><th>Status</th>'+items.map(it=>`<th>${esc(it.label)}</th>`).join(''):'<th>Nama</th><th>Status</th><th>Tanda tangan</th><th>Waktu</th>');
  const row=(x,i)=>bagi?`<tr><td class="nm">${i+1}</td><td>${esc(x.name)}</td><td>${badge(x)}</td>${items.map(it=>{const v=has(x.id,it.key);return`<td><label class="ck"><input type="checkbox" data-g="${esc(x.id)}" data-i="${esc(it.key)}" ${v?'checked':''}><span class="t">${v?esc(v.split(', ')[1]||''):''}</span></label></td>`}).join('')}</tr>`
    :`<tr><td class="nm">${i+1}</td><td>${esc(x.name)}</td><td>${badge(x)}</td><td>${x.sig?`<img class="sig" src="${esc(x.sig)}" alt="Tanda tangan ${esc(x.name)}">`:'—'}</td><td class="t">${esc(x.at)}</td></tr>`;
  $('#list').innerHTML=Object.entries(groups).sort((a,b)=>a[0].localeCompare(b[0],'id',{numeric:true})).map(([k,list])=>{
    list.sort((a,b)=>a.name.localeCompare(b.name,'id'));
    return`<section class="group"><h3>${esc(type?type+' - ':'')}${esc(k)}</h3><p>${list.length} tamu${bagi?' · '+sum(list):''}</p><div class="scroll"><table style="min-width:${minW}px"><colgroup>${cols}</colgroup><thead><tr>${head}</tr></thead><tbody>${list.map((x,i)=>row(x,i)).join('')}</tbody></table></div></section>`;
  }).join('');
}
$('#list').addEventListener('change',e=>{const c=e.target.closest('[data-g]');if(c&&mode==='bagi')setItem(c.dataset.g,c.dataset.i,c.checked)});
$('#list').addEventListener('change',async e=>{
  const i=e.target.closest('[data-note]');if(!i)return;
  const id=i.dataset.note,v=i.value.trim(),old=notes[id]||'';if(v===old)return;
  if(v)notes[id]=v;else delete notes[id];
  try{await api({action:'setNote',guestId:id,catatan:v})}
  catch(err){if(old)notes[id]=old;else delete notes[id];i.value=old;alert('Gagal menyimpan catatan: '+err.message)}
});
$('#list').addEventListener('click',e=>{const u=e.target.closest('[data-undo]');if(u&&confirm('Batalkan pemenang ini?'))setItem(u.dataset.undo,'doorprize',false)});
$('#itemList').addEventListener('change',e=>{const i=e.target.closest('[data-k]');if(!i)return;const v=i.value.trim();if(!v){renderManage();return}saveItems(items.map(x=>x.key===i.dataset.k?{...x,label:v}:x))});
$('#itemList').addEventListener('click',e=>{const b=e.target.closest('[data-del]');if(!b)return;const it=items.find(x=>x.key===b.dataset.del);if(it&&confirm(`Hapus item "${it.label}"? Centang yang sudah tercatat untuk item ini ikut terhapus.`))saveItems(items.filter(x=>x!==it))});
$('#itemAdd').addEventListener('submit',e=>{
  e.preventDefault();const v=$('#itemNew').value.trim();if(!v)return;
  if(items.length>=12){alert('Maksimal 12 item.');return}
  $('#itemNew').value='';saveItems([...items,{key:'i'+Date.now().toString(36),label:v}]);
});
document.querySelector('.tabs').addEventListener('click',e=>{
  const b=e.target.closest('[data-mode]');if(!b)return;
  mode=b.dataset.mode;pending=null;$('#drawBox').textContent='—';$('#saveWin').classList.add('hidden');
  document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('on',x===b));
  $('#fStatus').value=(mode==='bagi'||mode==='doorprize')?'Hadir':'';render();
});
$('#drawBtn').addEventListener('click',()=>{
  const type=$('#fType').value,org=$('#fOrg').value;
  const pool=guests.filter(g=>(!type||g.type===type)&&(!org||g.origin===org)&&recs[g.id]?.status==='Hadir'&&!has(g.id,'doorprize'));
  if(!pool.length){alert('Tidak ada peserta yang layak diundi.');return}
  const rnd=n=>crypto.getRandomValues(new Uint32Array(1))[0]%n;
  $('#drawBtn').disabled=true;$('#saveWin').classList.add('hidden');let n=0;
  const t=setInterval(()=>{
    $('#drawBox').textContent=pool[rnd(pool.length)].name;
    if(++n>22){clearInterval(t);pending=pool[rnd(pool.length)];$('#drawBox').textContent=pending.name+' ('+pending.origin+')';$('#drawBtn').disabled=false;$('#drawBtn').textContent='Undi ulang';$('#saveWin').classList.remove('hidden')}
  },70);
});
$('#saveWin').addEventListener('click',()=>{
  if(!pending)return;const w=pending;pending=null;
  $('#saveWin').classList.add('hidden');$('#drawBtn').textContent='Undi pemenang';setItem(w.id,'doorprize',true);
});
$('#fType').addEventListener('change',()=>{fillOrg();render()});
['fStatus','fOrg'].forEach(id=>$('#'+id).addEventListener('change',render));
$('#fSearch').addEventListener('input',render);
function stamp(){
  const d=new Date();
  $('#phFilter').textContent=`Jenis undangan: ${$('#fType').value||'Semua'}  |  Kelas/Instansi: ${$('#fOrg').value||'Semua'}  |  Status: ${$('#fStatus').value||'Semua'}  |  Dicetak: ${p2(d.getDate())}/${p2(d.getMonth()+1)}/${d.getFullYear()}, ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}
window.addEventListener('beforeprint',stamp);
/* Cetak lewat pembuat dokumen seragam (js/cetak.js): kop surat, judul sesuai menu, info acara & filter, tabel per kelas/instansi, kolom tanda tangan. */
function cetakRekap(){
  const bagi=mode==='bagi',door=mode==='doorprize',type=$('#fType').value;
  if(bagi&&!items.length){alert('Belum ada item pembagian untuk dicetak.');return}
  stamp();
  const judul=$('#phTitle').textContent;
  const sub=[$('#phInfo').textContent,$('#phFilter').textContent,$('#prog').textContent].filter(Boolean).map(esc).join('<br>');
  const no={h:'No',c:'c',v:(x,i)=>i+1},nama={h:'Nama',v:x=>esc(x.name)},status={h:'Status',v:x=>esc(x.status)};
  let isi='';
  if(mode==='rekap'&&$('#phSum').innerHTML)isi+=$('#phSum').innerHTML.replace('<table class="sumt">','<table class="t">');
  if(door){
    const win=view.filter(x=>has(x.id,'doorprize'));
    isi+=cetakTabel([no,{h:'Pemenang',v:x=>esc(x.name)},{h:'Instansi / Kelas',v:x=>esc(x.origin)},{h:'Waktu',c:'n',v:x=>esc(has(x.id,'doorprize'))},{h:'Hadiah / catatan',v:x=>esc(notes[x.id]||'')}],win,'Belum ada pemenang.');
  }else if(!view.length)isi+='<p>Tidak ada data yang cocok.</p>';
  else{
    const groups={};view.forEach(x=>(groups[x.origin]??=[]).push(x));
    const kol=bagi?[no,nama,status,...items.map(it=>({h:esc(it.label),v:x=>esc(has(x.id,it.key)||'')}))]
      :[no,nama,status,{h:'Tanda tangan',v:x=>x.sig?`<img class="sig" src="${esc(x.sig)}" alt="">`:'—'},{h:'Waktu',c:'n',v:x=>esc(x.at)}];
    isi+=Object.entries(groups).sort((a,b)=>a[0].localeCompare(b[0],'id',{numeric:true})).map(([k,list])=>{
      list.sort((a,b)=>a.name.localeCompare(b.name,'id'));
      return cetakBagian(esc((type?type+' - ':'')+k),`${list.length} tamu${bagi?' · '+sumItem(list):''}`,cetakTabel(kol,list));
    }).join('');
  }
  isi+='<div class="ttd"><div><p>Mengetahui,<br>Kepala Sekolah</p>( ................................ )</div><div><p>Jakarta, ................................<br>Ketua Panitia</p>( ................................ )</div></div>';
  cetakPratinjau(judul,cetakDokumen(judul,isi,{sub,css:'.sig{display:block;height:11mm;max-width:34mm;object-fit:contain}.ttd{display:flex;justify-content:space-between;gap:10mm;margin-top:10mm;text-align:center;page-break-inside:avoid}.ttd div{flex:1}.ttd p{margin:0 0 18mm}'}));
}
$('#print').addEventListener('click',cetakRekap);

/* ---------- Ekspor CSV ---------- */
$('#csv').addEventListener('click',()=>{
  if(!view.length){alert('Tidak ada data untuk diekspor.');return}
  const cell=v=>`"${String(v??'').replace(/"/g,'""')}"`;
  const yn=(x,i)=>has(x.id,i)?'Ya':'';
  const rows=[['Nama','Jenis undangan','Instansi / Kelas','Nomor WhatsApp','Status','Waktu konfirmasi',...items.map(i=>i.label),'Doorprize','Hadiah / catatan doorprize'],...view.map(x=>[x.name,x.type,x.origin,x.phone,x.status,x.at,...items.map(i=>yn(x,i.key)),yn(x,'doorprize'),notes[x.id]||''])];
  const blob=new Blob(['\ufeff'+rows.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download=`rekap-kehadiran-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href);
});

})();
