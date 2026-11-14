try{
/* Veil Creator: FOUNDER ONLY. Strips an image's metadata and hides a (optionally passphrase-locked) message inside it. Runs fully on the device.
   Access: the sidebar button is only shown to the owner, AND the tool refuses to open unless the server confirms the owner (owner-only edge function call, same backend rule as Portal lock). Fails closed. */
(function(V){
const $=id=>document.getElementById(id),enc=new TextEncoder(),MAGIC=[0x56,0x45,0x49,0x4C,0x31]; /* "VEIL1" */
const TTL=120000,TIMEOUT=12000;
let OK=false,okAt=0,gating=false,img=null,name='image',origBuf=null,url=null,pvUrl=null,busy=false,stop=false;
const say=m=>{try{V.tg.app.showAlert(m)}catch(e){alert(m)}};
const hap=t=>{try{V.tg.haptic(t)}catch(e){}};
const toTop=()=>{const s=$('vcSheet');if(s)s.scrollTop=0};
const LOCK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>';

/* ---------- founder gate ---------- */
function gateView(h){const g=$('vcGate'),a=$('vcApp');g.hidden=false;g.innerHTML=h;a.hidden=true}
function deny(msg,retry){gateView('<div class="mi-gi">'+LOCK+'</div><h3>Founders only</h3><p>'+msg+'</p>'+(retry?'<button class="btn solid" type="button" id="vcRetry">Try again</button>':''));
 const b=$('vcRetry');if(b)b.onclick=()=>{okAt=0;enter()}}
async function verify(){
 if(V.config.demoMode)return{ok:1};
 if(!document.body.classList.contains('owner'))return{k:'no'};
 let r;
 try{r=await Promise.race([V.services.api.lock_get(),new Promise((_,j)=>setTimeout(()=>j(new Error('t')),TIMEOUT))])}catch(e){return{k:'net'}}
 if(r&&r.ok)return{ok:1};
 if(!r||(!r.status&&r.error==='Network error. Try again.'))return{k:'net'};
 return{k:'no'}}
async function enter(prev){
 const bk=$('vcBack');if(bk){const p=prev&&prev!=='veil'?prev:'done';bk.dataset.go=p}
 if(gating)return;
 if(OK&&Date.now()-okAt<TTL){$('vcGate').hidden=true;$('vcApp').hidden=false;return}
 OK=false;gating=true;gateView('<div class="mi-sp"></div><p>Verifying founder access</p>');
 const r=await verify();gating=false;
 if(r.ok){OK=true;okAt=Date.now();$('vcGate').hidden=true;$('vcGate').innerHTML='';$('vcApp').hidden=false}
 else if(r.k==='net')deny('We could not verify your access. Check your connection and try again.',true);
 else deny('This tool is only available to the founder.')}
/* leaving wipes everything: message, passphrase, image, result */
function leave(){
 OK=false;okAt=0;stop=true;
 ['vcTxt','vcPw','vcPre','vcDt'].forEach(i=>{const e=$(i);if(e)e.value=''});
 {const c=$('vcDtOn'),w=$('vcDtW');if(c)c.checked=false;if(w)w.hidden=true}
 ['vcWork','vcOpts','vcOut'].forEach(i=>{const e=$(i);if(e)e.hidden=true});
 $('vcPrev').removeAttribute('src');$('vcBefore').textContent='';$('vcAfter').textContent='';$('vcFile').value='';
 if(url){URL.revokeObjectURL(url);url=null}if(pvUrl){URL.revokeObjectURL(pvUrl);pvUrl=null}
 img=null;origBuf=null;$('vcDl').onclick=null;
 $('vcGate').hidden=false;$('vcApp').hidden=true}

/* ---------- tool ---------- */
$('vcDrop').onclick=()=>{if(OK)$('vcFile').click()};
$('vcFile').onchange=e=>load(e.target.files[0]);
['dragover','dragenter'].forEach(t=>$('vcDrop').addEventListener(t,e=>{e.preventDefault();$('vcDrop').classList.add('on')}));
['dragleave','drop'].forEach(t=>$('vcDrop').addEventListener(t,e=>{e.preventDefault();$('vcDrop').classList.remove('on')}));
$('vcDrop').addEventListener('drop',e=>load(e.dataTransfer.files[0]));

async function load(f){
 if(!OK||!f||!f.type.startsWith('image/'))return;
 name=f.name.replace(/\.[^.]+$/,'')||'image';
 origBuf=await f.arrayBuffer();
 if(pvUrl)URL.revokeObjectURL(pvUrl);
 const u=pvUrl=URL.createObjectURL(f);
 img=new Image();
 img.onerror=()=>say('This image format cannot be opened here. Try a PNG or JPEG.');
 img.onload=()=>{
  $('vcPrev').src=u;
  $('vcBefore').textContent=f.type+', '+img.naturalWidth+'\u00d7'+img.naturalHeight+'\nMetadata found: '+list(origBuf);
  $('vcFmt').value=f.type==='image/jpeg'?'image/jpeg':'image/png';
  ['vcWork','vcOpts'].forEach(i=>$(i).hidden=false);$('vcOut').hidden=true};
 img.src=u}
function list(buf){
 const b=new Uint8Array(buf),l=[];
 if(b[0]===0x89){const dv=new DataView(buf);let p=8;
  while(p+12<=b.length){const len=dv.getUint32(p),t=String.fromCharCode(...b.slice(p+4,p+8));
   if(!['IHDR','IDAT','IEND','PLTE','sRGB','gAMA','pHYs','cHRM','sBIT','tRNS','bKGD','iCCP'].includes(t))l.push(t);p+=12+len}}
 else if(b[0]===0xFF){let p=2;
  while(p+4<b.length&&b[p]===0xFF){const m=b[p+1];if(m===0xDA||m===0xD9)break;const len=(b[p+2]<<8)|b[p+3];
   if(m===0xE1)l.push('EXIF/XMP');else if(m===0xFE)l.push('Comment');else if(m>=0xE0&&m<=0xEF)l.push('APP'+(m-0xE0));p+=2+len}}
 return l.length?l.join(', '):'none'}

/* payload: "VEIL1"(5) mode(1) nonce(4) [salt16 iv12] data. mode 0 plain, 1 AES-256-GCM (PBKDF2-SHA256, 150k) */
async function key(pass,salt){
 const k=await crypto.subtle.importKey('raw',enc.encode(pass),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:150000,hash:'SHA-256'},k,{name:'AES-GCM',length:256},false,['encrypt'])}
async function prep(text,pass){
 if(!pass)return{m:0,x:new Uint8Array(0),d:enc.encode(text)};
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(pass,salt),enc.encode(text)));
 const x=new Uint8Array(28);x.set(salt);x.set(iv,16);return{m:1,x,d:ct}}
