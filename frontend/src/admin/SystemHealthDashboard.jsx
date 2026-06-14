import React, { useState, useEffect, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import KimiMascot from '../KimiMascot.jsx';

const API_URL = import.meta.env.VITE_API_URL || '';

const SEV_CONFIG = {
  critical: { label: 'Crítico',    color: '#E24B4A', bg: '#FDECEA', icon: 'ti-alert-octagon'   },
  error:    { label: 'Error',      color: '#D85A30', bg: '#FAECE7', icon: 'ti-circle-x'         },
  critical_error: { label: 'Errores', color: '#E24B4A', bg: '#FDECEA', icon: 'ti-alert-octagon' },
  warning:  { label: 'Advertencia',color: '#EF9F27', bg: '#FEF3E0', icon: 'ti-alert-triangle'   },
  info:     { label: 'Info',       color: '#2563eb', bg: '#EFF6FF', icon: 'ti-info-circle'       },
  debug:    { label: 'Debug',      color: '#6b7280', bg: '#f3f4f6', icon: 'ti-bug'               },
};

function SevBadge({ severity }) {
  const s = SEV_CONFIG[severity] || SEV_CONFIG.info;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: s.color, background: s.bg, border: `0.5px solid ${s.color}40`, borderRadius: 20, padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
      <i className={`ti ${s.icon}`} style={{ fontSize: 10 }} /> {s.label}
    </span>
  );
}

function KpiCard({ icon, label, value, color, sub, isDark, onClick, active }) {
  const c = isDark ? { card: '#161622', border: '#2a2a3a' } : { card: '#fff', border: '#e5e7eb' };
  return (
    <div
      onClick={onClick}
      style={{
        background: active ? `linear-gradient(135deg, ${color}18, ${color}08)` : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.85)'),
        backdropFilter: 'blur(12px)',
        border: `1px solid ${active ? color + '50' : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)')}`,
        borderRadius: 14, padding: '14px 16px',
        display: 'flex', flexDirection: 'column', gap: 6,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s',
        boxShadow: active ? `0 0 20px ${color}20` : '0 4px 12px rgba(0,0,0,0.06)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className={`ti ${icon}`} style={{ fontSize: 16, color }} />
        </div>
        <p style={{ margin: 0, fontSize: 11, color: isDark ? '#9ca3af' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</p>
      </div>
      <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color, fontFamily: 'Outfit, sans-serif', lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ margin: 0, fontSize: 11, color: isDark ? '#6b7280' : '#9ca3af' }}>{sub}</p>}
    </div>
  );
}

