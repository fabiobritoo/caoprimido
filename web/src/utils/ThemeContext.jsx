import React, { createContext, useContext, useState, useEffect } from 'react';
import { CORES_CLARO, CORES_ESCURO, CORES_CLARO_BOB, CORES_ESCURO_BOB } from './tema.js';

const CHAVE_MODO_ESCURO = '@caoprimido:modoEscuro';
const CHAVE_MODO_BOB = '@caoprimido:modoBob';
const CHAVE_TAMANHO_TEXTO = '@caoprimido:tamanhoTexto';
export const TAMANHOS_TEXTO = [
  { id: 'normal', rotulo: 'Normal', zoom: 1 },
  { id: 'grande', rotulo: 'Grande', zoom: 1.15 },
  { id: 'muito', rotulo: 'Muito grande', zoom: 1.3 },
];
const ContextoTema = createContext(null);

// Em vez de só chamar setAttribute (que em alguns Android/Chrome não força
// o navegador a repintar a barra de status do PWA instalado), remove a tag
// antiga e cria uma nova do zero — é um workaround conhecido pra um bug já
// registrado no rastreador do Chromium sobre esse comportamento.
function aplicarCorDaBarra(cor) {
  document.querySelectorAll('meta[name="theme-color"]').forEach((tag) => tag.remove());
  const novaTag = document.createElement('meta');
  novaTag.setAttribute('name', 'theme-color');
  novaTag.setAttribute('content', cor);
  document.head.appendChild(novaTag);
}

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

  const [tamanhoTexto, setTamanhoTexto] = useState(() => {
    try {
      return localStorage.getItem(CHAVE_TAMANHO_TEXTO) || 'normal';
    } catch (e) {
      return 'normal';
    }
  });

  // "texto grande": amplia o app inteiro (letras, botões e espaços juntos)
  useEffect(() => {
    const zoom = (TAMANHOS_TEXTO.find((t) => t.id === tamanhoTexto) || TAMANHOS_TEXTO[0]).zoom;
    document.documentElement.style.zoom = zoom === 1 ? '' : String(zoom);
    try {
      localStorage.setItem(CHAVE_TAMANHO_TEXTO, tamanhoTexto);
    } catch (e) {
      // sem problema
    }
  }, [tamanhoTexto]);

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
    const corBarra = modoEscuro ? paleta.fundo : paleta.primaria;

    document.body.style.backgroundColor = paleta.fundo;
    aplicarCorDaBarra(corBarra);

    // em alguns Android/Chrome, o PWA instalado só relê a cor da barra do
    // sistema quando o app volta a ficar em primeiro plano — reforça nesses
    // momentos também, não só quando o tema muda
    const aoVoltarVisivel = () => {
      if (document.visibilityState === 'visible') aplicarCorDaBarra(corBarra);
    };
    document.addEventListener('visibilitychange', aoVoltarVisivel);
    window.addEventListener('focus', aoVoltarVisivel);
    return () => {
      document.removeEventListener('visibilitychange', aoVoltarVisivel);
      window.removeEventListener('focus', aoVoltarVisivel);
    };
  }, [modoEscuro, modoBob]);

  const CORES = modoBob
    ? (modoEscuro ? CORES_ESCURO_BOB : CORES_CLARO_BOB)
    : (modoEscuro ? CORES_ESCURO : CORES_CLARO);

  // pasta de imagens (public/nina ou public/bob) usada pelas telas pra
  // escolher as mascotes certas sem precisar checar modoBob em todo lugar
  const pastaMascote = modoBob ? 'bob' : 'nina';

  return (
    <ContextoTema.Provider
      value={{ modoEscuro, setModoEscuro, modoBob, setModoBob, CORES, pastaMascote, tamanhoTexto, setTamanhoTexto }}
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
