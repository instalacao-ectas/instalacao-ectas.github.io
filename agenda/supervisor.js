/* Agenda Técnica ECTAS: Painel do Supervisor.
   Mesma senha do Painel do Diário de Obra. Lança e edita a programação, cuida dos cadastros e das obras em espera. */
(function(){
"use strict";
const VERSAO="25/11/2026 08:45";
const $=id=>document.getElementById(id);
const A=window.AG;
const {h,hoje,addDias,segunda,dow,br,brA,dif,ehData,rotulo,cls,norm,kvs,vazio,indexar,grade,ondeEsta,modal,fechar,TIPOS,COM_OBRA,DOWL}=A;
const CENTRAL=window.CENTRAL_AGENDA||{};
const STATUS_OBRA=["Em espera","Planejado","Agendado","Confirmado","Em andamento","Atrasado","Concluído"];
let toastT;function toast(m,ms){const t=$("toast");t.textContent=m;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,ms||3200);}
const ss={get(k){try{return sessionStorage.getItem(k)||"";}catch(e){return "";}},set(k,v){try{if(v)sessionStorage.setItem(k,v);else sessionStorage.removeItem(k);}catch(e){}}};
const lsg=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;}};
const lss=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}};

let senha="",D=null,idx=new Map();
const S={clima:lsg("agd-sup-clima",true),tab:"agenda",ini:segunda(hoje()),semanas:lsg("agd-sup-semanas",2),destaque:"",dia:null,F:{func:"",tipo:"",q:"",de:addDias(hoje(),-7),ate:""},obraQ:"",cad:null};

/* ---------- central ---------- */
async function post(corpo){
  if(!CENTRAL.url)throw new Error("O painel ainda não está ligado à central. Veja o LEIAME-instalacao.md.");
  const r=await fetch(CENTRAL.url,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(corpo)});
  return r.json();
}
async function chamar(acao,extra){
  const res=await post({painel:true,senha,acao,...(extra||{})});
  if(!res.ok&&(res.erro==="senha incorreta"||res.erro==="senha vencida")){sair(res.erro);throw new Error(res.erro);}
  if(!res.ok)throw new Error(res.erro||"Não consegui salvar.");
  return res;
}
function msg(t,erro){$("msg-login").textContent=t;$("msg-login").className="msg"+(erro?" err":"");}
async function entrar(){
  $("b-entrar").disabled=true;msg("Entrando…");
  try{
    const r=await post({painel:true,senha,acao:"listar"});
    if(!r.ok){senha="";ss.set("agd-sup-senha","");
      msg(r.erro==="senha vencida"?"A senha do painel venceu. Troque no Painel do Diário de Obra e entre de novo.":r.erro==="senha incorreta"?"Senha incorreta. Use a mesma senha do Painel do Diário de Obra.":(r.erro||"Não consegui entrar."),true);return;}
    ss.set("agd-sup-senha",senha);ss.set("sup-senha",senha);
    carregar(r);$("v-login").hidden=true;$("nav").hidden=false;$("main").hidden=false;$("b-sair").hidden=false;$("b-atualizar").hidden=false;render();
  }catch(e){msg(e.message||"Não consegui entrar. Verifique a internet.",true);}
  finally{$("b-entrar").disabled=false;}
}
function carregar(r){D=r;D.lancamentos=D.lancamentos||[];idx=indexar(D.lancamentos);S.cad=null;}
async function recarregar(silencioso){
  try{const r=await chamar("listar");carregar(r);render();if(!silencioso)toast("Dados atualizados.");}catch(e){if(!silencioso)toast(e.message);}
}
$("f-login").addEventListener("submit",e=>{e.preventDefault();senha=$("senha").value;if(!senha)return msg("Digite a senha.",true);entrar();});
function sair(motivo){senha="";D=null;ss.set("agd-sup-senha","");ss.set("sup-senha","");
  $("v-login").hidden=false;$("nav").hidden=true;$("main").hidden=true;$("b-sair").hidden=true;$("b-atualizar").hidden=true;$("senha").value="";
  if(motivo==="senha vencida")msg("A senha do painel venceu. Troque no Painel do Diário de Obra e entre de novo.",true);else if(motivo)msg("Entre de novo.",true);}
$("b-sair").onclick=()=>sair("");
$("b-atualizar").onclick=()=>recarregar(false);

