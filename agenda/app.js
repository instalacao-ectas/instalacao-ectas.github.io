/* Agenda Técnica ECTAS: app do técnico (só leitura).
   Entra com o mesmo usuário e senha do Diário de Obra e guarda a última agenda no celular para ver sem internet. */
(function(){
"use strict";
const VERSAO="12/11/2026 16:00";
const $=id=>document.getElementById(id);
const {h,hoje,segunda,brA,indexar,grade,ondeEsta,minha,detalhe,vazio}=window.AG;
const CENTRAL=window.CENTRAL_AGENDA||{};
const temCentral=()=>!!(CENTRAL.url&&CENTRAL.chave);
const DIARIO=window.CENTRAL||{};
const ls={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;}},set(k,v){try{if(v==null)localStorage.removeItem(k);else localStorage.setItem(k,JSON.stringify(v));}catch(e){}}};
let toastT;function toast(m,ms){const t=$("toast");t.textContent=m;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,ms||3200);}

const S={tab:ls.get("agd-aba","minha"),dados:ls.get("agd-dados",null),idx:new Map(),ini:segunda(hoje()),semanas:ls.get("agd-semanas",2),destaque:"",dia:null,carregando:false};
if(S.dados)S.idx=indexar(S.dados.lancamentos);

/* ---------- sessão: a mesma do Diário de Obra ---------- */
const lerSessao=()=>ls.get("agd-sessao",null);
const gravarSessao=s=>ls.set("agd-sessao",s);
const sessaoDiario=()=>{const s=ls.get("sessao",null);return s&&s.token?s:null;};
function sairDiario(){["sessao","obras-lista","bloqueio","desbloq"].forEach(k=>{try{localStorage.removeItem(k);}catch(e){}});}
async function chamar(o,semToken){
  const s=lerSessao();
  if(!semToken&&!s)throw new Error("sem login");
  const r=await fetch(CENTRAL.url,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({...o,chave:CENTRAL.chave,...(semToken?{}:{token:s.token})})});
  const res=await r.json();
  if(!semToken&&!res.ok&&res.erro==="sessao"){await sessaoInvalida();const e=new Error("login necessário");e.sessao=true;throw e;}
  return res;
}
/* abre a sessão da Agenda com o login já feito no Diário, sem pedir senha */
async function ponteDiario(){
  const sd=sessaoDiario();if(!sd||!temCentral()||!navigator.onLine)return false;
  try{
    const res=await chamar({acao:"loginDiario",tokenDiario:sd.token},true);
    if(res.ok){gravarSessao({token:res.token,usuario:res.usuario.login,nome:res.usuario.nome,diario:sd.token});return true;}
    if(res.erro==="sessao_diario")sairDiario();
  }catch(e){}
  return false;
}
let ponteTentada=false;
async function sessaoInvalida(){
  const velha=lerSessao();gravarSessao(null);
  const sd=sessaoDiario();
  if(!ponteTentada&&sd&&(!velha||velha.diario!==sd.token)){ponteTentada=true;if(await ponteDiario()){ponteTentada=false;atualizar();return;}}
  ponteTentada=false;
  if(velha&&velha.diario&&sd&&sd.token===velha.diario)sairDiario();
  mostrarLogin("Sua sessão terminou. Entre novamente com o usuário e a senha do Diário de Obra.");
}
function mostrarLogin(motivo){
  $("v-entrar").hidden=false;$("nav").hidden=true;$("main").hidden=true;$("b-sair").hidden=true;$("b-atualizar").hidden=true;
  $("l-msg").textContent=motivo||"";$("l-msg").className="msg"+(motivo?" err":"");
  const u=$("l-usuario");if(!u.value)u.value=(lerSessao()||{}).usuario||ls.get("ultimo-usuario","")||"";
}
function esconderLogin(){$("v-entrar").hidden=true;$("nav").hidden=false;$("main").hidden=false;$("b-sair").hidden=false;$("b-atualizar").hidden=false;render();}
$("f-entrar").addEventListener("submit",async e=>{
  e.preventDefault();
  const usuario=$("l-usuario").value.trim().toLowerCase(),senha=$("l-senha").value;
  const erro=t=>{$("l-msg").textContent=t;$("l-msg").className="msg err";};
  if(!usuario||!senha)return erro("Digite o usuário e a senha.");
  if(!temCentral())return erro("O aplicativo ainda não está ligado à central. Avise o supervisor.");
  if(!navigator.onLine)return erro("Para entrar é preciso internet. Depois a agenda fica salva no celular.");
  const b=$("b-entrar");b.disabled=true;$("l-msg").textContent="Entrando…";$("l-msg").className="msg";
  try{
    const rd=await (await fetch(DIARIO.url,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({acao:"login",usuario,senha,chave:DIARIO.chave})})).json();
    if(!rd.ok)throw new Error(rd.erro||"Não consegui entrar.");
    ls.set("sessao",{token:rd.token,usuario:rd.usuario.login,nome:rd.usuario.nome});
    try{localStorage.setItem("ultimo-usuario",rd.usuario.login);localStorage.setItem("ultimo-uso",String(Date.now()));}catch(err){}
    const res=await chamar({acao:"loginDiario",tokenDiario:rd.token},true);
    if(!res.ok)throw new Error(res.erro==="sessao_diario"?"Não consegui confirmar o login. Tente de novo.":(res.erro||"Não consegui entrar."));
    const ant=lerSessao();
    gravarSessao({token:res.token,usuario:res.usuario.login,nome:res.usuario.nome,diario:rd.token});
    if(ant&&ant.usuario!==res.usuario.login){S.dados=null;ls.set("agd-dados",null);ls.set("agd-eu",null);}
    $("l-senha").value="";esconderLogin();toast("Olá, "+res.usuario.nome+".");atualizar();
  }catch(err){erro(err.message||"Não consegui entrar. Verifique a internet.");}
  finally{b.disabled=false;}
});
let confirmaSair=false,tSair=null;
$("b-sair").onclick=()=>{
  if(!confirmaSair){confirmaSair=true;$("b-sair").textContent="Toque de novo para sair";$("b-sair").classList.add("alerta");
    clearTimeout(tSair);tSair=setTimeout(()=>{confirmaSair=false;$("b-sair").textContent="Sair";$("b-sair").classList.remove("alerta");},5000);return;}
  confirmaSair=false;clearTimeout(tSair);$("b-sair").textContent="Sair";$("b-sair").classList.remove("alerta");
  gravarSessao(null);sairDiario();ls.set("agd-dados",null);S.dados=null;S.idx=new Map();$("l-usuario").value="";mostrarLogin("");
};

