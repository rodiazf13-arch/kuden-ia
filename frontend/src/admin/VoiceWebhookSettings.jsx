import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function VoiceWebhookSettings({ isDark, tenantId }) {
  const [loading, setLoading] = useState(false);
  const [mapping, setMapping] = useState({});
  const [customFields, setCustomFields] = useState([]);
  const [newKey, setNewKey] = useState('');
  const [newField, setNewField] = useState('');

  const webhookUrl = `https://api.kuden.cl/api/webhook/voice-call/${tenantId || '{YOUR_TENANT_ID}'}`;

  const textMain = isDark ? '#f9fafb' : '#111827';
  const textSec = isDark ? '#9ca3af' : '#6b7280';
  const cardBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.7)';
  const borderCol = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const inputBg = isDark ? 'rgba(0,0,0,0.2)' : '#f9fafb';

  const inputStyle = {
    backgroundColor: inputBg,
    border: `1px solid ${borderCol}`,
    borderRadius: '8px',
    padding: '10px 14px',
    color: textMain,
    outline: 'none',
    fontSize: '14px',
    width: '100%',
    transition: 'border-color 0.2s'
  };

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
    <div style={{
      background: cardBg, border: `1px solid ${borderCol}`, borderRadius: '16px',
      padding: '24px', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.2)' : '0 8px 32px rgba(0,0,0,0.04)'
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '24px' }}>
        <div style={{
          width: '52px', height: '52px', borderRadius: '14px',
          background: isDark ? 'rgba(37,99,235,0.1)' : '#eff6ff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `1px solid ${isDark ? 'rgba(37,99,235,0.2)' : '#bfdbfe'}`
        }}>
          <i className="ti ti-microphone" style={{ fontSize: '28px', color: '#3b82f6' }}></i>
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 6px', color: textMain }}>Webhook de Voz (Retell AI / VICIdial)</h2>
          <p style={{ margin: 0, fontSize: '14px', color: textSec, lineHeight: '1.5' }}>
            Recibe llamadas telefónicas finalizadas en Kuden. Configura qué llaves del JSON entrante de la plataforma externa corresponden a los campos de tus contactos en el CRM.
          </p>
        </div>
      </div>

      <div style={{ background: inputBg, border: `1px solid ${borderCol}`, padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
        <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: '600', color: textSec, textTransform: 'uppercase' }}>URL del Webhook (POST)</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input type="text" readOnly value={webhookUrl} style={{ ...inputStyle, fontFamily: 'monospace', color: '#3b82f6' }} />
          <button onClick={copyWebhookUrl} style={{ padding: '0 16px', borderRadius: '8px', background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
            <i className="ti ti-copy"></i> Copiar
          </button>
        </div>
      </div>

      <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '600', color: textMain }}>Mapeo de Campos Estructurales</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
        {systemFields.map(sf => (
          <div key={sf.key} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '250px', fontSize: '14px', fontWeight: '500', color: textMain }}>
              <i className="ti ti-point-filled" style={{ color: '#3b82f6', marginRight: '6px' }}></i>
              {sf.label}
            </div>
            <i className="ti ti-arrow-right" style={{ color: textSec }}></i>
            <input 
              type="text" 
              placeholder={`Ej: ${sf.key}`} 
              value={mapping[sf.key] || ''} 
              onChange={e => updateMapping(sf.key, e.target.value)}
              style={{ ...inputStyle, flex: 1 }} 
            />
          </div>
        ))}
        {baseContactFields.filter(f => ['telefono', 'cliente_nombre'].includes(f.key)).map(f => (
          <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '250px', fontSize: '14px', fontWeight: '500', color: textMain }}>
              <i className="ti ti-point-filled" style={{ color: '#3b82f6', marginRight: '6px' }}></i>
              {f.label} {f.required && <span style={{color:'#ef4444'}}>*</span>}
            </div>
            <i className="ti ti-arrow-right" style={{ color: textSec }}></i>
            <input 
              type="text" 
              placeholder={`Ej: ${f.key === 'telefono' ? 'customer_phone' : 'customer_name'}`} 
              value={mapping[f.key] || ''} 
              onChange={e => updateMapping(f.key, e.target.value)}
              style={{ ...inputStyle, flex: 1 }} 
            />
          </div>
        ))}
      </div>

      <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '600', color: textMain }}>Campos Adicionales Dinámicos</h3>
      <div style={{ background: inputBg, borderRadius: '12px', padding: '16px', border: `1px solid ${borderCol}`, marginBottom: '24px' }}>
        
        {/* Lista de mapeos adicionales ya configurados */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: Object.keys(mapping).filter(k => !['transcript', 'recordingUrl', 'telefono', 'cliente_nombre'].includes(k)).length > 0 ? '20px' : '0' }}>
          {Object.entries(mapping).filter(([k]) => !['transcript', 'recordingUrl', 'telefono', 'cliente_nombre'].includes(k)).map(([kudenField, jsonKey]) => {
            const fieldDef = allAvailableFields.find(f => f.key === kudenField);
            return (
              <div key={kudenField} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: cardBg, padding: '10px 16px', borderRadius: '8px', border: `1px solid ${borderCol}` }}>
                <span style={{ fontSize: '14px', color: textMain, fontWeight: '500', flex: 1 }}>{fieldDef?.label || kudenField}</span>
                <i className="ti ti-arrow-left" style={{ color: textSec }}></i>
                <span style={{ fontSize: '13px', color: '#10b981', fontFamily: 'monospace', background: 'rgba(16,185,129,0.1)', padding: '4px 8px', borderRadius: '6px', flex: 1 }}>
                  {jsonKey}
                </span>
                <button onClick={() => removeMapping(kudenField)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}>
                  <i className="ti ti-trash" style={{ fontSize: '18px' }}></i>
                </button>
              </div>
            );
          })}
        </div>

        {/* Agregador */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select value={newField} onChange={e => setNewField(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
            <option value="">— Seleccionar Campo Kuden —</option>
            {allAvailableFields.map(f => (
              <option key={f.key} value={f.key} disabled={mapping[f.key] !== undefined}>{f.label}</option>
            ))}
          </select>
          <span style={{ color: textSec, fontSize: '20px' }}>←</span>
          <input 
            type="text" 
            placeholder="Llave en JSON (ej: user_email)" 
            value={newKey} 
            onChange={e => setNewKey(e.target.value)} 
            style={{ ...inputStyle, flex: 1 }} 
          />
          <button onClick={handleAddNewMapping} disabled={!newField || !newKey} style={{ padding: '10px 16px', borderRadius: '8px', background: newField && newKey ? '#10b981' : '#9ca3af', color: '#fff', border: 'none', cursor: newField && newKey ? 'pointer' : 'not-allowed', fontWeight: '600' }}>
            Añadir
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={handleSave} disabled={loading} style={{
          backgroundColor: '#3b82f6', color: '#fff', fontWeight: '600', padding: '12px 28px',
          borderRadius: '10px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          {loading ? <i className="ti ti-loader" style={{ animation: 'spin 1s linear infinite' }}></i> : <i className="ti ti-device-floppy"></i>}
          Guardar Configuración
        </button>
      </div>
    </div>
  );
}
