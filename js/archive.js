try{
/* Corrupted Archive (members) + Archive Upload (founder only).
   Storage is Cloudflare R2, reached through the illuminati-corrupted edge function. Every rule is enforced on the server; this page only shows it.
   - Metadata: files are uploaded as the raw bytes of the selected file (no canvas, no re-encoding, no resizing) and downloaded back unchanged.
   - Images and audio can be saved, unlimited times. Videos are stream-only: no Save button, no download action on the server, and the player has its download / PiP / cast controls off. */
(function(V){
const $=id=>document.getElementById(id),api=V.services.api;
const MB=1048576,LIM={image:50*MB,audio:200*MB,video:500*MB};
const EXT={jpg:"image",jpeg:"image",png:"image",webp:"image",gif:"image",heic:"image",heif:"image",tif:"image",tiff:"image",avif:"image",bmp:"image",mp3:"audio",m4a:"audio",aac:"audio",wav:"audio",ogg:"audio",oga:"audio",opus:"audio",flac:"audio",mp4:"video",m4v:"video",webm:"video",mov:"video"};
const kindOf=f=>{const t=(f.type||"").toLowerCase(),e=EXT[(f.name.split(".").pop()||"").toLowerCase()];return/^image\//.test(t)?"image":/^audio\//.test(t)?"audio":/^video\//.test(t)?"video":e||""};
const h=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e};
const fmtSize=n=>n>=MB*1024?(n/MB/1024).toFixed(1)+" GB":n>=MB?(n/MB).toFixed(1)+" MB":Math.max(1,Math.round(n/1024))+" KB";
const fmtDate=s=>{try{return new Date(s).toLocaleDateString()}catch(e){return""}};
const hap=t=>{try{V.tg.haptic(t||"light")}catch(e){}};
function toast(t){const e=$("miToast");if(!e)return;e.textContent=t;e.classList.add("on");clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove("on"),2200)}
const PLAY='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>';
const LOCK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>';

/* hands a file to the device. Telegram's native downloader first (keeps the file exactly as stored), then a normal download link, then the external browser. */
function deliver(url,name){
 const t=V.tg.app;
 try{if(t&&typeof t.downloadFile==="function"&&t.isVersionAtLeast&&t.isVersionAtLeast("8.0")){t.downloadFile({url:url,file_name:name});return}}catch(e){}
 try{const a=document.createElement("a");a.href=url;a.download=name;a.rel="noopener";a.style.display="none";document.body.appendChild(a);a.click();a.remove();return}catch(e){}
 V.tg.open(url)}
async function save(x,btn){
 if(btn&&btn.disabled)return;
 const t=btn?btn.textContent:"";if(btn){btn.disabled=true;btn.textContent="Preparing…"}
 let r;try{r=await api.arc_download({id:x.id})}catch(e){r=null}
 if(btn){btn.disabled=false;btn.textContent=t}
 if(!r||!r.ok||!r.url){toast((r&&r.error)||"Could not prepare the file.");return}
 deliver(r.url,r.filename||x.filename);hap("medium")}

/* ================= Corrupted Archive (members) ================= */
let ITEMS=[],FILT="all",loadedAt=0,busy=false,vid=null,lbItem=null;
function stopVideo(){if(vid){try{vid.pause();vid.removeAttribute("src");vid.load()}catch(e){}vid=null}}
function stopAudio(){document.querySelectorAll("#arList audio").forEach(a=>{try{a.pause()}catch(e){}})}
function stale(){if(Date.now()-loadedAt>30000)load()} /* a link expired: fetch fresh ones (at most every 30 s) */
function videoBox(x){
 const w=h("div","ar-vid");w.setAttribute("role","button");w.tabIndex=0;w.setAttribute("aria-label","Stream "+x.title);
 const p=h("span","ar-play");p.innerHTML=PLAY;const l=h("span","ar-vl","Tap to stream");w.append(p,l);
 const go=async()=>{
  if(w.dataset.b)return;w.dataset.b="1";l.textContent="Loading…";
  let r;try{r=await api.arc_stream({id:x.id})}catch(e){r=null}
  if(!r||!r.ok||!r.url){w.dataset.b="";l.textContent=(r&&r.error)||"Could not load the video.";return}
  if(vid)try{vid.pause()}catch(e){}
  const v=document.createElement("video");v.className="ar-v";v.src=r.url;v.controls=true;v.autoplay=true;v.playsInline=true;v.preload="metadata";
  v.setAttribute("controlsList","nodownload noremoteplayback");v.disablePictureInPicture=true;v.disableRemotePlayback=true;
  v.addEventListener("contextmenu",e=>e.preventDefault());
  v.onerror=()=>toast("This video could not be played.");
  w.replaceWith(v);vid=v};
 w.onclick=go;w.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();go()}};
 return w}
