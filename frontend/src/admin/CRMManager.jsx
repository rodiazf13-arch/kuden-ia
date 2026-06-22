import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import EmojiPicker from 'emoji-picker-react';
import Contact360View from './Contact360View';

const API_URL = import.meta.env.VITE_API_URL || '';

// ── Helpers ──────────────────────────────────────────────────────────────────
const timeAgo = (iso) => {
  if (!iso) return '—';
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60) return 'hace ' + diff + 's';
  if (diff < 3600) return 'hace ' + Math.floor(diff / 60) + 'min';
  if (diff < 86400) return 'hace ' + Math.floor(diff / 3600) + 'h';
  return 'hace ' + Math.floor(diff / 86400) + 'd';
};

const STATUS_CONFIG = {
  active: { label: 'IA Activa', color: '#16D38A', bg: 'rgba(22, 211, 138, 0.15)', icon: 'ti-robot' },
  waiting_human: { label: 'Esperando Humano', color: '#F6B940', bg: 'rgba(246, 185, 64, 0.15)', icon: 'ti-alert-triangle' },
  human_active: { label: 'Ejecutivo Activo', color: '#635BFF', bg: 'rgba(99, 91, 255, 0.15)', icon: 'ti-user-check' },
  pending_csat: { label: 'Pendiente CSAT', color: '#FF8B3E', bg: 'rgba(255, 139, 62, 0.15)', icon: 'ti-star' },
  resolved: { label: 'Resuelto por IA', color: '#16D38A', bg: 'rgba(22, 211, 138, 0.15)', icon: 'ti-circle-check' },
  closed: { label: 'Cerrado', color: 'var(--color-text-secondary)', bg: 'var(--color-background-secondary)', icon: 'ti-lock' },
  abandoned: { label: 'Abandonado', color: '#FF5E73', bg: 'rgba(255, 94, 115, 0.15)', icon: 'ti-circle-x' },
  pending_followup: { label: 'Pendiente Seg.', color: '#F6B940', bg: 'rgba(246, 185, 64, 0.15)', icon: 'ti-clock' },
};

const SENTIMIENTO_CONFIG = {
  muy_negativo: { label: 'Muy frustrado', emoji: '😠', color: '#FF5E73', bg: 'rgba(255, 94, 115, 0.15)', pct: 10 },
  negativo: { label: 'Frustrado', emoji: '😕', color: '#FF8B3E', bg: 'rgba(255, 139, 62, 0.15)', pct: 30 },
  neutral: { label: 'Neutral', emoji: '😐', color: '#F6B940', bg: 'rgba(246, 185, 64, 0.15)', pct: 50 },
  positivo: { label: 'Satisfecho', emoji: '🙂', color: '#16D38A', bg: 'rgba(22, 211, 138, 0.15)', pct: 75 },
  muy_positivo: { label: 'Muy satisfecho', emoji: '😊', color: '#635BFF', bg: 'rgba(99, 91, 255, 0.15)', pct: 100 },
};

const FUGA_CONFIG = {
  sin_riesgo: { label: 'Sin riesgo', color: '#16D38A', bg: 'rgba(22, 211, 138, 0.15)', icon: 'ti-shield-check' },
  bajo: { label: 'Riesgo bajo', color: '#F6B940', bg: 'rgba(246, 185, 64, 0.15)', icon: 'ti-alert-triangle' },
  medio: { label: 'Riesgo medio', color: '#FF8B3E', bg: 'rgba(255, 139, 62, 0.15)', icon: 'ti-alert-triangle' },
  alto: { label: 'Riesgo alto', color: '#FF5E73', bg: 'rgba(255, 94, 115, 0.15)', icon: 'ti-flame' },
};

const CHANNEL_COLORS = {
  email: { rgb: '99, 91, 255' }, // Kuden Indigo
  whatsapp: { rgb: '37, 211, 102' }, // Verde
  instagram: { rgb: '225, 48, 108' }, // Rosado
  webchat: { rgb: '55, 215, 255' },  // Cyan Pulse
  voz: { rgb: '139, 92, 246' }  // Morado (Violeta)
};

const normalizeCanal = (canal) => {
  if (!canal) return null;
  const c = canal.toLowerCase().replace(/\s/g, '');
  if (c === 'web' || c === 'webchat') return 'webchat';
  return c;
};

const getChannelBg = (canal, c, state = 'normal') => {
  if (state === 'selected') return 'rgba(99, 91, 255, 0.15)';
  const color = CHANNEL_COLORS[normalizeCanal(canal)];
  if (!color) {
    if (state === 'hover') return c.inputBg;
    if (state === 'kanban-normal') return c.inputBg;
    return 'transparent';
  }
  if (state === 'hover') return `rgba(${color.rgb}, 0.25)`;
  if (state === 'kanban-normal') return `rgba(${color.rgb}, 0.08)`;
  return `rgba(${color.rgb}, 0.08)`;
};

const getChannelBorder = (canal, c) => {
  const color = CHANNEL_COLORS[normalizeCanal(canal)];
  if (!color) return c.border;
  return `rgba(${color.rgb}, 0.25)`;
};

function StatusBadge({ status }) {
  const s = STATUS_CONFIG[status] || STATUS_CONFIG.active;
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, color: s.color, background: s.bg,
      border: `0.5px solid ${s.color}40`, borderRadius: 20, padding: '2px 8px',
      display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
      fontFamily: 'var(--font-body)'
    }}>
      <i className={`ti ${s.icon}`} style={{ fontSize: 10 }} />
      {s.label}
    </span>
  );
}

// ── SLA Monitor Badge ────────────────────────────────────────────────────────
function SLABadge({ lastMessageAt, warningMinutes = 15, dangerMinutes = 30 }) {
  const [minutesPassed, setMinutesPassed] = useState(0);

  useEffect(() => {
    if (!lastMessageAt) return;
    const calc = () => {
      const diffMs = Date.now() - new Date(lastMessageAt).getTime();
      setMinutesPassed(Math.floor(diffMs / 60000));
    };
    calc();
    const interval = setInterval(calc, 60000);
    return () => clearInterval(interval);
  }, [lastMessageAt]);

  if (!lastMessageAt) return null;

  let color = '#16D38A'; // Verde
  let label = 'A tiempo';

  if (minutesPassed >= (dangerMinutes || 30)) {
    color = '#FF5E73'; // Rojo
    label = 'Atrasado';
  } else if (minutesPassed >= (warningMinutes || 15)) {
    color = '#F6B940'; // Amarillo
    label = 'Advertencia';
  }

  return (
    <span style={{
      fontSize: 10, fontWeight: 600, color, background: `${color}15`,
      border: `0.5px solid ${color}40`, borderRadius: 20, padding: '2px 8px',
      display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap'
    }} title={`Han pasado ${minutesPassed} minutos desde el último mensaje`}>
      ⏱ {label} ({minutesPassed}m)
    </span>
  );
}

