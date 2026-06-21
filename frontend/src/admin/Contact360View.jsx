import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || '';

const CHANNELS = [
  { id:"webchat",   label:"Web Chat",   icon:"ti-world",           color:"#1D9E75", bg:"#E1F5EE" },
  { id:"whatsapp",  label:"WhatsApp",   icon:"ti-brand-whatsapp",  color:"#25D366", bg:"#E8F9EE" },
  { id:"email",     label:"Email",      icon:"ti-mail",            color:"#3b82f6", bg:"#dbeafe" },
  { id:"voz",       label:"Voz",        icon:"ti-phone",           color:"#534AB7", bg:"#EEEDFE" },
  { id:"app",       label:"App Móvil",  icon:"ti-device-mobile",   color:"#D85A30", bg:"#FAECE7" },
  { id:"rrss",      label:"Redes Soc.", icon:"ti-share",           color:"#EF9F27", bg:"#FEF3E0" },
  { id:"instagram", label:"Instagram",  icon:"ti-brand-instagram", color:"#C13584", bg:"#FAE5F2" },
];
const CHANNEL_DEFAULT = { icon:"ti-messages", color:"#64748B", bg:"#F1F5F9" };

const CSAT_LABELS = ["","Muy malo","Malo","Regular","Bueno","Excelente"];
const CSAT_COLORS = ["","#E24B4A","#D85A30","#EF9F27","#1D9E75","#00A6FF"];

