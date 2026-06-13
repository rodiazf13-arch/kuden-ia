import React, { useState, useEffect, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function KnowledgeBaseManager({ tenantId, profileId, isDark, c }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [webUrl, setWebUrl] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (profileId) fetchDocuments();
  }, [profileId]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/profiles/${profileId}/documents?tenantId=${tenantId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDocuments(data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    const type = file.name.endsWith('.md') ? 'md' : 'pdf';
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tenantId', tenantId);
      formData.append('type', type);

      const res = await fetch(`${API_URL}/api/profiles/${profileId}/documents`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      await fetchDocuments();
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleWebUpload = async (e) => {
    e.preventDefault();
    if (!webUrl) return;
    setUploading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/profiles/${profileId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, type: 'web', url: webUrl })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setWebUrl('');
      await fetchDocuments();
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este documento y olvidar su conocimiento?')) return;
    try {
      const res = await fetch(`${API_URL}/api/documents/${id}?tenantId=${tenantId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar');
      setDocuments(prev => prev.filter(d => d.id !== id));
    } catch (e) {
      alert(e.message);
    }
  };

  // Drag and Drop handlers
  const onDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
  const onDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf' || file.name.endsWith('.md')) {
        handleFileUpload(file);
      } else {
        alert('Solo se permiten archivos PDF o MD');
      }
    }
  };

  return (
    <div style={{ marginTop: '24px', borderTop: `1px solid ${c.divider}`, paddingTop: '24px' }}>
      <h4 style={{ margin: '0 0 12px', fontSize: '15px', color: c.title, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <i className="ti ti-brain"></i> Base de Conocimiento (RAG)
      </h4>
      <p style={{ margin: '0 0 20px', fontSize: '13px', color: c.subtitle }}>
        Alimenta la inteligencia de este perfil. Sube archivos <strong>.pdf</strong>, <strong>.md</strong> o añade la URL de un sitio web para que Kuden extraiga su contenido.
      </p>

      {error && <div style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '24px' }}>
        {/* Dropzone */}
        <div 
          onDragOver={onDragOver} 
          onDrop={onDrop}
          style={{ flex: '1 1 300px', border: `2px dashed ${c.border}`, borderRadius: '12px', padding: '30px 20px', textAlign: 'center', cursor: 'pointer', background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', position: 'relative', transition: 'all 0.2s' }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input type="file" ref={fileInputRef} onChange={(e) => handleFileUpload(e.target.files[0])} accept=".pdf,.md" style={{ display: 'none' }} />
          {uploading ? (
            <div style={{ color: '#2563eb' }}>
              <i className="ti ti-loader" style={{ fontSize: '24px', display: 'inline-block', animation: 'spin 1s linear infinite' }}></i>
              <p style={{ margin: '8px 0 0', fontSize: '13px', fontWeight: '500' }}>Procesando y vectorizando...</p>
            </div>
          ) : (
            <div>
              <i className="ti ti-upload" style={{ fontSize: '28px', color: c.subtitle, marginBottom: '8px' }}></i>
              <p style={{ margin: 0, fontSize: '14px', color: c.title, fontWeight: '500' }}>Arrastra un PDF o MD aquí</p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: c.subtitle }}>o haz clic para explorar</p>
            </div>
          )}
        </div>

        {/* Web Scraper */}
        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'center' }}>
          <label style={{ fontSize: '13px', color: c.label }}>Extraer contenido de un Sitio Web</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="url" 
              value={webUrl} 
              onChange={e => setWebUrl(e.target.value)} 
              onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); handleWebUpload(e); } }}
              placeholder="https://empresa.com/faq" 
              disabled={uploading}
              style={{ flex: 1, backgroundColor: c.inputBg, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '10px', color: c.inputText, outline: 'none', fontSize: '13px' }} 
            />
            <button 
              type="button" 
              onClick={handleWebUpload}
              disabled={uploading || !webUrl}
              style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', padding: '0 16px', cursor: (uploading || !webUrl) ? 'not-allowed' : 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px', opacity: (uploading || !webUrl) ? 0.7 : 1 }}>
              {uploading ? '...' : <><i className="ti ti-world-download"></i> Extraer</>}
            </button>
          </div>
        </div>
      </div>

      {/* Lista de Documentos */}
      <div>
        <h5 style={{ margin: '0 0 12px', fontSize: '13px', color: c.title }}>Fuentes Activas ({documents.length})</h5>
        {loading ? (
          <p style={{ fontSize: '13px', color: c.subtitle }}>Cargando fuentes...</p>
        ) : documents.length === 0 ? (
          <p style={{ fontSize: '13px', color: c.subtitle, fontStyle: 'italic' }}>Este perfil no tiene conocimiento adicional asignado.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {documents.map(doc => (
              <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: c.inputBg, border: `1px solid ${c.border}`, padding: '10px 14px', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                  <i className={doc.source_type === 'web' ? 'ti ti-world' : (doc.source_type === 'md' ? 'ti ti-markdown' : 'ti ti-file-type-pdf')} style={{ color: doc.source_type === 'web' ? '#3b82f6' : '#ef4444', fontSize: '18px' }}></i>
                  <span style={{ fontSize: '13px', color: c.title, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{doc.name}</span>
                </div>
                <button onClick={() => handleDelete(doc.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }} title="Eliminar y Olvidar">
                  <i className="ti ti-trash"></i>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
