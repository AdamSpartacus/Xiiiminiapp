try{
/* Node Broadcast: members watch the founder's broadcast video inside the portal; only the founder can upload.
   Self-contained (injects its own sidebar button, view and styles). Talks to the existing illuminati-broadcast edge function.
   Storage is Cloudflare R2: the founder uploads straight to R2 with a signed PUT, members stream through short-lived signed links.
   Playback is view-only: no native controls (so no download / share / save menu), no context menu, no picture-in-picture, no remote playback,
   no drag, and a moving member watermark. A browser can never be made 100% un-recordable; this removes every normal way to save the file. */
(function(V){
/* ---- the only place to change if your edge function uses different action names ---- */
const FN="illuminati-broadcast";
const ACT={list:"list",stream:"stream",owner:"owner_check",init:"upload_init",commit:"upload_commit",del:"delete"};
const MAXMB=1024;
const S=V.config&&V.config.supabase;
const call=a=>async d=>{
 if(!S||!S.url)return{ok:false,error:"Node Broadcast needs the live backend."};
 const ac=typeof AbortController==="function"?new AbortController():null,tm=ac?setTimeout(()=>ac.abort(),20000):0;
 try{
  const r=await fetch(S.url+"/functions/v1/"+FN+"?forceFunctionRegion=ap-south-1",{method:"POST",...(ac?{signal:ac.signal}:{}),
   headers:{"Content-Type":"application/json",apikey:S.anonKey,...(String(S.anonKey).startsWith("eyJ")?{Authorization:"Bearer "+S.anonKey}:{})},
   body:JSON.stringify({action:a,initData:V.tg.initData,data:d})});
  const j=await r.json();
  try{if(j&&j.status==="locked"&&V.onlock)V.onlock(j)}catch(e){}
  return j}
 catch(e){return{ok:false,error:"Network error. Try again."}}
 finally{clearTimeout(tm)}};
const api={list:call(ACT.list),stream:call(ACT.stream),owner:call(ACT.owner),init:call(ACT.init),commit:call(ACT.commit),del:call(ACT.del)};

const LOGO="data:image/webp;base64,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";
const TOWER='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3L3.5 20h17z"/><path d="M12 9.5l-2.6 10.5M12 9.5l2.6 10.5M10.2 16h3.6"/><circle cx="12" cy="8" r="1.1"/><path d="M6.5 6.5a7 7 0 0 0 0 5M17.5 6.5a7 7 0 0 1 0 5"/></svg>';
const LOCK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>';
const PLAYI='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>';
const PAUSEI='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>';
const FSI='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';

const CSS=`
/* Node Broadcast. Every class is prefixed nb so nothing else is touched. */
body[data-view=nodebroadcast] #cats button[data-go]{display:flex!important}
body[data-view=nodebroadcast] #cats .msub{display:flex}
body.ready[data-view=nodebroadcast] #menubtn{display:flex}
html body:not(.member):not(.owner) #cats button.nbbtn{display:none!important}
#cats button.nbbtn svg{width:22px;height:22px;flex:none;display:block}
.view[data-view=nodebroadcast] [hidden]{display:none!important}
.view[data-view=nodebroadcast] .sheet{max-height:calc(100% - var(--sat) - 64px)}
@media (min-width:700px){.view[data-view=nodebroadcast] .sheet{max-height:calc(100% - 24px)}}
.nb-logo{display:block;width:150px;max-width:50%;margin:14px auto 4px;border-radius:14px;pointer-events:none;-webkit-user-drag:none;user-select:none}
.nb-item{margin:14px 0 0;border:1px solid var(--line);border-radius:16px;overflow:hidden;background:rgba(0,0,0,.35)}
.nb-body{padding:12px 14px 14px}.nb-body b{display:block;font-size:15px;overflow-wrap:anywhere}.nb-body small{color:var(--dim);font-size:12px}
.nb-stage{position:relative;background:#000;aspect-ratio:16/9;overflow:hidden;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;touch-action:manipulation}
.nb-stage:fullscreen{aspect-ratio:auto;width:100vw;height:100vh}
.nb-stage video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000;-webkit-touch-callout:none;pointer-events:none}
.nb-poster{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:#050506;cursor:pointer;color:var(--text);font-size:13px}
.nb-poster .nb-pb{width:58px;height:58px;border-radius:50%;border:1px solid rgba(255,255,255,.35);display:flex;align-items:center;justify-content:center}
.nb-poster svg{width:26px;height:26px}
.nb-hit{position:absolute;inset:0;z-index:2}
.nb-wm{position:absolute;z-index:3;left:6%;top:10%;font:600 11px/1 system-ui,-apple-system,sans-serif;letter-spacing:.08em;color:rgba(255,255,255,.22);pointer-events:none;white-space:nowrap;text-shadow:0 0 2px rgba(0,0,0,.6);transition:left 1.2s linear,top 1.2s linear}
.nb-bar{position:absolute;left:0;right:0;bottom:0;z-index:4;display:flex;align-items:center;gap:10px;padding:8px 12px calc(8px + env(safe-area-inset-bottom,0px));background:linear-gradient(transparent,rgba(0,0,0,.78));color:#fff}
.nb-bar button{background:none;border:0;color:#fff;padding:4px;display:flex;cursor:pointer}
.nb-bar button svg{width:22px;height:22px}
.nb-bar input[type=range]{flex:1;min-width:0;accent-color:#dfe3ea;height:22px}
.nb-bar span{font:600 11px/1 system-ui,sans-serif;font-variant-numeric:tabular-nums;color:#dfe3ea;white-space:nowrap}
.nb-up .ar-q{margin-top:10px}
.nb-q{margin:10px 0 0;padding:12px;border:1px solid var(--line);border-radius:14px;background:rgba(0,0,0,.3)}
.nb-q small{color:var(--dim)}
.nb-q input[type=text]{width:100%;margin:8px 0;box-sizing:border-box}
.nb-prog{height:4px;border-radius:2px;background:rgba(255,255,255,.12);overflow:hidden}.nb-prog i{display:block;height:100%;width:0;background:#dfe3ea}
.nb-st{margin-top:6px;font-size:12px;color:var(--dim)}.nb-st.bad{color:#ff8a8a}.nb-st.ok{color:#8fe3a6}
.nb-row{display:flex;gap:10px;align-items:center;justify-content:space-between;margin-top:10px}
`;

function inject(){
 if(document.getElementById("nbGate"))return;
 const cats=document.getElementById("cats"),main=document.getElementById("views")||document.querySelector("main");
 if(!cats||!main)return;
 const st=document.createElement("style");st.textContent=CSS;document.body.appendChild(st);
 const btn='<button class="nbbtn" data-go="nodebroadcast" aria-pressed="false"><span class="mi">'+TOWER+'</span>Node Broadcast</button>';
 const nz=cats.querySelector("button.nzbtn"),first=cats.querySelector('button[data-go="done"]');
 if(nz)nz.insertAdjacentHTML("afterend",btn);else if(first)first.insertAdjacentHTML("beforebegin",btn);else cats.insertAdjacentHTML("afterbegin",btn);
 main.insertAdjacentHTML("beforeend",
 '<section class="view" data-view="nodebroadcast"><div class="glass sheet">'+
 '<div class="fhead"><div class="frow"><button class="fback" type="button" data-go="done" aria-label="Back to profile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg><span>Back</span></button><h2>Node Broadcast</h2></div></div>'+
 '<img class="nb-logo" src="'+LOGO+'" alt="Node Broadcast" draggable="false">'+
 '<div class="mi-gate" id="nbGate" role="status" aria-live="polite"><div class="mi-sp"></div><p>Loading Node Broadcast</p></div>'+
 '<div id="nbApp" hidden>'+
 '<p class="gl-p mi-lead">Official broadcasts from the founder. Videos are view-only and play only inside this portal.</p>'+
 '<div id="nbList" aria-live="polite"></div><p class="note" id="nbNote" role="status"></p>'+
 '<div id="nbUp" class="nb-up" hidden><p class="eyebrow" style="margin-top:24px">Founder upload</p>'+
 '<label class="mi-drop" id="nbDrop" tabindex="0"><input id="nbFile" type="file" accept="video/*,.mp4,.mov,.m4v,.webm,.mkv" hidden><i>+</i><b>Select broadcast video</b><span>mp4, mov, webm &middot; up to '+(MAXMB/1024)+' GB</span></label>'+
 '<div id="nbQ"></div><button class="btn solid" id="nbGo" type="button" hidden>Upload</button><p class="note" id="nbUNote" role="status"></p></div>'+
 '</div></div></section>')}

function boot(){
 inject();
 const $=id=>document.getElementById(id),body=document.body;
 if(!$("nbGate"))return;
 const MB=1048576;
 const h=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
 const fmtSize=n=>n>=MB*1024?(n/MB/1024).toFixed(1)+" GB":n>=MB?(n/MB).toFixed(1)+" MB":Math.max(1,Math.round(n/1024))+" KB";
 const fmtDate=s=>{try{return new Date(s).toLocaleDateString()}catch(e){return""}};
 const fmtT=s=>{s=Math.max(0,Math.floor(s||0));return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")};
 const hap=t=>{try{V.tg.haptic(t||"light")}catch(e){}};
 const who=()=>{const u=V.tg&&V.tg.user;return u?(u.username?"@"+u.username:"ID "+u.id):"Member"};
 let ITEMS=[],vid=null,wmT=0,loadedAt=0,busy=false;

 /* ---------- view-only player ---------- */
 function stopVideo(){
  clearInterval(wmT);wmT=0;
  if(vid){try{vid.pause();vid.removeAttribute("src");vid.load()}catch(e){}vid=null}
  document.querySelectorAll("#nbList .nb-stage video").forEach(v=>{try{v.pause();v.removeAttribute("src");v.load()}catch(e){}})}
 function player(x){
  const stage=h("div","nb-stage"),poster=h("div","nb-poster"),pb=h("span","nb-pb"),lbl=h("span",null,"Tap to watch");
  pb.innerHTML=PLAYI;poster.append(pb,lbl);poster.setAttribute("role","button");poster.tabIndex=0;stage.appendChild(poster);
  const block=e=>{e.preventDefault();e.stopPropagation();return false};
  ["contextmenu","dragstart","selectstart","copy","cut"].forEach(t=>stage.addEventListener(t,block));
  let started=false;
  const start=async()=>{
   if(started)return;started=true;lbl.textContent="Loading…";
   let r;try{r=await api.stream({id:x.id})}catch(e){r=null}
   if(!r||!r.ok||!r.url||!/^https:\/\//i.test(r.url)){started=false;lbl.textContent=(r&&r.error)||"Could not load the video.";return}
   stopVideo();
   const v=document.createElement("video");
   v.playsInline=true;v.setAttribute("playsinline","");v.setAttribute("webkit-playsinline","");
   v.controls=false;v.removeAttribute("controls");
   v.setAttribute("controlsList","nodownload noplaybackrate noremoteplayback");
   v.setAttribute("disablePictureInPicture","");v.disablePictureInPicture=true;v.disableRemotePlayback=true;
   v.setAttribute("disableRemotePlayback","");v.preload="auto";v.draggable=false;
   v.addEventListener("contextmenu",block);v.addEventListener("enterpictureinpicture",()=>{try{document.exitPictureInPicture()}catch(e){}});
   v.src=r.url;
   const hit=h("div","nb-hit"),wm=h("div","nb-wm",who()+" · Node Broadcast"),bar=h("div","nb-bar");
   const pp=h("button");pp.type="button";pp.innerHTML=PLAYI;pp.setAttribute("aria-label","Play or pause");
   const cur=h("span",null,"0:00"),sk=document.createElement("input");sk.type="range";sk.min=0;sk.max=1000;sk.value=0;sk.setAttribute("aria-label","Seek");
   const dur=h("span",null,"0:00"),fs=h("button");fs.type="button";fs.innerHTML=FSI;fs.setAttribute("aria-label","Fullscreen");
   bar.append(pp,cur,sk,dur,fs);
   poster.remove();stage.append(v,hit,wm,bar);vid=v;
   const toggle=()=>{v.paused?v.play().catch(()=>{}):v.pause()};
   pp.onclick=toggle;hit.onclick=toggle;
   v.onplay=()=>{pp.innerHTML=PAUSEI};v.onpause=()=>{pp.innerHTML=PLAYI};
   v.onloadedmetadata=()=>{dur.textContent=fmtT(v.duration)};
   let drag=false;
   v.ontimeupdate=()=>{cur.textContent=fmtT(v.currentTime);if(!drag&&v.duration)sk.value=Math.round(v.currentTime/v.duration*1000)};
   sk.oninput=()=>{drag=true;if(v.duration)v.currentTime=sk.value/1000*v.duration};
   sk.onchange=()=>{drag=false};
   v.onended=()=>{pp.innerHTML=PLAYI};
   v.onerror=()=>{if(Date.now()-loadedAt>0){/* signed link expired or format unsupported: ask for a fresh link once */
     if(!v._retry){v._retry=1;const t=v.currentTime;api.stream({id:x.id}).then(n=>{if(n&&n.ok&&n.url){v.src=n.url;v.currentTime=t;v.play().catch(()=>{})}else lbl.textContent="Could not play this video."}).catch(()=>{})}}};
   fs.onclick=()=>{
    try{if(document.fullscreenElement){document.exitFullscreen();return}
     if(stage.requestFullscreen){stage.requestFullscreen();return}
     if(stage.webkitRequestFullscreen){stage.webkitRequestFullscreen();return}
     if(v.webkitEnterFullscreen)v.webkitEnterFullscreen()}catch(e){}};
   wmT=setInterval(()=>{wm.style.left=(4+Math.random()*52)+"%";wm.style.top=(8+Math.random()*78)+"%"},4000);
   v.play().catch(()=>{});hap("medium")};
  poster.onclick=start;poster.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();start()}};
  return stage}
 function card(x){
  const c=h("div","nb-item"),b=h("div","nb-body");
  b.appendChild(h("b",null,x.title||"Broadcast"));b.appendChild(h("small",null,[x.size?fmtSize(x.size):"",x.created_at?fmtDate(x.created_at):""].filter(Boolean).join(" · ")));
  c.append(player(x),b);return c}
 function draw(){
  stopVideo();const box=$("nbList");box.textContent="";
  if(!ITEMS.length){box.appendChild(h("p","note","No broadcast yet."));return}
  ITEMS.forEach(x=>box.appendChild(card(x)))}
 async function load(){
  if(busy)return;busy=true;$("nbNote").textContent="";
  if(!ITEMS.length)$("nbList").replaceChildren(h("p","note","Loading…"));
  let r;try{r=await api.list()}catch(e){r=null}
  busy=false;
  if(!r||!r.ok){if(r&&r.status==="locked")return;$("nbList").textContent="";$("nbNote").textContent=(r&&r.error)||"Could not load Node Broadcast.";return}
  ITEMS=Array.isArray(r.items)?r.items:[];loadedAt=Date.now();draw()}

 /* ---------- founder upload ---------- */
 let OK=false,Q=null,uploading=false;
 async function verifyOwner(){
  if(!body.classList.contains("owner"))return false;
  let r;try{r=await api.owner()}catch(e){r=null}
  return !!(r&&r.ok)}
 function putFile(url,f,mime,prog){
  return new Promise(res=>{
   const x=new XMLHttpRequest();x.open("PUT",url);if(mime)x.setRequestHeader("Content-Type",mime);
   x.upload.onprogress=e=>{if(e.lengthComputable)prog(e.loaded*100/e.total)};
   x.onload=()=>res(x.status>=200&&x.status<300?{ok:1}:{ok:0,msg:"Storage refused the upload ("+x.status+")."});
   x.onerror=()=>res({ok:0,msg:"Upload blocked. Check the R2 bucket CORS policy (PUT) and the R2_ACCOUNT_ID secret."});
   x.send(f)})}
 function syncGo(){const g=$("nbGo");g.hidden=!Q||Q.state==="done";g.disabled=uploading;g.textContent=uploading?"Uploading…":"Upload broadcast"}
 function setFile(f){
  const n=$("nbUNote");n.textContent="";
  if(!f)return;
  if(!f.size){n.textContent="That file is empty.";return}
  if(f.size>MAXMB*MB){n.textContent="That file is too large (max "+MAXMB/1024+" GB).";return}
  if(!/^video\//.test(f.type)&&!/\.(mp4|mov|m4v|webm|mkv)$/i.test(f.name)){n.textContent="Please choose a video file.";return}
  const el=h("div","nb-q"),nm=h("b",null,f.name),sm=h("small",null,fmtSize(f.size)),ti=document.createElement("input");
  ti.type="text";ti.maxLength=120;ti.placeholder="Title";ti.value=f.name.replace(/\.[^.]+$/,"").slice(0,120);ti.autocomplete="off";
  const bar=h("div","nb-prog"),fill=document.createElement("i");bar.appendChild(fill);const st=h("div","nb-st");
  el.append(nm,sm,ti,bar,st);$("nbQ").replaceChildren(el);
  Q={f,ti,state:"ready",bar:p=>{fill.style.width=Math.max(0,Math.min(100,p))+"%"},set:(c,m)=>{st.className="nb-st"+(c?" "+c:"");st.textContent=m||""}};syncGo()}
 async function uploadOne(){
  if(!Q||uploading||!OK)return;
  const it=Q,title=it.ti.value.trim();if(!title){it.set("bad","Give it a title.");return}
  uploading=true;it.ti.disabled=true;syncGo();it.set("","Preparing…");it.bar(0);
  const bad=m=>{it.set("bad",m);it.ti.disabled=false;it.bar(0);uploading=false;syncGo()};
  let r;try{r=await api.init({title,filename:it.f.name,mime:it.f.type||"video/mp4",size:it.f.size})}catch(e){r=null}
  if(!r||!r.ok||!r.uploadUrl){bad((r&&r.error)||"Could not start the upload.");return}
  const p=await putFile(r.uploadUrl,it.f,r.mime||it.f.type||"video/mp4",v=>{it.bar(v);it.set("",Math.round(v)+"%")});
  if(!p.ok){try{api.del({id:r.id}).catch(()=>{})}catch(e){}bad(p.msg);return}
  it.set("","Verifying…");
  let c;try{c=await api.commit({id:r.id})}catch(e){c=null}
  if(!c||!c.ok){try{api.del({id:r.id}).catch(()=>{})}catch(e){}bad((c&&c.error)||"Could not finish the upload.");return}
  it.state="done";uploading=false;it.bar(100);it.set("ok","Uploaded. Members can watch it now.");syncGo();hap("medium");
  Q=null;$("nbFile").value="";ITEMS=[];loadedAt=0;await load();founderList()}
 function founderList(){
  /* founder sees a delete button under each broadcast */
  document.querySelectorAll("#nbList .nb-item").forEach((c,i)=>{
   const x=ITEMS[i];if(!x||c.querySelector(".nb-del"))return;
   const row=h("div","nb-row"),del=h("button","btn nb-del","Delete");del.type="button";
   del.onclick=async()=>{
    if(!del.dataset.arm){del.dataset.arm="1";del.textContent="Tap again";clearTimeout(del._t);del._t=setTimeout(()=>{del.dataset.arm="";del.textContent="Delete"},4000);return}
    clearTimeout(del._t);del.disabled=true;let r;try{r=await api.del({id:x.id})}catch(e){r=null}
    if(r&&r.ok){ITEMS=ITEMS.filter(k=>k.id!==x.id);draw();founderList();hap("medium")}
    else{del.disabled=false;del.dataset.arm="";del.textContent="Failed. Retry"}};
   row.appendChild(del);c.querySelector(".nb-body").appendChild(row)})}
 $("nbFile").onchange=e=>setFile(e.target.files&&e.target.files[0]);
 $("nbDrop").addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();$("nbFile").click()}});
 $("nbGo").onclick=uploadOne;

 async function enter(){
  $("nbGate").hidden=false;$("nbApp").hidden=true;$("nbUp").hidden=true;
  await load();
  $("nbGate").hidden=true;$("nbApp").hidden=false;
  if(body.classList.contains("owner")){
   OK=await verifyOwner();
   $("nbUp").hidden=!OK;
   if(OK)founderList()}}
 function leave(){stopVideo();OK=false;Q=null;$("nbQ").textContent="";$("nbUp").hidden=true;$("nbGate").hidden=false;$("nbApp").hidden=true}
 /* a signed link lasts a few minutes: nothing is kept on the page when it is hidden */
 document.addEventListener("visibilitychange",()=>{if(document.hidden&&body.dataset.view==="nodebroadcast")document.querySelectorAll("#nbList video").forEach(v=>{try{v.pause()}catch(e){}})});
 /* only this view: stop keyboard save/print shortcuts */
 document.addEventListener("keydown",e=>{if(body.dataset.view==="nodebroadcast"&&(e.ctrlKey||e.metaKey)&&/^[sp]$/i.test(e.key))e.preventDefault()});
 if(V.tools)V.tools.hooks.nodebroadcast={enter,leave};
}
if(document.readyState!=="loading")boot();else document.addEventListener("DOMContentLoaded",boot);
})(window.ILLUMINATI);
}catch(e){console.error(e)}