/* ---------- dados ---------- */
async function atualizar(manual){
  if(!temCentral()||!lerSessao())return;
  if(!navigator.onLine){if(manual)toast("Sem internet. Mostrando a última agenda salva.");return;}
  S.carregando=true;if(manual)$("b-atualizar").textContent="Atualizando…";
  try{
    const r=await chamar({acao:"dados"});
    if(r.ok){S.dados={funcionarios:r.funcionarios||[],lancamentos:r.lancamentos||[],meuNome:r.meuNome||"",em:new Date().toISOString()};
      ls.set("agd-dados",S.dados);S.idx=indexar(S.dados.lancamentos);
      const s=lerSessao();if(s&&r.usuario&&r.usuario.nome!==s.nome)gravarSessao({...s,nome:r.usuario.nome});
      if(manual)toast("Agenda atualizada.");}
    else if(manual)toast(r.erro||"Não consegui atualizar.");
  }catch(e){if(!e.sessao&&manual)toast("Não consegui atualizar. Verifique a internet.");}
  finally{S.carregando=false;$("b-atualizar").textContent="Atualizar";render();}
}
$("b-atualizar").onclick=()=>atualizar(true);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&S.dados&&Date.now()-new Date(S.dados.em).getTime()>5*60000)atualizar();});
addEventListener("online",()=>atualizar());

