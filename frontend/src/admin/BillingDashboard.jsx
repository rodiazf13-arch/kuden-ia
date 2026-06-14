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

  const c = {
    card:      isDark ? '#111'    : '#ffffff',
    border:    isDark ? '#222'    : '#e5e7eb',
    title:     isDark ? '#ffffff' : '#111827',
    subtitle:  isDark ? '#aaaaaa' : '#6b7280',
    tableHd:   isDark ? '#1a1a1a' : '#f9fafb',
    text:      isDark ? '#e5e7eb' : '#374151'
  };

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
      let query = supabase
        .from('llm_usage_logs')
        .select(`
          id, tenant_id, provider, model, prompt_tokens, completion_tokens, api_cost_usd, billed_usd, source, created_at,
          tenants ( name )
        `)
        .order('created_at', { ascending: false })
        .limit(200);
        
      if (selectedTenant !== 'all') {
        query = query.eq('tenant_id', selectedTenant);
      }
      if (startDate) {
        query = query.gte('created_at', new Date(startDate + 'T00:00:00').toISOString());
      }
      if (endDate) {
        query = query.lte('created_at', new Date(endDate + 'T23:59:59').toISOString());
      }

      const { data, error } = await query;
      if (!error && data) {
        setLogs(data);
      }
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
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 'bold', margin: '0 0 8px', color: c.title }}>Tarificador Multi-LLM</h2>
          <p style={{ margin: 0, color: c.subtitle }}>Visualiza y exporta los consumos de API y márgenes de ganancia.</p>
        </div>
        <button onClick={exportToCSV} style={{ padding: '8px 16px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className="ti ti-download" /> Exportar a CSV
        </button>
      </div>

      {/* Barra de Filtros */}
      <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: '16px', marginBottom: 24, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 200 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: c.subtitle }}>Empresa</label>
          <select value={selectedTenant} onChange={e => setSelectedTenant(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${c.border}`, background: isDark ? '#1a1a1a' : '#fff', color: c.text, outline: 'none' }}>
            <option value="all">Todas las empresas</option>
            {tenantsList.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 150 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: c.subtitle }}>Fecha Inicio</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${c.border}`, background: isDark ? '#1a1a1a' : '#fff', color: c.text, outline: 'none', colorScheme: isDark ? 'dark' : 'light' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 150 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: c.subtitle }}>Fecha Fin</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${c.border}`, background: isDark ? '#1a1a1a' : '#fff', color: c.text, outline: 'none', colorScheme: isDark ? 'dark' : 'light' }} />
        </div>
        <div>
          <button onClick={fetchLogs} style={{ padding: '9px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="ti ti-filter" /> Filtrar
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 24 }}>
        <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: 20 }}>
          <p style={{ margin: '0 0 8px', fontSize: 13, color: c.subtitle }}>Costo API (Mostrado)</p>
          <p style={{ margin: 0, fontSize: 24, fontWeight: 'bold', color: '#ef4444' }}>${totalApiCost.toFixed(4)}</p>
        </div>
        <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: 20 }}>
          <p style={{ margin: '0 0 8px', fontSize: 13, color: c.subtitle }}>Facturado al Cliente</p>
          <p style={{ margin: 0, fontSize: 24, fontWeight: 'bold', color: '#3b82f6' }}>${totalBilled.toFixed(4)}</p>
        </div>
        <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: 20 }}>
          <p style={{ margin: '0 0 8px', fontSize: 13, color: c.subtitle }}>Margen de Ganancia</p>
          <p style={{ margin: 0, fontSize: 24, fontWeight: 'bold', color: '#10b981' }}>+${totalMargin.toFixed(4)}</p>
        </div>
      </div>

      {/* Tabla de logs */}
      <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13, color: c.text }}>
          <thead style={{ background: c.tableHd, borderBottom: `1px solid ${c.border}` }}>
            <tr>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Fecha</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Empresa</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Origen</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Proveedor / Modelo</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Tokens (In/Out)</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Costo API</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Cobrado</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Margen</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: c.subtitle }}>Cargando datos...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: c.subtitle }}>No se encontraron registros para los filtros seleccionados.</td></tr>
            ) : logs.map(log => {
              const date = new Date(log.created_at).toLocaleString();
              const margin = Number(log.billed_usd) - Number(log.api_cost_usd);
                  const sourceLabels = { widget: '💬 Widget', copilot: '🤖 Co-Piloto', agent_assist: '🧑 Asistencia Agente', summary: '📋 Resumen', other: '⚙️ Otro' };
                  const sourceLabel = sourceLabels[log.source] || `⚙️ ${log.source || 'widget'}`;
                  return (
                <tr key={log.id} style={{ borderBottom: `1px solid ${c.border}` }}>
                  <td style={{ padding: '12px 16px', color: c.subtitle }}>{date}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 500 }}>{log.tenants?.name || 'N/A'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ background: log.source === 'copilot' ? '#4c1d95' : log.source === 'agent_assist' ? '#164e63' : '#1e3a5f', color: '#fff', padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>{sourceLabel}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ background: c.border, padding: '2px 6px', borderRadius: 4, fontSize: 11, marginRight: 6 }}>{log.provider}</span>
                    {log.model}
                  </td>
                  <td style={{ padding: '12px 16px' }}>{log.prompt_tokens} / {log.completion_tokens}</td>
                  <td style={{ padding: '12px 16px', color: '#ef4444' }}>${Number(log.api_cost_usd).toFixed(5)}</td>
                  <td style={{ padding: '12px 16px', color: '#3b82f6' }}>${Number(log.billed_usd).toFixed(5)}</td>
                  <td style={{ padding: '12px 16px', color: '#10b981', fontWeight: 600 }}>+${margin.toFixed(5)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
