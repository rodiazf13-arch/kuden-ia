import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import Contact360View from './Contact360View';

function normalizeRut(rut) {
  if (!rut) return null;
  let r = String(rut).trim().toLowerCase().replace(/[^0-9k\-]/g, '');
  if (!r.includes('-') && r.length > 1) {
    r = r.slice(0, -1) + '-' + r.slice(-1);
  }
  return r;
}

function normalizePhone(phone) {
  if (!phone) return null;
  let p = String(phone).replace(/[^0-9+]/g, '');
  if (p.startsWith('56') && p.length === 11) p = '+' + p;
  else if (p.length === 9 && !p.startsWith('+')) p = '+56' + p;
  else if (p.length === 8 && !p.startsWith('+')) p = '+569' + p;
  return p;
}

// Campos base siempre presentes en contacts (columnas reales de la tabla)
const BASE_FIELD_SECTIONS = [
  {
    title: 'Identificación',
    icon: 'ti-id-badge',
    fields: [
      { key: 'cliente_nombre', label: 'Nombre completo', type: 'text', required: true,  col: '1/-1' },
      { key: 'rut',            label: 'RUT / ID',        type: 'text', required: false              },
      { key: 'fecha_nacimiento', label: 'Fecha de nacimiento', type: 'date', required: false  },
    ],
  },
  {
    title: 'Contacto',
    icon: 'ti-phone',
    fields: [
      { key: 'telefono', label: 'Teléfono',         type: 'text', required: true  },
      { key: 'email',    label: 'Correo electrónico', type: 'text', required: true  },
    ],
  },
  {
    title: 'Ubicación',
    icon: 'ti-map-pin',
    fields: [
      { key: 'direccion', label: 'Dirección',        type: 'text', required: false },
      { key: 'comuna',    label: 'Comuna',           type: 'text', required: false },
      { key: 'ciudad',    label: 'Ciudad',           type: 'text', required: false },
      { key: 'region',    label: 'Región',           type: 'text', required: false },
    ],
  },
  {
    title: 'Empresa / Cargo',
    icon: 'ti-briefcase',
    fields: [
      { key: 'empresa', label: 'Empresa donde trabaja', type: 'text', required: false },
      { key: 'cargo',   label: 'Cargo / Rol',           type: 'text', required: false },
    ],
  },
  {
    title: 'Redes Sociales',
    icon: 'ti-share',
    fields: [
      { key: 'facebook',  label: 'Facebook',  type: 'text', required: false },
      { key: 'instagram', label: 'Instagram', type: 'text', required: false },
      { key: 'linkedin',  label: 'LinkedIn',  type: 'text', required: false },
      { key: 'twitter',   label: 'X (Twitter)', type: 'text', required: false },
      { key: 'tiktok',    label: 'TikTok',    type: 'text', required: false },
    ],
  },
  {
    title: 'CRM / Simulador',
    icon: 'ti-chart-bar',
    fields: [
      { key: 'plan', label: 'Plan / Producto contratado', type: 'text', required: false },
    ],
  },
];

// Todos los campos base en una sola lista plana (para crear/editar)
const ALL_BASE_FIELDS = BASE_FIELD_SECTIONS.flatMap(s => s.fields);

