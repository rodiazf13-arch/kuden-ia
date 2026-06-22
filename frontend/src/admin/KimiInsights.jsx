import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import KimiMascot from '../KimiMascot.jsx';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function KimiInsights({ tenantId, isDark = true }) {
  const [data, setData] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState('all');

  useEffect(() => {
    if (tenantId) {
      fetch(`${API_URL}/api/crm/campaigns?tenantId=${tenantId}`)
        .then(r => r.json())
        .then(d => setCampaigns(Array.isArray(d) ? d : []))
        .catch(console.error);
      fetchInsights(false, 'all');
    }
  }, [tenantId]);

  const handleCampaignChange = (e) => {
    const val = e.target.value;
    setSelectedCampaign(val);
    fetchInsights(false, val);
  };

  const fetchInsights = async (generateReport = false, campaignOverride = selectedCampaign) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/insights/macro?tenantId=${tenantId}&generate=${generateReport}&campaignId=${campaignOverride}`);
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

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="insights-chart-tooltip">
          <p className="insights-chart-tooltip-date">{label}</p>
          <p className="insights-chart-tooltip-value">
            {payload[0].value} <span className="insights-chart-tooltip-unit">casos</span>
          </p>
        </div>
      );
    }
    return null;
  };

  const downloadReport = () => {
    if (!report) return;
    const reportHtml = document.getElementById('kimi-report-content').innerHTML;
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Reporte Kimi</title></head><body>";
    const footer = "</body></html>";
    const sourceHTML = header + reportHtml + footer;
    
    const blob = new Blob(['\ufeff', sourceHTML], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Reporte_Ejecutivo_Kimi_${new Date().toLocaleDateString()}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="insights-container">
      
      {/* Elementos decorativos de fondo para dar look "premium" */}
      <div className="insights-glow-1" />
      <div className="insights-glow-2" />

      <div className="insights-wrapper">
        
        {/* Header */}
        <div className="insights-header">
          <div>
            <h1 className="insights-title">Tablero Directivo</h1>
            <p className="insights-subtitle">Analítica Macro y Evaluación de Desempeño</p>
          </div>
          
          <div className="insights-header-actions">
            {campaigns && campaigns.length > 0 && (
              <select value={selectedCampaign} onChange={handleCampaignChange} className="insights-select">
                <option value="all">Todas las Campañas</option>
                {campaigns.map(cam => <option key={cam.id} value={cam.id}>{cam.name}</option>)}
              </select>
            )}

            {report && (
              <button onClick={downloadReport} className="insights-btn-secondary">
                <i className="ti ti-download"></i> Descargar .doc
              </button>
            )}

            <button onClick={() => fetchInsights(true)} disabled={loading} className="insights-btn-primary">
              <i className={`ti ti-${loading ? 'loader ti-spin' : 'sparkles'}`} style={{ fontSize: '18px' }}></i>
              {loading ? 'Kimi está procesando...' : 'Generar Análisis con Kimi'}
            </button>
          </div>
        </div>

        {error && (
          <div className="insights-alert-error">
            <i className="ti ti-alert-circle" style={{ fontSize: '18px' }}></i> {error}
          </div>
        )}

        {/* Row 1: KPI Cards */}
        {data && (
          <div className="insights-kpi-grid">
            
            {/* Total Casos */}
            <div className="insights-kpi-card">
              <div className="insights-kpi-header">
                <p className="insights-kpi-title">Total Interacciones</p>
                <div className="insights-kpi-icon-container primary">
                  <i className="ti ti-messages" style={{ fontSize: '18px' }}></i>
                </div>
              </div>
              <div className="insights-kpi-value-row">
                <p className="insights-kpi-value">{data.total_conversaciones}</p>
              </div>
              <p className="insights-kpi-desc">En los últimos 30 días</p>
            </div>

            {/* CSAT */}
            <div className="insights-kpi-card">
              <div className="insights-kpi-header">
                <p className="insights-kpi-title">CSAT Global</p>
                <div className="insights-kpi-icon-container success">
                  <i className="ti ti-star-filled" style={{ fontSize: '18px' }}></i>
                </div>
              </div>
              <div className="insights-kpi-value-row">
                <p className="insights-kpi-value success">{data.csat_global}</p>
                <span className="insights-kpi-value-denom">/ 5.0</span>
              </div>
              <p className="insights-kpi-desc">Satisfacción promedio general</p>
            </div>

            {/* Riesgo de Fuga */}
            <div className="insights-kpi-card">
              <div className="insights-kpi-header">
                <p className="insights-kpi-title">Tasa de Retención</p>
                <div className="insights-kpi-icon-container warning">
                  <i className="ti ti-shield-check" style={{ fontSize: '18px' }}></i>
                </div>
              </div>
              {data.riesgo_fuga_distribucion && (
                <div className="insights-kpi-distribution-list">
                  <div className="insights-kpi-distribution-item">
                    <span className="insights-kpi-distribution-label">Sin riesgo evidente</span>
                    <span className="insights-kpi-distribution-value success">{data.riesgo_fuga_distribucion.sin_riesgo}</span>
                  </div>
                  <div className="insights-kpi-distribution-item">
                    <span className="insights-kpi-distribution-label">Riesgo Medio</span>
                    <span className="insights-kpi-distribution-value warning">{data.riesgo_fuga_distribucion.medio}</span>
                  </div>
                  <div className="insights-kpi-distribution-item">
                    <span className="insights-kpi-distribution-label">Riesgo Alto</span>
                    <span className="insights-kpi-distribution-value error">{data.riesgo_fuga_distribucion.alto}</span>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* Row 2: Chart */}
        {data && data.conversaciones_por_dia && data.conversaciones_por_dia.length > 0 && (
          <div className="insights-chart-card">
            <h2 className="insights-card-title">Volumen de Interacciones (Últimos 30 Días)</h2>
            <div className="insights-chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.conversaciones_por_dia} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVolumen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-tertiary)" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} axisLine={false} tickLine={false} dy={10} 
                         tickFormatter={(val) => {
                           const d = new Date(val);
                           return `${d.getDate()}/${d.getMonth()+1}`;
                         }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} axisLine={false} tickLine={false} dx={-10} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="volumen" stroke="var(--color-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorVolumen)" animationDuration={1500} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Row 3: Bottom Split */}
        <div className="insights-layout-split">
          
          {/* Columna Izquierda: Reporte Kimi */}
          <div className="insights-report-card">
            <div className="insights-report-header">
              <div className="insights-report-mascot-container">
                <KimiMascot emotion="happy" isDark={isDark} />
              </div>
              <div>
                <h2 className="insights-report-header-title">Reporte Ejecutivo de Kimi</h2>
                <p className="insights-report-header-subtitle">Generado con IA en base a todas las transcripciones</p>
              </div>
            </div>
            
            {report ? (
              <div id="kimi-report-content" className="insights-report-content markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
              </div>
            ) : loading ? (
              <div className="insights-report-content loading">
                <div className="insights-report-loading-mascot">
                  <KimiMascot emotion="thinking" isDark={isDark} />
                </div>
                <p className="insights-report-content-text">Analizando miles de interacciones...</p>
                <p style={{ margin: 0 }}>Estoy redactando mis conclusiones operacionales.</p>
              </div>
            ) : (
              <div className="insights-report-content empty">
                <div className="insights-report-empty-mascot">
                  <KimiMascot emotion="neutral" isDark={isDark} />
                </div>
                <p className="insights-report-content-text">Aún no has generado el análisis de este mes.</p>
                <p style={{ margin: 0 }}>Haz clic en "Generar Análisis con Kimi" en la parte superior.</p>
              </div>
            )}
          </div>

          {/* Columna Derecha: Ranking de Ejecutivos */}
          <div className="insights-ranking-card">
            <h2 className="insights-ranking-title">
              <i className="ti ti-trophy"></i>
              Ranking de Ejecutivos
            </h2>
            
            {!data ? (
              <p className="insights-ranking-cases">Cargando datos crudos...</p>
            ) : data.ranking_ejecutivos?.length === 0 ? (
              <p className="insights-ranking-cases">No hay datos suficientes de ejecutivos humanos en los últimos 30 días.</p>
            ) : (
              <div className="insights-ranking-list">
                {data.ranking_ejecutivos.map((agent, idx) => {
                  const score = parseFloat(agent.promedio_csat) || 0;
                  const pct = Math.min((score / 5) * 100, 100);
                  const statusClass = score >= 4.5 ? 'success' : score >= 3.5 ? 'warning' : 'error';
                  
                  return (
                    <div key={agent.id} className="insights-ranking-item">
                      <div className="insights-ranking-header-row">
                        <div className="insights-ranking-info-group">
                          <span className="insights-ranking-position">#{idx + 1}</span>
                          <div>
                            <p className="insights-ranking-name">{agent.name}</p>
                            <p className="insights-ranking-cases">{agent.total_casos} casos resueltos</p>
                          </div>
                        </div>
                        <div className="insights-ranking-score-group">
                          <p className={`insights-ranking-score ${statusClass}`}>
                            {score.toFixed(1)} <i className="ti ti-star-filled" style={{ fontSize: '12px' }}></i>
                          </p>
                        </div>
                      </div>
                      <div className="insights-ranking-progress-track">
                        <div className={`insights-ranking-progress-fill ${statusClass}`} style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
