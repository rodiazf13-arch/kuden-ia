import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function CampaignsManager({ tenantId, isDark = true }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCam, setSelectedCam] = useState(null);

  // Users to assign
  const [users, setUsers] = useState([]);

  // Templates
  const [templates, setTemplates] = useState([]);

  // Profiles
  const [profiles, setProfiles] = useState([]);

  // States for selected campaign
  const [typifications, setTypifications] = useState([]);
  const [newTypLabel, setNewTypLabel] = useState('');

  // UI colors
  const c = {
    card: isDark ? '#111' : '#fff',
    border: isDark ? '#222' : '#e5e7eb',
    title: isDark ? '#fff' : '#111827',
    subtitle: isDark ? '#aaa' : '#6b7280',
    inputBg: isDark ? '#1a1a1a' : '#f9fafb',
    inputText: isDark ? '#fff' : '#111827',
  };

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

  useEffect(() => {
    if (tenantId) {
      Promise.all([loadCampaigns(), loadUsers(), loadTemplates(), loadProfiles()]).finally(() => setLoading(false));
    }
  }, [tenantId]);

  useEffect(() => {
    if (selectedCam) loadTypifications(selectedCam.id);
  }, [selectedCam]);

  // Create Campaign
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

  // Typifications
  const addTypification = async (label) => {
    if (!label.trim()) return;
    try {
      const res = await fetch(`${API_URL}/api/crm/campaigns/${selectedCam.id}/typifications`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, label })
      });
      if (res.ok) {
        setNewTypLabel('');
        loadTypifications(selectedCam.id);
      }
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
    for (const label of template.labels) {
      await addTypification(label);
    }
  };

  // Agents
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

  if (loading) return <div style={{ color: c.subtitle }}>Cargando...</div>;

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 'bold', margin: '0 0 20px', color: c.title }}>Gestión de Campañas</h2>

      <div style={{ display: 'flex', gap: 20 }}>
        {/* Left Column: Campaign List & Create */}
        <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: 16 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, color: c.title }}>Nueva Campaña</h3>
            <input placeholder="Nombre de campaña" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              style={{ width: '100%', padding: '8px 10px', marginBottom: 8, borderRadius: 8, border: `1px solid ${c.border}`, background: c.inputBg, color: c.inputText, outline: 'none', boxSizing: 'border-box', fontSize: 13 }} />
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })}
                style={{ width: 40, height: 32, padding: 0, border: 'none', cursor: 'pointer', borderRadius: 8 }} />
              <input placeholder="Descripción breve" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: `1px solid ${c.border}`, background: c.inputBg, color: c.inputText, outline: 'none', boxSizing: 'border-box', fontSize: 13 }} />
            </div>
            <select value={form.ai_profile_id} onChange={e => setForm({ ...form, ai_profile_id: e.target.value })}
              style={{ width: '100%', padding: '8px 10px', marginBottom: 12, borderRadius: 8, border: `1px solid ${c.border}`, background: c.inputBg, color: c.inputText, outline: 'none', boxSizing: 'border-box', fontSize: 13 }}>
              <option value="">Sin Perfil IA (Agente Genérico)</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <button onClick={handleCreate} disabled={!form.name}
              style={{ width: '100%', padding: '8px', background: form.name ? '#2563eb' : c.border, color: form.name ? '#fff' : c.subtitle, border: 'none', borderRadius: 8, cursor: form.name ? 'pointer' : 'not-allowed', fontWeight: 600 }}>
              + Crear Campaña
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {campaigns.map(cam => (
              <div key={cam.id} onClick={() => setSelectedCam(cam)}
                style={{ padding: '12px 16px', background: selectedCam?.id === cam.id ? `${cam.color}15` : c.card, border: `1px solid ${selectedCam?.id === cam.id ? cam.color : c.border}`, borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className={`ti ${cam.icon}`} style={{ color: cam.color, fontSize: 18 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: selectedCam?.id === cam.id ? cam.color : c.title }}>{cam.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: c.subtitle }}>{cam.campaign_agents?.length || 0} agentes asignados</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Campaign Details */}
        <div style={{ flex: 1 }}>
          {selectedCam ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* IA Profile Assignment */}
              <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: 20 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 16, color: c.title }}>Perfil de Inteligencia Artificial (Agente)</h3>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: c.subtitle }}>Asigna un Perfil IA a esta campaña. Todos los canales (Widgets, WhatsApp) asociados a esta campaña heredarán automáticamente el comportamiento de este perfil.</p>
                <select 
                  value={selectedCam.ai_profile_id || ''} 
                  onChange={e => {
                    const newId = e.target.value;
                    setSelectedCam({ ...selectedCam, ai_profile_id: newId });
                    updateCampaignProfile(selectedCam.id, newId);
                  }}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${c.border}`, background: c.inputBg, color: c.inputText, outline: 'none', fontSize: 14 }}>
                  <option value="">Sin Perfil IA (Agente Genérico por Defecto)</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>

              {/* Tipificaciones */}
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

              {/* Agentes Asignados */}
              <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: 20 }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, color: c.title }}>Agentes Asignados</h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {/* Lista de usuarios para asignar */}
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

                  {/* Agentes actualmente asignados */}
                  <div style={{ border: `1px solid ${c.border}`, borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ padding: '8px 12px', background: `${selectedCam.color}15`, borderBottom: `1px solid ${c.border}`, fontSize: 12, fontWeight: 600, color: selectedCam.color }}>Agentes en campaña</div>
                    <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                      {(selectedCam.campaign_agents || []).map(ca => {
                        const user = users.find(u => u.user_id === ca.user_id);
                        if (!user) return null;
                        return (
                          <div key={ca.user_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: `1px solid ${c.border}` }}>
                            <div>
                              <p style={{ margin: 0, fontSize: 13, color: c.title }}>{user.display_name || user.email}</p>
                            </div>
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
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, color: c.subtitle }}>
              Selecciona una campaña para configurarla
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
