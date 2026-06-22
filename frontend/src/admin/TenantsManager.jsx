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
  const [view, setView] = useState('list'); // 'list' | 'create'
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('general');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [llmMarkup, setLlmMarkup] = useState('1.20');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#2563eb');
  const [forgottenHours, setForgottenHours] = useState('12');
  const [creating, setCreating] = useState(false);

  // Campos seleccionados al crear/editar
  const [selectedFields, setSelectedFields] = useState([]);
  const [customFields, setCustomFields] = useState([]);   // campos propios añadidos

  // Edit states
  const [editingTenantId, setEditingTenantId] = useState(null);

  useEffect(() => { fetchTenants(); }, []);

  const handleIndustryChange = (newIndustry) => {
    setIndustry(newIndustry);
    setSelectedFields((FIELD_TEMPLATES[newIndustry] || []).map(f => f.key));
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
          .update({ name, industry_type: industry, website, address, is_active: isActive, llm_markup_multiplier: parseFloat(llmMarkup) || 1.20, logo_url: logoUrl, primary_color: primaryColor, forgotten_ticket_hours_threshold: parseInt(forgottenHours, 10) || 12 })
          .eq('id', editingTenantId);
        if (updErr) throw updErr;

        // Borramos los campos antiguos para reescribir
        await supabase.from('tenant_field_definitions').delete().eq('tenant_id', editingTenantId);
      } else {
        // INSERT
        const { data, error } = await supabase.from('tenants')
          .insert([{ name, industry_type: industry, website, address, is_active: isActive, llm_markup_multiplier: parseFloat(llmMarkup) || 1.20, logo_url: logoUrl, primary_color: primaryColor, forgotten_ticket_hours_threshold: parseInt(forgottenHours, 10) || 12 }])
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
      setName(''); setIndustry('general'); setWebsite(''); setAddress(''); setIsActive(true); setLlmMarkup('1.20'); setLogoUrl(''); setPrimaryColor('#2563eb'); setForgottenHours('12'); setSelectedFields([]); setCustomFields([]);
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
    setForgottenHours(t.forgotten_ticket_hours_threshold ? t.forgotten_ticket_hours_threshold.toString() : '12');

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
    setName(''); setIndustry('general'); setWebsite(''); setAddress(''); setIsActive(true); setLlmMarkup('1.20'); setLogoUrl(''); setPrimaryColor('#2563eb'); setForgottenHours('12');
    setSelectedFields((FIELD_TEMPLATES['general'] || []).map(f => f.key));
    setCustomFields([]);
    setError(null);
    setView('create');
  };

  // ─────────────────────────────────────────────────────────
  // Vista Lista
  // ─────────────────────────────────────────────────────────
  if (view === 'list') return (
    <div className="tenants-container">
      <div className="tenants-header-row">
        <div>
          <h2 className="tenants-title">Empresas (Tenants)</h2>
          <p className="tenants-subtitle">Gestiona las organizaciones cliente de Kuden IA.</p>
        </div>
        <button onClick={startCreate} className="tenants-btn-primary">
          <i className="ti ti-plus"></i> Nueva Empresa
        </button>
      </div>

      {error && (
        <div className="insights-alert-error">
          <i className="ti ti-alert-circle tenants-alert-icon"></i> {error}
        </div>
      )}

      <div className="tenants-table-card">
        <table className="tenants-table">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Industria</th>
              <th>Estado</th>
              <th>Creado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" className="tenants-table-empty">Cargando...</td></tr>
            ) : tenants.length === 0 ? (
              <tr><td colSpan="5" className="tenants-table-empty">No hay empresas registradas</td></tr>
            ) : tenants.map(t => {
              const ind = INDUSTRY_CATALOG[t.industry_type] || INDUSTRY_CATALOG.general;
              const isActive = t.is_active !== false;
              return (
                <tr key={t.id} className={isActive ? '' : 'tenants-row-inactive'}>
                  <td className="tenants-cell-name">
                    {t.name}
                    <div className="tenants-cell-id">{t.id}</div>
                  </td>
                  <td>
                    <span 
                      className="tenants-badge-industry" 
                      style={{ '--industry-theme-color': ind.color }}
                    >
                      <i className={`ti ${ind.icon}`}></i> {ind.label}
                    </span>
                  </td>
                  <td>
                    <span className={`users-badge ${isActive ? 'users-badge-active' : 'users-badge-disabled'}`}>
                      {isActive ? 'Activo' : 'Desactivado'}
                    </span>
                  </td>
                  <td className="tenants-cell-date">{new Date(t.created_at).toLocaleDateString('es-CL')}</td>
                  <td>
                    <button onClick={() => openEdit(t)} className="tenants-btn-secondary tenants-btn-secondary-sm">
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
  // Vista Crear/Editar empresa
  // ─────────────────────────────────────────────────────────
  const templateFields = FIELD_TEMPLATES[industry] || [];
  const ind = INDUSTRY_CATALOG[industry];

  return (
    <div className="tenants-container">
      <div className="tenants-form-header">
        <button onClick={() => { setView('list'); setEditingTenantId(null); }} className="tenants-btn-secondary tenants-btn-secondary-sm">
          <i className="ti ti-arrow-left"></i> Volver
        </button>
        <h2 className="tenants-title">{editingTenantId ? 'Editar Empresa' : 'Nueva Empresa'}</h2>
      </div>

      {error && (
        <div className="insights-alert-error">
          <i className="ti ti-alert-circle tenants-alert-icon"></i> {error}
        </div>
      )}

      <form onSubmit={handleSave}>
        {/* Datos básicos */}
        <div className="tenants-form-card">
          <h3 className="tenants-form-card-title">1. Datos de la empresa</h3>
          <div className="tenants-form-grid-2">
            <div className="tenants-form-group">
              <label className="tenants-form-label">Nombre de la Empresa</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Ej: ConectaChile SPA" className="tenants-input" />
            </div>
            <div className="tenants-form-group">
              <label className="tenants-form-label">Sitio Web (Opcional)</label>
              <input type="url" value={website} onChange={e => setWebsite(e.target.value)} placeholder="Ej: https://www.ejemplo.com" className="tenants-input" />
            </div>
            <div className="tenants-form-group">
              <label className="tenants-form-label">Dirección (Opcional)</label>
              <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Ej: Av. Providencia 1234" className="tenants-input" />
            </div>
            <div className="tenants-form-group">
              <label className="tenants-form-label">Multiplicador de Cobro IA (Markup)</label>
              <div className="tenants-input-group-row">
                <input type="number" step="0.01" min="1.00" value={llmMarkup} onChange={e => setLlmMarkup(e.target.value)} className="tenants-input tenants-color-picker-text" />
                <span className="tenants-input-markup-suffix">ej: 1.20 = +20% margen</span>
              </div>
            </div>
            <div className="tenants-form-group">
              <label className="tenants-form-label">Logo URL (Marca Blanca)</label>
              <input type="url" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="Ej: https://img.com/logo.png" className="tenants-input" />
            </div>
            <div className="tenants-form-group">
              <label className="tenants-form-label">Color Principal Corporativo (HEX)</label>
              <div className="tenants-color-picker-wrapper">
                <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="tenants-input tenants-color-picker-btn" />
                <input type="text" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} placeholder="#2563eb" className="tenants-input tenants-color-picker-text" />
              </div>
            </div>
            <div className="tenants-form-group">
              <label className="tenants-form-label">Umbral Tickets Olvidados (Horas)</label>
              <input type="number" min="1" value={forgottenHours} onChange={e => setForgottenHours(e.target.value)} className="tenants-input" placeholder="12" />
              <span className="tenants-form-text-info">Conversaciones inactivas asignadas a un agente que superen estas horas mostrarán alerta y bloquearán la toma de nuevos tickets.</span>
            </div>
            <div className="users-checkbox-banner tenants-form-group-full">
              <input type="checkbox" id="tenantActive" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="users-checkbox-input" />
              <label htmlFor="tenantActive" className="users-checkbox-label">
                Empresa Activa (Permitir acceso a sus usuarios)
              </label>
            </div>
          </div>
        </div>

        {/* Selector de industria */}
        <div className="tenants-form-card">
          <h3 className="tenants-form-card-title">2. Tipo de Industria</h3>
          <p className="tenants-form-card-subtitle">Selecciona el rubro. Kuden pre-cargará los campos más comunes para ese tipo de empresa.</p>
          <div className="tenants-industry-grid">
            {Object.entries(INDUSTRY_CATALOG).map(([key, info]) => (
              <button 
                key={key} 
                type="button" 
                onClick={() => handleIndustryChange(key)}
                className={`tenants-industry-btn ${industry === key ? 'active' : ''}`}
                style={{
                  '--industry-theme-color': info.color,
                  '--industry-theme-color-alpha': info.color + '15'
                }}
              >
                <i className={`ti ${info.icon} tenants-industry-btn-icon`}></i>
                <span className="tenants-industry-btn-label">{info.label}</span>
                <span className="tenants-industry-btn-desc">{info.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Campos de datos del contacto */}
        <div className="tenants-form-card">
          <h3 className="tenants-form-card-title">3. Campos del Contacto</h3>
          <p className="tenants-form-card-subtitle">
            Campos base (siempre presentes): <strong>Nombre, RUT, Teléfono, Email, Dirección, Plan</strong>. Selecciona los campos extra según tu industria.
          </p>

          {templateFields.length > 0 && (
            <div className="tenants-form-card-subtitle">
              <p 
                className="tenants-suggested-header"
                style={{ '--industry-theme-color': ind.color }}
              >
                <i className={`ti ${ind.icon}`}></i> Campos sugeridos para {ind.label}
              </p>
              <div className="tenants-field-list">
                {templateFields.map(f => {
                  const isSel = selectedFields.includes(f.key);
                  return (
                    <label 
                      key={f.key} 
                      className={`tenants-field-label ${isSel ? 'selected' : ''}`}
                      style={{ '--industry-theme-color': ind.color }}
                    >
                      <input 
                        type="checkbox" 
                        checked={isSel} 
                        onChange={() => toggleTemplateField(f.key)} 
                        className="tenants-field-checkbox"
                        style={{ '--industry-theme-color': ind.color }}
                      />
                      <div className="tenants-field-info">
                        <span className="tenants-field-name">{f.label}</span>
                        {f.required && <span className="tenants-field-badge-req">REQUERIDO</span>}
                      </div>
                      <span className="tenants-field-badge-type">{FIELD_TYPE_LABELS[f.type] || f.type}</span>
                      {f.options && <span className="tenants-field-badge-options">{f.options}</span>}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Campos personalizados */}
          <div className="tenants-custom-fields-wrapper">
            <p className="tenants-custom-fields-title">Campos personalizados adicionales</p>
            {customFields.map((f, idx) => (
              <div key={idx} className="tenants-custom-field-row">
                <input 
                  type="text" 
                  placeholder="Nombre campo (ej: N° Socio)" 
                  value={f.label} 
                  onChange={e => updateCustomField(idx, { label: e.target.value, key: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') })}
                  className="tenants-input tenants-custom-field-input" 
                />
                <select 
                  value={f.type} 
                  onChange={e => updateCustomField(idx, { type: e.target.value })} 
                  className="tenants-select tenants-custom-field-select"
                >
                  {Object.entries(FIELD_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                {f.type === 'select' ? (
                  <input 
                    type="text" 
                    placeholder="Op1,Op2,Op3" 
                    value={f.options} 
                    onChange={e => updateCustomField(idx, { options: e.target.value })}
                    className="tenants-input tenants-custom-field-input" 
                  />
                ) : (
                  <div />
                )}
                <button 
                  type="button" 
                  onClick={() => removeCustomField(idx)} 
                  className="users-btn-danger tenants-custom-field-delete"
                >
                  ✕
                </button>
              </div>
            ))}
            <button 
              type="button" 
              onClick={addCustomField}
              className="tenants-btn-secondary tenants-btn-dashed"
            >
              <i className="ti ti-plus"></i> Agregar campo personalizado
            </button>
          </div>
        </div>

        {/* Resumen + Guardar */}
        <div className="tenants-form-card tenants-form-footer">
          <div>
            <p className="tenants-summary-title">Resumen</p>
            <p className="tenants-summary-desc">
              {templateFields.filter(f => selectedFields.includes(f.key)).length + customFields.length} campo(s) extra · Industria: <strong style={{ color: ind.color }}>{ind.label}</strong>
            </p>
          </div>
          <button type="submit" disabled={creating || !name.trim()} className="tenants-btn-primary">
            {creating ? 'Guardando...' : (editingTenantId ? 'Actualizar Empresa →' : 'Crear Empresa →')}
          </button>
        </div>
      </form>
    </div>
  );
}
