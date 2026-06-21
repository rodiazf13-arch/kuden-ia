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

  // ─── SLA state ───────────────────────────────────────────────────────────────
  const [slaWarning, setSlaWarning] = useState(15);
  const [slaDanger, setSlaDanger] = useState(30);

  // ─── n8n + Tools state ───────────────────────────────────────────────────────
  const [n8nUrl, setN8nUrl] = useState('');
  const [n8nStageWebhookId, setN8nStageWebhookId] = useState('');
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
        setN8nStageWebhookId(data.n8n_stage_change_webhook_id || '');
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
      setSlaWarning(selectedCam.sla_warning_minutes ?? 15);
      setSlaDanger(selectedCam.sla_danger_minutes ?? 30);
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

  const updateCampaignSLA = async (campaignId, warningMinutes, dangerMinutes) => {
    try {
      const res = await fetch(`${API_URL}/api/crm/campaigns/${campaignId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, sla_warning_minutes: warningMinutes, sla_danger_minutes: dangerMinutes })
      });
      if (res.ok) {
        alert('Tiempos SLA guardados correctamente.');
        loadCampaigns();
      }
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

  const moveTypification = (index, direction) => {
    const newTyps = [...typifications];
    if (direction === 'up' && index > 0) {
      const temp = newTyps[index];
      newTyps[index] = newTyps[index - 1];
      newTyps[index - 1] = temp;
      setTypifications(newTyps);
    } else if (direction === 'down' && index < newTyps.length - 1) {
      const temp = newTyps[index];
      newTyps[index] = newTyps[index + 1];
      newTyps[index + 1] = temp;
      setTypifications(newTyps);
    }
  };

  const saveTypificationOrder = async () => {
    try {
      const payload = typifications.map((t, index) => ({ id: t.id, order_index: index }));
      const res = await fetch(`${API_URL}/api/crm/campaigns/${selectedCam.id}/typifications/reorder`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ typifications: payload })
      });
      if (res.ok) {
        alert('Orden guardado correctamente');
        loadTypifications(selectedCam.id);
      } else {
        alert('Error al guardar el orden');
      }
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
      const body = { n8n_webhook_url: n8nUrl, n8n_stage_change_webhook_id: n8nStageWebhookId };
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

  if (loading) return <div className="integration-section-subtitle">Cargando...</div>;

  return (
    <div>
      <h2 className="campaigns-page-title">Gestión de Campañas</h2>

      <div className="campaigns-manager-wrapper">
        {/* ── Left: Lista + Crear ── */}
        <div className="campaigns-sidebar">
          <div className="campaigns-sidebar-card">
            <h3>Nueva Campaña</h3>
            <input placeholder="Nombre de campaña" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <input placeholder="Descripción breve (opcional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            <div className="campaign-color-row">
              <label className="integration-form-label">Color de campaña</label>
              <input type="color" className="integration-color-picker-input-color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} />
            </div>
            <select value={form.ai_profile_id} onChange={e => setForm({ ...form, ai_profile_id: e.target.value })}>
              <option value="">Sin Perfil IA (Agente Genérico)</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <button onClick={handleCreate} disabled={!form.name} className="integration-btn-primary">
              + Crear Campaña
            </button>
          </div>

          <div className="campaigns-list-container">
            <h3>Campañas Creadas</h3>
            {campaigns.map(cam => {
              const isActive = selectedCam?.id === cam.id;
              return (
                <div key={cam.id} onClick={() => setSelectedCam(cam)}
                  className="campaign-list-item"
                  style={{ 
                    background: isActive ? `color-mix(in srgb, ${cam.color} 15%, transparent)` : undefined, 
                    borderColor: isActive ? cam.color : undefined 
                  }}>
                  <div className="campaign-list-item-content">
                    <i className={`ti ${cam.icon} campaign-list-item-icon`} style={{ color: cam.color }} />
                    <div className="campaign-list-item-info">
                      <p className="campaign-list-item-title" style={{ color: isActive ? cam.color : undefined }}>{cam.name}</p>
                      <p className="campaign-list-item-subtitle">
                        {cam.campaign_agents?.length || 0} agentes
                        {cam.n8n_webhook_url ? ' · 🔗 n8n' : ''}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right: Detalle de Campaña ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {selectedCam ? (
            <div className="campaigns-detail-content">

              {/* ── Cabecera de Campaña ── */}
              <div className="campaign-detail-header-card" style={{ '--color-brand': selectedCam.color }}>
                <div className="campaign-detail-header-icon">
                  <i className={`ti ${selectedCam.icon || 'ti-speakerphone'}`} />
                </div>
                <div>
                  <h2 className="campaign-detail-header-title">{selectedCam.name}</h2>
                  {selectedCam.description && (
                    <p className="campaign-detail-header-desc">{selectedCam.description}</p>
                  )}
                </div>
              </div>

              {/* ── Perfil IA ── */}
              <div className="campaign-detail-card">
                <h3>Perfil de Inteligencia Artificial</h3>
                <p className="integration-section-subtitle">Asigna un Perfil IA a esta campaña. Todos los canales asociados heredarán automáticamente el comportamiento de este perfil.</p>
                <select
                  value={selectedCam.ai_profile_id || ''}
                  onChange={e => {
                    const newId = e.target.value;
                    setSelectedCam({ ...selectedCam, ai_profile_id: newId });
                    updateCampaignProfile(selectedCam.id, newId);
                  }}>
                  <option value="">Sin Perfil IA (Agente Genérico por Defecto)</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.is_router ? '🤖 ' : ''}{p.label}</option>)}
                </select>
              </div>

              {/* ── SLA Config ── */}
              <div className="campaign-detail-card">
                <h3>Configuración de SLA (Tiempos de Respuesta)</h3>
                <p className="integration-section-subtitle">Define los umbrales en minutos para que los tickets cambien de color alertando sobre demoras en la atención humana.</p>
                
                <div className="integration-form-row">
                  <div className="integration-form-group">
                    <label className="integration-form-label">🟡 Advertencia (minutos)</label>
                    <input type="number" min="1" value={slaWarning} onChange={e => setSlaWarning(parseInt(e.target.value) || 0)} />
                  </div>
                  <div className="integration-form-group">
                    <label className="integration-form-label">🔴 Peligro (minutos)</label>
                    <input type="number" min="2" value={slaDanger} onChange={e => setSlaDanger(parseInt(e.target.value) || 0)} />
                  </div>
                </div>
                
                <button 
                  onClick={() => {
                    const selectedIndex = campaigns.findIndex(cam => cam.id === selectedCam.id);
                    if (selectedIndex > -1) {
                      const newCamps = [...campaigns];
                      newCamps[selectedIndex].sla_warning_minutes = slaWarning;
                      newCamps[selectedIndex].sla_danger_minutes = slaDanger;
                      setSelectedCam(newCamps[selectedIndex]);
                      setCampaigns(newCamps);
                    }
                    updateCampaignSLA(selectedCam.id, slaWarning, slaDanger);
                  }}
                  className="integration-btn-primary">
                  💾 Guardar SLA
                </button>
              </div>

              {/* ════ AGENTE AUTÓNOMO n8n ════ */}
              <div className="campaign-n8n-card">
                {/* Header */}
                <div className="campaign-n8n-header">
                  <div className="campaign-n8n-icon-wrapper">
                    <i className="ti ti-webhook" />
                  </div>
                  <div className="campaign-n8n-title-wrapper">
                    <h3>Agente Autónomo — n8n</h3>
                    <p>Conecta esta campaña a n8n para que la IA ejecute acciones reales (agendar citas, consultar sistemas, etc.)</p>
                  </div>
                  {n8nUrl && (
                    <span className={`campaign-n8n-status-badge ${n8nStatus === 'ok' ? 'ok' : n8nStatus === 'error' ? 'error' : 'configured'}`}>
                      {n8nStatus === 'ok' ? '🟢 Conectado' : n8nStatus === 'error' ? '🔴 Error de conexión' : '⚙️ Configurado'}
                    </span>
                  )}
                </div>

                {/* n8n URL + Test */}
                <div className="integration-banner-row">
                  <input
                    placeholder="URL base del servidor n8n (ej: https://n8n.kuden.cl)"
                    value={n8nUrl}
                    onChange={e => { setN8nUrl(e.target.value); setN8nStatus(null); }}
                  />
                  <button onClick={testN8nConnection} disabled={!n8nUrl || n8nTesting} className="integration-btn-primary">
                    {n8nTesting ? '⏳ Probando...' : '⚡ Probar'}
                  </button>
                </div>
                <div className="integration-form-row">
                  <div className="integration-form-group">
                    <input
                      placeholder="ID Webhook para Cambio de Etapa (ej: 1234-abcd)"
                      value={n8nStageWebhookId}
                      onChange={e => setN8nStageWebhookId(e.target.value)}
                    />
                  </div>
                  <div className="integration-form-group">
                    <input
                      placeholder={n8nHasToken ? '🔐 Token guardado — nuevo lo reemplaza' : 'Token secreto (opcional)'}
                      value={n8nToken}
                      onChange={e => setN8nToken(e.target.value)}
                      type="password"
                    />
                  </div>
                </div>
                <button onClick={saveN8nConfig} disabled={n8nSaving} className="integration-btn-primary campaign-n8n-save-btn">
                  {n8nSaving ? 'Guardando...' : '💾 Guardar configuración n8n'}
                </button>

                {/* ── Herramientas ── */}
                <div className="campaign-n8n-tools-section">
                  <div className="campaign-n8n-tools-header">
                    <div>
                      <h4>Herramientas del Agente</h4>
                      <p>Cada herramienta es una acción que la IA puede ejecutar autónomamente vía n8n.</p>
                    </div>
                    <button
                      onClick={() => { setShowToolForm(true); setEditingToolId(null); setToolForm({ name: '', label: '', description: '', n8n_workflow_id: '', input_schema: '' }); }}
                      className="integration-btn-primary"
                    >
                      + Nueva Herramienta
                    </button>
                  </div>

                  {/* Formulario de Tool */}
                  {showToolForm && (
                    <div className="integration-form-card campaign-tool-form-card" style={{ borderColor: editingToolId ? 'var(--color-primary)' : undefined }}>
                      <h5>
                        {editingToolId ? '✏️ Editar Herramienta' : '➕ Nueva Herramienta'}
                      </h5>
                      <div className="integration-form-row">
                        <div className="integration-form-group">
                          <label className="integration-form-label">Nombre técnico (sin espacios) *</label>
                          <input placeholder="ej: schedule_appointment" value={toolForm.name} onChange={e => setToolForm({ ...toolForm, name: e.target.value })} />
                        </div>
                        <div className="integration-form-group">
                          <label className="integration-form-label">Etiqueta visible *</label>
                          <input placeholder="ej: Agendar Cita" value={toolForm.label} onChange={e => setToolForm({ ...toolForm, label: e.target.value })} />
                        </div>
                      </div>
                      <div className="integration-form-group">
                        <label className="integration-form-label">Descripción — la IA la lee para saber cuándo usar esta herramienta *</label>
                        <input
                          placeholder="ej: Usar cuando el cliente quiera agendar una cita o reunión de forma explícita."
                          value={toolForm.description}
                          onChange={e => setToolForm({ ...toolForm, description: e.target.value })}
                        />
                      </div>
                      <div className="integration-form-group">
                        <label className="integration-form-label">ID del Webhook en n8n (path del workflow) *</label>
                        <input
                          placeholder="ej: kuden-schedule-appointment"
                          value={toolForm.n8n_workflow_id}
                          onChange={e => setToolForm({ ...toolForm, n8n_workflow_id: e.target.value })}
                        />
                        {n8nUrl && toolForm.n8n_workflow_id && (
                          <p className="campaign-tool-form-help">
                            → Llamará a: <code>{n8nUrl}/webhook/{toolForm.n8n_workflow_id}</code>
                          </p>
                        )}
                      </div>
                      <div className="integration-form-group">
                        <label className="integration-form-label">Schema de parámetros (JSON) — lo que la IA debe extraer de la conversación</label>
                        <textarea
                          placeholder={'{\n  "contact_name": "string",\n  "date_preference": "string",\n  "service_type": "string"\n}'}
                          value={toolForm.input_schema}
                          onChange={e => setToolForm({ ...toolForm, input_schema: e.target.value })}
                          rows={5}
                        />
                      </div>
                      <div className="campaign-tool-form-actions">
                        <button onClick={saveTool} disabled={toolSaving} className="integration-btn-primary">
                          {toolSaving ? 'Guardando...' : '💾 Guardar'}
                        </button>
                        <button onClick={resetToolForm} className="integration-btn-secondary">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Lista de Tools */}
                  {toolsLoading ? (
                    <p className="integration-section-subtitle">Cargando herramientas...</p>
                  ) : tools.length === 0 ? (
                    <div className="agent-tools-empty-state">
                      <i className="ti ti-robot-off" />
                      <p>Sin herramientas configuradas. La IA solo responderá, no actuará en sistemas externos.</p>
                    </div>
                  ) : (
                    <div className="agent-tools-list">
                      {tools.map(t => (
                        <div key={t.id} className={`agent-tool-item ${t.is_active ? 'active' : 'inactive'}`}>
                          <div className={`agent-tool-icon-container ${t.is_active ? 'active' : 'inactive'}`}>
                            <i className="ti ti-bolt" style={{ fontSize: 17 }} />
                          </div>
                          <div className="agent-tool-details">
                            <p className="agent-tool-title">{t.label}</p>
                            <p className="agent-tool-description">{t.description}</p>
                            <code className="agent-tool-code">/webhook/{t.n8n_workflow_id}</code>
                          </div>
                          <div className="agent-tool-actions">
                            <button onClick={() => toggleTool(t)} title={t.is_active ? 'Desactivar' : 'Activar'}
                              className={`integration-item-badge ${t.is_active ? 'active' : 'inactive'}`}
                              style={{ border: 'none', cursor: 'pointer' }}>
                              {t.is_active ? '● Activa' : '○ Inactiva'}
                            </button>
                            <button onClick={() => editTool(t)} title="Editar" className="integration-btn-secondary">
                              <i className="ti ti-pencil" />
                            </button>
                            <button onClick={() => deleteTool(t.id)} title="Eliminar" className="integration-btn-secondary btn-delete">
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
              <div className="campaign-detail-card">
                <div className="campaign-typifications-header">
                  <h3>Tipificaciones (Cierres)</h3>
                  {templates.length > 0 && (
                    <select onChange={e => {
                      const t = templates.find(x => x.id === e.target.value);
                      if (t) applyTemplate(t);
                      e.target.value = "";
                    }}>
                      <option value="">Aplicar plantilla...</option>
                      {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  )}
                </div>
                <div className="campaign-typifications-form">
                  <input placeholder="Nueva etiqueta de cierre..." value={newTypLabel} onChange={e => setNewTypLabel(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addTypification(newTypLabel)} />
                  <button onClick={() => addTypification(newTypLabel)} className="integration-btn-primary">
                    Añadir
                  </button>
                </div>
                <div className="campaign-typifications-list">
                  {typifications.length === 0 ? <p className="integration-section-subtitle">No hay tipificaciones. Crea una o aplica una plantilla.</p> : null}
                  {typifications.map((typ, idx) => (
                    <div 
                      key={typ.id} 
                      className="typification-item"
                      style={{ 
                        background: `color-mix(in srgb, ${selectedCam.color} 12%, transparent)`, 
                        border: `1px solid color-mix(in srgb, ${selectedCam.color} 30%, transparent)`, 
                        color: selectedCam.color 
                      }}
                    >
                      <div className="typification-item-label">
                        <span className="typification-item-number">{idx + 1}.</span>
                        {typ.label}
                      </div>
                      <div className="typification-item-actions">
                        <button onClick={() => moveTypification(idx, 'up')} disabled={idx === 0} className="typification-action-btn" style={{ color: selectedCam.color }}><i className="ti ti-arrow-up" /></button>
                        <button onClick={() => moveTypification(idx, 'down')} disabled={idx === typifications.length - 1} className="typification-action-btn" style={{ color: selectedCam.color }}><i className="ti ti-arrow-down" /></button>
                        <i className="ti ti-trash typification-delete-icon" onClick={() => removeTypification(typ.id)} />
                      </div>
                    </div>
                  ))}
                  {typifications.length > 1 && (
                    <button onClick={saveTypificationOrder} className="integration-btn-primary" style={{ alignSelf: 'flex-end', background: selectedCam.color }}>
                      💾 Guardar Orden
                    </button>
                  )}
                </div>
              </div>

              {/* ── Agentes Asignados ── */}
              <div className="campaign-detail-card">
                <h3>Agentes Asignados</h3>
                <div className="agents-split-grid">
                  <div className="agents-list-card">
                    <div className="agents-list-header available">Usuarios disponibles</div>
                    <div className="agents-list-scroll">
                      {users.filter(u => !(selectedCam.campaign_agents || []).find(ca => ca.user_id === u.user_id)).map(u => (
                        <div key={u.user_id} className="agent-assignment-row">
                          <div className="agent-assignment-info">
                            <p>{u.display_name || u.email}</p>
                            <p>{u.role}</p>
                          </div>
                          <button onClick={() => assignAgent(u.user_id)} className="integration-btn-primary agent-assign-btn">Asignar</button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="agents-list-card">
                    <div className="agents-list-header assigned" style={{ '--color-brand': selectedCam.color }}>Agentes en campaña</div>
                    <div className="agents-list-scroll">
                      {(selectedCam.campaign_agents || []).map(ca => {
                        const user = users.find(u => u.user_id === ca.user_id);
                        if (!user) return null;
                        return (
                          <div key={ca.user_id} className="agent-assignment-row">
                            <div className="agent-assignment-info">
                              <p>{user.display_name || user.email}</p>
                            </div>
                            <button onClick={() => removeAgent(user.user_id)} className="integration-btn-primary agent-remove-btn">Quitar</button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div className="campaign-detail-card-empty">
              <div>
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