/* ---------- telas ---------- */
document.querySelectorAll("#nav [data-tab]").forEach(b=>b.addEventListener("click",()=>{S.tab=b.dataset.tab;render();window.scrollTo(0,0);}));
const ativos=()=>D.funcionarios.filter(f=>f.ativo).map(f=>f.nome);
function render(){
  if(!D)return;
  document.querySelectorAll("#nav [data-tab]").forEach(b=>b.setAttribute("aria-selected",String(b.dataset.tab===S.tab)));
  const m=$("main"),gb=document.querySelector(".gradebox"),gsx=gb?gb.scrollLeft:0;
  const ae=document.activeElement,foco=ae&&ae.id&&m.contains(ae)?ae.id:null,pos=foco&&ae.selectionStart;
  const v={agenda:tAgenda,hoje:tHoje,lanc:tLanc,pend:tPend,cad:tCad}[S.tab]();
  m.replaceChildren(v);
  const gb2=document.querySelector(".gradebox");if(gb2)gb2.scrollLeft=gsx;
  if(foco){const el=$(foco);if(el){el.focus();try{if(pos!=null)el.setSelectionRange(pos,pos);}catch(e){}}}
}
function tAgenda(){
  const C=window.CLIMA,ligado=S.clima&&!!C,hj=hoje(),limite=addDias(hj,(C?C.DIAS_PREV:16)-1),faltam=new Set();
  const cidObra=new Map((D.obras||[]).filter(o=>o.cidade).map(o=>[norm(o.nome),o.cidade]));
  const cidadeDe=it=>it.cidade||cidObra.get(norm(it.obra))||"";
  const equipe=(obra,d)=>[...new Set(D.lancamentos.filter(x=>x.obra===obra&&x.ini<=d&&x.fim>=d).map(x=>x.func))].filter(n=>{const r=A.resolver(idx,n,d);return r&&r.it.obra===obra;});
  /* faixa do tempo dentro de cada dia de obra (de hoje até o fim da previsão) */
  const decorar=(bl,nm,d,it)=>{
    if(!ligado||!COM_OBRA.has(it.tipo)||d<hj||d>limite)return;
    const txt=bl.textContent;bl.textContent="";bl.classList.add("comtempo");bl.append(h("span",{class:"t",text:txt}));
    const cid=cidadeDe(it);
    if(!cid){bl.append(h("div",{class:"tempo vazio",title:"Cadastre a cidade da obra em Cadastros > Obras",text:"sem cidade"}));return;}
    const pv=C.prev(cid,d);
    if(pv===undefined){faltam.add(cid);bl.append(h("div",{class:"tempo vazio",text:"buscando previsão…"}));return;}
    if(pv===null){bl.append(h("div",{class:"tempo vazio",title:cid,text:C.naoEncontrada(cid)?"cidade não encontrada":"sem previsão"}));return;}
    bl.append(C.faixa(pv,()=>C.detalhe(it.obra||it.tipo,cid,d,pv,equipe(it.obra,d))));
  };
  /* alertas dos próximos 7 dias, para todos os técnicos ativos */
  let topo=null;
  if(ligado){
    const al=new Map();
    for(const n of ativos())for(let i=0;i<7;i++){
      const d=addDias(hj,i),r=A.resolver(idx,n,d);if(!r||!COM_OBRA.has(r.it.tipo))continue;
      const cid=cidadeDe(r.it);if(!cid)continue;
      const pv=C.prev(cid,d);if(pv===undefined){faltam.add(cid);continue;}
      if(!pv||!pv.risco)continue;
      const k=r.it.obra||cid;if(!al.has(k))al.set(k,{cid,dias:new Map(),eq:new Set()});
      const a=al.get(k);a.eq.add(n);if(!a.dias.has(d)||pv.risco==="alto")a.dias.set(d,pv);
    }
    if(al.size)topo=h("div",{class:"alertastempo"},h("h3",{text:"Alertas de tempo · próximos 7 dias"}),
      [...al.entries()].map(([obra,a])=>h("div",{class:"al"},h("b",{text:obra}),h("span",{class:"mini",text:a.cid+" · "+[...a.eq].join(", ")}),
        h("span",{class:"dias"},[...a.dias.entries()].sort().map(([d,pv])=>h("span",{class:"pil "+pv.risco,text:A.DOW[dow(d)]+" "+br(d)+" · "+(pv.c>=95?"trovoada":pv.p+"% "+(pv.mm>=10?Math.round(pv.mm)+" mm":"de chuva"))}))))));
  }
  const chave=h("label",{class:"toggle"},h("input",{type:"checkbox",checked:S.clima,onchange:e=>{S.clima=e.target.checked;lss("agd-sup-clima",S.clima);render();}}),"Previsão do tempo");
  const el=grade({nomes:ativos(),idx,ini:S.ini,semanas:S.semanas,destaque:S.destaque,editavel:true,decorar,topo,legendaExtra:ligado?C.legenda():null,
    extraBotoes:[C?chave:null,h("button",{class:"btn small",type:"button",onclick:compartilhar},"Compartilhar disponibilidade"),h("button",{class:"btn primary small",type:"button",onclick:()=>formLanc(null,{})},"+ Lançar")],
    aoClicar:(nm,d,r)=>{if(r)formLanc(r.it);else formLanc(null,{func:[nm],ini:d,fim:d});},
    aoMudar:o=>{Object.assign(S,o);if(o.semanas)lss("agd-sup-semanas",o.semanas);render();}});
  if(ligado&&faltam.size)C.garantir([...faltam]).then(novo=>{if(novo&&S.tab==="agenda")render();});
  if(ligado){
    const em=C.atualizadaEm();
    const bAt=h("button",{class:"linkbtn",type:"button",onclick:()=>{bAt.textContent="atualizando…";C.renovar(true).then(()=>render());}},"Atualizar agora");
    el.append(h("p",{class:"mini",style:"margin:10px 0 0"},
      em?"Previsão atualizada às "+new Date(em).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})+" e renovada sozinha a cada 30 minutos enquanto o painel estiver aberto. ":"",bAt,
      " · Fonte: Open-Meteo (modelos de institutos como ECMWF e NOAA), até 16 dias, pela cidade do lançamento ou da obra. Toque na faixa do tempo para ver os detalhes."));
  }
  return el;
}
function tHoje(){return ondeEsta({nomes:ativos(),idx,dia:S.dia,aoMudar:d=>{S.dia=d;render();}});}

