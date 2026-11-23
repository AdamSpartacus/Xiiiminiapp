try{
/* Decrypt gate + Node Synchronization. New members' codes stay encrypted until they complete one node sync; existing members can open node sync to help others. */
(function(V){
/* ---------- gate ---------- */
const tg=V.tg.app,CS=tg&&tg.CloudStorage,KD="vm_device";
const lsGet=k=>{try{return localStorage.getItem(k)}catch(e){return null}},lsSet=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
function uid(){if(V.tg.user)return String(V.tg.user.id);let d="";try{d=JSON.parse(localStorage.getItem(KD))||""}catch(e){}if(!d){d="dev-"+Math.random().toString(36).slice(2,10);try{localStorage.setItem(KD,JSON.stringify(d))}catch(e){}}return d}
const U=uid(),LK={dec:"vm_dec_"+U,pend:"vm_pend_"+U};
let dec=lsGet(LK.dec)==="1",pend=lsGet(LK.pend)==="1";
const csGet=k=>new Promise(res=>{try{if(!CS)return res(null);const t=setTimeout(()=>res(null),1500);CS.getItem(k,(e,v)=>{clearTimeout(t);res(e?null:v)})}catch(e){res(null)}});
const csSet=(k,v)=>{try{CS&&CS.setItem(k,v,()=>{})}catch(e){}};
const ready=Promise.all([csGet("vm_dec"),csGet("vm_pend")]).then(([d,p])=>{
  if(d==="1"){dec=true;lsSet(LK.dec,"1")}if(p==="1"){pend=true;lsSet(LK.pend,"1")}
  if(dec)csSet("vm_dec","1");if(pend)csSet("vm_pend","1")});
const since=Date.parse(V.config.syncFrom||"")||0,regAt=m=>Date.parse(String((m&&(m.at||m.created_at||m.createdAt))||""))||0;
/* a "new member" registered at/after syncFrom, or just registered on this device. Anyone older never has to sync. */
const isNew=m=>pend||(since>0&&regAt(m)>=since);
V.gate={ready,uid:()=>U,isNew,isDecrypted:()=>dec,locked:m=>typeof m.locked==="boolean"?m.locked:isNew(m)&&!dec,
  markPending(){pend=true;lsSet(LK.pend,"1");csSet("vm_pend","1")},
  markDecrypted(){dec=true;lsSet(LK.dec,"1");csSet("vm_dec","1")}};

/* ---------- node synchronization: the server checks every node and records the result; this page only shows it ---------- */
const $=i=>document.getElementById(i),P=V.config.supabase,PROJECT=P.url,KEY=P.anonKey,api=V.services.api;
const KINDS={decrypt:{NEED:5,ROUND:5000,CYCLE:180000},web:{NEED:100,ROUND:7000,CYCLE:600000},recover:{NEED:15,ROUND:5000,CYCLE:180000}},CFG={NEED:5,ROUND:5000,GRACE:900,TOL:250,CYCLE:180000,PING:5000,ALIVE:12000};let R=CFG.ROUND,KIND="decrypt";
/* every sync call carries the kind: web syncs run in their own batch namespace on the server */
const call=(f,d)=>KIND==="recover"?api["rec_"+f](d):api[f](KIND==="web"?Object.assign({mode:"web"},d):d);
const mm=ms=>Math.round(ms/60000)+" minute"+(ms>=120000?"s":"");
/* recovery sync: the founder sets how many members are needed; the server sends it with every heartbeat */
function paintNeed(){WAIT="Waiting for members. Synchronization starts when "+CFG.NEED+" are online.";$("nsRule").textContent="Your reference code is unique to you. Rebuild it before the timer ends. Synchronization only runs while "+CFG.NEED+" members are online.";if(KIND==="recover"&&$("nsWho"))$("nsWho").textContent="Join a batch. When "+CFG.NEED+" members are online and sync together, the corrupted archive is recovered. Every member who completes it earns 10 merits."}
function setKind(k){KIND=k==="web"?"web":k==="recover"?"recover":"decrypt";Object.assign(CFG,KINDS[KIND]);R=CFG.ROUND;WAIT="Waiting for members. Synchronization starts when "+CFG.NEED+" are online.";
  $("nsRule").textContent="Your reference code is unique to you. Rebuild it before the timer ends. Synchronization only runs while "+CFG.NEED+" members are online.";
  $("nsCn").textContent="Messages live only on screen for online members and vanish every "+mm(CFG.CYCLE)+".";
  $("nsT").textContent=(R/1000).toFixed(1);$("nsRt").textContent=$("nsCt").textContent=Math.floor(CFG.CYCLE/60000)+":00"}
const H={apikey:KEY,...(KEY.startsWith("eyJ")?{Authorization:"Bearer "+KEY}:{}),"Content-Type":"application/json"};
const rest=p=>PROJECT+"/rest/v1/"+p,RANDOM=/^Random-/;
let WHO="",ME="",MODE="decrypt",BATCH="",off=0,cur=null,frags=[],slots=[],sent=false,decoded=false,online=0,timers=[],CODE="",codeEp=null,active=false,armed=false,away=null,epoch=null,CODES={},lastChat=0,busy=false,lastErr="",wonRole="",qs=0;
const now=()=>Date.now()+off;
const show=id=>["nsPick","nsGame","nsDone"].forEach(s=>$(s).hidden=s!==id);
const hash=s=>{let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(36)};
const rng=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const clean=s=>s.replace(/[^\w \-]/g,"").replace(/\s+/g," ").trim().slice(0,24);
/* node id: the member's @username, otherwise an anonymous id. Stable per member, so extra tabs never count as extra players. */
function identify(){ME=(WHO||"N"+hash(U).slice(0,5).toUpperCase()).replace(/[^\w]/g,"").slice(0,21)||"NODE"}
/* ---------- batches (listed, created and matched by the server) ---------- */
async function search(q){
  const tk=++qs;$("nsRs").textContent="Searching\u2026";$("nsRes").textContent="";
  let r;try{r=await call("sync_search",{q})}catch(e){r=null}
  if(tk!==qs)return;
  if(!r||!r.ok){$("nsRs").textContent=(r&&r.error)||"Could not search right now.";return}
  const list=Array.isArray(r.batches)?r.batches:[];
  $("nsRs").textContent=list.length?"":"No batches found. Create one.";
  list.forEach(x=>{
    const d=document.createElement("div");d.className="nsitem";
    d.innerHTML="<div><b></b><small></small></div>";d.querySelector("b").textContent=x.batch;d.querySelector("small").textContent="by "+x.owner;
    const btn=document.createElement("button");btn.type="button";btn.className="btn";btn.textContent="Join";btn.onclick=()=>join(x.batch);d.appendChild(btn);$("nsRes").appendChild(d);
  });
}
let qt;$("nsQ").oninput=()=>{clearTimeout(qt);qt=setTimeout(()=>search($("nsQ").value.trim()),300)};
const tabs={nsTS:"nsPS",nsTC:"nsPC",nsTJ:"nsPJ"};
Object.keys(tabs).forEach(t=>$(t).onclick=()=>{Object.keys(tabs).forEach(k=>{$(k).setAttribute("aria-pressed",String(k===t));$(tabs[k]).hidden=k!==t})});
$("nsCf2").onchange=()=>{$("nsKw").hidden=!$("nsCf2").checked};
$("nsPC").addEventListener("submit",async e=>{
  e.preventDefault();const n=clean($("nsCn").value),priv=$("nsCf2").checked,k=$("nsCk").value.trim(),err=$("nsCe");
  if(n.length<3){err.textContent="Batch name needs 3+ characters.";return}
  if(priv&&k.length<4){err.textContent="Friends key needs 4+ characters.";return}
  err.textContent="";
  if(priv){join("f-"+n+"-"+hash(n+"|"+k));return}
  let r;try{r=await call("sync_create",{batch:n})}catch(x){r=null}
  if(!r||!r.ok||!r.batch){err.textContent=(r&&r.error)||"Could not create the batch.";return}
  join(r.batch);
});
$("nsPJ").addEventListener("submit",e=>{
  e.preventDefault();const n=clean($("nsJn").value),k=$("nsJk").value.trim();
  if(!n||!k){$("nsJe").textContent="Enter the batch name and friends key.";return}
  join("f-"+n+"-"+hash(n+"|"+k));
});
/* random matchmaking: the server joins you to a Random-* batch that has members online, or opens a new one */
$("nsRnd").onclick=async()=>{
  const b=$("nsRnd"),err=$("nsRe");err.textContent="";b.disabled=true;b.textContent="Finding members\u2026";
  let r;try{r=await call("sync_random",{})}catch(e){r=null}
  b.disabled=false;b.textContent="Join random batch";
  if(!r||!r.ok||!r.batch){err.textContent=(r&&r.error)||"Could not find a batch. Try again.";return}
  join(r.batch)};
/* ---------- game ---------- */
/* server clock: the edge function that checks every round also reports its time (lock_status). The old direct ems_now call is blocked for the public key, so it always failed and left phones with a wrong clock out of sync. */
async function syncClock(){try{const a=Date.now(),r=await api.lock_status(),b=Date.now();if(r&&typeof r.now==="number"&&isFinite(r.now))off=r.now-(a+b)/2}catch(e){}}
function newPuzzle(){
  const parts=[0,1,2,3,4].map(i=>CODE.slice(i*2,i*2+2)),r=rng(parseInt(hash(U+"|"+cur),36));let o,n=0;
  do{o=parts.slice();for(let i=4;i>0;i--){const j=Math.floor(r()*(i+1));[o[i],o[j]]=[o[j],o[i]]}}while(o.join("")===CODE&&++n<20);
  frags=o;slots=[];sent=false;draw()}
function draw(){
  $("nsRef").textContent=CODE;$("nsSlots").innerHTML="";$("nsTiles").innerHTML="";
  for(let k=0;k<5;k++){const b=document.createElement("button");b.type="button";b.className="nsslot";b.textContent=slots[k]!==undefined?frags[slots[k]]:"";b.onclick=()=>{if(sent||slots[k]===undefined)return;slots.splice(k,1);draw()};$("nsSlots").appendChild(b)}
  frags.forEach((f,i)=>{const b=document.createElement("button");b.type="button";b.className="nstile"+(slots.includes(i)?" used":"");b.textContent=f;b.onclick=()=>{if(sent||slots.length>=5)return;slots.push(i);draw();check()};$("nsTiles").appendChild(b)})}
function setSt(t,c){$("nsSt").textContent=t;$("nsSt").className=c||""}
function waiting(t){armed=false;sent=false;slots=[];frags=[];$("nsRef").textContent="\u00b7 \u00b7 \u00b7 \u00b7 \u00b7";$("nsSlots").innerHTML="";$("nsTiles").innerHTML="";$("nsBarI").style.width="0";$("nsT").textContent="\u2013";if(t)setSt(t)}
let WAIT="Waiting for members. Synchronization starts when "+CFG.NEED+" are online.";
/* the server verifies the sequence, the round timing and that 5 members are online, then records the result */
function check(){if(sent||!armed||slots.length<5)return;const ans=slots.map(i=>frags[i]).join("");if(ans===CODE){sent=true;setSt("Sequence locked. Hold for verification.","nsok");submit(ans,cur)}}
async function submit(ans,rd){
  const b=BATCH;let x;try{x=await call("sync_done",{batch:b,round:rd,answer:ans})}catch(e){x=null}
  if(b!==BATCH||decoded)return;
  if(x&&x.ok&&x.won)return win(x);
  if(x&&x.closed&&KIND==="recover"){leaveBatch();V.sync.onexit&&V.sync.onexit(false,"recover");return}
  if(!x||!x.ok)setSt((x&&x.error)||"Could not reach the server. Try again next round.","nsbad")}
async function judge(rd){
  if(decoded||!active||!BATCH)return;
  const b=BATCH;let x;
  /* The heartbeat reply now carries the win and how many nodes locked in each recent round, so one fresh heartbeat answers what sync_round did.
     If that heartbeat fails or the server does not send the counts, ask sync_round exactly as before. */
  rdSeen=undefined;
  for(let i=0;i<50&&busy;i++)await new Promise(r=>setTimeout(r,100));
  if(b!==BATCH||decoded)return;
  await pulseOnce();
  if(b!==BATCH||decoded)return;
  if(Array.isArray(rdSeen)){const e=rdSeen.find(z=>z&&+z.r===rd);x={ok:true,done:e?+e.d||0:0}}
  else{try{x=await call("sync_round",{batch:b,round:rd})}catch(e){x=null}
    if(b!==BATCH||decoded)return;
    if(x&&x.ok&&x.won)return win(x)}
  const n=x&&x.ok?+x.done||0:0;
  if(active)setSt(`SYNC FAILED \u00b7 ${n}/${CFG.NEED} nodes aligned. New sequence generated.`,"nsbad")}
function win(x){
  if(decoded)return;
  decoded=true;goOffline();BATCH="";show("nsDone");
  wonRole=x&&x.role||"";const mine=wonRole?wonRole==="member":MODE==="decrypt",mer=x&&+x.merits||0;
  const W=KIND==="web";
  $("nsDn").textContent=mine?(W?"All 100 nodes aligned. Web access is now unlocked permanently.":"All nodes aligned. Your Member Identification Code is now decrypted permanently."):"All nodes aligned. Thank you for helping other members "+(W?"unlock web access.":"synchronize.")+(mer>0?" You earned "+mer+" merits.":"");
  $("nsDbtn").textContent=W?(mine?"Open web access":"Back to web access"):(mine?"View my identification code":"Back to profile");
  if(KIND==="recover"){$("nsDn").textContent="Recovery complete. Recovering and processing the corrupted archive. It will be available within 24 hours."+(mer>0?" You earned "+mer+" merits.":"");$("nsDbtn").textContent="Back to archive"}
  try{V.sync.onwin&&V.sync.onwin(mine?"decrypt":"help",x,KIND)}catch(e){}}
function tick(){
  if(decoded||!BATCH)return;
  const sn=now(),ce=Math.floor(sn/CFG.CYCLE);
  if(ce!==codeEp||(!CODE&&CODES[ce])){codeEp=ce;CODE=CODES[ce]||""}
  const left=CFG.CYCLE-(sn%CFG.CYCLE),f=Math.floor(left/60000)+":"+String(Math.floor(left/1000)%60).padStart(2,"0");
  $("nsCt").textContent=f;$("nsRt").textContent=f;chatEpoch(sn);
  if(!active||!CODE)return;
  const r=Math.floor(sn/R);
  if(cur===null){cur=r;waiting(CFG.NEED+" members online. Synchronization begins at the next reset.")}
  else if(r!==cur){const prev=cur,was=armed;cur=r;armed=true;newPuzzle();setSt("Rebuild your code and lock it in.");if(was)setTimeout(()=>judge(prev),CFG.GRACE)}
  $("nsBarI").style.width=((sn%R)/R*100)+"%";$("nsT").textContent=((R-sn%R)/1000).toFixed(1)}
/* heartbeat: tells the server this node is online, and brings back the online count, this node's codes, new chat lines and the win */
let cq=[],again=false,hotAt=0,meN=0,lastP=0,rdSeen;
const nrm=s=>String(s==null?"":s).replace(/\s+/g," ").trim().slice(0,200);
/* pulse(): one heartbeat at a time. pulse(true) = "run one right after the one in flight" (used after sending a chat line) */
async function pulse(force){
  if(busy){if(force)again=true;return}
  await pulseOnce();
  if(again&&BATCH){again=false;pulse()}else again=false}
async function pulseOnce(){
  const b=BATCH;if(!b||busy)return;busy=true;lastP=Date.now();
  let r;try{r=await call("sync_ping",{batch:b,after:lastChat})}catch(e){r=null}
  busy=false;
  if(!r||b!==BATCH||decoded)return;
  if(!r.ok){if(r.closed&&KIND==="recover"){leaveBatch();V.sync.onexit&&V.sync.onexit(false,"recover");return}if(r.error&&r.error!==lastErr){lastErr=r.error;sys(r.error)}return}
  if(+r.need>0&&+r.need!==CFG.NEED){const was=CFG.NEED;CFG.NEED=+r.need;paintNeed();rcPaint();if(CFG.NEED<was&&KIND!=="recover")sys("A red card used its power. Nodes needed is now "+CFG.NEED+".")}
  if(r.codes)Object.assign(CODES,r.codes);
  (Array.isArray(r.chat)?r.chat:[]).forEach(m=>addChat(m,true));
  if(typeof r.rt==="string"&&/^ems-[0-9a-f]{24}$/.test(r.rt))rtOpen(r.rt);
  rdSeen=Array.isArray(r.rd)?r.rd:undefined;
  if(r.won)return win(r);
  online=+r.online||0;
  const was=active;active=online>=CFG.NEED;
  if(!active&&(was||cur!==null)){cur=null;waiting(WAIT)}
  $("nsOn").textContent=`nodes online: ${online}/${CFG.NEED}`+(online<CFG.NEED?" \u00b7 awaiting others":"")}
/* one place that shows a chat line, whether it came from the heartbeat or from Realtime (each id is shown once) */
let seenChat=new Set();
function addChat(m,fromPing){
  if(!m||!(m.id>0)||seenChat.has(m.id))return;seenChat.add(m.id);
  if(fromPing&&m.id>lastChat)lastChat=m.id;hotAt=Date.now();
  const mine=m.u===ME,tx=String(m.t||"").slice(0,200);
  if(mine){const i=cq.findIndex(p=>p.n===nrm(tx));if(i>=0){cq[i].el.classList.remove("pend");cq.splice(i,1);return}meN++}
  line(String(m.u||"?").slice(0,21),tx,mine)}
/* ---------- Supabase Realtime: chat lines, joins, leaves and the win are pushed the moment they happen ----------
   The channel name is secret per batch and is only handed to verified members (in the heartbeat reply). The database broadcasts to it.
   Realtime only delivers; every rule (who is online, who won) is still decided by the server. The heartbeat keeps running as the fallback. */
const RT={ws:null,name:"",ref:0,hb:null,retry:0,ok:false,timer:null,poke:0};
function rtSend(ws,topic,event,payload){try{ws.send(JSON.stringify({topic,event,payload,ref:String(++RT.ref)}))}catch(e){}}
function rtPoke(){if(RT.poke||!BATCH||decoded)return;RT.poke=setTimeout(()=>{RT.poke=0;if(BATCH&&!decoded&&Date.now()-lastP>1500)pulse(true)},Math.floor(Math.random()*250))}
function rtConnect(){
  if(!RT.name||!BATCH||decoded||typeof WebSocket!=="function")return;
  let ws;try{ws=new WebSocket(PROJECT.replace(/^http/,"ws")+"/realtime/v1/websocket?apikey="+encodeURIComponent(KEY)+"&vsn=1.0.0")}catch(e){return}
  RT.ws=ws;const topic="realtime:"+RT.name;
  ws.onopen=()=>{
    rtSend(ws,topic,"phx_join",{config:{broadcast:{self:false,ack:false},presence:{key:""},postgres_changes:[],private:false},access_token:KEY});
    clearInterval(RT.hb);RT.hb=setInterval(()=>rtSend(ws,"phoenix","heartbeat",{}),25000)};
  ws.onmessage=ev=>{let m;try{m=JSON.parse(ev.data)}catch(e){return}
    if(!m||m.topic!==topic)return;
    if(m.event==="phx_reply"){if(m.payload&&m.payload.status==="ok"){RT.ok=true;RT.retry=0;pulse(true)}else{try{ws.close()}catch(e){}}}
    else if(m.event==="phx_error"){try{ws.close()}catch(e){}}
    else if(m.event==="broadcast"&&m.payload){const e=m.payload.event,p=m.payload.payload;
      if((e==="chat"||e==="poke")&&BATCH&&!decoded)rtPoke()}};  /* broadcast content is never trusted or rendered: it only triggers a server fetch */
  ws.onclose=()=>{clearInterval(RT.hb);if(RT.ws!==ws)return;RT.ws=null;RT.ok=false;
    if(RT.name&&BATCH&&!decoded){RT.retry++;clearTimeout(RT.timer);RT.timer=setTimeout(rtConnect,Math.min(5000,400*RT.retry))}};
  ws.onerror=()=>{try{ws.close()}catch(e){}}}
function rtOpen(name){if(RT.name===name&&RT.ws)return;rtClose();RT.name=name;RT.retry=0;rtConnect()}
function rtClose(){RT.name="";RT.ok=false;clearTimeout(RT.timer);clearTimeout(RT.poke);RT.poke=0;clearInterval(RT.hb);const ws=RT.ws;RT.ws=null;if(ws){ws.onclose=ws.onmessage=ws.onerror=null;try{ws.close()}catch(e){}}}
document.addEventListener("visibilitychange",()=>{if(document.hidden||!BATCH||decoded)return;if(RT.name&&!RT.ws)rtConnect();pulse(true)});
/* ---------- red card power: a red card may spend 20 merits to lower the nodes needed by 5, only in syncs that need more than 10 ---------- */
const RC_COST=20,RC_CUT=5,RC_MIN=10;let rcOK=false,rcBusy=false;
function rcPaint(){
  const box=$("nsRc");if(!box)return;
  const show=!!(rcOK&&BATCH&&!decoded&&CFG.NEED>RC_MIN);box.hidden=!show;if(!show)return;
  $("nsRcT").textContent="Red card power. Lower the nodes needed from "+CFG.NEED+" to "+(CFG.NEED-RC_CUT)+" for everyone in this batch. It costs you "+RC_COST+" merits and works once per batch.";
  $("nsRcB").textContent=rcBusy?"Working...":"Use red card power (-"+RC_COST+" merits)";$("nsRcB").disabled=rcBusy}
async function rcStatus(){
  const b=BATCH;rcOK=false;rcPaint();if(!b||!api.redcard_power)return;
  let r;try{r=await api.redcard_power({op:"status",batch:b,mode:KIND})}catch(e){r=null}
  if(b!==BATCH)return;rcOK=!!(r&&r.ok&&r.eligible&&!r.used);rcPaint()}
function rcAsk(msg){
  try{const t=V.tg&&V.tg.app;if(t&&t.showConfirm)return new Promise(res=>t.showConfirm(msg,res))}catch(e){}
  return Promise.resolve(confirm(msg))}
$("nsRcB").onclick=async()=>{
  if(rcBusy||!BATCH||!rcOK)return;const b=BATCH;
  if(!(await rcAsk("Spend "+RC_COST+" merits to lower the nodes needed by "+RC_CUT+" for everyone in this batch?")))return;
  if(b!==BATCH)return;rcBusy=true;rcPaint();let r;
  try{r=await api.redcard_power({op:"use",batch:b,mode:KIND})}catch(e){r=null}
  rcBusy=false;if(b!==BATCH)return;
  if(r&&r.ok){rcOK=false;const was=CFG.NEED;CFG.NEED=+r.need>0?+r.need:Math.max(RC_MIN,was-RC_CUT);paintNeed();
    sys("Red card power used. Nodes needed is now "+CFG.NEED+"."+(r.merits!=null?" Merits left: "+r.merits+".":""));try{V.tg.haptic("heavy")}catch(e){}pulse(true)}
  else sys((r&&r.error)||"Could not use the red card power. Try again.");
  rcPaint()};
/* ---------- live chat: relayed by the server, verified members only, wiped every 3 min ---------- */
function line(u,t,me){
  const d=document.createElement("div");d.className="nsm"+(me?" me":"");
  const b=document.createElement("b");b.textContent=u;d.appendChild(b);d.appendChild(document.createTextNode(t));
  $("nsMsgs").appendChild(d);$("nsMsgs").scrollTop=1e9;return d}
function sys(t){const d=document.createElement("div");d.className="nsm sys";d.textContent=t;$("nsMsgs").appendChild(d)}
function chatEpoch(sn){const e=Math.floor(sn/CFG.CYCLE);if(epoch!==null&&e!==epoch){$("nsMsgs").textContent="";cq=[];sys("Chat reset. Previous messages are gone.")}epoch=e}
$("nsCf").addEventListener("submit",async e=>{
  e.preventDefault();const t=$("nsCi").value.trim();if(!t||!BATCH)return;$("nsCi").value="";
  const b=BATCH,el=line(ME,t.slice(0,200),true),p={n:nrm(t),el,mc:meN};el.classList.add("pend");cq.push(p);hotAt=Date.now();
  const fin=()=>{const i=cq.indexOf(p);if(i<0)return;cq.splice(i,1);if(meN>p.mc)el.remove();else el.classList.remove("pend")};
  let r;try{r=await call("sync_chat",{batch:b,text:t})}catch(x){r=null}
  if(!r||!r.ok){const i=cq.indexOf(p);if(i>=0)cq.splice(i,1);el.remove();if(b===BATCH)sys((r&&r.error)||"Message not sent.");return}
  pulse(true);setTimeout(()=>pulse(true),700);setTimeout(fin,6000)});
$("nsCi").addEventListener("input",()=>{hotAt=Date.now()});$("nsCi").addEventListener("focus",()=>{hotAt=Date.now()});
/* ---------- lifecycle ---------- */
async function join(b){
  BATCH=b.slice(0,60);const mine=BATCH,label=b.replace(/^f-(.*)-[a-z0-9]+$/,"$1 (friends)");
  $("nsMeta").textContent="batch "+label+" \u00b7 "+ME;$("nsMsgs").textContent="";epoch=null;decoded=false;cur=null;codeEp=null;active=false;online=0;away=null;CODE="";CODES={};lastChat=0;lastErr="";busy=false;again=false;cq=[];hotAt=0;wonRole="";rtClose();seenChat=new Set();
  $("nsOn").textContent="nodes online: 0/"+CFG.NEED+" \u00b7 awaiting others";
  show("nsGame");waiting(WAIT);rcOK=false;rcBusy=false;rcPaint();
  await syncClock();if(BATCH!==mine)return;
  tick();timers=[setInterval(tick,100),setInterval(()=>{const gap=!RT.ok&&Date.now()-hotAt<20000?1500:CFG.PING;if(Date.now()-lastP>=gap-100)pulse()},250),setInterval(syncClock,120000)];pulse();rcStatus();sys("Connected. Only verified members in this batch can see this chat.")}
function stopGame(){rtClose();timers.forEach(clearInterval);timers=[];active=false;cur=null;armed=false}
/* offline: stop heartbeats, tell the server (it removes an empty random batch itself) */
function goOffline(){
  const b=BATCH;if(!b)return;
  stopGame();rcOK=false;rcPaint();
  try{call("sync_leave",{batch:b})}catch(e){}}
function leaveBatch(){goOffline();BATCH="";away=null}
$("nsLeave").onclick=()=>{leaveBatch();show("nsPick");search($("nsQ").value.trim())};
$("nsBack").onclick=()=>{leaveBatch();V.sync.onexit&&V.sync.onexit(false,KIND)};
$("nsDbtn").onclick=()=>{V.sync.onexit&&V.sync.onexit(wonRole==="member"||(!wonRole&&MODE==="decrypt"),KIND)};
/* leaving the miniapp = offline. Coming back: named batches rejoin, random batches are gone. */
function leaveApp(){if(!BATCH||away!==null)return;away=BATCH;goOffline()}
function resumeApp(){
  if(away===null)return;const b=away;away=null;
  if(RANDOM.test(b)){BATCH="";show("nsPick");search("")}else join(b)}
document.addEventListener("visibilitychange",()=>document.hidden?leaveApp():resumeApp());
addEventListener("pagehide",leaveApp);
try{if(tg&&tg.onEvent){tg.onEvent("deactivated",leaveApp);tg.onEvent("activated",resumeApp)}}catch(e){}
V.sync={onwin:null,onexit:null,
  setUser(n){WHO=String(n||"").replace(/^@/,"")},
  start(mode,kind,need){
    leaveBatch();setKind(kind);if(KIND==="recover"&&+need>0)CFG.NEED=+need;MODE=mode==="help"?"help":"decrypt";identify();
    const W=KIND==="web";
    $("nsMode").textContent=MODE==="decrypt"?(W?"Decrypt web access":"Decrypt identification code"):"Help another member";
    $("nsWho").textContent=MODE==="decrypt"?(W?"Join a batch. When "+CFG.NEED+" members are online and sync together, web access is unlocked permanently.":"Join a batch. When "+CFG.NEED+" members are online and sync together, your Member Identification Code is decrypted permanently."):(W?"Join a batch and help other members unlock web access. Your own access is not affected. You earn 10 merits for every new member you help unlock.":"Join a batch and help other members sync. Your own code is not affected. You earn 10 merits for every new member you help decrypt.");
    if(KIND==="recover"){$("nsMode").textContent="Recover corrupted archive";paintNeed()}
    decoded=false;show("nsPick");$("nsTS").click();search("")}};
})(window.ILLUMINATI);
}catch(e){console.error(e)}
try{
/* Spore: 5-player co-op outbreak. All game state is on the server (illuminati-spore); this page only draws it and sends cure attempts. */
(function(V){
const $=i=>document.getElementById(i),api=V.services.api;
const DUR=20,USERS=5,CURES=4,NODES=20,HOME=[0,4,8,12,16],CW=180000,RANDOM=/^Random-/;
const hash=s=>{let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(36)};
const clean=s=>s.replace(/[^\w \-]/g,'').replace(/\s+/g,' ').trim().slice(0,24);
const ADJ=Array.from({length:NODES},(_,i)=>[(i+1)%NODES,(i+NODES-1)%NODES,(i+4)%NODES]);
ADJ.forEach((a,i)=>a.forEach(j=>{if(!ADJ[j].includes(i))ADJ[j].push(i)}));
const POS=Array.from({length:NODES},(_,i)=>{const a=i/NODES*6.283;return{x:.5+.38*Math.cos(a),y:.5+.38*Math.sin(a)}});
const HL=i=>HOME.includes(i)?' (User '+(HOME.indexOf(i)+1)+' home)':'';
const cv=$('spCv'),cx=cv.getContext('2d');let W=0,H=0;
let alive=false,batch='',isRnd=false,rtries=0,timer=0,busy=false,ST=null,G=null,sel=null,seen=0,after=0,tAt=0,elAt=0,scanUntil=0,scan={},loc=[],cw=Math.floor(Date.now()/CW),sentAt=0,settled=false;
function fit(){const d=Math.min(devicePixelRatio||1,V.perf.maxDpr);W=cv.clientWidth;H=cv.clientHeight;if(!W)return;cv.width=W*d;cv.height=H*d;cx.setTransform(d,0,0,d,0,0)}
const code=$('spCode');
const DAILY=3;let lft=null;
function setLeft(n){if(typeof n!=='number')return;lft=n;const e=$('spLeft');if(e)e.textContent='Attempts left today: '+n+'/'+DAILY+(n===0?' · resets at 7 PM GMT':'');const b=$('spRnd');if(b)b.disabled=n===0;const a=$('spAgain');if(a)a.hidden=n===0}
function view(p){$('spPick').hidden=p!=='p';$('spGame').hidden=p!=='g';if(p==='g')setTimeout(fit,0);if(p==='p')search()}
function myRank(){return G?G.me:(ST&&ST.me)||0}
/* ---------- pick a batch ---------- */
async function search(){
  const q=$('spQ').value.trim().toLowerCase(),box=$('spRes');let r;try{r=await api.spore_search({q})}catch(e){r=null}
  if(!alive||batch)return;
  box.textContent='';
  if(!r||!r.ok){$('spRs').textContent=(r&&r.error)||'Spore is unavailable right now.';return}
  setLeft(r.left);
  const list=r.batches||[];$('spRs').textContent=list.length?'':'No batches found. Create one.';
  list.forEach(x=>{const d=document.createElement('div');d.className='nsitem';d.innerHTML='<div><b></b><small></small></div>';
    d.querySelector('b').textContent=x.batch;d.querySelector('small').textContent='by '+(x.o||'a member')+' · '+x.n+'/'+USERS+(x.live?' · in progress':'');
    const b=document.createElement('button');b.type='button';b.className='btn';b.textContent='Join';b.disabled=x.n>=USERS||x.live;b.onclick=()=>join(x.batch,false);d.appendChild(b);box.appendChild(d)});
}
const tabs={spTS:'spPS',spTC:'spPC',spTJ:'spPJ'};
Object.keys(tabs).forEach(k=>$(k).onclick=()=>{Object.keys(tabs).forEach(j=>{$(j).setAttribute('aria-pressed',String(j===k));$(tabs[j]).hidden=j!==k});if(k==='spTS')search()});
let spQt;$('spQ').oninput=()=>{clearTimeout(spQt);spQt=setTimeout(search,300)};
$('spCf2').onchange=()=>{$('spKw').hidden=!$('spCf2').checked};
$('spPC').addEventListener('submit',async e=>{
  e.preventDefault();const n=clean($('spCn').value),priv=$('spCf2').checked,k=$('spCk').value.trim(),err=$('spCe');
  if(n.length<3){err.textContent='Batch name needs 3+ characters.';return}
  if(priv&&k.length<4){err.textContent='Friends key needs 4+ characters.';return}
  err.textContent='';
  if(priv){join('f-'+n+'-'+hash(n+'|'+k),false);return}
  let r;try{r=await api.spore_create({batch:n})}catch(x){r=null}
  if(!r||!r.ok){err.textContent=(r&&r.error)||'Could not create the batch.';return}
  join(r.batch,false)});
$('spPJ').addEventListener('submit',e=>{
  e.preventDefault();const n=clean($('spJn').value),k=$('spJk').value.trim();
  if(!n||!k){$('spJe').textContent='Enter the batch name and friends key.';return}
  $('spJe').textContent='';join('f-'+n+'-'+hash(n+'|'+k),false)});
async function random(){
  let r;try{r=await api.spore_random({})}catch(e){r=null}
  if(!r||!r.ok){$('spRe').textContent=(r&&r.error)||'Could not find a batch right now.';return}
  join(r.batch,true)}
$('spRnd').onclick=()=>{rtries=0;$('spRe').textContent='';random()};
/* ---------- lifecycle ---------- */
function reset(){clearTimeout(timer);timer=0;busy=false;ST=null;G=null;sel=null;after=0;scan={};loc=[];settled=false;$('spOver').hidden=true;$('spLog').textContent='';$('spChat').textContent=''}
function leaveLocal(msg){
  const b=batch;reset();batch='';
  if(msg!==undefined)$('spRe').textContent=msg;
  view('p');return b}
function join(name,rnd){
  reset();batch=name;isRnd=!!rnd;
  $('spMeta').textContent='batch '+name.replace(/^f-(.*)-[a-z0-9]+$/,'$1 (friends)');
  sys('Connected. Only members in this batch can see this chat.');
  view('g');ui();schedule(0)}
function schedule(ms){clearTimeout(timer);if(alive&&batch)timer=setTimeout(tick,ms)}
async function tick(){
  if(!alive||!batch)return;
  if(document.hidden||busy){schedule(1000);return}
  busy=true;const b=batch;let r;
  try{r=await api.spore_state({batch:b,seen,after})}catch(e){r=null}
  busy=false;if(!alive||b!==batch)return;
  if(r&&r.left!=null)setLeft(r.left);
  if(r&&r.gone){
    if(isRnd&&++rtries<5){leaveLocal();say('Batch full or in progress. Finding another.','warn');random();return}
    leaveLocal(r.error||'That batch is full or in progress.');return}
  if(r&&r.status==='denied'){leaveLocal(r.error||'Access denied.');return}
  if(r&&r.ok)apply(r);
  schedule(G&&!G.over?900:1500)}
function apply(r){
  if(r.left!=null)setLeft(r.left);
  ST=r;G=r.game||null;settled=true;
  if(G){elAt=G.el;tAt=performance.now()}
  if(G&&G.over){const w=G.win;$('spOres').textContent=w?'Network survived!':'Network lost.';$('spOres').className=w?'sp-ok':'sp-bad';
    $('spOt').textContent=String(G.why||'');$('spOm').textContent=(w?'Each of the 5 users earned +5 merits.':'Each of the 5 users lost 2 merits.')+(lft!=null?' Attempts left today: '+lft+'/'+DAILY+'.':'');$('spOver').hidden=false}
  else $('spOver').hidden=true;
  (r.chat||[]).forEach(m=>{after=Math.max(after,m.id);line(m.u?'User '+m.u:'?',m.t,m.u&&m.u===myRank())});
  renderLog();ui()}
$('spLeave').onclick=async()=>{const b=batch;leaveLocal('');if(b)try{api.spore_leave({batch:b})}catch(e){}};
$('spAgain').onclick=()=>{if(G)seen=G.id;G=null;sel=null;$('spOver').hidden=true;$('spLog').textContent='';loc=[];ui();schedule(0)};
/* ---------- log + chat ---------- */
function say(m,c){loc.unshift([m,c||'']);loc=loc.slice(0,4);renderLog()}
function renderLog(){const box=$('spLog');box.textContent='';
  const rows=loc.concat(G&&G.ev?G.ev.slice().reverse():[]).slice(0,8);
  rows.forEach(e=>{const d=document.createElement('div');d.className=e[1]==='ok'?'sp-ok':e[1]==='bad'?'sp-bad':e[1]==='warn'?'sp-warn':'';d.textContent=String(e[0]).slice(0,120);box.appendChild(d)})}
function line(u,x,me){const d=document.createElement('div');d.className='nsm'+(me?' me':'');const b=document.createElement('b');b.textContent=u;d.append(b,document.createTextNode(x));$('spChat').appendChild(d);$('spChat').scrollTop=1e9}
function sys(x){const d=document.createElement('div');d.className='nsm sys';d.textContent=x;$('spChat').appendChild(d);$('spChat').scrollTop=1e9}
$('spCf').addEventListener('submit',async e=>{e.preventDefault();const x=$('spCi').value.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,140);
  if(!x||!batch||Date.now()-sentAt<1000)return;sentAt=Date.now();$('spCi').value='';
  let r;try{r=await api.spore_chat({batch,text:x})}catch(e){r=null}
  if(!r||!r.ok)sys((r&&r.error)||'Could not send.');else schedule(0)});
setInterval(()=>{const n=Date.now(),w=Math.floor(n/CW);if(w!==cw){cw=w;$('spChat').textContent='';sys('Chat reset. Previous messages are gone.')}const s=Math.ceil(((cw+1)*CW-n)/1000);$('spCc').textContent=Math.floor(s/60)+':'+String(s%60).padStart(2,'0')},1000);
setInterval(()=>{if(alive&&!batch&&!document.hidden&&!$('spPS').hidden&&!$('spPick').hidden)search()},20000);
/* ---------- game UI ---------- */
function leftMs(){return G&&!G.over?Math.max(0,DUR*1000-(elAt+performance.now()-tAt)):G&&G.over?0:DUR*1000}
function shown(i){const n=G&&G.nodes[i]?G.nodes[i]:null,s=scan[i];if(s&&s.u>Date.now())return s.inf?'inf':'ok';return n&&n.i?'inf':'ok'}
function ui(){
  const me=myRank(),play=!!G&&!G.over,roster=(ST&&ST.roster)||[],ready=!G&&me&&roster[me-1]&&roster[me-1].r;
  $('spL').textContent=G?'Home nodes safe: '+HOME.filter(h=>shown(h)==='ok').length+'/5':'Accepted: '+roster.filter(p=>p.r).length+'/5';
  $('spOn').textContent='nodes online: '+(G?USERS:roster.length)+'/'+USERS+(me?' · you are User '+me:'')+(!G&&roster.length<USERS?' · awaiting others':'')+(settled?'':' · joining…');
  $('spPlayers').innerHTML=[0,1,2,3,4].map(i=>{const p=roster[i],c=G?G.cures[i]:CURES,mine=i===me-1;
    return '<div class="sp-pl'+(mine?' me':'')+'"><b>'+(G||p?(mine?'You':'User '+(i+1)):'Empty')+'</b>'+(G?'<span class="sp-pips">'+'●'.repeat(c)+'<span class="sp-dim">'+'○'.repeat(CURES-c)+'</span></span>':'<span class="'+(p&&p.r?'sp-ok':'sp-dim')+'">'+(p?(p.r?'Ready':'Waiting'):'-')+'</span>')+'</div>'}).join('');
  $('spGo').hidden=!!G;$('spGo').disabled=!settled||!me||!!ready;$('spGo').textContent=ready?'Accepted. Waiting for the others...':'Start';
  ['spCode','spCure','spScan'].forEach(i=>$(i).hidden=!play);
  $('spCure').disabled=!play||sel===null||!me||G.cures[me-1]===0;const sc=Date.now()<scanUntil;$('spScan').disabled=!play||sel===null||sc;$('spScan').textContent=sc?'Scanning...':'Scan';
  const sh=sel===null?null:shown(sel),nd=sel!==null&&G?G.nodes[sel]:null;
  $('spInfo').textContent=sel===null?(play?'You are User '+me+'. Tap a node.':'Tap a node.'):'Node '+(sel+1)+HL(sel)+': '+(sh==='inf'?'infected.'+(play&&nd&&nd.c?' Cure code: '+nd.c:''):'looks healthy.');
}
$('spGo').onclick=async()=>{if(!batch)return;$('spGo').disabled=true;let r;try{r=await api.spore_ready({batch})}catch(e){r=null}
  if(r&&!r.ok)say(r.error||'Could not start.','bad');schedule(0)};
async function cure(){if(!batch||!G||G.over||sel===null)return;const n=sel,c=code.value;code.value='';$('spCure').disabled=true;
  let r;try{r=await api.spore_cure({game:G.id,node:n,code:c})}catch(e){r=null}
  if(!r||!r.ok)say((r&&r.error)||'Could not send the cure.','bad');schedule(0);ui()}
$('spCure').onclick=cure;code.onkeydown=e=>{if(e.key==='Enter')cure()};
$('spScan').onclick=()=>{if(!G||G.over||sel===null||Date.now()<scanUntil)return;const i=sel,gid=G.id;scanUntil=Date.now()+3000;say('Scanning Node '+(i+1)+'...');ui();
  setTimeout(async()=>{let r;try{r=await api.spore_scan({game:gid,node:i})}catch(e){r=null}
    if(r&&r.ok){scan[i]={u:Date.now()+10000,inf:!!r.inf};say('Scan: Node '+(i+1)+' is '+(r.inf?'infected.':'clean.'),'ok')}else say((r&&r.error)||'Scan failed.','bad');
    scanUntil=0;ui();setTimeout(ui,10100)},3000);setTimeout(ui,3050)};
cv.onclick=e=>{const r=cv.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;let b=null,bd=30;POS.forEach((n,i)=>{const d=Math.hypot(n.x*W-mx,n.y*H-my);if(d<bd){bd=d;b=i}});sel=b;ui()};
function draw(){
  if(!alive)return;
  if(document.hidden||$('spGame').hidden||V.perf.skip("spore")){requestAnimationFrame(draw);return}
  if(!W||W!==cv.clientWidth)fit();
  const me=myRank(),l=Math.ceil(leftMs()/1000);
  if($('spT').textContent!==String(l))$('spT').textContent=l;
  $('spBar').style.width=(leftMs()/(DUR*1000)*100)+'%';
  cx.clearRect(0,0,W,H);cx.strokeStyle='rgba(255,255,255,.14)';cx.lineWidth=1;
  ADJ.forEach((a,i)=>a.forEach(j=>{if(j<i)return;cx.beginPath();cx.moveTo(POS[i].x*W,POS[i].y*H);cx.lineTo(POS[j].x*W,POS[j].y*H);cx.stroke()}));
  POS.forEach((n,i)=>{
    const inf=shown(i)==='inf',x=n.x*W,y=n.y*H,hu=HOME.indexOf(i);
    cx.save();if(inf){cx.shadowColor='#ff6b73';cx.shadowBlur=16}
    cx.fillStyle=inf?'#ff6b73':'#dfe3ea';cx.beginPath();cx.arc(x,y,11,0,7);cx.fill();cx.restore();
    if(sel===i){cx.strokeStyle='#fff';cx.lineWidth=2;cx.beginPath();cx.arc(x,y,21,0,7);cx.stroke();cx.lineWidth=1}
    if(hu>=0){cx.strokeStyle='#8fe3a8';cx.lineWidth=hu===me-1?3:2;cx.beginPath();cx.arc(x,y,15,0,7);cx.stroke();cx.lineWidth=1}
    cx.fillStyle=hu>=0?'#f0f1f4':'#7d8088';cx.font='10px ui-monospace,monospace';cx.textAlign='center';cx.fillText(hu>=0?(hu===me-1?'YOU':'U'+(hu+1)):i+1,x,y+28);
  });
  requestAnimationFrame(draw)}
addEventListener('resize',fit);
V.spore={
  enter(){if(alive)return;alive=true;draw();if(batch){const b=batch;batch='';join(b,isRnd)}else view('p')},
  stop(){alive=false;clearTimeout(timer);timer=0;busy=false}
};
})(window.ILLUMINATI);
}catch(e){console.error(e)}
try{
(function(V){
const $=(s,r)=>(r||document).querySelector(s),api=V.services.api,esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>"&#"+c.charCodeAt(0)+";");
let cur="intro",back="done",entered=false,M=[],BI=[],nb=0,LB={remove:"Delete",ban:"Ban",unban:"Unban"};
/* Portal lock (member side): the server decides and enforces it on every request; this page only shows the notice and freezes the screen */
let PL=null,plBusy=false,plLast=0;
const leftTxt=ms=>{let s=Math.max(0,Math.ceil(ms/1000));const d=Math.floor(s/86400);s%=86400;const h=Math.floor(s/3600);s%=3600;const m=Math.floor(s/60);s%=60;const p=n=>String(n).padStart(2,"0");return(d?d+"d ":"")+p(h)+":"+p(m)+":"+p(s)};
function plTick(){if(!PL)return;const c=$("#plc");if(!PL.until){c.textContent="The founder will reopen the portal.";return}
 const rem=Date.parse(PL.until)-(Date.now()+PL.off);if(rem<=0){c.textContent="Reopening\u2026";plCheck();return}c.textContent="Reopens in "+leftTxt(rem)}
function showLock(r){if(!r)return;const first=!PL;PL={until:r.until||null,off:(+r.now||Date.now())-Date.now()};$("#plm").textContent=String(r.message||"");plTick();if(!first)return;
 document.body.classList.add("plocked");["main","#tabs","#cats","#fbtn","#lbtn"].forEach(q=>document.querySelectorAll(q).forEach(e=>{e.inert=true}));
 try{glStop()}catch(e){}setInterval(plTick,1000)}
async function plCheck(){if(plBusy||document.body.classList.contains("owner"))return;plBusy=true;plLast=Date.now();let r;try{r=await api.lock_status()}catch(e){r=null}plBusy=false;
 if(!r||!r.ok)return;if(r.locked)showLock(r);else if(PL)location.reload()}
V.onlock=showLock;
setInterval(()=>{if(!document.hidden&&(PL||entered)&&(PL||Date.now()-plLast>=120000))plCheck()},10000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&(PL||entered)&&(PL||Date.now()-plLast>=120000))plCheck()});

