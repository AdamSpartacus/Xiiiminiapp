try{
/* Security: FOUNDER ONLY.
   Part 1 (every member): a small sensor that reports "developer tools opened" to the backend. This signal is unreliable by nature
   (it is a window-size heuristic) so the server logs it for information and adds no points.
   Part 2 (founder): the Security Events table (User ID, Timestamp, IP, Device, Reason, Severity, Evidence), the risk-score board and the
   review / lock thresholds. Who is a founder, what counts as an event, how many points it is worth and when an account is locked are all
   decided by the backend (edge function illuminati-security). This file only shows it. Fails closed. */
(function(V){
const api=V.services.api,$=id=>document.getElementById(id),body=document.body;
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const hap=k=>{try{V.tg.haptic(k||"light")}catch(e){}};
const LOCK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

/* ---------------- part 1: client sensor (all members) ---------------- */
(function(){
 if(!api.sec_report||!V.tg.initData)return;
 const plat=String(V.tg.app&&V.tg.app.platform||"unknown").toLowerCase();
 if(!["tdesktop","macos","weba","webk","web","unknown"].includes(plat))return;   /* phones resize for the keyboard; the heuristic would only produce noise */
 let sent=false;
 try{if(sessionStorage.getItem("vm_sec_dt"))sent=true}catch(e){}
 const open=()=>Math.max(outerWidth-innerWidth,outerHeight-innerHeight)>200;
 const check=()=>{
  if(sent||body.classList.contains("owner")||!body.classList.contains("ready"))return;
  if(!open())return;
  sent=true;try{sessionStorage.setItem("vm_sec_dt","1")}catch(e){}
  Promise.resolve(api.sec_report({reason:"devtools_open",platform:plat,evidence:{w:innerWidth,h:innerHeight,ow:outerWidth,oh:outerHeight,view:body.dataset.view||""}})).catch(()=>{})};
 addEventListener("resize",check);setInterval(check,5000)})();
/* anything else in the app can report through V.sec.report(reason, evidence). Only the reasons the backend allows are accepted. */
V.sec={report:(reason,evidence)=>{try{return api.sec_report({reason,platform:String(V.tg.app&&V.tg.app.platform||""),evidence:evidence||{}})}catch(e){return Promise.resolve(null)}}};

/* ---------------- part 2: founder page ---------------- */
const SEVS=["critical","high","medium","low","info"];
let sev="",rows=[],oldest=0,names=null,tab="events",loaded=false,wired=false,open=new Set(),RULES=[],ST=null;
const gate=h=>{const g=$("scGate");g.hidden=false;g.innerHTML=h;$("scApp").hidden=true};
const msg=t=>{$("scMsg").textContent=t||""};
const when=t=>{const d=new Date(t);return isNaN(d)?"":d.toLocaleString([],{year:"numeric",month:"short",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"})};
const label=r=>(RULES.find(x=>x.reason===r)||{}).label||String(r||"").replace(/_/g," ");
const who=id=>{if(id==null||id==="")return"";const u=names&&names[String(id)];return u?"@"+u:String(id)};
const subj=a=>a.subject.startsWith("u:")?who(a.subject.slice(2)):"IP "+a.subject.slice(3);

function wire(){
 if(wired)return;wired=true;
 $("scTabs").onclick=e=>{const b=e.target.closest("[data-t]");if(b)show(b.dataset.t)};
 $("scSev").onclick=e=>{const b=e.target.closest("[data-s]");if(!b)return;sev=b.dataset.s;hap("light");loadEvents(true)};
 $("scBody").onclick=e=>{const r=e.target.closest("tr.sc-r");if(!r)return;const id=r.dataset.id;if(open.has(id))open.delete(id);else open.add(id);drawEvents()};
 $("scMore").onclick=()=>loadEvents(false);
 $("scAcc").onclick=e=>{const b=e.target.closest("[data-a]");if(b&&!b.disabled)act(b.dataset.a,b.dataset.s)};
 $("scSave").onclick=saveSettings}

function show(t){
 tab=t;hap("light");msg("");
 document.querySelectorAll("#scTabs [data-t]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.t===t)));
 $("scEvents").hidden=t!=="events";$("scAccounts").hidden=t!=="accounts";$("scRules").hidden=t!=="rules";
 if(t==="accounts")loadAccounts();if(t==="rules")loadRules()}

function drawStats(s){
 $("scStats").innerHTML=s?'<div><b>'+(+s.events_24h||0)+'</b><small>Events 24h</small></div><div><b>'+(+s.review||0)+'</b><small>In review</small></div><div><b>'+(+s.locked||0)+'</b><small>Locked</small></div>':""}
function drawSev(){
 $("scSev").innerHTML=[["","All"]].concat(SEVS.map(s=>[s,s[0].toUpperCase()+s.slice(1)])).map(([v,t])=>'<button type="button" class="lchip" data-s="'+v+'"'+(v===sev?' style="background:linear-gradient(#fff,#b9bfca);color:#000"':"")+'>'+t+'</button>').join("")}
function drawEvents(){
 $("scBody").innerHTML=rows.map(r=>{
  const unv=!r.user_id,id=r.user_id||r.claimed_user_id,ev=JSON.stringify(r.evidence||{}),x=open.has(String(r.id));
  return '<tr class="sc-r" data-id="'+r.id+'"><td class="u">'+esc(who(id)||"unknown")+(unv?'<span class="sc-unv">unverified</span>':"")+'</td><td class="t">'+esc(when(r.created_at))+'</td><td class="ip">'+esc(r.ip||"")+'</td><td class="d" title="'+esc(r.device||"")+'">'+esc(r.device||"")+'</td><td>'+esc(label(r.reason))+(r.points?' <b style="color:var(--text)">+'+(+r.points)+'</b>':"")+(r.source==="client"?' <span class="sc-unv" style="display:inline">device-reported</span>':"")+'</td><td><span class="sc-sev '+esc(r.severity)+'">'+esc(r.severity)+'</span></td><td class="ev">'+esc(ev)+'</td></tr>'+
  (x?'<tr class="sc-x"><td colspan="7"><pre>'+esc(JSON.stringify(r.evidence||{},null,2))+'</pre></td></tr>':"")}).join("");
 $("scEmpty").hidden=rows.length>0}
async function ensureNames(){
 if(names)return;names={};
 try{const r=await api.list();if(r&&r.ok&&Array.isArray(r.members))r.members.forEach(m=>{if(m.uid&&m.username)names[String(m.uid)]=m.username})}catch(e){}}
async function loadEvents(fresh){
 if(fresh){rows=[];oldest=0;open=new Set()}
 drawSev();msg("");let r;
 try{r=await api.sec_events({limit:50,severity:sev||undefined,before:fresh?undefined:oldest||undefined})}catch(e){r=null}
 if(!r||!r.ok){msg((r&&r.error)||"Could not load events.");return}
 const got=Array.isArray(r.events)?r.events:[];rows=rows.concat(got);oldest=rows.length?rows[rows.length-1].id:0;
 $("scMore").hidden=got.length<50;drawEvents()}

const pct=(sc,lk)=>Math.max(2,Math.min(100,Math.round(100*(+sc||0)/Math.max(1,+lk||100))));
async function loadAccounts(){
 $("scAcc").innerHTML='<p class="note">Loading…</p>';let r,s;
 try{[r,s]=await Promise.all([api.sec_accounts(),ST?Promise.resolve({ok:true,settings:ST}):api.sec_settings_get()])}catch(e){r=null}
 if(s&&s.ok&&s.settings)ST=s.settings;
 if(!r||!r.ok){$("scAcc").innerHTML="";msg((r&&r.error)||"Could not load risk scores.");return}
 const L=ST?ST.lock_threshold:100,A=Array.isArray(r.accounts)?r.accounts:[];
 $("scAcc").innerHTML=A.length?A.map(a=>{
  const u=a.subject.startsWith("u:"),lk=a.status==="locked";
  return '<div class="sc-acc"><div class="sc-ah"><div style="min-width:0"><b>'+esc(subj(a))+'</b><small>Score '+(+a.score||0)+' of '+L+(u?"":" · unverified address")+(a.note?" · "+esc(a.note):"")+'</small></div><span class="sc-st '+esc(a.status)+'">'+esc(a.status==="ok"?"ok":a.status==="review"?"manual review":"locked")+'</span></div><div class="sc-bar"><i style="width:'+pct(a.score,L)+'%"></i></div><div class="sc-acts">'+
  (a.status!=="review"&&!lk?'<button type="button" class="lbt" data-a="sec_review" data-s="'+esc(a.subject)+'">Flag for review</button>':"")+
  (u&&!lk?'<button type="button" class="lbt" data-a="sec_lock" data-s="'+esc(a.subject)+'">Lock</button>':"")+
  (lk?'<button type="button" class="lbt on" data-a="sec_unlock" data-s="'+esc(a.subject)+'">Unlock</button>':"")+
  (a.score>0||a.status!=="ok"?'<button type="button" class="lbt" data-a="sec_reset" data-s="'+esc(a.subject)+'">Clear score</button>':"")+'</div></div>'}).join(""):'<p class="note">No accounts have a risk score.</p>'}
async function act(a,s){
 if(a==="sec_lock"&&!confirm("Lock this account? It will lose access until you unlock it."))return;
 if(a==="sec_reset"&&!confirm("Clear this score and set the account back to OK?"))return;
 let r;try{r=await api[a]({subject:s})}catch(e){r=null}
 if(r&&r.ok){hap("medium");msg("Done.");loadAccounts();loadStats()}else msg((r&&r.error)||"That did not work. Try again.")}

async function loadRules(){
 let r;try{r=await api.sec_settings_get()}catch(e){r=null}
 if(!r||!r.ok){msg((r&&r.error)||"Could not load the rules.");return}
 RULES=Array.isArray(r.rules)?r.rules:RULES;ST=r.settings||ST;
 $("scPts").innerHTML=RULES.map(x=>'<div class="sc-pt"><span>'+esc(x.label)+'</span><b>'+(x.points?"+"+(+x.points):"log only")+'</b></div>').join("");
 if(ST){$("scRv").value=ST.review_threshold;$("scLk").value=ST.lock_threshold}}
async function saveSettings(){
 const rv=Math.floor(+$("scRv").value),lk=Math.floor(+$("scLk").value);
 if(!(rv>0&&lk>0&&rv<=lk)){msg("The review threshold must be above 0 and not above the lock threshold.");return}
 const b=$("scSave");b.disabled=true;let r;
 try{r=await api.sec_settings_set({review_threshold:rv,lock_threshold:lk})}catch(e){r=null}b.disabled=false;
 if(r&&r.ok){ST=Object.assign({},ST,{review_threshold:r.review_threshold,lock_threshold:r.lock_threshold});hap("medium");msg("Saved. Review at "+r.review_threshold+", lock at "+r.lock_threshold+".")}
 else msg((r&&r.error)||"Could not save. Try again.")}
async function loadStats(){let r;try{r=await api.sec_summary()}catch(e){r=null}if(r&&r.ok)drawStats(r)}

async function enter(){
 wire();
 if(!body.classList.contains("owner")){gate('<div class="mi-gi">'+LOCK+'</div><h3>Founders only</h3><p>This section is only available to the founder.</p>');return}
 gate('<div class="mi-sp"></div><p>Verifying founder access</p>');let s,g;
 try{[s,g]=await Promise.all([api.sec_summary(),api.sec_settings_get()])}catch(e){s=g=null}
 if(s&&s.ok&&g&&g.ok){
  RULES=Array.isArray(g.rules)?g.rules:[];ST=g.settings||null;loaded=true;
  $("scGate").hidden=true;$("scApp").hidden=false;drawStats(s);show("events");await ensureNames();loadEvents(true);return}
 loaded=false;gate('<div class="mi-gi">'+LOCK+'</div><h3>Founders only</h3><p></p><button class="btn solid" type="button" id="scRetry">Try again</button>');
 $("scGate").querySelector("p").textContent=(s&&s.error)||(g&&g.error)||"We could not load this page. Check your connection and try again.";
 $("scRetry").onclick=enter}
/* leaving wipes everything that was loaded */
function leave(){loaded=false;rows=[];oldest=0;names=null;open=new Set();RULES=[];ST=null;sev="";
 $("scBody").innerHTML="";$("scAcc").innerHTML="";$("scPts").innerHTML="";$("scStats").innerHTML="";msg("");
 $("scGate").hidden=false;$("scApp").hidden=true}
const m=$("msec");if(m)m.onclick=()=>{if(body.classList.contains("owner")){const g=$("secGoView");if(g)g.click()}};
if(V.tools)V.tools.hooks.security={enter,leave};
})(window.ILLUMINATI);
}catch(e){console.error(e)}
