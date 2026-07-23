import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../lib/supabaseClient';
import KimiMascot from '../KimiMascot.jsx';
import { useKimi } from '../lib/KimiContext.jsx';

export default function KimiWidget({ tenantId, isDark, currentTab }) {
  const { kimiState, setKimiState } = useKimi();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUserId(data.user.id);
    });
  }, []);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Welcome message when opened the first time
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        sender_type: 'ai',
        content: `¡Hola! Soy Kimi. Veo que estás en la pantalla de **${getTabName(currentTab)}**. ¿En qué puedo asesorarte o ayudarte a configurar aquí?`
      }]);
    }
  }, [isOpen]);

  // Mensaje dinámico si el usuario cambia de pestaña mientras Kimi está abierta o vuelve a abrirla
  useEffect(() => {
    if (messages.length > 0) {
      const newMsg = `*(Cambiaste a la pantalla de **${getTabName(currentTab)}**. Pregúntame sobre esta vista si necesitas ayuda)*`;
      setMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.content === newMsg) return prev;
        return [...prev, { sender_type: 'ai', content: newMsg }];
      });
    }
  }, [currentTab]);

  const getTabName = (tabId) => {
    const map = {
      simulator: "Simulador IA",
      integrations: "Hub de Integraciones",
      crm: "CRM (Mensajes)",
      campaigns: "Campañas",
      contacts: "Contactos",
      ai_config: "Identidad Maestra",
      profiles: "Perfiles IA",
      insights: "Kimi Insights",
      users: "Usuarios",
      tenants: "Empresas",
      global_keys: "Gestión APIs y LLM",
      billing: "Tarificador"
    };
    return map[tabId] || tabId || "Dashboard";
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || !userId || !tenantId) return;

    const userMessage = { sender_type: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setKimiState('thinking');

    try {
      const payload = {
        tenantId,
        userId,
        message: input,
        history: messages.map(m => ({ role: m.sender_type === 'ai' ? 'assistant' : 'user', content: m.content })),
        appContext: getTabName(currentTab)
      };

      const API_URL = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${API_URL}/api/copilot/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.message) {
        setMessages(prev => [...prev, { sender_type: 'ai', content: data.message.content || data.message }]);
      } else if (data.error) {
        setMessages(prev => [...prev, { sender_type: 'ai', content: `Error: ${data.error}` }]);
      }
      setKimiState('success');
      setTimeout(() => setKimiState('idle'), 3000);
    } catch (err) {
      setMessages(prev => [...prev, { sender_type: 'ai', content: `Error de red: ${err.message}` }]);
      setKimiState('idle');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="kimi-widget-container">

      {/* Ventana de Chat */}
      {isOpen && (
        <div className="kimi-widget-window">
          {/* Header */}
          <div className="kimi-widget-header">
            <div className="kimi-widget-header-info">
              <KimiMascot size={40} hideBubble={true} state={kimiState} style={{ marginTop: '30px', marginLeft: '20px' }} />
              <div>
                <h3 className="kimi-widget-title">Kimi Co-Piloto</h3>
                <p className="kimi-widget-subtitle">Asistencia Contextual</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="kimi-widget-close-btn">
              <i className="ti ti-x"></i>
            </button>
          </div>

          {/* Messages */}
          <div className="kimi-widget-body">
            {messages.map((m, i) => (
              <div key={i} className={`kimi-widget-message-row ${m.sender_type === 'user' ? 'user' : 'ai'}`}>
                <div className={`kimi-widget-bubble ${m.sender_type === 'user' ? 'user' : 'ai'}`}>
                  <ReactMarkdown>
                    {m.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
            {loading && (
              <div className="kimi-widget-typing-indicator">
                <div className="kimi-widget-typing-bubble">
                  <i className="ti ti-dots"></i> Kimi está escribiendo...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="kimi-widget-footer">
            <form onSubmit={handleSend} className="kimi-widget-form">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Pregunta a Kimi sobre esta pantalla..."
                className="kimi-widget-input"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="kimi-widget-send-btn"
              >
                <i className="ti ti-send"></i>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Botón Flotante */}
      {isOpen ? (
        <button
          onClick={() => setIsOpen(false)}
          className="kimi-widget-fab open"
        >
          <i className="ti ti-x"></i>
        </button>
      ) : (
        <KimiMascot size={126} state={kimiState} closable={true} onClick={() => setIsOpen(true)} />
      )}

    </div>
  );
}