function build(p,n){
 const o=new Uint8Array(10+p.x.length+p.d.length);
 o.set(MAGIC);o[5]=p.m;new DataView(o.buffer).setUint32(6,n);o.set(p.x,10);o.set(p.d,10+p.x.length);return o}
const crcT=(()=>{const t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
const crc=u=>{let c=0xFFFFFFFF;for(const x of u)c=crcT[(c^x)&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0};
function injPng(buf,pl){ /* private ancillary chunk "veIl" */
 const b=new Uint8Array(buf),ch=new Uint8Array(12+pl.length),dv=new DataView(ch.buffer);
 dv.setUint32(0,pl.length);ch.set(enc.encode('veIl'),4);ch.set(pl,8);
 dv.setUint32(8+pl.length,crc(ch.slice(4,8+pl.length)));
 const at=33,o=new Uint8Array(b.length+ch.length);
 o.set(b.slice(0,at));o.set(ch,at);o.set(b.slice(at),at+ch.length);return o}
function injJpg(buf,pl){ /* private APP15 segment */
 const b=new Uint8Array(buf),L=pl.length+2,seg=new Uint8Array(4+pl.length);
 seg.set([0xFF,0xEF,L>>8,L&255]);seg.set(pl,4);
 let at=2;if(b[2]===0xFF&&b[3]===0xE1)at=4+((b[4]<<8)|b[5]); /* keep a leading Exif segment first */
 const o=new Uint8Array(b.length+seg.length);
 o.set(b.slice(0,at));o.set(seg,at);o.set(b.slice(at),at+seg.length);return o}
const sha=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('');

/* ---------- date and time in the metadata ----------
   The image is re-encoded clean, so the chosen date is written fresh: JPEG gets an Exif segment (DateTime, DateTimeOriginal,
   DateTimeDigitized); PNG gets eXIf (same tags), tIME and a "Creation Time" text chunk. Time is stored exactly as typed. */
const p2=n=>String(n).padStart(2,'0');
function nowLocal(){const d=new Date();return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate())+'T'+p2(d.getHours())+':'+p2(d.getMinutes())+':'+p2(d.getSeconds())}
function readDate(){
 const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec($('vcDt').value||'');if(!m)return null;
 const y=+m[1],mo=+m[2],d=+m[3],h=+m[4],mi=+m[5],s=+(m[6]||0),t=new Date(y,mo-1,d,h,mi,s);
 if(y<1900||y>2099||t.getFullYear()!==y||t.getMonth()!==mo-1||t.getDate()!==d||t.getHours()!==h)return null;
 return{y,mo,d,h,mi,s,ms:t.getTime(),exif:y+':'+p2(mo)+':'+p2(d)+' '+p2(h)+':'+p2(mi)+':'+p2(s),iso:y+'-'+p2(mo)+'-'+p2(d)+'T'+p2(h)+':'+p2(mi)+':'+p2(s),show:y+'-'+p2(mo)+'-'+p2(d)+' '+p2(h)+':'+p2(mi)+':'+p2(s)}}
function exifTiff(ds){ /* little-endian TIFF: IFD0{DateTime, ExifIFD ptr} + ExifIFD{DateTimeOriginal, DateTimeDigitized} */
 const t=new Uint8Array(128),dv=new DataView(t.buffer),S=enc.encode(ds+'\0');
 t.set([0x49,0x49,0x2A,0,8,0,0,0]);
 dv.setUint16(8,2,true);
 dv.setUint16(10,0x0132,true);dv.setUint16(12,2,true);dv.setUint32(14,20,true);dv.setUint32(18,68,true);
 dv.setUint16(22,0x8769,true);dv.setUint16(24,4,true);dv.setUint32(26,1,true);dv.setUint32(30,38,true);
 dv.setUint32(34,0,true);
 dv.setUint16(38,2,true);
 dv.setUint16(40,0x9003,true);dv.setUint16(42,2,true);dv.setUint32(44,20,true);dv.setUint32(48,88,true);
 dv.setUint16(52,0x9004,true);dv.setUint16(54,2,true);dv.setUint32(56,20,true);dv.setUint32(60,108,true);
 dv.setUint32(64,0,true);
 t.set(S,68);t.set(S,88);t.set(S,108);return t}
function pngChunk(type,data){const c=new Uint8Array(12+data.length),dv=new DataView(c.buffer);
 dv.setUint32(0,data.length);c.set(enc.encode(type),4);c.set(data,8);dv.setUint32(8+data.length,crc(c.slice(4,8+data.length)));return c}
function stamp(buf,type,d){ /* returns an ArrayBuffer of the image with the date metadata added */
 const b=new Uint8Array(buf),tiff=exifTiff(d.exif);let add,at;
 if(type==='image/png'){
  const tm=new Uint8Array(7);new DataView(tm.buffer).setUint16(0,d.y);tm.set([d.mo,d.d,d.h,d.mi,d.s],2);
  const parts=[pngChunk('eXIf',tiff),pngChunk('tIME',tm),pngChunk('tEXt',enc.encode('Creation Time\0'+d.iso))];
  add=new Uint8Array(parts.reduce((n,x)=>n+x.length,0));let q=0;parts.forEach(x=>{add.set(x,q);q+=x.length});at=33}
 else{const L=8+tiff.length;add=new Uint8Array(2+L);add.set([0xFF,0xE1,L>>8,L&255]);add.set(enc.encode('Exif'),4);add.set(tiff,10);at=2}
 const o=new Uint8Array(b.length+add.length);o.set(b.slice(0,at));o.set(add,at);o.set(b.slice(at),at+add.length);return o.buffer}
$('vcDtOn').onchange=()=>{const on=$('vcDtOn').checked;$('vcDtW').hidden=!on;if(on&&!$('vcDt').value)$('vcDt').value=nowLocal()};

$('vcGo').onclick=async()=>{
 if(!OK||!img)return;
 if(busy){stop=true;return}
 const text=$('vcTxt').value;if(!text.trim()){say('Enter the secret message first.');return}
 const pre=$('vcPre').value.trim().toLowerCase();
 if(pre&&!/^[0-9a-f]{1,5}$/.test(pre)){say('Hash prefix must be 1\u20135 hex characters (0-9, a-f).');return}
 let dt=null;if($('vcDtOn').checked){dt=readDate();if(!dt){say('Pick a valid date and time (year 1900\u20132099) or switch the date setting off.');return}}
 const type=$('vcFmt').value,c=document.createElement('canvas');
 c.width=img.naturalWidth;c.height=img.naturalHeight;
 const x=c.getContext('2d');
 if(type==='image/jpeg'){x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height)}
 x.drawImage(img,0,0);
 let base=await (await new Promise(r=>c.toBlob(r,type,0.95))).arrayBuffer();
 if(dt)base=stamp(base,type,dt);
 const inj=type==='image/png'?injPng:injJpg,p=await prep(text,$('vcPw').value);
 let n=0,out=inj(base,build(p,n)),hash=await sha(out),note='';
 if(pre){
  busy=true;stop=false;
  while(!hash.startsWith(pre)&&!stop&&OK&&n<3000000){
   n++;out=inj(base,build(p,n));hash=await sha(out);
   if(n%100===0){$('vcGo').textContent='Searching\u2026 '+n.toLocaleString()+' tries (tap to cancel)';await new Promise(r=>setTimeout(r))}}
  busy=false;$('vcGo').textContent='Clean & create veil';
  note=hash.startsWith(pre)?'\nPrefix "'+pre+'" matched after '+(n+1).toLocaleString()+' tries.':'\nPrefix not found (stopped after '+(n+1).toLocaleString()+' tries).'}
 if(!OK)return;
 const ext=type==='image/png'?'png':'jpg',fb=new Blob([out],{type});
 if(url)URL.revokeObjectURL(url);
 url=URL.createObjectURL(fb);
 $('vcDl').onclick=()=>{
  const f=new File([fb],name+'-veil.'+ext,dt?{type,lastModified:dt.ms}:{type});
  if(navigator.canShare&&navigator.canShare({files:[f]}))navigator.share({files:[f]}).catch(()=>{});
  else{const a=document.createElement('a');a.href=url;a.download=f.name;document.body.appendChild(a);a.click();a.remove()}
  hap()};
 $('vcAfter').textContent='All original metadata removed.'+(dt?'\nDate and time set to '+dt.show+' in the metadata.':'')+'\nVeil: '+(p.m?'locked with passphrase':'plain (no passphrase)')+', '+(out.length-base.byteLength)+' bytes hidden.\n\nSHA-256:\n'+hash+note;
 $('vcOut').hidden=false;$('vcOut').scrollIntoView({behavior:'smooth'})};

/* sidebar entry (Founder section, owner only) opens the view through a hidden proxy so the normal view switch runs */
const mv=$('mveil');if(mv)mv.onclick=()=>{if(document.body.classList.contains('owner')){const g=$('vcGoView');if(g)g.click()}};
if(V.tools)V.tools.hooks.veil={enter,leave};
})(window.ILLUMINATI);
}catch(e){console.error(e)}