export default function ContactsManager({ tenantId, isDark = true, userId }) {
  const [view,         setView]         = useState('list');
  const [contacts,     setContacts]     = useState([]);
  const [fieldDefs,    setFieldDefs]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [search,       setSearch]       = useState('');
  const [saving,       setSaving]       = useState(false);
  const [formData,     setFormData]     = useState({});
  const [phonePrefix,  setPhonePrefix]  = useState('+56');
  const [editingContact, setEditingContact] = useState(null);
  const [selectedContacts, setSelectedContacts] = useState([]);

  // NUEVOS FILTROS Y COLUMNAS DINÁMICAS
  const DEFAULT_COLS = ['Nombre', 'RUT', 'Teléfono', 'Email', 'Estado', 'NPS Histórico', 'Riesgo Fuga'];
  const AVAILABLE_COLS = ['Nombre', 'RUT', 'Teléfono', 'Email', 'Empresa', 'Estado', 'NPS Histórico', 'Riesgo Fuga'];
  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = localStorage.getItem(`kuden_contacts_cols_${tenantId}`);
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return DEFAULT_COLS;
  });
  const [showColDropdown, setShowColDropdown] = useState(false);
  const [fugaFilter, setFugaFilter] = useState('all');
  const [npsFilter, setNpsFilter] = useState('all');

  useEffect(() => {
    localStorage.setItem(`kuden_contacts_cols_${tenantId}`, JSON.stringify(visibleCols));
  }, [visibleCols, tenantId]);

  // CSV
  const [csvHeaders,   setCsvHeaders]   = useState([]);
  const [csvRows,      setCsvRows]      = useState([]);
  const [csvMapping,   setCsvMapping]   = useState({});
  const [csvFile,      setCsvFile]      = useState(null);
  const [importing,    setImporting]    = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef();

  const c = {
    card:      isDark ? '#111'    : '#ffffff',
    border:    isDark ? '#222'    : '#e5e7eb',
    thead:     isDark ? '#1a1a1a' : '#f3f4f6',
    title:     isDark ? '#ffffff' : '#111827',
    subtitle:  isDark ? '#aaaaaa' : '#6b7280',
    inputBg:   isDark ? '#1a1a1a' : '#f9fafb',
    inputText: isDark ? '#ffffff' : '#111827',
    label:     isDark ? '#888888' : '#6b7280',
    rowText:   isDark ? '#ffffff' : '#111827',
    rowSub:    isDark ? '#aaaaaa' : '#6b7280',
    sectionBg: isDark ? '#0f0f0f' : '#f9fafb',
  };


  // Todos los campos (base + custom del tenant) para el mapeo CSV
  const allFieldsFlat = [
    ...ALL_BASE_FIELDS.map(f => ({ ...f, field_key: f.key, field_label: f.label })),
    ...fieldDefs.map(f => ({ ...f, key: f.field_key })),
  ];

  useEffect(() => { if (tenantId) init(); }, [tenantId]);

  const init = async () => {
    setLoading(true);
    try {
      const [cRes, fRes] = await Promise.all([
        supabase.from('contacts').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(200),
        supabase.from('tenant_field_definitions').select('*').eq('tenant_id', tenantId).order('sort_order'),
      ]);
      if (cRes.error) throw cRes.error;
      if (fRes.error) throw fRes.error;
      setContacts(cRes.data || []);
      setFieldDefs(fRes.data || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  // ── Guardar contacto (Crear o Editar) ──────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const customData = {};
      fieldDefs.forEach(f => {
        if (formData[f.field_key] !== undefined && formData[f.field_key] !== '')
          customData[f.field_key] = formData[f.field_key];
      });

      const fullPhone = formData.telefono ? `${phonePrefix}${formData.telefono}` : null;

      const row = {
        tenant_id:        tenantId,
        cliente_nombre:   formData.cliente_nombre   || '',
        rut:              normalizeRut(formData.rut),
        telefono:         normalizePhone(fullPhone),
        email:            formData.email            || null,
        direccion:        formData.direccion        || null,
        plan:             formData.plan             || null,
        comuna:           formData.comuna           || null,
        ciudad:           formData.ciudad           || null,
        region:           formData.region           || null,
        empresa:          formData.empresa          || null,
        cargo:            formData.cargo            || null,
        fecha_nacimiento: formData.fecha_nacimiento || null,
        facebook:         formData.facebook         || null,
        instagram:        formData.instagram        || null,
        linkedin:         formData.linkedin         || null,
        twitter:          formData.twitter          || null,
        tiktok:           formData.tiktok           || null,
        custom_fields:    Object.keys(customData).length > 0 ? customData : {},
        status:           'activo',
      };

      if (editingContact) {
        const { data, error } = await supabase.from('contacts').update(row).eq('id', editingContact.id).select();
        if (error) throw error;
        setContacts(prev => prev.map(c => c.id === editingContact.id ? data[0] : c));
      } else {
        const { data, error } = await supabase.from('contacts').insert([row]).select();
        if (error) throw error;
        setContacts(prev => [data[0], ...prev]);
      }

      setFormData({});
      setPhonePrefix('+56');
      setEditingContact(null);
      setView('list');
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleEditClick = (contact) => {
    // Extract prefix if present
    let prefix = '+56';
    let num = contact.telefono || '';
    const knownPrefixes = ['+56', '+54', '+51'];
    let foundPrefix = knownPrefixes.find(p => num.startsWith(p));
    
    if (foundPrefix) {
      prefix = foundPrefix;
      num = num.substring(foundPrefix.length);
    } else {
      // Fallback para otros códigos (evitando atrapar el '9' de Chile)
      const match = num.match(/^(\+\d{1,3})(\d+)$/);
      if (match) {
        prefix = match[1];
        num = match[2];
      }
    }

    setFormData({
      ...contact,
      telefono: num,
      ...contact.custom_fields
    });
    setPhonePrefix(prefix);
    setEditingContact(contact);
    setView('detail');
  };

  const handleCreateNewClick = () => {
    setFormData({});
    setPhonePrefix('+56');
    setEditingContact(null);
    setError(null);
    setView('create');
  };

  const handleDeleteSelected = async () => {
    if (!window.confirm(`¿Estás seguro de eliminar ${selectedContacts.length} contacto(s)? Esta acción no se puede deshacer.`)) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('contacts').delete().in('id', selectedContacts);
      if (error) throw error;
      setContacts(prev => prev.filter(c => !selectedContacts.includes(c.id)));
      setSelectedContacts([]);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const toggleSelectAll = (e) => {
    if (e.target.checked) setSelectedContacts(filtered.map(c => c.id));
    else setSelectedContacts([]);
  };

  const toggleSelect = (id) => {
    setSelectedContacts(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const setField = (key, val) => setFormData(p => ({ ...p, [key]: val }));

  // ── CSV ──────────────────────────────────────────────────
  const downloadSampleCsv = () => {
    const headers = allFieldsFlat.map(f => f.label || f.field_label).join(',');
    const blob = new Blob([`\ufeff${headers}\n`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'kuden_contactos_ejemplo.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCsvFile(file); setImportResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const lines = ev.target.result.split(/\r?\n/).filter(l => l.trim());
      if (!lines.length) return;
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const rows    = lines.slice(1, 6).map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
      setCsvHeaders(headers);
      setCsvRows(rows);
      // Auto-match
      const mapping = {};
      allFieldsFlat.forEach(f => {
        const match = headers.find(h =>
          h.toLowerCase() === (f.label || f.field_label || '').toLowerCase() ||
          h.toLowerCase() === (f.key || f.field_key || '')
        );
        if (match) mapping[f.key || f.field_key] = match;
      });
      setCsvMapping(mapping);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvFile) return;
    setImporting(true); setImportResult(null);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const lines   = ev.target.result.split(/\r?\n/).filter(l => l.trim());
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const dataRows = lines.slice(1).filter(l => l.trim());

      const getVal = (row, csvHeader) => {
        if (!csvHeader) return null;
        const idx = headers.indexOf(csvHeader);
        const val = (row.split(',')[idx] || '').trim().replace(/^"|"$/g, '');
        return val || null;
      };

      const inserts = dataRows.map(row => {
        const customData = {};
        fieldDefs.forEach(f => {
          const v = getVal(row, csvMapping[f.field_key]);
          if (v) customData[f.field_key] = v;
        });
        return {
          tenant_id:        tenantId,
          cliente_nombre:   getVal(row, csvMapping['cliente_nombre']) || 'Sin nombre',
          rut:              getVal(row, csvMapping['rut']),
          telefono:         getVal(row, csvMapping['telefono']),
          email:            getVal(row, csvMapping['email']),
          direccion:        getVal(row, csvMapping['direccion']),
          plan:             getVal(row, csvMapping['plan']),
          comuna:           getVal(row, csvMapping['comuna']),
          ciudad:           getVal(row, csvMapping['ciudad']),
          region:           getVal(row, csvMapping['region']),
          empresa:          getVal(row, csvMapping['empresa']),
          cargo:            getVal(row, csvMapping['cargo']),
          fecha_nacimiento: getVal(row, csvMapping['fecha_nacimiento']),
          facebook:         getVal(row, csvMapping['facebook']),
          instagram:        getVal(row, csvMapping['instagram']),
          linkedin:         getVal(row, csvMapping['linkedin']),
          twitter:          getVal(row, csvMapping['twitter']),
          tiktok:           getVal(row, csvMapping['tiktok']),
          custom_fields:    Object.keys(customData).length > 0 ? customData : {},
          status:           'activo',
        };
      });

      let total = 0;
      for (let i = 0; i < inserts.length; i += 50) {
        const { error } = await supabase.from('contacts').insert(inserts.slice(i, i + 50));
        if (!error) total += Math.min(50, inserts.length - i);
      }
      setImportResult({ ok: total, total: dataRows.length });
      await init();
      setImporting(false);
    };
    reader.readAsText(csvFile);
  };

  const filtered = contacts.filter(c => {
    let match = true;
    if (search) {
      match = (c.cliente_nombre || '').toLowerCase().includes(search.toLowerCase()) ||
              (c.rut            || '').includes(search) ||
              (c.telefono       || '').includes(search) ||
              (c.email          || '').toLowerCase().includes(search.toLowerCase());
    }
    if (!match) return false;

    if (fugaFilter !== 'all') {
      const f = c.riesgo_fuga || 0;
      if (fugaFilter === 'alto') { if (f < 70) return false; }
      else if (fugaFilter === 'medio') { if (f < 40 || f >= 70) return false; }
      else if (fugaFilter === 'bajo') { if (f < 15 || f >= 40) return false; }
      else if (fugaFilter === 'sin_riesgo') { if (f >= 15) return false; }
    }

    if (npsFilter !== 'all') {
      const nps = c.nps_historico;
      if (npsFilter === 'promotor') { if (nps === null || nps < 50) return false; }
      else if (npsFilter === 'pasivo') { if (nps === null || nps < 0 || nps >= 50) return false; }
      else if (npsFilter === 'detractor') { if (nps === null || nps >= 0) return false; }
    }
    return true;
  });

  // Avatar inicial
  const initials = (nombre) => {
    if (!nombre) return '?';
    const parts = nombre.trim().split(' ');
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : nombre[0].toUpperCase();
  };

  // ═══════════════════════════════════════════════════════
  // LISTA
  // ═══════════════════════════════════════════════════════
  if (view === 'list') return (
    <div className="contacts-container">
      <div className="contacts-header-row">
        <div className="contacts-header-info">
          <h2>Contactos</h2>
          <p>
            {loading ? 'Cargando...' : `${contacts.length} contacto${contacts.length !== 1 ? 's' : ''} registrado${contacts.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="contacts-header-actions">
          {selectedContacts.length > 0 && (
            <button onClick={handleDeleteSelected} className="integration-btn-danger">
              <i className="ti ti-trash"></i> Eliminar ({selectedContacts.length})
            </button>
          )}
          <button onClick={() => { setCsvFile(null); setCsvHeaders([]); setCsvRows([]); setCsvMapping({}); setImportResult(null); setView('import'); }}
            className="integration-btn-secondary">
            <i className="ti ti-file-import"></i> Importar CSV
          </button>
          <button onClick={handleCreateNewClick} className="integration-btn-primary">
            <i className="ti ti-plus"></i> Nuevo Contacto
          </button>
        </div>
      </div>

      <div className="contacts-filters-bar">
        <div className="contacts-search-wrapper">
          <i className="ti ti-search"></i>
          <input 
            type="text" 
            placeholder="Buscar por nombre, RUT, teléfono o email..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            className="contacts-search-input" 
          />
        </div>
        <select value={fugaFilter} onChange={e => setFugaFilter(e.target.value)}>
          <option value="all">Fuga: Todos</option>
          <option value="alto">Alto Riesgo</option>
          <option value="medio">Riesgo Medio</option>
          <option value="bajo">Riesgo Bajo</option>
          <option value="sin_riesgo">Sin Riesgo</option>
        </select>
        <select value={npsFilter} onChange={e => setNpsFilter(e.target.value)}>
          <option value="all">NPS: Todos</option>
          <option value="promotor">Promotores</option>
          <option value="pasivo">Pasivos</option>
          <option value="detractor">Detractores</option>
        </select>
        <div className="contacts-dropdown-wrapper">
          <button onClick={() => setShowColDropdown(!showColDropdown)} className="integration-btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="ti ti-columns"></i> Columnas
          </button>
          {showColDropdown && (
            <div className="contacts-column-dropdown">
              <div className="contacts-column-dropdown-title">Columnas Visibles</div>
              {AVAILABLE_COLS.map(col => (
                <label key={col}>
                  <input type="checkbox" checked={visibleCols.includes(col)}
                    onChange={(e) => {
                      if (e.target.checked) setVisibleCols([...visibleCols, col]);
                      else setVisibleCols(visibleCols.filter(v => v !== col));
                    }}
                  />
                  {col}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && <div className="contacts-error-alert">{error}</div>}

      <div className="kuden-table-container">
        <table className="kuden-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>
                <input type="checkbox" checked={filtered.length > 0 && selectedContacts.length === filtered.length} onChange={toggleSelectAll} />
              </th>
              {AVAILABLE_COLS.filter(h => visibleCols.includes(h)).map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={visibleCols.length + 1} style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Cargando contactos...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={visibleCols.length + 1} style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                <i className="ti ti-address-book-off" style={{ fontSize: '36px', display: 'block', marginBottom: '10px' }}></i>
                {search || fugaFilter !== 'all' || npsFilter !== 'all' ? `Sin resultados para los filtros actuales` : '¡Crea tu primer contacto o importa desde CSV!'}
              </td></tr>
            ) : filtered.map(ct => {
              
              // Variables NPS y Fuga
              const nps = ct.nps_historico;
              const npsColor = nps === null ? "#aaa" : nps >= 50 ? "#1D9E75" : nps >= 0 ? "#EF9F27" : "#E24B4A";
              
              const f = ct.riesgo_fuga || 0;
              const fColor  = f >= 70 ? "#E24B4A" : f >= 40 ? "#D85A30" : f >= 15 ? "#EF9F27" : "#1D9E75";
              const fLabel  = f >= 70 ? "Alto Riesgo" : f >= 40 ? "Riesgo Medio" : f >= 15 ? "Riesgo Bajo" : "Sin Riesgo";

              return (
              <tr key={ct.id} onClick={() => handleEditClick(ct)} className={selectedContacts.includes(ct.id) ? 'selected-row' : ''}>
                <td onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={selectedContacts.includes(ct.id)} onChange={() => toggleSelect(ct.id)} />
                </td>
                
                {visibleCols.includes('Nombre') && (
                <td>
                  <div className="contact-name-container">
                    <div className="contact-avatar">
                      {initials(ct.cliente_nombre)}
                    </div>
                    <div className="contact-name-info">
                      <span className="contact-name-text">{ct.cliente_nombre || '—'}</span>
                      {ct.plan && <span className="contact-badge-plan">{ct.plan}</span>}
                    </div>
                  </div>
                </td>
                )}
                
                {visibleCols.includes('RUT') && <td style={{ fontFamily: 'monospace' }}>{ct.rut || '—'}</td>}
                {visibleCols.includes('Teléfono') && <td>{ct.telefono || '—'}</td>}
                {visibleCols.includes('Email') && <td>{ct.email || '—'}</td>}
                {visibleCols.includes('Empresa') && <td>{ct.empresa || '—'}</td>}
                
                {visibleCols.includes('Estado') && (
                <td>
                  <span className={`contact-badge-status ${ct.status || 'activo'}`}>
                    {ct.status || 'activo'}
                  </span>
                </td>
                )}

                {visibleCols.includes('NPS Histórico') && (
                <td>
                  {nps !== null ? (
                    <span className="contact-badge-nps" style={{ color: npsColor, background: `${npsColor}20` }}>
                      {nps >= 50 ? <i className="ti ti-mood-smile"></i> : nps >= 0 ? <i className="ti ti-mood-empty"></i> : <i className="ti ti-mood-sad"></i>}
                      {nps}
                    </span>
                  ) : <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>—</span>}
                </td>
                )}

                {visibleCols.includes('Riesgo Fuga') && (
                <td>
                  <span className="contact-badge-risk" style={{ color: fColor, background: `${fColor}20` }}>
                    <i className={f >= 70 ? "ti ti-flame" : f >= 40 ? "ti ti-alert-triangle" : "ti ti-shield-check"}></i>
                    {fLabel}
                  </span>
                </td>
                )}

              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════
  // CREAR CONTACTO
  // ═══════════════════════════════════════════════════════
  // ── DETALLE CONTACTO (360) ──
  if (view === 'detail') return (
    <Contact360View 
      contact={editingContact} 
      tenantId={tenantId}
      c={c} 
      isDark={isDark} 
      userId={userId}
      onBack={() => { setView('list'); setEditingContact(null); }} 
      onEdit={() => setView('create')} 
    />
  );

  // ──
  // CREAR / EDITAR CONTACTO
  // ──
  if (view === 'create') return (
    <div className="contacts-container">
      <div className="contacts-header-row" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button type="button" onClick={() => { setView('list'); setEditingContact(null); }} className="integration-btn-link" style={{ padding: 0 }}>
            <i className="ti ti-arrow-left"></i> Volver
          </button>
          <h2>{editingContact ? 'Editar Contacto' : 'Nuevo Contacto'}</h2>
        </div>
      </div>

      {error && <div className="contacts-error-alert">{error}</div>}

      <form onSubmit={handleSave}>
        {/* Secciones de campos base */}
        {BASE_FIELD_SECTIONS.map(section => (
          <div key={section.title} className="contacts-form-section">
            <h3>
              <i className={`ti ${section.icon}`}></i> {section.title}
            </h3>
            <div className="contacts-form-grid">
              {section.fields.map(f => (
                <div key={f.key} className="integration-form-group" style={{ gridColumn: f.col || 'auto' }}>
                  <label className="integration-form-label">
                    {f.label}
                    {f.required && <span style={{ color: 'var(--color-error)', marginLeft: '3px' }}>*</span>}
                  </label>
                  {f.key === 'telefono' ? (
                    <div className="contacts-phone-group">
                      <select
                        value={phonePrefix}
                        onChange={(e) => setPhonePrefix(e.target.value)}
                      >
                        <option value="+56">🇨🇱 +56</option>
                        <option value="+54">🇦🇷 +54</option>
                        <option value="+51">🇵🇪 +51</option>
                        <option value="+57">🇨🇴 +57</option>
                        <option value="+52">🇲🇽 +52</option>
                        <option value="+1">🇺🇸 +1</option>
                        <option value="+34">🇪🇸 +34</option>
                      </select>
                      <input type="text" value={formData[f.key] || ''}
                        onChange={e => {
                          const val = e.target.value.replace(/\D/g, '');
                          setField(f.key, val);
                        }}
                        placeholder="ej: 961586387"
                        required={f.required} />
                    </div>
                  ) : (
                    <input type={f.type || 'text'} value={formData[f.key] || ''}
                      onChange={e => setField(f.key, e.target.value)}
                      required={f.required} />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Campos personalizados del tenant */}
        {fieldDefs.length > 0 && (
          <div className="contacts-form-section">
            <h3>
              <i className="ti ti-adjustments"></i> Campos de tu Industria
            </h3>
            <div className="contacts-form-grid">
              {fieldDefs.map(f => (
                <div key={f.id} className="integration-form-group">
                  <label className="integration-form-label">
                    {f.field_label}{f.is_required && <span style={{ color: 'var(--color-error)', marginLeft: '3px' }}>*</span>}
                  </label>
                  {f.field_type === 'select' ? (
                    <select value={formData[f.field_key] || ''} onChange={e => setField(f.field_key, e.target.value)} required={f.is_required}>
                      <option value="">— Seleccionar —</option>
                      {(f.options || '').split(',').map(o => <option key={o.trim()} value={o.trim()}>{o.trim()}</option>)}
                    </select>
                  ) : (
                    <input type={f.field_type === 'number' ? 'number' : f.field_type === 'date' ? 'date' : 'text'}
                      value={formData[f.field_key] || ''} onChange={e => setField(f.field_key, e.target.value)}
                      required={f.is_required} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
          <button type="button" onClick={() => { setView('list'); setEditingContact(null); }} className="integration-btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="integration-btn-primary">
            {saving ? 'Guardando...' : editingContact ? 'Actualizar Contacto' : 'Guardar Contacto'}
          </button>
        </div>
      </form>
    </div>
  );

  // ═══════════════════════════════════════════════════════
  // IMPORTAR CSV
  // ═══════════════════════════════════════════════════════
  return (
    <div className="contacts-container">
      <div className="contacts-header-row" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => setView('list')} className="integration-btn-link" style={{ padding: 0 }}>
            <i className="ti ti-arrow-left"></i> Volver
          </button>
          <h2>Importar desde CSV</h2>
        </div>
      </div>

      {importResult && (
        <div className="contacts-form-section" style={{ background: 'rgba(22, 211, 138, 0.1)', borderColor: 'rgba(22, 211, 138, 0.3)', color: 'var(--color-success)', marginBottom: '20px', fontWeight: '500', padding: '16px' }}>
          ✅ Importación completada: <strong>{importResult.ok}</strong> de {importResult.total} filas importadas.
        </div>
      )}

      {/* Paso 1 */}
      <div className="contacts-form-section">
        <h3 style={{ fontSize: '16px', color: 'var(--color-text-primary)', textTransform: 'none', letterSpacing: 'normal' }}>Paso 1 — Selecciona el archivo CSV</h3>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px', gap: '16px', flexWrap: 'wrap' }}>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)', flex: 1 }}>
            La primera fila debe contener los encabezados. Si coinciden con un campo de Kuden, se mapearán automáticamente.
          </p>
          <button type="button" onClick={downloadSampleCsv} className="integration-btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}>
            <i className="ti ti-download"></i> Descargar Ejemplo CSV
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".csv" onChange={handleFileChange} style={{ display: 'none' }} />
        <button type="button" onClick={() => fileRef.current.click()} className={`csv-upload-zone ${csvFile ? 'has-file' : ''}`}>
          <i className="ti ti-file-upload"></i>
          {csvFile ? <span>📄 {csvFile.name}</span> : <span>Haz clic para seleccionar un archivo .csv</span>}
        </button>
      </div>

      {/* Paso 2: Mapeo */}
      {csvHeaders.length > 0 && (
        <div className="contacts-form-section">
          <h3 style={{ fontSize: '16px', color: 'var(--color-text-primary)', textTransform: 'none', letterSpacing: 'normal' }}>Paso 2 — Mapear columnas</h3>
          <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            <span style={{ color: 'var(--color-success)', fontWeight: '500' }}>✓ Verde = auto-mapeado.</span> Puedes ajustar cualquier mapeo manualmente.
          </p>
          <div className="csv-mapping-grid">
            {allFieldsFlat.map(f => {
              const fKey = f.key || f.field_key;
              const mapped = csvMapping[fKey];
              const isAuto = !!mapped;
              return (
                <React.Fragment key={fKey}>
                  <div className="csv-mapping-source">
                    {f.label || f.field_label}
                  </div>
                  <div className={`csv-mapping-arrow ${isAuto ? 'mapped' : ''}`}>→</div>
                  <select 
                    value={mapped || ''} 
                    onChange={e => setCsvMapping(p => ({ ...p, [fKey]: e.target.value || undefined }))}
                    style={{ 
                      borderColor: isAuto ? 'rgba(22, 211, 138, 0.4)' : undefined, 
                      background: isAuto ? 'rgba(22, 211, 138, 0.05)' : undefined 
                    }}
                  >
                    <option value="">— No mapear —</option>
                    {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* Paso 3: Preview */}
      {csvRows.length > 0 && (
        <div className="csv-preview-container">
          <h3>Paso 3 — Preview (primeras 5 filas)</h3>
          <table className="csv-preview-table">
            <thead>
              <tr>
                {csvHeaders.map(h => <th key={h} style={{ whiteSpace: 'nowrap' }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {csvRows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => <td key={j}>{cell || <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {csvHeaders.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
          <button onClick={handleImport} disabled={importing} className="integration-btn-primary" style={{ backgroundColor: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className={`ti ${importing ? 'ti-loader-2' : 'ti-file-import'}`}></i>
            {importing ? 'Importando...' : 'Importar todos los registros'}
          </button>
        </div>
      )}
    </div>
  );
}
