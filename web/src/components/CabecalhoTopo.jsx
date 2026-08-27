import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useTema } from '../utils/ThemeContext.jsx';

export default function CabecalhoTopo({ titulo, mostrarVoltar, botaoDireita }) {
  const navigate = useNavigate();
  const { CORES } = useTema();
  const estilos = criarEstilos(CORES);

  return (
    <div style={estilos.container}>
      <div style={estilos.lado}>
        {mostrarVoltar && (
          <button onClick={() => navigate(-1)} style={estilos.botaoVoltar}>
            <ChevronLeft size={26} strokeWidth={2.5} />
          </button>
        )}
      </div>
      <div style={estilos.titulo}>{titulo}</div>
      <div style={{ ...estilos.lado, justifyContent: 'flex-end' }}>{botaoDireita}</div>
    </div>
  );
}

function criarEstilos(CORES) {
  return {
    container: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: CORES.primaria,
      color: CORES.textoBotaoPrimario || '#fff',
      padding: '14px 10px',
      paddingTop: 'max(14px, env(safe-area-inset-top))',
      position: 'sticky',
      top: 0,
      zIndex: 10,
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    },
    lado: { width: 70, display: 'flex', alignItems: 'center' },
    botaoVoltar: {
      background: 'rgba(255,255,255,0.15)',
      border: 'none',
      color: CORES.textoBotaoPrimario || '#fff',
      borderRadius: 999,
      width: 36,
      height: 36,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    titulo: { fontSize: 18, fontWeight: 700, flex: 1, textAlign: 'center' },
  };
}
