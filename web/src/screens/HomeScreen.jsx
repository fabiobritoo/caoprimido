import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Check, Pill, Flame, Settings2, ClipboardList, TrendingUp, CalendarDays, CalendarClock, Database, Download,
  ChevronLeft,
} from 'lucide-react';
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
  diasDaSemanaContendo,
  remedioAplicavelNoDia,
  formatarData,
  formatarDataPorExtenso,
  somarDias,
} from '../utils/constantes.js';
import { RAIO, SOMBRA } from '../utils/tema.js';
import { useTema } from '../utils/ThemeContext.jsx';
import CabecalhoTopo from '../components/CabecalhoTopo.jsx';
import DoseDetalheModal from '../components/DoseDetalheModal.jsx';
import CalendarioModal from '../components/CalendarioModal.jsx';
import { VERSAO, VERSAO_DESCRICAO } from '../utils/versao.js';
import { calcularSequenciaDias } from '../utils/streak.js';
import { obterProximaConsulta } from '../utils/consultas.js';
import { deveLembrarBackup } from '../utils/backup.js';
import { estaInstalado } from '../utils/instalacao.js';
import { atualizarSeloLocal } from '../utils/selo.js';

const HOJE = formatarData(new Date());
const LIMIAR_SWIPE = 45; // pixels mínimos de arrasto pra contar como swipe

function formatarHora(timestamp) {
  if (!timestamp) return '--:--';
  const data = new Date(timestamp);
  return `${String(data.getHours()).padStart(2, '0')}:${String(data.getMinutes()).padStart(2, '0')}`;
}

function formatarDataCurtaBR(dataStr) {
  const [, mes, dia] = dataStr.split('-');
  return `${dia}/${mes}`;
}

