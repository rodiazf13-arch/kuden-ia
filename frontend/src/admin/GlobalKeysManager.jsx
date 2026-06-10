import React, { useState, useEffect } from 'react';
const API_URL = import.meta.env.VITE_API_URL || '';

export default function GlobalKeysManager({ isDark = true }) {
  const [keys, setKeys] = useState({
    anthropic_key: '',
    openai_key: '',
    gemini_key: '',
    groq_key: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const c = {
    card:      isDark ? '#111'    : '#ffffff',
    border:    isDark ? '#222'    : '#e5e7eb',
    title:     isDark ? '#ffffff' : '#111827',
    subtitle:  isDark ? '#aaaaaa' : '#6b7280',
    inputBg:   isDark ? '#1a1a1a' : '#f9fafb',
    inputText: isDark ? '#ffffff' : '#111827',
  };

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

  if (loading) return <div style={{ color: c.subtitle }}>Cargando configuraciones globales...</div>;

  const renderKeyRow = (label, keyName, placeholder) => (
    <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 16, color: c.title }}>{label}</h3>
      <div style={{ display: 'flex', gap: 12 }}>
        <input 
          type="password"
          placeholder={placeholder}
          value={keys[keyName]}
          onChange={e => setKeys({ ...keys, [keyName]: e.target.value })}
          style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: `1px solid ${c.border}`, background: c.inputBg, color: c.inputText, outline: 'none', fontSize: 14 }}
        />
        <button 
          onClick={() => handleSave(keyName)}
          disabled={saving}
          style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: saving ? 'wait' : 'pointer', fontWeight: 600 }}>
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 800 }}>
      <h2 style={{ fontSize: 24, fontWeight: 'bold', margin: '0 0 8px', color: c.title }}>Gestión de Llaves API Maestras</h2>
      <p style={{ margin: '0 0 24px', color: c.subtitle }}>Estas llaves son utilizadas por el Gestor Multi-LLM para dar servicio a todos los Tenants.</p>

      {renderKeyRow("Anthropic (Claude)", "anthropic_key", "sk-ant-...")}
      {renderKeyRow("OpenAI (GPT)", "openai_key", "sk-...")}
      {renderKeyRow("Google (Gemini)", "gemini_key", "AIza...")}
      {renderKeyRow("Groq (Llama 3)", "groq_key", "gsk_...")}
    </div>
  );
}
