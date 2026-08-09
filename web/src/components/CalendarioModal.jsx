import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { RAIO, SOMBRA } from '../utils/tema.js';
import { formatarData } from '../utils/constantes.js';

const NOMES_MES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const ABREV_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export default function CalendarioModal({ CORES, dataInicial, obterStatusDoDia, aoFechar, aoEscolherDia }) {
  const estilos = criarEstilos(CORES);
  const [mesVisivel, setMesVisivel] = useState(() => {
    const d = new Date(dataInicial + 'T12:00:00');
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const hojeStr = formatarData(new Date());

  const ano = mesVisivel.getFullYear();
  const mes = mesVisivel.getMonth();
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const totalDiasNoMes = new Date(ano, mes + 1, 0).getDate();

  const celulas = [];
  for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null);
  for (let dia = 1; dia <= totalDiasNoMes; dia++) {
    const dataStr = formatarData(new Date(ano, mes, dia));
    celulas.push({ dia, dataStr });
  }

  function corDoStatus(status) {
    switch (status) {
      case 'completo': return CORES.sucesso;
      case 'parcial': return CORES.atencao;
      case 'nenhum': return CORES.perigo;
      default: return 'transparent';
    }
  }

  return (
    <div style={estilos.fundo} onClick={aoFechar}>
      <div style={estilos.folha} onClick={(e) => e.stopPropagation()}>
        <div style={estilos.cabecalho}>
          <button
            onClick={() => setMesVisivel(new Date(ano, mes - 1, 1))}
            style={estilos.botaoNav}
          >
            <ChevronLeft size={20} />
          </button>
          <span style={estilos.tituloMes}>
            {NOMES_MES[mes]} {ano}
          </span>
          <button
            onClick={() => setMesVisivel(new Date(ano, mes + 1, 1))}
            style={estilos.botaoNav}
          >
            <ChevronRight size={20} />
          </button>
          <button onClick={aoFechar} style={estilos.botaoFechar}>
            <X size={18} />
          </button>
        </div>

        <div style={estilos.linhaAbrev}>
          {ABREV_SEMANA.map((a, i) => (
            <span key={i} style={estilos.abrevDia}>{a}</span>
          ))}
        </div>

        <div style={estilos.grade}>
          {celulas.map((celula, i) => {
            if (!celula) return <div key={i} style={estilos.celulaVazia} />;
            const status = obterStatusDoDia(celula.dataStr);
            const ehHoje = celula.dataStr === hojeStr;
            return (
              <button
                key={i}
                onClick={() => aoEscolherDia(celula.dataStr)}
                style={{
                  ...estilos.celula,
                  ...(ehHoje ? estilos.celulaHoje : {}),
                }}
              >
                <span>{celula.dia}</span>
                {status && (
                  <span style={{ ...estilos.bolinhaStatus, backgroundColor: corDoStatus(status) }} />
                )}
              </button>
            );
          })}
        </div>
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
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 500,
      padding: 20,
    },
    folha: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: CORES.fundoCard,
      borderRadius: RAIO.grande,
      padding: 18,
      boxShadow: SOMBRA.flutuante,
    },
    cabecalho: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
      position: 'relative',
    },
    botaoNav: {
      background: 'none',
      border: 'none',
      color: CORES.primaria,
      padding: 4,
    },
    tituloMes: { fontWeight: 700, fontSize: 16, color: CORES.textoPrincipal },
    botaoFechar: {
      position: 'absolute',
      right: -6,
      top: -10,
      background: 'none',
      border: 'none',
      color: CORES.textoSecundario,
      padding: 6,
    },
    linhaAbrev: { display: 'flex', marginBottom: 6 },
    abrevDia: {
      flex: 1,
      textAlign: 'center',
      fontSize: 11,
      color: CORES.textoSecundario,
      fontWeight: 600,
    },
    grade: {
      display: 'grid',
      gridTemplateColumns: 'repeat(7, 1fr)',
      gap: 2,
    },
    celulaVazia: { aspectRatio: '1' },
    celula: {
      aspectRatio: '1',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      background: 'none',
      border: 'none',
      borderRadius: RAIO.pequeno,
      fontSize: 13,
      color: CORES.textoPrincipal,
    },
    celulaHoje: {
      border: `1.5px solid ${CORES.primaria}`,
      fontWeight: 700,
    },
    bolinhaStatus: { width: 5, height: 5, borderRadius: 3 },
  };
}
