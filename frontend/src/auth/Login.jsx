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
    <div style={{ 
      minHeight: "100vh", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center", 
      background: "radial-gradient(circle at top, #1a153a 0%, #0a0a0a 50%, #050505 100%)", 
      color: "#fff", 
      padding: "1rem" 
    }}>
      <div style={{ 
        width: "100%", 
        maxWidth: "400px", 
        background: "rgba(255, 255, 255, 0.03)", 
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255, 255, 255, 0.05)", 
        borderRadius: "16px", 
        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)", 
        padding: "40px 32px" 
      }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "32px" }}>
          <img 
            src="/kuden-logo.png" 
            alt="KUDEN" 
            style={{ width: "160px", height: "auto", marginBottom: "8px", objectFit: "contain" }} 
          />
          <p style={{ color: "#888", marginTop: "8px", fontSize: "13px", letterSpacing: "1px", textTransform: "uppercase" }}>
            Workspace Login
          </p>
        </div>

        {error && (
          <div style={{ backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.5)", color: "#f87171", padding: "12px", borderRadius: "8px", fontSize: "14px", marginBottom: "24px", textAlign: "center" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "13px", color: "#9ca3af", marginLeft: "4px" }}>Correo Electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ backgroundColor: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "12px", color: "#fff", outline: "none", fontSize: "14px", width: "100%", boxSizing: "border-box", transition: "border 0.3s" }}
              placeholder="tu@empresa.com"
              required
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "13px", color: "#9ca3af", marginLeft: "4px" }}>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ backgroundColor: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "12px", color: "#fff", outline: "none", fontSize: "14px", width: "100%", boxSizing: "border-box", transition: "border 0.3s" }}
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ 
              marginTop: "20px", 
              background: "linear-gradient(135deg, #4F46E5 0%, #3B82F6 100%)", 
              color: "#fff", 
              fontWeight: "600", 
              padding: "12px", 
              borderRadius: "8px", 
              border: "none", 
              cursor: loading ? "not-allowed" : "pointer", 
              opacity: loading ? 0.7 : 1, 
              boxShadow: "0 4px 14px 0 rgba(59, 130, 246, 0.39)",
              transition: "opacity 0.2s, transform 0.1s" 
            }}
            onMouseOver={(e) => !loading && (e.currentTarget.style.transform = 'translateY(-1px)')}
            onMouseOut={(e) => !loading && (e.currentTarget.style.transform = 'translateY(0)')}
            onMouseDown={(e) => !loading && (e.currentTarget.style.transform = 'translateY(1px)')}
            onMouseUp={(e) => !loading && (e.currentTarget.style.transform = 'translateY(-1px)')}
          >
            {loading ? 'Iniciando...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}
