import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || '';

// ── Helpers ──────────────────────────────────────────────────────────────────
const timeAgo = (iso) => {
  if (!iso) return '—';
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60)   return 'hace ' + diff + 's';
  if (diff < 3600) return 'hace ' + Math.floor(diff / 60) + 'min';
  if (diff < 86400) return 'hace ' + Math.floor(diff / 3600) + 'h';
  return 'hace ' + Math.floor(diff / 86400) + 'd';
};

const STATUS_CONFIG = {
  active:        { label: 'IA Activa',          color: '#1D9E75', bg: '#E1F5EE', icon: 'ti-robot'             },
  waiting_human: { label: 'Esperando Humano',   color: '#EF9F27', bg: '#FEF3E0', icon: 'ti-alert-triangle'    },
  human_active:  { label: 'Ejecutivo Activo',   color: '#2563eb', bg: '#EFF6FF', icon: 'ti-user-check'        },
  pending_csat:  { label: 'Pendiente CSAT',     color: '#D85A30', bg: '#FAECE7', icon: 'ti-star'              },
  resolved:      { label: 'Resuelto por IA',    color: '#1D9E75', bg: '#E1F5EE', icon: 'ti-circle-check'      },
  closed:        { label: 'Cerrado',            color: '#6b7280', bg: '#f3f4f6', icon: 'ti-lock'              },
  abandoned:     { label: 'Abandonado',         color: '#E24B4A', bg: '#FDECEA', icon: 'ti-circle-x'          },
  pending_followup: { label: 'Pendiente Seg.',  color: '#EF9F27', bg: '#FEF3E0', icon: 'ti-clock'             },
};

const SENTIMIENTO_CONFIG = {
  muy_negativo: { label: 'Muy frustrado',  emoji: '😠', color: '#E24B4A', bg: '#FDECEA', pct: 10  },
  negativo:     { label: 'Frustrado',      emoji: '😕', color: '#D85A30', bg: '#FAECE7', pct: 30  },
  neutral:      { label: 'Neutral',        emoji: '😐', color: '#EF9F27', bg: '#FEF3E0', pct: 50  },
  positivo:     { label: 'Satisfecho',     emoji: '🙂', color: '#1D9E75', bg: '#E1F5EE', pct: 75  },
  muy_positivo: { label: 'Muy satisfecho', emoji: '😊', color: '#534AB7', bg: '#EEEDFE', pct: 100 },
};

const FUGA_CONFIG = {
  sin_riesgo: { label: 'Sin riesgo',   color: '#1D9E75', bg: '#E1F5EE', icon: 'ti-shield-check'   },
  bajo:       { label: 'Riesgo bajo',  color: '#EF9F27', bg: '#FEF3E0', icon: 'ti-alert-triangle' },
  medio:      { label: 'Riesgo medio', color: '#D85A30', bg: '#FAECE7', icon: 'ti-alert-triangle' },
  alto:       { label: 'Riesgo alto',  color: '#E24B4A', bg: '#FDECEA', icon: 'ti-flame'          },
};

