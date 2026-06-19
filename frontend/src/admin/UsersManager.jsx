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

  const c = {
    card:      isDark ? '#111'    : '#ffffff',
    border:    isDark ? '#222'    : '#e5e7eb',
    thead:     isDark ? '#1a1a1a' : '#f3f4f6',
    title:     isDark ? '#ffffff' : '#111827',
    subtitle:  isDark ? '#aaaaaa' : '#6b7280',
    inputBg:   isDark ? '#1a1a1a' : '#f9fafb',
    inputText: isDark ? '#ffffff' : '#111827',
    rowText:   isDark ? '#ffffff' : '#111827',
    rowMono:   isDark ? '#aaaaaa' : '#6b7280',
    label:     isDark ? '#888888' : '#6b7280',
  };

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

      const finalTenantId = (!isSuperAdmin && filterTenantId) ? filterTenantId : (tRes.data && tRes.data.length > 0 ? tRes.data[0].id : null);
      if (!selectedTenant && finalTenantId) setSelectedTenant(finalTenantId);
      
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

      if (finalTenantId) {
        const [gRes, cRes] = await Promise.all([
          fetch(`${apiUrl}/api/crm/groups?tenantId=${finalTenantId}`),
          fetch(`${apiUrl}/api/crm/campaigns?tenantId=${finalTenantId}`)
        ]);
        if (gRes.ok) setGroups(await gRes.json());
        if (cRes.ok) setCampaigns(await cRes.json());
      }
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
      const finalTenantId = isSuperAdmin ? selectedTenant : filterTenantId;
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/crm/groups`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: finalTenantId, name: groupName, description: groupDesc, color: groupColor, users: groupUsers, campaigns: groupCampaigns })
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

  const inputStyle = {
    backgroundColor: c.inputBg, border: `1px solid ${c.border}`,
    borderRadius: '8px', padding: '10px', color: c.inputText,
    outline: 'none', fontSize: '14px', width: '100%', boxSizing: 'border-box'
  };

  const filteredUsers = tenantUsers.filter(tu => {
    if (!searchQuery) return true;
    const s = searchQuery.toLowerCase();
    const matchesName = (tu.display_name || '').toLowerCase().includes(s);
    const matchesEmail = (tu.email || tu.user_id || '').toLowerCase().includes(s);
    const matchesTenant = isSuperAdmin && (tu.tenants?.name || '').toLowerCase().includes(s);
    return matchesName || matchesEmail || matchesTenant;
  });

  const tabStyle = (isActive) => ({
    padding: '10px 20px', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
    borderBottom: isActive ? `2px solid #2563eb` : '2px solid transparent',
    color: isActive ? '#2563eb' : c.subtitle, background: 'transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none',
    transition: 'all 0.2s'
  });

  return (
    <div>
      <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 8px', color: c.title }}>Usuarios y Grupos</h2>
      <p style={{ margin: '0 0 16px', fontSize: '14px', color: c.subtitle }}>
        {isSuperAdmin
          ? 'Vista global: puedes gestionar usuarios y grupos de todas las empresas.'
          : 'Gestiona los accesos y los grupos operativos de tu empresa.'}
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '16px', borderBottom: `1px solid ${c.border}`, marginBottom: '24px' }}>
        <button style={tabStyle(activeTab === 'users')} onClick={() => setActiveTab('users')}>Usuarios Ejecutivos</button>
        <button style={tabStyle(activeTab === 'groups')} onClick={() => setActiveTab('groups')}>Grupos Operativos</button>
      </div>

      {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.5)', color: '#f87171', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>{error}</div>}

      {activeTab === 'users' && (
        <>
      <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '24px', marginBottom: '32px' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: c.title }}>Crear Nuevo Usuario</h3>
        <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', color: c.label }}>Nombre Completo</label>
            <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} required placeholder="Ej: Juan Pérez" style={inputStyle} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', color: c.label }}>Correo Electrónico</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', color: c.label }}>Contraseña provisoria</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} style={inputStyle} />
          </div>

          {/* Selector de empresa: bloqueado si no es superAdmin */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', color: c.label }}>
              Empresa {!isSuperAdmin && <span style={{ color: '#1D9E75' }}>(tu empresa)</span>}
            </label>
            <select value={selectedTenant} onChange={e => setSelectedTenant(e.target.value)}
              disabled={!isSuperAdmin}
              style={{ ...inputStyle, opacity: !isSuperAdmin ? 0.7 : 1, cursor: !isSuperAdmin ? 'not-allowed' : 'auto' }}>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', color: c.label }}>Rol</label>
            <select value={role} onChange={e => setRole(e.target.value)} style={inputStyle}>
              <option value="agent">Agente (Solo simulador)</option>
              <option value="admin">Administrador (Acceso total)</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', gridColumn: '1 / -1', padding: '10px 12px', background: 'rgba(37,99,235,0.05)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: '8px' }}>
            <input type="checkbox" id="createCopilot" checked={copilotAccess} onChange={e => setCopilotAccess(e.target.checked)} style={{ cursor: 'pointer' }} />
            <label htmlFor="createCopilot" style={{ fontSize: '13px', color: c.title, cursor: 'pointer', fontWeight: '500' }}>
              🤖 Habilitar acceso al Co-Piloto Corporativo (Kimi)
            </label>
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button type="submit" disabled={creating || tenants.length === 0}
              style={{ backgroundColor: '#2563eb', color: '#fff', fontWeight: '500', padding: '10px 24px', borderRadius: '8px', border: 'none', cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.7 : 1, fontSize: '14px' }}>
              {creating ? 'Creando...' : 'Crear Usuario'}
            </button>
          </div>
        </form>
      </div>

      {/* Buscador y Tabla */}
      <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: '12px', overflow: 'hidden' }}>
        
        {/* Barra de búsqueda */}
        <div style={{ padding: '16px', borderBottom: `1px solid ${c.border}`, display: 'flex', gap: '12px', alignItems: 'center' }}>
          <i className="ti ti-search" style={{ color: c.subtitle, fontSize: '18px' }}></i>
          <input 
            type="text" 
            placeholder="Buscar por nombre, correo o empresa..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ 
              ...inputStyle, 
              border: 'none', 
              background: 'transparent', 
              padding: 0, 
              fontSize: '14px', 
              boxShadow: 'none',
              outline: 'none'
            }} 
          />
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: c.thead, borderBottom: `1px solid ${c.border}` }}>
              {(isSuperAdmin ? ['Empresa', 'Usuario / Correo', 'Estado', 'Rol', 'Acciones'] : ['Usuario / Correo', 'Estado', 'Rol', 'Acciones']).map(h => (
                <th key={h} style={{ padding: '16px', color: c.subtitle, fontWeight: '500', fontSize: '12px', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={isSuperAdmin ? "5" : "4"} style={{ padding: '16px', textAlign: 'center', color: c.subtitle }}>Cargando...</td></tr>
            ) : tenantUsers.length === 0 ? (
              <tr><td colSpan={isSuperAdmin ? "5" : "4"} style={{ padding: '16px', textAlign: 'center', color: c.subtitle }}>No hay usuarios registrados</td></tr>
            ) : filteredUsers.length === 0 ? (
              <tr><td colSpan={isSuperAdmin ? "5" : "4"} style={{ padding: '16px', textAlign: 'center', color: c.subtitle }}>No se encontraron resultados para "{searchQuery}"</td></tr>
            ) : filteredUsers.map(tu => {
              const isActive = tu.is_active !== false;
              return (
              <tr key={tu.user_id} style={{ borderBottom: `1px solid ${c.border}`, opacity: isActive ? 1 : 0.6 }}>
                {isSuperAdmin && (
                  <td style={{ padding: '16px', color: c.rowText, fontWeight: '500', fontSize: '14px' }}>
                    {tu.tenants?.name || 'Desconocido'}
                  </td>
                )}
                <td style={{ padding: '16px' }}>
                  <div style={{ color: c.rowText, fontWeight: '500', fontSize: '14px', marginBottom: '2px' }}>{tu.display_name || 'Sin Nombre'}</div>
                  <div style={{ color: c.rowMono, fontSize: '12px', fontFamily: 'monospace' }}>{tu.email || tu.user_id}</div>
                </td>
                <td style={{ padding: '16px' }}>
                  <span style={{ padding: '4px 10px', background: isActive ? '#1D9E7520' : '#E24B4A20', color: isActive ? '#1D9E75' : '#E24B4A', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                    {isActive ? 'Activo' : 'Desactivado'}
                  </span>
                </td>
                <td style={{ padding: '16px' }}>
                  <span style={{ padding: '4px 10px', background: tu.role === 'admin' ? '#534AB740' : '#1D9E7540', color: tu.role === 'admin' ? '#A39DF4' : '#6BDEB9', borderRadius: '4px', fontSize: '11px', textTransform: 'uppercase', fontWeight: '600' }}>
                    {tu.role}
                  </span>
                </td>
                <td style={{ padding: '16px' }}>
                  <button onClick={() => openEdit(tu)} style={{ background: 'transparent', border: 'none', color: '#60a5fa', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
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
          <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '24px', marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: c.title }}>{editingGroup ? 'Editar Grupo' : 'Crear Nuevo Grupo'}</h3>
              {editingGroup && (
                <button onClick={() => { setEditingGroup(null); setGroupName(''); setGroupDesc(''); setGroupUsers([]); setGroupCampaigns([]); }} style={{ background: 'transparent', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: '13px' }}>
                  Cancelar Edición
                </button>
              )}
            </div>
            <form onSubmit={editingGroup ? handleUpdateGroup : handleCreateGroup} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', color: c.label }}>Nombre del Grupo</label>
                  <input type="text" value={groupName} onChange={e => setGroupName(e.target.value)} required placeholder="Ej: Soporte Nivel 2" style={inputStyle} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', color: c.label }}>Color</label>
                  <input type="color" value={groupColor} onChange={e => setGroupColor(e.target.value)} style={{ ...inputStyle, padding: 0, height: '40px' }} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: c.label }}>Descripción</label>
                <input type="text" value={groupDesc} onChange={e => setGroupDesc(e.target.value)} placeholder="Descripción breve" style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', color: c.label }}>Usuarios Asignados (Múltiple)</label>
                  <select multiple value={groupUsers} onChange={e => setGroupUsers(Array.from(e.target.selectedOptions, option => option.value))} style={{ ...inputStyle, height: '100px' }}>
                    {tenantUsers.map(u => <option key={u.user_id} value={u.user_id}>{u.display_name || u.email}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', color: c.label }}>Campañas Autorizadas (Múltiple)</label>
                  <select multiple value={groupCampaigns} onChange={e => setGroupCampaigns(Array.from(e.target.selectedOptions, option => option.value))} style={{ ...inputStyle, height: '100px' }}>
                    {campaigns.map(cam => <option key={cam.id} value={cam.id}>{cam.name}</option>)}
                  </select>
                  <p style={{ margin: 0, fontSize: '11px', color: c.subtitle }}>Si no seleccionas campañas, el grupo no verá ninguna conversación por defecto.</p>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="submit" disabled={creating || updating} style={{ backgroundColor: '#2563eb', color: '#fff', padding: '10px 24px', borderRadius: '8px', border: 'none', cursor: (creating || updating) ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '500' }}>
                  {editingGroup ? (updating ? 'Guardando...' : 'Guardar Cambios') : (creating ? 'Creando...' : 'Crear Grupo')}
                </button>
              </div>
            </form>
          </div>

          <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: c.thead, borderBottom: `1px solid ${c.border}` }}>
                  {['Grupo', 'Integrantes', 'Campañas Autorizadas', 'Acciones'].map(h => (
                    <th key={h} style={{ padding: '16px', color: c.subtitle, fontWeight: '500', fontSize: '12px', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.length === 0 ? (
                  <tr><td colSpan="4" style={{ padding: '16px', textAlign: 'center', color: c.subtitle }}>No hay grupos creados</td></tr>
                ) : groups.map(g => (
                  <tr key={g.id} style={{ borderBottom: `1px solid ${c.border}` }}>
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: g.color || '#2563eb' }}></div>
                        <span style={{ color: c.rowText, fontWeight: '600', fontSize: '14px' }}>{g.name}</span>
                      </div>
                      <div style={{ color: c.subtitle, fontSize: '12px', marginTop: '4px' }}>{g.description}</div>
                    </td>
                    <td style={{ padding: '16px', color: c.rowText, fontSize: '13px' }}>
                      {g.agent_group_users?.length || 0} usuarios
                    </td>
                    <td style={{ padding: '16px', color: c.rowText, fontSize: '13px' }}>
                      {g.campaign_groups?.length || 0} campañas
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={() => openEditGroup(g)} style={{ background: 'transparent', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: '13px' }}>Editar</button>
                        <button onClick={() => handleDeleteGroup(g.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '13px' }}>Eliminar</button>
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: c.title }}>Editar Usuario</h3>
              <button onClick={() => setEditingUser(null)} style={{ background: 'transparent', border: 'none', color: c.subtitle, cursor: 'pointer', fontSize: '20px' }}>&times;</button>
            </div>
            
            <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', color: c.label }}>Nombre Completo</label>
                <input type="text" value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: c.label }}>Correo Electrónico</label>
                <div style={{ padding: '10px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${c.border}`, borderRadius: '8px', color: c.subtitle, fontSize: '12px', fontFamily: 'monospace' }}>
                  {editingUser.email || editingUser.user_id}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: c.label }}>Rol</label>
                <select value={editRole} onChange={e => setEditRole(e.target.value)} style={inputStyle}>
                  <option value="agent">Agente</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: c.label }}>Nueva Contraseña (dejar en blanco para no cambiar)</label>
                <input type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)} minLength={6} placeholder="••••••••" style={inputStyle} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: 'rgba(37,99,235,0.05)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: '8px' }}>
                <input type="checkbox" id="editCopilot" checked={editCopilotAccess} onChange={e => setEditCopilotAccess(e.target.checked)} style={{ cursor: 'pointer' }} />
                <label htmlFor="editCopilot" style={{ fontSize: '13px', color: c.inputText, cursor: 'pointer', fontWeight: '500' }}>
                  🤖 Acceso al Co-Piloto Corporativo (Kimi)
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: editActive ? 'rgba(29,158,117,0.1)' : 'rgba(226,75,74,0.1)', border: `1px solid ${editActive ? '#1D9E7550' : '#E24B4A50'}`, borderRadius: '8px' }}>
                <input type="checkbox" id="userActive" checked={editActive} onChange={e => setEditActive(e.target.checked)} style={{ cursor: 'pointer' }} />
                <label htmlFor="userActive" style={{ fontSize: '13px', color: c.inputText, cursor: 'pointer', fontWeight: '500' }}>
                  Usuario Activo (Permitir acceso)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button type="button" onClick={() => setEditingUser(null)} style={{ background: 'transparent', border: `1px solid ${c.border}`, color: c.inputText, padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={updating} style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '8px', cursor: updating ? 'not-allowed' : 'pointer', opacity: updating ? 0.7 : 1, fontSize: '14px', fontWeight: '500' }}>
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
