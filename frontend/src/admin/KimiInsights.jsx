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

  const c = {
    bg: isDark ? '#0a0a0a' : '#f9fafb',
    cardBg: isDark ? 'rgba(255, 255, 255, 0.03)' : '#ffffff',
    cardBorder: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
    textMain: isDark ? '#f8fafc' : '#0f172a',
    textSec: isDark ? '#94a3b8' : '#64748b',
    primary: '#3b82f6',
    primaryGlow: 'rgba(59, 130, 246, 0.5)',
    green: '#10b981',
    yellow: '#f59e0b',
    red: '#ef4444'
  };

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
        <div style={{ background: c.cardBg, border: `1px solid ${c.cardBorder}`, backdropFilter: 'blur(10px)', padding: '12px', borderRadius: '8px', color: c.textMain, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
          <p style={{ margin: '0 0 4px', fontSize: '12px', color: c.textSec }}>{label}</p>
          <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: c.primary }}>
            {payload[0].value} <span style={{ fontSize: '12px', fontWeight: 'normal', color: c.textSec }}>casos</span>
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
    <div style={{ position: 'relative', width: '100%', height: '100%', background: c.bg, color: c.textMain, overflowY: 'auto' }}>
      
      {/* Elementos decorativos de fondo para dar look "premium" */}
      <div style={{ position: 'absolute', top: -100, left: -100, width: 400, height: 400, background: c.primary, filter: 'blur(150px)', opacity: 0.15, pointerEvents: 'none', borderRadius: '50%' }} />
      <div style={{ position: 'absolute', bottom: -100, right: -100, width: 300, height: 300, background: c.green, filter: 'blur(150px)', opacity: 0.1, pointerEvents: 'none', borderRadius: '50%' }} />

      <div style={{ padding: '32px', position: 'relative', zIndex: 1, maxWidth: 1400, margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '700', letterSpacing: '-0.03em', background: `linear-gradient(90deg, ${c.textMain}, ${c.textSec})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Tablero Directivo
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '14px', color: c.textSec }}>
              Analítica Macro y Evaluación de Desempeño
            </p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {campaigns && campaigns.length > 0 && (
              <select value={selectedCampaign} onChange={handleCampaignChange}
                style={{ padding: '12px 16px', borderRadius: '12px', border: `1px solid ${c.cardBorder}`, background: c.cardBg, color: c.textMain, outline: 'none', backdropFilter: 'blur(10px)', fontSize: '14px', cursor: 'pointer' }}>
                <option value="all">Todas las Campañas</option>
                {campaigns.map(cam => <option key={cam.id} value={cam.id}>{cam.name}</option>)}
              </select>
            )}

            {report && (
              <button 
                onClick={downloadReport}
                style={{
                  padding: '12px 20px', background: 'transparent', color: c.primary, border: `1px solid ${c.primary}`, borderRadius: '12px',
                  fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <i className="ti ti-download" style={{ fontSize: '18px' }}></i>
                Descargar .doc
              </button>
            )}

            <button 
              onClick={() => fetchInsights(true)}
              disabled={loading}
              style={{
                padding: '12px 24px', background: `linear-gradient(135deg, ${c.primary}, #2563eb)`, color: '#fff', border: 'none', borderRadius: '12px',
                fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.8 : 1,
                display: 'flex', alignItems: 'center', gap: '8px', boxShadow: `0 8px 20px ${c.primaryGlow}`, transition: 'all 0.2s'
              }}
              onMouseEnter={e => { if(!loading) e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { if(!loading) e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <i className={`ti ti-${loading ? 'loader ti-spin' : 'sparkles'}`} style={{ fontSize: '18px' }}></i>
              {loading ? 'Kimi está procesando...' : 'Generar Análisis con Kimi'}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: '16px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: '12px', marginBottom: '24px', border: '1px solid rgba(239,68,68,0.2)', backdropFilter: 'blur(10px)' }}>
            <i className="ti ti-alert-circle" style={{ marginRight: '8px' }}></i> {error}
          </div>
        )}

        {/* Row 1: KPI Cards */}
        {data && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '24px' }}>
            
            {/* Total Casos */}
            <div style={{ background: c.cardBg, border: `1px solid ${c.cardBorder}`, borderRadius: '16px', padding: '24px', backdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <p style={{ margin: 0, fontSize: '13px', color: c.textSec, textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Total Interacciones</p>
                <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(59,130,246,0.1)', color: c.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ti ti-messages" style={{ fontSize: '18px' }}></i>
                </div>
              </div>
              <p style={{ margin: '16px 0 0', fontSize: '36px', fontWeight: '700', color: c.textMain }}>{data.total_conversaciones}</p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: c.textSec }}>En los últimos 30 días</p>
            </div>

            {/* CSAT */}
            <div style={{ background: c.cardBg, border: `1px solid ${c.cardBorder}`, borderRadius: '16px', padding: '24px', backdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <p style={{ margin: 0, fontSize: '13px', color: c.textSec, textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>CSAT Global</p>
                <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(16,185,129,0.1)', color: c.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ti ti-star-filled" style={{ fontSize: '18px' }}></i>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '16px' }}>
                <p style={{ margin: 0, fontSize: '36px', fontWeight: '700', color: c.green }}>{data.csat_global}</p>
                <span style={{ fontSize: '14px', color: c.textSec, fontWeight: '500' }}>/ 5.0</span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: c.textSec }}>Satisfacción promedio general</p>
            </div>

            {/* Riesgo de Fuga */}
            <div style={{ background: c.cardBg, border: `1px solid ${c.cardBorder}`, borderRadius: '16px', padding: '24px', backdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <p style={{ margin: 0, fontSize: '13px', color: c.textSec, textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Tasa de Retención</p>
                <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(245,158,11,0.1)', color: c.yellow, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ti ti-shield-check" style={{ fontSize: '18px' }}></i>
                </div>
              </div>
              {data.riesgo_fuga_distribucion && (
                <div style={{ marginTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: c.textMain }}>Sin riesgo evidente</span>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: c.green }}>{data.riesgo_fuga_distribucion.sin_riesgo}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: c.textMain }}>Riesgo Medio</span>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: c.yellow }}>{data.riesgo_fuga_distribucion.medio}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', color: c.textMain }}>Riesgo Alto</span>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: c.red }}>{data.riesgo_fuga_distribucion.alto}</span>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* Row 2: Chart */}
        {data && data.conversaciones_por_dia && data.conversaciones_por_dia.length > 0 && (
          <div style={{ background: c.cardBg, border: `1px solid ${c.cardBorder}`, borderRadius: '16px', padding: '24px', backdropFilter: 'blur(12px)', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 24px', color: c.textMain }}>Volumen de Interacciones (Últimos 30 Días)</h2>
            <div style={{ height: 300, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.conversaciones_por_dia} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVolumen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={c.primary} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={c.primary} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={c.cardBorder} />
                  <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: c.textSec }} axisLine={false} tickLine={false} dy={10} 
                         tickFormatter={(val) => {
                           const d = new Date(val);
                           return `${d.getDate()}/${d.getMonth()+1}`;
                         }} />
                  <YAxis tick={{ fontSize: 11, fill: c.textSec }} axisLine={false} tickLine={false} dx={-10} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="volumen" stroke={c.primary} strokeWidth={3} fillOpacity={1} fill="url(#colorVolumen)" animationDuration={1500} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Row 3: Bottom Split */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px', alignItems: 'start' }}>
          
          {/* Columna Izquierda: Reporte Kimi */}
          <div style={{ background: c.cardBg, border: `1px solid ${c.cardBorder}`, borderRadius: '16px', padding: '32px', backdropFilter: 'blur(12px)', minHeight: '400px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', borderBottom: `1px solid ${c.cardBorder}`, paddingBottom: '16px' }}>
              <div style={{ width: 48, height: 48 }}>
                <KimiMascot emotion="happy" isDark={isDark} />
              </div>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 4px', color: c.textMain }}>Reporte Ejecutivo de Kimi</h2>
                <p style={{ margin: 0, fontSize: '13px', color: c.textSec }}>Generado con IA en base a todas las transcripciones</p>
              </div>
            </div>
            
            {report ? (
              <div id="kimi-report-content" className="markdown-body" style={{ color: c.textSec, fontSize: '15px', lineHeight: 1.7 }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
              </div>
            ) : loading ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: c.textSec }}>
                <div style={{ width: 80, height: 80, margin: '0 auto 20px' }}>
                  <KimiMascot emotion="thinking" isDark={isDark} />
                </div>
                <p style={{ fontSize: '16px', fontWeight: '500', color: c.textMain }}>Analizando miles de interacciones...</p>
                <p style={{ fontSize: '14px', opacity: 0.8 }}>Estoy redactando mis conclusiones operacionales.</p>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '80px 20px', color: c.textSec }}>
                <div style={{ width: 64, height: 64, margin: '0 auto 16px', opacity: 0.5, filter: 'grayscale(100%)' }}>
                  <KimiMascot emotion="neutral" isDark={isDark} />
                </div>
                <p style={{ fontSize: '15px' }}>Aún no has generado el análisis de este mes.</p>
                <p style={{ fontSize: '13px', opacity: 0.7 }}>Haz clic en "Generar Análisis con Kimi" en la parte superior.</p>
              </div>
            )}
          </div>

          {/* Columna Derecha: Ranking de Ejecutivos */}
          <div style={{ background: c.cardBg, border: `1px solid ${c.cardBorder}`, borderRadius: '16px', padding: '24px', backdropFilter: 'blur(12px)' }}>
            <h2 style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 20px', color: c.textMain, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="ti ti-trophy" style={{ color: c.yellow, fontSize: '18px' }}></i>
              Ranking de Ejecutivos
            </h2>
            
            {!data ? (
              <p style={{ fontSize: '13px', color: c.textSec }}>Cargando datos crudos...</p>
            ) : data.ranking_ejecutivos?.length === 0 ? (
              <p style={{ fontSize: '13px', color: c.textSec }}>No hay datos suficientes de ejecutivos humanos en los últimos 30 días.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {data.ranking_ejecutivos.map((agent, idx) => {
                  const score = parseFloat(agent.promedio_csat) || 0;
                  const pct = Math.min((score / 5) * 100, 100);
                  const color = score >= 4.5 ? c.green : score >= 3.5 ? c.yellow : c.red;
                  
                  return (
                    <div key={agent.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 'bold', color: c.textSec, width: '16px' }}>#{idx + 1}</span>
                          <div>
                            <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: c.textMain }}>{agent.name}</p>
                            <p style={{ margin: 0, fontSize: '11px', color: c.textSec }}>{agent.total_casos} casos resueltos</p>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color }}>{score.toFixed(1)} <i className="ti ti-star-filled" style={{ fontSize: '12px' }}></i></p>
                        </div>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 1s ease-in-out' }}></div>
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
