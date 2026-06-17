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

      if (currentAccount) {
        await fetch(`${API_URL}/api/email_accounts/${currentAccount.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        await fetch(`${API_URL}/api/email_accounts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      setIsEditing(false);
      fetchData();
    } catch (e) {
      console.error('Error guardando cuenta de correo:', e);
      alert('Error guardando configuración de la cuenta');
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

  if (loading) return <div style={{ color: c.subtitle }}>Cargando cuentas de correo...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 'bold', margin: '0 0 4px', color: c.title }}>Cuentas de Correo (n8n Bridge)</h2>
          <p style={{ margin: 0, fontSize: 13, color: c.subtitle }}>Configura múltiples cuentas de correo y asócialas a campañas específicas.</p>
        </div>
        {!isEditing && (
          <button 
            onClick={handleCreateNew}
            style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <i className="ti ti-plus"></i> Nueva Cuenta
          </button>
        )}
      </div>

      {isEditing ? (
        <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: 24, maxWidth: 600 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, color: c.title }}>{currentAccount ? 'Editar Cuenta' : 'Nueva Cuenta'}</h3>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 6, color: c.subtitle }}>Nombre (Ej: Soporte)</label>
                <input 
                  type="text" 
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${c.border}`, background: c.inputBg, color: c.inputText, outline: 'none', boxSizing: 'border-box' }}
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 6, color: c.subtitle }}>Correo Electrónico</label>
                <input 
                  type="email" 
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${c.border}`, background: c.inputBg, color: c.inputText, outline: 'none', boxSizing: 'border-box' }}
                  value={formData.email_address}
                  onChange={(e) => setFormData({...formData, email_address: e.target.value})}
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, marginBottom: 6, color: c.subtitle }}>Outbound n8n Webhook URL</label>
              <input 
                type="url" 
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${c.border}`, background: c.inputBg, color: c.inputText, outline: 'none', boxSizing: 'border-box' }}
                value={formData.n8n_outbound_webhook}
                onChange={(e) => setFormData({...formData, n8n_outbound_webhook: e.target.value})}
                placeholder="https://n8n.kuden.cl/webhook/..."
                required
              />
              <p style={{ margin: '4px 0 0', fontSize: 11, color: c.subtitle }}>El webhook específico en n8n que despacha correos para esta cuenta.</p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, marginBottom: 6, color: c.subtitle }}>Asignar a Campaña</label>
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
              <p style={{ margin: '4px 0 0', fontSize: 11, color: c.subtitle }}>Los tickets que lleguen a este correo heredarán automáticamente esta campaña y la IA usará su contexto.</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <input 
                type="checkbox" 
                id="is_active_account"
                checked={formData.is_active}
                onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                style={{ cursor: 'pointer', width: 16, height: 16 }}
              />
              <label htmlFor="is_active_account" style={{ fontSize: 14, color: c.title, cursor: 'pointer' }}>Cuenta Activa</label>
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
                Guardar Cuenta
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {accounts.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 20px', background: c.card, border: `1px dashed ${c.border}`, borderRadius: 12 }}>
              <p style={{ color: c.subtitle, margin: 0 }}>No hay cuentas configuradas. ¡Añade tu primer correo de soporte!</p>
            </div>
          ) : (
            accounts.map(acc => (
              <div key={acc.id} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: 20, flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 'bold', color: c.title, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{acc.name}</h3>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 12, fontWeight: 'bold', background: acc.is_active ? '#1D9E7520' : '#e5e7eb', color: acc.is_active ? '#1D9E75' : '#6b7280' }}>
                      {acc.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  
                  <div style={{ fontSize: 13, color: c.subtitle, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><i className="ti ti-mail" style={{ color: '#3b82f6' }}></i> <strong style={{ color: c.title }}>{acc.email_address}</strong></div>
                    <div><strong style={{ color: c.title }}>Campaña:</strong> {acc.campaigns ? acc.campaigns.name : 'General'}</div>
                  </div>
                </div>
                
                <div style={{ padding: '12px 20px', borderTop: `1px solid ${c.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isDark ? '#1a1a1a' : '#f9fafb' }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button 
                      onClick={() => handleEdit(acc)}
                      style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 13, fontWeight: 'bold', padding: 0 }}
                    >
                      Editar
                    </button>
                    <button 
                      onClick={() => handleDelete(acc.id)}
                      style={{ background: 'none', border: 'none', color: '#E24B4A', cursor: 'pointer', fontSize: 13, fontWeight: 'bold', padding: 0 }}
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
