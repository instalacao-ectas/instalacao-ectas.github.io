/* Orçado x Realizado (aba do Painel do Supervisor)
   Custos de campo por visita: orçado na DIR x realizado lançado pelo supervisor.
   Integra com o cadastro de obras do painel e com a Agenda Técnica (equipe e dias em cada obra). */
(()=>{
"use strict";
const $=id=>document.getElementById(id);
const CC=window.CENTRAL_CUSTOS||{}, CD=window.CENTRAL||{}, CA=window.CENTRAL_AGENDA||{};
const PREVIA=!!window.ORCADO_PREVIA;   // só na prévia publicada fora do site

const TIPOS=["INSTALAÇÃO","COMISSIONAMENTO","START-UP","MANUTENÇÃO EM GARANTIA","MANUTENÇÃO CONTRATADA"];
const ORCADOS=new Set(["INSTALAÇÃO","COMISSIONAMENTO","START-UP"]);
const CONCEITO=[["Instalação","Sim","ECTAS (vendido ao cliente)"],["Comissionamento","Sim","ECTAS (vendido ao cliente)"],["Start-up","Sim","ECTAS (vendido ao cliente)"],["Manutenção em garantia","Não","ECTAS"],["Manutenção contratada","Não","Cliente"]];
const CATS=[["desl","Deslocamento"],["est","Estadia"],["ht","Horas técnicas"],["he","Horas extras"],["adic","Gastos adicionais"],["frete","Frete"],["munk","Munk"]];
const SIT={estouro:["Acima do orçado","p-ruim"],dentro:["Dentro do orçado","p-ok"],nao:["Não orçado","p-neu"],pend:["Orçado sem gasto","p-atn"],vazio:["Sem valores","p-neu"]};
const MESES_L=["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const noPeriodo=(v,ano,mes)=>{const d=v.ini||v.cad||"";return (!ano||d.startsWith(ano))&&(!mes||d.slice(5,7)===mes);};
const nomePeriodo=(ano,mes)=>mes?(MESES_L[+mes-1].toLowerCase()+(ano?"/"+ano:" (todos os anos)")):(ano||"todos os anos");
const MESES=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

/* ---------- utilitários ---------- */
function esc(s){const d=document.createElement("div");d.textContent=s==null?"":String(s);return d.innerHTML;}
const num=v=>{const n=parseFloat(v);return isFinite(n)?n:0;};
const brl=n=>(n<0?"-":"")+"R$ "+Math.abs(n||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const brlK=n=>{const a=Math.abs(n||0);return (n<0?"-":"")+(a>=1e6?"R$ "+(a/1e6).toLocaleString("pt-BR",{maximumFractionDigits:2})+" mi":a>=1e3?"R$ "+(a/1e3).toLocaleString("pt-BR",{maximumFractionDigits:1})+" mil":brl(a));};
const fmt=s=>{if(!s)return"-";const[y,m,d]=s.split("-");return `${d}/${m}/${y}`;};
const pct=n=>(n>0?"+":"")+n.toLocaleString("pt-BR",{maximumFractionDigits:1})+"%";
const norm=s=>String(s==null?"":s).normalize("NFD").replace(/[̀-ͯ]/g,"").trim().replace(/\s+/g," ").toUpperCase();
const idObra=s=>{const t=String(s==null?"":s).trim();return /^\d+$/.test(t)?String(parseInt(t,10)):t;};
const plural=(n,s,p)=>n.toLocaleString("pt-BR")+" "+(n===1?s:p);
function toast(t){const e=$("toast");e.textContent=t;e.hidden=false;clearTimeout(e._t);e._t=setTimeout(()=>e.hidden=true,2600);}
function diasUteis(a,b){if(!a||!b||b<a)return 0;let d=new Date(a+"T12:00"),e=new Date(b+"T12:00"),n=0;while(d<=e){const w=d.getDay();if(w&&w<6)n++;d.setDate(d.getDate()+1);}return n;}
const maxS=(a,b)=>a>b?a:b, minS=(a,b)=>a<b?a:b;

/* ---------- estado ---------- */
let senha="", HIST=[], APP=[], FUNC=[], OBRAS=[], AGENDA=[], carroDia=150;
const S={aba:"resumo"};

/* ---------- cálculo de uma visita (mesmas regras da planilha BD - CUSTOS DE INSTALAÇÃO) ---------- */
function calc(v){
  const d=v.desl||{},e=v.est||{},s=v.serv||{};
  // Lançamentos antigos gravaram o total do carro no campo da diária: acima de 150 é tratado como total.
  const carroTot=(d.carro||0)>150?(d.carro||0):(d.carro||0)*(d.diasCarro||0);
  const real={desl:carroTot+(d.aluguel||0)+(d.uber||0)+(d.passagem||0)+(d.pedagio||0)+(d.bagagem||0)+(d.combustivel||0),
    est:(e.hotel||0)+(e.alimentacao||0),
    ht:(v.equipe||[]).reduce((a,x)=>a+(x.vDia||0)*(x.dias||0),0),
    he:(v.equipe||[]).reduce((a,x)=>a+(x.vHora||0)*((x.h50||0)*1.5+(x.h75||0)*1.75),0),
    adic:(v.adic||[]).reduce((a,x)=>a+(x.valor||0),0),frete:s.frete||0,munk:s.munk||0};
  real.total=CATS.reduce((a,[k])=>a+real[k],0);
  let orc=null;
  if(v.orc){const o=v.orc;orc={desl:o.desl||0,est:o.est||((o.hotel||0)+(o.alim||0)),ht:o.ht||0,he:o.he||0,adic:o.adic||0,frete:o.frete||0,munk:o.munk||0};orc.total=CATS.reduce((a,[k])=>a+orc[k],0);}
  let sit;
  if(!orc||!orc.total)sit=real.total>0?"nao":"vazio";else if(!real.total)sit="pend";else sit=real.total>orc.total?"estouro":"dentro";
  return {real,orc,carroTot,sit,saldo:orc&&orc.total?orc.total-real.total:null,desvio:orc&&orc.total?(real.total-orc.total)/orc.total*100:null};
}
const todas=()=>HIST.concat(APP);

/* ---------- Agenda Técnica: quem esteve na obra e em quais dias ---------- */
function funcDaAgenda(nome){
  const ex=FUNC.find(f=>f.agenda&&norm(f.agenda)===norm(nome));if(ex)return ex;
  const t=norm(nome).replace(/-.*/,"").split(" ").filter(Boolean);
  if(!t.length)return null;
  const c=FUNC.filter(f=>{const ft=norm(f.nome).split(" ");return t.every(x=>ft.includes(x));});
  return c.length===1?c[0]:(c.find(f=>norm(f.nome).startsWith(t[0]))||null);
}
function agendaDaObra(id,ini,fim){
  if(!id||!ini||!fim)return [];
  const por={};
  AGENDA.filter(l=>idObra(l.obra)===idObra(id)&&l.fim>=ini&&l.ini<=fim).forEach(l=>{
    const a=maxS(l.ini,ini),b=minS(l.fim,fim);
    const p=por[l.func]=por[l.func]||{nome:l.func,dias:0,periodos:[]};
    p.dias+=diasUteis(a,b);p.periodos.push(fmt(a)+" a "+fmt(b));
  });
  return Object.values(por).map(p=>({...p,func:funcDaAgenda(p.nome)})).sort((a,b)=>b.dias-a.dias);
}
function diasComEquipe(lista){return lista.reduce((m,p)=>Math.max(m,p.dias),0);}

/* ---------- carga ---------- */
async function chamar(base,params){const u=base.url+"?"+new URLSearchParams({...params,senha,_:Date.now()}).toString();const r=await fetch(u);const j=await r.json();if(!j.ok)throw new Error(j.erro||"Falha na central");return j;}
async function enviar(base,corpo){const r=await fetch(base.url,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({...corpo,senha})});const j=await r.json();if(!j.ok)throw new Error(j.erro||"Falha na central");return j;}

async function carregar(){
  let custos,agenda=[],obrasPainel=[];
  if(PREVIA){
    const [c,a]=await Promise.all([fetch("orcado/carga-custos.json").then(r=>r.json()),fetch("orcado/agenda-previa.json").then(r=>r.json()).catch(()=>({lancamentos:[]}))]);
    custos={visitas:c.visitas,lancamentos:[],funcionarios:c.funcionarios,carroDia:c.carroDia};obrasPainel=c.obras;agenda=a.lancamentos;
  }else{
    const [c,a,o]=await Promise.all([
      enviar(CC,{painel:true,acao:"listar"}),
      CA.url?enviar(CA,{painel:true,acao:"listar"}).then(j=>(j.lancamentos||[]).filter(l=>l.tipo==="Obra"&&l.obraId).map(l=>({func:l.func,ini:l.ini,fim:l.fim,obra:l.obraId,nome:l.obra}))).catch(()=>[]):[],
      chamar(CD,{acao:"obrasTodas"}).then(j=>(j.obras||[]).map(x=>({id:x.id,cliente:x.nome||x.obra,cidade:x.local||"",status:x.ativa?"Ativa":"Encerrada"}))).catch(()=>[])]);
    custos=c;agenda=a;obrasPainel=o;
    if(c.planilha){const l=$("link-planilha");l.href=c.planilha;l.hidden=false;}
  }
  HIST=(custos.visitas||[]).map(v=>({...v,_k:"h:"+v.id}));
  APP=(custos.lancamentos||[]).map(v=>({...v,_app:true,_k:"a:"+v.id}));
  FUNC=(custos.funcionarios||[]).slice().sort((a,b)=>a.nome.localeCompare(b.nome));
  carroDia=num(custos.carroDia)||150;
  AGENDA=agenda;
  const vistos=new Set();OBRAS=[];
  obrasPainel.concat(HIST.map(v=>({id:v.idObra,cliente:v.obra,pedido:v.pedido}))).forEach(o=>{const k=idObra(o.id)||norm(o.cliente);if(!k||vistos.has(k))return;vistos.add(k);OBRAS.push({...o,id:idObra(o.id)});});
  $("atualizado").textContent=!PREVIA?"Atualizado às "+new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})+` · ${plural(AGENDA.length,"alocação","alocações")} da Agenda em obras`:`Base histórica: ${plural(HIST.length,"visita","visitas")} (nov/2023 a out/2026) · Agenda: ${plural(AGENDA.length,"alocação","alocações")} em obras`;
}

/* ---------- login (mesma senha do Painel do Diário) ---------- */
async function entrar(s){
  senha=s;
  try{await carregar();try{sessionStorage.setItem("sup-senha",senha);}catch(e){}$("v-login").hidden=true;$("v-painel").hidden=false;iniciar();}
  catch(e){senha="";try{sessionStorage.removeItem("sup-senha");}catch(x){}$("v-login").hidden=false;$("v-painel").hidden=true;
    const m=String(e.message||"");$("msg-login").textContent=m==="senha vencida"?"Sua senha venceu. Troque a senha no Painel do Diário de Obra e volte aqui.":m==="senha incorreta"?"Senha incorreta.":(m||"Não foi possível entrar.");$("msg-login").className="msg err";}
}
$("v-login").addEventListener("submit",e=>{e.preventDefault();entrar($("senha").value);});
$("b-sair").onclick=()=>{try{sessionStorage.removeItem("sup-senha");}catch(e){}location.href="supervisor.html";};

/* ---------- sub-abas ---------- */
function abrirAba(a){S.aba=a;document.querySelectorAll("[data-aba]").forEach(b=>b.setAttribute("aria-selected",String(b.dataset.aba===a)));["resumo","visitas","lancar","regras"].forEach(x=>$("a-"+x).hidden=x!==a);
  if(a==="resumo")renderResumo();if(a==="visitas")renderVisitas();if(a==="lancar")renderForm();if(a==="regras")renderRegras();window.scrollTo(0,0);}
document.querySelectorAll("[data-aba]").forEach(b=>b.onclick=()=>abrirAba(b.dataset.aba));
function opcoes(sel,lista,primeiro){const v=sel.value;sel.innerHTML=(primeiro!=null?`<option value="">${esc(primeiro)}</option>`:"")+lista.map(o=>Array.isArray(o)?`<option value="${esc(o[0])}">${esc(o[1])}</option>`:`<option>${esc(o)}</option>`).join("");if([...sel.options].some(o=>o.value===v))sel.value=v;}

/* ---------- RESUMO ---------- */
function renderResumo(){
  const anos=[...new Set(todas().map(v=>(v.ini||v.cad||"").slice(0,4)).filter(Boolean))].sort().reverse();
  opcoes($("r-ano"),anos,"Todos os anos");opcoes($("r-mes-f"),MESES_L.map((m,i)=>[String(i+1).padStart(2,"0"),m]),"Todos os meses");opcoes($("r-tipo"),TIPOS,"Todos os tipos");
  const obs=[...new Map(todas().map(v=>[v.idObra,v.obra])).entries()].sort((a,b)=>String(a[1]).localeCompare(String(b[1])));
  opcoes($("r-obra"),obs.map(([i,n])=>[i,`${i} - ${n}`]),"Todas as obras");
  const ano=$("r-ano").value,mes=$("r-mes-f").value,tp=$("r-tipo").value,ob=$("r-obra").value;
  const L=todas().filter(v=>noPeriodo(v,ano,mes)&&(!tp||v.tipo===tp)&&(!ob||v.idObra===ob)).map(v=>({v,c:calc(v)}));
  const comp=L.filter(x=>x.c.sit==="estouro"||x.c.sit==="dentro");
  const O=comp.reduce((a,x)=>a+x.c.orc.total,0),R=comp.reduce((a,x)=>a+x.c.real.total,0);
  const nao=L.filter(x=>x.c.sit==="nao"),est=comp.filter(x=>x.c.sit==="estouro").length;
  const pend=APP.filter(v=>v.status==="Enviado").length;
  $("r-kpis").innerHTML=[
    ["Visitas",L.length.toLocaleString("pt-BR"),`${comp.length} com orçado e gasto`,""],
    ["Realizado total",brlK(L.reduce((a,x)=>a+x.c.real.total,0)),"todas as visitas",""],
    ["Orçado (comparável)",brlK(O),"visitas com DIR",""],
    ["Realizado (comparável)",brlK(R),O?`desvio ${pct((R-O)/O*100)}`:"",R>O?"ruim":"bom"],
    ["Acima do orçado",comp.length?Math.round(est/comp.length*100)+"%":"-",`${est} de ${comp.length} visitas`,comp.length&&est/comp.length>.5?"ruim":""],
    ["Não orçado",brlK(nao.reduce((a,x)=>a+x.c.real.total,0)),`${plural(nao.length,"visita","visitas")} (garantia/contrato)`,""],
    ["Aguardando aprovação",String(pend),"lançamentos do app",pend?"ruim":""]
  ].map(([l,v,d,c])=>`<div class="kpi ${c}"><span>${esc(l)}</span><b>${esc(v)}</b><small>${esc(d)}</small></div>`).join("");
  const mx=Math.max(1,...CATS.map(([k])=>Math.max(comp.reduce((a,x)=>a+x.c.orc[k],0),comp.reduce((a,x)=>a+x.c.real[k],0))));
  $("r-cat").innerHTML=CATS.map(([k,n])=>{const o=comp.reduce((a,x)=>a+x.c.orc[k],0),r=comp.reduce((a,x)=>a+x.c.real[k],0);
    return `<div class="lin"><div class="nm">${esc(n)}</div><div><div class="b o" style="width:${o/mx*100}%"></div><div class="b r ${r>o?"acima":""}" style="width:${r/mx*100}%"></div><div class="v">${brlK(o)} → ${brlK(r)} ${o?`<span class="${r>o?"neg":"pos"}">(${pct((r-o)/o*100)})</span>`:""}</div></div></div>`;}).join("");
  const m={};L.forEach(x=>{const k=(x.v.ini||x.v.cad||"").slice(0,7);if(k)m[k]=(m[k]||0)+x.c.real.total;});
  const ks=Object.keys(m).sort().slice(-12),mm=Math.max(1,...ks.map(k=>m[k]));
  $("r-mes").innerHTML=ks.length?ks.map(k=>`<div class="c" title="${esc(brl(m[k]))}"><em>${esc(brlK(m[k]).replace("R$ ",""))}</em><i style="height:${m[k]/mm*120}px"></i><span>${MESES[+k.slice(5)-1]}/${k.slice(2,4)}</span></div>`).join(""):`<p class="status">Sem dados no filtro.</p>`;
  const t={};L.forEach(x=>{const z=t[x.v.tipo]=t[x.v.tipo]||{n:0,r:0};z.n++;z.r+=x.c.real.total;});
  $("r-tipos").innerHTML=Object.entries(t).sort((a,b)=>b[1].r-a[1].r).map(([k,x])=>`<tr><td>${esc(k)}</td><td class="n">${plural(x.n,"visita","visitas")}</td><td class="n"><b>${brl(x.r)}</b></td></tr>`).join("");
  // cenário por obra: todas as obras com gasto lançado no filtro
  const g={};
  L.filter(x=>x.c.real.total>0).forEach(x=>{const k=x.v.idObra||norm(x.v.obra);const o=g[k]=g[k]||{id:x.v.idObra,obra:x.v.obra,n:0,ult:"",orc:0,realC:0,real:0,tipos:{}};
    o.n++;if((x.v.ini||"")>o.ult)o.ult=x.v.ini||"";o.real+=x.c.real.total;o.tipos[x.v.tipo]=1;
    if(x.c.orc&&x.c.orc.total){o.orc+=x.c.orc.total;o.realC+=x.c.real.total;}});
  const OB=Object.values(g).map(o=>({...o,saldo:o.orc?o.orc-o.realC:null,desv:o.orc?(o.realC-o.orc)/o.orc*100:null}));
  const ord=$("r-ord").value;
  OB.sort({real:(a,b)=>b.real-a.real,estouro:(a,b)=>((a.saldo==null?1e15:a.saldo)-(b.saldo==null?1e15:b.saldo)),data:(a,b)=>b.ult.localeCompare(a.ult),obra:(a,b)=>String(a.obra).localeCompare(String(b.obra))}[ord]);
  const per=[nomePeriodo(ano,mes),tp?tp.toLowerCase():"",ob?("obra "+ob):""].filter(Boolean).join(" · ");
  $("r-tit").textContent=`Cenário das obras no período (${plural(OB.length,"obra","obras")})`;
  $("r-dica").textContent=`Todas as obras com gasto lançado em ${per}, somando as visitas de cada uma. Clique numa obra para ver o resumo geral dos gastos dela.`;
  const sitO=o=>!o.orc?["Não orçado","p-neu"]:o.realC>o.orc?["Acima do orçado","p-ruim"]:["Dentro do orçado","p-ok"];
  $("r-obras").innerHTML=OB.length?OB.map(o=>{const s=sitO(o);return `<tr class="clic" data-ob="${esc(o.id||("N:"+o.obra))}"><td class="quebra">${esc(o.id)} - ${esc(o.obra)}<small>${esc(Object.keys(o.tipos).join(", ").toLowerCase())}</small></td><td class="n">${o.n}</td><td>${fmt(o.ult)}</td><td class="n">${o.orc?brl(o.orc):"-"}</td><td class="n">${brl(o.real)}</td><td class="n ${o.saldo==null?"":o.saldo<0?"neg":"pos"}">${o.saldo==null?"-":brl(o.saldo)}</td><td class="n ${o.desv==null?"":o.desv>0?"neg":"pos"}">${o.desv==null?"-":pct(o.desv)}</td><td><span class="pill ${s[1]}">${s[0]}</span></td></tr>`;}).join(""):`<tr><td colspan="8">Nenhum gasto lançado no filtro.</td></tr>`;
  const tO=OB.reduce((a,o)=>a+o.orc,0),tR=OB.reduce((a,o)=>a+o.real,0),tRc=OB.reduce((a,o)=>a+o.realC,0),tN=OB.reduce((a,o)=>a+o.n,0);
  $("r-tot").innerHTML=OB.length?`<tr class="tot"><td>Total (${plural(OB.length,"obra","obras")})</td><td class="n">${tN}</td><td></td><td class="n">${brl(tO)}</td><td class="n">${brl(tR)}</td><td class="n ${tO-tRc<0?"neg":"pos"}" title="Saldo só das visitas com orçado">${tO?brl(tO-tRc):"-"}</td><td class="n">${tO?pct((tRc-tO)/tO*100):"-"}</td><td></td></tr>`:"";
  $("r-obras").querySelectorAll("tr[data-ob]").forEach(tr=>tr.onclick=()=>abrirObra(tr.dataset.ob,ano,tp,mes));
  // obras dentro do orçamento (visitas orçadas com realizado <= orçado)
  const den=comp.filter(x=>x.c.sit==="dentro").sort((a,b)=>b.c.saldo-a.c.saldo);
  $("r-dentro-dica").textContent=`${plural(den.length,"visita orçada ficou","visitas orçadas ficaram")} com o realizado igual ou abaixo do orçado em ${per} (de ${comp.length} com orçado e gasto), da maior economia para a menor.`;
  $("r-dentro").innerHTML=den.length?den.map(({v,c})=>`<tr class="clic" data-k="${esc(v._k)}"><td>${esc(v.pedido)}</td><td class="quebra">${esc(v.obra)}</td><td class="tipo-c">${esc(v.tipo)}</td><td>${fmt(v.ini)}</td><td class="n">${brl(c.orc.total)}</td><td class="n">${brl(c.real.total)}</td><td class="n pos">${brl(c.saldo)}</td><td class="n pos">${pct(c.desvio)}</td></tr>`).join(""):`<tr><td colspan="8">Nenhuma visita dentro do orçamento no filtro.</td></tr>`;
  const dO=den.reduce((a,x)=>a+x.c.orc.total,0),dR=den.reduce((a,x)=>a+x.c.real.total,0);
  $("r-dentro-tot").innerHTML=den.length?`<tr class="tot"><td colspan="4">Total (${plural(den.length,"visita","visitas")})</td><td class="n">${brl(dO)}</td><td class="n">${brl(dR)}</td><td class="n pos">${brl(dO-dR)}</td><td class="n pos">${pct((dR-dO)/dO*100)}</td></tr>`:"";
  ligarLinhas("r-dentro");
  // maiores estouros (visitas orçadas com realizado > orçado)
  const top=comp.filter(x=>x.c.sit==="estouro").sort((a,b)=>a.c.saldo-b.c.saldo);
  $("r-top-dica").textContent=`${plural(top.length,"visita orçada passou","visitas orçadas passaram")} do orçado em ${per} (de ${comp.length} com orçado e gasto), do maior estouro para o menor.`;
  $("r-top").innerHTML=top.length?top.map(({v,c})=>`<tr class="clic" data-k="${esc(v._k)}"><td>${esc(v.pedido)}</td><td class="quebra">${esc(v.obra)}</td><td class="tipo-c">${esc(v.tipo)}</td><td>${fmt(v.ini)}</td><td class="n">${brl(c.orc.total)}</td><td class="n">${brl(c.real.total)}</td><td class="n neg">${brl(c.saldo)}</td><td class="n neg">${pct(c.desvio)}</td></tr>`).join(""):`<tr><td colspan="8">Nenhum estouro no filtro.</td></tr>`;
  const eO=top.reduce((a,x)=>a+x.c.orc.total,0),eR=top.reduce((a,x)=>a+x.c.real.total,0);
  $("r-top-tot").innerHTML=top.length?`<tr class="tot"><td colspan="4">Total (${plural(top.length,"visita","visitas")})</td><td class="n">${brl(eO)}</td><td class="n">${brl(eR)}</td><td class="n neg">${brl(eO-eR)}</td><td class="n neg">${pct((eR-eO)/eO*100)}</td></tr>`:"";
  ligarLinhas("r-top");
}
["r-ano","r-mes-f","r-tipo","r-obra","r-ord"].forEach(id=>$(id).addEventListener("change",renderResumo));

/* ---------- VISITAS ---------- */
function renderVisitas(){
  opcoes($("v-tipo"),TIPOS,"Todos");
  const q=norm($("v-q").value),tp=$("v-tipo").value,si=$("v-sit").value,st=$("v-st").value;
  const L=todas().map(v=>({v,c:calc(v)})).filter(({v,c})=>(!q||norm(v.pedido+" "+v.idObra+" "+v.obra).includes(q))&&(!tp||v.tipo===tp)&&(!si||c.sit===si)&&(!st||(st==="hist"?!v._app:v.status===st)))
    .sort((a,b)=>(b.v.ini||b.v.cad||"").localeCompare(a.v.ini||a.v.cad||""));
  $("v-body").innerHTML=L.length?L.slice(0,300).map(({v,c})=>`<tr class="clic" data-k="${esc(v._k)}"><td>${esc(v.pedido)}</td><td>${esc(v.idObra)}</td><td class="quebra">${esc(v.obra)} ${v._app?`<span class="pill ${v.status==="Aprovado"?"p-ok":"p-app"}">${esc(v.status==="Aprovado"?"Aprovado":"Aguardando aprovação")}</span>`:""}</td><td>${esc(v.tipo)}</td><td>${fmt(v.ini)}</td><td>${fmt(v.fim)}</td><td class="n">${c.orc&&c.orc.total?brl(c.orc.total):"-"}</td><td class="n">${brl(c.real.total)}</td><td class="n ${c.saldo==null||c.sit==="pend"?"":c.saldo<0?"neg":"pos"}">${c.saldo==null||c.sit==="pend"?"-":brl(c.saldo)}</td><td><span class="pill ${SIT[c.sit][1]}">${SIT[c.sit][0]}</span></td></tr>`).join(""):`<tr><td colspan="10">Nenhuma visita encontrada.</td></tr>`;
  $("v-cont").textContent=plural(L.length,"visita","visitas")+(L.length>300?" (mostrando as 300 mais recentes)":"");
  ligarLinhas("v-body");
}
["v-q","v-tipo","v-sit","v-st"].forEach(id=>$(id).addEventListener("input",renderVisitas));
function ligarLinhas(id){$(id).querySelectorAll("tr.clic").forEach(tr=>tr.onclick=()=>abrirVisita(tr.dataset.k));}

/* ---------- ficha da visita (formato da aba ARQUIVO) ---------- */
function abrirVisita(k,voltar){
  const v=todas().find(x=>x._k===k);if(!v)return;const c=calc(v),d=v.desl||{},o=c.orc,r=c.real;
  const fin=x=>o&&o.total?o[x]-r[x]:-r[x];
  const cel=n=>`<td class="n ${n<0?"neg":n>0?"pos":""}">${brl(n)}</td>`;
  const grupo=(rot,itens,k2)=>itens.map((it,i)=>`<tr><td>${i?"":`<b>${rot}</b>`}</td><td>${esc(it[0])}</td><td class="n">${it[1]}</td>${i?"<td></td><td></td><td></td>":`<td class="n">${o&&o.total?brl(o[k2]):"-"}</td><td class="n">${brl(r[k2])}</td>${cel(fin(k2))}`}</tr>`).join("");
  const ag=agendaDaObra(v.idObra,v.ini,v.fim);
  let h=`<div class="topo"><h3>${esc(v.idObra)} - ${esc(v.obra)}</h3><button type="button" class="btn sec" id="m-x">Fechar</button></div>
  <div style="display:flex;gap:6px;flex-wrap:wrap"><span class="pill ${SIT[c.sit][1]}">${SIT[c.sit][0]}</span>${v._app?`<span class="pill p-app">Lançado no painel · ${esc(v.status)}</span>`:`<span class="pill p-neu">Histórico da planilha</span>`}</div>
  <div class="det"><div><span>Pedido</span>${esc(v.pedido)}</div><div><span>Tipo</span>${esc(v.tipo)}</div><div><span>Período</span>${fmt(v.ini)} a ${fmt(v.fim)}</div>${v.supervisor?`<div><span>Supervisor</span>${esc(v.supervisor)}</div>`:""}</div>
  <div class="tabela"><table><thead><tr><th>Descrição</th><th>Item</th><th class="n">Lançado</th><th class="n">Orçado</th><th class="n">Realizado</th><th class="n">Final</th></tr></thead><tbody>
  ${grupo("Deslocamento",[["Dias de carro ECTAS",d.diasCarro||0],["Carro ECTAS (total)",brl(c.carroTot)],["Aluguel de carro",brl(d.aluguel)],["Uber",brl(d.uber)],["Passagem",brl(d.passagem)],["Pedágio",brl(d.pedagio)],["Bagagem",brl(d.bagagem)],["Combustível",brl(d.combustivel)]],"desl")}
  ${grupo("Estadia",[["Hotel",brl((v.est||{}).hotel)],["Alimentação",brl((v.est||{}).alimentacao)]],"est")}
  ${[["ht","Hora técnica"],["he","Horas extras"],["frete","Frete"],["munk","Munk"],["adic","Gastos adicionais"]].map(([x,n])=>`<tr><td><b>${n}</b></td><td></td><td></td><td class="n">${o&&o.total?brl(o[x]):"-"}</td><td class="n">${brl(r[x])}</td>${cel(fin(x))}</tr>`).join("")}
  <tr class="tot"><td>Total</td><td></td><td></td><td class="n">${o&&o.total?brl(o.total):"-"}</td><td class="n">${brl(r.total)}</td>${cel(o&&o.total?c.saldo:-r.total)}</tr></tbody></table></div>`;
  if((v.equipe||[]).length){
    h+=`<h2 style="margin:6px 0 0;font-size:.8rem;text-transform:uppercase;letter-spacing:.08em;color:var(--accent)">Equipe lançada x Agenda Técnica</h2>
    <div class="tabela"><table><thead><tr><th>Colaborador</th><th class="n">Dias lançados</th><th class="n">Dias na Agenda</th><th class="n">Até 2h</th><th class="n">Além 2h</th><th class="n">H. técnicas</th><th class="n">H. extras</th></tr></thead><tbody>${v.equipe.map(e=>{const a=ag.find(p=>p.func&&p.func.nome===e.nome);const dif=a&&a.dias!==e.dias;return `<tr><td>${esc(e.nome)}</td><td class="n">${e.dias}</td><td class="n ${dif?"neg":""}">${a?a.dias:"-"}</td><td class="n">${e.h50}</td><td class="n">${e.h75}</td><td class="n">${brl(e.vDia*e.dias)}</td><td class="n">${brl(e.vHora*(e.h50*1.5+e.h75*1.75))}</td></tr>`;}).join("")}</tbody></table></div>`;
    const fora=ag.filter(p=>!v.equipe.some(e=>p.func&&p.func.nome===e.nome));
    if(fora.length)h+=`<div class="alerta-box atn">Na Agenda, também estavam nesta obra no período: ${fora.map(p=>esc(p.nome)+" ("+p.dias+" d)").join(", ")}.</div>`;
    if(!ag.length)h+=`<p class="status">Sem alocações desta obra na Agenda Técnica neste período.</p>`;
  }
  if((v.adic||[]).length)h+=`<details><summary style="cursor:pointer;font-weight:700">Gastos adicionais (${v.adic.length})</summary><div class="tabela"><table><tbody>${v.adic.map(a=>`<tr><td class="quebra">${esc(a.desc)}</td><td class="n">${brl(a.valor)}</td></tr>`).join("")}</tbody></table></div></details>`;
  if(v.obs)h+=`<p><b>Observações:</b> ${esc(v.obs)}</p>`;
  if(v._app)h+=`<div style="display:flex;gap:8px;flex-wrap:wrap">${v.status!=="Aprovado"?`<button type="button" class="btn pri" id="m-ap">Aprovar</button>`:""}<button type="button" class="btn sec" id="m-ed">Editar</button></div>`;
  $("modal-box").innerHTML=h;$("modal").hidden=false;
  $("m-x").onclick=fechar;
  if(voltar){const b=document.createElement("button");b.type="button";b.className="btn sec";b.textContent="← Voltar à obra";b.onclick=voltar;$("m-x").parentNode.insertBefore(b,$("m-x"));}
  if($("m-ap"))$("m-ap").onclick=async()=>{await gravar({...v,status:"Aprovado",aprovadoEm:new Date().toISOString()});fechar();toast("Lançamento aprovado");};
  if($("m-ed"))$("m-ed").onclick=()=>{fechar();F=Object.assign(novo(),JSON.parse(JSON.stringify(v)));if(!F.orc)F.orc=novo().orc;passo=0;abrirAba("lancar");};
}

/* ---------- resumo geral da obra (todas as visitas no filtro) ---------- */
function abrirObra(chave,ano,tp,mes){
  const daObra=v=>chave.startsWith("N:")?(!v.idObra&&v.obra===chave.slice(2)):v.idObra===chave;
  const L=todas().filter(v=>daObra(v)&&noPeriodo(v,ano,mes)&&(!tp||v.tipo===tp)).map(v=>({v,c:calc(v)})).filter(x=>x.c.real.total>0||(x.c.orc&&x.c.orc.total))
    .sort((a,b)=>(a.v.ini||"").localeCompare(b.v.ini||""));
  if(!L.length)return;
  const nome=L[L.length-1].v.obra, id=L[0].v.idObra;
  // somas por categoria: orçado e realizado (realizado comparável = só visitas com orçado)
  const O={},R={},Rc={};CATS.forEach(([k])=>{O[k]=0;R[k]=0;Rc[k]=0;});
  L.forEach(({c})=>CATS.forEach(([k])=>{R[k]+=c.real[k];if(c.orc&&c.orc.total){O[k]+=c.orc[k];Rc[k]+=c.real[k];}}));
  const tO=CATS.reduce((a,[k])=>a+O[k],0),tR=CATS.reduce((a,[k])=>a+R[k],0),tRc=CATS.reduce((a,[k])=>a+Rc[k],0);
  // detalhe do deslocamento e estadia somados
  const D={diasCarro:0,carro:0,aluguel:0,uber:0,passagem:0,pedagio:0,bagagem:0,combustivel:0},E={hotel:0,alimentacao:0};
  L.forEach(({v,c})=>{const d=v.desl||{};D.diasCarro+=d.diasCarro||0;D.carro+=c.carroTot;["aluguel","uber","passagem","pedagio","bagagem","combustivel"].forEach(k=>D[k]+=d[k]||0);E.hotel+=(v.est||{}).hotel||0;E.alimentacao+=(v.est||{}).alimentacao||0;});
  // equipe somada
  const EQ={};L.forEach(({v})=>(v.equipe||[]).forEach(e=>{const x=EQ[e.nome]=EQ[e.nome]||{dias:0,h50:0,h75:0,ht:0,he:0,vis:0};x.dias+=e.dias||0;x.h50+=e.h50||0;x.h75+=e.h75||0;x.ht+=(e.vDia||0)*(e.dias||0);x.he+=(e.vHora||0)*((e.h50||0)*1.5+(e.h75||0)*1.75);x.vis++;}));
  const AD=[];L.forEach(({v})=>(v.adic||[]).forEach(a=>AD.push({...a,ini:v.ini})));
  const temO=tO>0,saldo=tO-tRc,desv=temO?(tRc-tO)/tO*100:null;
  const cel=n=>`<td class="n ${n<0?"neg":n>0?"pos":""}">${brl(n)}</td>`;
  const per=[nomePeriodo(ano,mes),tp?tp.toLowerCase():""].filter(Boolean).join(" · ");
  const sub=(rot,itens)=>itens.map((it,i)=>`<tr><td>${i?"":`<b>${rot}</b>`}</td><td>${esc(it[0])}</td><td class="n">${it[1]}</td><td></td><td></td><td></td></tr>`).join("");
  let h=`<div class="topo"><h3>${esc(id||"")}${id?" - ":""}${esc(nome)}</h3><button type="button" class="btn sec" id="m-x">Fechar</button></div>
  <div style="display:flex;gap:6px;flex-wrap:wrap"><span class="pill ${!temO?"p-neu":tRc>tO?"p-ruim":"p-ok"}">${!temO?"Não orçado":tRc>tO?"Acima do orçado":"Dentro do orçado"}</span><span class="pill p-neu">Resumo geral da obra · ${esc(per)}</span></div>
  <div class="kpis"><div class="kpi"><span>Visitas</span><b>${L.length}</b><small>${fmt(L[0].v.ini)} a ${fmt(L[L.length-1].v.fim||L[L.length-1].v.ini)}</small></div>
    <div class="kpi"><span>Orçado</span><b>${temO?brlK(tO):"-"}</b><small>soma das DIR</small></div>
    <div class="kpi"><span>Realizado</span><b>${brlK(tR)}</b><small>todas as visitas</small></div>
    <div class="kpi ${temO?(saldo<0?"ruim":"bom"):""}"><span>Saldo</span><b>${temO?brlK(saldo):"-"}</b><small>${temO?pct(desv)+" sobre o orçado":"sem orçado"}</small></div></div>
  <div class="tabela"><table><thead><tr><th>Categoria</th><th>Item</th><th class="n">Lançado</th><th class="n">Orçado</th><th class="n">Realizado</th><th class="n">Final</th></tr></thead><tbody>
  ${CATS.map(([k,n])=>`<tr><td><b>${n}</b></td><td></td><td></td><td class="n">${temO?brl(O[k]):"-"}</td><td class="n">${brl(R[k])}</td>${cel(temO?O[k]-Rc[k]:-R[k])}</tr>`+
     (k==="desl"?sub("",[["Dias de carro ECTAS",D.diasCarro],["Carro ECTAS (total)",brl(D.carro)],["Aluguel de carro",brl(D.aluguel)],["Uber",brl(D.uber)],["Passagem",brl(D.passagem)],["Pedágio",brl(D.pedagio)],["Bagagem",brl(D.bagagem)],["Combustível",brl(D.combustivel)]].filter(x=>x[1]&&x[1]!=="R$ 0,00")):"")+
     (k==="est"?sub("",[["Hotel",brl(E.hotel)],["Alimentação",brl(E.alimentacao)]]):"")).join("")}
  <tr class="tot"><td>Total</td><td></td><td></td><td class="n">${temO?brl(tO):"-"}</td><td class="n">${brl(tR)}</td>${cel(temO?saldo:-tR)}</tr></tbody></table></div>
  ${temO&&tR!==tRc?`<p class="status">O final soma só as visitas que têm orçado. Visitas não orçadas (garantia/contrato) somam ${brl(tR-tRc)} no realizado.</p>`:""}
  <h2 style="margin:6px 0 0;font-size:.8rem;text-transform:uppercase;letter-spacing:.08em;color:var(--accent)">Visitas da obra</h2>
  <div class="tabela"><table><thead><tr><th>Início</th><th>Pedido</th><th>Tipo</th><th class="n">Orçado</th><th class="n">Realizado</th><th class="n">Saldo</th><th>Situação</th></tr></thead><tbody id="m-vis">${L.map(({v,c})=>{const o=c.orc&&c.orc.total;return `<tr class="clic" data-k="${esc(v._k)}"><td>${fmt(v.ini)}</td><td>${esc(v.pedido)}</td><td>${esc(v.tipo)}</td><td class="n">${o?brl(c.orc.total):"-"}</td><td class="n">${brl(c.real.total)}</td><td class="n ${o?(c.saldo<0?"neg":"pos"):""}">${o&&c.sit!=="pend"?brl(c.saldo):"-"}</td><td><span class="pill ${SIT[c.sit][1]}">${SIT[c.sit][0]}</span></td></tr>`;}).join("")}</tbody></table></div>
  <p class="status">Clique numa visita para ver o fechamento dela.</p>`;
  const eq=Object.entries(EQ).sort((a,b)=>(b[1].ht+b[1].he)-(a[1].ht+a[1].he));
  if(eq.length)h+=`<h2 style="margin:6px 0 0;font-size:.8rem;text-transform:uppercase;letter-spacing:.08em;color:var(--accent)">Equipe (somada)</h2>
  <div class="tabela"><table><thead><tr><th>Colaborador</th><th class="n">Visitas</th><th class="n">Dias</th><th class="n">Até 2h</th><th class="n">Além 2h</th><th class="n">H. técnicas</th><th class="n">H. extras</th><th class="n">Total</th></tr></thead><tbody>${eq.map(([n,x])=>`<tr><td>${esc(n)}</td><td class="n">${x.vis}</td><td class="n">${nf(x.dias)}</td><td class="n">${nf(x.h50)}</td><td class="n">${nf(x.h75)}</td><td class="n">${brl(x.ht)}</td><td class="n">${brl(x.he)}</td><td class="n"><b>${brl(x.ht+x.he)}</b></td></tr>`).join("")}</tbody></table></div>`;
  if(AD.length)h+=`<details><summary style="cursor:pointer;font-weight:700">Gastos adicionais (${AD.length} itens · ${brl(AD.reduce((a,x)=>a+(x.valor||0),0))})</summary><div class="tabela"><table><tbody>${AD.map(a=>`<tr><td>${fmt(a.ini)}</td><td class="quebra">${esc(a.desc)}</td><td class="n">${brl(a.valor)}</td></tr>`).join("")}</tbody></table></div></details>`;
  if(id)h+=`<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn sec" id="m-filtra">Filtrar o painel por esta obra</button></div>`;
  $("modal-box").innerHTML=h;$("modal").hidden=false;$("modal").scrollTop=0;
  $("m-x").onclick=fechar;
  $("m-vis").querySelectorAll("tr.clic").forEach(tr=>tr.onclick=()=>abrirVisita(tr.dataset.k,()=>abrirObra(chave,ano,tp,mes)));
  if($("m-filtra"))$("m-filtra").onclick=()=>{fechar();$("r-obra").value=id;renderResumo();$("r-kpis").scrollIntoView({behavior:"smooth"});};
}
const nf=n=>Number(n||0).toLocaleString("pt-BR",{maximumFractionDigits:2});
function fechar(){$("modal").hidden=true;$("modal-box").innerHTML="";}
$("modal").addEventListener("click",e=>{if(e.target.id==="modal")fechar();});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("modal").hidden)fechar();});

