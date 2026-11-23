try{
/* Red Cards.
   The founder chooses up to 5 members as red cards (founder-only "Red cards" tab in the sidebar Founder section).
   While you are inside any multiplayer place (Node Sync, Spore or a Conclave batch) this file pings the backend
   (edge function illuminati-redcard) with the room you are in. When a red card member is in that same room the
   whole portal turns dark red and a "Red Card Joined" notice appears. Outside multiplayer nothing happens.
   Who is a red card, and who is in a room, is decided by the backend only; this file just shows it. */
(function(V){
const api=V.services.api,$=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const hap=k=>{try{V.tg.haptic(k||"light")}catch(e){}};
const LIMIT=5,POLL=7000,FRESH=20000,MISS=3;
const body=document.body;

/* ---------------- red palette + notice ---------------- */
/* While a red card is in your room, <html> gets the class rc-red (the dark red palette lives in the #rcRedPalette style in index.html).
   The Conclave game runs inside its own frame, so the same colour variables are injected there. Removing everything restores the normal palette. */
let note=null,noteT=0;
const HEAD_ON="#0c0205",HEAD_OFF="#000000";
const FRAME_CSS=':root{--text:#f4e6e8;--fg:#f4e6e8;--mute:#d8b4b9;--mut:#d8b4b9;--dim:#ee4455;--line:rgba(255,52,72,.34);--accent:#ff4d5e;--gold:#ff4d5e;--gold2:rgba(255,70,90,.5);--panel:rgba(255,30,50,.05);--tile:rgba(255,30,50,.11);--tile2:rgba(255,30,50,.03);--glass:linear-gradient(145deg,rgba(255,30,50,.14),rgba(110,0,14,.05));--bgfx:radial-gradient(640px 460px at 82% -4%,rgba(150,0,20,.5),transparent 70%),radial-gradient(800px 480px at 50% -12%,#2a0309,#000 62%)}';
function frame(on){
 try{const f=document.getElementById("clvFrame");if(f&&f.contentWindow)f.contentWindow.postMessage({clv:"theme",css:on?FRAME_CSS:""},"*")}catch(e){}}
window.addEventListener("message",ev=>{const f=document.getElementById("clvFrame");if(!f||ev.source!==f.contentWindow)return;const m=ev.data;if(m&&m.clv==="red"&&m.op==="ready")frame(!!lit)});
function mount(){
 if(note)return;
 note=document.createElement("div");note.id="rcNote";note.setAttribute("role","status");note.setAttribute("aria-live","assertive");
 body.appendChild(note)}
let lit=null;
/* Only touches the page when the state actually changes, so repeated pings can never make it blink. */
function setGlow(on){mount();on=!!on;
 if(lit!==on){lit=on;document.documentElement.classList.toggle("rc-red",on);
  try{const a=V.tg.app;if(a){a.setHeaderColor&&a.setHeaderColor(on?HEAD_ON:HEAD_OFF);a.setBackgroundColor&&a.setBackgroundColor(on?HEAD_ON:HEAD_OFF);a.setBottomBarColor&&a.setBottomBarColor(on?HEAD_ON:HEAD_OFF)}}catch(e){}}
 frame(on)}
function announce(){
 mount();note.textContent="Red Card Joined";note.classList.remove("on");void note.offsetWidth;note.classList.add("on");
 clearTimeout(noteT);noteT=setTimeout(()=>note.classList.remove("on"),3200);hap("heavy")}

/* ---------------- which multiplayer room am I in ---------------- */
let room=null,cnt=0,miss=0,timer=0,busy=false;
const key=r=>r.kind+":"+r.batch;
function seen(kind,batch){
 const r={kind,batch:String(batch).slice(0,60),t:Date.now()};
 if(!room||key(room)!==key(r)){room=r;cnt=0;miss=0;setGlow(false);ping()}else room.t=r.t;
 if(!timer)timer=setInterval(tick,POLL)}
function clear(){room=null;cnt=0;miss=0;setGlow(false);clearInterval(timer);timer=0}
function tick(){
 if(!room)return;
 if(Date.now()-room.t>FRESH){clear();return}
 if(!document.hidden)ping()}
async function ping(){
 if(!room||busy||!api.redcard_ping)return;busy=true;const r0=room;let r;
 try{r=await api.redcard_ping({kind:r0.kind,batch:r0.batch})}catch(e){r=null}busy=false;
 if(!room||key(room)!==key(r0)||!r||!r.ok)return;
 const n=Math.max(0,Math.min(99,+r.red||0));
 /* Going up is instant. Going down only counts after MISS answers in a row, so one late heartbeat from the red card can't flash the portal black. */
 if(n>=cnt){miss=0;if(n>cnt)announce();cnt=n}else if(++miss>=MISS){cnt=n;miss=0}
 setGlow(cnt>0)}
V.red={room:(kind,batch)=>{batch?seen(kind,batch):clear()},clear};

/* Node Sync and Spore: learn the room from the calls those screens already make. */
[["sync_ping","sync"],["rec_sync_ping","sync"],["spore_state","spore"]].forEach(([name,kind])=>{
 const f=api[name];if(typeof f!=="function")return;
 api[name]=function(d){try{if(d&&d.batch)seen(kind,d.batch)}catch(e){}return f.apply(this,arguments)}});
["sync_leave","rec_sync_leave","spore_leave"].forEach(name=>{
 const f=api[name];if(typeof f!=="function")return;
 api[name]=function(){try{clear()}catch(e){}return f.apply(this,arguments)}});
/* ---------------- founder page: choose the red cards (own tab, founder only) ---------------- */
let FM=[],SEL=new Set(),loaded=false,wired=false;
const gate=h=>{const g=$("rcGate");g.hidden=false;g.innerHTML=h;$("rcApp").hidden=true};
const LOCK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
const nm=m=>m.username?"@"+m.username:(m.name||"Member");
const fname=id=>{const m=FM.find(x=>x.uid===id);return m?nm(m):"Former member"};
function wire(){
 if(wired)return;wired=true;
 $("rcQ").oninput=draw;
 $("rcChips").onclick=e=>{const b=e.target.closest("[data-rx]");if(!b)return;SEL.delete(b.dataset.rx);hap("light");draw()};
 $("rcList").onclick=e=>{const b=e.target.closest("[data-ra]");if(!b||b.disabled)return;const id=b.dataset.ra;if(SEL.has(id))SEL.delete(id);else if(SEL.size<LIMIT)SEL.add(id);hap("light");draw()};
 $("rcSave").onclick=save}
function draw(){
 const q=$("rcQ").value.trim().toLowerCase(),full=SEL.size>=LIMIT;
 $("rcCount").textContent=SEL.size+" of "+LIMIT+" selected";
 $("rcChips").innerHTML=SEL.size?[...SEL].map(id=>'<button type="button" class="lchip" data-rx="'+esc(id)+'" aria-label="Remove '+esc(fname(id))+'">'+esc(fname(id))+' \u00d7</button>').join(""):'<p class="note" style="margin:0;text-align:left">No red cards yet.</p>';
 $("rcList").innerHTML=FM.filter(m=>!q||[m.username,m.name].join(" ").toLowerCase().includes(q)).slice(0,60).map(m=>{
  const on=SEL.has(m.uid);
  return '<div class="lrow"><div class="lwho"><b>'+esc(nm(m))+'</b><small>'+esc(m.name||"")+'</small></div><button type="button" class="lbt'+(on?" on":"")+'" data-ra="'+esc(m.uid)+'"'+(!on&&full?' disabled style="opacity:.4"':"")+'>'+(on?"Red card":"Add")+'</button></div>'}).join("")||'<p class="note">No members found.</p>'}
async function enter(){
 wire();
 if(!body.classList.contains("owner")){gate('<div class="mi-gi">'+LOCK+'</div><h3>Founders only</h3><p>This section is only available to the founder.</p>');return}
 gate('<div class="mi-sp"></div><p>Verifying founder access</p>');let a,b;
 try{[a,b]=await Promise.all([api.vote_founder_get(),api.redcard_get()])}catch(e){a=b=null}
 if(a&&a.ok&&b&&b.ok){FM=Array.isArray(a.members)?a.members:[];SEL=new Set((Array.isArray(b.cards)?b.cards:[]).map(String).slice(0,LIMIT));loaded=true;
  $("rcGate").hidden=true;$("rcApp").hidden=false;$("rcQ").value="";$("rcMsg").textContent="";$("rcSave").disabled=false;draw();return}
 loaded=false;gate('<div class="mi-gi">'+LOCK+'</div><h3>Founders only</h3><p></p>');
 $("rcGate").querySelector("p").textContent=(b&&b.error)||(a&&a.error)||"We could not load this page. Check your connection and try again."}
function leave(){loaded=false;SEL=new Set();FM=[];$("rcGate").hidden=false;$("rcApp").hidden=true}
async function save(){
 if(!loaded)return;const btn=$("rcSave"),msg=$("rcMsg");btn.disabled=true;msg.textContent="";let r;
 try{r=await api.redcard_set({cards:[...SEL].slice(0,LIMIT)})}catch(e){r=null}btn.disabled=false;
 if(r&&r.ok){SEL=new Set((Array.isArray(r.cards)?r.cards:[]).map(String).slice(0,LIMIT));draw();msg.textContent="Saved. "+SEL.size+" red card"+(SEL.size===1?"":"s")+" active.";hap("medium")}
 else msg.textContent=(r&&r.error)||"Could not save. Try again."}
/* sidebar entry (Founder section, owner only) opens the view through a hidden proxy so the normal view switch runs */
const mr=$("mred");if(mr)mr.onclick=()=>{if(body.classList.contains("owner")){const g=$("redGoSet");if(g)g.click()}};
if(V.tools)V.tools.hooks.redset={enter,leave};
})(window.ILLUMINATI);
}catch(e){console.error(e)}
