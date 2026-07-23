import React, { createContext, useState, useContext } from 'react';

const KimiContext = createContext();

export function KimiProvider({ children }) {
  // states: 'idle', 'listening', 'thinking', 'speaking', 'success', 'handoff', 'sleep'
  const [kimiState, setKimiState] = useState('idle');
  const [kimiMessage, setKimiMessage] = useState(null);
  const [isKimiHidden, setIsKimiHidden] = useState(false);

  return (
    <KimiContext.Provider value={{ kimiState, setKimiState, kimiMessage, setKimiMessage, isKimiHidden, setIsKimiHidden }}>
      {children}
    </KimiContext.Provider>
  );
}

export function useKimi() {
  return useContext(KimiContext);
}
