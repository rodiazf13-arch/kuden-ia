import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function BillingDashboard({ isDark = true }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const c = {
    card:      isDark ? '#111'    : '#ffffff',
    border:    isDark ? '#222'    : '#e5e7eb',
    title:     isDark ? '#ffffff' : '#111827',
    subtitle:  isDark ? '#aaaaaa' : '#6b7280',
    tableHd:   isDark ? '#1a1a1a' : '#f9fafb',
    text:      isDark ? '#e5e7eb' : '#374151'
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('llm_usage_logs')
        .select(`
          id, provider, model, prompt_tokens, completion_tokens, api_cost_usd, billed_usd, created_at,
          tenants ( name )
        `)
        .order('created_at', { ascending: false })
        .limit(100);
        
      if (!error && data) {
        setLogs(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ color: c.subtitle }}>Cargando tarificador...</div>;

  const totalApiCost = logs.reduce((acc, l) => acc + Number(l.api_cost_usd), 0);
  const totalBilled = logs.reduce((acc, l) => acc + Number(l.billed_usd), 0);
  const totalMargin = totalBilled - totalApiCost;

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 'bold', margin: '0 0 8px', color: c.title }}>Tarificador Multi-LLM</h2>
      <p style={{ margin: '0 0 24px', color: c.subtitle }}>Visualiza los consumos de API y los márgenes de ganancia por empresa.</p>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 24 }}>
        <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: 20 }}>
          <p style={{ margin: '0 0 8px', fontSize: 13, color: c.subtitle }}>Costo API Total (100 tx)</p>
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
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Proveedor / Modelo</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Tokens (In/Out)</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Costo API</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Cobrado</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Margen</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => {
              const date = new Date(log.created_at).toLocaleString();
              const margin = Number(log.billed_usd) - Number(log.api_cost_usd);
              return (
                <tr key={log.id} style={{ borderBottom: `1px solid ${c.border}` }}>
                  <td style={{ padding: '12px 16px', color: c.subtitle }}>{date}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 500 }}>{log.tenants?.name || 'N/A'}</td>
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
