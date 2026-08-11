import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Pill, Clock, Package, Tag } from 'lucide-react';
import { listarRemedios, removerRemedio, obterIdDispositivo } from '../utils/storage.js';
import { sincronizarNotificacoesServidor } from '../utils/notifications.js';
import { rotuloUnidade, descreverFrequencia } from '../utils/constantes.js';
import { RAIO, SOMBRA } from '../utils/tema.js';
import { useTema } from '../utils/ThemeContext.jsx';
import CabecalhoTopo from '../components/CabecalhoTopo.jsx';

export default function ManageMedicinesScreen() {
  const navigate = useNavigate();
  const { CORES } = useTema();
  const estilos = criarEstilos(CORES);
  const [remedios, setRemedios] = useState([]);

  const carregar = useCallback(async () => {
    setRemedios(await listarRemedios());
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function excluir(remedio) {
    if (!confirm(`Excluir "${remedio.nome}"?`)) return;
    const novaLista = await removerRemedio(remedio.id);
    setRemedios(novaLista);
    await sincronizarNotificacoesServidor(obterIdDispositivo(), novaLista);
  }

  return (
    <div style={{ minHeight: '100%', backgroundColor: CORES.fundo, paddingBottom: 96 }}>
      <CabecalhoTopo titulo="Meus Remédios" mostrarVoltar />

      <div style={{ padding: 16 }}>
        {remedios.length === 0 && (
          <div style={estilos.vazioContainer}>
            <Pill size={48} color={CORES.borda} strokeWidth={1.5} />
            <div style={estilos.vazio}>Nenhum remédio cadastrado ainda.</div>
          </div>
        )}

        {remedios.map((item) => {
          const unidadeTexto = rotuloUnidade(item.unidade).toLowerCase();
          return (
            <div key={item.id} style={estilos.card}>
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

              <div style={estilos.acoes}>
                <button
                  onClick={() => navigate(`/remedio/${item.id}/compras`)}
                  style={estilos.botaoIconePreco}
                  aria-label="Histórico de preços"
                >
                  <Tag size={16} strokeWidth={2.2} />
                </button>
                <button
                  onClick={() => navigate(`/editar/${item.id}`)}
                  style={estilos.botaoIconeEditar}
                  aria-label="Editar"
                >
                  <Pencil size={16} strokeWidth={2.2} />
                </button>
                <button
                  onClick={() => excluir(item)}
                  style={estilos.botaoIconeExcluir}
                  aria-label="Excluir"
                >
                  <Trash2 size={16} strokeWidth={2.2} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button onClick={() => navigate('/novo')} style={estilos.botaoAdicionar}>
        <Plus size={28} strokeWidth={2.5} color="#fff" />
      </button>
    </div>
  );
}

function criarEstilos(CORES) {
  return {
    card: {
      backgroundColor: CORES.fundoCard,
      borderRadius: RAIO.medio,
      padding: 16,
      marginBottom: 12,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      boxShadow: SOMBRA.card,
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
    acoes: { display: 'flex', flexDirection: 'column', gap: 8 },
    botaoIconePreco: {
      width: 34,
      height: 34,
      borderRadius: RAIO.pill,
      border: 'none',
      backgroundColor: CORES.fundo,
      color: CORES.textoSecundario,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    botaoIconeEditar: {
      width: 34,
      height: 34,
      borderRadius: RAIO.pill,
      border: 'none',
      backgroundColor: CORES.primariaClara,
      color: CORES.primariaEscura,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    botaoIconeExcluir: {
      width: 34,
      height: 34,
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
    vazio: { textAlign: 'center', color: CORES.textoSecundario },
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
  };
}
