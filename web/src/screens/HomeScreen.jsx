import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listarRemedios,
  obterRegistros,
  doseTomada,
  alternarDose,
} from '../utils/storage.js';
import {
  rotuloUnidade,
  diasDaSemanaAtualSegunda,
  remedioAplicavelNoDia,
  formatarData,
} from '../utils/constantes.js';
import { CORES } from '../utils/tema.js';
import CabecalhoTopo from '../components/CabecalhoTopo.jsx';
import { VERSAO, VERSAO_DESCRICAO } from '../utils/versao.js';

const HOJE = formatarData(new Date());

export default function HomeScreen() {
  const navigate = useNavigate();
  const [remedios, setRemedios] = useState([]);
  const [registros, setRegistros] = useState({});
  const [diaSelecionado, setDiaSelecionado] = useState(HOJE);

  const diasDaSemana = diasDaSemanaAtualSegunda();

  const carregar = useCallback(async () => {
    const lista = await listarRemedios();
    const regs = await obterRegistros();
    setRemedios(lista);
    setRegistros(regs);
  }, []);

  useEffect(() => {
    carregar();
    const aoVoltarParaAba = () => {
      if (document.visibilityState === 'visible') carregar();
    };
    document.addEventListener('visibilitychange', aoVoltarParaAba);
    return () => document.removeEventListener('visibilitychange', aoVoltarParaAba);
  }, [carregar]);

  const dosesDoDia = [];
  for (const remedio of remedios) {
    if (!remedioAplicavelNoDia(remedio.frequencia, diaSelecionado)) continue;
    for (const horario of remedio.horarios || []) {
      dosesDoDia.push({
        remedio,
        horario,
        tomado: doseTomada(registros, remedio.id, diaSelecionado, horario),
      });
    }
  }
  dosesDoDia.sort((a, b) => a.horario.localeCompare(b.horario));

  const diaEhFuturo = diaSelecionado > HOJE;
  const todasTomadas = dosesDoDia.length > 0 && dosesDoDia.every((d) => d.tomado);

  async function alternarDoseItem(item) {
    if (diaEhFuturo) return;
    const resultado = await alternarDose(item.remedio, diaSelecionado, item.horario);
    setRemedios(resultado.remedios);
    setRegistros(resultado.registros);
  }

  return (
    <div style={{ minHeight: '100%', backgroundColor: CORES.fundo, paddingBottom: 90 }}>
      <CabecalhoTopo
        titulo="Cãoprimido"
        botaoDireita={
          <button onClick={() => navigate('/meus-remedios')} style={estilos.botaoTexto}>
            Meus remédios
          </button>
        }
      />

      <div style={estilos.faixaSemana}>
        {diasDaSemana.map((dia) => {
          const selecionado = dia.data === diaSelecionado;
          const hoje = dia.data === HOJE;
          return (
            <button
              key={dia.data}
              onClick={() => setDiaSelecionado(dia.data)}
              style={estilos.diaColuna}
            >
              <span style={estilos.diaAbrev}>{dia.abrev}</span>
              <span
                style={{
                  ...estilos.diaCirculo,
                  ...(selecionado ? estilos.diaCirculoSelecionado : {}),
                  ...(!selecionado && hoje ? estilos.diaCirculoHoje : {}),
                }}
              >
                {dia.numero}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ padding: 16 }}>
        {dosesDoDia.length > 0 && (
          <div style={estilos.cabecalhoLista}>
            <img
              src={todasTomadas ? '/nina/mascote-parabens.png' : '/nina/mascote-hora-remedio.png'}
              alt=""
              style={estilos.mascoteCabecalho}
            />
            {todasTomadas && <div style={estilos.textoParabens}>Tudo em dia por hoje! 🎉</div>}
          </div>
        )}

        {dosesDoDia.length === 0 && (
          <div style={estilos.vazioContainer}>
            <img src="/nina/mascote-dormindo.png" alt="" style={estilos.mascoteVazio} />
            <div style={estilos.vazioTexto}>Nenhum remédio agendado para esse dia.</div>
          </div>
        )}

        {dosesDoDia.map((item) => {
          const unidadeTexto = rotuloUnidade(item.remedio.unidade).toLowerCase();
          const atrasado = !item.tomado && diaSelecionado < HOJE;
          return (
            <button
              key={`${item.remedio.id}-${item.horario}`}
              onClick={() => alternarDoseItem(item)}
              disabled={diaEhFuturo}
              style={{
                ...estilos.doseCard,
                ...(item.tomado ? estilos.doseCardTomado : {}),
                ...(atrasado ? estilos.doseCardAtrasado : {}),
              }}
            >
              <div style={estilos.doseHorarioBloco}>
                <span style={estilos.doseHorario}>{item.horario}</span>
              </div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={estilos.doseNome}>{item.remedio.nome}</div>
                <div style={estilos.doseDetalhe}>
                  {item.remedio.quantidadePorDose} {unidadeTexto}
                </div>
              </div>
              <div
                style={{
                  ...estilos.doseStatus,
                  ...(item.tomado ? estilos.doseStatusTomado : {}),
                  ...(atrasado ? estilos.doseStatusAtrasado : {}),
                }}
              >
                {item.tomado ? '✓' : ''}
              </div>
            </button>
          );
        })}
      </div>

      {todasTomadas && (
        <div style={estilos.gifCanto}>
          <img src="/nina/nina-lambendo.gif" alt="" style={{ width: '100%', height: '100%' }} />
        </div>
      )}

      <button onClick={() => navigate('/novo')} style={estilos.botaoAdicionar}>
        +
      </button>

      <div style={estilos.rodapeVersao}>
        v{VERSAO} · {VERSAO_DESCRICAO}
      </div>
    </div>
  );
}

const estilos = {
  botaoTexto: { background: 'none', border: 'none', color: '#fff', fontWeight: 600, fontSize: 13 },
  faixaSemana: {
    display: 'flex',
    justifyContent: 'space-between',
    backgroundColor: CORES.fundoCard,
    padding: '14px 10px',
    borderBottom: `1px solid ${CORES.borda}`,
  },
  diaColuna: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    background: 'none',
    border: 'none',
    width: 40,
    gap: 6,
  },
  diaAbrev: { fontSize: 11, color: CORES.textoSecundario },
  diaCirculo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 15,
    fontWeight: 600,
    color: CORES.textoPrincipal,
  },
  diaCirculoSelecionado: { backgroundColor: CORES.primaria, color: '#fff' },
  diaCirculoHoje: { border: `2px solid ${CORES.primaria}` },
  cabecalhoLista: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 12 },
  mascoteCabecalho: { width: 130, height: 130, objectFit: 'contain' },
  textoParabens: { fontSize: 16, fontWeight: 700, color: CORES.primariaEscura, marginTop: -6 },
  vazioContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 30 },
  mascoteVazio: { width: 220, height: 220, objectFit: 'contain', marginBottom: 12 },
  vazioTexto: { color: CORES.textoSecundario, textAlign: 'center' },
  doseCard: {
    width: '100%',
    backgroundColor: CORES.fundoCard,
    border: 'none',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    display: 'flex',
    alignItems: 'center',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  doseCardTomado: { backgroundColor: '#EDF7EE' },
  doseCardAtrasado: { backgroundColor: '#FBEAEA' },
  doseHorarioBloco: {
    width: 56,
    textAlign: 'center',
    marginRight: 12,
    borderRight: `1px solid ${CORES.borda}`,
    paddingRight: 12,
  },
  doseHorario: { fontSize: 15, fontWeight: 700, color: CORES.primaria },
  doseNome: { fontSize: 16, fontWeight: 600, color: CORES.textoPrincipal },
  doseDetalhe: { color: CORES.textoSecundario, fontSize: 13, marginTop: 2 },
  doseStatus: {
    width: 28,
    height: 28,
    borderRadius: 14,
    border: '2px solid #DDD',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: 700,
  },
  doseStatusTomado: { backgroundColor: CORES.sucesso, borderColor: CORES.sucesso },
  doseStatusAtrasado: { borderColor: CORES.perigo },
  gifCanto: {
    position: 'fixed',
    left: 16,
    bottom: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    border: '2px solid #fff',
    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
  },
  botaoAdicionar: {
    position: 'fixed',
    right: 20,
    bottom: 30,
    backgroundColor: CORES.primaria,
    color: '#fff',
    width: 56,
    height: 56,
    borderRadius: 28,
    border: 'none',
    fontSize: 30,
    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
  },
  rodapeVersao: {
    textAlign: 'center',
    fontSize: 11,
    color: CORES.textoSecundario,
    opacity: 0.6,
    padding: '20px 0 10px',
  },
};
