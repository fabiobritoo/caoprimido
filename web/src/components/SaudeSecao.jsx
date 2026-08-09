import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Scale, HeartPulse, Activity, FileText, X } from 'lucide-react';
import { listarRegistrosSaude, adicionarRegistroSaude, removerRegistroSaude } from '../utils/saude.js';
import { formatarData } from '../utils/constantes.js';
import { RAIO, SOMBRA, criarBotaoPrimario } from '../utils/tema.js';

const HOJE = formatarData(new Date());

function formatarDataExibicao(dataStr) {
  const [ano, mes, dia] = dataStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

export default function SaudeSecao({ CORES }) {
  const estilos = criarEstilos(CORES);
  const [registros, setRegistros] = useState([]);
  const [formularioAberto, setFormularioAberto] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const [data, setData] = useState(HOJE);
  const [peso, setPeso] = useState('');
  const [sistolica, setSistolica] = useState('');
  const [diastolica, setDiastolica] = useState('');
  const [frequencia, setFrequencia] = useState('');
  const [anotacoes, setAnotacoes] = useState('');

  const carregar = async () => {
    setRegistros(await listarRegistrosSaude());
    setCarregando(false);
  };

  useEffect(() => {
    carregar();
  }, []);

  function limparFormulario() {
    setData(HOJE);
    setPeso('');
    setSistolica('');
    setDiastolica('');
    setFrequencia('');
    setAnotacoes('');
  }

  async function salvar() {
    if (!peso && !sistolica && !frequencia && !anotacoes.trim()) {
      alert('Preencha ao menos um campo.');
      return;
    }
    await adicionarRegistroSaude({
      data,
      peso: peso ? Number(peso) : null,
      pressaoSistolica: sistolica ? Number(sistolica) : null,
      pressaoDiastolica: diastolica ? Number(diastolica) : null,
      frequenciaCardiaca: frequencia ? Number(frequencia) : null,
      anotacoes: anotacoes.trim() || null,
    });
    limparFormulario();
    setFormularioAberto(false);
    await carregar();
  }

  async function excluir(id) {
    if (!confirm('Excluir esse registro?')) return;
    setRegistros(await removerRegistroSaude(id));
  }

  const pontosPeso = registros
    .filter((r) => r.peso != null)
    .slice()
    .sort((a, b) => a.data.localeCompare(b.data));

  return (
    <div>
      {pontosPeso.length >= 2 && <GraficoPeso pontos={pontosPeso} CORES={CORES} />}

      {!formularioAberto ? (
        <button onClick={() => setFormularioAberto(true)} style={estilos.botaoNovoRegistro}>
          <Plus size={18} strokeWidth={2.5} />
          Novo registro
        </button>
      ) : (
        <div style={estilos.formulario}>
          <label style={estilos.label}>Data</label>
          <input
            type="date"
            value={data}
            max={HOJE}
            onChange={(e) => setData(e.target.value)}
            style={estilos.input}
          />

          <label style={estilos.label}>
            <Scale size={14} /> Peso (kg)
          </label>
          <input
            type="number"
            step="0.1"
            placeholder="Ex: 72.5"
            value={peso}
            onChange={(e) => setPeso(e.target.value)}
            style={estilos.input}
          />

          <label style={estilos.label}>
            <HeartPulse size={14} /> Pressão arterial (mmHg)
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              placeholder="Sistólica (12)"
              value={sistolica}
              onChange={(e) => setSistolica(e.target.value)}
              style={{ ...estilos.input, flex: 1 }}
            />
            <input
              type="number"
              placeholder="Diastólica (8)"
              value={diastolica}
              onChange={(e) => setDiastolica(e.target.value)}
              style={{ ...estilos.input, flex: 1 }}
            />
          </div>

          <label style={estilos.label}>
            <Activity size={14} /> Frequência cardíaca (bpm)
          </label>
          <input
            type="number"
            placeholder="Ex: 72"
            value={frequencia}
            onChange={(e) => setFrequencia(e.target.value)}
            style={estilos.input}
          />

          <label style={estilos.label}>
            <FileText size={14} /> Anotações
          </label>
          <textarea
            placeholder="Como você está se sentindo, sintomas, observações..."
            value={anotacoes}
            onChange={(e) => setAnotacoes(e.target.value)}
            style={estilos.textarea}
            rows={3}
          />

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button
              onClick={() => {
                limparFormulario();
                setFormularioAberto(false);
              }}
              style={estilos.botaoCancelar}
            >
              <X size={16} /> Cancelar
            </button>
            <button onClick={salvar} style={estilos.botaoSalvar}>
              Salvar registro
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        {!carregando && registros.length === 0 && (
          <div style={estilos.vazioTexto}>Nenhum registro de saúde ainda.</div>
        )}

        {registros.map((r) => (
          <div key={r.id} style={estilos.cartaoRegistro}>
            <div style={estilos.cartaoTopo}>
              <span style={estilos.cartaoData}>{formatarDataExibicao(r.data)}</span>
              <button onClick={() => excluir(r.id)} style={estilos.botaoExcluir}>
                <Trash2 size={15} />
              </button>
            </div>
            <div style={estilos.cartaoValores}>
              {r.peso != null && (
                <span style={estilos.valorItem}>
                  <Scale size={13} /> {r.peso} kg
                </span>
              )}
              {r.pressaoSistolica != null && (
                <span style={estilos.valorItem}>
                  <HeartPulse size={13} /> {r.pressaoSistolica}/{r.pressaoDiastolica || '—'} mmHg
                </span>
              )}
              {r.frequenciaCardiaca != null && (
                <span style={estilos.valorItem}>
                  <Activity size={13} /> {r.frequenciaCardiaca} bpm
                </span>
              )}
            </div>
            {r.anotacoes && <div style={estilos.cartaoAnotacoes}>{r.anotacoes}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatarDataCurta(dataStr) {
  const [, mes, dia] = dataStr.split('-');
  return `${dia}/${mes}`;
}

function GraficoPeso({ pontos, CORES }) {
  const largura = 320;
  const altura = 150;
  const padding = 24;
  const alturaLinha = altura - 34; // reserva espaço embaixo pras datas

  const pesos = pontos.map((p) => p.peso);
  const min = Math.min(...pesos);
  const max = Math.max(...pesos);
  const faixa = max - min || 1;

  const coordX = (i) => padding + (i * (largura - padding * 2)) / Math.max(1, pontos.length - 1);
  const coordY = (peso) => alturaLinha - padding / 2 - ((peso - min) / faixa) * (alturaLinha - padding);

  const linha = pontos.map((p, i) => `${coordX(i)},${coordY(p.peso)}`).join(' ');

  // pra não poluir quando tem muitos pontos, mostra no máximo ~5 datas espaçadas
  // (sempre incluindo a primeira e a última)
  const maximoRotulos = 5;
  const passo = Math.max(1, Math.ceil(pontos.length / maximoRotulos));
  const indicesComRotulo = new Set();
  for (let i = 0; i < pontos.length; i += passo) indicesComRotulo.add(i);
  indicesComRotulo.add(pontos.length - 1);

  return (
    <div
      style={{
        backgroundColor: CORES.fundoCard,
        borderRadius: RAIO.medio,
        padding: 16,
        marginBottom: 16,
        boxShadow: SOMBRA.card,
      }}
    >
      <div style={{ fontSize: 13, color: CORES.textoSecundario, marginBottom: 8 }}>
        Evolução do peso ({pontos[0].peso}kg → {pontos[pontos.length - 1].peso}kg)
      </div>
      <svg width="100%" viewBox={`0 0 ${largura} ${altura}`} preserveAspectRatio="xMidYMid meet">
        <polyline
          points={linha}
          fill="none"
          stroke={CORES.primaria}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {pontos.map((p, i) => (
          <circle key={i} cx={coordX(i)} cy={coordY(p.peso)} r="3.5" fill={CORES.primaria} />
        ))}
        {pontos.map(
          (p, i) =>
            indicesComRotulo.has(i) && (
              <text
                key={`data-${i}`}
                x={coordX(i)}
                y={alturaLinha + 16}
                fontSize="9"
                fill={CORES.textoSecundario}
                textAnchor="middle"
              >
                {formatarDataCurta(p.data)}
              </text>
            )
        )}
      </svg>
    </div>
  );
}

function criarEstilos(CORES) {
  return {
    botaoNovoRegistro: {
      ...criarBotaoPrimario(CORES),
      width: '100%',
    },
    formulario: {
      backgroundColor: CORES.fundoCard,
      borderRadius: RAIO.medio,
      padding: 16,
      boxShadow: SOMBRA.card,
    },
    label: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
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
    botaoSalvar: {
      flex: 2,
      ...criarBotaoPrimario(CORES),
      padding: '12px 16px',
    },
    vazioTexto: { textAlign: 'center', color: CORES.textoSecundario, fontSize: 14, marginTop: 20 },
    cartaoRegistro: {
      backgroundColor: CORES.fundoCard,
      borderRadius: RAIO.pequeno,
      padding: 14,
      marginBottom: 10,
      boxShadow: SOMBRA.card,
    },
    cartaoTopo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    cartaoData: { fontWeight: 700, color: CORES.textoPrincipal, fontSize: 14 },
    botaoExcluir: { background: 'none', border: 'none', color: CORES.perigo, padding: 4 },
    cartaoValores: { display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 },
    valorItem: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      fontSize: 13,
      color: CORES.textoSecundario,
    },
    cartaoAnotacoes: {
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
