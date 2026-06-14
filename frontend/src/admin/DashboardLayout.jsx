import React, { useState, useEffect } from 'react';
const API_URL = import.meta.env.VITE_API_URL || '';

export default function DashboardLayout({ userEmail, tenantName, tenantId, tenantLogo, tenantColor, isSuperAdmin, userRole, currentTab, setTab, handleLogout, children }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('kuden_theme') || 'light'; // Light mode por defecto
  });
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    localStorage.setItem('kuden_theme', theme);
    // Aplicar data-theme al documento para que las variables CSS de dark mode funcionen
    document.documentElement.setAttribute('data-theme', theme);
    return () => {};
  }, [theme]);

  // Poll alert count every 5s for the CRM badge
  useEffect(() => {
    if (!tenantId) return;
    const fetchAlerts = async () => {
      try {
        const res  = await fetch(`${API_URL}/api/crm/alerts?tenantId=${tenantId}`);
        const data = await res.json();
        setAlertCount(data?.count || 0);
      } catch {}
    };
    fetchAlerts();
    const t = setInterval(fetchAlerts, 5000);
    return () => clearInterval(t);
  }, [tenantId]);

  const isDark = theme === 'dark';

  // Colors adaptados al tema — con soporte glassmorphism
  const brandColor   = tenantColor || '#2563eb';
  const textMain     = isDark ? '#f9fafb' : '#111827';
  const textSec      = isDark ? '#9ca3af' : '#6b7280';
  const borderCol    = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';

  const sidebarBg    = isDark
    ? 'var(--gradient-bg-sidebar)'
    : 'linear-gradient(180deg, rgba(248,250,255,0.95) 0%, rgba(255,255,255,0.98) 100%)';

  const mainBg       = isDark
    ? 'var(--gradient-bg-main)'
    : 'var(--gradient-bg-main)';

  const tabGroups = [
    {
      title: 'Demos & Integración',
      items: [
        { id: 'simulator',  label: 'Simulador IA',  icon: 'ti-message-chatbot' },
        { id: 'widget',     label: 'Widget Web',    icon: 'ti-world' }
      ]
    },
    {
      title: 'Operaciones CRM',
      items: [
        { id: 'crm',        label: 'CRM',           icon: 'ti-messages', badge: alertCount > 0 ? alertCount : null, badgeColor: '#EF9F27' },
        { id: 'campaigns',  label: 'Campañas',      icon: 'ti-speakerphone' },
        { id: 'contacts',   label: 'Contactos',     icon: 'ti-address-book' }
      ]
    },
    {
      title: 'Motor IA',
      items: [
        { id: 'profiles',   label: 'Perfiles IA',   icon: 'ti-robot' },
        { id: 'ai_config',  label: 'Config. IA',    icon: 'ti-settings-automation' }
      ]
    },
    {
      title: 'Administración',
      items: [
        { id: 'users',      label: 'Usuarios',      icon: 'ti-user-plus' },
        { id: 'tenants',    label: 'Empresas',      icon: 'ti-building',   superAdminOnly: true },
        { id: 'global_keys',label: 'Llaves API',    icon: 'ti-key',        superAdminOnly: true },
        { id: 'billing',    label: 'Tarificador',   icon: 'ti-receipt',    superAdminOnly: true },
        { id: 'monitoring', label: 'Health Monitor',icon: 'ti-activity',   superAdminOnly: true },
      ]
    }
  ];

  return (
    <div
      data-theme={theme}
      style={{ display: 'flex', minHeight: '100vh', background: mainBg, color: textMain, transition: 'background 0.4s, color 0.3s' }}
    >
      {/* ── Sidebar ── */}
      <aside style={{
        width: '250px',
        background: sidebarBg,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: `1px solid ${borderCol}`,
        boxShadow: isDark ? '4px 0 24px rgba(0,0,0,0.3)' : '4px 0 24px rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'background 0.4s, border-color 0.3s',
        position: 'relative',
        zIndex: 10,
      }}>

        {/* Logo */}
        <div style={{ padding: '20px 16px', borderBottom: `1px solid ${borderCol}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
          {tenantLogo ? (
            <img src={tenantLogo} alt="Logo Empresa" style={{ width: 34, height: 34, borderRadius: '8px', objectFit: 'contain', flexShrink: 0, background: isDark ? 'rgba(255,255,255,0.1)' : 'transparent', padding: 2 }} />
          ) : (
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: `linear-gradient(135deg, ${brandColor}, ${brandColor}bb)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 12px ${brandColor}40`,
            }}>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 17 }}>{tenantName ? tenantName.charAt(0).toUpperCase() : 'K'}</span>
            </div>
          )}
          <div style={{ overflow: 'hidden' }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: brandColor, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 155 }}>
              {tenantName && !isSuperAdmin ? tenantName : 'KUDEN IA'}
            </p>
            <p style={{ margin: 0, fontSize: '11px', color: textSec }}>
              {isSuperAdmin ? '⚡ Super Admin' : 'Panel de Control'}
            </p>
          </div>
        </div>

        {/* Empresa actual pill */}
        {tenantName && (
          <div style={{ padding: '10px 16px', borderBottom: `1px solid ${borderCol}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: isSuperAdmin ? '#f59e0b' : '#1D9E75', flexShrink: 0, boxShadow: isSuperAdmin ? '0 0 6px #f59e0b80' : '0 0 6px #1D9E7580' }} />
            <p style={{ margin: 0, fontSize: '11px', color: textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tenantName}
            </p>
          </div>
        )}

        {/* Navegación */}
        <nav style={{ flex: 1, padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
          {tabGroups.map((group, idx) => {
            const groupItems = group.items.filter(t => !t.superAdminOnly || isSuperAdmin);
            if (groupItems.length === 0) return null;
            return (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <p style={{ margin: '0 0 4px 10px', fontSize: '10px', fontWeight: '700', color: textSec, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  {group.title}
                </p>
                {groupItems.map(t => {
                  const isActive = currentTab === t.id;
                  return (
                    <button key={t.id} onClick={() => setTab(t.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '9px',
                        padding: '9px 12px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                        background: isActive
                          ? `linear-gradient(135deg, ${brandColor}22, ${brandColor}11)`
                          : 'transparent',
                        color: isActive ? brandColor : textSec,
                        fontWeight: isActive ? '600' : '500',
                        fontSize: '13px', transition: 'all 0.15s', textAlign: 'left', width: '100%',
                        borderLeft: isActive ? `3px solid ${brandColor}` : '3px solid transparent',
                        boxShadow: isActive ? `inset 0 0 0 1px ${brandColor}20` : 'none',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
                          e.currentTarget.style.color = textMain;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = textSec;
                        }
                      }}
                    >
                      <i className={`ti ${t.icon}`} style={{ fontSize: '15px', flexShrink: 0 }} />
                      {t.label}
                      {t.superAdminOnly && (
                        <span style={{ marginLeft: 'auto', fontSize: '9px', background: '#f59e0b15', color: '#f59e0b', border: '1px solid #f59e0b30', borderRadius: '4px', padding: '1px 5px', fontWeight: '700' }}>MASTER</span>
                      )}
                      {t.badge > 0 && (
                        <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: '700', background: t.badgeColor || '#E24B4A', color: '#fff', borderRadius: 20, padding: '1px 7px', minWidth: 20, textAlign: 'center', animation: 'badge-pop 0.3s ease-out' }}>{t.badge}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Footer sidebar */}
        <div style={{ padding: '14px', borderTop: `1px solid ${borderCol}` }}>
          {/* Rol badge */}
          <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '10px', padding: '3px 9px', borderRadius: '20px',
              background: isSuperAdmin ? '#f59e0b15' : userRole === 'admin' ? '#2563eb15' : '#1D9E7515',
              color:      isSuperAdmin ? '#f59e0b'   : userRole === 'admin' ? '#2563eb'   : '#1D9E75',
              border: `1px solid ${isSuperAdmin ? '#f59e0b30' : userRole === 'admin' ? '#2563eb30' : '#1D9E7530'}`,
              fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              {isSuperAdmin ? '⚡ Super Admin' : userRole === 'admin' ? 'Admin' : 'Agente'}
            </span>
          </div>

          <p style={{ margin: '0 0 2px', fontSize: '10px', color: textSec }}>Conectado como</p>
          <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: '500', wordBreak: 'break-all', color: textMain }}>{userEmail}</p>

          {/* Theme toggle */}
          <button onClick={() => setTheme(isDark ? 'light' : 'dark')}
            style={{ width: '100%', padding: '7px', borderRadius: '8px', border: `1px solid ${borderCol}`, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', color: textSec, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', marginBottom: '6px' }}>
            {isDark ? <><i className="ti ti-sun" /> Modo Claro</> : <><i className="ti ti-moon" /> Modo Oscuro</>}
          </button>

          {/* Mi Perfil */}
          <button onClick={() => setTab('profile')}
            style={{ width: '100%', padding: '7px', borderRadius: '8px', border: `1px solid ${currentTab === 'profile' ? brandColor + '40' : borderCol}`, background: currentTab === 'profile' ? brandColor + '10' : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', color: currentTab === 'profile' ? brandColor : textSec, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', marginBottom: '6px' }}>
            <i className="ti ti-user" /> Mi Perfil
          </button>

          {/* Logout */}
          <button onClick={handleLogout}
            style={{ width: '100%', padding: '7px', borderRadius: '8px', border: `1px solid ${borderCol}`, background: 'transparent', color: textSec, cursor: 'pointer', transition: 'all 0.2s', fontSize: '12px' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = textSec; e.currentTarget.style.borderColor = borderCol; }}>
            <i className="ti ti-logout" style={{ marginRight: 5 }} />Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* ── Contenido principal ── */}
      <div style={{ flex: 1, background: 'transparent', overflowY: 'auto', transition: 'background 0.4s' }}>
        <div style={{ padding: '28px 32px', maxWidth: '1140px', animation: 'fadeSlideIn 0.25s ease-out' }}>
          {typeof children === 'function' ? children(isDark) : children}
        </div>
      </div>
    </div>
  );
}