const meP=api.me().catch(()=>({status:"none"}));
/* Keep the Telegram name current: on every open (and whenever the app comes back to the foreground) compare it with the saved one and update it if it changed. Silent; ignored if it fails. */
let tgSaved=null,tgBusy=false;
async function tgSync(){if(tgBusy||tgSaved===null||!api.set_tg_name)return;const t=tgInfo();if(!t.tg_name||t.tg_name===tgSaved)return;tgBusy=true;try{const r=await api.set_tg_name(t);if(r&&r.ok)tgSaved=t.tg_name}catch(e){}tgBusy=false}
meP.then(r=>{try{if(r&&r.member){tgSaved=String(r.member.tg_name||"");tgSync()}}catch(e){}});
document.addEventListener("visibilitychange",()=>{if(!document.hidden)tgSync()});
try{V.tg.app&&V.tg.app.onEvent&&V.tg.app.onEvent("activated",tgSync)}catch(e){}
let clvF=null;
/* Conclave runs in a sandboxed frame (opaque origin): it cannot touch this page, cookies or storage. It only gets the login data it must send to the server,
   and talks back through two checked messages (red-card room, ready). Messages are accepted only from that exact frame. */
function clvInit(){let o={d:"",p:"",u:null};try{const t=window.Telegram&&Telegram.WebApp;if(t){const u=t.initDataUnsafe&&t.initDataUnsafe.user;o={d:String(t.initData||""),p:String(t.platform||""),u:u?{username:String(u.username||"").slice(0,64),first_name:String(u.first_name||"").slice(0,64)}:null}}}catch(e){}return encodeURIComponent(JSON.stringify(o))}
window.addEventListener("message",ev=>{if(!clvF||ev.source!==clvF.contentWindow)return;const m=ev.data;if(!m||m.clv!=="red")return;const R=window.ILLUMINATI&&window.ILLUMINATI.red;if(!R)return;try{if(m.op==="leave")R.clear();else if(m.op==="room"&&typeof m.batch==="string"&&m.batch.length<=64)R.room("conclave",m.batch)}catch(e){}});
function clvOpen(){const w=document.getElementById("clvWrap");if(!w||clvF)return;clvF=document.createElement("iframe");clvF.id="clvFrame";clvF.title="Conclave";clvF.setAttribute("sandbox","allow-scripts");clvF.setAttribute("allow","fullscreen; clipboard-write");const t=document.getElementById("clvTpl");if(!t)return;const c=t.content.cloneNode(true),st=c.querySelector("style"),sd=document.createElement("div");sd.appendChild(c);clvF.srcdoc='<!DOCTYPE html><html lang="en" data-embed="1"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no"><meta name="color-scheme" content="dark"><meta name="clv-init" content="'+clvInit()+'"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&display=swap">'+(st?st.outerHTML:"")+'</head><body>'+(st?(st.remove(),sd.innerHTML):sd.innerHTML)+'<scr'+'ipt src="js/conclave.js"></scr'+'ipt></body></html>';w.appendChild(clvF)}
function go(n){if(n===cur)return;if(n==="conclave"&&!document.body.classList.contains("member"))return;if(n==="nodezero"&&!document.body.classList.contains("member")&&!document.body.classList.contains("owner"))return;if(["founders","lock","veil","arcup","recset","voteset","redset","nzset","security"].includes(n)&&!document.body.classList.contains("owner"))return;const nx=$('.view[data-view="'+n+'"]'),pv=$('.view[data-view="'+cur+'"]');
 pv.classList.add("out");pv.classList.remove("on");setTimeout(()=>pv.classList.remove("out"),520);
 nx.classList.add("on");nx.scrollTop=0;cur=n;document.body.dataset.view=n;if(n==="conclave"){try{clvOpen()}catch(e){console.error(e)}}try{if(n!=="intro"&&V.pyramid&&V.pyramid.stop)V.pyramid.stop();V.tg.haptic("light");V.card&&(V.card.view(n==="done"),(n==="letter"||n==="form")&&V.card.warm())}catch(e){console.error(e)}
 document.querySelectorAll("#cats button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.go===n)));document.body.classList.remove("menu-open");if(n==="merits")loadMerits();if(n==="web")webLoad();try{if(n==="genesis")glStart();else glStop()}catch(e){console.error(e)}try{if(V.spore){if(n==="spore")V.spore.enter();else V.spore.stop()}}catch(e){console.error(e)}try{V.tools&&V.tools.onView(n)}catch(e){}try{const bb=V.tg.app&&V.tg.app.BackButton;if(bb)n==="founders"||n==="lock"?bb.show():bb.hide()}catch(e){}}
let MEM=null,justDec=false;
const MASK="VC-\u2022\u2022Q\u2022-\u2022\u2022\u2022\u2022-\u2022\u2022\u2022\u2022-\u2022\u2022\u2022\u2022";
/* new members see the code only after one node sync; everyone else sees it right away */
const tierOf=m=>{if(m&&(m.tier==="initiate"||m.tier==="founding"))return m.tier;const t=Date.parse(m&&(m.at||m.created_at)||""),f=Date.parse(V.config.initiateFrom||"");return isFinite(t)&&isFinite(f)&&t>=f?"initiate":"founding"};
V.tierOf=tierOf;
function paintCode(){const m=MEM;if(!m)return;const lk=V.gate.locked(m);
 V.card&&V.card.set(m.name,lk?"":m.code,lk,tierOf(m));{const ds=$("#ds");if(ds)ds.textContent=tierOf(m)==="initiate"?"Initiate":"Founding Member"}
 $("#dcode").textContent=lk?MASK:m.code;$("#dcode").dataset.lk=lk?"1":"";$(".codebox").classList.toggle("lk",lk);
 $("#cdec").style.display=lk?"":"none";$("#clockn").style.display=lk?"":"none";
 $("#ccopy").style.display=lk?"none":"";$("#chelp").style.display=lk?"none":""}
function scramble(){const el=$("#dcode"),t=MEM.code,A="0123456789ABCDEFGHJKMNPQRSTVWXYZ";let n=0;const iv=setInterval(()=>{n++;const k=Math.floor(t.length*n/24);el.textContent=n>=24?t:t.split("").map((c,i)=>i<k||c==="-"?c:A[Math.floor(Math.random()*A.length)]).join("");if(n>=24)clearInterval(iv)},45)}
function startSync(mode,kind){V.sync.start(mode,kind);go("sync")}
function show(m){MEM=m;if(typeof m.locked!=="boolean"&&V.gate.isNew(m)&&!V.gate.isDecrypted())V.gate.markPending();V.sync.setUser(m.username||"");if(typeof m.web==="boolean")paintWeb(m.web);paintCode();$("#dn").textContent=m.name;$("#dc").textContent=m.country;$("#du").textContent=m.username?"@"+m.username:"Not set";$("#uclaim").style.display=m.username?"none":"block"}
async function enter(){if(entered)return;entered=true;const r=await meP;await V.gate.ready;if(r.status==="locked"){showLock(r);return}if(r.status==="error"){if(r.error)$("#dmsg").textContent=r.error;go("denied");return}if(r.status==="denied"||!r.status){document.body.classList.add("locked");if(r.error)$("#dmsg").textContent=r.error;go("denied");return}document.body.classList.add("ready");
 if(V.services.isOwner(r))document.body.classList.add("owner");else document.querySelectorAll("#cats .own,#fbtn,#lbtn").forEach(e=>e.remove());
 if(r.status==="banned")go("banned");else if(r.status==="member"&&r.member){document.body.classList.add("member");show(r.member);go("done")}else go("letter")}
setTimeout(enter,4800);
addEventListener("click",()=>{if(cur==="intro"&&performance.now()>1800)enter()});
document.addEventListener("click",e=>{const b=e.target.closest("[data-go]");if(b)go(b.dataset.go)});

try{const dn=new Intl.DisplayNames(["en"],{type:"region",fallback:"none"}),skip="EU UN EZ QO ZZ XA XB AC CP DG EA IC TA".split(" "),L=[];
 for(let a=65;a<91;a++)for(let b=65;b<91;b++){const c=String.fromCharCode(a,b),n=skip.includes(c)?null:dn.of(c);if(n)L.push(n)}
 L.sort((x,y)=>x.localeCompare(y));$("#ct").insertAdjacentHTML("beforeend",L.map(n=>'<option>'+n+'</option>').join(""))}catch(e){}
$("#dob").max=new Date().toISOString().slice(0,10);

/* Telegram account name (first + last name on the Telegram profile). Kept separately from the name typed in the form. */
function tgInfo(){const u=V.tg&&V.tg.user;if(!u)return{tg_name:"",tg_username:""};const cl=x=>String(x||"").replace(/\s+/g," ").trim().slice(0,128);return{tg_name:cl([u.first_name,u.last_name].filter(Boolean).join(" ")),tg_username:cl(u.username).slice(0,64)}}
$("#sub").addEventListener("click",async()=>{
 const err=$("#err"),g=$('input[name="g"]:checked'),p={name:$("#fn").value.trim().replace(/\s+/g," "),dob:$("#dob").value,country:$("#ct").value,gender:g?g.value:"",username:$("#un").value.trim().replace(/^@/,"").toLowerCase(),...tgInfo()};
 const bad=!/\p{L}.*\p{L}/u.test(p.name)?"Enter your full name.":!p.dob||p.dob>$("#dob").max||p.dob<"1900-01-01"?"Enter a valid date of birth.":!p.country?"Select your country of residence.":!p.gender?"Select your gender.":!p.username?"Choose a username.":!/^[a-z][a-z0-9_]{2,19}$/.test(p.username)?"Username must be 3-20 characters: letters, numbers, underscore, starting with a letter.":$("#un").dataset.ok==="0"?"That username is already taken.":"";
 err.textContent=bad;if(bad)return;
 const btn=$("#sub");btn.disabled=true;V.tg.haptic("medium");
 let r;try{r=await api.register(p)}catch(e){r={ok:false}}
 if(r&&r.status==="denied"){document.body.classList.add("locked");go("denied");return}if(!r||!r.ok||!r.member){err.textContent=(r&&r.error)||"Submission failed. Check your connection and try again.";btn.disabled=false;return}
 V.gate.markPending();show(r.member);go("done")});

/* Username: live availability check (the server still enforces uniqueness at save time) */
function watch(inp,hint){let t=0;inp.addEventListener("input",()=>{const k=++t;inp.value=inp.value.toLowerCase().replace(/[^a-z0-9_@]/g,"").replace(/^@/,"");const v=inp.value;inp.dataset.ok="";hint.className="note un";
  if(!v){hint.textContent="";return}
  if(!/^[a-z][a-z0-9_]{2,19}$/.test(v)){hint.textContent="3-20 characters: letters, numbers, underscore. Start with a letter.";return}
  hint.textContent="Checking availability...";
  setTimeout(async()=>{if(k!==t)return;let r;try{r=await api.check_username(v)}catch(e){r=null}if(k!==t)return;
   if(!r||!r.ok){hint.textContent=(r&&r.error)||"Could not check right now.";return}
   if(r.available){inp.dataset.ok="1";hint.className="note un ok";hint.textContent="@"+v+" is available"}else{inp.dataset.ok="0";hint.className="note un no";hint.textContent=r.error||"@"+v+" is already taken"}},450)})}
watch($("#un"),$("#unh"));watch($("#uc"),$("#uch"));
$("#ucb").addEventListener("click",async()=>{const v=$("#uc").value.trim(),h=$("#uch");if(!/^[a-z][a-z0-9_]{2,19}$/.test(v)||$("#uc").dataset.ok==="0"){h.className="note un no";h.textContent=$("#uc").dataset.ok==="0"?"That username is already taken.":"Enter a valid username first.";return}
 const b=$("#ucb");b.disabled=true;let r;try{r=await api.set_username(v)}catch(e){r=null}b.disabled=false;
 if(r&&r.ok){$("#du").textContent="@"+r.username;if(MEM)MEM.username=r.username;V.sync.setUser(r.username);$("#uclaim").style.display="none"}else{h.className="note un no";h.textContent=(r&&r.error)||"Could not save. Try again."}});

/* Copy member code */
async function copyText(t){try{await navigator.clipboard.writeText(t);return true}catch(e){}
 try{const a=document.createElement("textarea");a.value=t;a.setAttribute("readonly","");a.style.cssText="position:fixed;top:0;left:0;opacity:0";document.body.appendChild(a);a.select();a.setSelectionRange(0,t.length);const ok=document.execCommand("copy");a.remove();return ok}catch(e){return false}}
$("#ccopy").addEventListener("click",async()=>{const b=$("#ccopy"),l=b.querySelector("span"),t=$("#dcode").textContent.trim();if(!t||$("#dcode").dataset.lk)return;const ok=await copyText(t);V.tg.haptic(ok?"medium":"light");l.textContent=ok?"Copied":"Copy failed";b.classList.toggle("ok",ok);clearTimeout(b._t);b._t=setTimeout(()=>{l.textContent="Copy code";b.classList.remove("ok")},1800)});
$("#dcode").addEventListener("click",()=>{if(!$("#dcode").dataset.lk)$("#ccopy").click()});
$("#cdec").addEventListener("click",()=>startSync("decrypt"));
$("#chelp").addEventListener("click",()=>startSync("help"));
V.sync.onwin=async(mode,x,kind)=>{if(kind==="recover"){try{V.recover&&V.recover.refresh()}catch(e){}return}if(kind==="web"){if(mode==="decrypt")paintWeb(true);return}if(!MEM||!V.gate.locked(MEM))return;
 if(typeof MEM.locked==="boolean"){let r;try{r=await api.me()}catch(e){r=null}if(r&&r.member&&r.member.locked===false){justDec=true;show(r.member)}}
 else{V.gate.markDecrypted();justDec=true;paintCode()}};
V.sync.onexit=(reveal,kind)=>{if(kind==="recover"){go("archive");return}if(kind==="web"){go("web");return}go("done");if(reveal&&justDec&&MEM){justDec=false;setTimeout(scramble,450)}};

/* Merits + Hall of Merit (the server decides what each row shows; member codes are never listed) */
const fmt=n=>(+n||0).toLocaleString("en-US");
async function loadMerits(){const hl=$("#hall");hl.innerHTML='<p class="note">Loading\u2026</p>';let r;try{r=await api.merits()}catch(e){r=null}
 const ok=!!(r&&r.ok),me=ok&&r.me?r.me:null,rows=ok&&Array.isArray(r.members)?r.members:[];
 $("#mv").textContent=fmt(me&&me.merits);$("#mr").textContent=me&&me.rank?"#"+me.rank:"\u2014";$("#ms").textContent=me&&me.status?me.status:"Active";
 $("#hc").textContent=rows.length?rows.length+(rows.length===1?" member":" members"):"";
 if(ok&&typeof r.wallet==="boolean")paintWallet(r.wallet);hl.innerHTML=rows.length?rows.map(m=>'<div class="hr'+(m.you?' me':'')+'"><span class="hk'+(m.rank<=3?' top':'')+'">'+String(m.rank).padStart(2,"0")+'</span><span class="hn"><b>'+esc(m.label||"Anonymous member")+(m.you?'<em>You</em>':'')+'</b><span class="st '+(String(m.status||"Active").toLowerCase()==="active"?"ok":"no")+'">'+esc(m.status||"Active")+'</span></span><span class="hm">'+fmt(m.merits)+'</span></div>').join(""):'<p class="note">No standings yet.</p>'}

/* Genesis Lock: live metrics from the backend (progress = members/150,000, accuracy = merits/1,000,000) */
let glT=0,glBusy=false,glAt=0;const GL_TTL=6*3600*1000;
const pct=v=>{v=+v||0;return v>0&&v<0.01?"<0.01%":v>=100?"100%":v.toFixed(2)+"%"};
function paintWallet(un){document.querySelectorAll(".wallet:not(.web)").forEach(w=>{w.classList.toggle("open",!!un);w.setAttribute("aria-label","BTC Wallet, "+(un?"unlocked":"locked"));const t=w.querySelector(".wt span"),p=w.querySelector(".wp");if(t)t.textContent=un?"Unlocked. Genesis Lock fully synchronized.":(w.id==="glw"?"Unlocks at full synchronization.":"Locked. Not accessible.");if(p)p.textContent=un?"Open":"Locked"})}
async function glLoad(){if(glBusy||(glAt&&Date.now()-glAt<GL_TTL))return;glBusy=true;let r;try{r=await api.genesis()}catch(e){r=null}glBusy=false;
 if(!r||!r.ok)return;glAt=Date.now();const p=Math.max(0,Math.min(100,+r.progress||0)),un=!!r.unlocked;
 $("#glp").textContent=pct(p);$("#glb").style.width=p+"%";$("#glb").parentNode.setAttribute("aria-valuenow",p.toFixed(2));
 $("#glo").textContent=fmt(r.online);$("#gls").textContent=(+r.stability||0).toFixed(1)+"%";$("#gla").textContent=pct(r.accuracy);
 const st=$("#glst");st.classList.toggle("ok",un);st.textContent=un?"Status: Fully Synchronized":"Status: Awaiting Full Synchronization";paintWallet(un)}
function glStart(){glStop();glLoad();glT=setInterval(()=>{if(!document.hidden)glLoad()},GL_TTL)}
function glStop(){clearInterval(glT);glT=0}

/* Access Web: locked until a 100-node synchronization is decrypted (the server decides, this only shows it) */
let webBusy=false;
function paintWeb(un){un=!!un;const w=$("#webw");w.classList.toggle("open",un);w.setAttribute("aria-label","Web access, "+(un?"unlocked":"locked"));
 w.querySelector(".wt span").textContent=un?"Unlocked. Your node synchronization is decrypted.":"Locked. Decrypt a 100-node synchronization to unlock.";$("#webp").textContent=un?"Open":"Locked";
 $("#webdec").style.display=un?"none":"";$("#webgo").style.display=un?"":"none";$("#webhelp").style.display=un?"":"none";
 $("#webn").textContent=un?"Web access is unlocked permanently. You can still join a batch to help other members reach 100 nodes. You earn 10 merits for every new member you help unlock.":"The decryption runs once. Join a batch with other members, rebuild your reference code before the 7 second timer ends, and when 100 nodes align together web access opens permanently."}
async function webLoad(){if(webBusy)return;webBusy=true;let r;try{r=await api.web_status()}catch(e){r=null}webBusy=false;if(r&&r.ok)paintWeb(r.web)}
$("#webdec").addEventListener("click",()=>startSync("decrypt","web"));
$("#webgo").addEventListener("click",()=>{const u="https://vssociety.site";try{const t=V.tg.app;if(t&&t.openLink){t.openLink(u);return}}catch(e){}window.open(u,"_blank","noopener")});
$("#webhelp").addEventListener("click",()=>startSync("help","web"));

/* Founders (owner only; the backend enforces this too) */
async function load(){const r=await api.list();if(!r||!r.ok){$("#fl").innerHTML="<p>"+esc((r&&r.error)||"Could not load members.")+"</p>";return}M=r.members||[];BI=Array.isArray(r.banned_ids)?r.banned_ids:[];nb=Array.isArray(r.banned_ids)?BI.length:(r.banned||0);draw()}
const PN={};const paintMerit=id=>{const m=M.find(x=>x.uid===id);if(!m)return;document.querySelectorAll("#fl .mv").forEach(el=>{if(el.dataset.uid!==id)return;el.textContent=+m.merits||0;el.classList.remove("pop");void el.offsetWidth;el.classList.add("pop")})};
const MB=id=>[-5,-1,1,5].map(n=>'<button data-merit="'+n+'" data-id="'+esc(id)+'">'+(n<0?"\u2212":"+")+Math.abs(n)+'</button>').join("");
function draw(){const q=$("#fq").value.trim().toLowerCase(),BS=new Set(BI.concat(M.filter(m=>m.banned).map(m=>m.uid))),
 rows=M.filter(m=>[m.code,m.legacy_code,m.username,m.name,m.tg_name,m.country,m.uid,m.tg||m.tg_username].join(" ").toLowerCase().includes(q)),
 orph=[...BS].filter(id=>!M.some(m=>m.uid===id)&&String(id).toLowerCase().includes(q));
 $("#fc").textContent=M.length+" members, "+BS.size+" banned";
 const bt=(a,id,banned)=>'<button class="'+(a==="remove"?"del":a)+'" data-act="'+a+'" data-id="'+esc(id)+'">'+LB[a]+'</button>';
 $("#fl").innerHTML=rows.map(m=>{const bn=BS.has(m.uid);return '<div class="mem"><div class="mh"><b>'+esc(m.code)+(bn?'<span class="tag">Banned</span>':'')+'</b><div class="ma">'+bt("remove",m.uid)+(bn?bt("unban",m.uid):bt("ban",m.uid))+'</div></div><dl><dt>Name</dt><dd>'+esc(m.name)+'</dd><dt>Status</dt><dd><b>'+(tierOf(m)==="initiate"?"Initiate":"Founding Member")+'</b> <button type="button" class="lbt" data-tier="'+(tierOf(m)==="initiate"?"founding":"initiate")+'" data-id="'+esc(m.uid)+'">'+(tierOf(m)==="initiate"?"Make founding member":"Make initiate")+'</button></dd><dt>Telegram name</dt><dd>'+esc(m.tg_name||'-')+'</dd><dt>User</dt><dd>'+(m.username?'@'+esc(m.username):'-')+'</dd><dt>Old code</dt><dd>'+esc(m.legacy_code||'-')+'</dd><dt>Merits</dt><dd><b class="mv" data-uid="'+esc(m.uid)+'">'+(+m.merits||0)+'</b><span class="mc">'+MB(m.uid)+'</span></dd><dt>Born</dt><dd>'+esc(m.dob)+'</dd><dt>Country</dt><dd>'+esc(m.country)+'</dd><dt>Gender</dt><dd>'+esc(m.gender)+'</dd><dt>Account</dt><dd>'+esc(m.uid)+((m.tg||m.tg_username)?" @"+esc(m.tg||m.tg_username):"")+'</dd><dt>Joined</dt><dd>'+esc(String(m.at||m.created_at||"").slice(0,10))+'</dd></dl></div>'}).join("")||"<p>No members found.</p>";
 if(orph.length)$("#fl").insertAdjacentHTML("beforeend",'<div class="bh">Banned, no longer a member</div>'+orph.map(id=>'<div class="mem"><div class="mh"><b>'+esc(id)+'<span class="tag">Banned</span></b><div class="ma">'+bt("unban",id)+'</div></div></div>').join(""))}
$("#fbtn").onclick=async()=>{back=cur;go("founders");await load()};
/* Live refresh of the members list while the Founders view is open (skipped while a confirm button is armed or a merit tap is in flight) */
setInterval(async()=>{if(cur!=="founders"||document.hidden||Object.values(PN).some(v=>v>0)||document.querySelector("#fl [data-arm='1']"))return;const q=$("#fq");const r=await api.list().catch(()=>null);if(!r||!r.ok||cur!=="founders"||Object.values(PN).some(v=>v>0)||document.querySelector("#fl [data-arm='1']"))return;M=r.members||[];BI=Array.isArray(r.banned_ids)?r.banned_ids:[];nb=Array.isArray(r.banned_ids)?BI.length:(r.banned||0);const y=$("#fl").scrollTop;draw();$("#fl").scrollTop=y},60000);
$("#fback").onclick=()=>go(back);
try{V.tg.app&&V.tg.app.BackButton&&V.tg.app.BackButton.onClick(()=>{if(cur==="founders"||cur==="lock")go(back)})}catch(e){}
$("#fq").oninput=draw;
$("#fl").onclick=async e=>{const mb=e.target.closest("[data-merit]");if(mb){const id=mb.dataset.id,d=+mb.dataset.merit,m=M.find(x=>x.uid===id);if(!m)return;
  const prev=+m.merits||0,gain=Math.max(0,prev+d)-prev;if(!gain)return;
  m.merits=prev+gain;paintMerit(id);V.tg.haptic("light");PN[id]=(PN[id]||0)+1;
  let r;try{r=await api.award_merit({id,delta:gain})}catch(x){r=null}
  PN[id]--;
  if(r&&r.ok){if(!PN[id]&&typeof r.merits==="number"){m.merits=r.merits;paintMerit(id)}}
  else{m.merits=Math.max(0,(+m.merits||0)-gain);paintMerit(id);mb.textContent="Failed";setTimeout(()=>{mb.textContent=(d<0?"\u2212":"+")+Math.abs(d)},1200)}
  return}
 const tb=e.target.closest("[data-tier]");if(tb){if(tb.disabled)return;const id=tb.dataset.id,t=tb.dataset.tier,m=M.find(x=>x.uid===id);if(!m)return;tb.disabled=true;let r;try{r=await api.set_tier({id,tier:t})}catch(x){r=null}if(r&&r.ok){m.tier=r.tier==="initiate"?"initiate":"founding";draw()}else{tb.disabled=false;tb.textContent="Failed. Try again"}return}
 const b=e.target.closest("[data-act]");if(!b)return;const a=b.dataset.act;
 if(a!=="unban"&&!b.dataset.arm){b.dataset.arm=1;b.textContent="Tap again to confirm";setTimeout(()=>{b.dataset.arm="";b.textContent=LB[a]},4000);return}
 b.disabled=true;let r;try{r=await api[a](b.dataset.id)}catch(x){r=null}if(r&&r.ok)await load();else{b.disabled=false;b.textContent="Failed. Try again"}};

/* Portal lock: founder controls. The backend enforces the lock, the exceptions and the expiry; the founder is never locked out. */
let LK=null,LM=[],EXS=new Set(),lkLast=0,lkBusy=false,UL=[],lkUT=0;
const lkNote=(t,bad)=>{const n=$("#lnote");n.textContent=t||"";n.style.color=bad?"#ff9a9a":""};
const lkName=id=>{const m=LM.find(x=>x.uid===id);return m?(m.username?"@"+m.username:(m.name||id)):id};
const lkCnt=()=>{$("#lcnt").textContent=$("#lmsg").value.length+"/500"};
function lkDraw(){const q=$("#lq").value.trim().toLowerCase();
 $("#lex").innerHTML=EXS.size?[...EXS].map(id=>'<button type="button" class="lchip" data-lx="'+esc(id)+'" aria-label="Remove exception">'+esc(lkName(id))+' \u00d7</button>').join(""):'<p class="note" style="margin:0">No exceptions yet. Only you can enter while the portal is locked.</p>';
 const rows=LM.filter(m=>!q||[m.username,m.name,m.tg_name,m.code,m.uid,m.tg_username,m.tg].join(" ").toLowerCase().includes(q)).slice(0,40);
 $("#llist").innerHTML=rows.map(m=>{const on=EXS.has(m.uid);return '<div class="lrow"><div class="lwho"><b>'+esc(m.username?"@"+m.username:(m.name||"Member"))+'</b><small>'+esc(m.name||"")+' \u00b7 '+esc(m.uid)+'</small></div><button type="button" class="lbt'+(on?" on":"")+'" data-la="'+esc(m.uid)+'">'+(on?"Allowed":"Allow")+'</button></div>'}).join("")||'<p class="note">No members found.</p>'}
function lkPaint(){if(!LK)return;const s=$("#lkst"),rem=LK.locked&&LK.until?Date.parse(LK.until)-(Date.now()+LK.off):null;
 if(rem!==null&&rem<=0&&Date.now()-lkLast>4000){lkLoad();return}
 s.className="lkst"+(LK.locked?" on":"");
 s.textContent=LK.locked?(rem!==null?"Portal locked. Reopens automatically in "+leftTxt(rem):"Portal locked until you unlock it."):"Portal open. Members have full access.";
 const g=$("#lgo");if(!g.dataset.arm)g.textContent=LK.locked?"Unlock portal":"Lock portal";
 $("#lrs").style.display=LK.locked?"":"none";$("#lst").textContent=LK.locked?"Locked":"Open"}
function lkApply(r,fill){LK={locked:!!r.locked,until:r.until||null,off:(+r.now||Date.now())-Date.now()};lkLast=Date.now();
 if(fill){$("#lmsg").value=r.message||"";lkCnt();EXS=new Set(Array.isArray(r.exceptions)?r.exceptions:[])}UL=Array.isArray(r.users)?r.users:[];lkPaint();lkDraw();lkUDraw()}
async function lkLoad(fill){if(lkBusy)return;lkBusy=true;lkLast=Date.now();let r;try{r=await api.lock_get()}catch(e){r=null}lkBusy=false;
 if(!r||!r.ok){lkNote((r&&r.error)||"Could not load the lock settings.",1);return}lkApply(r,fill)}
async function lkOpen(){lkNote("");$("#lq").value="";$("#luq").value="";ulNote("");LK=null;$("#lkst").className="lkst";$("#lkst").textContent="Loading\u2026";
 const l=api.list().catch(()=>null);await lkLoad(true);const r=await l;
 if(r&&r.ok&&Array.isArray(r.members)){LM=r.members;lkDraw();lkUDraw()}else if(!LM.length)lkNote("Could not load the member list.",1)}
function lkDraft(){const msg=$("#lmsg").value.trim();if(!msg){lkNote("Write the warning members will see.",1);return null}if(msg.length>500){lkNote("The warning is limited to 500 characters.",1);return null}return{message:msg,exceptions:[...EXS]}}
function lkMinutes(){const u=+$("#lunit").value;if(!u)return{ok:true,m:null};const n=Number($("#lnum").value),m=n*u;
 if(!Number.isInteger(n)||n<1||!Number.isInteger(m)||m>525600){lkNote("Enter a whole number, from 1 minute up to 365 days.",1);return{ok:false}}return{ok:true,m}}
async function lkSend(act,payload,btn){lkNote("");btn.disabled=true;let r;try{r=await api[act](payload)}catch(e){r=null}btn.disabled=false;
 if(r&&r.ok){lkApply(r,true);V.tg.haptic("medium");return true}lkNote((r&&r.error)||"Failed. Try again.",1);return false}
$("#lbtn").onclick=async()=>{back=cur;go("lock");await lkOpen()};
$("#lback").onclick=()=>go(back);
$("#lmsg").oninput=lkCnt;$("#lq").oninput=lkDraw;
$("#lunit").onchange=()=>{$("#lnum").disabled=!+$("#lunit").value};
$("#lex").onclick=e=>{const b=e.target.closest("[data-lx]");if(!b)return;EXS.delete(b.dataset.lx);lkDraw()};
$("#llist").onclick=e=>{const b=e.target.closest("[data-la]");if(!b)return;const id=b.dataset.la;
 if(EXS.has(id))EXS.delete(id);else{if(EXS.size>=100){lkNote("Up to 100 exceptions.",1);return}EXS.add(id)}lkNote("");lkDraw()};
$("#lsave").onclick=async()=>{const d=lkDraft();if(!d)return;if(await lkSend("lock_save",d,$("#lsave")))lkNote("Saved.")};
$("#lrs").onclick=async()=>{const d=lkDraft(),t=lkMinutes();if(!d||!t.ok)return;if(await lkSend("lock_set",Object.assign({locked:true,minutes:t.m},d),$("#lrs")))lkNote("Timer restarted.")};
$("#lgo").onclick=async()=>{const b=$("#lgo");if(!LK)return;
 if(!b.dataset.arm){b.dataset.arm="1";b.textContent=LK.locked?"Tap again to unlock":"Tap again to lock everyone out";clearTimeout(b._t);b._t=setTimeout(()=>{b.dataset.arm="";lkPaint()},4000);return}
 clearTimeout(b._t);b.dataset.arm="";
 if(LK.locked){if(await lkSend("lock_set",{locked:false},b))lkNote("Portal unlocked.");lkPaint();return}
 const d=lkDraft(),t=lkMinutes();if(!d||!t.ok){lkPaint();return}
 if(await lkSend("lock_set",Object.assign({locked:true,minutes:t.m},d),b))lkNote("Portal locked.");lkPaint()};
/* Lock one member: the founder locks a single member on their own (their own warning + timer, even while the portal is open). Enforced on the server. */
const ulNote=(t,bad)=>{const n=$("#lunote");if(!n)return;n.textContent=t||"";n.style.color=bad?"#ff9a9a":""};
function lkUDraw(){const q=$("#luq").value.trim().toLowerCase(),on=new Set(UL.map(x=>x.id)),me=String(V.gate.uid()||""),now=Date.now()+(LK?LK.off:0);
 $("#lul").innerHTML=UL.length?UL.map(x=>{const rem=x.until?Date.parse(x.until)-now:null;return '<button type="button" class="lchip" data-ux="'+esc(x.id)+'" aria-label="Unlock member">'+esc(lkName(x.id))+' \u00b7 <span class="lut" data-u="'+esc(x.until||"")+'">'+(rem!==null?leftTxt(rem):"until unlocked")+'</span> \u00d7</button>'}).join(""):'<p class="note" style="margin:0">No members are locked individually.</p>';
 const rows=LM.filter(m=>!on.has(m.uid)&&String(m.uid)!==me&&(!q||[m.username,m.name,m.tg_name,m.code,m.uid,m.tg_username,m.tg].join(" ").toLowerCase().includes(q))).slice(0,40);
 $("#lulist").innerHTML=rows.map(m=>'<div class="lrow"><div class="lwho"><b>'+esc(m.username?"@"+m.username:(m.name||"Member"))+'</b><small>'+esc(m.name||"")+' \u00b7 '+esc(m.uid)+'</small></div><button type="button" class="lbt" data-ul="'+esc(m.uid)+'">Lock</button></div>').join("")||'<p class="note">No members found.</p>'}
function lkUTick(){const now=Date.now()+LK.off;let exp=false;document.querySelectorAll("#lul .lut").forEach(s=>{const u=s.dataset.u;if(!u)return;const rem=Date.parse(u)-now;if(rem<=0)exp=true;else s.textContent=leftTxt(rem)});if(exp&&Date.now()-lkLast>4000)lkLoad()}
$("#luq").oninput=lkUDraw;
$("#lul").onclick=async e=>{const b=e.target.closest("[data-ux]");if(!b)return;ulNote("");b.disabled=true;let r;try{r=await api.unlock_user({id:b.dataset.ux})}catch(_){r=null}
 if(r&&r.ok){lkApply(r,false);V.tg.haptic("medium");ulNote("Member unlocked.")}else{b.disabled=false;ulNote((r&&r.error)||"Failed. Try again.",1)}};
$("#lulist").onclick=async e=>{const b=e.target.closest("[data-ul]");if(!b)return;ulNote("");
 if(b.dataset.arm!=="1"){document.querySelectorAll("#lulist [data-ul]").forEach(x=>{x.dataset.arm="";x.textContent="Lock"});b.dataset.arm="1";b.textContent="Tap again";clearTimeout(lkUT);lkUT=setTimeout(()=>{if(b.isConnected){b.dataset.arm="";b.textContent="Lock"}},4000);return}
 clearTimeout(lkUT);const id=b.dataset.ul,msg=$("#lmsg").value.trim(),u=+$("#lunit").value;let m=null;
 const stop=t=>{b.dataset.arm="";b.textContent="Lock";ulNote(t,1)};
 if(!msg||msg.length>500)return stop("Write the warning above first (1 to 500 characters).");
 if(u){const n=Number($("#lnum").value);m=n*u;if(!Number.isInteger(n)||n<1||!Number.isInteger(m)||m>525600)return stop("Enter a whole number, from 1 minute up to 365 days.")}
 b.disabled=true;let r;try{r=await api.lock_user({id,message:msg,minutes:m})}catch(_){r=null}
 if(r&&r.ok){lkApply(r,false);V.tg.haptic("medium");ulNote(lkName(id)+" is locked.")}else{b.disabled=false;stop((r&&r.error)||"Failed. Try again.")}};
setInterval(()=>{if(cur==="lock"&&LK&&!document.hidden){lkPaint();lkUTick()}},1000);
})(window.ILLUMINATI);
}catch(e){console.error(e)}
try{
/* Sidebar menu */
(function(){const b=document.body,mb=document.getElementById("menubtn"),sc=document.getElementById("menuscrim"),ct=document.getElementById("cats");
const set=o=>{b.classList.toggle("menu-open",o);mb.setAttribute("aria-expanded",String(o));mb.setAttribute("aria-label",o?"Close menu":"Open menu")};
mb.onclick=()=>set(!b.classList.contains("menu-open"));sc.onclick=()=>set(false);
document.addEventListener("keydown",e=>{if(e.key==="Escape")set(false)});
ct.addEventListener("click",e=>{if(e.target.closest("button"))set(false)});
const via=id=>()=>{set(false);const t=document.getElementById(id);if(t)t.click()};
document.getElementById("mfound").onclick=via("fbtn");document.getElementById("mlock").onclick=via("lbtn");
new MutationObserver(()=>{if(!b.classList.contains("menu-open"))mb.setAttribute("aria-expanded","false")}).observe(b,{attributes:true,attributeFilter:["class"]});
})();
}catch(e){console.error(e)}
try{
/* measure the countdown bar so sections always stop just above it */
(function(){const t=document.getElementById("tabs");if(!t)return;
const f=()=>{const h=Math.ceil(t.offsetHeight);if(h>0)document.documentElement.style.setProperty("--dock-h",h+"px")};
f();if(window.ResizeObserver)new ResizeObserver(f).observe(t);addEventListener("resize",f);})();
}catch(e){console.error(e)}
try{
/* keep the focused field in view when the on-screen keyboard opens */
(function(){let t=0;
document.addEventListener("focusin",e=>{const el=e.target;if(!el||!/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)||el.type==="checkbox"||el.type==="radio")return;
 clearTimeout(t);t=setTimeout(()=>{try{if(document.activeElement===el)el.scrollIntoView({block:"center",behavior:"smooth"})}catch(_){}},320)});
})();
}catch(e){console.error(e)}

