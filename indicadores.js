/* Indicadores do Diário de Obra (prévia): números tirados dos RDOs da central */
(()=>{
const $=id=>document.getElementById(id);
const CENTRAL=window.CENTRAL||{};
const FUNCOES=[["lider","Líder","--s1"],["montador","Montador","--s2"],["auxiliar","Auxiliar","--s3"],["outros","Outros","--s4"]];
let senha="",todos=[],cadObras=[],ciente=new Set(),canon={};
const S={aba:"geral",obra:"",mes:"",ocTag:"",fotosMes:""};

/* ---------- utilitários ---------- */
function esc(s){const d=document.createElement("div");d.textContent=s==null?"":String(s);return d.innerHTML;}
const num=v=>parseInt(v,10)||0;
const dataStr=v=>{if(!v)return"";const s=String(v);return /^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(0,10):"";};
function hora(v){const t=String(v??"").trim();if(!/^\d{4}-\d{2}-\d{2}T/.test(t))return t;const d=new Date(t);return isNaN(d)?t:d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",timeZone:"America/Sao_Paulo"});}
const fmt=s=>{if(!s)return"-";const[y,m,d]=s.split("-");return `${d}/${m}/${y}`;};
const dia=s=>{const[y,m,d]=s.split("-");return new Date(+y,+m-1,+d);};
function iso(d){const z=new Date(d);z.setMinutes(z.getMinutes()-z.getTimezoneOffset());return z.toISOString().slice(0,10);}
const hoje=()=>iso(new Date());
const ontem=()=>{const d=new Date();d.setDate(d.getDate()-1);return iso(d);};
const somaDias=(s,n)=>{const d=dia(s);d.setDate(d.getDate()+n);return iso(d);};
const diaSP=v=>{if(!v)return"";const d=new Date(v);return isNaN(d)?"":d.toLocaleDateString("sv-SE",{timeZone:"America/Sao_Paulo"});};
const semIcone=t=>String(t||"").replace(/^[^\p{L}]+/u,"");
const ruim=t=>/chuva|impratic/i.test(t||"");
const norm=s=>String(s==null?"":s).normalize("NFD").replace(/[̀-ͯ]/g,"").trim().replace(/\s+/g," ").toUpperCase();
const plural=(n,s,p)=>n.toLocaleString("pt-BR")+" "+(n===1?s:p);
const pct=(a,b)=>b?Math.round(100*a/b):null;
const nf=(v,c)=>Number(v).toLocaleString("pt-BR",{maximumFractionDigits:c||0,minimumFractionDigits:c||0});
function msg(id,t,err){const m=$(id);if(!m)return;m.textContent=t;m.className="msg"+(err?" err":"");}
const MESES=["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

/* ---------- obras: mesma regra do painel (código da obra, senão nome) ---------- */
function obraChave(r){const id=norm(r.idobra);return id?"ID:"+id:"NOME:"+norm(r.obra);}
function montarCanon(lista){
  const g={};
  lista.slice().sort((a,b)=>a.data.localeCompare(b.data)).forEach(r=>{
    const k=obraChave(r),x=g[k]=g[k]||{id:"",nomes:{},locais:{}};
    if(String(r.idobra??"").trim())x.id=String(r.idobra).trim();
    const conta=(m,v)=>{v=String(v||"").trim().replace(/\s+/g," ");if(!v)return;const n=norm(v);const e=m[n]=m[n]||{c:0,g:{}};e.c++;e.g[v]=(e.g[v]||0)+1;};
    conta(x.nomes,r.obra);conta(x.locais,r.local);
  });
  const top=m=>{let b=null;Object.values(m).forEach(v=>{if(!b||v.c>b.c)b=v;});if(!b)return"";let t="",c=0;Object.entries(b.g).forEach(([k,n])=>{if(n>c){t=k;c=n;}});return t;};
  canon={};Object.entries(g).forEach(([k,x])=>canon[k]={idobra:x.id,obra:top(x.nomes),local:top(x.locais)});
}
function nomeObra(k){const c=canon[k]||{};return [c.idobra,c.obra].map(v=>String(v??"").trim()).filter(Boolean).join(" - ")+(c.local?" / "+c.local:"");}
function obraAtiva(k){if(!cadObras.length||!k.startsWith("ID:"))return true;const o=cadObras.find(x=>norm(x.id)===k.slice(3));return !!o&&o.ativa;}

/* ---------- cálculos de um RDO ---------- */
function horasRdo(r){
  const p=v=>{const m=/^(\d{1,2}):(\d{2})/.exec(hora(v));return m?(+m[1])*60+(+m[2]):null;};
  const a=p(r.hini),b=p(r.hfim);if(a==null||b==null||b<=a)return null;
  let h=(b-a)/60;if(h>6)h-=1;return h;
}
const hh=r=>{const h=horasRdo(r);return h==null?0:h*r.total;};
const temOcor=r=>!!String(r.ocor||"").trim();
const chuva=r=>ruim(r.clima_manha)||ruim(r.clima_tarde);
const diaPreench=r=>diaSP(r.salvo_no_celular)||diaSP(r.recebido_em);

/* ---------- assuntos das ocorrências ---------- */
const TAGS=[
  ["seg","Segurança / acidente",/acident|incident|ferid|machuc|lesao|seguranca|\bepi\b|queda|caiu|choque/],
  ["mat","Falta de material",/falt\w* (de )?(material|pec|tubo|conex|cabo|insumo)|sem material|aguardando material|material nao (chegou|entregue)|atraso (na|da) entrega/],
  ["par","Paralisação",/paralis|paral[iy]|parad[ao]|interromp|suspens|impedid|sem acesso|liberacao/],
  ["equ","Equipamento",/equipamento|maquina|gerador|bomba|caminhao|munck|retro|escavadeira|compressor|pane|quebr\w* (o|a) (equip|maq)/],
  ["ret","Retrabalho / defeito",/retrabalho|refaz|refeit|vazament|defeit|trinc|fissur|errad/],
  ["cli","Cliente / fiscalização",/cliente|fiscal|contratante|vistoria|visita|engenheir/],
  ["cli2","Clima",/chuva|temporal|tempo ruim|alagad/],
  ["equipe","Equipe",/falt\w* (de )?(funcionario|colaborador|ajudante|pessoal|mao de obra)|atestado|ausen|faltou/],
];
const NOME_TAG=Object.fromEntries(TAGS.map(([k,n])=>[k,n]));NOME_TAG.out="Outros assuntos";
function tagsDe(t){const s=norm(t).toLowerCase();const r=TAGS.filter(([,,re])=>re.test(s)).map(([k])=>k);return r.length?r:["out"];}
/* "Tratada": guardado na central (aba "Ocorrências tratadas" da planilha), vale em qualquer computador */
const LS="rdo-ocor-tratadas";
let tratadas=new Set();
async function enviar(corpo){
  const r=await fetch(CENTRAL.url,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({...corpo,senha})});
  const j=await r.json();if(!j.ok)throw new Error(j.erro||"falha");return j;
}
async function marcarTratada(uid,on,btn){
  const antes=new Set(tratadas);if(on)tratadas.add(uid);else tratadas.delete(uid);
  if(btn){btn.disabled=true;btn.textContent=on?"Registrando…":"Reabrindo…";}
  try{const j=await enviar({acao:"tratadaSalvar",adicionar:on?[uid]:[],remover:on?[]:[uid]});tratadas=new Set(j.tratadas||[]);msg("msg-oc","");}
  catch(e){tratadas=antes;msg("msg-oc","Não consegui registrar na central: "+e.message,true);}
  render();if(S.aba!=="ocor")renderOcor();
}
// marcações feitas na prévia (guardadas só no computador) sobem para a central uma vez
async function migrarLocais(){
  let loc=[];try{loc=JSON.parse(localStorage.getItem(LS)||"[]");}catch(e){}
  const novas=loc.filter(u=>!tratadas.has(u));
  if(!loc.length)return;
  try{if(novas.length){const j=await enviar({acao:"tratadaSalvar",adicionar:novas,remover:[]});tratadas=new Set(j.tratadas||[]);}localStorage.removeItem(LS);render();}catch(e){}
}

/* ---------- central ---------- */
async function chamar(params){
  const u=CENTRAL.url+"?"+new URLSearchParams({...params,senha,_:Date.now()}).toString();
  const r=await fetch(u,{cache:"no-store"});const j=await r.json();
  if(!j.ok){const e=new Error(j.erro||"falha");e.codigo=j.erro;throw e;}
  return j;
}
async function carregar(){
  const [j,o]=await Promise.all([chamar({acao:"listar"}),chamar({acao:"obrasTodas"}).catch(()=>({obras:[]}))]);
  todos=(j.rdos||[]).map(r=>({...r,data:dataStr(r.data),total:num(r.total)})).filter(r=>r.data);
  ciente=new Set(j.ciente||[]);cadObras=o.obras||[];tratadas=new Set(j.tratadas||[]);
  montarCanon(todos);montarFiltros();render();
  $("atualizado").textContent="Atualizado às "+new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})+" · "+todos.length+" RDOs na central";
  if(Array.isArray(j.tratadas))migrarLocais();
}
async function entrar(s){
  senha=s;msg("msg-login","Entrando…");
  try{await carregar();
    try{sessionStorage.setItem("sup-senha",senha);}catch(e){}
    $("v-login").hidden=true;$("v-painel").hidden=false;msg("msg-login","");
  }catch(e){
    senha="";try{sessionStorage.removeItem("sup-senha");}catch(x){}
    $("v-login").hidden=false;$("v-painel").hidden=true;
    msg("msg-login",e.codigo==="senha incorreta"?"Senha incorreta.":e.codigo==="senha vencida"?"A senha venceu. Troque no Painel do Supervisor.":"Não consegui entrar: "+e.message,true);
  }
}
$("v-login").addEventListener("submit",e=>{e.preventDefault();const s=$("senha").value;if(!s)return msg("msg-login","Digite a senha.",true);entrar(s);});
$("b-sair").onclick=()=>{location.href="supervisor.html";senha="";todos=[];try{sessionStorage.removeItem("sup-senha");}catch(e){}$("v-painel").hidden=true;$("v-login").hidden=false;$("senha").value="";};
$("b-atualizar").onclick=async()=>{const b=$("b-atualizar");b.disabled=true;b.textContent="Atualizando…";
  try{await carregar();b.textContent="✓ Atualizado";msg("msg-atu","");}catch(e){b.textContent="Atualizar";msg("msg-atu","Não consegui atualizar: "+e.message,true);}
  finally{b.disabled=false;setTimeout(()=>b.textContent="Atualizar",2000);}};

/* ---------- filtros ---------- */
function montarFiltros(){
  const so=$("f-obra"),cur=so.value;
  const obras=[...new Set(todos.map(obraChave))].map(k=>[k,nomeObra(k)]).sort((a,b)=>a[1].localeCompare(b[1],"pt"));
  so.innerHTML='<option value="">Todas as obras</option>'+obras.map(([k,n])=>`<option value="${esc(k)}"${k===cur?" selected":""}>${esc(n)}</option>`).join("");
  const sr=$("f-resp"),cr=sr.value;
  sr.innerHTML='<option value="">Todos</option>'+[...new Set(todos.map(r=>String(r.resp||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt")).map(v=>`<option${v===cr?" selected":""}>${esc(v)}</option>`).join("");
  const oo=$("o-obra"),co=S.obra||oo.value;
  // ficha: obras ativas primeiro, depois as inativas
  const ord=obras.slice().sort((a,b)=>(obraAtiva(b[0])-obraAtiva(a[0]))||a[1].localeCompare(b[1],"pt"));
  oo.innerHTML=ord.map(([k,n])=>`<option value="${esc(k)}"${k===co?" selected":""}>${esc(n)}${obraAtiva(k)?"":" (inativa)"}</option>`).join("");
  if(!S.obra&&ord.length){const ult=todos.slice().sort((a,b)=>b.data.localeCompare(a.data))[0];S.obra=ult?obraChave(ult):ord[0][0];oo.value=S.obra;}
}
function periodo(){
  const v=$("f-per").value,h=hoje(),d=new Date();
  const seg=x=>{const z=new Date(x);const w=(z.getDay()+6)%7;z.setDate(z.getDate()-w);return z;};
  if(v==="semana"){return [iso(seg(d)),h];}
  if(v==="semana-1"){const a=seg(d);a.setDate(a.getDate()-7);const b=new Date(a);b.setDate(b.getDate()+6);return [iso(a),iso(b)];}
  if(v==="mes"){return [h.slice(0,8)+"01",h];}
  if(v==="mes-1"){const a=new Date(d.getFullYear(),d.getMonth()-1,1),b=new Date(d.getFullYear(),d.getMonth(),0);return [iso(a),iso(b)];}
  if(v==="30"||v==="90"){return [somaDias(h,-(+v-1)),h];}
  return [$("f-de").value||h.slice(0,8)+"01",$("f-ate").value||h];
}
$("f-per").addEventListener("change",()=>{const p=$("f-per").value==="pers";$("l-de").hidden=$("l-ate").hidden=!p;
  if(p&&!$("f-de").value){$("f-de").value=hoje().slice(0,8)+"01";$("f-ate").value=hoje();}render();});
["f-de","f-ate","f-obra","f-resp"].forEach(id=>$(id).addEventListener("change",render));
function filtrar(de,ate){
  const o=$("f-obra").value,p=$("f-resp").value;
  return todos.filter(r=>(!o||obraChave(r)===o)&&(!p||String(r.resp||"").trim()===p)&&r.data>=de&&r.data<=ate);
}

/* ---------- dias úteis esperados por obra ---------- */
const primeiroRdo={};
function inicioObra(k){if(!(k in primeiroRdo)){const ds=todos.filter(r=>obraChave(r)===k).map(r=>r.data).sort();primeiroRdo[k]=ds[0]||"";}return primeiroRdo[k];}
function cobertura(k,de,ate,datas){
  // dias de segunda a sexta entre o primeiro RDO da obra (ou o início do período) e ontem
  const fim=[ate,ontem()].sort()[0],ini=[de,inicioObra(k)].sort()[1];
  let esp=0,com=0,just=0;const faltas=[];
  if(!ini||ini>fim)return {esp,com,just,faltas};
  for(let d=dia(ini);iso(d)<=fim;d.setDate(d.getDate()+1)){
    if(d.getDay()===0||d.getDay()===6)continue;
    const s=iso(d);esp++;
    if(datas.has(s))com++;else if(ciente.has(k+"|"+s))just++;else faltas.push(s);
  }
  return {esp,com,just,faltas};
}
function resumo(L,de,ate){
  const porObra={};
  L.forEach(r=>{const k=obraChave(r);const x=porObra[k]=porObra[k]||{k,rdos:[],datas:new Set()};x.rdos.push(r);x.datas.add(r.data);});
  // obra ativa sem nenhum RDO no período também conta (se já tinha RDO antes e não há filtro de encarregado)
  if(!$("f-resp").value){const fo=$("f-obra").value;
    [...new Set(todos.map(obraChave))].forEach(k=>{if((fo&&k!==fo)||porObra[k])return;if(obraAtiva(k)&&inicioObra(k)&&inicioObra(k)<=ate)porObra[k]={k,rdos:[],datas:new Set()};});}
  let esp=0,com=0,just=0;
  Object.values(porObra).forEach(x=>{x.cob=obraAtiva(x.k)?cobertura(x.k,de,ate,x.datas):{esp:0,com:0,just:0,faltas:[]};esp+=x.cob.esp;com+=x.cob.com;just+=x.cob.just;});
  const hd=L.reduce((s,r)=>s+r.total,0),hhT=L.reduce((s,r)=>s+hh(r),0);
  const diasChuva=new Set(L.filter(chuva).map(r=>obraChave(r)+"|"+r.data)).size;
  const ocor=L.filter(temOcor),abertas=ocor.filter(r=>!tratadas.has(r.uid)).length;
  const comData=L.filter(r=>diaPreench(r)),mesmoDia=comData.filter(r=>diaPreench(r)<=r.data).length;
  return {porObra,esp,com,just,hd,hh:hhT,diasChuva,ocor:ocor.length,abertas,rdos:L.length,mesmoDia,comData:comData.length};
}

/* ---------- render geral ---------- */
function render(){
  if(!todos.length&&!senha)return;
  const [de,ate]=periodo();const dias=Math.round((dia(ate)-dia(de))/864e5)+1;
  const deA=somaDias(de,-dias),ateA=somaDias(de,-1);
  const R=resumo(filtrar(de,ate),de,ate),A=resumo(filtrar(deA,ateA),deA,ateA);
  $("periodo-txt").textContent=`Período: ${fmt(de)} a ${fmt(ate)} · comparação com ${fmt(deA)} a ${fmt(ateA)}`;
  const vari=(a,b,melhorSobe,suf)=>{if(b==null||a==null)return"";if(!b&&!a)return`<span class="var igual">igual ao período anterior</span>`;
    if(!b)return`<span class="var igual">sem dados no período anterior</span>`;const d=a-b;if(Math.abs(d)<0.5)return`<span class="var igual">= igual ao período anterior</span>`;
    const bom=melhorSobe?d>0:d<0;return`<span class="var ${bom?"sobe":"desce"}">${d>0?"▲":"▼"} ${nf(Math.abs(d))}${suf||""} vs. anterior</span>`;};
  const kpi=(t,v,s,vr)=>`<div class="kpi"><span>${t}</span><b>${v}</b>${s?`<small>${s}</small>`:""}${vr||""}</div>`;
  const cob=pct(R.com,R.esp),cobA=pct(A.com,A.esp),md=pct(R.mesmoDia,R.comData),mdA=pct(A.mesmoDia,A.comData);
  $("kpis").innerHTML=
    kpi("RDOs recebidos",nf(R.rdos),plural(Object.values(R.porObra).filter(x=>x.rdos.length).length,"obra","obras"),vari(R.rdos,A.rdos,true))+
    kpi("Dias úteis com RDO",cob==null?"–":cob+"%",R.esp?`${R.com} de ${R.esp} dias${R.just?` · ${R.just} ciente`:""}`:"sem dias úteis no período",vari(cob,cobA,true," p.p."))+
    kpi("Homem-dia",nf(R.hd),"soma do efetivo",vari(R.hd,A.hd,true))+
    kpi("Homem-hora",nf(R.hh),"pessoas × horas de expediente",vari(R.hh,A.hh,true))+
    kpi("Dias com chuva",nf(R.diasChuva),"obra-dia com chuva ou impraticável",vari(R.diasChuva,A.diasChuva,false))+
    kpi("Ocorrências",nf(R.ocor),R.ocor?`${R.abertas} aberta${R.abertas===1?"":"s"}`:"nenhuma no período",vari(R.ocor,A.ocor,false))+
    kpi("Preenchidos no mesmo dia",md==null?"–":md+"%",R.comData?`${R.mesmoDia} de ${R.comData} RDOs`:"",vari(md,mdA,true," p.p."));
  renderObras(R);const deS=somaDias(ate,-83);renderSemanas(filtrar(deS,ate),deS,ate);
  const nAb=R.abertas;$("n-ocor").hidden=!nAb;$("n-ocor").textContent=nAb;
  if(S.aba==="obra")renderFicha();if(S.aba==="ocor")renderOcor();
}
function renderObras(R){
  const linhas=Object.values(R.porObra).map(x=>{
    const c=x.cob,ult=x.rdos.map(r=>r.data).sort().pop();
    return {...x,ord:c.esp?c.com/c.esp:2,ult,hh:x.rdos.reduce((s,r)=>s+hh(r),0),chuva:new Set(x.rdos.filter(chuva).map(r=>r.data)).size,oc:x.rdos.filter(temOcor).length};
  }).sort((a,b)=>a.ord-b.ord||nomeObra(a.k).localeCompare(nomeObra(b.k),"pt"));
  if(!linhas.length){$("tb-obras").innerHTML=`<tr><td colspan="7" class="vazio-msg">Nenhum RDO no período.</td></tr>`;return;}
  $("tb-obras").innerHTML=linhas.map(x=>{
    const c=x.cob,p=c.esp?pct(c.com,c.esp):null;
    const bar=!obraAtiva(x.k)?`<span class="status">obra inativa</span>`:!c.esp?`<span class="status">sem dias úteis</span>`:
      `<div class="barra"><div class="t"><i style="width:${100*c.com/c.esp}%;background:var(--ok)"></i><i style="width:${100*c.just/c.esp}%;background:var(--just)"></i><i style="width:${100*c.faltas.length/c.esp}%;background:var(--falta)"></i></div><b>${c.com}/${c.esp}</b></div>`;
    return `<tr class="clic" data-k="${esc(x.k)}"><td><b>${esc(nomeObra(x.k))}</b></td><td title="${p==null?"":p+"%"}">${bar}</td><td class="n">${x.rdos.length}</td><td class="n">${nf(x.hh)}</td><td class="n">${x.chuva||"–"}</td><td class="n">${x.oc?`<b style="color:var(--alerta)">${x.oc}</b>`:"–"}</td><td>${x.ult?fmt(x.ult):"<span class='status'>sem RDO no período</span>"}</td></tr>`;
  }).join("");
  $("tb-obras").querySelectorAll("tr[data-k]").forEach(tr=>tr.onclick=()=>{S.obra=tr.dataset.k;$("o-obra").value=S.obra;const [,ate]=periodo();S.mes=ate.slice(0,7);abrirAba("obra");});
}
function renderSemanas(L,de,ate){
  $("leg-sem").innerHTML=FUNCOES.map(([,n,v])=>`<span><i style="background:var(${v})"></i>${n}</span>`).join("");
  const seg=s=>{const d=dia(s);d.setDate(d.getDate()-((d.getDay()+6)%7));return iso(d);};
  const g={};for(let s=seg(de);s<=ate;s=somaDias(s,7))g[s]={lider:0,montador:0,auxiliar:0,outros:0,n:0};
  L.forEach(r=>{const h=horasRdo(r);const x=g[seg(r.data)];if(!x)return;x.n++;if(h==null)return;FUNCOES.forEach(([k])=>x[k]+=num(r[k])*h);});
  barras($("g-sem"),Object.keys(g).sort().map(s=>({rot:fmt(s).slice(0,5),dica:`Semana de ${fmt(s)}`,v:g[s],extra:`${g[s].n} RDO${g[s].n===1?"":"s"}`})),"h");
}
/* gráfico de barras empilhadas por função */
function barras(box,itens,unid){
  const tot=v=>FUNCOES.reduce((s,[k])=>s+v[k],0);
  if(!itens.length||!itens.some(i=>tot(i.v)>0)){box.innerHTML='<p class="vazio-msg">Sem dados no período.</p>';return;}
  const max=Math.max(1,...itens.map(i=>tot(i.v)));
  const passos=[1,2,5,10,20,25,50,100,200,250,500,1000,2000,5000,10000];const passo=passos.find(p=>max/p<=5)||10000,topo=Math.ceil(max/passo)*passo;
  const H=220,ml=44,mb=26,mt=10,gap=6,bw=Math.max(8,Math.min(40,Math.floor(680/itens.length)-gap));
  const W=Math.max(box.clientWidth||600,ml+itens.length*(bw+gap)+10);const y=v=>mt+(H-mt-mb)*(1-v/topo);
  let s=`<svg width="${W}" height="${H}" role="img" aria-label="Gráfico de barras empilhadas por função">`;
  for(let v=0;v<=topo;v+=passo)s+=`<line x1="${ml}" x2="${W-4}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)"/><text x="${ml-6}" y="${y(v)+4}" text-anchor="end">${nf(v)}</text>`;
  const cada=Math.ceil(itens.length/14);
  itens.forEach((it,i)=>{const x=ml+6+i*(bw+gap);let base=0;const segs=FUNCOES.filter(([k])=>it.v[k]>0);
    segs.forEach(([k,,cv],j)=>{const val=it.v[k],y1=y(base+val),h=Math.max(0,y(base)-y1-(j>0?2:0)),top=j===segs.length-1,r=top?Math.min(4,h/2,bw/2):0;
      s+=top?`<path d="M${x},${y1+h} V${y1+r} Q${x},${y1} ${x+r},${y1} H${x+bw-r} Q${x+bw},${y1} ${x+bw},${y1+r} V${y1+h} Z" fill="var(${cv})"/>`:`<rect x="${x}" y="${y1}" width="${bw}" height="${h}" fill="var(${cv})"/>`;base+=val;});
    if(i%cada===0)s+=`<text x="${x+bw/2}" y="${H-8}" text-anchor="middle">${esc(it.rot)}</text>`;
    s+=`<rect class="hit" data-i="${i}" x="${x-gap/2}" y="${mt}" width="${bw+gap}" height="${H-mt-mb}" fill="transparent"/>`;});
  box.innerHTML=s+"</svg><div class='tip' hidden></div>";
  const tip=box.querySelector(".tip");
  box.querySelectorAll(".hit").forEach(h=>{
    h.addEventListener("mouseenter",()=>{const it=itens[+h.dataset.i];
      tip.innerHTML=`<b>${esc(it.dica)}</b> · ${nf(tot(it.v),unid==="h"?0:0)}${unid==="h"?" homem-hora":" pessoas"}<br>`+FUNCOES.map(([k,n,cv])=>`<span class="dot" style="background:var(${cv})"></span> ${n}: ${nf(it.v[k])}`).join("<br>")+(it.extra?`<br><span class="status">${esc(it.extra)}</span>`:"");
      tip.hidden=false;tip.style.left=Math.min(+h.getAttribute("x")+20,box.scrollWidth-190)+"px";tip.style.top="6px";});
    h.addEventListener("mouseleave",()=>tip.hidden=true);});
}

/* ---------- abas ---------- */
function abrirAba(a){S.aba=a;document.querySelectorAll("[data-aba]").forEach(b=>b.setAttribute("aria-selected",String(b.dataset.aba===a)));
  ["geral","obra","ocor"].forEach(x=>$("a-"+x).hidden=x!==a);if(a==="obra")renderFicha();if(a==="ocor")renderOcor();window.scrollTo({top:0});}
document.querySelectorAll("[data-aba]").forEach(b=>b.onclick=()=>abrirAba(b.dataset.aba));

/* ---------- ficha da obra ---------- */
$("o-obra").addEventListener("change",()=>{S.obra=$("o-obra").value;renderFicha();});
$("o-ant").onclick=()=>{S.mes=mesSoma(S.mes,-1);renderFicha();};
$("o-prox").onclick=()=>{S.mes=mesSoma(S.mes,1);renderFicha();};
function mesSoma(m,n){const[y,mm]=m.split("-").map(Number);const d=new Date(y,mm-1+n,1);return iso(d).slice(0,7);}
function renderFicha(){
  if(!S.obra){$("o-cal").innerHTML='<p class="vazio-msg">Nenhuma obra com RDO.</p>';return;}
  if(!S.mes)S.mes=hoje().slice(0,7);
  const k=S.obra,[y,m]=S.mes.split("-").map(Number);
  $("o-mes").textContent=MESES[m-1]+" "+y;$("o-prox").disabled=S.mes>=hoje().slice(0,7);
  const de=S.mes+"-01",ate=iso(new Date(y,m,0));
  const L=todos.filter(r=>obraChave(r)===k&&r.data>=de&&r.data<=ate);
  const porDia={};L.forEach(r=>(porDia[r.data]=porDia[r.data]||[]).push(r));
  const ativa=obraAtiva(k),ini=inicioObra(k),hj=hoje(),on=ontem();
  // mini indicadores do mês
  const c=ativa?cobertura(k,de,ate,new Set(Object.keys(porDia))):{esp:0,com:0,just:0,faltas:[]};
  const hhM=L.reduce((s,r)=>s+hh(r),0),hd=L.reduce((s,r)=>s+r.total,0);
  const resp=[...new Set(L.map(r=>String(r.resp||"").trim()).filter(Boolean))];
  const mini=(t,v)=>`<div class="mini"><span>${t}</span><b>${v}</b></div>`;
  $("o-minis").innerHTML=mini("RDOs no mês",L.length)+mini("Dias úteis com RDO",c.esp?`${c.com}/${c.esp}`:"–")+mini("Sem RDO",c.faltas.length?`<span style="color:var(--falta)">${c.faltas.length}</span>`:"0")+
    mini("Homem-dia",nf(hd))+mini("Homem-hora",nf(hhM))+mini("Dias de chuva",new Set(L.filter(chuva).map(r=>r.data)).size)+mini("Ocorrências",L.filter(temOcor).length)+
    mini("Encarregado"+(resp.length>1?"s":""),`<span style="font-size:.85rem">${esc(resp.join(", ")||"–")}</span>`);
  // calendário
  const prim=new Date(y,m-1,1),off=(prim.getDay()+6)%7;
  let h=["seg","ter","qua","qui","sex","sáb","dom"].map(d=>`<div class="sem">${d}</div>`).join("");
  for(let i=0;i<off;i++)h+=`<div class="d vazio"></div>`;
  for(let d=1;d<=+ate.slice(8);d++){
    const s=S.mes+"-"+String(d).padStart(2,"0"),wd=dia(s).getDay(),fds=wd===0||wd===6,rs=porDia[s];
    let cls="d",ti=fmt(s),ic="";
    if(rs){cls+=" ok";const ef=rs.reduce((a,r)=>a+r.total,0);
      if(rs.some(chuva))ic+=`<span class="dot" style="background:var(--chuva)" title="Chuva"></span>`;
      if(rs.some(temOcor))ic+=`<span class="dot" style="background:var(--alerta)" title="Ocorrência"></span>`;
      ti+=` · ${rs.length>1?rs.length+" RDOs · ":""}${ef} pessoas${rs.some(chuva)?" · chuva":""}${rs.some(temOcor)?" · ocorrência":""}`;
      h+=`<button type="button" class="${cls}${s===hj?" hoje":""}" data-d="${s}" title="${esc(ti)}"><span>${d}</span><span class="ic">${ic}</span><span class="ef">${ef}</span></button>`;continue;}
    if(s>on)cls+=" futuro";
    else if(fds)cls+=" fds";
    else if(ativa&&ini&&s>=ini){if(ciente.has(k+"|"+s)){cls+=" just";ti+=" · sem RDO (ciente)";}else{cls+=" falta";ti+=" · sem RDO";}}
    else cls+=" fds";
    h+=`<div class="${cls}${s===hj?" hoje":""}" title="${esc(ti)}"><span>${d}</span></div>`;
  }
  $("o-cal").innerHTML=h;
  $("o-cal").querySelectorAll("button[data-d]").forEach(b=>b.onclick=()=>{const rs=porDia[b.dataset.d];abrirRdo(rs[0],rs);});
  // efetivo por dia
  $("o-leg").innerHTML=FUNCOES.map(([,n,v])=>`<span><i style="background:var(${v})"></i>${n}</span>`).join("");
  const dias=[];for(let d=1;d<=+ate.slice(8);d++){const s=S.mes+"-"+String(d).padStart(2,"0");if(s>hj)break;const rs=porDia[s]||[];
    const v={lider:0,montador:0,auxiliar:0,outros:0};rs.forEach(r=>FUNCOES.forEach(([kk])=>v[kk]+=num(r[kk])));dias.push({rot:String(d).padStart(2,"0"),dica:fmt(s),v,extra:rs.length?"":"sem RDO"});}
  barras($("o-graf"),dias,"p");
  // homem-hora acumulado
  let ac=0;const pts=dias.map((x,i)=>{const s=S.mes+"-"+x.rot;ac+=(porDia[s]||[]).reduce((a,r)=>a+hh(r),0);return {i,v:ac,rot:x.rot};});
  linha($("o-acum"),pts);
  // fotos
  const fotos=[];L.slice().sort((a,b)=>b.data.localeCompare(a.data)).forEach(r=>{let f=[];try{f=JSON.parse(r.fotos||"[]");}catch(e){}f.forEach(x=>x&&x.id&&fotos.push({...x,r}));});
  $("o-nfotos").textContent=fotos.length?`(${fotos.length})`:"";
  const chave=k+"|"+S.mes;
  if(S.fotosMes!==chave){S.fotosMes=chave;$("o-gal").innerHTML="";msg("o-msg-gal","");
    if(!fotos.length){$("o-gal").innerHTML='<p class="vazio-msg">Nenhuma foto neste mês.</p>';$("o-carregar").hidden=true;}
    else{$("o-carregar").hidden=false;$("o-carregar").textContent=`Carregar ${fotos.length>12?"as 12 mais recentes":"as "+fotos.length+" fotos"}`;
      $("o-gal").innerHTML=`<p class="vazio-msg">As fotos ficam no Google Drive e são baixadas só quando você pedir, para a tela abrir rápido.</p>`;
      $("o-carregar").onclick=()=>carregarFotos(fotos,0);}}
}
function carregarFotos(fotos,ini){
  const lote=fotos.slice(ini,ini+12);if(!ini)$("o-gal").innerHTML="";
  lote.forEach(f=>{const fig=document.createElement("figure");fig.innerHTML=`<div class="ph">Carregando…</div><figcaption>${fmt(f.r.data).slice(0,5)} · ${esc(f.desc||"sem legenda")}</figcaption>`;fig.onclick=()=>abrirRdo(f.r);$("o-gal").appendChild(fig);
    chamar({acao:"foto",id:f.id}).then(j=>{fig.querySelector(".ph").innerHTML=`<img alt="${esc(f.desc||"")}" src="data:${j.tipo||"image/jpeg"};base64,${j.b64}">`;}).catch(()=>{fig.querySelector(".ph").textContent="Foto indisponível";});});
  const resto=fotos.length-(ini+lote.length);
  $("o-carregar").hidden=resto<=0;$("o-carregar").textContent=`Carregar mais ${Math.min(12,resto)}`;$("o-carregar").onclick=()=>carregarFotos(fotos,ini+12);
}
function linha(box,pts){
  if(!pts.length||!pts[pts.length-1].v){box.innerHTML='<p class="vazio-msg">Sem homem-hora registrado neste mês.</p>';return;}
  const H=150,ml=44,mb=24,mt=10,W=Math.max(box.clientWidth||600,300),max=pts[pts.length-1].v;
  const passos=[10,20,50,100,200,250,500,1000,2000,5000,10000];const passo=passos.find(p=>max/p<=4)||10000,topo=Math.ceil(max/passo)*passo;
  const x=i=>ml+8+(W-ml-20)*(pts.length>1?i/(pts.length-1):0),y=v=>mt+(H-mt-mb)*(1-v/topo);
  let s=`<svg width="${W}" height="${H}" role="img" aria-label="Homem-hora acumulado no mês">`;
  for(let v=0;v<=topo;v+=passo)s+=`<line x1="${ml}" x2="${W-4}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)"/><text x="${ml-6}" y="${y(v)+4}" text-anchor="end">${nf(v)}</text>`;
  const d=pts.map((p,i)=>(i?"L":"M")+x(i).toFixed(1)+","+y(p.v).toFixed(1)).join(" ");
  s+=`<path d="${d} L${x(pts.length-1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z" fill="var(--s1)" opacity=".12"/><path d="${d}" fill="none" stroke="var(--s1)" stroke-width="2.5" stroke-linejoin="round"/>`;
  const cada=Math.ceil(pts.length/10);pts.forEach((p,i)=>{if(i%cada===0||i===pts.length-1)s+=`<text x="${x(i)}" y="${H-6}" text-anchor="middle">${p.rot}</text>`;});
  const u=pts[pts.length-1];s+=`<circle cx="${x(pts.length-1)}" cy="${y(u.v)}" r="4" fill="var(--s1)"/><text x="${x(pts.length-1)-6}" y="${y(u.v)-8}" text-anchor="end" style="font-weight:700;fill:var(--fg)">${nf(u.v)} h</text>`;
  box.innerHTML=s+"</svg>";
}

/* ---------- ocorrências ---------- */
$("oc-tratadas").addEventListener("change",renderOcor);
function renderOcor(){
  const [de,ate]=periodo();
  const L=filtrar(de,ate).filter(temOcor).map(r=>({r,tags:tagsDe(r.ocor),ok:tratadas.has(r.uid)})).sort((a,b)=>b.r.data.localeCompare(a.r.data));
  const ver=$("oc-tratadas").checked,vis=L.filter(x=>ver||!x.ok);
  const cont={};vis.forEach(x=>x.tags.forEach(t=>cont[t]=(cont[t]||0)+1));
  if(S.ocTag&&!cont[S.ocTag])S.ocTag="";
  $("oc-chips").innerHTML=`<button type="button" class="chipf" data-t="" aria-pressed="${!S.ocTag}">Todas<span class="n">${vis.length}</span></button>`+
    Object.entries(cont).sort((a,b)=>b[1]-a[1]).map(([t,n])=>`<button type="button" class="chipf" data-t="${t}" aria-pressed="${S.ocTag===t}">${esc(NOME_TAG[t])}<span class="n">${n}</span></button>`).join("");
  $("oc-chips").querySelectorAll("[data-t]").forEach(b=>b.onclick=()=>{S.ocTag=b.dataset.t;renderOcor();});
  const mostrar=vis.filter(x=>!S.ocTag||x.tags.includes(S.ocTag));
  $("oc-lista").innerHTML=mostrar.length?mostrar.map(({r,tags,ok})=>`<div class="oc${ok?" tratada":""}">
      <div class="cab"><b>${esc(nomeObra(obraChave(r)))}</b><span>${fmt(r.data)}</span><span>RDO ${esc(r.rdo)}</span><span>${esc(r.resp||"")}</span></div>
      <div class="txt">${esc(String(r.ocor).trim())}</div>
      <div class="pe">${tags.map(t=>`<span class="tag${t==="seg"?" seg":""}">${esc(NOME_TAG[t])}</span>`).join("")}
        <span class="acoes"><button type="button" class="linkbtn" data-ver="${esc(r.uid)}">Ver RDO</button>${ok?`<button type="button" class="linkbtn" data-reabrir="${esc(r.uid)}">Reabrir</button>`:`<button type="button" class="btn-tratar" data-tratar="${esc(r.uid)}">✓ Tratada</button>`}</span></div></div>`).join("")
    :`<p class="vazio-msg">${L.length?"Nenhuma ocorrência aberta neste filtro.":"Nenhuma ocorrência registrada no período."}</p>`;
  const porUid=Object.fromEntries(L.map(x=>[x.r.uid,x.r]));
  $("oc-lista").querySelectorAll("[data-ver]").forEach(b=>b.onclick=()=>abrirRdo(porUid[b.dataset.ver]));
  $("oc-lista").querySelectorAll("[data-tratar]").forEach(b=>b.onclick=()=>marcarTratada(b.dataset.tratar,true,b));
  $("oc-lista").querySelectorAll("[data-reabrir]").forEach(b=>b.onclick=()=>marcarTratada(b.dataset.reabrir,false,b));
  // por obra
  const g={};L.forEach(x=>{const k=obraChave(x.r),o=g[k]=g[k]||{ab:0,tr:0,t:{}};x.ok?o.tr++:o.ab++;x.tags.forEach(t=>o.t[t]=(o.t[t]||0)+1);});
  const ls=Object.entries(g).sort((a,b)=>b[1].ab-a[1].ab||b[1].tr-a[1].tr);
  $("oc-obras").innerHTML=ls.length?ls.map(([k,o])=>`<tr><td><b>${esc(nomeObra(k))}</b></td><td class="n">${o.ab?`<b style="color:var(--alerta)">${o.ab}</b>`:"0"}</td><td class="n">${o.tr}</td><td>${Object.entries(o.t).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([t,n])=>`<span class="tag${t==="seg"?" seg":""}">${esc(NOME_TAG[t])} · ${n}</span>`).join(" ")}</td></tr>`).join("")
    :`<tr><td colspan="4" class="vazio-msg">Nenhuma ocorrência no período.</td></tr>`;
}

/* ---------- detalhe do RDO ---------- */
function abrirRdo(r,todosDoDia){
  let fotos=[];try{fotos=JSON.parse(r.fotos||"[]");}catch(e){}
  const campo=(t,v)=>`<div><span>${t}</span>${esc(v||"-")}</div>`;
  const bloco=(t,v)=>v&&String(v).trim()?`<div><div class="det"><div><span>${t}</span></div></div><div class="txt">${esc(v)}</div></div>`:"";
  const outros=(todosDoDia||[]).length>1?`<div class="status">Há ${todosDoDia.length} RDOs neste dia: ${todosDoDia.map((x,i)=>`<button type="button" class="linkbtn" data-i="${i}">RDO ${esc(x.rdo)}</button>`).join(" · ")}</div>`:"";
  $("modal-box").innerHTML=`<div class="topo"><h3>RDO ${esc(r.rdo)} · ${esc(nomeObra(obraChave(r)))}</h3><button type="button" class="btn sec" id="m-fechar">Fechar</button></div>${outros}
    <div class="det">${campo("Data",fmt(r.data))}${campo("Responsável",r.resp)}${campo("Expediente",(hora(r.hini)||"?")+" às "+(hora(r.hfim)||"?"))}
    ${campo("Tempo",semIcone(r.clima_manha)+" / "+semIcone(r.clima_tarde))}${campo("Efetivo",r.total+" pessoas")}${campo("Homem-hora",horasRdo(r)==null?"sem horário":nf(hh(r),1))}</div>
    ${bloco("Atividades executadas",r.ativ)}${bloco("Equipamentos",r.equip)}${bloco("Materiais recebidos",r.mat)}${bloco("Ocorrências",r.ocor)}${bloco("Observações",r.obs)}
    ${fotos.length?`<div class="galeria">${fotos.map(f=>`<figure><div class="ph" data-id="${esc(f.id)}">Carregando…</div><figcaption>${esc(f.desc||"sem legenda")}</figcaption></figure>`).join("")}</div>`:""}`;
  $("modal").hidden=false;$("m-fechar").onclick=fechar;
  $("modal-box").querySelectorAll("[data-i]").forEach(b=>b.onclick=()=>abrirRdo(todosDoDia[+b.dataset.i],todosDoDia));
  $("modal-box").querySelectorAll(".ph[data-id]").forEach(ph=>chamar({acao:"foto",id:ph.dataset.id}).then(j=>{ph.innerHTML=`<img alt="" src="data:${j.tipo||"image/jpeg"};base64,${j.b64}">`;}).catch(()=>ph.textContent="Foto indisponível"));
}
function fechar(){$("modal").hidden=true;$("modal-box").innerHTML="";}
$("modal").addEventListener("click",e=>{if(e.target===$("modal"))fechar();});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("modal").hidden)fechar();});
let tR=null;addEventListener("resize",()=>{clearTimeout(tR);tR=setTimeout(()=>{if(senha)render();},250);});

/* ---------- início: aproveita a senha do painel já aberto nesta aba ---------- */
if(!CENTRAL.url)msg("msg-login","A central ainda não foi configurada.",true);
else{let s="";try{s=sessionStorage.getItem("sup-senha")||"";}catch(e){}if(s){$("v-login").hidden=true;entrar(s);}}
})();