export default function SystemHealthDashboard({ isDark }) {
  const [logs,     setLogs]     = useState([]);
  const [stats,    setStats]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [severity, setSeverity] = useState('all');
  const [search,   setSearch]   = useState('');
  const [expanded, setExpanded] = useState(null);
  const [from,     setFrom]     = useState(() => {
    const d = new Date(); d.setHours(0,0,0,0); return d.toISOString().slice(0,16);
  });

  const textMain = isDark ? '#f9fafb' : '#111827';
  const textSec  = isDark ? '#9ca3af' : '#6b7280';
  const cardBg   = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.85)';
  const border   = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (severity !== 'all') params.set('severity', severity);
      if (search) params.set('search', search);
      if (from)   params.set('from', new Date(from).toISOString());
      const res  = await fetch(`${API_URL}/api/admin/audit-logs?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setLogs(data.logs || []);
      setStats(data.stats || null);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [severity, search, from]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => {
    const t = setInterval(fetchLogs, 10000); // Auto-refresh cada 10s
    return () => clearInterval(t);
  }, [fetchLogs]);

  const resolveLog = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/audit-logs/${id}/resolve`, { method: 'PUT' });
      if (res.ok) fetchLogs();
    } catch (e) {
      console.error(e);
    }
  };

  // Agrupar logs por hora para el gráfico
  const chartData = (() => {
    const buckets = {};
    logs.forEach(l => {
      const hour = new Date(l.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
      if (!buckets[hour]) buckets[hour] = { time: hour, error: 0, warning: 0, info: 0, debug: 0 };
      const sev = (l.severity === 'critical' || l.severity === 'error') ? 'error' : l.severity;
      buckets[hour][sev] = (buckets[hour][sev] || 0) + 1;
    });
    return Object.values(buckets).slice(0, 24).reverse();
  })();

  const criticalCount = (stats?.bySeverity?.critical || 0) + (stats?.bySeverity?.error || 0);
  const systemOk = criticalCount === 0;

  const kpis = [
    { icon: 'ti-list',          label: 'Total Eventos',   value: stats?.total || 0,          color: '#2563eb', id: 'all'      },
    { icon: 'ti-alert-octagon', label: 'Errores Críticos',value: criticalCount,               color: '#E24B4A', id: 'critical_error' },
    { icon: 'ti-alert-triangle',label: 'Advertencias',    value: stats?.bySeverity?.warning || 0, color: '#EF9F27', id: 'warning' },
    { icon: 'ti-info-circle',   label: 'Informativos',    value: stats?.bySeverity?.info || 0,    color: '#1D9E75', id: 'info'    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeSlideIn 0.3s ease-out' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #534AB7, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(83,74,183,0.3)' }}>
            <i className="ti ti-activity" style={{ fontSize: 20, color: '#fff' }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, color: textMain, fontFamily: 'Outfit, sans-serif' }}>Health Monitor</h2>
            <p style={{ margin: 0, fontSize: 12, color: textSec }}>Sistema de Observabilidad Interno · Auto-refresh cada 10s</p>
          </div>
        </div>
        {/* Estado general */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <KimiMascot size={32} state={systemOk ? 'idle' : 'alert'} />
          <span style={{ fontSize: 12, fontWeight: 600, color: systemOk ? '#1D9E75' : '#E24B4A' }}>
            {systemOk ? 'Kimi dice: ¡Todo en orden!' : `${criticalCount} incidente${criticalCount > 1 ? 's' : ''} activo${criticalCount > 1 ? 's' : ''}`}
          </span>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {kpis.map(k => (
          <KpiCard key={k.id} {...k}
            isDark={isDark}
            active={severity === k.id}
            onClick={() => setSeverity(prev => prev === k.id ? 'all' : k.id)}
            sub={severity === k.id ? 'Filtro activo · Click para quitar' : 'Click para filtrar'}
          />
        ))}
      </div>

      {/* ── Gráfico de Eventos ── */}
      {chartData.length > 0 && (
        <div style={{ background: cardBg, backdropFilter: 'blur(12px)', border: `1px solid ${border}`, borderRadius: 14, padding: '16px 18px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
          <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: textMain }}>📈 Distribución temporal de eventos</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="grad-error" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#E24B4A" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#E24B4A" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-warning" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF9F27" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#EF9F27" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-info" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#222' : '#e5e7eb'} vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: textSec }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: textSec }} axisLine={false} tickLine={false} />
              <RTooltip contentStyle={{ background: isDark ? '#1a1a2e' : '#fff', border: `1px solid ${border}`, borderRadius: 8, color: textMain, fontSize: 12 }} />
              <Area type="monotone" dataKey="error"   stroke="#E24B4A" fill="url(#grad-error)"   strokeWidth={2} />
              <Area type="monotone" dataKey="warning" stroke="#EF9F27" fill="url(#grad-warning)" strokeWidth={1.5} />
              <Area type="monotone" dataKey="info"    stroke="#2563eb" fill="url(#grad-info)"    strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Filtros y tabla ── */}
      <div style={{ background: cardBg, backdropFilter: 'blur(12px)', border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
        {/* Barra de filtros */}
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${border}`, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Buscar en mensajes..."
            style={{ flex: 1, minWidth: 180, fontSize: 12, padding: '7px 10px', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', border: `1px solid ${border}`, borderRadius: 8, color: textMain }}
          />
          <input
            type="datetime-local" value={from} onChange={e => setFrom(e.target.value)}
            style={{ fontSize: 11, padding: '7px 8px', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', border: `1px solid ${border}`, borderRadius: 8, color: textMain }}
          />
          {['all','critical_error','warning','info','debug'].map(s => (
            <button key={s} onClick={() => setSeverity(s)}
              style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${severity === s ? (SEV_CONFIG[s]?.color || '#2563eb') + '80' : border}`, background: severity === s ? (SEV_CONFIG[s]?.color || '#2563eb') + '15' : 'transparent', color: severity === s ? (SEV_CONFIG[s]?.color || '#2563eb') : textSec, transition: 'all 0.15s' }}>
              {s === 'all' ? 'Todos' : SEV_CONFIG[s]?.label || s}
            </button>
          ))}
          <button onClick={fetchLogs} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer' }}>
            <i className="ti ti-refresh" style={{ marginRight: 4 }} />Actualizar
          </button>
        </div>

        {/* Tabla */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}>
                {['Timestamp', 'Severidad', 'Fuente', 'Mensaje', 'Tenant', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: textSec, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${border}`, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: textSec }}>Cargando logs...</td></tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px 20px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                      <KimiMascot size={48} state="happy" />
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1D9E75' }}>¡Sin eventos en este período!</p>
                      <p style={{ margin: 0, fontSize: 12, color: textSec }}>Kimi está tranquila — el sistema opera con normalidad.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map(log => {
                  const sev = SEV_CONFIG[log.severity] || SEV_CONFIG.info;
                  const isOpen = expanded === log.id;
                  const isResolved = log.metadata?.resolved === true;
                  return (
                    <React.Fragment key={log.id}>
                      <tr style={{ borderBottom: `1px solid ${border}`, opacity: isResolved ? 0.6 : 1, background: (!isResolved && (log.severity === 'critical' || log.severity === 'error')) ? (isDark ? 'rgba(226,75,74,0.04)' : 'rgba(226,75,74,0.02)') : 'transparent', transition: 'background 0.1s' }}
                        onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'}
                        onMouseLeave={e => e.currentTarget.style.background = (!isResolved && (log.severity === 'critical' || log.severity === 'error')) ? (isDark ? 'rgba(226,75,74,0.04)' : 'rgba(226,75,74,0.02)') : 'transparent'}
                      >
                        <td style={{ padding: '9px 14px', color: textSec, whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 11 }}>
                          {new Date(log.created_at).toLocaleString('es-CL', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit' })}
                        </td>
                        <td style={{ padding: '9px 14px' }}><SevBadge severity={log.severity} /></td>
                        <td style={{ padding: '9px 14px', color: textSec, fontFamily: 'monospace', fontSize: 11, whiteSpace: 'nowrap' }}>{log.source}</td>
                        <td style={{ padding: '9px 14px', color: textMain, maxWidth: 350, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: isResolved ? 'line-through' : 'none' }}>
                          {isResolved && <span style={{ color: '#1D9E75', fontWeight: 'bold', marginRight: 6 }}>[✓ Resuelto]</span>}
                          {log.message}
                        </td>
                        <td style={{ padding: '9px 14px', color: textSec, fontFamily: 'monospace', fontSize: 10 }}>{log.tenant_id ? log.tenant_id.slice(0,8) + '…' : '—'}</td>
                        <td style={{ padding: '9px 14px' }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            {log.metadata && Object.keys(log.metadata).length > 0 && (
                              <button onClick={() => setExpanded(isOpen ? null : log.id)}
                                style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, border: `1px solid ${border}`, background: 'transparent', color: textSec, cursor: 'pointer' }}>
                                {isOpen ? 'Cerrar' : 'Ver más'}
                              </button>
                            )}
                            {!isResolved && (log.severity === 'critical' || log.severity === 'error') && (
                              <button onClick={() => resolveLog(log.id)}
                                style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, border: `1px solid #1D9E75`, background: '#1D9E7515', color: '#1D9E75', cursor: 'pointer', fontWeight: 'bold' }}>
                                Resolver
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={6} style={{ padding: '0 14px 12px', borderBottom: `1px solid ${border}` }}>
                            <pre style={{ margin: 0, padding: '10px 14px', background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderRadius: 8, fontSize: 11, color: textSec, overflowX: 'auto', fontFamily: 'monospace', lineHeight: 1.6 }}>
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
