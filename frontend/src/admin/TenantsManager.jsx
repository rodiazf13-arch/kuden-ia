import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

// Plantillas de campos por industria
const INDUSTRY_CATALOG = {
  general: { label: 'General', icon: 'ti-building', color: '#6b7280', desc: 'Empresa sin segmento específico.' },
  soporte: { label: 'Soporte', icon: 'ti-headset', color: '#2563eb', desc: 'Atención al cliente, help desk, mesa de ayuda.' },
  cobranza: { label: 'Cobranza', icon: 'ti-cash', color: '#d97706', desc: 'Gestión de deudas, pagos y documentos.' },
  salud: { label: 'Salud / Clínica', icon: 'ti-heart-rate-monitor', color: '#16a34a', desc: 'Hospitales, clínicas, consultorios.' },
  inmobiliaria: { label: 'Inmobiliaria', icon: 'ti-home', color: '#7c3aed', desc: 'Ventas y arriendo de propiedades.' },
  ventas: { label: 'Ventas', icon: 'ti-trending-up', color: '#db2777', desc: 'Equipos comerciales y seguimiento de leads.' },
  educacion: { label: 'Educación', icon: 'ti-school', color: '#0891b2', desc: 'Colegios, universidades, instituciones.' },
};

const FIELD_TEMPLATES = {
  general: [],
  soporte: [
    { key: 'numero_contrato', label: 'N° Contrato', type: 'text', required: false },
    { key: 'producto', label: 'Producto', type: 'text', required: false },
    { key: 'tipo_falla', label: 'Tipo de Falla', type: 'select', options: 'Hardware,Software,Conectividad,Otro', required: false },
    { key: 'sla_horas', label: 'SLA (horas)', type: 'number', required: false },
  ],
  cobranza: [
    { key: 'monto_deuda', label: 'Monto Deuda ($)', type: 'number', required: true },
    { key: 'cuotas_pendientes', label: 'Cuotas Pendientes', type: 'number', required: false },
    { key: 'fecha_vencimiento', label: 'Fecha Vencimiento', type: 'date', required: false },
    { key: 'tipo_documento', label: 'Tipo Documento', type: 'select', options: 'Factura,Pagaré,Boleta,Otro', required: false },
    { key: 'numero_documento', label: 'N° Documento', type: 'text', required: false },
  ],
  salud: [
    { key: 'fecha_nacimiento', label: 'Fecha Nacimiento', type: 'date', required: false },
    { key: 'prevision', label: 'Previsión', type: 'select', options: 'FONASA,ISAPRE,CAPREDENA,DIPRECA,Particular', required: false },
    { key: 'numero_ficha', label: 'N° Ficha', type: 'text', required: false },
    { key: 'medico_tratante', label: 'Médico Tratante', type: 'text', required: false },
  ],
  inmobiliaria: [
    { key: 'tipo_propiedad', label: 'Tipo Propiedad', type: 'select', options: 'Casa,Departamento,Oficina,Local,Terreno', required: false },
    { key: 'precio', label: 'Precio (UF)', type: 'number', required: false },
    { key: 'comuna', label: 'Comuna', type: 'text', required: false },
    { key: 'etapa_negociacion', label: 'Etapa Negociación', type: 'select', options: 'Prospecto,Interesado,Visita,Oferta,Cierre', required: false },
  ],
  ventas: [
    { key: 'producto_interes', label: 'Producto de Interés', type: 'text', required: false },
    { key: 'presupuesto', label: 'Presupuesto ($)', type: 'number', required: false },
    { key: 'etapa_embudo', label: 'Etapa Embudo', type: 'select', options: 'Lead,Contactado,Demo,Propuesta,Cierre,Perdido', required: false },
    { key: 'origen_lead', label: 'Origen del Lead', type: 'select', options: 'Web,Referido,Redes Sociales,Email,Evento,Otro', required: false },
  ],
  educacion: [
    { key: 'carrera', label: 'Carrera / Programa', type: 'text', required: false },
    { key: 'semestre', label: 'Semestre / Nivel', type: 'text', required: false },
    { key: 'jornada', label: 'Jornada', type: 'select', options: 'Diurna,Vespertina,Online', required: false },
    { key: 'apoderado', label: 'Nombre Apoderado', type: 'text', required: false },
  ],
};