/* ---------- REGRAS ---------- */
function renderRegras(){
  const nomesAg=[...new Set(AGENDA.map(l=>l.func))];
  $("g-func").innerHTML=FUNC.map(f=>{const a=nomesAg.filter(n=>{const x=funcDaAgenda(n);return x&&x.nome===f.nome;});return `<tr><td>${esc(f.nome)}</td><td>${a.length?esc(a.join(", ")):'<span class="status">não encontrado</span>'}</td><td class="n">${brl(f.vHora)}</td><td class="n">${brl(f.vDia)}</td></tr>`;}).join("");
  const sem=nomesAg.filter(n=>!funcDaAgenda(n));
  if(sem.length)$("g-func").insertAdjacentHTML("beforeend",`<tr><td colspan="4" class="quebra"><span class="pill p-atn">Sem custo cadastrado</span> ${esc(sem.join(", "))} (nomes da Agenda sem valor hora/dia)</td></tr>`);
  $("g-conc").innerHTML=CONCEITO.map(r=>`<tr>${r.map(x=>`<td>${esc(x)}</td>`).join("")}</tr>`).join("");
  $("g-carro").value=carroDia;
}
$("g-carro").addEventListener("change",async e=>{carroDia=num(e.target.value);if(PREVIA){toast("Diária alterada só nesta prévia");return;}
  try{await enviar(CC,{painel:true,acao:"paramSalvar",chave:"carro_dia",valor:carroDia});toast("Diária do carro atualizada");}catch(err){toast(err.message||"Não foi possível gravar");}});

