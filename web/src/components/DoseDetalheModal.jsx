import React from 'react';
import { Pill, Undo2, X } from 'lucide-react';
import { RAIO, SOMBRA } from '../utils/tema.js';
import { rotuloUnidade } from '../utils/constantes.js';

function formatarHora(timestamp) {
  if (!timestamp) return '--:--';
  const data = new Date(timestamp);
  return `${String(data.getHours()).padStart(2, '0')}:${String(data.getMinutes()).padStart(2, '0')}`;
}

export default function DoseDetalheModal({ item, CORES, aoFechar, aoDesfazer }) {
  if (!item) return null;
  const unidadeTexto = rotuloUnidade(item.remedio.unidade).toLowerCase();
  const estilos = criarEstilos(CORES);

  return (
    <div style={estilos.fundo} onClick={aoFechar}>
      <div style={estilos.folha} onClick={(e) => e.stopPropagation()}>
        <div style={estilos.alcinha} />

        <button onClick={aoFechar} style={estilos.botaoFechar}>
          <X size={18} color={CORES.textoSecundario} />
        </button>

        <div style={estilos.cabecalho}>
          <div style={estilos.iconeGrande}>
            <Pill size={28} color={CORES.primaria} strokeWidth={2} />
          </div>
          <div style={estilos.nome}>{item.remedio.nome}</div>
          <div style={estilos.subtitulo}>
            Agendado para {item.horario} · Tomar {item.remedio.quantidadePorDose} {unidadeTexto}
          </div>
          <div style={estilos.subtitulo}>
            Restante: {item.remedio.quantidadeAtual} {unidadeTexto}
          </div>
        </div>

        <div style={estilos.linha}>
          <span style={estilos.linhaLabel}>Dose</span>
          <span style={estilos.linhaValor}>
            {item.remedio.quantidadePorDose} {unidadeTexto}
          </span>
        </div>

        <div style={estilos.linha}>
          <span style={estilos.linhaLabel}>Horário registrado</span>
          <span style={estilos.linhaValor}>{formatarHora(item.tomadoEm)}</span>
        </div>

        <div style={estilos.statusBox}>
          Esta dose foi marcada como tomada às {formatarHora(item.tomadoEm)}
        </div>

        <button onClick={() => aoDesfazer(item)} style={estilos.botaoDesfazer}>
          <Undo2 size={18} strokeWidth={2.3} />
          Desfazer (marcar como não tomada)
        </button>
      </div>
    </div>
  );
}

function criarEstilos(CORES) {
  return {
    fundo: {
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.45)',
      display: 'flex',
      alignItems: 'flex-end',
      zIndex: 500,
    },
    folha: {
      position: 'relative',
      width: '100%',
      backgroundColor: CORES.fundoCard,
      borderTopLeftRadius: RAIO.grande,
      borderTopRightRadius: RAIO.grande,
      padding: '12px 20px 30px',
      boxShadow: SOMBRA.flutuante,
    },
    alcinha: {
      width: 40,
      height: 4,
      borderRadius: RAIO.pill,
      backgroundColor: CORES.borda,
      margin: '0 auto 14px',
    },
    botaoFechar: {
      position: 'absolute',
      top: 14,
      right: 16,
      background: 'none',
      border: 'none',
    },
    cabecalho: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 18 },
    iconeGrande: {
      width: 60,
      height: 60,
      borderRadius: RAIO.medio,
      backgroundColor: CORES.primariaClara,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    nome: { fontSize: 19, fontWeight: 700, color: CORES.textoPrincipal },
    subtitulo: { fontSize: 13, color: CORES.textoSecundario, marginTop: 2, textAlign: 'center' },
    linha: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: CORES.fundo,
      borderRadius: RAIO.pequeno,
      padding: '13px 16px',
      marginBottom: 10,
    },
    linhaLabel: { fontSize: 15, fontWeight: 600, color: CORES.textoPrincipal },
    linhaValor: { fontSize: 15, color: CORES.textoSecundario },
    statusBox: {
      textAlign: 'center',
      fontSize: 13,
      color: CORES.sucesso,
      fontWeight: 600,
      margin: '14px 0 18px',
    },
    botaoDesfazer: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: CORES.perigoFundo,
      color: CORES.perigo,
      border: 'none',
      borderRadius: RAIO.medio,
      padding: '14px 20px',
      fontWeight: 700,
      fontSize: 15,
    },
  };
}
