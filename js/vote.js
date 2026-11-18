try{
/* Member voting.
   Member page ("Voting" in the sidebar): every member sees the official requests and votes. The founder-chosen proposers can also raise requests.
   Founder page ("Voting setup" under Founder): choose up to 10 proposers and set the decision rules.
   All counting and every rule is enforced by the backend (edge function illuminati-vote + vote_* database functions); this file only shows it. */
(function(V){
const api=V.services.api,$=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const hap=k=>{try{V.tg.haptic(k||"light")}catch(e){}};
const toast=t=>{const e=$("miToast");if(!e)return;e.textContent=t;e.classList.add("on");clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove("on"),2200)};
const body=document.body,active=()=>body.dataset.view==="vote";
const SP='<div class="mi-sp"></div>',LOCK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
const PILL={open:"Open",passed:"Passed",failed:"Failed",revision:"Revision",lost:"Not chosen"};
const pc=(a,b)=>b>0?+(a*100/b).toFixed(1):0;
const pl=(n,w)=>n+" "+w+(n===1?"":"s");
let S=null,skew=0,busy=false,form=null,timer=0;const more=new Set();
const now=()=>Date.now()+skew;
function left(ms){if(ms<=0)return"Closing now";const m=Math.floor(ms/6e4),d=Math.floor(m/1440),h=Math.floor(m%1440/60),mi=m%60;return(d?d+"d "+h+"h":h?h+"h "+mi+"m":Math.max(1,mi)+"m")+" left"}
function badge(n){const b=$("vtBadge");if(!b)return;n=+n||0;b.hidden=!n;b.textContent=n>9?"9+":String(n)}

/* ---------------- member page ---------------- */
function gate(html){const g=$("vtGate");g.hidden=false;g.innerHTML=html;$("vtApp").hidden=true}
function errGate(m){gate('<div class="mi-gi">'+LOCK+'</div><h3>Voting unavailable</h3><p></p><button class="btn" id="vtRetry" type="button">Try again</button>');$("vtGate").querySelector("p").textContent=m;$("vtRetry").onclick=()=>{gate(SP+"<p>Loading the votes</p>");load(false)}}
async function load(silent){
 if(busy)return;busy=true;let r;try{r=await api.vote_state()}catch(e){r=null}busy=false;
 if(r&&r.ok){S=r;skew=(+r.now||Date.now())-Date.now();badge(r.pending);if(active())paint();return}
 if(r&&r.status==="locked")return;
 if(!S&&active())errGate((r&&r.error)||"Could not load the votes. Check your connection and try again.");
 else if(!silent)toast((r&&r.error)||"Could not refresh the votes.")}

const turnoutLine=p=>"Turnout "+p.turnout+" of "+p.eligible+" ("+pc(p.turnout,p.eligible)+"%), "+p.min_part+"% needed";
function meter(p,contest){const t=p.turnout,s=pc(p.yes,t);
 if(contest)return'<div class="vt-meter" role="img" aria-label="'+s+'% of the votes"><i class="s" style="width:'+s+'%"></i></div><div class="vt-nums"><span>Votes <b>'+s+'%</b> <small>'+p.yes+'</small></span></div>';
 const o=pc(p.no,t);
 return'<div class="vt-meter" role="img" aria-label="Support '+s+'%, oppose '+o+'%"><i class="s" style="width:'+s+'%"></i><i class="o" style="width:'+o+'%"></i><b class="tk" style="left:'+p.pass_pct+'%"></b></div><div class="vt-nums"><span>Support <b>'+s+'%</b> <small>'+p.yes+'</small></span><span>Oppose <b>'+o+'%</b> <small>'+p.no+'</small></span></div>'}
function outcome(p,rv){const t=p.turnout,tp=pc(p.yes,t),np=pc(p.no,t),vs=rv?" to "+pl(rv.yes,"vote"):"";
 if(p.status==="passed")return p.reason==="contest"?"Won the contest with "+pl(p.yes,"vote")+vs+".":"Passed with "+tp+"% support.";
 if(p.status==="failed")return"Failed. "+np+"% of the votes opposed it.";
 if(p.status==="lost")return"Not chosen. It received "+pl(p.yes,"vote")+vs+".";
 if(p.status==="revision"){
  if(p.reason==="quorum")return"Not enough members voted ("+pc(t,p.eligible)+"% of "+p.eligible+", "+p.min_part+"% needed). Returned for revision.";
  if(p.reason==="tie")return"The two requests tied. Returned for revision.";
  return"Neither limit was reached ("+tp+"% support, "+np+"% opposed). Returned for revision."}
 return""}
function acts(p,contest){let a="";
 if(p.status==="open"){
  if(S.member){
   if(p.can_vote){
    if(contest){const on=p.my==="yes";a+='<button class="lbt'+(on?" on":"")+'" type="button" data-vt="cast" data-id="'+p.id+'" data-c="yes" aria-pressed="'+on+'">'+(on?"Your pick":"Back this request")+'</button>'}
    else a+=["yes","no"].map(c=>'<button class="lbt'+(p.my===c?" on":"")+'" type="button" data-vt="cast" data-id="'+p.id+'" data-c="'+c+'" aria-pressed="'+(p.my===c)+'">'+(c==="yes"?"Support":"Oppose")+'</button>').join("");
   }else a+='<p class="vt-meta" style="flex-basis:100%;margin:0">You joined after this request opened, so you cannot vote on it.</p>'}
  if(S.proposer&&!p.mine&&!p.rival&&S.open_mine<2)a+='<button class="lbt" type="button" data-vt="counter" data-id="'+p.id+'" style="flex-basis:100%">Raise a competing request</button>'}
 if(p.status==="revision"&&p.mine&&S.proposer&&S.open_mine<2)a+='<button class="lbt on" type="button" data-vt="revise" data-id="'+p.id+'" style="flex-basis:100%">Revise and resubmit</button>';
 if((p.status==="open"||p.status==="revision")&&((p.mine&&p.status==="open"&&p.turnout===0)||S.owner))a+='<button class="lbt" type="button" data-vt="withdraw" data-id="'+p.id+'" style="flex-basis:100%">Withdraw</button>';
 return a?'<div class="vt-act">'+a+'</div>':""}
function card(p,contest,rv){
 const ex=more.has(p.id),long=p.body.length>240||p.body.split("\n").length>4,open=p.status==="open";
 let h='<article class="vt-card'+(ex?" x":"")+'"><div class="vt-top"><span class="vt-pill '+p.status+'">'+PILL[p.status]+'</span><span class="vt-who">'+esc(p.author)+(p.round>1?" \u00b7 Round "+p.round:"")+'</span></div>'
  +'<h3 class="vt-t">'+esc(p.title)+'</h3><p class="vt-body">'+esc(p.body)+'</p>'+(long?'<button class="vt-more" type="button" data-vt="more" data-id="'+p.id+'">'+(ex?"Show less":"Read more")+'</button>':"")
  +meter(p,contest);
 if(!contest)h+='<p class="vt-meta">'+turnoutLine(p)+(open?" \u00b7 "+left(p.closes-now()):"")+'</p>';
 if(!open)h+='<p class="vt-out">'+esc(outcome(p,rv))+'</p>'+(p.closed?'<p class="vt-meta">Closed '+new Date(p.closed).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"})+'</p>':"");
 return h+acts(p,contest)+'</article>'}
function contestBlock(g){const a=g.items[0],b=g.items[1],open=a.status==="open";
 return'<section class="vt-contest" aria-label="Competing requests"><p class="vt-ch"><b>Contest</b>'+(open?" Back one request. The one with the most votes passes.":"")+'</p>'
  +card(a,true,b)+'<p class="vt-vs">VS</p>'+card(b,true,a)+'<p class="vt-meta" style="text-align:center">'+turnoutLine(a)+(open?" \u00b7 "+left(a.closes-now()):"")+'</p></section>'}
function groups(list){const m=new Map(),o=[];list.forEach(p=>{const k=p.grp+":"+p.round;let g=m.get(k);if(!g){g={items:[]};m.set(k,g);o.push(g)}g.items.push(p)});o.forEach(g=>g.items.sort((x,y)=>(y.id===y.grp)-(x.id===x.grp)));return o}
const sec=(t,a)=>a.length?'<p class="sh vt-h">'+t+'<small>'+a.length+'</small></p>'+a.map(g=>g.items.length>1?contestBlock(g):card(g.items[0],false,null)).join(""):"";
function paint(){
 if(!S)return;const st=S.settings,P=S.proposals||[];
 $("vtGate").hidden=true;$("vtApp").hidden=false;
 $("vtCount").textContent=pl(S.electorate,"voting member");
 $("vtRules").innerHTML='<div><b>'+st.min_part+'%</b><small>of members must vote</small></div><div><b>&gt;'+st.pass_pct+'%</b><small>support to pass</small></div><div><b>&gt;'+st.fail_pct+'%</b><small>opposed to fail</small></div>';
 $("vtLead").textContent="A request passes with more than "+st.pass_pct+"% support and fails with more than "+st.fail_pct+"% opposition. Anything in between returns to its author for revision. If two competing requests are raised, members back one and the most votes passes.";
 $("vtBar").innerHTML=S.proposer?'<div class="vt-role"><b>You are a proposer</b><span>You can raise official requests and put up a competing request against another proposer\u2019s. '+S.open_mine+' of 2 open.</span><button class="btn solid" id="vtNew" type="button"'+(S.open_mine>=2?" disabled":"")+'>Raise a request</button></div>':"";
 const nb=$("vtNew");if(nb)nb.onclick=()=>openForm("new");
 const gs=groups(P),open=gs.filter(g=>g.items[0].status==="open"),rev=gs.filter(g=>g.items[0].status==="revision"),done=gs.filter(g=>g.items[0].status!=="open"&&g.items[0].status!=="revision");
 $("vtList").innerHTML=P.length?sec("Open for voting",open)+sec("Returned for revision",rev)+sec("Decided",done):'<div class="nscard"><p class="nslbl">No requests yet</p><p class="note" style="margin:0">When a proposer raises an official request, it appears here for every member to vote on.</p></div>';
 const pr=S.proposers||[];
 $("vtProp").innerHTML=pr.length?'<p class="sh vt-h">Proposers<small>'+pr.length+'</small></p><div class="vt-chips">'+pr.map(x=>'<span class="vt-chip'+(x.you?" you":"")+'">'+esc(x.label)+(x.you?" \u00b7 you":"")+'</span>').join("")+'</div><p class="vt-meta">Only these members can raise requests. Every other member votes.</p>':""}

$("vtList").addEventListener("click",async e=>{
 const b=e.target.closest("[data-vt]");if(!b||!S)return;const a=b.dataset.vt,id=b.dataset.id,p=S.proposals.find(x=>x.id===id);
 if(a==="more"){more.has(id)?more.delete(id):more.add(id);paint();return}
 if(!p)return;
 if(a==="counter"){openForm("counter",p);return}
 if(a==="revise"){openForm("revise",p);return}
 if(a==="cast"){const c=b.dataset.c;if(b.disabled||p.my===c)return;
  b.closest(".vt-act").querySelectorAll("button").forEach(x=>x.disabled=true);b.textContent="\u2026";
  let r;try{r=await api.vote_cast({id,choice:c})}catch(x){r=null}
  if(r&&r.ok){hap("medium");toast("Vote recorded. You can change it until voting closes.")}else toast((r&&r.error)||"Could not record your vote. Try again.");
  await load(true);if(active())paint();return}
 if(a==="withdraw"){
  if(!b.dataset.arm){b.dataset.arm="1";b.textContent="Tap again to confirm";setTimeout(()=>{if(b.isConnected){b.dataset.arm="";b.textContent="Withdraw"}},4000);return}
  b.disabled=true;let r;try{r=S.owner&&!p.mine?await api.vote_founder_withdraw({id}):await api.vote_withdraw({id})}catch(x){r=null}
  if(r&&r.ok){hap("medium");toast("Request withdrawn.")}else toast((r&&r.error)||"Could not withdraw. Try again.");
  await load(true);if(active())paint()}});

/* new request / competing request / revision */
const FORM=["vtRules","vtLead","vtBar","vtList","vtProp"];
const cnt=()=>{$("vtCnt").textContent=$("vtBody").value.length+"/2000"};
function openForm(mode,p){
 form={mode,id:p?p.id:null};$("vtFN").textContent="";
 $("vtFT").textContent=mode==="new"?"New request":mode==="counter"?"Competing request":"Revise request";
 const vs=$("vtVs");vs.hidden=mode!=="counter";if(mode==="counter")vs.textContent="You are opposing: "+p.title+". Voting restarts for everyone. Each member backs one of the two requests and the one with the most votes passes. Both close together.";
 $("vtTitle").value=mode==="revise"?p.title:"";$("vtBody").value=mode==="revise"?p.body:"";cnt();
 $("vtHrsW").hidden=mode==="counter";$("vtHrs").value="72";
 $("vtSend").textContent=mode==="revise"?"Resubmit for voting":"Submit request";$("vtSend").disabled=false;
 FORM.forEach(i=>$(i).hidden=true);$("vtForm").hidden=false;$("vtSheet").scrollTop=0;$("vtTitle").focus({preventScroll:true})}
function closeForm(){if(!form)return;form=null;$("vtForm").hidden=true;FORM.forEach(i=>$(i).hidden=false);$("vtSheet").scrollTop=0}
$("vtBody").oninput=cnt;$("vtCancel").onclick=closeForm;
$("vtSend").onclick=async()=>{
 if(!form)return;const t=$("vtTitle").value.replace(/\s+/g," ").trim(),b=$("vtBody").value.trim(),note=$("vtFN");
 if(t.length<3){note.textContent="Give the request a title of at least 3 characters.";return}
 if(b.length<10){note.textContent="Describe the request in at least 10 characters.";return}
 const h=+$("vtHrs").value,btn=$("vtSend");btn.disabled=true;note.textContent="";let r;
 try{r=form.mode==="new"?await api.vote_propose({title:t,body:b,hours:h}):form.mode==="counter"?await api.vote_counter({id:form.id,title:t,body:b}):await api.vote_revise({id:form.id,title:t,body:b,hours:h})}catch(e){r=null}
 btn.disabled=false;
 if(r&&r.ok){hap("medium");const m=form.mode;closeForm();toast(m==="counter"?"Competing request raised. Voting restarted.":m==="revise"?"Request resubmitted for voting.":"Request raised. Every member can now vote.");await load(true);if(active())paint()}
 else note.textContent=(r&&r.error)||"Could not submit. Try again."};

function enter(){
 if(S)paint();else gate(SP+"<p>Loading the votes</p>");
 load(true);clearInterval(timer);timer=setInterval(()=>{if(active()&&!document.hidden&&!form)load(true)},20000)}
function leave(){clearInterval(timer);timer=0;closeForm()}

/* sidebar badge: how many open requests are waiting for this member's vote */
let bl=0;
function boot(){if(!body.classList.contains("ready")||!(body.classList.contains("member")||body.classList.contains("owner")))return false;setTimeout(()=>load(true),1500);return true}
if(!boot()){const mo=new MutationObserver(()=>{if(boot())mo.disconnect()});mo.observe(body,{attributes:true,attributeFilter:["class"]})}
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&S&&Date.now()-bl>60000&&!active()){bl=Date.now();load(true)}});