// ── Panel de Inteligencia IA (derecha en el detalle) ─────────────────────────
function IntelPanel({ conv, c, isDark }) {
  const sent = SENTIMIENTO_CONFIG[conv.sentimiento_final] || SENTIMIENTO_CONFIG.neutral;
  const fuga = FUGA_CONFIG[conv.fuga_final] || FUGA_CONFIG.sin_riesgo;

  const segScore = (() => {
    const plan = conv.contacts?.plan || '';
    if (plan.includes('Empresas') || plan.includes('1GB')) return { label: 'Estratégico', color: '#635BFF', score: 100 };
    if (plan.includes('500MB') || plan.includes('VIP')) return { label: 'Alto', color: '#16D38A', score: 75 };
    if (plan.includes('200MB')) return { label: 'Medio', color: '#F6B940', score: 50 };
    return { label: 'Básico', color: '#FF8B3E', score: 25 };
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
          ? <span style={{ fontSize: 11, fontWeight: 500, color: '#0B6642', background: 'rgba(22, 211, 138, 0.12)', border: '0.5px solid rgba(22, 211, 138, 0.25)', borderRadius: 20, padding: '2px 8px' }}>{conv.intencion}</span>
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
      <div style={{
        background: isDark ? 'rgba(99, 91, 255, 0.12)' : '#EEEDFE',
        border: `0.5px solid ${isDark ? 'rgba(99, 91, 255, 0.25)' : '#CECBF6'}`,
        borderRadius: 10, padding: '10px 12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
          <i className="ti ti-sparkles" style={{ fontSize: 13, color: isDark ? '#9E99FF' : '#534AB7' }} />
          <p style={{ margin: 0, fontSize: 11, fontWeight: 500, color: isDark ? '#FFFFFF' : '#26215C' }}>Recomendación KUDEN</p>
        </div>
        <p style={{ margin: 0, fontSize: 11, color: isDark ? '#A9B0C3' : '#26215C', lineHeight: 1.5 }}>{rec}</p>
      </div>

      {/* CSAT */}
      {conv.csat_final && (
        <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 2px', fontSize: 10, color: c.subtitle, textTransform: 'uppercase' }}>CSAT</p>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 500, color: '#F6B940' }}>{parseFloat(conv.csat_final).toFixed(1)} ★</p>
        </div>
      )}
    </div>
  );
}

// ── Burbuja de mensaje ────────────────────────────────────────────────────────
function MessageBubble({ msg, c, isDark }) {
  const isCustomer = msg.sender_type === 'customer';
  const isAI = msg.sender_type === 'ai';
  const isHuman = msg.sender_type === 'human_agent';
  const isSystem = msg.sender_type === 'system';
  const isNote = msg.is_internal_note;

  if (isSystem) return (
    <div style={{ textAlign: 'center', padding: '4px 0' }}>
      <span style={{ fontSize: 11, color: c.subtitle, fontStyle: 'italic' }}>⚙️ {msg.content}</span>
    </div>
  );

  if (isNote) return (
    <div style={{
      background: isDark ? '#3A331A' : '#FEF9C3',
      border: `1px solid ${isDark ? '#856A15' : '#FDE047'}`,
      borderRadius: 10, padding: '8px 12px', margin: '4px 0'
    }}>
      <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 600, color: isDark ? '#FCD34D' : '#92400E' }}>🔒 NOTA INTERNA · {msg.sender_name}</p>
      <p style={{ margin: 0, fontSize: 12, color: isDark ? '#FFF' : '#78350F', lineHeight: 1.5 }}>{msg.content}</p>
    </div>
  );

  return (
    <div style={{ display: 'flex', justifyContent: isCustomer ? 'flex-end' : 'flex-start', marginBottom: 6 }}>
      {!isCustomer && (
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0, marginRight: 6, alignSelf: 'flex-end',
          background: isAI ? '#16D38A' : '#635BFF',
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
          background: isCustomer
            ? (isDark ? '#2D324F' : '#e5e7eb')
            : isAI
              ? (isDark ? 'rgba(22, 211, 138, 0.12)' : 'rgba(22, 211, 138, 0.08)')
              : (isDark ? 'rgba(99, 91, 255, 0.12)' : 'rgba(99, 91, 255, 0.08)'),
          color: isCustomer
            ? (isDark ? '#FFFFFF' : '#101828')
            : isAI
              ? (isDark ? '#16D38A' : '#0B6642')
              : (isDark ? '#9E99FF' : '#3F35E0'),
          border: isCustomer
            ? `1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`
            : `0.5px solid ${isAI ? 'rgba(22, 211, 138, 0.25)' : 'rgba(99, 91, 255, 0.25)'}`,
          whiteSpace: 'pre-wrap'
        }}>
          {msg.content && msg.content.includes('🔗 Grabación:') ? (
            msg.content.split('\n').map((line, idx, arr) => {
              if (line.includes('🔗 Grabación:') && line.includes('http')) {
                const url = line.replace('🔗 Grabación:', '').trim();
                return (
                  <div key={idx} style={{ marginBottom: idx < arr.length - 1 ? 8 : 0 }}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: '#635BFF',
                        fontWeight: '600',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        background: 'rgba(99,91,255,0.08)',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        marginTop: '4px'
                      }}
                    >
                      <i className="ti ti-download" style={{ fontSize: '14px' }}></i>
                      Descargar Grabación
                    </a>
                  </div>
                );
              }
              return <div key={idx}>{line}</div>;
            })
          ) : msg.content}
        </div>
        <p style={{ margin: '2px 0 0', fontSize: 9, color: c.subtitle, paddingLeft: isCustomer ? 0 : 2, textAlign: isCustomer ? 'right' : 'left' }}>
          {msg.created_at ? new Date(msg.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : ''}
        </p>
      </div>
    </div>
  );
}