const FIELD_TYPE_LABELS = { text: 'Texto', number: 'Número', date: 'Fecha', select: 'Lista opciones' };

export default function TenantsManager({ isDark = true }) {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('list'); // 'list' | 'create' | 'fields'
  const [selectedTenant, setSelectedTenant] = useState(null);

  // Form crear empresa
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('general');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [llmMarkup, setLlmMarkup] = useState('1.20');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#2563eb');
  const [creating, setCreating] = useState(false);

  // Campos seleccionados al crear/editar
  const [selectedFields, setSelectedFields] = useState([]);
  const [customFields, setCustomFields] = useState([]);   // campos propios añadidos

  // Edit states
  const [editingTenantId, setEditingTenantId] = useState(null);

  const c = {
    card: isDark ? '#111' : '#ffffff',
    border: isDark ? '#222' : '#e5e7eb',
    thead: isDark ? '#1a1a1a' : '#f3f4f6',
    title: isDark ? '#ffffff' : '#111827',
    subtitle: isDark ? '#aaaaaa' : '#6b7280',
    inputBg: isDark ? '#1a1a1a' : '#f9fafb',
    inputText: isDark ? '#ffffff' : '#111827',
    label: isDark ? '#888888' : '#6b7280',
    rowText: isDark ? '#ffffff' : '#111827',
    rowMono: isDark ? '#aaaaaa' : '#6b7280',
  };

  const inputStyle = { backgroundColor: c.inputBg, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '10px', color: c.inputText, outline: 'none', fontSize: '14px', width: '100%', boxSizing: 'border-box' };

  useEffect(() => { fetchTenants(); }, []);

  const handleIndustryChange = (newIndustry) => {
    setIndustry(newIndustry);
    setSelectedFields((FIELD_TEMPLATES[newIndustry] || []).map(f => f.key));
    // No borramos custom fields para que no se pierdan si el usuario los escribió
  };

  const fetchTenants = async () => {
    try {
      const { data, error } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setTenants(data || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true); setError(null);
    try {
      let currentTenantId = editingTenantId;

      if (editingTenantId) {
        // UPDATE
        const { error: updErr } = await supabase.from('tenants')
          .update({ name, industry_type: industry, website, address, is_active: isActive, llm_markup_multiplier: parseFloat(llmMarkup) || 1.20, logo_url: logoUrl, primary_color: primaryColor })
          .eq('id', editingTenantId);
        if (updErr) throw updErr;

        // Borramos los campos antiguos para reescribir
        await supabase.from('tenant_field_definitions').delete().eq('tenant_id', editingTenantId);
      } else {
        // INSERT
        const { data, error } = await supabase.from('tenants')
          .insert([{ name, industry_type: industry, website, address, is_active: isActive, llm_markup_multiplier: parseFloat(llmMarkup) || 1.20, logo_url: logoUrl, primary_color: primaryColor }])
          .select();
        if (error) throw error;
        currentTenantId = data[0].id;

        // Crear config IA por defecto
        await supabase.from('tenant_ai_config').insert([{
          tenant_id: currentTenantId,
          company_name: name,
          agent_name: 'KUDEN',
          base_prompt: `Eres el agente virtual de ${name}. Responde con amabilidad y profesionalismo.`,
        }]);
      }

      // 2. Insertar campos seleccionados y custom
      const template = (FIELD_TEMPLATES[industry] || []).filter(f => selectedFields.includes(f.key));
      const allFields = [...template, ...customFields];

      if (allFields.length > 0) {
        const rows = allFields.map((f, i) => ({
          tenant_id: currentTenantId,
          field_key: f.key,
          field_label: f.label,
          field_type: f.type || 'text',
          options: f.options || null,
          is_required: f.required || false,
          sort_order: i,
        }));
        const { error: fe } = await supabase.from('tenant_field_definitions').insert(rows);
        if (fe) throw fe;
      }

      fetchTenants();
      setName(''); setIndustry('general'); setWebsite(''); setAddress(''); setIsActive(true); setLlmMarkup('1.20'); setLogoUrl(''); setPrimaryColor('#2563eb'); setSelectedFields([]); setCustomFields([]);
      setEditingTenantId(null);
      setView('list');
      alert(editingTenantId ? `✅ Empresa "${name}" actualizada.` : `✅ Empresa "${name}" creada con ${allFields.length} campos.`);
    } catch (err) { setError(err.message); }
    finally { setCreating(false); }
  };

  const addCustomField = () => {
    setCustomFields(prev => [...prev, { key: `custom_${Date.now()}`, label: '', type: 'text', options: '', required: false }]);
  };

  const updateCustomField = (idx, updates) => {
    setCustomFields(prev => prev.map((f, i) => i === idx ? { ...f, ...updates } : f));
  };

  const removeCustomField = (idx) => {
    setCustomFields(prev => prev.filter((_, i) => i !== idx));
  };

  const toggleTemplateField = (key) => {
    setSelectedFields(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const openEdit = async (t) => {
    setEditingTenantId(t.id);
    setName(t.name);
    setIndustry(t.industry_type);
    setWebsite(t.website || '');
    setAddress(t.address || '');
    setIsActive(t.is_active !== false);
    setLlmMarkup(t.llm_markup_multiplier ? t.llm_markup_multiplier.toString() : '1.20');
    setLogoUrl(t.logo_url || '');
    setPrimaryColor(t.primary_color || '#2563eb');

    // Cargar campos personalizados
    const { data: fieldsData } = await supabase.from('tenant_field_definitions').select('*').eq('tenant_id', t.id).order('sort_order');
    if (fieldsData) {
      const templateKeys = (FIELD_TEMPLATES[t.industry_type] || []).map(f => f.key);
      const selected = [];
      const custom = [];
      fieldsData.forEach(d => {
        if (templateKeys.includes(d.field_key)) {
          selected.push(d.field_key);
        } else {
          custom.push({ key: d.field_key, label: d.field_label, type: d.field_type, options: d.options, required: d.is_required });
        }
      });
      setSelectedFields(selected);
      setCustomFields(custom);
    } else {
      setSelectedFields((FIELD_TEMPLATES[t.industry_type] || []).map(f => f.key));
      setCustomFields([]);
    }

    setError(null);
    setView('create');
  };

  const startCreate = () => {
    setEditingTenantId(null);
    setName(''); setIndustry('general'); setWebsite(''); setAddress(''); setIsActive(true); setLlmMarkup('1.20'); setLogoUrl(''); setPrimaryColor('#2563eb');
    setSelectedFields((FIELD_TEMPLATES['general'] || []).map(f => f.key));
    setCustomFields([]);
    setError(null);
    setView('create');
  };

  // ─────────────────────────────────────────────────────────
  // Vista Lista
  // ─────────────────────────────────────────────────────────
  if (view === 'list') return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px', color: c.title }}>Empresas (Tenants)</h2>
          <p style={{ margin: 0, fontSize: '14px', color: c.subtitle }}>Gestiona las organizaciones cliente de Kuden IA.</p>
        </div>
        <button onClick={startCreate}
          style={{ backgroundColor: '#2563eb', color: '#fff', fontWeight: '600', padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <i className="ti ti-plus"></i> Nueva Empresa
        </button>
      </div>

      {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.5)', color: '#f87171', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>{error}</div>}

      <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: c.thead, borderBottom: `1px solid ${c.border}` }}>
              {['Empresa', 'Industria', 'Estado', 'Creado', 'Acciones'].map(h => (
                <th key={h} style={{ padding: '14px 16px', color: c.subtitle, fontWeight: '500', fontSize: '12px', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: c.subtitle }}>Cargando...</td></tr>
            ) : tenants.length === 0 ? (
              <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: c.subtitle }}>No hay empresas registradas</td></tr>
            ) : tenants.map(t => {
              const ind = INDUSTRY_CATALOG[t.industry_type] || INDUSTRY_CATALOG.general;
              const isActive = t.is_active !== false;
              return (
                <tr key={t.id} style={{ borderBottom: `1px solid ${c.border}`, opacity: isActive ? 1 : 0.6 }}>
                  <td style={{ padding: '14px 16px', color: c.rowText, fontWeight: '500' }}>
                    {t.name}
                    <div style={{ fontSize: '11px', color: c.rowMono, marginTop: '4px', fontFamily: 'monospace' }}>{t.id}</div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '3px 10px', borderRadius: '20px', background: ind.color + '20', color: ind.color, border: `1px solid ${ind.color}40`, fontWeight: '600' }}>
                      <i className={`ti ${ind.icon}`}></i> {ind.label}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ padding: '4px 10px', background: isActive ? '#1D9E7520' : '#E24B4A20', color: isActive ? '#1D9E75' : '#E24B4A', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                      {isActive ? 'Activo' : 'Desactivado'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', color: c.subtitle, fontSize: '13px' }}>{new Date(t.created_at).toLocaleDateString('es-CL')}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <button onClick={() => openEdit(t)} style={{ background: 'transparent', border: 'none', color: '#60a5fa', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
                      <i className="ti ti-edit"></i> Editar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );

  // ─────────────────────────────────────────────────────────
  // Vista Crear empresa
  // ─────────────────────────────────────────────────────────
  const templateFields = FIELD_TEMPLATES[industry] || [];
  const ind = INDUSTRY_CATALOG[industry];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
        <button onClick={() => { setView('list'); setEditingTenantId(null); }} style={{ background: 'none', border: 'none', color: c.subtitle, cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <i className="ti ti-arrow-left"></i> Volver
        </button>
        <h2 style={{ fontSize: '22px', fontWeight: 'bold', margin: 0, color: c.title }}>{editingTenantId ? 'Editar Empresa' : 'Nueva Empresa'}</h2>
      </div>

      {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.5)', color: '#f87171', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>{error}</div>}

      <form onSubmit={handleSave}>
        {/* Datos básicos */}
        <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 20px', fontSize: '16px', color: c.title }}>1. Datos de la empresa</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', color: c.label }}>Nombre de la Empresa</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Ej: ConectaChile SPA" style={inputStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', color: c.label }}>Industria / Sector</label>
              <select value={industry} onChange={e => handleIndustryChange(e.target.value)} style={inputStyle}>
                {Object.entries(INDUSTRY_CATALOG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', color: c.label }}>Sitio Web (Opcional)</label>
              <input type="url" value={website} onChange={e => setWebsite(e.target.value)} placeholder="Ej: https://www.ejemplo.com" style={inputStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', color: c.label }}>Dirección (Opcional)</label>
              <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Ej: Av. Providencia 1234" style={inputStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', color: c.label }}>Multiplicador de Cobro IA (Markup)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="number" step="0.01" min="1.00" value={llmMarkup} onChange={e => setLlmMarkup(e.target.value)} style={{ ...inputStyle, width: '100px' }} />
                <span style={{ fontSize: '12px', color: c.subtitle }}>ej: 1.20 = +20% margen</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', color: c.label }}>Logo URL (Marca Blanca)</label>
              <input type="url" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="Ej: https://img.com/logo.png" style={inputStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', color: c.label }}>Color Principal Corporativo (HEX)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} style={{ width: '40px', height: '40px', padding: '2px', border: `1px solid ${c.border}`, borderRadius: '8px', cursor: 'pointer', background: 'transparent' }} />
                <input type="text" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} placeholder="#2563eb" style={{ ...inputStyle, width: '100px' }} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: isActive ? 'rgba(29,158,117,0.1)' : 'rgba(226,75,74,0.1)', border: `1px solid ${isActive ? '#1D9E7550' : '#E24B4A50'}`, borderRadius: '8px' }}>
                <input type="checkbox" id="tenantActive" checked={isActive} onChange={e => setIsActive(e.target.checked)} style={{ cursor: 'pointer' }} />
                <label htmlFor="tenantActive" style={{ fontSize: '13px', color: c.inputText, cursor: 'pointer', fontWeight: '500' }}>
                  Empresa Activa (Permitir acceso a sus usuarios)
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Selector de industria */}
        <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 6px', fontSize: '16px', color: c.title }}>2. Tipo de Industria</h3>
          <p style={{ margin: '0 0 16px', fontSize: '13px', color: c.subtitle }}>Selecciona el rubro. Kuden pre-cargará los campos más comunes para ese tipo de empresa.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '10px' }}>
            {Object.entries(INDUSTRY_CATALOG).map(([key, info]) => (
              <button key={key} type="button" onClick={() => setIndustry(key)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px', padding: '14px', borderRadius: '10px', border: `2px solid ${industry === key ? info.color : c.border}`, backgroundColor: industry === key ? info.color + '15' : 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                <i className={`ti ${info.icon}`} style={{ fontSize: '22px', color: industry === key ? info.color : c.subtitle }}></i>
                <span style={{ fontSize: '13px', fontWeight: '600', color: industry === key ? info.color : c.title }}>{info.label}</span>
                <span style={{ fontSize: '11px', color: c.subtitle, lineHeight: 1.3 }}>{info.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Campos de datos del contacto */}
        <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 6px', fontSize: '16px', color: c.title }}>3. Campos del Contacto</h3>
          <p style={{ margin: '0 0 16px', fontSize: '13px', color: c.subtitle }}>
            Campos base (siempre presentes): <strong>Nombre, RUT, Teléfono, Email, Dirección, Plan</strong>. Selecciona los campos extra según tu industria.
          </p>

          {templateFields.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: '600', color: ind.color, textTransform: 'uppercase' }}>
                <i className={`ti ${ind.icon}`}></i> Campos sugeridos para {ind.label}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {templateFields.map(f => (
                  <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${selectedFields.includes(f.key) ? ind.color + '60' : c.border}`, backgroundColor: selectedFields.includes(f.key) ? ind.color + '10' : 'transparent', cursor: 'pointer', transition: 'all 0.15s' }}>
                    <input type="checkbox" checked={selectedFields.includes(f.key)} onChange={() => toggleTemplateField(f.key)} style={{ width: '16px', height: '16px', accentColor: ind.color, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '14px', fontWeight: '500', color: c.title }}>{f.label}</span>
                      {f.required && <span style={{ marginLeft: '6px', fontSize: '10px', color: '#ef4444', fontWeight: '600' }}>REQUERIDO</span>}
                    </div>
                    <span style={{ fontSize: '11px', color: c.subtitle, padding: '2px 8px', background: c.border, borderRadius: '4px' }}>{FIELD_TYPE_LABELS[f.type] || f.type}</span>
                    {f.options && <span style={{ fontSize: '11px', color: c.subtitle, maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.options}</span>}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Campos personalizados */}
          <div>
            <p style={{ margin: '16px 0 10px', fontSize: '12px', fontWeight: '600', color: c.subtitle, textTransform: 'uppercase' }}>Campos personalizados adicionales</p>
            {customFields.map((f, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px auto', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                <input type="text" placeholder="Nombre campo (ej: N° Socio)" value={f.label} onChange={e => updateCustomField(idx, { label: e.target.value, key: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') })}
                  style={{ ...inputStyle, fontSize: '13px', padding: '8px 10px' }} />
                <select value={f.type} onChange={e => updateCustomField(idx, { type: e.target.value })} style={{ ...inputStyle, fontSize: '13px', padding: '8px 10px' }}>
                  {Object.entries(FIELD_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                {f.type === 'select' ? (
                  <input type="text" placeholder="Op1,Op2,Op3" value={f.options} onChange={e => updateCustomField(idx, { options: e.target.value })}
                    style={{ ...inputStyle, fontSize: '12px', padding: '8px 10px' }} />
                ) : (
                  <div />
                )}
                <button type="button" onClick={() => removeCustomField(idx)} style={{ background: '#ef444420', border: 'none', color: '#f87171', borderRadius: '6px', padding: '8px', cursor: 'pointer', fontSize: '16px' }}>✕</button>
              </div>
            ))}
            <button type="button" onClick={addCustomField}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: `1px dashed ${c.border}`, backgroundColor: 'transparent', color: c.subtitle, cursor: 'pointer', fontSize: '13px', marginTop: '4px' }}>
              <i className="ti ti-plus"></i> Agregar campo personalizado
            </button>
          </div>
        </div>

        {/* Resumen + Guardar */}
        <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: '600', color: c.title }}>Resumen</p>
            <p style={{ margin: 0, fontSize: '13px', color: c.subtitle }}>
              {templateFields.filter(f => selectedFields.includes(f.key)).length + customFields.length} campo(s) extra · Industria: <strong style={{ color: ind.color }}>{ind.label}</strong>
            </p>
          </div>
          <button type="submit" disabled={creating || !name.trim()}
            style={{ backgroundColor: '#2563eb', color: '#fff', fontWeight: '600', padding: '12px 28px', borderRadius: '8px', border: 'none', cursor: creating || !name.trim() ? 'not-allowed' : 'pointer', opacity: creating || !name.trim() ? 0.6 : 1, fontSize: '14px' }}>
            {creating ? 'Guardando...' : (editingTenantId ? 'Actualizar Empresa →' : 'Crear Empresa →')}
          </button>
        </div>
      </form>
    </div>
  );
}