/* ---------------- founder page ---------------- */
let FM=[],FSel=new Set(),fLoaded=false;
const fgate=h=>{const g=$("vsGate");g.hidden=false;g.innerHTML=h;$("vsApp").hidden=true};
const fname=id=>{const m=FM.find(x=>x.uid===id);return m?(m.username?"@"+m.username:(m.name||"Member")):"Former member"};
function fDraw(){
 const q=$("vsQ").value.trim().toLowerCase(),full=FSel.size>=10;
 $("vsCount").textContent=FSel.size+" of 10 selected";
 $("vsChips").innerHTML=FSel.size?[...FSel].map(id=>'<button type="button" class="lchip" data-vx="'+esc(id)+'" aria-label="Remove '+esc(fname(id))+'">'+esc(fname(id))+' \u00d7</button>').join(""):'<p class="note" style="margin:0;text-align:left">No proposers yet. Members cannot raise requests until you choose some.</p>';
 const rows=FM.filter(m=>!q||[m.username,m.name].join(" ").toLowerCase().includes(q)).slice(0,60);
 $("vsList").innerHTML=rows.map(m=>{const on=FSel.has(m.uid);return'<div class="lrow"><div class="lwho"><b>'+esc(m.username?"@"+m.username:(m.name||"Member"))+'</b><small>'+esc(m.name||"")+'</small></div><button type="button" class="lbt'+(on?" on":"")+'" data-va="'+esc(m.uid)+'"'+(!on&&full?" disabled style=\"opacity:.4\"":"")+'>'+(on?"Selected":"Select")+'</button></div>'}).join("")||'<p class="note">No members found.</p>'}
