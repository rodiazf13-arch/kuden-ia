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
            <div className="llm-models-empty">
              <i className="ti ti-loader ti-spin" style={{ fontSize: '28px', marginBottom: '12px', display: 'block' }}></i>
              <p style={{ margin: 0 }}>Cargando bóveda de llaves API corporativas...</p>
            </div>
          ) : (
            <div className="llm-keys-grid">
              {keysList.map(item => {
                const isConfigured = item.api_key && item.api_key.length > 0;
                const isSaving = savingKey[item.provider];

                return (
                  <div key={item.provider} className="llm-key-card">
                    <div className="llm-key-header">
                      <div className="llm-key-info">
                        <span className="llm-key-icon-wrapper">
                          <i className={`ti ti-${item.provider === 'anthropic' ? 'brain' : item.provider === 'openai' ? 'sparkles' : item.provider === 'gemini' ? 'flame' : 'cpu'}`}></i>
                        </span>
                        <div>
                          <h3 className="llm-key-title">{item.label}</h3>
                          <span className={`llm-key-status ${item.is_enabled ? 'enabled' : 'disabled'}`}>
                            {item.is_enabled ? '● Proveedor Habilitado' : '○ Proveedor Deshabilitado'}
                          </span>
                        </div>
                      </div>

                      {/* Configured Badge & Toggle */}
                      <div className="llm-key-badges">
                        {isConfigured ? (
                          <span className="llm-badge configured">
                            <i className="ti ti-check"></i> Configurada
                          </span>
                        ) : (
                          <span className="llm-badge unconfigured">
                            <i className="ti ti-x"></i> Sin configurar
                          </span>
                        )}

                        <label className="llm-toggle-switch" title="Activar/Desactivar proveedor en todo el sistema">
                          <input
                            type="checkbox"
                            checked={item.is_enabled}
                            onChange={() => handleToggleProvider(item.provider, item.is_enabled)}
                            style={{ display: 'none' }}
                          />
                          <div className={`llm-toggle-track ${item.is_enabled ? 'active' : ''}`}>
                            <div className="llm-toggle-thumb" />
                          </div>
                        </label>
                      </div>
                    </div>

                    <div className="llm-key-input-row">
                      <input
                        type="password"
                        placeholder={item.placeholder}
                        value={item.api_key}
                        onChange={e => {
                          const val = e.target.value;
                          setKeysList(prev => prev.map(k => k.provider === item.provider ? { ...k, api_key: val } : k));
                        }}
                        className="llm-key-input"
                      />
                      <button
                        onClick={() => handleSaveKey(item.provider)}
                        disabled={isSaving}
                        className="llm-key-save-btn"
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
          <div className="llm-models-header-bar">
            <span className="llm-models-subtitle">
              Tarifas por cada <strong>1,000,000 de tokens</strong> (Regla Binding Constraint activa)
            </span>
            <button
              onClick={() => handleOpenModelModal()}
              className="llm-new-model-btn"
            >
              <i className="ti ti-plus"></i> Nuevo Modelo LLM
            </button>
          </div>

          {loadingModels ? (
            <div className="llm-models-empty">
              <i className="ti ti-loader ti-spin" style={{ fontSize: '28px', marginBottom: '12px', display: 'block' }}></i>
              <p style={{ margin: 0 }}>Cargando catálogo maestro de modelos...</p>
            </div>
          ) : modelsList.length === 0 ? (
            <div className="llm-models-empty">
              <i className="ti ti-database-off" style={{ fontSize: '36px', color: 'var(--color-text-secondary)', marginBottom: '12px', display: 'block' }}></i>
              <p style={{ margin: 0, fontWeight: '600' }}>No hay modelos registrados en el mantenedor.</p>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>Ejecuta el script SQL o haz clic en "Nuevo Modelo LLM".</p>
            </div>
          ) : (
            <div className="kuden-table-container">
              <table className="kuden-table">
                <thead>
                  <tr>
                    <th>Modelo & Nombre Visible</th>
                    <th>Proveedor</th>
                    <th>Input Rate / 1M USD</th>
                    <th>Output Rate / 1M USD</th>
                    <th style={{ textAlign: 'center' }}>Estado</th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {modelsList.map(model => (
                    <tr key={model.id}>
                      <td>
                        <div className="llm-model-name-primary">{model.friendly_name}</div>
                        <div className="llm-model-name-secondary">{model.model_name}</div>
                      </td>
                      <td>
                        <span className={`llm-provider-badge ${model.provider || 'default'}`}>
                          {model.provider}
                        </span>
                      </td>
                      <td className="llm-rate-cell">
                        ${Number(model.prompt_rate).toFixed(4)} USD
                      </td>
                      <td className="llm-rate-cell">
                        ${Number(model.completion_rate).toFixed(4)} USD
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => handleToggleModelActive(model)}
                          className={`llm-status-toggle-btn ${model.is_active ? 'active' : 'inactive'}`}
                        >
                          <i className={`ti ti-${model.is_active ? 'check' : 'x'}`}></i>
                          {model.is_active ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="llm-action-btn-group">
                          <button
                            onClick={() => handleOpenModelModal(model)}
                            className="llm-action-btn"
                            title="Editar tarifas"
                          >
                            <i className="ti ti-edit"></i>
                          </button>
                          <button
                            onClick={() => handleDeleteModel(model)}
                            className="llm-action-btn delete"
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
        <div className="llm-modal-overlay">
          <div className="llm-modal-card">
            <div className="llm-modal-header">
              <h3 className="llm-modal-title">
                {editingModel ? 'Editar Tarifa / Modelo LLM' : 'Nuevo Modelo LLM'}
              </h3>
              <button onClick={() => setShowModelModal(false)} className="llm-modal-close">
                <i className="ti ti-x"></i>
              </button>
            </div>

            <form onSubmit={handleSaveModel} className="llm-modal-form">
              <div className="llm-form-group">
                <label className="llm-form-label">
                  Nombre Técnico / ID exacto de la API (`model_name`) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej: gpt-4o, claude-sonnet-4-6"
                  value={modelForm.model_name}
                  onChange={e => setModelForm({ ...modelForm, model_name: e.target.value })}
                  className="llm-form-input"
                />
              </div>

              <div className="llm-form-group">
                <label className="llm-form-label">
                  Nombre Amigable (`friendly_name`) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej: Claude 4.6 Sonnet (Balanceado)"
                  value={modelForm.friendly_name}
                  onChange={e => setModelForm({ ...modelForm, friendly_name: e.target.value })}
                  className="llm-form-input"
                />
              </div>

              <div className="llm-form-group">
                <label className="llm-form-label">
                  Proveedor LLM (`provider`) *
                </label>
                <select
                  value={modelForm.provider}
                  onChange={e => setModelForm({ ...modelForm, provider: e.target.value })}
                  className="llm-form-select"
                >
                  <option value="anthropic">Anthropic</option>
                  <option value="openai">OpenAI</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="groq">Groq</option>
                  <option value="openrouter">OpenRouter</option>
                </select>
              </div>

              <div className="llm-form-grid-2">
                <div className="llm-form-group">
                  <label className="llm-form-label">
                    Tarifa Input (USD / 1M tokens) *
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={modelForm.prompt_rate}
                    onChange={e => setModelForm({ ...modelForm, prompt_rate: parseFloat(e.target.value) || 0 })}
                    className="llm-form-input"
                  />
                </div>
                <div className="llm-form-group">
                  <label className="llm-form-label">
                    Tarifa Output (USD / 1M tokens) *
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={modelForm.completion_rate}
                    onChange={e => setModelForm({ ...modelForm, completion_rate: parseFloat(e.target.value) || 0 })}
                    className="llm-form-input"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  id="modal_is_active"
                  checked={modelForm.is_active}
                  onChange={e => setModelForm({ ...modelForm, is_active: e.target.checked })}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                />
                <label htmlFor="modal_is_active" className="llm-form-label" style={{ cursor: 'pointer', margin: 0 }}>
                  Modelo Activo (Permitido para selección en perfiles IA)
                </label>
              </div>

              <div className="llm-modal-actions">
                <button
                  type="button"
                  onClick={() => setShowModelModal(false)}
                  className="llm-btn-cancel"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingModel}
                  className="llm-btn-save"
                >
                  <i className="ti ti-device-floppy"></i>
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