// ── Vista de detalle de conversación ─────────────────────────────────────────
function ConversationDetail({ convId, tenantId, userId, displayName, userRole, isSuperAdmin, c, campaigns = [], groups = [], tenantUsers = [], onBack, onView360, hasTooManyForgotten = false, forgottenCount = 0, isDark }) {
  const [data, setData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [isNote, setIsNote] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [showInfo, setShowInfo] = useState(false);  // panel lateral colapsado por defecto
  const [closingMode, setClosingMode] = useState(false);
  const [pendingMode, setPendingMode] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpTime, setFollowUpTime] = useState('');
  const [followUpNote, setFollowUpNote] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emailSignature, setEmailSignature] = useState('');
  const [typifications, setTypifications] = useState([]);
  const [selectedTyp, setSelectedTyp] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const bottomRef = useRef(null);
  const lastMsgCountRef = useRef(0);

  // Colisión Multi-Agente
  const [typingUsers, setTypingUsers] = useState([]);
  const channelRef = useRef(null);
  const typingTimeoutRef = useRef(null);

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

  // Cargar firma de correo
  useEffect(() => {
    if (!userId) return;
    fetch(`${API_URL}/api/users/${userId}/signature`)
      .then(res => res.json())
      .then(data => {
        if (data && data.email_signature) setEmailSignature(data.email_signature);
      })
      .catch(err => console.error('Error cargando firma en CRM', err));
  }, [userId]);

  useEffect(() => {
    if (data?.campaign_id) {
      fetch(`${API_URL}/api/crm/campaigns/${data.campaign_id}/typifications`)
        .then(r => r.json()).then(d => setTypifications(Array.isArray(d) ? d : [])).catch(console.error);
    } else {
      setTypifications([]);
    }
  }, [data?.campaign_id]);

  useEffect(() => {
    if (data?.canal === 'voz') {
      setIsNote(true);
    }
  }, [data?.canal]);

  useEffect(() => {
    const t = setInterval(fetchDetail, 5000);
    return () => clearInterval(t);
  }, [fetchDetail]);

  // Presence channel para colisión
  useEffect(() => {
    if (!convId || !userId) return;

    const channel = supabase.channel(`crm-presence-${convId}`, {
      config: { presence: { key: userId } }
    });
    channelRef.current = channel;

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const typing = [];
      for (const id in state) {
        if (id !== userId) {
          typing.push(...state[id].filter(p => p.typing).map(p => p.displayName));
        }
      }
      setTypingUsers([...new Set(typing)]);
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ typing: false, displayName });
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [convId, userId, displayName]);

  const handleInput = async (val) => {
    setInput(val);
    if (channelRef.current && channelRef.current.state === 'joined') {
      await channelRef.current.track({ typing: true, displayName });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(async () => {
        if (channelRef.current && channelRef.current.state === 'joined') {
          await channelRef.current.track({ typing: false, displayName });
        }
      }, 3000);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() && attachments.length === 0) return;
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/api/crm/conversations/${convId}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, userId, displayName, content: input, isInternalNote: isNote, attachments }),
      });
      if (res.ok) {
        setInput('');
        setAttachments([]);
        if (channelRef.current && channelRef.current.state === 'joined') {
          await channelRef.current.track({ typing: false, displayName });
        }
        await fetchDetail();
      } else {
        const err = await res.json();
        alert('Error al enviar mensaje: ' + err.error);
      }
    } catch (e) { console.error(e); }
    setSending(false);
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setUploadingFiles(true);
    const newAttachments = [];

    try {
      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${tenantId}/${convId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('chat_attachments')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('chat_attachments')
          .getPublicUrl(filePath);

        newAttachments.push({ url: data.publicUrl, name: file.name, type: file.type });
      }
      setAttachments(prev => [...prev, ...newAttachments]);
    } catch (err) {
      console.error('Error subiendo adjunto:', err);
      alert('Error al subir archivo. Asegúrate de haber creado el bucket "chat_attachments" en Supabase.');
    } finally {
      setUploadingFiles(false);
      e.target.value = null;
    }
  };

  const handleSuggestAI = async () => {
    setSuggesting(true);
    try {
      const res = await fetch(`${API_URL}/api/crm/conversations/${convId}/suggest`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, userId, displayName }),
      });
      if (res.ok) {
        if (!res.ok) throw new Error("API Error");
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

  const doAssign = async (type, val) => {
    setActionMsg('');
    try {
      const body = { assignerName: displayName };
      if (type === 'group') body.assigned_group_id = val || null;
      if (type === 'user') body.assigned_to = val || null;

      const res = await fetch(`${API_URL}/api/crm/conversations/${convId}/assign`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setActionMsg(`Transferido exitosamente.`);
        await fetchDetail();
      }
    } catch (e) { console.error(e); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: c.subtitle }}>Cargando conversación...</div>;
  if (!data) return <div style={{ padding: 40, textAlign: 'center', color: c.subtitle }}>No se encontró la conversación.</div>;

  const conv = data;
  const contact = conv.contacts || {};
  const status = conv.status;
  const isMyConv = conv.assigned_to === userId;
  const canAct = isSuperAdmin || userRole === 'admin' || isMyConv || !conv.assigned_to;

  // Botones según estado
  const renderActions = () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {(status === 'active' || status === 'waiting_human') && canAct && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => doAction('takeover', 'Has tomado el control de la conversación.')}
            disabled={hasTooManyForgotten}
            style={{
              padding: '7px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8, border: 'none', cursor: hasTooManyForgotten ? 'not-allowed' : 'pointer',
              background: hasTooManyForgotten ? '#9CA3AF' : (status === 'waiting_human' ? '#F6B940' : '#635BFF'), color: '#fff', opacity: hasTooManyForgotten ? 0.6 : 1
            }}
            title={hasTooManyForgotten ? `Bloqueado. Tienes ${forgottenCount} tickets olvidados.` : ''}>
            🖐 Tomar Control
          </button>
          {hasTooManyForgotten && <span style={{ fontSize: 10, color: '#FF5E73', fontWeight: 600 }}>Limpia tus tickets olvidados primero.</span>}
        </div>
      )}
      {status === 'human_active' && isMyConv && !closingMode && !pendingMode && (
        <>
          <button onClick={() => doAction('release', 'Control devuelto a KUDEN IA.')}
            style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8, border: `1px solid ${c.border}`, cursor: 'pointer', background: 'transparent', color: c.subtitle }}>
            🤖 Devolver a IA
          </button>
          <button onClick={() => setPendingMode(true)}
            style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8, border: `1px solid ${c.border}`, cursor: 'pointer', background: isDark ? 'rgba(246, 185, 64, 0.15)' : '#FEF3E0', color: '#F6B940' }}>
            ⏳ Dejar Pendiente
          </button>
          <button onClick={async () => {
            if (conv.campaign_id) {
              const res = await fetch(`${API_URL}/api/crm/campaigns/${conv.campaign_id}/typifications`);
              if (res.ok) setTypifications(await res.json());
            } else { setTypifications([]); }
            setClosingMode(true);
          }}
            style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#16D38A', color: '#fff' }}>
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
          <button onClick={() => {
            const isOutbound = conv.canal === 'email' || conv.canal === 'outbound';
            const closeReason = isOutbound ? 'Conversación cerrada (Canal Saliente).' : 'Conversación cerrada. CSAT pendiente.';
            doAction('close', closeReason, { motivoLabel: selectedTyp, force: isOutbound });
          }}
            disabled={!conv.campaign_id || (!selectedTyp && typifications.length > 0)}
            style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: 'none', cursor: (!conv.campaign_id || (!selectedTyp && typifications.length > 0)) ? 'not-allowed' : 'pointer', background: '#16D38A', color: '#fff', opacity: (!conv.campaign_id || (!selectedTyp && typifications.length > 0)) ? 0.5 : 1 }}>
            Confirmar
          </button>
          {!conv.campaign_id && <span style={{ fontSize: 10, color: '#FF5E73' }}>⚠️ Asigna una campaña primero</span>}
          <button onClick={() => setClosingMode(false)} style={{ background: 'transparent', border: 'none', color: c.subtitle, cursor: 'pointer', fontSize: 11 }}>Cancelar</button>
        </div>
      )}
      {status === 'human_active' && isMyConv && pendingMode && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: isDark ? 'rgba(246, 185, 64, 0.15)' : '#FEF3E0', padding: '4px 8px', borderRadius: 8, border: `1px solid ${isDark ? 'rgba(246, 185, 64, 0.3)' : '#F6B940'}` }}>
          <input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} style={{ fontSize: 11, padding: '4px', borderRadius: 4, border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#F6B940'}`, background: isDark ? '#1C2035' : '#fff', color: isDark ? '#fff' : '#333' }} />
          <input type="time" value={followUpTime} onChange={e => setFollowUpTime(e.target.value)} style={{ fontSize: 11, padding: '4px', borderRadius: 4, border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#F6B940'}`, background: isDark ? '#1C2035' : '#fff', color: isDark ? '#fff' : '#333' }} />
          <input type="text" placeholder="Nota..." value={followUpNote} onChange={e => setFollowUpNote(e.target.value)} style={{ fontSize: 11, padding: '4px', borderRadius: 4, border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#F6B940'}`, background: isDark ? '#1C2035' : '#fff', color: isDark ? '#fff' : '#333', width: 120 }} />

          <button onClick={() => doAction('close', 'Conversación dejada en pendiente.', { isPending: true, followUpAt: new Date(`${followUpDate}T${followUpTime}`).toISOString(), followUpNote })}
            disabled={!followUpDate || !followUpTime}
            style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: 'none', cursor: (!followUpDate || !followUpTime) ? 'not-allowed' : 'pointer', background: '#F6B940', color: '#fff', opacity: (!followUpDate || !followUpTime) ? 0.5 : 1 }}>
            Confirmar
          </button>
          <button onClick={() => setPendingMode(false)} style={{ background: 'transparent', border: 'none', color: '#F6B940', cursor: 'pointer', fontSize: 11 }}>Cancelar</button>
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
            {(status === 'waiting_human' || status === 'human_active') && <SLABadge lastMessageAt={conv.last_message_at} warningMinutes={conv.campaigns?.sla_warning_minutes} dangerMinutes={conv.campaigns?.sla_danger_minutes} />}
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
            {/* Transferencia a Grupo */}
            {groups.length > 0 && (
              <select
                value={conv.assigned_group_id || ''}
                onChange={(e) => doAssign('group', e.target.value)}
                style={{ fontSize: 10, padding: '2px 6px', background: c.card, borderRadius: 10, color: c.title, border: `1px solid ${c.border}`, outline: 'none', maxWidth: 150, cursor: (!isMyConv && !isSuperAdmin && userRole !== 'admin') ? 'not-allowed' : 'pointer' }}
                disabled={!isMyConv && !isSuperAdmin && userRole !== 'admin'}
              >
                <option value="">Sin grupo</option>
                {groups.map(g => {
                  // Mostrar solo los grupos que tienen acceso a la campana actual o a todas si no hay campana
                  if (!conv.campaign_id || g.campaign_groups?.some(cg => cg.campaign_id === conv.campaign_id)) {
                    return <option key={g.id} value={g.id}>{g.name}</option>;
                  }
                  return null;
                })}
              </select>
            )}
            {/* Transferencia a Ejecutivo */}
            {tenantUsers.length > 0 && (
              <select
                value={conv.assigned_to || ''}
                onChange={(e) => doAssign('user', e.target.value)}
                style={{ fontSize: 10, padding: '2px 6px', background: c.card, borderRadius: 10, color: c.title, border: `1px solid ${c.border}`, outline: 'none', maxWidth: 150, cursor: (!isMyConv && !isSuperAdmin && userRole !== 'admin') ? 'not-allowed' : 'pointer' }}
                disabled={!isMyConv && !isSuperAdmin && userRole !== 'admin'}
              >
                <option value="">No asignado</option>
                {tenantUsers.map(u => <option key={u.user_id} value={u.user_id}>{u.display_name}</option>)}
              </select>
            )}
          </div>
        </div>
        {/* Toggle panel lateral y Vista 360 */}
        <button
          onClick={() => onView360(contact)}
          title="Ver Vista 360° Omnicanal"
          style={{
            padding: '5px 10px', fontSize: 12, borderRadius: 8, border: `1px solid ${c.border}`,
            background: 'transparent', color: c.subtitle,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0
          }}
        >
          <i className="ti ti-chart-pie" style={{ fontSize: 14 }} />
          Vista 360°
        </button>
        <button
          onClick={() => setShowInfo(v => !v)}
          title={showInfo ? 'Ocultar panel' : 'Ver ficha y análisis IA'}
          style={{
            padding: '5px 10px', fontSize: 12, borderRadius: 8, border: `1px solid ${c.border}`,
            background: showInfo ? 'rgba(99, 91, 255, 0.15)' : 'transparent', color: showInfo ? '#635BFF' : c.subtitle,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0
          }}
        >
          <i className={`ti ${showInfo ? 'ti-layout-sidebar-right-collapse' : 'ti-layout-sidebar-right'}`} style={{ fontSize: 14 }} />
          {showInfo ? 'Ocultar' : 'Info'}
        </button>
        {renderActions()}
      </div>
      {actionMsg && <div style={{ padding: '8px 16px', background: 'rgba(22, 211, 138, 0.15)', borderBottom: `1px solid ${c.border}`, fontSize: 12, color: '#16D38A' }}>✓ {actionMsg}</div>}

      {/* Body: Chat + Panel colapsable */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

        {/* Chat */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
            {messages.map(m => <MessageBubble key={m.id} msg={m} c={c} isDark={isDark} />)}
            {typingUsers.length > 0 && (
              <div style={{ fontSize: 11, color: c.subtitle, fontStyle: 'italic', marginBottom: 8, paddingLeft: 4 }}>
                👨‍💼 {typingUsers.join(', ')} {typingUsers.length === 1 ? 'está escribiendo...' : 'están escribiendo...'}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          {/* Input ejecutivo */}
          {(status === 'human_active' && isMyConv) || isSuperAdmin || userRole === 'admin' || conv.canal === 'voz' ? (
            <div style={{ padding: '10px 12px', borderTop: `1px solid ${c.border}`, background: c.card }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                {conv.canal !== 'voz' && (
                  <button onClick={() => setIsNote(false)}
                    style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: `1px solid ${!isNote ? '#635BFF' : c.border}`, background: !isNote ? 'rgba(99, 91, 255, 0.15)' : 'transparent', color: !isNote ? '#635BFF' : c.subtitle, cursor: 'pointer' }}>
                    💬 Mensaje
                  </button>
                )}
                <button onClick={() => setIsNote(true)}
                  style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: `1px solid ${isNote ? '#F6B940' : c.border}`, background: isNote ? 'rgba(246, 185, 64, 0.15)' : 'transparent', color: isNote ? '#F6B940' : c.subtitle, cursor: 'pointer' }}>
                  🔒 Nota interna {conv.canal === 'voz' && '(Llamada de Voz)'}
                </button>
                {conv.canal !== 'voz' && (
                  <>
                    <button onClick={handleSuggestAI} disabled={suggesting}
                      style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: `1px solid #16D38A`, background: 'rgba(22, 211, 138, 0.15)', color: '#16D38A', cursor: suggesting ? 'wait' : 'pointer', opacity: suggesting ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {suggesting ? <i className="ti ti-loader" style={{ animation: 'spin 1s linear infinite' }} /> : <i className="ti ti-sparkles" />} Sugerencia IA
                    </button>
                    {emailSignature && !isNote && (
                      <button onClick={() => setInput(prev => prev + (prev.endsWith('\n') ? '' : '\n\n') + emailSignature)}
                        style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: `1px solid ${c.border}`, background: 'transparent', color: c.subtitle, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <i className="ti ti-signature" /> Insertar Firma
                      </button>
                    )}
                  </>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
                <button onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  style={{ padding: '8px 12px', background: 'transparent', color: c.subtitle, border: `1px solid ${c.border}`, borderRadius: 8, cursor: 'pointer', fontSize: 16 }}
                  title="Insertar Emoji"
                >
                  😀
                </button>
                <input
                  type="file"
                  multiple
                  id="chat-attachment-input"
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />
                <button
                  onClick={() => document.getElementById('chat-attachment-input').click()}
                  disabled={uploadingFiles}
                  style={{ padding: '8px 12px', background: 'transparent', color: c.subtitle, border: `1px solid ${c.border}`, borderRadius: 8, cursor: uploadingFiles ? 'wait' : 'pointer', fontSize: 16, opacity: uploadingFiles ? 0.5 : 1 }}
                  title="Adjuntar Archivo"
                >
                  <i className="ti ti-paperclip" />
                </button>

                {showEmojiPicker && (
                  <div style={{ position: 'absolute', bottom: '100%', left: 0, zIndex: 100, marginBottom: 8 }}>
                    <EmojiPicker
                      onEmojiClick={(emojiObj) => {
                        setInput(prev => prev + emojiObj.emoji);
                        setShowEmojiPicker(false);
                      }}
                    />
                  </div>
                )}

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {attachments.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingBottom: 4 }}>
                      {attachments.map((att, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, background: c.inputBg, border: `1px solid ${c.border}`, padding: '4px 8px', borderRadius: 4, fontSize: 11, color: c.subtitle }}>
                          <i className="ti ti-file" /> {att.name}
                          <i className="ti ti-x" style={{ cursor: 'pointer', marginLeft: 4 }} onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} />
                        </div>
                      ))}
                    </div>
                  )}
                  <textarea value={input} onChange={e => handleInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder={isNote ? 'Nota interna (no visible al cliente)...' : 'Escribe un mensaje... (Ctrl + Enter para enviar)'}
                    rows={2}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${isNote ? (isDark ? '#856A15' : '#FDE047') : c.border}`, background: isNote ? (isDark ? '#3A331A' : '#FEF9C3') : c.inputBg, color: isNote ? (isDark ? '#fff' : '#78350F') : c.inputText, fontSize: 13, outline: 'none', resize: 'vertical', minHeight: '40px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>

                <button onClick={sendMessage} disabled={sending || (!input.trim() && attachments.length === 0)}
                  style={{ padding: '8px 16px', background: isNote ? '#F6B940' : '#635BFF', color: '#fff', border: 'none', borderRadius: 8, cursor: (input.trim() || attachments.length > 0) ? 'pointer' : 'not-allowed', opacity: (input.trim() || attachments.length > 0) ? 1 : 0.5, height: 'fit-content' }}>
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
                  ['Nombre', contact.cliente_nombre],
                  ['RUT', contact.rut],
                  ['Teléfono', contact.telefono],
                  ['Email', contact.email],
                  ['Plan', contact.plan],
                  ['Empresa', contact.empresa],
                  ['Lead ID (VICI)', contact.custom_fields?.lead_id],
                  ['Lista ID (VICI)', contact.custom_fields?.list_id],
                  ['Campaña ID (VICI)', contact.custom_fields?.campaign_id_vici],
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
                <div>
                  <p style={{ margin: '0 0 1px', fontSize: 9, color: c.subtitle, textTransform: 'uppercase' }}>Etapa Kanban</p>
                  <select
                    value={conv.motivo_label || ''}
                    onChange={(e) => doAction('typification', 'Etapa actualizada', { motivoLabel: e.target.value })}
                    style={{ width: '100%', fontSize: 11, padding: '4px', borderRadius: 4, border: `1px solid ${c.border}`, background: c.inputBg, color: c.inputText, outline: 'none' }}
                  >
                    <option value="">Entrada / Sin Etapa</option>
                    {typifications.map(t => <option key={t.id} value={t.label}>{t.label}</option>)}
                  </select>
                </div>
                {conv.campaigns && (
                  <div style={{ background: `${conv.campaigns.color}15`, border: `0.5px solid ${conv.campaigns.color}40`, borderRadius: 8, padding: '5px 8px' }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: conv.campaigns.color }}>{conv.campaigns.name}</p>
                  </div>
                )}
              </div>
            </div>
            {/* Resumen Ejecutivo */}
            {conv.resumen_ejecutivo && (
              <div style={{ padding: '10px 12px', borderBottom: `1px solid ${c.border}` }}>
                <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, color: c.subtitle, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resumen Ejecutivo</p>
                <div style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc', border: `1px solid ${c.border}`, borderRadius: 8, padding: '10px' }}>
                  <p style={{ margin: 0, fontSize: 11, color: c.subtitle, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {conv.resumen_ejecutivo}
                  </p>
                </div>
              </div>
            )}
            {/* Panel de Inteligencia IA */}
            <div style={{ padding: '10px 12px' }}>
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, color: c.subtitle, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Inteligencia IA</p>
              <IntelPanel conv={conv} c={c} isDark={isDark} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Fila de la bandeja ────────────────────────────────────────────────────────
function ConvRow({ conv, isSelected, onClick, c, groups = [], tenantUsers = [] }) {
  const contact = conv.contacts || {};
  const campaign = conv.campaigns;
  const group = groups.find(g => g.id === conv.assigned_group_id);
  const user = tenantUsers.find(u => u.user_id === conv.assigned_to);
  const sent = SENTIMIENTO_CONFIG[conv.sentimiento_final] || SENTIMIENTO_CONFIG.neutral;
  const fuga = FUGA_CONFIG[conv.fuga_final] || FUGA_CONFIG.sin_riesgo;
  const initials = (n) => n ? n.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() : '?';

  return (
    <div onClick={onClick} style={{
      padding: '10px 12px', borderBottom: `1px solid ${getChannelBorder(conv.canal, c)}`, cursor: 'pointer',
      background: getChannelBg(conv.canal, c, isSelected ? 'selected' : 'normal'),
      borderLeft: isSelected ? '3px solid #635BFF' : '3px solid transparent',
      transition: 'background 0.1s',
    }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = getChannelBg(conv.canal, c, 'hover'); }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = getChannelBg(conv.canal, c, 'normal'); }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        {/* Avatar */}
        <div style={{
          width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,var(--color-primary),var(--color-accent))', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0
        }}>
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
            {normalizeCanal(conv.canal) === 'email' && <i className="ti ti-mail" style={{ fontSize: 13, color: '#635BFF' }} title="Email" />}
            {normalizeCanal(conv.canal) === 'whatsapp' && <i className="ti ti-brand-whatsapp" style={{ fontSize: 13, color: '#25D366' }} title="WhatsApp" />}
            {normalizeCanal(conv.canal) === 'webchat' && <i className="ti ti-world" style={{ fontSize: 13, color: '#37D7FF' }} title="Web Chat" />}
            {normalizeCanal(conv.canal) === 'instagram' && <i className="ti ti-brand-instagram" style={{ fontSize: 13, color: '#E1306C' }} title="Instagram" />}
            {normalizeCanal(conv.canal) === 'voz' && <i className="ti ti-microphone" style={{ fontSize: 13, color: '#8b5cf6' }} title="Llamada de Voz" />}
            <StatusBadge status={conv.status} />
            {(conv.status === 'waiting_human' || conv.status === 'human_active') && <SLABadge lastMessageAt={conv.last_message_at} warningMinutes={campaign?.sla_warning_minutes} dangerMinutes={campaign?.sla_danger_minutes} />}
            {campaign && (
              <span style={{ fontSize: 9, fontWeight: 600, color: campaign.color, background: `${campaign.color}15`, border: `0.5px solid ${campaign.color}40`, borderRadius: 10, padding: '1px 5px' }}>
                {campaign.name}
              </span>
            )}
            {group && (
              <span style={{ fontSize: 9, fontWeight: 600, color: c.title, background: c.card, border: `0.5px solid ${c.border}`, borderRadius: 10, padding: '1px 5px', display: 'flex', alignItems: 'center', gap: 2 }} title="Grupo asignado">
                <i className="ti ti-users" style={{ fontSize: 10 }} /> {group.name}
              </span>
            )}
            {user && (
              <span style={{ fontSize: 9, fontWeight: 600, color: '#635BFF', background: 'rgba(99, 91, 255, 0.15)', border: `0.5px solid rgba(99, 91, 255, 0.25)`, borderRadius: 10, padding: '1px 5px', display: 'flex', alignItems: 'center', gap: 2 }} title="Ejecutivo asignado">
                <i className="ti ti-user" style={{ fontSize: 10 }} /> {user.display_name.split(' ')[0]}
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
function ReportPanel({ tenantId, c, campaigns, onNavigate }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [periodCampaign, setPeriodCampaign] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const now = new Date();
      let from;
      if (period === 'today') { from = new Date(now.setHours(0, 0, 0, 0)).toISOString(); }
      else if (period === 'week') { from = new Date(Date.now() - 7 * 86400000).toISOString(); }
      else { from = new Date(Date.now() - 30 * 86400000).toISOString(); }
      try {
        let url = `${API_URL}/api/crm/stats?tenantId=${tenantId}&from=${from}`;
        if (periodCampaign) url += `&campaignId=${periodCampaign}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("API Error");
        const data = await res.json();
        setStats(data);
      } catch (e) {
        console.error(e);
        setStats({ byStatus: {}, byCanal: {}, bySentimiento: {}, byFuga: {} });
      }
      setLoading(false);
    };
    load();
  }, [tenantId, period, periodCampaign]);

  if (loading) return <div style={{ padding: 40, color: c.subtitle, textAlign: 'center' }}>Cargando métricas...</div>;
  if (!stats) return null;

  const kpis = [
    { l: 'Total conversaciones', v: stats.total, color: '#635BFF', icon: 'ti-messages', action: () => onNavigate && onNavigate('all') },
    { l: 'Tasa FCR (IA)', v: stats.fcrRate + '%', color: '#16D38A', icon: 'ti-robot' },
    { l: 'Tasa escalación', v: stats.escalationRate + '%', color: '#FF8B3E', icon: 'ti-user-check' },
    { l: 'CSAT promedio', v: stats.csatAvg ? stats.csatAvg + ' ★' : '—', color: '#F6B940', icon: 'ti-star' },
  ];

  const renderRechartsBar = (obj, colorMap, label, onBarClick) => {
    const data = Object.entries(obj).map(([k, v]) => ({
      id: k,
      name: colorMap?.[k]?.label || k,
      value: v,
      fill: colorMap?.[k]?.color || '#635BFF'
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
              <Bar dataKey="value" radius={[4, 4, 0, 0]} onClick={onBarClick ? (entry) => onBarClick(entry.id) : undefined} style={{ cursor: onBarClick ? 'pointer' : 'default' }}>
                {data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const renderRechartsPie = (obj, colorMap, label, onPieClick) => {
    const data = Object.entries(obj).map(([k, v]) => ({
      id: k,
      name: colorMap?.[k]?.label || k,
      value: v,
      color: colorMap?.[k]?.color || '#635BFF'
    }));
    return (
      <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: '14px 16px', height: 260, display: 'flex', flexDirection: 'column' }}>
        <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: c.title }}>{label}</p>
        <div style={{ flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none" onClick={onPieClick ? (entry) => onPieClick(entry.id || entry.payload.id || entry.name) : undefined} style={{ cursor: onPieClick ? 'pointer' : 'default' }}>
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
        {[['today', 'Hoy'], ['week', 'Semana'], ['month', 'Mes']].map(([p, l]) => (
          <button key={p} onClick={() => setPeriod(p)}
            style={{ padding: '5px 14px', fontSize: 12, borderRadius: 20, border: `1px solid ${period === p ? '#635BFF' : c.border}`, background: period === p ? '#635BFF' : 'transparent', color: period === p ? '#fff' : c.subtitle, cursor: 'pointer' }}>
            {l}
          </button>
        ))}
        {campaigns && campaigns.length > 0 && (
          <select value={periodCampaign} onChange={e => setPeriodCampaign(e.target.value)}
            style={{ marginLeft: 'auto', padding: '5px 14px', fontSize: 12, borderRadius: 8, border: `1px solid ${c.border}`, background: c.inputBg, color: c.inputText, outline: 'none' }}>
            <option value="">Todas las campañas</option>
            {campaigns.map(cam => <option key={cam.id} value={cam.id}>{cam.name}</option>)}
          </select>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
        {kpis.map(k => (
          <div key={k.l} onClick={k.action ? k.action : undefined} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', cursor: k.action ? 'pointer' : 'default', transition: 'transform 0.1s', ...(k.action && { '&:active': { transform: 'scale(0.98)' } }) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <i className={`ti ${k.icon}`} style={{ fontSize: 14, color: k.color }} />
              <p style={{ margin: 0, fontSize: 11, color: c.subtitle, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k.l}</p>
            </div>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 600, color: k.color }}>{k.v}</p>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {Object.keys(stats.byStatus).length > 0 && renderRechartsBar(stats.byStatus, STATUS_CONFIG, '📊 Por estado', (id) => onNavigate && onNavigate('status', id))}
        {Object.keys(stats.bySentimiento).length > 0 && renderRechartsPie(stats.bySentimiento, SENTIMIENTO_CONFIG, '😊 Sentimiento al cierre', (id) => onNavigate && onNavigate('sentimiento', id))}
        {Object.keys(stats.byFuga).length > 0 && renderRechartsPie(stats.byFuga, FUGA_CONFIG, '🚨 Riesgo de fuga', (id) => onNavigate && onNavigate('fuga', id))}
        {Object.keys(stats.byCanal).length > 0 && renderRechartsBar(stats.byCanal, null, '📡 Por canal', (id) => onNavigate && onNavigate('canal', id))}
      </div>
    </div>
  );
}

// ── Tablero Kanban ──────────────────────────────────────────────────────────────
function KanbanBoard({ conversations, typifications, c, onClick }) {
  // Inicializar estado desde localStorage
  const [collapsedColumns, setCollapsedColumns] = useState(() => {
    try {
      const saved = localStorage.getItem('kanbanCollapsedCols');
      if (saved) return new Set(JSON.parse(saved));
    } catch (e) { console.error('Error reading localStorage', e); }
    return new Set();
  });

  // Guardar en localStorage cada vez que cambie
  useEffect(() => {
    localStorage.setItem('kanbanCollapsedCols', JSON.stringify(Array.from(collapsedColumns)));
  }, [collapsedColumns]);

  if (!typifications || typifications.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: c.subtitle, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <i className="ti ti-layout-kanban" style={{ fontSize: 48, display: 'block', marginBottom: 16, color: '#635BFF' }} />
        <h3 style={{ margin: '0 0 8px', fontSize: 18, color: c.title }}>Vista Kanban no disponible</h3>
        <p style={{ margin: 0, fontSize: 14 }}>Por favor, selecciona una <strong>Campaña</strong> específica en los filtros para ver el tablero con sus etapas.</p>
      </div>
    );
  }

  const columns = [
    { id: 'sin_etapa', label: 'Entrada / Sin Etapa' },
    ...typifications.map(t => ({ id: t.label, label: t.label }))
  ];

  const grouped = {};
  columns.forEach(col => { grouped[col.id] = []; });

  conversations.forEach(conv => {
    const stage = conv.motivo_label || 'sin_etapa';
    if (grouped[stage]) grouped[stage].push(conv);
    else grouped['sin_etapa'].push(conv);
  });

  const toggleCollapse = (id, e) => {
    if (e) e.stopPropagation();
    const nextSet = new Set(collapsedColumns);
    if (nextSet.has(id)) nextSet.delete(id);
    else nextSet.add(id);
    setCollapsedColumns(nextSet);
  };

  return (
    <div style={{ display: 'flex', gap: 16, overflowX: 'auto', padding: '16px', height: '100%', boxSizing: 'border-box', background: c.inputBg }}>
      {columns.map(col => {
        const isCollapsed = collapsedColumns.has(col.id);
        if (isCollapsed) {
          return (
            <div key={col.id} onClick={() => toggleCollapse(col.id)} style={{ width: 60, flexShrink: 0, display: 'flex', flexDirection: 'column', background: c.card, borderRadius: 12, border: `1px solid ${c.border}`, cursor: 'pointer', transition: 'all 0.2s', alignItems: 'center', padding: '12px 0' }}>
              <i className="ti ti-arrows-maximize" style={{ fontSize: 16, color: '#635BFF', marginBottom: 16 }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: c.subtitle, background: c.inputBg, padding: '4px 8px', borderRadius: 12, border: `1px solid ${c.border}`, marginBottom: 16 }}>
                {grouped[col.id].length}
              </span>
              <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 13, fontWeight: 600, color: c.title, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                {col.label}
              </div>
            </div>
          );
        }

        return (
          <div key={col.id} style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', background: c.card, borderRadius: 12, border: `1px solid ${c.border}`, transition: 'all 0.2s' }}>
            <div style={{ padding: '12px 16px', borderBottom: `2px solid #635BFF`, background: c.inputBg, borderRadius: '12px 12px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: c.title, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {col.label}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: c.subtitle, background: c.card, padding: '2px 8px', borderRadius: 12, border: `1px solid ${c.border}` }}>
                  {grouped[col.id].length}
                </span>
                <i className="ti ti-arrows-minimize" onClick={(e) => toggleCollapse(col.id, e)} style={{ cursor: 'pointer', fontSize: 16, color: c.subtitle }} title="Minimizar columna" />
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {grouped[col.id].map(conv => (
                <div key={conv.id} onClick={() => onClick(conv.id)}
                  style={{ background: getChannelBg(conv.canal, c, 'kanban-normal'), border: `1px solid ${getChannelBorder(conv.canal, c)}`, borderRadius: 10, padding: 12, cursor: 'pointer', transition: 'transform 0.1s, box-shadow 0.1s, background 0.1s' }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
                    e.currentTarget.style.background = getChannelBg(conv.canal, c, 'hover');
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.background = getChannelBg(conv.canal, c, 'kanban-normal');
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: c.title, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {conv.contacts?.cliente_nombre || '—'}
                    </p>
                    <span style={{ fontSize: 10, color: c.subtitle, flexShrink: 0, marginLeft: 8 }}>{timeAgo(conv.last_message_at)}</span>
                  </div>
                  <p style={{ margin: '0 0 10px', fontSize: 11, color: c.subtitle, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {conv.last_message_preview || 'Sin mensajes aún'}
                  </p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <StatusBadge status={conv.status} />
                    {(conv.status === 'waiting_human' || conv.status === 'human_active') && <SLABadge lastMessageAt={conv.last_message_at} warningMinutes={conv.campaigns?.sla_warning_minutes} dangerMinutes={conv.campaigns?.sla_danger_minutes} />}
                    {conv.canal && <span style={{ fontSize: 9, padding: '2px 6px', background: c.card, borderRadius: 10, color: c.subtitle, border: `0.5px solid ${c.border}` }}>{conv.canal}</span>}
                  </div>
                </div>
              ))}
              {grouped[col.id].length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', color: c.subtitle, fontSize: 12, fontStyle: 'italic' }}>
                  Vacío
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Módulo principal CRM ──────────────────────────────────────────────────────
export default function CRMManager({ tenantId, isDark = true, userId, userEmail, userRole, isSuperAdmin }) {
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [view360Contact, setView360Contact] = useState(null);
  const [alerts, setAlerts] = useState({ count: 0, alerts: [] });
  const [campaigns, setCampaigns] = useState([]);
  const [groups, setGroups] = useState([]);
  const [tenantUsers, setTenantUsers] = useState([]);
  const [filterStatus, setFilterStatus] = useState('my');
  const [filterCanal, setFilterCanal] = useState('all');
  const [filterFuga, setFilterFuga] = useState('all');
  const [filterSentimiento, setFilterSentimiento] = useState('all');
  const [filterCampaign, setFilterCampaign] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('reports'); // 'inbox' | 'reports'
  const [viewMode, setViewMode] = useState('board'); // 'list' | 'board'
  const [campaignTypifications, setCampaignTypifications] = useState([]);
  const [forgottenThreshold, setForgottenThreshold] = useState(12);
  const displayName = userEmail?.split('@')[0] || 'Ejecutivo';

  const c = {
    card: isDark ? '#0D1020' : '#ffffff',
    border: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(99, 91, 255, 0.08)',
    title: isDark ? '#ffffff' : '#101828',
    subtitle: isDark ? '#A9B0C3' : '#667085',
    inputBg: isDark ? '#171A2F' : '#EEF2F9',
    inputText: isDark ? '#ffffff' : '#101828',
  };

  const fetchConversations = useCallback(async () => {
    if (!tenantId) return;
    try {
      const params = new URLSearchParams({ tenantId, limit: '100', userId });
      if (filterStatus && filterStatus !== 'all') params.set('status', filterStatus);
      if (filterCanal && filterCanal !== 'all') params.set('canal', filterCanal);
      if (filterFuga && filterFuga !== 'all') params.set('fuga', filterFuga);
      if (filterSentimiento && filterSentimiento !== 'all') params.set('sentimiento', filterSentimiento);
      if (filterCampaign) params.set('campaignId', filterCampaign);
      if (search) params.set('search', search);
      const [convRes, alertRes] = await Promise.all([
        fetch(`${API_URL}/api/crm/conversations?${params}`).then(r => r.ok ? r.json() : null),
        fetch(`${API_URL}/api/crm/alerts?tenantId=${tenantId}`).then(r => r.ok ? r.json() : null),
      ]);
      if (Array.isArray(convRes)) {
        setConversations(convRes);
        // Verificar si hay una conversacion que abrir desde ContactsManager
        const pendingConvId = localStorage.getItem('kuden_open_conv_id');
        if (pendingConvId) {
          setSelectedId(pendingConvId);
          setTab('inbox');
          localStorage.removeItem('kuden_open_conv_id');
        }
      }
      if (alertRes && !alertRes.error) {
        setAlerts(alertRes);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [tenantId, filterStatus, filterCanal, filterFuga, filterSentimiento, filterCampaign, search]);

  const forgottenTickets = useMemo(() => {
    return conversations.filter(c => {
      const isActive = c.status === 'active' || c.status === 'human_active' || c.status === 'pending_followup';
      if (!isActive || c.assigned_to !== userId) return false;
      const lastUpdate = new Date(c.last_message_at || c.updated_at || c.created_at);
      const hoursSinceUpdate = (new Date() - lastUpdate) / (1000 * 60 * 60);
      return hoursSinceUpdate >= forgottenThreshold;
    });
  }, [conversations, userId, forgottenThreshold]);

  const hasTooManyForgotten = forgottenTickets.length >= 3;

  // Carga inicial y polling cada 5 segundos
  useEffect(() => { fetchConversations(); }, [fetchConversations]);
  useEffect(() => {
    const t = setInterval(fetchConversations, 5000);
    return () => clearInterval(t);
  }, [fetchConversations]);

  // Cargar campañas, grupos y usuarios (solo una vez)
  useEffect(() => {
    if (!tenantId) return;
    fetch(`${API_URL}/api/crm/campaigns?tenantId=${tenantId}`)
      .then(r => r.json()).then(d => setCampaigns(Array.isArray(d) ? d : [])).catch(console.error);

    fetch(`${API_URL}/api/crm/groups?tenantId=${tenantId}`)
      .then(r => r.json()).then(d => setGroups(Array.isArray(d) ? d : [])).catch(console.error);

    fetch(`${API_URL}/api/crm/users?tenantId=${tenantId}`)
      .then(r => r.json()).then(d => setTenantUsers(Array.isArray(d) ? d : [])).catch(console.error);

    supabase.from('tenants').select('forgotten_ticket_hours_threshold').eq('id', tenantId).single()
      .then(({ data }) => { if (data?.forgotten_ticket_hours_threshold) setForgottenThreshold(data.forgotten_ticket_hours_threshold); })
      .catch(console.error);
  }, [tenantId]);

  // Cargar tipificaciones de la campaña seleccionada para el Kanban
  useEffect(() => {
    if (!filterCampaign) {
      setCampaignTypifications([]);
      return;
    }
    fetch(`${API_URL}/api/crm/campaigns/${filterCampaign}/typifications`)
      .then(r => r.json()).then(d => setCampaignTypifications(Array.isArray(d) ? d : [])).catch(console.error);
  }, [filterCampaign]);

  const FILTER_TABS = [
    { id: 'my', label: '🙋 Asignadas a mí' },
    { id: 'open', label: 'Activas' },
    { id: 'all', label: 'Todas' },
    { id: 'waiting_human', label: '⚡ Necesitan Atención', badge: alerts.count },
    { id: 'active', label: '🤖 IA Activa' },
    { id: 'human_active', label: '👨‍💼 Con Ejecutivo' },
    { id: 'pending_csat', label: '⭐ CSAT Pendiente' },
    { id: 'pending_followup', label: '⏳ Pendientes' },
    { id: 'closed', label: '✅ Cerradas' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 'bold', margin: '0 0 4px', color: c.title }}>CRM Operacional</h2>
          <p style={{ margin: 0, fontSize: 14, color: c.subtitle }}>
            {loading ? 'Cargando...' : `${conversations.length} conversacion${conversations.length !== 1 ? 'es' : ''}`}
            {alerts.count > 0 && <span style={{ marginLeft: 8, color: '#F6B940', fontWeight: 600 }}>· ⚡ {alerts.count} requieren atención</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['inbox', '📥 Bandeja'], ['reports', '📊 Reportes']].map(([id, label]) => (
            <button key={id} onClick={() => { setTab(id); setSelectedId(null); }}
              style={{
                padding: '8px 16px', fontSize: 13, fontWeight: tab === id ? 600 : 400, borderRadius: 8,
                border: `1px solid ${tab === id ? '#635BFF' : c.border}`,
                background: tab === id ? '#635BFF' : 'transparent',
                color: tab === id ? '#fff' : c.subtitle, cursor: 'pointer'
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'reports' ? (
        <ReportPanel tenantId={tenantId} c={c} campaigns={campaigns} onNavigate={(type, val) => {
          setTab('inbox');
          setViewMode('list'); // Switch to list view as requested

          // Reset other filters to avoid conflicts when coming from reports
          setFilterStatus('all');
          setFilterCanal('all');
          setFilterFuga('all');
          setFilterSentimiento('all');
          setFilterCampaign('');

          // Set the specific filter clicked
          if (type === 'status') setFilterStatus(val);
          else if (type === 'canal') setFilterCanal(val);
          else if (type === 'fuga') setFilterFuga(val);
          else if (type === 'sentimiento') setFilterSentimiento(val);
        }} />
      ) : (
        <>
          {/* Panel de alertas */}
          {alerts.count > 0 && (
            <div style={{ background: isDark ? 'rgba(246, 185, 64, 0.15)' : '#FEF3E0', border: `1px solid ${isDark ? 'rgba(246, 185, 64, 0.3)' : '#EF9F2760'}`, borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <i className="ti ti-alert-triangle" style={{ fontSize: 16, color: '#F6B940' }} />
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: isDark ? '#F6B940' : '#92400E' }}>{alerts.count} conversacion{alerts.count > 1 ? 'es requieren' : ' requiere'} atención humana</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {alerts.alerts.slice(0, 3).map(a => (
                  <div key={a.id} onClick={() => setSelectedId(a.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.6)', borderRadius: 8, cursor: 'pointer' }}>
                    <i className={`ti ${a.fuga_final === 'alto' ? 'ti-flame' : 'ti-user-question'}`} style={{ fontSize: 14, color: a.fuga_final === 'alto' ? '#FF5E73' : '#F6B940' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: isDark ? '#FFF' : '#78350F' }}>{a.contacts?.cliente_nombre || '—'}</p>
                      <p style={{ margin: 0, fontSize: 11, color: isDark ? 'var(--color-text-secondary)' : '#92400E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.last_message_preview}</p>
                    </div>
                    <span style={{ fontSize: 10, color: isDark ? 'var(--color-text-tertiary)' : '#92400E' }}>{timeAgo(a.last_message_at)}</span>
                    <button style={{ fontSize: 11, padding: '3px 10px', background: '#F6B940', color: '#fff', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 600 }}>
                      → Atender
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Layout: bandeja + detalle */}
          {view360Contact ? (
            <div style={{ height: 'calc(100vh - 170px)', background: c.card, borderRadius: 12, overflow: 'hidden' }}>
              <Contact360View
                contact={view360Contact}
                onBack={() => setView360Contact(null)}
                isDark={isDark}
                c={c}
                tenantId={tenantId}
                userId={userId}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 0, background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, overflow: 'hidden', height: 'calc(100vh - 170px)' }}>
              {/* Columna izquierda: Bandeja */}
              <div className={`crm-list-col ${selectedId ? 'hide-on-mobile' : 'mobile-full-width'}`} style={{ width: selectedId ? 340 : '100%', borderRight: selectedId ? `1px solid ${c.border}` : 'none', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                {/* Filtros */}
                <div style={{ padding: '10px 12px', borderBottom: `1px solid ${c.border}`, background: isDark ? '#0f0f0f' : '#f9fafb' }}>
                  {forgottenTickets.length > 0 && (
                    <div style={{ background: isDark ? 'rgba(255, 94, 115, 0.15)' : '#FEF2F2', border: `1px solid ${isDark ? 'rgba(255, 94, 115, 0.3)' : '#FCA5A5'}`, padding: '12px 16px', margin: '0 0 16px 0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '20px' }}>🚨</span>
                        <div>
                          <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: isDark ? '#FF5E73' : '#991B1B' }}>¡Alerta de Cierre de Tickets!</p>
                          <p style={{ margin: 0, fontSize: '12px', color: isDark ? 'var(--color-text-secondary)' : '#B91C1C' }}>Tienes {forgottenTickets.length} conversación{forgottenTickets.length !== 1 ? 'es' : ''} inactiva{forgottenTickets.length !== 1 ? 's' : ''} por más de {forgottenThreshold} horas. Tipifíca{forgottenTickets.length !== 1 ? 'las' : 'la'} y ciérra{forgottenTickets.length !== 1 ? 'las' : 'la'}.</p>
                        </div>
                      </div>
                      <button onClick={() => { setViewMode('list'); setFilterStatus('human_active'); setFilterCanal('all'); setFilterCampaign(''); }} style={{ padding: '8px 14px', background: '#FF5E73', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                        Filtrar Mis Tickets Olvidados
                      </button>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o ticket..."
                      style={{ flex: 1, padding: '7px 10px', fontSize: 12, borderRadius: 8, border: `1px solid ${c.border}`, background: c.inputBg, color: c.inputText, outline: 'none', boxSizing: 'border-box' }} />
                    {/* View Toggle */}
                    <div style={{ display: 'flex', background: c.inputBg, borderRadius: 8, border: `1px solid ${c.border}`, overflow: 'hidden' }}>
                      <button onClick={() => setViewMode('list')} title="Vista de Lista"
                        style={{ padding: '0 10px', background: viewMode === 'list' ? '#635BFF' : 'transparent', color: viewMode === 'list' ? '#fff' : c.subtitle, border: 'none', cursor: 'pointer' }}>
                        <i className="ti ti-list" style={{ fontSize: 16 }} />
                      </button>
                      <button onClick={() => setViewMode('board')} title="Vista de Tablero Kanban"
                        style={{ padding: '0 10px', background: viewMode === 'board' ? '#635BFF' : 'transparent', color: viewMode === 'board' ? '#fff' : c.subtitle, border: 'none', cursor: 'pointer', borderLeft: `1px solid ${c.border}` }}>
                        <i className="ti ti-layout-kanban" style={{ fontSize: 16 }} />
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {FILTER_TABS.map(f => (
                      <button key={f.id} onClick={() => setFilterStatus(f.id)}
                        style={{
                          fontSize: 10, padding: '3px 8px', borderRadius: 20, border: `1px solid ${filterStatus === f.id ? '#635BFF' : c.border}`,
                          background: filterStatus === f.id ? '#635BFF' : 'transparent',
                          color: filterStatus === f.id ? '#fff' : c.subtitle, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap'
                        }}>
                        {f.label}
                        {f.badge > 0 && <span style={{ background: '#F6B940', color: '#fff', borderRadius: 10, fontSize: 9, padding: '0 4px' }}>{f.badge}</span>}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                    <select value={filterCanal} onChange={e => setFilterCanal(e.target.value)}
                      style={{ flex: 1, minWidth: 100, padding: '5px 8px', fontSize: 11, borderRadius: 8, border: `1px solid ${c.border}`, background: c.inputBg, color: c.inputText, outline: 'none' }}>
                      <option value="all">Canales (Todos)</option>
                      <option value="webchat">Web Chat</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="instagram">Instagram</option>
                      <option value="email">Email</option>
                      <option value="voz">Llamada de Voz</option>
                    </select>
                    <select value={filterFuga} onChange={e => setFilterFuga(e.target.value)}
                      style={{ flex: 1, minWidth: 100, padding: '5px 8px', fontSize: 11, borderRadius: 8, border: `1px solid ${c.border}`, background: c.inputBg, color: c.inputText, outline: 'none' }}>
                      <option value="all">Riesgo (Todos)</option>
                      <option value="bajo">Riesgo Bajo</option>
                      <option value="medio">Riesgo Medio</option>
                      <option value="alto">Riesgo Alto</option>
                    </select>
                    <select value={filterSentimiento} onChange={e => setFilterSentimiento(e.target.value)}
                      style={{ flex: 1, minWidth: 100, padding: '5px 8px', fontSize: 11, borderRadius: 8, border: `1px solid ${c.border}`, background: c.inputBg, color: c.inputText, outline: 'none' }}>
                      <option value="all">Sentimiento (Todos)</option>
                      <option value="positivo">Positivo</option>
                      <option value="neutral">Neutral</option>
                      <option value="negativo">Negativo</option>
                    </select>
                    {campaigns.length > 0 && (
                      <select value={filterCampaign} onChange={e => setFilterCampaign(e.target.value)}
                        style={{ flex: 1, minWidth: 100, padding: '5px 8px', fontSize: 11, borderRadius: 8, border: `1px solid ${c.border}`, background: c.inputBg, color: c.inputText, outline: 'none' }}>
                        <option value="">Campañas (Todas)</option>
                        {campaigns.map(cam => <option key={cam.id} value={cam.id}>{cam.name}</option>)}
                      </select>
                    )}
                  </div>
                </div>
                {/* Lista o Tablero */}
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
                  ) : viewMode === 'board' && !selectedId ? (
                    <KanbanBoard conversations={conversations} typifications={campaignTypifications} c={c} onClick={id => setSelectedId(id)} />
                  ) : (
                    conversations.map(conv => (
                      <ConvRow key={conv.id} conv={conv} isSelected={selectedId === conv.id}
                        onClick={() => setSelectedId(conv.id)} c={c} groups={groups} tenantUsers={tenantUsers} />
                    ))
                  )}
                </div>
              </div>

              {/* Columna derecha: Detalle */}
              {selectedId && (
                <div className="crm-detail-col mobile-full-width" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <ConversationDetail
                    convId={selectedId}
                    tenantId={tenantId}
                    userId={userId}
                    displayName={displayName}
                    userRole={userRole}
                    isSuperAdmin={isSuperAdmin}
                    c={c}
                    campaigns={campaigns}
                    groups={groups}
                    tenantUsers={tenantUsers}
                    onBack={() => setSelectedId(null)}
                    onView360={(cId) => setView360Contact(cId)}
                    hasTooManyForgotten={hasTooManyForgotten}
                    forgottenCount={forgottenTickets.length}
                    isDark={isDark}
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
