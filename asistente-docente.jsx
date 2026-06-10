import { useState } from "react";

const NIVELES = ["Primaria","Sec. básica","Sec. superior","Terciario"];

const MODULES = [
  { id:"recursos",      icon:"🌿", label:"Recursos"      },
  { id:"planificacion", icon:"📅", label:"Planificación" },
  { id:"evaluacion",    icon:"🎯", label:"Evaluación"    },
  { id:"curriculo",     icon:"📚", label:"Currículo"     },
];

const TIPOS_REC = [
  {id:"actividad",label:"Actividad",icon:"✏️"},
  {id:"consigna",label:"Consigna",icon:"📋"},
  {id:"texto",label:"Texto didáctico",icon:"📖"},
  {id:"evaluacion",label:"Evaluación",icon:"🎯"},
  {id:"experimento",label:"Experimento",icon:"🔬"},
  {id:"debate",label:"Debate",icon:"💬"},
];
const DURACIONES = ["1 clase","2 clases","1 semana","2 semanas","1 mes"];
const TIPOS_EVAL = [
  {id:"rubrica",label:"Rúbrica",icon:"📊"},
  {id:"examen",label:"Examen",icon:"📝"},
  {id:"auto",label:"Autoevaluación",icon:"🪞"},
  {id:"cotejo",label:"Lista de cotejo",icon:"☑️"},
  {id:"oral",label:"Evaluación oral",icon:"🗣️"},
];
const ACCIONES_CUR = [
  {id:"mapa",label:"Mapa de contenidos"},
  {id:"secuencia",label:"Secuencia anual"},
  {id:"transversal",label:"Ejes transversales"},
  {id:"consulta",label:"Consulta libre"},
];

// ── utils ──────────────────────────────────────────────────────────────────
async function callClaude(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:prompt}]})
  });
  const d = await res.json();
  return d.content?.map(b=>b.text||"").join("\n")||"";
}

function md(text) {
  return text.split("\n").map((line,i)=>{
    if(line.startsWith("## "))  return <h2 key={i} style={{color:"#1a3a2a",fontSize:"1rem",fontWeight:700,margin:"0.7rem 0 0.2rem"}}>{line.slice(3)}</h2>;
    if(line.startsWith("# "))   return <h1 key={i} style={{color:"#1a3a2a",fontSize:"1.1rem",fontWeight:700,margin:"0.5rem 0 0.2rem"}}>{line.slice(2)}</h1>;
    if(line.startsWith("### ")) return <h3 key={i} style={{color:"#2d5a40",fontSize:"0.9rem",fontWeight:700,margin:"0.5rem 0 0.1rem"}}>{line.slice(4)}</h3>;
    if(line.startsWith("- ")||line.startsWith("• ")){
      const html=line.slice(2).replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>");
      return <li key={i} style={{marginBottom:"0.2rem"}} dangerouslySetInnerHTML={{__html:html}}/>;
    }
    if(/^\d+\./.test(line)){
      const html=line.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>");
      return <li key={i} style={{marginBottom:"0.2rem",listStyleType:"decimal"}} dangerouslySetInnerHTML={{__html:html}}/>;
    }
    if(!line.trim()) return <br key={i}/>;
    const html=line.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\*(.*?)\*/g,"<em>$1</em>");
    return <p key={i} style={{margin:"0.12rem 0",lineHeight:1.6}} dangerouslySetInnerHTML={{__html:html}}/>;
  });
}

