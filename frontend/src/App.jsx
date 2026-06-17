import React, { useState, useEffect } from 'react';
import KudenSimulator from "./simulator/KudenSimulator.jsx";
import Login from "./auth/Login.jsx";
import DashboardLayout from "./admin/DashboardLayout.jsx";
import TenantsManager from "./admin/TenantsManager.jsx";
import UsersManager from "./admin/UsersManager.jsx";
import ProfilesManager from "./admin/ProfilesManager.jsx";
import ContactsManager from "./admin/ContactsManager.jsx";
import AIConfigManager from "./admin/AIConfigManager.jsx";
import CRMManager from "./admin/CRMManager.jsx";
import CampaignsManager from "./admin/CampaignsManager.jsx";
import WidgetSettings from "./admin/WidgetSettings.jsx";
import GlobalKeysManager from './admin/GlobalKeysManager.jsx';
import BillingDashboard from './admin/BillingDashboard.jsx';
import UserProfile from './admin/UserProfile.jsx';
import SystemHealthDashboard from './admin/SystemHealthDashboard.jsx';
import CopilotManager from './admin/CopilotManager.jsx';
import KimiInsights from './admin/KimiInsights.jsx';
import IntegrationsHub from './admin/IntegrationsHub.jsx';
import { supabase } from "./lib/supabaseClient.js";

const MASTER_TENANT_NAME = "Kuden Demo Tenant";

