import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import KnowledgeBaseManager from './KnowledgeBaseManager';

const API_URL = import.meta.env.VITE_API_URL || '';

const COMMON_ICONS = [
  'ti-headset', 'ti-robot', 'ti-messages', 'ti-user', 'ti-user-check', 'ti-shield-check',
  'ti-shopping-cart', 'ti-currency-dollar', 'ti-credit-card', 'ti-receipt',
  'ti-heart', 'ti-thumb-up', 'ti-bulb', 'ti-flame', 'ti-star',
  'ti-chart-bar', 'ti-device-mobile', 'ti-world', 'ti-mail', 'ti-phone',
  'ti-calendar', 'ti-clock', 'ti-settings', 'ti-tool', 'ti-truck'
];

export default function ProfilesManager({ tenantId, isDark = true, isSuperAdmin = false, actualTenantId, allTenants = [] }) {
  const [profiles, setProfiles] = useState([]);
  const [globalProfiles, setGlobalProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Formulario
  const [label, setLabel] = useState('');
  const [desc, setDesc] = useState('');
  const [persona, setPersona] = useState('');
  const [hint, setHint] = useState('');
  const [color, setColor] = useState('#1D9E75');
  const [bg, setBg] = useState('#E1F5EE');
  const [icon, setIcon] = useState('ti-headset');
  const [llmProvider, setLlmProvider] = useState('anthropic');
  const [llmModel, setLlmModel] = useState('claude-sonnet-4-6');
  const [isRouter, setIsRouter] = useState(false);
  const [subProfileIds, setSubProfileIds] = useState([]);
  const [targetTenantId, setTargetTenantId] = useState('own'); // 'own', 'global', or a specific tenant.id
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [openRouterModels, setOpenRouterModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [catalogModels, setCatalogModels] = useState([]);

  const c = {
    card: isDark ? '#111' : '#ffffff',
    border: isDark ? '#222' : '#e5e7eb',
    title: isDark ? '#ffffff' : '#111827',
    subtitle: isDark ? '#aaaaaa' : '#6b7280',
    inputBg: isDark ? '#1a1a1a' : '#f9fafb',
    inputText: isDark ? '#ffffff' : '#111827',
    label: isDark ? '#888888' : '#6b7280',
    sectionHd: isDark ? '#cccccc' : '#374151',
    divider: isDark ? '#222222' : '#e5e7eb',
    globalBg: isDark ? '#1a1500' : '#fffbeb',
    globalBdr: isDark ? '#78350f' : '#fcd34d',
  };

  useEffect(() => { if (tenantId) fetchProfiles(); }, [tenantId]);

  useEffect(() => {
    setLoadingModels(true);
    fetch(`${API_URL}/api/master/provider-models?provider=${llmProvider}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.models && Array.isArray(data.models)) {
          setCatalogModels(data.models);
          if (data.models.length > 0 && !editingId) {
            setLlmModel(data.models[0].model_name || data.models[0].id);
          }
        }
      })
      .catch(err => console.error("Error fetching models from central catalog:", err))
      .finally(() => {
        if (llmProvider === 'openrouter' && openRouterModels.length === 0) {
          fetch('https://openrouter.ai/api/v1/models')
            .then(res => res.json())
            .then(data => {
              if (data && data.data) {
                const sortedModels = data.data.sort((a,b) => a.id.localeCompare(b.id));
                setOpenRouterModels(sortedModels);
              }
            })
            .catch(err => console.error("Error fetching openrouter models:", err))
            .finally(() => setLoadingModels(false));
        } else {
          setLoadingModels(false);
        }
      });
  }, [llmProvider]);

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
    setColor('#1D9E75'); setBg('#E1F5EE'); setIcon('ti-headset'); setTargetTenantId('own');
    setLlmProvider('anthropic'); setLlmModel('claude-sonnet-4-6');
    setIsRouter(false); setSubProfileIds([]);
    setEditingId(null);
  };

  const editProfile = (p) => {
    setEditingId(p.id); setLabel(p.label); setDesc(p.description || '');
    setPersona(p.persona_prompt || ''); setHint(p.hint_text || '');
    setColor(p.color || '#1D9E75'); setBg(p.bg || '#E1F5EE');
    setIcon(p.icon || 'ti-headset');
    if (p.is_global) setTargetTenantId('global');
    else if (p.tenant_id !== actualTenantId) setTargetTenantId(p.tenant_id);
    else setTargetTenantId('own');

    setIsRouter(p.is_router || false);
    setSubProfileIds(p.sub_profile_ids || []);
    setLlmProvider(p.llm_provider || 'anthropic'); setLlmModel(p.llm_model || 'claude-sonnet-4-6');
    window.scrollTo(0, 0);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true); setError(null);
    try {
      let finalTenantId = tenantId;
      let finalIsGlobal = false;

      if (isSuperAdmin) {
        if (targetTenantId === 'global') {
          finalIsGlobal = true;
          finalTenantId = actualTenantId;
        } else if (targetTenantId === 'own') {
          finalIsGlobal = false;
          finalTenantId = actualTenantId;
        } else {
          finalIsGlobal = false;
          finalTenantId = targetTenantId;
        }
      }

      const payload = {
        tenant_id: finalTenantId, label, description: desc, persona_prompt: persona,
        hint_text: hint, color, bg, icon, is_global: finalIsGlobal,
        llm_provider: llmProvider, llm_model: llmModel,
        is_router: isRouter, sub_profile_ids: subProfileIds
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

  const ProfileCard = ({ p, isOwnProfile = true }) => {
    const cardBgColor = isDark ? 'rgba(255, 255, 255, 0.04)' : p.bg;
    const cardBorderColor = isDark ? `${p.color}40` : `${p.color}60`;

    return (
      <div
        className={`profiles-item-card ${isDark ? 'dark-mode-card' : 'light-mode-card'}`}
        style={{
          background: cardBgColor,
          borderColor: cardBorderColor,
          borderLeft: isDark ? `4px solid ${p.color}` : `1px solid ${cardBorderColor}`
        }}
      >
        {/* Badge global */}
        {p.is_global && (
          <span className="profiles-badge-global">
            ⭐ Plantilla Kuden
          </span>
        )}

        {/* Badge Router */}
        {p.is_router && (
          <span className="profiles-badge-router" style={{ left: p.is_global ? '120px' : '10px' }}>
            🤖 Agente Maestro
          </span>
        )}

        {/* Acciones (solo para propios) */}
        {isOwnProfile && (
          <div className="profiles-item-actions">
            {isSuperAdmin && (
              <button onClick={() => toggleGlobal(p)} title={p.is_global ? 'Quitar de plantillas globales' : 'Publicar como plantilla global'}
                className={`profiles-action-btn btn-star ${p.is_global ? 'active' : ''}`}>
                {p.is_global ? '★' : '☆'}
              </button>
            )}
            <button onClick={() => editProfile(p)} title="Editar" className="profiles-action-btn">
              <i className="ti ti-pencil"></i>
            </button>
            <button onClick={() => handleDelete(p.id)} title="Eliminar" className="profiles-action-btn btn-delete">
              ✕
            </button>
          </div>
        )}

        {/* Header */}
        <div className={`profiles-item-header ${(p.is_global || p.is_router || isOwnProfile) ? 'has-badges' : ''}`}>
          <div className="profiles-icon-container" style={{ background: p.color }}>
            <i className={`ti ${p.icon}`}></i>
          </div>
          <div className="profiles-item-name-group">
            <p className="profiles-item-label-row">
              {p.label}
              <span className="profiles-item-provider-badge">{p.llm_provider || 'anthropic'}</span>
            </p>
            <p className="profiles-item-desc">{p.description}</p>
          </div>
        </div>

        <div className={`profiles-quote-box ${isDark ? 'dark-mode-quote' : 'light-mode-quote'}`}>
          <p className="profiles-quote-title" style={{ color: p.color }}>📋 Cómo responde KUDEN</p>
          <p className="profiles-quote-text">"{p.persona_prompt}"</p>
        </div>

        <div className={`profiles-quote-box ${isDark ? 'dark-mode-quote' : 'light-mode-quote'}`}>
          <p className="profiles-quote-title" style={{ color: p.color }}>💬 Ejemplo de mensaje del cliente</p>
          <p className="profiles-quote-text italic">"{p.hint_text}"</p>
        </div>
      </div>
    );
  };

  if (!tenantId) return (
    <div className="profiles-subtitle" style={{ padding: '40px', textAlign: 'center' }}>
      Tu cuenta no está vinculada a ninguna empresa. Contacta al administrador.
    </div>
  );

  return (
    <div className="profiles-container">
      <h2 className="profiles-title">Perfiles del Agente IA</h2>
      <p className="profiles-subtitle">
        Define cómo responde <strong>KUDEN</strong> según el tipo de atención. El cliente siempre es humano; estos perfiles le indican a la IA su tono y enfoque.
        {isSuperAdmin && <span style={{ color: 'var(--color-cta)', marginLeft: '4px' }}> Como Super Admin, puedes publicar perfiles como <strong>Plantillas Kuden</strong> para que estén disponibles en todas las empresas.</span>}
      </p>

      {error && <div className="profiles-alert error"><i className="ti ti-alert-triangle" style={{ fontSize: '16px' }}></i>{error}</div>}

      {/* ── Formulario ── */}
      <div className={`profiles-card ${editingId ? 'editing' : ''}`}>
        <div className="profiles-card-header">
          <h3 className={`profiles-card-title ${editingId ? 'editing' : ''}`}>
            {editingId ? 'Editar Perfil' : 'Crear Nuevo Perfil'}
          </h3>
          {editingId && (
            <button onClick={resetForm} className="profiles-cancel-btn">
              Cancelar edición
            </button>
          )}
        </div>
        <p className="profiles-form-desc">
          Ejemplos: <em>"Soporte Técnico Empático"</em>, <em>"Ventas Primer Contacto"</em>, <em>"Retención VIP"</em>, <em>"Reclamos Alta Frustración"</em>.
        </p>
        <form onSubmit={handleCreate} className="profiles-form-grid">

          <div className="profiles-input-wrapper">
            <label className="profiles-label">Nombre del Perfil</label>
            <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="Ej: Soporte Técnico Empático" required className="profiles-input" />
          </div>

          <div className="profiles-input-wrapper">
            <label className="profiles-label">Descripción Corta</label>
            <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ej: Para clientes con problemas de servicio" required className="profiles-input" />
          </div>

          <div className={`profiles-checkbox-card ${isRouter ? 'active' : ''}`}>
            <label className="profiles-checkbox-label">
              <input type="checkbox" checked={isRouter} onChange={e => setIsRouter(e.target.checked)} className="profiles-checkbox-input" />
              <span className="profiles-checkbox-text">🤖 Configurar este perfil como Agente Maestro (Router)</span>
            </label>

            {isRouter && (
              <div className="profiles-router-sub-container">
                <p className="profiles-router-sub-text">Selecciona a qué otros perfiles podrá enrutar las conversaciones este Agente Maestro:</p>
                <div className="profiles-router-badge-group">
                  {profiles.filter(p => p.id !== editingId).map(p => {
                    const isSelected = subProfileIds.includes(p.id);
                    return (
                      <label key={p.id} className={`profiles-router-tag-label ${isSelected ? 'active' : ''}`}>
                        <input type="checkbox" checked={isSelected}
                          onChange={e => {
                            if (e.target.checked) setSubProfileIds([...subProfileIds, p.id]);
                            else setSubProfileIds(subProfileIds.filter(id => id !== p.id));
                          }}
                          style={{ display: 'none' }}
                        />
                        {p.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Provider and Model selectors */}
          <div className="profiles-input-wrapper">
            <label className="profiles-label">Proveedor de Inteligencia (LLM)</label>
            <select value={llmProvider} onChange={e => {
              setLlmProvider(e.target.value);
            }} className="profiles-select">
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI (GPT)</option>
              <option value="gemini">Google (Gemini)</option>
              <option value="groq">Groq (Llama 3)</option>
              <option value="openrouter">OpenRouter (Universal)</option>
            </select>
          </div>

          <div className="profiles-input-wrapper">
            <label className="profiles-label">
              Modelo Específico {loadingModels && <span style={{ fontSize: 10, color: 'var(--color-primary)' }}>(Cargando...)</span>}
            </label>
            <select value={llmModel} onChange={e => setLlmModel(e.target.value)} disabled={loadingModels} className="profiles-select">
              {catalogModels.length > 0 ? (
                <>
                  {catalogModels.map(m => (
                    <option key={m.id || m.model_name} value={m.model_name || m.id}>
                      {m.friendly_name || m.name} (${Number(m.prompt_rate || 0).toFixed(2)}/1M in - ${Number(m.completion_rate || 0).toFixed(2)}/1M out)
                    </option>
                  ))}
                  {llmModel && !catalogModels.some(m => (m.model_name || m.id) === llmModel) && (
                    <option value={llmModel} style={{ color: '#ef4444' }}>
                      ⚠️ {llmModel} (Inactivo / Deprecado - No en Catálogo)
                    </option>
                  )}
                </>
              ) : (
                <>
                  {llmProvider === 'anthropic' && (
                    <>
                      <option value="claude-sonnet-4-6">Claude 4.6 Sonnet (Inteligente)</option>
                      <option value="claude-haiku-4-5-20251001">Claude 4.5 Haiku (Rápido)</option>
                    </>
                  )}
                  {llmProvider === 'openai' && (
                    <>
                      <option value="gpt-5.5">GPT-5.5 (Flagship)</option>
                      <option value="gpt-5.4">GPT-5.4 (Standard)</option>
                      <option value="gpt-5.4-mini">GPT-5.4 Mini (Rápido)</option>
                    </>
                  )}
                  {llmProvider === 'gemini' && (
                    <>
                      <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview</option>
                      <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                      <option value="gemini-3.5-flash">Gemini 3.5 Flash (Rápido)</option>
                    </>
                  )}
                  {llmProvider === 'groq' && (
                    <>
                      <option value="llama-4-70b-8192">Llama 4 70B (Inteligente)</option>
                      <option value="llama-4-8b-8192">Llama 4 8B (Rápido)</option>
                    </>
                  )}
                  {llmProvider === 'openrouter' && openRouterModels.map(m => (
                    <option key={m.id} value={m.id}>{m.id} ({m.pricing?.prompt ? `$${(m.pricing.prompt * 1000000).toFixed(2)}/1M` : 'Gratis'})</option>
                  ))}
                  {llmModel && !catalogModels.some(m => m.model_name === llmModel) && (
                    <option value={llmModel} style={{ color: '#ef4444' }}>
                      ⚠️ {llmModel} (Inactivo / Deprecado)
                    </option>
                  )}
                </>
              )}
            </select>
          </div>

          <div className="profiles-input-wrapper full-width">
            <label className="profiles-label">
              {isRouter ? 'Instrucciones Base (Routing Prompt)' : 'Instrucciones para KUDEN — ¿Cómo debe responder el agente IA?'}
            </label>
            <textarea value={persona} onChange={e => setPersona(e.target.value)} rows={3}
              placeholder={isRouter ? "Ej: Eres el recepcionista central. Saluda y deriva al perfil correspondiente." : "Ej: Responde con empatía y paciencia..."}
              required className="profiles-textarea" />
          </div>

          <div className="profiles-input-wrapper full-width">
            <label className="profiles-label">Mensaje de muestra del cliente</label>
            <input type="text" value={hint} onChange={e => setHint(e.target.value)}
              placeholder="Ej: Llevo 3 días sin internet y nadie me da solución" required className="profiles-input" />
          </div>

          {/* Color & Icon pickers row */}
          <div className="profiles-row-pickers">
            <div className="profiles-picker-group">
              <label className="profiles-label">Color principal</label>
              <input type="color" value={color} onChange={e => setColor(e.target.value)} className="profiles-color-picker-input" />
            </div>
            <div className="profiles-picker-group">
              <label className="profiles-label">Color de fondo</label>
              <input type="color" value={bg} onChange={e => setBg(e.target.value)} className="profiles-color-picker-input" />
            </div>
            <div className="profiles-picker-group" style={{ position: 'relative' }}>
              <label className="profiles-label">Ícono (Tabler Icons)</label>
              <div className="profiles-icon-picker-container">
                <div className="profiles-icon-preview">
                  <i className={`ti ${icon}`} style={{ fontSize: '20px' }}></i>
                </div>
                <button
                  type="button"
                  onClick={() => setIconPickerOpen(!iconPickerOpen)}
                  className="profiles-icon-picker-btn"
                >
                  {icon || 'Seleccionar Ícono'}
                  <i className="ti ti-chevron-down"></i>
                </button>
              </div>

              {iconPickerOpen && (
                <div className="profiles-icon-picker-popover">
                  {COMMON_ICONS.map(ic => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => { setIcon(ic); setIconPickerOpen(false); }}
                      title={ic}
                      className={`profiles-icon-grid-btn ${icon === ic ? 'active' : ''}`}
                    >
                      <i className={`ti ${ic}`} style={{ fontSize: '18px' }}></i>
                    </button>
                  ))}
                  <div style={{ gridColumn: '1 / -1', marginTop: '8px' }}>
                    <input type="text" value={icon} onChange={e => setIcon(e.target.value)} placeholder="Código manual (ej: ti-home)" className="profiles-input" style={{ padding: '6px 10px', fontSize: '12px' }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Superadmin Destination dropdown */}
          {isSuperAdmin && (
            <div className={`profiles-superadmin-box ${targetTenantId === 'global' ? 'global' : ''}`}>
              <label className="profiles-superadmin-box-title">Destino del Perfil IA</label>
              <select value={targetTenantId} onChange={e => setTargetTenantId(e.target.value)} className="profiles-select">
                <option value="own">Solo Interno (Kuden Demo Tenant)</option>
                <option value="global">⭐ Plantilla Global (Visible en modo lectura para todos los clientes)</option>
                {allTenants.map(t => (
                  <option key={t.id} value={t.id}>Asignar a cliente: {t.name}</option>
                ))}
              </select>
              {targetTenantId === 'global' && (
                <p className="profiles-superadmin-desc">Este perfil estará disponible para todas las empresas clientes en su lista de "Plantillas Kuden".</p>
              )}
              {targetTenantId !== 'global' && targetTenantId !== 'own' && (
                <p className="profiles-superadmin-desc">Este perfil se creará directamente en el entorno de la empresa seleccionada.</p>
              )}
            </div>
          )}

          {editingId && (
            <div style={{ gridColumn: '1 / -1' }}>
              <KnowledgeBaseManager tenantId={tenantId} profileId={editingId} isDark={isDark} c={c} />
            </div>
          )}

          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button type="submit" disabled={creating} className="profiles-btn-submit">
              {creating ? (
                <>
                  <i className="ti ti-loader" style={{ animation: 'spin 1s linear infinite', marginRight: '6px' }}></i>
                  Guardando...
                </>
              ) : (
                'Guardar Perfil'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ── Perfiles propios ── */}
      <h3 className="profiles-section-title">
        {isSuperAdmin ? 'Mis perfiles (Kuden Demo Tenant)' : 'Perfiles de mi empresa'}
        <span className="profiles-section-count">
          {profiles.length} perfil{profiles.length !== 1 ? 'es' : ''}
        </span>
      </h3>

      {loading ? (
        <p className="profiles-subtitle">Cargando perfiles...</p>
      ) : profiles.length === 0 ? (
        <div className="profiles-empty-state">
          <i className="ti ti-robot profiles-empty-icon"></i>
          <p className="profiles-empty-text">No hay perfiles propios. Crea uno para activar el Simulador.</p>
        </div>
      ) : (
        <div className="profiles-grid">
          {profiles.map(p => <ProfileCard key={p.id} p={p} isOwnProfile={true} />)}
        </div>
      )}

      {/* ── Plantillas Kuden globales ── */}
      {!isSuperAdmin && globalProfiles.length > 0 && (
        <div>
          <div className="profiles-global-divider-container">
            <hr className="profiles-global-divider-line" />
            <span className="profiles-global-divider-text">
              ⭐ Plantillas Kuden (globales) — disponibles para tu empresa
            </span>
            <hr className="profiles-global-divider-line" />
          </div>
          <p className="profiles-global-desc">
            Estos perfiles fueron creados por Kuden y están disponibles para que los uses en el Simulador. Son de solo lectura.
          </p>
          <div className="profiles-grid">
            {globalProfiles.map(p => <ProfileCard key={p.id} p={p} isOwnProfile={false} />)}
          </div>
        </div>
      )}
    </div>
  );
}