// ── shared UI ──────────────────────────────────────────────────────────────
const inp = {width:"100%",boxSizing:"border-box",padding:"0.55rem 0.75rem",background:"#243d30",border:"1.5px solid #2d5a40",borderRadius:"8px",color:"#fff",fontSize:"0.82rem",outline:"none"};
function SI({v,set,ph,ta=false,rows=2}){
  const Tag=ta?"textarea":"input";
  return <Tag value={v} onChange={e=>set(e.target.value)} placeholder={ph} rows={ta?rows:undefined}
    style={{...inp,...(ta?{resize:"none",fontFamily:"inherit"}:{})}}
    onFocus={e=>e.target.style.borderColor="#4a9e6b"}
    onBlur={e=>e.target.style.borderColor="#2d5a40"}/>;
}
function Label({t,opt}){return(
  <label style={{display:"block",color:"#a8c5b5",fontSize:"0.68rem",fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"0.35rem"}}>
    {t}{opt&&<span style={{color:"#4a6b57",fontWeight:400}}> (opcional)</span>}
  </label>
);}
function F({t,opt,children}){return <div style={{marginBottom:"0.9rem"}}><Label t={t} opt={opt}/>{children}</div>;}
function Chips({opts,val,set}){return(
  <div style={{display:"flex",flexWrap:"wrap",gap:"0.35rem"}}>
    {opts.map(o=>{const id=o.id||o,lb=o.label||o,sel=val===id;return(
      <button key={id} onClick={()=>set(id)} style={{padding:"0.3rem 0.65rem",borderRadius:"20px",border:"1.5px solid",cursor:"pointer",fontSize:"0.75rem",
        borderColor:sel?"#4a9e6b":"#2d5a40",background:sel?"#4a9e6b":"transparent",color:sel?"#fff":"#a8c5b5",fontWeight:sel?600:400,transition:"all 0.15s"}}>
        {o.icon?`${o.icon} ${lb}`:lb}
      </button>
    );})}
  </div>
);}
function Btn({onClick,disabled,loading}){return(
  <button onClick={onClick} disabled={disabled||loading} style={{
    width:"100%",padding:"0.7rem",borderRadius:"10px",border:"none",marginTop:"0.5rem",
    cursor:disabled||loading?"not-allowed":"pointer",
    background:disabled||loading?"#2d5a40":"#4a9e6b",
    color:disabled||loading?"#4a6b57":"#fff",fontSize:"0.88rem",fontWeight:600,transition:"all 0.2s"}}>
    {loading?"✨ Generando...":"✨ Generar"}
  </button>
);}

// ── result pane ────────────────────────────────────────────────────────────
function Result({res,loading,error,badge,onCopy,onNew,copied}){
  if(loading) return(
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:"0.8rem",background:"#fafcfb"}}>
      <div style={{fontSize:"2rem",animation:"spin 1.4s linear infinite"}}>🌿</div>
      <p style={{color:"#2d5a40",fontWeight:500,margin:0,fontSize:"0.9rem"}}>Generando...</p>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if(error) return <div style={{margin:"1.5rem",background:"#fff0f0",border:"1px solid #ffb3b3",borderRadius:"10px",padding:"1rem",color:"#c0392b",fontSize:"0.88rem"}}>{error}</div>;
  if(!res) return(
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"#7aaa90",padding:"2rem",textAlign:"center",background:"#fafcfb"}}>
      <div style={{fontSize:"2.5rem",marginBottom:"0.8rem",opacity:0.25}}>🌿</div>
      <p style={{fontSize:"0.92rem",fontWeight:500,color:"#4a9e6b",margin:0}}>Completá el formulario y generá tu material</p>
      <p style={{fontSize:"0.78rem",color:"#9ab8a5",marginTop:"0.35rem"}}>El resultado aparecerá aquí</p>
    </div>
  );
  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{background:"#fff",borderBottom:"1px solid #ddeee4",padding:"0.65rem 1.25rem",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
        <span style={{color:"#2d5a40",fontSize:"0.78rem",fontWeight:600}}>{badge}</span>
        <div style={{display:"flex",gap:"0.4rem"}}>
          <button onClick={onCopy} style={{padding:"0.3rem 0.7rem",borderRadius:"7px",border:"1.5px solid",borderColor:copied?"#4a9e6b":"#c8dfd0",background:copied?"#4a9e6b":"#fff",color:copied?"#fff":"#2d5a40",fontSize:"0.75rem",cursor:"pointer"}}>{copied?"✓ Copiado":"Copiar"}</button>
          <button onClick={onNew} style={{padding:"0.3rem 0.7rem",borderRadius:"7px",border:"1.5px solid #c8dfd0",background:"#fff",color:"#2d5a40",fontSize:"0.75rem",cursor:"pointer"}}>Nuevo</button>
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"1.25rem 1.5rem",color:"#2a3a30",fontSize:"0.86rem",lineHeight:1.65,background:"#fff"}}>
        <ul style={{paddingLeft:"1.1rem",margin:0}}>{md(res)}</ul>
      </div>
    </div>
  );
}