function card(x){
 const c=h("div","ar-item"),body=h("div","ar-body"),t=h("b",null,x.title);
 t.appendChild(h("span","ar-tag",x.kind));body.appendChild(t);
 body.appendChild(h("small",null,fmtSize(x.size)+" · "+fmtDate(x.created_at)));
 if(x.kind==="image"&&x.url){const im=document.createElement("img");im.className="ar-thumb";im.loading="lazy";im.decoding="async";im.alt=x.title;im.src=x.url;im.onclick=()=>openLb(x);im.onerror=stale;c.appendChild(im)}
 else if(x.kind==="video")c.appendChild(videoBox(x));
 if(x.kind==="audio"&&x.url){const a=document.createElement("audio");a.controls=true;a.preload="none";a.src=x.url;a.onerror=stale;body.appendChild(a)}
 if(x.saveable){const act=h("div","ar-act"),b=h("button","btn","Save original");b.type="button";b.onclick=()=>save(x,b);act.appendChild(b);body.appendChild(act)}
 else body.appendChild(h("small","ar-lock","Stream only. This video cannot be saved."));
 c.appendChild(body);return c}
function draw(){
 stopVideo();stopAudio();
 const box=$("arList");box.textContent="";
 const rows=ITEMS.filter(x=>FILT==="all"||x.kind===FILT);
 if(!rows.length){box.appendChild(h("p","note",ITEMS.length?"Nothing in this category yet.":"The archive is empty."));return}
 rows.forEach(x=>box.appendChild(card(x)))}
async function load(){
 if(busy)return;busy=true;$("arNote").textContent="";
 if(!ITEMS.length)$("arList").replaceChildren(h("p","note","Loading…"));
 let r;try{r=await api.arc_list()}catch(e){r=null}
 busy=false;
 if(!r||!r.ok){if(r&&r.status==="locked")return;if(!ITEMS.length)$("arList").textContent="";$("arNote").textContent=(r&&r.error)||"Could not load the archive.";return}
 ITEMS=Array.isArray(r.items)?r.items:[];loadedAt=Date.now();draw()}
$("arTabs").addEventListener("click",e=>{const b=e.target.closest("button[data-f]");if(!b)return;FILT=b.dataset.f;
 $("arTabs").querySelectorAll("button").forEach(k=>k.setAttribute("aria-pressed",String(k===b)));draw();hap()});

/* image viewer */
function openLb(x){lbItem=x;$("arLbI").src=x.url;$("arLbI").alt=x.title;$("arLb").classList.add("on")}
function closeLb(){lbItem=null;$("arLb").classList.remove("on");$("arLbI").removeAttribute("src")}
$("arLb").addEventListener("click",e=>{if(e.target===$("arLb"))closeLb()});
$("arLbX").onclick=closeLb;
$("arLbS").onclick=()=>{if(lbItem)save(lbItem,$("arLbS"))};
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("arLb").classList.contains("on"))closeLb()});
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&document.body.dataset.view==="archive"&&Date.now()-loadedAt>40*60000)load()});

/* ================= Archive Upload (founder only) ================= */
const TTL=120000,TIMEOUT=12000;
let OK=false,okAt=0,gating=false,uploading=false,Q=[],AL=[];
function gateView(html){const g=$("auGate");g.hidden=false;g.innerHTML=html;$("auApp").hidden=true}
function deny(msg,retry){gateView('<div class="mi-gi">'+LOCK+'</div><h3>Founders only</h3><p>'+msg+'</p>'+(retry?'<button class="btn solid" type="button" id="auRetry">Try again</button>':''));
 const b=$("auRetry");if(b)b.onclick=()=>{okAt=0;enter()}}
