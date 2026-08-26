import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Pill, Clock, Package, Tag, Archive, ArchiveRestore, X } from 'lucide-react';
import { listarRemedios, atualizarRemedio, removerRemedio, obterIdDispositivo } from '../utils/storage.js';
import { sincronizarNotificacoesServidor } from '../utils/notifications.js';
import { rotuloUnidade, descreverFrequencia, remedioEstaAtivo, formatarData } from '../utils/constantes.js';
import { RAIO, SOMBRA } from '../utils/tema.js';
import { useTema } from '../utils/ThemeContext.jsx';
import CabecalhoTopo from '../components/CabecalhoTopo.jsx';

const HOJE = formatarData(new Date());

function formatarDataExibicao(dataStr) {
  const [ano, mes, dia] = dataStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

export default function ManageMedicinesScreen() {
  const navigate = useNavigate();
  const { CORES } = useTema();
  const estilos = criarEstilos(CORES);
  const [remedios, setRemedios] = useState([]);
  const [antigosAbertos, setAntigosAbertos] = useState(false);

  const carregar = useCallback(async () => {
    setRemedios(await listarRemedios());
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const ativos = remedios.filter((r) => remedioEstaAtivo(r, HOJE));
  const antigos = remedios.filter((r) => !remedioEstaAtivo(r, HOJE));

  async function excluir(remedio) {
    if (!confirm(`Excluir "${remedio.nome}" permanentemente? Isso apaga o histórico dele também.`)) return;
    const novaLista = await removerRemedio(remedio.id);
    setRemedios(novaLista);
    await sincronizarNotificacoesServidor(obterIdDispositivo(), novaLista);
  }

  async function pararDeTomar(remedio) {
    if (!confirm(`Marcar "${remedio.nome}" como parado? Ele sai da lista principal e vai pra "Remédios antigos" — o histórico continua guardado.`)) {
      return;
    }
    await atualizarRemedio(remedio.id, {
      ativo: false,
      dataTermino: remedio.dataTermino || HOJE,
    });
    const novaLista = await listarRemedios();
    setRemedios(novaLista);
    await sincronizarNotificacoesServidor(obterIdDispositivo(), novaLista);
  }

  async function reativar(remedio) {
    await atualizarRemedio(remedio.id, { ativo: true, dataTermino: null });
    const novaLista = await listarRemedios();
    setRemedios(novaLista);
    await sincronizarNotificacoesServidor(obterIdDispositivo(), novaLista);
  }

  return (
    <div style={{ minHeight: '100%', backgroundColor: CORES.fundo, paddingBottom: 96 }}>
      <CabecalhoTopo titulo="Meus Remédios" mostrarVoltar />

      <div style={{ padding: 16 }}>
        <div style={estilos.linhaAntigos}>
          <span style={estilos.textoAntigos}>Remédios antigos {antigos.length > 0 && `(${antigos.length})`}</span>
          <button
            onClick={() => setAntigosAbertos(true)}
            style={estilos.botaoIconeAntigos}
            aria-label="Ver remédios antigos"
          >
            <Archive size={16} strokeWidth={2.2} />
          </button>
        </div>

        {ativos.length === 0 && (
          <div style={estilos.vazioContainer}>
            <Pill size={48} color={CORES.borda} strokeWidth={1.5} />
            <div style={estilos.vazio}>Nenhum remédio ativo cadastrado ainda.</div>
          </div>
        )}

        {ativos.map((item) => {
          const unidadeTexto = rotuloUnidade(item.unidade).toLowerCase();
          return (
            <div key={item.id} style={estilos.card}>
              <div style={estilos.linhaConteudo}>
                <div style={estilos.iconeRemedio}>
                  <Pill size={20} color={CORES.primaria} strokeWidth={2} />
                </div>

                <div style={{ flex: 1 }}>
                  <div style={estilos.nome}>{item.nome}</div>

                  <div style={estilos.linhaDetalhe}>
                    <Clock size={13} color={CORES.textoSecundario} />
                    <span style={estilos.detalhe}>
                      {(item.horarios || []).join(', ')} · {item.quantidadePorDose} {unidadeTexto}
                    </span>
                  </div>

                  <div style={estilos.detalhe}>{descreverFrequencia(item.frequencia)}</div>

                  <div style={estilos.linhaDetalhe}>
                    <Package size={13} color={CORES.textoSecundario} />
                    <span style={estilos.detalhe}>
                      Estoque: {item.quantidadeAtual} {unidadeTexto}
                    </span>
                  </div>
                </div>
              </div>

              <div style={estilos.divisorCard} />

              <div style={estilos.acoes}>
                <button
                  onClick={() => navigate(`/remedio/${item.id}/compras`)}
                  style={estilos.botaoIconePreco}
                  aria-label="Histórico de preços"
                >
                  <Tag size={17} strokeWidth={2.2} />
                </button>
                <button
                  onClick={() => navigate(`/editar/${item.id}`)}
                  style={estilos.botaoIconeEditar}
                  aria-label="Editar"
                >
                  <Pencil size={17} strokeWidth={2.2} />
                </button>
                <button
                  onClick={() => pararDeTomar(item)}
                  style={estilos.botaoIconeParar}
                  aria-label="Parei de tomar"
                >
                  <Archive size={17} strokeWidth={2.2} />
                </button>
                <button
                  onClick={() => excluir(item)}
                  style={estilos.botaoIconeExcluir}
                  aria-label="Excluir"
                >
                  <Trash2 size={17} strokeWidth={2.2} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button onClick={() => navigate('/novo')} style={estilos.botaoAdicionar}>
        <Plus size={28} strokeWidth={2.5} color="#fff" />
      </button>

      {antigosAbertos && (
        <div style={estilos.fundoModal} onClick={() => setAntigosAbertos(false)}>
          <div style={estilos.folhaModal} onClick={(e) => e.stopPropagation()}>
            <div style={estilos.topoModal}>
              <span style={estilos.tituloModal}>Remédios antigos</span>
              <button onClick={() => setAntigosAbertos(false)} style={estilos.botaoFecharModal}>
                <X size={18} />
              </button>
            </div>

            {antigos.length === 0 ? (
              <div style={estilos.vazio}>Nenhum remédio antigo por aqui ainda.</div>
            ) : (
              antigos.map((item) => {
                const unidadeTexto = rotuloUnidade(item.unidade).toLowerCase();
                return (
                  <div key={item.id} style={estilos.cardAntigo}>
                    <div style={{ flex: 1 }}>
                      <div style={estilos.nomeAntigo}>{item.nome}</div>
                      <div style={estilos.detalheAntigo}>
                        {item.quantidadePorDose} {unidadeTexto} · {descreverFrequencia(item.frequencia)}
                      </div>
                      {item.dataTermino && (
                        <div style={estilos.detalheAntigo}>
                          Parou em {formatarDataExibicao(item.dataTermino)}
                        </div>
                      )}
                    </div>
                    <button onClick={() => reativar(item)} style={estilos.botaoReativar}>
                      <ArchiveRestore size={14} strokeWidth={2.2} />
                      Reativar
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function criarEstilos(CORES) {
  return {
    linhaAntigos: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 8,
      marginBottom: 14,
    },
    textoAntigos: { fontSize: 13, color: CORES.textoSecundario, fontWeight: 600 },
    botaoIconeAntigos: {
      width: 30,
      height: 30,
      borderRadius: RAIO.pill,
      border: 'none',
      backgroundColor: CORES.fundoCard,
      color: CORES.textoSecundario,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: SOMBRA.card,
    },
    card: {
      backgroundColor: CORES.fundoCard,
      borderRadius: RAIO.medio,
      padding: 16,
      marginBottom: 12,
      boxShadow: SOMBRA.card,
    },
    linhaConteudo: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
    },
    divisorCard: {
      height: 1,
      backgroundColor: CORES.borda,
      margin: '14px 0 10px',
    },
    iconeRemedio: {
      width: 40,
      height: 40,
      borderRadius: RAIO.pequeno,
      backgroundColor: CORES.primariaClara,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    nome: { fontSize: 17, fontWeight: 700, color: CORES.textoPrincipal, marginBottom: 4 },
    linhaDetalhe: { display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 },
    detalhe: { color: CORES.textoSecundario, fontSize: 13 },
    acoes: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
    botaoIconePreco: {
      width: 40,
      height: 40,
      borderRadius: RAIO.pill,
      border: 'none',
      backgroundColor: CORES.fundo,
      color: CORES.textoSecundario,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    botaoIconeEditar: {
      width: 40,
      height: 40,
      borderRadius: RAIO.pill,
      border: 'none',
      backgroundColor: CORES.primariaClara,
      color: CORES.primariaEscura,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    botaoIconeParar: {
      width: 40,
      height: 40,
      borderRadius: RAIO.pill,
      border: 'none',
      backgroundColor: CORES.fundo,
      color: CORES.atencao,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    botaoIconeExcluir: {
      width: 40,
      height: 40,
      borderRadius: RAIO.pill,
      border: 'none',
      backgroundColor: CORES.perigoFundo,
      color: CORES.perigo,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    vazioContainer: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 12,
      marginTop: 60,
    },
    vazio: { textAlign: 'center', color: CORES.textoSecundario, padding: '20px 0' },
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
      maxHeight: '75vh',
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
    cardAntigo: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      backgroundColor: CORES.fundo,
      borderRadius: RAIO.pequeno,
      padding: 12,
      marginBottom: 10,
    },
    nomeAntigo: { fontSize: 15, fontWeight: 700, color: CORES.textoPrincipal },
    detalheAntigo: { fontSize: 12, color: CORES.textoSecundario, marginTop: 2 },
    botaoReativar: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      backgroundColor: CORES.primariaClara,
      color: CORES.primariaEscura,
      border: 'none',
      borderRadius: RAIO.pill,
      padding: '8px 12px',
      fontSize: 12,
      fontWeight: 700,
      flexShrink: 0,
    },
  };
}
