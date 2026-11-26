/* Gastos de Campo (app do técnico)
   O técnico só lança os gastos adicionais das visitas em que é o responsável em campo:
   fotografa a nota fiscal, o celular lê o valor (OCR, sem mandar a foto para fora), o técnico confere e envia.
   A nota cai nos gastos adicionais da visita; o supervisor completa o resto dos custos no painel. */
(()=>{
"use strict";
const $=id=>document.getElementById(id);
const CC=window.CENTRAL_CUSTOS||{}, CD=window.CENTRAL||{};
const PREVIA=!!window.ORCADO_PREVIA;
const LS_PREVIA="orc-previa-lanc";

/* ---------- utilitários ---------- */
function esc(s){const d=document.createElement("div");d.textContent=s==null?"":String(s);return d.innerHTML;}
const brl=n=>(n<0?"-":"")+"R$ "+Math.abs(n||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmt=s=>{if(!s)return"-";const[y,m,d]=s.split("-");return `${d}/${m}/${y}`;};
const hoje=()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10);};
const ls={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;}},set(k,v){try{if(v==null)localStorage.removeItem(k);else localStorage.setItem(k,JSON.stringify(v));}catch(e){}}};
let tT;function toast(m){const t=$("toast");t.textContent=m;t.hidden=false;clearTimeout(tT);tT=setTimeout(()=>t.hidden=true,3200);}
const valorNum=s=>{s=String(s||"").replace(/[^\d,.-]/g,"");if(s.includes(","))s=s.replace(/\./g,"").replace(",",".");const n=parseFloat(s);return isFinite(n)?Math.round(n*100)/100:0;};
const valorTxt=n=>n?n.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}):"";

/* ---------- estado ---------- */
let eu=null, VIS=[], atual=null, notaFoto=null, notaMini=null, valorLido=0;

/* ---------- dados: prévia (no aparelho) ou central ---------- */
const TEC_PREVIA=[["leonardo","Leonardo Santos da Costa"],["marcelo","Marcelo de Sousa Ferreira"],["gleobi","Gleobi Luiz Borges"],["alison","Alison da Silva"],["rodrigo","Rodrigo Oliveira de Oliveira"]];
function semearPrevia(){
  if(ls.get(LS_PREVIA,null))return;
  ls.set(LS_PREVIA,[{id:"Lprevia1",status:"Em campo",pedido:"5999",idObra:"1761",obra:"ASH EMPR IMOB - SPRING PARK",tipo:"INSTALAÇÃO",ini:"2026-11-23",fim:"2026-11-27",
    supervisor:"Supervisor",resp:{login:"leonardo",nome:"Leonardo Santos da Costa"},orc:{desl:1500,hotel:0,alim:0,ht:3000,he:0,adic:300,frete:0,munk:0},
    desl:{diasCarro:0,carro:150},est:{},serv:{},equipe:[],adic:[],notas:[],obs:""}]);
}
async function chamar(acao,extra){
  const s=ls.get("sessao",null);
  const r=await fetch(CC.url,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({campo:true,acao,tokenDiario:s&&s.token,...(extra||{})})});
  const j=await r.json();
  if(!j.ok){if(j.erro==="sessao"){ls.set("sessao",null);eu=null;mostra("v-entrar");$("l-msg").textContent="Sua sessão expirou. Entre de novo.";$("l-msg").className="msg err";}
    const e=new Error(j.erro==="sessao"?"Sessão expirada":(j.erro||"Falha na central"));e.codigo=j.erro;throw e;}
  return j;
}
async function carregar(){
  if(PREVIA){VIS=(ls.get(LS_PREVIA,[])||[]).filter(v=>v.resp&&v.resp.login===eu.login);return;}
  const j=await chamar("campoListar");VIS=j.visitas||[];
}
async function salvarNota(n){
  if(PREVIA){const L=ls.get(LS_PREVIA,[]);const v=L.find(x=>x.id===atual.id);if(!v||v.status!=="Em campo")throw new Error("Esta visita já foi encerrada pelo supervisor.");
    v.notas=(v.notas||[]).concat([n]);ls.set(LS_PREVIA,L);return;}
  await chamar("notaSalvar",{visita:atual.id,nota:n});
}
async function concluirNotas(){
  if(PREVIA){const L=ls.get(LS_PREVIA,[]);const v=L.find(x=>x.id===atual.id);if(!v||v.status!=="Em campo")throw new Error("Esta visita já foi encerrada.");
    v.campo={concluido:true,em:new Date().toLocaleString("pt-BR").slice(0,17),login:eu.login,nome:eu.nome};ls.set(LS_PREVIA,L);return;}
  await chamar("campoConcluir",{visita:atual.id});
}
async function excluirNota(id){
  if(PREVIA){const L=ls.get(LS_PREVIA,[]);const v=L.find(x=>x.id===atual.id);if(!v||v.status!=="Em campo")throw new Error("Esta visita já foi encerrada.");v.notas=(v.notas||[]).filter(x=>x.id!==id);ls.set(LS_PREVIA,L);return;}
  await chamar("notaExcluir",{visita:atual.id,nota:id});
}

