import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

const THEME = {
  navy:        "#0E2A3A",
  ink:         "#13313F",
  slate:       "#4E6B79",
  slateSoft:   "#6E8794",
  celeste:     "#1FA1C4",
  celesteBright:"#3FC8E6",
  celesteDeep: "#137E9C",
  celesteSoft: "#DCF2F9",
  celesteTint: "#EEF8FC",
  blue:        "#3E6AA8",
  line:        "#E1EDF3",
  line2:       "#D2E5ED",
  gradBtn:     "linear-gradient(135deg,#3FC8E6,#137E9C)",
  gradBrand:   "linear-gradient(120deg,#1FA1C4,#3E6AA8)",
};

const FONT_DISPLAY = '"Bricolage Grotesque", sans-serif';
const FONT_BODY    = '"Plus Jakarta Sans", system-ui, sans-serif';
const FONT_MONO    = '"JetBrains Mono", ui-monospace, monospace';
const KUDEN_LOGO   = "/kuden-logo.png";

const CHANNELS = [
  { id:"web",      label:"Web Chat",  icon:"ti-world",          color:"#1FA1C4", bg:"#DCF2F9" },
  { id:"whatsapp", label:"WhatsApp",  icon:"ti-brand-whatsapp", color:"#25D366", bg:"#E8F9EE" },
  { id:"voz",      label:"Voz",       icon:"ti-phone",          color:"#3E6AA8", bg:"#E7EFF9" },
  { id:"app",      label:"App Móvil", icon:"ti-device-mobile",  color:"#137E9C", bg:"#D4EEF6" },
  { id:"rrss",     label:"Redes Soc.",icon:"ti-share",          color:"#0E5F77", bg:"#D0E8F0" },
];

const CSAT_LABELS = ["","Muy malo","Malo","Regular","Bueno","Excelente"];
const CSAT_COLORS = ["","#E24B4A","#D85A30","#EF9F27","#1D9E75","#534AB7"];

const SENTIMIENTOS = [
  { id:"muy_negativo", label:"Muy frustrado", emoji:"😠", color:"#E24B4A", bg:"#FDECEA", pct:10 },
  { id:"negativo",     label:"Frustrado",     emoji:"😕", color:"#D85A30", bg:"#FAECE7", pct:30 },
  { id:"neutral",      label:"Neutral",       emoji:"😐", color:"#EF9F27", bg:"#FEF3E0", pct:50 },
  { id:"positivo",     label:"Satisfecho",    emoji:"🙂", color:"#1D9E75", bg:"#E1F5EE", pct:75 },
  { id:"muy_positivo", label:"Muy satisfecho",emoji:"😊", color:"#534AB7", bg:"#EEEDFE", pct:100 },
];

const RIESGO_FUGA = [
  { id:"sin_riesgo", label:"Sin riesgo",   color:"#1FA1C4", bg:"#DCF2F9", icon:"ti-shield-check"   },
  { id:"bajo",       label:"Riesgo bajo",  color:"#EF9F27", bg:"#FEF3E0", icon:"ti-alert-triangle" },
  { id:"medio",      label:"Riesgo medio", color:"#D85A30", bg:"#FAECE7", icon:"ti-alert-triangle" },
  { id:"alto",       label:"Riesgo alto",  color:"#E24B4A", bg:"#FDECEA", icon:"ti-flame"          },
];

const CLOSE_OPTIONS = [
  { id:"resuelto",   label:"Resolver",  desc:"Caso solucionado por KUDEN",       icon:"ti-circle-check",       color:"#1D9E75", bg:"#E1F5EE", estadoCRM:"resuelto"    },
  { id:"escalado",   label:"Escalar",   desc:"Transferir a agente humano",        icon:"ti-arrows-transfer-up", color:"#534AB7", bg:"#EEEDFE", estadoCRM:"escalado"    },
  { id:"abandonado", label:"Abandonar", desc:"Cliente desistió o se desconectó", icon:"ti-circle-x",           color:"#D85A30", bg:"#FAECE7", estadoCRM:"en progreso" },
];

const estadoConfig = {
  "en progreso": { color:"#EF9F27", bg:"#FEF3E0", label:"En progreso" },
  "resuelto":    { color:"#1D9E75", bg:"#E1F5EE", label:"Resuelto"    },
  "escalado":    { color:"#534AB7", bg:"#EEEDFE", label:"Escalado"    },
};

const PLANES = ["Plan Básico 50MB","Plan Hogar 200MB","Plan Hogar 500MB","Plan VIP Fibra 1GB","Plan Empresas"];



const buildSystem = (masterConfig, profile, dbProfiles, cliente, canal) => {
  const agentName = masterConfig?.agent_name || "KUDEN";
  const companyName = masterConfig?.company_name || "ConectaChile";
  const basePrompt = masterConfig?.base_prompt || "Eres el asistente virtual. Atiende amablemente.";
  const allowed = masterConfig?.allowed_profiles || [];
  
  const activeProfiles = dbProfiles.filter(p => allowed.includes(p.id));
  const profilesList = activeProfiles.map(p => `- [Perfil: ${p.label}]: ${p.persona_prompt}`).join("\n");
  
  let prompt = `Eres ${agentName}, agente maestro de IA de ${companyName}.\n`;
  prompt += `INSTRUCCIONES DEL AGENTE MAESTRO:\n${basePrompt}\n\n`;
  
  if (profile && profile.id !== 'master') {
    prompt += `ATENCIÓN: Para esta respuesta específica, debes adoptar la siguiente personalidad/perfil:\n`;
    prompt += `[Perfil Activo: ${profile.label}]: ${profile.persona_prompt || profile.persona || "Cliente estándar"}\n\n`;
  } else if (activeProfiles.length > 0) {
    prompt += `PERFILES DISPONIBLES (Adapta tu tono y personalidad al perfil que mejor encaje según lo que pida el cliente):\n${profilesList}\n\n`;
  }
  
  prompt += `CLIENTE: ${cliente.nombre}, RUT: ${cliente.rut}, Plan: ${cliente.plan}, Tel: ${cliente.telefono}\n`;
  prompt += `CANAL: ${canal}\n\n`;
  
  prompt += `Responde en español, máximo 3-4 oraciones, sin listas.\n`;
  prompt += `Al final agrega EXACTAMENTE:\n`;
  prompt += `[ACCION: texto, máx 6 palabras]\n`;
  prompt += `[INTENCION: consulta técnica | consulta comercial | reclamo | riesgo de fuga | solicitud de cambio | saludo]\n`;
  prompt += `[ESTADO: en progreso | resuelto | escalado]\n`;
  prompt += `[SENTIMIENTO: muy_negativo | negativo | neutral | positivo | muy_positivo]\n`;
  prompt += `[FUGA: sin_riesgo | bajo | medio | alto]`;
  
  return prompt;
};

const parseFull = (text) => {
  const get = (k) => { const m = text.match(new RegExp("\\["+k+":\\s*(.+?)\\]","i")); return m ? m[1].trim() : null; };
  const clean = text.replace(/\[(ACCION|INTENCION|ESTADO|SENTIMIENTO|FUGA):.*?\]/gi,"").trim();
  return { clean, accion:get("ACCION"), intencion:get("INTENCION"), estado:get("ESTADO"), sentimiento:get("SENTIMIENTO"), fuga:get("FUGA") };
};

const genTkt = () => "TKT-" + Math.floor(Math.random()*90000+10000);
const fmt = (s) => String(Math.floor(s/60)).padStart(2,"0") + ":" + String(s%60).padStart(2,"0");

const segFromPlan = (plan) => {
  if (!plan) return { label:"Básico", color:"#D85A30", bg:"#FAECE7", score:25, desc:"Cliente inicial." };
  if (plan.includes("Empresas")||plan.includes("1GB")) return { label:"Estratégico", color:"#534AB7", bg:"#EEEDFE", score:100, desc:"Cliente de alto valor. Prioridad máxima." };
  if (plan.includes("500MB")||plan.includes("VIP"))    return { label:"Alto",        color:"#1D9E75", bg:"#E1F5EE", score:75,  desc:"Cliente consolidado. Buena rentabilidad." };
  if (plan.includes("200MB"))                          return { label:"Medio",       color:"#EF9F27", bg:"#FEF3E0", score:50,  desc:"Cliente en desarrollo. Potencial de upsell." };
  return { label:"Básico", color:"#D85A30", bg:"#FAECE7", score:25, desc:"Cliente inicial. Foco en retención." };
};

// ── UI helpers ──────────────────────────────────────────────────────────────
function Badge({ label, color, bg }) {
  return <span style={{ fontSize:10, fontWeight:500, color, background:bg, border:"0.5px solid "+color+"40", borderRadius:20, padding:"2px 8px" }}>{label}</span>;
}
function Field({ label, value }) {
  return (
    <div>
      <p style={{ margin:"0 0 1px", fontSize:10, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.04em" }}>{label}</p>
      <p style={{ margin:0, fontSize:12, fontWeight:500, color:"var(--color-text-primary)" }}>{value||"—"}</p>
    </div>
  );
}
function StarRating({ msgIndex, ratings, onRate }) {
  const [hover, setHover] = useState(0);
  const cur = ratings[msgIndex]||0;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:5 }}>
      <span style={{ fontSize:10, color:"var(--color-text-secondary)" }}>{cur ? CSAT_LABELS[cur] : "Calificar"}</span>
      <div style={{ display:"flex", gap:1 }}>
        {[1,2,3,4,5].map(s => (
          <button key={s} onClick={() => onRate(msgIndex,s)} onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)}
            style={{ background:"none", border:"none", padding:"1px", cursor:"pointer", fontSize:14, color:s<=(hover||cur)?CSAT_COLORS[hover||cur]:"var(--color-border-secondary)" }}>★</button>
        ))}
      </div>
    </div>
  );
}

