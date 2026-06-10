import React, { useState, useEffect } from 'react';
const API_URL = import.meta.env.VITE_API_URL || '';

export default function DashboardLayout({ userEmail, tenantName, tenantId, tenantLogo, tenantColor, isSuperAdmin, userRole, currentTab, setTab, handleLogout, children }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('kuden_theme') || 'dark';
  });
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    localStorage.setItem('kuden_theme', theme);
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

  const bgMain    = isDark ? "#0a0a0a" : "#f3f4f6";
  const bgSidebar = isDark ? "#111111" : "#ffffff";
  const borderCol = isDark ? "#222222" : "#e5e7eb";
  const textMain  = isDark ? "#ffffff" : "#111827";
  const textSec   = isDark ? "#aaaaaa" : "#6b7280";
  const btnHoverBg   = isDark ? "#222222" : "#f3f4f6";
  const btnHoverText = isDark ? "#ffffff" : "#111827";

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
        { id: 'tenants',    label: 'Empresas',      icon: 'ti-building', superAdminOnly: true },
        { id: 'global_keys',label: 'Llaves API',    icon: 'ti-key',      superAdminOnly: true },
        { id: 'billing',    label: 'Tarificador',   icon: 'ti-receipt',  superAdminOnly: true }
      ]
    }
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: bgMain, color: textMain, transition: "background-color 0.3s, color 0.3s" }}>

      {/* ── Sidebar ── */}
      <aside style={{ width: "260px", backgroundColor: bgSidebar, borderRight: `1px solid ${borderCol}`, display: "flex", flexDirection: "column", transition: "background-color 0.3s, border-color 0.3s", backdropFilter: "blur(10px)" }}>

        {/* Logo */}
        <div style={{ padding: "20px", borderBottom: `1px solid ${borderCol}`, display: "flex", alignItems: "center", gap: "12px" }}>
          {tenantLogo ? (
            <img src={tenantLogo} alt="Logo Empresa" style={{ width: 36, height: 36, borderRadius: "8px", objectFit: "contain", flexShrink: 0, background: isDark ? '#fff' : 'transparent' }} />
          ) : (
            <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: tenantColor, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 12px ${tenantColor}40` }}>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 18 }}>{tenantName ? tenantName.charAt(0).toUpperCase() : 'K'}</span>
            </div>
          )}
          <div>
            <p style={{ margin: 0, fontWeight: "bold", fontSize: "16px", color: tenantColor || "#60a5fa", letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160 }}>
              {tenantName && !isSuperAdmin ? tenantName : "KUDEN IA"}
            </p>
            <p style={{ margin: 0, fontSize: "11px", color: textSec }}>
              {isSuperAdmin ? "⚡ Super Admin" : "Panel de Control"}
            </p>
          </div>
        </div>

        {/* Empresa actual */}
        {tenantName && (
          <div style={{ padding: "12px 20px", borderBottom: `1px solid ${borderCol}`, display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: isSuperAdmin ? "#f59e0b" : "#1D9E75", flexShrink: 0 }}></div>
            <p style={{ margin: 0, fontSize: "12px", color: textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {tenantName}
            </p>
          </div>
        )}

        {/* Navegación */}
        <nav style={{ flex: 1, padding: "16px 10px", display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto" }}>
          {tabGroups.map((group, idx) => {
            const groupItems = group.items.filter(t => !t.superAdminOnly || isSuperAdmin);
            if (groupItems.length === 0) return null;
            return (
              <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <p style={{ margin: "0 0 4px 10px", fontSize: "11px", fontWeight: "600", color: textSec, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {group.title}
                </p>
                {groupItems.map(t => (
                  <button key={t.id} onClick={() => setTab(t.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      padding: "9px 14px", borderRadius: "8px", border: "none", cursor: "pointer",
                      backgroundColor: currentTab === t.id ? (tenantColor || "#2563eb") : "transparent",
                      color: currentTab === t.id ? "#ffffff" : textSec,
                      fontWeight: currentTab === t.id ? "600" : "500",
                      fontSize: "13px", transition: "all 0.15s", textAlign: "left", width: "100%"
                    }}
                    onMouseEnter={(e) => { if (currentTab !== t.id) { e.currentTarget.style.backgroundColor = btnHoverBg; e.currentTarget.style.color = btnHoverText; } }}
                    onMouseLeave={(e) => { if (currentTab !== t.id) { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = textSec; } }}
                  >
                    <i className={`ti ${t.icon}`} style={{ fontSize: "16px", flexShrink: 0 }}></i>
                    {t.label}
                    {t.superAdminOnly && (
                      <span style={{ marginLeft: "auto", fontSize: "9px", background: "#f59e0b20", color: "#f59e0b", border: "1px solid #f59e0b40", borderRadius: "4px", padding: "1px 5px", fontWeight: "600" }}>MASTER</span>
                    )}
                    {t.badge > 0 && (
                      <span style={{ marginLeft: "auto", fontSize: "10px", fontWeight: "700", background: t.badgeColor || '#E24B4A', color: "#fff", borderRadius: 20, padding: "1px 7px", minWidth: 20, textAlign: "center" }}>{t.badge}</span>
                    )}
                  </button>
                ))}
              </div>
            );
          })}
        </nav>

        {/* Footer sidebar */}
        <div style={{ padding: "16px", borderTop: `1px solid ${borderCol}` }}>
          {/* Rol badge */}
          <div style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "20px",
              background: isSuperAdmin ? "#f59e0b20" : userRole === "admin" ? "#2563eb20" : "#1D9E7520",
              color:      isSuperAdmin ? "#f59e0b"   : userRole === "admin" ? "#60a5fa"   : "#1D9E75",
              border: `1px solid ${isSuperAdmin ? "#f59e0b40" : userRole === "admin" ? "#2563eb40" : "#1D9E7540"}`,
              fontWeight: "600", textTransform: "uppercase" }}>
              {isSuperAdmin ? "Super Admin" : userRole === "admin" ? "Admin" : "Agente"}
            </span>
          </div>

          {/* Correo */}
          <p style={{ margin: "0 0 4px", fontSize: "11px", color: textSec }}>Conectado como</p>
          <p style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: "500", wordBreak: "break-all", color: textMain }}>{userEmail}</p>

          {/* Theme toggle */}
          <button onClick={() => setTheme(isDark ? 'light' : 'dark')}
            style={{ width: "100%", padding: "8px", borderRadius: "8px", border: `1px solid ${borderCol}`, backgroundColor: "transparent", color: textSec, cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "13px", marginBottom: "8px" }}>
            {isDark ? <><i className="ti ti-sun"></i> Cambiar a Modo Claro</> : <><i className="ti ti-moon"></i> Cambiar a Modo Oscuro</>}
          </button>

          {/* Mi Perfil */}
          <button onClick={() => setTab('profile')}
            style={{ width: "100%", padding: "8px", borderRadius: "8px", border: `1px solid ${currentTab === 'profile' ? '#2563eb' : borderCol}`, backgroundColor: currentTab === 'profile' ? '#2563eb15' : "transparent", color: currentTab === 'profile' ? '#60a5fa' : textSec, cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "13px", marginBottom: "8px" }}
            onMouseEnter={(e) => { if (currentTab !== 'profile') { e.target.style.backgroundColor = btnHoverBg; e.target.style.color = btnHoverText; } }}
            onMouseLeave={(e) => { if (currentTab !== 'profile') { e.target.style.backgroundColor = "transparent"; e.target.style.color = textSec; } }}
          >
            <i className="ti ti-user"></i> Mi Perfil
          </button>

          {/* Logout */}
          <button onClick={handleLogout}
            style={{ width: "100%", padding: "8px", borderRadius: "8px", border: `1px solid ${borderCol}`, backgroundColor: "transparent", color: textSec, cursor: "pointer", transition: "all 0.2s", fontSize: "13px" }}
            onMouseEnter={(e) => { e.target.style.backgroundColor = "#ef444420"; e.target.style.color = "#f87171"; e.target.style.borderColor = "#ef444440"; }}
            onMouseLeave={(e) => { e.target.style.backgroundColor = "transparent"; e.target.style.color = textSec; e.target.style.borderColor = borderCol; }}>
            Cerrar Sesión
          </button>
        </div>
      </div>

      {/* ── Contenido principal ── */}
      <div style={{ flex: 1, backgroundColor: bgMain, overflowY: "auto", transition: "background-color 0.3s" }}>
        <div style={{ padding: "32px", maxWidth: "1100px" }}>
          {typeof children === 'function' ? children(isDark) : children}
        </div>
      </div>
    </div>
  );
}
