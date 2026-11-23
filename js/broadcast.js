try{
/* Node Broadcast: members watch the founder's broadcast video inside the portal; only the founder can upload.
   Self-contained (injects its own sidebar button, view and styles). Talks to the existing illuminati-broadcast edge function.
   Storage is Cloudflare R2: the founder uploads straight to R2 with a signed PUT, members stream through short-lived signed links.
   Playback is view-only: no native controls (so no download / share / save menu), no context menu, no picture-in-picture, no remote playback,
   no drag, and a moving member watermark. A browser can never be made 100% un-recordable; this removes every normal way to save the file. */
(function(V){
/* ---- the only place to change if your edge function uses different action names ---- */
const FN="illuminati-broadcast";
const ACT={list:"list",stream:"watch",owner:"owner_check",init:"upload_init",commit:"upload_commit",del:"delete"};
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

const ICON="data:image/png;base64,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";
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
.nb-stage:fullscreen,.nb-stage:-webkit-full-screen{aspect-ratio:auto;width:100vw;height:100vh;height:100dvh}
.nb-stage.nb-pfs{position:fixed;left:0;top:0;z-index:2147483000;aspect-ratio:auto;border-radius:0;transform-origin:0 0}
.nb-err{position:absolute;left:0;right:0;top:42%;z-index:3;text-align:center;font-size:13px;color:#ff8a8a;padding:0 16px;pointer-events:none}
html.nb-lock,html.nb-lock body{overflow:hidden!important}
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
 const btn='<button class="nbbtn" data-go="nodebroadcast" aria-pressed="false"><span class="mi"><img src="'+ICON+'" alt="" style="width:30px;height:auto"></span>Node Broadcast</button>';
 const nz=cats.querySelector("button.nzbtn"),first=cats.querySelector('button[data-go="done"]');
 if(nz)nz.insertAdjacentHTML("afterend",btn);else if(first)first.insertAdjacentHTML("beforebegin",btn);else cats.insertAdjacentHTML("afterbegin",btn);
 main.insertAdjacentHTML("beforeend",
 '<section class="view" data-view="nodebroadcast"><div class="glass sheet">'+
 '<div class="fhead"><div class="frow"><button class="fback" type="button" data-go="done" aria-label="Back to profile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg><span>Back</span></button><h2>Node Broadcast</h2></div></div>'+
 '<div class="mi-gate" id="nbGate" role="status" aria-live="polite"><div class="mi-sp"></div><p>Loading Node Broadcast</p></div>'+
 '<div id="nbApp" hidden>'+
 '<p class="gl-p mi-lead">Official broadcasts from the Backroom Server. Videos are view-only and play only inside this portal.</p>'+
 '<div id="nbList" aria-live="polite"></div><p class="note" id="nbNote" role="status"></p>'+
 '<div id="nbUp" class="nb-up" hidden><p class="eyebrow" style="margin-top:24px">Upload broadcast</p>'+
 '<label class="mi-drop" id="nbDrop" tabindex="0"><input id="nbFile" type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm" hidden><i>+</i><b>Select broadcast video</b><span>mp4, m4v, mov, webm &middot; up to '+(MAXMB/1024)+' GB</span></label>'+
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
  try{if(isFS())exitFS()}catch(e){}
  clearInterval(wmT);wmT=0;
  if(vid){try{vid.pause();vid.removeAttribute("src");vid.load()}catch(e){}vid=null}
  document.querySelectorAll("#nbList .nb-stage video").forEach(v=>{try{v.pause();v.removeAttribute("src");v.load()}catch(e){}})}

 /* ---------- fullscreen: real Fullscreen API where it exists, otherwise a landscape pseudo-fullscreen (iPhone has no element fullscreen) ---------- */
 const TGW=()=>window.Telegram&&Telegram.WebApp;
 let fsStage=null,fsHome=null,fsMode="",fsWasPlaying=false;
 const nativeFS=()=>document.fullscreenElement||document.webkitFullscreenElement;
 const isFS=()=>!!(nativeFS()||fsMode==="pseudo");
 function fitPseudo(){
  if(!fsStage||fsMode!=="pseudo")return;
  const W=window.innerWidth,H=window.innerHeight,s=fsStage.style;
  if(H>W){s.width=H+"px";s.height=W+"px";s.transform="translateX("+W+"px) rotate(90deg)"}  /* portrait phone: turn the picture sideways */
  else{s.width=W+"px";s.height=H+"px";s.transform="none"}}
 function lockLandscape(){
  try{const o=screen.orientation;if(o&&o.lock)o.lock("landscape").catch(()=>{})}catch(e){}
  try{const t=TGW();if(t&&t.lockOrientation&&t.isVersionAtLeast&&t.isVersionAtLeast("8.0"))t.lockOrientation()}catch(e){}}
 function unlockOrientation(){
  try{const o=screen.orientation;if(o&&o.unlock)o.unlock()}catch(e){}
  try{const t=TGW();if(t&&t.unlockOrientation&&t.isVersionAtLeast&&t.isVersionAtLeast("8.0"))t.unlockOrientation()}catch(e){}}
 function tgFull(on){
  try{const t=TGW();if(!t||!t.isVersionAtLeast||!t.isVersionAtLeast("8.0"))return;
   if(on&&t.requestFullscreen&&!t.isFullscreen)t.requestFullscreen();
   if(!on&&t.exitFullscreen&&t.isFullscreen)t.exitFullscreen()}catch(e){}}
 function enterFS(stage,v){
  hap("light");fsStage=stage;
  const canNative=(document.fullscreenEnabled||document.webkitFullscreenEnabled)&&(stage.requestFullscreen||stage.webkitRequestFullscreen);
  const pseudo=()=>{
   if(fsMode)return;fsMode="pseudo";fsWasPlaying=!v.paused;
   fsHome=document.createComment("nb");stage.parentNode.insertBefore(fsHome,stage);
   document.body.appendChild(stage); /* out of the glass sheet so position:fixed covers the whole screen */
   stage.classList.add("nb-pfs");document.documentElement.classList.add("nb-lock");
   tgFull(true);lockLandscape();fitPseudo();
   if(fsWasPlaying)v.play().catch(()=>{})};
  if(canNative){
   let p;try{p=stage.requestFullscreen?stage.requestFullscreen({navigationUI:"hide"}):stage.webkitRequestFullscreen()}catch(e){p=Promise.reject(e)}
   Promise.resolve(p).then(()=>{fsMode="native";lockLandscape()}).catch(pseudo)}
  else pseudo()}
 function exitFS(){
  if(nativeFS()){try{(document.exitFullscreen||document.webkitExitFullscreen).call(document)}catch(e){}}
  if(fsMode==="pseudo"&&fsStage){
   const stage=fsStage,v=stage.querySelector("video"),was=v&&!v.paused;
   stage.classList.remove("nb-pfs");stage.style.width=stage.style.height=stage.style.transform="";
   if(fsHome&&fsHome.parentNode){fsHome.parentNode.insertBefore(stage,fsHome);fsHome.remove()}
   document.documentElement.classList.remove("nb-lock");
   tgFull(false);unlockOrientation();
   if(v&&was)v.play().catch(()=>{})}
  fsMode="";fsHome=null}
 const onFsChange=()=>{if(!nativeFS()&&fsMode==="native"){fsMode="";unlockOrientation()}};
 document.addEventListener("fullscreenchange",onFsChange);document.addEventListener("webkitfullscreenchange",onFsChange);
 window.addEventListener("resize",fitPseudo);window.addEventListener("orientationchange",()=>setTimeout(fitPseudo,150));
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&fsMode==="pseudo")exitFS()});
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
   const hit=h("div","nb-hit"),bar=h("div","nb-bar");
   const pp=h("button");pp.type="button";pp.innerHTML=PLAYI;pp.setAttribute("aria-label","Play or pause");
   const cur=h("span",null,"0:00"),sk=document.createElement("input");sk.type="range";sk.min=0;sk.max=1000;sk.value=0;sk.setAttribute("aria-label","Seek");
   const dur=h("span",null,"0:00"),fs=h("button");fs.type="button";fs.innerHTML=FSI;fs.setAttribute("aria-label","Fullscreen");
   bar.append(pp,cur,sk,dur,fs);
   poster.remove();stage.append(v,hit,bar);vid=v;
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
     if(!v._retry){v._retry=1;const t=v.currentTime;api.stream({id:x.id}).then(n=>{if(n&&n.ok&&n.url){v.src=n.url;v.currentTime=t;v.play().catch(()=>{})}else showErr("Could not play this video.")}).catch(()=>showErr("Could not play this video."))}else showErr("Could not play this video.")}};
   const err=h("div","nb-err");err.hidden=true;stage.appendChild(err);
   const showErr=m=>{err.textContent=m;err.hidden=!m};
   v.addEventListener("playing",()=>showErr(""));
   fs.onclick=()=>{isFS()?exitFS():enterFS(stage,v)};
   v.play().catch(()=>{});hap("medium")};
  poster.onclick=start;poster.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();start()}};
  return stage}
 function card(x){
  const c=h("div","nb-item"),b=h("div","nb-body");
  b.appendChild(h("small",null,x.size?fmtSize(x.size):""));
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
  if(!/^video\//.test(f.type)&&!/\.(mp4|mov|m4v|webm)$/i.test(f.name)){n.textContent="Please choose a video file.";return}
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
 document.addEventListener("visibilitychange",()=>{if(document.hidden&&body.dataset.view==="nodebroadcast")document.querySelectorAll(".nb-stage video").forEach(v=>{try{v.pause()}catch(e){}})});
 /* only this view: stop keyboard save/print shortcuts */
 document.addEventListener("keydown",e=>{if(body.dataset.view==="nodebroadcast"&&(e.ctrlKey||e.metaKey)&&/^[sp]$/i.test(e.key))e.preventDefault()});
 if(V.tools)V.tools.hooks.nodebroadcast={enter,leave};
}
if(document.readyState!=="loading")boot();else document.addEventListener("DOMContentLoaded",boot);
})(window.ILLUMINATI);
}catch(e){console.error(e)}
