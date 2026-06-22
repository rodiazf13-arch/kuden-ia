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

  const testWidget = (widget) => {
    const backendUrl = API_URL || window.location.origin;
    const testUrl = `/test-widget.html?tenantId=${tenantId}&widgetId=${widget.id}&apiUrl=${encodeURIComponent(backendUrl)}`;
    window.open(testUrl, '_blank');
  };

  if (loading) return <div className="integration-section-subtitle">Cargando widgets...</div>;

  return (
    <div>
      <div className="integration-section-header">
        <div>
          <h2 className="integration-section-title" style={{ fontSize: inHub ? 18 : 24 }}>{inHub ? 'Widgets Web' : 'Panel de Widgets Web'}</h2>
          <p className="integration-section-subtitle" style={{ fontSize: inHub ? 13 : 14 }}>Configura y obtén el código para incrustar el chat en distintas páginas web.</p>
        </div>
        {!isEditing && (
          <button 
            onClick={handleCreateNew}
            className="integration-btn-primary"
          >
            <i className="ti ti-plus"></i> Nuevo Widget
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="integration-form-card">
          <h3 className="integration-form-title">{currentWidget ? 'Editar Widget' : 'Nuevo Widget'}</h3>
          <form onSubmit={handleSave} className="integration-form">
            
            <div className="integration-form-row">
              <div className="integration-form-group">
                <label className="integration-form-label">Nombre (Título del Chat)</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>

              <div className="integration-form-group">
                <label className="integration-form-label">Color Principal</label>
                <div className="integration-color-picker-container">
                  <input 
                    type="color" 
                    className="integration-color-picker-input-color"
                    value={formData.color}
                    onChange={(e) => setFormData({...formData, color: e.target.value})}
                  />
                  <input 
                    type="text" 
                    style={{ flex: 1 }}
                    value={formData.color}
                    onChange={(e) => setFormData({...formData, color: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="integration-form-group">
              <label className="integration-form-label">Mensaje de Bienvenida</label>
              <input 
                type="text" 
                value={formData.welcome_message}
                onChange={(e) => setFormData({...formData, welcome_message: e.target.value})}
              />
              <p className="integration-form-help">Este mensaje será el primero que vea el cliente al abrir el chat.</p>
            </div>

            <div className="integration-form-group">
              <label className="integration-form-label">Asignar a Campaña (Opcional)</label>
              <select 
                value={formData.campaign_id}
                onChange={(e) => setFormData({...formData, campaign_id: e.target.value})}
              >
                <option value="">Sin Campaña (General)</option>
                {campaigns.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <p className="integration-form-help">Los tickets generados por este widget heredarán automáticamente esta campaña y sus tipificaciones.</p>
            </div>

            <div className="integration-form-checkbox-container">
              <input 
                type="checkbox" 
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
              />
              <label htmlFor="is_active">Widget Activo</label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
              <button 
                type="button" 
                onClick={handleCancel}
                className="integration-btn-secondary"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                className="integration-btn-primary"
              >
                Guardar Configuración
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="integration-grid-container">
          {widgets.length === 0 ? (
            <div className="integration-empty-state">
              <p>No hay widgets configurados. ¡Crea el primero!</p>
            </div>
          ) : (
            widgets.map(w => (
              <div key={w.id} className="integration-item-card">
                <div className="integration-item-card-color-stripe" style={{ backgroundColor: w.color }}></div>
                <div className="integration-item-card-body">
                  <div className="integration-item-card-title-row">
                    <h3 className="integration-item-card-title">{w.name}</h3>
                    <span className={`integration-item-badge ${w.is_active ? 'active' : 'inactive'}`}>
                      {w.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  
                  <div className="integration-item-card-details">
                    <div><strong>Campaña:</strong> {w.campaigns ? w.campaigns.name : 'General'}</div>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <strong>Mensaje:</strong> {w.welcome_message}
                    </div>
                  </div>
                </div>
                
                <div className="integration-item-card-footer">
                  <div className="integration-item-card-actions">
                    <button 
                      onClick={() => handleEdit(w)}
                      className="integration-btn-link"
                    >
                      Editar
                    </button>
                    <button 
                      onClick={() => handleDelete(w.id)}
                      className="integration-btn-danger"
                    >
                      Eliminar
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => testWidget(w)}
                      className="integration-btn-secondary"
                    >
                      <i className="ti ti-external-link"></i> Probar
                    </button>
                    <button 
                      onClick={() => copyScript(w)}
                      className="integration-btn-primary"
                    >
                      <i className="ti ti-copy"></i> Copiar Script
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
