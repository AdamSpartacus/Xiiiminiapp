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
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
 return pl[5]===0||((pl[5]===1||pl[5]===2)&&pl.length>=54)?pl:null}
async function veilUnlock(pl,pass){
 const k0=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveKey']);
 const k=await crypto.subtle.deriveKey({name:'PBKDF2',salt:pl.slice(10,26),iterations:pl[5]===2?600000:150000,hash:'SHA-256'},k0,{name:'AES-GCM',length:256},false,['decrypt']);
 return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:pl.slice(26,38)},k,pl.slice(38)))}
const veilDone=t=>`<details class="mi-sec" open id="miVeil"><summary><span>Veil Data</span><em>1</em></summary><dl class="mi-r"><dt>Message</dt><dd style="white-space:pre-wrap">${esc(t)}</dd></dl></details>`;
function veilHTML(pl){
 if(pl[5]===0){let t='';try{t=new TextDecoder().decode(pl.slice(10))}catch(e){}return veilDone(t)}
 return `<details class="mi-sec" open id="miVeil"><summary><span>Veil Data</span><em>LOCKED</em></summary><dl class="mi-r"><dt>Status</dt><dd>${VLOCK}Locked. Passphrase required.</dd></dl><div class="mi-veilbox"><input class="nsin" id="miVpw" type="password" placeholder="Passphrase" autocomplete="off"><button class="btn solid" id="miVub" type="button">Unlock</button><div class="mi-verr" id="miVerr"></div></div></details>`}
function veilWire(pl){
 if(pl[5]!==1&&pl[5]!==2)return;
 const go=async()=>{const pw=$('#miVpw').value,e=$('#miVerr'),b=$('#miVub');if(!pw){e.textContent='Enter the passphrase.';return}
  b.textContent='Unlocking…';e.textContent='';
  try{const t=await veilUnlock(pl,pw);hap('medium');$('#miVeil').outerHTML=veilDone(t)}
  catch(x){b.textContent='Unlock';e.textContent='Wrong passphrase.';hap('heavy')}};
 $('#miVub').onclick=go;$('#miVpw').onkeydown=e=>{if(e.key==='Enter')go()}}