/* ---------- telas ---------- */
document.querySelectorAll("#nav [data-tab]").forEach(b=>b.addEventListener("click",()=>{S.tab=b.dataset.tab;ls.set("agd-aba",S.tab);render();window.scrollTo(0,0);}));
const nomes=()=>(S.dados&&S.dados.funcionarios||[]).filter(f=>f.ativo!==false).map(f=>f.nome);
function render(){
  document.querySelectorAll("#nav [data-tab]").forEach(b=>b.setAttribute("aria-selected",String(b.dataset.tab===S.tab)));
  const m=$("main");if(m.hidden)return;
  const gb=document.querySelector(".gradebox"),gsx=gb?gb.scrollLeft:0,foco=document.activeElement&&document.activeElement.id;
  const partes=[];
  if(!temCentral())partes.push(h("div",{class:"banner",text:"O aplicativo ainda não está ligado à central. Avise o supervisor."}));
  if(!S.dados){partes.push(vazio(S.carregando?"Carregando a agenda…":"Agenda ainda não carregada",S.carregando?"":"Toque em Atualizar com internet."));m.replaceChildren(...partes);return;}
  partes.push(h("p",{class:"atualizado",text:"Agenda atualizada em "+new Date(S.dados.em).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})+(navigator.onLine?"":" · sem internet, mostrando a última salva")}));
  if(S.tab==="minha")partes.push(telaMinha());
  else if(S.tab==="agenda")partes.push(grade({nomes:nomes(),idx:S.idx,ini:S.ini,semanas:S.semanas,destaque:S.destaque,editavel:false,
    aoClicar:(nm,d,r)=>detalhe(nm,d,r),aoMudar:(o,leve)=>{Object.assign(S,o);if(o.semanas)ls.set("agd-semanas",o.semanas);render();}}));
  else partes.push(ondeEsta({nomes:nomes(),idx:S.idx,dia:S.dia,aoMudar:d=>{S.dia=d;render();}}));
  m.replaceChildren(...partes);
  const gb2=document.querySelector(".gradebox");if(gb2)gb2.scrollLeft=gsx;
  if(foco){const el=$(foco);if(el&&el.focus){el.focus();if(el.type==="search")try{el.setSelectionRange(el.value.length,el.value.length);}catch(e){}}}
}
function telaMinha(){
  const lista=nomes(),auto=S.dados.meuNome&&lista.includes(S.dados.meuNome)?S.dados.meuNome:"";
  let eu=auto||ls.get("agd-eu","");if(eu&&!lista.includes(eu))eu="";
  const cab=h("div",{class:"vhead"},h("div",{},h("h2",{text:"Minha agenda"}),h("p",{class:"lead",text:auto?"Olá, "+auto+". Sua alocação de hoje e das próximas semanas.":"Sua alocação de hoje e das próximas semanas."})));
  const escolha=auto?null:h("div",{class:"quem"},h("label",{class:"field"},"Quem é você?",
    h("select",{id:"m-eu",onchange:e=>{ls.set("agd-eu",e.target.value);render();}},h("option",{value:"",text:"Escolha seu nome"}),lista.map(n=>h("option",{value:n,selected:n===eu,text:n})))),
    h("span",{class:"mini",text:"Fica salvo neste celular. O supervisor pode ligar seu nome ao seu usuário para você não precisar escolher."}));
  if(!eu)return h("div",{},cab,escolha,vazio("Escolha seu nome","Assim que escolher, aparecem a obra de hoje, cidade, veículo e os próximos dias."));
  return h("div",{},cab,escolha,minha({nome:eu,idx:S.idx}));
}

/* ---------- instalar na tela inicial ---------- */
let pedidoInstalar=null;
const instalado=()=>matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
const ehIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
function mostrarInstalar(forcar){
  if(instalado()){$("instalar").hidden=true;$("b-instalar-rodape").hidden=true;return;}
  $("b-instalar-rodape").hidden=false;
  if(!forcar&&Date.now()<ls.get("agd-instalar-adiado",0))return;
  const como=$("instalar-como"),b=$("b-instalar");
  if(pedidoInstalar){como.textContent="Fica com ícone na tela inicial e mostra a última agenda mesmo sem internet.";b.hidden=false;}
  else if(ehIOS()){como.textContent="No Safari, toque em Compartilhar (o quadrado com a seta) e depois em Adicionar à Tela de Início.";b.hidden=true;}
  else{como.textContent="Abra o menu do navegador (⋮) e toque em Instalar aplicativo ou Adicionar à tela inicial.";b.hidden=true;}
  $("instalar").hidden=false;
}
addEventListener("beforeinstallprompt",e=>{e.preventDefault();pedidoInstalar=e;mostrarInstalar(false);});
addEventListener("appinstalled",()=>{pedidoInstalar=null;$("instalar").hidden=true;$("b-instalar-rodape").hidden=true;toast("Aplicativo instalado.");});
$("b-instalar").onclick=async()=>{if(!pedidoInstalar){mostrarInstalar(true);return;}pedidoInstalar.prompt();try{const r=await pedidoInstalar.userChoice;if(r&&r.outcome==="accepted")$("instalar").hidden=true;}catch(e){}pedidoInstalar=null;};
$("b-instalar-nao").onclick=()=>{ls.set("agd-instalar-adiado",Date.now()+7*864e5);$("instalar").hidden=true;};
$("b-instalar-rodape").onclick=()=>{mostrarInstalar(true);window.scrollTo({top:0,behavior:"smooth"});};
setTimeout(()=>mostrarInstalar(false),2500);
if("serviceWorker" in navigator&&location.protocol==="https:"){
  const tinha=!!navigator.serviceWorker.controller;let recarregou=false;
  navigator.serviceWorker.addEventListener("controllerchange",()=>{if(tinha&&!recarregou){recarregou=true;setTimeout(()=>location.reload(),200);}});
  navigator.serviceWorker.register("sw.js",{updateViaCache:"none"}).then(r=>{r.update();document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")r.update();});}).catch(()=>{});
}

/* ---------- início ---------- */
$("versao").textContent="Versão "+VERSAO;
(async()=>{
  const sa=lerSessao(),sd=sessaoDiario();
  if(sa&&sd&&sd.usuario!==sa.usuario){gravarSessao(null);ls.set("agd-dados",null);S.dados=null;}
  else if(sa&&sa.diario&&!sd)gravarSessao(null);
  if(!lerSessao()&&sd)await ponteDiario();
  if(!lerSessao())mostrarLogin("");
  else{esconderLogin();atualizar();}
})();
})();