/* ===== Node Zero (member welcome page + founder-only editor picker) =====
   Self-contained: injects its own sidebar buttons, views and styles, and talks to the illuminati-nodezero edge function directly,
   so this is the only file that needs uploading. It starts once the page and all other scripts have loaded. */
try{(function(V){
const NZHTML={sb:"<button class=\"nzbtn\" data-go=\"nodezero\" aria-pressed=\"false\"><span class=\"mi\"><img src=\"data:image/png;base64,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\" alt=\"\" style=\"width:27.0px\"></span>Node Zero</button>",founder:"<button class=\"mbtn own\" id=\"mnz\" type=\"button\">Node Zero editors</button>",proxy:"<button id=\"nzGoSet\" data-go=\"nzset\" type=\"button\" hidden aria-hidden=\"true\" tabindex=\"-1\"></button>",views:"  <section class=\"view\" data-view=\"nodezero\"><div class=\"glass sheet\">\n    <div class=\"fhead\"><div class=\"frow\"><button class=\"fback\" type=\"button\" data-go=\"done\" aria-label=\"Back to profile\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M15 5l-7 7 7 7\"/></svg><span>Back</span></button><h2>Node Zero</h2><button class=\"lbt\" id=\"nzEditBtn\" type=\"button\" hidden>Edit</button></div></div>\n    <div class=\"mi-gate\" id=\"nzGate\" role=\"status\" aria-live=\"polite\"><div class=\"mi-sp\"></div><p>Loading Node Zero</p></div>\n    <div id=\"nzRead\" hidden>\n      <p class=\"eyebrow\" id=\"nzEye\" style=\"margin-top:18px\"></p>\n      <p class=\"nz-status\" id=\"nzStatus\" role=\"status\"></p>\n      <p class=\"gl-p mi-lead\" id=\"nzIntro\"></p>\n      <div id=\"nzSecs\"></div>\n      <div id=\"nzEdit\" hidden>\n        <p class=\"eyebrow\" style=\"margin-top:22px\">Your sections</p>\n        <p class=\"gl-p mi-lead\">The entry protocol above and the notice below are fixed and cannot be changed. You can only add sections here, edit your own text, and remove sections.</p>\n        <p class=\"vt-sel\" id=\"nzCount\"></p>\n        <div id=\"nzFSecs\"></div>\n        <button class=\"btn\" id=\"nzAdd\" type=\"button\">Add section</button>\n        <button class=\"btn solid\" id=\"nzSave\" type=\"button\">Save changes</button>\n        <button class=\"btn\" id=\"nzCancel\" type=\"button\">Cancel</button>\n        <p class=\"note\" id=\"nzMsg\" role=\"status\"></p>\n      </div>\n      <div class=\"nz-notice\" id=\"nzNotice\"></div>\n      <p class=\"note\" id=\"nzUpd\"></p>\n    </div>\n  </div></section>\n  <section class=\"view\" data-view=\"nzset\"><div class=\"glass sheet\">\n    <div class=\"fhead\"><div class=\"frow\"><button class=\"fback\" type=\"button\" data-go=\"done\" aria-label=\"Back to profile\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M15 5l-7 7 7 7\"/></svg><span>Back</span></button><h2>Node Zero editors</h2></div></div>\n    <div class=\"mi-gate\" id=\"nzsGate\" role=\"status\" aria-live=\"polite\"><div class=\"mi-sp\"></div><p>Verifying founder access</p></div>\n    <div id=\"nzsApp\" hidden>\n      <p class=\"eyebrow\" style=\"margin-top:18px\">Who can edit</p>\n      <p class=\"gl-p mi-lead\">Choose up to 10 members who can edit the Node Zero welcome page. They get an Edit button on the page. Every other member can only read it. You can always edit it yourself. Only you can see and change this list.</p>\n      <p class=\"vt-sel\" id=\"nzsCount\"></p>\n      <div class=\"lchips\" id=\"nzsChips\"></div>\n      <input class=\"lsearch\" id=\"nzsQ\" type=\"search\" autocomplete=\"off\" autocapitalize=\"none\" spellcheck=\"false\" placeholder=\"Search members\" aria-label=\"Search members to make editors\">\n      <div id=\"nzsList\"></div>\n      <button class=\"btn solid\" id=\"nzsSave\" type=\"button\">Save editors</button>\n      <p class=\"note\" id=\"nzsMsg\" role=\"status\"></p>\n    </div>\n  </div></section>\n",css:"/* Node Zero: member welcome page (data-view=nodezero) and founder editor picker (data-view=nzset). Every class is prefixed nz so nothing else is touched. */\nbody[data-view=nodezero] #cats button[data-go],body[data-view=nzset] #cats button[data-go]{display:flex!important}\nbody[data-view=nodezero] #cats .msub,body[data-view=nzset] #cats .msub{display:flex}\nbody.ready[data-view=nodezero] #menubtn,body.ready.owner[data-view=nzset] #menubtn{display:flex}\nhtml body:not(.member):not(.owner) #cats button.nzbtn{display:none!important}\n#cats button.nzbtn svg{width:22px;height:22px;flex:none;display:block}\n.view[data-view=nodezero] [hidden],.view[data-view=nzset] [hidden]{display:none!important}\n.view[data-view=nodezero] .sheet,.view[data-view=nzset] .sheet{max-height:calc(100% - var(--sat) - 64px)}\n@media (min-width:700px){.view[data-view=nodezero] .sheet,.view[data-view=nzset] .sheet{max-height:calc(100% - 24px)}}\n.nz-status{margin:8px 0 14px;font:600 13px/1.4 var(--sans);letter-spacing:.04em;color:#8fe3a6}\n.nz-status::before{content:\"\";display:inline-block;width:8px;height:8px;margin-right:9px;border-radius:50%;background:#8fe3a6;box-shadow:0 0 10px rgba(143,227,166,.7)}\n#nzIntro{white-space:pre-wrap;overflow-wrap:anywhere}\n.nz-sec{margin:12px 0 0;padding:16px 16px 14px;border:1px solid var(--line);border-radius:16px;background:rgba(0,0,0,.35)}\n.nz-sec h3{margin:0 0 8px;font-size:15px}\n.nz-sec p{margin:0;font-size:13.5px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}\n.nz-notice{margin:18px 0 0;padding:14px 16px;border-left:2px solid rgba(255,194,122,.7);background:rgba(255,194,122,.06);border-radius:0 12px 12px 0;font-size:12.5px;line-height:1.55;color:var(--dim);white-space:pre-wrap;overflow-wrap:anywhere}\n.nz-fs{margin:12px 0 0;padding:14px 14px 12px;border:1px solid var(--line);border-radius:16px;background:rgba(0,0,0,.25)}\n.nz-fs .fld{margin-bottom:10px}\n.nz-fs textarea{min-height:110px}\n.nz-sa{display:flex;gap:8px;flex-wrap:wrap}\n.nz-sa .lbt:disabled{opacity:.4}\n#nzEdit .btn:disabled{opacity:.5}\n"};
const NZAPI=(function(){
 const S=V.config&&V.config.supabase;
 const call=a=>async d=>{
  if(!S||!S.url)return{ok:false,error:"Node Zero needs the live backend."};
  const ac=typeof AbortController==="function"?new AbortController():null,tm=ac?setTimeout(()=>ac.abort(),20000):0;
  try{
   const r=await fetch(S.url+"/functions/v1/illuminati-nodezero?forceFunctionRegion=ap-south-1",{method:"POST",...(ac?{signal:ac.signal}:{}),
    headers:{"Content-Type":"application/json",apikey:S.anonKey,...(String(S.anonKey).startsWith("eyJ")?{Authorization:"Bearer "+S.anonKey}:{})},
    body:JSON.stringify({action:a,initData:V.tg.initData,data:d})});
   const j=await r.json();
   try{if(j&&j.status==="locked"&&V.onlock)V.onlock(j)}catch(e){}
   return j}
  catch(e){return{ok:false,error:"Network error. Try again."}}
  finally{clearTimeout(tm)}};
 return{nz_get:call("get"),nz_save:call("save"),nz_founder_get:call("founder_get"),nz_founder_set:call("founder_set")}})();
function inject(){
 if(document.getElementById("nzGate"))return;
 const cats=document.getElementById("cats");if(!cats)return;
 const st=document.createElement("style");st.textContent=NZHTML.css;document.body.appendChild(st);
 const first=cats.querySelector('button[data-go="done"]');
 if(first)first.insertAdjacentHTML("beforebegin",NZHTML.sb);else cats.insertAdjacentHTML("afterbegin",NZHTML.sb);
 const red=document.getElementById("mred");
 if(red)red.insertAdjacentHTML("afterend",NZHTML.founder);else cats.insertAdjacentHTML("beforeend",NZHTML.founder);
 const px=document.getElementById("redGoSet");
 if(px)px.insertAdjacentHTML("afterend",NZHTML.proxy);else document.body.insertAdjacentHTML("beforeend",NZHTML.proxy);
 const sec=document.querySelector('.view[data-view="security"]');
 if(sec)sec.insertAdjacentHTML("beforebegin",NZHTML.views);
 else{const mn=document.querySelector("main");if(mn)mn.insertAdjacentHTML("beforeend",NZHTML.views)}}
function boot(){inject();NZ(V)}
const NZ=function(V){
const api=NZAPI,$=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const hap=k=>{try{V.tg.haptic(k||"light")}catch(e){}};
const body=document.body;
const LOCK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
const MAXSEC=12,EDITORS=10;

/* ---------------- member page ---------------- */
let PAGE=null,VER=0,CAN=false,UPD="",editing=false,wired=false,busy=false;
let D={eyebrow:"",status:"",intro:"",notice:"",sections:[]};
const gate=h=>{const g=$("nzGate");g.hidden=false;g.innerHTML=h;$("nzRead").hidden=true;$("nzEdit").hidden=true;$("nzSecs").hidden=false;$("nzEditBtn").hidden=true};
function locked(m){gate('<div class="mi-gi">'+LOCK+'</div><h3>Node Zero</h3><p></p>');$("nzGate").querySelector("p").textContent=m}
function fmt(t){try{const d=new Date(t);return isNaN(d)?"":d.toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"})}catch(e){return""}}
function clean(c){
 c=c&&typeof c==="object"?c:{};
 return{eyebrow:String(c.eyebrow||""),status:String(c.status||""),intro:String(c.intro||""),notice:String(c.notice||""),
  sections:(Array.isArray(c.sections)?c.sections:[]).slice(0,MAXSEC).map(s=>({title:String(s&&s.title||""),body:String(s&&s.body||"")}))}}
function paint(){
 const c=PAGE;if(!c)return;
 $("nzGate").hidden=true;$("nzEdit").hidden=true;$("nzSecs").hidden=false;$("nzUpd").hidden=false;$("nzRead").hidden=false;
 $("nzEye").textContent=c.eyebrow;
 const st=$("nzStatus");st.textContent=c.status;st.hidden=!c.status;
 const it=$("nzIntro");it.textContent=c.intro;it.hidden=!c.intro;
 const box=$("nzSecs");box.textContent="";
 c.sections.forEach(s=>{
  const d=document.createElement("div");d.className="nz-sec";
  const h=document.createElement("h3");h.textContent=s.title;
  const p=document.createElement("p");p.textContent=s.body;
  d.appendChild(h);d.appendChild(p);box.appendChild(d)});
 const nt=$("nzNotice");nt.textContent=c.notice;nt.hidden=!c.notice;
 const u=fmt(UPD);$("nzUpd").textContent=u?"Last updated "+u:"";
 $("nzEditBtn").hidden=!CAN}
function apply(r){PAGE=clean(r.content);VER=+r.version||VER;UPD=r.updated_at||UPD}

async function enter(){
 wire();editing=false;
 if(!PAGE)gate('<div class="mi-sp"></div><p>Loading Node Zero</p>');
 let r;try{r=await api.nz_get()}catch(e){r=null}
 if(body.dataset.view!=="nodezero")return;
 if(r&&r.ok&&r.content){apply(r);CAN=!!r.can_edit;paint();return}
 if(PAGE){paint();return}
 locked((r&&r.error)||"We could not load this page. Check your connection and try again.")}
function leave(){editing=false;$("nzEdit").hidden=true;$("nzSecs").hidden=false;$("nzUpd").hidden=false;if(PAGE){$("nzRead").hidden=false}}

/* ---------------- editing (editors + founder) ---------------- */
function pull(){
 if(!editing)return;
 D.sections=[...document.querySelectorAll("#nzFSecs .nz-fs")].map(e=>({title:e.querySelector(".nz-st").value,body:e.querySelector(".nz-sb").value}))}
function drawForm(){
 const box=$("nzFSecs");box.textContent="";
 D.sections.forEach((s,i)=>{
  const d=document.createElement("div");d.className="nz-fs";d.dataset.i=i;
  d.innerHTML='<label class="fld">Section title<input class="nz-st" maxlength="80" autocomplete="off"></label>'+
   '<label class="fld">Text<textarea class="nz-sb" maxlength="1500" rows="5"></textarea></label>'+
   '<div class="nz-sa"><button type="button" class="lbt" data-a="up"'+(i===0?" disabled":"")+'>Up</button>'+
   '<button type="button" class="lbt" data-a="down"'+(i===D.sections.length-1?" disabled":"")+'>Down</button>'+
   '<button type="button" class="lbt" data-a="del">Remove</button></div>';
  d.querySelector(".nz-st").value=s.title;d.querySelector(".nz-sb").value=s.body;box.appendChild(d)});
 $("nzAdd").disabled=D.sections.length>=MAXSEC;
 $("nzCount").textContent=D.sections.length+" of "+MAXSEC+" sections"}
function startEdit(){
 if(!CAN||!PAGE)return;editing=true;D=clean(PAGE);
 $("nzSecs").hidden=true;$("nzUpd").hidden=true;$("nzEdit").hidden=false;$("nzEditBtn").hidden=true;$("nzMsg").textContent="";$("nzSave").disabled=false;
 drawForm();try{$("nzEdit").scrollIntoView({block:"start"})}catch(e){}}
function stopEdit(){editing=false;$("nzEdit").hidden=true;paint()}
async function save(){
 if(!editing||busy)return;pull();
 const msg=$("nzMsg"),btn=$("nzSave");
 const e=D.sections.findIndex(s=>!s.title.trim()||!s.body.trim())>=0?"Every section needs a title and some text.":"";
 if(e){msg.textContent=e;return}
 busy=true;btn.disabled=true;msg.textContent="Saving";let r;
 try{r=await api.nz_save({content:{eyebrow:PAGE.eyebrow,status:PAGE.status,intro:PAGE.intro,notice:PAGE.notice,sections:D.sections},version:VER})}catch(x){r=null}
 busy=false;btn.disabled=false;
 if(r&&r.ok){apply(r);editing=false;paint();hap("medium");try{V.toast&&V.toast("Node Zero saved")}catch(x){}return}
 if(r&&r.conflict&&r.content){apply(r);D=clean(r.content);drawForm();msg.textContent=r.error||"Someone else just saved this page. Their version is loaded.";return}
 msg.textContent=(r&&r.error)||"Could not save. Try again."}
function wire(){
 if(wired)return;wired=true;
 $("nzEditBtn").onclick=()=>{hap("light");startEdit()};
 $("nzCancel").onclick=()=>{hap("light");stopEdit()};
 $("nzSave").onclick=save;
 $("nzAdd").onclick=()=>{pull();if(D.sections.length<MAXSEC){D.sections.push({title:"",body:""});drawForm();const l=document.querySelectorAll("#nzFSecs .nz-st");if(l.length)try{l[l.length-1].focus()}catch(e){}}};
 $("nzFSecs").onclick=ev=>{
  const b=ev.target.closest("[data-a]");if(!b||b.disabled)return;
  const row=b.closest(".nz-fs");if(!row)return;const i=+row.dataset.i;pull();
  if(b.dataset.a==="del")D.sections.splice(i,1);
  else{const j=b.dataset.a==="up"?i-1:i+1;if(j<0||j>=D.sections.length)return;const t=D.sections[i];D.sections[i]=D.sections[j];D.sections[j]=t}
  hap("light");drawForm()}}

/* ---------------- founder page: choose who can edit (own tab, founder only) ---------------- */
let FM=[],SEL=new Set(),loaded=false,fwired=false;
const fgate=h=>{const g=$("nzsGate");g.hidden=false;g.innerHTML=h;$("nzsApp").hidden=true};
const nm=m=>m.username?"@"+m.username:(m.name||"Member");
const fname=id=>{const m=FM.find(x=>x.uid===id);return m?nm(m):"Former member"};
function fwire(){
 if(fwired)return;fwired=true;
 $("nzsQ").oninput=fdraw;
 $("nzsChips").onclick=e=>{const b=e.target.closest("[data-rx]");if(!b)return;SEL.delete(b.dataset.rx);hap("light");fdraw()};
 $("nzsList").onclick=e=>{const b=e.target.closest("[data-ra]");if(!b||b.disabled)return;const id=b.dataset.ra;if(SEL.has(id))SEL.delete(id);else if(SEL.size<EDITORS)SEL.add(id);hap("light");fdraw()};
 $("nzsSave").onclick=fsave}
function fdraw(){
 const q=$("nzsQ").value.trim().toLowerCase(),full=SEL.size>=EDITORS;
 $("nzsCount").textContent=SEL.size+" of "+EDITORS+" selected";
 $("nzsChips").innerHTML=SEL.size?[...SEL].map(id=>'<button type="button" class="lchip" data-rx="'+esc(id)+'" aria-label="Remove '+esc(fname(id))+'">'+esc(fname(id))+' \u00d7</button>').join(""):'<p class="note" style="margin:0;text-align:left">No editors yet. Only you can edit the page.</p>';
 $("nzsList").innerHTML=FM.filter(m=>!q||[m.username,m.name].join(" ").toLowerCase().includes(q)).slice(0,60).map(m=>{
  const on=SEL.has(m.uid);
  return '<div class="lrow"><div class="lwho"><b>'+esc(nm(m))+'</b><small>'+esc(m.name||"")+'</small></div><button type="button" class="lbt'+(on?" on":"")+'" data-ra="'+esc(m.uid)+'"'+(!on&&full?' disabled style="opacity:.4"':"")+'>'+(on?"Editor":"Add")+'</button></div>'}).join("")||'<p class="note">No members found.</p>'}
async function fenter(){
 fwire();
 if(!body.classList.contains("owner")){fgate('<div class="mi-gi">'+LOCK+'</div><h3>Founders only</h3><p>This section is only available to the founder.</p>');return}
 fgate('<div class="mi-sp"></div><p>Verifying founder access</p>');let r;
 try{r=await api.nz_founder_get()}catch(e){r=null}
 if(r&&r.ok){FM=Array.isArray(r.members)?r.members:[];SEL=new Set((Array.isArray(r.editors)?r.editors:[]).map(String).slice(0,EDITORS));loaded=true;
  $("nzsGate").hidden=true;$("nzsApp").hidden=false;$("nzsQ").value="";$("nzsMsg").textContent="";$("nzsSave").disabled=false;fdraw();return}
 loaded=false;fgate('<div class="mi-gi">'+LOCK+'</div><h3>Founders only</h3><p></p>');
 $("nzsGate").querySelector("p").textContent=(r&&r.error)||"We could not load this page. Check your connection and try again."}
function fleave(){loaded=false;SEL=new Set();FM=[];$("nzsGate").hidden=false;$("nzsApp").hidden=true}
async function fsave(){
 if(!loaded)return;const btn=$("nzsSave"),msg=$("nzsMsg");btn.disabled=true;msg.textContent="";let r;
 try{r=await api.nz_founder_set({editors:[...SEL].slice(0,EDITORS)})}catch(e){r=null}
 btn.disabled=false;
 if(r&&r.ok){SEL=new Set((Array.isArray(r.editors)?r.editors:[]).map(String).slice(0,EDITORS));if(Array.isArray(r.members))FM=r.members;fdraw();msg.textContent="Saved. "+SEL.size+" editor"+(SEL.size===1?"":"s")+" can edit Node Zero.";hap("medium")}
 else msg.textContent=(r&&r.error)||"Could not save. Try again."}
/* sidebar entry (Founder section, owner only) opens the view through a hidden proxy so the normal view switch runs */
const mn=$("mnz");if(mn)mn.onclick=()=>{if(body.classList.contains("owner")){const g=$("nzGoSet");if(g)g.click()}};
if(V.tools){V.tools.hooks.nodezero={enter,leave};V.tools.hooks.nzset={enter:fenter,leave:fleave}}
};
if(document.readyState==="complete")boot();else document.addEventListener("DOMContentLoaded",boot);
})(window.ILLUMINATI);
}catch(e){console.error(e)}
