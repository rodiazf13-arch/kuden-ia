import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function AIConfigManager({ tenantId, isDark = true }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Form fields
  const [companyName, setCompanyName] = useState('');
  const [agentName, setAgentName] = useState('');
  const [basePrompt, setBasePrompt] = useState('');
  const [allowedProfiles, setAllowedProfiles] = useState([]);
  const [dbProfiles, setDbProfiles] = useState([]);

  const c = {
    card:      isDark ? '#111'    : '#ffffff',
    border:    isDark ? '#222'    : '#e5e7eb',
    title:     isDark ? '#ffffff' : '#111827',
    subtitle:  isDark ? '#aaaaaa' : '#6b7280',
    inputBg:   isDark ? '#1a1a1a' : '#f9fafb',
    inputText: isDark ? '#ffffff' : '#111827',
    label:     isDark ? '#888888' : '#6b7280',
    sectionHd: isDark ? '#cccccc' : '#374151',
  };

  useEffect(() => {
    if (tenantId) fetchConfig();
  }, [tenantId]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      
      // Fetch available profiles (own + globals)
      const [ownRes, globalRes, configRes] = await Promise.all([
        supabase.from('ai_profiles').select('id, label, is_global').eq('tenant_id', tenantId).order('label'),
        supabase.from('ai_profiles').select('id, label, is_global').eq('is_global', true).neq('tenant_id', tenantId).order('label'),
        supabase.from('tenant_ai_config').select('*').eq('tenant_id', tenantId).single()
      ]);
      
      const own = ownRes.data || [];
      const globals = globalRes.data || [];
      setDbProfiles([...own, ...globals]);

      if (configRes.error && configRes.error.code !== 'PGRST116') throw configRes.error;
      
      const data = configRes.data;
      if (data) {
        setConfig(data);
        setCompanyName(data.company_name || '');
        setAgentName(data.agent_name || '');
        setBasePrompt(data.base_prompt || '');
        setAllowedProfiles(data.allowed_profiles || []);
      } else {
        // Init default if doesn't exist
        setCompanyName('Mi Empresa');
        setAgentName('KUDEN');
        setBasePrompt('Eres el Agente Maestro virtual. Tu objetivo es entender al cliente y asistirle amablemente.');
        setAllowedProfiles([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const payload = {
        tenant_id: tenantId,
        company_name: companyName,
        agent_name: agentName,
        base_prompt: basePrompt,
        allowed_profiles: allowedProfiles,
      };

      let res;
      if (config && config.id) {
        res = await supabase.from('tenant_ai_config').update(payload).eq('id', config.id);
      } else {
        res = await supabase.from('tenant_ai_config').insert([payload]);
      }

      if (res.error) throw res.error;
      
      setConfig({ ...config, ...payload });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    backgroundColor: c.inputBg,
    border: `1px solid ${c.border}`,
    borderRadius: '8px',
    padding: '10px',
    color: c.inputText,
    outline: 'none',
    fontSize: '14px',
    width: '100%',
    boxSizing: 'border-box'
  };

  if (!tenantId) return (
    <div style={{ color: c.subtitle, padding: '40px', textAlign: 'center' }}>
      Tu cuenta no está vinculada a ninguna empresa. Contacta al administrador.
    </div>
  );

  if (loading) return <p style={{ color: c.subtitle }}>Cargando configuración maestra...</p>;

  return (
    <div style={{ maxWidth: '800px' }}>
      <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 8px', color: c.title }}>Agente Maestro IA (Routing)</h2>
      <p style={{ margin: '0 0 24px', fontSize: '14px', color: c.subtitle, lineHeight: 1.5 }}>
        Configura la identidad base de tu Asistente Virtual. Este es el <strong>Agente Maestro</strong> que recibe al cliente, evalúa su intención y adopta dinámicamente los "Perfiles IA" adecuados para cada situación (Ej: cambiar automáticamente al perfil de <em>Retención</em> si el cliente está molesto).
      </p>

      {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.5)', color: '#f87171', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>{error}</div>}
      {success && <div style={{ background: 'rgba(29,158,117,0.1)', border: '1px solid rgba(29,158,117,0.5)', color: '#1D9E75', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>✅ Configuración del Agente Maestro actualizada correctamente. El Simulador y el CRM ahora usarán estas reglas.</div>}

      <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '24px' }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '16px', color: c.sectionHd }}>Identidad Global</h3>
        
        <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', color: c.label }}>Nombre de tu Empresa</label>
            <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Ej: ConectaChile" required style={inputStyle} />
            <span style={{ fontSize: '11px', color: c.subtitle }}>La IA se presentará como representante de esta marca.</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', color: c.label }}>Nombre del Asistente</label>
            <input type="text" value={agentName} onChange={e => setAgentName(e.target.value)} placeholder="Ej: KUDEN, Sofía, Max" required style={inputStyle} />
            <span style={{ fontSize: '11px', color: c.subtitle }}>El nombre con el que el Agente firma sus mensajes.</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '12px', color: c.label }}>Instrucciones del Agente Maestro (Routing Prompt)</label>
            <textarea value={basePrompt} onChange={e => setBasePrompt(e.target.value)} rows={6}
              placeholder="Ej: Eres Sofía, asistente virtual de ConectaChile. Tu misión es entender la necesidad del cliente y responder con amabilidad. Si el cliente tiene un problema técnico o comercial, adopta la personalidad adecuada."
              required style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          <div style={{ gridColumn: '1 / -1', background: 'rgba(29,158,117,0.05)', border: '1px solid rgba(29,158,117,0.2)', padding: '16px', borderRadius: '8px' }}>
            <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: '600', color: '#1D9E75' }}>Perfiles IA Permitidos (Habilidades)</p>
            <p style={{ margin: '0 0 12px', fontSize: '11px', color: c.subtitle }}>
              Selecciona a cuáles Perfiles IA tendrá acceso el Agente Maestro para enrutar las conversaciones de los clientes. Si no seleccionas ninguno, solo usará sus instrucciones maestras.
            </p>
            
            {dbProfiles.length === 0 ? (
              <p style={{ margin: 0, fontSize: '12px', color: c.subtitle, fontStyle: 'italic' }}>No hay perfiles disponibles.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {dbProfiles.map(p => {
                  const isChecked = allowedProfiles.includes(p.id);
                  return (
                    <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={isChecked} onChange={(e) => {
                        if (e.target.checked) setAllowedProfiles(prev => [...prev, p.id]);
                        else setAllowedProfiles(prev => prev.filter(id => id !== p.id));
                      }} style={{ cursor: 'pointer' }}/>
                      <span style={{ fontSize: '13px', color: c.inputText }}>{p.label}</span>
                      {p.is_global && <span style={{ fontSize: '9px', background: '#f59e0b20', color: '#f59e0b', padding: '2px 6px', borderRadius: '10px' }}>Global</span>}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button type="submit" disabled={saving}
              style={{ backgroundColor: '#1D9E75', color: '#fff', fontWeight: '500', padding: '10px 28px', borderRadius: '8px', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontSize: '14px' }}>
              {saving ? 'Guardando...' : 'Guardar Configuración'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
