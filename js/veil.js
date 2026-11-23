try{
/* Veil Creator: FOUNDER ONLY. Strips the metadata of a photo, audio or video file and hides a (optionally passphrase-locked) veil inside it. Runs fully on the device.
   Separate fields: Veil data (hidden message), Embedded text (plain text stored in the file), Taken time and Modified time (stored only as dates, never as text).
   Access: the sidebar button is only shown to the owner, AND the tool refuses to open unless the server confirms the owner (owner-only edge function call, same backend rule as Portal lock). Fails closed. */
(function(V){
const $=id=>document.getElementById(id),enc=new TextEncoder(),MAGIC=[0x56,0x45,0x49,0x4C,0x31]; /* "VEIL1" */
const TTL=600000,TIMEOUT=12000;
const MAXAV=200*1048576; /* audio / video are read on the device; keep them within what a phone can handle */
let OK=false,okAt=0,gating=false,img=null,kind='image',file=null,name='image',origBuf=null,url=null,pvUrl=null,busy=false,stop=false;
const say=m=>{try{V.tg.app.showAlert(m)}catch(e){alert(m)}};
const hap=t=>{try{V.tg.haptic(t)}catch(e){}};
const toTop=()=>{const s=$('vcSheet');if(s)s.scrollTop=0};
const LOCK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>';

/* ---------- founder gate ---------- */
function gateView(h){const g=$('vcGate'),a=$('vcApp');g.hidden=false;g.innerHTML=h;a.hidden=true}
function deny(msg,retry){gateView('<div class="mi-gi">'+LOCK+'</div><h3>Founders only</h3><p>'+String(msg==null?'':msg).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))+'</p>'+(retry?'<button class="btn solid" type="button" id="vcRetry">Try again</button>':''));
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
 ['vcTxt','vcPw','vcPre','vcEt','vcTk','vcMd'].forEach(i=>{const e=$(i);if(e)e.value=''});
 ['vcWork','vcOpts','vcOut'].forEach(i=>{const e=$(i);if(e)e.hidden=true});
 ['vcPrevV','vcPrevA'].forEach(i=>{const e=$(i);try{e.pause()}catch(x){}e.removeAttribute('src');e.load&&e.load()});
 $('vcPrev').removeAttribute('src');$('vcBefore').textContent='';$('vcAfter').textContent='';$('vcFile').value='';
 if(url){URL.revokeObjectURL(url);url=null}if(pvUrl){URL.revokeObjectURL(pvUrl);pvUrl=null}
 img=null;file=null;origBuf=null;$('vcDl').onclick=null;
 $('vcGate').hidden=false;$('vcApp').hidden=true}

/* ---------- tool ---------- */
$('vcDrop').onclick=()=>{if(OK)$('vcFile').click()};
$('vcFile').onchange=e=>load(e.target.files[0]);
['dragover','dragenter'].forEach(t=>$('vcDrop').addEventListener(t,e=>{e.preventDefault();$('vcDrop').classList.add('on')}));
['dragleave','drop'].forEach(t=>$('vcDrop').addEventListener(t,e=>{e.preventDefault();$('vcDrop').classList.remove('on')}));
$('vcDrop').addEventListener('drop',e=>load(e.dataTransfer.files[0]));

const M=()=>V.mi||{};
const AUD=/\.(mp3|m4a|wav|flac|ogg|oga|opus|aac|weba)$/i,VID=/\.(mp4|m4v|mov|webm|mkv|3gp)$/i;
const kindOf=f=>/^image\//.test(f.type)?'image':/^audio\//.test(f.type)?'audio':/^video\//.test(f.type)?'video':AUD.test(f.name)?'audio':VID.test(f.name)?'video':'';
function setKind(k){
 kind=k;const im=k==='image';
 $('vcPrev').hidden=!im;$('vcPrevV').hidden=k!=='video';$('vcPrevA').hidden=k!=='audio';
 $('vcFmtW').hidden=!im;$('vcAvNote').hidden=im}
async function load(f){
 if(!OK||!f)return;
 const k=kindOf(f);
 if(!k){say('Choose a photo, an audio file or a video file.');return}
 if(k!=='image'&&f.size>MAXAV){say('That file is too large for this tool. Audio and video can be up to 200 MB.');return}
 if(!M().cleanMedia&&k!=='image'){say('The media engine did not load. Reload the app and try again.');return}
 name=f.name.replace(/\.[^.]+$/,'')||'file';file=f;
 if(pvUrl)URL.revokeObjectURL(pvUrl);
 const u=pvUrl=URL.createObjectURL(f);
 if(k==='image'){
  origBuf=await f.arrayBuffer();
  img=new Image();
  img.onerror=()=>say('This image format cannot be opened here. Try a PNG or JPEG.');
  img.onload=()=>{
   setKind('image');$('vcPrev').src=u;
   $('vcBefore').textContent=f.type+', '+img.naturalWidth+'×'+img.naturalHeight+'\nMetadata found: '+list(origBuf);
   $('vcFmt').value=f.type==='image/jpeg'?'image/jpeg':'image/png';
   ['vcWork','vcOpts'].forEach(i=>$(i).hidden=false);$('vcOut').hidden=true};
  img.src=u;return}
 img=null;origBuf=null;setKind(k);
 const pv=k==='video'?$('vcPrevV'):$('vcPrevA');pv.src=u;
 let info='reading…';
 $('vcBefore').textContent=(f.type||k)+', '+M().fmtB(f.size)+'\nMetadata found: '+info;
 ['vcWork','vcOpts'].forEach(i=>$(i).hidden=false);$('vcOut').hidden=true;
 try{const r=await M().cleanMedia(f);info=r.info&&r.info.length?r.info.join(', '):(r.cl?'none':'unknown (this format’s tags cannot be read here)')}catch(e){info='unknown'}
 if(file===f)$('vcBefore').textContent=(f.type||k)+', '+M().fmtB(f.size)+'\nMetadata found: '+info}
function list(buf){
 const b=new Uint8Array(buf),l=[];
 if(b[0]===0x89){const dv=new DataView(buf);let p=8;
  while(p+12<=b.length){const len=dv.getUint32(p),t=String.fromCharCode(...b.slice(p+4,p+8));
   if(!['IHDR','IDAT','IEND','PLTE','sRGB','gAMA','pHYs','cHRM','sBIT','tRNS','bKGD','iCCP'].includes(t))l.push(t);p+=12+len}}
 else if(b[0]===0xFF){let p=2;
  while(p+4<b.length&&b[p]===0xFF){const m=b[p+1];if(m===0xDA||m===0xD9)break;const len=(b[p+2]<<8)|b[p+3];
   if(m===0xE1)l.push('EXIF/XMP');else if(m===0xFE)l.push('Comment');else if(m>=0xE0&&m<=0xEF)l.push('APP'+(m-0xE0));p+=2+len}}
 return l.length?l.join(', '):'none'}

/* payload: "VEIL1"(5) mode(1) nonce(4) [salt16 iv12] data. mode 0 plain, 1 AES-256-GCM (PBKDF2-SHA256, 150k, legacy), 2 same with 600k */
async function key(pass,salt){
 const k=await crypto.subtle.importKey('raw',enc.encode(pass),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:600000,hash:'SHA-256'},k,{name:'AES-GCM',length:256},false,['encrypt'])}
