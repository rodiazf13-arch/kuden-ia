import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
    }
    
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#0a0a0a", color: "#fff", fontFamily: "sans-serif", padding: "1rem" }}>
      <div style={{ width: "100%", maxWidth: "400px", backgroundColor: "#111", border: "1px solid #222", borderRadius: "12px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)", padding: "32px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "32px" }}>
          <div style={{ width: "48px", height: "48px", backgroundColor: "#2563eb", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 15px rgba(37,99,235,0.4)", marginBottom: "16px" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#fff" }}>
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h1 style={{ fontSize: "24px", fontWeight: "bold", margin: 0, color: "#60a5fa" }}>
            KUDEN IA
          </h1>
          <p style={{ color: "#888", marginTop: "8px", fontSize: "14px" }}>Acceso Administrador</p>
        </div>

        {error && (
          <div style={{ backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.5)", color: "#f87171", padding: "12px", borderRadius: "8px", fontSize: "14px", marginBottom: "24px", textAlign: "center" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "14px", color: "#aaa", marginLeft: "4px" }}>Correo Electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ backgroundColor: "#1a1a1a", border: "1px solid #333", borderRadius: "8px", padding: "12px", color: "#fff", outline: "none", fontSize: "14px", width: "100%", boxSizing: "border-box" }}
              placeholder="tu@empresa.com"
              required
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "14px", color: "#aaa", marginLeft: "4px" }}>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ backgroundColor: "#1a1a1a", border: "1px solid #333", borderRadius: "8px", padding: "12px", color: "#fff", outline: "none", fontSize: "14px", width: "100%", boxSizing: "border-box" }}
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ marginTop: "16px", backgroundColor: "#2563eb", color: "#fff", fontWeight: "500", padding: "12px", borderRadius: "8px", border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1, transition: "opacity 0.2s" }}
          >
            {loading ? 'Iniciando...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}
