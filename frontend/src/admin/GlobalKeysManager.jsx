import React, { useState, useEffect } from 'react';
const API_URL = import.meta.env.VITE_API_URL || '';

export default function GlobalKeysManager({ isDark = true }) {
  const [keys, setKeys] = useState({
    anthropic_key: '',
    openai_key: '',
    gemini_key: '',
    groq_key: '',
    openrouter_key: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/global-settings`);
      const data = await res.json();
      if (Array.isArray(data)) {
        const newKeys = { ...keys };
        data.forEach(item => {
          if (newKeys[item.key] !== undefined) {
            newKeys[item.key] = item.value?.api_key || '';
          }
        });
        setKeys(newKeys);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (keyName) => {
    setSaving(true);
    try {
      await fetch(`${API_URL}/api/admin/global-settings/${keyName}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: { api_key: keys[keyName] } })
      });
      alert(`Llave ${keyName} guardada correctamente.`);
    } catch (e) {
      alert("Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: '40px 20px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>Cargando configuraciones globales...</div>;

  const renderKeyRow = (label, keyName, placeholder) => (
    <div className="keys-card">
      <h3 className="keys-card-title">{label}</h3>
      <div className="keys-form-row">
        <input 
          type="password"
          placeholder={placeholder}
          value={keys[keyName]}
          onChange={e => setKeys({ ...keys, [keyName]: e.target.value })}
          className="keys-input"
        />
        <button 
          onClick={() => handleSave(keyName)}
          disabled={saving}
          className="keys-btn-save">
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="keys-container">
      <h2 className="keys-title">Gestión de Llaves API Maestras</h2>
      <p className="keys-subtitle">Estas llaves son utilizadas por el Gestor Multi-LLM para dar servicio a todos los Tenants.</p>

      {renderKeyRow("Anthropic (Claude)", "anthropic_key", "sk-ant-...")}
      {renderKeyRow("OpenAI (GPT)", "openai_key", "sk-...")}
      {renderKeyRow("Google (Gemini)", "gemini_key", "AIza...")}
      {renderKeyRow("Groq (Llama 3)", "groq_key", "gsk_...")}
      {renderKeyRow("OpenRouter (Multi-LLM)", "openrouter_key", "sk-or-v1-...")}
    </div>
  );
}
