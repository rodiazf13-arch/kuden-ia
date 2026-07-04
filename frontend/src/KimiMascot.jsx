import React from 'react';

/**
 * KimiMascot — La nueva mascota de Kuden IA usando kimi.png y CSS orbits.
 * Estados soportados por kimi-widget.css:
 *   idle, listening, thinking, speaking, success, handoff, sleep
 */
export default function KimiMascot({ size = 120, state = 'idle', style = {} }) {
  // Combinamos los estilos pasados por props con un tamaño base configurable
  const containerStyle = {
    width: `${size}px`,
    height: `${size}px`,
    margin: '0 auto',
    ...style
  };

  return (
    <div className={`kimi ${state}`} style={containerStyle}>
      <div className="kimi-orbit orbit-outer"><span className="kimi-sat sat-1"></span></div>
      <div className="kimi-orbit orbit-inner"><span className="kimi-sat sat-2"></span></div>
      <img src="/assets/kimi.png" alt="Kimi AI" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </div>
  );
}
