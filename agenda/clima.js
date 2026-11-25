/* Agenda Técnica ECTAS: previsão do tempo na agenda do supervisor.
   Fonte: Open-Meteo (gratuito, sem cadastro; reúne modelos de institutos como ECMWF e NOAA; até 16 dias).
   A cidade vem do lançamento ou, se vazia, do cadastro da obra. */
(function(){
"use strict";
const {h,hoje,addDias,dow,br,DOWL,norm}=window.AG;
const UF={AC:"Acre",AL:"Alagoas",AP:"Amapá",AM:"Amazonas",BA:"Bahia",CE:"Ceará",DF:"Distrito Federal",ES:"Espírito Santo",GO:"Goiás",MA:"Maranhão",MT:"Mato Grosso",MS:"Mato Grosso do Sul",MG:"Minas Gerais",PA:"Pará",PB:"Paraíba",PR:"Paraná",PE:"Pernambuco",PI:"Piauí",RJ:"Rio de Janeiro",RN:"Rio Grande do Norte",RS:"Rio Grande do Sul",RO:"Rondônia",RR:"Roraima",SC:"Santa Catarina",SP:"São Paulo",SE:"Sergipe",TO:"Tocantins"};
const DIAS_PREV=16,VALIDADE=30*60000;   // a previsão é renovada a cada 30 minutos
const ls={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}};
const geo=ls.get("agd-geo",{});          // cidade -> {lat,lon} ou {nada:true}, guardado no navegador
const prevs=new Map();                     // chave -> {daily,em} | null
let emCurso=null,ultima=0;
const nomes=new Map();                     // chave -> cidade como foi escrita

function partes(c){
  const t=String(c||"").trim();if(!t)return null;
  const m=t.match(/^(.*?)[\s]*[\/,\-][\s]*([A-Za-z]{2})$/);
  return m?{nome:m[1].trim(),uf:m[2].toUpperCase()}:{nome:t,uf:""};
}
const chave=c=>{const p=partes(c);return p?norm(p.nome)+"/"+p.uf:"";};

async function geocodificar(c){
  const k=chave(c);if(geo[k])return geo[k];
  const p=partes(c);
  const r=await (await fetch("https://geocoding-api.open-meteo.com/v1/search?count=10&language=pt&country=BR&name="+encodeURIComponent(p.nome))).json();
  const lista=r.results||[];
  const acha=lista.find(x=>p.uf&&x.admin1===UF[p.uf]&&norm(x.name)===norm(p.nome))||lista.find(x=>p.uf&&x.admin1===UF[p.uf])||(!p.uf?lista[0]:null);
  geo[k]=acha?{lat:acha.latitude,lon:acha.longitude}:{nada:true};
  ls.set("agd-geo",geo);
  return geo[k];
}
/* busca a previsão das cidades que faltam; resolve true se chegou algo novo */
function garantir(cidades){
  const agora=Date.now();
  const falta=[...new Set(cidades.map(chave).filter(Boolean))].filter(k=>{const p=prevs.get(k);return p===undefined||(p&&agora-p.em>(p.falha?5*60000:VALIDADE));});
  if(!falta.length)return Promise.resolve(false);
  if(emCurso)return emCurso.then(()=>garantir(cidades));
  const porChave={};cidades.forEach(c=>{const k=chave(c);if(k){porChave[k]=c;nomes.set(k,c);}});
  emCurso=(async()=>{
    const pontos=[];
    for(const k of falta){try{const g=await geocodificar(porChave[k]);if(g.nada)prevs.set(k,null);else pontos.push({k,g});}catch(e){prevs.set(k,{falha:true,em:Date.now()});}}   // sem internet: tenta de novo em 5 minutos
    for(let i=0;i<pontos.length;i+=40){
      const lote=pontos.slice(i,i+40);
      try{
        const url="https://api.open-meteo.com/v1/forecast?timezone=America%2FSao_Paulo&forecast_days="+DIAS_PREV+
          "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_gusts_10m_max"+
          "&latitude="+lote.map(p=>p.g.lat).join(",")+"&longitude="+lote.map(p=>p.g.lon).join(",");
        const j=await (await fetch(url)).json();const arr=Array.isArray(j)?j:[j];
        lote.forEach((p,n)=>{prevs.set(p.k,arr[n]&&arr[n].daily?{daily:arr[n].daily,em:Date.now()}:{falha:true,em:Date.now()});});
        if(arr.some(x=>x&&x.daily))ultima=Date.now();
      }catch(e){lote.forEach(p=>prevs.set(p.k,{falha:true,em:Date.now()}));}
    }
    return true;
  })().finally(()=>{emCurso=null;});
  return emCurso;
}
/* undefined = ainda não buscada; null = cidade não encontrada ou dia fora da previsão */
function prev(cidade,dia){
  const p=prevs.get(chave(cidade));
  if(p===undefined)return undefined;if(!p||p.falha)return null;
  const i=p.daily.time.indexOf(dia);if(i<0)return null;
  const g=k=>p.daily[k]?p.daily[k][i]:null;
  const c=g("weather_code"),pr=g("precipitation_probability_max");if(c==null&&pr==null)return null;
  const mm=g("precipitation_sum")||0,raj=g("wind_gusts_10m_max");
  const risco=(c>=95||(pr>=70&&mm>=10)||raj>=60)?"alto":pr>=60?"medio":"";
  return {c,tmax:g("temperature_2m_max"),tmin:g("temperature_2m_min"),p:pr==null?0:pr,mm,raj,risco};
}
const naoEncontrada=cidade=>prevs.get(chave(cidade))===null;

/* códigos WMO -> descrição, ícone e rótulo curto */
function cond(c){
  if(c==null)return["Sem dados","nuvem","Sem dados"];
  if(c===0)return["Céu limpo","sol","Sol"];if(c<=2)return["Parcialmente nublado","solnuvem","Sol e nuvens"];if(c===3)return["Nublado","nuvem","Nublado"];
  if(c===45||c===48)return["Neblina","neblina","Neblina"];if(c>=51&&c<=57)return["Garoa","garoa","Garoa"];if(c>=61&&c<=67)return["Chuva","chuva","Chuva"];
  if(c>=80&&c<=82)return["Pancadas de chuva","chuva","Pancadas"];if(c>=95)return["Trovoadas","raio","Trovoada"];return["Tempo instável","nuvem","Instável"];
}
const NUV='<path d="M9 22h15a5.5 5.5 0 0 0 .6-11 7.5 7.5 0 0 0-14.3 1.8A4.6 4.6 0 0 0 9 22z" fill="#C9D3DC" stroke="#8A9AA7" stroke-width="1.2"/>';
const NUVE='<path d="M9 20h15a5.5 5.5 0 0 0 .6-11 7.5 7.5 0 0 0-14.3 1.8A4.6 4.6 0 0 0 9 20z" fill="#7F8F9C" stroke="#5B6873" stroke-width="1.2"/>';
const ICO={
 sol:'<svg viewBox="0 0 32 32" aria-hidden="true"><g stroke="#F2A900" stroke-width="2.4" stroke-linecap="round"><path d="M16 2.5v4M16 25.5v4M2.5 16h4M25.5 16h4M6.4 6.4l2.8 2.8M22.8 22.8l2.8 2.8M6.4 25.6l2.8-2.8M22.8 9.2l2.8-2.8"/></g><circle cx="16" cy="16" r="6.5" fill="#FFC72C" stroke="#F2A900" stroke-width="1.5"/></svg>',
 solnuvem:'<svg viewBox="0 0 32 32" aria-hidden="true"><g stroke="#F2A900" stroke-width="2" stroke-linecap="round"><path d="M11 2.5v3M3 10.5h3M5.3 4.8l2 2M16.7 4.8l-2 2"/></g><circle cx="11" cy="10.5" r="5" fill="#FFC72C" stroke="#F2A900" stroke-width="1.3"/><path d="M9 26h15a5.5 5.5 0 0 0 .6-11 7.5 7.5 0 0 0-14.3 1.8A4.6 4.6 0 0 0 9 26z" fill="#C9D3DC" stroke="#8A9AA7" stroke-width="1.2"/></svg>',
 nuvem:'<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 15h11a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.5 1.3A3.4 3.4 0 0 0 6 15z" fill="#DDE3E8" stroke="#A3B0BB" stroke-width="1"/>'+NUV+'</svg>',
 neblina:'<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M9 18h15a5.5 5.5 0 0 0 .6-11 7.5 7.5 0 0 0-14.3 1.8A4.6 4.6 0 0 0 9 18z" fill="#C9D3DC" stroke="#8A9AA7" stroke-width="1.2"/><g stroke="#8A9AA7" stroke-width="2.2" stroke-linecap="round"><path d="M5 23h22M8 28h16"/></g></svg>',
 garoa:'<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M9 20h15a5.5 5.5 0 0 0 .6-11 7.5 7.5 0 0 0-14.3 1.8A4.6 4.6 0 0 0 9 20z" fill="#B3C0CA" stroke="#8A9AA7" stroke-width="1.2"/><g fill="#2E9BD6"><circle cx="11" cy="25" r="1.6"/><circle cx="17" cy="27" r="1.6"/><circle cx="23" cy="25" r="1.6"/></g></svg>',
 chuva:'<svg viewBox="0 0 32 32" aria-hidden="true">'+NUVE+'<g stroke="#0E7CC2" stroke-width="2.4" stroke-linecap="round"><path d="M10.5 23.5l-1.8 4.5M16.5 23.5l-1.8 4.5M22.5 23.5l-1.8 4.5"/></g></svg>',
 raio:'<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M9 20h15a5.5 5.5 0 0 0 .6-11 7.5 7.5 0 0 0-14.3 1.8A4.6 4.6 0 0 0 9 20z" fill="#56636E" stroke="#5B6873" stroke-width="1.2"/><path d="M17.5 18.5l-4.5 7h4l-2 5.5 7-8.5h-4.2l2.4-4z" fill="#FFC72C" stroke="#E09A00" stroke-width="1" stroke-linejoin="round"/><g stroke="#0E7CC2" stroke-width="2" stroke-linecap="round"><path d="M9.5 23l-1.4 3.5M25 23l-1.4 3.5"/></g></svg>'
};
function icone(k){const s=h("span",{class:"ico"});s.innerHTML=ICO[k]||ICO.nuvem;return s;}
function faixa(pv,aoTocar){
  const [desc,ic,curto]=cond(pv.c);
  const f=h("div",{class:"tempo "+pv.risco,tabindex:"0",role:"button",title:desc+" · "+Math.round(pv.tmin)+"° a "+Math.round(pv.tmax)+"° · "+pv.p+"% de chance · "+pv.mm+" mm",
    "aria-label":desc+", máxima de "+Math.round(pv.tmax)+" graus, "+pv.p+"% de chance de chuva",
    onclick:e=>{e.stopPropagation();aoTocar();},onkeydown:e=>{if(e.key==="Enter"){e.preventDefault();e.stopPropagation();aoTocar();}}},
    icone(ic),h("span",{class:"tx"},h("b",{text:curto}),h("span",{},Math.round(pv.tmax)+"° · ",h("span",{class:"p",text:pv.p+"%"}))));
  return f;
}
function legenda(){return h("div",{class:"legtempo"},[["sol","Sol"],["solnuvem","Sol e nuvens"],["nuvem","Nublado"],["neblina","Neblina"],["garoa","Garoa"],["chuva","Chuva / pancadas"],["raio","Trovoada"]].map(([k,t])=>h("span",{},icone(k),t)),
  h("span",{},h("i",{class:"q-alto"}),"Risco alto"),h("span",{},h("i",{class:"q-medio"}),"Atenção"));}
function detalhe(obra,cidade,dia,pv,equipe){
  const [desc,ic]=cond(pv.c),corpo=h("div",{class:"body"});
  corpo.append(h("p",{class:"full mini",style:"margin:0",text:cidade}),
    h("div",{class:"full climagrande"},icone(ic),h("div",{},h("b",{text:Math.round(pv.tmax)+"°"}),h("div",{class:"mini",text:desc+" · mínima "+Math.round(pv.tmin)+"°"}))),
    h("dl",{class:"kv full"},h("dt",{text:"Chance de chuva"}),h("dd",{text:pv.p+"%"}),h("dt",{text:"Chuva prevista"}),h("dd",{text:(pv.mm||0).toLocaleString("pt-BR")+" mm"}),
      h("dt",{text:"Rajadas de vento"}),h("dd",{text:pv.raj!=null?Math.round(pv.raj)+" km/h":"sem dado"}),h("dt",{text:"Equipe"}),h("dd",{text:equipe.join(", ")})),
    pv.risco?h("p",{class:"full aviso",style:"margin:0",text:pv.risco==="alto"?"Risco alto para trabalho externo":"Atenção: chance de chuva"}):null,
    h("p",{class:"full mini",style:"margin:0",text:"Previsão Open-Meteo, atualizada a cada hora."}));
  window.AG.modal(obra+" · "+DOWL[dow(dia)]+" "+br(dia),corpo,[h("span",{class:"spacer"}),h("button",{class:"btn primary",type:"button",onclick:window.AG.fechar},"Fechar")]);
}
/* busca de novo a previsão de todas as cidades já usadas (chamada pelo painel a cada 30 minutos) */
function renovar(forcar){
  if(!nomes.size)return Promise.resolve(false);
  if(forcar)prevs.forEach(p=>{if(p)p.em=0;});
  return garantir([...nomes.values()]);
}
const vencida=()=>!ultima||Date.now()-ultima>VALIDADE;
window.CLIMA={renovar,vencida,atualizadaEm:()=>ultima,VALIDADE,garantir,prev,naoEncontrada,cond,faixa,legenda,detalhe,icone,DIAS_PREV};
})();
