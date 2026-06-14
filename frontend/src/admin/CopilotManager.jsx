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
  const [userId, setUserId] = useState(null);

  const c = {
    bg: isDark ? '#0a0a0a' : '#f9fafb',
    card: isDark ? '#111' : '#ffffff',
    border: isDark ? '#222' : '#e5e7eb',
    textMain: isDark ? '#f9fafb' : '#111827',
    textSec: isDark ? '#9ca3af' : '#6b7280',
    primary: '#2563eb',
    userBubble: isDark ? '#2563eb' : '#3b82f6',
    aiBubble: isDark ? '#1a1a1a' : '#f3f4f6',
  };

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
    <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, display: 'flex', flexDirection: 'column', background: c.bg, borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
        <div style={{ padding: '20px', borderBottom: `1px solid ${c.border}`, background: c.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <KimiMascot size={40} state={loading ? 'thinking' : 'idle'} />
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', color: c.textMain }}>Co-Piloto (Kimi)</h2>
              <p style={{ margin: 0, fontSize: '13px', color: c.textSec }}>Tu consultora estratégica y asistente interna</p>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              style={{ padding: '6px 12px', background: 'transparent', border: `1px solid ${c.border}`, borderRadius: '6px', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', transition: 'all 0.2s' }}
              onMouseOver={(e) => { e.currentTarget.style.background = '#ef444422'; e.currentTarget.style.borderColor = '#ef4444'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = c.border; }}
            >
              <i className="ti ti-trash"></i> Limpiar
            </button>
          )}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {fetching ? (
            <div style={{ textAlign: 'center', color: c.textSec, marginTop: '40px' }}>Cargando sesión...</div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', marginTop: '60px', color: c.textSec }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                <KimiMascot size={94} state="happy" />
              </div>
              <h3 style={{ margin: '0 0 8px', color: c.textMain }}>¡Hola! Soy Kimi.</h3>
              <p style={{ maxWidth: '400px', margin: '0 auto', lineHeight: '1.5' }}>
                Estoy conectada a los datos de la empresa y lista para ayudarte. Pregúntame sobre estrategias, pídeme redactar correos, o analicemos juntas las métricas de tus campañas.
              </p>
            </div>
          ) : (
            messages.map((m, i) => {
              const isUser = m.sender_type === 'user';
              return (
                <div key={i} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '75%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: isUser ? c.userBubble : c.aiBubble,
                    color: isUser ? '#fff' : c.textMain,
                    border: isUser ? 'none' : `1px solid ${c.border}`,
                    fontSize: '14px',
                    lineHeight: '1.5',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                  }}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ node, ...props }) => <p style={{ margin: '0 0 8px' }} {...props} />,
                        a: ({ node, ...props }) => <a style={{ color: isUser ? '#fff' : c.primary, textDecoration: 'underline' }} {...props} />,
                        pre: ({ node, ...props }) => <pre style={{ background: 'rgba(0,0,0,0.5)', padding: '10px', borderRadius: '6px', overflowX: 'auto', marginTop: '8px' }} {...props} />,
                        code: ({ node, inline, ...props }) => inline
                          ? <code style={{ background: 'rgba(0,0,0,0.2)', padding: '2px 4px', borderRadius: '4px' }} {...props} />
                          : <code {...props} />,
                        table: ({ node, ...props }) => <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', marginBottom: '10px' }} {...props} />,
                        th: ({ node, ...props }) => <th style={{ borderBottom: '2px solid rgba(100,100,100,0.5)', padding: '8px', textAlign: 'left' }} {...props} />,
                        td: ({ node, ...props }) => <td style={{ borderBottom: '1px solid rgba(100,100,100,0.2)', padding: '8px' }} {...props} />
                      }}
                    >
                      {m.content}
                    </ReactMarkdown>
                  </div>
                </div>
              );
            })
          )}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-end', gap: '10px' }}>
              <KimiMascot size={32} state="thinking" />
              <div style={{ padding: '12px 16px', borderRadius: '12px', background: c.aiBubble, color: c.textSec, border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#6b7280', display: 'inline-block', animation: 'kimiBounce 1.2s infinite ease-in-out', animationDelay: '0s' }} />
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#6b7280', display: 'inline-block', animation: 'kimiBounce 1.2s infinite ease-in-out', animationDelay: '0.2s' }} />
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#6b7280', display: 'inline-block', animation: 'kimiBounce 1.2s infinite ease-in-out', animationDelay: '0.4s' }} />
                </span>
                <span style={{ fontSize: '13px' }}>Kimi está pensando...</span>
              </div>
            </div>
          )}
          <style>{`
          @keyframes kimiBounce {
            0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
            40% { transform: translateY(-6px); opacity: 1; }
          }
        `}</style>
          <div ref={messagesEndRef} />
        </div>

        <div style={{ padding: '20px', borderTop: `1px solid ${c.border}`, background: c.card }}>
          <form onSubmit={handleSend} style={{ display: 'flex', gap: '10px', maxWidth: '900px', margin: '0 auto' }}>
            <input
              type="text"
              placeholder="Escribe tu consulta a Kimi..."
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={loading || fetching}
              style={{
                flex: 1,
                padding: '14px 20px',
                borderRadius: '24px',
                border: `1px solid ${c.border}`,
                background: c.bg,
                color: c.textMain,
                outline: 'none',
                fontSize: '15px'
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading || fetching}
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                background: input.trim() && !loading ? c.primary : c.border,
                color: '#fff',
                border: 'none',
                cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                transition: 'background 0.2s'
              }}
            >
              <i className="ti ti-send"></i>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