const SENTIMIENTOS = [
  { id:"muy_negativo", label:"Muy frustrado", emoji:"🤬", color:"#E24B4A", bg:"#FDECEA", pct:10 },
  { id:"negativo",     label:"Frustrado",     emoji:"😠", color:"#D85A30", bg:"#FAECE7", pct:30 },
  { id:"neutral",      label:"Neutral",       emoji:"😐", color:"#EF9F27", bg:"#FEF3E0", pct:50 },
  { id:"positivo",     label:"Satisfecho",    emoji:"🙂", color:"#1D9E75", bg:"#E1F5EE", pct:75 },
  { id:"muy_positivo", label:"Muy satisfecho",emoji:"🤩", color:"#00A6FF", bg:"#EBF7FF", pct:100 },
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

function DashboardPerfil({ contact, conversations }) {
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

  return (
    <div className="contact-360-dashboard">
      <div className="contact-360-card contact-360-header-card">
        <div className="contact-360-header-avatar" style={{ background: seg.bg, borderColor: seg.color }}>
          <span style={{ color: seg.color }}>{(cd.cliente_nombre||"?")[0].toUpperCase()}</span>
        </div>
        <div className="contact-360-header-info">
          <p className="contact-360-header-name">{cd.cliente_nombre}</p>
          <p className="contact-360-header-meta">{cd.rut} • {cd.telefono}</p>
          <div className="contact-360-header-badges">
            <span className="contact-badge-plan">{cd.plan || 'Sin plan'}</span>
            <span className="contact-badge-status activo" style={{ color: seg.color, background: seg.bg, borderColor: seg.color + '40' }}>
              Segmento {seg.label}
            </span>
          </div>
        </div>
      </div>
      
      <div className="contact-360-dashboard-grid">
        {/* Segmento de valor */}
        <div className="contact-360-card">
          <p className="contact-360-card-title">Segmento de valor</p>
          <div className="contact-360-card-header">
            <div className="contact-360-card-icon-container" style={{ background: seg.bg, borderColor: seg.color }}>
              <i className="ti ti-diamond contact-360-card-icon" style={{ color: seg.color }} aria-hidden="true" />
            </div>
            <div>
              <p className="contact-360-card-title-text" style={{ color: seg.color }}>{seg.label}</p>
              <p className="contact-360-card-subtitle">{seg.desc}</p>
            </div>
          </div>
          <div className="contact-360-progress-bg">
            <div className="contact-360-progress-fill" style={{ width: seg.score + '%', background: seg.color }} />
          </div>
          <div className="contact-360-progress-labels">
            <span className="contact-360-progress-label">Básico</span>
            <span className="contact-360-progress-label">Estratégico</span>
          </div>
        </div>

        {/* NPS Histórico */}
        <div className="contact-360-card">
          <p className="contact-360-card-title">NPS histórico</p>
          <div className="contact-360-card-header">
            <p className="contact-360-card-value" style={{ color: npsColor }}>{nps!==null?nps:"—"}</p>
            <div>
              <span className="contact-badge-nps" style={{ color: npsColor, background: npsColor + '20', borderColor: npsColor + '40' }}>
                {npsLabel}
              </span>
              <p className="contact-360-card-value-meta">{allCSAT.length} evaluaciones</p>
            </div>
          </div>
          <div className="nps-breakdown-container">
            {[{l:"Promotores",c:"#1D9E75",v:prom},{l:"Pasivos",c:"#EF9F27",v:pas},{l:"Detractores",c:"#E24B4A",v:det}].map(x => (
              <div key={x.l} className="nps-breakdown-item" style={{ background: x.c + '18' }}>
                <p style={{ color: x.c }}>{x.v}</p>
                <p style={{ color: x.c }}>{x.l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Canal Preferido */}
        <div className="contact-360-card">
          <p className="contact-360-card-title">Canal preferido</p>
          {cObj ? (
            <div>
              <div className="contact-360-card-header">
                <div className="contact-360-card-icon-container" style={{ background: cObj.bg }}>
                  <i className={'ti ' + cObj.icon + ' contact-360-card-icon-lg'} style={{ color: cObj.color }} aria-hidden="true" />
                </div>
                <div>
                  <p className="contact-360-card-title-text" style={{ color: cObj.color }}>{cPref[0]}</p>
                  <p className="contact-360-card-subtitle">{cPref[1]} interacciones</p>
                </div>
              </div>
              <div className="contact-360-channels-list">
                {cEntries.map(entry => {
                  const chO = CHANNELS.find(ch=>ch.label.toLowerCase().includes(entry[0].toLowerCase()) || ch.id === entry[0])||CHANNELS[0];
                  return (
                    <div key={entry[0]} className="contact-360-channel-pill" style={{ background: chO.bg }}>
                      <i className={'ti ' + chO.icon + ' contact-360-channel-pill-icon'} style={{ color: chO.color }} aria-hidden="true" />
                      <span className="contact-360-channel-pill-text" style={{ color: chO.color }}>{entry[0]} ({entry[1]})</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : <p className="contact-360-empty-text">Sin historial suficiente</p>}
        </div>

        {/* Score riesgo fuga */}
        <div className="contact-360-card">
          <p className="contact-360-card-title">Score riesgo de fuga</p>
          <div className="contact-360-card-header">
            <p className="contact-360-card-value" style={{ color: fColor }}>{fScore}</p>
            <div>
              <span className="contact-badge-risk" style={{ color: fColor, background: fColor + '20', borderColor: fColor + '40' }}>
                {fLabel}
              </span>
              <p className="contact-360-card-value-meta">Promedio acumulado</p>
            </div>
          </div>
          <div className="contact-360-progress-bg" style={{ marginBottom: 8 }}>
            <div className="contact-360-progress-fill" style={{ width: fScore + '%', background: fColor }} />
          </div>
          {sEvol.length > 0 && (
            <div>
              <p className="contact-360-evolution-title">Sentimiento por sesión (últimas 10)</p>
              <div className="sentiment-bar-chart">
                {sEvol.map((s, i) => {
                  const sO = SENTIMIENTOS.find(x => x.id === s.sent) || SENTIMIENTOS[2];
                  return (
                    <div key={i} className="sentiment-chart-bar" title={sO.label}>
                      <div className="sentiment-chart-bar-fill" style={{ background: sO.color, height: Math.max(s.score, 12) + '%' }} />
                      <span>S{s.i}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="contact-360-rec-card">
        <div className="contact-360-rec-header">
          <i className="ti ti-sparkles" aria-hidden="true" />
          <p>Recomendación KUDEN IA</p>
        </div>
        <p className="contact-360-rec-text">{rec}</p>
      </div>
    </div>
  );
}

export default function Contact360View({ contact, onBack, onEdit, isDark, c, tenantId, userId }) {
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

  const handleStartConversation = async (canal) => {
    try {
      // 1. Crear conversacion
      const { data, error } = await supabase.from('conversations').insert({
        tenant_id: tenantId,
        contact_id: contact.id,
        status: 'human_active',
        canal: canal,
        motivo_label: 'Conversación Saliente',
        assigned_to: userId,
        ticket_id: 'KUD-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
        last_message_at: new Date().toISOString()
      }).select();

      if (error) throw error;
      
      if (data && data.length > 0) {
        const newConvId = data[0].id;
        // 2. Guardar en localStorage
        localStorage.setItem('kuden_open_conv_id', newConvId);
        // 3. Emitir evento para cambiar al CRM
        window.dispatchEvent(new CustomEvent('changeTab', { detail: 'crm' }));
      }
    } catch (err) {
      console.error('Error iniciando conversación:', err);
      alert('Hubo un error al iniciar la conversación.');
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
    <div className="contact-360-wrapper">
      {/* Columna Izquierda: Perfil y Resumen */}
      <div className="contact-360-sidebar">
        <button onClick={onBack} className="integration-btn-link contact-360-back-btn">
          <i className="ti ti-arrow-left"></i> Volver a contactos
        </button>

        <div className="contact-360-profile-info">
          <div className="contact-360-avatar">
            {contact.cliente_nombre?.charAt(0).toUpperCase()}
          </div>
          <h2>{contact.cliente_nombre}</h2>
          <p>{contact.email || contact.telefono}</p>
        </div>

        <button onClick={onEdit} className="integration-btn-secondary contact-360-sidebar-btn">
          <i className="ti ti-edit"></i> Editar Contacto
        </button>

        <div className="contact-360-action-box">
          <h3>
            <i className="ti ti-message-share"></i> Iniciar Conversación
          </h3>
          <div className="contact-360-channels-list contact-360-action-list">
            <button onClick={() => handleStartConversation('whatsapp')} className="contact-360-action-btn whatsapp">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg> Enviar un WhatsApp
            </button>
            <button onClick={() => handleStartConversation('email')} className="contact-360-action-btn email">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 48 48"><path fill="#4caf50" d="M45,16.2l-5,2.75l-5,4.75L24,31.5L5,17V10c0-2.209,1.791-4,4-4h30c2.209,0,4,1.791,4,4V16.2z"/><path fill="#1e88e5" d="M3,16.2l5,2.75l5,4.75l11,7.8l11-7.8l5-4.75l5-2.75V38c0,2.209-1.791,4-4,4H9c-2.209,0-4-1.791-4-4V16.2z"/><path fill="#e53935" d="M24,31.5L5,17L3,16.2C3,15.709,3,15.209,3,14.71C3,12.109,5.109,10,7.71,10H14L24,31.5z"/><path fill="#ffb300" d="M45,16.2L43,17l-19,14.5l10-21.5h6.29C42.891,10,45,12.109,45,14.71C45,15.209,45,15.709,45,16.2z"/></svg> Enviar un Email
            </button>
            <button onClick={() => handleStartConversation('instagram')} className="contact-360-action-btn instagram">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="url(#ig-grad-360)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/><defs><linearGradient id="ig-grad-360" x1="12" x2="12" y1="2" y2="22" gradientUnits="userSpaceOnUse"><stop stopColor="#f09433"/><stop offset=".25" stopColor="#e6683c"/><stop offset=".5" stopColor="#dc2743"/><stop offset=".75" stopColor="#cc2366"/><stop offset="1" stopColor="#bc1888"/></linearGradient></defs></svg> Enviar DM Instagram
            </button>
          </div>
        </div>

        <div className="contact-360-summary-box">
          <h3>
            <i className="ti ti-brain"></i> Resumen Global de IA
          </h3>
          <div className="contact-360-summary-text">
            {globalSummary ? (
              <span className="contact-360-summary-content">{globalSummary}</span>
            ) : (
              <span className="contact-360-summary-empty">No hay un resumen generado aún.</span>
            )}
          </div>
          <button 
            onClick={generateGlobalSummary} 
            disabled={generating}
            className="integration-btn-primary contact-360-sidebar-btn"
          >
            {generating ? 'Generando...' : 'Actualizar Resumen IA'}
          </button>
        </div>

        <div className="contact-360-sidebar-footer">
          <p>Plan / Producto</p>
          <p>{contact.plan || 'No definido'}</p>
        </div>
      </div>

      {/* Columna Derecha: Dashboard y Tabs */}
      <div className="contact-360-main-pane">
        
        <div className="contact-360-tabs">
          <button 
            onClick={() => setActiveTab('perfil')}
            className={`contact-360-tab-btn ${activeTab === 'perfil' ? 'active' : ''}`}
          >
            <i className="ti ti-chart-pie"></i> Perfil Analítico
          </button>
          <button 
            onClick={() => setActiveTab('historial')}
            className={`contact-360-tab-btn ${activeTab === 'historial' ? 'active' : ''}`}
          >
            <i className="ti ti-history"></i> Historial Omnicanal
          </button>
        </div>

        <div className="contact-360-scrollable-content">
          {loading ? (
            <p className="contact-360-loading">Cargando datos...</p>
          ) : activeTab === 'perfil' ? (
            <DashboardPerfil contact={contact} conversations={conversations} />
          ) : conversations.length === 0 ? (
            <div className="contact-360-empty-state">
              <i className="ti ti-messages" aria-hidden="true"></i>
              <p>Este cliente aún no tiene interacciones registradas.</p>
            </div>
          ) : (
            <div className="contact-360-history-list">
              {conversations.map(conv => {
                const isExpanded = expandedId === conv.id;
                return (
                  <div key={conv.id} className="history-ticket-card">
                    {/* Header del Ticket */}
                    <div 
                      onClick={() => setExpandedId(isExpanded ? null : conv.id)}
                      className={`history-ticket-header ${isExpanded ? 'expanded' : ''}`}
                    >
                      {(() => {
                        const ch = CHANNELS.find(c => c.id === conv.canal) || CHANNEL_DEFAULT;
                        return (
                          <div className="history-ticket-icon" style={{ background: ch.bg, color: ch.color }}>
                            <i className={`ti ${ch.icon}`} aria-hidden="true"></i>
                          </div>
                        );
                      })()}
                      <div className="history-ticket-meta">
                        <div className="history-ticket-meta-top">
                          <h4 className="history-ticket-title">{conv.motivo_label || 'Conversación'}</h4>
                          <span className="history-ticket-time">{timeAgo(conv.last_message_at || conv.updated_at)}</span>
                        </div>
                        <div className="history-ticket-meta-bottom">
                          <span>Campaña: {conv.campaigns?.name || 'General'}</span>
                          <span>&bull;</span>
                          <span>Estado: {conv.status}</span>
                        </div>
                      </div>
                      <i className={`ti ti-chevron-${isExpanded ? 'up' : 'down'} history-ticket-chevron`} aria-hidden="true"></i>
                    </div>

                    {/* Contenido Expandido */}
                    {isExpanded && (
                      <div className="history-ticket-body">
                        {/* Resumen IA */}
                        {conv.resumen_ejecutivo && (
                          <div className="history-ticket-summary-ia">
                            <p className="history-ticket-summary-ia-title">Resumen Ejecutivo IA</p>
                            <p className="history-ticket-summary-ia-text">{conv.resumen_ejecutivo}</p>
                          </div>
                        )}
                        
                        {conv.follow_up_note && (
                          <div className="history-ticket-followup">
                            <p className="history-ticket-followup-title">Nota de Seguimiento (Pendiente)</p>
                            <p className="history-ticket-followup-text">{conv.follow_up_note}</p>
                            {conv.follow_up_at && <p className="history-ticket-followup-date">Para: {new Date(conv.follow_up_at).toLocaleString()}</p>}
                          </div>
                        )}

                        {/* Mensajes */}
                        <div>
                          <p className="history-chat-title">Registro de Chat</p>
                          <div className="history-chat-container">
                            {conv.messages && conv.messages.length > 0 ? conv.messages.map((m, idx) => {
                              const isCust = m.sender_type === 'customer';
                              const isSys = m.sender_type === 'system';
                              if (isSys) {
                                return (
                                  <div key={idx} className="history-chat-bubble-system">
                                    <span className="history-chat-bubble-system-text">{m.content}</span>
                                  </div>
                                );
                              }
                              return (
                                <div key={idx} className={`history-chat-bubble ${isCust ? 'customer' : 'agent'}`}>
                                  <span className="history-chat-bubble-sender">
                                    {m.sender_name || (isCust ? 'Cliente' : 'Agente')}
                                  </span>
                                  <div className="history-chat-bubble-content">
                                    {m.content && m.content.includes('🔗 Grabación:') ? (
                                      m.content.split('\n').map((line, idx, arr) => {
                                        if (line.includes('🔗 Grabación:') && line.includes('http')) {
                                          const url = line.replace('🔗 Grabación:', '').trim();
                                          return (
                                            <div key={idx} className="history-chat-recording-wrapper">
                                              <a 
                                                href={url} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                download
                                                className="recording-download-btn"
                                              >
                                                <i className="ti ti-download"></i>
                                                Descargar Grabación
                                              </a>
                                            </div>
                                          );
                                        }
                                        return <div key={idx}>{line}</div>;
                                      })
                                    ) : m.content}
                                  </div>
                                </div>
                              );
                            }) : (
                              <p className="history-chat-empty">No se encontraron mensajes grabados para esta interacción.</p>
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
