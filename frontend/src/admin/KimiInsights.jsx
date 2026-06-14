import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import KimiMascot from '../KimiMascot.jsx';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function KimiInsights({ tenantId, isDark = true }) {
  const [data, setData] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const c = {
    bg: isDark ? '#0a0a0a' : '#f9fafb',
    card: isDark ? 'rgba(255,255,255,0.02)' : '#ffffff',
    border: isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb',
    textMain: isDark ? '#f9fafb' : '#111827',
    textSec: isDark ? '#9ca3af' : '#6b7280',
    primary: '#2563eb',
    highlight: isDark ? '#1e293b' : '#f1f5f9'
  };

  useEffect(() => {
    if (tenantId) fetchInsights(false);
  }, [tenantId]);

  const fetchInsights = async (generateReport = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/insights/macro?tenantId=${tenantId}&generate=${generateReport}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Error al cargar datos');
      
      setData(json.data);
      if (json.report) {
        setReport(json.report);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflowY: 'auto', padding: '24px', background: c.bg, color: c.textMain }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: 60, height: 60 }}>
              <KimiMascot emotion={loading ? 'thinking' : 'happy'} isDark={isDark} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700', letterSpacing: '-0.02em' }}>Kimi Insights (BI)</h1>
              <p style={{ margin: '4px 0 0', fontSize: '14px', color: c.textSec }}>
                Analítica Macro y Evaluación de Desempeño
              </p>
            </div>
          </div>
          
          <button 
            onClick={() => fetchInsights(true)}
            disabled={loading}
            style={{
              padding: '10px 20px', background: c.primary, color: '#fff', border: 'none', borderRadius: '8px',
              fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
              display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(37,99,235,0.3)'
            }}
          >
            <i className={`ti ti-${loading ? 'loader ti-spin' : 'sparkles'}`}></i>
            {loading ? 'Kimi está analizando...' : 'Kimi: Generar Análisis de 30 Días'}
          </button>
        </div>

        {error && (
          <div style={{ padding: '16px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: '8px', marginBottom: '24px', border: '1px solid rgba(239,68,68,0.2)' }}>
            <i className="ti ti-alert-circle" style={{ marginRight: '8px' }}></i> {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px', alignItems: 'start' }}>
          
          {/* Columna Izquierda: Reporte Kimi */}
          <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 20px', color: c.textMain, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="ti ti-file-analytics" style={{ color: c.primary }}></i> Reporte Estratégico
            </h2>
            
            {report ? (
              <div className="markdown-body" style={{ color: c.textSec, fontSize: '14px', lineHeight: 1.6 }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
              </div>
            ) : loading ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: c.textSec }}>
                <div style={{ width: 80, height: 80, margin: '0 auto 20px' }}>
                  <KimiMascot emotion="thinking" isDark={isDark} />
                </div>
                <p>Procesando miles de conversaciones...</p>
                <p style={{ fontSize: '12px', opacity: 0.7 }}>Estoy leyendo los datos operacionales de los últimos 30 días para redactar mis conclusiones.</p>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: c.textSec, background: c.highlight, borderRadius: '8px', border: `1px dashed ${c.border}` }}>
                <i className="ti ti-robot" style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.5 }}></i>
                <p>Aún no has generado el análisis de este mes.</p>
                <p style={{ fontSize: '12px', opacity: 0.7 }}>Haz clic en el botón superior para que evalúe el desempeño general.</p>
              </div>
            )}
          </div>

          {/* Columna Derecha: Ranking y Datos Crudos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* KPI Cards */}
            {data && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '16px' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', color: c.textSec, textTransform: 'uppercase', fontWeight: '600' }}>Total Conversaciones</p>
                  <p style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: c.textMain }}>{data.total_conversaciones}</p>
                </div>
                <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '16px' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', color: c.textSec, textTransform: 'uppercase', fontWeight: '600' }}>CSAT Global</p>
                  <p style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#10b981' }}>{data.csat_global} <i className="ti ti-star-filled" style={{ fontSize: '16px' }}></i></p>
                </div>
              </div>
            )}

            {/* Ranking de Ejecutivos */}
            <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '20px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 16px', color: c.textMain, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                🏆 Ranking de Ejecutivos
              </h2>
              
              {!data ? (
                <p style={{ fontSize: '13px', color: c.textSec }}>Cargando datos crudos...</p>
              ) : data.ranking_ejecutivos?.length === 0 ? (
                <p style={{ fontSize: '13px', color: c.textSec }}>No hay datos suficientes de ejecutivos humanos en los últimos 30 días.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {data.ranking_ejecutivos.map((agent, idx) => (
                    <div key={agent.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb', borderRadius: '8px', border: `1px solid ${c.border}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: idx === 0 ? '#fbbf24' : idx === 1 ? '#9ca3af' : idx === 2 ? '#b45309' : c.primary, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                          {idx + 1}
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: c.textMain }}>{agent.name}</p>
                          <p style={{ margin: 0, fontSize: '11px', color: c.textSec }}>{agent.total_casos} casos</p>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: agent.promedio_csat >= 4 ? '#10b981' : agent.promedio_csat >= 3 ? '#f59e0b' : '#ef4444' }}>
                          {agent.promedio_csat} <i className="ti ti-star-filled" style={{ fontSize: '12px' }}></i>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
