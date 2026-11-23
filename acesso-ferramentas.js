/* Botão "Controle de Ferramentas" na barra dos apps do técnico: só aparece para quem o supervisor
   cadastrou em algum kit. A central do Controle de Ferramentas confere com o login do Diário de Obra. */
(()=>{
  const CENTRAL="https://script.google.com/macros/s/AKfycbyWTkngm991Ep8tREoi1Oo9iDyrAxIgb-LLcAwhOqqUnNDsGLU4uoQy_SfIoOKLTiYIkw/exec";
  const CHAVE="ectas-ferramentas-campo-2026";
  const ler=k=>{try{return localStorage.getItem(k);}catch(e){return null;}};
  const gravar=(k,v)=>{try{localStorage.setItem(k,v);}catch(e){}};
  const links=()=>[...document.querySelectorAll(".troca-app a")].filter(a=>/(^|\/)ferramentas\/$/.test(a.getAttribute("href")||"")&&a.getAttribute("aria-current")!=="page");
  const sessao=()=>{try{const s=JSON.parse(ler("sessao")||"null");return s&&s.token?s:null;}catch(e){return null;}};
  // sem login do Diário: esconde; com login: usa o último resultado conhecido (do mesmo usuário) até a central responder
  function aplicar(){
    const s=sessao(),v=ler("fer-liberado"),u=ler("fer-liberado-usuario");
    const mostrar=!!s&&v==="1"&&u===s.usuario;
    links().forEach(a=>{a.hidden=!mostrar;});
  }
  let ultimo="",emCurso=false;
  async function conferir(forcar){
    const s=sessao();aplicar();
    if(!s||!navigator.onLine||emCurso)return;
    if(!forcar&&ultimo===s.token)return;
    emCurso=true;
    try{
      const r=await fetch(CENTRAL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({acao:"acesso",chave:CHAVE,tokenDiario:s.token})}).then(x=>x.json());
      if(r.ok){gravar("fer-liberado",r.liberado?"1":"0");gravar("fer-liberado-usuario",s.usuario);ultimo=s.token;}
      else if(r.erro==="sessao_diario"){gravar("fer-liberado","0");ultimo=s.token;}
    }catch(e){}
    emCurso=false;aplicar();
  }
  aplicar();
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>conferir(true));else conferir(true);
  // depois de entrar ou trocar de usuário no app, confere de novo
  setInterval(()=>{const s=sessao();if(!s||s.token!==ultimo)conferir(false);else aplicar();},5000);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")conferir(true);});
})();