/* ---------- LANÇAMENTO ---------- */
const PASSOS=["Identificação","Orçado (DIR)","Deslocamento","Estadia e serviços","Equipe e horas","Gastos adicionais","Revisão e envio"];
let passo=0,F=null;
function novo(){let sup="";try{sup=localStorage.getItem("orc-sup")||"";}catch(e){}return {id:"",pedido:"",idObra:"",obra:"",tipo:"INSTALAÇÃO",ini:"",fim:"",supervisor:sup,desl:{diasCarro:0,carro:carroDia,aluguel:0,uber:0,passagem:0,pedagio:0,bagagem:0,combustivel:0},est:{hotel:0,alimentacao:0},serv:{frete:0,munk:0},orc:{desl:0,hotel:0,alim:0,ht:0,he:0,adic:0,frete:0,munk:0},equipe:[],adic:[],obs:""};}
function rascunho(){try{localStorage.setItem("orc-rascunho",JSON.stringify(F));}catch(e){}}
const orcado=()=>ORCADOS.has(F.tipo);

function renderForm(){
  if(!F){try{const s=localStorage.getItem("orc-rascunho");F=s?Object.assign(novo(),JSON.parse(s)):novo();}catch(e){F=novo();}}
  opcoes($("i-tipo"),TIPOS);
  $("i-obra").value=F.idObra?`${F.idObra} - ${F.obra}`:"";$("i-pedido").value=F.pedido;$("i-tipo").value=F.tipo;$("i-ini").value=F.ini;$("i-fim").value=F.fim;$("i-sup").value=F.supervisor;$("i-obs").value=F.obs;
  document.querySelectorAll("[data-o]").forEach(i=>i.value=F.orc[i.dataset.o]||"");
  document.querySelectorAll("[data-d]").forEach(i=>i.value=F.desl[i.dataset.d]||"");
  document.querySelectorAll("[data-es]").forEach(i=>i.value=F.est[i.dataset.es]||"");
  document.querySelectorAll("[data-sv]").forEach(i=>i.value=F.serv[i.dataset.sv]||"");
  renderEq();renderAd();irPara(passo);
}
function irPara(p){
  passo=p;
  $("passos").innerHTML=PASSOS.map((n,i)=>`<button type="button" data-p="${i}" ${i===passo?'aria-current="step"':""} class="${i<passo?"feito":""} ${i===1&&!orcado()?"pula":""}"><b>${i<passo?"✓":i+1}</b>${esc(n)}</button>`).join("");
  $("passos").querySelectorAll("button").forEach(b=>b.onclick=()=>irPara(+b.dataset.p));
  document.querySelectorAll(".etapa").forEach(e=>e.classList.toggle("on",+e.dataset.e===passo));
  $("b-volta").style.visibility=passo?"visible":"hidden";
  const ult=passo===PASSOS.length-1;$("b-segue").textContent=ult?"Enviar para aprovação":"Avançar →";
  $("i-regra").innerHTML=orcado()?`<div class="alerta-box ok">${esc(F.tipo)} é orçado na DIR: preencha o orçado no passo 2 para comparar.</div>`:`<div class="alerta-box atn">${esc(F.tipo)} não é orçado. O gasto entra como realizado, pago pela ${F.tipo==="MANUTENÇÃO CONTRATADA"?"cliente":"ECTAS"}; o passo 2 fica dispensado.</div>`;
  $("o-msg").innerHTML=orcado()?"":`<div class="alerta-box atn">Tipo não orçado: estes campos não se aplicam.</div>`;
  document.querySelectorAll("#o-campos input").forEach(i=>i.disabled=!orcado());
  integDesl();integEq();
  if(ult)renderRev();
  resumo();
}
$("b-volta").onclick=()=>irPara(Math.max(0,passo-1-(passo===2&&!orcado()?1:0)));
$("b-segue").onclick=()=>{if(passo<PASSOS.length-1)irPara(passo+1+(passo===0&&!orcado()?1:0));else enviarLanc();};
$("b-limpa").onclick=e=>{const b=e.currentTarget;if(b.dataset.c){F=novo();passo=0;rascunho();renderForm();b.textContent="Limpar";delete b.dataset.c;toast("Formulário limpo");}else{b.textContent="Confirmar limpeza";b.dataset.c=1;setTimeout(()=>{b.textContent="Limpar";delete b.dataset.c;},3000);}};

