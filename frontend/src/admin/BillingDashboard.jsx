import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function BillingDashboard({ isDark = true }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [tenantsList, setTenantsList] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');



  const fetchTenants = async () => {
    try {
      const { data } = await supabase.from('tenants').select('id, name').order('name');
      if (data) setTenantsList(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const buildQuery = (tableName) => {
        let q = supabase
          .from(tableName)
          .select(`
            id, tenant_id, provider, model, prompt_tokens, completion_tokens, source, created_at,
            tenants ( name ),
            ${tableName === 'usage_logs' ? 'cost_usd, billed_usd, campaign_id, ai_profile_id' : 'api_cost_usd, billed_usd'}
          `)
          .order('created_at', { ascending: false })
          .limit(200);
        if (selectedTenant !== 'all') q = q.eq('tenant_id', selectedTenant);
        if (startDate) q = q.gte('created_at', new Date(startDate + 'T00:00:00').toISOString());
        if (endDate) q = q.lte('created_at', new Date(endDate + 'T23:59:59').toISOString());
        return q;
      };

      let { data, error } = await buildQuery('usage_logs');
      if (error || !data) {
        const fallback = await buildQuery('llm_usage_logs');
        data = fallback.data;
        if (data) {
          data = data.map(item => ({ ...item, cost_usd: item.api_cost_usd || item.cost_usd || 0 }));
        }
      } else {
        data = data.map(item => ({ ...item, api_cost_usd: item.cost_usd || item.api_cost_usd || 0 }));
      }

      if (data) setLogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedTenant, startDate, endDate]);

  useEffect(() => {
    fetchTenants();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const exportToCSV = async () => {
    try {
      // Fetch full dataset without limit for the CSV
      let query = supabase
        .from('llm_usage_logs')
        .select(`
          id, provider, model, prompt_tokens, completion_tokens, api_cost_usd, billed_usd, source, created_at,
          tenants ( name )
        `)
        .order('created_at', { ascending: false });

      if (selectedTenant !== 'all') query = query.eq('tenant_id', selectedTenant);
      if (startDate) query = query.gte('created_at', new Date(startDate + 'T00:00:00').toISOString());
      if (endDate) query = query.lte('created_at', new Date(endDate + 'T23:59:59').toISOString());

      const { data, error } = await query;
      if (error || !data) throw error;

      const csvRows = [];
      const headers = ['Fecha', 'Empresa', 'Origen', 'Proveedor', 'Modelo', 'Prompt Tokens', 'Completion Tokens', 'Costo API (USD)', 'Cobrado (USD)', 'Margen (USD)'];
      csvRows.push(headers.join(','));

      data.forEach(log => {
        const margin = Number(log.billed_usd) - Number(log.api_cost_usd);
        const values = [
          new Date(log.created_at).toLocaleString('es-CL').replace(',', ''),
          log.tenants?.name || 'N/A',
          log.source || 'widget',
          log.provider,
          log.model,
          log.prompt_tokens,
          log.completion_tokens,
          Number(log.api_cost_usd).toFixed(5),
          Number(log.billed_usd).toFixed(5),
          margin.toFixed(5)
        ];
        csvRows.push(values.map(v => `"${v}"`).join(','));
      });

      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `reporte_llm_usage_${new Date().getTime()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("Error al exportar CSV:", e);
      alert("Error al exportar CSV");
    }
  };

  const totalApiCost = logs.reduce((acc, l) => acc + Number(l.api_cost_usd), 0);
  const totalBilled = logs.reduce((acc, l) => acc + Number(l.billed_usd), 0);
  const totalMargin = totalBilled - totalApiCost;

  return (
    <div className="billing-container">
      <div className="billing-content-wrapper">
      <div className="billing-header">
        <div className="billing-title-box">
          <h2>Tarificador Multi-LLM</h2>
          <p>Visualiza y exporta los consumos de API y márgenes de ganancia.</p>
        </div>
        <button onClick={exportToCSV} className="billing-btn-export">
          <i className="ti ti-download" /> Exportar a CSV
        </button>
      </div>

      {/* Barra de Filtros */}
      <div className="billing-filters-bar">
        <div className="billing-filter-group">
          <label>Empresa</label>
          <select value={selectedTenant} onChange={e => setSelectedTenant(e.target.value)} className="billing-filter-input">
            <option value="all">Todas las empresas</option>
            {tenantsList.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div className="billing-filter-group">
          <label>Fecha Inicio</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="billing-filter-input" />
        </div>
        <div className="billing-filter-group">
          <label>Fecha Fin</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="billing-filter-input" />
        </div>
        <div>
          <button onClick={fetchLogs} className="billing-btn-filter">
            <i className="ti ti-filter" /> Filtrar
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="billing-kpi-grid">
        <div className="billing-kpi-card">
          <p className="billing-kpi-title">Costo API (Mostrado)</p>
          <p className="billing-kpi-value api-cost">${totalApiCost.toFixed(4)}</p>
        </div>
        <div className="billing-kpi-card">
          <p className="billing-kpi-title">Facturado al Cliente</p>
          <p className="billing-kpi-value billed">${totalBilled.toFixed(4)}</p>
        </div>
        <div className="billing-kpi-card">
          <p className="billing-kpi-title">Margen de Ganancia</p>
          <p className="billing-kpi-value margin">+${totalMargin.toFixed(4)}</p>
        </div>
      </div>

      {/* Tabla de logs */}
      <div className="billing-table-wrapper">
        <table className="billing-table">
          <thead>
            <tr>
              <th className="billing-th">Fecha</th>
              <th className="billing-th">Empresa</th>
              <th className="billing-th">Origen</th>
              <th className="billing-th">Proveedor / Modelo</th>
              <th className="billing-th">Tokens (In/Out)</th>
              <th className="billing-th">Costo API</th>
              <th className="billing-th">Cobrado</th>
              <th className="billing-th">Margen</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="billing-empty-state">Cargando datos...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={8} className="billing-empty-state">No se encontraron registros para los filtros seleccionados.</td></tr>
            ) : logs.map(log => {
              const date = new Date(log.created_at).toLocaleString();
              const margin = Number(log.billed_usd) - Number(log.api_cost_usd);
              const sourceLabels = { widget: '💬 Widget', copilot: '🤖 Co-Piloto', agent_assist: '🧑 Asistencia Agente', summary: '📋 Resumen', other: '⚙️ Otro' };
              const sourceLabel = sourceLabels[log.source] || `⚙️ ${log.source || 'widget'}`;
              
              let sourceClass = 'source-other';
              if (log.source === 'copilot') sourceClass = 'source-copilot';
              else if (log.source === 'agent_assist') sourceClass = 'source-assist';

              return (
                <tr key={log.id} className="billing-tr">
                  <td className="billing-td billing-td-date">{date}</td>
                  <td className="billing-td billing-td-tenant">{log.tenants?.name || 'N/A'}</td>
                  <td className="billing-td">
                    <span className={`billing-badge ${sourceClass}`}>{sourceLabel}</span>
                  </td>
                  <td className="billing-td">
                    <span className="billing-badge provider">{log.provider}</span>
                    {log.model}
                  </td>
                  <td className="billing-td">{log.prompt_tokens} / {log.completion_tokens}</td>
                  <td className="billing-td billing-td-cost">${Number(log.api_cost_usd).toFixed(5)}</td>
                  <td className="billing-td billing-td-billed">${Number(log.billed_usd).toFixed(5)}</td>
                  <td className="billing-td billing-td-margin">+${margin.toFixed(5)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}
