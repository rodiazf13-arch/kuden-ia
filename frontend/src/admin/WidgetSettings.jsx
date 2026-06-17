import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function WidgetSettings({ tenantId, isDark = true, inHub = false }) {
  const [widgets, setWidgets] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [isEditing, setIsEditing] = useState(false);
  const [currentWidget, setCurrentWidget] = useState(null);
  const [formData, setFormData] = useState({
    name: 'Asistente Virtual',
    color: '#2563eb',
    welcome_message: '¡Hola! ¿En qué podemos ayudarte?',
    campaign_id: '',
    is_active: true
  });

  // UI colors
  const c = {
    card: isDark ? '#111' : '#fff',
    border: isDark ? '#222' : '#e5e7eb',
    title: isDark ? '#fff' : '#111827',
    subtitle: isDark ? '#aaa' : '#6b7280',
    inputBg: isDark ? '#1a1a1a' : '#f9fafb',
    inputText: isDark ? '#fff' : '#111827',
  };

  useEffect(() => {
    if (tenantId) fetchData();
  }, [tenantId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const resW = await fetch(`${API_URL}/api/web_widgets?tenantId=${tenantId}`);
      if (resW.ok) setWidgets(await resW.json());
      
      const resC = await fetch(`${API_URL}/api/crm/campaigns?tenantId=${tenantId}`);
      if (resC.ok) setCampaigns(await resC.json());
    } catch (e) {
      console.error('Error cargando widgets:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (widget) => {
    setCurrentWidget(widget);
    setFormData({
      name: widget.name,
      color: widget.color,
      welcome_message: widget.welcome_message,
      campaign_id: widget.campaign_id || '',
      is_active: widget.is_active
    });
    setIsEditing(true);
  };

  const handleCreateNew = () => {
    setCurrentWidget(null);
    setFormData({
      name: 'Asistente Virtual',
      color: '#2563eb',
      welcome_message: '¡Hola! ¿En qué podemos ayudarte?',
      campaign_id: '',
      is_active: true
    });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setCurrentWidget(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        tenant_id: tenantId,
        campaign_id: formData.campaign_id || null
      };

      if (currentWidget) {
        await fetch(`${API_URL}/api/web_widgets/${currentWidget.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        await fetch(`${API_URL}/api/web_widgets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      setIsEditing(false);
      fetchData();
    } catch (e) {
      console.error('Error guardando widget:', e);
      alert('Error guardando configuración del widget');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Seguro que deseas eliminar este widget?")) return;
    try {
      await fetch(`${API_URL}/api/web_widgets/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (e) {
      console.error('Error eliminando widget:', e);
    }
  };

  const copyScript = (widget) => {
    const baseUrl = window.location.origin;
    const backendUrl = API_URL || window.location.origin;

    const scriptText = `<!-- Kuden IA Widget -->
<script>
  window.KudenWidgetInit = {
    tenantId: "${tenantId}",
    widgetId: "${widget.id}",
    apiUrl: "${backendUrl}"
  };
</script>
<script src="${baseUrl}/kuden-widget.js" defer></script>
<!-- End Kuden IA Widget -->`;

    navigator.clipboard.writeText(scriptText);
    alert('¡Código copiado al portapapeles! Pégalo en el <head> o antes del cierre del <body> en tu sitio web.');
  };

  if (loading) return <div style={{ color: c.subtitle }}>Cargando widgets...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: inHub ? 18 : 24, fontWeight: 'bold', margin: '0 0 4px', color: c.title }}>{inHub ? 'Widgets Web' : 'Panel de Widgets Web'}</h2>
          <p style={{ margin: 0, fontSize: inHub ? 13 : 14, color: c.subtitle }}>Configura y obtén el código para incrustar el chat en distintas páginas web.</p>
        </div>
        {!isEditing && (
          <button 
            onClick={handleCreateNew}
            style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <i className="ti ti-plus"></i> Nuevo Widget
          </button>
        )}
      </div>

      {isEditing ? (
        <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: 24, maxWidth: 600 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, color: c.title }}>{currentWidget ? 'Editar Widget' : 'Nuevo Widget'}</h3>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 6, color: c.subtitle }}>Nombre (Título del Chat)</label>
                <input 
                  type="text" 
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${c.border}`, background: c.inputBg, color: c.inputText, outline: 'none', boxSizing: 'border-box' }}
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 6, color: c.subtitle }}>Color Principal</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input 
                    type="color" 
                    style={{ width: 42, height: 42, padding: 0, border: 'none', borderRadius: 8, cursor: 'pointer' }}
                    value={formData.color}
                    onChange={(e) => setFormData({...formData, color: e.target.value})}
                  />
                  <input 
                    type="text" 
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: `1px solid ${c.border}`, background: c.inputBg, color: c.inputText, outline: 'none', boxSizing: 'border-box' }}
                    value={formData.color}
                    onChange={(e) => setFormData({...formData, color: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, marginBottom: 6, color: c.subtitle }}>Mensaje de Bienvenida</label>
              <input 
                type="text" 
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${c.border}`, background: c.inputBg, color: c.inputText, outline: 'none', boxSizing: 'border-box' }}
                value={formData.welcome_message}
                onChange={(e) => setFormData({...formData, welcome_message: e.target.value})}
              />
              <p style={{ margin: '4px 0 0', fontSize: 11, color: c.subtitle }}>Este mensaje será el primero que vea el cliente al abrir el chat.</p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, marginBottom: 6, color: c.subtitle }}>Asignar a Campaña (Opcional)</label>
              <select 
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${c.border}`, background: c.inputBg, color: c.inputText, outline: 'none', boxSizing: 'border-box' }}
                value={formData.campaign_id}
                onChange={(e) => setFormData({...formData, campaign_id: e.target.value})}
              >
                <option value="">Sin Campaña (General)</option>
                {campaigns.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: c.subtitle }}>Los tickets generados por este widget heredarán automáticamente esta campaña y sus tipificaciones.</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <input 
                type="checkbox" 
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                style={{ cursor: 'pointer', width: 16, height: 16 }}
              />
              <label htmlFor="is_active" style={{ fontSize: 14, color: c.title, cursor: 'pointer' }}>Widget Activo</label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
              <button 
                type="button" 
                onClick={handleCancel}
                style={{ padding: '8px 16px', background: 'transparent', color: c.subtitle, border: `1px solid ${c.border}`, borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}
              >
                Cancelar
              </button>
              <button 
                type="submit"
                style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}
              >
                Guardar Configuración
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {widgets.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 20px', background: c.card, border: `1px dashed ${c.border}`, borderRadius: 12 }}>
              <p style={{ color: c.subtitle, margin: 0 }}>No hay widgets configurados. ¡Crea el primero!</p>
            </div>
          ) : (
            widgets.map(w => (
              <div key={w.id} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ height: 6, width: '100%', backgroundColor: w.color }}></div>
                <div style={{ padding: 20, flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 'bold', color: c.title, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.name}</h3>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 12, fontWeight: 'bold', background: w.is_active ? '#1D9E7520' : '#e5e7eb', color: w.is_active ? '#1D9E75' : '#6b7280' }}>
                      {w.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  
                  <div style={{ fontSize: 13, color: c.subtitle, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div><strong style={{ color: c.title }}>Campaña:</strong> {w.campaigns ? w.campaigns.name : 'General'}</div>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><strong style={{ color: c.title }}>Mensaje:</strong> {w.welcome_message}</div>
                  </div>
                </div>
                
                <div style={{ padding: '12px 20px', borderTop: `1px solid ${c.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isDark ? '#1a1a1a' : '#f9fafb' }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button 
                      onClick={() => handleEdit(w)}
                      style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 13, fontWeight: 'bold', padding: 0 }}
                    >
                      Editar
                    </button>
                    <button 
                      onClick={() => handleDelete(w.id)}
                      style={{ background: 'none', border: 'none', color: '#E24B4A', cursor: 'pointer', fontSize: 13, fontWeight: 'bold', padding: 0 }}
                    >
                      Eliminar
                    </button>
                  </div>
                  <button 
                    onClick={() => copyScript(w)}
                    style={{ background: isDark ? '#54326d' : '#123683', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <i className="ti ti-copy"></i> Copiar Script
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
