import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import EmailAccountsManager from './EmailAccountsManager';
import WidgetSettings from './WidgetSettings';
import VoiceWebhookSettings from './VoiceWebhookSettings';

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
    <div className="integrations-hub-wrapper">
      
      {/* Header */}
      <div className="integrations-header-container">
        <div>
          <h1 className="integrations-title">
            Hub de Integraciones
          </h1>
          <p className="integrations-subtitle">
            Conecta Kuden IA con tus herramientas favoritas. Administra los tokens de acceso y permite que nuestros agentes operen bajo el ecosistema de tu empresa.
          </p>
        </div>
        <div className="n8n-status-banner">
          <div className="n8n-status-icon-container">
            <i className="ti ti-bolt" style={{ fontSize: '20px' }}></i>
          </div>
          <div>
            <p className="n8n-status-title">Motor n8n Activo</p>
            <p className="n8n-status-text">Eventos encolados listos para orquestación.</p>
          </div>
        </div>
      </div>

      {/* Categories */}
      {integrations.map((cat, idx) => (
        <div key={idx} className="integrations-category-section">
          <h2 className="integrations-category-title">
            {cat.category}
          </h2>
          
          <div className="integrations-grid">
            {cat.items.map(item => (
              <div key={item.id} className="integration-card">
                <div className="integration-card-header">
                  <div className="integration-icon-container">
                    <i className={`${item.icon} integration-icon`} style={{ color: item.id === 'calcom' && isDark ? '#fff' : item.color }}></i>
                  </div>
                  <div className="integration-info">
                    <h3 className="integration-name">{item.name}</h3>
                    <div className="integration-status-container">
                      <span className={`integration-status-dot ${item.status === 'connected' ? 'connected' : 'disconnected'}`}></span>
                      <span className="integration-status-text">
                        {item.status === 'connected' ? 'Conectado' : 'Sin conectar'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <p className="integration-description">
                  {item.description}
                </p>

                <button 
                  onClick={() => handleConnect(item.id)}
                  disabled={connectingId === item.id}
                  className="integration-connect-btn"
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

      {/* Sección especial para Webhook de Voz */}
      <div style={{ marginBottom: 40 }}>
        <VoiceWebhookSettings tenantId={tenantId} isDark={isDark} />
      </div>
    </div>
  );
}
