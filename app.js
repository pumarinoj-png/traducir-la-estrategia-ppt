(function(){
"use strict";

/* ---------- Estado ---------- */
const emptyState = () => ({
  stage:1, busy:null, err:null,
  prioridad:"", q:{resultado:"",importa:"",problema:""},
  fb1:null, fb1Done:false,
  ppt:{prioridad:"",empresa:"",clientes:"",resultados:"",area:"",decisiones:"",conductas:""},
  fb2:null,
  caso:null, tests:{comp:null,dec:null,hard:null}, notes:{comp:"",dec:"",hard:""},
  ev:null
});
let S = emptyState();

/* ---------- Utilidades ---------- */
const $ = s => document.querySelector(s);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const getPath = (o,p) => p.split(".").reduce((a,k)=>a?.[k],o);
const setPath = (o,p,v) => { const ks=p.split("."); const last=ks.pop(); ks.reduce((a,k)=>a[k],o)[last]=v; };
const list = a => Array.isArray(a) && a.length ? `<ul>${a.map(x=>`<li>${esc(typeof x==="string"?x:JSON.stringify(x))}</li>`).join("")}</ul>` : `<p class="muted">—</p>`;

async function ai(prompt){
  let res;
  try{
    res = await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt})});
  }catch(e){ throw {code:"network", message:"No pude conectarme con el servidor. Revisa tu conexión e intenta de nuevo."}; }
  if(!res.ok){
    let m=""; try{ m=(await res.json()).error; }catch(e){}
    throw {code:res.status===429?"rate_limited":"api", message:m||"Error al contactar la IA. Intenta de nuevo."};
  }
  const data = await res.json();
  let t = String(data.text||"").replace(/```json|```/g,"").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if(a<0||b<0) throw {code:"parse", message:"La IA respondió en un formato inesperado. Intenta de nuevo."};
  try{ return JSON.parse(t.slice(a,b+1)); }
  catch(e){ throw {code:"parse", message:"No pude interpretar la respuesta de la IA. Intenta de nuevo."}; }
}
function errMsg(e){
  if(e && e.code==="not_granted") return "Para usar la IA necesitas aceptar el permiso cuando el visor lo solicite.";
  if(e && e.code==="rate_limited") return "Demasiadas solicitudes seguidas. Espera unos segundos e intenta de nuevo.";
  return (e && e.message) || "Ocurrió un error. Intenta de nuevo.";
}
async function run(label, fn){
  S.busy=label; S.err=null; render();
  try{ await fn(); }catch(e){ S.err=errMsg(e); }
  S.busy=null; render();
  window.scrollTo({top:0,behavior:"smooth"});
}
const busyBtn = (id,label,cls="") => `<button class="btn ${cls}" data-act="${id}" ${S.busy?"disabled":""}>${S.busy===id?`<span class="spin"></span>`:""}${esc(label)}</button>`;

const BASE = `Eres parte de una app de entrenamiento para subgerentes de una empresa chilena. Escribe en español de Chile, tuteando, de forma directa y concreta. Responde ÚNICAMENTE con un objeto JSON válido, sin markdown ni texto adicional. Regla de oro: nunca inventes políticas, atribuciones, montos, indicadores ni procedimientos de la empresa; si algo no está en la información entregada, dilo explícitamente.`;

function defText(){
  return `PRIORIDAD ESTRATÉGICA: ${S.prioridad}\n- Resultado específico buscado: ${S.q.resultado}\n- Por qué es importante: ${S.q.importa}\n- Problema que se intenta resolver: ${S.q.problema}`;
}
function pptText(){
  const p=S.ppt;
  return `MENSAJE PPT PARA LAS JEFATURAS
Diapositiva 1 · PRIORIDAD (qué necesitamos lograr, foco principal): ${p.prioridad}
Diapositiva 2 · PROPÓSITO
- Impacto en la empresa: ${p.empresa}
- Impacto en clientes: ${p.clientes}
- Impacto en resultados: ${p.resultados}
Diapositiva 3 · TRADUCCIÓN A DECISIONES Y CONDUCTAS
- Qué significa para nuestra área: ${p.area}
- Qué priorizaremos y decidiremos (criterios y decisiones): ${p.decisiones}
- Qué haremos diferente y qué dejaremos de hacer: ${p.conductas}`;
}

