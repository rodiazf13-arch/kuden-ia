import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || '';

const CHANNELS = [
  { id:"webchat",  label:"Web Chat",  icon:"ti-world",          color:"#1D9E75", bg:"#E1F5EE" },
  { id:"whatsapp", label:"WhatsApp",  icon:"ti-brand-whatsapp", color:"#25D366", bg:"#E8F9EE" },
  { id:"email",    label:"Email",     icon:"ti-mail",           color:"#3b82f6", bg:"#dbeafe" },
  { id:"voz",      label:"Voz",       icon:"ti-phone",          color:"#534AB7", bg:"#EEEDFE" },
  { id:"app",      label:"App Móvil", icon:"ti-device-mobile",  color:"#D85A30", bg:"#FAECE7" },
  { id:"rrss",     label:"Redes Soc.",icon:"ti-share",          color:"#EF9F27", bg:"#FEF3E0" },
];

const CSAT_LABELS = ["","Muy malo","Malo","Regular","Bueno","Excelente"];
const CSAT_COLORS = ["","#E24B4A","#D85A30","#EF9F27","#1D9E75","#534AB7"];

const SENTIMIENTOS = [
  { id:"muy_negativo", label:"Muy frustrado", emoji:"🤬", color:"#E24B4A", bg:"#FDECEA", pct:10 },
  { id:"negativo",     label:"Frustrado",     emoji:"😠", color:"#D85A30", bg:"#FAECE7", pct:30 },
  { id:"neutral",      label:"Neutral",       emoji:"😐", color:"#EF9F27", bg:"#FEF3E0", pct:50 },
  { id:"positivo",     label:"Satisfecho",    emoji:"🙂", color:"#1D9E75", bg:"#E1F5EE", pct:75 },
  { id:"muy_positivo", label:"Muy satisfecho",emoji:"🤩", color:"#534AB7", bg:"#EEEDFE", pct:100 },
];

const RIESGO_FUGA = [
  { id:"sin_riesgo", label:"Sin riesgo",   color:"#1D9E75", bg:"#E1F5EE", icon:"ti-shield-check"   },
  { id:"bajo",       label:"Riesgo bajo",  color:"#EF9F27", bg:"#FEF3E0", icon:"ti-alert-triangle" },
  { id:"medio",      label:"Riesgo medio", color:"#D85A30", bg:"#FAECE7", icon:"ti-alert-triangle" },
  { id:"alto",       label:"Riesgo alto",  color:"#E24B4A", bg:"#FDECEA", icon:"ti-flame"          },
];

const segFromPlan = (plan) => {
  if (!plan) return { label:"Básico", color:"#D85A30", bg:"#FAECE7", score:25, desc:"Cliente inicial." };
  if (plan.includes("Empresas")||plan.includes("1GB")) return { label:"Estratégico", color:"#534AB7", bg:"#EEEDFE", score:100, desc:"Cliente de alto valor. Prioridad máxima." };
  if (plan.includes("500MB")||plan.includes("VIP"))    return { label:"Alto",        color:"#1D9E75", bg:"#E1F5EE", score:75,  desc:"Cliente consolidado. Buena rentabilidad." };
  if (plan.includes("200MB"))                          return { label:"Medio",       color:"#EF9F27", bg:"#FEF3E0", score:50,  desc:"Cliente en desarrollo. Potencial de upsell." };
  return { label:"Básico", color:"#D85A30", bg:"#FAECE7", score:25, desc:"Cliente inicial. Foco en retención." };
};

function Badge({ label, color, bg }) {
  return <span style={{ fontSize:10, fontWeight:500, color, background:bg, border:"0.5px solid "+color+"40", borderRadius:20, padding:"2px 8px" }}>{label}</span>;
}

