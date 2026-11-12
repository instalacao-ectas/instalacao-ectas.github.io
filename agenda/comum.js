/* Agenda Técnica ECTAS: partes comuns ao app do técnico e ao painel do supervisor
   (datas, cores por tipo, grade semanal, "onde está a equipe", "minha agenda" e janela de detalhes). */
(function(){
"use strict";
const TIPOS=[["Obra",1],["Assistência técnica",2],["Manutenção",3],["Base ECTAS",4],["Treinamento",5],["Reunião",5],["Exame",5],
  ["Folga",6],["Férias",6],["Feriado",6],["Licença",6],["Atestado",7],["Falta",7],["A definir",8]];
const GRUPO=Object.fromEntries(TIPOS);
const LEG=[[1,"Obra / instalação"],[2,"Assistência técnica"],[3,"Manutenção"],[4,"Base ECTAS"],[5,"Treinamento, reunião, exame"],[6,"Folga, férias, feriado"],[7,"Atestado, falta"]];
const COM_OBRA=new Set(["Obra","Assistência técnica","Manutenção"]);
const DOW=["DOM","SEG","TER","QUA","QUI","SEX","SÁB"];
const DOWL=["domingo","segunda","terça","quarta","quinta","sexta","sábado"];

/* datas em texto aaaa-mm-dd, contas em UTC para não sofrer com fuso */
const pad=n=>String(n).padStart(2,"0");
function hoje(){const d=new Date();return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());}
function toD(s){const [y,m,d]=s.split("-").map(Number);return new Date(Date.UTC(y,m-1,d));}
function fromD(d){return d.getUTCFullYear()+"-"+pad(d.getUTCMonth()+1)+"-"+pad(d.getUTCDate());}
function addDias(s,n){const d=toD(s);d.setUTCDate(d.getUTCDate()+n);return fromD(d);}
function dow(s){return toD(s).getUTCDay();}
function segunda(s){const w=dow(s);return addDias(s,w===0?-6:1-w);}
function br(s){if(!s)return "";const p=s.split("-");return p[2]+"/"+p[1];}
function brA(s){if(!s)return "";const p=s.split("-");return p[2]+"/"+p[1]+"/"+p[0];}
function dif(a,b){return Math.round((toD(b)-toD(a))/864e5);}
const ehData=s=>typeof s==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(s);

/* montagem de elementos (sempre textContent: nada vira HTML) */
function h(tag,attrs,...kids){
  const el=document.createElement(tag);
  for(const [k,v] of Object.entries(attrs||{})){
    if(v==null||v===false)continue;
    if(k==="class")el.className=v;
    else if(k==="text")el.textContent=v;
    else if(k.startsWith("on"))el.addEventListener(k.slice(2),v);
    else el.setAttribute(k,v===true?"":v);
  }
  for(const c of kids.flat()){if(c==null||c===false)continue;el.append(c.nodeType?c:document.createTextNode(String(c)));}
  return el;
}
const grp=it=>GRUPO[it.tipo]||8;
const rotulo=it=>COM_OBRA.has(it.tipo)&&it.obra?it.obra:it.tipo;
const cls=it=>"g"+grp(it)+(it.status==="Planejado"?" plan":"");
const norm=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
const kvs=pares=>pares.filter(p=>p[1]).flatMap(([k,v])=>[h("dt",{text:k}),h("dd",{text:v})]);
function vazio(t,m){return h("div",{class:"empty"},h("b",{text:t,style:"display:block;color:var(--fg);margin-bottom:4px"}),m||"");}

/* índice por funcionário; no mesmo dia vale o lançamento salvo por último (maior "seq") */
function indexar(lancs){
  const m=new Map();
  for(const it of lancs||[]){if(!it||!it.func||!ehData(it.ini)||!ehData(it.fim))continue;if(!m.has(it.func))m.set(it.func,[]);m.get(it.func).push(it);}
  return m;
}
function resolver(idx,func,dia){
  let best=null,n=0;
  for(const it of idx.get(func)||[]){if(it.ini<=dia&&it.fim>=dia){n++;if(!best||(it.seq||0)>(best.seq||0))best=it;}}
  return best?{it:best,n}:null;
}
function proximo(idx,func,dia,atual){
  let best=null;
  for(const it of idx.get(func)||[]){if(it.ini>dia&&(!atual||it.id!==atual.id)){if(!best||it.ini<best.ini||(it.ini===best.ini&&(it.seq||0)>(best.seq||0)))best=it;}}
  if(best){const r=resolver(idx,func,best.ini);return r?r.it:best;}
  return null;
}

/* ---------- janela (modal) ---------- */
let ultimoFoco=null;
function modal(titulo,corpo,rodape){
  ultimoFoco=document.activeElement;
  const m=h("div",{class:"janela",role:"dialog","aria-modal":"true","aria-label":titulo},
    h("header",{},h("h2",{text:titulo}),h("button",{class:"iconbtn x",type:"button","aria-label":"Fechar",onclick:fechar},"×")),corpo,h("footer",{},rodape));
  const sc=h("div",{class:"scrim",onclick:e=>{if(e.target===sc)fechar();}},m);
  let root=document.getElementById("modalroot");if(!root){root=h("div",{id:"modalroot"});document.body.append(root);}
  root.replaceChildren(sc);document.addEventListener("keydown",esc);
  const f=m.querySelector("input,select,textarea,button.primary");if(f)f.focus();
}
function esc(e){if(e.key==="Escape")fechar();}
function fechar(){const r=document.getElementById("modalroot");if(r)r.replaceChildren();document.removeEventListener("keydown",esc);if(ultimoFoco&&ultimoFoco.focus)try{ultimoFoco.focus();}catch(e){}}

function detalhe(nm,d,r){
  const corpo=h("div",{class:"body"});
  if(!r)corpo.append(h("p",{class:"full mini",text:"Nenhum lançamento para este dia."}));
  else{
    const it=r.it;
    corpo.append(h("div",{class:"full destaque "+cls(it)},h("span",{class:"when",text:it.tipo+" · "+(it.status||"")}),h("span",{class:"what",text:rotulo(it)})),
      h("dl",{class:"kv full"},kvs([["Período",brA(it.ini)+" a "+brA(it.fim)],["Cidade",it.cidade],["ID da obra",it.obraId],["Veículo",it.veiculo],["Observação",it.obs]])));
    if(r.n>1)corpo.append(h("p",{class:"full aviso",text:"Há outro lançamento neste dia. Confirme com o supervisor."}));
  }
  modal(nm+" · "+DOWL[dow(d)]+", "+brA(d),corpo,[h("button",{class:"btn primary",type:"button",onclick:fechar},"Fechar")]);
}

/* ---------- grade semanal ---------- */
/* o = {nomes, idx, ini, semanas, destaque, editavel, aoClicar(nome,dia,r), aoMudar(estado), extraBotoes} */
function grade(o){
  const dias=[];for(let i=0;i<o.semanas*7;i++)dias.push(addDias(o.ini,i));
  const hj=hoje(),q=norm((o.destaque||"").trim());
  const barra=h("div",{class:"vhead"},
    h("div",{},h("h2",{text:"Agenda da equipe"}),h("p",{class:"lead",text:o.editavel?"Toque em um dia para lançar ou editar.":"Toque em um dia para ver os detalhes."})),
    h("div",{class:"toolbar"},
      h("button",{class:"btn small",type:"button","aria-label":"Semana anterior",onclick:()=>o.aoMudar({ini:addDias(o.ini,-7)})},"‹"),
      h("button",{class:"btn small",type:"button",onclick:()=>o.aoMudar({ini:segunda(hoje())})},"Hoje"),
      h("button",{class:"btn small",type:"button","aria-label":"Próxima semana",onclick:()=>o.aoMudar({ini:addDias(o.ini,7)})},"›"),
      h("span",{class:"faixa tnum",text:br(dias[0])+" a "+brA(dias[dias.length-1])}),
      h("select",{id:"g-sem","aria-label":"Semanas exibidas",class:"compacto",onchange:e=>o.aoMudar({semanas:+e.target.value})},
        [1,2,4,6].map(n=>h("option",{value:n,selected:n===o.semanas},n===1?"1 semana":n+" semanas"))),
      h("input",{type:"search",id:"g-dest",class:"compacto",placeholder:"Destacar obra ou cidade",value:o.destaque||"",oninput:e=>o.aoMudar({destaque:e.target.value},true)}),
      o.extraBotoes||null));
  const leg=h("div",{class:"legenda"},LEG.map(([g,t])=>h("span",{},h("i",{class:"g"+g}),t)),
    h("span",{},h("i",{class:"leg-plan"}),"Planejado (borda tracejada)"),
    h("span",{},h("i",{class:"leg-dup"}),"Dois lançamentos no mesmo dia"));
  if(!o.nomes.length)return h("div",{},barra,vazio("Nenhum funcionário ativo","Cadastre a equipe e marque quem aparece na agenda."));
  const cab=h("thead",{},h("tr",{},h("th",{class:"nome",text:"Funcionário"}),
    dias.map(d=>h("th",{class:(d===hj?"hoje ":"")+(dow(d)%6===0?"fds":"")},DOW[dow(d)],h("span",{class:"dn",text:br(d)})))));
  const cont=dias.map(()=>({c:0,b:0,a:0}));
  const linhas=o.nomes.map(nm=>h("tr",{},h("td",{class:"nome",text:nm}),dias.map((d,i)=>{
    const r=resolver(o.idx,nm,d);
    const td=h("td",{class:"cel"+(dow(d)%6===0?" fds":"")+(d===hj?" hojecol":""),tabindex:"0",
      onclick:()=>o.aoClicar(nm,d,r),onkeydown:e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();o.aoClicar(nm,d,r);}}});
    if(r){
      const g=grp(r.it);if(g<=3)cont[i].c++;else if(g===4)cont[i].b++;else if(g>=6&&g<=7)cont[i].a++;
      const txt=rotulo(r.it);
      const acerto=q&&(norm(txt).includes(q)||norm(r.it.cidade).includes(q)||norm(nm).includes(q));
      td.title=nm+" · "+DOWL[dow(d)]+" "+br(d)+"\n"+r.it.tipo+(r.it.obra?" · "+r.it.obra:"")+(r.it.cidade?" · "+r.it.cidade:"")+" · "+(r.it.status||"");
      td.append(h("div",{class:"bloco "+cls(r.it)+(acerto?" acerto":""),text:txt}));
      if(r.n>1)td.append(h("span",{class:"dup",title:"Há "+r.n+" lançamentos neste dia; vale o salvo por último."}));
    }else td.append(h("div",{class:"bloco livre",text:o.editavel?"+":""}));
    return td;
  })));
  const soma=h("tr",{class:"soma"},h("td",{class:"nome",text:"Em campo · base · ausentes"}),
    cont.map((c,i)=>h("td",{},dow(dias[i])%6===0&&!c.c&&!c.b&&!c.a?"":h("span",{},h("b",{text:c.c})," · "+c.b+" · "+c.a))));
  return h("div",{},barra,leg,h("div",{class:"gradebox"+(q?" com-destaque":"")},h("table",{class:"grade"},cab,h("tbody",{},linhas,soma))));
}