/* ---------- Navegación ---------- */
const STAGES = ["Definir","Traducir","Simular","Evaluar"];
function maxReached(){
  let m=1;
  if(S.fb1Done) m=2;
  if(S.fb2Done) m=3;
  if(Object.values(S.tests).some(Boolean)) m=3;
  if(S.ev) m=4;
  return Math.max(m,S.stage,S.maxStage||1);
}
function renderSteps(){
  const mr=maxReached();
  $("#steps").innerHTML = STAGES.map((t,i)=>{
    const n=i+1; const cls = n===S.stage?"cur":(n<=mr?"done":"");
    return `<button class="step ${cls}" data-go="${n}" ${n<=mr?"":"disabled"}><span class="n">${n===S.stage||n>mr?n:"✓"}</span><span class="t">${t}</span></button>`;
  }).join("");
}
function go(n){ S.stage=n; S.maxStage=Math.max(S.maxStage||1,n); S.err=null; render(); window.scrollTo({top:0}); }

/* ---------- Etapa 1: Definir ---------- */
function fbBox(o){
  if(!o) return "";
  return `<div class="fb ${o.ok?"ok":"warn"}"><b>${o.ok?"Suficientemente preciso":"Necesito más precisión"}</b>${esc(o.desafio)}</div>`;
}
function field(label,hint,path,rows=3,fb=""){
  return `<label class="f">${label}</label>${hint?`<p class="hint">${hint}</p>`:""}<textarea rows="${rows}" data-bind="${path}">${esc(getPath(S,path))}</textarea>${fb}`;
}
function viewDefine(){
  const f=S.fb1||{};
  const allOk = S.fb1 && ["prioridad","importa"].every(k=>f[k]&&f[k].ok);
  return `<div class="card">
    <h2>1 · Define qué quieres que comprendan tus jefaturas</h2>
    <p class="lead">Ingresa una prioridad estratégica real de la empresa y responde dos preguntas. Si las respuestas son demasiado generales, te voy a pedir más precisión.</p>
    ${field("¿Cuál es la prioridad estratégica, qué resultado buscamos conseguir?","Una prioridad real que hoy necesitas que tu equipo de jefaturas lleve a la práctica.","prioridad",2,fbBox(f.prioridad))}
    ${field("¿Por qué esto es importante para la empresa, cómo nos ayuda?","Qué pasa si lo logramos y qué pasa si no.","q.importa",3,fbBox(f.importa))}
    <div class="actions">
      <button class="btn" data-act="to2" ${S.busy?"disabled":""}>Continuar a Traducir →</button>
      ${busyBtn("check1", S.fb1?"Revisar de nuevo con IA":"Revisar con IA (opcional)","ghost")}
    </div>
  </div>`;
}
async function check1(){
  const{prioridad,q}=S;
  if(![prioridad,q.importa].every(x=>x.trim().length>0)){ S.err="Completa la prioridad y las dos preguntas antes de revisar."; return; }
  const p = `${BASE}

Evalúa la precisión de lo que escribió un subgerente al definir una prioridad estratégica. Una respuesta es GENERAL (ok=false) si podría aplicarse a casi cualquier empresa o área, usa fórmulas vacías ("mejorar el servicio", "ser más eficientes", "agregar valor", "optimizar procesos") o no indica algo concreto como un resultado observable, un segmento, un proceso, un plazo o un indicador. Es suficientemente precisa (ok=true) si un tercero podría saber qué se busca y reconocer cuándo se logró.

Para cada campo entrega "desafio": si ok=false, cuestiona con respeto pero con firmeza por qué es general y pide mayor precisión con 1 o 2 preguntas concretas (ej. "¿mejorar qué, para quién, medido cómo?"). Si ok=true, una frase breve que confirme qué lo hace preciso. No reescribas la respuesta por el usuario.

${defText()}

Formato: {"prioridad":{"ok":bool,"desafio":""},"importa":{"ok":bool,"desafio":""}}`;
  const r = await ai(p);
  S.fb1=r; S.fb1Done = true;
}

