import React, { useState, useEffect } from 'react';
import { Plus, Trash2, CalendarClock, MapPin, User, X } from 'lucide-react';
import { listarConsultas, adicionarConsulta, removerConsulta } from '../utils/consultas.js';
import { formatarData } from '../utils/constantes.js';
import { RAIO, SOMBRA, criarBotaoPrimario } from '../utils/tema.js';
import { useTema } from '../utils/ThemeContext.jsx';
import CabecalhoTopo from '../components/CabecalhoTopo.jsx';

const HOJE = formatarData(new Date());

function formatarDataExibicao(dataStr) {
  const [ano, mes, dia] = dataStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

export default function ConsultasScreen() {
  const { CORES } = useTema();
  const estilos = criarEstilos(CORES);
  const [consultas, setConsultas] = useState([]);
  const [formularioAberto, setFormularioAberto] = useState(false);

  const [data, setData] = useState(HOJE);
  const [hora, setHora] = useState('09:00');
  const [medico, setMedico] = useState('');
  const [local, setLocal] = useState('');
  const [anotacoes, setAnotacoes] = useState('');

  const carregar = async () => setConsultas(await listarConsultas());

  useEffect(() => {
    carregar();
  }, []);

  function limpar() {
    setData(HOJE);
    setHora('09:00');
    setMedico('');
    setLocal('');
    setAnotacoes('');
  }

  async function salvar() {
    if (!medico.trim()) {
      alert('Informe ao menos o nome do médico ou especialidade.');
      return;
    }
    await adicionarConsulta({
      data,
      hora,
      medico: medico.trim(),
      local: local.trim() || null,
      anotacoes: anotacoes.trim() || null,
    });
    limpar();
    setFormularioAberto(false);
    await carregar();
  }

  async function excluir(id) {
    if (!confirm('Excluir essa consulta?')) return;
    setConsultas(await removerConsulta(id));
  }

  const hojeAgora = new Date();
  const consultasFuturas = consultas.filter(
    (c) => new Date(`${c.data}T${c.hora || '23:59'}:00`) >= hojeAgora
  );
  const consultasPassadas = consultas.filter(
    (c) => new Date(`${c.data}T${c.hora || '23:59'}:00`) < hojeAgora
  );

  function renderizarConsulta(c) {
    return (
      <div key={c.id} style={estilos.cartao}>
        <div style={estilos.cartaoTopo}>
          <div style={estilos.dataBox}>
            <CalendarClock size={16} color={CORES.primaria} />
            <span style={estilos.dataTexto}>
              {formatarDataExibicao(c.data)} {c.hora && `às ${c.hora}`}
            </span>
          </div>
          <button onClick={() => excluir(c.id)} style={estilos.botaoExcluir}>
            <Trash2 size={15} />
          </button>
        </div>
        <div style={estilos.linhaInfo}>
          <User size={13} color={CORES.textoSecundario} />
          <span>{c.medico}</span>
        </div>
        {c.local && (
          <div style={estilos.linhaInfo}>
            <MapPin size={13} color={CORES.textoSecundario} />
            <span>{c.local}</span>
          </div>
        )}
        {c.anotacoes && <div style={estilos.anotacoes}>{c.anotacoes}</div>}
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100%', backgroundColor: CORES.fundo, paddingBottom: 40 }}>
      <CabecalhoTopo titulo="Consultas médicas" mostrarVoltar />

      <div style={{ padding: 16 }}>
        {!formularioAberto ? (
          <button onClick={() => setFormularioAberto(true)} style={estilos.botaoNovo}>
            <Plus size={18} strokeWidth={2.5} />
            Nova consulta
          </button>
        ) : (
          <div style={estilos.formulario}>
            <label style={estilos.label}>Data</label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              style={estilos.input}
            />

            <label style={estilos.label}>Horário</label>
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              style={estilos.input}
            />

            <label style={estilos.label}>Médico / especialidade</label>
            <input
              type="text"
              placeholder="Ex: Dra. Ana — Cardiologista"
              value={medico}
              onChange={(e) => setMedico(e.target.value)}
              style={estilos.input}
            />

            <label style={estilos.label}>Local (opcional)</label>
            <input
              type="text"
              placeholder="Ex: Clínica São Lucas"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              style={estilos.input}
            />

            <label style={estilos.label}>Anotações (opcional)</label>
            <textarea
              placeholder="Levar exames anteriores, jejum, etc."
              value={anotacoes}
              onChange={(e) => setAnotacoes(e.target.value)}
              style={estilos.textarea}
              rows={3}
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
                Salvar consulta
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          {consultasFuturas.length === 0 && consultasPassadas.length === 0 && (
            <div style={estilos.vazioTexto}>Nenhuma consulta agendada ainda.</div>
          )}

          {consultasFuturas.length > 0 && (
            <>
              <div style={estilos.secaoTitulo}>Próximas</div>
              {consultasFuturas.map(renderizarConsulta)}
            </>
          )}

          {consultasPassadas.length > 0 && (
            <>
              <div style={{ ...estilos.secaoTitulo, marginTop: 20, opacity: 0.7 }}>Anteriores</div>
              {consultasPassadas.map(renderizarConsulta)}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function criarEstilos(CORES) {
  return {
    botaoNovo: { ...criarBotaoPrimario(CORES), width: '100%' },
    formulario: {
      backgroundColor: CORES.fundoCard,
      borderRadius: RAIO.medio,
      padding: 16,
      boxShadow: SOMBRA.card,
    },
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
    secaoTitulo: { fontWeight: 700, fontSize: 15, color: CORES.textoPrincipal, marginBottom: 10 },
    vazioTexto: { textAlign: 'center', color: CORES.textoSecundario, fontSize: 14, marginTop: 20 },
    cartao: {
      backgroundColor: CORES.fundoCard,
      borderRadius: RAIO.pequeno,
      padding: 14,
      marginBottom: 10,
      boxShadow: SOMBRA.card,
    },
    cartaoTopo: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
    dataBox: { display: 'flex', alignItems: 'center', gap: 6 },
    dataTexto: { fontWeight: 700, color: CORES.textoPrincipal, fontSize: 14 },
    botaoExcluir: { background: 'none', border: 'none', color: CORES.perigo, padding: 4 },
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
