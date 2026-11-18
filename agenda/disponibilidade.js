/* Agenda Técnica ECTAS: disponibilidade técnica para outras áreas (vendas, comercial, planejamento).
   Usado pelo painel do supervisor (arquivo PDF/Excel e link de consulta) e pela página pública de consulta. */
(function(){
"use strict";
const A=window.AG;
const {h,addDias,dow,br,brA,hoje,resolver,grp,DOW}=A;
const BASE=new URL("./",document.currentScript.src);   // pasta agenda/
const LIB=new URL("../lib/",BASE);

/* situação de um técnico num dia, do ponto de vista de quem quer vender ou agendar */
function situacao(idx,nome,dia,mostrarObra){
  const r=resolver(idx,nome,dia);
  if(!r)return {c:"livre",t:"Livre",plan:false};
  const it=r.it,g=grp(it),plan=it.status==="Planejado",cid=it.cidade?" · "+it.cidade:"";
  let c,t;
  if(g<=3){c="campo";t=(mostrarObra&&it.obra?it.obra:"Ocupado")+cid;}
  else if(g===4){c="livre";t="Livre (na base)";}
  else if(g===5){c="cap";t="Ocupado ("+it.tipo.toLowerCase()+")";}
  else if(g<=7){c="aus";t=it.tipo==="Feriado"?"Feriado":"Indisponível";}
  else{c="res";t="Reservado";}
  if(plan&&c!=="livre")t="Previsto: "+t;
  return {c,t,plan:plan&&c!=="livre"};
}
const ROTULO={livre:"Livre",campo:"Em campo (obra, assistência, manutenção)",cap:"Treinamento, reunião ou exame",aus:"Indisponível (folga, férias, ausência)",res:"Reservado (a definir)"};
const fds=d=>dow(d)===0||dow(d)===6;
function montar(o){ // o={idx,nomes,ini,dias,obra}
  const dias=[];for(let i=0;i<o.dias;i++)dias.push(addDias(o.ini,i));
  const linhas=o.nomes.map(n=>({nome:n,cel:dias.map(d=>situacao(o.idx,n,d,o.obra))}));
  const livres=dias.map((d,i)=>fds(d)?null:linhas.filter(l=>l.cel[i].c==="livre").length);
  return {dias,linhas,livres};
}

/* ---------- tabela na tela ---------- */
function tabela(o){
  const M=montar(o),hj=hoje();
  const cab=h("thead",{},h("tr",{},h("th",{class:"nome",text:"Técnico"}),M.dias.map(d=>h("th",{class:(d===hj?"hoje ":"")+(fds(d)?"fds":"")},DOW[dow(d)],h("span",{class:"dn",text:br(d)})))));
  const corpo=h("tbody",{},
    h("tr",{class:"livres"},h("td",{class:"nome",text:"Técnicos livres"}),M.livres.map((n,i)=>h("td",{class:"num"+(n===0?" zero":"")},n==null?"":h("b",{text:n})," "+(n==null?"":"de "+M.linhas.length)))),
    M.linhas.map(l=>h("tr",{},h("td",{class:"nome",text:l.nome}),l.cel.map((s,i)=>h("td",{class:"cel"+(fds(M.dias[i])?" fds":"")},h("div",{class:"disp d-"+s.c+(s.plan?" plan":""),text:s.c==="livre"&&fds(M.dias[i])?"":s.t}))))));
  return h("div",{class:"gradebox"},h("table",{class:"grade dispgrade"},cab,corpo));
}
function legenda(){return h("div",{class:"legenda"},Object.keys(ROTULO).map(k=>h("span",{},h("i",{class:"d-"+k}),ROTULO[k])),h("span",{},h("i",{class:"leg-plan"}),"Previsto (ainda não confirmado)"));}

/* ---------- bibliotecas (as mesmas do Diário de Obra) ---------- */
const libs={};
function lib(nome){return libs[nome]||(libs[nome]=new Promise((ok,erro)=>{const s=document.createElement("script");s.src=new URL(nome,LIB).href;s.onload=ok;s.onerror=()=>{delete libs[nome];erro(new Error("Não consegui carregar o gerador de arquivos. Verifique a internet."));};document.head.append(s);}));}
const nomeArq=(o,ext)=>"disponibilidade-tecnica-"+o.ini+"-a-"+addDias(o.ini,o.dias-1)+"."+ext;

/* ---------- PDF (A4 deitado, duas semanas por página) ---------- */
const COR={livre:[227,243,234],campo:[0,115,168],cap:[242,181,48],aus:[174,184,193],res:[233,238,242]};
const TXT={livre:[30,127,79],campo:[255,255,255],cap:[20,33,43],aus:[20,33,43],res:[91,104,115]};
const clara=c=>c.map(v=>Math.round(v+(255-v)*.72));
async function pdf(o){
  await lib("jspdf.umd.min.js");
  const {jsPDF}=window.jspdf,doc=new jsPDF({orientation:"landscape",unit:"mm",format:"a4"});
  const M=montar(o),W=297,ML=10,NW=38,porPag=14,RH=9.5,gerado=new Date().toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
  for(let b=0;b<M.dias.length;b+=porPag){
    if(b)doc.addPage();
    const dias=M.dias.slice(b,b+porPag),CW=(W-2*ML-NW)/porPag;
    doc.setFillColor(0,43,73);doc.rect(0,0,W,18,"F");
    doc.setTextColor(255,255,255);doc.setFont("helvetica","bold");doc.setFontSize(14);doc.text("Disponibilidade técnica · ECTAS",ML,11.5);
    doc.setFont("helvetica","normal");doc.setFontSize(9);doc.text("Equipe externa · "+brA(dias[0])+" a "+brA(dias[dias.length-1]),W-ML,8.5,{align:"right"});
    doc.text("Gerado em "+gerado,W-ML,13.5,{align:"right"});
    let y=24;
    doc.setFontSize(7.5);doc.setTextColor(91,104,115);doc.setFont("helvetica","bold");doc.text("TÉCNICO",ML+1,y+5);
    dias.forEach((d,i)=>{const x=ML+NW+i*CW;if(fds(d)){doc.setFillColor(231,236,241);doc.rect(x,y,CW,8,"F");}
      doc.setTextColor(91,104,115);doc.setFont("helvetica","bold");doc.text(DOW[dow(d)],x+CW/2,y+3.3,{align:"center"});doc.setTextColor(20,33,43);doc.text(br(d),x+CW/2,y+7,{align:"center"});});
    y+=9;
    // linha de técnicos livres
    doc.setFillColor(233,238,242);doc.rect(ML,y,W-2*ML,7,"F");doc.setTextColor(20,33,43);doc.setFont("helvetica","bold");doc.setFontSize(8);doc.text("Técnicos livres",ML+1,y+4.7);
    dias.forEach((d,i)=>{const n=M.livres[b+i];if(n==null)return;const x=ML+NW+i*CW;doc.setTextColor(n===0?192:30,n===0?57:127,n===0?43:79);doc.text(n+" de "+M.linhas.length,x+CW/2,y+4.7,{align:"center"});});
    y+=8;
    for(const l of M.linhas){
      if(y+RH>196){doc.addPage();y=14;}
      doc.setDrawColor(213,221,227);doc.line(ML,y+RH,W-ML,y+RH);
      doc.setTextColor(20,33,43);doc.setFont("helvetica","bold");doc.setFontSize(8);doc.text(doc.splitTextToSize(l.nome,NW-2)[0],ML+1,y+RH/2+1.2);
      dias.forEach((d,i)=>{
        const s=l.cel[b+i],x=ML+NW+i*CW;if(fds(d)&&s.c==="livre")return;
        const cor=s.plan?clara(COR[s.c]):COR[s.c];doc.setFillColor(...cor);doc.roundedRect(x+.4,y+.5,CW-.8,RH-1,1,1,"F");
        doc.setTextColor(...(s.plan?[20,33,43]:TXT[s.c]));doc.setFont("helvetica",s.plan?"italic":"bold");doc.setFontSize(5.6);
        const ls=doc.splitTextToSize(s.t,CW-1.6).slice(0,3);doc.text(ls,x+CW/2,y+RH/2-(ls.length-1)*1.1+.8,{align:"center"});
      });
      y+=RH;
    }
    // legenda
    y=Math.min(y+6,200);let x=ML;doc.setFontSize(7);
    for(const k of Object.keys(ROTULO)){doc.setFillColor(...COR[k]);doc.rect(x,y-2.6,3.2,3.2,"F");doc.setTextColor(91,104,115);doc.setFont("helvetica","normal");doc.text(ROTULO[k],x+4.5,y);x+=doc.getTextWidth(ROTULO[k])+10;}
    doc.text("Previsto = ainda não confirmado (cor clara)",x,y);
  }
  doc.save(nomeArq(o,"pdf"));
}

/* ---------- Excel ---------- */
async function excel(o){
  await lib("xlsx.full.min.js");
  const M=montar(o),X=window.XLSX;
  const cab=["Técnico"].concat(M.dias.map(d=>DOW[dow(d)]+" "+br(d)));
  const linhas=[["Disponibilidade técnica · ECTAS · "+brA(M.dias[0])+" a "+brA(M.dias[M.dias.length-1])],[],cab,
    ["Técnicos livres"].concat(M.livres.map(n=>n==null?"":n+" de "+M.linhas.length))]
    .concat(M.linhas.map(l=>[l.nome].concat(l.cel.map((s,i)=>s.c==="livre"&&fds(M.dias[i])?"":s.t))));
  linhas.push([],["Legenda: Livre = sem compromisso ou na base; Previsto = ainda não confirmado; Indisponível = folga, férias ou ausência."]);
  const ws=X.utils.aoa_to_sheet(linhas);ws["!cols"]=[{wch:18}].concat(M.dias.map(()=>({wch:22})));ws["!freeze"]={xSplit:1,ySplit:3};
  const res=[["Data","Dia","Técnicos livres","Técnicos na equipe"]].concat(M.dias.map((d,i)=>[brA(d),DOW[dow(d)],M.livres[i]==null?"fim de semana":M.livres[i],M.linhas.length]));
  const ws2=X.utils.aoa_to_sheet(res);ws2["!cols"]=[{wch:12},{wch:6},{wch:16},{wch:18}];
  const wb=X.utils.book_new();X.utils.book_append_sheet(wb,ws,"Disponibilidade");X.utils.book_append_sheet(wb,ws2,"Livres por dia");
  X.writeFile(wb,nomeArq(o,"xlsx"));
}

window.DISP={situacao,montar,tabela,legenda,pdf,excel,linkConsulta:k=>new URL("disponibilidade.html?k="+encodeURIComponent(k),BASE).href};
})();