/* ---------- compartilhar a disponibilidade técnica com outras áreas ---------- */
function compartilhar(){
  const corpo=h("div",{class:"body"});
  const ini=h("input",{type:"date",id:"d-ini",value:S.ini});
  const sem=h("select",{id:"d-sem"},[2,4,6,8].map(n=>h("option",{value:n,selected:n===4},n+" semanas")));
  const obra=h("input",{type:"checkbox",id:"d-obra",checked:true});
  const msgA=h("div",{class:"mini full",role:"status"});
  const opc=()=>({idx,nomes:ativos(),ini:ehData(ini.value)?segunda(ini.value):S.ini,dias:(+sem.value)*7,obra:obra.checked});
  const baixar=async(tipo,b)=>{b.disabled=true;const t=b.textContent;b.textContent="Gerando…";
    try{await window.DISP[tipo](opc());msgA.textContent="Arquivo gerado. Envie para o setor por e-mail ou WhatsApp.";}
    catch(e){msgA.textContent=e.message||"Não consegui gerar o arquivo.";}finally{b.disabled=false;b.textContent=t;}};
  const bPdf=h("button",{class:"btn primary small",type:"button"},"Baixar PDF");bPdf.onclick=()=>baixar("pdf",bPdf);
  const bXls=h("button",{class:"btn small",type:"button"},"Baixar Excel");bXls.onclick=()=>baixar("excel",bXls);
  const arquivo=h("div",{class:"partilha full"},h("h3",{text:"1. Arquivo para enviar"}),
    h("p",{class:"mini",style:"margin:0",text:"Mostra, dia a dia, quem está livre, em campo ou indisponível, e quantos técnicos estão livres em cada dia útil. Folgas e atestados aparecem só como \"Indisponível\"."}),
    h("div",{class:"row"},h("label",{class:"field",style:"flex:1;min-width:140px"},"A partir da semana de",ini),h("label",{class:"field",style:"flex:1;min-width:120px"},"Período",sem)),
    h("label",{class:"check"},obra,"Mostrar o nome da obra (desmarque para mostrar só \"Ocupado\" e a cidade)"),
    h("div",{class:"row"},bPdf,bXls),msgA);
  const caixaLink=h("div",{class:"stack",style:"gap:8px"},h("p",{class:"mini",style:"margin:0",text:"Carregando…"}));
  const link=h("div",{class:"partilha full"},h("h3",{text:"2. Link de consulta (sempre atualizado)"}),
    h("p",{class:"mini",style:"margin:0",text:"Quem recebe o link vê a disponibilidade a qualquer momento, sem senha e sem poder alterar nada. Você pode trocar ou desligar o link quando quiser."}),caixaLink);
  corpo.append(arquivo,link);
  async function link_(modo,extra){
    caixaLink.replaceChildren(h("p",{class:"mini",style:"margin:0",text:"Aguarde…"}));
    try{const r=await chamar("dispLink",{modo,...(extra||{})});desenhar(r);}catch(e){caixaLink.replaceChildren(h("p",{class:"aviso",text:e.message}));}
  }
  function desenhar(r){
    if(!r.k){caixaLink.replaceChildren(h("button",{class:"btn primary small",type:"button",onclick:()=>link_("ativar")},"Criar link de consulta"));return;}
    const url=window.DISP.linkConsulta(r.k),txt="Disponibilidade técnica da equipe externa ECTAS (atualizada em tempo real): "+url;
    const campo=h("input",{type:"text",id:"d-link",value:url,readonly:true,onfocus:e=>e.target.select()});
    const copiar=h("button",{class:"btn small",type:"button"},"Copiar");
    copiar.onclick=async()=>{try{await navigator.clipboard.writeText(url);copiar.textContent="Copiado";}catch(e){campo.select();copiar.textContent="Use Ctrl+C";}setTimeout(()=>copiar.textContent="Copiar",2500);};
    const obraL=h("input",{type:"checkbox",checked:r.obra,onchange:e=>link_("ver",{obra:e.target.checked})});
    const novo=h("button",{class:"btn small",type:"button"},"Gerar novo link");
    novo.onclick=()=>{if(novo.dataset.a!=="1"){novo.dataset.a="1";novo.textContent="Confirmar: o link atual para de funcionar";return;}link_("novo");};
    const desl=h("button",{class:"btn bad small",type:"button"},"Desligar link");
    desl.onclick=()=>{if(desl.dataset.a!=="1"){desl.dataset.a="1";desl.textContent="Confirmar desligar";return;}link_("desligar");};
    caixaLink.replaceChildren(h("div",{class:"linkcaixa"},campo,copiar),
      h("div",{class:"row"},h("a",{class:"btn small",href:"https://wa.me/?text="+encodeURIComponent(txt),target:"_blank",rel:"noopener"},"Enviar por WhatsApp"),
        h("a",{class:"btn small",href:"mailto:?subject="+encodeURIComponent("Disponibilidade técnica ECTAS")+"&body="+encodeURIComponent(txt),target:"_blank"},"Enviar por e-mail"),
        h("a",{class:"btn small",href:url,target:"_blank",rel:"noopener"},"Abrir")),
      h("label",{class:"check"},obraL,"No link, mostrar o nome da obra"),
      h("div",{class:"row"},novo,desl));
  }
  link_("ver");
  modal("Compartilhar disponibilidade técnica",corpo,[h("span",{class:"spacer"}),h("button",{class:"btn",type:"button",onclick:fechar},"Fechar")]);
}

