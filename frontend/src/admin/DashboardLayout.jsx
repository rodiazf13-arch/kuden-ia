import React, { useState, useEffect } from 'react';
import KimiWidget from './KimiWidget';
const API_URL = import.meta.env.VITE_API_URL || '';

export default function DashboardLayout({ userEmail, tenantName, tenantId, tenantLogo, tenantColor, isSuperAdmin, userRole, copilotAccess, currentTab, setTab, handleLogout, allTenants, impersonatedTenantId, setImpersonatedTenantId, originalTenantName, children }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('kuden_theme') || 'light'; // Light mode por defecto
  });
  const [alertCount, setAlertCount] = useState(0);
  const [impersonateOpen, setImpersonateOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
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
  const brandColor = tenantColor || '#635BFF';

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
        { id: 'campaigns', label: 'Campañas', icon: 'ti-speakerphone', adminOnly: true },
        { id: 'contacts', label: 'Contactos', icon: 'ti-address-book' }
      ]
    },
    {
      title: 'Motor IA',
      items: [
        { id: 'ai_config', label: 'Identidad Maestra', icon: 'ti-brain', superAdminOnly: true },
        { id: 'profiles', label: 'Perfiles IA', icon: 'ti-robot', superAdminOnly: true },
        ...(copilotAccess ? [
          { id: 'copilot', label: 'Co-Piloto (Kimi)', icon: 'ti-bulb', badgeColor: '#635BFF' },
          { id: 'insights', label: 'Kimi Insights (BI)', icon: 'ti-chart-bar' }
        ] : [])
      ]
    },
    {
      title: 'Administración',
      items: [
        { id: 'users', label: 'Usuarios y Grupos', icon: 'ti-users', adminOnly: true },
        { id: 'tenants', label: 'Empresas', icon: 'ti-building', superAdminOnly: true },
        { id: 'global_keys', label: 'Gestión APIs y LLM', icon: 'ti-key', superAdminOnly: true },
        { id: 'billing', label: 'Tarificador', icon: 'ti-receipt', superAdminOnly: true },
        { id: 'monitoring', label: 'Health Monitor', icon: 'ti-activity', superAdminOnly: true },
      ]
    }
  ];

  return (
    <div
      className="dashboard-layout-wrapper"
      data-theme={theme}
      style={{
        '--color-brand': brandColor,
        '--color-brand-hover': tenantColor ? `${tenantColor}dd` : 'var(--color-primary-hover)'
      }}
    >
      {/* ── Mobile Sidebar Overlay ── */}
      <div 
        className={`sidebar-overlay ${isMobileSidebarOpen ? 'open' : ''}`} 
        onClick={() => setIsMobileSidebarOpen(false)}
      ></div>

      {/* ── Sidebar ── */}
      <aside className={`sidebar-container ${isMobileSidebarOpen ? 'open' : ''} ${isSidebarCollapsed ? 'collapsed' : ''}`}>

        {/* Botón para colapsar/expandir */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          title={isSidebarCollapsed ? "Expandir" : "Contraer"}
          className="sidebar-collapse-btn"
        >
          <i className={`ti ti-chevron-${isSidebarCollapsed ? 'right' : 'left'}`} style={{ fontSize: '14px' }}></i>
        </button>

        {/* Logo */}
        <div className="sidebar-logo-container">
          {tenantLogo ? (
            <img src={tenantLogo} alt="Logo Empresa" className="sidebar-tenant-logo-img" />
          ) : (
            <div className="sidebar-logo-fallback">
              <span className="sidebar-logo-fallback-letter">{tenantName ? tenantName.charAt(0).toUpperCase() : 'K'}</span>
            </div>
          )}
          {!isSidebarCollapsed && (
            <div style={{ overflow: 'hidden' }}>
              <p className="sidebar-logo-text-title">
                {tenantName && !isSuperAdmin ? tenantName : 'KUDEN IA'}
              </p>
              <p className="sidebar-logo-text-subtitle">
                {isSuperAdmin ? '⚡ Super Admin' : 'Panel de Control'}
              </p>
            </div>
          )}
        </div>

        {/* Empresa actual pill */}
        {tenantName && !isSidebarCollapsed && (
          <div className="sidebar-tenant-pill">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="sidebar-tenant-pill-avatar-container">
                {tenantLogo ? (
                  <img src={tenantLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <i className="ti ti-building" style={{ fontSize: 20, color: 'var(--color-brand)' }}></i>
                )}
              </div>
              <div className="sidebar-tenant-pill-info">
                <h2>{tenantName || 'Sin Empresa'}</h2>
                <span className="sidebar-tenant-pill-role-badge">{userRole === 'admin' ? 'Administrador' : 'Agente'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Empresa actual pill (Colapsado) */}
        {tenantName && isSidebarCollapsed && (
          <div className="sidebar-tenant-pill">
            <div className="sidebar-tenant-pill-avatar-container" title={tenantName}>
              {tenantLogo ? (
                <img src={tenantLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <i className="ti ti-building" style={{ fontSize: 20, color: 'var(--color-brand)' }}></i>
              )}
            </div>
          </div>
        )}

        {/* Navegación */}
        <nav className="sidebar-nav">
          {tabGroups.map((group, idx) => {
            const groupItems = group.items.filter(t => 
              (!t.superAdminOnly || isSuperAdmin) && 
              (!t.adminOnly || userRole === 'admin' || isSuperAdmin)
            );
            if (groupItems.length === 0) return null;
            return (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {!isSidebarCollapsed ? (
                  <p className="sidebar-nav-group-title">
                    {group.title}
                  </p>
                ) : (
                  <div className="sidebar-nav-group-divider" title={group.title} />
                )}
                {groupItems.map(t => {
                  const isActive = currentTab === t.id;
                  return (
                    <button key={t.id} onClick={() => setTab(t.id)} title={isSidebarCollapsed ? t.label : ''}
                      className={`sidebar-nav-btn ${isActive ? 'active' : ''}`}
                    >
                      <i className={`ti ${t.icon}`} />
                      {!isSidebarCollapsed && <span style={{ whiteSpace: 'nowrap' }}>{t.label}</span>}
                      {t.superAdminOnly && !isSidebarCollapsed && (
                        <span className="sidebar-nav-role-badge">MASTER</span>
                      )}
                      {t.badge > 0 && !isSidebarCollapsed && (
                        <span className="sidebar-nav-counter-badge" style={t.badgeColor ? { background: t.badgeColor } : {}}>{t.badge}</span>
                      )}
                      {t.badge > 0 && isSidebarCollapsed && (
                        <div className="sidebar-nav-counter-badge-dot" style={t.badgeColor ? { background: t.badgeColor } : {}} />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Footer sidebar */}
        <div className="sidebar-footer">
          
          {/* Profile Menu Popup */}
          {profileMenuOpen && (
            <div className="sidebar-profile-menu">
              
              {/* Impersonation Dropdown for SuperAdmins inside Menu */}
              {(isSuperAdmin || impersonatedTenantId) && allTenants?.length > 0 && (
                <div className="impersonate-wrapper">
                  <button
                    onClick={() => setImpersonateOpen(!impersonateOpen)}
                    className={`impersonate-btn ${impersonatedTenantId ? 'active' : ''}`}
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
                    <div className="impersonate-dropdown">
                      <button
                        onClick={() => { setImpersonatedTenantId(null); setImpersonateOpen(false); setProfileMenuOpen(false); }}
                        className={`impersonate-option ${!impersonatedTenantId ? 'active' : ''}`}
                      >
                        <i className="ti ti-shield" style={{ marginRight: 6, color: 'var(--color-brand)' }}></i>
                        {originalTenantName} (Vista Original)
                      </button>
                      {allTenants.map(t => (
                        <button
                          key={t.id}
                          onClick={() => { setImpersonatedTenantId(t.id); setImpersonateOpen(false); setProfileMenuOpen(false); }}
                          className={`impersonate-option ${impersonatedTenantId === t.id ? 'active' : ''}`}
                        >
                          <i className="ti ti-building" style={{ marginRight: 6, color: 'var(--color-text-secondary)' }}></i>
                          {t.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {deferredPrompt && (
                <button onClick={handleInstallClick} className="profile-menu-item install-app">
                  <i className="ti ti-download" /> Instalar App Móvil
                </button>
              )}

              <button onClick={() => { setTheme(isDark ? 'light' : 'dark'); setProfileMenuOpen(false); }} className="profile-menu-item">
                {isDark ? <i className="ti ti-sun" /> : <i className="ti ti-moon" />}
                {isDark ? 'Modo Claro' : 'Modo Oscuro'}
              </button>

              <button onClick={() => { setTab('profile'); setProfileMenuOpen(false); }} className="profile-menu-item">
                <i className="ti ti-user" /> Mi Perfil
              </button>

              <div className="sidebar-nav-group-divider" style={{ margin: '4px 0' }}></div>

              <button onClick={handleLogout} className="profile-menu-item logout">
                <i className="ti ti-logout" /> Cerrar Sesión
              </button>
            </div>
          )}

          {/* User Button */}
          <button 
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            className={`sidebar-user-btn ${profileMenuOpen ? 'active' : ''}`}
          >
            <div className="sidebar-user-btn-content">
              <div className="sidebar-user-avatar">
                {userEmail ? userEmail.charAt(0).toUpperCase() : 'U'}
              </div>
              {!isSidebarCollapsed && (
                <div className="sidebar-user-info">
                  <p className="sidebar-user-info-label">Conectado como</p>
                  <p className="sidebar-user-info-email">
                    {userEmail}
                  </p>
                </div>
              )}
            </div>
            {!isSidebarCollapsed && (
              <i className="ti ti-dots-vertical"></i>
            )}
          </button>
        </div>
      </aside>

      {/* ── Contenido principal ── */}
      <main className="mobile-full-width dashboard-main-content">
        
        {/* Mobile Header (Solo visible en móvil) */}
        <div className="mobile-only-flex mobile-header dashboard-mobile-header">
          <button 
            onClick={() => setIsMobileSidebarOpen(true)}
            className="mobile-sidebar-toggle"
          >
            <i className="ti ti-menu-2"></i>
          </button>
          <div className="mobile-header-title">
            {tenantName && !isSuperAdmin ? tenantName : 'KUDEN IA'}
          </div>
          <div style={{ width: 24 }}></div>
        </div>

        <div className="mobile-p-0 dashboard-page-container">
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
