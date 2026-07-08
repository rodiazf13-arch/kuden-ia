import React, { useState, useEffect } from 'react';
const API_URL = import.meta.env.VITE_API_URL || '';

export default function GlobalKeysManager({ isDark = true }) {
  const [activeTab, setActiveTab] = useState('keys'); // 'keys' | 'models'
  
  // ─── Estado Bóveda de Llaves API ───────────────────────────────────────────
  const [keysList, setKeysList] = useState([
    { provider: 'anthropic', label: 'Anthropic (Claude)', api_key: '', is_enabled: true, placeholder: 'sk-ant-...' },
    { provider: 'openai', label: 'OpenAI (GPT)', api_key: '', is_enabled: true, placeholder: 'sk-...' },
    { provider: 'gemini', label: 'Google (Gemini)', api_key: '', is_enabled: true, placeholder: 'AIza...' },
    { provider: 'groq', label: 'Groq (Llama 4 / 3)', api_key: '', is_enabled: true, placeholder: 'gsk_...' },
    { provider: 'openrouter', label: 'OpenRouter (Multi-LLM)', api_key: '', is_enabled: true, placeholder: 'sk-or-v1-...' }
  ]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [savingKey, setSavingKey] = useState({});

  // ─── Estado Catálogo de Modelos LLM ────────────────────────────────────────
  const [modelsList, setModelsList] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);
  const [editingModel, setEditingModel] = useState(null);
  const [modelForm, setModelForm] = useState({
    model_name: '',
    friendly_name: '',
    provider: 'anthropic',
    prompt_rate: 3.0,
    completion_rate: 15.0,
    is_active: true
  });
  const [savingModel, setSavingModel] = useState(false);

  useEffect(() => {
    fetchKeys();
  }, []);

  useEffect(() => {
    if (activeTab === 'models') {
      fetchModels();
    }
  }, [activeTab]);

  // ─── Funciones Bóveda de Llaves ────────────────────────────────────────────
  const fetchKeys = async () => {
    setLoadingKeys(true);
    try {
      const res = await fetch(`${API_URL}/api/master/provider-keys`);
      if (res.ok) {
        const data = await res.json();
        if (data.keys && Array.isArray(data.keys)) {
          setKeysList(prev => prev.map(item => {
            const found = data.keys.find(k => k.provider === item.provider);
            if (found) {
              return { ...item, api_key: found.api_key || '', is_enabled: found.is_enabled !== false };
            }
            return item;
          }));
        }
      } else {
        // Fallback si la ruta master falla o no está montada aún, intentar la ruta antigua
        const fallbackRes = await fetch(`${API_URL}/api/admin/global-settings`);
        const fallbackData = await fallbackRes.json();
        if (Array.isArray(fallbackData)) {
          setKeysList(prev => prev.map(item => {
            const found = fallbackData.find(g => g.key === `${item.provider}_key`);
            return found ? { ...item, api_key: found.value?.api_key || '' } : item;
          }));
        }
      }
    } catch (e) {
      console.error("Error cargando llaves API:", e);
    } finally {
      setLoadingKeys(false);
    }
  };

  const handleSaveKey = async (provider) => {
    setSavingKey(prev => ({ ...prev, [provider]: true }));
    const item = keysList.find(k => k.provider === provider);
    try {
      const res = await fetch(`${API_URL}/api/master/provider-keys/${provider}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: item.api_key, is_enabled: item.is_enabled })
      });
      if (res.ok) {
        alert(`Configuración del proveedor ${item.label} guardada correctamente.`);
      } else {
        // Fallback a global_settings si falla api master
        await fetch(`${API_URL}/api/admin/global-settings/${provider}_key`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: { api_key: item.api_key } })
        });
        alert(`Llave ${item.label} guardada correctamente.`);
      }
    } catch (e) {
      alert("Error al guardar la configuración del proveedor.");
    } finally {
      setSavingKey(prev => ({ ...prev, [provider]: false }));
    }
  };

  const handleToggleProvider = async (provider, currentStatus) => {
    const nextStatus = !currentStatus;
    setKeysList(prev => prev.map(k => k.provider === provider ? { ...k, is_enabled: nextStatus } : k));
    try {
      const item = keysList.find(k => k.provider === provider);
      await fetch(`${API_URL}/api/master/provider-keys/${provider}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: item.api_key, is_enabled: nextStatus })
      });
    } catch (e) {
      console.error("Error toggling provider:", e);
    }
  };

  // ─── Funciones Catálogo de Modelos ─────────────────────────────────────────
  const fetchModels = async () => {
    setLoadingModels(true);
    try {
      const res = await fetch(`${API_URL}/api/master/llm-models`);
      const data = await res.json();
      if (data.models && Array.isArray(data.models)) {
        setModelsList(data.models);
      }
    } catch (e) {
      console.error("Error cargando modelos LLM:", e);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleOpenModelModal = (model = null) => {
    if (model) {
      setEditingModel(model);
      setModelForm({
        model_name: model.model_name || '',
        friendly_name: model.friendly_name || '',
        provider: model.provider || 'anthropic',
        prompt_rate: model.prompt_rate || 0,
        completion_rate: model.completion_rate || 0,
        is_active: model.is_active !== false
      });
    } else {
      setEditingModel(null);
      setModelForm({
        model_name: '',
        friendly_name: '',
        provider: 'anthropic',
        prompt_rate: 1.0,
        completion_rate: 5.0,
        is_active: true
      });
    }
    setShowModelModal(true);
  };

  const handleSaveModel = async (e) => {
    e.preventDefault();
    setSavingModel(true);
    try {
      const url = editingModel 
        ? `${API_URL}/api/master/llm-models/${editingModel.id}` 
        : `${API_URL}/api/master/llm-models`;
      const method = editingModel ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modelForm)
      });
      if (res.ok) {
        setShowModelModal(false);
        fetchModels();
      } else {
        const err = await res.json();
        alert(`Error al guardar modelo: ${err.error || 'Desconocido'}`);
      }
    } catch (e) {
      alert("Error al guardar el modelo LLM.");
    } finally {
      setSavingModel(false);
    }
  };

  const handleToggleModelActive = async (model) => {
    const nextStatus = !model.is_active;
    setModelsList(prev => prev.map(m => m.id === model.id ? { ...m, is_active: nextStatus } : m));
    try {
      await fetch(`${API_URL}/api/master/llm-models/${model.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: nextStatus })
      });
    } catch (e) {
      console.error("Error toggling model:", e);
      fetchModels();
    }
  };

  const handleDeleteModel = async (model) => {
    if (!confirm(`¿Estás seguro de eliminar el modelo "${model.friendly_name}"?`)) return;
    try {
      const res = await fetch(`${API_URL}/api/master/llm-models/${model.id}`, { method: 'DELETE' });
      if (res.ok) {
        setModelsList(prev => prev.filter(m => m.id !== model.id));
      }
    } catch (e) {
      alert("Error al eliminar el modelo.");
    }
  };

  return (
    <div className="keys-container" style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--color-text)', margin: '0 0 6px 0' }}>
            Gestión APIs y LLM (Bóveda Central)
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: '0' }}>
            Administración centralizada de API Keys corporativas, catálogo de modelos y tarifas por millón de tokens (Kuden QA Standard).
          </p>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', background: 'var(--color-surface)', padding: '4px', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
          <button
            onClick={() => setActiveTab('keys')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'keys' ? '#24b9eb' : 'transparent',
              color: activeTab === 'keys' ? '#ffffff' : 'var(--color-text-secondary)',
              fontWeight: '600',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            <i className="ti ti-key"></i> Bóveda API Keys (`provider_keys`)
          </button>
          <button
            onClick={() => setActiveTab('models')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'models' ? '#24b9eb' : 'transparent',
              color: activeTab === 'models' ? '#ffffff' : 'var(--color-text-secondary)',
              fontWeight: '600',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            <i className="ti ti-cpu"></i> Catálogo & Tarifas (`llm_models_pricing`)
          </button>
        </div>
      </div>

      {/* ─── TAB 1: Bóveda API Keys ─── */}
      {activeTab === 'keys' && (
        <div>
          {loadingKeys ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              <i className="ti ti-loader ti-spin" style={{ fontSize: '28px', marginBottom: '12px' }}></i>
              <p>Cargando bóveda de llaves API corporativas...</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))', gap: '20px' }}>
              {keysList.map(item => {
                const isConfigured = item.api_key && item.api_key.length > 0;
                const isSaving = savingKey[item.provider];

                return (
                  <div key={item.provider} style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '14px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          width: '36px', height: '36px', borderRadius: '10px',
                          background: 'rgba(36, 185, 235, 0.1)', color: '#24b9eb',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px'
                        }}>
                          <i className={`ti ti-${item.provider === 'anthropic' ? 'brain' : item.provider === 'openai' ? 'sparkles' : item.provider === 'gemini' ? 'flame' : 'cpu'}`}></i>
                        </span>
                        <div>
                          <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--color-text)', margin: '0' }}>{item.label}</h3>
                          <span style={{ fontSize: '12px', color: item.is_enabled ? '#10b981' : '#ef4444', fontWeight: '600' }}>
                            {item.is_enabled ? '● Proveedor Habilitado' : '○ Proveedor Deshabilitado'}
                          </span>
                        </div>
                      </div>

                      {/* Configured Badge & Toggle */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {isConfigured ? (
                          <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <i className="ti ti-check"></i> Configurada
                          </span>
                        ) : (
                          <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <i className="ti ti-x"></i> Sin configurar
                          </span>
                        )}

                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} title="Activar/Desactivar proveedor en todo el sistema">
                          <input
                            type="checkbox"
                            checked={item.is_enabled}
                            onChange={() => handleToggleProvider(item.provider, item.is_enabled)}
                            style={{ display: 'none' }}
                          />
                          <div style={{
                            width: '44px', height: '24px',
                            background: item.is_enabled ? '#10b981' : 'var(--color-border)',
                            borderRadius: '12px', position: 'relative', transition: 'background 0.2s'
                          }}>
                            <div style={{
                              width: '18px', height: '18px', background: '#fff',
                              borderRadius: '50%', position: 'absolute',
                              top: '3px', left: item.is_enabled ? '23px' : '3px',
                              transition: 'left 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                            }} />
                          </div>
                        </label>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                      <input
                        type="password"
                        placeholder={item.placeholder}
                        value={item.api_key}
                        onChange={e => {
                          const val = e.target.value;
                          setKeysList(prev => prev.map(k => k.provider === item.provider ? { ...k, api_key: val } : k));
                        }}
                        style={{
                          flex: 1, padding: '10px 14px', borderRadius: '8px',
                          border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                          color: 'var(--color-text)', fontSize: '14px'
                        }}
                      />
                      <button
                        onClick={() => handleSaveKey(item.provider)}
                        disabled={isSaving}
                        style={{
                          background: '#24b9eb', color: '#fff', border: 'none',
                          padding: '0 18px', borderRadius: '8px', fontWeight: '600',
                          fontSize: '14px', cursor: isSaving ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', gap: '6px', opacity: isSaving ? 0.7 : 1
                        }}
                      >
                        <i className="ti ti-device-floppy"></i>
                        {isSaving ? 'Guardando...' : 'Guardar'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: Catálogo de Modelos LLM ─── */}
      {activeTab === 'models' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)', fontWeight: '500' }}>
              Tarifas por cada <strong style={{ color: 'var(--color-text)' }}>1,000,000 de tokens</strong> (Regla Binding Constraint activa)
            </span>
            <button
              onClick={() => handleOpenModelModal()}
              style={{
                background: '#10b981', color: '#fff', border: 'none',
                padding: '10px 18px', borderRadius: '8px', fontWeight: '600',
                fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <i className="ti ti-plus"></i> Nuevo Modelo LLM
            </button>
          </div>

          {loadingModels ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              <i className="ti ti-loader ti-spin" style={{ fontSize: '28px', marginBottom: '12px' }}></i>
              <p>Cargando catálogo maestro de modelos...</p>
            </div>
          ) : modelsList.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', background: 'var(--color-surface)', borderRadius: '14px', border: '1px solid var(--color-border)' }}>
              <i className="ti ti-database-off" style={{ fontSize: '36px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}></i>
              <p style={{ margin: 0, color: 'var(--color-text)' }}>No hay modelos registrados en el mantenedor.</p>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Ejecuta el script SQL o haz clic en "Nuevo Modelo LLM".</p>
            </div>
          ) : (
            <div style={{ background: 'var(--color-surface)', borderRadius: '14px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.05)', borderBottom: '1px solid var(--color-border)', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                    <th style={{ padding: '14px 16px' }}>Modelo & Nombre Visible</th>
                    <th style={{ padding: '14px 16px' }}>Proveedor</th>
                    <th style={{ padding: '14px 16px' }}>Input Rate / 1M USD</th>
                    <th style={{ padding: '14px 16px' }}>Output Rate / 1M USD</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center' }}>Estado</th>
                    <th style={{ padding: '14px 16px', textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {modelsList.map(model => (
                    <tr key={model.id} style={{ borderBottom: '1px solid var(--color-border)', fontSize: '14px', color: 'var(--color-text)' }}>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: '600' }}>{model.friendly_name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>{model.model_name}</div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase',
                          background: model.provider === 'anthropic' ? 'rgba(139,92,246,0.15)' : model.provider === 'openai' ? 'rgba(16,185,129,0.15)' : 'rgba(36,185,235,0.15)',
                          color: model.provider === 'anthropic' ? '#8b5cf6' : model.provider === 'openai' ? '#10b981' : '#24b9eb'
                        }}>
                          {model.provider}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontWeight: '500' }}>
                        ${Number(model.prompt_rate).toFixed(4)} USD
                      </td>
                      <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontWeight: '500' }}>
                        ${Number(model.completion_rate).toFixed(4)} USD
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleToggleModelActive(model)}
                          style={{
                            background: model.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                            color: model.is_active ? '#10b981' : '#ef4444',
                            border: 'none', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', gap: '4px'
                          }}
                        >
                          <i className={`ti ti-${model.is_active ? 'check' : 'x'}`}></i>
                          {model.is_active ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            onClick={() => handleOpenModelModal(model)}
                            style={{ background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text)', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer' }}
                            title="Editar tarifas"
                          >
                            <i className="ti ti-edit"></i>
                          </button>
                          <button
                            onClick={() => handleDeleteModel(model)}
                            style={{ background: 'transparent', border: '1px solid var(--color-border)', color: '#ef4444', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer' }}
                            title="Eliminar modelo"
                          >
                            <i className="ti ti-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL CREAR / EDITAR MODELO ─── */}
      {showModelModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'var(--color-surface)', borderRadius: '16px', border: '1px solid var(--color-border)',
            width: '100%', maxWidth: '520px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--color-text)' }}>
                {editingModel ? 'Editar Tarifa / Modelo LLM' : 'Nuevo Modelo LLM'}
              </h3>
              <button onClick={() => setShowModelModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', fontSize: '20px', cursor: 'pointer' }}>
                <i className="ti ti-x"></i>
              </button>
            </div>

            <form onSubmit={handleSaveModel} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--color-text)', marginBottom: '6px' }}>
                  Nombre Técnico / ID exacto de la API (`model_name`) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej: gpt-5.4, claude-sonnet-4-6"
                  value={modelForm.model_name}
                  onChange={e => setModelForm({ ...modelForm, model_name: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '14px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--color-text)', marginBottom: '6px' }}>
                  Nombre Amigable (`friendly_name`) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej: Claude 4.6 Sonnet (Balanceado)"
                  value={modelForm.friendly_name}
                  onChange={e => setModelForm({ ...modelForm, friendly_name: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '14px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--color-text)', marginBottom: '6px' }}>
                  Proveedor LLM (`provider`) *
                </label>
                <select
                  value={modelForm.provider}
                  onChange={e => setModelForm({ ...modelForm, provider: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '14px' }}
                >
                  <option value="anthropic">Anthropic</option>
                  <option value="openai">OpenAI</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="groq">Groq</option>
                  <option value="openrouter">OpenRouter</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--color-text)', marginBottom: '6px' }}>
                    Tarifa Input (USD / 1M tokens) *
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={modelForm.prompt_rate}
                    onChange={e => setModelForm({ ...modelForm, prompt_rate: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '14px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--color-text)', marginBottom: '6px' }}>
                    Tarifa Output (USD / 1M tokens) *
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={modelForm.completion_rate}
                    onChange={e => setModelForm({ ...modelForm, completion_rate: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '14px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                <input
                  type="checkbox"
                  id="modal_is_active"
                  checked={modelForm.is_active}
                  onChange={e => setModelForm({ ...modelForm, is_active: e.target.checked })}
                  style={{ width: '18px', height: '18px' }}
                />
                <label htmlFor="modal_is_active" style={{ fontSize: '14px', color: 'var(--color-text)', cursor: 'pointer', fontWeight: '500' }}>
                  Modelo Activo (Permitido para selección en perfiles IA)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => setShowModelModal(false)}
                  style={{ background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text)', padding: '10px 18px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingModel}
                  style={{ background: '#24b9eb', color: '#fff', border: 'none', padding: '10px 22px', borderRadius: '8px', fontWeight: '600', cursor: savingModel ? 'not-allowed' : 'pointer' }}
                >
                  {savingModel ? 'Guardando...' : 'Guardar Modelo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
