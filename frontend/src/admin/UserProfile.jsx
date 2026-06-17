import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function UserProfile({ isDark, userEmail, userId }) {
  const [loading, setLoading] = useState(false);
  const [sigLoading, setSigLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [sigMsg, setSigMsg] = useState({ type: '', text: '' });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [signature, setSignature] = useState('');
  
  const API_URL = import.meta.env.VITE_API_URL || '';

  React.useEffect(() => {
    if (!userId) return;
    fetch(`${API_URL}/api/users/${userId}/signature`)
      .then(res => res.json())
      .then(data => {
        if (data && data.email_signature) setSignature(data.email_signature);
      })
      .catch(err => console.error('Error cargando firma', err));
  }, [userId, API_URL]);

  const handleUpdateSignature = async (e) => {
    e.preventDefault();
    if (!userId) return;
    setSigLoading(true);
    setSigMsg({ type: '', text: '' });
    try {
      const res = await fetch(`${API_URL}/api/users/${userId}/signature`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_signature: signature })
      });
      if (!res.ok) throw new Error('Error al guardar firma');
      setSigMsg({ type: 'success', text: 'Firma guardada exitosamente.' });
    } catch (error) {
      console.error(error);
      setSigMsg({ type: 'error', text: 'Error: ' + error.message });
    } finally {
      setSigLoading(false);
    }
  };

  const bgCard = isDark ? '#111111' : '#ffffff';
  const bgMain = isDark ? '#0a0a0a' : '#f3f4f6';
  const textMain = isDark ? '#ffffff' : '#111827';
  const textSec = isDark ? '#aaaaaa' : '#6b7280';
  const borderCol = isDark ? '#222222' : '#e5e7eb';
  const inputBg = isDark ? '#1a1a1a' : '#f9fafb';

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setMsg({ type: 'error', text: 'Las contraseñas no coinciden.' });
      return;
    }
    if (password.length < 6) {
      setMsg({ type: 'error', text: 'La contraseña debe tener al menos 6 caracteres.' });
      return;
    }
    setLoading(true);
    setMsg({ type: '', text: '' });
    try {
      const { error } = await supabase.auth.updateUser({ password: password });
      if (error) throw error;
      setMsg({ type: 'success', text: 'Contraseña actualizada exitosamente.' });
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error(error);
      setMsg({ type: 'error', text: 'Error al actualizar la contraseña: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 24, fontWeight: 'bold', margin: '0 0 4px', color: textMain }}>Mi Perfil</h2>
        <p style={{ margin: 0, fontSize: 14, color: textSec }}>
          Gestiona tus datos personales y seguridad.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        {/* Información Básica */}
        <div style={{ background: bgCard, border: `1px solid ${borderCol}`, borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px', color: textMain }}>Información Básica</h3>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: textSec, marginBottom: 6 }}>
              Correo Electrónico (No editable)
            </label>
            <input
              type="text"
              value={userEmail}
              disabled
              style={{ width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 8, border: `1px solid ${borderCol}`, background: inputBg, color: textSec, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <p style={{ fontSize: 12, color: textSec, margin: 0 }}>
            Por el momento, el correo electrónico y tu rol son administrados centralizadamente por un administrador.
          </p>
        </div>

        {/* Seguridad */}
        <div style={{ background: bgCard, border: `1px solid ${borderCol}`, borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px', color: textMain }}>Seguridad</h3>
          
          {msg.text && (
            <div style={{ padding: '10px 12px', marginBottom: 16, borderRadius: 8, fontSize: 12, fontWeight: 500, 
              background: msg.type === 'error' ? '#FDECEA' : '#E1F5EE', 
              color: msg.type === 'error' ? '#E24B4A' : '#1D9E75',
              border: `1px solid ${msg.type === 'error' ? '#E24B4A40' : '#1D9E7540'}` }}>
              {msg.type === 'success' ? '✓ ' : '⚠️ '}{msg.text}
            </div>
          )}

          <form onSubmit={handleUpdatePassword}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: textSec, marginBottom: 6 }}>
                Nueva Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                style={{ width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 8, border: `1px solid ${borderCol}`, background: inputBg, color: textMain, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: textSec, marginBottom: 6 }}>
                Confirmar Contraseña
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repite tu nueva contraseña"
                required
                style={{ width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 8, border: `1px solid ${borderCol}`, background: inputBg, color: textMain, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !password || !confirmPassword}
              style={{
                padding: '10px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
                background: '#2563eb', color: '#fff', cursor: loading ? 'wait' : 'pointer',
                opacity: (loading || !password || !confirmPassword) ? 0.6 : 1,
                width: '100%'
              }}
            >
              {loading ? 'Actualizando...' : 'Actualizar Contraseña'}
            </button>
          </form>
        </div>

        {/* Firma de Correo */}
        <div style={{ background: bgCard, border: `1px solid ${borderCol}`, borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px', color: textMain }}>Firma de Correo</h3>
          
          {sigMsg.text && (
            <div style={{ padding: '10px 12px', marginBottom: 16, borderRadius: 8, fontSize: 12, fontWeight: 500, 
              background: sigMsg.type === 'error' ? '#FDECEA' : '#E1F5EE', 
              color: sigMsg.type === 'error' ? '#E24B4A' : '#1D9E75',
              border: `1px solid ${sigMsg.type === 'error' ? '#E24B4A40' : '#1D9E7540'}` }}>
              {sigMsg.type === 'success' ? '✓ ' : '⚠️ '}{sigMsg.text}
            </div>
          )}

          <form onSubmit={handleUpdateSignature}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: textSec, marginBottom: 6 }}>
                Firma para respuestas
              </label>
              <textarea
                value={signature}
                onChange={e => setSignature(e.target.value)}
                placeholder={"Atentamente,\nTu Nombre\nCargo"}
                rows={5}
                style={{ width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 8, border: `1px solid ${borderCol}`, background: inputBg, color: textMain, outline: 'none', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>
            <button
              type="submit"
              disabled={sigLoading}
              style={{
                padding: '10px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
                background: '#1D9E75', color: '#fff', cursor: sigLoading ? 'wait' : 'pointer',
                opacity: sigLoading ? 0.6 : 1,
                width: '100%'
              }}
            >
              {sigLoading ? 'Guardando...' : 'Guardar Firma'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