/* ---------- previsão do tempo: renovação automática ---------- */
function renovarClima(forcar){
  const C=window.CLIMA;
  if(!C||!D||!S.clima||document.visibilityState!=="visible")return;
  if(!forcar&&!C.vencida())return;
  C.renovar(true).then(novo=>{if(novo&&S.tab==="agenda"&&!document.querySelector(".janela"))render();});
}
setInterval(()=>renovarClima(false),5*60000);   // confere a cada 5 minutos; busca de novo quando passar de 30 minutos
document.addEventListener("visibilitychange",()=>renovarClima(false));

/* ---------- lista de lançamentos ---------- */
function tLanc(){
  const F=S.F,q=norm(F.q);
  const linhas=D.lancamentos.filter(it=>(!F.func||it.func===F.func)&&(!F.tipo||it.tipo===F.tipo)&&(!F.de||it.fim>=F.de)&&(!F.ate||it.ini<=F.ate)&&
    (!q||norm(it.obra).includes(q)||norm(it.cidade).includes(q)||norm(it.obs).includes(q)||norm(it.obraId).includes(q)))
    .sort((a,b)=>a.ini<b.ini?-1:a.ini>b.ini?1:a.func.localeCompare(b.func));
  const sobre=it=>(idx.get(it.func)||[]).some(o=>o!==it&&o.ini<=it.fim&&o.fim>=it.ini);
  const nomes=[...new Set(D.funcionarios.map(f=>f.nome).concat([...idx.keys()]))].sort((a,b)=>a.localeCompare(b));
  const cab=h("div",{class:"vhead"},h("div",{},h("h2",{text:"Lançamentos"}),h("p",{class:"lead",text:linhas.length+" de "+D.lancamentos.length+" lançamentos"})),
    h("div",{class:"toolbar"},h("button",{class:"btn small",type:"button",onclick:()=>exportar(linhas)},"Baixar para Excel (CSV)"),
      D.planilha?h("a",{class:"btn small",href:D.planilha,target:"_blank",rel:"noopener"},"Abrir a planilha"):null,
      h("button",{class:"btn primary small",type:"button",onclick:()=>formLanc(null,{})},"+ Novo lançamento")));
  const filtros=h("div",{class:"filtros"},
    h("label",{class:"field"},"Funcionário",h("select",{id:"f-func",onchange:e=>{F.func=e.target.value;render();}},h("option",{value:"",text:"Todos"}),nomes.map(n=>h("option",{value:n,selected:n===F.func,text:n})))),
    h("label",{class:"field"},"Tipo",h("select",{id:"f-tipo",onchange:e=>{F.tipo=e.target.value;render();}},h("option",{value:"",text:"Todos"}),TIPOS.map(([t])=>h("option",{value:t,selected:t===F.tipo,text:t})))),
    h("label",{class:"field"},"Obra, cidade ou obs.",h("input",{type:"search",id:"f-q",value:F.q,oninput:e=>{F.q=e.target.value;render();}})),
    h("label",{class:"field"},"De",h("input",{type:"date",id:"f-de",value:F.de,onchange:e=>{F.de=e.target.value;render();}})),
    h("label",{class:"field"},"Até",h("input",{type:"date",id:"f-ate",value:F.ate,onchange:e=>{F.ate=e.target.value;render();}})));
  if(!linhas.length)return h("div",{},cab,filtros,vazio("Nenhum lançamento com esses filtros","Limpe os filtros ou crie um novo lançamento."));
  const tab=h("div",{class:"tablebox"},h("table",{class:"lista"},
    h("thead",{},h("tr",{},["Funcionário","Período","Dias","Tipo","Obra / local","Cidade","Status","Veículo","Observação",""].map(t=>h("th",{text:t})))),
    h("tbody",{},linhas.slice(0,400).map(it=>h("tr",{class:"lin",tabindex:"0",onclick:()=>formLanc(it),onkeydown:e=>{if(e.key==="Enter")formLanc(it);}},
      h("td",{},h("b",{text:it.func})),h("td",{class:"tnum",style:"white-space:nowrap",text:brA(it.ini)+(it.fim!==it.ini?" a "+brA(it.fim):"")}),h("td",{class:"num",text:dif(it.ini,it.fim)+1}),
      h("td",{},h("span",{class:"pilula "+cls(it),text:it.tipo})),h("td",{text:it.obra?(it.obraId?it.obraId+" · ":"")+it.obra:""}),h("td",{text:it.cidade}),
      h("td",{text:it.status}),h("td",{text:it.veiculo}),h("td",{class:"mini",text:it.obs}),
      h("td",{},sobre(it)?h("span",{class:"chip c-bad",text:"Sobreposição"}):null))))));
  return h("div",{},cab,filtros,tab,linhas.length>400?h("p",{class:"mini",text:"Mostrando os 400 primeiros. Use os filtros para refinar."}):null);
}
function exportar(linhas){
  const esc=v=>{v=String(v==null?"":v);return /[;"\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};
  const txt=[["Funcionário","Início","Término","Tipo","ID","Obra / local","Cidade/UF","Status","Veículo","Observação"].join(";")]
    .concat(linhas.map(it=>[it.func,brA(it.ini),brA(it.fim),it.tipo,it.obraId,it.obra,it.cidade,it.status,it.veiculo,it.obs].map(esc).join(";"))).join("\r\n");
  const a=h("a",{href:URL.createObjectURL(new Blob(["﻿"+txt],{type:"text/csv;charset=utf-8"})),download:"agenda-tecnica-"+hoje()+".csv"});
  document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);
}

/* ---------- formulário de lançamento ---------- */
function formLanc(it,pre){
  pre=pre||{};const ed=!!it,t=hoje();
  const v=Object.assign({ini:pre.ini||t,fim:pre.fim||pre.ini||t,tipo:"Obra",status:"Confirmado",obra:"",obraId:"",cidade:"",veiculo:"",obs:""},it||{},pre.copia||{});
  const marcados=new Set(ed?[it.func]:(pre.func||[]));
  const corpo=h("div",{class:"body"});
  const nomes=[...new Set(ativos().concat(ed?[it.func]:[]))];
  const quem=ed?h("label",{class:"field full"},"Funcionário",h("select",{id:"l-func"},[...new Set(nomes.concat(D.funcionarios.map(f=>f.nome)))].map(n=>h("option",{value:n,selected:n===it.func,text:n}))))
    :h("div",{class:"field full"},h("span",{class:"label",text:"Funcionários (marque todos da equipe)"}),h("div",{class:"marcas",id:"l-funcs"},nomes.map(n=>h("label",{},h("input",{type:"checkbox",value:n,checked:marcados.has(n)}),n))));
  const ini=h("input",{type:"date",id:"l-ini",value:v.ini}),fim=h("input",{type:"date",id:"l-fim",value:v.fim});
  ini.addEventListener("change",()=>{if(fim.value<ini.value)fim.value=ini.value;checar();});fim.addEventListener("change",checar);
  const rap=h("div",{class:"rapidos full"},
    h("button",{type:"button",class:"btn small",onclick:()=>{const m=segunda(ini.value||t);ini.value=m;fim.value=addDias(m,4);checar();}},"Semana (seg a sex)"),
    h("button",{type:"button",class:"btn small",onclick:()=>{fim.value=ini.value;checar();}},"Só 1 dia"),
    h("button",{type:"button",class:"btn small",onclick:()=>{const m=segunda(addDias(ini.value||t,7));ini.value=m;fim.value=addDias(m,4);checar();}},"Próxima semana"));
  const tipo=h("select",{id:"l-tipo"},TIPOS.map(([x])=>h("option",{value:x,selected:x===v.tipo,text:x})));
  const dl=h("datalist",{id:"dl-obras"},D.obras.map(o=>h("option",{value:o.nome},(o.id?o.id+" · ":"")+(o.cidade||""))));
  const obra=h("input",{type:"text",id:"l-obra",list:"dl-obras",value:v.obra,placeholder:"Digite para buscar na lista",autocomplete:"off"});
  const oid=h("input",{type:"text",id:"l-oid",value:v.obraId,inputmode:"numeric"});
  const cid=h("input",{type:"text",id:"l-cid",value:v.cidade,placeholder:"Cidade/UF"});
  obra.addEventListener("change",()=>{const o=D.obras.find(o=>norm(o.nome)===norm(obra.value));if(o){if(o.id)oid.value=o.id;if(o.cidade)cid.value=o.cidade;}});
  const blocoObra=[h("label",{class:"field full"},"Obra / local",obra),h("label",{class:"field"},"ID da obra",oid),h("label",{class:"field"},"Cidade/UF",cid)];
  const mostrarObra=()=>blocoObra.forEach(el=>el.hidden=!COM_OBRA.has(tipo.value));
  tipo.addEventListener("change",mostrarObra);
  const st=h("div",{class:"seg",role:"radiogroup","aria-label":"Status"},["Planejado","Confirmado"].map(x=>h("button",{type:"button","aria-pressed":String(x===v.status),onclick:e=>{st.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(b===e.currentTarget)));}},x)));
  const dlv=h("datalist",{id:"dl-veic"},D.veiculos.map(x=>h("option",{value:x})));
  const veic=h("input",{type:"text",id:"l-veic",list:"dl-veic",value:v.veiculo,autocomplete:"off"});
  const obs=h("textarea",{id:"l-obs"},v.obs||"");
  const alerta=h("div",{class:"alerta",hidden:true});
  corpo.append(quem,h("label",{class:"field"},"Início",ini),h("label",{class:"field"},"Término",fim),rap,
    h("label",{class:"field"},"Tipo",tipo),h("div",{class:"field"},h("span",{class:"label",text:"Status"}),st),
    ...blocoObra,dl,h("label",{class:"field full"},"Veículo",veic),dlv,h("label",{class:"field full"},"Observação",obs),alerta);
  mostrarObra();
  const escolhidos=()=>ed?[corpo.querySelector("#l-func").value]:[...corpo.querySelectorAll("#l-funcs input:checked")].map(i=>i.value);
  function checar(){
    const a=ini.value,b=fim.value,ms=[];
    if(a&&b&&b<a)ms.push("O término é antes do início.");
    if(a&&b)for(const n of escolhidos()){const ov=(idx.get(n)||[]).filter(o=>(!ed||o.id!==it.id)&&o.ini<=b&&o.fim>=a);
      if(ov.length)ms.push(n+" já tem "+ov.map(o=>rotulo(o)+" ("+br(o.ini)+(o.fim!==o.ini?"–"+br(o.fim):"")+")").join(", ")+". Este lançamento passa a valer nesses dias.");}
    alerta.hidden=!ms.length;alerta.textContent=ms.join(" ");
  }
  corpo.addEventListener("change",e=>{if(e.target.closest("#l-funcs")||e.target.id==="l-func")checar();});
  checar();
  const salvar=h("button",{class:"btn primary",type:"button"},ed?"Salvar alterações":"Salvar lançamento");
  salvar.addEventListener("click",async()=>{
    const quem=escolhidos();
    if(!quem.length){alerta.hidden=false;alerta.textContent="Marque pelo menos um funcionário.";return;}
    if(!ehData(ini.value)||!ehData(fim.value)||fim.value<ini.value){alerta.hidden=false;alerta.textContent="Confira as datas de início e término.";return;}
    const com=COM_OBRA.has(tipo.value);
    const base={ini:ini.value,fim:fim.value,tipo:tipo.value,status:st.querySelector('[aria-pressed="true"]').textContent,
      obra:com?obra.value.trim():"",obraId:com?oid.value.trim():"",cidade:com?cid.value.trim():"",veiculo:veic.value.trim(),obs:obs.value.trim()};
    const lista=ed?[{...base,id:it.id,func:quem[0]}]:quem.map(n=>({...base,func:n}));
    salvar.disabled=true;salvar.textContent="Salvando…";
    try{
      const r=await chamar("lancSalvar",{lancamentos:lista});
      for(const n of r.lancamentos){const i=D.lancamentos.findIndex(x=>x.id===n.id);if(i>=0)D.lancamentos[i]=n;else D.lancamentos.push(n);}
      idx=indexar(D.lancamentos);fechar();render();toast(ed?"Lançamento atualizado.":(lista.length>1?lista.length+" lançamentos salvos.":"Lançamento salvo."));
    }catch(e){salvar.disabled=false;salvar.textContent="Tentar de novo";toast(e.message);}
  });
  const rod=[];
  if(ed){
    const exc=h("button",{class:"btn bad",type:"button"},"Excluir");
    exc.addEventListener("click",async()=>{
      if(exc.dataset.armado!=="1"){exc.dataset.armado="1";exc.textContent="Confirmar exclusão";return;}
      exc.disabled=true;
      try{await chamar("lancExcluir",{id:it.id});D.lancamentos=D.lancamentos.filter(x=>x.id!==it.id);idx=indexar(D.lancamentos);fechar();render();toast("Lançamento excluído.");}
      catch(e){exc.disabled=false;toast(e.message);}
    });
    rod.push(exc,h("button",{class:"btn",type:"button",onclick:()=>{fechar();formLanc(null,{func:[it.func],ini:addDias(it.ini,7),fim:addDias(it.fim,7),copia:{tipo:it.tipo,obra:it.obra,obraId:it.obraId,cidade:it.cidade,veiculo:it.veiculo,status:it.status}});}},"Repetir na semana seguinte"));
  }
  rod.push(h("span",{class:"spacer"}),h("button",{class:"btn",type:"button",onclick:fechar},"Cancelar"),salvar);
  modal(ed?"Editar lançamento":"Novo lançamento",corpo,rod);
}