// ── useGen hook ────────────────────────────────────────────────────────────
function useGen(){
  const [res,setRes]=useState(""); const [loading,setLoading]=useState(false);
  const [copied,setCopied]=useState(false); const [error,setError]=useState("");
  const run=async(prompt)=>{
    setLoading(true);setRes("");setError("");setCopied(false);
    try{setRes(await callClaude(prompt));}catch{setError("Error al generar. Intentá de nuevo.");}
    setLoading(false);
  };
  const copy=()=>{navigator.clipboard.writeText(res);setCopied(true);setTimeout(()=>setCopied(false),2000);};
  const clear=()=>{setRes("");setError("");};
  return {res,loading,copied,error,run,copy,clear};
}

// ── MÓDULO RECURSOS ────────────────────────────────────────────────────────
function Recursos(){
  const [tema,setTema]=useState(""); const [nivel,setNivel]=useState("");
  const [tipo,setTipo]=useState(""); const [obj,setObj]=useState("");
  const {res,loading,copied,error,run,copy,clear}=useGen();
  const can=tema.trim()&&nivel&&tipo;
  const gen=()=>run(`Eres experto en didáctica. Generá un recurso educativo completo en español.
Tipo: ${TIPOS_REC.find(t=>t.id===tipo)?.label} | Tema: ${tema} | Nivel: ${nivel}${obj?` | Objetivo: ${obj}`:""}
Redactalo listo para usar, con instrucciones claras, tiempo estimado si aplica. Usá markdown (##, listas, negritas). Solo el recurso, sin meta-comentarios.`);
  const reset=()=>{setTema("");setNivel("");setTipo("");setObj("");clear();};
  const t=TIPOS_REC.find(x=>x.id===tipo);
  return{form:(
    <div style={{padding:"1.25rem",overflowY:"auto"}}>
      <F t="Tema"><SI v={tema} set={setTema} ph="Ej: Fotosíntesis, Mitosis..."/></F>
      <F t="Nivel"><Chips opts={NIVELES} val={nivel} set={setNivel}/></F>
      <F t="Tipo de recurso"><Chips opts={TIPOS_REC} val={tipo} set={setTipo}/></F>
      <F t="Objetivo" opt><SI v={obj} set={setObj} ph="Que los estudiantes comprendan..." ta rows={2}/></F>
      <Btn onClick={gen} disabled={!can} loading={loading}/>
    </div>
  ),result:<Result res={res} loading={loading} error={error} copied={copied} onCopy={copy} onNew={reset}
    badge={`${t?.icon||""} ${t?.label||""} · ${nivel} · ${tema}`}/>};
}

