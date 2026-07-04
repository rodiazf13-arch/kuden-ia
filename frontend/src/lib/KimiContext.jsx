import React, { createContext, useState, useContext } from 'react';

const KimiContext = createContext();

export function KimiProvider({ children }) {
  // states: 'idle', 'listening', 'thinking', 'speaking', 'success', 'handoff', 'sleep'
  const [kimiState, setKimiState] = useState('idle');
  const [kimiMessage, setKimiMessage] = useState(null);

  return (
    <KimiContext.Provider value={{ kimiState, setKimiState, kimiMessage, setKimiMessage }}>
      {children}
    </KimiContext.Provider>
  );
}

export function useKimi() {
  return useContext(KimiContext);
}
