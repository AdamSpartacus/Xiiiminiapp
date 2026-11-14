try{
/* Tools registry. Every tool listed here shows up in BOTH the Tools page (grouped by category) and the sidebar's Tools section.
   To add a tool: 1) add an entry below, 2) add a <section class="view" data-view="<view>"> to index.html, 3) (optional) set V.tools.hooks.<view>={enter(){},leave(){}} from its script. */
(function(V){
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const ICON={meta:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17.5l4.6-4.2 3.4 3 2.6-2.3 5.4 4.5"/></svg>'};
const T=[
 {id:"meta",view:"meta",cat:"Image Intelligence",name:"Meta Index",desc:"Reveal the hidden data inside any photo or video, or strip it clean.",icon:ICON.meta}
];
const hooks={};let prev=null;
const chev='<svg class="mi-go" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
function groups(){const m=new Map();T.forEach(t=>{const c=t.cat||"Tools";if(!m.has(c))m.set(c,[]);m.get(c).push(t)});return[...m]}
function render(){
 const hub=document.getElementById("toolsl"),side=document.getElementById("msub");
 if(hub)hub.innerHTML=groups().map(([c,l])=>'<p class="mi-cat">'+esc(c)+'</p>'+l.map(t=>'<button class="mi-tool" type="button" data-go="'+esc(t.view)+'"><span class="mi-ti">'+(t.icon||"")+'</span><span class="mi-tt"><b>'+esc(t.name)+'</b><span>'+esc(t.desc||"")+'</span></span>'+chev+'</button>').join("")).join("")
  +'<div class="wallet" aria-disabled="true" role="group" aria-label="More tools coming soon"><div class="wt"><b>More tools</b><span>New tools will appear here.</span></div><i class="wp">Soon</i></div>';
 if(side)side.innerHTML=groups().map(([c,l])=>'<span class="mcat">'+esc(c)+'</span>'+l.map(t=>'<button type="button" data-go="'+esc(t.view)+'" aria-pressed="'+(document.body.dataset.view===t.view)+'">'+(t.icon||"")+'<span>'+esc(t.name)+'</span></button>').join("")).join("")}
V.tools={list:T,hooks,add(t){T.push(t);render()},
 onView(n){if(prev&&prev!==n&&hooks[prev]&&hooks[prev].leave){try{hooks[prev].leave()}catch(e){console.error(e)}}
  prev=n;if(hooks[n]&&hooks[n].enter){try{hooks[n].enter()}catch(e){console.error(e)}}}};
render();
})(window.ILLUMINATI);
}catch(e){console.error(e)}
