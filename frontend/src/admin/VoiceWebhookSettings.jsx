import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function VoiceWebhookSettings({ isDark, tenantId }) {
  const [loading, setLoading] = useState(false);
  const [mapping, setMapping] = useState({});
  const [customFields, setCustomFields] = useState([]);
  const [newKey, setNewKey] = useState('');
  const [newField, setNewField] = useState('');

  const webhookUrl = `https://api.kuden.cl/api/webhook/voice-call/${tenantId || '{YOUR_TENANT_ID}'}`;

  const baseContactFields = [
    { key: 'telefono', label: 'Teléfono (Llave Principal)', required: true },
    { key: 'cliente_nombre', label: 'Nombre del Cliente' },
    { key: 'email', label: 'Correo Electrónico' },
    { key: 'rut', label: 'RUT / ID' },
    { key: 'empresa', label: 'Empresa' },
    { key: 'cargo', label: 'Cargo' },
    { key: 'plan', label: 'Plan / Producto' },
    { key: 'direccion', label: 'Dirección' },
    { key: 'comuna', label: 'Comuna' },
    { key: 'ciudad', label: 'Ciudad' },
    { key: 'region', label: 'Región' },
    { key: 'motivo_label', label: '[Conversación] Tipificación / Estado Cierre' },
    { key: 'campaign_id', label: '[Conversación] ID Campaña Kuden' }
  ];

  const systemFields = [
    { key: 'transcript', label: 'Transcripción de la Llamada' },
    { key: 'recordingUrl', label: 'URL de la Grabación' }
  ];

  useEffect(() => {
    if (tenantId) {
      loadData();
    }
  }, [tenantId]);

  const loadData = async () => {
    try {
      const [tRes, fRes] = await Promise.all([
        supabase.from('tenants').select('voice_webhook_mapping').eq('id', tenantId).single(),
        supabase.from('tenant_field_definitions').select('field_key, field_label').eq('tenant_id', tenantId)
      ]);
      
      if (tRes.data) {
        setMapping(tRes.data.voice_webhook_mapping || {});
      }
      if (fRes.data) {
        setCustomFields(fRes.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('tenants').update({ voice_webhook_mapping: mapping }).eq('id', tenantId);
      if (error) throw error;
      alert("Configuración de Webhook guardada exitosamente.");
    } catch (e) {
      alert("Error al guardar: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const updateMapping = (kudenField, jsonKey) => {
    setMapping(prev => ({ ...prev, [kudenField]: jsonKey }));
  };

  const removeMapping = (kudenField) => {
    setMapping(prev => {
      const updated = { ...prev };
      delete updated[kudenField];
      return updated;
    });
  };

  const handleAddNewMapping = () => {
    if (!newKey.trim() || !newField) return;
    updateMapping(newField, newKey.trim());
    setNewKey('');
    setNewField('');
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    alert("URL copiada al portapapeles");
  };

  const allAvailableFields = [...baseContactFields, ...customFields.map(cf => ({ key: cf.field_key, label: `[Custom] ${cf.field_label}` }))];

  return (
    <div className="voice-webhook-container">
      <div className="voice-webhook-header">
        <div className="voice-webhook-icon-container">
          <i className="ti ti-microphone voice-webhook-icon"></i>
        </div>
        <div style={{ flex: 1 }}>
          <h2 className="integration-section-title" style={{ fontSize: '20px' }}>Webhook de Voz (Retell AI / VICIdial)</h2>
          <p className="integration-section-subtitle" style={{ lineHeight: '1.5' }}>
            Recibe llamadas telefónicas finalizadas en Kuden. Configura qué llaves del JSON entrante de la plataforma externa corresponden a los campos de tus contactos en el CRM.
          </p>
        </div>
      </div>

      <div className="integration-banner">
        <p className="integration-banner-title">URL del Webhook (POST)</p>
        <div className="integration-banner-row">
          <input type="text" readOnly value={webhookUrl} style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }} />
          <button onClick={copyWebhookUrl} className="integration-btn-primary" style={{ padding: '0 16px', whiteSpace: 'nowrap' }}>
            <i className="ti ti-copy"></i> Copiar
          </button>
        </div>
      </div>

      <h3 className="integration-form-title" style={{ fontSize: '16px' }}>Mapeo de Campos Estructurales</h3>
      <div className="integration-mapping-list">
        {systemFields.map(sf => (
          <div key={sf.key} className="integration-mapping-row">
            <div className="integration-mapping-label">
              <i className="ti ti-point-filled" style={{ color: 'var(--color-primary)', marginRight: '6px' }}></i>
              {sf.label}
            </div>
            <i className="ti ti-arrow-right" style={{ color: 'var(--color-text-tertiary)' }}></i>
            <input 
              type="text" 
              placeholder={`Ej: ${sf.key}`} 
              value={mapping[sf.key] || ''} 
              onChange={e => updateMapping(sf.key, e.target.value)}
              style={{ flex: 1 }} 
            />
          </div>
        ))}
        {baseContactFields.filter(f => ['telefono', 'cliente_nombre'].includes(f.key)).map(f => (
          <div key={f.key} className="integration-mapping-row">
            <div className="integration-mapping-label">
              <i className="ti ti-point-filled" style={{ color: 'var(--color-primary)', marginRight: '6px' }}></i>
              {f.label} {f.required && <span style={{color:'var(--color-error)'}}>*</span>}
            </div>
            <i className="ti ti-arrow-right" style={{ color: 'var(--color-text-tertiary)' }}></i>
            <input 
              type="text" 
              placeholder={`Ej: ${f.key === 'telefono' ? 'customer_phone' : 'customer_name'}`} 
              value={mapping[f.key] || ''} 
              onChange={e => updateMapping(f.key, e.target.value)}
              style={{ flex: 1 }} 
            />
          </div>
        ))}
      </div>

      <h3 className="integration-form-title" style={{ fontSize: '16px' }}>Regla de Validación / Filtro (Opcional)</h3>
      <div className="integration-banner" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: '1.4' }}>
          Configura una llave y un valor esperado. Las llamadas que no cumplan esta condición serán ignoradas silenciosamente por el sistema (evitando procesar llamadas no deseadas o con estados fallidos).
        </p>
        <div className="integration-form-row" style={{ marginTop: '4px' }}>
          <div className="integration-form-group">
            <label className="integration-form-label" style={{ fontSize: '11px', fontWeight: '600' }}>Llave JSON a evaluar (ej: call.custom_analysis_data.validacion)</label>
            <input 
              type="text" 
              placeholder="Ej: call.custom_analysis_data.validacion" 
              value={mapping['validation_key'] || ''} 
              onChange={e => updateMapping('validation_key', e.target.value)}
            />
          </div>
          <div className="integration-form-group">
            <label className="integration-form-label" style={{ fontSize: '11px', fontWeight: '600' }}>Valor esperado (ej: true)</label>
            <input 
              type="text" 
              placeholder="Ej: true" 
              value={mapping['validation_value'] || ''} 
              onChange={e => updateMapping('validation_value', e.target.value)}
            />
          </div>
        </div>
      </div>

      <h3 className="integration-form-title" style={{ fontSize: '16px' }}>Registro de Logs (Auditoría)</h3>
      <div className="integration-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ flex: 1 }}>
          <p className="integration-form-label" style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: '600', color: 'var(--color-text-primary)' }}>Logs de Auditoría Activos</p>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: '1.4' }}>
            Registra el éxito o validación de cada llamada en el System Health Monitor. Desactívalo para evitar saturar el visor en campañas masivas.
          </p>
        </div>
        <div>
          <button 
            onClick={() => updateMapping('logs_enabled', mapping['logs_enabled'] !== false ? false : true)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '13px',
              transition: 'all 0.2s',
              backgroundColor: mapping['logs_enabled'] !== false ? 'rgba(22, 211, 138, 0.15)' : 'rgba(255, 94, 115, 0.15)',
              color: mapping['logs_enabled'] !== false ? 'var(--color-success)' : 'var(--color-error)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <i className={mapping['logs_enabled'] !== false ? "ti ti-toggle-on" : "ti ti-toggle-off"} style={{ fontSize: '18px' }}></i>
            {mapping['logs_enabled'] !== false ? "Habilitado" : "Deshabilitado"}
          </button>
        </div>
      </div>

      <h3 className="integration-form-title" style={{ fontSize: '16px' }}>Campos Adicionales Dinámicos</h3>
      <div className="integration-banner">
        
        {/* Lista de mapeos adicionales ya configurados */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: Object.keys(mapping).filter(k => !['transcript', 'recordingUrl', 'telefono', 'cliente_nombre', 'validation_key', 'validation_value', 'logs_enabled'].includes(k)).length > 0 ? '20px' : '0' }}>
          {Object.entries(mapping).filter(([k]) => !['transcript', 'recordingUrl', 'telefono', 'cliente_nombre', 'validation_key', 'validation_value', 'logs_enabled'].includes(k)).map(([kudenField, jsonKey]) => {
            const fieldDef = allAvailableFields.find(f => f.key === kudenField);
            return (
              <div key={kudenField} className="integration-mapping-row" style={{ padding: '10px 16px', background: 'var(--color-background-primary)', borderRadius: '8px', border: '1px solid var(--color-border-tertiary)' }}>
                <span style={{ fontSize: '14px', color: 'var(--color-text-primary)', fontWeight: '500', flex: 1 }}>{fieldDef?.label || kudenField}</span>
                <i className="ti ti-arrow-left" style={{ color: 'var(--color-text-tertiary)' }}></i>
                <span className="integration-mapping-badge">
                  {jsonKey}
                </span>
                <button onClick={() => removeMapping(kudenField)} style={{ background: 'none', border: 'none', color: 'var(--color-error)', cursor: 'pointer', padding: '4px' }}>
                  <i className="ti ti-trash" style={{ fontSize: '18px' }}></i>
                </button>
              </div>
            );
          })}
        </div>

        {/* Agregador */}
        <div className="integration-form-row" style={{ alignItems: 'center' }}>
          <select value={newField} onChange={e => setNewField(e.target.value)} style={{ flex: 1 }}>
            <option value="">— Seleccionar Campo Kuden —</option>
            {allAvailableFields.map(f => (
              <option key={f.key} value={f.key} disabled={mapping[f.key] !== undefined}>{f.label}</option>
            ))}
          </select>
          <span style={{ color: 'var(--color-text-tertiary)', fontSize: '20px' }}>←</span>
          <input 
            type="text" 
            placeholder="Llave en JSON (ej: user_email)" 
            value={newKey} 
            onChange={e => setNewKey(e.target.value)} 
            style={{ flex: 1 }} 
          />
          <button 
            onClick={handleAddNewMapping} 
            disabled={!newField || !newKey} 
            className="integration-btn-primary" 
            style={{ 
              padding: '10px 16px', 
              background: newField && newKey ? 'var(--gradient-success)' : 'var(--color-text-disabled)', 
              cursor: newField && newKey ? 'pointer' : 'not-allowed' 
            }}
          >
            Añadir
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={handleSave} disabled={loading} className="integration-btn-primary" style={{ padding: '12px 28px' }}>
          {loading ? <i className="ti ti-loader" style={{ animation: 'spin 1s linear infinite' }}></i> : <i className="ti ti-device-floppy"></i>}
          Guardar Configuración
        </button>
      </div>
    </div>
  );
}
