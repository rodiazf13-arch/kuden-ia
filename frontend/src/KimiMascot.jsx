import React from 'react';

/**
 * KimiMascot — La nueva mascota de Kuden IA usando kimi.png y CSS orbits.
 * Estados soportados por kimi-widget.css:
 *   idle, listening, thinking, speaking, success, handoff, sleep
 */
export default function KimiMascot({ size = 120, state = 'idle', onClick, style = {} }) {
  const sizeStyle = typeof size === 'number' ? `${size}px` : size;

  return (
    <div 
      className={`kimi ${state}`} 
      style={{ 
        width: sizeStyle, 
        height: sizeStyle, 
        cursor: onClick ? 'pointer' : 'default', 
        flexShrink: 0, 
        position: 'relative', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        ...style 
      }}
      onClick={onClick}
    >
      <div className="kimi-orbit orbit-outer"><span className="kimi-sat sat-1"></span></div>
      <div className="kimi-orbit orbit-inner"><span className="kimi-sat sat-2"></span></div>
      <img src="/assets/kimi.png" alt="Kimi AI" style={{ width: '82%', height: '82%', objectFit: 'contain', userSelect: 'none', pointerEvents: 'none', zIndex: 2 }} />
    </div>
  );
}