/* ---------- telas ---------- */
function mostra(v){["v-entrar","v-lista","v-visita","v-nota"].forEach(x=>$(x).hidden=x!==v);$("b-sair").hidden=v==="v-entrar";window.scrollTo(0,0);}
const somaNotas=v=>(v.notas||[]).filter(n=>!n.recusada).reduce((a,n)=>a+(n.valor||0),0);
function cartao(v,aberta){
  const b=document.createElement("button");b.type="button";b.className="card visita";
  b.innerHTML=`<b>${esc(v.idObra)} - ${esc(v.obra)}</b><div class="meta"><span>Pedido ${esc(v.pedido)} · ${fmt(v.ini)} a ${fmt(v.fim)}</span></div>
   <div class="meta"><span>${(v.notas||[]).length} nota(s) ${!aberta?"· encerrada":concl(v)?"· ✓ envio concluído":""}</span><span class="tot">${brl(somaNotas(v))}</span></div>`;
  b.onclick=()=>abrirVisita(v.id);return b;
}
function renderLista(){
  $("ola").textContent=`Olá, ${eu.nome.split(" ")[0]}. Estas são as visitas em que você é o responsável pelos gastos em campo.`;
  const ab=VIS.filter(v=>v.status==="Em campo"),enc=VIS.filter(v=>v.status!=="Em campo");
  const L=$("lista-abertas");L.innerHTML="";
  if(!ab.length)L.innerHTML=`<div class="card"><p class="status" style="margin:0">Nenhuma visita aberta para você agora. Quando o supervisor abrir uma visita com você como responsável, ela aparece aqui.</p></div>`;
  ab.forEach(v=>L.append(cartao(v,true)));
  $("det-enc").hidden=!enc.length;const E=$("lista-enc");E.innerHTML="";enc.forEach(v=>E.append(cartao(v,false)));
  mostra("v-lista");
}
const concl=v=>!!(v.campo&&v.campo.concluido);
function abrirVisita(id){
  atual=VIS.find(v=>v.id===id);if(!atual)return;
  const fim=concl(atual),aberta=atual.status==="Em campo"&&!fim;
  $("vis-cab").innerHTML=`<h2>Visita</h2><b>${esc(atual.idObra)} - ${esc(atual.obra)}</b>
   <div class="status">Pedido ${esc(atual.pedido)} · ${esc(String(atual.tipo||"").toLowerCase())} · ${fmt(atual.ini)} a ${fmt(atual.fim)}</div>
   <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="status">Total das suas notas</span><span class="tot" style="font-size:1.3rem">${brl(somaNotas(atual))}</span></div>
   ${atual.status!=="Em campo"?'<span class="pill p-atn">Encerrada pelo supervisor: não recebe mais notas</span>':fim?`<div class="concluido">✅ Você concluiu o envio das notas${atual.campo.em?" em "+esc(atual.campo.em):""}. Elas não podem mais ser alteradas. Se faltou alguma, peça ao supervisor para reabrir.</div>`:""}`;
  $("b-concluir").hidden=!aberta;$("dica-concluir").hidden=!aberta;delete $("b-concluir").dataset.c;$("b-concluir").textContent="✅ Concluir envio das notas";
  $("b-foto").hidden=!aberta;document.querySelector('label[for="in-galeria"]').hidden=!aberta;
  const N=$("notas");const ns=(atual.notas||[]).slice().reverse();
  N.innerHTML=ns.length?ns.map(n=>`<div class="nota"><img src="${esc(n.mini||n.foto||"")}" alt="Nota"><div class="d">${esc(n.desc)}<small>${fmt(n.data)}${n.loja?" · "+esc(n.loja):""}</small>${n.digitado?'<span class="pill p-atn">valor digitado</span> ':""}${n.recusada?'<span class="pill p-ruim">recusada pelo supervisor</span>':""}</div><div class="v">${brl(n.valor)}${aberta&&!n.recusada?`<br><button type="button" class="linkbtn" data-del="${esc(n.id)}" style="font-size:.74rem">excluir</button>`:""}</div></div>`).join(""):`<p class="status" style="margin:0">Nenhuma nota ainda. Toque em "Fotografar nota fiscal".</p>`;
  N.querySelectorAll("[data-del]").forEach(b=>b.onclick=async()=>{if(b.dataset.c){try{await excluirNota(b.dataset.del);await carregar();abrirVisita(atual.id);toast("Nota excluída");}catch(e){toast(e.message);}}else{b.dataset.c=1;b.textContent="toque de novo";setTimeout(()=>{b.textContent="excluir";delete b.dataset.c;},3000);}});
  mostra("v-visita");
}
$("b-concluir").onclick=async e=>{
  const b=e.currentTarget,ns=(atual.notas||[]).filter(n=>!n.recusada);
  if(!b.dataset.c){b.dataset.c=1;b.textContent=`Confirmar: enviei todas as ${ns.length} nota(s) (${brl(somaNotas(atual))})`;
    toast("Depois de concluir, as notas desta visita não podem mais ser alteradas");setTimeout(()=>{if(b.dataset.c){delete b.dataset.c;b.textContent="✅ Concluir envio das notas";}},6000);return;}
  b.disabled=true;
  try{await concluirNotas();await carregar();abrirVisita(atual.id);toast("Envio das notas concluído. Obrigado!");}
  catch(err){toast(err.message||"Não foi possível concluir");}finally{b.disabled=false;}
};
$("b-voltar").onclick=async()=>{await carregar().catch(()=>{});renderLista();};
$("b-cancelar").onclick=()=>abrirVisita(atual.id);

