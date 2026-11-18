try{
/* Red Cards.
   The founder chooses up to 5 members as red cards ("Voting setup" page, section "Red cards").
   While you are inside any multiplayer place (Node Sync, Spore or a Conclave batch) this file pings the backend
   (edge function illuminati-redcard) with the room you are in. When a red card member is in that same room the
   whole portal glows red from the edges and a "Red Card Joined" notice appears. Outside multiplayer nothing happens.
   Who is a red card, and who is in a room, is decided by the backend only; this file just shows it. */
(function(V){
const api=V.services.api,$=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const hap=k=>{try{V.tg.haptic(k||"light")}catch(e){}};
const LIMIT=5,POLL=4000,FRESH=15000;
const body=document.body;

/* ---------------- glow + notice ---------------- */
let glow=null,note=null,noteT=0;
function mount(){
 if(glow)return;
 glow=document.createElement("div");glow.id="rcGlow";glow.setAttribute("aria-hidden","true");
 note=document.createElement("div");note.id="rcNote";note.setAttribute("role","status");note.setAttribute("aria-live","assertive");
 body.appendChild(glow);body.appendChild(note)}
function setGlow(on){mount();glow.classList.toggle("on",!!on)}
function announce(){
 mount();note.textContent="Red Card Joined";note.classList.remove("on");void note.offsetWidth;note.classList.add("on");
 clearTimeout(noteT);noteT=setTimeout(()=>note.classList.remove("on"),3200);hap("heavy")}

/* ---------------- which multiplayer room am I in ---------------- */
let room=null,prev=0,timer=0,busy=false;
const key=r=>r.kind+":"+r.batch;
function seen(kind,batch){
 const r={kind,batch:String(batch).slice(0,60),t:Date.now()};
 if(!room||key(room)!==key(r)){room=r;prev=0;ping()}else room.t=r.t;
 if(!timer)timer=setInterval(tick,POLL)}
function clear(){room=null;prev=0;setGlow(false);clearInterval(timer);timer=0}
function tick(){
 if(!room)return;
 if(Date.now()-room.t>FRESH){clear();return}
 if(!document.hidden)ping()}
async function ping(){
 if(!room||busy||!api.redcard_ping)return;busy=true;const r0=room;let r;
 try{r=await api.redcard_ping({kind:r0.kind,batch:r0.batch})}catch(e){r=null}busy=false;
 if(!room||key(room)!==key(r0)||!r||!r.ok)return;
 const n=Math.max(0,Math.min(99,+r.red||0));
 setGlow(n>0);if(n>prev)announce();prev=n}
V.red={room:(kind,batch)=>{batch?seen(kind,batch):clear()},clear};

/* Node Sync and Spore: learn the room from the calls those screens already make. */
[["sync_ping","sync"],["rec_sync_ping","sync"],["spore_state","spore"]].forEach(([name,kind])=>{
 const f=api[name];if(typeof f!=="function")return;
 api[name]=function(d){try{if(d&&d.batch)seen(kind,d.batch)}catch(e){}return f.apply(this,arguments)}});
["sync_leave","rec_sync_leave","spore_leave","sync_done","rec_sync_done"].forEach(name=>{
 const f=api[name];if(typeof f!=="function")return;
 api[name]=function(){try{clear()}catch(e){}return f.apply(this,arguments)}});
/* ---------------- founder page: choose the red cards ---------------- */
let FM=[],SEL=new Set(),loaded=false,mounted=false;
function build(){
 if(mounted)return true;const app=$("vsApp");if(!app)return false;mounted=true;
 const d=document.createElement("div");d.id="rcApp";
 d.innerHTML='<p class="eyebrow" style="margin-top:28px">Red cards</p>'
 +'<p class="gl-p mi-lead">Choose up to '+LIMIT+' members as red cards. When a red card joins Node Sync, Spore or a Conclave batch, everyone in that room sees the whole portal glow red and a &ldquo;Red Card Joined&rdquo; notice. Nothing changes anywhere else.</p>'
 +'<p class="vt-sel" id="rcCount"></p><div class="lchips" id="rcChips"></div>'
 +'<input class="lsearch" id="rcQ" type="search" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Search members" aria-label="Search members for red cards">'
 +'<div id="rcList"></div><button class="btn solid" id="rcSave" type="button">Save red cards</button><p class="note" id="rcMsg" role="status"></p>';
 app.appendChild(d);
 $("rcQ").oninput=draw;
 $("rcChips").onclick=e=>{const b=e.target.closest("[data-rx]");if(!b)return;SEL.delete(b.dataset.rx);hap("light");draw()};
 $("rcList").onclick=e=>{const b=e.target.closest("[data-ra]");if(!b||b.disabled)return;const id=b.dataset.ra;if(SEL.has(id))SEL.delete(id);else if(SEL.size<LIMIT)SEL.add(id);hap("light");draw()};
 $("rcSave").onclick=save;return true}
const nm=m=>m.username?"@"+m.username:(m.name||"Member");
const fname=id=>{const m=FM.find(x=>x.uid===id);return m?nm(m):"Former member"};
function draw(){
 if(!mounted)return;const q=$("rcQ").value.trim().toLowerCase(),full=SEL.size>=LIMIT;
 $("rcCount").textContent=SEL.size+" of "+LIMIT+" selected";
 $("rcChips").innerHTML=SEL.size?[...SEL].map(id=>'<button type="button" class="lchip" data-rx="'+esc(id)+'" aria-label="Remove '+esc(fname(id))+'">'+esc(fname(id))+' \u00d7</button>').join(""):'<p class="note" style="margin:0;text-align:left">No red cards yet.</p>';
 $("rcList").innerHTML=FM.filter(m=>!q||[m.username,m.name].join(" ").toLowerCase().includes(q)).slice(0,60).map(m=>{
  const on=SEL.has(m.uid);
  return '<div class="lrow"><div class="lwho"><b>'+esc(nm(m))+'</b><small>'+esc(m.name||"")+'</small></div><button type="button" class="lbt'+(on?" on":"")+'" data-ra="'+esc(m.uid)+'"'+(!on&&full?' disabled style="opacity:.4"':"")+'>'+(on?"Red card":"Add")+'</button></div>'}).join("")}
async function load(){
 if(!build())return;const msg=$("rcMsg");msg.textContent="Loading red cards";let a,b;
 try{[a,b]=await Promise.all([api.vote_founder_get(),api.redcard_get()])}catch(e){a=b=null}
 if(a&&a.ok&&b&&b.ok){FM=Array.isArray(a.members)?a.members:[];SEL=new Set((Array.isArray(b.cards)?b.cards:[]).map(String).slice(0,LIMIT));loaded=true;msg.textContent="";$("rcSave").disabled=false;draw();return}
 loaded=false;$("rcSave").disabled=true;msg.textContent=(b&&b.error)||(a&&a.error)||"Red cards could not be loaded. The red card backend may not be set up yet."}
async function save(){
 if(!loaded)return;const btn=$("rcSave"),msg=$("rcMsg");btn.disabled=true;msg.textContent="";let r;
 try{r=await api.redcard_set({cards:[...SEL].slice(0,LIMIT)})}catch(e){r=null}btn.disabled=false;
 if(r&&r.ok){SEL=new Set((Array.isArray(r.cards)?r.cards:[]).map(String).slice(0,LIMIT));draw();msg.textContent="Saved. "+SEL.size+" red card"+(SEL.size===1?"":"s")+" active.";hap("medium")}
 else msg.textContent=(r&&r.error)||"Could not save. Try again."}
const onView=()=>{if(body.dataset.view==="voteset")setTimeout(load,60);else loaded=false};
new MutationObserver(onView).observe(body,{attributes:true,attributeFilter:["data-view"]});onView();
})(window.ILLUMINATI);
}catch(e){console.error(e)}