async function prep(text,pass){
 if(!pass)return{m:0,x:new Uint8Array(0),d:enc.encode(text)};
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(pass,salt),enc.encode(text)));
 const x=new Uint8Array(28);x.set(salt);x.set(iv,16);return{m:2,x,d:ct}}
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

/* ---------- taken time, modified time and embedded text ----------
   The image is re-encoded clean, so these are written fresh. Taken time = Exif DateTimeOriginal + DateTimeDigitized. Modified time = Exif DateTime (+ PNG tIME).
   Neither is ever written as a text chunk, so they cannot show up as Embedded text. Embedded text = JPEG comment / PNG iTXt "Comment". Times are stored exactly as typed. */
const p2=n=>String(n).padStart(2,'0');
function readDate(id){
 const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec($(id).value||'');if(!m)return null;
 const y=+m[1],mo=+m[2],d=+m[3],h=+m[4],mi=+m[5],s=+(m[6]||0),t=new Date(y,mo-1,d,h,mi,s);
 if(y<1900||y>2099||t.getFullYear()!==y||t.getMonth()!==mo-1||t.getDate()!==d||t.getHours()!==h)return null;
 return{y,mo,d,h,mi,s,ms:t.getTime(),exif:y+':'+p2(mo)+':'+p2(d)+' '+p2(h)+':'+p2(mi)+':'+p2(s),iso:y+'-'+p2(mo)+'-'+p2(d)+'T'+p2(h)+':'+p2(mi)+':'+p2(s),show:y+'-'+p2(mo)+'-'+p2(d)+' '+p2(h)+':'+p2(mi)+':'+p2(s)}}