/* ---------- foto e leitura (OCR no próprio celular) ---------- */
async function prepararImagem(file){
  const img=await new Promise((ok,err)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=err;i.src=URL.createObjectURL(file);});
  const max=1700,esc_=Math.min(1,max/Math.max(img.width,img.height));
  const c=document.createElement("canvas");c.width=Math.round(img.width*esc_);c.height=Math.round(img.height*esc_);
  const g=c.getContext("2d");g.drawImage(img,0,0,c.width,c.height);
  const foto=c.toDataURL("image/jpeg",.6);            // cópia para guardar como comprovante
  const d=g.getImageData(0,0,c.width,c.height),p=d.data;   // versão em tons de cinza e mais contraste para ler melhor
  for(let i=0;i<p.length;i+=4){let y=.299*p[i]+.587*p[i+1]+.114*p[i+2];y=Math.max(0,Math.min(255,(y-128)*1.5+128));p[i]=p[i+1]=p[i+2]=y;}
  g.putImageData(d,0,0);
  const leitura=await new Promise(ok=>c.toBlob(ok,"image/png"));
  const m=document.createElement("canvas"),em=Math.min(1,240/Math.max(img.width,img.height));m.width=Math.round(img.width*em);m.height=Math.round(img.height*em);
  m.getContext("2d").drawImage(img,0,0,m.width,m.height);
  return {foto,leitura,mini:m.toDataURL("image/jpeg",.6)};
}
let worker=null;
async function lerTexto(blob,progresso){
  if(!worker){
    progresso("Preparando o leitor (só na primeira vez)…",.05);
    worker=await Tesseract.createWorker("por",1,{workerPath:new URL("lib/worker.min.js",location.href).href,corePath:new URL("lib/core",location.href).href,
      langPath:new URL("lib/lang",location.href).href,gzip:true,logger:m=>{if(m.status==="recognizing text")progresso("Lendo a nota…",.3+.7*m.progress);}});
  }
  progresso("Lendo a nota…",.3);
  const {data}=await worker.recognize(blob);
  return data.text||"";
}
/* encontra valor total, data, CNPJ e estabelecimento no texto da nota */
function extrairNota(texto){
  const linhas=texto.split(/\n/).map(l=>l.trim()).filter(Boolean);
  const reV=/(\d{1,3}(?:[.\s]\d{3})*,\s?\d{2}|\d+,\s?\d{2})(?!\d)/g;
  const nums=l=>(l.match(reV)||[]).map(x=>valorNum(x.replace(/\s/g,"")));
  const N=l=>l.normalize("NFD").replace(/[̀-ͯ]/g,"").toUpperCase();
  const ruim=/ITENS|QTD|QUANT|TRIBUT|IMPOSTO|DESCONTO|DESC\.|TROCO|ACRESC|LEI 12|APROX|SUBTOTAL|SUB-TOTAL|DINHEIRO|RECEBIDO/;
  const bom=[/VALOR\s*(TOTAL|A\s*PAGAR|PAGO|LIQUIDO)/,/TOTAL\s*(R\$|A\s*PAGAR|GERAL|DA\s*NOTA|DO\s*CUPOM)/,/VL\.?\s*TOTAL/,/^TOTAL\b/,/\bTOTAL\b/];
  let valor=0,como="";
  for(const re of bom){
    for(let i=0;i<linhas.length&&!valor;i++){const l=N(linhas[i]);if(!re.test(l)||ruim.test(l))continue;
      let v=nums(linhas[i]);if(!v.length&&linhas[i+1])v=nums(linhas[i+1]);
      if(v.length){valor=v[v.length-1];como=`Valor achado na linha "${linhas[i].slice(0,40)}".`;}}
    if(valor)break;
  }
  if(!valor){const todos=linhas.filter(l=>!ruim.test(N(l))).flatMap(nums).filter(x=>x>0&&x<100000);if(todos.length){valor=Math.max(...todos);como="Não achei a linha do TOTAL: usei o maior valor da nota. Confira.";}}
  let data="";const md=texto.match(/(\d{2})[\/.-](\d{2})[\/.-](\d{4}|\d{2})/);
  if(md){let a=md[3].length===2?"20"+md[3]:md[3];const iso=`${a}-${md[2]}-${md[1]}`;if(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(iso))data=iso;}
  const mc=texto.match(/\d{2}\.?\d{3}\.?\d{3}\s?\/?\s?\d{4}\s?-?\s?\d{2}/);
  const cnpj=mc?mc[0].replace(/\D/g,"").replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,"$1.$2.$3/$4-$5"):"";
  // estabelecimento: a linha "mais limpa" do topo da nota (antes do CNPJ), com palavras de verdade
  const iC=linhas.findIndex(l=>/CNPJ|\d{2}\.\d{3}\.\d{3}/.test(l));
  const topo=linhas.slice(0,iC>0?iC:6).slice(-5);
  const nota_=l=>{const p=l.split(/\s+/).filter(w=>/^[A-Za-zÀ-ú&.]{2,}$/.test(w));const letras=(l.match(/[A-Za-zÀ-ú]/g)||[]).length;
    const r=letras/Math.max(1,l.replace(/\s/g,"").length);return (r>.8?1:0)*(p.filter(w=>w.length>=3).length+(/LTDA|EIRELI|\bME\b|S\/?A\b|COMERCIO|COM\.|MATERIA|FERRAG|POSTO|AUTO|RESTAURANTE|HOTEL|MERCADO|SUPERMERCADO|FARMACIA|LOJA/i.test(l)?3:0));};
  const melhor=topo.filter(l=>!/CUPOM|DOCUMENTO|NFC|NOTA FISCAL|EXTRATO|CPF|IE[: ]|ENDERE|RUA|AV\.|AVENIDA|TEL|FONE|SAT/i.test(l)).map(l=>[nota_(l),l]).sort((a,b)=>b[0]-a[0])[0];
  const loja=melhor&&melhor[0]>=2?melhor[1].replace(/[^\wÀ-ú .&/-]/g,"").trim().slice(0,60):"";
  return {valor,como,data,cnpj,loja};
}
async function receberFoto(file){
  if(!file)return;
  mostra("v-nota");$("n-form").hidden=true;$("n-lendo").hidden=false;$("n-barra").style.width="0";$("n-img").removeAttribute("src");
  const prog=(t,p)=>{$("n-etapa").textContent=t;$("n-barra").style.width=Math.round(p*100)+"%";};
  try{
    prog("Preparando a foto…",.02);
    const {foto,leitura,mini}=await prepararImagem(file);notaFoto=foto;notaMini=mini;$("n-img").src=foto;
    let texto="";try{texto=await lerTexto(leitura,prog);}catch(e){texto="";}
    const r=extrairNota(texto);
    $("n-texto").textContent=texto||"(não consegui ler texto nesta foto)";
    // valor lido com segurança (linha do TOTAL): fica travado, o técnico só confirma.
    // Sem leitura: a foto vale como comprovante e o técnico digita o valor (a nota vai marcada como "valor digitado").
    valorLido=r.valor&&!/Confira/.test(r.como)?r.valor:0;
    const vi=$("n-valor");vi.readOnly=!!valorLido;vi.classList.toggle("travado",!!valorLido);vi.value=valorLido?valorTxt(valorLido):"";
    vi.placeholder=valorLido?"":"0,00";
    $("l-valor").firstChild.textContent=valorLido?"Valor lido da nota [R$]":"Valor total da nota [R$] (digite)";
    $("n-data").value=r.data||hoje();$("n-cnpj").value=r.cnpj;$("n-loja").value=valorLido?r.loja:"";$("n-desc").value="";
    const a=$("n-achado");
    if(valorLido){a.className="achado ok";a.textContent=`Valor lido: ${brl(valorLido)}. Confira com a nota. Se não estiver certo, toque em "Tirar outra foto".`;}
    else{a.className="achado atn";a.textContent=`Não consegui ler o valor desta nota. A foto fica registrada como comprovante: digite o valor total da nota${r.valor?` (o maior valor que encontrei foi ${brl(r.valor)})`:""}. Se preferir, tire outra foto mais de perto e com boa luz.`;}
    $("n-lendo").hidden=true;$("n-form").hidden=false;$("n-msg").textContent="";
    setTimeout(()=>(valorLido?$("n-desc"):vi).focus(),100);
  }catch(e){$("n-etapa").textContent="Não consegui abrir a foto. Tente de novo.";}
}
["in-foto","in-galeria"].forEach(id=>$(id).addEventListener("change",e=>{const f=e.target.files[0];e.target.value="";receberFoto(f);}));
$("n-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const valor=valorLido||valorNum($("n-valor").value),desc=$("n-desc").value.trim();
  if(!(valor>0)){$("n-msg").textContent="Informe o valor da nota.";$("n-msg").className="msg err";return;}
  if(!desc){$("n-msg").textContent="Diga o que foi comprado.";$("n-msg").className="msg err";return;}
  const n={id:"N"+Date.now().toString(36),valor,desc,data:$("n-data").value||hoje(),cnpj:$("n-cnpj").value.trim(),loja:$("n-loja").value.trim(),
    foto:notaFoto,mini:notaMini,digitado:!valorLido,tecnico:eu.nome,login:eu.login,enviadaEm:new Date().toISOString(),leitura:$("n-texto").textContent.slice(0,1500)};
  $("b-confirmar").disabled=true;$("n-msg").textContent="Enviando…";$("n-msg").className="msg";
  try{await salvarNota(n);await carregar();abrirVisita(atual.id);toast(`Nota de ${brl(valor)} enviada para a obra.`);}
  catch(err){$("n-msg").textContent=err.message||"Não consegui enviar. Tente de novo.";$("n-msg").className="msg err";}
  finally{$("b-confirmar").disabled=false;}
});