function StatusBadge({ status }) {
  const s = STATUS_CONFIG[status] || STATUS_CONFIG.active;
  return (
    <span style={{ fontSize: 10, fontWeight: 600, color: s.color, background: s.bg,
      border: `0.5px solid ${s.color}40`, borderRadius: 20, padding: '2px 8px',
      display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
      <i className={`ti ${s.icon}`} style={{ fontSize: 10 }} />
      {s.label}
    </span>
  );
}

// ── Panel de Inteligencia IA (derecha en el detalle) ─────────────────────────
function IntelPanel({ conv, c }) {
  const sent = SENTIMIENTO_CONFIG[conv.sentimiento_final] || SENTIMIENTO_CONFIG.neutral;
  const fuga = FUGA_CONFIG[conv.fuga_final]               || FUGA_CONFIG.sin_riesgo;

  const segScore = (() => {
    const plan = conv.contacts?.plan || '';
    if (plan.includes('Empresas') || plan.includes('1GB')) return { label: 'Estratégico', color: '#534AB7', score: 100 };
    if (plan.includes('500MB') || plan.includes('VIP'))    return { label: 'Alto',        color: '#1D9E75', score: 75  };
    if (plan.includes('200MB'))                            return { label: 'Medio',       color: '#EF9F27', score: 50  };
    return { label: 'Básico', color: '#D85A30', score: 25 };
  })();

  const rec = conv.fuga_final === 'alto'
    ? '⚠️ Riesgo de fuga elevado. Se recomienda contacto proactivo e intervención humana.'
    : conv.sentimiento_final === 'muy_negativo' || conv.sentimiento_final === 'negativo'
    ? 'Cliente con frustración detectada. Considera tomar el control para una atención empática.'
    : 'Conversación dentro de parámetros normales. La IA está gestionando adecuadamente.';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Sentimiento */}
      <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 10, padding: '10px 12px' }}>
        <p style={{ margin: '0 0 6px', fontSize: 10, color: c.subtitle, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sentimiento</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
          <span style={{ fontSize: 20 }}>{sent.emoji}</span>
          <div style={{ flex: 1 }}>
            <p style={{ margin: '0 0 3px', fontSize: 11, fontWeight: 500, color: sent.color }}>{sent.label}</p>
            <div style={{ background: c.inputBg, borderRadius: 4, height: 5, overflow: 'hidden' }}>
              <div style={{ width: sent.pct + '%', height: '100%', background: sent.color, borderRadius: 4, transition: 'width 0.6s' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Riesgo de Fuga */}
      <div style={{ background: fuga.bg, border: `0.5px solid ${fuga.color}40`, borderRadius: 10, padding: '10px 12px' }}>
        <p style={{ margin: '0 0 5px', fontSize: 10, color: c.subtitle, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Riesgo de Fuga</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className={`ti ${fuga.icon}`} style={{ fontSize: 16, color: fuga.color }} />
          <p style={{ margin: 0, fontSize: 11, fontWeight: 500, color: fuga.color }}>{fuga.label}</p>
        </div>
      </div>

      {/* Intención */}
      <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 10, padding: '10px 12px' }}>
        <p style={{ margin: '0 0 5px', fontSize: 10, color: c.subtitle, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Intención detectada</p>
        {conv.intencion
          ? <span style={{ fontSize: 11, fontWeight: 500, color: '#085041', background: '#E1F5EE', border: '0.5px solid #1D9E7540', borderRadius: 20, padding: '2px 8px' }}>{conv.intencion}</span>
          : <p style={{ margin: 0, fontSize: 11, color: c.subtitle, fontStyle: 'italic' }}>Sin datos</p>}
      </div>

      {/* Segmento de valor */}
      <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 10, padding: '10px 12px' }}>
        <p style={{ margin: '0 0 5px', fontSize: 10, color: c.subtitle, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Segmento de Valor</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className="ti ti-diamond" style={{ fontSize: 14, color: segScore.color }} />
          <p style={{ margin: 0, fontSize: 11, fontWeight: 500, color: segScore.color }}>{segScore.label}</p>
        </div>
        <div style={{ background: c.inputBg, borderRadius: 4, height: 5, overflow: 'hidden', marginTop: 5 }}>
          <div style={{ width: segScore.score + '%', height: '100%', background: segScore.color, borderRadius: 4 }} />
        </div>
      </div>

      {/* Recomendación IA */}
      <div style={{ background: '#EEEDFE', border: '0.5px solid #CECBF6', borderRadius: 10, padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
          <i className="ti ti-sparkles" style={{ fontSize: 13, color: '#534AB7' }} />
          <p style={{ margin: 0, fontSize: 11, fontWeight: 500, color: '#26215C' }}>Recomendación KUDEN</p>
        </div>
        <p style={{ margin: 0, fontSize: 11, color: '#26215C', lineHeight: 1.5 }}>{rec}</p>
      </div>

      {/* CSAT */}
      {conv.csat_final && (
        <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 2px', fontSize: 10, color: c.subtitle, textTransform: 'uppercase' }}>CSAT</p>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 500, color: '#EF9F27' }}>{parseFloat(conv.csat_final).toFixed(1)} ★</p>
        </div>
      )}
    </div>
  );
}

// ── Burbuja de mensaje ────────────────────────────────────────────────────────
function MessageBubble({ msg, c }) {
  const isCustomer    = msg.sender_type === 'customer';
  const isAI          = msg.sender_type === 'ai';
  const isHuman       = msg.sender_type === 'human_agent';
  const isSystem      = msg.sender_type === 'system';
  const isNote        = msg.is_internal_note;

  if (isSystem) return (
    <div style={{ textAlign: 'center', padding: '4px 0' }}>
      <span style={{ fontSize: 11, color: c.subtitle, fontStyle: 'italic' }}>⚙️ {msg.content}</span>
    </div>
  );

  if (isNote) return (
    <div style={{ background: '#FEF9C3', border: '1px solid #FDE047', borderRadius: 10, padding: '8px 12px', margin: '4px 0' }}>
      <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 600, color: '#92400E' }}>🔒 NOTA INTERNA · {msg.sender_name}</p>
      <p style={{ margin: 0, fontSize: 12, color: '#78350F', lineHeight: 1.5 }}>{msg.content}</p>
    </div>
  );

  return (
    <div style={{ display: 'flex', justifyContent: isCustomer ? 'flex-end' : 'flex-start', marginBottom: 6 }}>
      {!isCustomer && (
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0, marginRight: 6, alignSelf: 'flex-end',
          background: isAI ? '#1D9E75' : '#2563eb',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i className={`ti ${isAI ? 'ti-robot' : 'ti-user'}`} style={{ fontSize: 13, color: '#fff' }} />
        </div>
      )}
      <div style={{ maxWidth: '72%' }}>
        {!isCustomer && (
          <p style={{ margin: '0 0 2px', fontSize: 10, color: c.subtitle, paddingLeft: 2 }}>
            {isAI ? '🤖 KUDEN IA' : `👨‍💼 ${msg.sender_name || 'Ejecutivo'}`}
          </p>
        )}
        <div style={{
          padding: '8px 12px', fontSize: 13, lineHeight: 1.5,
          borderRadius: isCustomer ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
          background: isCustomer ? '#e5e7eb' : isAI ? '#1D9E7520' : '#2563eb20',
          color: isCustomer ? '#111' : isAI ? '#085041' : '#1e40af',
          border: isCustomer ? 'none' : `0.5px solid ${isAI ? '#1D9E7540' : '#2563eb40'}`,
        }}>
          {msg.content}
        </div>
        <p style={{ margin: '2px 0 0', fontSize: 9, color: c.subtitle, paddingLeft: isCustomer ? 0 : 2, textAlign: isCustomer ? 'right' : 'left' }}>
          {msg.created_at ? new Date(msg.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : ''}
        </p>
      </div>
    </div>
  );
}

// ── Vista de detalle de conversación ─────────────────────────────────────────
function ConversationDetail({ convId, tenantId, userId, displayName, userRole, isSuperAdmin, c, campaigns = [], onBack }) {
  const [data,       setData]       = useState(null);
  const [messages,   setMessages]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [sending,    setSending]    = useState(false);
  const [input,      setInput]      = useState('');
  const [isNote,     setIsNote]     = useState(false);
  const [actionMsg,  setActionMsg]  = useState('');
  const [showInfo,   setShowInfo]   = useState(false);  // panel lateral colapsado por defecto
  const [closingMode, setClosingMode] = useState(false);
  const [pendingMode, setPendingMode] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpTime, setFollowUpTime] = useState('');
  const [followUpNote, setFollowUpNote] = useState('');
  const [typifications, setTypifications] = useState([]);
  const [selectedTyp, setSelectedTyp] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const bottomRef = useRef(null);
  const lastMsgCountRef = useRef(0);

  const fetchDetail = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/crm/conversations/${convId}`);
      if (!res.ok) return; // Omitir si la llamada falla, para evitar parpadeos
      const json = await res.json();
      
      if (json && json.conversation) {
        setData(prev => {
          const newJson = JSON.stringify(json.conversation);
          return JSON.stringify(prev) !== newJson ? json.conversation : prev;
        });
      }
      
      if (json && Array.isArray(json.messages)) {
        setMessages(prev => {
          const newMsgs = json.messages;
          // Sólo hacemos scroll hacia abajo si aumentó la cantidad de mensajes
          if (newMsgs.length > lastMsgCountRef.current) {
            lastMsgCountRef.current = newMsgs.length;
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
          }
          return JSON.stringify(prev) !== JSON.stringify(newMsgs) ? newMsgs : prev;
        });
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [convId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  // Polling every 5s — smart update prevents unnecessary re-renders
  useEffect(() => {
    const t = setInterval(fetchDetail, 5000);
    return () => clearInterval(t);
  }, [fetchDetail]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/api/crm/conversations/${convId}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, userId, displayName, content: input, isInternalNote: isNote }),
      });
      if (res.ok) { setInput(''); await fetchDetail(); }
    } catch (e) { console.error(e); }
    setSending(false);
  };

  const handleSuggestAI = async () => {
    setSuggesting(true);
    try {
      const res = await fetch(`${API_URL}/api/crm/conversations/${convId}/suggest`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, userId, displayName }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.suggestion) {
          setInput(data.suggestion);
          setIsNote(false);
        }
      }
    } catch (e) { console.error(e); }
    setSuggesting(false);
  };

  const doAction = async (endpoint, successMsg, extraBody = {}) => {
    setActionMsg('');
    try {
      const res = await fetch(`${API_URL}/api/crm/conversations/${convId}/${endpoint}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, userId, displayName, ...extraBody }),
      });
      if (res.ok) { setActionMsg(successMsg); setClosingMode(false); await fetchDetail(); }
    } catch (e) { console.error(e); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: c.subtitle }}>Cargando conversación...</div>;
  if (!data)   return <div style={{ padding: 40, textAlign: 'center', color: c.subtitle }}>No se encontró la conversación.</div>;

  const conv    = data;
  const contact = conv.contacts || {};
  const status  = conv.status;
  const isMyConv = conv.assigned_to === userId;
  const canAct  = isSuperAdmin || userRole === 'admin' || isMyConv || !conv.assigned_to;

  // Botones según estado
  const renderActions = () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {(status === 'active' || status === 'waiting_human') && canAct && (
        <button onClick={() => doAction('takeover', 'Has tomado el control de la conversación.')}
          style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer',
            background: status === 'waiting_human' ? '#EF9F27' : '#2563eb', color: '#fff' }}>
          ⚡ Tomar Control
        </button>
      )}
      {status === 'human_active' && isMyConv && !closingMode && !pendingMode && (
        <>
          <button onClick={() => doAction('release', 'Control devuelto a KUDEN IA.')}
            style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8, border: `1px solid ${c.border}`, cursor: 'pointer', background: 'transparent', color: c.subtitle }}>
            🤖 Devolver a IA
          </button>
          <button onClick={() => setPendingMode(true)}
            style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8, border: `1px solid ${c.border}`, cursor: 'pointer', background: '#FEF3E0', color: '#EF9F27' }}>
            ⏳ Dejar Pendiente
          </button>
          <button onClick={async () => {
            if (conv.campaign_id) {
              const res = await fetch(`${API_URL}/api/crm/campaigns/${conv.campaign_id}/typifications`);
              if (res.ok) setTypifications(await res.json());
            } else { setTypifications([]); }
            setClosingMode(true);
          }}
            style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#1D9E75', color: '#fff' }}>
            ✅ Cerrar
          </button>
        </>
      )}
      {status === 'human_active' && isMyConv && closingMode && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: c.inputBg, padding: '4px 8px', borderRadius: 8, border: `1px solid ${c.border}` }}>
          <span style={{ fontSize: 11, color: c.subtitle }}>Tipificar:</span>
          <select value={selectedTyp} onChange={e => setSelectedTyp(e.target.value)} style={{ fontSize: 11, padding: '4px', borderRadius: 4, border: `1px solid ${c.border}`, background: c.card, color: c.inputText }}>
            <option value="">Seleccione motivo...</option>
            {typifications.map(t => <option key={t.id} value={t.label}>{t.label}</option>)}
          </select>
          <button onClick={() => doAction('close', 'Conversación cerrada. CSAT pendiente.', { motivoLabel: selectedTyp })}
            disabled={!selectedTyp && typifications.length > 0}
            style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: 'none', cursor: (!selectedTyp && typifications.length > 0) ? 'not-allowed' : 'pointer', background: '#1D9E75', color: '#fff', opacity: (!selectedTyp && typifications.length > 0) ? 0.5 : 1 }}>
            Confirmar
          </button>
          <button onClick={() => setClosingMode(false)} style={{ background: 'transparent', border: 'none', color: c.subtitle, cursor: 'pointer', fontSize: 11 }}>Cancelar</button>
        </div>
      )}
      {status === 'human_active' && isMyConv && pendingMode && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: '#FEF3E0', padding: '4px 8px', borderRadius: 8, border: `1px solid #EF9F27` }}>
          <input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} style={{ fontSize: 11, padding: '4px', borderRadius: 4, border: `1px solid #EF9F27`, background: '#fff', color: '#333' }} />
          <input type="time" value={followUpTime} onChange={e => setFollowUpTime(e.target.value)} style={{ fontSize: 11, padding: '4px', borderRadius: 4, border: `1px solid #EF9F27`, background: '#fff', color: '#333' }} />
          <input type="text" placeholder="Nota..." value={followUpNote} onChange={e => setFollowUpNote(e.target.value)} style={{ fontSize: 11, padding: '4px', borderRadius: 4, border: `1px solid #EF9F27`, background: '#fff', color: '#333', width: 120 }} />
          
          <button onClick={() => doAction('close', 'Conversación dejada en pendiente.', { isPending: true, followUpAt: new Date(`${followUpDate}T${followUpTime}`).toISOString(), followUpNote })}
            disabled={!followUpDate || !followUpTime}
            style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: 'none', cursor: (!followUpDate || !followUpTime) ? 'not-allowed' : 'pointer', background: '#EF9F27', color: '#fff', opacity: (!followUpDate || !followUpTime) ? 0.5 : 1 }}>
            Confirmar
          </button>
          <button onClick={() => setPendingMode(false)} style={{ background: 'transparent', border: 'none', color: '#EF9F27', cursor: 'pointer', fontSize: 11 }}>Cancelar</button>
        </div>
      )}
      {status === 'pending_csat' && canAct && (
        <button onClick={() => doAction('close', 'Conversación cerrada sin CSAT.', { force: true })}
          style={{ padding: '7px 14px', fontSize: 12, borderRadius: 8, border: `1px solid ${c.border}`, cursor: 'pointer', background: 'transparent', color: c.subtitle }}>
          Cerrar sin CSAT
        </button>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${c.border}`, background: c.card, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: c.subtitle, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
          <i className="ti ti-arrow-left" /> Bandeja
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: c.title }}>{contact.cliente_nombre || '—'}</p>
            <span style={{ fontSize: 11, color: c.subtitle, fontFamily: 'monospace' }}>{conv.ticket_id}</span>
            <StatusBadge status={status} />
            {conv.canal && <span style={{ fontSize: 10, padding: '2px 6px', background: c.inputBg, borderRadius: 10, color: c.subtitle, border: `0.5px solid ${c.border}` }}>{conv.canal}</span>}
            {/* Reasignación manual de campaña */}
            {campaigns.length > 0 && (
              <select 
                value={conv.campaign_id || ''} 
                onChange={(e) => doAction('campaign', 'Campaña reasignada exitosamente.', { campaignId: e.target.value || null })}
                style={{ fontSize: 10, padding: '2px 6px', background: c.card, borderRadius: 10, color: c.title, border: `1px solid ${c.border}`, outline: 'none', maxWidth: 150, cursor: (!isMyConv && !isSuperAdmin && userRole !== 'admin') ? 'not-allowed' : 'pointer' }}
                disabled={!isMyConv && !isSuperAdmin && userRole !== 'admin'}
              >
                <option value="">Sin campaña</option>
                {campaigns.map(cam => <option key={cam.id} value={cam.id}>{cam.name}</option>)}
              </select>
            )}
          </div>
        </div>
        {/* Toggle panel lateral */}
        <button
          onClick={() => setShowInfo(v => !v)}
          title={showInfo ? 'Ocultar panel' : 'Ver ficha y análisis IA'}
          style={{ padding: '5px 10px', fontSize: 12, borderRadius: 8, border: `1px solid ${c.border}`,
            background: showInfo ? '#2563eb15' : 'transparent', color: showInfo ? '#2563eb' : c.subtitle,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
        >
          <i className={`ti ${showInfo ? 'ti-layout-sidebar-right-collapse' : 'ti-layout-sidebar-right'}`} style={{ fontSize: 14 }} />
          {showInfo ? 'Ocultar' : 'Info'}
        </button>
        {renderActions()}
      </div>
      {actionMsg && <div style={{ padding: '8px 16px', background: '#1D9E7515', borderBottom: `1px solid ${c.border}`, fontSize: 12, color: '#1D9E75' }}>✓ {actionMsg}</div>}

      {/* Body: Chat + Panel colapsable */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

        {/* Chat */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
            {messages.map(m => <MessageBubble key={m.id} msg={m} c={c} />)}
            <div ref={bottomRef} />
          </div>
          {/* Input ejecutivo */}
          {(status === 'human_active' && isMyConv) || isSuperAdmin || userRole === 'admin' ? (
            <div style={{ padding: '10px 12px', borderTop: `1px solid ${c.border}`, background: c.card }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <button onClick={() => setIsNote(false)}
                  style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: `1px solid ${!isNote ? '#2563eb' : c.border}`, background: !isNote ? '#2563eb15' : 'transparent', color: !isNote ? '#2563eb' : c.subtitle, cursor: 'pointer' }}>
                  💬 Mensaje
                </button>
                <button onClick={() => setIsNote(true)}
                  style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: `1px solid ${isNote ? '#EF9F27' : c.border}`, background: isNote ? '#EF9F2715' : 'transparent', color: isNote ? '#EF9F27' : c.subtitle, cursor: 'pointer' }}>
                  🔒 Nota interna
                </button>
                <button onClick={handleSuggestAI} disabled={suggesting}
                  style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: `1px solid #1D9E75`, background: '#1D9E7515', color: '#1D9E75', cursor: suggesting ? 'wait' : 'pointer', opacity: suggesting ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {suggesting ? <i className="ti ti-loader" style={{ animation: 'spin 1s linear infinite' }} /> : <i className="ti ti-sparkles" />} Sugerencia IA
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder={isNote ? 'Nota interna (no visible al cliente)...' : 'Escribe un mensaje...'}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${isNote ? '#FDE047' : c.border}`, background: isNote ? '#FEF9C3' : c.inputBg, color: c.inputText, fontSize: 13, outline: 'none' }} />
                <button onClick={sendMessage} disabled={sending || !input.trim()}
                  style={{ padding: '8px 16px', background: isNote ? '#EF9F27' : '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: input.trim() ? 'pointer' : 'not-allowed', opacity: input.trim() ? 1 : 0.5 }}>
                  <i className="ti ti-send" style={{ fontSize: 14 }} />
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: '10px 16px', borderTop: `1px solid ${c.border}`, background: c.card, fontSize: 12, color: c.subtitle, textAlign: 'center' }}>
              {status === 'active' ? 'La IA está manejando esta conversación. Toma el control para escribir.' : 'Conversación cerrada.'}
            </div>
          )}
        </div>

        {/* Panel lateral: Ficha + IA (colapsable) */}
        {showInfo && (
          <div style={{ width: 220, borderLeft: `1px solid ${c.border}`, overflowY: 'auto', background: c.card, display: 'flex', flexDirection: 'column' }}>
            {/* Ficha del cliente */}
            <div style={{ padding: '10px 12px', borderBottom: `1px solid ${c.border}` }}>
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, color: c.subtitle, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cliente</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {[
                  ['Nombre',    contact.cliente_nombre],
                  ['RUT',       contact.rut],
                  ['Teléfono',  contact.telefono],
                  ['Email',     contact.email],
                  ['Plan',      contact.plan],
                  ['Empresa',   contact.empresa],
                ].map(([l, v]) => v ? (
                  <div key={l}>
                    <p style={{ margin: '0 0 1px', fontSize: 9, color: c.subtitle, textTransform: 'uppercase' }}>{l}</p>
                    <p style={{ margin: 0, fontSize: 11, color: c.title, wordBreak: 'break-all' }}>{v}</p>
                  </div>
                ) : null)}
              </div>
              <hr style={{ border: 'none', borderTop: `1px solid ${c.border}`, margin: '8px 0' }} />
              <p style={{ margin: '0 0 5px', fontSize: 11, fontWeight: 600, color: c.subtitle, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Caso</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div>
                  <p style={{ margin: '0 0 1px', fontSize: 9, color: c.subtitle, textTransform: 'uppercase' }}>Ticket</p>
                  <p style={{ margin: 0, fontSize: 11, fontFamily: 'monospace', color: c.title }}>{conv.ticket_id || '—'}</p>
                </div>
                <div>
                  <p style={{ margin: '0 0 1px', fontSize: 9, color: c.subtitle, textTransform: 'uppercase' }}>Último mensaje</p>
                  <p style={{ margin: 0, fontSize: 11, color: c.title }}>{conv.last_message_at ? new Date(conv.last_message_at).toLocaleString('es-CL') : '—'}</p>
                </div>
                {conv.campaigns && (
                  <div style={{ background: `${conv.campaigns.color}15`, border: `0.5px solid ${conv.campaigns.color}40`, borderRadius: 8, padding: '5px 8px' }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: conv.campaigns.color }}>{conv.campaigns.name}</p>
                  </div>
                )}
              </div>
            </div>
            {/* Panel de Inteligencia IA */}
            <div style={{ padding: '10px 12px' }}>
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, color: c.subtitle, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Inteligencia IA</p>
              <IntelPanel conv={conv} c={c} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Fila de la bandeja ────────────────────────────────────────────────────────
function ConvRow({ conv, isSelected, onClick, c }) {
  const contact  = conv.contacts || {};
  const campaign = conv.campaigns;
  const sent     = SENTIMIENTO_CONFIG[conv.sentimiento_final] || SENTIMIENTO_CONFIG.neutral;
  const fuga     = FUGA_CONFIG[conv.fuga_final]               || FUGA_CONFIG.sin_riesgo;
  const initials = (n) => n ? n.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() : '?';

  return (
    <div onClick={onClick} style={{
      padding: '10px 12px', borderBottom: `1px solid ${c.border}`, cursor: 'pointer',
      background: isSelected ? '#2563eb15' : 'transparent',
      borderLeft: isSelected ? '3px solid #2563eb' : '3px solid transparent',
      transition: 'background 0.1s',
    }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = c.inputBg; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        {/* Avatar */}
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#2563eb,#7c3aed)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
          {initials(contact.cliente_nombre)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: c.title, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {contact.cliente_nombre || '—'}
            </p>
            <span style={{ fontSize: 10, color: c.subtitle, flexShrink: 0, marginLeft: 4 }}>{timeAgo(conv.last_message_at)}</span>
          </div>
          <p style={{ margin: '0 0 4px', fontSize: 11, color: c.subtitle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {conv.last_message_preview || 'Sin mensajes aún'}
          </p>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            <StatusBadge status={conv.status} />
            {campaign && (
              <span style={{ fontSize: 9, fontWeight: 600, color: campaign.color, background: `${campaign.color}15`, border: `0.5px solid ${campaign.color}40`, borderRadius: 10, padding: '1px 5px' }}>
                {campaign.name}
              </span>
            )}
            <span title={sent.label} style={{ fontSize: 12 }}>{sent.emoji}</span>
            {conv.fuga_final && conv.fuga_final !== 'sin_riesgo' && (
              <i className={`ti ${fuga.icon}`} style={{ fontSize: 11, color: fuga.color }} title={fuga.label} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Panel de Reportería ───────────────────────────────────────────────────────
function ReportPanel({ tenantId, c }) {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [period,  setPeriod]  = useState('month');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const now  = new Date();
      let from;
      if (period === 'today') { from = new Date(now.setHours(0,0,0,0)).toISOString(); }
      else if (period === 'week') { from = new Date(Date.now() - 7*86400000).toISOString(); }
      else { from = new Date(Date.now() - 30*86400000).toISOString(); }
      try {
        const res  = await fetch(`${API_URL}/api/crm/stats?tenantId=${tenantId}&from=${from}`);
        const data = await res.json();
        setStats(data);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, [tenantId, period]);

  if (loading) return <div style={{ padding: 40, color: c.subtitle, textAlign: 'center' }}>Cargando métricas...</div>;
  if (!stats)  return null;

  const kpis = [
    { l: 'Total conversaciones', v: stats.total,          color: '#534AB7', icon: 'ti-messages'     },
    { l: 'Tasa FCR (IA)',        v: stats.fcrRate + '%',  color: '#1D9E75', icon: 'ti-robot'        },
    { l: 'Tasa escalación',      v: stats.escalationRate + '%', color: '#D85A30', icon: 'ti-user-check' },
    { l: 'CSAT promedio',        v: stats.csatAvg ? stats.csatAvg + ' ★' : '—', color: '#EF9F27', icon: 'ti-star' },
  ];

  const renderRechartsBar = (obj, colorMap, label) => {
    const data = Object.entries(obj).map(([k, v]) => ({
      name: colorMap?.[k]?.label || k,
      value: v,
      fill: colorMap?.[k]?.color || '#2563eb'
    }));
    return (
      <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: '14px 16px', height: 260, display: 'flex', flexDirection: 'column' }}>
        <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: c.title }}>{label}</p>
        <div style={{ flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barSize={30}>
              <CartesianGrid strokeDasharray="3 3" stroke={c.border} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: c.subtitle }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: c.subtitle }} axisLine={false} tickLine={false} />
              <RechartsTooltip contentStyle={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 8, color: c.inputText }} cursor={{ fill: c.inputBg }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const renderRechartsPie = (obj, colorMap, label) => {
    const data = Object.entries(obj).map(([k, v]) => ({
      name: colorMap?.[k]?.label || k,
      value: v,
      color: colorMap?.[k]?.color || '#2563eb'
    }));
    return (
      <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: '14px 16px', height: 260, display: 'flex', flexDirection: 'column' }}>
        <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: c.title }}>{label}</p>
        <div style={{ flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                {data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
              </Pie>
              <RechartsTooltip contentStyle={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 8, color: c.inputText }} itemStyle={{ color: c.inputText }} />
              <Legend wrapperStyle={{ fontSize: 11, color: c.subtitle }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '0 2px' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[['today','Hoy'],['week','Semana'],['month','Mes']].map(([p, l]) => (
          <button key={p} onClick={() => setPeriod(p)}
            style={{ padding: '5px 14px', fontSize: 12, borderRadius: 20, border: `1px solid ${period===p ? '#2563eb' : c.border}`, background: period===p ? '#2563eb' : 'transparent', color: period===p ? '#fff' : c.subtitle, cursor: 'pointer' }}>
            {l}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
        {kpis.map(k => (
          <div key={k.l} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <i className={`ti ${k.icon}`} style={{ fontSize: 14, color: k.color }} />
              <p style={{ margin: 0, fontSize: 11, color: c.subtitle, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k.l}</p>
            </div>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 600, color: k.color }}>{k.v}</p>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {Object.keys(stats.byStatus).length > 0      && renderRechartsBar(stats.byStatus,      STATUS_CONFIG,      '📊 Por estado')}
        {Object.keys(stats.bySentimiento).length > 0 && renderRechartsPie(stats.bySentimiento, SENTIMIENTO_CONFIG, '😊 Sentimiento al cierre')}
        {Object.keys(stats.byFuga).length > 0        && renderRechartsPie(stats.byFuga,        FUGA_CONFIG,        '🚨 Riesgo de fuga')}
        {Object.keys(stats.byCanal).length > 0       && renderRechartsBar(stats.byCanal,       null,               '📡 Por canal')}
      </div>
    </div>
  );
}

// ── Módulo principal CRM ──────────────────────────────────────────────────────
export default function CRMManager({ tenantId, isDark = true, userId, userEmail, userRole, isSuperAdmin }) {
  const [conversations, setConversations] = useState([]);
  const [selectedId,    setSelectedId]    = useState(null);
  const [alerts,        setAlerts]        = useState({ count: 0, alerts: [] });
  const [campaigns,     setCampaigns]     = useState([]);
  const [filterStatus,  setFilterStatus]  = useState('open');
  const [filterCanal,   setFilterCanal]   = useState('all');
  const [filterCampaign,setFilterCampaign]= useState('');
  const [search,        setSearch]        = useState('');
  const [loading,       setLoading]       = useState(true);
  const [tab,           setTab]           = useState('inbox'); // 'inbox' | 'reports'
  const displayName = userEmail?.split('@')[0] || 'Ejecutivo';

  const c = {
    card:      isDark ? '#111'    : '#ffffff',
    border:    isDark ? '#222'    : '#e5e7eb',
    title:     isDark ? '#ffffff' : '#111827',
    subtitle:  isDark ? '#aaaaaa' : '#6b7280',
    inputBg:   isDark ? '#1a1a1a' : '#f9fafb',
    inputText: isDark ? '#ffffff' : '#111827',
  };

  const fetchConversations = useCallback(async () => {
    if (!tenantId) return;
    try {
      const params = new URLSearchParams({ tenantId, limit: '100' });
      if (filterStatus && filterStatus !== 'all') params.set('status', filterStatus);
      if (filterCanal && filterCanal !== 'all') params.set('canal', filterCanal);
      if (filterCampaign) params.set('campaignId', filterCampaign);
      if (search) params.set('search', search);
      const [convRes, alertRes] = await Promise.all([
        fetch(`${API_URL}/api/crm/conversations?${params}`).then(r => r.ok ? r.json() : null),
        fetch(`${API_URL}/api/crm/alerts?tenantId=${tenantId}`).then(r => r.ok ? r.json() : null),
      ]);
      if (Array.isArray(convRes)) {
        setConversations(convRes);
      }
      if (alertRes && !alertRes.error) {
        setAlerts(alertRes);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [tenantId, filterStatus, filterCanal, filterCampaign, search]);

  // Carga inicial y polling cada 5 segundos
  useEffect(() => { fetchConversations(); }, [fetchConversations]);
  useEffect(() => {
    const t = setInterval(fetchConversations, 5000);
    return () => clearInterval(t);
  }, [fetchConversations]);

  // Cargar campañas (solo una vez)
  useEffect(() => {
    if (!tenantId) return;
    fetch(`${API_URL}/api/crm/campaigns?tenantId=${tenantId}`)
      .then(r => r.json()).then(d => setCampaigns(Array.isArray(d) ? d : [])).catch(console.error);
  }, [tenantId]);

  const FILTER_TABS = [
    { id: 'open',          label: 'Activas'        },
    { id: 'all',           label: 'Todas'          },
    { id: 'waiting_human', label: '⚡ Necesitan Atención', badge: alerts.count },
    { id: 'active',        label: '🤖 IA Activa'   },
    { id: 'human_active',  label: '👨‍💼 Con Ejecutivo' },
    { id: 'pending_csat',  label: '⭐ CSAT Pendiente' },
    { id: 'pending_followup', label: '⏳ Pendientes' },
    { id: 'closed',        label: '✅ Cerradas'    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 'bold', margin: '0 0 4px', color: c.title }}>CRM Operacional</h2>
          <p style={{ margin: 0, fontSize: 14, color: c.subtitle }}>
            {loading ? 'Cargando...' : `${conversations.length} conversacione${conversations.length !== 1 ? 's' : ''}`}
            {alerts.count > 0 && <span style={{ marginLeft: 8, color: '#EF9F27', fontWeight: 600 }}>· ⚡ {alerts.count} requieren atención</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['inbox','📥 Bandeja'],['reports','📊 Reportes']].map(([id, label]) => (
            <button key={id} onClick={() => { setTab(id); setSelectedId(null); }}
              style={{ padding: '8px 16px', fontSize: 13, fontWeight: tab === id ? 600 : 400, borderRadius: 8,
                border: `1px solid ${tab === id ? '#2563eb' : c.border}`,
                background: tab === id ? '#2563eb' : 'transparent',
                color: tab === id ? '#fff' : c.subtitle, cursor: 'pointer' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'reports' ? (
        <ReportPanel tenantId={tenantId} c={c} />
      ) : (
        <>
          {/* Panel de alertas */}
          {alerts.count > 0 && (
            <div style={{ background: '#FEF3E0', border: '1px solid #EF9F2760', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <i className="ti ti-alert-triangle" style={{ fontSize: 16, color: '#EF9F27' }} />
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#92400E' }}>{alerts.count} conversacion{alerts.count > 1 ? 'es requieren' : ' requiere'} atención humana</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {alerts.alerts.slice(0, 3).map(a => (
                  <div key={a.id} onClick={() => setSelectedId(a.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: 'rgba(255,255,255,0.6)', borderRadius: 8, cursor: 'pointer' }}>
                    <i className={`ti ${a.fuga_final === 'alto' ? 'ti-flame' : 'ti-user-question'}`} style={{ fontSize: 14, color: a.fuga_final === 'alto' ? '#E24B4A' : '#EF9F27' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#78350F' }}>{a.contacts?.cliente_nombre || '—'}</p>
                      <p style={{ margin: 0, fontSize: 11, color: '#92400E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.last_message_preview}</p>
                    </div>
                    <span style={{ fontSize: 10, color: '#92400E' }}>{timeAgo(a.last_message_at)}</span>
                    <button style={{ fontSize: 11, padding: '3px 10px', background: '#EF9F27', color: '#fff', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 600 }}>
                      → Atender
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Layout: bandeja + detalle */}
          <div style={{ display: 'flex', gap: 0, background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, overflow: 'hidden', height: 'calc(100vh - 170px)' }}>
            {/* Columna izquierda: Bandeja */}
            <div style={{ width: selectedId ? 340 : '100%', borderRight: selectedId ? `1px solid ${c.border}` : 'none', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
              {/* Filtros */}
              <div style={{ padding: '10px 12px', borderBottom: `1px solid ${c.border}`, background: isDark ? '#0f0f0f' : '#f9fafb' }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o ticket..."
                  style={{ width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 8, border: `1px solid ${c.border}`, background: c.inputBg, color: c.inputText, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {FILTER_TABS.map(f => (
                    <button key={f.id} onClick={() => setFilterStatus(f.id)}
                      style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, border: `1px solid ${filterStatus === f.id ? '#2563eb' : c.border}`,
                        background: filterStatus === f.id ? '#2563eb' : 'transparent',
                        color: filterStatus === f.id ? '#fff' : c.subtitle, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
                      {f.label}
                      {f.badge > 0 && <span style={{ background: '#EF9F27', color: '#fff', borderRadius: 10, fontSize: 9, padding: '0 4px' }}>{f.badge}</span>}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <select value={filterCanal} onChange={e => setFilterCanal(e.target.value)}
                    style={{ flex: 1, padding: '5px 8px', fontSize: 11, borderRadius: 8, border: `1px solid ${c.border}`, background: c.inputBg, color: c.inputText, outline: 'none' }}>
                    <option value="all">Todos los canales</option>
                    <option value="webchat">Web Chat</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="instagram">Instagram</option>
                  </select>
                  {campaigns.length > 0 && (
                    <select value={filterCampaign} onChange={e => setFilterCampaign(e.target.value)}
                      style={{ flex: 1, padding: '5px 8px', fontSize: 11, borderRadius: 8, border: `1px solid ${c.border}`, background: c.inputBg, color: c.inputText, outline: 'none' }}>
                      <option value="">Todas las campañas</option>
                      {campaigns.map(cam => <option key={cam.id} value={cam.id}>{cam.name}</option>)}
                    </select>
                  )}
                </div>
              </div>
              {/* Lista */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {loading ? (
                  <div style={{ padding: 40, textAlign: 'center', color: c.subtitle }}>
                    <i className="ti ti-loader-2" style={{ fontSize: 24, display: 'block', marginBottom: 8 }} />
                    Cargando conversaciones...
                  </div>
                ) : conversations.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: c.subtitle }}>
                    <i className="ti ti-messages-off" style={{ fontSize: 32, display: 'block', marginBottom: 10 }} />
                    <p style={{ margin: 0, fontSize: 13 }}>No hay conversaciones con estos filtros</p>
                  </div>
                ) : conversations.map(conv => (
                  <ConvRow key={conv.id} conv={conv} isSelected={selectedId === conv.id}
                    onClick={() => setSelectedId(conv.id)} c={c} />
                ))}
              </div>
            </div>

            {/* Columna derecha: Detalle */}
            {selectedId && (
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <ConversationDetail
                  convId={selectedId}
                  tenantId={tenantId}
                  userId={userId}
                  displayName={displayName}
                  userRole={userRole}
                  isSuperAdmin={isSuperAdmin}
                  c={c}
                  campaigns={campaigns}
                  onBack={() => setSelectedId(null)}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
