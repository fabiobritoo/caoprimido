import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Check, Pill, Flame, Activity, Settings2, ClipboardList } from 'lucide-react';
import {
  listarRemedios,
  obterRegistros,
  doseTomada,
  horarioRegistrado,
  alternarDose,
  obterIdDispositivo,
} from '../utils/storage.js';
import {
  rotuloUnidade,
  diasDaSemanaAtualSegunda,
  remedioAplicavelNoDia,
  formatarData,
} from '../utils/constantes.js';
import { RAIO, SOMBRA } from '../utils/tema.js';
import { useTema } from '../utils/ThemeContext.jsx';
import CabecalhoTopo from '../components/CabecalhoTopo.jsx';
import DoseDetalheModal from '../components/DoseDetalheModal.jsx';
import { VERSAO, VERSAO_DESCRICAO } from '../utils/versao.js';
import { calcularSequenciaDias } from '../utils/streak.js';
import { atualizarSeloLocal } from '../utils/selo.js';

const HOJE = formatarData(new Date());

function formatarHora(timestamp) {
  if (!timestamp) return '--:--';
  const data = new Date(timestamp);
  return `${String(data.getHours()).padStart(2, '0')}:${String(data.getMinutes()).padStart(2, '0')}`;
}

export default function HomeScreen() {
  const navigate = useNavigate();
  const { CORES } = useTema();
  const estilos = criarEstilos(CORES);
  const [remedios, setRemedios] = useState([]);
  const [registros, setRegistros] = useState({});
  const [diaSelecionado, setDiaSelecionado] = useState(HOJE);
  const [sequenciaDias, setSequenciaDias] = useState(0);
  const [doseSelecionada, setDoseSelecionada] = useState(null);

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
        tomadoEm: horarioRegistrado(registros, remedio.id, diaSelecionado, horario),
      });
    }
  }
  dosesDoDia.sort((a, b) => a.horario.localeCompare(b.horario));

  const dosesPendentes = dosesDoDia.filter((d) => !d.tomado);
  const dosesRegistradas = dosesDoDia
    .filter((d) => d.tomado)
    .sort((a, b) => (a.tomadoEm || 0) - (b.tomadoEm || 0));

  const gruposPorHorario = [];
  for (const item of dosesPendentes) {
    let grupo = gruposPorHorario.find((g) => g.horario === item.horario);
    if (!grupo) {
      grupo = { horario: item.horario, itens: [] };
      gruposPorHorario.push(grupo);
    }
    grupo.itens.push(item);
  }

  const diaEhFuturo = diaSelecionado > HOJE;
  const todasTomadas = dosesDoDia.length > 0 && dosesDoDia.every((d) => d.tomado);

  async function marcarComoTomado(item) {
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

      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({
          tipo: 'FECHAR_NOTIFICACOES',
          remedioId: item.remedio.id,
          dia: diaSelecionado,
          horario: item.horario,
        });
      }
    }
  }

  async function desfazerDose(item) {
    const resultado = await alternarDose(item.remedio, diaSelecionado, item.horario);
    setRemedios(resultado.remedios);
    setRegistros(resultado.registros);
    setSequenciaDias(calcularSequenciaDias(resultado.remedios, resultado.registros));
    atualizarSeloLocal(resultado.remedios, resultado.registros);
    setDoseSelecionada(null);
  }

  return (
    <div style={{ minHeight: '100%', backgroundColor: CORES.fundo, paddingBottom: 96 }}>
      <CabecalhoTopo titulo="Cãoprimido" />

      <div style={estilos.navRapida}>
        <button onClick={() => navigate('/meus-remedios')} style={estilos.navItem}>
          <Pill size={20} strokeWidth={2.2} />
          <span>Remédios</span>
        </button>
        <button onClick={() => navigate('/diagnostico')} style={estilos.navItem}>
          <Activity size={20} strokeWidth={2.2} />
          <span>Diagnóstico</span>
        </button>
        <button onClick={() => navigate('/configuracoes')} style={estilos.navItem}>
          <Settings2 size={20} strokeWidth={2.2} />
          <span>Config</span>
        </button>
      </div>

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
            <div style={estilos.textoParabens}>
              {todasTomadas ? 'Tudo em dia por hoje! 🎉' : '\u00A0'}
            </div>
          </div>
        )}

        {dosesDoDia.length === 0 && (
          <div style={estilos.vazioContainer}>
            <img src="/nina/mascote-dormindo.png" alt="" style={estilos.mascoteVazio} />
            <div style={estilos.vazioTexto}>Nenhum remédio agendado para esse dia.</div>
          </div>
        )}

        {gruposPorHorario.map((grupo) => (
          <div key={grupo.horario} style={{ marginBottom: 18 }}>
            <div style={estilos.horarioTitulo}>{grupo.horario}</div>

            {grupo.itens.map((item) => {
              const unidadeTexto = rotuloUnidade(item.remedio.unidade).toLowerCase();
              const atrasado = diaSelecionado < HOJE;
              return (
                <button
                  key={`${item.remedio.id}-${item.horario}`}
                  onClick={() => marcarComoTomado(item)}
                  disabled={diaEhFuturo}
                  style={{
                    ...estilos.doseCard,
                    ...(atrasado ? estilos.doseCardAtrasado : {}),
                  }}
                >
                  <div style={estilos.doseIcone}>
                    <Pill size={18} color={CORES.primaria} strokeWidth={2.2} />
                  </div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={estilos.doseNome}>{item.remedio.nome}</div>
                    <div style={estilos.doseDetalhe}>
                      Tomar {item.remedio.quantidadePorDose} {unidadeTexto}
                    </div>
                  </div>
                  <div
                    style={{
                      ...estilos.doseStatus,
                      ...(atrasado ? estilos.doseStatusAtrasado : {}),
                    }}
                  />
                </button>
              );
            })}
          </div>
        ))}

        {dosesRegistradas.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={estilos.registradoTitulo}>
              <ClipboardList size={18} strokeWidth={2.3} color={CORES.textoSecundario} />
              Registrado
            </div>

            {dosesRegistradas.map((item) => {
              const unidadeTexto = rotuloUnidade(item.remedio.unidade).toLowerCase();
              return (
                <button
                  key={`reg-${item.remedio.id}-${item.horario}`}
                  onClick={() => setDoseSelecionada(item)}
                  style={{ ...estilos.doseCard, ...estilos.doseCardTomado }}
                >
                  <div style={estilos.doseIcone}>
                    <Pill size={18} color={CORES.primaria} strokeWidth={2.2} />
                  </div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={estilos.doseNome}>{item.remedio.nome}</div>
                    <div style={estilos.doseDetalhe}>
                      {item.remedio.quantidadePorDose} {unidadeTexto} · agendado {item.horario}
                    </div>
                  </div>
                  <div style={estilos.horaRegistrada}>{formatarHora(item.tomadoEm)}</div>
                  <div style={{ ...estilos.doseStatus, ...estilos.doseStatusTomado }}>
                    <Check size={16} strokeWidth={3} color="#fff" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
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
        v{VERSAO} · {VERSAO_DESCRICAO}
      </div>

      <DoseDetalheModal
        item={doseSelecionada}
        CORES={CORES}
        aoFechar={() => setDoseSelecionada(null)}
        aoDesfazer={desfazerDose}
      />
    </div>
  );
}

function criarEstilos(CORES) {
  return {
    navRapida: {
      display: 'flex',
      justifyContent: 'space-around',
      backgroundColor: CORES.fundoCard,
      padding: '10px 8px',
      borderBottom: `1px solid ${CORES.borda}`,
    },
    navItem: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 4,
      background: 'none',
      border: 'none',
      color: CORES.primaria,
      fontSize: 11,
      fontWeight: 600,
      padding: '6px 14px',
      borderRadius: RAIO.pequeno,
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
    cabecalhoLista: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      marginBottom: 12,
      height: 172,
    },
    mascoteCabecalho: { width: 130, height: 130, objectFit: 'contain' },
    textoParabens: { fontSize: 16, fontWeight: 700, color: CORES.primariaEscura, marginTop: 8, minHeight: 22 },
    vazioContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 30 },
    mascoteVazio: { width: 220, height: 220, objectFit: 'contain', marginBottom: 12 },
    vazioTexto: { color: CORES.textoSecundario, textAlign: 'center' },
    horarioTitulo: {
      fontSize: 18,
      fontWeight: 700,
      color: CORES.textoPrincipal,
      marginBottom: 8,
      paddingLeft: 2,
    },
    registradoTitulo: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 15,
      fontWeight: 700,
      color: CORES.textoSecundario,
      marginBottom: 10,
      paddingLeft: 2,
      borderTop: `1px solid ${CORES.borda}`,
      paddingTop: 16,
    },
    doseCard: {
      width: '100%',
      backgroundColor: CORES.fundoCard,
      border: 'none',
      borderRadius: RAIO.medio,
      padding: 14,
      marginBottom: 8,
      display: 'flex',
      alignItems: 'center',
      boxShadow: SOMBRA.card,
    },
    doseCardTomado: { backgroundColor: CORES.sucessoFundo },
    doseCardAtrasado: { backgroundColor: CORES.perigoFundo },
    doseIcone: {
      width: 38,
      height: 38,
      borderRadius: RAIO.pequeno,
      backgroundColor: CORES.primariaClara,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      flexShrink: 0,
    },
    doseNome: { fontSize: 16, fontWeight: 600, color: CORES.textoPrincipal },
    doseDetalhe: { color: CORES.textoSecundario, fontSize: 13, marginTop: 2 },
    horaRegistrada: {
      fontSize: 13,
      fontWeight: 700,
      color: CORES.sucesso,
      marginRight: 10,
    },
    doseStatus: {
      width: 30,
      height: 30,
      borderRadius: RAIO.pill,
      border: `2px solid ${CORES.borda}`,
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
      border: `2px solid ${CORES.fundoCard}`,
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
  };
}
