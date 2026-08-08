import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adicionarRemedio, atualizarRemedio, listarRemedios } from '../utils/storage.js';
import { UNIDADES, DIAS_SEMANA, formatarData } from '../utils/constantes.js';
import { CORES } from '../utils/tema.js';
import CabecalhoTopo from '../components/CabecalhoTopo.jsx';

const FREQUENCIAS = [
  { valor: 'diaria', rotulo: 'Todos os dias' },
  { valor: 'dias_semana', rotulo: 'Dias específicos da semana' },
  { valor: 'intervalo', rotulo: 'A cada X dias (ex: dias alternados)' },
];

export default function AddMedicineScreen() {
  const navigate = useNavigate();
  const { id: remedioIdEdicao } = useParams();
  const modoEdicao = !!remedioIdEdicao;

  const [carregando, setCarregando] = useState(modoEdicao);
  const [remedioOriginal, setRemedioOriginal] = useState(null);

  const [nome, setNome] = useState('');
  const [unidade, setUnidade] = useState('comprimido');
  const [quantidadePorDose, setQuantidadePorDose] = useState('1');
  const [quantidadeAtual, setQuantidadeAtual] = useState('');
  const [quantidadeMinima, setQuantidadeMinima] = useState('');
  const [horarios, setHorarios] = useState([]);
  const [novoHorario, setNovoHorario] = useState('08:00');
  const [tipoFrequencia, setTipoFrequencia] = useState('diaria');
  const [diasSemanaSelecionados, setDiasSemanaSelecionados] = useState([]);
  const [intervaloDias, setIntervaloDias] = useState('2');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!modoEdicao) return;
    (async () => {
      const lista = await listarRemedios();
      const encontrado = lista.find((r) => r.id === remedioIdEdicao);
      if (encontrado) {
        setRemedioOriginal(encontrado);
        setNome(encontrado.nome);
        setUnidade(encontrado.unidade || 'comprimido');
        setQuantidadePorDose(String(encontrado.quantidadePorDose || 1));
        setQuantidadeAtual(String(encontrado.quantidadeAtual ?? ''));
        setQuantidadeMinima(String(encontrado.quantidadeMinima ?? ''));
        setHorarios(encontrado.horarios || []);
        const freq = encontrado.frequencia || { tipo: 'diaria' };
        setTipoFrequencia(freq.tipo);
        if (freq.tipo === 'dias_semana') setDiasSemanaSelecionados(freq.dias || []);
        if (freq.tipo === 'intervalo') setIntervaloDias(String(freq.intervaloDias || 2));
      }
      setCarregando(false);
    })();
  }, [modoEdicao, remedioIdEdicao]);

  function adicionarHorario() {
    if (!horarios.includes(novoHorario)) {
      setHorarios([...horarios, novoHorario].sort());
    }
  }

  function removerHorario(h) {
    setHorarios(horarios.filter((x) => x !== h));
  }

  function alternarDiaSemana(dia) {
    setDiasSemanaSelecionados((atual) =>
      atual.includes(dia) ? atual.filter((d) => d !== dia) : [...atual, dia].sort()
    );
  }

  function montarFrequencia() {
    const hoje = formatarData(new Date());
    if (tipoFrequencia === 'diaria') return { tipo: 'diaria' };
    if (tipoFrequencia === 'dias_semana') {
      return { tipo: 'dias_semana', dias: diasSemanaSelecionados };
    }
    if (tipoFrequencia === 'intervalo') {
      const dataInicioExistente =
        remedioOriginal?.frequencia?.tipo === 'intervalo'
          ? remedioOriginal.frequencia.dataInicio
          : null;
      return {
        tipo: 'intervalo',
        intervaloDias: Number(intervaloDias) || 2,
        dataInicio: dataInicioExistente || hoje,
        proximaData: hoje,
      };
    }
    return { tipo: 'diaria' };
  }

  async function salvar() {
    if (!nome.trim()) return alert('Informe o nome do remédio.');
    if (horarios.length === 0) return alert('Adicione pelo menos um horário.');
    if (!quantidadeAtual) return alert('Informe a quantidade atual em estoque.');
    if (tipoFrequencia === 'dias_semana' && diasSemanaSelecionados.length === 0) {
      return alert('Selecione ao menos um dia da semana.');
    }

    setSalvando(true);

    const dadosRemedio = {
      nome: nome.trim(),
      unidade,
      quantidadePorDose: Number(quantidadePorDose) || 1,
      dosagem: `${quantidadePorDose} ${unidade}`,
      horarios,
      frequencia: montarFrequencia(),
      quantidadeAtual: Number(quantidadeAtual),
      quantidadeMinima: Number(quantidadeMinima) || 5,
    };

    if (modoEdicao) {
      await atualizarRemedio(remedioIdEdicao, dadosRemedio);
    } else {
      await adicionarRemedio({ id: Date.now().toString(), ...dadosRemedio });
    }

    setSalvando(false);
    navigate(-1);
  }

  if (carregando) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Carregando...</div>;
  }

  return (
    <div style={{ minHeight: '100%', backgroundColor: '#fff', paddingBottom: 40 }}>
      <CabecalhoTopo titulo={modoEdicao ? 'Editar Remédio' : 'Novo Remédio'} mostrarVoltar />

      <div style={{ padding: 20 }}>
        <label style={estilos.label}>Nome do remédio</label>
        <input
          style={estilos.input}
          placeholder="Ex: Losartana"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />

        <label style={estilos.label}>Unidade de medida</label>
        <div style={estilos.linhaChips}>
          {UNIDADES.map((u) => (
            <button
              key={u.valor}
              onClick={() => setUnidade(u.valor)}
              style={{
                ...estilos.chip,
                ...(unidade === u.valor ? estilos.chipSelecionado : {}),
              }}
            >
              {u.rotulo}
            </button>
          ))}
        </div>

        <label style={estilos.label}>Quantidade por dose</label>
        <input
          style={estilos.input}
          type="number"
          placeholder="Ex: 1"
          value={quantidadePorDose}
          onChange={(e) => setQuantidadePorDose(e.target.value)}
        />

        <label style={estilos.label}>Horários do alarme</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="time"
            value={novoHorario}
            onChange={(e) => setNovoHorario(e.target.value)}
            style={{ ...estilos.input, flex: 1 }}
          />
          <button onClick={adicionarHorario} style={estilos.botaoSecundario}>
            + Adicionar
          </button>
        </div>
        <div style={estilos.linhaChips}>
          {horarios.map((h) => (
            <button key={h} onClick={() => removerHorario(h)} style={estilos.chipHorario}>
              {h} ✕
            </button>
          ))}
        </div>

        <label style={estilos.label}>Frequência</label>
        {FREQUENCIAS.map((f) => (
          <button
            key={f.valor}
            onClick={() => setTipoFrequencia(f.valor)}
            style={estilos.linhaRadio}
          >
            <span
              style={{
                ...estilos.radioCirculo,
                ...(tipoFrequencia === f.valor ? estilos.radioCirculoSelecionado : {}),
              }}
            />
            <span style={{ color: CORES.textoPrincipal }}>{f.rotulo}</span>
          </button>
        ))}

        {tipoFrequencia === 'dias_semana' && (
          <div style={estilos.linhaChips}>
            {DIAS_SEMANA.map((d) => (
              <button
                key={d.valor}
                onClick={() => alternarDiaSemana(d.valor)}
                style={{
                  ...estilos.diaCirculo,
                  ...(diasSemanaSelecionados.includes(d.valor)
                    ? estilos.diaCirculoSelecionado
                    : {}),
                }}
              >
                {d.curto}
              </button>
            ))}
          </div>
        )}

        {tipoFrequencia === 'intervalo' && (
          <>
            <div style={estilos.subLabel}>A cada quantos dias? (2 = dias alternados)</div>
            <input
              style={estilos.input}
              type="number"
              value={intervaloDias}
              onChange={(e) => setIntervaloDias(e.target.value)}
            />
          </>
        )}

        <label style={estilos.label}>Quantidade atual em estoque</label>
        <input
          style={estilos.input}
          type="number"
          placeholder="Ex: 30"
          value={quantidadeAtual}
          onChange={(e) => setQuantidadeAtual(e.target.value)}
        />

        <label style={estilos.label}>Avisar quando restar (quantidade mínima)</label>
        <input
          style={estilos.input}
          type="number"
          placeholder="Ex: 5"
          value={quantidadeMinima}
          onChange={(e) => setQuantidadeMinima(e.target.value)}
        />

        <button onClick={salvar} disabled={salvando} style={estilos.botaoSalvar}>
          {salvando ? 'Salvando...' : modoEdicao ? 'Salvar alterações' : 'Salvar remédio'}
        </button>
      </div>
    </div>
  );
}

