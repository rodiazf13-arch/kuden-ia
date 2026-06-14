import React from 'react';

/**
 * KimiMascot — La mascota de Kuden IA
 * "Kimi" es el diminutivo cariñoso de Kimun (conocimiento / saber en Mapudungún).
 * Visualmente está inspirada en el logo de Kuden: un núcleo central con
 * órbitas/ondas a su alrededor, representando la IA conectando canales.
 *
 * Estados:
 *   idle     → flota suavemente
 *   thinking → las órbitas giran rápido (procesando)
 *   happy    → destello verde (respuesta exitosa)
 *   alert    → pulso rojo (error crítico)
 *   wave     → animación de bienvenida
 */
export default function KimiMascot({ size = 40, state = 'idle', style = {} }) {
  const s = size;

  // Colores según estado (mantenemos los del diseño original para coherencia)
  const colors = {
    idle:     { core: '#2563eb', orbit1: '#7c3aed', orbit2: '#1D9E75', orbit3: '#534AB7', glow: 'rgba(37, 99, 235, 0.5)' },
    thinking: { core: '#7c3aed', orbit1: '#2563eb', orbit2: '#EF9F27', orbit3: '#1D9E75', glow: 'rgba(124, 58, 237, 0.7)' },
    happy:    { core: '#1D9E75', orbit1: '#059669', orbit2: '#1D9E75', orbit3: '#34d399', glow: 'rgba(29, 158, 117, 0.6)' },
    alert:    { core: '#E24B4A', orbit1: '#D85A30', orbit2: '#EF9F27', orbit3: '#E24B4A', glow: 'rgba(226, 75, 74, 0.7)' },
    wave:     { core: '#534AB7', orbit1: '#2563eb', orbit2: '#7c3aed', orbit3: '#1D9E75', glow: 'rgba(83, 74, 183, 0.5)' },
  };

  const c = colors[state] || colors.idle;

  // Velocidades de órbita según estado
  const speeds = {
    idle:     { o1: '4s', o2: '6s', o3: '9s' },
    thinking: { o1: '1s', o2: '1.5s', o3: '2s' },
    happy:    { o1: '2.5s', o2: '3.5s', o3: '5s' },
    alert:    { o1: '0.8s', o2: '1.2s', o3: '1.8s' },
    wave:     { o1: '3s', o2: '4.5s', o3: '6s' },
  };
  const sp = speeds[state] || speeds.idle;

  const floatAnim = state === 'idle' || state === 'wave' ? 'float 3s ease-in-out infinite' : 'none';

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', animation: floatAnim, ...style }}>
      <style>{`
        .kimi-new-container {
            position: relative;
            display: flex;
            justify-content: center;
            align-items: center;
        }

        .kimi-new-core {
            position: absolute;
            border-radius: 50%;
            animation: kimi-new-pulse 2s infinite ease-in-out;
            z-index: 2;
        }

        .kimi-new-orbit {
            position: absolute;
            border: calc(var(--s) * 0.02) solid transparent;
            border-radius: 50%;
        }

        @keyframes kimi-new-pulse {
            0%, 100% {
                transform: scale(1);
                box-shadow: 0 0 calc(var(--s) * 0.15) var(--c-core), 0 0 calc(var(--s) * 0.3) var(--c-glow);
            }
            50% {
                transform: scale(1.1);
                box-shadow: 0 0 calc(var(--s) * 0.22) var(--c-core), 0 0 calc(var(--s) * 0.4) var(--c-glow);
            }
        }

        @keyframes kimi-rotate-1 { from { transform: rotate(45deg); } to { transform: rotate(405deg); } }
        @keyframes kimi-rotate-2 { from { transform: rotate(-45deg); } to { transform: rotate(-405deg); } }
        @keyframes kimi-rotate-3 { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
      
      <div 
        className="kimi-new-container" 
        title="Kimi - Asistente de Kuden"
        style={{
          width: s,
          height: s,
          '--s': `${s}px`,
          '--c-core': c.core,
          '--c-glow': c.glow
        }}
      >
          <div 
            className="kimi-new-core"
            style={{
              width: s * 0.3,
              height: s * 0.3,
              background: \`radial-gradient(circle, #ffffff 0%, \${c.orbit1} 50%, \${c.core} 100%)\`,
              animationDuration: state === 'thinking' ? '0.8s' : state === 'alert' ? '0.5s' : '2s'
            }}
          ></div>
          <div 
            className="kimi-new-orbit"
            style={{
              width: s * 0.7,
              height: s * 0.4,
              borderTopColor: c.orbit1,
              borderBottomColor: \`\${c.orbit1}33\`,
              animation: \`kimi-rotate-1 \${sp.o1} infinite linear\`
            }}
          ></div>
          <div 
            className="kimi-new-orbit"
            style={{
              width: s * 0.4,
              height: s * 0.7,
              borderLeftColor: c.orbit2,
              borderRightColor: \`\${c.orbit2}33\`,
              animation: \`kimi-rotate-2 \${sp.o2} infinite linear\`
            }}
          ></div>
          <div 
            className="kimi-new-orbit"
            style={{
              width: s * 0.8,
              height: s * 0.8,
              borderTopColor: c.orbit3,
              animation: \`kimi-rotate-3 \${sp.o3} infinite linear\`
            }}
          ></div>
      </div>
    </div>
  );
}