/* ---------- Etapa 2: Traducir ---------- */
const chipFor = n => n==="observable"?["ok","Observable"]:n==="parcial"?["warn","Parcial"]:["bad","Solo intención"];
function fb2Box(o){
  if(!o) return "";
  const [c,t]=chipFor(o.nivel);
  return `<div class="fb ${c}"><b>${t}</b>${esc(o.comentario||"")}${o.sugerencia?`<div style="margin-top:6px"><b style="display:inline">Para precisar:</b> ${esc(o.sugerencia)}</div>`:""}</div>`;
}
function viewTranslate(){
  const f=S.fb2?.campos||{};
  const sum=S.fb2;
  return `<div class="card">
    <h2>2 · Traduce: construye tu mensaje PPT</h2>
    <p class="lead">Escribe lo que irías a presentar. Voy a revisar que la traducción contenga decisiones y conductas observables, no solo buenas intenciones.</p>
    <details class="ref"><summary>Ver mi definición de la etapa 1</summary><p style="white-space:pre-wrap">${esc(defText())}</p></details>
    ${S.fb2Done&&sum?`<div class="fb ${sum.observable?"ok":"warn"}" style="margin-bottom:18px"><b>Lectura general</b>${esc(sum.resumen||"")}</div>`:""}

    <div class="slide"><div class="sh"><h3>1. Prioridad</h3><span>Diapositiva 1</span></div><div class="sb">
      ${field("¿Qué necesitamos lograr? ¿Cuál es nuestro foco principal?","","ppt.prioridad",3,fb2Box(f.prioridad))}
    </div></div>

    <div class="slide"><div class="sh"><h3>2. Propósito</h3><span>Diapositiva 2</span></div><div class="sb">
      ${field("Impacto en la empresa","¿Por qué es importante?","ppt.empresa",2)}
      ${field("Impacto en nuestros clientes","","ppt.clientes",2)}
      ${field("Impacto en nuestros resultados","","ppt.resultados",2,fb2Box(f.proposito))}
    </div></div>

    <div class="slide"><div class="sh"><h3>3. Traducción a decisiones y conductas</h3><span>Diapositiva 3</span></div><div class="sb">
      ${field("¿Qué significa esto para nuestra área?","","ppt.area",2,fb2Box(f.area))}
      ${field("¿Qué priorizaremos y qué decidiremos?","Qué va antes que qué, y qué decisiones podrá tomar la jefatura y bajo qué criterio.","ppt.decisiones",4,fb2Box(f.decisiones))}
      ${field("¿Qué haremos diferente y qué dejaremos de hacer?","Conductas concretas que alguien podría ver o verificar, y lo que dejaremos de hacer.","ppt.conductas",4,fb2Box(f.conductas))}
    </div></div>

    <div class="actions">
      <button class="btn" data-act="to3" ${S.busy?"disabled":""}>Continuar a Simular →</button>
      ${busyBtn("check2", S.fb2Done?"Revisar de nuevo con IA":"Revisar con IA (opcional)","ghost")}
      <button class="btn ghost" data-go="1">← Volver a Definir</button>
    </div>
  </div>`;
}
async function check2(){
  const p0=S.ppt;
  if(Object.values(p0).some(x=>!x.trim())){ S.err="Completa todos los campos del mensaje PPT antes de revisar."; return; }
  const p = `${BASE}

Revisa si este mensaje PPT traduce la prioridad en DECISIONES Y CONDUCTAS OBSERVABLES o solo en buenas intenciones. Clasifica cada elemento:
- "observable": alguien podría ver, medir o verificar si se hizo; incluye criterio de decisión, umbral, plazo, quién/qué/cuándo.
- "parcial": hay dirección concreta pero faltan criterios, umbrales o límites.
- "intencion": declaraciones como "estar atentos", "priorizar al cliente", "trabajar en equipo", "ser más ágiles".
También verifica coherencia con la definición original. En "sugerencia" haz una pregunta o indicación concreta (no reescribas el texto); déjala vacía si es observable.

DEFINICIÓN ORIGINAL:
${defText()}

${pptText()}

Formato: {"observable":bool (true solo si "decisiones" y "conductas" son observables; en "conductas" debe quedar claro también qué se dejará de hacer),"resumen":"2 o 3 frases con la lectura general, incluyendo coherencia con la definición","campos":{"prioridad":{"nivel":"","comentario":"","sugerencia":""},"proposito":{...},"area":{...},"decisiones":{...},"conductas":{...}}}`;
  S.fb2 = await ai(p); S.fb2Done=true;
}