const estilos = {
  label: {
    display: 'block',
    fontWeight: 600,
    marginTop: 16,
    marginBottom: 6,
    color: CORES.textoPrincipal,
  },
  subLabel: { fontSize: 13, color: CORES.textoSecundario, marginBottom: 6 },
  input: {
    width: '100%',
    border: `1px solid ${CORES.borda}`,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  botaoSecundario: {
    border: `1px solid ${CORES.primaria}`,
    borderRadius: 8,
    padding: '0 16px',
    color: CORES.primaria,
    background: 'none',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  linhaChips: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    border: `1px solid ${CORES.borda}`,
    borderRadius: 16,
    padding: '6px 12px',
    background: '#fff',
    color: '#444',
    fontSize: 14,
  },
  chipSelecionado: { backgroundColor: CORES.primaria, borderColor: CORES.primaria, color: '#fff' },
  chipHorario: {
    backgroundColor: CORES.primariaClara,
    border: 'none',
    borderRadius: 16,
    padding: '6px 12px',
    color: CORES.primariaEscura,
    fontWeight: 600,
  },
  linhaRadio: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 0',
    background: 'none',
    border: 'none',
    width: '100%',
    textAlign: 'left',
  },
  radioCirculo: {
    width: 20,
    height: 20,
    borderRadius: 10,
    border: '2px solid #AAA',
    display: 'inline-block',
  },
  radioCirculoSelecionado: { borderColor: CORES.primaria, backgroundColor: CORES.primaria },
  diaCirculo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    border: `1px solid ${CORES.borda}`,
    background: '#fff',
    color: '#444',
    fontWeight: 600,
  },
  diaCirculoSelecionado: { backgroundColor: CORES.primaria, borderColor: CORES.primaria, color: '#fff' },
  botaoSalvar: {
    width: '100%',
    backgroundColor: CORES.primaria,
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: 16,
    fontWeight: 700,
    fontSize: 16,
    marginTop: 30,
  },
};
