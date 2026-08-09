import React, { createContext, useContext, useState, useEffect } from 'react';
import { CORES_CLARO, CORES_ESCURO } from './tema.js';

const CHAVE_MODO_ESCURO = '@caoprimido:modoEscuro';
const ContextoTema = createContext(null);

export function ProvedorTema({ children }) {
  const [modoEscuro, setModoEscuro] = useState(() => {
    try {
      return localStorage.getItem(CHAVE_MODO_ESCURO) === 'true';
    } catch (e) {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_MODO_ESCURO, String(modoEscuro));
    } catch (e) {
      // sem problema se não conseguir salvar
    }
    const paleta = modoEscuro ? CORES_ESCURO : CORES_CLARO;
    document.body.style.backgroundColor = paleta.fundo;
    // ajusta a cor de fundo do navegador (barra de status etc) junto
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', modoEscuro ? '#181210' : '#D9527A');
  }, [modoEscuro]);

  const CORES = modoEscuro ? CORES_ESCURO : CORES_CLARO;

  return (
    <ContextoTema.Provider value={{ modoEscuro, setModoEscuro, CORES }}>
      {children}
    </ContextoTema.Provider>
  );
}

export function useTema() {
  const contexto = useContext(ContextoTema);
  if (!contexto) {
    throw new Error('useTema precisa ser usado dentro de <ProvedorTema>');
  }
  return contexto;
}