/* ---------- Etapa 3: Simular ---------- */
async function genCase(){
  const p = `${BASE}

Crea UN caso realista de simulación para una jefatura (por ejemplo jefe/a de área, jefe/a de equipo) que consulta a su subgerente. El caso debe poner en tensión la prioridad comunicada con otra demanda legítima del día a día, de modo que no exista una respuesta obvia y se necesiten los criterios del mensaje para decidir. Debe ser plausible para el contexto de la empresa que se infiere de la información; no inventes políticas, atribuciones ni normas internas, solo la situación operativa. Redáctalo en primera persona como lo diría la jefatura, de 3 a 6 frases, y termina con una pregunta directa al subgerente.

${defText()}

${pptText()}

Formato: {"rol":"cargo ficticio genérico de la jefatura","situacion":"texto en primera persona con la pregunta final","tension":"una frase que explique qué se está poniendo a prueba"}`;
  S.caso = await ai(p);
  S.tests={comp:null,dec:null,hard:null};
}
const TESTINFO = {
  comp:["Prueba de comprensión","La jefatura virtual explica qué entendió de tu mensaje. Tú detectas malentendidos o vacíos."],
  dec:["Prueba de decisión","La jefatura decide el caso usando solo tu PPT. Observas si faltaron criterios."],
  hard:["Preguntas difíciles","La jefatura te hace las preguntas incómodas y se ve si el PPT las responde."]
};
function resComp(r){
  return `<div class="res"><h4>Lo que entendí como prioridad</h4><p>${esc(r.prioridad)}</p>
  <h4>Por qué creo que importa</h4><p>${esc(r.proposito)}</p>
  <h4>Lo que haría distinto</h4>${list(r.haria)}
  <h4>Lo que dejaría de hacer</h4>${list(r.dejaria)}
  <h4>Dudas y vacíos (no está en el PPT)</h4>${list(r.vacios)}</div>`;
}
function resDec(r){
  const crit=(r.criterios||[]).map(c=>`<li><span class="chip ${/ppt/i.test(c.fuente)?"ok":"warn"}">${/ppt/i.test(c.fuente)?"Del PPT":"Juicio propio"}</span>${esc(c.criterio)}</li>`).join("");
  return `<div class="res"><h4>Mi decisión</h4><div class="decision">${esc(r.decision)}</div>
  <h4>Cómo razoné</h4><p>${esc(r.razonamiento)}</p>
  <h4>Criterios que usé</h4><ul style="list-style:none;padding:0">${crit||"<li class='muted'>—</li>"}</ul>
  <h4>Criterios que me faltaron</h4>${list(r.faltantes)}
  <h4>¿Te habría consultado igual?</h4><p><span class="chip ${r.consultaria==="no"?"ok":r.consultaria==="si"?"bad":"warn"}">${r.consultaria==="no"?"No, pude decidir solo":r.consultaria==="si"?"Sí, te consultaría":"Parcialmente"}</span> ${esc(r.motivo_consulta)}</p></div>`;
}
function resHard(r){
  return `<div class="res">${(r.preguntas||[]).map(q=>{
    const c=q.respuesta==="si"?["ok","El PPT lo responde"]:q.respuesta==="parcial"?["warn","Respuesta parcial"]:["bad","El PPT no lo responde"];
    return `<div class="q"><div class="qq">“${esc(q.pregunta)}”</div><span class="chip ${c[0]}">${c[1]}</span> ${esc(q.fundamento)}</div>`;}).join("")}</div>`;
}
const RENDER = {comp:resComp,dec:resDec,hard:resHard};
function viewSimulate(){
  const c=S.caso;
  const tests = Object.keys(TESTINFO).map(k=>`<div class="test ${S.tests[k]?"done":""}"><h3>${TESTINFO[k][0]}</h3><p>${TESTINFO[k][1]}</p>${busyBtn("test:"+k, S.tests[k]?"Repetir":"Ejecutar","sm")}</div>`).join("");
  const results = Object.keys(TESTINFO).filter(k=>S.tests[k]).map(k=>`<div class="card"><h2 style="font-size:20px">${TESTINFO[k][0]}</h2>${RENDER[k](S.tests[k])}
    <label class="f small">Tus observaciones: ¿qué malentendidos, vacíos o criterios faltaron?</label>
    <textarea rows="3" data-bind="notes.${k}">${esc(S.notes[k])}</textarea></div>`).join("");
  const any = Object.values(S.tests).some(Boolean);
  return `<div class="card">
    <h2>3 · Simula: ¿tu jefatura realmente entendió?</h2>
    <p class="lead">Una jefatura virtual recibe solo tu mensaje PPT. No sabe nada más de la empresa: si faltan criterios, lo va a decir.</p>
    ${c?`<div class="case"><div class="who">Simulación · ${esc(c.rol)} te consulta</div><blockquote>“${esc(c.situacion)}”</blockquote></div>
      <p class="small muted" style="margin:8px 0 0">Lo que se pone a prueba: ${esc(c.tension)}</p>
      <h3 style="margin-top:20px;font-size:18px">¿Tu mensaje entregó criterios suficientes para decidir sin preguntarte?</h3>
      <div class="tests">${tests}</div>
      <div class="actions" style="margin-top:6px">${busyBtn("regen","Generar otro caso","ghost sm")}<button class="btn ghost sm" data-go="2">← Ajustar mi PPT</button></div>`
    :`<div class="actions">${busyBtn("regen","Generar caso de simulación")}</div>`}
  </div>
  ${results}
  ${any?`<div class="actions">${busyBtn("eval","Ver mi evaluación →")}</div><p class="small muted">Mientras más pruebas ejecutes, más precisa será la evaluación.</p>`:""}`;
}
async function runTest(k){
  const common = `${BASE}

Actúas como una JEFATURA VIRTUAL (${S.caso.rol}) que ha recibido ÚNICAMENTE el siguiente mensaje PPT de su subgerente. No conoces nada más de la empresa. Regla estricta: usa solo lo que dice el PPT; si necesitas un criterio, umbral, atribución o política que el PPT no entrega, no lo inventes: dilo explícitamente. Puedes tomar decisiones plausibles, pero distingue siempre entre lo que sale del PPT y lo que es juicio propio.

${pptText()}

CASO PLANTEADO A TU SUBGERENTE:
${S.caso.situacion}
`;
  let fmt;
  if(k==="comp") fmt = `Tarea: explica con tus palabras qué entendiste del mensaje. Formato: {"prioridad":"qué entendiste que se busca","proposito":"por qué entendiste que importa","haria":["conductas o decisiones que harías distinto, solo si el PPT lo permite deducir"],"dejaria":["qué dejarías de hacer, o indica si no quedó claro"],"vacios":["cosas que no entendiste o que el PPT no dice"]}`;
  if(k==="dec") fmt = `Tarea: toma una decisión sobre el caso basándote únicamente en el PPT. Formato: {"decision":"qué priorizas, en 1 o 2 frases","razonamiento":"2 a 4 frases","criterios":[{"criterio":"","fuente":"PPT o juicio propio"}],"faltantes":["criterios o límites que el PPT no entrega y habrías necesitado"],"consultaria":"si, no o parcial","motivo_consulta":"una frase"}`;
  if(k==="hard") fmt = `Tarea: hazle a tu subgerente las preguntas difíciles que realmente te harías. Incluye obligatoriamente estas tres: "¿Qué dejamos de hacer?", "¿Esto tiene prioridad sobre los otros indicadores?", "¿Hasta dónde puedo decidir yo?". Agrega 1 pregunta adicional propia de este caso. Para cada una indica si el PPT permite responderla. Formato: {"preguntas":[{"pregunta":"","respuesta":"si, parcial o no","fundamento":"qué parte del PPT la responde o qué falta"}]}`;
  S.tests[k] = await ai(common+"\n"+fmt);
}

