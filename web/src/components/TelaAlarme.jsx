import React, { useEffect } from 'react';
import { CORES } from '../utils/tema.js';
import { iniciarAlarme, pararAlarme } from '../utils/somAlarme.js';

export default function TelaAlarme({ titulo, corpo, aoFechar }) {
  useEffect(() => {
    iniciarAlarme();
    if (navigator.vibrate) {
      navigator.vibrate([400, 200, 400, 200, 400, 200, 400]);
    }
    return () => pararAlarme();
  }, []);

  function pararEFechar() {
    pararAlarme();
    aoFechar();
  }

  return (
    <div style={estilos.container}>
      <div style={estilos.iconeAlarme}>⏰</div>
      <div style={estilos.titulo}>{titulo}</div>
      {corpo && <div style={estilos.corpo}>{corpo}</div>}

      <button onClick={pararEFechar} style={estilos.botaoParar}>
        Já tomei — Parar alarme
      </button>
    </div>
  );
}

const estilos = {
  container: {
    position: 'fixed',
    inset: 0,
    backgroundColor: CORES.primaria,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    zIndex: 1000,
    textAlign: 'center',
  },
  iconeAlarme: { fontSize: 72, marginBottom: 20, animation: 'pulsar 1s infinite' },
  titulo: { color: '#fff', fontSize: 24, fontWeight: 700, marginBottom: 10 },
  corpo: { color: '#fff', fontSize: 16, opacity: 0.9, marginBottom: 40 },
  botaoParar: {
    backgroundColor: '#fff',
    color: CORES.primaria,
    border: 'none',
    borderRadius: 14,
    padding: '18px 32px',
    fontSize: 18,
    fontWeight: 700,
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
  },
};