/* ---------- onde está a equipe ---------- */
/* o = {nomes, idx, dia, aoMudar(dia)} */
function ondeEsta(o){
  const dia=o.dia||hoje();
  const barra=h("div",{class:"vhead"},h("div",{},h("h2",{text:"Onde está a equipe"}),h("p",{class:"lead",text:(dia===hoje()?"Hoje, ":"")+DOWL[dow(dia)]+", "+brA(dia)})),
    h("div",{class:"toolbar"},
      h("button",{class:"btn small",type:"button","aria-label":"Dia anterior",onclick:()=>o.aoMudar(addDias(dia,-1))},"‹"),
      h("input",{type:"date",id:"o-dia",class:"compacto",value:dia,onchange:e=>{if(ehData(e.target.value))o.aoMudar(e.target.value);}}),
      h("button",{class:"btn small",type:"button","aria-label":"Próximo dia",onclick:()=>o.aoMudar(addDias(dia,1))},"›"),
      h("button",{class:"btn small",type:"button",onclick:()=>o.aoMudar(null)},"Hoje")));
  if(!o.nomes.length)return h("div",{},barra,vazio("Nenhum funcionário ativo",""));
  const k={c:0,b:0,t:0,a:0,s:0},obras=new Map();
  const cartoes=o.nomes.map(nm=>{
    const r=resolver(o.idx,nm,dia),it=r&&r.it,nx=proximo(o.idx,nm,dia,it);
    if(!it)k.s++;else{const g=grp(it);if(g<=3)k.c++;else if(g===4)k.b++;else if(g===5)k.t++;else if(g<=7)k.a++;}
    if(it&&grp(it)<=3){const ch=rotulo(it);if(!obras.has(ch))obras.set(ch,{it,ppl:[]});obras.get(ch).ppl.push(nm);}
    return h("div",{class:"card pessoa"},
      h("div",{class:"nm",text:nm}),
      it?h("div",{class:"act "+cls(it),text:rotulo(it)}):h("div",{class:"act g8",text:"Sem lançamento"}),
      it?h("dl",{class:"kv"},kvs([["Tipo",it.tipo+(it.status==="Planejado"?" (planejado)":"")],["Cidade",it.cidade],["Veículo",it.veiculo],["Até",brA(it.fim)],["Obs.",it.obs]])):null,
      nx?h("div",{class:"prox"},"Próximo: ",h("b",{text:rotulo(nx)})," a partir de "+br(nx.ini)):null);
  });
  const kp=h("div",{class:"kpis agk"},
    h("div",{class:"kpi g1"},h("span",{class:"label",text:"Em campo"}),h("b",{text:k.c})),
    h("div",{class:"kpi g4"},h("span",{class:"label",text:"Na base ECTAS"}),h("b",{text:k.b})),
    h("div",{class:"kpi g5"},h("span",{class:"label",text:"Treinamento / exame"}),h("b",{text:k.t})),
    h("div",{class:"kpi g7"},h("span",{class:"label",text:"Ausentes"}),h("b",{text:k.a})),
    h("div",{class:"kpi g8"},h("span",{class:"label",text:"Sem lançamento"}),h("b",{text:k.s})));
  const por=obras.size?[h("div",{class:"sec",text:"Equipes por obra"}),h("div",{class:"grid"},[...obras.values()].map(x=>h("div",{class:"card porobra"},
    h("span",{class:"pilula "+cls(x.it),text:x.it.tipo}),h("b",{text:rotulo(x.it)}),x.it.cidade?h("span",{class:"mini",text:x.it.cidade}):null,
    h("span",{class:"mini"},h("b",{style:"color:var(--fg)",text:x.ppl.length+" pessoa"+(x.ppl.length>1?"s":"")+": "}),x.ppl.join(", ")))))]:[];
  return h("div",{},barra,kp,por,h("div",{class:"sec",text:"Por funcionário"}),h("div",{class:"grid"},cartoes));
}