function ligaNum(attr,obj){document.querySelectorAll(`[data-${attr}]`).forEach(i=>i.addEventListener("input",()=>{F[obj][i.dataset[attr==="es"?"es":attr]]=num(i.value);rascunho();resumo();if(attr==="d")$("d-carro").textContent=brl(calc(F).carroTot);}));}
ligaNum("o","orc");ligaNum("d","desl");ligaNum("es","est");ligaNum("sv","serv");
$("i-pedido").addEventListener("input",e=>{F.pedido=e.target.value.trim();puxarOrcado();rascunho();});
$("i-tipo").addEventListener("change",e=>{F.tipo=e.target.value;rascunho();irPara(passo);});
["ini","fim"].forEach(k=>$("i-"+k).addEventListener("change",e=>{F[k]=e.target.value;F.equipe.forEach(x=>{if(!x.manual&&!x.agenda)x.dias=diasUteis(F.ini,F.fim);});rascunho();renderEq();integDesl();integEq();resumo();}));
$("i-sup").addEventListener("input",e=>{F.supervisor=e.target.value;try{localStorage.setItem("orc-sup",F.supervisor);}catch(x){}rascunho();});
$("i-obs").addEventListener("input",e=>{F.obs=e.target.value;rascunho();});

// busca de obra (cadastro do painel + histórico)
$("i-obra").addEventListener("input",e=>{const q=norm(e.target.value),box=$("i-sug");if(!q){box.hidden=true;return;}
  const r=OBRAS.filter(o=>norm(o.id+" "+o.cliente+" "+(o.cidade||"")).includes(q)).slice(0,30);
  box.innerHTML=r.length?r.map(o=>`<div data-id="${esc(o.id)}"><b>${esc(o.id)}</b> · ${esc(o.cliente)} <span class="status">${esc(o.cidade||"")}</span></div>`).join(""):`<div class="status">Nenhuma obra encontrada</div>`;box.hidden=false;
  box.querySelectorAll("[data-id]").forEach(d=>d.onmousedown=()=>{const o=OBRAS.find(x=>x.id===d.dataset.id);F.idObra=o.id;F.obra=o.cliente;if(!F.pedido&&o.pedido){F.pedido=String(o.pedido);$("i-pedido").value=F.pedido;}$("i-obra").value=`${o.id} - ${o.cliente}`;box.hidden=true;puxarOrcado();rascunho();integEq();resumo();});});