// ── MÓDULO PLANIFICACIÓN ───────────────────────────────────────────────────
function Planificacion(){
  const [tema,setTema]=useState(""); const [nivel,setNivel]=useState("");
  const [dur,setDur]=useState(""); const [obj,setObj]=useState("");
  const {res,loading,copied,error,run,copy,clear}=useGen();
  const can=tema.trim()&&nivel&&dur;
  const gen=()=>run(`Eres experto en planificación didáctica. Generá una planificación escolar completa en español.
Tema: ${tema} | Nivel: ${nivel} | Duración: ${dur}${obj?` | Objetivos: ${obj}`:""}
Incluí: propósitos, contenidos, actividades de apertura/desarrollo/cierre, recursos y evaluación. Usá markdown estructurado. Solo la planificación, sin comentarios extra.`);
  const reset=()=>{setTema("");setNivel("");setDur("");setObj("");clear();};
  return{form:(
    <div style={{padding:"1.25rem",overflowY:"auto"}}>
      <F t="Tema o unidad"><SI v={tema} set={setTema} ph="Ej: Sistema digestivo, Revolución Francesa..."/></F>
      <F t="Nivel"><Chips opts={NIVELES} val={nivel} set={setNivel}/></F>
      <F t="Duración"><Chips opts={DURACIONES} val={dur} set={setDur}/></F>
      <F t="Objetivos" opt><SI v={obj} set={setObj} ph="Que los alumnos logren..." ta rows={2}/></F>
      <Btn onClick={gen} disabled={!can} loading={loading}/>
    </div>
  ),result:<Result res={res} loading={loading} error={error} copied={copied} onCopy={copy} onNew={reset}
    badge={`📅 Planificación · ${nivel} · ${tema} · ${dur}`}/>};
}

// ── MÓDULO EVALUACIÓN ──────────────────────────────────────────────────────
function Evaluacion(){
  const [tema,setTema]=useState(""); const [nivel,setNivel]=useState("");
  const [tipo,setTipo]=useState(""); const [crit,setCrit]=useState("");
  const {res,loading,copied,error,run,copy,clear}=useGen();
  const can=tema.trim()&&nivel&&tipo;
  const gen=()=>run(`Eres experto en evaluación educativa. Generá un instrumento de evaluación completo en español.
Tipo: ${TIPOS_EVAL.find(t=>t.id===tipo)?.label} | Tema: ${tema} | Nivel: ${nivel}${crit?` | Criterios: ${crit}`:""}
Incluí instrucciones para docente y alumnos. Si es rúbrica usá tabla markdown. Si es examen numerá las consignas. Solo el instrumento, sin comentarios.`);
  const reset=()=>{setTema("");setNivel("");setTipo("");setCrit("");clear();};
  const t=TIPOS_EVAL.find(x=>x.id===tipo);
  return{form:(
    <div style={{padding:"1.25rem",overflowY:"auto"}}>
      <F t="Tema evaluado"><SI v={tema} set={setTema} ph="Ej: Célula, Ecuaciones..."/></F>
      <F t="Nivel"><Chips opts={NIVELES} val={nivel} set={setNivel}/></F>
      <F t="Instrumento"><Chips opts={TIPOS_EVAL} val={tipo} set={setTipo}/></F>
      <F t="Criterios clave" opt><SI v={crit} set={setCrit} ph="Comprensión, aplicación práctica..." ta rows={2}/></F>
      <Btn onClick={gen} disabled={!can} loading={loading}/>
    </div>
  ),result:<Result res={res} loading={loading} error={error} copied={copied} onCopy={copy} onNew={reset}
    badge={`${t?.icon||""} ${t?.label||""} · ${nivel} · ${tema}`}/>};
}

