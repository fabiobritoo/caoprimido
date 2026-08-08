import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CORES } from '../utils/tema.js';

export default function CabecalhoTopo({ titulo, mostrarVoltar, botaoDireita }) {
  const navigate = useNavigate();

  return (
    <div style={estilos.container}>
      <div style={estilos.lado}>
        {mostrarVoltar && (
          <button onClick={() => navigate(-1)} style={estilos.botaoVoltar}>
            ‹
          </button>
        )}
      </div>
      <div style={estilos.titulo}>{titulo}</div>
      <div style={{ ...estilos.lado, justifyContent: 'flex-end' }}>{botaoDireita}</div>
    </div>
  );
}

const estilos = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CORES.primaria,
    color: '#fff',
    padding: '14px 12px',
    paddingTop: 'max(14px, env(safe-area-inset-top))',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  lado: { width: 70, display: 'flex', alignItems: 'center' },
  botaoVoltar: {
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: 28,
    padding: 0,
    lineHeight: 1,
  },
  titulo: { fontSize: 18, fontWeight: 700, flex: 1, textAlign: 'center' },
};