function CloseModal({ onClose, onConfirm, csatAvg, elapsed }) {
  const [sel, setSel] = useState(null);
  const el = useRef(document.createElement("div"));
  useEffect(() => {
    const portal = el.current;
    Object.assign(portal.style, { position:"fixed", top:"0", left:"0", width:"100%", height:"100%", background:"rgba(0,0,0,0.55)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:"99999" });
    document.body.appendChild(portal);
    return () => document.body.removeChild(portal);
  }, []);
  useEffect(() => {
    const portal = el.current;
    portal.innerHTML = "";
    const box = document.createElement("div");
    Object.assign(box.style, { background:"white", borderRadius:"12px", padding:"24px", width:"340px", boxShadow:"0 16px 48px rgba(0,0,0,0.32)", fontFamily:"sans-serif" });
    const cc = sel ? (CLOSE_OPTIONS.find(o=>o.id===sel)||{}).color||"#ccc" : "#ccc";
    box.innerHTML =
      "<p style='margin:0 0 4px;font-size:14px;font-weight:500;color:#111'>Cerrar caso</p>" +
      "<p style='margin:0 0 16px;font-size:12px;color:#666'>Duración: "+fmt(elapsed)+" · CSAT: "+(csatAvg?csatAvg.toFixed(1)+" ★":"sin calificar")+"</p>" +
      "<p style='margin:0 0 10px;font-size:10px;color:#888;text-transform:uppercase'>Motivo de cierre</p>" +
      "<div id='opts' style='display:flex;flex-direction:column;gap:8px;margin-bottom:16px'></div>" +
      "<div style='display:flex;gap:8px'>" +
        "<button id='btn-cancel' style='flex:1;font-size:12px;padding:8px;cursor:pointer;border-radius:8px;border:1px solid #ddd;background:#f5f5f5'>Cancelar</button>" +
        "<button id='btn-confirm' style='flex:1;font-size:12px;padding:8px;cursor:pointer;border-radius:8px;border:none;font-weight:500;background:"+cc+";color:"+(sel?"#fff":"#888")+"'>Confirmar cierre</button>" +
      "</div>";
    const optsDiv = box.querySelector("#opts");
    CLOSE_OPTIONS.forEach(opt => {
      const btn = document.createElement("button");
      btn.style.cssText = "display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;cursor:pointer;text-align:left;width:100%;background:"+(sel===opt.id?opt.bg:"#f5f5f5")+";border:"+(sel===opt.id?"2px solid "+opt.color:"1px solid #ddd");
      btn.innerHTML = "<div style='flex:1'><p style='margin:0;font-size:13px;font-weight:500;color:"+(sel===opt.id?opt.color:"#111")+"'>"+opt.label+"</p><p style='margin:0;font-size:11px;color:#666'>"+opt.desc+"</p></div>";
      btn.onclick = () => setSel(opt.id);
      optsDiv.appendChild(btn);
    });
    box.querySelector("#btn-cancel").onclick = onClose;
    box.querySelector("#btn-confirm").onclick = () => sel && onConfirm(sel);
    portal.appendChild(box);
    portal.onclick = (e) => { if (e.target===portal) onClose(); };
  }, [sel]);
  return null;
}

function ClienteForm({ profile, dbProfiles, setProfile, onStart }) {
  const [nombre,    setNombre]    = useState("");
  const [rut,       setRut]       = useState("");
  const [telefono,  setTelefono]  = useState("");
  const [plan,      setPlan]      = useState("");
  const [direccion, setDireccion] = useState("");
  const [canal,     setCanal]     = useState("web");
  const ok = nombre.trim()!==""&&rut.trim()!==""&&telefono.trim()!==""&&plan!=="";
  return (
    <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", padding:16, display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ margin:0, fontSize:13, fontWeight:500, color:"var(--color-text-primary)" }}>Datos del cliente</p>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Perfil IA:</span>
          <select value={profile?.id || "master"} onChange={e => {
            if (e.target.value === 'master') setProfile({ id: 'master', label: '🤖 Agente Maestro (Automático)', hint_text: 'Hola' });
            else setProfile((dbProfiles||[]).find(p => p.id === e.target.value));
          }} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 4, background: "var(--color-background-secondary)", color: "var(--color-text-primary)", border: "1px solid var(--color-border-tertiary)" }}>
            <option value="master">🤖 Agente Maestro (Automático)</option>
            {(dbProfiles||[]).map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <p style={{ margin:"0 0 6px", fontSize:10, color:"var(--color-text-secondary)", textTransform:"uppercase" }}>Canal de contacto</p>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {CHANNELS.map(ch => (
            <button key={ch.id} onClick={() => setCanal(ch.id)}
              style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 10px", borderRadius:20, cursor:"pointer", fontSize:11,
                background:canal===ch.id?ch.bg:"var(--color-background-secondary)",
                border:canal===ch.id?"1.5px solid "+ch.color:"0.5px solid var(--color-border-tertiary)",
                color:canal===ch.id?ch.color:"var(--color-text-secondary)", fontWeight:canal===ch.id?500:400 }}>
              <i className={"ti "+ch.icon} style={{ fontSize:13 }} aria-hidden="true"/>{ch.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        {[["Nombre *",nombre,setNombre,"Ej: María González"],["RUT *",rut,setRut,"Ej: 12345678-9"],["Teléfono *",telefono,setTelefono,"Ej: +56912345678"],["Dirección",direccion,setDireccion,"Ej: Av. Providencia 123"]].map(function(item) {
          return (
            <div key={item[0]}>
              <p style={{ margin:"0 0 4px", fontSize:10, color:"var(--color-text-secondary)", textTransform:"uppercase" }}>{item[0]}</p>
              <input value={item[1]} onChange={e=>item[2](e.target.value)} placeholder={item[3]} style={{ width:"100%", fontSize:12, boxSizing:"border-box" }}/>
            </div>
          );
        })}
        <div style={{ gridColumn:"1/-1" }}>
          <p style={{ margin:"0 0 4px", fontSize:10, color:"var(--color-text-secondary)", textTransform:"uppercase" }}>Plan contratado *</p>
          <select value={plan} onChange={e=>{ e.stopPropagation(); setPlan(e.target.value); }} style={{ width:"100%", fontSize:12, padding:"6px 8px", boxSizing:"border-box" }}>
            <option value="">— Seleccionar plan —</option>
            {PLANES.map(pl => <option key={pl} value={pl}>{pl}</option>)}
          </select>
          {plan && <p style={{ margin:"3px 0 0", fontSize:10, color:THEME.celesteDeep }}>✓ {plan}</p>}
        </div>
      </div>
      <button onClick={() => ok && onStart({nombre,rut,telefono,plan,direccion,canal})}
        style={{ fontSize:13, padding:"10px", fontWeight:500, border:"none", borderRadius:"var(--border-radius-md)", cursor:ok?"pointer":"not-allowed", background:ok?THEME.gradBtn:"#bbb", color:ok?"#fff":"#666" }}>
        {ok ? "Iniciar atención con KUDEN → ("+(CHANNELS.find(c=>c.id===canal)||CHANNELS[0]).label+")" : "Completa los campos obligatorios (*)"}
      </button>
    </div>
  );
}

function IntelPanel({ sentimiento, fuga, intencion, action, loading }) {
  const sent    = SENTIMIENTOS.find(s=>s.id===sentimiento)||SENTIMIENTOS[2];
  const fugaObj = RIESGO_FUGA.find(f=>f.id===fuga)||RIESGO_FUGA[0];
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", padding:"10px 12px" }}>
        <p style={{ margin:"0 0 7px", fontSize:10, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em" }}>Sentimiento</p>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
          <span style={{ fontSize:20 }}>{sent.emoji}</span>
          <div style={{ flex:1 }}>
            <p style={{ margin:"0 0 3px", fontSize:11, fontWeight:500, color:sent.color }}>{sent.label}</p>
            <div style={{ background:"var(--color-background-secondary)", borderRadius:4, height:5, overflow:"hidden" }}>
              <div style={{ width:sent.pct+"%", height:"100%", background:sent.color, borderRadius:4, transition:"width 0.6s" }}/>
            </div>
          </div>
        </div>
      </div>
      <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", padding:"10px 12px" }}>
        <p style={{ margin:"0 0 5px", fontSize:10, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em" }}>Riesgo fuga</p>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <i className={"ti "+fugaObj.icon} style={{ fontSize:16, color:fugaObj.color }} aria-hidden="true"/>
          <p style={{ margin:0, fontSize:11, fontWeight:500, color:fugaObj.color }}>{fugaObj.label}</p>
        </div>
      </div>
      <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", padding:"10px 12px" }}>
        <p style={{ margin:"0 0 5px", fontSize:10, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em" }}>Capacidad activa</p>
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:loading?"#EF9F27":THEME.celeste, flexShrink:0 }}/>
          <p style={{ margin:0, fontSize:11, fontWeight:500, color:"var(--color-text-primary)", lineHeight:1.3 }}>{action}</p>
        </div>
      </div>
      <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", padding:"10px 12px" }}>
        <p style={{ margin:"0 0 5px", fontSize:10, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em" }}>Intención</p>
        {intencion ? <Badge label={intencion} color={THEME.celesteDeep} bg={THEME.celesteSoft}/> : <p style={{ margin:0, fontSize:11, color:"var(--color-text-tertiary)", fontStyle:"italic" }}>Sin datos</p>}
      </div>
    </div>
  );
}

function PerfilTab({ cliente, casesLog, fakeHistory }) {
  const hist = fakeHistory || [];
  const cd   = cliente || (casesLog.length > 0 ? casesLog[0] : null);
  if (!cd) return (
    <div style={{ textAlign:"center", padding:40 }}>
      <i className="ti ti-user-circle" style={{ fontSize:32, color:"var(--color-text-tertiary)", display:"block", marginBottom:10 }} aria-hidden="true"/>
      <p style={{ color:"var(--color-text-secondary)", fontSize:13 }}>Selecciona un cliente demo o ingresa datos del cliente</p>
    </div>
  );
  const seg = segFromPlan(cd.plan);
  const allCSAT = hist.map(h=>h.csat).concat(casesLog.map(c=>parseFloat(c.csatFinal)).filter(n=>!isNaN(n)));
  const prom = allCSAT.filter(c=>c>=5).length;
  const det  = allCSAT.filter(c=>c<=2).length;
  const pas  = allCSAT.filter(c=>c===3||c===4).length;
  const nps  = allCSAT.length ? Math.round(((prom-det)/allCSAT.length)*100) : null;
  const npsColor = nps===null?"#aaa":nps>=50?"#1D9E75":nps>=0?"#EF9F27":"#E24B4A";
  const npsLabel = nps===null?"Sin datos":nps>=50?"Promotor":nps>=0?"Pasivo":"Detractor";
  const cFreq = {};
  hist.map(h=>h.canal).concat(casesLog.map(c=>c.canal)).forEach(c=>{ cFreq[c]=(cFreq[c]||0)+1; });
  const cEntries = Object.entries(cFreq).sort((a,b)=>b[1]-a[1]);
  const cPref = cEntries[0]||null;
  const cObj  = cPref ? CHANNELS.find(c=>c.label===cPref[0])||CHANNELS[0] : null;
  const fScores = { sin_riesgo:0, bajo:25, medio:60, alto:100 };
  const fVals   = casesLog.map(c=>fScores[c.fugaFinal]||0);
  const fScore  = fVals.length ? Math.round(fVals.reduce((a,b)=>a+b,0)/fVals.length) : 0;
  const fColor  = fScore>=70?"#E24B4A":fScore>=40?"#D85A30":fScore>=15?"#EF9F27":"#1D9E75";
  const fLabel  = fScore>=70?"Alto riesgo":fScore>=40?"Riesgo medio":fScore>=15?"Riesgo bajo":"Sin riesgo";
  const sScores = { muy_negativo:0, negativo:25, neutral:50, positivo:75, muy_positivo:100 };
  const sEvol   = casesLog.slice().reverse().map((c,i)=>({ i:i+1, score:sScores[c.sentimientoFinal]||50, sent:c.sentimientoFinal }));
  const n0 = (cd.cliente_nombre||cd.nombre||"El cliente").split(" ")[0];
  const rec = seg.score>=75
    ? n0+" es un cliente "+seg.label.toLowerCase()+". Se recomienda atención preferencial y beneficios de fidelización."
    : fScore>=60
    ? "⚠️ "+n0+" presenta riesgo de fuga elevado. Contacto proactivo recomendado."
    : nps!==null&&nps<0
    ? n0+" tiene historial de insatisfacción. Priorizar FCR y seguimiento."
    : "Perfil en desarrollo. Continúa registrando interacciones para afinar la segmentación.";
  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", gap:10 }}>
      <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", padding:"14px 16px", display:"flex", alignItems:"center", gap:14 }}>
        <div style={{ width:48, height:48, borderRadius:"50%", background:seg.bg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, border:"2px solid "+seg.color }}>
          <span style={{ fontSize:20, fontWeight:600, color:seg.color }}>{(cd.cliente_nombre||cd.nombre||"?")[0].toUpperCase()}</span>
        </div>
        <div style={{ flex:1 }}>
          <p style={{ margin:"0 0 2px", fontSize:15, fontWeight:500, color:"var(--color-text-primary)" }}>{cd.cliente_nombre||cd.nombre}</p>
          <p style={{ margin:"0 0 5px", fontSize:12, color:"var(--color-text-secondary)" }}>{cd.rut} · {cd.telefono}</p>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            <Badge label={cd.plan||"—"} color={THEME.blue} bg="#E7EFF9"/>
            <Badge label={"Segmento "+seg.label} color={seg.color} bg={seg.bg}/>
          </div>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", padding:"12px 14px" }}>
          <p style={{ margin:"0 0 8px", fontSize:11, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.04em" }}>Segmento de valor</p>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
            <div style={{ width:36, height:36, borderRadius:"50%", background:seg.bg, display:"flex", alignItems:"center", justifyContent:"center", border:"2px solid "+seg.color }}>
              <i className="ti ti-diamond" style={{ fontSize:16, color:seg.color }} aria-hidden="true"/>
            </div>
            <div>
              <p style={{ margin:0, fontSize:15, fontWeight:500, color:seg.color }}>{seg.label}</p>
              <p style={{ margin:0, fontSize:11, color:"var(--color-text-secondary)" }}>{seg.desc}</p>
            </div>
          </div>
          <div style={{ background:"var(--color-background-secondary)", borderRadius:6, height:8, overflow:"hidden" }}>
            <div style={{ width:seg.score+"%", height:"100%", background:seg.color, borderRadius:6 }}/>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
            <span style={{ fontSize:9, color:"var(--color-text-tertiary)" }}>Básico</span>
            <span style={{ fontSize:9, color:"var(--color-text-tertiary)" }}>Estratégico</span>
          </div>
        </div>
        <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", padding:"12px 14px" }}>
          <p style={{ margin:"0 0 8px", fontSize:11, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.04em" }}>NPS histórico</p>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
            <p style={{ margin:0, fontSize:32, fontWeight:800, fontFamily:FONT_DISPLAY, color:npsColor }}>{nps!==null?nps:"—"}</p>
            <div>
              <Badge label={npsLabel} color={npsColor} bg={npsColor+"20"}/>
              <p style={{ margin:"4px 0 0", fontSize:10, color:"var(--color-text-secondary)" }}>{allCSAT.length} evaluaciones</p>
            </div>
          </div>
          <div style={{ display:"flex", gap:6 }}>
            {[{l:"Promotores",c:"#1D9E75",v:prom},{l:"Pasivos",c:"#EF9F27",v:pas},{l:"Detractores",c:"#E24B4A",v:det}].map(x => (
              <div key={x.l} style={{ flex:1, background:x.c+"18", borderRadius:"var(--border-radius-md)", padding:"5px 6px", textAlign:"center" }}>
                <p style={{ margin:0, fontSize:14, fontWeight:500, color:x.c }}>{x.v}</p>
                <p style={{ margin:0, fontSize:9, color:x.c }}>{x.l}</p>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", padding:"12px 14px" }}>
          <p style={{ margin:"0 0 8px", fontSize:11, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.04em" }}>Canal preferido</p>
          {cObj ? (
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                <div style={{ width:36, height:36, borderRadius:"50%", background:cObj.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <i className={"ti "+cObj.icon} style={{ fontSize:18, color:cObj.color }} aria-hidden="true"/>
                </div>
                <div>
                  <p style={{ margin:0, fontSize:14, fontWeight:500, color:cObj.color }}>{cPref[0]}</p>
                  <p style={{ margin:0, fontSize:11, color:"var(--color-text-secondary)" }}>{cPref[1]} interacciones</p>
                </div>
              </div>
              <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                {cEntries.map(entry => {
                  const chO = CHANNELS.find(c=>c.label===entry[0])||CHANNELS[0];
                  return (
                    <div key={entry[0]} style={{ display:"flex", alignItems:"center", gap:3, background:chO.bg, borderRadius:20, padding:"2px 7px" }}>
                      <i className={"ti "+chO.icon} style={{ fontSize:9, color:chO.color }} aria-hidden="true"/>
                      <span style={{ fontSize:10, color:chO.color }}>{entry[0]} ({entry[1]})</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : <p style={{ margin:0, fontSize:12, color:"var(--color-text-tertiary)", fontStyle:"italic" }}>Sin historial suficiente</p>}
        </div>
        <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", padding:"12px 14px" }}>
          <p style={{ margin:"0 0 8px", fontSize:11, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.04em" }}>Score riesgo de fuga</p>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
            <p style={{ margin:0, fontSize:32, fontWeight:800, fontFamily:FONT_DISPLAY, color:fColor }}>{fScore}</p>
            <div>
              <Badge label={fLabel} color={fColor} bg={fColor+"20"}/>
              <p style={{ margin:"4px 0 0", fontSize:10, color:"var(--color-text-secondary)" }}>Promedio acumulado</p>
            </div>
          </div>
          <div style={{ background:"var(--color-background-secondary)", borderRadius:6, height:8, overflow:"hidden", marginBottom:8 }}>
            <div style={{ width:fScore+"%", height:"100%", background:fColor, borderRadius:6 }}/>
          </div>
          {sEvol.length > 0 && (
            <div>
              <p style={{ margin:"0 0 5px", fontSize:10, color:"var(--color-text-secondary)" }}>Sentimiento por sesión</p>
              <div style={{ display:"flex", alignItems:"flex-end", gap:3, height:32 }}>
                {sEvol.map((s,i) => {
                  const sO = SENTIMIENTOS.find(x=>x.id===s.sent)||SENTIMIENTOS[2];
                  return (
                    <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                      <div style={{ width:"100%", background:sO.color, borderRadius:"3px 3px 0 0", height:Math.max((s.score/100)*28,4)+"px" }}/>
                      <span style={{ fontSize:9, color:"var(--color-text-tertiary)" }}>S{s.i}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      <div style={{ background:THEME.celesteTint, border:"0.5px solid "+THEME.line2, borderRadius:"var(--border-radius-lg)", padding:"12px 14px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
          <i className="ti ti-sparkles" style={{ fontSize:14, color:THEME.celeste }} aria-hidden="true"/>
          <p style={{ margin:0, fontSize:12, fontWeight:500, color:THEME.navy }}>Recomendación KUDEN IA</p>
        </div>
        <p style={{ margin:0, fontSize:12, color:THEME.ink, lineHeight:1.6 }}>{rec}</p>
      </div>
    </div>
  );
}

function MetricasTab({ casesLog }) {
  if (casesLog.length === 0) return (
    <div style={{ textAlign:"center", padding:40 }}>
      <i className="ti ti-chart-bar" style={{ fontSize:32, color:"var(--color-text-tertiary)", display:"block", marginBottom:10 }} aria-hidden="true"/>
      <p style={{ color:"var(--color-text-secondary)", fontSize:13 }}>Cierra al menos un caso para ver las métricas</p>
    </div>
  );
  const total     = casesLog.length;
  const resueltos = casesLog.filter(c=>c.motivo==="resuelto").length;
  const escalados = casesLog.filter(c=>c.motivo==="escalado").length;
  const tasa      = Math.round((resueltos/total)*100);
  const cVals     = casesLog.map(c=>parseFloat(c.csatFinal)).filter(n=>!isNaN(n));
  const cProm     = cVals.length ? (cVals.reduce((a,b)=>a+b,0)/cVals.length).toFixed(1) : "—";
  const durs      = casesLog.map(c=>{ const p=c.duracion.split(":").map(Number); return p[0]*60+p[1]; });
  const dProm     = durs.length ? fmt(Math.round(durs.reduce((a,b)=>a+b,0)/durs.length)) : "—";
  const canalC={}, intC={}, sentC={}, fugaC={};
  casesLog.forEach(c=>{
    canalC[c.canal]=(canalC[c.canal]||0)+1;
    intC[c.intencion||"—"]=(intC[c.intencion||"—"]||0)+1;
    sentC[c.sentimientoFinal||"neutral"]=(sentC[c.sentimientoFinal||"neutral"]||0)+1;
    fugaC[c.fugaFinal||"sin_riesgo"]=(fugaC[c.fugaFinal||"sin_riesgo"]||0)+1;
  });
  const mxC = Math.max(...Object.values(canalC),1);
  const mxI = Math.max(...Object.values(intC),1);
  const kpis = [
    {l:"Casos totales",  v:""+total,   c:THEME.blue, i:"ti-inbox"},
    {l:"Tasa resolución",v:tasa+"%",   c:THEME.celeste, i:"ti-circle-check"},
    {l:"CSAT promedio",  v:cProm+" ★", c:"#EF9F27", i:"ti-star"},
    {l:"Duración prom.", v:dProm,       c:"#D85A30", i:"ti-clock"},
  ];
  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
        {kpis.map(k => (
          <div key={k.l} style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", padding:"12px 14px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
              <i className={"ti "+k.i} style={{ fontSize:14, color:k.c }} aria-hidden="true"/>
              <p style={{ margin:0, fontSize:10, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.04em" }}>{k.l}</p>
            </div>
            <p style={{ margin:0, fontSize:22, fontWeight:800, fontFamily:FONT_DISPLAY, color:k.c }}>{k.v}</p>
          </div>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", padding:"12px 14px" }}>
          <p style={{ margin:"0 0 10px", fontSize:12, fontWeight:500, color:"var(--color-text-primary)" }}>📡 Por canal</p>
          {Object.entries(canalC).map(entry => {
            const chO = CHANNELS.find(c=>c.label===entry[0])||CHANNELS[0];
            return (
              <div key={entry[0]} style={{ marginBottom:7 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <i className={"ti "+chO.icon} style={{ fontSize:11, color:chO.color }} aria-hidden="true"/>
                    <span style={{ fontSize:11, color:"var(--color-text-primary)" }}>{entry[0]}</span>
                  </div>
                  <span style={{ fontSize:11, fontWeight:500, color:chO.color }}>{entry[1]}</span>
                </div>
                <div style={{ background:"var(--color-background-secondary)", borderRadius:4, height:5, overflow:"hidden" }}>
                  <div style={{ width:((entry[1]/mxC)*100)+"%", height:"100%", background:chO.color, borderRadius:4 }}/>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", padding:"12px 14px" }}>
          <p style={{ margin:"0 0 10px", fontSize:12, fontWeight:500, color:"var(--color-text-primary)" }}>🎯 Por intención</p>
          {Object.entries(intC).map(entry => (
            <div key={entry[0]} style={{ marginBottom:7 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                <span style={{ fontSize:11, color:"var(--color-text-primary)" }}>{entry[0]}</span>
                <span style={{ fontSize:11, fontWeight:500, color:THEME.celesteDeep }}>{entry[1]}</span>
              </div>
              <div style={{ background:"var(--color-background-secondary)", borderRadius:4, height:5, overflow:"hidden" }}>
                <div style={{ width:((entry[1]/mxI)*100)+"%", height:"100%", background:THEME.celesteDeep, borderRadius:4 }}/>
              </div>
            </div>
          ))}
        </div>
        <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", padding:"12px 14px" }}>
          <p style={{ margin:"0 0 10px", fontSize:12, fontWeight:500, color:"var(--color-text-primary)" }}>😊 Sentimiento al cierre</p>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {SENTIMIENTOS.filter(s=>(sentC[s.id]||0)>0).map(s => (
              <div key={s.id} style={{ background:s.bg, border:"0.5px solid "+s.color+"40", borderRadius:"var(--border-radius-md)", padding:"8px 10px", textAlign:"center", minWidth:50 }}>
                <p style={{ margin:"0 0 2px", fontSize:18 }}>{s.emoji}</p>
                <p style={{ margin:"0 0 1px", fontSize:16, fontWeight:500, color:s.color }}>{sentC[s.id]}</p>
                <p style={{ margin:0, fontSize:9, color:s.color }}>{s.label.split(" ")[0]}</p>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", padding:"12px 14px" }}>
          <p style={{ margin:"0 0 10px", fontSize:12, fontWeight:500, color:"var(--color-text-primary)" }}>🚨 Riesgo de fuga</p>
          {RIESGO_FUGA.map(f => {
            const cnt = fugaC[f.id]||0;
            const pct = Math.round((cnt/total)*100);
            return (
              <div key={f.id} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                <i className={"ti "+f.icon} style={{ fontSize:13, color:f.color, flexShrink:0 }} aria-hidden="true"/>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                    <span style={{ fontSize:11, color:"var(--color-text-primary)" }}>{f.label}</span>
                    <span style={{ fontSize:11, fontWeight:500, color:f.color }}>{cnt} ({pct}%)</span>
                  </div>
                  <div style={{ background:"var(--color-background-secondary)", borderRadius:4, height:5, overflow:"hidden" }}>
                    <div style={{ width:pct+"%", height:"100%", background:f.color, borderRadius:4 }}/>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", padding:"12px 14px" }}>
        <p style={{ margin:"0 0 10px", fontSize:12, fontWeight:500, color:"var(--color-text-primary)" }}>⚡ Resolución autónoma KUDEN</p>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ flex:1 }}>
            <div style={{ background:"var(--color-background-secondary)", borderRadius:6, height:10, overflow:"hidden", marginBottom:6 }}>
              <div style={{ width:tasa+"%", height:"100%", background:THEME.celeste, borderRadius:6 }}/>
            </div>
            <span style={{ fontSize:10, color:"var(--color-text-secondary)" }}>✓ {resueltos} resueltos · {escalados} escalados · {total-resueltos-escalados} abandonados</span>
          </div>
          <div style={{ textAlign:"center", flexShrink:0 }}>
            <p style={{ margin:0, fontSize:28, fontWeight:800, fontFamily:FONT_DISPLAY, color:THEME.celeste }}>{tasa}%</p>
            <p style={{ margin:0, fontSize:10, color:"var(--color-text-secondary)" }}>tasa FCR</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── App principal ────────────────────────────────────────────────────────────
export default function KudenSimulator({ tenantId }) {
  const [profile,        setProfile]        = useState({ id: 'master', label: '🤖 Agente Maestro (Automático)', hint_text: 'Hola' });
  const [dbProfiles,     setDbProfiles]     = useState([]);
  const [masterConfig,   setMasterConfig]   = useState(null);
  const [cliente,        setCliente]        = useState(null);
  const [canal,          setCanal]          = useState("web");
  const [messages,       setMessages]       = useState([]);
  const [input,          setInput]          = useState("");
  const [loading,        setLoading]        = useState(false);
  const [action,         setAction]         = useState("En espera...");
  const [intencion,      setIntencion]      = useState(null);
  const [sentimiento,    setSentimiento]    = useState("neutral");
  const [fuga,           setFuga]           = useState("sin_riesgo");
  const [actionHistory,  setActionHistory]  = useState([]);
  const [ratings,        setRatings]        = useState({});
  const [crm,            setCrm]            = useState(null);
  const [closedCase,     setClosedCase]     = useState(null);
  const [casesLog,       setCasesLog]       = useState([]);
  const [elapsed,        setElapsed]        = useState(0);
  const [tab,            setTab]            = useState("chat");
  const [showModal,      setShowModal]      = useState(false);
  const [chatReady,      setChatReady]      = useState(false);
  const [resumen,        setResumen]        = useState(null);
  const [loadingResumen, setLoadingResumen] = useState(false);
  const [demoCliente,    setDemoCliente]    = useState(null);
  const [rutBusqueda,    setRutBusqueda]    = useState("");
  const [rutResultado,   setRutResultado]   = useState(null);
  const [rutBuscando,    setRutBuscando]    = useState(false);
  const [dbContacts,     setDbContacts]     = useState([]);

  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const historyRef = useRef([]);
  const timerRef   = useRef(null);
  const startRef   = useRef(null);
  const profileRef = useRef(null);
  const clienteRef = useRef(null);
  const canalRef   = useRef("web");
  const closedRef  = useRef(false);
  const loadingRef = useRef(false);
  const crmRef     = useRef(null);   // permite leer ticketId desde doSend (useCallback)

  profileRef.current = profile;
  clienteRef.current = cliente;
  canalRef.current   = canal;
  closedRef.current  = !!closedCase;
  loadingRef.current = loading;
  crmRef.current     = crm;

  useEffect(() => {
    if (tenantId) {
      // Cargar perfiles propios + plantillas globales de Kuden + config maestro + contactos
      Promise.all([
        supabase.from('ai_profiles').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: true }),
        supabase.from('ai_profiles').select('*').eq('is_global', true).neq('tenant_id', tenantId).order('label', { ascending: true }),
        supabase.from('contacts').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
        supabase.from('tenant_ai_config').select('*').eq('tenant_id', tenantId).single()
      ]).then(([ownRes, globalRes, contactsRes, configRes]) => {
        const own    = ownRes.data    || [];
        const global = globalRes.data || [];
        setDbProfiles([...own, ...global]);
        setDbContacts(contactsRes.data || []);
        if (configRes.data) setMasterConfig(configRes.data);
      });
    }
  }, [tenantId]);

  useEffect(() => { bottomRef.current && bottomRef.current.scrollIntoView({ behavior:"smooth" }); }, [messages, loading]);
  useEffect(() => {
    if (chatReady && !closedCase) {
      timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now()-startRef.current)/1000)), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [chatReady, closedCase]);

  const csatArr = Object.values(ratings);
  const csatAvg = csatArr.length ? csatArr.reduce((a,b)=>a+b,0)/csatArr.length : 0;
  const handleRate = (idx, star) => setRatings(prev => Object.assign({}, prev, { [idx]:star }));

  const doSend = useCallback(async (text, prof, cli, ch) => {
    if (!text||!text.trim()||loadingRef.current||closedRef.current) return;
    const userMsg = { role:"user", content:text };
    const newHistory = historyRef.current.concat([userMsg]);
    historyRef.current = newHistory;
    setMessages(prev => prev.concat([{ role:"user", text }]));
    setInput(""); setLoading(true); loadingRef.current=true; setAction("Procesando solicitud...");
    try {
      const chLabel = (CHANNELS.find(c=>c.id===ch)||CHANNELS[0]).label;
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/chat`, {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          model:"claude-sonnet-4-5",
          max_tokens:1000,
          system:buildSystem(masterConfig, prof, dbProfiles, cli, chLabel),
          messages:newHistory,
          contactData: {
            tenantId:      tenantId || null,
            clienteNombre: cli.nombre,
            rut:           cli.rut       || null,
            telefono:      cli.telefono  || null,
            direccion:     cli.direccion || null,
            plan:          cli.plan,
            canal:         chLabel,
            ticketId:      crmRef.current?.ticketId || null,
          },
        }),
      });
      const data = await res.json();
      const raw  = (data.content&&data.content[0]&&data.content[0].text)||"Lo siento, ocurrió un error.";
      const parsed = parseFull(raw);
      historyRef.current = newHistory.concat([{ role:"assistant", content:parsed.clean }]);
      setMessages(prev => prev.concat([{ role:"assistant", text:parsed.clean }]));
      if (parsed.accion)      { setAction(parsed.accion); setActionHistory(prev => [parsed.accion].concat(prev).slice(0,6)); }
      if (parsed.intencion)   setIntencion(parsed.intencion);
      if (parsed.sentimiento) setSentimiento(parsed.sentimiento);
      if (parsed.fuga)        setFuga(parsed.fuga);
      setCrm(prev => prev ? Object.assign({}, prev, { intencion:parsed.intencion||prev.intencion, estado:parsed.estado||prev.estado, turnos:prev.turnos+1 }) : prev);
    } catch(e) { setMessages(prev => prev.concat([{ role:"assistant", text:"Error de conexión." }])); }
    setLoading(false); loadingRef.current=false;
    inputRef.current && inputRef.current.focus();
  }, []);

  const launchChat = (form, prof) => {
    const fallbackProf = { id: 'master', label: '🤖 Agente Maestro (Automático)', hint_text: 'Hola' };
    const ch = form.canal||"web";
    const usedProf = prof || fallbackProf;
    setCliente(form); setCanal(ch);
    if (!profile) setProfile(usedProf);
    startRef.current = Date.now();
    const chLabel = (CHANNELS.find(c=>c.id===ch)||CHANNELS[0]).label;
    setCrm({ ticketId:genTkt(), nombre:form.nombre, rut:form.rut, telefono:form.telefono, plan:form.plan, direccion:form.direccion, canal:chLabel, intencion:"—", estado:"en progreso", turnos:0 });
    setChatReady(true);
    setSentimiento("neutral"); setFuga("sin_riesgo");
    setMessages([]); setActionHistory([]); setRatings({});
    setClosedCase(null); setResumen(null); setElapsed(0);
    historyRef.current = [];
    setTab("chat");
    doSend(usedProf.hint_text || usedProf.hint || "Hola", usedProf, form, ch);
  };

  const startChat = (form) => launchChat(form, profile);

  const selectDemoCliente = (dc) => {
    setDemoCliente(dc);
    const form = { nombre:dc.cliente_nombre, rut:dc.rut, telefono:dc.telefono, plan:dc.plan, direccion:dc.direccion, canal:dc.canal || "web" };
    launchChat(form, profile);
  };

  const formatRut = (val) => {
    const clean = val.replace(/[^0-9kK]/g,"").toUpperCase();
    if (clean.length < 2) return clean;
    const body = clean.slice(0,-1).replace(/\B(?=(\d{3})+(?!\d))/g,".");
    return body + "-" + clean.slice(-1);
  };

  const buscarPorRut = () => {
    const rut = rutBusqueda.trim();
    if (!rut) return;
    setRutBuscando(true); setRutResultado(null);
    setTimeout(() => {
      const norm = (s) => (s||"").replace(/[\.\-]/g,"").toLowerCase();
      const found = dbContacts.find(c => norm(c.rut) === norm(rut));
      setRutBuscando(false);
      if (found) { setRutResultado("encontrado"); selectDemoCliente(found); }
      else setRutResultado("no_encontrado");
    }, 800);
  };

  const handleRutKey = (e) => { if (e.key==="Enter") buscarPorRut(); };

  const sendMessage = (txt) => doSend(txt||input, profileRef.current, clienteRef.current, canalRef.current);
  const handleKey   = (e)   => { if (e.key==="Enter"&&!e.shiftKey) { e.preventDefault(); sendMessage(); } };

  const generarResumen = async (caseData, msgs) => {
    setLoadingResumen(true);
    const conv = msgs.map(m => (m.role==="user"?"Cliente":"KUDEN")+": "+m.text).join("\n");
    try {
      // Usa /api/summarize para persistir resumen_ejecutivo + todos los metadatos en Supabase
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/summarize`, {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          // Datos del contacto
          tenantId:         tenantId || null,
          clienteNombre:    caseData.nombre,
          rut:              caseData.rut       || null,
          telefono:         caseData.telefono  || null,
          direccion:        caseData.direccion || null,
          plan:             caseData.plan,
          canal:            caseData.canal,
          // Metadatos del caso
          motivoLabel:      caseData.motivoLabel,
          ticketId:         caseData.ticketId        || null,
          perfilCliente:    caseData.perfil           || null,
          duracion:         caseData.duracion         || null,
          csatFinal:        caseData.csatFinal        || null,
          sentimientoFinal: caseData.sentimientoFinal || null,
          fugaFinal:        caseData.fugaFinal        || null,
          intencion:        caseData.intencion        || null,
          estado:           caseData.estado           || null,
          totalMensajes:    caseData.totalMensajes     || null,
          // Transcripción para el resumen IA
          conversacion:     conv,
        }),
      });
      const data = await res.json();
      setResumen((data.content&&data.content[0]&&data.content[0].text)||"No se pudo generar el resumen.");
    } catch(e) { setResumen("Error al generar el resumen."); }
    setLoadingResumen(false);
  };

  const confirmClose = (motivo) => {
    clearInterval(timerRef.current);
    const opt = CLOSE_OPTIONS.find(o=>o.id===motivo)||CLOSE_OPTIONS[0];
    const newCase = Object.assign({}, crm, {
      perfil:profile&&profile.label, duracion:fmt(elapsed),
      csatFinal:csatAvg?csatAvg.toFixed(1):"Sin calificar",
      csatLabel:csatAvg?CSAT_LABELS[Math.round(csatAvg)]:"—",
      cerradoEn:new Date().toLocaleTimeString("es-CL"),
      totalMensajes:messages.length, motivo,
      motivoLabel:opt.label, motivoColor:opt.color, motivoBg:opt.bg, motivoIcon:opt.icon,
      sentimientoFinal:sentimiento, fugaFinal:fuga
    });
    setClosedCase(newCase);
    setCasesLog(prev => [newCase].concat(prev));
    setCrm(prev => Object.assign({}, prev, { estado:opt.estadoCRM||"en progreso" }));
    setShowModal(false); setTab("crm");
    generarResumen(newCase, messages);
  };

  const selectProfile = (p) => {
    clearInterval(timerRef.current);
    setProfile(p); setCliente(null); setCanal("web"); setMessages([]); setActionHistory([]);
    setAction("En espera..."); setIntencion(null); setChatReady(false);
    setSentimiento("neutral"); setFuga("sin_riesgo");
    setRatings({}); setCrm(null); setClosedCase(null); setElapsed(0); setResumen(null);
    setDemoCliente(null); setRutBusqueda(""); setRutResultado(null);
    setShowModal(false); historyRef.current=[]; setTab("chat");
  };

  const p        = profile;
  const activeCh = CHANNELS.find(c=>c.id===canal)||CHANNELS[0];
  const ec       = crm ? estadoConfig[crm.estado]||estadoConfig["en progreso"] : null;
  const sentObj  = SENTIMIENTOS.find(s=>s.id===sentimiento)||SENTIMIENTOS[2];
  const activeHistory = demoCliente ? demoCliente.historial : [];

  const TABS = [
    { id:"chat",      label:"💬 Chat" },
    { id:"crm",       label:"📋 CRM",      badge:crm?"LIVE":null, bc:THEME.celeste },
    { id:"historial", label:"🗂 Historial" },
    { id:"metricas",  label:"📊 Métricas", badge:casesLog.length||null, bc:"#534AB7" },
    { id:"perfil",    label:"👤 Perfil" },
  ];

  return (
    <div style={{ padding:"0.75rem 0", fontFamily:FONT_BODY, color:THEME.ink }}>
      {showModal && <CloseModal onClose={() => setShowModal(false)} onConfirm={confirmClose} csatAvg={csatAvg} elapsed={elapsed}/>}

      {/* Buscador por RUT */}
      <div style={{ marginBottom:12 }}>
        <p style={{ margin:"0 0 7px", fontSize:10, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em" }}>Buscar cliente por RUT</p>
        <div style={{ display:"flex", gap:8 }}>
          <input value={rutBusqueda}
            onChange={e => { setRutBusqueda(formatRut(e.target.value)); setRutResultado(null); }}
            onKeyDown={handleRutKey}
            placeholder="Ej: 12.345.678-9"
            maxLength={12}
            style={{ flex:1, fontSize:13, padding:"7px 10px", borderRadius:"var(--border-radius-md)",
              border: rutResultado==="no_encontrado"?"1.5px solid #E24B4A":rutResultado==="encontrado"?"1.5px solid "+THEME.celeste:"0.5px solid var(--color-border-tertiary)" }}
          />
          <button onClick={buscarPorRut} disabled={rutBuscando||!rutBusqueda.trim()}
            style={{ padding:"7px 16px", fontSize:12, fontWeight:600, cursor:rutBusqueda.trim()?"pointer":"not-allowed", background:THEME.gradBtn, color:"#fff", border:"none", borderRadius:"100px", opacity:rutBusqueda.trim()?1:0.5 }}>
            {rutBuscando ? "Buscando..." : "🔍 Buscar"}
          </button>
        </div>
        {rutResultado==="no_encontrado" && (
          <div style={{ marginTop:6, display:"flex", alignItems:"center", gap:6, padding:"6px 10px", background:"#FDECEA", border:"0.5px solid #E24B4A40", borderRadius:"var(--border-radius-md)" }}>
            <i className="ti ti-alert-circle" style={{ fontSize:13, color:"#E24B4A" }} aria-hidden="true"/>
            <p style={{ margin:0, fontSize:11, color:"#E24B4A" }}>RUT no encontrado. Verifica e intenta nuevamente.</p>
          </div>
        )}
        {rutResultado==="encontrado" && demoCliente && (
          <div style={{ marginTop:6, display:"flex", alignItems:"center", gap:8, padding:"10px 12px", background:THEME.celesteSoft, border:"0.5px solid "+THEME.line2, borderRadius:"var(--border-radius-md)" }}>
            <div style={{ width:36, height:36, borderRadius:"50%", background:segFromPlan(demoCliente.plan).bg, border:"2px solid "+segFromPlan(demoCliente.plan).color, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <span style={{ fontSize:15, fontWeight:600, color:segFromPlan(demoCliente.plan).color }}>{(demoCliente.cliente_nombre||"?")[0]}</span>
            </div>
            <div style={{ flex:1 }}>
              <p style={{ margin:"0 0 2px", fontSize:13, fontWeight:500, color:"var(--color-text-primary)" }}>{demoCliente.cliente_nombre}</p>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                <span style={{ fontSize:10, color:"var(--color-text-secondary)" }}>{demoCliente.rut}</span>
                <span style={{ fontSize:10, color:"var(--color-text-secondary)" }}>·</span>
                <span style={{ fontSize:10, color:"var(--color-text-secondary)" }}>{demoCliente.telefono}</span>
                <span style={{ fontSize:10, color:"var(--color-text-secondary)" }}>·</span>
                <Badge label={demoCliente.plan} color={segFromPlan(demoCliente.plan).color} bg={segFromPlan(demoCliente.plan).bg}/>
              </div>
              <p style={{ margin:"3px 0 0", fontSize:10, color:THEME.celesteDeep }}>{(demoCliente.historial?.length || 0)} casos en historial · {demoCliente.direccion}</p>
            </div>
            <div style={{ textAlign:"right", flexShrink:0 }}>
              <i className="ti ti-circle-check" style={{ fontSize:20, color:THEME.celeste }} aria-hidden="true"/>
              <p style={{ margin:"2px 0 0", fontSize:10, color:THEME.celesteDeep, fontWeight:500 }}>Cargado</p>
            </div>
          </div>
        )}
        <div style={{ marginTop:8 }}>
          <p style={{ margin:"0 0 5px", fontSize:10, color:"var(--color-text-tertiary)" }}>RUTs de prueba disponibles:</p>
          <div style={{ display:"flex", gap:5, flexWrap:"wrap", maxHeight:"150px", overflowY:"auto" }}>
            {dbContacts.map(dc => (
              <button key={dc.id} onClick={() => { setRutBusqueda(dc.rut); setRutResultado(null); }}
                style={{ fontSize:10, padding:"3px 8px", cursor:"pointer", borderRadius:20, background:"var(--color-background-secondary)", border:"0.5px solid var(--color-border-tertiary)", color:"var(--color-text-secondary)" }}>
                {dc.rut || "Sin RUT"} <span style={{ color:"var(--color-text-tertiary)" }}>· {(dc.cliente_nombre||"").split(" ")[0]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:0, marginBottom:10, borderBottom:"0.5px solid var(--color-border-tertiary)" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding:"6px 12px", fontSize:12, fontWeight:tab===t.id?500:400, cursor:"pointer", background:"none", border:"none",
              borderBottom:tab===t.id?"2px solid "+THEME.celeste:"2px solid transparent",
              color:tab===t.id?THEME.celesteDeep:"var(--color-text-secondary)",
              display:"flex", alignItems:"center", gap:4 }}>
            {t.label}
            {t.badge && <span style={{ background:t.bc, color:"#fff", borderRadius:10, fontSize:9, padding:"1px 5px" }}>{t.badge}</span>}
          </button>
        ))}
      </div>

      <div style={{ display:"flex", gap:12 }}>

        {/* ── CHAT ── */}
        {tab==="chat" && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", gap:10 }}>
            {!profile && !chatReady && (
              <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", padding:32, textAlign:"center" }}>
                <i className="ti ti-users" style={{ fontSize:28, color:"var(--color-text-tertiary)", display:"block", marginBottom:8 }} aria-hidden="true"/>
                <p style={{ color:"var(--color-text-secondary)", fontSize:12 }}>Busca un RUT o selecciona un cliente demo para comenzar</p>
              </div>
            )}
            {profile && !chatReady && <ClienteForm profile={profile} dbProfiles={dbProfiles} setProfile={setProfile} onStart={startChat}/>}
            {chatReady && p && (
              <div style={{ display:"flex", flexDirection:"column", background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", overflow:"hidden" }}>
                <div style={{ display:"flex", borderBottom:"0.5px solid var(--color-border-tertiary)", background:"var(--color-background-secondary)", padding:"0 12px" }}>
                  {CHANNELS.map(ch => (
                    <button key={ch.id} onClick={() => { if(!closedCase){ setCanal(ch.id); canalRef.current=ch.id; }}}
                      style={{ display:"flex", alignItems:"center", gap:4, padding:"7px 10px", fontSize:11, cursor:closedCase?"not-allowed":"pointer", background:"none", border:"none",
                        borderBottom:canal===ch.id?"2px solid "+ch.color:"2px solid transparent",
                        color:canal===ch.id?ch.color:"var(--color-text-tertiary)", fontWeight:canal===ch.id?500:400, whiteSpace:"nowrap" }}>
                      <i className={"ti "+ch.icon} style={{ fontSize:12 }} aria-hidden="true"/>{ch.label}
                    </button>
                  ))}
                </div>
                <div style={{ padding:"9px 14px", borderBottom:"0.5px solid var(--color-border-tertiary)", display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:32, height:32, borderRadius:"50%", background:"#fff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, border:"1px solid "+THEME.line2, overflow:"hidden" }}>
                    <img src={KUDEN_LOGO} alt="KUDEN" style={{ width:24, height:24, objectFit:"contain" }}/>
                  </div>
                  <div style={{ flex:1 }}>
                    <p style={{ margin:0, fontWeight:700, fontSize:13, color:THEME.navy, fontFamily:FONT_DISPLAY }}>KUDEN · ConectaChile</p>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <p style={{ margin:0, fontSize:10, color:THEME.celeste }}>● {cliente&&cliente.nombre?cliente.nombre.split(" ")[0]:"cliente"}</p>
                      <div style={{ display:"flex", alignItems:"center", gap:3, background:activeCh.bg, borderRadius:20, padding:"1px 7px" }}>
                        <i className={"ti "+activeCh.icon} style={{ fontSize:10, color:activeCh.color }} aria-hidden="true"/>
                        <span style={{ fontSize:10, color:activeCh.color, fontWeight:500 }}>{activeCh.label}</span>
                      </div>
                      <span style={{ fontSize:14 }}>{sentObj.emoji}</span>
                    </div>
                  </div>
                  {!closedCase && <span style={{ fontSize:11, color:"var(--color-text-secondary)", fontVariantNumeric:"tabular-nums" }}>⏱ {fmt(elapsed)}</span>}
                  {ec && <Badge label={ec.label} color={ec.color} bg={ec.bg}/>}
                </div>
                <div style={{ overflowY:"auto", padding:12, display:"flex", flexDirection:"column", gap:9, maxHeight:300 }}>
                  {messages.map((m,i) => (
                    <div key={i}>
                      <div style={{ display:"flex", justifyContent:m.role==="assistant"?"flex-start":"flex-end" }}>
                        {m.role==="assistant" && (
                          <div style={{ width:22, height:22, borderRadius:"50%", background:"#fff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginRight:5, alignSelf:"flex-end", border:"1px solid "+THEME.line2, overflow:"hidden" }}>
                            <img src={KUDEN_LOGO} alt="KUDEN" style={{ width:17, height:17, objectFit:"contain" }}/>
                          </div>
                        )}
                        <div style={{ maxWidth:"75%", padding:"8px 11px", fontSize:13, lineHeight:1.5,
                          borderRadius:m.role==="assistant"?"12px 12px 12px 3px":"12px 12px 3px 12px",
                          background:m.role==="assistant"?"var(--color-background-secondary)":p.color,
                          color:m.role==="assistant"?"var(--color-text-primary)":"#fff" }}>{m.text}</div>
                      </div>
                      {m.role==="assistant" && <div style={{ paddingLeft:27 }}><StarRating msgIndex={i} ratings={ratings} onRate={handleRate}/></div>}
                    </div>
                  ))}
                  {loading && (
                    <div style={{ display:"flex", alignItems:"flex-end", gap:5 }}>
                      <div style={{ width:22, height:22, borderRadius:"50%", background:"#fff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, border:"1px solid "+THEME.line2, overflow:"hidden" }}>
                        <img src={KUDEN_LOGO} alt="KUDEN" style={{ width:17, height:17, objectFit:"contain" }}/>
                      </div>
                      <div style={{ background:"var(--color-background-secondary)", borderRadius:"12px 12px 12px 3px", padding:"8px 12px" }}>
                        <span style={{ color:"var(--color-text-secondary)", fontSize:12 }}>escribiendo...</span>
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef}/>
                </div>
                <div style={{ padding:"8px 12px", borderTop:"0.5px solid var(--color-border-tertiary)", display:"flex", gap:6 }}>
                  <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKey}
                    placeholder={closedCase?"Caso cerrado":"Escribe por "+activeCh.label+"..."}
                    style={{ flex:1, fontSize:12 }} disabled={loading||!!closedCase}/>
                  {!closedCase && <button onClick={() => setShowModal(true)} style={{ padding:"0 10px", fontSize:11, cursor:"pointer", background:"#FAECE7", color:"#4A1B0C", border:"0.5px solid #F5C4B3", borderRadius:"var(--border-radius-md)", whiteSpace:"nowrap" }}>Cerrar caso ▾</button>}
                  <button onClick={() => sendMessage()} disabled={loading||!input.trim()||!!closedCase} style={{ padding:"0 12px", cursor:"pointer" }}>
                    <i className="ti ti-send" style={{ fontSize:14 }} aria-hidden="true"/>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CRM ── */}
        {tab==="crm" && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", gap:10 }}>
            {!crm ? (
              <div style={{ textAlign:"center", padding:40, color:"var(--color-text-secondary)", fontSize:13 }}>
                <i className="ti ti-database" style={{ fontSize:28, display:"block", marginBottom:8, color:"var(--color-text-tertiary)" }} aria-hidden="true"/>
                Selecciona un cliente demo o ingresa sus datos para comenzar
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {closedCase && (
                  <div style={{ background:closedCase.motivoBg||"#E1F5EE", border:"0.5px solid "+(closedCase.motivoColor||"#9FE1CB"), borderRadius:"var(--border-radius-lg)", padding:"12px 14px", display:"flex", alignItems:"center", gap:10 }}>
                    <i className={"ti "+(closedCase.motivoIcon||"ti-circle-check")} style={{ fontSize:20, color:closedCase.motivoColor||"#1D9E75" }} aria-hidden="true"/>
                    <div>
                      <p style={{ margin:0, fontWeight:500, fontSize:13, color:"var(--color-text-primary)" }}>Caso {closedCase.motivoLabel} · {closedCase.cerradoEn}</p>
                      <p style={{ margin:0, fontSize:11, color:"var(--color-text-secondary)" }}>Duración: {closedCase.duracion} · {closedCase.totalMensajes} mensajes · CSAT: {closedCase.csatFinal} ★</p>
                    </div>
                  </div>
                )}
                <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", padding:"12px 14px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                    <p style={{ margin:0, fontSize:12, fontWeight:500, color:"var(--color-text-primary)" }}>👤 Datos del cliente</p>
                    {ec && <Badge label={ec.label} color={ec.color} bg={ec.bg}/>}
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9 }}>
                    <Field label="Nombre"    value={crm.nombre}/>
                    <Field label="RUT"       value={crm.rut}/>
                    <Field label="Teléfono"  value={crm.telefono}/>
                    <Field label="Canal"     value={crm.canal}/>
                    <Field label="Plan"      value={crm.plan}/>
                    <Field label="Dirección" value={crm.direccion||"No informada"}/>
                  </div>
                </div>
                <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", padding:"12px 14px" }}>
                  <p style={{ margin:"0 0 9px", fontSize:12, fontWeight:500, color:"var(--color-text-primary)" }}>🎫 Caso · {crm.ticketId}</p>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9 }}>
                    <Field label="Intención" value={crm.intencion}/>
                    <Field label="Turnos"    value={crm.turnos}/>
                    <Field label="Duración"  value={closedCase?closedCase.duracion:fmt(elapsed)}/>
                    <Field label="CSAT"      value={csatAvg?csatAvg.toFixed(1)+" ★":"Sin calificar"}/>
                    {closedCase && <Field label="Motivo cierre" value={closedCase.motivoLabel}/>}
                  </div>
                </div>
                <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", padding:"12px 14px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
                    <i className="ti ti-sparkles" style={{ fontSize:14, color:"#534AB7" }} aria-hidden="true"/>
                    <p style={{ margin:0, fontSize:12, fontWeight:500, color:"var(--color-text-primary)" }}>Resumen IA</p>
                  </div>
                  {loadingResumen
                    ? <p style={{ margin:0, fontSize:12, color:"var(--color-text-secondary)", fontStyle:"italic" }}>Generando resumen...</p>
                    : resumen
                    ? <div>
                        <p style={{ margin:"0 0 8px", fontSize:12, color:"var(--color-text-primary)", lineHeight:1.6 }}>{resumen}</p>
                        <button onClick={() => navigator.clipboard&&navigator.clipboard.writeText(resumen)}
                          style={{ fontSize:11, padding:"4px 10px", cursor:"pointer", borderRadius:"var(--border-radius-md)", background:"#EEEDFE", color:"#534AB7", border:"0.5px solid #CECBF6" }}>
                          <i className="ti ti-copy" style={{ fontSize:11, marginRight:4 }} aria-hidden="true"/>Copiar
                        </button>
                      </div>
                    : <p style={{ margin:0, fontSize:12, color:"var(--color-text-tertiary)", fontStyle:"italic" }}>Disponible al cerrar el caso</p>
                  }
                </div>
                <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", padding:"12px 14px" }}>
                  <p style={{ margin:"0 0 8px", fontSize:12, fontWeight:500, color:"var(--color-text-primary)" }}>⚡ Log KUDEN</p>
                  {actionHistory.length===0
                    ? <p style={{ margin:0, fontSize:11, color:"var(--color-text-tertiary)", fontStyle:"italic" }}>Sin acciones aún</p>
                    : <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                        {actionHistory.map((a,i) => (
                          <div key={i} style={{ display:"flex", gap:6, alignItems:"flex-start" }}>
                            <div style={{ width:5, height:5, borderRadius:"50%", background:i===0?"#1D9E75":"var(--color-border-secondary)", flexShrink:0, marginTop:5 }}/>
                            <p style={{ margin:0, fontSize:11, color:i===0?"var(--color-text-primary)":"var(--color-text-secondary)", lineHeight:1.4 }}>{a}</p>
                          </div>
                        ))}
                      </div>
                  }
                </div>
                {!closedCase && <button onClick={() => setShowModal(true)} style={{ fontSize:12, padding:9, cursor:"pointer", background:"#FAECE7", color:"#4A1B0C", border:"0.5px solid #F5C4B3", borderRadius:"var(--border-radius-lg)", fontWeight:500 }}>Cerrar caso ▾</button>}
                {closedCase  && <button onClick={() => selectProfile(profile)} style={{ fontSize:12, padding:9, cursor:"pointer", borderRadius:"var(--border-radius-lg)" }}>Nueva conversación ↺</button>}
              </div>
            )}
          </div>
        )}

        {/* ── HISTORIAL ── */}
        {tab==="historial" && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", gap:10 }}>
            {cliente && p && (
              <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", padding:"12px 14px", display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:36, height:36, borderRadius:"50%", background:p.bg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <i className={"ti "+p.icon} style={{ fontSize:17, color:p.color }} aria-hidden="true"/>
                </div>
                <div>
                  <p style={{ margin:0, fontSize:13, fontWeight:500, color:"var(--color-text-primary)" }}>{cliente.nombre}</p>
                  <p style={{ margin:0, fontSize:11, color:"var(--color-text-secondary)" }}>{cliente.plan} · {cliente.rut}</p>
                </div>
              </div>
            )}
            <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", padding:"12px 14px" }}>
              <p style={{ margin:"0 0 10px", fontSize:12, fontWeight:500, color:"var(--color-text-primary)" }}>🗂 Casos en sesión</p>
              {casesLog.length===0 && <p style={{ fontSize:12, color:"var(--color-text-tertiary)", fontStyle:"italic", marginBottom:10 }}>Sin casos cerrados aún</p>}
              {casesLog.map((h,idx) => {
                const ec2  = estadoConfig[h.estado]||estadoConfig["en progreso"];
                const hCh  = CHANNELS.find(c=>c.label===h.canal)||CHANNELS[0];
                const csatN= parseFloat(h.csatFinal);
                const hS   = SENTIMIENTOS.find(s=>s.id===h.sentimientoFinal)||SENTIMIENTOS[2];
                return (
                  <div key={h.ticketId+"_"+idx} style={{ padding:"10px 12px", background:h.motivoBg||"#E1F5EE", border:"0.5px solid "+(h.motivoColor||"#9FE1CB")+"40", borderRadius:"var(--border-radius-md)", display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:5, flexWrap:"wrap", marginBottom:3 }}>
                        <p style={{ margin:0, fontSize:12, fontWeight:500, color:"var(--color-text-primary)" }}>{h.ticketId}</p>
                        {idx===0 && <span style={{ fontSize:9, background:h.motivoColor, color:"#fff", borderRadius:10, padding:"1px 5px" }}>nuevo</span>}
                        <Badge label={h.motivoLabel||ec2.label} color={h.motivoColor||ec2.color} bg={h.motivoBg||ec2.bg}/>
                        <div style={{ display:"flex", alignItems:"center", gap:3, background:hCh.bg, borderRadius:20, padding:"1px 6px" }}>
                          <i className={"ti "+hCh.icon} style={{ fontSize:9, color:hCh.color }} aria-hidden="true"/>
                          <span style={{ fontSize:9, color:hCh.color, fontWeight:500 }}>{h.canal}</span>
                        </div>
                        <span style={{ fontSize:11 }}>{hS.emoji}</span>
                      </div>
                      <p style={{ margin:0, fontSize:11, color:"var(--color-text-secondary)" }}>{h.nombre} · {h.intencion} · {h.cerradoEn}</p>
                    </div>
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <p style={{ margin:0, fontSize:13, color:!isNaN(csatN)?CSAT_COLORS[Math.round(csatN)]:"#ccc", fontWeight:500 }}>{!isNaN(csatN)?"★".repeat(Math.round(csatN)):"—"}</p>
                      <p style={{ margin:0, fontSize:10, color:"var(--color-text-secondary)" }}>{h.csatLabel}</p>
                    </div>
                  </div>
                );
              })}
              {activeHistory.length > 0 && (
                <div style={{ borderTop:"0.5px solid var(--color-border-tertiary)", paddingTop:10, marginTop:4 }}>
                  <p style={{ margin:"0 0 8px", fontSize:11, color:"var(--color-text-secondary)", fontWeight:500 }}>Historial del cliente</p>
                  {activeHistory.map(h => {
                    const ec2 = estadoConfig[h.estado]||estadoConfig["en progreso"];
                    const hCh = CHANNELS.find(c=>c.label===h.canal)||CHANNELS[0];
                    return (
                      <div key={h.id} style={{ padding:"10px 12px", background:"var(--color-background-secondary)", borderRadius:"var(--border-radius-md)", display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                            <p style={{ margin:0, fontSize:12, fontWeight:500, color:"var(--color-text-primary)" }}>{h.id}</p>
                            <Badge label={ec2.label} color={ec2.color} bg={ec2.bg}/>
                            <div style={{ display:"flex", alignItems:"center", gap:3, background:hCh.bg, borderRadius:20, padding:"1px 6px" }}>
                              <i className={"ti "+hCh.icon} style={{ fontSize:9, color:hCh.color }} aria-hidden="true"/>
                              <span style={{ fontSize:9, color:hCh.color, fontWeight:500 }}>{h.canal}</span>
                            </div>
                          </div>
                          <p style={{ margin:0, fontSize:11, color:"var(--color-text-secondary)" }}>{h.tipo} · {h.fecha}</p>
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <p style={{ margin:0, fontSize:13, color:CSAT_COLORS[h.csat], fontWeight:500 }}>{"★".repeat(h.csat)}</p>
                          <p style={{ margin:0, fontSize:10, color:"var(--color-text-secondary)" }}>{CSAT_LABELS[h.csat]}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── MÉTRICAS ── */}
        {tab==="metricas" && <MetricasTab casesLog={casesLog}/>}

        {/* ── PERFIL ── */}
        {tab==="perfil" && <PerfilTab cliente={cliente} casesLog={casesLog} fakeHistory={activeHistory}/>}

        {/* ── SIDE PANEL ── */}
        {tab==="chat" && chatReady && (
          <div style={{ width:168, display:"flex", flexDirection:"column", gap:9, flexShrink:0 }}>
            <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", padding:"10px 12px", textAlign:"center" }}>
              <p style={{ margin:"0 0 5px", fontSize:10, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em" }}>CSAT promedio</p>
              <p style={{ margin:"0 0 2px", fontSize:24, fontWeight:800, fontFamily:FONT_DISPLAY, color:csatAvg>=4?THEME.celeste:csatAvg>=3?"#EF9F27":csatAvg>=1?"#E24B4A":"var(--color-text-tertiary)" }}>{csatAvg?csatAvg.toFixed(1):"—"}</p>
              <p style={{ margin:0, fontSize:10, color:"var(--color-text-secondary)" }}>{csatArr.length} calificaciones</p>
            </div>
            <IntelPanel sentimiento={sentimiento} fuga={fuga} intencion={intencion} action={action} loading={loading}/>
          </div>
        )}
      </div>
    </div>
  );
}