/* ---------- login ---------- */
$("v-entrar").addEventListener("submit",async e=>{
  e.preventDefault();const msg=t=>{$("l-msg").textContent=t;$("l-msg").className="msg err";};
  if(PREVIA){const [login,nome]=TEC_PREVIA.find(t=>t[0]===$("l-previa").value);eu={login,nome};ls.set("orc-previa-eu",eu);await carregar();renderLista();return;}
  const usuario=$("l-usuario").value.trim().toLowerCase(),senha=$("l-senha").value;
  if(!usuario||!senha)return msg("Digite o usuário e a senha.");
  try{
    const rd=await (await fetch(CD.url,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({acao:"login",usuario,senha,chave:CD.chave})})).json();
    if(!rd.ok)throw new Error(rd.erro||"Não consegui entrar.");
    ls.set("sessao",{token:rd.token,usuario:rd.usuario.login,nome:rd.usuario.nome});
    eu={login:rd.usuario.login,nome:rd.usuario.nome};$("l-senha").value="";await carregar();renderLista();
  }catch(err){msg(err.message||"Não consegui entrar.");}
});
$("b-sair").onclick=()=>{eu=null;if(PREVIA)ls.set("orc-previa-eu",null);mostra("v-entrar");};

/* ---------- início ---------- */
(async()=>{
  if(PREVIA){
    semearPrevia();
    $("aviso-previa").hidden=false;$("aviso-previa").textContent="Prévia: nada é enviado para a central. A leitura da nota é real, feita no próprio aparelho.";
    $("l-senha-w").hidden=true;$("l-usuario").closest("label").hidden=true;$("l-previa-w").hidden=false;
    $("l-previa").innerHTML=TEC_PREVIA.map(t=>`<option value="${t[0]}">${esc(t[1])}</option>`).join("");
    document.querySelectorAll(".troca-app a:not([aria-current])").forEach(a=>a.addEventListener("click",ev=>{ev.preventDefault();toast("Na prévia só o app de Gastos está disponível");}));
    window.addEventListener("storage",ev=>{if(ev.key===LS_PREVIA&&eu)carregar().then(()=>{if(!$("v-lista").hidden)renderLista();else if(!$("v-visita").hidden&&atual)abrirVisita(atual.id);});});
    const s=ls.get("orc-previa-eu",null);if(s){eu=s;await carregar();renderLista();}else mostra("v-entrar");
    return;
  }
  const s=ls.get("sessao",null);
  if(s&&s.token){eu={login:s.usuario,nome:s.nome||s.usuario};try{await carregar();renderLista();return;}catch(e){}}
  mostra("v-entrar");
})();
})();