async function run(f){
 if(!OK)return;
 if(f&&(isVideo(f)||isAudio(f)))return runVideo(f,!isVideo(f));
 if(!f||(!/^image\//.test(f.type)&&!/\.(heic|heif|avif|tiff?|jpe?g|png|webp|gif|bmp)$/i.test(f.name)))return toast('Please choose an image, audio or video file');
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
 const hl=[['Camera',mk.join(' ')],['Lens',m.LensModel||m.Lens],['Taken',fv(m.DateTimeOriginal||m.CreateDate)],['Modified',fv(m.ModifyDate||m.DateTime)],['Exposure',ex.join(' · ')],['Embedded text',Object.values(custom)[0]],['Software',m.Software||m.CreatorTool],['Your IP',net&&net['IP address']],['Location',gps?gps.latitude.toFixed(5)+', '+gps.longitude.toFixed(5):'']].filter(x=>x[1]);
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
 const ext=isVideo(f)||isAudio(f)?(m?m[1]:'mp4'):({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[b.type]||'png');return base+'-clean.'+ext}

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
const mac=d=>d?Math.max(0,Math.round(d.getTime()/1000)+2082844800):0;
function macT(u,s,v1,T){const c=mac(T.c),m=mac(T.m),dv=new DataView(u.buffer,u.byteOffset,u.byteLength);
 if(v1){dv.setUint32(s,Math.floor(c/4294967296));dv.setUint32(s+4,c>>>0);dv.setUint32(s+8,Math.floor(m/4294967296));dv.setUint32(s+12,m>>>0)}
 else{dv.setUint32(s,Math.min(c,4294967295));dv.setUint32(s+4,Math.min(m,4294967295))}}
function procMoov(u,hd,apply,T){
 const R={info:[],created:null,modified:null,loc:'',keys:[]};
 const fr=(k,l)=>{R.info.push(l);if(apply){u.fill(0,k.o+k.hd,k.o+k.sz);u[k.o+4]=102;u[k.o+5]=114;u[k.o+6]=101;u[k.o+7]=101}};
 const zt=k=>{if(apply){const v1=u[k.o+k.hd]===1,n=v1?16:8,s0=k.o+k.hd+4;u.fill(0,s0,s0+n);if(T)macT(u,s0,v1,T)}};
 for(const k of kids(u,hd,u.length)){
  if(k.t==='mvhd'){const v1=u[k.o+k.hd]===1,c=rd(u,k.o+k.hd+(v1?8:4)),m=rd(u,k.o+k.hd+(v1?16:8));if(c)R.created=new Date((c-2082844800)*1000);if(m)R.modified=new Date((m-2082844800)*1000);zt(k)}
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
async function scanMP4(f,vt){
 const tb=await boxes(f,0,f.size),R={info:[],created:null,modified:null,loc:'',keys:[]};
 for(const b of tb){
  if(b.t==='moov'){const r=procMoov(await u8(f.slice(b.o,b.o+b.sz)),b.hd,false);R.info.push(...r.info);R.created=r.created;R.modified=r.modified;R.loc=r.loc;R.keys=r.keys}
  else if(META_TOP.includes(b.t)&&!(vt&&b.t==='uuid'&&b.o+b.sz===f.size))R.info.push('Top-level '+b.t.trim()+' block ('+fmtB(b.sz)+')')}
 const l=tb[tb.length-1];if(l&&l.o+l.sz<f.size)R.info.push('Trailing vendor data ('+fmtB(f.size-l.o-l.sz)+')');
 return R}
async function mp4Parts(f,T){
 const tb=await boxes(f,0,f.size),parts=[],info=[];if(!tb.length)throw new Error('bad');
 for(const b of tb){
  if(b.t==='moov'){const u=await u8(f.slice(b.o,b.o+b.sz));info.push(...procMoov(u,b.hd,true,T).info);parts.push(u)}
  else if(META_TOP.includes(b.t)&&b.sz<4294967296){info.push('Top-level '+b.t.trim()+' block');const z=new Uint8Array(b.sz);new DataView(z.buffer).setUint32(0,b.sz);z.set([102,114,101,101],4);parts.push(z)}
  else parts.push(f.slice(b.o,b.o+b.sz))}
 const l=tb[tb.length-1];if(l&&l.o+l.sz<f.size)info.push('Trailing vendor data');
 return{kind:'mp4',parts,cl:1,info}}

/* videos: WebM / Matroska */
function ebId(u,o){let l=1,b=u[o];while(l<4&&!(b&(0x80>>(l-1))))l++;let v=0;for(let i=0;i<l;i++)v=v*256+u[o+i];return[v,l]}
function ebSz(u,o){let l=1,b=u[o];while(l<8&&!(b&(0x80>>(l-1))))l++;let v=b&(0xFF>>l),un=v===(0xFF>>l);for(let i=1;i<l;i++){v=v*256+u[o+i];if(u[o+i]!==255)un=false}return[un?-1:v,l]}
function voidEl(u,o,tot){if(tot<2)return;const L=tot-2<=126?1:8,p=tot-1-L;u.fill(0,o,o+tot);u[o]=0xEC;
 if(L===1)u[o+1]=0x80|p;else{u[o+1]=1;let v=p;for(let i=7;i>=1;i--){u[o+1+i]=v%256;v=Math.floor(v/256)}}}
function webmProc(u,apply,T){
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
    else if(i3===0x4461&&z3===8){const ns=new DataView(u.buffer,u.byteOffset+d,8).getBigInt64(0);R.created=new Date(978307200000+Number(ns/1000000n));if(apply){u.fill(0,d,d+8);if(T&&T.c)new DataView(u.buffer,u.byteOffset+d,8).setBigInt64(0,BigInt(T.c.getTime()-978307200000)*1000000n)}}
    q+=l3+s3+z3}}
  p+=tot}
 return R}

/* ===== Shared media helpers (also used by the founder Veil Creator through V.mi) ===== */
const isAudio=f=>/^audio\//.test(f.type)||/\.(mp3|m4a|wav|flac|ogg|oga|opus|aac|weba)$/i.test(f.name);
const encT=new TextEncoder(),asc=s=>encT.encode(s);
const isEBML=h=>h[0]===0x1A&&h[1]===0x45&&h[2]===0xDF&&h[3]===0xA3;
/* audio: strip tags, keep the audio bytes untouched */
async function mp3Parts(f){let s0=0,e=f.size;const info=[];
 for(;;){const h=await u8(f.slice(s0,s0+10));if(h.length>=10&&h[0]===0x49&&h[1]===0x44&&h[2]===0x33&&h[3]<0xFF){const z=((h[6]&127)<<21)|((h[7]&127)<<14)|((h[8]&127)<<7)|(h[9]&127),n=10+z+((h[5]&16)?10:0);info.push('ID3v2 tag ('+fmtB(n)+')');s0+=n}else break}
 for(let g=0;g<4&&e-s0>=32;g++){
  if(e-s0>=128){const t=await u8(f.slice(e-128,e));if(tp(t,0).slice(0,3)==='TAG'){e-=128;info.push('ID3v1 tag');if(e-s0>=227){const x=await u8(f.slice(e-227,e-223));if(tp(x,0)==='TAG+')e-=227}continue}}
  const a=await u8(f.slice(e-32,e));if(tp(a,0)+tp(a,4)==='APETAGEX'){const sz=(a[12]|(a[13]<<8)|(a[14]<<16)|(a[15]<<24))>>>0,t=sz+((a[23]&0x80)?32:0);if(t<=e-s0){e-=t;info.push('APE tag ('+fmtB(t)+')');continue}}
  break}
 return{kind:'raw',parts:[f.slice(s0,e)],cl:1,info}}
async function wavParts(f){const KEEP=['fmt ','data','fact'],parts=[null],info=[];let o=12,tot=4;
 while(o+8<=f.size){const h=await u8(f.slice(o,o+8)),id=tp(h,0),sz=(h[4]|(h[5]<<8)|(h[6]<<16)|(h[7]<<24))>>>0,t=8+sz+(sz&1),e=Math.min(o+t,f.size);
  if(KEEP.includes(id)){parts.push(f.slice(o,e));tot+=e-o}else if(id!=='veIl')info.push(id.trim()+' chunk ('+fmtB(e-o)+')');o+=t}
 if(tot&1){parts.push(new Uint8Array(1));tot++}
 const hd=new Uint8Array(12);hd.set(asc('RIFF'));new DataView(hd.buffer).setUint32(4,tot,true);hd.set(asc('WAVE'),8);parts[0]=hd;
 return{kind:'wav',parts,cl:1,info,riff:tot}}
async function flacParts(f){let o=4,last=false;const keep=[],info=[],NM={1:'Padding',2:'Application',4:'Vorbis comment',5:'Cue sheet',6:'Picture'};
 while(!last&&o+4<=f.size){const h=await u8(f.slice(o,o+4));last=!!(h[0]&128);const ty=h[0]&127,L=(h[1]<<16)|(h[2]<<8)|h[3];
  if(ty===0||ty===3)keep.push({h,b:f.slice(o+4,o+4+L)});else info.push((NM[ty]||'Block '+ty)+' ('+fmtB(L)+')');o+=4+L}
 if(!last||!keep.length)throw new Error('bad');
 const parts=[new Uint8Array([0x66,0x4C,0x61,0x43])];keep.forEach((k,i)=>{k.h[0]=(k.h[0]&127)|(i===keep.length-1?128:0);parts.push(k.h,k.b)});parts.push(f.slice(o));
 return{kind:'raw',parts,cl:1,info}}
/* the veil tail: [wrapper][body][bodyLen u32][totalLen u32]"VEILEND1" appended after the media. Wrapper = a uuid box (MP4), a Void element (WebM), a "veIl" chunk (WAV) or nothing. Players skip all of them. */
const VEND=[0x56,0x45,0x49,0x4C,0x45,0x4E,0x44,0x31],VUUID=[0x56,0x45,0x49,0x4C,0xA7,0x31,0x4D,0x1E,0x9B,0x02,0x5C,0xD4,0x7E,0x01,0xC3,0x58];
async function tailInfo(f){if(f.size<16)return null;const t=await u8(f.slice(f.size-16,f.size));
 if(!VEND.every((v,i)=>t[8+i]===v))return null;const bl=rd(t,0),tl=rd(t,4);if(bl+16>tl||tl>f.size)return null;return{bl,tl}}
function bodyBuild(pl,text,tk,md){ /* records: type(1) len(4) data. 1 veil payload, 2 embedded text, 3 taken, 4 modified */
 const R=[[1,pl]];if(text)R.push([2,asc(text)]);if(tk)R.push([3,asc(tk)]);if(md)R.push([4,asc(md)]);
 const o=new Uint8Array(R.reduce((n,r)=>n+5+r[1].length,0)),dv=new DataView(o.buffer);let p=0;
 R.forEach(r=>{o[p]=r[0];dv.setUint32(p+1,r[1].length);o.set(r[1],p+5);p+=5+r[1].length});return o}
function tailBuild(kind,body){
 const pad=kind==='wav'?body.length&1:0,inner=pad+body.length+16;let head=new Uint8Array(0);
 if(kind==='mp4'){head=new Uint8Array(24);new DataView(head.buffer).setUint32(0,24+inner);head.set(asc('uuid'),4);head.set(VUUID,8)}
 else if(kind==='webm'){head=new Uint8Array(9);head[0]=0xEC;head[1]=1;let v=inner;for(let i=8;i>=2;i--){head[i]=v%256;v=Math.floor(v/256)}}
 else if(kind==='wav'){head=new Uint8Array(8);head.set(asc('veIl'));new DataView(head.buffer).setUint32(4,inner,true)}
 const out=new Uint8Array(head.length+inner),dv=new DataView(out.buffer),f0=head.length+pad+body.length;
 out.set(head);out.set(body,head.length+pad);dv.setUint32(f0,body.length);dv.setUint32(f0+4,out.length);out.set(VEND,f0+8);
 return{u:out,off:head.length+pad+11} /* off = where the 4-byte nonce sits in the first record's payload */}
const isoP=s=>{const d=new Date(s);return isNaN(d)?null:d};
async function tailRead(f){const ti=await tailInfo(f);if(!ti)return null;
 const b=await u8(f.slice(f.size-16-ti.bl,f.size-16)),R={tl:ti.tl,pl:null,text:'',taken:null,mod:null},dec=d=>new TextDecoder().decode(d);let p=0;
 while(p+5<=b.length){const ty=b[p],l=rd(b,p+1);if(p+5+l>b.length)break;const d=b.subarray(p+5,p+5+l);
  if(ty===1)R.pl=d.slice();else if(ty===2)R.text=dec(d);else if(ty===3)R.taken=isoP(dec(d));else if(ty===4)R.mod=isoP(dec(d));p+=5+l}
 if(R.pl&&!(R.pl.length>=10&&VMAGIC.every((v,i)=>R.pl[i]===v)&&(R.pl[5]===0||((R.pl[5]===1||R.pl[5]===2)&&R.pl.length>=54))))R.pl=null;
 return R}
/* cleanMedia: drops any veil tail and all tags; returns the clean bytes as parts. T={c:Date|null,m:Date|null} writes taken/modified times where the container has them. */
async function cleanMedia(f,T){
 const vt=await tailInfo(f);if(vt)f=f.slice(0,f.size-vt.tl,f.type);
 const h=await u8(f.slice(0,12));
 if(tp(h,4)==='ftyp')return mp4Parts(f,T);
 if(isEBML(h)){if(f.size>5e8)throw new Error('big');const u=await u8(f),r=webmProc(u,false);webmProc(u,true,T);return{kind:'webm',parts:[u],cl:1,info:r.info}}
 if(tp(h,0)==='RIFF'&&tp(h,8)==='WAVE')return wavParts(f);
 if(tp(h,0)==='fLaC')return flacParts(f);
 if((h[0]===0x49&&h[1]===0x44&&h[2]===0x33)||(h[0]===0xFF&&(h[1]&0xE0)===0xE0))return mp3Parts(f);
 return{kind:'raw',parts:[f],cl:0,info:[]}}
async function cleanVideo(f){
 const r=await cleanMedia(f);if(!r.cl)throw new Error('unsupported');
 return new Blob(r.parts,{type:f.type||(isAudio(f)?'audio/mpeg':'video/mp4')})}
class Sha256{
 constructor(){this.h=Uint32Array.from([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);this.b=new Uint8Array(64);this.n=0;this.l=0;this.w=new Uint32Array(64)}
 clone(){const c=new Sha256();c.h.set(this.h);c.b.set(this.b);c.n=this.n;c.l=this.l;return c}
 blk(u,o){const w=this.w,h=this.h,K=Sha256.K;
  for(let i=0;i<16;i++)w[i]=(u[o+4*i]<<24)|(u[o+4*i+1]<<16)|(u[o+4*i+2]<<8)|u[o+4*i+3];
  for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=(w[i-16]+(((a>>>7)|(a<<25))^((a>>>18)|(a<<14))^(a>>>3))+w[i-7]+(((b>>>17)|(b<<15))^((b>>>19)|(b<<13))^(b>>>10)))|0}
  let a=h[0],b=h[1],c=h[2],d=h[3],e=h[4],f=h[5],g=h[6],hh=h[7];
  for(let i=0;i<64;i++){const t1=(hh+(((e>>>6)|(e<<26))^((e>>>11)|(e<<21))^((e>>>25)|(e<<7)))+((e&f)^(~e&g))+K[i]+w[i])|0,t2=((((a>>>2)|(a<<30))^((a>>>13)|(a<<19))^((a>>>22)|(a<<10)))+((a&b)^(a&c)^(b&c)))|0;
   hh=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0}
  h[0]+=a;h[1]+=b;h[2]+=c;h[3]+=d;h[4]+=e;h[5]+=f;h[6]+=g;h[7]+=hh}
 update(u){let i=0;this.l+=u.length;
  if(this.n){while(this.n<64&&i<u.length)this.b[this.n++]=u[i++];if(this.n<64)return this;this.blk(this.b,0);this.n=0}
  for(;i+64<=u.length;i+=64)this.blk(u,i);
  while(i<u.length)this.b[this.n++]=u[i++];return this}
 digest(){const c=this.clone(),bits=c.l*8,pad=new Uint8Array(((c.n<56?56:120)-c.n)+8);pad[0]=0x80;
  const dv=new DataView(pad.buffer);dv.setUint32(pad.length-8,Math.floor(bits/4294967296));dv.setUint32(pad.length-4,bits>>>0);
  const l=c.l;c.update(pad);c.l=l;return[...c.h].map(v=>(v>>>0).toString(16).padStart(8,'0')).join('')}}
Sha256.K=Uint32Array.from([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
V.mi={cleanMedia,tailInfo,tailRead,tailBuild,bodyBuild,Sha256,u8,isAudio,isVideo,fmtB};

async function runVideo(f,aud){
 hap('medium');$('#miHome').hidden=true;const out=$('#miOut');out.hidden=false;out.innerHTML='<div class="mi-load">Analysing</div>';toTop();
 const url=URL.createObjectURL(f),hd=new Uint8Array(await f.slice(0,16).arrayBuffer());
 let kind='Unknown',R={info:[],created:null,modified:null,loc:'',keys:[]};
 const vt=await tailRead(f).catch(()=>null);
 try{if(tp(hd,4)==='ftyp'){kind=/^qt/.test(tp(hd,8))?'QuickTime MOV':/^M4[AB]/.test(tp(hd,8))?'M4A / ISO BMFF audio':'MP4 / ISO BMFF';R=await scanMP4(f,vt)}
  else if(hd[0]===0x1A&&hd[1]===0x45){kind='WebM / Matroska';if(f.size<5e8)R=Object.assign(R,webmProc(await u8(f),false))}
  else if(tp(hd,0)==='RIFF'&&tp(hd,8)==='WAVE')kind='WAV';
  else if(tp(hd,0)==='fLaC')kind='FLAC';else if(tp(hd,0)==='OggS')kind='Ogg';
  else if(aud&&((hd[0]===0x49&&hd[1]===0x44&&hd[2]===0x33)||(hd[0]===0xFF&&(hd[1]&0xE0)===0xE0)))kind='MP3 / MPEG audio'}catch(e){}
 const vm=await new Promise(r=>{const v=document.createElement(aud?'audio':'video');v.preload='metadata';v.onloadedmetadata=()=>r([v.videoWidth,v.videoHeight,v.duration]);v.onerror=()=>r([0,0,0]);setTimeout(()=>r([0,0,0]),4000);v.src=url});
 const hash=f.size<1.5e8?await sha(f):'',dur=vm[2]&&isFinite(vm[2])?Math.floor(vm[2]/60)+':'+String(Math.round(vm[2]%60)).padStart(2,'0'):'';
 const file={Name:f.name,Size:fmtB(f.size)+' ('+f.size.toLocaleString()+' bytes)','Declared type':f.type||'n/a','Detected container':kind,'Last modified':new Date(f.lastModified),'SHA-256':hash};
 const loc=R.loc?(R.loc.match(/^([+-]\d+\.\d+)([+-]\d+\.\d+)/)||[]).slice(1,3).map(Number).join(', '):'';
 const okD=d=>d&&d.getFullYear()>1990?d:'',tk=(vt&&vt.taken)||okD(R.created),md=(vt&&vt.mod)||okD(R.modified);
 const emb={'Dimensions':vm[0]?vm[0]+' × '+vm[1]+' px':'',Duration:dur,Taken:tk,Modified:md,'Location (GPS)':loc,'Apple tags':R.keys.map(k=>k.replace('com.apple.quicktime.','')).join(', ')};
 const hl=[['Taken',fv(tk)],['Modified',fv(md)],['Embedded text',vt&&vt.text]].filter(x=>x[1]);
 const found=R.info.length||loc||tk||md||(vt&&vt.text);
 out.innerHTML=`<div class="mi-frame">${aud?`<audio src="${url}" controls preload="metadata" style="display:block;width:100%;padding:14px;box-sizing:border-box"></audio>`:`<video src="${url}" controls playsinline muted></video>`}<div class="mi-chips"><span>${esc(kind)}</span>${vm[0]?`<span>${vm[0]} × ${vm[1]}</span>`:''}${dur?`<span>${dur}</span>`:''}<span>${fmtB(f.size)}</span></div></div>
 <div class="mi-acts"><button class="btn solid" id="miBs">Remove metadata</button><button class="btn" id="miBn">New file</button></div>
 ${hl.length?`<div class="mi-hl">${hl.map(x=>`<div class="${x[0]=='Embedded text'?'w':''}"><small>${x[0]}</small><b>${esc(x[1])}</b></div>`).join('')}</div>`:''}
 <div class="mi-note">${found?'This '+(aud?'audio file':'video')+' carries embedded metadata'+(R.info.length?': <b>'+R.info.map(esc).join('</b>, <b>')+'</b>':'')+'. Tap <b>Remove metadata</b> to save a clean copy; the '+(aud?'audio':'video and audio')+' is not re-encoded.':'No removable metadata blocks were detected. You can still save a clean copy.'}</div>
 <div id="miSecs">${sec('File',rows(file),1)}${sec('Embedded metadata',rows(emb),1)}${sec('Embedded Text',vt&&vt.text?[['Text',vt.text]]:[],1)}</div>`;
 if(vt&&vt.pl){$('#miSecs').insertAdjacentHTML('afterbegin',veilHTML(vt.pl));veilWire(vt.pl)}
 $('#miBs').onclick=async e=>{const b=e.currentTarget,L=b.textContent;hap();b.textContent='Working…';
  try{const c=await cleanVideo(f);deliver(c,cleanName(f,c),b,L)}catch(x){b.textContent=L;toast(x.message==='big'?'File too large for this format':'This format is not supported yet')}};
 $('#miBn').onclick=()=>{out.hidden=true;$('#miHome').hidden=false;$('#miFile').value='';hap()};
}
$('#miFile2').onchange=async e=>{
 const fs=[...e.target.files];if(!fs.length||!OK)return;
 $('#miHome').hidden=true;const out=$('#miOut');out.hidden=false;out.innerHTML='<div class="mi-load">Removing metadata</div>';toTop();
 const res=[];
 for(const f of fs){try{const b=isVideo(f)||isAudio(f)?await cleanVideo(f):await cleanImage(f);res.push({f,b,name:cleanName(f,b)})}catch(x){res.push({f,err:1})}}
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