// ── MÓDULO CURRÍCULO ───────────────────────────────────────────────────────
function Curriculo(){
  const [nivel,setNivel]=useState(""); const [accion,setAccion]=useState("");
  const [materia,setMateria]=useState(""); const [consulta,setConsulta]=useState("");
  const {res,loading,copied,error,run,copy,clear}=useGen();
  const can=nivel&&accion&&(accion==="consulta"?consulta.trim():materia.trim());
  const gen=()=>run(`Eres experto en diseño curricular y normativa educativa argentina. Respondé en español.
Acción: ${ACCIONES_CUR.find(a=>a.id===accion)?.label} | Nivel: ${nivel} | ${accion==="consulta"?`Consulta: ${consulta}`:`Materia: ${materia}`}
Organizá la respuesta con claridad usando markdown. Si es mapa o secuencia, estructuralo por bloques o bimestres. Solo el contenido solicitado.`);
  const reset=()=>{setNivel("");setAccion("");setMateria("");setConsulta("");clear();};
  const a=ACCIONES_CUR.find(x=>x.id===accion);
  return{form:(
    <div style={{padding:"1.25rem",overflowY:"auto"}}>
      <F t="Nivel"><Chips opts={NIVELES} val={nivel} set={setNivel}/></F>
      <F t="Qué necesitás"><Chips opts={ACCIONES_CUR} val={accion} set={setAccion}/></F>
      {accion&&accion!=="consulta"&&<F t="Materia o área"><SI v={materia} set={setMateria} ph="Ej: Biología, Lengua..."/></F>}
      {accion==="consulta"&&<F t="Tu consulta"><SI v={consulta} set={setConsulta} ph="Ej: ¿Cómo relaciono Biología con Química en 3° año?" ta rows={3}/></F>}
      <Btn onClick={gen} disabled={!can} loading={loading}/>
    </div>
  ),result:<Result res={res} loading={loading} error={error} copied={copied} onCopy={copy} onNew={reset}
    badge={`📚 ${a?.label||""} · ${nivel}${materia?` · ${materia}`:""}`}/>};
}

// ── APP ────────────────────────────────────────────────────────────────────
const PANEL_FN = { recursos:Recursos, planificacion:Planificacion, evaluacion:Evaluacion, curriculo:Curriculo };

export default function App(){
  const [modId,setModId]=useState("recursos");
  const mod=MODULES.find(m=>m.id===modId);
  const {form,result}=PANEL_FN[modId]();

  return(
    <div style={{display:"flex",height:"100vh",fontFamily:"'DM Sans',sans-serif",overflow:"hidden"}}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet"/>

      {/* Sidebar */}
      <div style={{width:"200px",flexShrink:0,background:"#1a3a2a",display:"flex",flexDirection:"column",padding:"1.25rem 0.85rem"}}>
        <div style={{marginBottom:"1.25rem",paddingLeft:"0.4rem"}}>
          <div style={{color:"#4a9e6b",fontSize:"0.62rem",fontWeight:600,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:"0.25rem"}}>🌿 Asistente Docente</div>
          <div style={{color:"#fff",fontFamily:"'Playfair Display',serif",fontSize:"1rem",fontWeight:700,lineHeight:1.25}}>Generador de Materiales</div>
        </div>
        {MODULES.map(m=>(
          <button key={m.id} onClick={()=>setModId(m.id)} style={{
            display:"flex",alignItems:"center",gap:"0.55rem",width:"100%",padding:"0.6rem 0.7rem",marginBottom:"0.25rem",
            borderRadius:"9px",border:"none",cursor:"pointer",textAlign:"left",
            background:modId===m.id?"#243d30":"transparent",transition:"background 0.15s"}}>
            <span style={{fontSize:"1rem"}}>{m.icon}</span>
            <span style={{color:modId===m.id?"#fff":"#7aaa90",fontSize:"0.82rem",fontWeight:modId===m.id?600:400}}>{m.label}</span>
          </button>
        ))}
        <div style={{marginTop:"auto",paddingLeft:"0.4rem",borderTop:"1px solid #243d30",paddingTop:"0.85rem"}}>
          <p style={{color:"#3d5e4a",fontSize:"0.68rem",margin:0,lineHeight:1.5}}>Powered by Claude</p>
        </div>
      </div>

      {/* Form pane */}
      <div style={{width:"280px",flexShrink:0,background:"#1a3a2a",borderLeft:"1px solid #243d30",display:"flex",flexDirection:"column",overflowY:"auto"}}>
        {/* Module header */}
        <div style={{padding:"0.85rem 1.25rem",borderBottom:"1px solid #243d30",flexShrink:0}}>
          <span style={{color:"#fff",fontWeight:700,fontSize:"0.88rem"}}>{mod.icon} {mod.label}</span>
        </div>
        {form}
      </div>

      {/* Result pane */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:"#fafcfb"}}>
        {result}
      </div>
    </div>
  );
}