/* ---------- obras em espera e manutenções ---------- */
function tPend(){
  const t=hoje(),stc=s=>s==="Confirmado"||s==="Concluído"?"c-ok":s==="Atrasado"?"c-bad":s==="Em espera"?"c-warn":"c-mute";
  const ord=(a,b)=>(Number(a.ordem)||0)-(Number(b.ordem)||0);
  const esp=(D.espera||[]).slice().sort(ord),man=(D.manutencoes||[]).slice().sort(ord);
  const data=v=>ehData(v)?brA(v):v;
  const cartao=(tipo,v,meta)=>h("div",{class:"card pend stack",style:"gap:6px",tabindex:"0",onclick:()=>formPend(tipo,v),onkeydown:e=>{if(e.key==="Enter")formPend(tipo,v);}},
    h("div",{class:"row",style:"justify-content:space-between"},h("b",{text:(v.obra_id?v.obra_id+" · ":"")+v.obra}),h("span",{class:"chip "+stc(v.status),text:v.status||"Em espera"})),
    h("dl",{class:"kv"},meta),v.obs?h("div",{class:"prox",text:v.obs}):null);
  return h("div",{},
    h("div",{class:"vhead"},h("div",{},h("h2",{text:"Obras em espera"}),h("p",{class:"lead",text:"Instalações aguardando o cliente. Data de atualização em vermelho: mais de 30 dias sem notícia."})),
      h("div",{class:"toolbar"},h("button",{class:"btn primary small",type:"button",onclick:()=>formPend("espera",{})},"+ Obra em espera"))),
    esp.length?h("div",{class:"grid"},esp.map(v=>cartao("espera",v,[...kvs([["Previsão",data(v.previsao)],["Prazo",v.prazo],["Tipo",v.tipo_inst]]),
      ...(v.atualizado?[h("dt",{text:"Atualizado"}),h("dd",{class:ehData(v.atualizado)&&dif(v.atualizado,t)>30?"velho":"",text:data(v.atualizado)})]:[])]))):vazio("Nenhuma obra em espera",""),
    h("div",{class:"vhead",style:"margin-top:26px"},h("div",{},h("h2",{text:"Manutenções"})),
      h("div",{class:"toolbar"},h("button",{class:"btn primary small",type:"button",onclick:()=>formPend("manut",{})},"+ Manutenção"))),
    man.length?h("div",{class:"grid"},man.map(v=>cartao("manut",v,kvs([["Entrada",data(v.entrada)],["Motivo",v.motivo]])))):vazio("Nenhuma manutenção",""));
}
function formPend(tipo,v){
  const esp=tipo==="espera",corpo=h("div",{class:"body"});
  const campos=esp?[["obra_id","ID",""],["obra","Obra","full"],["previsao","Previsão de ida (data ou texto)",""],["prazo","Prazo estimado",""],["tipo_inst","Tipo de instalação",""],["status","Status","sel"],["atualizado","Última atualização","data"],["obs","Observação","area"]]
    :[["obra_id","ID",""],["obra","Obra","full"],["entrada","Data de entrada","data"],["status","Status","sel"],["motivo","Motivo","full"],["obs","Observação","area"]];
  const inp={};
  for(const [k,lab,tp] of campos){
    let el;
    if(tp==="sel")el=h("select",{id:"p-"+k},STATUS_OBRA.map(s=>h("option",{value:s,selected:s===(v[k]||"Em espera"),text:s})));
    else if(tp==="area")el=h("textarea",{id:"p-"+k},v[k]||"");
    else if(tp==="data")el=h("input",{type:"date",id:"p-"+k,value:ehData(v[k])?v[k]:(k==="atualizado"&&!v.uid?hoje():"")});
    else el=h("input",{type:"text",id:"p-"+k,value:v[k]||"",list:k==="obra"?"dl-obras2":null});
    inp[k]=el;corpo.append(h("label",{class:"field"+(tp==="full"||tp==="area"?" full":"")},lab,el));
  }
  corpo.append(h("datalist",{id:"dl-obras2"},D.obras.map(o=>h("option",{value:o.nome}))));
  inp.obra.addEventListener("change",()=>{const o=D.obras.find(o=>norm(o.nome)===norm(inp.obra.value));if(o&&o.id&&!inp.obra_id.value)inp.obra_id.value=o.id;});
  const salvar=h("button",{class:"btn primary",type:"button"},"Salvar");
  salvar.addEventListener("click",async()=>{
    if(!inp.obra.value.trim()){inp.obra.focus();return;}
    const item={uid:v.uid||"",ordem:v.ordem||""};for(const [k] of campos)item[k]=inp[k].value.trim();
    if(esp&&v.uid&&item.status!==v.status&&item.atualizado===(v.atualizado||""))item.atualizado=hoje();
    salvar.disabled=true;
    try{const r=await chamar("pendSalvar",{tipo,item});const arr=esp?D.espera:D.manutencoes;const i=arr.findIndex(x=>x.uid===r.item.uid);if(i>=0)arr[i]=r.item;else arr.push(r.item);fechar();render();toast("Salvo.");}
    catch(e){salvar.disabled=false;toast(e.message);}
  });
  const rod=[];
  if(v.uid){
    const exc=h("button",{class:"btn bad",type:"button"},esp?"Remover da lista":"Excluir");
    exc.addEventListener("click",async()=>{if(exc.dataset.armado!=="1"){exc.dataset.armado="1";exc.textContent="Confirmar";return;}
      try{await chamar("pendExcluir",{tipo,uid:v.uid});if(esp)D.espera=D.espera.filter(x=>x.uid!==v.uid);else D.manutencoes=D.manutencoes.filter(x=>x.uid!==v.uid);fechar();render();toast("Removido.");}catch(e){toast(e.message);}});
    rod.push(exc);
    if(esp)rod.push(h("button",{class:"btn",type:"button",onclick:()=>{fechar();S.tab="agenda";render();const o=D.obras.find(o=>norm(o.nome)===norm(v.obra));formLanc(null,{copia:{obra:v.obra,obraId:v.obra_id,cidade:o?o.cidade:""}});}},"Lançar equipe"));
  }
  rod.push(h("span",{class:"spacer"}),h("button",{class:"btn",type:"button",onclick:fechar},"Cancelar"),salvar);
  modal(v.uid?(esp?"Obra em espera":"Manutenção"):(esp?"Nova obra em espera":"Nova manutenção"),corpo,rod);
}