function DashboardPerfil({ contact, conversations, c, isDark }) {
  const cd = contact;
  const seg = segFromPlan(cd.plan);
  const allCSAT = conversations.map(c=>parseFloat(c.csat_final)).filter(n=>!isNaN(n));
  const prom = allCSAT.filter(c=>c>=5).length;
  const det  = allCSAT.filter(c=>c<=2).length;
  const pas  = allCSAT.filter(c=>c===3||c===4).length;
  const nps  = allCSAT.length ? Math.round(((prom-det)/allCSAT.length)*100) : null;
  const npsColor = nps===null?"#aaa":nps>=50?"#1D9E75":nps>=0?"#EF9F27":"#E24B4A";
  const npsLabel = nps===null?"Sin datos":nps>=50?"Promotor":nps>=0?"Pasivo":"Detractor";
  
  const cFreq = {};
  conversations.forEach(conv=>{ 
    const can = conv.canal || 'webchat';
    cFreq[can]=(cFreq[can]||0)+1; 
  });
  const cEntries = Object.entries(cFreq).sort((a,b)=>b[1]-a[1]);
  const cPref = cEntries[0]||null;
  const cObj  = cPref ? CHANNELS.find(ch=>ch.label.toLowerCase().includes(cPref[0].toLowerCase()) || ch.id === cPref[0])||CHANNELS[0] : null;
  
  const fScores = { sin_riesgo:0, bajo:25, medio:60, alto:100 };
  const fVals   = conversations.map(c=>fScores[c.fuga_final]||0);
  const fScore  = fVals.length ? Math.round(fVals.reduce((a,b)=>a+b,0)/fVals.length) : 0;
  const fColor  = fScore>=70?"#E24B4A":fScore>=40?"#D85A30":fScore>=15?"#EF9F27":"#1D9E75";
  const fLabel  = fScore>=70?"Alto riesgo":fScore>=40?"Riesgo medio":fScore>=15?"Riesgo bajo":"Sin riesgo";
  
  const sScores = { muy_negativo:0, negativo:25, neutral:50, positivo:75, muy_positivo:100 };
  const sEvol   = conversations.slice(0,10).reverse().map((c,i)=>({ i:i+1, score:sScores[c.sentimiento_final]||50, sent:c.sentimiento_final }));
  
  const n0 = (cd.cliente_nombre||"El cliente").split(" ")[0];
  const rec = seg.score>=75
    ? n0+" es un cliente "+seg.label.toLowerCase()+". Se recomienda atención preferencial y beneficios de fidelización."
    : fScore>=60
    ? "⚠️ "+n0+" presenta riesgo de fuga elevado. Contacto proactivo recomendado."
    : nps!==null&&nps<0
    ? n0+" tiene historial de insatisfacción. Priorizar resolución al primer contacto y seguimiento."
    : "Perfil en desarrollo. Continúa registrando interacciones para afinar la segmentación.";

  const cardBg = isDark ? "rgba(255,255,255,0.02)" : "#fff";

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:15, paddingRight:10 }}>
      <div style={{ background:cardBg, border:"0.5px solid "+c.border, borderRadius:"12px", padding:"14px 16px", display:"flex", alignItems:"center", gap:14 }}>
        <div style={{ width:48, height:48, borderRadius:"50%", background:seg.bg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, border:"2px solid "+seg.color }}>
          <span style={{ fontSize:20, fontWeight:600, color:seg.color }}>{(cd.cliente_nombre||"?")[0].toUpperCase()}</span>
        </div>
        <div style={{ flex:1 }}>
          <p style={{ margin:"0 0 2px", fontSize:15, fontWeight:500, color:c.title }}>{cd.cliente_nombre}</p>
          <p style={{ margin:"0 0 5px", fontSize:12, color:c.subtitle }}>{cd.rut} • {cd.telefono}</p>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            <Badge label={cd.plan||"Sin plan"} color="#534AB7" bg="#EEEDFE"/>
            <Badge label={"Segmento "+seg.label} color={seg.color} bg={seg.bg}/>
          </div>
        </div>
      </div>
      
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:15 }}>
        {/* Segmento de valor */}
        <div style={{ background:cardBg, border:"0.5px solid "+c.border, borderRadius:"12px", padding:"15px" }}>
          <p style={{ margin:"0 0 8px", fontSize:11, color:c.subtitle, textTransform:"uppercase", letterSpacing:"0.04em" }}>Segmento de valor</p>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
            <div style={{ width:36, height:36, borderRadius:"50%", background:seg.bg, display:"flex", alignItems:"center", justifyContent:"center", border:"2px solid "+seg.color }}>
              <i className="ti ti-diamond" style={{ fontSize:16, color:seg.color }} aria-hidden="true"/>
            </div>
            <div>
              <p style={{ margin:0, fontSize:15, fontWeight:500, color:seg.color }}>{seg.label}</p>
              <p style={{ margin:0, fontSize:11, color:c.subtitle }}>{seg.desc}</p>
            </div>
          </div>
          <div style={{ background:isDark?"#333":"#f0f0f0", borderRadius:6, height:8, overflow:"hidden" }}>
            <div style={{ width:seg.score+"%", height:"100%", background:seg.color, borderRadius:6 }}/>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
            <span style={{ fontSize:9, color:c.subtitle }}>Básico</span>
            <span style={{ fontSize:9, color:c.subtitle }}>Estratégico</span>
          </div>
        </div>

        {/* NPS Histórico */}
        <div style={{ background:cardBg, border:"0.5px solid "+c.border, borderRadius:"12px", padding:"15px" }}>
          <p style={{ margin:"0 0 8px", fontSize:11, color:c.subtitle, textTransform:"uppercase", letterSpacing:"0.04em" }}>NPS histórico</p>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
            <p style={{ margin:0, fontSize:32, fontWeight:500, color:npsColor }}>{nps!==null?nps:"—"}</p>
            <div>
              <Badge label={npsLabel} color={npsColor} bg={npsColor+"20"}/>
              <p style={{ margin:"4px 0 0", fontSize:10, color:c.subtitle }}>{allCSAT.length} evaluaciones</p>
            </div>
          </div>
          <div style={{ display:"flex", gap:6 }}>
            {[{l:"Promotores",c:"#1D9E75",v:prom},{l:"Pasivos",c:"#EF9F27",v:pas},{l:"Detractores",c:"#E24B4A",v:det}].map(x => (
              <div key={x.l} style={{ flex:1, background:x.c+"18", borderRadius:"6px", padding:"5px 6px", textAlign:"center" }}>
                <p style={{ margin:0, fontSize:14, fontWeight:500, color:x.c }}>{x.v}</p>
                <p style={{ margin:0, fontSize:9, color:x.c }}>{x.l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Canal Preferido */}
        <div style={{ background:cardBg, border:"0.5px solid "+c.border, borderRadius:"12px", padding:"15px" }}>
          <p style={{ margin:"0 0 8px", fontSize:11, color:c.subtitle, textTransform:"uppercase", letterSpacing:"0.04em" }}>Canal preferido</p>
          {cObj ? (
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                <div style={{ width:36, height:36, borderRadius:"50%", background:cObj.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <i className={"ti "+cObj.icon} style={{ fontSize:18, color:cObj.color }} aria-hidden="true"/>
                </div>
                <div>
                  <p style={{ margin:0, fontSize:14, fontWeight:500, color:cObj.color }}>{cPref[0]}</p>
                  <p style={{ margin:0, fontSize:11, color:c.subtitle }}>{cPref[1]} interacciones</p>
                </div>
              </div>
              <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                {cEntries.map(entry => {
                  const chO = CHANNELS.find(ch=>ch.label.toLowerCase().includes(entry[0].toLowerCase()) || ch.id === entry[0])||CHANNELS[0];
                  return (
                    <div key={entry[0]} style={{ display:"flex", alignItems:"center", gap:3, background:chO.bg, borderRadius:20, padding:"2px 7px" }}>
                      <i className={"ti "+chO.icon} style={{ fontSize:9, color:chO.color }} aria-hidden="true"/>
                      <span style={{ fontSize:10, color:chO.color }}>{entry[0]} ({entry[1]})</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : <p style={{ margin:0, fontSize:12, color:c.subtitle, fontStyle:"italic" }}>Sin historial suficiente</p>}
        </div>

        {/* Score riesgo fuga */}
        <div style={{ background:cardBg, border:"0.5px solid "+c.border, borderRadius:"12px", padding:"15px" }}>
          <p style={{ margin:"0 0 8px", fontSize:11, color:c.subtitle, textTransform:"uppercase", letterSpacing:"0.04em" }}>Score riesgo de fuga</p>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
            <p style={{ margin:0, fontSize:32, fontWeight:500, color:fColor }}>{fScore}</p>
            <div>
              <Badge label={fLabel} color={fColor} bg={fColor+"20"}/>
              <p style={{ margin:"4px 0 0", fontSize:10, color:c.subtitle }}>Promedio acumulado</p>
            </div>
          </div>
          <div style={{ background:isDark?"#333":"#f0f0f0", borderRadius:6, height:8, overflow:"hidden", marginBottom:8 }}>
            <div style={{ width:fScore+"%", height:"100%", background:fColor, borderRadius:6 }}/>
          </div>
          {sEvol.length > 0 && (
            <div>
              <p style={{ margin:"0 0 5px", fontSize:10, color:c.subtitle }}>Sentimiento por sesión (últimas 10)</p>
              <div style={{ display:"flex", alignItems:"flex-end", gap:3, height:32 }}>
                {sEvol.map((s,i) => {
                  const sO = SENTIMIENTOS.find(x=>x.id===s.sent)||SENTIMIENTOS[2];
                  return (
                    <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 }} title={sO.label}>
                      <div style={{ width:"100%", background:sO.color, borderRadius:"3px 3px 0 0", height:Math.max((s.score/100)*28,4)+"px", opacity:0.8 }}/>
                      <span style={{ fontSize:9, color:c.subtitle }}>S{s.i}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div style={{ background:"#EEEDFE", border:"0.5px solid #CECBF6", borderRadius:"12px", padding:"15px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
          <i className="ti ti-sparkles" style={{ fontSize:14, color:"#534AB7" }} aria-hidden="true"/>
          <p style={{ margin:0, fontSize:12, fontWeight:500, color:"#26215C" }}>Recomendación KUDEN IA</p>
        </div>
        <p style={{ margin:0, fontSize:12, color:"#26215C", lineHeight:1.6 }}>{rec}</p>
      </div>
    </div>
  );
}

export default function Contact360View({ contact, onBack, onEdit, isDark, c, tenantId }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [globalSummary, setGlobalSummary] = useState(contact.global_summary || '');
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [activeTab, setActiveTab] = useState('perfil');

  useEffect(() => {
    fetchConversations();
  }, [contact.id]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          campaigns ( name )
        `)
        .eq('contact_id', contact.id)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      const convsWithMsgs = await Promise.all(
        data.map(async (conv) => {
          const { data: msgs } = await supabase
            .from('conversation_messages')
            .select('*')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: true });
          return { ...conv, messages: msgs || [] };
        })
      );
      setConversations(convsWithMsgs);
    } catch (e) {
      console.error("Error fetching conversations:", e);
    } finally {
      setLoading(false);
    }
  };

  const generateGlobalSummary = async () => {
    try {
      setGenerating(true);
      const res = await fetch(`${API_URL}/api/contacts/${contact.id}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId })
      });
      const data = await res.json();
      if (data.summary) {
        setGlobalSummary(data.summary);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  const timeAgo = (iso) => {
    if (!iso) return '—';
    const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (diff < 60) return 'hace ' + diff + 's';
    if (diff < 3600) return 'hace ' + Math.floor(diff / 60) + 'min';
    if (diff < 86400) return 'hace ' + Math.floor(diff / 3600) + 'h';
    return 'hace ' + Math.floor(diff / 86400) + 'd';
  };

  return (
    <div style={{ display: 'flex', gap: '20px', height: 'calc(100vh - 120px)' }}>
      {/* Columna Izquierda: Perfil y Resumen */}
      <div style={{ width: '350px', background: c.card, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: c.subtitle, cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', padding: 0 }}>
          <i className="ti ti-arrow-left"></i> Volver a contactos
        </button>

        <div style={{ textAlign: 'center', marginTop: '10px' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #2563eb, #7c3aed)', color: '#fff', fontSize: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px', fontWeight: 'bold' }}>
            {contact.cliente_nombre?.charAt(0).toUpperCase()}
          </div>
          <h2 style={{ margin: '0 0 5px', color: c.title, fontSize: '20px' }}>{contact.cliente_nombre}</h2>
          <p style={{ margin: 0, color: c.subtitle, fontSize: '14px' }}>{contact.email || contact.telefono}</p>
        </div>

        <button onClick={onEdit} style={{ width: '100%', padding: '10px', background: c.inputBg, border: `1px solid ${c.border}`, borderRadius: '8px', color: c.title, cursor: 'pointer', fontWeight: 500 }}>
          <i className="ti ti-edit"></i> Editar Contacto
        </button>

        <div style={{ background: c.sectionBg, padding: '15px', borderRadius: '8px', border: `1px solid ${c.border}` }}>
          <h3 style={{ margin: '0 0 10px', color: c.title, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <i className="ti ti-brain" style={{ color: '#7c3aed' }}></i> Resumen Global de IA
          </h3>
          <div style={{ fontSize: '13px', color: c.rowText, lineHeight: '1.5', minHeight: '60px' }}>
            {globalSummary ? (
              <span style={{ whiteSpace: 'pre-wrap' }}>{globalSummary}</span>
            ) : (
              <span style={{ color: c.subtitle }}>No hay un resumen generado aún.</span>
            )}
          </div>
          <button 
            onClick={generateGlobalSummary} 
            disabled={generating}
            style={{ marginTop: '15px', width: '100%', padding: '8px', background: '#7c3aed', border: 'none', borderRadius: '6px', color: '#fff', cursor: generating ? 'wait' : 'pointer', fontSize: '13px' }}
          >
            {generating ? 'Generando...' : 'Actualizar Resumen IA'}
          </button>
        </div>

        <div style={{ marginTop: 'auto' }}>
          <p style={{ margin: '0 0 5px', fontSize: '12px', color: c.subtitle }}>Plan / Producto</p>
          <p style={{ margin: 0, color: c.title, fontWeight: 500, fontSize: '14px' }}>{contact.plan || 'No definido'}</p>
        </div>
      </div>

      {/* Columna Derecha: Dashboard y Tabs */}
      <div style={{ flex: 1, background: c.card, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        <div style={{ display: 'flex', gap: '15px', borderBottom: `1px solid ${c.border}`, paddingBottom: '10px', marginBottom: '20px' }}>
          <button 
            onClick={() => setActiveTab('perfil')}
            style={{ 
              background: 'none', border: 'none', padding: '0 5px 10px', fontSize: '16px', fontWeight: 500, cursor: 'pointer',
              color: activeTab === 'perfil' ? c.title : c.subtitle,
              borderBottom: activeTab === 'perfil' ? '2px solid #3b82f6' : '2px solid transparent',
              marginBottom: '-11px', display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            <i className="ti ti-chart-pie"></i> Perfil Analítico
          </button>
          <button 
            onClick={() => setActiveTab('historial')}
            style={{ 
              background: 'none', border: 'none', padding: '0 5px 10px', fontSize: '16px', fontWeight: 500, cursor: 'pointer',
              color: activeTab === 'historial' ? c.title : c.subtitle,
              borderBottom: activeTab === 'historial' ? '2px solid #3b82f6' : '2px solid transparent',
              marginBottom: '-11px', display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            <i className="ti ti-history"></i> Historial Omnicanal
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <p style={{ color: c.subtitle, textAlign: 'center', marginTop: '40px' }}>Cargando datos...</p>
          ) : activeTab === 'perfil' ? (
            <DashboardPerfil contact={contact} conversations={conversations} c={c} isDark={isDark} />
          ) : conversations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: c.subtitle }}>
              <i className="ti ti-messages" style={{ fontSize: '40px', marginBottom: '10px', opacity: 0.5 }}></i>
              <p>Este cliente aún no tiene interacciones registradas.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', paddingRight: '10px' }}>
              {conversations.map(conv => {
                const isExpanded = expandedId === conv.id;
                return (
                  <div key={conv.id} style={{ border: `1px solid ${c.border}`, borderRadius: '8px', overflow: 'hidden', background: c.sectionBg }}>
                    {/* Header del Ticket */}
                    <div 
                      onClick={() => setExpandedId(isExpanded ? null : conv.id)}
                      style={{ padding: '15px', display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer', background: isExpanded ? c.inputBg : 'transparent' }}
                    >
                      <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#3b82f620', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                        <i className={`ti ${conv.canal === 'whatsapp' ? 'ti-brand-whatsapp' : conv.canal === 'email' ? 'ti-mail' : 'ti-messages'}`}></i>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <h4 style={{ margin: 0, color: c.title, fontSize: '15px' }}>{conv.motivo_label || 'Conversación'}</h4>
                          <span style={{ fontSize: '12px', color: c.subtitle }}>{timeAgo(conv.last_message_at || conv.updated_at)}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', fontSize: '12px', color: c.subtitle }}>
                          <span>Campaña: {conv.campaigns?.name || 'General'}</span>
                          <span>&bull;</span>
                          <span>Estado: {conv.status}</span>
                        </div>
                      </div>
                      <i className={`ti ti-chevron-${isExpanded ? 'up' : 'down'}`} style={{ color: c.subtitle }}></i>
                    </div>

                    {/* Contenido Expandido */}
                    {isExpanded && (
                      <div style={{ borderTop: `1px solid ${c.border}`, padding: '15px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* Resumen IA */}
                        {conv.resumen_ejecutivo && (
                          <div style={{ background: '#7c3aed10', border: '1px solid #7c3aed30', padding: '12px', borderRadius: '8px' }}>
                            <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 600, color: '#7c3aed', textTransform: 'uppercase' }}>Resumen Ejecutivo IA</p>
                            <p style={{ margin: 0, fontSize: '13px', color: c.rowText, whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{conv.resumen_ejecutivo}</p>
                          </div>
                        )}
                        
                        {conv.follow_up_note && (
                          <div style={{ background: '#f59e0b10', border: '1px solid #f59e0b30', padding: '12px', borderRadius: '8px' }}>
                            <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase' }}>Nota de Seguimiento (Pendiente)</p>
                            <p style={{ margin: '0 0 4px', fontSize: '13px', color: c.rowText }}>{conv.follow_up_note}</p>
                            {conv.follow_up_at && <p style={{ margin: 0, fontSize: '11px', color: c.subtitle }}>Para: {new Date(conv.follow_up_at).toLocaleString()}</p>}
                          </div>
                        )}

                        {/* Mensajes */}
                        <div>
                          <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 600, color: c.subtitle, textTransform: 'uppercase' }}>Registro de Chat</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: c.card, border: `1px solid ${c.border}`, padding: '15px', borderRadius: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                            {conv.messages && conv.messages.length > 0 ? conv.messages.map((m, idx) => {
                              const isCust = m.sender_type === 'customer';
                              const isSys = m.sender_type === 'system';
                              if (isSys) {
                                return (
                                  <div key={idx} style={{ textAlign: 'center', margin: '10px 0' }}>
                                    <span style={{ background: c.inputBg, color: c.subtitle, fontSize: '11px', padding: '4px 12px', borderRadius: '20px' }}>{m.content}</span>
                                  </div>
                                );
                              }
                              return (
                                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: isCust ? 'flex-end' : 'flex-start' }}>
                                  <span style={{ fontSize: '10px', color: c.subtitle, marginBottom: '2px', marginLeft: '4px', marginRight: '4px' }}>
                                    {m.sender_name || (isCust ? 'Cliente' : 'Agente')}
                                  </span>
                                  <div style={{ 
                                    maxWidth: '85%', padding: '8px 12px', borderRadius: '12px', fontSize: '13px', lineHeight: '1.4',
                                    background: isCust ? '#2563eb' : c.inputBg,
                                    color: isCust ? '#fff' : c.title,
                                    borderBottomRightRadius: isCust ? 0 : '12px',
                                    borderBottomLeftRadius: !isCust ? 0 : '12px',
                                  }}>
                                    {m.content}
                                  </div>
                                </div>
                              );
                            }) : (
                              <p style={{ margin: 0, fontSize: '12px', color: c.subtitle, textAlign: 'center' }}>No se encontraron mensajes grabados para esta interacción.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
