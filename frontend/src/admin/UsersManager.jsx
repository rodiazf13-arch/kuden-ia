import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function UsersManager({ isDark = true, filterTenantId = null, isSuperAdmin = false }) {
  const [tenantUsers, setTenantUsers] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedTenant, setSelectedTenant] = useState(filterTenantId || '');
  const [role, setRole] = useState('agent');
  const [copilotAccess, setCopilotAccess] = useState(false);
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'groups'
  const [groups, setGroups] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  
  // Edit states for Users
  const [editingUser, setEditingUser] = useState(null);
  const [editRole, setEditRole] = useState('agent');
  const [editPassword, setEditPassword] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editCopilotAccess, setEditCopilotAccess] = useState(false);
  const [editActive, setEditActive] = useState(true);
  const [updating, setUpdating] = useState(false);

  // States for Groups Form
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupColor, setGroupColor] = useState('#2563eb');
  const [groupUsers, setGroupUsers] = useState([]);
  const [groupCampaigns, setGroupCampaigns] = useState([]);
  const [editingGroup, setEditingGroup] = useState(null);

  useEffect(() => { fetchData(); }, [filterTenantId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Query de tenants: si no es superadmin, solo su propio tenant
      let tQuery = supabase.from('tenants').select('id, name');
      if (!isSuperAdmin && filterTenantId) {
        tQuery = tQuery.eq('id', filterTenantId);
      }
      const tRes = await tQuery;
      if (tRes.error) throw tRes.error;
      setTenants(tRes.data || []);

      // Determine the tenantId to filter users and groups
      const finalTenantId = isSuperAdmin ? filterTenantId : (filterTenantId || (tRes.data?.[0]?.id || null));
      
      if (!selectedTenant && (tRes.data && tRes.data.length > 0)) {
        setSelectedTenant(finalTenantId || tRes.data[0].id);
      }
      
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      let url = `${apiUrl}/api/admin/users`;
      if (finalTenantId) url += `?filterTenantId=${finalTenantId}`;
      
      const uRes = await fetch(url);
      if (!uRes.ok) {
        const errorData = await uRes.json();
        throw new Error(errorData.error || 'Error al cargar usuarios');
      }
      const uData = await uRes.json();
      setTenantUsers(uData || []);

      // Fetch Groups and Campaigns
      const groupsUrl = finalTenantId ? `${apiUrl}/api/crm/groups?tenantId=${finalTenantId}` : `${apiUrl}/api/crm/groups`;
      const campaignsUrl = finalTenantId ? `${apiUrl}/api/crm/campaigns?tenantId=${finalTenantId}` : `${apiUrl}/api/crm/campaigns`;

      const [gRes, cRes] = await Promise.all([
        fetch(groupsUrl),
        fetch(campaignsUrl)
      ]);
      if (gRes.ok) setGroups(await gRes.json());
      if (cRes.ok) setCampaigns(await cRes.json());
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!email || !password || !selectedTenant) return;
    setCreating(true); setError(null);
    const finalTenantId = isSuperAdmin ? selectedTenant : filterTenantId;
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: finalTenantId,
          email,
          password,
          role,
          display_name: displayName,
          copilot_access: copilotAccess
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear usuario');
      
      fetchData();
      setEmail(''); setPassword(''); setDisplayName('');
      alert('✅ Usuario creado exitosamente.');
    } catch (err) { setError(err.message); }
    finally { setCreating(false); }
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setEditRole(user.role);
    setEditPassword('');
    setEditDisplayName(user.display_name || '');
    setEditCopilotAccess(user.copilot_access || false);
    setEditActive(user.is_active !== false); // default to true if undefined
    setError(null);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setUpdating(true); setError(null);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/admin/users/${editingUser.user_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: editPassword,
          role: editRole,
          is_active: editActive,
          display_name: editDisplayName,
          copilot_access: editCopilotAccess
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al actualizar usuario');
      
      setEditingUser(null);
      fetchData();
      alert('✅ Usuario actualizado exitosamente.');
    } catch (err) { setError(err.message); }
    finally { setUpdating(false); }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    setCreating(true); setError(null);
    try {
      const targetTenantId = isSuperAdmin ? selectedTenant : filterTenantId;
      if (!targetTenantId) throw new Error("Debe seleccionar una empresa para crear el grupo");
      
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/crm/groups`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: targetTenantId, name: groupName, description: groupDesc, color: groupColor, users: groupUsers, campaigns: groupCampaigns })
      });
      if (!res.ok) throw new Error('Error al crear grupo');
      setGroupName(''); setGroupDesc(''); setGroupColor('#2563eb'); setGroupUsers([]); setGroupCampaigns([]);
      fetchData();
      alert('✅ Grupo creado exitosamente.');
    } catch (err) { setError(err.message); }
    finally { setCreating(false); }
  };

  const openEditGroup = (g) => {
    setEditingGroup(g);
    setGroupName(g.name);
    setGroupDesc(g.description || '');
    setGroupColor(g.color || '#2563eb');
    setGroupUsers(g.agent_group_users?.map(u => u.user_id) || []);
    setGroupCampaigns(g.campaign_groups?.map(c => c.campaign_id) || []);
    setError(null);
  };

  const handleUpdateGroup = async (e) => {
    e.preventDefault();
    setUpdating(true); setError(null);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/crm/groups/${editingGroup.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: groupName, description: groupDesc, color: groupColor, users: groupUsers, campaigns: groupCampaigns })
      });
      if (!res.ok) throw new Error('Error al actualizar grupo');
      setEditingGroup(null);
      setGroupName(''); setGroupDesc(''); setGroupColor('#2563eb'); setGroupUsers([]); setGroupCampaigns([]);
      fetchData();
      alert('✅ Grupo actualizado exitosamente.');
    } catch (err) { setError(err.message); }
    finally { setUpdating(false); }
  };

  const handleDeleteGroup = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar este grupo?')) return;
    setError(null);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/crm/groups/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar grupo');
      fetchData();
    } catch (err) { setError(err.message); }
  };

  const filteredUsers = tenantUsers.filter(tu => {
    if (!searchQuery) return true;
    const s = searchQuery.toLowerCase();
    const matchesName = (tu.display_name || '').toLowerCase().includes(s);
    const matchesEmail = (tu.email || tu.user_id || '').toLowerCase().includes(s);
    const matchesTenant = isSuperAdmin && (tu.tenants?.name || '').toLowerCase().includes(s);
    return matchesName || matchesEmail || matchesTenant;
  });

  return (
    <div className="users-container">
      <h2 className="users-title">Usuarios y Grupos</h2>
      <p className="users-subtitle">
        {isSuperAdmin
          ? 'Vista global: puedes gestionar usuarios y grupos de todas las empresas.'
          : 'Gestiona los accesos y los grupos operativos de tu empresa.'}
      </p>

      {/* Tabs */}
      <div className="users-tab-group">
        <button className={`users-tab-btn ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>Usuarios Ejecutivos</button>
        <button className={`users-tab-btn ${activeTab === 'groups' ? 'active' : ''}`} onClick={() => setActiveTab('groups')}>Grupos Operativos</button>
      </div>

      {error && (
        <div className="insights-alert-error">
          <i className="ti ti-alert-circle" style={{ fontSize: '18px' }}></i> {error}
        </div>
      )}

      {activeTab === 'users' && (
        <>
          <div className="users-form-card">
            <h3 className="users-form-card-title">Crear Nuevo Usuario</h3>
            <form onSubmit={handleCreate} className="users-form-grid-2">
              <div className="users-form-group">
                <label className="users-form-label">Nombre Completo</label>
                <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} required placeholder="Ej: Juan Pérez" className="users-input" />
              </div>
              <div className="users-form-group">
                <label className="users-form-label">Correo Electrónico</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="users-input" />
              </div>
              <div className="users-form-group">
                <label className="users-form-label">Contraseña provisoria</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className="users-input" />
              </div>

              {/* Selector de empresa: bloqueado si no es superAdmin */}
              <div className="users-form-group">
                <label className="users-form-label">
                  Empresa {!isSuperAdmin && <span style={{ color: 'var(--color-success)', textTransform: 'none' }}>(tu empresa)</span>}
                </label>
                <select value={selectedTenant} onChange={e => setSelectedTenant(e.target.value)}
                  disabled={!isSuperAdmin}
                  className="users-select"
                  style={!isSuperAdmin ? { opacity: 0.7, cursor: 'not-allowed' } : {}}>
                  {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              <div className="users-form-group">
                <label className="users-form-label">Rol</label>
                <select value={role} onChange={e => setRole(e.target.value)} className="users-select">
                  <option value="agent">Agente (CRM + Contactos)</option>
                  <option value="admin">Administrador (Acceso total)</option>
                </select>
              </div>

              <div className="users-checkbox-banner" style={{ gridColumn: '1 / -1' }}>
                <input type="checkbox" id="createCopilot" checked={copilotAccess} onChange={e => setCopilotAccess(e.target.checked)} className="users-checkbox-input" />
                <label htmlFor="createCopilot" className="users-checkbox-label">
                  🤖 Habilitar acceso al Co-Piloto Corporativo (Kimi)
                </label>
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="submit" disabled={creating || tenants.length === 0} className="users-btn-primary">
                  {creating ? 'Creando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>

          {/* Buscador y Tabla */}
          <div className="users-table-card">
            
            {/* Barra de búsqueda */}
            <div className="users-search-container">
              <i className="ti ti-search users-search-icon"></i>
              <input 
                type="text" 
                placeholder="Buscar por nombre, correo o empresa..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="users-search-input"
              />
            </div>

            <table className="users-table">
              <thead>
                <tr>
                  {isSuperAdmin && <th>Empresa</th>}
                  <th>Usuario / Correo</th>
                  <th>Estado</th>
                  <th>Rol</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={isSuperAdmin ? "5" : "4"} style={{ padding: '16px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Cargando...</td></tr>
                ) : tenantUsers.length === 0 ? (
                  <tr><td colSpan={isSuperAdmin ? "5" : "4"} style={{ padding: '16px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>No hay usuarios registrados</td></tr>
                ) : filteredUsers.length === 0 ? (
                  <tr><td colSpan={isSuperAdmin ? "5" : "4"} style={{ padding: '16px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>No se encontraron resultados para "{searchQuery}"</td></tr>
                ) : filteredUsers.map(tu => {
                  const isActive = tu.is_active !== false;
                  return (
                    <tr key={tu.user_id} className={isActive ? '' : 'inactive-user'}>
                      {isSuperAdmin && (
                        <td style={{ fontWeight: '500' }}>
                          {tu.tenants?.name || 'Desconocido'}
                        </td>
                      )}
                      <td>
                        <div className="users-cell-name">{tu.display_name || 'Sin Nombre'}</div>
                        <div className="users-cell-email" style={{ fontFamily: 'monospace' }}>{tu.email || tu.user_id}</div>
                      </td>
                      <td>
                        <span className={`users-badge ${isActive ? 'users-badge-active' : 'users-badge-disabled'}`}>
                          {isActive ? 'Activo' : 'Desactivado'}
                        </span>
                      </td>
                      <td>
                        <span className={`users-badge ${tu.role === 'admin' ? 'users-badge-admin' : 'users-badge-agent'}`}>
                          {tu.role}
                        </span>
                      </td>
                      <td>
                        <button onClick={() => openEdit(tu)} className="users-btn-secondary" style={{ padding: '6px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <i className="ti ti-edit"></i> Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'groups' && (
        <>
          <div className="users-form-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 className="users-form-card-title" style={{ margin: 0 }}>
                {editingGroup ? 'Editar Grupo' : 'Crear Nuevo Grupo'}
              </h3>
              {editingGroup && (
                <button onClick={() => { setEditingGroup(null); setGroupName(''); setGroupDesc(''); setGroupColor('#2563eb'); setGroupUsers([]); setGroupCampaigns([]); }} className="users-btn-secondary" style={{ padding: '6px 12px', fontSize: '13px' }}>
                  Cancelar Edición
                </button>
              )}
            </div>
            <form onSubmit={editingGroup ? handleUpdateGroup : handleCreateGroup} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="users-form-grid-2">
                <div className="users-form-group">
                  <label className="users-form-label">Nombre del Grupo</label>
                  <input type="text" value={groupName} onChange={e => setGroupName(e.target.value)} required placeholder="Ej: Soporte Nivel 2" className="users-input" />
                </div>
                <div className="users-form-group">
                  <label className="users-form-label">Color</label>
                  <input type="color" value={groupColor} onChange={e => setGroupColor(e.target.value)} className="users-input" style={{ padding: 0, height: '40px', cursor: 'pointer' }} />
                </div>
              </div>
              
              <div className="users-form-group">
                <label className="users-form-label">Descripción</label>
                <input type="text" value={groupDesc} onChange={e => setGroupDesc(e.target.value)} placeholder="Descripción breve" className="users-input" />
              </div>

              {isSuperAdmin && !editingGroup && (
                <div className="users-form-group">
                  <label className="users-form-label">Empresa</label>
                  <select value={selectedTenant} onChange={e => setSelectedTenant(e.target.value)} className="users-select">
                    <option value="">-- Seleccionar --</option>
                    {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}

              <div className="users-form-grid-2">
                <div className="users-form-group">
                  <label className="users-form-label">Usuarios Asignados (Múltiple)</label>
                  <select multiple value={groupUsers} onChange={e => setGroupUsers(Array.from(e.target.selectedOptions, option => option.value))} className="users-select">
                    {tenantUsers
                      .filter(u => !isSuperAdmin || !selectedTenant || u.tenant_id === selectedTenant)
                      .map(u => <option key={u.user_id} value={u.user_id}>{u.display_name || u.email}</option>)}
                  </select>
                </div>
                <div className="users-form-group">
                  <label className="users-form-label">Campañas Autorizadas (Múltiple)</label>
                  <select multiple value={groupCampaigns} onChange={e => setGroupCampaigns(Array.from(e.target.selectedOptions, option => option.value))} className="users-select">
                    {campaigns
                      .filter(cam => !isSuperAdmin || !selectedTenant || cam.tenant_id === selectedTenant)
                      .map(cam => <option key={cam.id} value={cam.id}>{cam.name}</option>)}
                  </select>
                  <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--color-text-secondary)' }}>Si no seleccionas campañas, el grupo no verá ninguna conversación por defecto.</p>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="submit" disabled={creating || updating} className="users-btn-primary">
                  {editingGroup ? (updating ? 'Guardando...' : 'Guardar Cambios') : (creating ? 'Creando...' : 'Crear Grupo')}
                </button>
              </div>
            </form>
          </div>

          <div className="users-table-card">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Grupo</th>
                  <th>Integrantes</th>
                  <th>Campañas Autorizadas</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {groups.length === 0 ? (
                  <tr><td colSpan="4" style={{ padding: '16px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>No hay grupos creados</td></tr>
                ) : groups.map(g => (
                  <tr key={g.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="users-group-color-pill" style={{ background: g.color || '#2563eb' }}></div>
                        <span style={{ fontWeight: '600', fontSize: '14px', color: 'var(--color-text-primary)' }}>{g.name}</span>
                      </div>
                      <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px', marginTop: '4px' }}>{g.description}</div>
                    </td>
                    <td>
                      {g.agent_group_users?.length || 0} usuarios
                    </td>
                    <td>
                      {g.campaign_groups?.length || 0} campañas
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={() => openEditGroup(g)} className="users-btn-secondary" style={{ padding: '6px 12px', fontSize: '13px' }}>Editar</button>
                        <button onClick={() => handleDeleteGroup(g.id)} className="users-btn-danger">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {editingUser && (
        <div className="users-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setEditingUser(null); }}>
          <div className="users-modal-card">
            <div className="users-modal-header">
              <h3 className="users-modal-title">Editar Usuario</h3>
              <button onClick={() => setEditingUser(null)} className="users-modal-close-btn">&times;</button>
            </div>
            
            <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="users-form-group">
                <label className="users-form-label">Nombre Completo</label>
                <input type="text" value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} className="users-input" />
              </div>
              <div className="users-form-group">
                <label className="users-form-label">Correo Electrónico</label>
                <div style={{ padding: '10px 14px', background: 'var(--color-background-secondary)', border: '1px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-md)', color: 'var(--color-text-secondary)', fontSize: '12px', fontFamily: 'monospace' }}>
                  {editingUser.email || editingUser.user_id}
                </div>
              </div>

              <div className="users-form-group">
                <label className="users-form-label">Rol</label>
                <select value={editRole} onChange={e => setEditRole(e.target.value)} className="users-select">
                  <option value="agent">Agente</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <div className="users-form-group">
                <label className="users-form-label">Nueva Contraseña (dejar en blanco para no cambiar)</label>
                <input type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)} minLength={6} placeholder="••••••••" className="users-input" />
              </div>

              <div className="users-checkbox-banner">
                <input type="checkbox" id="editCopilot" checked={editCopilotAccess} onChange={e => setEditCopilotAccess(e.target.checked)} className="users-checkbox-input" />
                <label htmlFor="editCopilot" className="users-checkbox-label">
                  🤖 Acceso al Co-Piloto Corporativo (Kimi)
                </label>
              </div>

              <div className={`users-checkbox-banner ${editActive ? 'active-status' : 'inactive-status'}`}>
                <input type="checkbox" id="userActive" checked={editActive} onChange={e => setEditActive(e.target.checked)} className="users-checkbox-input" />
                <label htmlFor="userActive" className="users-checkbox-label">
                  Usuario Activo (Permitir acceso)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button type="button" onClick={() => setEditingUser(null)} className="users-btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={updating} className="users-btn-primary">
                  {updating ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