export default function App() {
  const [session,    setSession]    = useState(null);
  const [tenantId,   setTenantId]   = useState(null);
  const [tenantName, setTenantName] = useState(null);
  const [tenantLogo, setTenantLogo] = useState(null);
  const [tenantColor, setTenantColor] = useState(null);
  const [userRole,   setUserRole]   = useState(null);
  const [copilotAccess, setCopilotAccess] = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [currentTab, setCurrentTab] = useState('crm');
  const [accessDeniedMsg, setAccessDeniedMsg] = useState(null);

  const [impersonatedTenantId, setImpersonatedTenantId] = useState(null);
  const [allTenants, setAllTenants] = useState([]);

  const isSuperAdmin = tenantName === MASTER_TENANT_NAME;
  const activeTenantId = impersonatedTenantId || tenantId;

  // Derive active tenant details
  const activeTenant = impersonatedTenantId
    ? allTenants.find(t => t.id === impersonatedTenantId)
    : { name: tenantName, logo_url: tenantLogo, primary_color: tenantColor };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchTenantInfo(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchTenantInfo(session.user.id);
      else { setTenantId(null); setTenantName(null); setTenantLogo(null); setTenantColor(null); setUserRole(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchTenantInfo = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('tenant_users')
        .select('tenant_id, role, is_active, copilot_access, tenants(name, is_active, logo_url, primary_color)')
        .eq('user_id', userId)
        .single();
      if (error) throw error;
      if (data) {
        if (data.is_active === false || data.tenants?.is_active === false) {
          setAccessDeniedMsg("Tu cuenta o la empresa a la que perteneces ha sido desactivada. Contacta al soporte.");
          setTenantId(null);
          setTenantName(null);
          setTenantLogo(null);
          setTenantColor(null);
          setUserRole(null);
        } else {
          setTenantId(data.tenant_id);
          setUserRole(data.role);
          setCopilotAccess(data.copilot_access || false);
          setTenantName(data.tenants?.name || null);
          setTenantLogo(data.tenants?.logo_url || null);
          setTenantColor(data.tenants?.primary_color || null);
          setAccessDeniedMsg(null);

          // Si es superadmin, obtener la lista de clientes para impersonation
          if (data.tenants?.name === MASTER_TENANT_NAME) {
            const { data: tData } = await supabase
              .from('tenants')
              .select('id, name, logo_url, primary_color')
              .eq('is_active', true)
              .order('name');
            if (tData) setAllTenants(tData);
          } else {
            // Asegurarnos de limpiar el estado si es un usuario normal
            setAllTenants([]);
            setImpersonatedTenantId(null);
          }
        }
      }
    } catch (err) { console.error("Error obteniendo tenant_info:", err.message); }
    finally { setLoading(false); }
  };

  const handleLogout = async () => { 
    setImpersonatedTenantId(null);
    setAllTenants([]);
    await supabase.auth.signOut(); 
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#0a0a0a", color: "#fff" }}>
      Cargando Kuden IA...
    </div>
  );

  if (!session) return <Login />;

  if (accessDeniedMsg) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: "#0a0a0a", color: "#fff", padding: 20, textAlign: "center" }}>
        <i className="ti ti-ban" style={{ fontSize: 64, color: "#E24B4A", marginBottom: 20 }}></i>
        <h1 style={{ fontSize: 24, marginBottom: 10 }}>Acceso Suspendido</h1>
        <p style={{ color: "#aaa", marginBottom: 30, maxWidth: 400 }}>{accessDeniedMsg}</p>
        <button onClick={handleLogout} style={{ padding: "10px 24px", background: "#E24B4A", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: "bold" }}>
          Cerrar Sesión
        </button>
      </div>
    );
  }

  const AccessDenied = ({ isDark }) => (
    <div style={{ padding: "60px 40px", textAlign: "center", color: isDark ? "#666" : "#9ca3af" }}>
      <i className="ti ti-lock" style={{ fontSize: "48px", display: "block", marginBottom: "16px" }}></i>
      <h2 style={{ margin: "0 0 8px", color: isDark ? "#fff" : "#111" }}>Acceso restringido</h2>
      <p style={{ margin: 0 }}>Solo los administradores de Kuden pueden acceder a esta sección.</p>
    </div>
  );

  const renderContent = (isDark) => {
    switch (currentTab) {
      case 'simulator':
        return activeTenantId
          ? <KudenSimulator tenantId={activeTenantId} />
          : <div style={{ padding: "40px", textAlign: "center", color: "#666" }}><h2>Sin empresa asignada</h2></div>;

      case 'contacts':
        return <ContactsManager tenantId={activeTenantId} isDark={isDark} />;

      case 'profiles':
        return <ProfilesManager tenantId={activeTenantId} isDark={isDark} isSuperAdmin={isSuperAdmin && !impersonatedTenantId} actualTenantId={tenantId} allTenants={allTenants} />;

      case 'users':
        return <UsersManager isDark={isDark} filterTenantId={isSuperAdmin && !impersonatedTenantId ? null : activeTenantId} isSuperAdmin={isSuperAdmin && !impersonatedTenantId} />;

      case 'ai_config':
        if (!isSuperAdmin) return <AccessDenied isDark={isDark} />;
        return <AIConfigManager tenantId={activeTenantId} isDark={isDark} />;

      case 'global_keys':
        if (!isSuperAdmin) return <AccessDenied isDark={isDark} />;
        return <GlobalKeysManager isDark={isDark} />;

      case 'billing':
        if (!isSuperAdmin) return <AccessDenied isDark={isDark} />;
        return <BillingDashboard isDark={isDark} />;

      case 'integrations':
        if (userRole !== 'admin' && !isSuperAdmin) return <AccessDenied isDark={isDark} />;
        return <IntegrationsHub isDark={isDark} tenantId={activeTenantId} />;

      case 'profile':
        return <UserProfile isDark={isDark} userEmail={session?.user?.email} />;

      case 'tenants':
        if (!isSuperAdmin) return <AccessDenied isDark={isDark} />;
        return <TenantsManager isDark={isDark} />;

      case 'campaigns':
        return <CampaignsManager tenantId={activeTenantId} isDark={isDark} />;

      case 'crm':
        return (
          <CRMManager
            tenantId={activeTenantId}
            isDark={isDark}
            userId={session?.user?.id}
            userEmail={session?.user?.email}
            userRole={userRole}
            isSuperAdmin={isSuperAdmin && !impersonatedTenantId}
          />
        );

      case 'monitoring':
        if (!isSuperAdmin) return <AccessDenied isDark={isDark} />;
        return <SystemHealthDashboard isDark={isDark} />;

      case 'copilot':
        if (!copilotAccess) return <AccessDenied isDark={isDark} />;
        return <CopilotManager tenantId={activeTenantId} isDark={isDark} />;

      case 'insights':
        if (!copilotAccess) return <AccessDenied isDark={isDark} />;
        return <KimiInsights tenantId={activeTenantId} isDark={isDark} />;

      default:
        return null;
    }
  };

  return (
    <DashboardLayout
      userEmail={session.user.email}
      tenantName={activeTenant?.name || tenantName}
      tenantId={activeTenantId}
      tenantLogo={activeTenant?.logo_url || tenantLogo}
      tenantColor={activeTenant?.primary_color || tenantColor}
      isSuperAdmin={isSuperAdmin}
      userRole={userRole}
      copilotAccess={copilotAccess}
      currentTab={currentTab}
      setTab={setCurrentTab}
      handleLogout={handleLogout}
      // Nuevos props para Impersonation
      allTenants={allTenants}
      impersonatedTenantId={impersonatedTenantId}
      setImpersonatedTenantId={setImpersonatedTenantId}
      originalTenantName={tenantName}
    >
      {(isDark) => renderContent(isDark)}
    </DashboardLayout>
  );
}