$("i-obra").addEventListener("blur",()=>setTimeout(()=>$("i-sug").hidden=true,150));
function puxarOrcado(){
  if(!F.pedido||!F.idObra||Object.values(F.orc).some(x=>x))return;
  const m=todas().filter(v=>v.pedido===F.pedido&&v.idObra===F.idObra&&v.orc&&calc(v).orc.total).pop();
  if(m){F.orc=Object.assign(novo().orc,m.orc);document.querySelectorAll("[data-o]").forEach(i=>i.value=F.orc[i.dataset.o]||"");toast("Orçado da DIR encontrado e carregado");}
}

// integração com a Agenda Técnica
function integEq(){
  const box=$("eq-integ");
  if(!F.idObra||!F.ini||!F.fim){box.innerHTML=`<b class="t">📅 Agenda Técnica</b><span>Escolha a obra e as datas no passo 1 para trazer a equipe alocada.</span>`;return;}
  const ag=agendaDaObra(F.idObra,F.ini,F.fim);
  if(!ag.length){box.innerHTML=`<b class="t">📅 Agenda Técnica</b><span>Ninguém alocado na obra ${esc(F.idObra)} entre ${fmt(F.ini)} e ${fmt(F.fim)}.</span>`;return;}
  box.innerHTML=`<b class="t">📅 Agenda Técnica</b><span>${plural(ag.length,"colaborador alocado","colaboradores alocados")} nesta obra no período:</span>
  <div class="tabela"><table><tbody>${ag.map(p=>`<tr><td>${esc(p.nome)}</td><td>${p.func?esc(p.func.nome):'<span class="pill p-atn">sem custo cadastrado</span>'}</td><td class="n">${plural(p.dias,"dia útil","dias úteis")}</td><td class="status quebra">${esc(p.periodos.join("; "))}</td></tr>`).join("")}</tbody></table></div>
  <button type="button" class="btn sec" id="eq-agenda" style="align-self:flex-start">Trazer equipe e dias da Agenda</button>`;
  $("eq-agenda").onclick=()=>{let n=0;ag.forEach(p=>{if(!p.func)return;const ex=F.equipe.find(x=>x.nome===p.func.nome);if(ex){ex.dias=p.dias;ex.agenda=true;}else{F.equipe.push({nome:p.func.nome,vDia:p.func.vDia,vHora:p.func.vHora,dias:p.dias,h50:0,h75:0,agenda:true});}n++;});rascunho();renderEq();resumo();toast(`${plural(n,"colaborador trazido","colaboradores trazidos")} da Agenda`);};
}
function integDesl(){
  const box=$("d-integ");const ag=agendaDaObra(F.idObra,F.ini,F.fim),d=diasComEquipe(ag);
  if(!d){box.hidden=true;return;}box.hidden=false;
  box.innerHTML=`<b class="t">📅 Agenda Técnica</b><span>A equipe ficou até ${plural(d,"dia útil","dias úteis")} nesta obra no período.</span><button type="button" class="btn sec" id="d-agenda" style="align-self:flex-start">Usar ${d} dias de carro</button>`;
  $("d-agenda").onclick=()=>{F.desl.diasCarro=d;document.querySelector('[data-d="diasCarro"]').value=d;$("d-carro").textContent=brl(calc(F).carroTot);rascunho();resumo();};
}
// equipe
function renderEq(){
  $("eq-lista").innerHTML=F.equipe.length?F.equipe.map((x,i)=>`<div class="l-eq" data-i="${i}">
    <select data-k="nome"><option value="">Selecione…</option>${FUNC.map(f=>`<option ${f.nome===x.nome?"selected":""}>${esc(f.nome)}</option>`).join("")}</select>
    <input type="number" step="0.5" min="0" class="num" data-k="dias" value="${x.dias||""}" aria-label="Dias úteis">
    <input type="number" step="0.01" min="0" class="num" data-k="h50" value="${x.h50||""}" aria-label="Horas até 2h">
    <input type="number" step="0.01" min="0" class="num" data-k="h75" value="${x.h75||""}" aria-label="Horas além de 2h">
    <div class="calc">${brl((x.vDia||0)*(x.dias||0)+(x.vHora||0)*((x.h50||0)*1.5+(x.h75||0)*1.75))}</div>
    <button type="button" class="btn sec" data-del aria-label="Remover">✕</button>
    ${x.agenda?'<span class="origem">dias vindos da Agenda Técnica</span>':""}</div>`).join(""):`<p class="status">Nenhum colaborador. Use a Agenda acima ou adicione manualmente.</p>`;
  $("eq-lista").querySelectorAll(".l-eq").forEach(r=>{const i=+r.dataset.i;
    r.querySelectorAll("[data-k]").forEach(el=>el.addEventListener("change",()=>{const x=F.equipe[i],k=el.dataset.k;
      if(k==="nome"){const f=FUNC.find(f=>f.nome===el.value);x.nome=el.value;x.vDia=f?f.vDia:0;x.vHora=f?f.vHora:0;}else{x[k]=num(el.value);if(k==="dias"){x.manual=true;x.agenda=false;}}
      rascunho();renderEq();resumo();}));
    r.querySelector("[data-del]").onclick=()=>{F.equipe.splice(i,1);rascunho();renderEq();resumo();};});
}
$("eq-add").onclick=()=>{F.equipe.push({nome:"",vDia:0,vHora:0,dias:diasUteis(F.ini,F.fim),h50:0,h75:0});renderEq();};
// adicionais
function renderAd(){
  $("ad-lista").innerHTML=F.adic.length?F.adic.map((a,i)=>`<div class="l-ad" data-i="${i}"><input data-k="desc" value="${esc(a.desc)}" placeholder="Ex.: 2x Broca HSS 8mm"><input type="number" step="0.01" min="0" class="num" data-k="valor" value="${a.valor||""}"><button type="button" class="btn sec" data-del aria-label="Remover">✕</button></div>`).join("")+`<div style="text-align:right;font-weight:800">Total: ${brl(F.adic.reduce((s,a)=>s+(a.valor||0),0))}</div>`:`<p class="status">Nenhum gasto adicional.</p>`;
  $("ad-lista").querySelectorAll(".l-ad").forEach(r=>{const i=+r.dataset.i;
    r.querySelector('[data-k="desc"]').addEventListener("input",e=>{F.adic[i].desc=e.target.value;rascunho();});
    r.querySelector('[data-k="valor"]').addEventListener("change",e=>{F.adic[i].valor=num(e.target.value);rascunho();renderAd();resumo();});
    r.querySelector("[data-del]").onclick=()=>{F.adic.splice(i,1);rascunho();renderAd();resumo();};});
}
$("ad-add").onclick=()=>{F.adic.push({desc:"",valor:0});renderAd();const l=$("ad-lista").querySelectorAll('[data-k="desc"]');l[l.length-1].focus();};

