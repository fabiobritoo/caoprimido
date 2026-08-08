import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Check, Clock, ListChecks, Flame, Activity, Settings2 } from 'lucide-react';
import {
  listarRemedios,
  obterRegistros,
  doseTomada,
  alternarDose,
  obterIdDispositivo,
} from '../utils/storage.js';
import {
  rotuloUnidade,
  diasDaSemanaAtualSegunda,
  remedioAplicavelNoDia,
  formatarData,
} from '../utils/constantes.js';
import { CORES, RAIO, SOMBRA } from '../utils/tema.js';
import CabecalhoTopo from '../components/CabecalhoTopo.jsx';
import { VERSAO, VERSAO_DESCRICAO } from '../utils/versao.js';
import { calcularSequenciaDias } from '../utils/streak.js';
import { atualizarSeloLocal } from '../utils/selo.js';

const HOJE = formatarData(new Date());

export default function HomeScreen() {
  const navigate = useNavigate();
  const [remedios, setRemedios] = useState([]);
  const [registros, setRegistros] = useState({});
  const [diaSelecionado, setDiaSelecionado] = useState(HOJE);
  const [sequenciaDias, setSequenciaDias] = useState(0);

  const diasDaSemana = diasDaSemanaAtualSegunda();

  const carregar = useCallback(async () => {
    const lista = await listarRemedios();
    const regs = await obterRegistros();
    setRemedios(lista);
    setRegistros(regs);
    setSequenciaDias(calcularSequenciaDias(lista, regs));
    atualizarSeloLocal(lista, regs);
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
    setSequenciaDias(calcularSequenciaDias(resultado.remedios, resultado.registros));
    atualizarSeloLocal(resultado.remedios, resultado.registros);

    if (resultado.tomadoAgora) {
      fetch('/api/reconhecer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: obterIdDispositivo(),
          remedioId: item.remedio.id,
          dia: diaSelecionado,
          horario: item.horario,
        }),
      }).catch(() => {});
    }
  }

  return (
    <div style={{ minHeight: '100%', backgroundColor: CORES.fundo, paddingBottom: 96 }}>
      <CabecalhoTopo
        titulo="Cãoprimido"
        botaoDireita={
          <button onClick={() => navigate('/meus-remedios')} style={estilos.botaoTexto}>
            <ListChecks size={16} strokeWidth={2.5} />
            Remédios
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

      {sequenciaDias > 0 && (
        <div style={estilos.faixaStreak}>
          <Flame size={16} strokeWidth={2.5} fill={CORES.primariaEscura} />
          {sequenciaDias} {sequenciaDias === 1 ? 'dia seguido' : 'dias seguidos'} em dia!
        </div>
      )}

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
                <Clock size={15} color={CORES.primaria} strokeWidth={2.5} />
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
                {item.tomado && <Check size={16} strokeWidth={3} color="#fff" />}
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
        <Plus size={28} strokeWidth={2.5} color="#fff" />
      </button>

      <div style={estilos.rodapeVersao}>
        <span>
          v{VERSAO} · {VERSAO_DESCRICAO}
        </span>
        <div style={estilos.rodapeLinks}>
          <span onClick={() => navigate('/diagnostico')} style={estilos.linkDiagnostico}>
            <Activity size={12} /> diagnóstico
          </span>
          <span onClick={() => navigate('/configuracoes')} style={estilos.linkDiagnostico}>
            <Settings2 size={12} /> config
          </span>
        </div>
      </div>
    </div>
  );
}

const estilos = {
  botaoTexto: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'rgba(255,255,255,0.15)',
    border: 'none',
    borderRadius: RAIO.pill,
    color: '#fff',
    fontWeight: 600,
    fontSize: 13,
    padding: '8px 14px',
  },
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
    borderRadius: RAIO.pill,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 15,
    fontWeight: 600,
    color: CORES.textoPrincipal,
    transition: 'all 0.15s',
  },
  diaCirculoSelecionado: { backgroundColor: CORES.primaria, color: '#fff', boxShadow: SOMBRA.botao },
  diaCirculoHoje: { border: `2px solid ${CORES.primaria}` },
  faixaStreak: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    textAlign: 'center',
    backgroundColor: CORES.primariaClara,
    color: CORES.primariaEscura,
    fontWeight: 600,
    fontSize: 14,
    padding: '10px 0',
  },
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
    borderRadius: RAIO.medio,
    padding: 14,
    marginBottom: 10,
    display: 'flex',
    alignItems: 'center',
    boxShadow: SOMBRA.card,
  },
  doseCardTomado: { backgroundColor: '#EDF7EE' },
  doseCardAtrasado: { backgroundColor: '#FBEAEA' },
  doseHorarioBloco: {
    width: 60,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    marginRight: 12,
    borderRight: `1px solid ${CORES.borda}`,
    paddingRight: 12,
  },
  doseHorario: { fontSize: 14, fontWeight: 700, color: CORES.primaria },
  doseNome: { fontSize: 16, fontWeight: 600, color: CORES.textoPrincipal },
  doseDetalhe: { color: CORES.textoSecundario, fontSize: 13, marginTop: 2 },
  doseStatus: {
    width: 30,
    height: 30,
    borderRadius: RAIO.pill,
    border: '2px solid #DDD',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  doseStatusTomado: { backgroundColor: CORES.sucesso, borderColor: CORES.sucesso },
  doseStatusAtrasado: { borderColor: CORES.perigo },
  gifCanto: {
    position: 'fixed',
    left: 16,
    bottom: 24,
    width: 64,
    height: 64,
    borderRadius: RAIO.pill,
    overflow: 'hidden',
    border: '2px solid #fff',
    boxShadow: SOMBRA.flutuante,
  },
  botaoAdicionar: {
    position: 'fixed',
    right: 20,
    bottom: 30,
    backgroundColor: CORES.primaria,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 58,
    height: 58,
    borderRadius: RAIO.pill,
    border: 'none',
    boxShadow: SOMBRA.botao,
  },
  rodapeVersao: {
    textAlign: 'center',
    fontSize: 11,
    color: CORES.textoSecundario,
    opacity: 0.65,
    padding: '20px 0 10px',
  },
  rodapeLinks: { display: 'flex', justifyContent: 'center', gap: 16, marginTop: 6 },
  linkDiagnostico: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    textDecoration: 'underline',
    cursor: 'pointer',
  },
};