/* ---------- cadastros ---------- */
function tCad(){
  if(!S.cad)S.cad={funcs:D.funcionarios.map(f=>({...f})),veics:D.veiculos.slice(),obras:D.obras.map(o=>({...o})),sujo:{}};
  const C=S.cad,usuarios=(D.usuarios||[]).filter(u=>u.ativo!==false);
  const marcar=k=>{C.sujo[k]=true;const b=$("c-salvar");if(b){b.disabled=false;b.textContent="Salvar cadastros";}};
  const bSalvar=h("button",{class:"btn primary small",id:"c-salvar",type:"button",disabled:!Object.keys(C.sujo).length},Object.keys(C.sujo).length?"Salvar cadastros":"Sem alterações");
  bSalvar.addEventListener("click",async()=>{
    bSalvar.disabled=true;bSalvar.textContent="Salvando…";
    try{
      if(C.sujo.funcs)await chamar("funcSalvar",{lista:C.funcs.filter(f=>f.nome.trim())});
      if(C.sujo.veics)await chamar("veicSalvar",{lista:C.veics});
      if(C.sujo.obras)await chamar("obrasSalvar",{lista:C.obras.filter(o=>o.nome.trim()).sort((a,b)=>a.nome.localeCompare(b.nome))});
      toast("Cadastros salvos.");await recarregar(true);
    }catch(e){bSalvar.disabled=false;bSalvar.textContent="Tentar de novo";toast(e.message);}
  });
  const cab=h("div",{class:"vhead"},h("div",{},h("h2",{text:"Cadastros"}),h("p",{class:"lead",text:"Equipe, veículos e obras das listas. Desmarque Ativo para tirar alguém da agenda sem apagar o histórico."})),
    h("div",{class:"toolbar"},Object.keys(C.sujo).length?h("button",{class:"btn small",type:"button",onclick:()=>{S.cad=null;render();}},"Descartar"):null,bSalvar));
  const pF=h("div",{class:"card stack"},h("h3",{text:"Funcionários ("+C.funcs.filter(f=>f.ativo).length+" ativos)"}),
    h("p",{class:"mini",style:"margin:0",text:"Ligue cada pessoa ao usuário dela no Diário de Obra: assim a Minha agenda abre direto no nome certo. A ordem desta lista é a ordem das linhas na agenda."}),
    h("div",{class:"stack",style:"gap:6px"},C.funcs.map((f,i)=>h("div",{class:"edlinha"},
      h("input",{type:"text",id:"cf-n"+i,value:f.nome,"aria-label":"Nome",placeholder:"Nome",oninput:e=>{f.nome=e.target.value;marcar("funcs");}}),
      h("input",{type:"text",id:"cf-f"+i,value:f.funcao||"","aria-label":"Função",placeholder:"Função",oninput:e=>{f.funcao=e.target.value;marcar("funcs");}}),
      h("select",{"aria-label":"Usuário do Diário de Obra",onchange:e=>{f.login=e.target.value;marcar("funcs");}},h("option",{value:"",text:"Sem usuário do Diário"}),
        [...new Set(usuarios.map(u=>u.login).concat(f.login?[f.login]:[]))].map(l=>{const u=usuarios.find(x=>x.login===l);return h("option",{value:l,selected:l===f.login,text:u?u.nome+" ("+l+")":l});})),
      h("label",{class:"check",style:"align-items:center;white-space:nowrap"},h("input",{type:"checkbox",checked:!!f.ativo,onchange:e=>{f.ativo=e.target.checked;marcar("funcs");}}),"Ativo"),
      h("button",{class:"iconbtn",type:"button","aria-label":"Remover "+f.nome,title:"Remover",onclick:()=>{C.funcs.splice(i,1);marcar("funcs");render();}},"×")))),
    h("button",{class:"btn small",type:"button",onclick:()=>{C.funcs.push({nome:"",funcao:"",ativo:true,login:""});marcar("funcs");render();setTimeout(()=>{const el=$("cf-n"+(C.funcs.length-1));if(el)el.focus();},30);}},"+ Adicionar funcionário"));
  const novoV=h("input",{type:"text",id:"cv-novo",placeholder:"Ex.: Cronos - ABC1D23"});
  const addV=()=>{if(novoV.value.trim()){C.veics.push(novoV.value.trim());marcar("veics");render();setTimeout(()=>{const el=$("cv-novo");if(el)el.focus();},30);}};
  novoV.addEventListener("keydown",e=>{if(e.key==="Enter")addV();});
  const pV=h("div",{class:"card stack"},h("h3",{text:"Veículos"}),h("div",{class:"chipsv"},C.veics.map((v,i)=>h("span",{},v,h("button",{class:"iconbtn",type:"button","aria-label":"Remover "+v,onclick:()=>{C.veics.splice(i,1);marcar("veics");render();}},"×")))),
    h("div",{class:"row"},h("div",{style:"flex:1;min-width:180px"},novoV),h("button",{class:"btn small",type:"button",onclick:addV},"Adicionar")));
  const q=norm(S.obraQ),lista=C.obras.map((o,i)=>i).filter(i=>!q||norm(C.obras[i].nome).includes(q)||norm(C.obras[i].id).includes(q)||norm(C.obras[i].cidade).includes(q));
  const pO=h("div",{class:"card stack"},h("h3",{text:"Obras ("+C.obras.length+")"}),
    h("div",{class:"row"},h("input",{type:"search",id:"co-q",placeholder:"Buscar por nome, ID ou cidade",value:S.obraQ,style:"flex:1;min-width:200px;width:auto",oninput:e=>{S.obraQ=e.target.value;render();}}),
      h("button",{class:"btn small",type:"button",onclick:()=>{C.obras.unshift({id:"",nome:"",cidade:""});S.obraQ="";marcar("obras");render();setTimeout(()=>{const el=$("co-n0");if(el)el.focus();},30);}},"+ Nova obra")),
    h("div",{class:"stack",style:"gap:6px"},lista.slice(0,60).map(i=>{const o=C.obras[i];return h("div",{class:"edlinha ob"},
      h("input",{type:"text",id:"co-i"+i,value:o.id||"",placeholder:"ID","aria-label":"ID",oninput:e=>{o.id=e.target.value;marcar("obras");}}),
      h("input",{type:"text",id:"co-n"+i,value:o.nome,placeholder:"Nome da obra","aria-label":"Obra",oninput:e=>{o.nome=e.target.value;marcar("obras");}}),
      h("input",{type:"text",id:"co-c"+i,value:o.cidade||"",placeholder:"Cidade/UF","aria-label":"Cidade",oninput:e=>{o.cidade=e.target.value;marcar("obras");}}),
      h("button",{class:"iconbtn",type:"button","aria-label":"Remover obra",onclick:()=>{C.obras.splice(i,1);marcar("obras");render();}},"×"));})),
    lista.length>60?h("p",{class:"mini",text:"Mostrando 60 de "+lista.length+". Use a busca."}):null);
  return h("div",{},cab,h("div",{class:"stack"},pF,pV,pO));
}

/* ---------- início ---------- */
$("versao").textContent="Versão "+VERSAO;
if(!CENTRAL.url)msg("O painel ainda não está ligado à central. Siga o LEIAME-instalacao.md desta pasta.",true);
const guardada=ss.get("agd-sup-senha")||ss.get("sup-senha");
if(guardada&&CENTRAL.url){senha=guardada;entrar();}
})();
