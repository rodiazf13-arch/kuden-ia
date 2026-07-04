import React, { useState, useEffect, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import KimiMascot from '../KimiMascot.jsx';

const API_URL = import.meta.env.VITE_API_URL || '';

const SEV_CONFIG = {
  critical: { label: 'Crítico', color: '#E24B4A', bg: '#FDECEA', icon: 'ti-alert-octagon' },
  error: { label: 'Error', color: '#D85A30', bg: '#FAECE7', icon: 'ti-circle-x' },
  critical_error: { label: 'Errores', color: '#E24B4A', bg: '#FDECEA', icon: 'ti-alert-octagon' },
  warning: { label: 'Advertencia', color: '#EF9F27', bg: '#FEF3E0', icon: 'ti-alert-triangle' },
  info: { label: 'Info', color: '#2563eb', bg: '#EFF6FF', icon: 'ti-info-circle' },
  debug: { label: 'Debug', color: '#6b7280', bg: '#f3f4f6', icon: 'ti-bug' },
};

function SevBadge({ severity }) {
  const s = SEV_CONFIG[severity] || SEV_CONFIG.info;
  const style = {
    '--sev-color': s.color,
    '--sev-bg': s.bg,
    '--sev-border-color': `${s.color}40`
  };
  return (
    <span className="health-badge" style={style}>
      <i className={`ti ${s.icon} health-badge-icon`} /> {s.label}
    </span>
  );
}

function KpiCard({ icon, label, value, color, sub, onClick, active }) {
  const style = {
    '--kpi-color': color,
    '--kpi-color-alpha': `${color}18`,
    '--kpi-color-border': `${color}50`,
    '--kpi-color-glow': `${color}20`
  };
  return (
    <div
      onClick={onClick}
      className={`health-kpi-card ${onClick ? 'interactive' : ''} ${active ? 'active' : ''}`}
      style={style}
    >
      <div className="health-kpi-card-header">
        <div className="health-kpi-card-icon-wrapper">
          <i className={`ti ${icon} health-kpi-card-icon`} />
        </div>
        <p className="health-kpi-card-label">{label}</p>
      </div>
      <p className="health-kpi-card-value">{value}</p>
      {sub && <p className="health-kpi-card-sub">{sub}</p>}
    </div>
  );
}

export default function SystemHealthDashboard({ isDark }) {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useState('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString().slice(0, 16);
  });

  const chartStrokeColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
  const chartTextColor = isDark ? '#A9B0C3' : '#667085';
  const tooltipBg = isDark ? '#171A2F' : '#FFFFFF';
  const tooltipBorder = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(99, 91, 255, 0.08)';
  const tooltipTextColor = isDark ? '#FFFFFF' : '#101828';

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (severity !== 'all') params.set('severity', severity);
      if (search) params.set('search', search);
      if (from) params.set('from', new Date(from).toISOString());
      const res = await fetch(`${API_URL}/api/admin/audit-logs?${params}`);
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
    { icon: 'ti-list', label: 'Total Eventos', value: stats?.total || 0, color: '#635BFF', id: 'all' },
    { icon: 'ti-alert-octagon', label: 'Errores Críticos', value: criticalCount, color: '#FF5E73', id: 'critical_error' },
    { icon: 'ti-alert-triangle', label: 'Advertencias', value: stats?.bySeverity?.warning || 0, color: '#F6B940', id: 'warning' },
    { icon: 'ti-info-circle', label: 'Informativos', value: stats?.bySeverity?.info || 0, color: '#16D38A', id: 'info' },
  ];

  return (
    <div className="health-container">

      {/* ── Header ── */}
      <div className="health-header">
        <div className="health-header-left">
          <div className="health-header-icon-box">
            <i className="ti ti-activity health-header-icon" />
          </div>
          <div className="health-header-title">
            <h2>Health Monitor</h2>
            <p>Sistema de Observabilidad Interno · Auto-refresh cada 10s</p>
          </div>
        </div>
        {/* Estado general */}
        <div className="health-status-box">
          <KimiMascot size={150} state={systemOk ? 'idle' : 'alert'} />
          <span className={`health-status-text ${systemOk ? 'ok' : 'alert'}`}>
            {systemOk ? 'Kimi dice: ¡Todo en orden!' : `${criticalCount} incidente${criticalCount > 1 ? 's' : ''} activo${criticalCount > 1 ? 's' : ''}`}
          </span>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="health-kpi-grid">
        {kpis.map(k => (
          <KpiCard key={k.id} {...k}
            active={severity === k.id}
            onClick={() => setSeverity(prev => prev === k.id ? 'all' : k.id)}
            sub={severity === k.id ? 'Filtro activo · Click para quitar' : 'Click para filtrar'}
          />
        ))}
      </div>

      {/* ── Gráfico de Eventos ── */}
      {chartData.length > 0 && (
        <div className="health-chart-card">
          <p className="health-chart-title">📈 Distribución temporal de eventos</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="grad-error" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF5E73" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#FF5E73" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-warning" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F6B940" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F6B940" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-info" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#635BFF" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#635BFF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={chartStrokeColor} vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: chartTextColor }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: chartTextColor }} axisLine={false} tickLine={false} />
              <RTooltip contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, color: tooltipTextColor, fontSize: 12 }} />
              <Area type="monotone" dataKey="error" stroke="#FF5E73" fill="url(#grad-error)" strokeWidth={2} />
              <Area type="monotone" dataKey="warning" stroke="#F6B940" fill="url(#grad-warning)" strokeWidth={1.5} />
              <Area type="monotone" dataKey="info" stroke="#635BFF" fill="url(#grad-info)" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Filtros y tabla ── */}
      <div className="health-logs-card">
        {/* Barra de filtros */}
        <div className="health-filters-bar">
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Buscar en mensajes..."
            className="health-input"
          />
          <input
            type="datetime-local" value={from} onChange={e => setFrom(e.target.value)}
            className="health-input-datetime"
          />
          {['all', 'critical_error', 'warning', 'info', 'debug'].map(s => {
            const isSel = severity === s;
            const configColor = SEV_CONFIG[s]?.color || 'var(--color-primary)';
            const btnStyle = isSel ? {
              '--sev-color': configColor,
              '--sev-bg-alpha': `${configColor}15`,
              '--sev-border-color': `${configColor}80`
            } : {};
            return (
              <button key={s} onClick={() => setSeverity(s)}
                className={`health-filter-btn ${isSel ? 'active' : ''}`}
                style={btnStyle}>
                {s === 'all' ? 'Todos' : SEV_CONFIG[s]?.label || s}
              </button>
            );
          })}
          <button onClick={fetchLogs} className="health-btn-refresh">
            <i className="ti ti-refresh" /> Actualizar
          </button>
        </div>

        {/* Tabla */}
        <div className="health-table-wrapper">
          <table className="health-table">
            <thead>
              <tr>
                {['Timestamp', 'Severidad', 'Fuente', 'Mensaje', 'Tenant', ''].map(h => (
                  <th key={h} className="health-th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="health-empty-state"><span style={{ color: 'var(--color-text-secondary)' }}>Cargando logs...</span></td></tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="health-empty-state">
                    <div className="health-empty-wrapper">
                      <KimiMascot size={150} state="happy" />
                      <p className="health-empty-title">¡Sin eventos en este período!</p>
                      <p className="health-empty-desc">Kimi está tranquila — el sistema opera con normalidad.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map(log => {
                  const isOpen = expanded === log.id;
                  const isResolved = log.metadata?.resolved === true;
                  const isActiveIncident = !isResolved && (log.severity === 'critical' || log.severity === 'error');
                  return (
                    <React.Fragment key={log.id}>
                      <tr className={`health-tr ${isResolved ? 'resolved' : ''} ${isActiveIncident ? 'incident-active' : ''}`}>
                        <td className="health-td health-td-timestamp">
                          {new Date(log.created_at).toLocaleString('es-CL', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="health-td"><SevBadge severity={log.severity} /></td>
                        <td className="health-td health-td-source">{log.source}</td>
                        <td className={`health-td health-td-message ${isResolved ? 'resolved' : ''}`}>
                          {isResolved && <span className="health-resolved-tag">[✓ Resuelto]</span>}
                          {log.message}
                        </td>
                        <td className="health-td health-td-tenant">{log.tenant_id ? log.tenant_id.slice(0, 8) + '…' : '—'}</td>
                        <td className="health-td">
                          <div className="health-actions-cell">
                            {log.metadata && Object.keys(log.metadata).length > 0 && (
                              <button onClick={() => setExpanded(isOpen ? null : log.id)}
                                className="health-btn-action">
                                {isOpen ? 'Cerrar' : 'Ver más'}
                              </button>
                            )}
                            {!isResolved && (log.severity === 'critical' || log.severity === 'error') && (
                              <button onClick={() => resolveLog(log.id)}
                                className="health-btn-resolve">
                                Resolver
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={6} className="health-expanded-row">
                            <pre className="health-expanded-pre">
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