function visitaDoForm(){const v=JSON.parse(JSON.stringify(F));v.equipe=v.equipe.filter(x=>x.nome);v.adic=v.adic.filter(a=>a.desc||a.valor);if(!orcado())v.orc=null;else v.orc.est=(v.orc.hotel||0)+(v.orc.alim||0);return v;}
function resumo(){
  const c=calc(visitaDoForm()),o=c.orc;
  $("rs").innerHTML=`<tr><td></td><td class="n status">Orçado</td><td class="n status">Realizado</td></tr>`+CATS.map(([k,n])=>`<tr><td>${esc(n)}</td><td class="n">${o?brlK(o[k]):"-"}</td><td class="n ${o&&o.total&&c.real[k]>o[k]?"neg":""}">${brlK(c.real[k])}</td></tr>`).join("")+
   `<tr class="tot"><td>Total</td><td class="n">${o?brl(o.total):"-"}</td><td class="n">${brl(c.real.total)}</td></tr>`+
   `<tr><td colspan="3" style="padding-top:10px">${o&&o.total?`<span class="status">Saldo</span><div class="saldo ${c.saldo<0?"neg":"pos"}">${brl(c.saldo)}</div><span class="${c.saldo<0?"neg":"pos"}">${pct(c.desvio)} sobre o orçado</span>`:`<span class="status">${orcado()?"Informe o orçado para ver o saldo.":"Tipo não orçado."}</span>`}</td></tr>`;
}
function validar(v){
  const e=[],w=[];
  if(!v.idObra)e.push("Escolha a obra.");if(!v.pedido)e.push("Informe o pedido.");
  if(!v.ini||!v.fim)e.push("Informe as datas de início e fim.");else if(v.fim<v.ini)e.push("A data fim é anterior ao início.");
  if(!String(v.supervisor||"").trim())e.push("Informe o supervisor responsável.");
  F.equipe.forEach(x=>{if(x.nome&&!x.dias)e.push(`${x.nome} está sem dias úteis.`);});
  F.adic.forEach(a=>{if(a.desc&&!a.valor)e.push(`Gasto "${a.desc}" sem valor.`);if(!a.desc&&a.valor)e.push("Gasto adicional com valor e sem descrição.");});
  if(!v.equipe.length)w.push("Nenhum colaborador lançado.");
  if(orcado()&&!(calc(v).orc&&calc(v).orc.total))w.push("Visita orçada sem valor de orçado.");
  const ag=agendaDaObra(v.idObra,v.ini,v.fim);
  v.equipe.forEach(x=>{const a=ag.find(p=>p.func&&p.func.nome===x.nome);if(ag.length&&!a)w.push(`${x.nome} não aparece na Agenda desta obra no período.`);else if(a&&a.dias!==x.dias)w.push(`${x.nome}: ${x.dias} dias lançados, ${a.dias} na Agenda.`);});
  const du=diasUteis(v.ini,v.fim);v.equipe.forEach(x=>{if(du&&(x.h50||0)>du*2+.01)w.push(`${x.nome}: mais de 2h por dia em "até 2h".`);});
  if(todas().some(x=>x._k!==v._k&&x.pedido===v.pedido&&x.idObra===v.idObra&&x.ini===v.ini&&x.tipo===v.tipo&&calc(x).real.total>0))w.push("Já existe lançamento com o mesmo pedido, obra, tipo e início.");
  return {e,w};
}
function renderRev(){
  const v=visitaDoForm(),{e,w}=validar(v);
  $("rv").innerHTML=(e.length?`<div class="alerta-box ruim"><b>Corrija antes de enviar:</b><br>${e.map(esc).join("<br>")}</div>`:`<div class="alerta-box ok">Pronto para enviar. O lançamento fica aguardando aprovação.</div>`)+
   (w.length?`<div class="alerta-box atn"><b>Confira:</b><br>${w.map(esc).join("<br>")}</div>`:"")+
   `<div class="det"><div><span>Obra</span>${esc(v.idObra)} - ${esc(v.obra)}</div><div><span>Pedido</span>${esc(v.pedido)}</div><div><span>Tipo</span>${esc(v.tipo)}</div><div><span>Período</span>${fmt(v.ini)} a ${fmt(v.fim)}</div><div><span>Equipe</span>${plural(v.equipe.length,"pessoa","pessoas")}</div><div><span>Adicionais</span>${plural(v.adic.length,"item","itens")}</div></div>`;
}
async function enviarLanc(){
  const v=visitaDoForm(),{e}=validar(v);if(e.length){renderRev();toast("Há pendências no lançamento");return;}
  v.id=v.id||("L"+Date.now().toString(36));v.status=v.status==="Aprovado"?"Aprovado":"Enviado";v.cad=new Date().toISOString().slice(0,10);
  $("b-segue").disabled=true;const ok=await gravar(v);$("b-segue").disabled=false;
  if(ok){const sup=v.supervisor;F=novo();F.supervisor=sup;passo=0;rascunho();toast(PREVIA?"Lançamento registrado nesta prévia (não gravado)":"Lançamento enviado para aprovação");abrirAba("visitas");setTimeout(()=>abrirVisita("a:"+v.id),150);}
}
async function gravar(v){
  const doc=JSON.parse(JSON.stringify(v));delete doc._k;delete doc._app;
  if(!PREVIA){try{const j=await enviar(CC,{painel:true,acao:"lancSalvar",lancamento:doc});doc.id=j.id||doc.id;doc.status=j.status||doc.status;}catch(err){toast(err.message||"Não foi possível gravar");return false;}}
  const r={...doc,_app:true,_k:"a:"+doc.id},i=APP.findIndex(x=>x.id===doc.id);if(i>=0)APP[i]=r;else APP.push(r);
  v.id=doc.id;return true;
}

/* ---------- início ---------- */
function iniciar(){
  if(PREVIA){const a=$("aviso-previa");a.hidden=false;a.textContent="Prévia para aprovação: sem login e sem gravação. Dados da planilha BD - CUSTOS DE INSTALAÇÃO e da carga da Agenda Técnica.";
    document.querySelectorAll(".troca-app a:not([aria-current]), #b-sair").forEach(a=>a.addEventListener("click",e=>{e.preventDefault();toast("Na prévia só a aba Orçado x Realizado está disponível");}));}
  abrirAba("resumo");
}
if(PREVIA){$("v-login").hidden=true;entrar("");}
else if(!CC.url){$("v-login").hidden=false;$("msg-login").textContent="A central de Custos ainda não foi instalada. Siga o orcado/LEIAME-instalacao.md.";$("msg-login").className="msg err";}
else{let s="";try{s=sessionStorage.getItem("sup-senha")||"";}catch(e){}if(s)entrar(s);else $("v-login").hidden=false;}
})();
