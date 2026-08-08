import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listarRemedios, removerRemedio } from '../utils/storage.js';
import { rotuloUnidade, descreverFrequencia } from '../utils/constantes.js';
import { CORES } from '../utils/tema.js';
import CabecalhoTopo from '../components/CabecalhoTopo.jsx';

export default function ManageMedicinesScreen() {
  const navigate = useNavigate();
  const [remedios, setRemedios] = useState([]);

  const carregar = useCallback(async () => {
    setRemedios(await listarRemedios());
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function excluir(remedio) {
    if (!confirm(`Excluir "${remedio.nome}"?`)) return;
    setRemedios(await removerRemedio(remedio.id));
  }

  return (
    <div style={{ minHeight: '100%', backgroundColor: CORES.fundo, paddingBottom: 90 }}>
      <CabecalhoTopo titulo="Meus Remédios" mostrarVoltar />

      <div style={{ padding: 16 }}>
        {remedios.length === 0 && (
          <div style={estilos.vazio}>Nenhum remédio cadastrado ainda.</div>
        )}

        {remedios.map((item) => {
          const unidadeTexto = rotuloUnidade(item.unidade).toLowerCase();
          return (
            <div key={item.id} style={estilos.card}>
              <div style={{ flex: 1 }}>
                <div style={estilos.nome}>{item.nome}</div>
                <div style={estilos.detalhe}>
                  {item.quantidadePorDose} {unidadeTexto} · {(item.horarios || []).join(', ')}
                </div>
                <div style={estilos.detalhe}>{descreverFrequencia(item.frequencia)}</div>
                <div style={estilos.detalhe}>
                  Estoque: {item.quantidadeAtual} {unidadeTexto}
                </div>
              </div>
              <div style={estilos.acoes}>
                <button
                  onClick={() => navigate(`/editar/${item.id}`)}
                  style={estilos.botaoEditar}
                >
                  Editar
                </button>
                <button onClick={() => excluir(item)} style={estilos.botaoExcluir}>
                  Excluir
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button onClick={() => navigate('/novo')} style={estilos.botaoAdicionar}>
        +
      </button>
    </div>
  );
}

const estilos = {
  card: {
    backgroundColor: CORES.fundoCard,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    display: 'flex',
    alignItems: 'flex-start',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  nome: { fontSize: 18, fontWeight: 600 },
  detalhe: { color: CORES.textoSecundario, marginTop: 2, fontSize: 13 },
  acoes: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 },
  botaoEditar: {
    background: 'none',
    border: 'none',
    color: CORES.primaria,
    fontSize: 13,
    fontWeight: 600,
  },
  botaoExcluir: { background: 'none', border: 'none', color: CORES.perigo, fontSize: 13 },
  vazio: { textAlign: 'center', marginTop: 40, color: CORES.textoSecundario },
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
};
