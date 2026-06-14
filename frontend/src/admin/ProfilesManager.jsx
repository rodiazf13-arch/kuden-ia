import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import KnowledgeBaseManager from './KnowledgeBaseManager';

export default function ProfilesManager({ tenantId, isDark = true, isSuperAdmin = false }) {
  const [profiles,        setProfiles]        = useState([]);
  const [globalProfiles,  setGlobalProfiles]  = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState(null);

  // Formulario
  const [label,     setLabel]     = useState('');
  const [desc,      setDesc]      = useState('');
  const [persona,   setPersona]   = useState('');
  const [hint,      setHint]      = useState('');
  const [color,     setColor]     = useState('#1D9E75');
  const [bg,        setBg]        = useState('#E1F5EE');
  const [icon,      setIcon]      = useState('ti-headset');
  const [llmProvider, setLlmProvider] = useState('anthropic');
  const [llmModel,    setLlmModel]    = useState('claude-3-5-sonnet-20240620');
  const [isGlobal,  setIsGlobal]  = useState(false);  // Solo superAdmin puede activar
  const [creating,  setCreating]  = useState(false);
  const [editingId, setEditingId] = useState(null);

  const c = {
    card:      isDark ? '#111'    : '#ffffff',
    border:    isDark ? '#222'    : '#e5e7eb',
    title:     isDark ? '#ffffff' : '#111827',
    subtitle:  isDark ? '#aaaaaa' : '#6b7280',
    inputBg:   isDark ? '#1a1a1a' : '#f9fafb',
    inputText: isDark ? '#ffffff' : '#111827',
    label:     isDark ? '#888888' : '#6b7280',
    sectionHd: isDark ? '#cccccc' : '#374151',
    divider:   isDark ? '#222222' : '#e5e7eb',
    globalBg:  isDark ? '#1a1500' : '#fffbeb',
    globalBdr: isDark ? '#78350f' : '#fcd34d',
  };

  useEffect(() => { if (tenantId) fetchProfiles(); }, [tenantId]);

  const fetchProfiles = async () => {
    try {
      setLoading(true);

      // 1. Perfiles propios del tenant
      const { data: own, error: e1 } = await supabase
        .from('ai_profiles').select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      if (e1) throw e1;

      // 2. Plantillas globales (de cualquier tenant, marcadas is_global=true)
      //    Excluir las que ya pertenecen a este tenant (para no duplicar si superAdmin)
      const { data: globals, error: e2 } = await supabase
        .from('ai_profiles').select('*')
        .eq('is_global', true)
        .neq('tenant_id', tenantId)   // evitar duplicar los propios
        .order('label', { ascending: true });
      if (e2) throw e2;

      setProfiles(own || []);
      setGlobalProfiles(globals || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const resetForm = () => {
    setLabel(''); setDesc(''); setPersona(''); setHint('');
    setColor('#1D9E75'); setBg('#E1F5EE'); setIcon('ti-headset'); setIsGlobal(false);
    setLlmProvider('anthropic'); setLlmModel('claude-3-5-sonnet-20240620');
    setEditingId(null);
  };

  const editProfile = (p) => {
    setEditingId(p.id); setLabel(p.label); setDesc(p.description || '');
    setPersona(p.persona_prompt || ''); setHint(p.hint_text || '');
    setColor(p.color || '#1D9E75'); setBg(p.bg || '#E1F5EE');
    setIcon(p.icon || 'ti-headset'); setIsGlobal(p.is_global || false);
    setLlmProvider(p.llm_provider || 'anthropic'); setLlmModel(p.llm_model || 'claude-3-5-sonnet-20240620');
    window.scrollTo(0,0);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true); setError(null);
    try {
      const payload = {
        tenant_id: tenantId, label, description: desc, persona_prompt: persona,
        hint_text: hint, color, bg, icon, is_global: isSuperAdmin ? isGlobal : false,
        llm_provider: llmProvider, llm_model: llmModel
      };
      if (editingId) {
        const { error } = await supabase.from('ai_profiles').update(payload).eq('id', editingId);
        if (error) throw error;
        setProfiles(prev => prev.map(p => p.id === editingId ? { ...p, ...payload } : p));
      } else {
        const { data, error } = await supabase.from('ai_profiles').insert([payload]).select();
        if (error) throw error;
        setProfiles(prev => [data[0], ...prev]);
      }
      resetForm();
    } catch (err) { setError(err.message); }
    finally { setCreating(false); }
  };

  const toggleGlobal = async (profile) => {
    if (!isSuperAdmin) return;
    try {
      const newVal = !profile.is_global;
      const { error } = await supabase
        .from('ai_profiles').update({ is_global: newVal }).eq('id', profile.id);
      if (error) throw error;
      setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, is_global: newVal } : p));
    } catch (err) { alert('Error: ' + err.message); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar este perfil?')) return;
    try {
      const { error } = await supabase.from('ai_profiles').delete().eq('id', id);
      if (error) throw error;
      setProfiles(prev => prev.filter(p => p.id !== id));
    } catch (err) { alert('Error al eliminar: ' + err.message); }
  };

  const inputStyle = {
    backgroundColor: c.inputBg, border: `1px solid ${c.border}`,
    borderRadius: '8px', padding: '10px', color: c.inputText,
    outline: 'none', fontSize: '14px', width: '100%', boxSizing: 'border-box'
  };

  const ProfileCard = ({ p, isOwnProfile = true }) => (
    <div style={{ background: p.bg, border: `2px solid ${p.color}30`, borderRadius: '12px', padding: '20px', position: 'relative' }}>

      {/* Badge global */}
      {p.is_global && (
        <span style={{ position: 'absolute', top: '10px', left: '10px', fontSize: '10px', padding: '2px 8px', borderRadius: '20px', background: '#f59e0b20', color: '#f59e0b', border: '1px solid #f59e0b40', fontWeight: '700' }}>
          ⭐ Plantilla Kuden
        </span>
      )}

      {/* Acciones (solo para propios) */}
      {isOwnProfile && (
        <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '6px' }}>
          {isSuperAdmin && (
            <button onClick={() => toggleGlobal(p)} title={p.is_global ? 'Quitar de plantillas globales' : 'Publicar como plantilla global'}
              style={{ background: p.is_global ? '#f59e0b20' : 'rgba(0,0,0,0.1)', border: `1px solid ${p.is_global ? '#f59e0b60' : 'transparent'}`, color: p.is_global ? '#f59e0b' : '#555', cursor: 'pointer', borderRadius: '6px', padding: '3px 8px', fontSize: '12px' }}>
              {p.is_global ? '⭐' : '☆'}
            </button>
          )}
          <button onClick={() => editProfile(p)} title="Editar"
            style={{ background: 'rgba(0,0,0,0.1)', border: 'none', color: '#555', cursor: 'pointer', borderRadius: '6px', width: '24px', height: '24px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="ti ti-pencil"></i>
          </button>
          <button onClick={() => handleDelete(p.id)} title="Eliminar"
            style={{ background: 'rgba(0,0,0,0.1)', border: 'none', color: '#555', cursor: 'pointer', borderRadius: '6px', width: '24px', height: '24px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', marginTop: p.is_global ? '20px' : '0' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <i className={`ti ${p.icon}`} style={{ fontSize: '18px', color: '#fff' }}></i>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: 6 }}>
            {p.label}
            <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.1)', padding: '2px 6px', borderRadius: 10, color: '#4b5563' }}>{p.llm_provider || 'anthropic'}</span>
          </p>
          <p style={{ margin: 0, fontSize: '12px', color: '#4b5563' }}>{p.description}</p>
        </div>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.65)', borderRadius: '8px', padding: '10px', marginBottom: '8px' }}>
        <p style={{ margin: '0 0 4px', fontSize: '10px', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.06em', color: p.color }}>📋 Cómo responde KUDEN</p>
        <p style={{ margin: 0, fontSize: '12px', color: '#333', lineHeight: 1.5 }}>"{p.persona_prompt}"</p>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.65)', borderRadius: '8px', padding: '10px' }}>
        <p style={{ margin: '0 0 4px', fontSize: '10px', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.06em', color: p.color }}>💬 Ejemplo de mensaje del cliente</p>
        <p style={{ margin: 0, fontSize: '12px', color: '#555', fontStyle: 'italic' }}>"{p.hint_text}"</p>
      </div>
    </div>
  );

  if (!tenantId) return (
    <div style={{ color: c.subtitle, padding: '40px', textAlign: 'center' }}>
      Tu cuenta no está vinculada a ninguna empresa. Contacta al administrador.
    </div>
  );

  return (
    <div>
      <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 8px', color: c.title }}>Perfiles del Agente IA</h2>
      <p style={{ margin: '0 0 24px', fontSize: '14px', color: c.subtitle }}>
        Define cómo responde <strong>KUDEN</strong> según el tipo de atención. El cliente siempre es humano; estos perfiles le indican a la IA su tono y enfoque.
        {isSuperAdmin && <span style={{ color: '#f59e0b' }}> Como Super Admin, puedes publicar perfiles como <strong>Plantillas Kuden</strong> para que estén disponibles en todas las empresas.</span>}
      </p>

      {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.5)', color: '#f87171', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>{error}</div>}

      {/* ── Formulario ── */}
      <div style={{ background: c.card, border: `1px solid ${editingId ? '#2563eb' : c.border}`, borderRadius: '12px', padding: '24px', marginBottom: '32px' }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
          <h3 style={{ margin: 0, fontSize: '16px', color: editingId ? '#2563eb' : c.sectionHd }}>{editingId ? 'Editar Perfil' : 'Crear Nuevo Perfil'}</h3>
          {editingId && <button onClick={resetForm} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "12px", textDecoration: "underline" }}>Cancelar edición</button>}
        </div>
        <p style={{ margin: '0 0 20px', fontSize: '13px', color: c.subtitle }}>
          Ejemplos: <em>"Soporte Técnico Empático"</em>, <em>"Ventas Primer Contacto"</em>, <em>"Retención VIP"</em>, <em>"Reclamos Alta Frustración"</em>.
        </p>
        <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', color: c.label }}>Nombre del Perfil</label>
            <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="Ej: Soporte Técnico Empático" required style={inputStyle} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', color: c.label }}>Descripción Corta</label>
            <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ej: Para clientes con problemas de servicio" required style={inputStyle} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, gridColumn: '1 / -1' }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: c.label, marginBottom: 4 }}>Proveedor de Inteligencia (LLM)</label>
              <select value={llmProvider} onChange={e => {
                setLlmProvider(e.target.value);
                if(e.target.value === 'anthropic') setLlmModel('claude-3-5-sonnet-20240620');
                else if(e.target.value === 'openai') setLlmModel('gpt-4o-mini');
                else if(e.target.value === 'gemini') setLlmModel('gemini-1.5-flash');
                else if(e.target.value === 'groq') setLlmModel('llama3-8b-8192');
              }} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${c.border}`, background: c.inputBg, color: c.inputText, outline: 'none', fontSize: 14 }}>
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="openai">OpenAI (GPT)</option>
                <option value="gemini">Google (Gemini)</option>
                <option value="groq">Groq (Llama 3)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: c.label, marginBottom: 4 }}>Modelo Específico</label>
              <select value={llmModel} onChange={e => setLlmModel(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${c.border}`, background: c.inputBg, color: c.inputText, outline: 'none', fontSize: 14 }}>
                {llmProvider === 'anthropic' && (
                  <>
                    <option value="claude-sonnet-4-6">Claude 4.6 Sonnet (Inteligente)</option>
                    <option value="claude-haiku-4-5-20251001">Claude 4.5 Haiku (Rápido)</option>
                  </>
                )}
                {llmProvider === 'openai' && (
                  <>
                    <option value="gpt-5">GPT-5 (Inteligente)</option>
                    <option value="gpt-5-mini">GPT-5 Mini (Rápido)</option>
                  </>
                )}
                {llmProvider === 'gemini' && (
                  <>
                    <option value="gemini-3.1-pro">Gemini 3.1 Pro (Inteligente)</option>
                    <option value="gemini-3.5-flash">Gemini 3.5 Flash (Rápido)</option>
                  </>
                )}
                {llmProvider === 'groq' && (
                  <>
                    <option value="llama-4-70b-8192">Llama 4 70B (Inteligente)</option>
                    <option value="llama-4-8b-8192">Llama 4 8B (Rápido)</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '12px', color: c.label }}>Instrucciones para KUDEN — ¿Cómo debe responder el agente IA?</label>
            <textarea value={persona} onChange={e => setPersona(e.target.value)} rows={3}
              placeholder="Ej: Responde con empatía y paciencia. El cliente puede estar frustrado. Ofrece soluciones concretas y confirma que el problema quedó registrado."
              required style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '12px', color: c.label }}>Mensaje de muestra del cliente</label>
            <input type="text" value={hint} onChange={e => setHint(e.target.value)}
              placeholder="Ej: Llevo 3 días sin internet y nadie me da solución" required style={inputStyle} />
          </div>

          <div style={{ display: 'flex', gap: '16px', gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
              <label style={{ fontSize: '12px', color: c.label }}>Color principal</label>
              <input type="color" value={color} onChange={e => setColor(e.target.value)}
                style={{ width: '100%', height: '40px', backgroundColor: c.inputBg, border: `1px solid ${c.border}`, borderRadius: '8px', cursor: 'pointer' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
              <label style={{ fontSize: '12px', color: c.label }}>Color de fondo</label>
              <input type="color" value={bg} onChange={e => setBg(e.target.value)}
                style={{ width: '100%', height: '40px', backgroundColor: c.inputBg, border: `1px solid ${c.border}`, borderRadius: '8px', cursor: 'pointer' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
              <label style={{ fontSize: '12px', color: c.label }}>Ícono (Tabler Icons)</label>
              <input type="text" value={icon} onChange={e => setIcon(e.target.value)} placeholder="ti-headset" style={inputStyle} />
            </div>
          </div>

          {/* Toggle "Publicar como plantilla global" — solo visible para superAdmin */}
          {isSuperAdmin && (
            <div style={{ gridColumn: '1 / -1', background: isGlobal ? c.globalBg : 'transparent', border: `1px solid ${isGlobal ? c.globalBdr : c.border}`, borderRadius: '10px', padding: '14px', display: 'flex', alignItems: 'center', gap: '14px', transition: 'all 0.2s' }}>
              <label style={{ position: 'relative', width: '44px', height: '24px', cursor: 'pointer', flexShrink: 0 }}>
                <input type="checkbox" checked={isGlobal} onChange={e => setIsGlobal(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                <span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: isGlobal ? '#f59e0b' : '#333', borderRadius: '24px', transition: '0.3s' }}></span>
                <span style={{ position: 'absolute', top: '3px', left: isGlobal ? '23px' : '3px', width: '18px', height: '18px', backgroundColor: '#fff', borderRadius: '50%', transition: '0.3s' }}></span>
              </label>
              <div>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: isGlobal ? '#f59e0b' : c.sectionHd }}>
                  ⭐ Publicar como Plantilla Kuden (global)
                </p>
                <p style={{ margin: 0, fontSize: '12px', color: c.subtitle }}>
                  Este perfil estará disponible para todas las empresas clientes en modo lectura.
                </p>
              </div>
            </div>
          )}

          {editingId && (
            <div style={{ gridColumn: '1 / -1' }}>
              <KnowledgeBaseManager tenantId={tenantId} profileId={editingId} isDark={isDark} c={c} />
            </div>
          )}

          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button type="submit" disabled={creating}
              style={{ backgroundColor: '#2563eb', color: '#fff', fontWeight: '500', padding: '10px 28px', borderRadius: '8px', border: 'none', cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.7 : 1, fontSize: '14px' }}>
              {creating ? 'Guardando...' : 'Guardar Perfil'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Perfiles propios ── */}
      <h3 style={{ fontSize: '18px', fontWeight: '600', color: c.title, margin: '0 0 16px' }}>
        {isSuperAdmin ? 'Mis perfiles (Kuden Demo Tenant)' : 'Perfiles de mi empresa'}
        <span style={{ marginLeft: '8px', fontSize: '13px', fontWeight: '400', color: c.subtitle }}>
          {profiles.length} perfil{profiles.length !== 1 ? 'es' : ''}
        </span>
      </h3>

      {loading ? (
        <p style={{ color: c.subtitle }}>Cargando perfiles...</p>
      ) : profiles.length === 0 ? (
        <div style={{ background: c.card, border: `1px dashed ${c.border}`, borderRadius: '12px', padding: '40px', textAlign: 'center', marginBottom: '32px' }}>
          <i className="ti ti-robot" style={{ fontSize: '40px', color: c.subtitle, display: 'block', marginBottom: '12px' }}></i>
          <p style={{ margin: 0, color: c.subtitle, fontSize: '14px' }}>No hay perfiles propios. Crea uno para activar el Simulador.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px', marginBottom: '40px' }}>
          {profiles.map(p => <ProfileCard key={p.id} p={p} isOwnProfile={true} />)}
        </div>
      )}

      {/* ── Plantillas Kuden globales (solo para tenants que NO son el maestro) ── */}
      {!isSuperAdmin && globalProfiles.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '8px 0 20px' }}>
            <hr style={{ flex: 1, border: 'none', borderTop: `1px solid ${c.divider}` }} />
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#f59e0b', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
              ⭐ Plantillas Kuden (globales) — disponibles para tu empresa
            </span>
            <hr style={{ flex: 1, border: 'none', borderTop: `1px solid ${c.divider}` }} />
          </div>
          <p style={{ margin: '-12px 0 20px', fontSize: '13px', color: c.subtitle }}>
            Estos perfiles fueron creados por Kuden y están disponibles para que los uses en el Simulador. Son de solo lectura.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {globalProfiles.map(p => <ProfileCard key={p.id} p={p} isOwnProfile={false} />)}
          </div>
        </div>
      )}
    </div>
  );
}