function fRules(){const a=+$("vsMin").value,p=+$("vsPass").value,f=+$("vsFail").value;
 $("vsPrev").textContent="A request passes with more than "+p+"% support, fails with more than "+f+"% opposition, and otherwise returns to its author for revision. At least "+a+"% of members must vote for the result to count."}
async function fEnter(){
 fgate(SP+"<p>Verifying founder access</p>");let r;try{r=await api.vote_founder_get()}catch(e){r=null}
 if(r&&r.ok){FM=r.members||[];FSel=new Set(r.proposers||[]);$("vsMin").value=r.settings.min_part;$("vsPass").value=r.settings.pass_pct;$("vsFail").value=r.settings.fail_pct;$("vsQ").value="";$("vsNote").textContent="";
  $("vsGate").hidden=true;$("vsApp").hidden=false;fLoaded=true;fDraw();fRules();return}
 fgate('<div class="mi-gi">'+LOCK+'</div><h3>Founders only</h3><p></p>');$("vsGate").querySelector("p").textContent=(r&&r.error)||"We could not load this page. Check your connection and try again."}
function fLeave(){fLoaded=false;$("vsGate").hidden=false;$("vsApp").hidden=true}
$("vsQ").oninput=fDraw;
["vsMin","vsPass","vsFail"].forEach(i=>$(i).oninput=fRules);
$("vsChips").onclick=e=>{const b=e.target.closest("[data-vx]");if(!b)return;FSel.delete(b.dataset.vx);hap("light");fDraw()};
$("vsList").onclick=e=>{const b=e.target.closest("[data-va]");if(!b||b.disabled)return;const id=b.dataset.va;if(FSel.has(id))FSel.delete(id);else if(FSel.size<10)FSel.add(id);hap("light");fDraw()};
$("vsSave").onclick=async()=>{
 const n=$("vsNote"),mn=+$("vsMin").value,ps=+$("vsPass").value,fl=+$("vsFail").value;
 if(!FSel.size){n.textContent="Choose at least one proposer.";return}
 if(![mn,ps,fl].every(Number.isInteger)){n.textContent="Enter whole numbers for the rules.";return}
 if(mn<1||mn>100){n.textContent="Minimum participation must be 1 to 100.";return}
 if(ps<50||ps>99){n.textContent="Support needed to pass must be 50 to 99.";return}
 if(fl<1||fl>50){n.textContent="Opposition that fails a request must be 1 to 50.";return}
 if(ps+fl<100){n.textContent="Pass and fail limits must add up to at least 100.";return}
 const b=$("vsSave");b.disabled=true;n.textContent="";let r;try{r=await api.vote_founder_set({proposers:[...FSel],min_part:mn,pass_pct:ps,fail_pct:fl})}catch(e){r=null}b.disabled=false;
 if(r&&r.ok){FSel=new Set(r.proposers||[]);$("vsMin").value=r.settings.min_part;$("vsPass").value=r.settings.pass_pct;$("vsFail").value=r.settings.fail_pct;fDraw();fRules();n.textContent="Saved. "+pl(FSel.size,"member")+" can now raise official requests. Open requests keep the rules they started with.";hap("medium");if(S)load(true)}
 else n.textContent=(r&&r.error)||"Could not save. Try again."};
const mv=$("mvote");if(mv)mv.onclick=()=>{if(body.classList.contains("owner")){const g=$("voteGoSet");if(g)g.click()}};

if(V.tools){V.tools.hooks.vote={enter,leave};V.tools.hooks.voteset={enter:fEnter,leave:fLeave}}
V.vote={refresh:()=>load(true)};
})(window.ILLUMINATI);
}catch(e){console.error(e)}
