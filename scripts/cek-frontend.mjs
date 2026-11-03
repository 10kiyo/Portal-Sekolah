// Pemeriksa frontend tanpa browser: menjalankan skrip tiap halaman berurutan di V8 dengan DOM palsu untuk menangkap
// syntax error, deklarasi ganda ("already been declared"), serta berkas JS/CSS lokal yang hilang. Jalankan: npm run cek
import fs from 'fs'; import vm from 'vm'; import path from 'path';
import { fileURLToPath } from 'url';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
process.on('unhandledRejection', () => {}); // galat asinkron dari DOM palsu bukan temuan
let masalah=0, total=0;
for (const f of fs.readdirSync(dir).filter(x=>x.endsWith('.html'))) {
  const html=fs.readFileSync(path.join(dir,f),'utf8');
  const ctx=vm.createContext({console:{log(){},error(){},warn(){}}, setTimeout(){return 0}, setInterval(){return 0}, addEventListener(){}, location:{search:'',hash:'',href:'',pathname:'/'}, localStorage:{getItem(){return null},setItem(){}}, sessionStorage:{getItem(){return null},setItem(){}}, navigator:{userAgent:''}, URL, URLSearchParams, TextEncoder, TextDecoder, atob, btoa, Image:function(){}, requestAnimationFrame(){return 0}, cancelAnimationFrame(){}, matchMedia:()=>({matches:false,addEventListener(){}}), getComputedStyle:()=>({}), IntersectionObserver:function(){this.observe=()=>{}}, ResizeObserver:function(){this.observe=()=>{}}, MutationObserver:function(){this.observe=()=>{}}, Event:function(){}, CustomEvent:function(){}, FormData:function(){}, innerWidth:1200, innerHeight:800, scrollTo(){}, open(){}, print(){}, alert(){}, confirm(){return false}, prompt(){return null}, history:{replaceState(){},pushState(){}}, Intl, Promise, fetch:()=>new Promise(()=>{}), supabase:{createClient:()=>({auth:{onAuthStateChange(){},getSession:()=>new Promise(()=>{})},from:()=>({select:()=>new Promise(()=>{})})})}});
  ctx.window=ctx; ctx.self=ctx; ctx.top=ctx; ctx.parent=ctx; ctx.document=new Proxy(function(){}, {get:(t,k)=> k==='querySelector'||k==='getElementById'||k==='querySelectorAll'? ()=>null : ()=>{}, set:()=>true});
  const re=/<script([^>]*)>([\s\S]*?)<\/script>/g; let m;
  while((m=re.exec(html))){
    const src=(/src="([^"]+)"/.exec(m[1])||[])[1]; let code=m[2];
    if(src){ if(/^https?:/.test(src)) continue; const p=path.join(dir,src.split('?')[0]); if(!fs.existsSync(p)){console.log('FILE HILANG',f,src);masalah++;continue;} code=fs.readFileSync(p,'utf8'); }
    if(!code.trim()) continue; total++;
    try{ new vm.Script(code,{filename:src||f}); }catch(e){ console.log('SYNTAX',f,src||'(inline)',e.message); masalah++; continue; }
    try{ vm.runInContext(code,ctx,{timeout:500}); }catch(e){ if(/already been declared/.test(e.message)){ console.log('BENTROK',f,src||'(inline)',e.message); masalah++; } else if(e&&e.name==='ReferenceError'){ console.log('NAMA HILANG',f,src||'(inline)',e.message); masalah++; } }
  }
  // link css yang dirujuk harus ada, dan url() relatif di dalamnya harus valid (dihitung dari lokasi file CSS)
  for(const l of html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)) { if(/^https?:/.test(l[1])) continue; const cp=path.join(dir,l[1].split('?')[0]); if(!fs.existsSync(cp)){console.log('CSS HILANG',f,l[1]);masalah++;continue;} for(const u of fs.readFileSync(cp,'utf8').matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)){ const v=u[1]; if(/^(data:|https?:|#|\/\/)/.test(v)) continue; const tp=v.startsWith('/')?path.join(dir,v):path.join(path.dirname(cp),v.split(/[?#]/)[0]); if(!fs.existsSync(tp)){console.log('URL CSS RUSAK',l[1],'->',v);masalah++;} } }
}
console.log(`${total} blok skrip diperiksa, masalah: ${masalah}`);
process.exitCode = masalah ? 1 : 0;
