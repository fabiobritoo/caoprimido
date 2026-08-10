import React, { createContext, useContext, useState, useEffect } from 'react';
import { CORES_CLARO, CORES_ESCURO, CORES_CLARO_BOB, CORES_ESCURO_BOB } from './tema.js';

const CHAVE_MODO_ESCURO = '@caoprimido:modoEscuro';
const CHAVE_MODO_BOB = '@caoprimido:modoBob';
const ContextoTema = createContext(null);

export function ProvedorTema({ children }) {
  const [modoEscuro, setModoEscuro] = useState(() => {
    try {
      return localStorage.getItem(CHAVE_MODO_ESCURO) === 'true';
    } catch (e) {
      return false;
    }
  });

  const [modoBob, setModoBob] = useState(() => {
    try {
      return localStorage.getItem(CHAVE_MODO_BOB) === 'true';
    } catch (e) {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_MODO_ESCURO, String(modoEscuro));
      localStorage.setItem(CHAVE_MODO_BOB, String(modoBob));
    } catch (e) {
      // sem problema se não conseguir salvar
    }

    const paleta = modoBob
      ? (modoEscuro ? CORES_ESCURO_BOB : CORES_CLARO_BOB)
      : (modoEscuro ? CORES_ESCURO : CORES_CLARO);

    document.body.style.backgroundColor = paleta.fundo;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', modoEscuro ? paleta.fundo : paleta.primaria);
  }, [modoEscuro, modoBob]);

  const CORES = modoBob
    ? (modoEscuro ? CORES_ESCURO_BOB : CORES_CLARO_BOB)
    : (modoEscuro ? CORES_ESCURO : CORES_CLARO);

  // pasta de imagens (public/nina ou public/bob) usada pelas telas pra
  // escolher as mascotes certas sem precisar checar modoBob em todo lugar
  const pastaMascote = modoBob ? 'bob' : 'nina';

  return (
    <ContextoTema.Provider
      value={{ modoEscuro, setModoEscuro, modoBob, setModoBob, CORES, pastaMascote }}
    >
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
