import React from 'react';

/**
 * KimiMascot — Wrapper React para el Web Component interactivo de Kimi (kuden-kimi-widget).
 */
export default function KimiMascot({ size = 120, state = 'idle', onClick, style = {} }) {
  // Convertimos el prop 'size' a un valor CSS válido para la variable del Web Component
  const sizeStyle = typeof size === 'number' ? `${size}px` : size;

  return (
    <kuden-kimi-widget
      state={state}
      product="Kuden IA"
      theme="auto"
      closable="false"
      onClick={onClick}
      style={{
        '--kimi-size': sizeStyle,
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        display: 'inline-block',
        flexShrink: 0,
        ...style
      }}
    ></kuden-kimi-widget>
  );
}
