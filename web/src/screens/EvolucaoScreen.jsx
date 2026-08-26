import React, { useState, useEffect } from 'react';
import { TrendingUp, Flame, Award, Percent, FileDown, Tag, X, Check } from 'lucide-react';
import { listarRemedios, obterRegistros, doseTomada } from '../utils/storage.js';
import {
  calcularMapaCalor,
  calcularAdesaoGeral,
  calcularMelhorSequencia,
  calcularAdesaoPorRemedio,
} from '../utils/evolucao.js';
import { remedioAplicavelNoDia, formatarData } from '../utils/constantes.js';
import { calcularSequenciaDias } from '../utils/streak.js';
import { RAIO, SOMBRA, criarBotaoSecundario } from '../utils/tema.js';
import { useTema } from '../utils/ThemeContext.jsx';
import CabecalhoTopo from '../components/CabecalhoTopo.jsx';
import SaudeSecao from '../components/SaudeSecao.jsx';

const DIAS_HISTORICO = 84; // 12 semanas

function formatarDataExibicao(dataStr) {
  const [ano, mes, dia] = dataStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

export default function EvolucaoScreen() {
  const { CORES, modoBob } = useTema();
  const estilos = criarEstilos(CORES);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [gerandoPdfPreco, setGerandoPdfPreco] = useState(false);
  const [aba, setAba] = useState('remedios');
  const [carregando, setCarregando] = useState(true);
  const [mapaCalor, setMapaCalor] = useState([]);
  const [adesaoGeral, setAdesaoGeral] = useState(null);
  const [sequenciaAtual, setSequenciaAtual] = useState(0);
  const [melhorSequencia, setMelhorSequencia] = useState(0);
  const [porRemedio, setPorRemedio] = useState([]);
  const [remedios, setRemedios] = useState([]);
  const [registros, setRegistros] = useState({});
  const [diaDetalhe, setDiaDetalhe] = useState(null);

  useEffect(() => {
    (async () => {
      const listaRemedios = await listarRemedios();
      const listaRegistros = await obterRegistros();
      setRemedios(listaRemedios);
      setRegistros(listaRegistros);

      setMapaCalor(calcularMapaCalor(listaRemedios, listaRegistros, DIAS_HISTORICO));
      setAdesaoGeral(calcularAdesaoGeral(listaRemedios, listaRegistros, DIAS_HISTORICO));
      setSequenciaAtual(calcularSequenciaDias(listaRemedios, listaRegistros));
      setMelhorSequencia(calcularMelhorSequencia(listaRemedios, listaRegistros, DIAS_HISTORICO));
      setPorRemedio(calcularAdesaoPorRemedio(listaRemedios, listaRegistros, DIAS_HISTORICO));
      setCarregando(false);
    })();
  }, []);

  const colunas = [];
  let colunaAtual = [];
  mapaCalor.forEach((dia, idx) => {
    const diaSemana = new Date(dia.data + 'T12:00:00').getDay();
    if (idx === 0) {
      for (let i = 0; i < diaSemana; i++) colunaAtual.push(null);
    }
    colunaAtual.push(dia);
    if (diaSemana === 6 || idx === mapaCalor.length - 1) {
      colunas.push(colunaAtual);
      colunaAtual = [];
    }
  });

  function corDoStatus(status) {
    switch (status) {
      case 'completo': return CORES.sucesso;
      case 'parcial': return CORES.atencao;
      case 'nenhum': return CORES.perigo;
      case 'hoje_pendente': return CORES.primariaClara;
      case 'sem_remedio': return CORES.borda;
      default: return 'transparent';
    }
  }

  // monta, pra um dia específico, a lista de doses agendadas naquele dia e
  // se cada uma foi tomada ou não — usado no painel de detalhe ao clicar
  // num quadradinho do mapa de calor
  function montarDetalheDoDia(dataStr) {
    const itens = [];
    for (const remedio of remedios) {
      if (!remedioAplicavelNoDia(remedio.frequencia, dataStr, null, remedio.dataTermino)) continue;
      for (const horario of remedio.horarios || []) {
        itens.push({
          nome: remedio.nome,
          horario,
          tomado: doseTomada(registros, remedio.id, dataStr, horario),
        });
      }
    }
    itens.sort((a, b) => a.horario.localeCompare(b.horario));
    return itens;
  }

  function abrirDetalheDoDia(dia) {
    if (!dia || dia.status === 'sem_remedio' || dia.status === 'futuro') return;
    setDiaDetalhe({ data: dia.data, status: dia.status, itens: montarDetalheDoDia(dia.data) });
  }

  async function baixarRelatorio() {
    setGerandoPdf(true);
    try {
      const { gerarRelatorioPdf } = await import('../utils/relatorioPdf.js');
      await gerarRelatorioPdf({ modoBob });
    } catch (e) {
      console.error('Erro ao gerar PDF', e);
      alert('Não consegui gerar o PDF agora. Tente de novo.');
    }
    setGerandoPdf(false);
  }

  async function baixarRelatorioPreco() {
    setGerandoPdfPreco(true);
    try {
      const { gerarRelatorioPrecoPdf } = await import('../utils/relatorioPrecoPdf.js');
      await gerarRelatorioPrecoPdf({ modoBob });
    } catch (e) {
      console.error('Erro ao gerar PDF de preços', e);
      alert('Não consegui gerar o PDF agora. Tente de novo.');
    }
    setGerandoPdfPreco(false);
  }

  return (
    <div style={{ minHeight: '100%', backgroundColor: CORES.fundo, paddingBottom: 40 }}>
      <CabecalhoTopo titulo="Evolução" mostrarVoltar />

      <div style={estilos.seletorAbas}>
        <button
          onClick={() => setAba('remedios')}
          style={{ ...estilos.aba, ...(aba === 'remedios' ? estilos.abaAtiva : {}) }}
        >
          Remédios
        </button>
        <button
          onClick={() => setAba('saude')}
          style={{ ...estilos.aba, ...(aba === 'saude' ? estilos.abaAtiva : {}) }}
        >
          Saúde
        </button>
      </div>

      {aba === 'remedios' && (
        <div style={{ padding: '14px 16px 0' }}>
          <button onClick={baixarRelatorioPreco} disabled={gerandoPdfPreco} style={estilos.botaoPdfPreco}>
            <Tag size={16} strokeWidth={2.3} />
            {gerandoPdfPreco ? 'Gerando PDF...' : 'Exportar relatório de preços'}
          </button>
        </div>
      )}

      <div style={{ padding: '14px 16px 0' }}>
        <button onClick={baixarRelatorio} disabled={gerandoPdf} style={estilos.botaoPdf}>
          <FileDown size={16} strokeWidth={2.3} />
          {gerandoPdf ? 'Gerando PDF...' : 'Exportar relatório em PDF'}
        </button>
      </div>

      {aba === 'saude' ? (
        <div style={{ padding: 16 }}>
          <SaudeSecao CORES={CORES} />
        </div>
      ) : carregando ? (
        <div style={{ padding: 40, textAlign: 'center', color: CORES.textoSecundario }}>
          Carregando...
        </div>
      ) : (
        <div style={{ padding: 16 }}>
          <div style={estilos.cartoesResumo}>
            <div style={estilos.cartaoResumo}>
              <Percent size={20} color={CORES.primaria} strokeWidth={2.2} />
              <div style={estilos.cartaoValor}>
                {adesaoGeral === null ? '—' : `${adesaoGeral}%`}
              </div>
              <div style={estilos.cartaoLabel}>adesão geral</div>
            </div>
            <div style={estilos.cartaoResumo}>
              <Flame size={20} color={CORES.primaria} strokeWidth={2.2} />
              <div style={estilos.cartaoValor}>{sequenciaAtual}</div>
              <div style={estilos.cartaoLabel}>sequência atual</div>
            </div>
            <div style={estilos.cartaoResumo}>
              <Award size={20} color={CORES.primaria} strokeWidth={2.2} />
              <div style={estilos.cartaoValor}>{melhorSequencia}</div>
              <div style={estilos.cartaoLabel}>melhor sequência</div>
            </div>
          </div>

          <div style={estilos.secaoTitulo}>
            <TrendingUp size={18} strokeWidth={2.3} color={CORES.primaria} />
            Últimas 12 semanas
          </div>

          <div style={estilos.mapaCalorScroll}>
            <div style={estilos.mapaCalorGrid}>
              {colunas.map((coluna, i) => (
                <div key={i} style={estilos.colunaSemana}>
                  {coluna.map((dia, j) =>
                    dia ? (
                      <button
                        key={j}
                        title={dia.data}
                        onClick={() => abrirDetalheDoDia(dia)}
                        style={{
                          ...estilos.quadradoDia,
                          backgroundColor: corDoStatus(dia.status),
                        }}
                      />
                    ) : (
                      <div key={j} style={estilos.quadradoDia} />
                    )
                  )}
                </div>
              ))}
            </div>
          </div>
          <div style={estilos.dicaClicar}>Toque num quadradinho pra ver o detalhe do dia</div>

          <div style={estilos.legenda}>
            <span style={estilos.legendaItem}>
              <span style={{ ...estilos.legendaBolinha, backgroundColor: CORES.sucesso }} /> completo
            </span>
            <span style={estilos.legendaItem}>
              <span style={{ ...estilos.legendaBolinha, backgroundColor: CORES.atencao }} /> parcial
            </span>
            <span style={estilos.legendaItem}>
              <span style={{ ...estilos.legendaBolinha, backgroundColor: CORES.perigo }} /> nenhum
            </span>
            <span style={estilos.legendaItem}>
              <span style={{ ...estilos.legendaBolinha, backgroundColor: CORES.borda }} /> sem remédio
            </span>
          </div>

          {porRemedio.length > 0 && (
            <>
              <div style={{ ...estilos.secaoTitulo, marginTop: 26 }}>Adesão por remédio</div>
              {porRemedio.map((r) => (
                <div key={r.nome} style={estilos.linhaRemedio}>
                  <div style={estilos.linhaRemedioTopo}>
                    <span style={estilos.linhaRemedioNome}>{r.nome}</span>
                    <span style={estilos.linhaRemedioPercentual}>{r.percentual}%</span>
                  </div>
                  <div style={estilos.barraFundo}>
                    <div
                      style={{
                        ...estilos.barraPreenchida,
                        width: `${r.percentual}%`,
                        backgroundColor:
                          r.percentual >= 80 ? CORES.sucesso : r.percentual >= 50 ? CORES.atencao : CORES.perigo,
                      }}
                    />
                  </div>
                  <div style={estilos.linhaRemedioDetalhe}>
                    {r.tomadas} de {r.agendadas} doses
                  </div>
                </div>
              ))}
            </>
          )}

          {porRemedio.length === 0 && (
            <div style={estilos.vazioTexto}>
              Ainda não há histórico suficiente. Volte aqui depois de alguns dias de uso.
            </div>
          )}
        </div>
      )}

      {diaDetalhe && (
        <div style={estilos.fundoModal} onClick={() => setDiaDetalhe(null)}>
          <div style={estilos.folhaModal} onClick={(e) => e.stopPropagation()}>
            <div style={estilos.topoModal}>
              <span style={estilos.tituloModal}>{formatarDataExibicao(diaDetalhe.data)}</span>
              <button onClick={() => setDiaDetalhe(null)} style={estilos.botaoFecharModal}>
                <X size={18} />
              </button>
            </div>

            {diaDetalhe.itens.length === 0 ? (
              <div style={estilos.vazioTexto}>Nenhuma dose agendada nesse dia.</div>
            ) : (
              diaDetalhe.itens.map((item, i) => (
                <div key={i} style={estilos.linhaDetalheItem}>
                  <div
                    style={{
                      ...estilos.bolinhaDetalhe,
                      backgroundColor: item.tomado ? CORES.sucesso : CORES.perigo,
                    }}
                  >
                    {item.tomado && <Check size={12} strokeWidth={3} color="#fff" />}
                  </div>
                  <span style={estilos.horarioDetalhe}>{item.horario}</span>
                  <span style={estilos.nomeDetalhe}>{item.nome}</span>
                  <span
                    style={{
                      ...estilos.statusDetalhe,
                      color: item.tomado ? CORES.sucesso : CORES.perigo,
                    }}
                  >
                    {item.tomado ? 'Tomado' : 'Não tomado'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function criarEstilos(CORES) {
  return {
    botaoPdf: {
      ...criarBotaoSecundario(CORES),
      width: '100%',
    },
    botaoPdfPreco: {
      ...criarBotaoSecundario(CORES),
      width: '100%',
      backgroundColor: CORES.primariaClara,
    },
    seletorAbas: {
      display: 'flex',
      backgroundColor: CORES.fundoCard,
      borderBottom: `1px solid ${CORES.borda}`,
      padding: '0 16px',
    },
    aba: {
      flex: 1,
      background: 'none',
      border: 'none',
      padding: '14px 0',
      fontSize: 15,
      fontWeight: 600,
      color: CORES.textoSecundario,
      borderBottom: '3px solid transparent',
    },
    abaAtiva: {
      color: CORES.primaria,
      borderBottom: `3px solid ${CORES.primaria}`,
    },
    cartoesResumo: { display: 'flex', gap: 10, marginBottom: 24 },
    cartaoResumo: {
      flex: 1,
      backgroundColor: CORES.fundoCard,
      borderRadius: RAIO.medio,
      padding: '16px 10px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,
      boxShadow: SOMBRA.card,
    },
    cartaoValor: { fontSize: 22, fontWeight: 700, color: CORES.textoPrincipal },
    cartaoLabel: { fontSize: 11, color: CORES.textoSecundario, textAlign: 'center' },
    secaoTitulo: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 16,
      fontWeight: 700,
      color: CORES.textoPrincipal,
      marginBottom: 12,
    },
    mapaCalorScroll: { overflowX: 'auto', paddingBottom: 4 },
    mapaCalorGrid: { display: 'flex', gap: 4, width: 'max-content' },
    colunaSemana: { display: 'flex', flexDirection: 'column', gap: 4 },
    quadradoDia: { width: 16, height: 16, borderRadius: 4, border: 'none', padding: 0 },
    dicaClicar: { fontSize: 11, color: CORES.textoSecundario, marginTop: 8, fontStyle: 'italic' },
    legenda: { display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10 },
    legendaItem: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      fontSize: 11,
      color: CORES.textoSecundario,
    },
    legendaBolinha: { width: 9, height: 9, borderRadius: 3, display: 'inline-block' },
    linhaRemedio: {
      backgroundColor: CORES.fundoCard,
      borderRadius: RAIO.pequeno,
      padding: 14,
      marginBottom: 10,
      boxShadow: SOMBRA.card,
    },
    linhaRemedioTopo: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    linhaRemedioNome: { fontWeight: 600, color: CORES.textoPrincipal, fontSize: 15 },
    linhaRemedioPercentual: { fontWeight: 700, color: CORES.textoPrincipal, fontSize: 15 },
    barraFundo: {
      height: 8,
      borderRadius: RAIO.pill,
      backgroundColor: CORES.borda,
      overflow: 'hidden',
    },
    barraPreenchida: { height: '100%', borderRadius: RAIO.pill },
    linhaRemedioDetalhe: { fontSize: 12, color: CORES.textoSecundario, marginTop: 6 },
    vazioTexto: {
      textAlign: 'center',
      color: CORES.textoSecundario,
      fontSize: 14,
      marginTop: 30,
      lineHeight: 1.5,
    },
    fundoModal: {
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.45)',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      zIndex: 500,
    },
    folhaModal: {
      width: '100%',
      maxWidth: 480,
      backgroundColor: CORES.fundoCard,
      borderRadius: '18px 18px 0 0',
      padding: 20,
      maxHeight: '70vh',
      overflowY: 'auto',
    },
    topoModal: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    tituloModal: { fontSize: 17, fontWeight: 700, color: CORES.textoPrincipal },
    botaoFecharModal: { background: 'none', border: 'none', color: CORES.textoSecundario, padding: 4 },
    linhaDetalheItem: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 0',
      borderBottom: `1px solid ${CORES.borda}`,
    },
    bolinhaDetalhe: {
      width: 22,
      height: 22,
      borderRadius: RAIO.pill,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    horarioDetalhe: { fontSize: 13, color: CORES.textoSecundario, width: 42, flexShrink: 0 },
    nomeDetalhe: { fontSize: 14, fontWeight: 600, color: CORES.textoPrincipal, flex: 1 },
    statusDetalhe: { fontSize: 12, fontWeight: 700 },
  };
}
