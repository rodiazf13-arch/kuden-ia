import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../lib/supabaseClient';

export default function KimiWidget({ tenantId, isDark, currentTab }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const messagesEndRef = useRef(null);

  const c = {
    bg: isDark ? '#1a1a2e' : '#ffffff',
    card: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc',
    border: isDark ? '#2a2a40' : '#e2e8f0',
    primary: '#2563eb',
    textMain: isDark ? '#f8fafc' : '#1e293b',
    textSec: isDark ? '#94a3b8' : '#64748b'
  };

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
      global_keys: "Llaves API",
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
        setMessages(prev => [...prev, { sender_type: 'ai', content: data.message }]);
      } else if (data.error) {
        setMessages(prev => [...prev, { sender_type: 'ai', content: `Error: ${data.error}` }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { sender_type: 'ai', content: `Error de red: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      
      {/* Ventana de Chat */}
      {isOpen && (
        <div style={{
          width: '350px',
          height: '500px',
          maxHeight: '70vh',
          background: c.bg,
          border: `1px solid ${c.border}`,
          borderRadius: '16px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          marginBottom: '16px',
          overflow: 'hidden',
          animation: 'fadeSlideIn 0.3s ease'
        }}>
          {/* Header */}
          <div style={{ background: c.primary, padding: '16px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#fff', color: c.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                <i className="ti ti-bulb"></i>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 'bold' }}>Kimi Co-Piloto</h3>
                <p style={{ margin: 0, fontSize: 10, opacity: 0.8 }}>Asistencia Contextual</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>
              <i className="ti ti-x"></i>
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: c.card }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.sender_type === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  background: m.sender_type === 'user' ? c.primary : (isDark ? 'rgba(255,255,255,0.05)' : '#fff'),
                  color: m.sender_type === 'user' ? '#fff' : c.textMain,
                  border: m.sender_type === 'user' ? 'none' : `1px solid ${c.border}`,
                  fontSize: 13,
                  boxShadow: m.sender_type === 'user' ? 'none' : '0 2px 5px rgba(0,0,0,0.02)'
                }}>
                  <ReactMarkdown
                    components={{
                      p: ({node, ...props}) => <p style={{margin: '0 0 8px'}} {...props} />,
                      a: ({node, ...props}) => <a style={{color: m.sender_type === 'user' ? '#fff' : c.primary, textDecoration: 'underline'}} {...props} />,
                      code: ({node, ...props}) => <code style={{background: 'rgba(0,0,0,0.1)', padding: '2px 4px', borderRadius: 4, fontSize: 11}} {...props} />
                    }}
                  >
                    {m.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '10px 14px', borderRadius: '12px', background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', border: `1px solid ${c.border}`, fontSize: 13, color: c.textSec }}>
                  <i className="ti ti-dots"></i> Kimi está escribiendo...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '12px', borderTop: `1px solid ${c.border}`, background: c.bg }}>
            <form onSubmit={handleSend} style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Pregunta a Kimi sobre esta pantalla..."
                style={{ flex: 1, padding: '10px 14px', borderRadius: '20px', border: `1px solid ${c.border}`, background: c.card, color: c.textMain, outline: 'none', fontSize: 13 }}
                disabled={loading}
              />
              <button 
                type="submit" 
                disabled={loading || !input.trim()}
                style={{ width: 38, height: 38, borderRadius: '50%', background: c.primary, color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', opacity: loading || !input.trim() ? 0.5 : 1 }}
              >
                <i className="ti ti-send"></i>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Botón Flotante */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: c.primary,
          color: '#fff',
          border: 'none',
          boxShadow: '0 8px 24px rgba(37, 99, 235, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '28px',
          cursor: 'pointer',
          transition: 'transform 0.2s, box-shadow 0.2s',
          zIndex: 1000
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        <i className={isOpen ? "ti ti-x" : "ti ti-bulb"}></i>
      </button>

    </div>
  );
}
