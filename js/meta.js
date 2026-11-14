try{
/* Meta Index: image + video metadata reader / remover. Runs fully on the device (the file is never uploaded).
   Members only: before the tool opens, the Supabase edge function "illuminati-gate" verifies the Telegram initData (opened from the channel) and the membership. Fails closed. */
(function(V){
const $=s=>document.querySelector(s),hap=t=>{try{V.tg.haptic(t)}catch(e){}};
const NETERR="Network error. Try again.",TTL=120000,TIMEOUT=12000,REQUIRE_PROFILE=false;
let OK=false,okAt=0,gating=false,XR=null;
const toTop=()=>{const s=$('#miSheet');if(s)s.scrollTop=0};

/* ---------- members-only gate ---------- */
const MSG={
 open:['Open from the channel','This tool only works as a Telegram miniapp, launched from the members\u2019 channel.'],
 denied:['Access denied','This tool is only for members of the paid channel. Join the channel, then reopen it from there.'],
 banned:['Access revoked','Your membership access has been revoked.'],
 profile:['Complete your profile','Finish your member profile in the Member Portal first, then reopen this tool.'],
 net:['Could not verify','We could not verify your membership. Check your connection and try again.']};
const LOCK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>';
function gateView(h){const g=$('#miGate'),a=$('#miApp');if(g){g.hidden=false;g.innerHTML=h}if(a)a.hidden=true}
function spinner(){gateView('<div class="mi-sp"></div><p>Verifying membership</p>')}
function fail(k,extra,ref){const m=MSG[k]||MSG.denied;
 gateView('<div class="mi-gi">'+LOCK+'</div><h3>'+m[0]+'</h3><p>'+(k==='denied'&&extra?esc(extra):m[1])+'</p>'
  +(ref?'<p class="mi-ref">Ref: '+String(ref).replace(/[^a-z_]/g,'')+'</p>':'')
  +(k==='net'?'<button class="btn solid" type="button" id="miRetry">Try again</button>':''));
 const b=$('#miRetry');if(b)b.onclick=()=>{okAt=0;enter()}}
async function check(){
 if(!V.tg.initData&&!V.config.demoMode)return{k:'open'};
 let r;
 try{r=await Promise.race([V.services.api.gate_me(),new Promise((_,j)=>setTimeout(()=>j(new Error('timeout')),TIMEOUT))])}catch(e){return{k:'net'}}
 if(!r||(!r.status&&r.error===NETERR))return{k:'net'};
 if(r.status==='member')return{ok:1};
 if(r.status==='none')return REQUIRE_PROFILE?{k:'profile'}:{ok:1};
 if(r.status==='banned')return{k:'banned'};
 return{k:'denied',msg:r.error,ref:r.reason}}
async function enter(){
 if(gating)return;
 if(OK&&Date.now()-okAt<TTL){const g=$('#miGate'),a=$('#miApp');if(g)g.hidden=true;if(a)a.hidden=false;return}
 OK=false;gating=true;spinner();
 const r=await check();gating=false;
 if(r.ok){OK=true;okAt=Date.now();const g=$('#miGate'),a=$('#miApp');if(g){g.hidden=true;g.innerHTML=''}if(a)a.hidden=false;loadExifr();onOk()}
 else fail(r.k,r.msg,r.ref)}
function loadExifr(){
 if(window.exifr)return Promise.resolve();
 return XR||(XR=new Promise((ok,bad)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/exifr@7.1.3/dist/full.umd.js';s.onload=ok;s.onerror=()=>{XR=null;bad(new Error('exifr'))};document.head.appendChild(s)}))}

/* ---------- tool ---------- */
let cur=null;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pretty=k=>k.replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/_/g,' ');
function fv(v){if(v==null)return'';if(v instanceof Date)return isNaN(v)?'':v.toLocaleString(undefined,{dateStyle:'medium',timeStyle:'medium'});
 if(ArrayBuffer.isView(v)||v instanceof ArrayBuffer)return'[binary, '+v.byteLength+' bytes]';if(Array.isArray(v))return v.map(fv).join(', ');
 if(typeof v==='object')return JSON.stringify(v);if(typeof v==='number')return String(+v.toFixed(6));return String(v)}
const fmtB=n=>n<1024?n+' B':n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(2)+' MB';
const gcd=(a,b)=>b?gcd(b,a%b):a;
function toast(t){const e=$('#miToast');e.textContent=t;e.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('on'),1600)}
function sniff(u){const h=[...u.slice(0,12)].map(x=>x.toString(16).padStart(2,'0')).join(''),t=String.fromCharCode(...u.slice(4,12));
 if(h.startsWith('ffd8ff'))return'JPEG';if(h.startsWith('89504e47'))return'PNG';if(h.startsWith('47494638'))return'GIF';if(h.startsWith('424d'))return'BMP';
 if(h.startsWith('52494646')&&String.fromCharCode(...u.slice(8,12))==='WEBP')return'WebP';if(/^ftyp(heic|heix|mif1|msf1)/.test(t))return'HEIC / HEIF';if(/^ftypavi/.test(t))return'AVIF';
 if(h.startsWith('49492a00')||h.startsWith('4d4d002a'))return'TIFF';return'Unknown'}
async function sha(f){try{const d=await crypto.subtle.digest('SHA-256',await f.arrayBuffer());return[...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('')}catch(e){return''}}
const rows=o=>Object.entries(o||{}).map(([k,v])=>[pretty(k),fv(v)]).filter(r=>r[1]!=='');
const sec=(t,r,open)=>r.length?`<details class="mi-sec"${open?' open':''}><summary><span>${t}</span><em>${r.length}</em></summary>${r.map(x=>`<dl class="mi-r"><dt>${esc(x[0])}</dt><dd>${esc(x[1])}</dd></dl>`).join('')}</details>`:'';
let _ip=null;const startIP=()=>_ip||(_ip=(async()=>{const T=u=>Promise.race([fetch(u).then(r=>r.json()),new Promise((_,j)=>setTimeout(j,5000))]);
 try{const d=await T('https://ipapi.co/json/');if(d&&d.ip)return{'IP address':d.ip,City:d.city,Region:d.region,Country:d.country_name,'ISP / Network':d.org,Timezone:d.timezone}}catch(e){}
 try{const d=await T('https://api.ipify.org?format=json');if(d&&d.ip)return{'IP address':d.ip}}catch(e){}return null})());
const onOk=()=>startIP().then(n=>{if(n)$('#miIp').innerHTML='Your IP address <b>'+esc(n['IP address'])+'</b>'});

/* ===== Embedded text reader (JPEG comment / EXIF text / PNG tEXt, iTXt, zTXt) ===== */
async function inflate(u){try{const ds=new DecompressionStream('deflate'),w=ds.writable.getWriter();w.write(u);w.close();return new Uint8Array(await new Response(ds.readable).arrayBuffer())}catch(e){return null}}
async function readCustomText(f,meta){
 const o={},b=new Uint8Array(await f.arrayBuffer()),u8d=new TextDecoder('utf-8'),l1=new TextDecoder('latin1');
 const add=(k,v)=>{v=String(v==null?'':v).replace(/\0/g,'').trim();if(!v)return;let n=k,i=2;while(n in o)n=k+' '+(i++);o[n]=v};
 if(b[0]===0xFF&&b[1]===0xD8){
  let p=2;
  while(p+4<b.length&&b[p]===0xFF){const m=b[p+1];if(m===0xDA||m===0xD9)break;const l=(b[p+2]<<8)|b[p+3];
   if(m===0xFE)add('JPEG Comment',u8d.decode(b.subarray(p+4,p+2+l)));
   p+=2+l}
 }else if(b[0]===0x89&&b[1]===0x50){
  const dv=new DataView(b.buffer,b.byteOffset,b.byteLength);let p=8;
  while(p+12<=b.length){
   const len=dv.getUint32(p),t=String.fromCharCode(b[p+4],b[p+5],b[p+6],b[p+7]),d=b.subarray(p+8,p+8+len);
   if(t==='tEXt'){const z=d.indexOf(0);if(z>0)add('PNG '+l1.decode(d.subarray(0,z)),l1.decode(d.subarray(z+1)))}
   else if(t==='zTXt'){const z=d.indexOf(0);if(z>0){const x=await inflate(d.subarray(z+2));if(x)add('PNG '+l1.decode(d.subarray(0,z)),l1.decode(x))}}
   else if(t==='iTXt'){const z=d.indexOf(0);if(z>0){const cf=d[z+1];let q=z+3;while(q<d.length&&d[q]!==0)q++;q++;while(q<d.length&&d[q]!==0)q++;q++;
     const body=d.subarray(q);const raw=cf?await inflate(body):body;if(raw)add('PNG '+u8d.decode(d.subarray(0,z)),u8d.decode(raw))}}
   if(t==='IEND')break;p+=12+len}
 }
 const S=(k,v)=>{if(typeof v==='string')add(k,v)};
 S('EXIF Image Description',meta.ifd0&&meta.ifd0.ImageDescription);S('EXIF User Comment',meta.exif&&meta.exif.UserComment);
 S('Windows Comment',meta.ifd0&&meta.ifd0.XPComment);S('Windows Title',meta.ifd0&&meta.ifd0.XPTitle);
 S('Artist',meta.ifd0&&meta.ifd0.Artist);S('Copyright',meta.ifd0&&meta.ifd0.Copyright);
 return o}
/* ===== Veil Data (read-only): reads veils made by the Veil Creator; cannot edit or write them ===== */
const VMAGIC=[0x56,0x45,0x49,0x4C,0x31];
const VLOCK='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:6px"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
function veilExtract(buf){
 const b=new Uint8Array(buf);let pl=null;
 if(b[0]===0x89&&b[1]===0x50){const dv=new DataView(buf);let p=8;
  while(p+12<=b.length){const len=dv.getUint32(p),t=String.fromCharCode(b[p+4],b[p+5],b[p+6],b[p+7]);
   if(t==='veIl'){pl=b.slice(p+8,p+8+len);break}if(t==='IEND')break;p+=12+len}}
 else if(b[0]===0xFF&&b[1]===0xD8){let p=2;
  while(p+4<b.length&&b[p]===0xFF){const m=b[p+1];if(m===0xDA||m===0xD9)break;const len=(b[p+2]<<8)|b[p+3];
   if(m===0xEF&&VMAGIC.every((v,i)=>b[p+4+i]===v)){pl=b.slice(p+4,p+2+len);break}p+=2+len}}
 if(!pl||pl.length<10||!VMAGIC.every((v,i)=>pl[i]===v))return null;
 return pl[5]===0||(pl[5]===1&&pl.length>=54)?pl:null}
async function veilUnlock(pl,pass){
 const k0=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveKey']);
 const k=await crypto.subtle.deriveKey({name:'PBKDF2',salt:pl.slice(10,26),iterations:150000,hash:'SHA-256'},k0,{name:'AES-GCM',length:256},false,['decrypt']);
 return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:pl.slice(26,38)},k,pl.slice(38)))}
const veilDone=t=>`<details class="mi-sec" open id="miVeil"><summary><span>Veil Data</span><em>1</em></summary><dl class="mi-r"><dt>Message</dt><dd style="white-space:pre-wrap">${esc(t)}</dd></dl></details>`;
function veilHTML(pl){
 if(pl[5]===0){let t='';try{t=new TextDecoder().decode(pl.slice(10))}catch(e){}return veilDone(t)}
 return `<details class="mi-sec" open id="miVeil"><summary><span>Veil Data</span><em>LOCKED</em></summary><dl class="mi-r"><dt>Status</dt><dd>${VLOCK}Locked. Passphrase required.</dd></dl><div class="mi-veilbox"><input class="nsin" id="miVpw" type="password" placeholder="Passphrase" autocomplete="off"><button class="btn solid" id="miVub" type="button">Unlock</button><div class="mi-verr" id="miVerr"></div></div></details>`}
function veilWire(pl){
 if(pl[5]!==1)return;
 const go=async()=>{const pw=$('#miVpw').value,e=$('#miVerr'),b=$('#miVub');if(!pw){e.textContent='Enter the passphrase.';return}
  b.textContent='Unlocking…';e.textContent='';
  try{const t=await veilUnlock(pl,pw);hap('medium');$('#miVeil').outerHTML=veilDone(t)}
  catch(x){b.textContent='Unlock';e.textContent='Wrong passphrase.';hap('heavy')}};
 $('#miVub').onclick=go;$('#miVpw').onkeydown=e=>{if(e.key==='Enter')go()}}
async function run(f){
 if(!OK)return;
 if(f&&isVideo(f))return runVideo(f);
 if(!f||(!/^image\//.test(f.type)&&!/\.(heic|heif|avif|tiff?|jpe?g|png|webp|gif|bmp)$/i.test(f.name)))return toast('Please choose an image file');
 hap('medium');$('#miHome').hidden=true;const out=$('#miOut');out.hidden=false;out.innerHTML='<div class="mi-load">Analysing</div>';toTop();
 try{await loadExifr()}catch(e){toast('Could not load the metadata engine');out.hidden=true;$('#miHome').hidden=false;return}
 const url=URL.createObjectURL(f);
 const dim=await new Promise(r=>{const i=new Image();i.onload=()=>r([i.naturalWidth,i.naturalHeight]);i.onerror=()=>r([0,0]);i.src=url});
 const fmt=sniff(new Uint8Array(await f.slice(0,16).arrayBuffer())),hash=await sha(f),net=await startIP();
 const O={mergeOutput:false,tiff:true,exif:true,gps:true,interop:true,ifd1:true,xmp:true,icc:true,iptc:true,jfif:true,ihdr:true,makerNote:true,userComment:true,multiSegment:true};
 const meta=await exifr.parse(f,O).catch(()=>null)||{},gps=await exifr.gps(f).catch(()=>null),custom=await readCustomText(f,meta).catch(()=>({})),hasTxt=Object.keys(custom).length>0;
 const m=Object.assign({},meta.xmp,meta.ifd0,meta.exif,meta.gps),[w,h]=dim,g=gcd(w,h)||1;
 const file={Name:f.name,Size:fmtB(f.size)+' ('+f.size.toLocaleString()+' bytes)','Declared type':f.type||'n/a','Detected format':fmt,'Last modified':new Date(f.lastModified),'SHA-256':hash};
 const image={Dimensions:w?w+' × '+h+' px':'',Megapixels:w?(w*h/1e6).toFixed(2)+' MP':'','Aspect ratio':w?(w/g)+':'+(h/g):'',Orientation:m.Orientation||'','Colour space':m.ColorSpace||''};
 const mk=[m.Make,m.Model].filter(Boolean);if(mk[1]&&mk[1].startsWith(mk[0]))mk.shift();
 const ex=[m.FNumber&&'ƒ/'+(+m.FNumber).toFixed(1).replace('.0',''),m.ExposureTime&&(m.ExposureTime<1?'1/'+Math.round(1/m.ExposureTime):m.ExposureTime)+' s',m.ISO&&'ISO '+m.ISO,m.FocalLength&&Math.round(m.FocalLength)+' mm'].filter(Boolean);
 const hl=[['Camera',mk.join(' ')],['Lens',m.LensModel||m.Lens],['Taken',fv(m.DateTimeOriginal||m.CreateDate)],['Exposure',ex.join(' · ')],['Embedded text',Object.values(custom)[0]],['Software',m.Software||m.CreatorTool],['Your IP',net&&net['IP address']],['Location',gps?gps.latitude.toFixed(5)+', '+gps.longitude.toFixed(5):'']].filter(x=>x[1]);
 const names={ifd0:'Camera & Image',exif:'Exposure & Capture',gps:'Location (GPS)',interop:'Interoperability',ifd1:'Thumbnail',xmp:'XMP',icc:'Colour Profile',iptc:'IPTC',jfif:'JFIF',ihdr:'PNG Header'};
 const got=Object.keys(names).filter(k=>meta[k]&&rows(meta[k]).length);
 cur={file:{...file,'Last modified':file['Last modified'].toISOString()},image,...meta,...(hasTxt?{embeddedText:custom}:{}),...(gps?{gpsDecimal:gps}:{}),...(net?{connection:net}:{})};
 out.innerHTML=`<div class="mi-frame"><img src="${url}" alt=""><div class="mi-chips"><span>${esc(fmt)}</span>${w?`<span>${w} × ${h}</span>`:''}<span>${fmtB(f.size)}</span></div></div>
 <div class="mi-acts"><button class="btn solid" id="miBc">Copy JSON</button><button class="btn" id="miBd">Download JSON</button><button class="btn" id="miBs">Remove metadata</button><button class="btn" id="miBn">New image</button></div>
 ${hl.length?`<div class="mi-hl">${hl.map(x=>`<div class="${x[0]=='Location'||x[0]=='Exposure'||x[0]=='Embedded text'?'w':''}"><small>${x[0]}</small><b>${esc(x[1])}</b></div>`).join('')}</div>`:''}
 ${gps?`<div class="mi-acts one"><button class="btn solid" id="miBm">Open in Maps</button></div>`:''}
 ${got.length||hasTxt?'':'<div class="mi-note">No embedded EXIF metadata was found. Screenshots, edited images and photos sent as compressed photos through Telegram or WhatsApp have it removed. Send the original as a <b>file</b> to keep it.</div>'}
 <input class="nsin mi-q" id="miQ" placeholder="Search all metadata" autocomplete="off">
 <div id="miSecs">${sec('File',rows(file),1)}${sec('Image',rows(image),1)}${sec('Embedded Text',rows(custom),1)}${sec('Your Connection',rows(net),1)}${got.map((k,i)=>sec(names[k],rows(meta[k]),i<2)).join('')}</div>`;
 try{const vp=veilExtract(await f.arrayBuffer());if(vp){$('#miSecs').insertAdjacentHTML('afterbegin',veilHTML(vp));veilWire(vp)}}catch(e){}
 const J=()=>JSON.stringify(cur,(k,v)=>ArrayBuffer.isView(v)?'[binary '+v.byteLength+' bytes]':v,2);
 $('#miBc').onclick=()=>{navigator.clipboard.writeText(J()).then(()=>toast('JSON copied'),()=>toast('Copy failed'));hap()};
 $('#miBd').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([J()],{type:'application/json'}));a.download=f.name.replace(/\.[^.]+$/,'')+'-metadata.json';a.click();hap()};
 $('#miBs').onclick=async e=>{const b=e.currentTarget,L=b.textContent;hap();b.textContent='Working…';try{const c=await cleanImage(f);deliver(c,cleanName(f,c),b,L)}catch(x){b.textContent=L;toast('Could not clean this file')}};
 $('#miBn').onclick=()=>{out.hidden=true;$('#miHome').hidden=false;$('#miFile').value='';hap()};
 if(gps)$('#miBm').onclick=()=>{const u='https://www.google.com/maps?q='+gps.latitude+','+gps.longitude;V.tg.open(u)};
 $('#miQ').oninput=e=>{const s=e.target.value.toLowerCase();document.querySelectorAll('#miSecs details').forEach(d=>{let n=0;d.querySelectorAll('.mi-r').forEach(r=>{const ok=r.textContent.toLowerCase().includes(s);r.hidden=!ok;n+=ok});d.hidden=!n;if(s)d.open=true})};
 $('#miSecs').onclick=e=>{const r=e.target.closest('.mi-r');if(r){navigator.clipboard.writeText(r.querySelector('dd').textContent).then(()=>toast('Copied'));hap()}};
}
/* ===== Metadata removal (photo + video) ===== */
const isVideo=f=>/^video\//.test(f.type)||/\.(mp4|mov|m4v|webm|mkv|3gp)$/i.test(f.name);
const u8=async b=>new Uint8Array(await b.arrayBuffer());
const rd=(u,o)=>((u[o]<<24)|(u[o+1]<<16)|(u[o+2]<<8)|u[o+3])>>>0;
const tp=(u,o)=>String.fromCharCode(u[o],u[o+1],u[o+2],u[o+3]);
const sendOut=(b,name)=>{const f=new File([b],name,{type:b.type});
 if(navigator.canShare&&navigator.canShare({files:[f]}))navigator.share({files:[f]}).catch(()=>{});
 else{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();a.remove()}};
const canShare=(b,name)=>{try{return !!(navigator.canShare&&navigator.canShare({files:[new File([b],name,{type:b.type})]}))}catch(e){return false}};
function deliver(b,name,btn,label){
 if(btn&&canShare(b,name)){btn.textContent='Save clean file';btn.onclick=()=>{sendOut(b,name);hap()};toast('Metadata removed. Tap Save')}
 else{sendOut(b,name);toast('Clean copy saved');if(btn)btn.textContent=label}}
function cleanName(f,b){const base=f.name.replace(/\.[^.]+$/,''),m=f.name.match(/\.([^.]+)$/);
 const ext=isVideo(f)?(m?m[1]:'mp4'):({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[b.type]||'png');return base+'-clean.'+ext}

/* photos */
function stripJPEG(u){
 const out=[u.subarray(0,2)];let i=2;
 while(i<u.length-1){
  if(u[i]!==0xFF){i++;continue}
  let m=u[i+1];while(m===0xFF&&i<u.length-2){i++;m=u[i+1]}
  if(m===0xD9){out.push(u.subarray(i,i+2));break}
  if(m===0x01||(m>=0xD0&&m<=0xD7)){out.push(u.subarray(i,i+2));i+=2;continue}
  const L=(u[i+2]<<8)|u[i+3],end=i+2+L;let keep=true;
  if(m>=0xE1&&m<=0xEF)keep=(m===0xE2&&tp(u,i+4)==='ICC_')||m===0xEE;else if(m===0xFE)keep=false;
  if(keep)out.push(u.subarray(i,end));
  i=end;
  if(m===0xDA){let j=i;while(j<u.length-1){const n=u[j+1];if(u[j]===0xFF&&n!==0&&n!==0xFF&&!(n>=0xD0&&n<=0xD7))break;j++}out.push(u.subarray(i,j));i=j}
 }
 return new Blob(out,{type:'image/jpeg'})}
function stripPNG(u){
 const keep=['IHDR','PLTE','IDAT','IEND','tRNS','gAMA','cHRM','sRGB','iCCP','sBIT','cICP','bKGD','acTL','fcTL','fdAT'];
 const parts=[u.subarray(0,8)];let i=8;
 while(i+12<=u.length){const L=rd(u,i),t=tp(u,i+4),end=i+12+L;if(keep.includes(t))parts.push(u.subarray(i,end));i=end;if(t==='IEND')break}
 return new Blob(parts,{type:'image/png'})}
function stripWebP(u){
 const parts=[];let i=12,total=4;
 while(i+8<=u.length){const id=tp(u,i),sz=((u[i+4])|(u[i+5]<<8)|(u[i+6]<<16)|(u[i+7]<<24))>>>0,tot=8+sz+(sz&1),e=Math.min(i+tot,u.length);
  if(id!=='EXIF'&&id!=='XMP '){let c=u.slice(i,e);if(id==='VP8X')c[8]&=~0x0C;parts.push(c);total+=c.length}i+=tot}
 const h=new Uint8Array(12);h.set([82,73,70,70]);new DataView(h.buffer).setUint32(4,total,true);h.set([87,69,66,80],8);
 return new Blob([h,...parts],{type:'image/webp'})}
async function reencode(f,type){
 const c=document.createElement('canvas'),bm=await createImageBitmap(f,{imageOrientation:'from-image'}).catch(()=>null);
 if(bm){c.width=bm.width;c.height=bm.height;c.getContext('2d').drawImage(bm,0,0)}
 else{const i=new Image(),url=URL.createObjectURL(f);await new Promise((r,j)=>{i.onload=r;i.onerror=j;i.src=url});c.width=i.naturalWidth;c.height=i.naturalHeight;c.getContext('2d').drawImage(i,0,0)}
 return new Promise((r,j)=>c.toBlob(b=>b?r(b):j(new Error('encode')),type,.95))}
async function cleanImage(f){
 const u=await u8(f),t=sniff(u);
 if(t==='JPEG'){let o=1;try{o=await exifr.orientation(f)||1}catch(e){}return o>1?reencode(f,'image/jpeg'):stripJPEG(u)}
 if(t==='PNG')return stripPNG(u);
 if(t==='WebP')return stripWebP(u);
 return reencode(f,'image/png')}

/* videos: MP4 / MOV */
const META_TOP=['uuid','meta','udta','XMP_','xml '];
const kids=(u,s,e)=>{const r=[];let o=s;while(o+8<=e){let sz=rd(u,o),hd=8;if(sz===1){sz=rd(u,o+8)*4294967296+rd(u,o+12);hd=16}else if(sz===0)sz=e-o;if(sz<hd||o+sz>e)break;r.push({o,sz,hd,t:tp(u,o+4)});o+=sz}return r};
async function boxes(f,s,e){const r=[];let o=s;
 while(o+8<=e){const h=new Uint8Array(await f.slice(o,o+16).arrayBuffer());let sz=rd(h,0),hd=8;
  if(sz===1){sz=rd(h,8)*4294967296+rd(h,12);hd=16}else if(sz===0)sz=e-o;
  if(sz<hd||o+sz>e)break;r.push({o,sz,hd,t:tp(h,4)});o+=sz}
 return r}
function procMoov(u,hd,apply){
 const R={info:[],created:null,loc:'',keys:[]};
 const fr=(k,l)=>{R.info.push(l);if(apply){u.fill(0,k.o+k.hd,k.o+k.sz);u[k.o+4]=102;u[k.o+5]=114;u[k.o+6]=101;u[k.o+7]=101}};
 const zt=k=>{if(apply){const n=u[k.o+k.hd]===1?16:8;u.fill(0,k.o+k.hd+4,k.o+k.hd+4+n)}};
 for(const k of kids(u,hd,u.length)){
  if(k.t==='mvhd'){const c=rd(u,k.o+k.hd+(u[k.o+k.hd]===1?8:4));if(c)R.created=new Date((c-2082844800)*1000);zt(k)}
  else if(k.t==='udta'||k.t==='meta'||k.t==='uuid')fr(k,'Movie '+k.t+' block');
  else if(k.t==='trak'){let hl='';
   for(const t of kids(u,k.o+k.hd,k.o+k.sz)){
    if(t.t==='tkhd')zt(t);
    else if(t.t==='udta'||t.t==='meta')fr(t,'Track '+t.t+' block');
    else if(t.t==='mdia')for(const m of kids(u,t.o+t.hd,t.o+t.sz)){if(m.t==='mdhd')zt(m);else if(m.t==='hdlr')hl=tp(u,m.o+m.hd+8);else if(m.t==='udta'||m.t==='meta')fr(m,'Track '+m.t+' block')}}
   if(['meta','mebx','camm'].includes(hl))fr(k,'Timed metadata track ('+hl+')')}
 }
 if(!apply){const s=new TextDecoder('latin1').decode(u),m=s.match(/[+-]\d{1,3}\.\d{2,}[+-]\d{1,3}\.\d{2,}/);if(m)R.loc=m[0];R.keys=[...new Set(s.match(/com\.apple\.quicktime\.[A-Za-z0-9.\-]+/g)||[])]}
 return R}
async function scanMP4(f){
 const tb=await boxes(f,0,f.size),R={info:[],created:null,loc:'',keys:[]};
 for(const b of tb){
  if(b.t==='moov'){const r=procMoov(await u8(f.slice(b.o,b.o+b.sz)),b.hd,false);R.info.push(...r.info);R.created=r.created;R.loc=r.loc;R.keys=r.keys}
  else if(META_TOP.includes(b.t))R.info.push('Top-level '+b.t.trim()+' block ('+fmtB(b.sz)+')')}
 const l=tb[tb.length-1];if(l&&l.o+l.sz<f.size)R.info.push('Trailing vendor data ('+fmtB(f.size-l.o-l.sz)+')');
 return R}
async function cleanMP4(f){
 const tb=await boxes(f,0,f.size),parts=[];if(!tb.length)throw new Error('bad');
 for(const b of tb){
  if(b.t==='moov'){const u=await u8(f.slice(b.o,b.o+b.sz));procMoov(u,b.hd,true);parts.push(u)}
  else if(META_TOP.includes(b.t)&&b.sz<4294967296){const z=new Uint8Array(b.sz);new DataView(z.buffer).setUint32(0,b.sz);z.set([102,114,101,101],4);parts.push(z)}
  else parts.push(f.slice(b.o,b.o+b.sz))}
 return new Blob(parts,{type:f.type||'video/mp4'})}

/* videos: WebM / Matroska */
function ebId(u,o){let l=1,b=u[o];while(l<4&&!(b&(0x80>>(l-1))))l++;let v=0;for(let i=0;i<l;i++)v=v*256+u[o+i];return[v,l]}
function ebSz(u,o){let l=1,b=u[o];while(l<8&&!(b&(0x80>>(l-1))))l++;let v=b&(0xFF>>l),un=v===(0xFF>>l);for(let i=1;i<l;i++){v=v*256+u[o+i];if(u[o+i]!==255)un=false}return[un?-1:v,l]}
function voidEl(u,o,tot){if(tot<2)return;const L=tot-2<=126?1:8,p=tot-1-L;u.fill(0,o,o+tot);u[o]=0xEC;
 if(L===1)u[o+1]=0x80|p;else{u[o+1]=1;let v=p;for(let i=7;i>=1;i--){u[o+1+i]=v%256;v=Math.floor(v/256)}}}
function webmProc(u,apply){
 const R={info:[],created:null};let o=0;
 let [id,il]=ebId(u,o),[sz,sl]=ebSz(u,o+il);o+=il+sl+sz;
 [id,il]=ebId(u,o);[sz,sl]=ebSz(u,o+il);if(id!==0x18538067)return R;
 let p=o+il+sl;const e=sz<0?u.length:Math.min(u.length,p+sz);
 while(p+2<e){
  const[i2,l2]=ebId(u,p),[z2,s2]=ebSz(u,p+l2);if(z2<0)break;const tot=l2+s2+z2;
  if(i2===0x1254C367){R.info.push('Tags block ('+fmtB(tot)+')');if(apply)voidEl(u,p,tot)}
  else if(i2===0x1549A966){let q=p+l2+s2;const qe=q+z2;
   while(q+2<qe){const[i3,l3]=ebId(u,q),[z3,s3]=ebSz(u,q+l3),d=q+l3+s3;
    if(i3===0x7BA9||i3===0x4D80||i3===0x5741){const s=new TextDecoder().decode(u.subarray(d,d+z3)).replace(/\0/g,'').trim();if(s)R.info.push((i3===0x7BA9?'Title: ':i3===0x4D80?'Muxing app: ':'Writing app: ')+s);if(apply)u.fill(0,d,d+z3)}
    else if(i3===0x4461&&z3===8){const ns=new DataView(u.buffer,u.byteOffset+d,8).getBigInt64(0);R.created=new Date(978307200000+Number(ns/1000000n));if(apply)u.fill(0,d,d+8)}
    q+=l3+s3+z3}}
  p+=tot}
 return R}
async function cleanVideo(f){
 const h=new Uint8Array(await f.slice(0,12).arrayBuffer());
 if(tp(h,4)==='ftyp')return cleanMP4(f);
 if(h[0]===0x1A&&h[1]===0x45&&h[2]===0xDF&&h[3]===0xA3){if(f.size>5e8)throw new Error('big');const u=await u8(f);webmProc(u,true);return new Blob([u],{type:f.type||'video/webm'})}
 throw new Error('unsupported')}

async function runVideo(f){
 hap('medium');$('#miHome').hidden=true;const out=$('#miOut');out.hidden=false;out.innerHTML='<div class="mi-load">Analysing</div>';toTop();
 const url=URL.createObjectURL(f),hd=new Uint8Array(await f.slice(0,16).arrayBuffer());
 let kind='Unknown',R={info:[],created:null,loc:'',keys:[]};
 try{if(tp(hd,4)==='ftyp'){kind=/^qt/.test(tp(hd,8))?'QuickTime MOV':'MP4 / ISO BMFF';R=await scanMP4(f)}
  else if(hd[0]===0x1A&&hd[1]===0x45){kind='WebM / Matroska';if(f.size<5e8)R=Object.assign(R,webmProc(await u8(f),false))}}catch(e){}
 const vm=await new Promise(r=>{const v=document.createElement('video');v.preload='metadata';v.onloadedmetadata=()=>r([v.videoWidth,v.videoHeight,v.duration]);v.onerror=()=>r([0,0,0]);setTimeout(()=>r([0,0,0]),4000);v.src=url});
 const hash=f.size<1.5e8?await sha(f):'',dur=vm[2]&&isFinite(vm[2])?Math.floor(vm[2]/60)+':'+String(Math.round(vm[2]%60)).padStart(2,'0'):'';
 const file={Name:f.name,Size:fmtB(f.size)+' ('+f.size.toLocaleString()+' bytes)','Declared type':f.type||'n/a','Detected container':kind,'Last modified':new Date(f.lastModified),'SHA-256':hash};
 const loc=R.loc?(R.loc.match(/^([+-]\d+\.\d+)([+-]\d+\.\d+)/)||[]).slice(1,3).map(Number).join(', '):'';
 const emb={'Dimensions':vm[0]?vm[0]+' × '+vm[1]+' px':'',Duration:dur,'Created (embedded)':R.created&&R.created.getFullYear()>1990?R.created:'','Location (GPS)':loc,'Apple tags':R.keys.map(k=>k.replace('com.apple.quicktime.','')).join(', ')};
 const found=R.info.length||loc||emb['Created (embedded)'];
 out.innerHTML=`<div class="mi-frame"><video src="${url}" controls playsinline muted></video><div class="mi-chips"><span>${esc(kind)}</span>${vm[0]?`<span>${vm[0]} × ${vm[1]}</span>`:''}<span>${fmtB(f.size)}</span></div></div>
 <div class="mi-acts"><button class="btn solid" id="miBs">Remove metadata</button><button class="btn" id="miBn">New file</button></div>
 <div class="mi-note">${found?'This video carries embedded metadata'+(R.info.length?': <b>'+R.info.map(esc).join('</b>, <b>')+'</b>':'')+'. Tap <b>Remove metadata</b> to save a clean copy; video and audio are not re-encoded.':'No removable metadata blocks were detected. You can still save a clean copy.'}</div>
 <div id="miSecs">${sec('File',rows(file),1)}${sec('Embedded metadata',rows(emb),1)}</div>`;
 $('#miBs').onclick=async e=>{const b=e.currentTarget,L=b.textContent;hap();b.textContent='Working…';
  try{const c=await cleanVideo(f);deliver(c,cleanName(f,c),b,L)}catch(x){b.textContent=L;toast(x.message==='big'?'File too large for this format':'This video format is not supported yet')}};
 $('#miBn').onclick=()=>{out.hidden=true;$('#miHome').hidden=false;$('#miFile').value='';hap()};
}
$('#miFile2').onchange=async e=>{
 const fs=[...e.target.files];if(!fs.length||!OK)return;
 $('#miHome').hidden=true;const out=$('#miOut');out.hidden=false;out.innerHTML='<div class="mi-load">Removing metadata</div>';toTop();
 const res=[];
 for(const f of fs){try{const b=isVideo(f)?await cleanVideo(f):await cleanImage(f);res.push({f,b,name:cleanName(f,b)})}catch(x){res.push({f,err:1})}}
 out.innerHTML=`<div style="margin-top:18px">${res.map((r,i)=>`<div class="mi-note mi-item"><div style="min-width:0"><b style="word-break:break-all">${esc(r.f.name)}</b><br><small>${r.err?'Could not clean this file':fmtB(r.f.size)+' → '+fmtB(r.b.size)+' · metadata removed'}</small></div>${r.err?'':`<button class="btn solid" data-i="${i}" style="flex:none;min-width:0;padding:10px 18px">Save</button>`}</div>`).join('')}</div>
 <div class="mi-acts"><button class="btn" id="miBn">Done</button></div>`;
 out.querySelectorAll('button[data-i]').forEach(b=>b.onclick=()=>{const r=res[+b.dataset.i];sendOut(r.b,r.name);hap()});
 $('#miBn').onclick=()=>{out.hidden=true;$('#miHome').hidden=false;$('#miFile2').value='';hap()};
};


/* ---------- wiring ---------- */
const inMeta=()=>document.body.dataset.view==='meta';
$('#miFile').onchange=e=>run(e.target.files[0]);
const dz=$('#miDrop');
['dragover','dragenter'].forEach(t=>addEventListener(t,e=>{if(!inMeta())return;e.preventDefault();dz.classList.add('on')}));
['dragleave','drop'].forEach(t=>addEventListener(t,e=>{if(!inMeta())return;e.preventDefault();dz.classList.remove('on')}));
addEventListener('drop',e=>{if(inMeta())run(e.dataTransfer.files[0])});
addEventListener('paste',e=>{if(!inMeta())return;const f=[...(e.clipboardData&&e.clipboardData.files||[])][0];if(f)run(f)});

if(V.tools)V.tools.hooks.meta={enter,leave(){}};
})(window.ILLUMINATI);
}catch(e){console.error(e)}
