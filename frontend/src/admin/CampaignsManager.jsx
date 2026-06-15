import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function CampaignsManager({ tenantId, isDark = true }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCam, setSelectedCam] = useState(null);
  const [users, setUsers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [typifications, setTypifications] = useState([]);
  const [newTypLabel, setNewTypLabel] = useState('');

  // ─── n8n + Tools state ───────────────────────────────────────────────────────
  const [n8nUrl, setN8nUrl] = useState('');
  const [n8nToken, setN8nToken] = useState('');
  const [n8nHasToken, setN8nHasToken] = useState(false);
  const [n8nStatus, setN8nStatus] = useState(null); // null | 'ok' | 'error'
  const [n8nTesting, setN8nTesting] = useState(false);
  const [n8nSaving, setN8nSaving] = useState(false);
  const [tools, setTools] = useState([]);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [toolForm, setToolForm] = useState({ name: '', label: '', description: '', n8n_workflow_id: '', input_schema: '' });
  const [editingToolId, setEditingToolId] = useState(null);
  const [toolSaving, setToolSaving] = useState(false);
  const [showToolForm, setShowToolForm] = useState(false);

  const c = {
    card: isDark ? '#111' : '#fff',
    border: isDark ? '#222' : '#e5e7eb',
    title: isDark ? '#fff' : '#111827',
    subtitle: isDark ? '#aaa' : '#6b7280',
    inputBg: isDark ? '#1a1a1a' : '#f9fafb',
    inputText: isDark ? '#fff' : '#111827',
    n8nBg: isDark ? '#0a1a0a' : '#f0fdf4',
    n8nBorder: isDark ? '#1a4a1a' : '#bbf7d0',
  };

  const inp = {
    width: '100%', padding: '8px 10px', borderRadius: 8,
    border: `1px solid ${c.border}`, background: c.inputBg,
    color: c.inputText, outline: 'none', boxSizing: 'border-box', fontSize: 13
  };

  // ─── Loaders ─────────────────────────────────────────────────────────────────
  const loadCampaigns = async () => {
    try {
      const res = await fetch(`${API_URL}/api/crm/campaigns?tenantId=${tenantId}`);
      if (res.ok) setCampaigns(await res.json());
    } catch (e) { console.error(e); }
  };

  const loadUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/users?filterTenantId=${tenantId}`);
      if (res.ok) setUsers(await res.json());
    } catch (e) { console.error(e); }
  };

  const loadTemplates = async () => {
    try {
      const res = await fetch(`${API_URL}/api/crm/typification-templates`);
      if (res.ok) setTemplates(await res.json());
    } catch (e) { console.error(e); }
  };

  const loadTypifications = async (camId) => {
    try {
      const res = await fetch(`${API_URL}/api/crm/campaigns/${camId}/typifications`);
      if (res.ok) setTypifications(await res.json());
    } catch (e) { console.error(e); }
  };

  const loadProfiles = async () => {
    try {
      const { data, error } = await supabase.from('ai_profiles')
        .select('id, label')
        .or(`tenant_id.eq.${tenantId},is_global.eq.true`)
        .order('label');
      if (!error) setProfiles(data || []);
    } catch (e) { console.error(e); }
  };

  const loadN8nConfig = async (camId) => {
    try {
      const res = await fetch(`${API_URL}/api/crm/campaigns/${camId}/n8n-config`);
      if (res.ok) {
        const data = await res.json();
        setN8nUrl(data.n8n_webhook_url || '');
        setN8nHasToken(data.has_secret_token || false);
        setN8nToken('');
        setN8nStatus(null);
      }
    } catch (e) { console.error(e); }
  };

  const loadTools = async (camId) => {
    setToolsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/crm/campaigns/${camId}/tools`);
      if (res.ok) setTools(await res.json());
    } catch (e) { console.error(e); }
    finally { setToolsLoading(false); }
  };

  useEffect(() => {
    if (tenantId) {
      Promise.all([loadCampaigns(), loadUsers(), loadTemplates(), loadProfiles()]).finally(() => setLoading(false));
    }
  }, [tenantId]);

  useEffect(() => {
    if (selectedCam) {
      loadTypifications(selectedCam.id);
      loadN8nConfig(selectedCam.id);
      loadTools(selectedCam.id);
    }
  }, [selectedCam?.id]);

  // ─── Campaign handlers ────────────────────────────────────────────────────────
  const [form, setForm] = useState({ name: '', description: '', color: '#2563eb', icon: 'ti-speakerphone', ai_profile_id: '' });

  const handleCreate = async () => {
    if (!form.name) return;
    try {
      const res = await fetch(`${API_URL}/api/crm/campaigns`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, ...form })
      });
      if (res.ok) {
        setForm({ name: '', description: '', color: '#2563eb', icon: 'ti-speakerphone', ai_profile_id: '' });
        loadCampaigns();
      }
    } catch (e) { console.error(e); }
  };

  const updateCampaignProfile = async (campaignId, profileId) => {
    try {
      const res = await fetch(`${API_URL}/api/crm/campaigns/${campaignId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, ai_profile_id: profileId })
      });
      if (res.ok) loadCampaigns();
    } catch (e) { console.error(e); }
  };

  // ─── Typification handlers ────────────────────────────────────────────────────
  const addTypification = async (label) => {
    if (!label.trim()) return;
    try {
      const res = await fetch(`${API_URL}/api/crm/campaigns/${selectedCam.id}/typifications`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, label })
      });
      if (res.ok) { setNewTypLabel(''); loadTypifications(selectedCam.id); }
    } catch (e) { console.error(e); }
  };

  const removeTypification = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/crm/campaigns/${selectedCam.id}/typifications/${id}`, { method: 'DELETE' });
      if (res.ok) loadTypifications(selectedCam.id);
    } catch (e) { console.error(e); }
  };

  const applyTemplate = async (template) => {
    if (!template || !template.labels) return;
    for (const label of template.labels) { await addTypification(label); }
  };

  // ─── Agent assignment handlers ────────────────────────────────────────────────
  const assignAgent = async (userId) => {
    try {
      const res = await fetch(`${API_URL}/api/crm/campaigns/${selectedCam.id}/agents`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      if (res.ok) loadCampaigns();
    } catch (e) { console.error(e); }
  };

  const removeAgent = async (userId) => {
    try {
      const res = await fetch(`${API_URL}/api/crm/campaigns/${selectedCam.id}/agents/${userId}`, { method: 'DELETE' });
      if (res.ok) loadCampaigns();
    } catch (e) { console.error(e); }
  };

  // ─── n8n handlers ─────────────────────────────────────────────────────────────
  const testN8nConnection = async () => {
    if (!n8nUrl) return;
    setN8nTesting(true); setN8nStatus(null);
    try {
      const res = await fetch(`${API_URL}/api/crm/campaigns/${selectedCam.id}/test-n8n`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ n8n_webhook_url: n8nUrl })
      });
      const data = await res.json();
      setN8nStatus(data.ok ? 'ok' : 'error');
    } catch (e) { setN8nStatus('error'); }
    finally { setN8nTesting(false); }
  };

  const saveN8nConfig = async () => {
    setN8nSaving(true);
    try {
      const body = { n8n_webhook_url: n8nUrl };
      if (n8nToken.trim()) body.n8n_secret_token = n8nToken;
      const res = await fetch(`${API_URL}/api/crm/campaigns/${selectedCam.id}/n8n-config`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        setN8nHasToken(!!n8nToken.trim() || n8nHasToken);
        setN8nToken('');
        alert('✅ Configuración n8n guardada correctamente.');
      }
    } catch (e) { alert('Error al guardar: ' + e.message); }
    finally { setN8nSaving(false); }
  };

  // ─── Tool handlers ────────────────────────────────────────────────────────────
  const resetToolForm = () => {
    setToolForm({ name: '', label: '', description: '', n8n_workflow_id: '', input_schema: '' });
    setEditingToolId(null);
    setShowToolForm(false);
  };

  const editTool = (t) => {
    setToolForm({
      name: t.name, label: t.label, description: t.description,
      n8n_workflow_id: t.n8n_workflow_id,
      input_schema: t.input_schema ? JSON.stringify(t.input_schema, null, 2) : ''
    });
    setEditingToolId(t.id);
    setShowToolForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveTool = async () => {
    if (!toolForm.name || !toolForm.label || !toolForm.description || !toolForm.n8n_workflow_id) {
      alert('Nombre técnico, etiqueta, descripción e ID de workflow son obligatorios.');
      return;
    }
    let parsedSchema = null;
    if (toolForm.input_schema.trim()) {
      try { parsedSchema = JSON.parse(toolForm.input_schema); }
      catch { alert('El schema de parámetros no es JSON válido. Revísalo.'); return; }
    }
    setToolSaving(true);
    try {
      const body = { ...toolForm, input_schema: parsedSchema, tenantId };
      let res;
      if (editingToolId) {
        res = await fetch(`${API_URL}/api/agent-tools/${editingToolId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
      } else {
        res = await fetch(`${API_URL}/api/crm/campaigns/${selectedCam.id}/tools`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
      }
      if (res.ok) { resetToolForm(); loadTools(selectedCam.id); }
      else { const e = await res.json(); alert('Error: ' + e.error); }
    } catch (e) { alert('Error: ' + e.message); }
    finally { setToolSaving(false); }
  };

  const toggleTool = async (tool) => {
    try {
      await fetch(`${API_URL}/api/agent-tools/${tool.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !tool.is_active })
      });
      loadTools(selectedCam.id);
    } catch (e) { console.error(e); }
  };

  const deleteTool = async (id) => {
    if (!window.confirm('¿Eliminar esta herramienta? La IA dejará de poder ejecutarla.')) return;
    try {
      await fetch(`${API_URL}/api/agent-tools/${id}`, { method: 'DELETE' });
      loadTools(selectedCam.id);
    } catch (e) { console.error(e); }
  };

  if (loading) return <div style={{ color: c.subtitle }}>Cargando...</div>;

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 'bold', margin: '0 0 20px', color: c.title }}>Gestión de Campañas</h2>

      <div style={{ display: 'flex', gap: 20 }}>
        {/* ── Left: Lista + Crear ── */}
        <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: 16 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, color: c.title }}>Nueva Campaña</h3>
            <input placeholder="Nombre de campaña" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              style={{ ...inp, marginBottom: 8 }} />
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })}
                style={{ width: 40, height: 32, padding: 0, border: 'none', cursor: 'pointer', borderRadius: 8, flexShrink: 0 }} />
              <input placeholder="Descripción breve" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                style={{ ...inp, marginBottom: 0 }} />
            </div>
            <select value={form.ai_profile_id} onChange={e => setForm({ ...form, ai_profile_id: e.target.value })}
              style={{ ...inp, marginBottom: 12 }}>
              <option value="">Sin Perfil IA (Agente Genérico)</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <button onClick={handleCreate} disabled={!form.name}
              style={{ width: '100%', padding: '8px', background: form.name ? '#2563eb' : c.border, color: form.name ? '#fff' : c.subtitle, border: 'none', borderRadius: 8, cursor: form.name ? 'pointer' : 'not-allowed', fontWeight: 600 }}>
              + Crear Campaña
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h3 style={{ margin: '8px 0 4px', fontSize: 14, color: c.title }}>Campañas Creadas</h3>
            {campaigns.map(cam => (
              <div key={cam.id} onClick={() => setSelectedCam(cam)}
                style={{ padding: '12px 16px', background: selectedCam?.id === cam.id ? `${cam.color}15` : c.card, border: `1px solid ${selectedCam?.id === cam.id ? cam.color : c.border}`, borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className={`ti ${cam.icon}`} style={{ color: cam.color, fontSize: 18, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: selectedCam?.id === cam.id ? cam.color : c.title, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cam.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: c.subtitle }}>
                      {cam.campaign_agents?.length || 0} agentes
                      {cam.n8n_webhook_url ? ' · 🔗 n8n' : ''}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: Detalle de Campaña ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {selectedCam ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* ── Perfil IA ── */}
              <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: 20 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 16, color: c.title }}>Perfil de Inteligencia Artificial</h3>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: c.subtitle }}>Asigna un Perfil IA a esta campaña. Todos los canales asociados heredarán automáticamente el comportamiento de este perfil.</p>
                <select
                  value={selectedCam.ai_profile_id || ''}
                  onChange={e => {
                    const newId = e.target.value;
                    setSelectedCam({ ...selectedCam, ai_profile_id: newId });
                    updateCampaignProfile(selectedCam.id, newId);
                  }}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${c.border}`, background: c.inputBg, color: c.inputText, outline: 'none', fontSize: 14 }}>
                  <option value="">Sin Perfil IA (Agente Genérico por Defecto)</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.is_router ? '🤖 ' : ''}{p.label}</option>)}
                </select>
              </div>

              {/* ════ AGENTE AUTÓNOMO n8n ════ */}
              <div style={{ background: c.n8nBg, border: `2px solid ${c.n8nBorder}`, borderRadius: 12, padding: 20 }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #1D9E75, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className="ti ti-webhook" style={{ color: '#fff', fontSize: 20 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: 16, color: c.title }}>Agente Autónomo — n8n</h3>
                    <p style={{ margin: 0, fontSize: 12, color: c.subtitle }}>Conecta esta campaña a n8n para que la IA ejecute acciones reales (agendar citas, consultar sistemas, etc.)</p>
                  </div>
                  {n8nUrl && (
                    <span style={{
                      fontSize: 11, padding: '4px 12px', borderRadius: 20, fontWeight: 700,
                      background: n8nStatus === 'ok' ? '#1D9E7520' : n8nStatus === 'error' ? '#E24B4A20' : '#2563eb15',
                      color: n8nStatus === 'ok' ? '#1D9E75' : n8nStatus === 'error' ? '#E24B4A' : '#2563eb',
                      border: '1px solid currentColor'
                    }}>
                      {n8nStatus === 'ok' ? '🟢 Conectado' : n8nStatus === 'error' ? '🔴 Error de conexión' : '⚙️ Configurado'}
                    </span>
                  )}
                </div>

                {/* n8n URL + Test */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 8 }}>
                  <input
                    placeholder="URL base del servidor n8n (ej: https://n8n.kuden.cl)"
                    value={n8nUrl}
                    onChange={e => { setN8nUrl(e.target.value); setN8nStatus(null); }}
                    style={inp}
                  />
                  <button onClick={testN8nConnection} disabled={!n8nUrl || n8nTesting}
                    style={{ padding: '8px 16px', background: n8nStatus === 'ok' ? '#1D9E75' : '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', opacity: (!n8nUrl || n8nTesting) ? 0.6 : 1 }}>
                    {n8nTesting ? '⏳ Probando...' : '⚡ Probar'}
                  </button>
                </div>
                <input
                  placeholder={n8nHasToken ? '🔐 Token guardado — escribe uno nuevo para reemplazarlo' : 'Token secreto (opcional) — para autenticar las llamadas de Kuden → n8n'}
                  value={n8nToken}
                  onChange={e => setN8nToken(e.target.value)}
                  type="password"
                  style={{ ...inp, marginBottom: 12 }}
                />
                <button onClick={saveN8nConfig} disabled={n8nSaving}
                  style={{ padding: '9px 22px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                  {n8nSaving ? 'Guardando...' : '💾 Guardar configuración n8n'}
                </button>

                {/* ── Herramientas ── */}
                <div style={{ marginTop: 24, borderTop: `1px solid ${c.n8nBorder}`, paddingTop: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div>
                      <h4 style={{ margin: '0 0 2px', fontSize: 15, color: c.title }}>Herramientas del Agente</h4>
                      <p style={{ margin: 0, fontSize: 12, color: c.subtitle }}>Cada herramienta es una acción que la IA puede ejecutar autónomamente vía n8n.</p>
                    </div>
                    <button
                      onClick={() => { setShowToolForm(true); setEditingToolId(null); setToolForm({ name: '', label: '', description: '', n8n_workflow_id: '', input_schema: '' }); }}
                      style={{ padding: '7px 14px', background: '#534AB7', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 12, flexShrink: 0 }}>
                      + Nueva Herramienta
                    </button>
                  </div>

                  {/* Formulario de Tool */}
                  {showToolForm && (
                    <div style={{ background: isDark ? '#111' : '#fff', border: `1px solid ${editingToolId ? '#534AB7' : c.border}`, borderRadius: 10, padding: 16, marginBottom: 14 }}>
                      <h5 style={{ margin: '0 0 14px', fontSize: 14, color: c.title }}>
                        {editingToolId ? '✏️ Editar Herramienta' : '➕ Nueva Herramienta'}
                      </h5>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                        <div>
                          <label style={{ fontSize: 11, color: c.subtitle, display: 'block', marginBottom: 4 }}>Nombre técnico (sin espacios) *</label>
                          <input placeholder="ej: schedule_appointment" value={toolForm.name} onChange={e => setToolForm({ ...toolForm, name: e.target.value })} style={inp} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: c.subtitle, display: 'block', marginBottom: 4 }}>Etiqueta visible *</label>
                          <input placeholder="ej: Agendar Cita" value={toolForm.label} onChange={e => setToolForm({ ...toolForm, label: e.target.value })} style={inp} />
                        </div>
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 11, color: c.subtitle, display: 'block', marginBottom: 4 }}>Descripción — la IA la lee para saber cuándo usar esta herramienta *</label>
                        <input
                          placeholder="ej: Usar cuando el cliente quiera agendar una cita o reunión de forma explícita."
                          value={toolForm.description}
                          onChange={e => setToolForm({ ...toolForm, description: e.target.value })}
                          style={inp}
                        />
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 11, color: c.subtitle, display: 'block', marginBottom: 4 }}>ID del Webhook en n8n (path del workflow) *</label>
                        <input
                          placeholder="ej: kuden-schedule-appointment"
                          value={toolForm.n8n_workflow_id}
                          onChange={e => setToolForm({ ...toolForm, n8n_workflow_id: e.target.value })}
                          style={inp}
                        />
                        {n8nUrl && toolForm.n8n_workflow_id && (
                          <p style={{ margin: '4px 0 0', fontSize: 11, color: '#2563eb' }}>
                            → Llamará a: <code style={{ fontSize: 11 }}>{n8nUrl}/webhook/{toolForm.n8n_workflow_id}</code>
                          </p>
                        )}
                      </div>
                      <div style={{ marginBottom: 14 }}>
                        <label style={{ fontSize: 11, color: c.subtitle, display: 'block', marginBottom: 4 }}>Schema de parámetros (JSON) — lo que la IA debe extraer de la conversación</label>
                        <textarea
                          placeholder={'{\n  "contact_name": "string",\n  "date_preference": "string",\n  "service_type": "string"\n}'}
                          value={toolForm.input_schema}
                          onChange={e => setToolForm({ ...toolForm, input_schema: e.target.value })}
                          rows={5}
                          style={{ ...inp, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={saveTool} disabled={toolSaving}
                          style={{ padding: '8px 22px', background: '#534AB7', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                          {toolSaving ? 'Guardando...' : '💾 Guardar'}
                        </button>
                        <button onClick={resetToolForm}
                          style={{ padding: '8px 14px', background: 'transparent', color: c.subtitle, border: `1px solid ${c.border}`, borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Lista de Tools */}
                  {toolsLoading ? (
                    <p style={{ fontSize: 13, color: c.subtitle }}>Cargando herramientas...</p>
                  ) : tools.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px', border: `1px dashed ${c.n8nBorder}`, borderRadius: 10 }}>
                      <i className="ti ti-robot-off" style={{ fontSize: 30, color: c.subtitle, display: 'block', marginBottom: 8 }} />
                      <p style={{ margin: 0, fontSize: 13, color: c.subtitle }}>Sin herramientas configuradas. La IA solo responderá, no actuará en sistemas externos.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {tools.map(t => (
                        <div key={t.id} style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                          background: t.is_active ? (isDark ? '#0d1a0d' : '#f0fdf4') : (isDark ? '#111' : '#f9fafb'),
                          border: `1px solid ${t.is_active ? '#1D9E7540' : c.border}`,
                          borderRadius: 10, transition: 'all 0.2s'
                        }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: t.is_active ? '#1D9E7520' : `${c.border}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <i className="ti ti-bolt" style={{ color: t.is_active ? '#1D9E75' : c.subtitle, fontSize: 17 }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: t.is_active ? c.title : c.subtitle }}>{t.label}</p>
                            <p style={{ margin: '1px 0', fontSize: 11, color: c.subtitle, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.description}</p>
                            <code style={{ fontSize: 10, color: '#2563eb', opacity: 0.8 }}>/webhook/{t.n8n_workflow_id}</code>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <button onClick={() => toggleTool(t)} title={t.is_active ? 'Desactivar' : 'Activar'}
                              style={{ padding: '4px 10px', fontSize: 11, fontWeight: 700, border: 'none', borderRadius: 6, cursor: 'pointer', background: t.is_active ? '#1D9E7520' : '#2563eb15', color: t.is_active ? '#1D9E75' : '#2563eb' }}>
                              {t.is_active ? '● Activa' : '○ Inactiva'}
                            </button>
                            <button onClick={() => editTool(t)} title="Editar"
                              style={{ padding: '5px 9px', background: 'transparent', border: `1px solid ${c.border}`, borderRadius: 6, cursor: 'pointer', color: c.subtitle, fontSize: 13 }}>
                              <i className="ti ti-pencil" />
                            </button>
                            <button onClick={() => deleteTool(t.id)} title="Eliminar"
                              style={{ padding: '5px 9px', background: 'transparent', border: `1px solid #E24B4A40`, borderRadius: 6, cursor: 'pointer', color: '#E24B4A', fontSize: 13 }}>
                              <i className="ti ti-trash" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Tipificaciones ── */}
              <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 16, color: c.title }}>Tipificaciones (Cierres)</h3>
                  {templates.length > 0 && (
                    <select onChange={e => {
                      const t = templates.find(x => x.id === e.target.value);
                      if (t) applyTemplate(t);
                      e.target.value = "";
                    }} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${c.border}`, background: c.inputBg, color: c.inputText, outline: 'none', fontSize: 12 }}>
                      <option value="">Aplicar plantilla...</option>
                      {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <input placeholder="Nueva etiqueta de cierre..." value={newTypLabel} onChange={e => setNewTypLabel(e.target.value)}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${c.border}`, background: c.inputBg, color: c.inputText, outline: 'none', fontSize: 13 }}
                    onKeyDown={e => e.key === 'Enter' && addTypification(newTypLabel)} />
                  <button onClick={() => addTypification(newTypLabel)}
                    style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                    Añadir
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {typifications.length === 0 ? <p style={{ fontSize: 13, color: c.subtitle }}>No hay tipificaciones. Crea una o aplica una plantilla.</p> : null}
                  {typifications.map(typ => (
                    <div key={typ.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: `${selectedCam.color}15`, border: `1px solid ${selectedCam.color}40`, borderRadius: 20, color: selectedCam.color, fontSize: 12, fontWeight: 500 }}>
                      {typ.label}
                      <i className="ti ti-x" style={{ cursor: 'pointer', opacity: 0.7 }} onClick={() => removeTypification(typ.id)} />
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Agentes Asignados ── */}
              <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: 20 }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, color: c.title }}>Agentes Asignados</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ border: `1px solid ${c.border}`, borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ padding: '8px 12px', background: c.inputBg, borderBottom: `1px solid ${c.border}`, fontSize: 12, fontWeight: 600, color: c.subtitle }}>Usuarios disponibles</div>
                    <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                      {users.filter(u => !(selectedCam.campaign_agents || []).find(ca => ca.user_id === u.user_id)).map(u => (
                        <div key={u.user_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: `1px solid ${c.border}` }}>
                          <div>
                            <p style={{ margin: 0, fontSize: 13, color: c.title }}>{u.display_name || u.email}</p>
                            <p style={{ margin: 0, fontSize: 11, color: c.subtitle }}>{u.role}</p>
                          </div>
                          <button onClick={() => assignAgent(u.user_id)} style={{ padding: '4px 10px', fontSize: 11, background: '#1D9E7520', color: '#1D9E75', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Asignar</button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ border: `1px solid ${c.border}`, borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ padding: '8px 12px', background: `${selectedCam.color}15`, borderBottom: `1px solid ${c.border}`, fontSize: 12, fontWeight: 600, color: selectedCam.color }}>Agentes en campaña</div>
                    <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                      {(selectedCam.campaign_agents || []).map(ca => {
                        const user = users.find(u => u.user_id === ca.user_id);
                        if (!user) return null;
                        return (
                          <div key={ca.user_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: `1px solid ${c.border}` }}>
                            <p style={{ margin: 0, fontSize: 13, color: c.title }}>{user.display_name || user.email}</p>
                            <button onClick={() => removeAgent(user.user_id)} style={{ padding: '4px 10px', fontSize: 11, background: '#E24B4A20', color: '#E24B4A', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Quitar</button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, color: c.subtitle, minHeight: 240 }}>
              <div style={{ textAlign: 'center' }}>
                <i className="ti ti-arrow-left" style={{ fontSize: 28, display: 'block', marginBottom: 8, opacity: 0.5 }} />
                Selecciona una campaña para configurarla
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