function exifTiff(tk,md){ /* little-endian TIFF: IFD0{DateTime (modified), ExifIFD ptr} + ExifIFD{DateTimeOriginal, DateTimeDigitized (taken)} */
 const n0=(md?1:0)+(tk?1:0),ifd1=8+2+n0*12+4,sz1=tk?2+2*12+4:0;let sp=ifd1+sz1;
 const t=new Uint8Array(sp+(md?20:0)+(tk?40:0)),dv=new DataView(t.buffer);
 t.set([0x49,0x49,0x2A,0,8,0,0,0]);let o=8;dv.setUint16(o,n0,true);o+=2;
 const str=(o,tag,txt)=>{dv.setUint16(o,tag,true);dv.setUint16(o+2,2,true);dv.setUint32(o+4,20,true);dv.setUint32(o+8,sp,true);t.set(enc.encode(txt+'\0'),sp);sp+=20};
 if(md){str(o,0x0132,md.exif);o+=12}
 if(tk){dv.setUint16(o,0x8769,true);dv.setUint16(o+2,4,true);dv.setUint32(o+4,1,true);dv.setUint32(o+8,ifd1,true);o+=12}
 dv.setUint32(o,0,true);
 if(tk){o=ifd1;dv.setUint16(o,2,true);o+=2;str(o,0x9003,tk.exif);o+=12;str(o,0x9004,tk.exif);o+=12;dv.setUint32(o,0,true)}
 return t}
function pngChunk(type,data){const c=new Uint8Array(12+data.length),dv=new DataView(c.buffer);
 dv.setUint32(0,data.length);c.set(enc.encode(type),4);c.set(data,8);dv.setUint32(8+data.length,crc(c.slice(4,8+data.length)));return c}
function stamp(buf,type,tk,md,txt){ /* returns the image with the chosen metadata added */
 const b=new Uint8Array(buf),parts=[];let at;
 if(type==='image/png'){
  if(tk||md)parts.push(pngChunk('eXIf',exifTiff(tk,md)));
  if(md){const tm=new Uint8Array(7);new DataView(tm.buffer).setUint16(0,md.y);tm.set([md.mo,md.d,md.h,md.mi,md.s],2);parts.push(pngChunk('tIME',tm))}
  if(txt){const t=enc.encode(txt),k=enc.encode('Comment'),d=new Uint8Array(k.length+5+t.length);d.set(k);d.set(t,k.length+5);parts.push(pngChunk('iTXt',d))}
  at=33}
 else{
  if(tk||md){const tiff=exifTiff(tk,md),L=8+tiff.length,sg=new Uint8Array(2+L);sg.set([0xFF,0xE1,L>>8,L&255]);sg.set(enc.encode('Exif'),4);sg.set(tiff,10);parts.push(sg)}
  if(txt){const t=enc.encode(txt).slice(0,65000),L=t.length+2,sg=new Uint8Array(4+t.length);sg.set([0xFF,0xFE,L>>8,L&255]);sg.set(t,4);parts.push(sg)}
  at=2}
 if(!parts.length)return buf;
 const add=new Uint8Array(parts.reduce((n,x)=>n+x.length,0));let q=0;parts.forEach(x=>{add.set(x,q);q+=x.length});
 const o=new Uint8Array(b.length+add.length);o.set(b.slice(0,at));o.set(add,at);o.set(b.slice(at),at+add.length);return o.buffer}