/* ---------- Etapa 4: Evaluar ---------- */
const DIMS = [
  ["claridad","Claridad en la prioridad","¿Se entiende el resultado que se busca?"],
  ["proposito","Sentido del propósito","¿Se comprende por qué importa?"],
  ["acciones","Traducción a acciones","¿Se sabe qué hacer diferente?"],
  ["autonomia","Autonomía para decidir","¿Existen criterios suficientes para actuar sin consultar todo?"]
];
async function evaluate(){
  const ran = Object.keys(S.tests).filter(k=>S.tests[k]);
  const evid = ran.map(k=>`[${TESTINFO[k][0]}]\n${JSON.stringify(S.tests[k])}\nObservaciones del subgerente: ${S.notes[k]||"(sin observaciones)"}`).join("\n\n");
  const p = `${BASE}

Evalúa la calidad del mensaje PPT de un subgerente usando como evidencia principal el desempeño de la jefatura virtual en las pruebas. Califica con escala chilena de 1.0 a 7.0 (un decimal; 4.0 es el mínimo aprobatorio y 7.0 solo si es excelente y sin vacíos relevantes). Sé exigente y justo: las buenas intenciones sin criterios observables no pasan de 4.0 en acciones ni en autonomía. Si alguna prueba no se ejecutó, indícalo en la justificación y no inventes evidencia.

Dimensiones: claridad (¿se entiende el resultado que se busca?), proposito (¿se comprende por qué importa?), acciones (¿se sabe qué hacer diferente?), autonomia (¿existen criterios suficientes para actuar sin consultar todo?).

DEFINICIÓN ORIGINAL:
${defText()}

${pptText()}

CASO: ${S.caso.situacion}

EVIDENCIA DE LAS PRUEBAS:
${evid}

Para la oportunidad de mejora elige LA principal (la que más aumentaría la comprensión de las jefaturas), y propone un ejemplo de redacción concreta que el subgerente podría agregar o reemplazar en su PPT, sin inventar políticas de la empresa: usa corchetes [ ] donde él deba completar un dato que solo él conoce.

Formato: {"dimensiones":{"claridad":{"nota":0.0,"justificacion":"1 a 3 frases con evidencia"},"proposito":{...},"acciones":{...},"autonomia":{...}},"fortaleza":"lo mejor del mensaje, 1 frase","oportunidad":{"titulo":"","detalle":"2 a 4 frases","ejemplo":"redacción sugerida"}}`;
  S.ev = await ai(p);
}
const scoreCls = n => n>=5.5?"ok":n>=4?"warn":"bad";
function fmt(n){ return (Math.round(Math.max(1,Math.min(7,Number(n)||1))*10)/10).toFixed(1); }
function viewEvaluate(){
  const e=S.ev;
  if(!e) return `<div class="card"><h2>4 · Evalúa</h2><p class="lead">Aún no hay evaluación.</p><div class="actions">${busyBtn("eval","Generar evaluación")}</div></div>`;
  const notas = DIMS.map(d=>Number(e.dimensiones?.[d[0]]?.nota)||1);
  const avg = notas.reduce((a,b)=>a+b,0)/notas.length;
  const dimsHtml = DIMS.map((d,i)=>{
    const o=e.dimensiones?.[d[0]]||{}; const n=notas[i]; const c=scoreCls(n);
    return `<div class="dim"><div class="row"><div><div class="name">${d[1]}</div><div class="q2">${d[2]}</div></div><div class="score s-${c}">${fmt(n)}</div></div>
    <div class="bar"><i class="b-${c}" style="width:${((Math.max(1,Math.min(7,n))-1)/6*100).toFixed(0)}%"></i></div><div class="small">${esc(o.justificacion)}</div></div>`;
  }).join("");
  const op=e.oportunidad||{};
  return `<div class="card">
    <h2>4 · Evalúa: ¿qué tan bien viajó tu mensaje?</h2>
    <p class="lead">Evaluación basada en cómo respondió la jefatura virtual con solo tu PPT.</p>
    <div class="overall"><div class="big s-${scoreCls(avg)}">${fmt(avg)}</div><div><b>Promedio general</b><div class="small muted">Escala 1.0 a 7.0 · aprobación desde 4.0</div></div></div>
    ${dimsHtml}
    ${e.fortaleza?`<div class="fb ok" style="margin:16px 0"><b>Lo que ya funciona</b>${esc(e.fortaleza)}</div>`:""}
    <div class="opp"><div class="tag">Principal oportunidad de mejora</div><h3>${esc(op.titulo)}</h3><div>${esc(op.detalle)}</div>
      ${op.ejemplo?`<div class="rewrite"><b class="small">Ejemplo de redacción:</b><br>${esc(op.ejemplo)}</div>`:""}</div>
    <div class="actions">
      <button class="btn" data-go="2">Mejorar mi PPT</button>
      <button class="btn ghost" data-act="newcase">Probar con un caso nuevo</button>
      <button class="btn ghost" data-act="restart">Empezar con otra prioridad</button>
    </div>
  </div>`;
}

