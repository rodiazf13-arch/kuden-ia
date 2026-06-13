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
  const center = s / 2;
  const coreR  = s * 0.18;

  // Colores según estado
  const colors = {
    idle:     { core: '#2563eb', orbit1: '#7c3aed', orbit2: '#1D9E75', orbit3: '#534AB7', glow: '#2563eb40' },
    thinking: { core: '#7c3aed', orbit1: '#2563eb', orbit2: '#EF9F27', orbit3: '#1D9E75', glow: '#7c3aed50' },
    happy:    { core: '#1D9E75', orbit1: '#059669', orbit2: '#1D9E75', orbit3: '#34d399', glow: '#1D9E7560' },
    alert:    { core: '#E24B4A', orbit1: '#D85A30', orbit2: '#EF9F27', orbit3: '#E24B4A', glow: '#E24B4A50' },
    wave:     { core: '#534AB7', orbit1: '#2563eb', orbit2: '#7c3aed', orbit3: '#1D9E75', glow: '#534AB740' },
  };

  const c = colors[state] || colors.idle;

  // Velocidades de órbita según estado
  const speeds = {
    idle:     { o1: '4s', o2: '6s', o3: '9s' },
    thinking: { o1: '0.8s', o2: '1.2s', o3: '1.6s' },
    happy:    { o1: '2s',   o2: '3s',   o3: '4s'   },
    alert:    { o1: '0.6s', o2: '0.9s', o3: '1.3s' },
    wave:     { o1: '3s',   o2: '4.5s', o3: '6s'   },
  };
  const sp = speeds[state] || speeds.idle;

  const floatAnim    = state === 'idle' || state === 'wave' ? 'float 3s ease-in-out infinite' : 'none';
  const pulseAnim    = state === 'thinking' ? 'kimi-pulse 0.8s ease-in-out infinite' : 'none';
  const corePulse    = state === 'alert' ? 'pulse-glow 0.6s ease-in-out infinite' : state === 'happy' ? 'kimi-pulse 1s ease-in-out infinite' : 'none';

  // Radios de órbita proporcionales al tamaño
  const r1 = s * 0.30;
  const r2 = s * 0.38;
  const r3 = s * 0.44;

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', animation: floatAnim, ...style }}>
      <svg
        width={s} height={s}
        viewBox={`0 0 ${s} ${s}`}
        style={{ animation: pulseAnim, overflow: 'visible' }}
      >
        <defs>
          {/* Gradiente del núcleo */}
          <radialGradient id={`core-grad-${state}`} cx="40%" cy="35%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.6" />
            <stop offset="100%" stopColor={c.core} />
          </radialGradient>
          {/* Glow del núcleo */}
          <filter id="glow-filter">
            <feGaussianBlur stdDeviation={s * 0.08} result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Glow de fondo */}
        <circle cx={center} cy={center} r={coreR * 2.2}
          fill={c.glow} style={{ filter: `blur(${s * 0.1}px)` }} />

        {/* Órbita 1 — elipse inclinada */}
        <ellipse cx={center} cy={center}
          rx={r1} ry={r1 * 0.35}
          fill="none" stroke={c.orbit1} strokeWidth={s * 0.025}
          strokeOpacity={0.6}
          transform={`rotate(-30, ${center}, ${center})`}
        />
        {/* Electrón 1 */}
        <g style={{ transformOrigin: `${center}px ${center}px`, animation: `kimi-spin ${sp.o1} linear infinite`, transformBox: 'fill-box' }}>
          <circle
            cx={center + r1} cy={center}
            r={s * 0.055}
            fill={c.orbit1}
            style={{ filter: `drop-shadow(0 0 ${s*0.04}px ${c.orbit1})` }}
            transform={`rotate(-30, ${center}, ${center})`}
          />
        </g>

        {/* Órbita 2 — elipse inclinada opuesta */}
        <ellipse cx={center} cy={center}
          rx={r2} ry={r2 * 0.35}
          fill="none" stroke={c.orbit2} strokeWidth={s * 0.02}
          strokeOpacity={0.45}
          transform={`rotate(60, ${center}, ${center})`}
        />
        {/* Electrón 2 */}
        <g style={{ transformOrigin: `${center}px ${center}px`, animation: `kimi-spin ${sp.o2} linear infinite reverse`, transformBox: 'fill-box' }}>
          <circle
            cx={center + r2} cy={center}
            r={s * 0.04}
            fill={c.orbit2}
            style={{ filter: `drop-shadow(0 0 ${s*0.03}px ${c.orbit2})` }}
            transform={`rotate(60, ${center}, ${center})`}
          />
        </g>

        {/* Órbita 3 — vertical */}
        <ellipse cx={center} cy={center}
          rx={r3} ry={r3 * 0.28}
          fill="none" stroke={c.orbit3} strokeWidth={s * 0.018}
          strokeOpacity={0.35}
          transform={`rotate(90, ${center}, ${center})`}
        />
        {/* Electrón 3 */}
        <g style={{ transformOrigin: `${center}px ${center}px`, animation: `kimi-spin ${sp.o3} linear infinite`, transformBox: 'fill-box' }}>
          <circle
            cx={center + r3} cy={center}
            r={s * 0.035}
            fill={c.orbit3}
            style={{ filter: `drop-shadow(0 0 ${s*0.025}px ${c.orbit3})` }}
            transform={`rotate(90, ${center}, ${center})`}
          />
        </g>

        {/* Núcleo central */}
        <circle
          cx={center} cy={center} r={coreR}
          fill={`url(#core-grad-${state})`}
          filter="url(#glow-filter)"
          style={{ animation: corePulse }}
        />
        {/* Brillo interior del núcleo */}
        <circle cx={center - coreR * 0.3} cy={center - coreR * 0.3} r={coreR * 0.35}
          fill="rgba(255,255,255,0.45)"
        />
      </svg>
    </div>
  );
}
