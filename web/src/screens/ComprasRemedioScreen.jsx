import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Trash2, Pencil, Tag, MapPin, X, TrendingUp, TrendingDown } from 'lucide-react';
import { listarComprasDoRemedio, adicionarCompra, atualizarCompra, removerCompra } from '../utils/compras.js';
import { listarRemedios } from '../utils/storage.js';
import { formatarData } from '../utils/constantes.js';
import { RAIO, SOMBRA, criarBotaoPrimario } from '../utils/tema.js';
import { useTema } from '../utils/ThemeContext.jsx';
import CabecalhoTopo from '../components/CabecalhoTopo.jsx';

const HOJE = formatarData(new Date());

function formatarDataExibicao(dataStr) {
  const [ano, mes, dia] = dataStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

function formatarPreco(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function ComprasRemedioScreen() {
  const { id: remedioId } = useParams();
  const { CORES } = useTema();
  const estilos = criarEstilos(CORES);

  const [nomeRemedio, setNomeRemedio] = useState('');
  const [compras, setCompras] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [formularioAberto, setFormularioAberto] = useState(false);
  const [idEditando, setIdEditando] = useState(null);

  const [data, setData] = useState(HOJE);
  const [preco, setPreco] = useState('');
  const [local, setLocal] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [anotacoes, setAnotacoes] = useState('');

  const carregar = async () => {
    const remedios = await listarRemedios();
    const remedio = remedios.find((r) => r.id === remedioId);
    setNomeRemedio(remedio?.nome || 'Remédio');
    setCompras(await listarComprasDoRemedio(remedioId));
    setCarregando(false);
  };

  useEffect(() => {
    carregar();
  }, [remedioId]);

  function limpar() {
    setData(HOJE);
    setPreco('');
    setLocal('');
    setQuantidade('');
    setAnotacoes('');
    setIdEditando(null);
  }

  function abrirParaEditar(compra) {
    setData(compra.data);
    setPreco(String(compra.preco));
    setLocal(compra.local || '');
    setQuantidade(compra.quantidade != null ? String(compra.quantidade) : '');
    setAnotacoes(compra.anotacoes || '');
    setIdEditando(compra.id);
    setFormularioAberto(true);
  }

  async function salvar() {
    if (!preco || Number(preco) <= 0) {
      alert('Informe o preço pago.');
      return;
    }
    const dados = {
      remedioId,
      data,
      preco: Number(preco),
      local: local.trim() || null,
      quantidade: quantidade ? Number(quantidade) : null,
      anotacoes: anotacoes.trim() || null,
    };

    if (idEditando) {
      setCompras(await atualizarCompra(idEditando, dados));
    } else {
      setCompras(await adicionarCompra(dados));
    }
    limpar();
    setFormularioAberto(false);
  }

  async function excluir(id) {
    if (!confirm('Excluir esse registro de compra?')) return;
    setCompras(await removerCompra(id, remedioId));
  }

  const comprasComVariacao = compras.map((c, i) => {
    const anterior = compras[i + 1];
    if (!anterior) return { ...c, variacao: null };
    const variacao = ((c.preco - anterior.preco) / anterior.preco) * 100;
    return { ...c, variacao };
  });

  if (carregando) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Carregando...</div>;
  }

  return (
    <div style={{ minHeight: '100%', backgroundColor: CORES.fundo, paddingBottom: 40 }}>
      <CabecalhoTopo titulo={`Preços — ${nomeRemedio}`} mostrarVoltar />

      <div style={{ padding: 16 }}>
        <div style={estilos.explicacao}>
          Registre o que você pagou em cada compra pra comparar preços entre farmácias e ao
          longo do tempo. Totalmente opcional.
        </div>

        {!formularioAberto ? (
          <button onClick={() => setFormularioAberto(true)} style={estilos.botaoNovo}>
            <Plus size={18} strokeWidth={2.5} />
            Registrar compra
          </button>
        ) : (
          <div style={estilos.formulario}>
            <div style={estilos.formularioTitulo}>
              {idEditando ? 'Editar registro' : 'Nova compra'}
            </div>

            <label style={estilos.label}>Data</label>
            <input
              type="date"
              value={data}
              max={HOJE}
              onChange={(e) => setData(e.target.value)}
              style={estilos.input}
            />

            <label style={estilos.label}>Preço pago (R$)</label>
            <input
              type="number"
              step="0.01"
              placeholder="Ex: 45.90"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              style={estilos.input}
            />

            <label style={estilos.label}>Local / farmácia (opcional)</label>
            <input
              type="text"
              placeholder="Ex: Drogasil, iFood Farmácia..."
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              style={estilos.input}
            />

            <label style={estilos.label}>Quantidade comprada (opcional)</label>
            <input
              type="number"
              placeholder="Ex: 30 (comprimidos na caixa)"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              style={estilos.input}
            />

            <label style={estilos.label}>Anotações (opcional)</label>
            <textarea
              placeholder="Promoção, cupom usado, etc."
              value={anotacoes}
              onChange={(e) => setAnotacoes(e.target.value)}
              style={estilos.textarea}
              rows={2}
            />

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button
                onClick={() => {
                  limpar();
                  setFormularioAberto(false);
                }}
                style={estilos.botaoCancelar}
              >
                <X size={16} /> Cancelar
              </button>
              <button onClick={salvar} style={estilos.botaoSalvar}>
                {idEditando ? 'Salvar alterações' : 'Salvar compra'}
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          {comprasComVariacao.length === 0 && (
            <div style={estilos.vazioTexto}>Nenhuma compra registrada ainda.</div>
          )}

          {comprasComVariacao.map((c) => (
            <div key={c.id} style={estilos.cartao}>
              <div style={estilos.cartaoTopo}>
                <span style={estilos.cartaoData}>{formatarDataExibicao(c.data)}</span>
                <div style={estilos.acoesCartao}>
                  <button onClick={() => abrirParaEditar(c)} style={estilos.botaoEditar}>
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => excluir(c.id)} style={estilos.botaoExcluir}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div style={estilos.linhaPreco}>
                <Tag size={16} color={CORES.primaria} />
                <span style={estilos.precoTexto}>{formatarPreco(c.preco)}</span>
                {c.variacao != null && Math.abs(c.variacao) >= 0.5 && (
                  <span
                    style={{
                      ...estilos.variacaoBadge,
                      color: c.variacao > 0 ? CORES.perigo : CORES.sucesso,
                      backgroundColor: c.variacao > 0 ? CORES.perigoFundo : CORES.sucessoFundo,
                    }}
                  >
                    {c.variacao > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {c.variacao > 0 ? '+' : ''}
                    {c.variacao.toFixed(1)}%
                  </span>
                )}
              </div>

              {c.local && (
                <div style={estilos.linhaInfo}>
                  <MapPin size={13} color={CORES.textoSecundario} />
                  <span>{c.local}</span>
                </div>
              )}
              {c.quantidade != null && (
                <div style={estilos.linhaInfo}>
                  <span>
                    {c.quantidade} unidades — {formatarPreco(c.preco / c.quantidade)}/unidade
                  </span>
                </div>
              )}
              {c.anotacoes && <div style={estilos.anotacoes}>{c.anotacoes}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function criarEstilos(CORES) {
  return {
    explicacao: { color: CORES.textoSecundario, fontSize: 13, marginBottom: 16, lineHeight: 1.5 },
    botaoNovo: { ...criarBotaoPrimario(CORES), width: '100%' },
    formulario: {
      backgroundColor: CORES.fundoCard,
      borderRadius: RAIO.medio,
      padding: 16,
      boxShadow: SOMBRA.card,
    },
    formularioTitulo: { fontWeight: 700, fontSize: 15, color: CORES.textoPrincipal, marginBottom: 4 },
    label: {
      display: 'block',
      fontWeight: 600,
      fontSize: 13,
      color: CORES.textoPrincipal,
      marginTop: 12,
      marginBottom: 6,
    },
    input: {
      width: '100%',
      border: `1.5px solid ${CORES.borda}`,
      borderRadius: RAIO.pequeno,
      padding: 10,
      fontSize: 15,
      backgroundColor: CORES.fundo,
      color: CORES.textoPrincipal,
      boxSizing: 'border-box',
    },
    textarea: {
      width: '100%',
      border: `1.5px solid ${CORES.borda}`,
      borderRadius: RAIO.pequeno,
      padding: 10,
      fontSize: 14,
      backgroundColor: CORES.fundo,
      color: CORES.textoPrincipal,
      resize: 'vertical',
      fontFamily: 'inherit',
      boxSizing: 'border-box',
    },
    botaoCancelar: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: CORES.fundo,
      color: CORES.textoSecundario,
      border: `1px solid ${CORES.borda}`,
      borderRadius: RAIO.medio,
      padding: '12px 16px',
      fontWeight: 600,
    },
    botaoSalvar: { flex: 2, ...criarBotaoPrimario(CORES), padding: '12px 16px' },
    vazioTexto: { textAlign: 'center', color: CORES.textoSecundario, fontSize: 14, marginTop: 20 },
    cartao: {
      backgroundColor: CORES.fundoCard,
      borderRadius: RAIO.pequeno,
      padding: 14,
      marginBottom: 10,
      boxShadow: SOMBRA.card,
    },
    cartaoTopo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    cartaoData: { fontWeight: 700, color: CORES.textoPrincipal, fontSize: 14 },
    acoesCartao: { display: 'flex', gap: 4 },
    botaoEditar: {
      background: CORES.primariaClara,
      border: 'none',
      borderRadius: RAIO.pill,
      color: CORES.primariaEscura,
      padding: 6,
      display: 'flex',
    },
    botaoExcluir: {
      background: CORES.perigoFundo,
      border: 'none',
      borderRadius: RAIO.pill,
      color: CORES.perigo,
      padding: 6,
      display: 'flex',
    },
    linhaPreco: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 },
    precoTexto: { fontSize: 18, fontWeight: 700, color: CORES.textoPrincipal },
    variacaoBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3,
      fontSize: 11,
      fontWeight: 700,
      borderRadius: RAIO.pill,
      padding: '3px 8px',
    },
    linhaInfo: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginTop: 6,
      fontSize: 13,
      color: CORES.textoSecundario,
    },
    anotacoes: {
      marginTop: 8,
      fontSize: 13,
      color: CORES.textoPrincipal,
      backgroundColor: CORES.fundo,
      borderRadius: RAIO.pequeno,
      padding: 8,
      lineHeight: 1.4,
    },
  };
}
