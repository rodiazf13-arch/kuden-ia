import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function EmailAccountsManager({ tenantId, isDark = true }) {
  const [accounts, setAccounts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [isEditing, setIsEditing] = useState(false);
  const [currentAccount, setCurrentAccount] = useState(null);
  const [formData, setFormData] = useState({
    name: 'Soporte',
    email_address: 'soporte@miempresa.com',
    n8n_outbound_webhook: '',
    campaign_id: '',
    is_active: true
  });


  useEffect(() => {
    if (tenantId) fetchData();
  }, [tenantId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const resA = await fetch(`${API_URL}/api/email_accounts?tenantId=${tenantId}`);
      if (resA.ok) setAccounts(await resA.json());
      
      const resC = await fetch(`${API_URL}/api/crm/campaigns?tenantId=${tenantId}`);
      if (resC.ok) setCampaigns(await resC.json());
    } catch (e) {
      console.error('Error cargando email accounts:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (account) => {
    setCurrentAccount(account);
    setFormData({
      name: account.name || '',
      email_address: account.email_address,
      n8n_outbound_webhook: account.n8n_outbound_webhook || '',
      campaign_id: account.campaign_id || '',
      is_active: account.is_active
    });
    setIsEditing(true);
  };

  const handleCreateNew = () => {
    setCurrentAccount(null);
    setFormData({
      name: 'Soporte',
      email_address: 'soporte@miempresa.com',
      n8n_outbound_webhook: '',
      campaign_id: '',
      is_active: true
    });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setCurrentAccount(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        tenant_id: tenantId,
        campaign_id: formData.campaign_id || null
      };

      let res;
      if (currentAccount) {
        res = await fetch(`${API_URL}/api/email_accounts/${currentAccount.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`${API_URL}/api/email_accounts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Error al guardar');
      }

      setIsEditing(false);
      fetchData();
    } catch (e) {
      console.error('Error guardando cuenta de correo:', e);
      alert('Error guardando configuración de la cuenta: ' + e.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta cuenta de correo?")) return;
    try {
      await fetch(`${API_URL}/api/email_accounts/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (e) {
      console.error('Error eliminando cuenta:', e);
    }
  };

  if (loading) return <div className="integration-section-subtitle">Cargando cuentas de correo...</div>;

  return (
    <div>
      <div className="integration-section-header">
        <div>
          <h2 className="integration-section-title">Cuentas de Correo (n8n Bridge)</h2>
          <p className="integration-section-subtitle">Configura múltiples cuentas de correo y asócialas a campañas específicas.</p>
        </div>
        {!isEditing && (
          <button 
            onClick={handleCreateNew}
            className="integration-btn-primary"
          >
            <i className="ti ti-plus"></i> Nueva Cuenta
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="integration-form-card">
          <h3 className="integration-form-title">{currentAccount ? 'Editar Cuenta' : 'Nueva Cuenta'}</h3>
          <form onSubmit={handleSave} className="integration-form">
            
            <div className="integration-form-row">
              <div className="integration-form-group">
                <label className="integration-form-label">Nombre (Ej: Soporte)</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>

              <div className="integration-form-group">
                <label className="integration-form-label">Correo Electrónico</label>
                <input 
                  type="email" 
                  value={formData.email_address}
                  onChange={(e) => setFormData({...formData, email_address: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="integration-form-group">
              <label className="integration-form-label">Outbound n8n Webhook URL</label>
              <input 
                type="url" 
                value={formData.n8n_outbound_webhook}
                onChange={(e) => setFormData({...formData, n8n_outbound_webhook: e.target.value})}
                placeholder="https://n8n.kuden.cl/webhook/..."
                required
              />
              <p className="integration-form-help">El webhook específico en n8n que despacha correos para esta cuenta.</p>
            </div>

            <div className="integration-form-group">
              <label className="integration-form-label">Asignar a Campaña</label>
              <select 
                value={formData.campaign_id}
                onChange={(e) => setFormData({...formData, campaign_id: e.target.value})}
              >
                <option value="">Sin Campaña (General)</option>
                {campaigns.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <p className="integration-form-help">Los tickets que lleguen a este correo heredarán automáticamente esta campaña y la IA usará su contexto.</p>
            </div>

            <div className="integration-form-checkbox-container">
              <input 
                type="checkbox" 
                id="is_active_account"
                checked={formData.is_active}
                onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
              />
              <label htmlFor="is_active_account">Cuenta Activa</label>
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
                Guardar Cuenta
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="integration-grid-container">
          {accounts.length === 0 ? (
            <div className="integration-empty-state">
              <p>No hay cuentas configuradas. ¡Añade tu primer correo de soporte!</p>
            </div>
          ) : (
            accounts.map(acc => (
              <div key={acc.id} className="integration-item-card">
                <div className="integration-item-card-body">
                  <div className="integration-item-card-title-row">
                    <h3 className="integration-item-card-title">{acc.name}</h3>
                    <span className={`integration-item-badge ${acc.is_active ? 'active' : 'inactive'}`}>
                      {acc.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  
                  <div className="integration-item-card-details">
                    <div className="integration-item-card-detail-item">
                      <i className="ti ti-mail" style={{ color: 'var(--color-primary)' }}></i>
                      <strong>{acc.email_address}</strong>
                    </div>
                    <div>
                      <strong>Campaña:</strong> {acc.campaigns ? acc.campaigns.name : 'General'}
                    </div>
                  </div>
                </div>
                
                <div className="integration-item-card-footer">
                  <div className="integration-item-card-actions">
                    <button 
                      onClick={() => handleEdit(acc)}
                      className="integration-btn-link"
                    >
                      Editar
                    </button>
                    <button 
                      onClick={() => handleDelete(acc.id)}
                      className="integration-btn-danger"
                    >
                      Eliminar
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