const hex=u=>[...new Uint8Array(u)].map(v=>v.toString(16).padStart(2,'0')).join('');
const tick=async(n,pre)=>{$('vcGo').textContent='Searching… '+n.toLocaleString()+' tries (tap to cancel)';await new Promise(r=>setTimeout(r))};
$('vcGo').onclick=async()=>{
 if(!OK||!file)return;
 if(busy){stop=true;return}
 const text=$('vcTxt').value;if(!text.trim()){say('Enter the veil data first.');return}
 const pre=$('vcPre').value.trim().toLowerCase();
 if(pre&&!/^[0-9a-f]{1,5}$/.test(pre)){say('Hash prefix must be 1–5 hex characters (0-9, a-f).');return}
 const tk=$('vcTk').value?readDate('vcTk'):null,md=$('vcMd').value?readDate('vcMd'):null;
 if(($('vcTk').value&&!tk)||($('vcMd').value&&!md)){say('Pick a valid taken / modified time (year 1900–2099) or clear it.');return}
 const et=$('vcEt').value.trim();
 const btn=$('vcGo'),label=btn.textContent;
 try{
  const p=await prep(text,$('vcPw').value);
  let out,hash,note='',n=0,hidden=0,removed='',ext,type,fb;
  if(kind==='image'){
   if(!img)return;
   type=$('vcFmt').value;const c=document.createElement('canvas');
   c.width=img.naturalWidth;c.height=img.naturalHeight;
   const x=c.getContext('2d');
   if(type==='image/jpeg'){x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height)}
   x.drawImage(img,0,0);
   let base=await (await new Promise(r=>c.toBlob(r,type,0.95))).arrayBuffer();
   base=stamp(base,type,tk,md,et);
   const inj=type==='image/png'?injPng:injJpg;
   out=inj(base,build(p,n));hash=await sha(out);
   if(pre){
    busy=true;stop=false;
    while(!hash.startsWith(pre)&&!stop&&OK&&n<3000000){
     n++;out=inj(base,build(p,n));hash=await sha(out);
     if(n%100===0)await tick(n)}
    busy=false;btn.textContent=label;
    note=hash.startsWith(pre)?'\nPrefix "'+pre+'" matched after '+(n+1).toLocaleString()+' tries.':'\nPrefix not found (stopped after '+(n+1).toLocaleString()+' tries).'}
   hidden=out.length-base.byteLength;ext=type==='image/png'?'png':'jpg';fb=new Blob([out],{type});removed='All original metadata removed.'}
  else{
   const m=M();btn.textContent='Working…';
   const r=await m.cleanMedia(file,(tk||md)?{c:tk?new Date(tk.ms):null,m:md?new Date(md.ms):null}:null);
   if(!r.cl&&kind==='video'){btn.textContent=label;say('This video container is not supported. Use MP4, MOV, M4V, WebM or MKV.');return}
   if(r.kind==='mp4'&&[tk,md].some(d=>d&&(d.y<1904||d.y>2040))){btn.textContent=label;say('MP4 and MOV store dates from 1904 to 2040. Pick a date in that range.');return}
   const iso=d=>d&&d.iso,mk=k=>m.tailBuild(r.kind,m.bodyBuild(build(p,k),et,iso(tk),iso(md)));
   const t0=mk(0);if(r.kind==='wav'){new DataView(r.parts[0].buffer).setUint32(4,r.riff+t0.u.length,true)}
   /* hash the clean media once, then only the small tail per try */
   const S=new m.Sha256(),CH=4194304;
   for(const q of r.parts){if(q instanceof Uint8Array)S.update(q);else for(let o=0;o<q.size;o+=CH)S.update(new Uint8Array(await q.slice(o,o+CH).arrayBuffer()))}
   S.update(t0.u.subarray(0,t0.off));
   const fin=k=>{const t=mk(k),s=S.clone();s.update(t.u.subarray(t.off));return{t,h:s.digest()}};
   let cur=fin(0);
   if(pre){
    busy=true;stop=false;
    while(!cur.h.startsWith(pre)&&!stop&&OK&&n<3000000){n++;cur=fin(n);if(n%500===0)await tick(n)}
    busy=false;btn.textContent=label;
    note=cur.h.startsWith(pre)?'\nPrefix "'+pre+'" matched after '+(n+1).toLocaleString()+' tries.':'\nPrefix not found (stopped after '+(n+1).toLocaleString()+' tries).'}
   hash=cur.h;hidden=cur.t.u.length;
   const mt=/\.([^.]+)$/.exec(file.name);ext=mt?mt[1].toLowerCase():(kind==='audio'?'mp3':'mp4');type=file.type||(kind==='audio'?'audio/mpeg':'video/mp4');
   fb=new Blob([...r.parts,cur.t.u],{type});
   removed=r.cl?(r.info&&r.info.length?'Original metadata removed: '+r.info.join(', ')+'.':'No removable metadata was found.'):'This format’s own tags could not be stripped here; the veil was added.'}
  if(!OK)return;
  if(url)URL.revokeObjectURL(url);
  url=URL.createObjectURL(fb);
  $('vcDl').onclick=()=>{
   const f=new File([fb],name+'-veil.'+ext,md?{type,lastModified:md.ms}:{type});
   if(navigator.canShare&&navigator.canShare({files:[f]}))navigator.share({files:[f]}).catch(()=>{});
   else{const a=document.createElement('a');a.href=url;a.download=f.name;document.body.appendChild(a);a.click();a.remove()}
   hap()};
  $('vcAfter').textContent=removed
   +(tk?'\nTaken time set to '+tk.show+'.':'')+(md?'\nModified time set to '+md.show+'.':'')
   +(et?'\nEmbedded text added ('+et.length+' characters).':'')
   +'\nVeil data: '+(p.m?'locked with passphrase':'plain (no passphrase)')+', '+hidden+' bytes hidden.\n\nSHA-256:\n'+hash+note;
  $('vcOut').hidden=false;$('vcOut').scrollIntoView({behavior:'smooth'})
 }catch(e){busy=false;btn.textContent=label;console.error(e);say(e&&e.message==='big'?'This file is too large for that format.':'Could not create the veil from this file.')}};

/* sidebar entry (Founder section, owner only) opens the view through a hidden proxy so the normal view switch runs */
const mv=$('mveil');if(mv)mv.onclick=()=>{if(document.body.classList.contains('owner')){const g=$('vcGoView');if(g)g.click()}};
if(V.tools)V.tools.hooks.veil={enter,leave};
})(window.ILLUMINATI);
}catch(e){console.error(e)}
