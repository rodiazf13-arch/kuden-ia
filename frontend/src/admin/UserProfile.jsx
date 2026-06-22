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
    <div className="profile-container">
      <div className="profile-header">
        <h2 className="profile-title">Mi Perfil</h2>
        <p className="profile-subtitle">
          Gestiona tus datos personales y seguridad.
        </p>
      </div>

      <div className="profile-grid">
        {/* Información Básica */}
        <div className="profile-card">
          <h3 className="profile-card-title">Información Básica</h3>
          <div className="profile-field-group">
            <label className="profile-label">
              Correo Electrónico (No editable)
            </label>
            <input
              type="text"
              value={userEmail}
              disabled
              className="profile-input"
            />
          </div>
          <p className="profile-info-text">
            Por el momento, el correo electrónico y tu rol son administrados centralizadamente por un administrador.
          </p>
        </div>

        {/* Seguridad */}
        <div className="profile-card">
          <h3 className="profile-card-title">Seguridad</h3>
          
          {msg.text && (
            <div className={`profile-alert ${msg.type}`}>
              {msg.type === 'success' ? '✓ ' : '⚠️ '}{msg.text}
            </div>
          )}

          <form onSubmit={handleUpdatePassword}>
            <div className="profile-field-group">
              <label className="profile-label">
                Nueva Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                className="profile-input"
              />
            </div>
            <div className="profile-field-group">
              <label className="profile-label">
                Confirmar Contraseña
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repite tu nueva contraseña"
                required
                className="profile-input"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !password || !confirmPassword}
              className="profile-btn-primary"
            >
              {loading ? 'Actualizando...' : 'Actualizar Contraseña'}
            </button>
          </form>
        </div>

        {/* Firma de Correo */}
        <div className="profile-card">
          <h3 className="profile-card-title">Firma de Correo</h3>
          
          {sigMsg.text && (
            <div className={`profile-alert ${sigMsg.type}`}>
              {sigMsg.type === 'success' ? '✓ ' : '⚠️ '}{sigMsg.text}
            </div>
          )}

          <form onSubmit={handleUpdateSignature}>
            <div className="profile-field-group">
              <label className="profile-label">
                Firma para respuestas
              </label>
              <textarea
                value={signature}
                onChange={e => setSignature(e.target.value)}
                placeholder={"Atentamente,\nTu Nombre\nCargo"}
                rows={5}
                className="profile-textarea"
              />
            </div>
            <button
              type="submit"
              disabled={sigLoading}
              className="profile-btn-success"
            >
              {sigLoading ? 'Guardando...' : 'Guardar Firma'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