async function verify(){
 if(!document.body.classList.contains("owner"))return{k:"no"};
 let r;try{r=await Promise.race([api.arc_owner(),new Promise((_,j)=>setTimeout(()=>j(new Error("t")),TIMEOUT))])}catch(e){return{k:"net"}}
 if(r&&r.ok)return{ok:1};
 if(!r||(!r.status&&r.error==="Network error. Try again."))return{k:"net"};
 return{k:"no",msg:r.error}}
async function enter(){
 if(gating)return;
 if(OK&&Date.now()-okAt<TTL){$("auGate").hidden=true;$("auApp").hidden=false;loadList();return}
 OK=false;gating=true;gateView('<div class="mi-sp"></div><p>Verifying founder access</p>');
 const r=await verify();gating=false;
 if(r.ok){OK=true;okAt=Date.now();$("auGate").hidden=true;$("auGate").innerHTML="";$("auApp").hidden=false;loadList()}
 else if(r.k==="net")deny("We could not verify your access. Check your connection and try again.",true);
 else deny("This section is only available to the founder.")}
function leave(){OK=false;okAt=0;$("auGate").hidden=false;$("auApp").hidden=true}

/* queue */
function mkRow(it){
 const el=h("div","ar-q"),top=h("div","ar-row"),nm=h("div","ar-nm"),b=h("b",null,it.f.name),s=h("small",null,it.kind+" · "+fmtSize(it.f.size)+(it.kind==="video"?" · stream only":""));
 nm.append(b,s);const x=h("button","ar-x","×");x.type="button";x.setAttribute("aria-label","Remove "+it.f.name);
 x.onclick=()=>{if(it.state==="up")return;Q=Q.filter(k=>k!==it);el.remove();sync()};
 top.append(nm,x);
 const ti=document.createElement("input");ti.className="ar-ti";ti.type="text";ti.maxLength=120;ti.autocomplete="off";ti.placeholder="Title";ti.setAttribute("aria-label","Title for "+it.f.name);
 ti.value=it.f.name.replace(/\.[^.]+$/,"").slice(0,120);
 const bar=h("div","ar-bar"),fill=document.createElement("i");bar.appendChild(fill);const st=h("div","ar-st");
 el.append(top,ti,bar,st);
 it.el=el;it.ti=ti;it.x=x;it.bar=p=>{fill.style.width=Math.max(0,Math.min(100,p))+"%"};
 it.set=(c,m)=>{st.className="ar-st"+(c?" "+c:"");st.textContent=m||""};
 return el}
function sync(){
 const pend=Q.filter(k=>k.state!=="done").length;
 $("auGo").hidden=!pend;$("auGo").disabled=uploading;
 $("auGo").textContent=uploading?"Uploading…":"Upload "+(pend>1?pend+" files":"file")}
function addFiles(list){
 const msgs=[];
 [...list].forEach(f=>{
  const kind=kindOf(f);
  if(!f.size){msgs.push(f.name+" is empty.");return}
  if(!kind){msgs.push(f.name+" is not an image, audio or video file.");return}
  if(f.size>LIM[kind]){msgs.push(f.name+" is too large (max "+LIM[kind]/MB+" MB for "+kind+").");return}
  if(Q.some(k=>k.f.name===f.name&&k.f.size===f.size&&k.f.lastModified===f.lastModified))return;
  if(Q.length>=20){msgs.push("Up to 20 files at a time.");return}
  const it={f,kind,state:"ready",id:""};Q.push(it);$("auQ").appendChild(mkRow(it))});
 $("auNote").textContent=msgs.slice(0,3).join(" ");sync()}
function fail(it,msg){
 it.state="err";it.ti.disabled=false;it.x.hidden=false;it.set("bad",msg);it.bar(0);
 if(it.id){const id=it.id;it.id="";try{api.arc_delete({id}).catch(()=>{})}catch(e){}}}
/* raw PUT of the selected file to R2: the bytes are sent exactly as they are on the device, so EXIF / ID3 / XMP and every other tag survive */
function putFile(url,f,mime,prog){
 return new Promise(res=>{
  const x=new XMLHttpRequest();x.open("PUT",url);if(mime)x.setRequestHeader("Content-Type",mime);
  x.upload.onprogress=e=>{if(e.lengthComputable)prog(e.loaded*100/e.total)};
  x.onload=()=>res(x.status>=200&&x.status<300?{ok:1}:{ok:0,msg:"Storage refused the upload ("+x.status+")."});
  x.onerror=()=>res({ok:0,msg:"Upload blocked. Check your connection. If it keeps failing, the R2 bucket's CORS rule must allow PUT from this app's address."});
  x.send(f)})}