/* ---------- Render ---------- */
function render(){
  renderSteps();
  const err = S.err?`<div class="err" role="alert">${esc(S.err)}</div>`:"";
  const v = S.stage===1?viewDefine():S.stage===2?viewTranslate():S.stage===3?viewSimulate():viewEvaluate();
  $("#app").innerHTML = err+v;
  document.querySelectorAll("[data-bind]").forEach(el=>{
    el.addEventListener("input",()=>setPath(S,el.dataset.bind,el.value));
  });
}

document.addEventListener("click",e=>{
  const g=e.target.closest("[data-go]");
  if(g && !g.disabled){ go(Number(g.dataset.go)); return; }
  const b=e.target.closest("[data-act]");
  if(!b||b.disabled||S.busy) return;
  const a=b.dataset.act;
  if(a==="check1") run("check1",check1);
  else if(a==="to2"){
    if(![S.prioridad,S.q.resultado,S.q.importa,S.q.problema].every(x=>x.trim())){ S.err="Completa la prioridad y las tres preguntas para continuar."; render(); window.scrollTo({top:0}); }
    else go(2);
  }
  else if(a==="check2") run("check2",check2);
  else if(a==="to3"){
    if(Object.values(S.ppt).some(x=>!x.trim())){ S.err="Completa todos los campos del mensaje PPT para continuar."; render(); window.scrollTo({top:0}); }
    else go(3);
  }
  else if(a==="regen") run("regen",genCase);
  else if(a.startsWith("test:")) run(a,()=>runTest(a.slice(5)));
  else if(a==="eval") run("eval",async()=>{ await evaluate(); S.stage=4; });
  else if(a==="newcase"){ S.ev=null; S.notes={comp:"",dec:"",hard:""}; run("regen",async()=>{ await genCase(); S.stage=3; }); }
  else if(a==="restart"){ S=emptyState(); render(); window.scrollTo({top:0}); }
});

render();
})();
