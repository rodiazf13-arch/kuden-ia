import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import EmailAccountsManager from './EmailAccountsManager';
import WidgetSettings from './WidgetSettings';

export default function IntegrationsHub({ isDark, tenantId }) {
  const [connectingId, setConnectingId] = useState(null);
  const [emailWebhook, setEmailWebhook] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  useEffect(() => {
    if (tenantId) {
      supabase.from('tenants').select('n8n_outbound_email_webhook').eq('id', tenantId).single()
        .then(({ data }) => {
          if (data) setEmailWebhook(data.n8n_outbound_email_webhook || '');
        });
    }
  }, [tenantId]);

  const saveEmailWebhook = async () => {
    if (!tenantId) return;
    setSavingEmail(true);
    await supabase.from('tenants').update({ n8n_outbound_email_webhook: emailWebhook }).eq('id', tenantId);
    setSavingEmail(false);
    alert('Webhook guardado exitosamente.');
  };

  const textMain = isDark ? '#f9fafb' : '#111827';
  const textSec = isDark ? '#9ca3af' : '#6b7280';
  const cardBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.7)';
  const borderCol = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  // Integraciones agrupadas
  const integrations = [
    {
      category: 'Agendamiento y Calendarios',
      items: [
        { id: 'gcal', name: 'Google Calendar', icon: 'ti-brand-google', color: '#DB4437', status: 'disconnected', description: 'Sincronización bidireccional de citas e invitaciones automáticas.' },
        { id: 'outlook', name: 'Outlook Calendar', icon: 'ti-brand-windows', color: '#0078D4', status: 'disconnected', description: 'Conecta con Microsoft 365 para agendamientos corporativos.' },
        { id: 'calendly', name: 'Calendly', icon: 'ti-calendar-event', color: '#006BFF', status: 'disconnected', description: 'Permite a Kuden generar y compartir tus links de Calendly.' },
        { id: 'calcom', name: 'Cal.com', icon: 'ti-calendar-time', color: '#111111', status: 'disconnected', description: 'Integración open-source para enrutamiento avanzado de citas.' },
      ]
    },
    {
      category: 'Canales Oficiales y Meta',
      items: [
        { id: 'meta_wa', name: 'Meta WhatsApp Cloud', icon: 'ti-brand-whatsapp', color: '#25D366', status: 'disconnected', description: 'Tech Provider Oficial. Conecta números de WhatsApp Business API.' },
        { id: 'meta_ig', name: 'Instagram Direct', icon: 'ti-brand-instagram', color: '#E1306C', status: 'disconnected', description: 'Respuestas automáticas a DMs y comentarios en posts.' }
      ]
    }
  ];

  const handleConnect = (id) => {
    setConnectingId(id);
    // Simular un proceso de conexión OAuth
    setTimeout(() => {
      setConnectingId(null);
      alert('Esta funcionalidad se integrará con n8n OAuth Próximamente.');
    }, 1500);
  };

  return (
    <div style={{ padding: '0 20px', maxWidth: 1200, margin: '0 auto', animation: 'fadeIn 0.4s ease-out' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', margin: '0 0 8px 0', color: textMain, letterSpacing: '-0.5px' }}>
            Hub de Integraciones
          </h1>
          <p style={{ margin: 0, color: textSec, fontSize: '15px', maxWidth: 600 }}>
            Conecta Kuden IA con tus herramientas favoritas. Administra los tokens de acceso y permite que nuestros agentes operen bajo el ecosistema de tu empresa.
          </p>
        </div>
        <div style={{
          background: isDark ? 'linear-gradient(135deg, rgba(37,99,235,0.1), rgba(37,99,235,0.05))' : '#eff6ff',
          border: `1px solid ${isDark ? 'rgba(37,99,235,0.2)' : '#bfdbfe'}`,
          padding: '12px 20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px'
        }}>
          <div style={{ width: 40, height: 40, borderRadius: '10px', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
            <i className="ti ti-bolt" style={{ fontSize: '20px' }}></i>
          </div>
          <div>
            <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: '700', color: isDark ? '#60a5fa' : '#1d4ed8' }}>Motor n8n Activo</p>
            <p style={{ margin: 0, fontSize: '11px', color: isDark ? '#9ca3af' : '#64748b' }}>Eventos encolados listos para orquestación.</p>
          </div>
        </div>
      </div>

      {/* Categories */}
      {integrations.map((cat, idx) => (
        <div key={idx} style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 20px 0', color: textMain, borderBottom: `1px solid ${borderCol}`, paddingBottom: 10 }}>
            {cat.category}
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {cat.items.map(item => (
              <div key={item.id} style={{
                background: cardBg,
                border: `1px solid ${borderCol}`,
                borderRadius: '16px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.2)' : '0 8px 32px rgba(0,0,0,0.04)',
                transition: 'transform 0.2s, box-shadow 0.2s',
                cursor: 'default'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = isDark ? '0 12px 40px rgba(0,0,0,0.3)' : '0 12px 40px rgba(0,0,0,0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = isDark ? '0 8px 32px rgba(0,0,0,0.2)' : '0 8px 32px rgba(0,0,0,0.04)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{
                    width: '52px', height: '52px', borderRadius: '14px',
                    background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    border: `1px solid ${borderCol}`
                  }}>
                    <i className={item.icon} style={{ fontSize: '28px', color: item.id === 'calcom' && isDark ? '#fff' : item.color }}></i>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: '700', color: textMain }}>{item.name}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.status === 'connected' ? '#10b981' : '#9ca3af' }}></span>
                      <span style={{ fontSize: '12px', color: textSec, fontWeight: '500' }}>
                        {item.status === 'connected' ? 'Conectado' : 'Sin conectar'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <p style={{ margin: 0, fontSize: '13px', color: textSec, lineHeight: '1.5', flex: 1 }}>
                  {item.description}
                </p>

                <button 
                  onClick={() => handleConnect(item.id)}
                  disabled={connectingId === item.id}
                  style={{
                    width: '100%', padding: '10px', borderRadius: '10px',
                    background: connectingId === item.id ? 'transparent' : (isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6'),
                    border: connectingId === item.id ? `1px solid ${borderCol}` : 'none',
                    color: connectingId === item.id ? textSec : textMain,
                    fontWeight: '600', fontSize: '13px', cursor: connectingId === item.id ? 'wait' : 'pointer',
                    transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    if (connectingId !== item.id) {
                      e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (connectingId !== item.id) {
                      e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6';
                    }
                  }}
                >
                  {connectingId === item.id ? (
                    <><i className="ti ti-loader" style={{ animation: 'spin 1s linear infinite' }}></i> Conectando OAuth...</>
                  ) : (
                    <>Vincular Cuenta <i className="ti ti-arrow-right"></i></>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Sección especial para Webhook Email */}
      <div style={{ marginBottom: 40 }}>
        <EmailAccountsManager tenantId={tenantId} isDark={isDark} />
      </div>

      {/* Sección especial para el Widget Web */}
      <div style={{ marginBottom: 40 }}>
        <WidgetSettings tenantId={tenantId} isDark={isDark} inHub={true} />
      </div>
      
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
