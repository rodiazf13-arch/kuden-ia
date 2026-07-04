import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { supabase } from '../lib/supabaseClient';
import KimiMascot from '../KimiMascot.jsx';

export default function CopilotManager({ tenantId, isDark = true }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) {
        setUserId(session.user.id);
      }
    });
  }, []);

  useEffect(() => {
    if (tenantId && userId) {
      fetchHistory();
    }
  }, [tenantId, userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchHistory = async () => {
    setFetching(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const res = await fetch(`${API_URL}/api/copilot/history?tenantId=${tenantId}&userId=${userId}`);
      const data = await res.json();
      if (data.messages) {
        setMessages(data.messages);
      }
    } catch (e) {
      console.error("Error fetching copilot history", e);
    } finally {
      setFetching(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading || !userId) return;

    const userMessage = { sender_type: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const res = await fetch(`${API_URL}/api/copilot/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, userId, message: userMessage.content })
      });
      const data = await res.json();
      if (data.message) {
        setMessages(prev => [...prev, data.message]);
      } else if (data.error) {
        setMessages(prev => [...prev, { sender_type: 'ai', content: `**Error:** ${data.error}` }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { sender_type: 'ai', content: `**Error de conexión:** ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const userMessage = { sender_type: 'user', content: `📎 Subió el documento: **${file.name}**\n\nPor favor, diseña la estructura de agentes IA para mi empresa basándote en este documento.` };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tenantId', tenantId);

      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const res = await fetch(`${API_URL}/api/copilot/onboarding/pdf`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (data.profiles) {
        setMessages(prev => [...prev, {
          sender_type: 'ai',
          content: `He analizado tu documento y diseñado la siguiente estructura de agentes IA para tu negocio. Revisa la propuesta y haz clic en "Autorizar y Crear Perfiles" si estás de acuerdo.`,
          proposedProfiles: data.profiles
        }]);
      } else if (data.error) {
        setMessages(prev => [...prev, { sender_type: 'ai', content: `**Error:** ${data.error}` }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { sender_type: 'ai', content: `**Error de conexión:** ${err.message}` }]);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleCreateProfiles = async (profiles) => {
    if (!window.confirm("¿Estás seguro de que deseas crear estos perfiles en tu base de datos?")) return;
    setLoading(true);
    try {
      // Obtener modelo por defecto (Opción B: Herencia)
      let defaultProv = 'anthropic';
      let defaultMod = 'claude-sonnet-4-6';
      const { data: config } = await supabase.from('tenant_ai_config').select('kimi_llm_provider, kimi_llm_model').eq('tenant_id', tenantId).maybeSingle();
      if (config && config.kimi_llm_provider) {
        defaultProv = config.kimi_llm_provider;
        defaultMod = config.kimi_llm_model;
      }

      const nonRouters = profiles.filter(p => !p.is_router);
      const routers = profiles.filter(p => p.is_router);
      const labelToIdMap = {};

      for (const p of nonRouters) {
        const payload = {
          tenant_id: tenantId, label: p.label, description: p.description, persona_prompt: p.persona_prompt,
          hint_text: p.hint_text, color: p.color || '#2563eb', bg: p.bg || '#eff6ff', icon: p.icon || 'ti-robot',
          is_global: false, llm_provider: defaultProv, llm_model: defaultMod,
          is_router: false, sub_profile_ids: []
        };
        const { data, error } = await supabase.from('ai_profiles').insert([payload]).select().single();
        if (error) throw error;
        labelToIdMap[p.label] = data.id;
      }

      for (const p of routers) {
        const subIds = (p.sub_profiles || []).map(lbl => labelToIdMap[lbl]).filter(Boolean);
        const payload = {
          tenant_id: tenantId, label: p.label, description: p.description, persona_prompt: p.persona_prompt,
          hint_text: p.hint_text, color: p.color || '#f59e0b', bg: p.bg || '#fffbeb', icon: p.icon || 'ti-share',
          is_global: false, llm_provider: defaultProv, llm_model: defaultMod,
          is_router: true, sub_profile_ids: subIds
        };
        const { error } = await supabase.from('ai_profiles').insert([payload]);
        if (error) throw error;
      }

      setMessages(prev => [...prev, { sender_type: 'ai', content: `✅ ¡Listo! Los perfiles han sido creados con éxito. Puedes ir a "Perfiles del Agente IA" en el menú para verlos y editarlos.` }]);
    } catch (err) {
      alert("Error al crear perfiles: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = async () => {
    if (!window.confirm("¿Estás seguro de que deseas borrar todo el historial del chat actual con Kimi?")) return;

    setMessages([]);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      await fetch(`${API_URL}/api/copilot/history?tenantId=${tenantId}&userId=${userId}`, {
        method: 'DELETE'
      });
    } catch (e) {
      console.error("Error clearing chat history", e);
    }
  };

  return (
    <div className="copilot-container">
      <div className="copilot-wrapper">

        {/* Cabecera */}
        <div className="copilot-header">
          <div className="copilot-header-info">
            <KimiMascot size={70} state={loading ? 'thinking' : 'idle'} />
            <div>
              <h2 className="copilot-header-title">Co-Piloto (Kimi)</h2>
              <p className="copilot-header-subtitle">Tu consultora estratégica y asistente interna</p>
            </div>
          </div>
          {messages.length > 0 && (
            <button onClick={handleClearChat} className="copilot-btn-clear">
              <i className="ti ti-trash"></i> Limpiar
            </button>
          )}
        </div>

        {/* Área de mensajes */}
        <div className="copilot-messages-area">
          {fetching ? (
            <div className="copilot-fetching-state">Cargando sesión...</div>
          ) : messages.length === 0 ? (
            <div className="copilot-empty-state">
              <div className="copilot-empty-icon-container">
                <KimiMascot size={154} state="happy" />
              </div>
              <h3 className="copilot-empty-title">¡Hola! Soy Kimi.</h3>
              <p className="copilot-empty-desc">
                Estoy conectada a los datos de la empresa y lista para ayudarte. Pregúntame sobre estrategias, pídeme redactar correos, o analicemos juntas las métricas de tus campañas.
              </p>
            </div>
          ) : (
            messages.map((m, i) => {
              const isUser = m.sender_type === 'user';
              return (
                <div key={i} className={`copilot-message-row ${isUser ? 'user' : 'ai'}`}>
                  <div className={`copilot-bubble ${isUser ? 'user' : 'ai'}`}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {m.content}
                    </ReactMarkdown>

                    {m.proposedProfiles && (
                      <div className="copilot-proposal-container">
                        <div className="copilot-proposal-grid">
                          {m.proposedProfiles.map((p, idx) => (
                            <div key={idx} className="copilot-proposal-card">
                              <p className="copilot-proposal-title">
                                <i className={`ti ${p.icon || 'ti-robot'}`} style={{ color: p.color || 'var(--color-primary)' }}></i>
                                {p.label}
                                {p.is_router && <span className="copilot-proposal-router-badge">ROUTER</span>}
                              </p>
                              <p className="copilot-proposal-desc">{p.description}</p>
                              {p.is_router && p.sub_profiles && (
                                <p className="copilot-proposal-router-paths">
                                  <i className="ti ti-arrow-forward-up"></i> Deriva a: {p.sub_profiles.join(', ')}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => handleCreateProfiles(m.proposedProfiles)}
                          className="copilot-btn-create-profiles"
                        >
                          <i className="ti ti-wand"></i> Autorizar y Crear Perfiles
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Indicador de pensamiento */}
          {loading && (
            <div className="copilot-thinking-row">
              <KimiMascot size={62} state="thinking" />
              <div className="copilot-thinking-bubble">
                <div className="copilot-thinking-dots">
                  <span className="copilot-thinking-dot" />
                  <span className="copilot-thinking-dot" />
                  <span className="copilot-thinking-dot" />
                </div>
                <span>Kimi está pensando...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Zona de input inferior */}
        <div className="copilot-input-area">
          <form onSubmit={handleSend} className="copilot-form">
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="application/pdf" onChange={handleFileUpload} />
            <button
              type="button"
              onClick={() => fileInputRef.current.click()}
              disabled={loading || fetching}
              title="Adjuntar PDF Onboarding"
              className="copilot-btn-attach"
            >
              <i className="ti ti-paperclip"></i>
            </button>
            <input
              type="text"
              placeholder="Escribe tu consulta a Kimi..."
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={loading || fetching}
              className="copilot-input"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading || fetching}
              className={`copilot-btn-send ${input.trim() && !loading && !fetching ? 'active' : ''}`}
            >
              <i className="ti ti-send"></i>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