/* ---------- minha agenda ---------- */
/* o = {nome, idx} -> hoje em destaque e próximas 6 semanas agrupadas */
function minha(o){
  const t=hoje(),r=resolver(o.idx,o.nome,t);
  const grande=r?h("div",{class:"destaque "+cls(r.it)},h("span",{class:"when",text:"Hoje · "+DOWL[dow(t)]+" "+br(t)+" · "+r.it.tipo+(r.it.status==="Planejado"?" (planejado)":"")}),
      h("span",{class:"what",text:rotulo(r.it)}),
      h("span",{class:"meta",text:[r.it.cidade,r.it.veiculo?"Veículo: "+r.it.veiculo:"","até "+brA(r.it.fim)].filter(Boolean).join(" · ")}),
      r.it.obs?h("span",{class:"meta",text:r.it.obs}):null)
    :h("div",{class:"destaque g8"},h("span",{class:"when",text:"Hoje · "+DOWL[dow(t)]+" "+br(t)}),h("span",{class:"what",text:"Nenhum lançamento para hoje"}),h("span",{class:"meta",text:"Fale com o supervisor se estiver faltando algo."}));
  const blocos=[];let cur=null;
  for(let i=1;i<=42;i++){
    const d=addDias(t,i),rr=resolver(o.idx,o.nome,d);
    if(!rr){if(!(cur&&(dow(d)===6||dow(d)===0)))cur=null;continue;}
    if(cur&&cur.key===rr.it.id&&dif(cur.fim,d)<=3){cur.fim=d;continue;}
    cur={key:rr.it.id,it:rr.it,ini:d,fim:d};blocos.push(cur);
  }
  const lista=blocos.length?h("div",{class:"linha-tempo"},blocos.map(b=>h("div",{class:"lt"},
    h("div",{class:"d tnum"},DOW[dow(b.ini)]+" "+br(b.ini),b.fim!==b.ini?h("div",{text:"até "+DOW[dow(b.fim)]+" "+br(b.fim)}):null),
    h("div",{class:"b "+cls(b.it)},h("span",{class:"t",text:rotulo(b.it)}),
      h("span",{class:"m",text:[b.it.tipo+(b.it.status==="Planejado"?" (planejado)":""),b.it.cidade,b.it.veiculo?"Veículo: "+b.it.veiculo:""].filter(Boolean).join(" · ")}),
      b.it.obs?h("span",{class:"m",text:b.it.obs}):null))))
    :vazio("Nada lançado para as próximas semanas","Quando o supervisor lançar, aparece aqui.");
  return h("div",{},grande,h("div",{class:"sec",text:"Próximas 6 semanas"}),lista);
}

window.AG={TIPOS,GRUPO,COM_OBRA,DOW,DOWL,hoje,addDias,dow,segunda,br,brA,dif,ehData,h,grp,rotulo,cls,norm,kvs,vazio,indexar,resolver,proximo,modal,fechar,detalhe,grade,ondeEsta,minha};
})();