export default function HomeScreen() {
  const navigate = useNavigate();
  const { CORES, pastaMascote } = useTema();
  const estilos = criarEstilos(CORES);
  const [remedios, setRemedios] = useState([]);
  const [registros, setRegistros] = useState({});
  const [proximaConsulta, setProximaConsulta] = useState(null);
  const [diaSelecionado, setDiaSelecionado] = useState(HOJE);
  const [semanaAncora, setSemanaAncora] = useState(HOJE);
  const [sequenciaDias, setSequenciaDias] = useState(0);
  const [doseSelecionada, setDoseSelecionada] = useState(null);
  const [calendarioAberto, setCalendarioAberto] = useState(false);
  const [idConfirmando, setIdConfirmando] = useState(null);
  const [idRecemRegistrado, setIdRecemRegistrado] = useState(null);
  const [avisoEstoque, setAvisoEstoque] = useState(null);
  const [lembrarBackup, setLembrarBackup] = useState(false);
  const [jaInstalado, setJaInstalado] = useState(true); // começa true pra não "piscar" o banner à toa
  const [promptInstalacao, setPromptInstalacao] = useState(null);
  const [deltaXArrasto, setDeltaXArrasto] = useState(0);
  const [arrastando, setArrastando] = useState(false);
  const [transicaoAtiva, setTransicaoAtiva] = useState(true);

  const toqueInicioX = useRef(null);
  const larguraViewportRef = useRef(0);
  const viewportRef = useRef(null);

  const diasSemanaAnterior = diasDaSemanaContendo(somarDias(semanaAncora, -7));
  const diasDaSemana = diasDaSemanaContendo(semanaAncora);
  const diasSemanaProxima = diasDaSemanaContendo(somarDias(semanaAncora, 7));

  const carregar = useCallback(async () => {
    const lista = await listarRemedios();
    const regs = await obterRegistros();
    setRemedios(lista);
    setRegistros(regs);
    setSequenciaDias(calcularSequenciaDias(lista, regs));
    atualizarSeloLocal(lista, regs);
    setProximaConsulta(await obterProximaConsulta());
    setLembrarBackup(deveLembrarBackup());
  }, []);

  useEffect(() => {
    carregar();
    const aoVoltarParaAba = () => {
      if (document.visibilityState === 'visible') carregar();
    };
    document.addEventListener('visibilitychange', aoVoltarParaAba);
    return () => document.removeEventListener('visibilitychange', aoVoltarParaAba);
  }, [carregar]);

  useEffect(() => {
    setJaInstalado(estaInstalado());

    // o Chrome/Android dispara esse evento quando o app é instalável — a
    // gente "segura" ele (preventDefault) pra poder mostrar nosso próprio
    // botão, em vez do banner genérico do navegador
    const aoFicarInstalavel = (evento) => {
      evento.preventDefault();
      setPromptInstalacao(evento);
    };
    const aoInstalar = () => {
      setJaInstalado(true);
      setPromptInstalacao(null);
    };

    window.addEventListener('beforeinstallprompt', aoFicarInstalavel);
    window.addEventListener('appinstalled', aoInstalar);
    return () => {
      window.removeEventListener('beforeinstallprompt', aoFicarInstalavel);
      window.removeEventListener('appinstalled', aoInstalar);
    };
  }, []);

  async function instalarAgora() {
    if (!promptInstalacao) {
      navigate('/como-instalar');
      return;
    }
    promptInstalacao.prompt();
    await promptInstalacao.userChoice;
    setPromptInstalacao(null);
  }

  const obterStatusDoDia = useCallback(
    (dataStr) => {
      const doses = [];
      for (const remedio of remedios) {
        if (!remedioAplicavelNoDia(remedio.frequencia, dataStr, remedio.dataInicio, remedio.dataTermino)) continue;
        for (const horario of remedio.horarios || []) {
          doses.push({ remedioId: remedio.id, horario });
        }
      }
      if (doses.length === 0) return null;
      const tomadas = doses.filter((d) => doseTomada(registros, d.remedioId, dataStr, d.horario));
      if (tomadas.length === doses.length) return 'completo';
      if (tomadas.length === 0) return 'nenhum';
      return 'parcial';
    },
    [remedios, registros]
  );


  function aoTocarInicio(e) {
    toqueInicioX.current = e.touches[0].clientX;
    if (viewportRef.current) larguraViewportRef.current = viewportRef.current.offsetWidth;
    setTransicaoAtiva(false);
    setArrastando(true);
  }
  function aoTocarMover(e) {
    if (toqueInicioX.current === null) return;
    setDeltaXArrasto(e.touches[0].clientX - toqueInicioX.current);
  }
  function aoTocarFim() {
    if (toqueInicioX.current === null) return;
    const deltaFinal = deltaXArrasto;
    toqueInicioX.current = null;
    setArrastando(false);
    setTransicaoAtiva(true);

    const largura = larguraViewportRef.current || 300;

    if (deltaFinal > LIMIAR_SWIPE) {
      // arrastou pra direita -> termina de revelar a semana ANTERIOR
      setDeltaXArrasto(largura);
      setTimeout(() => {
        setTransicaoAtiva(false);
        setSemanaAncora((atual) => somarDias(atual, -7));
        setDeltaXArrasto(0);
      }, 220);
    } else if (deltaFinal < -LIMIAR_SWIPE) {
      setDeltaXArrasto(-largura);
      setTimeout(() => {
        setTransicaoAtiva(false);
        setSemanaAncora((atual) => somarDias(atual, 7));
        setDeltaXArrasto(0);
      }, 220);
    } else {
      setDeltaXArrasto(0); // não passou do limite: volta suavemente pro lugar
    }
  }
  function aoTocarCancelar() {
    toqueInicioX.current = null;
    setArrastando(false);
    setTransicaoAtiva(true);
    setDeltaXArrasto(0);
  }

  function aoEscolherDiaNoCalendario(dataStr) {
    setTransicaoAtiva(false);
    setDiaSelecionado(dataStr);
    setSemanaAncora(dataStr);
    setDeltaXArrasto(0);
    setCalendarioAberto(false);
    setTimeout(() => setTransicaoAtiva(true), 50);
  }

  const dosesDoDia = [];
  for (const remedio of remedios) {
    if (!remedioAplicavelNoDia(remedio.frequencia, diaSelecionado, remedio.dataInicio, remedio.dataTermino)) continue;
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

  // se a próxima dose pendente estiver a mais de 1h de distância, mostra a
  // mascote "standby" em vez da "hora do remédio" (que fica reservada pra
  // quando realmente está perto/na hora)
  let proximaDoseEmBreve = true;
  if (diaSelecionado === HOJE && dosesPendentes.length > 0) {
    const agora = new Date();
    const minutosAte = (horario) => {
      const [h, m] = horario.split(':').map(Number);
      const alvo = new Date();
      alvo.setHours(h, m, 0, 0);
      return (alvo - agora) / 60000;
    };
    const menorDistancia = Math.min(...dosesPendentes.map((d) => minutosAte(d.horario)));
    proximaDoseEmBreve = menorDistancia <= 60;
  }

  async function marcarComoTomado(item) {
    if (diaEhFuturo) return;
    const chave = `${item.remedio.id}-${item.horario}`;

    if (!item.tomado) {
      // dá um retorno visual imediato (o card "confirma" no lugar) antes de
      // efetivamente mover pra "Registrado" — sem isso, a troca é tão rápida
      // que às vezes não dá pra perceber que o toque funcionou
      setIdConfirmando(chave);
      await new Promise((resolve) => setTimeout(resolve, 420));
    }

    const resultado = await alternarDose(item.remedio, diaSelecionado, item.horario);
    setRemedios(resultado.remedios);
    setRegistros(resultado.registros);
    setSequenciaDias(calcularSequenciaDias(resultado.remedios, resultado.registros));
    atualizarSeloLocal(resultado.remedios, resultado.registros);
    setIdConfirmando(null);

    if (resultado.tomadoAgora) {
      setIdRecemRegistrado(chave);
      setTimeout(() => setIdRecemRegistrado(null), 500);

      // se essa confirmação deixou o estoque no limite (ou abaixo), avisa na
      // hora — não depende de notificação push, que só repete a cada 3 dias
      const remedioAtualizado = resultado.remedios.find((r) => r.id === item.remedio.id);
      if (
        remedioAtualizado?.quantidadeMinima > 0 &&
        remedioAtualizado.quantidadeAtual <= remedioAtualizado.quantidadeMinima
      ) {
        setAvisoEstoque(remedioAtualizado);
      }

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

    // avisa o servidor que a confirmação foi desfeita, senão ele acha que já
    // foi tomada e nunca mais reenvia o lembrete pra esse horário
    fetch('/api/desreconhecer', {
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

  function corDoCirculo(status) {
    switch (status) {
      case 'completo': return CORES.sucesso;
      case 'parcial': return CORES.atencao;
      case 'nenhum': return CORES.perigo;
      default: return null;
    }
  }

  function renderizarPainelSemana(dias) {
    return (
      <div style={estilos.painelSemana}>
        {dias.map((dia) => {
          const selecionado = dia.data === diaSelecionado;
          const hoje = dia.data === HOJE;
          const status = obterStatusDoDia(dia.data);
          const corStatus = corDoCirculo(status);
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
                  ...(corStatus ? { backgroundColor: corStatus, color: '#fff' } : {}),
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
    );
  }

  return (
    <div style={{ minHeight: '100%', backgroundColor: CORES.fundo, paddingBottom: 96 }}>
      <CabecalhoTopo titulo="Cãoprimido" />

      <div style={estilos.navRapida}>
        <button onClick={() => navigate('/meus-remedios')} style={estilos.navItem}>
          <Pill size={20} strokeWidth={2.2} />
          <span>Remédios</span>
        </button>
        <button onClick={() => navigate('/evolucao')} style={estilos.navItem}>
          <TrendingUp size={20} strokeWidth={2.2} />
          <span>Evolução</span>
        </button>
        <button onClick={() => navigate('/consultas')} style={estilos.navItem}>
          <CalendarClock size={20} strokeWidth={2.2} />
          <span>Consultas</span>
        </button>
        <button onClick={() => navigate('/configuracoes')} style={estilos.navItem}>
          <Settings2 size={20} strokeWidth={2.2} />
          <span>Config</span>
        </button>
      </div>

      <div
        style={estilos.faixaSemana}
        onTouchStart={aoTocarInicio}
        onTouchMove={aoTocarMover}
        onTouchEnd={aoTocarFim}
        onTouchCancel={aoTocarCancelar}
      >
        <div ref={viewportRef} style={estilos.janelaSemana}>
          <div
            style={{
              ...estilos.trilhoSemanas,
              transform: `translateX(calc(-33.3333% + ${deltaXArrasto}px))`,
              transition: transicaoAtiva ? 'transform 0.22s ease-out' : 'none',
            }}
          >
            {renderizarPainelSemana(diasSemanaAnterior)}
            {renderizarPainelSemana(diasDaSemana)}
            {renderizarPainelSemana(diasSemanaProxima)}
          </div>
        </div>
        <div style={estilos.divisorCalendario} />
        <button onClick={() => setCalendarioAberto(true)} style={estilos.botaoCalendario}>
          <CalendarDays size={19} color={CORES.primaria} strokeWidth={2.2} />
        </button>
      </div>

      <div style={estilos.faixaDataSelecionada}>
        <span style={estilos.textoDataSelecionada}>{formatarDataPorExtenso(diaSelecionado)}</span>
        {diaSelecionado !== HOJE && (
          <button
            onClick={() => {
              setDiaSelecionado(HOJE);
              setSemanaAncora(HOJE);
            }}
            style={estilos.botaoVoltarHoje}
          >
            <ChevronLeft size={13} strokeWidth={2.5} />
            Voltar para hoje
          </button>
        )}
      </div>

      <div
        style={{
          ...estilos.faixaStreak,
          backgroundColor: sequenciaDias > 0 ? CORES.primariaClara : 'transparent',
        }}
      >
        {sequenciaDias > 0 ? (
          <>
            <Flame size={16} strokeWidth={2.5} fill={CORES.primariaEscura} />
            {sequenciaDias} {sequenciaDias === 1 ? 'dia seguido' : 'dias seguidos'} em dia!
          </>
        ) : (
          '\u00A0'
        )}
      </div>

      {proximaConsulta && (
        <button onClick={() => navigate('/consultas')} style={estilos.faixaConsulta}>
          <CalendarClock size={15} strokeWidth={2.3} />
          Próxima consulta: {formatarDataCurtaBR(proximaConsulta.data)}
          {proximaConsulta.hora && ` às ${proximaConsulta.hora}`} — {proximaConsulta.medico}
        </button>
      )}

      {lembrarBackup && (
        <button onClick={() => navigate('/configuracoes')} style={estilos.faixaBackup}>
          <Database size={15} strokeWidth={2.3} />
          Faz um tempo que você não faz backup dos dados — toque pra fazer agora
        </button>
      )}

      {!jaInstalado && (
        <div style={estilos.faixaInstalar}>
          <button onClick={instalarAgora} style={estilos.botaoInstalarPrincipal}>
            <Download size={15} strokeWidth={2.3} />
            {promptInstalacao ? 'Instalar app' : 'Instale o app no seu celular'}
          </button>
          <button onClick={() => navigate('/como-instalar')} style={estilos.linkComoInstalar}>
            Como instalar
          </button>
        </div>
      )}

      <div style={{ padding: 16 }}>
        {dosesDoDia.length > 0 && (
          <div style={estilos.cabecalhoLista}>
            <img
              src={
                todasTomadas
                  ? `/${pastaMascote}/mascote-parabens.png`
                  : proximaDoseEmBreve
                  ? `/${pastaMascote}/mascote-hora-remedio.png`
                  : `/${pastaMascote}/mascote-standby.png`
              }
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
            <img src={`/${pastaMascote}/mascote-dormindo.png`} alt="" style={estilos.mascoteVazio} />
            <div style={estilos.vazioTexto}>Nenhum remédio agendado para esse dia.</div>
          </div>
        )}

        {gruposPorHorario.map((grupo) => (
          <div key={grupo.horario} style={{ marginBottom: 18 }}>
            <div style={estilos.horarioTitulo}>{grupo.horario}</div>

            {grupo.itens.map((item) => {
              const unidadeTexto = rotuloUnidade(item.remedio.unidade).toLowerCase();
              const atrasado = diaSelecionado < HOJE;
              const chave = `${item.remedio.id}-${item.horario}`;
              const confirmando = idConfirmando === chave;
              return (
                <button
                  key={chave}
                  onClick={() => marcarComoTomado(item)}
                  disabled={diaEhFuturo || confirmando}
                  className={confirmando ? 'dose-confirmando' : ''}
                  style={{
                    ...estilos.doseCard,
                    ...(atrasado ? estilos.doseCardAtrasado : {}),
                    ...(confirmando ? estilos.doseCardConfirmando : {}),
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
                      ...(confirmando ? estilos.doseStatusTomado : {}),
                    }}
                  >
                    {confirmando && (
                      <Check size={16} strokeWidth={3} color="#fff" className="check-aparecendo" />
                    )}
                  </div>
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
              const chave = `${item.remedio.id}-${item.horario}`;
              const recemRegistrado = idRecemRegistrado === chave;
              return (
                <button
                  key={`reg-${chave}`}
                  onClick={() => setDoseSelecionada(item)}
                  className={recemRegistrado ? 'dose-entrando-registrado' : ''}
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
          <img src={`/${pastaMascote}/mascote-lambendo.gif`} alt="" style={{ width: '100%', height: '100%' }} />
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

      {calendarioAberto && (
        <CalendarioModal
          CORES={CORES}
          dataInicial={diaSelecionado}
          obterStatusDoDia={obterStatusDoDia}
          aoFechar={() => setCalendarioAberto(false)}
          aoEscolherDia={aoEscolherDiaNoCalendario}
        />
      )}

      {avisoEstoque && (
        <div style={estilos.fundoAvisoEstoque} onClick={() => setAvisoEstoque(null)}>
          <div style={estilos.folhaAvisoEstoque} onClick={(e) => e.stopPropagation()}>
            <img
              src={`/${pastaMascote}/mascote-atencao.png`}
              alt=""
              style={estilos.mascoteAvisoEstoque}
            />
            <div style={estilos.tituloAvisoEstoque}>Estoque acabando</div>
            <div style={estilos.textoAvisoEstoque}>
              <strong>{avisoEstoque.nome}</strong> está com só{' '}
              <strong>
                {avisoEstoque.quantidadeAtual} {rotuloUnidade(avisoEstoque.unidade).toLowerCase()}
              </strong>{' '}
              restantes. Bom já pensar em comprar mais.
            </div>
            <div style={estilos.botoesAvisoEstoque}>
              <button
                onClick={() => {
                  navigate(`/remedio/${avisoEstoque.id}/compras`);
                  setAvisoEstoque(null);
                }}
                style={estilos.botaoAvisoEstoqueSecundario}
              >
                Ver preços
              </button>
              <button onClick={() => setAvisoEstoque(null)} style={estilos.botaoAvisoEstoquePrimario}>
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
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
      fontSize: 10,
      fontWeight: 600,
      padding: '6px 8px',
      borderRadius: RAIO.pequeno,
    },
    faixaSemana: {
      display: 'flex',
      alignItems: 'center',
      backgroundColor: CORES.fundoCard,
      padding: '14px 8px 14px 10px',
      borderBottom: `1px solid ${CORES.borda}`,
      touchAction: 'pan-y',
    },
    janelaSemana: {
      flex: 1,
      overflow: 'hidden',
    },
    trilhoSemanas: {
      display: 'flex',
      width: '300%',
    },
    painelSemana: {
      display: 'flex',
      justifyContent: 'space-between',
      width: '33.3333%',
      flexShrink: 0,
      padding: '0 5px',
      boxSizing: 'border-box',
    },
    faixaDataSelecionada: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 16px',
      backgroundColor: CORES.fundoCard,
      borderBottom: `1px solid ${CORES.borda}`,
    },
    textoDataSelecionada: {
      fontSize: 13,
      fontWeight: 600,
      color: CORES.textoPrincipal,
      textTransform: 'capitalize',
    },
    botaoVoltarHoje: {
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      background: CORES.primariaClara,
      color: CORES.primariaEscura,
      border: 'none',
      borderRadius: RAIO.pill,
      padding: '5px 10px 5px 6px',
      fontSize: 12,
      fontWeight: 700,
    },
    divisorCalendario: {
      width: 1,
      alignSelf: 'stretch',
      backgroundColor: CORES.borda,
      margin: '4px 8px',
    },
    botaoCalendario: {
      background: CORES.primariaClara,
      border: 'none',
      borderRadius: RAIO.pill,
      width: 38,
      height: 38,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    diaColuna: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      background: 'none',
      border: 'none',
      width: 38,
      gap: 6,
    },
    diaAbrev: { fontSize: 11, color: CORES.textoSecundario },
    diaCirculo: {
      width: 32,
      height: 32,
      borderRadius: RAIO.pill,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 15,
      fontWeight: 600,
      color: CORES.textoPrincipal,
      transition: 'all 0.15s',
      boxSizing: 'border-box',
    },
    diaCirculoSelecionado: {
      width: 36,
      height: 36,
      backgroundColor: CORES.primaria,
      color: CORES.textoBotaoPrimario || '#fff',
    },
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
      minHeight: 40,
      boxSizing: 'border-box',
    },
    faixaConsulta: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      textAlign: 'center',
      backgroundColor: CORES.fundoCard,
      borderBottom: `1px solid ${CORES.borda}`,
      color: CORES.textoSecundario,
      fontWeight: 600,
      fontSize: 12,
      padding: '9px 10px',
      border: 'none',
      borderRadius: 0,
    },
    faixaBackup: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      textAlign: 'center',
      backgroundColor: CORES.fundoCard,
      borderBottom: `1px solid ${CORES.borda}`,
      color: CORES.textoSecundario,
      fontWeight: 600,
      fontSize: 12,
      padding: '9px 10px',
      border: 'none',
      borderRadius: 0,
    },
    faixaInstalar: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: CORES.primariaClara,
      borderBottom: `1px solid ${CORES.borda}`,
      padding: '9px 10px',
      flexWrap: 'wrap',
    },
    botaoInstalarPrincipal: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      backgroundColor: CORES.primaria,
      color: '#fff',
      border: 'none',
      borderRadius: RAIO.pill,
      padding: '6px 12px',
      fontSize: 12,
      fontWeight: 700,
    },
    linkComoInstalar: {
      background: 'none',
      border: 'none',
      color: CORES.primariaEscura,
      fontSize: 12,
      fontWeight: 700,
      textDecoration: 'underline',
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
    doseCardConfirmando: { backgroundColor: CORES.sucessoFundo },
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
      // fundo sólido (não só a borda) — sem isso, o gif com fundo
      // transparente deixava o texto de versão atrás "vazando" por trás
      backgroundColor: CORES.primariaClara,
      border: `2px solid ${CORES.fundoCard}`,
      boxShadow: SOMBRA.flutuante,
      zIndex: 50,
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
    fundoAvisoEstoque: {
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 600,
      padding: 24,
    },
    folhaAvisoEstoque: {
      width: '100%',
      maxWidth: 340,
      backgroundColor: CORES.fundoCard,
      borderRadius: RAIO.medio,
      padding: 24,
      textAlign: 'center',
      boxShadow: SOMBRA.botao,
    },
    mascoteAvisoEstoque: {
      width: 96,
      height: 96,
      margin: '0 auto 10px',
      display: 'block',
    },
    tituloAvisoEstoque: {
      fontSize: 18,
      fontWeight: 700,
      color: CORES.textoPrincipal,
      marginBottom: 8,
    },
    textoAvisoEstoque: {
      fontSize: 14,
      color: CORES.textoSecundario,
      lineHeight: 1.5,
      marginBottom: 20,
    },
    botoesAvisoEstoque: { display: 'flex', gap: 10 },
    botaoAvisoEstoqueSecundario: {
      flex: 1,
      backgroundColor: CORES.fundo,
      color: CORES.textoSecundario,
      border: `1px solid ${CORES.borda}`,
      borderRadius: RAIO.medio,
      padding: '12px 10px',
      fontWeight: 600,
      fontSize: 13,
    },
    botaoAvisoEstoquePrimario: {
      flex: 1,
      backgroundColor: CORES.primaria,
      color: '#fff',
      border: 'none',
      borderRadius: RAIO.medio,
      padding: '12px 10px',
      fontWeight: 700,
      fontSize: 13,
    },
  };
}
