import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || '';

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

  // Internal AI Config
  const [kimiProvider, setKimiProvider] = useState('anthropic');
  const [kimiModel, setKimiModel] = useState('claude-sonnet-4-6');
  const [summaryProvider, setSummaryProvider] = useState('anthropic');
  const [summaryModel, setSummaryModel] = useState('claude-haiku-4-5-20251001');
  const [openRouterModels, setOpenRouterModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [kimiCatalogModels, setKimiCatalogModels] = useState([]);
  const [summaryCatalogModels, setSummaryCatalogModels] = useState([]);

  useEffect(() => {
    fetch(`${API_URL}/api/master/provider-models?provider=${kimiProvider}`)
      .then(res => res.json())
      .then(data => { if (data?.models) setKimiCatalogModels(data.models); })
      .catch(err => console.error("Error fetching kimi catalog:", err));
  }, [kimiProvider]);

  useEffect(() => {
    fetch(`${API_URL}/api/master/provider-models?provider=${summaryProvider}`)
      .then(res => res.json())
      .then(data => { if (data?.models) setSummaryCatalogModels(data.models); })
      .catch(err => console.error("Error fetching summary catalog:", err));
  }, [summaryProvider]);

  // RAG Suggestions
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionAiProfile, setSuggestionAiProfile] = useState({});

  useEffect(() => {
    if (tenantId) {
      fetchConfig();
      fetchSuggestions();
    }
  }, [tenantId]);

  const fetchSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const res = await fetch(`${API_URL}/api/rag-suggestions?tenantId=${tenantId}&status=pending`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuggestions(data || []);
      
      // Init default profile mapping
      const mapping = {};
      (data || []).forEach(s => {
        mapping[s.id] = s.ai_profile_id || '';
      });
      setSuggestionAiProfile(mapping);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleApproveSuggestion = async (sug) => {
    const profId = suggestionAiProfile[sug.id];
    if (!profId) return alert('Debes seleccionar un perfil IA de destino');
    try {
      const res = await fetch(`${API_URL}/api/rag-suggestions/${sug.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, aiProfileId: profId, question: sug.suggested_question, answer: sug.suggested_answer })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert('¡Sugerencia vectorizada exitosamente!');
      setSuggestions(prev => prev.filter(s => s.id !== sug.id));
    } catch (e) {
      alert(e.message);
    }
  };

  const handleRejectSuggestion = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/rag-suggestions/${id}/reject`, { method: 'POST' });
      if (!res.ok) throw new Error('Error al rechazar');
      setSuggestions(prev => prev.filter(s => s.id !== id));
    } catch (e) {
      alert(e.message);
    }
  };

  useEffect(() => {
    if ((kimiProvider === 'openrouter' || summaryProvider === 'openrouter') && openRouterModels.length === 0) {
      setLoadingModels(true);
      fetch('https://openrouter.ai/api/v1/models')
        .then(res => res.json())
        .then(data => {
          if (data && data.data) {
            const sortedModels = data.data.sort((a,b) => a.id.localeCompare(b.id));
            setOpenRouterModels(sortedModels);
            if (kimiProvider === 'openrouter' && (!kimiModel || !sortedModels.find(m => m.id === kimiModel))) setKimiModel(sortedModels[0].id);
            if (summaryProvider === 'openrouter' && (!summaryModel || !sortedModels.find(m => m.id === summaryModel))) setSummaryModel(sortedModels[0].id);
          }
        })
        .catch(err => console.error("Error fetching openrouter models:", err))
        .finally(() => setLoadingModels(false));
    }
  }, [kimiProvider, summaryProvider]);

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
        setKimiProvider(data.kimi_llm_provider || 'anthropic');
        setKimiModel(data.kimi_llm_model || 'claude-sonnet-4-6');
        setSummaryProvider(data.summary_llm_provider || 'anthropic');
        setSummaryModel(data.summary_llm_model || 'claude-haiku-4-5-20251001');
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
        kimi_llm_provider: kimiProvider,
        kimi_llm_model: kimiModel,
        summary_llm_provider: summaryProvider,
        summary_llm_model: summaryModel,
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

  if (!tenantId) return (
    <div className="aiconfig-subtitle" style={{ padding: '40px', textAlign: 'center' }}>
      Tu cuenta no está vinculada a ninguna empresa. Contacta al administrador.
    </div>
  );

  if (loading) return <p className="aiconfig-subtitle">Cargando configuración maestra...</p>;

  return (
    <div className="aiconfig-container">
      <h2 className="aiconfig-title">Inteligencia Interna Kuden</h2>
      <p className="aiconfig-subtitle">
        Configura qué modelos procesan las tareas internas de la plataforma (como reportería, análisis y Kimi Co-Piloto).
      </p>

      {error && (
        <div className="aiconfig-alert error">
          <i className="ti ti-alert-triangle"></i>
          {error}
        </div>
      )}
      
      {success && (
        <div className="aiconfig-alert success">
          <i className="ti ti-circle-check"></i>
          Configuración de Inteligencia Interna actualizada correctamente.
        </div>
      )}

      <div className="aiconfig-card">
        <h3 className="aiconfig-section-title">Modelos de Inteligencia Interna</h3>
        <p className="aiconfig-section-subtitle">
          Elige los proveedores y modelos que Kuden utilizará por detrás para realizar tareas operativas. Elegir modelos económicos para resúmenes puede ahorrar mucho presupuesto.
        </p>

        <form onSubmit={handleSave} className="aiconfig-form-grid">
          
          {/* KIMI COPILOT */}
          <div className="aiconfig-sub-card kimi-config-card">
            <h4 className="aiconfig-sub-card-title">
              <i className="ti ti-cpu"></i>
              Kimi Co-Piloto
            </h4>
            <div className="aiconfig-sub-grid">
              <div className="aiconfig-input-wrapper">
                <label className="aiconfig-label">Proveedor LLM</label>
                <select value={kimiProvider} onChange={e => {
                  setKimiProvider(e.target.value);
                }}>
                  <option value="anthropic">Anthropic</option>
                  <option value="openai">OpenAI</option>
                  <option value="gemini">Google</option>
                  <option value="groq">Groq</option>
                  <option value="openrouter">OpenRouter</option>
                </select>
              </div>
              <div className="aiconfig-input-wrapper">
                <label className="aiconfig-label">Modelo Específico</label>
                <select value={kimiModel} onChange={e => setKimiModel(e.target.value)} disabled={loadingModels}>
                  {kimiCatalogModels.length > 0 ? (
                    kimiCatalogModels.map(m => (
                      <option key={m.id || m.model_name} value={m.model_name}>
                        {m.friendly_name} (${Number(m.prompt_rate).toFixed(2)}/1M in)
                      </option>
                    ))
                  ) : (
                    <>
                      {kimiProvider === 'anthropic' && <><option value="claude-sonnet-4-6">Claude 4.6 Sonnet</option><option value="claude-haiku-4-5-20251001">Claude 4.5 Haiku</option></>}
                      {kimiProvider === 'openai' && <><option value="gpt-4o">GPT-4o</option><option value="gpt-4o-mini">GPT-4o Mini</option></>}
                      {kimiProvider === 'gemini' && <><option value="gemini-1.5-pro">Gemini 1.5 Pro</option><option value="gemini-1.5-flash">Gemini 1.5 Flash</option></>}
                      {kimiProvider === 'groq' && <><option value="llama3-70b-8192">Llama 3 70B</option><option value="llama3-8b-8192">Llama 3 8B</option></>}
                      {kimiProvider === 'openrouter' && openRouterModels.map(m => <option key={m.id} value={m.id}>{m.id}</option>)}
                    </>
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* SUMMARY ANALYST */}
          <div className="aiconfig-sub-card summary">
            <h4 className="aiconfig-sub-card-title">
              <i className="ti ti-notes"></i>
              Analista de Resúmenes (Cierre de Tickets)
            </h4>
            <div className="aiconfig-sub-grid">
              <div className="aiconfig-input-wrapper">
                <label className="aiconfig-label">Proveedor LLM</label>
                <select value={summaryProvider} onChange={e => {
                  setSummaryProvider(e.target.value);
                }}>
                  <option value="anthropic">Anthropic</option>
                  <option value="openai">OpenAI</option>
                  <option value="gemini">Google</option>
                  <option value="groq">Groq</option>
                  <option value="openrouter">OpenRouter</option>
                </select>
              </div>
              <div className="aiconfig-input-wrapper">
                <label className="aiconfig-label">Modelo Específico</label>
                <select value={summaryModel} onChange={e => setSummaryModel(e.target.value)} disabled={loadingModels}>
                  {summaryCatalogModels.length > 0 ? (
                    summaryCatalogModels.map(m => (
                      <option key={m.id || m.model_name} value={m.model_name}>
                        {m.friendly_name} (${Number(m.prompt_rate).toFixed(2)}/1M in)
                      </option>
                    ))
                  ) : (
                    <>
                      {summaryProvider === 'anthropic' && <><option value="claude-sonnet-4-6">Claude 4.6 Sonnet</option><option value="claude-haiku-4-5-20251001">Claude 4.5 Haiku</option></>}
                      {summaryProvider === 'openai' && <><option value="gpt-4o">GPT-4o</option><option value="gpt-4o-mini">GPT-4o Mini</option></>}
                      {summaryProvider === 'gemini' && <><option value="gemini-1.5-pro">Gemini 1.5 Pro</option><option value="gemini-1.5-flash">Gemini 1.5 Flash</option></>}
                      {summaryProvider === 'groq' && <><option value="llama3-70b-8192">Llama 3 70B</option><option value="llama3-8b-8192">Llama 3 8B</option></>}
                      {summaryProvider === 'openrouter' && openRouterModels.map(m => <option key={m.id} value={m.id}>{m.id}</option>)}
                    </>
                  )}
                </select>
              </div>
            </div>
          </div>

          <div className="aiconfig-footer">
            <button type="submit" disabled={saving} className="aiconfig-btn-primary">
              {saving ? (
                <>
                  <i className="ti ti-loader" style={{ animation: 'spin 1s linear infinite' }}></i>
                  Guardando...
                </>
              ) : (
                <>
                  <i className="ti ti-device-floppy"></i>
                  Guardar Configuración
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* BUZÓN RAG AUTO-DIDACTA */}
      <div className="aiconfig-card">
        <h3 className="aiconfig-rag-header">
          <i className="ti ti-bulb"></i>
          Buzón de Entrenamiento Auto-Didacta (RAG)
        </h3>
        <p className="aiconfig-section-subtitle">
          Kimi analiza las conversaciones de los humanos e identifica soluciones nuevas que no estaban en su base de datos. Aprueba las sugerencias y asígnalas a un perfil para que las memorice automáticamente.
        </p>

        {loadingSuggestions ? (
          <p className="aiconfig-section-subtitle">Buscando sugerencias...</p>
        ) : suggestions.length === 0 ? (
          <p className="aiconfig-rag-empty">
            No hay sugerencias nuevas. La IA sigue analizando tickets.
          </p>
        ) : (
          <div className="aiconfig-rag-list">
            {suggestions.map(sug => (
              <div key={sug.id} className="aiconfig-rag-item">
                <div style={{ marginBottom: '12px' }}>
                  <span className="aiconfig-rag-item-label">Pregunta Detectada (Cliente)</span>
                  <p className="aiconfig-rag-item-text">{sug.suggested_question}</p>
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <span className="aiconfig-rag-item-label">Solución Dada (Humano)</span>
                  <p className="aiconfig-rag-item-answer">{sug.suggested_answer}</p>
                </div>

                <div className="aiconfig-rag-assignment-row">
                  <div className="aiconfig-rag-select-group">
                    <span className="aiconfig-rag-item-label">Asignar conocimiento a</span>
                    <select 
                      value={suggestionAiProfile[sug.id] || ''}
                      onChange={e => setSuggestionAiProfile({...suggestionAiProfile, [sug.id]: e.target.value})}
                    >
                      <option value="">-- Seleccionar Perfil IA --</option>
                      {dbProfiles.map(p => (
                        <option key={p.id} value={p.id}>{p.label} {p.is_global ? '(Plantilla Global)' : ''}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="aiconfig-rag-actions">
                    <button 
                      onClick={() => handleRejectSuggestion(sug.id)}
                      className="aiconfig-btn-reject"
                    >
                      Descartar
                    </button>
                    <button 
                      onClick={() => handleApproveSuggestion(sug)}
                      className="aiconfig-btn-approve"
                    >
                      <i className="ti ti-circle-check"></i>
                      Aprobar e Inyectar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