async function one(it){
 const title=it.ti.value.trim();
 if(!title){it.set("bad","Give it a title.");return}
 it.state="up";it.ti.disabled=true;it.x.hidden=true;it.set("","Preparing…");it.bar(0);
 let r;try{r=await api.arc_init({title,filename:it.f.name,mime:it.f.type||"",size:it.f.size})}catch(e){r=null}
 if(!r||!r.ok||!r.uploadUrl){fail(it,(r&&r.error)||"Could not start the upload.");return}
 it.id=r.id;
 const p=await putFile(r.uploadUrl,it.f,r.mime,v=>{it.bar(v);it.set("",Math.round(v)+"%")});
 if(!p.ok){fail(it,p.msg);return}
 it.set("","Verifying…");
 let c;try{c=await api.arc_commit({id:r.id})}catch(e){c=null}
 if(!c||!c.ok){it.id="";fail(it,(c&&c.error)||"Could not finish the upload.");return}
 it.state="done";it.id="";it.bar(100);it.set("ok","Uploaded. Original file and metadata stored unchanged.")}
async function uploadAll(){
 if(uploading||!OK)return;uploading=true;sync();$("auNote").textContent="";
 for(const it of Q.slice()){if(it.state==="done")continue;await one(it)}
 uploading=false;sync();hap("medium");ITEMS=[];loadedAt=0;loadList();
 if(Q.every(k=>k.state==="done"))toast("Upload complete")}
$("auGo").onclick=uploadAll;
const pick=$("auFile");
pick.onchange=e=>{addFiles(e.target.files);pick.value=""};
$("auDrop").addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();pick.click()}});
["dragover","dragenter"].forEach(t=>$("auDrop").addEventListener(t,e=>{e.preventDefault();$("auDrop").classList.add("on")}));
["dragleave","drop"].forEach(t=>$("auDrop").addEventListener(t,e=>{e.preventDefault();$("auDrop").classList.remove("on")}));
$("auDrop").addEventListener("drop",e=>{if(e.dataTransfer&&e.dataTransfer.files)addFiles(e.dataTransfer.files)});

/* what is already in the archive, with delete */
function drawList(){
 const box=$("auList");box.textContent="";$("auCount").textContent=AL.length?"("+AL.length+")":"";
 if(!AL.length){box.appendChild(h("p","note","Nothing uploaded yet."));return}
 AL.forEach(x=>{
  const d=h("div","nsitem"),w=document.createElement("div"),b=h("b",null,x.title),s=h("small",null,x.kind+" · "+fmtSize(x.size)+" · "+fmtDate(x.created_at));
  w.append(b,s);const del=h("button","btn","Delete");del.type="button";
  del.onclick=async()=>{
   if(!del.dataset.arm){del.dataset.arm="1";del.textContent="Tap again";clearTimeout(del._t);del._t=setTimeout(()=>{del.dataset.arm="";del.textContent="Delete"},4000);return}
   clearTimeout(del._t);del.disabled=true;let r;try{r=await api.arc_delete({id:x.id})}catch(e){r=null}
   if(r&&r.ok){AL=AL.filter(k=>k.id!==x.id);ITEMS=ITEMS.filter(k=>k.id!==x.id);drawList();hap("medium")}
   else{del.disabled=false;del.dataset.arm="";del.textContent="Failed. Retry"}};
  d.append(w,del);box.appendChild(d)})}
async function loadList(){
 let r;try{r=await api.arc_list()}catch(e){r=null}
 if(!r||!r.ok){$("auList").replaceChildren(h("p","note",(r&&r.error)||"Could not load the archive."));return}
 AL=Array.isArray(r.items)?r.items:[];drawList()}

/* sidebar entry (Founder section, owner only) opens the view through a hidden proxy so the normal view switch runs */
const mu=$("marcup");if(mu)mu.onclick=()=>{if(document.body.classList.contains("owner")){const g=$("arcGoUp");if(g)g.click()}};
if(V.tools){V.tools.hooks.archive={enter:load,leave(){stopVideo();stopAudio();closeLb()}};V.tools.hooks.arcup={enter,leave}}
})(window.ILLUMINATI);
}catch(e){console.error(e)}
