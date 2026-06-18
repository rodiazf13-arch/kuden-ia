import React, { useState, useEffect } from 'react';
import KimiWidget from './KimiWidget';
const API_URL = import.meta.env.VITE_API_URL || '';

export default function DashboardLayout({ userEmail, tenantName, tenantId, tenantLogo, tenantColor, isSuperAdmin, userRole, copilotAccess, currentTab, setTab, handleLogout, allTenants, impersonatedTenantId, setImpersonatedTenantId, originalTenantName, children }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('kuden_theme') || 'light'; // Light mode por defecto
  });
  const [alertCount, setAlertCount] = useState(0);
  const [impersonateOpen, setImpersonateOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('kuden_sidebar_collapsed') === 'true';
  });
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };

  useEffect(() => {
    localStorage.setItem('kuden_theme', theme);
    // Aplicar data-theme al documento para que las variables CSS de dark mode funcionen
    document.documentElement.setAttribute('data-theme', theme);
    return () => { };
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('kuden_sidebar_collapsed', isSidebarCollapsed);
  }, [isSidebarCollapsed]);

  // Poll alert count every 5s for the CRM badge
  useEffect(() => {
    if (!tenantId) return;
    const fetchAlerts = async () => {
      try {
        const res = await fetch(`${API_URL}/api/crm/alerts?tenantId=${tenantId}`);
        const data = await res.json();
        setAlertCount(data?.count || 0);
      } catch { }
    };
    fetchAlerts();
    const t = setInterval(fetchAlerts, 5000);
    return () => clearInterval(t);
  }, [tenantId]);

  const isDark = theme === 'dark';

  // Colors adaptados al tema — con soporte glassmorphism
  const brandColor = tenantColor || '#2563eb';
  const textMain = isDark ? '#f9fafb' : '#111827';
  const textSec = isDark ? '#9ca3af' : '#6b7280';
  const borderCol = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';

  const sidebarBg = isDark
    ? 'var(--gradient-bg-sidebar)'
    : 'linear-gradient(180deg, rgba(248,250,255,0.95) 0%, rgba(255,255,255,0.98) 100%)';

  const mainBg = isDark
    ? 'var(--gradient-bg-main)'
    : 'var(--gradient-bg-main)';

  const tabGroups = [
    {
      title: 'Integraciones & Web',
      items: [
        { id: 'simulator', label: 'Simulador IA', icon: 'ti-message-chatbot', superAdminOnly: true },
        { id: 'integrations', label: 'Hub Integraciones', icon: 'ti-plug', superAdminOnly: true }
      ]
    },
    {
      title: 'Operaciones CRM',
      items: [
        { id: 'crm', label: 'CRM', icon: 'ti-messages', badge: alertCount > 0 ? alertCount : null, badgeColor: '#EF9F27' },
        { id: 'campaigns', label: 'Campañas', icon: 'ti-speakerphone' },
        { id: 'contacts', label: 'Contactos', icon: 'ti-address-book' }
      ]
    },
    {
      title: 'Motor IA',
      items: [
        { id: 'ai_config', label: 'Identidad Maestra', icon: 'ti-brain', superAdminOnly: true },
        { id: 'profiles', label: 'Perfiles IA', icon: 'ti-robot' },
        ...(copilotAccess ? [
          { id: 'copilot', label: 'Co-Piloto (Kimi)', icon: 'ti-bulb', badgeColor: '#2563eb' },
          { id: 'insights', label: 'Kimi Insights (BI)', icon: 'ti-chart-bar' }
        ] : [])
      ]
    },
    {
      title: 'Administración',
      items: [
        { id: 'users', label: 'Usuarios', icon: 'ti-user-plus' },
        { id: 'tenants', label: 'Empresas', icon: 'ti-building', superAdminOnly: true },
        { id: 'global_keys', label: 'Llaves API', icon: 'ti-key', superAdminOnly: true },
        { id: 'billing', label: 'Tarificador', icon: 'ti-receipt', superAdminOnly: true },
        { id: 'monitoring', label: 'Health Monitor', icon: 'ti-activity', superAdminOnly: true },
      ]
    }
  ];

  return (
    <div
      data-theme={theme}
      style={{ display: 'flex', minHeight: '100vh', background: mainBg, color: textMain, transition: 'background 0.4s, color 0.3s' }}
    >
      {/* ── Mobile Sidebar Overlay ── */}
      <div 
        className={`sidebar-overlay ${isMobileSidebarOpen ? 'open' : ''}`} 
        onClick={() => setIsMobileSidebarOpen(false)}
      ></div>

      {/* ── Sidebar ── */}
      <aside className={`sidebar-container ${isMobileSidebarOpen ? 'open' : ''}`} style={{
        width: isSidebarCollapsed ? '80px' : '250px',
        background: sidebarBg,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: `1px solid ${borderCol}`,
        boxShadow: isDark ? '4px 0 24px rgba(0,0,0,0.3)' : '4px 0 24px rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), background 0.4s, border-color 0.3s',
        position: 'relative',
        zIndex: 1000,
      }}>

        {/* Botón para colapsar/expandir */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          title={isSidebarCollapsed ? "Expandir" : "Contraer"}
          style={{
            position: 'absolute',
            top: '26px',
            right: '-14px',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: isDark ? '#1a1a2e' : '#fff',
            border: `1px solid ${borderCol}`,
            color: textSec,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            zIndex: 20,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = brandColor; e.currentTarget.style.borderColor = brandColor; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = textSec; e.currentTarget.style.borderColor = borderCol; }}
        >
          <i className={`ti ti-chevron-${isSidebarCollapsed ? 'right' : 'left'}`} style={{ fontSize: '14px' }}></i>
        </button>

        {/* Logo */}
        <div style={{ padding: isSidebarCollapsed ? '20px 0' : '20px 16px', borderBottom: `1px solid ${borderCol}`, display: 'flex', alignItems: 'center', gap: '12px', justifyContent: isSidebarCollapsed ? 'center' : 'flex-start' }}>
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
          {!isSidebarCollapsed && (
            <div style={{ overflow: 'hidden' }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: brandColor, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 155 }}>
                {tenantName && !isSuperAdmin ? tenantName : 'KUDEN IA'}
              </p>
              <p style={{ margin: 0, fontSize: '11px', color: textSec }}>
                {isSuperAdmin ? '⚡ Super Admin' : 'Panel de Control'}
              </p>
            </div>
          )}
        </div>

        {/* Empresa actual pill */}
        {tenantName && !isSidebarCollapsed && (
          <div style={{ padding: '24px 20px', borderBottom: `1px solid ${borderCol}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {tenantLogo ? <img src={tenantLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <i className="ti ti-building" style={{ fontSize: 20, color: brandColor }}></i>}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <h2 style={{ fontSize: 14, margin: '0 0 2px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{tenantName || 'Sin Empresa'}</h2>
                <span style={{ fontSize: 11, color: textSec, background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', padding: '2px 6px', borderRadius: 10 }}>{userRole === 'admin' ? 'Administrador' : 'Agente'}</span>
              </div>
            </div>

            {/* Impersonation Dropdown for SuperAdmins */}
            {(isSuperAdmin || impersonatedTenantId) && allTenants?.length > 0 && (
              <div style={{ marginTop: 16, position: 'relative' }}>
                <button
                  onClick={() => setImpersonateOpen(!impersonateOpen)}
                  style={{
                    width: '100%', padding: '8px 12px', background: impersonatedTenantId ? 'rgba(239, 159, 39, 0.15)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
                    border: `1px solid ${impersonatedTenantId ? '#EF9F27' : borderCol}`, borderRadius: 8, color: impersonatedTenantId ? '#EF9F27' : textSec,
                    fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
                    fontWeight: impersonatedTenantId ? 600 : 500
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                    <i className="ti ti-eye"></i>
                    <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {impersonatedTenantId ? `Viendo: ${tenantName}` : 'Visualizar como cliente...'}
                    </span>
                  </div>
                  <i className={`ti ti-chevron-${impersonateOpen ? 'up' : 'down'}`}></i>
                </button>

                {impersonateOpen && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                    background: isDark ? '#1a1a2e' : '#fff', border: `1px solid ${borderCol}`,
                    borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100,
                    maxHeight: 200, overflowY: 'auto'
                  }}>
                    <button
                      onClick={() => { setImpersonatedTenantId(null); setImpersonateOpen(false); }}
                      style={{ width: '100%', padding: '8px 12px', textAlign: 'left', background: !impersonatedTenantId ? (isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb') : 'transparent', border: 'none', borderBottom: `1px solid ${borderCol}`, color: textMain, fontSize: 12, cursor: 'pointer' }}
                    >
                      <i className="ti ti-shield" style={{ marginRight: 6, color: '#2563eb' }}></i>
                      {originalTenantName} (Vista Original)
                    </button>
                    {allTenants.map(t => (
                      <button
                        key={t.id}
                        onClick={() => { setImpersonatedTenantId(t.id); setImpersonateOpen(false); }}
                        style={{ width: '100%', padding: '8px 12px', textAlign: 'left', background: impersonatedTenantId === t.id ? (isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb') : 'transparent', border: 'none', color: textMain, fontSize: 12, cursor: 'pointer' }}
                      >
                        <i className="ti ti-building" style={{ marginRight: 6, color: textSec }}></i>
                        {t.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Empresa actual pill (Colapsado) */}
        {tenantName && isSidebarCollapsed && (
          <div style={{ padding: '16px 0', borderBottom: `1px solid ${borderCol}`, display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }} title={tenantName}>
              {tenantLogo ? <img src={tenantLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <i className="ti ti-building" style={{ fontSize: 20, color: brandColor }}></i>}
            </div>
          </div>
        )}

        {/* Navegación */}
        <nav style={{ flex: 1, padding: isSidebarCollapsed ? '14px 10px' : '14px 10px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', overflowX: 'hidden' }}>
          {tabGroups.map((group, idx) => {
            const groupItems = group.items.filter(t => 
              (!t.superAdminOnly || isSuperAdmin) && 
              (!t.adminOnly || userRole === 'admin' || isSuperAdmin)
            );
            if (groupItems.length === 0) return null;
            return (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {!isSidebarCollapsed ? (
                  <p style={{ margin: '0 0 4px 10px', fontSize: '10px', fontWeight: '700', color: textSec, textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>
                    {group.title}
                  </p>
                ) : (
                  <div style={{ height: 1, background: borderCol, margin: '8px 10px' }} title={group.title} />
                )}
                {groupItems.map(t => {
                  const isActive = currentTab === t.id;
                  return (
                    <button key={t.id} onClick={() => setTab(t.id)} title={isSidebarCollapsed ? t.label : ''}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '9px',
                        padding: isSidebarCollapsed ? '12px 0' : '9px 12px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                        justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                        background: isActive
                          ? `linear-gradient(135deg, ${brandColor}22, ${brandColor}11)`
                          : 'transparent',
                        color: isActive ? brandColor : textSec,
                        fontWeight: isActive ? '600' : '500',
                        fontSize: '13px', transition: 'all 0.15s', width: '100%',
                        borderLeft: isActive && !isSidebarCollapsed ? `3px solid ${brandColor}` : '3px solid transparent',
                        boxShadow: isActive ? `inset 0 0 0 1px ${brandColor}20` : 'none',
                        position: 'relative'
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
                      <i className={`ti ${t.icon}`} style={{ fontSize: isSidebarCollapsed ? '20px' : '15px', flexShrink: 0 }} />
                      {!isSidebarCollapsed && <span style={{ whiteSpace: 'nowrap' }}>{t.label}</span>}
                      {t.superAdminOnly && !isSidebarCollapsed && (
                        <span style={{ marginLeft: 'auto', fontSize: '9px', background: '#0b8cf51e', color: '#24b9eb', border: '1px solid #0b84f530', borderRadius: '4px', padding: '1px 5px', fontWeight: '700' }}>MASTER</span>
                      )}
                      {t.badge > 0 && !isSidebarCollapsed && (
                        <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: '700', background: t.badgeColor || '#E24B4A', color: '#fff', borderRadius: 20, padding: '1px 7px', minWidth: 20, textAlign: 'center', animation: 'badge-pop 0.3s ease-out' }}>{t.badge}</span>
                      )}
                      {t.badge > 0 && isSidebarCollapsed && (
                        <div style={{ position: 'absolute', top: 6, right: 12, width: 8, height: 8, borderRadius: '50%', background: t.badgeColor || '#E24B4A' }} />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Footer sidebar */}
        <div style={{ padding: isSidebarCollapsed ? '14px 10px' : '14px', borderTop: `1px solid ${borderCol}`, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
          {/* Rol badge */}
          {!isSidebarCollapsed && (
            <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontSize: '10px', padding: '3px 9px', borderRadius: '20px',
                background: isSuperAdmin ? '#f59e0b15' : userRole === 'admin' ? '#2563eb15' : '#1D9E7515',
                color: isSuperAdmin ? '#f59e0b' : userRole === 'admin' ? '#2563eb' : '#1D9E75',
                border: `1px solid ${isSuperAdmin ? '#f59e0b30' : userRole === 'admin' ? '#2563eb30' : '#1D9E7530'}`,
                fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                {isSuperAdmin ? '⚡ Super Admin' : userRole === 'admin' ? 'Admin' : 'Agente'}
              </span>
            </div>
          )}

          {!isSidebarCollapsed && (
            <>
              <p style={{ margin: '0 0 2px', fontSize: '10px', color: textSec }}>Conectado como</p>
              <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: '500', wordBreak: 'break-all', color: textMain }}>{userEmail}</p>
            </>
          )}

          {/* Install PWA Button */}
          {deferredPrompt && (
            <button onClick={handleInstallClick} title="Instalar App Móvil"
              style={{ width: '100%', padding: '7px', borderRadius: '8px', border: `1px solid #1D9E7550`, background: '#1D9E7515', color: '#1D9E75', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: isSidebarCollapsed ? '16px' : '12px', marginBottom: '6px', fontWeight: '600' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#1D9E7530'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#1D9E7515'; }}
            >
              <i className="ti ti-download" /> {!isSidebarCollapsed && 'Instalar App'}
            </button>
          )}

          {/* Theme toggle */}
          <button onClick={() => setTheme(isDark ? 'light' : 'dark')} title={isDark ? 'Modo Claro' : 'Modo Oscuro'}
            style={{ width: '100%', padding: '7px', borderRadius: '8px', border: `1px solid ${borderCol}`, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', color: textSec, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: isSidebarCollapsed ? '16px' : '12px', marginBottom: '6px' }}>
            {isDark ? <i className="ti ti-sun" /> : <i className="ti ti-moon" />}
            {!isSidebarCollapsed && (isDark ? 'Modo Claro' : 'Modo Oscuro')}
          </button>

          {/* Mi Perfil */}
          <button onClick={() => setTab('profile')} title="Mi Perfil"
            style={{ width: '100%', padding: '7px', borderRadius: '8px', border: `1px solid ${currentTab === 'profile' ? brandColor + '40' : borderCol}`, background: currentTab === 'profile' ? brandColor + '10' : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', color: currentTab === 'profile' ? brandColor : textSec, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: isSidebarCollapsed ? '16px' : '12px', marginBottom: '6px' }}>
            <i className="ti ti-user" /> {!isSidebarCollapsed && 'Mi Perfil'}
          </button>

          {/* Logout */}
          <button onClick={handleLogout} title="Cerrar Sesión"
            style={{ width: '100%', padding: '7px', borderRadius: '8px', border: `1px solid ${borderCol}`, background: 'transparent', color: textSec, cursor: 'pointer', transition: 'all 0.2s', fontSize: isSidebarCollapsed ? '16px' : '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = textSec; e.currentTarget.style.borderColor = borderCol; }}>
            <i className="ti ti-logout" style={{ marginRight: isSidebarCollapsed ? 0 : 5 }} />
            {!isSidebarCollapsed && 'Cerrar Sesión'}
          </button>
        </div>
      </aside>

      {/* ── Contenido principal ── */}
      <main className="mobile-full-width" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, background: 'transparent', overflowY: 'auto', transition: 'background 0.4s' }}>
        
        {/* Mobile Header (Solo visible en móvil) */}
        <div className="mobile-only-flex mobile-header" style={{ display: 'none', alignItems: 'center', padding: '12px 16px', background: sidebarBg, borderBottom: `1px solid ${borderCol}`, zIndex: 90 }}>
          <button 
            onClick={() => setIsMobileSidebarOpen(true)}
            style={{ background: 'transparent', border: 'none', color: textMain, fontSize: 24, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
          >
            <i className="ti ti-menu-2"></i>
          </button>
          <div style={{ flex: 1, textAlign: 'center', fontWeight: 600, color: brandColor, fontSize: 16 }}>
            {tenantName && !isSuperAdmin ? tenantName : 'KUDEN IA'}
          </div>
          <div style={{ width: 24 }}></div> {/* Spacer para centrar título */}
        </div>

        <div className="mobile-p-0" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '28px 32px', maxWidth: '1640px', width: '100%', margin: '0 auto', animation: 'fadeSlideIn 0.25s ease-out' }}>
          {typeof children === 'function' ? children(isDark) : children}
        </div>

        {/* Floating Contextual Kimi */}
        {copilotAccess && currentTab !== 'copilot' && (
          <KimiWidget tenantId={tenantId} isDark={isDark} currentTab={currentTab} />
        )}
      </main>
    </div>
  );
}
