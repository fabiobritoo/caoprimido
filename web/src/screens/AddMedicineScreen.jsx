import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Plus,
  X,
  Clock,
  Pill,
  Droplet,
  FlaskConical,
  Syringe,
  Package,
  Scale,
  CalendarDays,
  Repeat,
  CalendarClock,
  Save,
  Tag,
  TrendingUp,
} from 'lucide-react';
import { adicionarRemedio, atualizarRemedio, listarRemedios, obterIdDispositivo } from '../utils/storage.js';
import { sincronizarNotificacoesServidor } from '../utils/notifications.js';
import {
  UNIDADES,
  DIAS_SEMANA,
  formatarData,
  somarDias,
  rotuloUnidade,
  doseDoDia,
  calcularFasesComDatas,
} from '../utils/constantes.js';
import { adicionarCompra } from '../utils/compras.js';
import { RAIO, criarBotaoPrimario } from '../utils/tema.js';
import { useTema } from '../utils/ThemeContext.jsx';
import CabecalhoTopo from '../components/CabecalhoTopo.jsx';

function formatarDataExibicao(dataStr) {
  if (!dataStr) return '';
  const [ano, mes, dia] = dataStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

const ICONE_UNIDADE = {
  comprimido: Pill,
  capsula: Pill,
  gota: Droplet,
  ml: FlaskConical,
  grama: Scale,
  injecao: Syringe,
  sache: Package,
  unidade: Package,
};

// aceita "0,25" e "0.25"
function paraNumero(valor) {
  return Number(String(valor ?? '').replace(',', '.'));
}

// 0.25 -> "0,25"
function formatarDose(n) {
  return String(n).replace('.', ',');
}

// duração digitada na fase -> total de dias (ou null se inválida)
function diasDaFase(fase) {
  const n = Math.floor(paraNumero(fase.duracao));
  if (!(n > 0)) return null;
  return fase.tipo === 'semanas' ? n * 7 : n;
}

const FASES_PADRAO = [
  { dose: '', duracao: '2', tipo: 'semanas' },
  { dose: '', duracao: '', tipo: 'semanas' },
];

const FREQUENCIAS = [
  { valor: 'diaria', rotulo: 'Todos os dias', icone: CalendarDays },
  { valor: 'dias_semana', rotulo: 'Dias específicos da semana', icone: CalendarClock },
  { valor: 'intervalo', rotulo: 'A cada X dias (dias alternados)', icone: Repeat },
];

export default function AddMedicineScreen() {
  const { CORES } = useTema();
  const estilos = criarEstilos(CORES);
  const navigate = useNavigate();
  const { id: remedioIdEdicao } = useParams();
  const modoEdicao = !!remedioIdEdicao;

  const [carregando, setCarregando] = useState(modoEdicao);
  const [remedioOriginal, setRemedioOriginal] = useState(null);

  const [nome, setNome] = useState('');
  const [unidade, setUnidade] = useState('comprimido');
  const [quantidadePorDose, setQuantidadePorDose] = useState('1');
  // fases de dose: ex. 0,25 por 2 semanas -> 0,5 por 4 semanas -> 1 daí em diante
  const [usarFases, setUsarFases] = useState(false);
  const [fases, setFases] = useState(FASES_PADRAO);
  const [quantidadeAtual, setQuantidadeAtual] = useState('');
  const [quantidadeMinima, setQuantidadeMinima] = useState('');
  const [horarios, setHorarios] = useState([]);
  const [novoHorario, setNovoHorario] = useState('08:00');
  const [tipoFrequencia, setTipoFrequencia] = useState('diaria');
  const [diasSemanaSelecionados, setDiasSemanaSelecionados] = useState([]);
  const [intervaloDias, setIntervaloDias] = useState('2');
  const [dataInicio, setDataInicio] = useState(formatarData(new Date()));
  const [dataInicioEraDesconhecida, setDataInicioEraDesconhecida] = useState(false);
  const [dataInicioTocada, setDataInicioTocada] = useState(false);
  const [terminoAtivo, setTerminoAtivo] = useState(false);
  const [dataTermino, setDataTermino] = useState(formatarData(new Date()));
  const [modoTermino, setModoTermino] = useState('dias'); // 'dias' ou 'data'
  const [quantidadeDias, setQuantidadeDias] = useState('7');
  const [precoInicial, setPrecoInicial] = useState('');
  const [localInicial, setLocalInicial] = useState('');
  const [quantidadeInicialCompra, setQuantidadeInicialCompra] = useState('');
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
        if (Array.isArray(encontrado.fases) && encontrado.fases.length >= 2) {
          setUsarFases(true);
          setFases(
            encontrado.fases.map((f, i, todas) => {
              const dose = String(f.quantidadePorDose).replace('.', ',');
              if (i === todas.length - 1 || !f.dias) return { dose, duracao: '', tipo: 'semanas' };
              return f.dias % 7 === 0
                ? { dose, duracao: String(f.dias / 7), tipo: 'semanas' }
                : { dose, duracao: String(f.dias), tipo: 'dias' };
            })
          );
        }
        setQuantidadeAtual(String(encontrado.quantidadeAtual ?? ''));
        setQuantidadeMinima(String(encontrado.quantidadeMinima ?? ''));
        setHorarios(encontrado.horarios || []);
        const freq = encontrado.frequencia || { tipo: 'diaria' };
        setTipoFrequencia(freq.tipo);
        if (freq.tipo === 'dias_semana') setDiasSemanaSelecionados(freq.dias || []);
        if (freq.tipo === 'intervalo') setIntervaloDias(String(freq.intervaloDias || 2));
        if (encontrado.dataInicio) {
          setDataInicio(encontrado.dataInicio);
        } else {
          // remédio antigo, cadastrado antes desse campo existir — não temos
          // a data real de início, então NÃO vamos gravar "hoje" por engano
          // se a pessoa só editar outra coisa e salvar
          setDataInicioEraDesconhecida(true);
        }
        if (encontrado.dataTermino) {
          setTerminoAtivo(true);
          setDataTermino(encontrado.dataTermino);
          setModoTermino('data'); // ao editar um remédio já salvo, mostra a data exata em vez de recalcular por dias
        }
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

  // quando o modo é "por quantidade de dias", recalcula a data de término
  // automaticamente sempre que a quantidade ou a data de início mudar —
  // "tomar por 7 dias" a partir de hoje termina 6 dias depois (conta o
  // próprio dia de início como o 1º dia)
  useEffect(() => {
    if (!terminoAtivo || modoTermino !== 'dias') return;
    const dias = Number(quantidadeDias);
    if (!dias || dias < 1) return;
    setDataTermino(somarDias(dataInicio, dias - 1));
  }, [terminoAtivo, modoTermino, quantidadeDias, dataInicio]);

  function alternarFases() {
    if (!usarFases) {
      // ao ligar, a dose já digitada vira a dose da fase 1
      setFases((atual) =>
        atual.map((f, i) => (i === 0 && !f.dose ? { ...f, dose: String(quantidadePorDose || '').replace('.', ',') } : f))
      );
    }
    setUsarFases(!usarFases);
  }

  function atualizarFase(indice, campos) {
    setFases((atual) => atual.map((f, i) => (i === indice ? { ...f, ...campos } : f)));
  }

  function adicionarFase() {
    setFases((atual) => [
      // a antiga "última fase" passa a ter duração (sugere 4 semanas)
      ...atual.map((f, i) =>
        i === atual.length - 1 ? { ...f, duracao: f.duracao || '4', tipo: f.tipo || 'semanas' } : f
      ),
      { dose: '', duracao: '', tipo: 'semanas' },
    ]);
  }

  function removerFase(indice) {
    setFases((atual) => (atual.length > 2 ? atual.filter((_, i) => i !== indice) : atual));
  }

  // fases no formato salvo: [{ quantidadePorDose, dias }], última com dias null
  function fasesParaSalvar() {
    return fases.map((f, i) => ({
      quantidadePorDose: paraNumero(f.dose),
      dias: i === fases.length - 1 ? null : diasDaFase(f),
    }));
  }

  function montarFrequencia() {
    if (tipoFrequencia === 'diaria') return { tipo: 'diaria' };
    if (tipoFrequencia === 'dias_semana') {
      return { tipo: 'dias_semana', dias: diasSemanaSelecionados };
    }
    if (tipoFrequencia === 'intervalo') {
      return {
        tipo: 'intervalo',
        intervaloDias: Number(intervaloDias) || 2,
        // usa a MESMA data de início escolhida no campo "Duração",
        // pra não ter duas datas de início conflitantes pro mesmo remédio
        dataInicio,
        proximaData: dataInicio,
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
    if (terminoAtivo && dataTermino < dataInicio) {
      return alert('A data de término não pode ser antes da data de início.');
    }
    if (usarFases) {
      if (fases.length < 2) return alert('Use pelo menos 2 fases (ou desligue as fases de dose).');
      for (let i = 0; i < fases.length; i++) {
        if (!(paraNumero(fases[i].dose) > 0)) return alert(`Informe a dose da fase ${i + 1}.`);
        if (i < fases.length - 1 && !diasDaFase(fases[i])) {
          return alert(`Informe a duração da fase ${i + 1}.`);
        }
      }
    }

    setSalvando(true);

    // se a data de início era desconhecida (remédio antigo) e a pessoa não
    // mexeu nela agora, não grava "hoje" por engano — isso apagaria o
    // histórico de adesão desse remédio sem querer. Com fases a data de início
    // é obrigatória (é de onde as fases contam), então grava sempre.
    const dataInicioParaSalvar =
      !usarFases && dataInicioEraDesconhecida && !dataInicioTocada ? null : dataInicio;

    // com fases, "quantidade por dose" guarda a dose que vale hoje (o resto do
    // app calcula a dose de cada dia a partir de "fases")
    const fasesSalvas = usarFases ? fasesParaSalvar() : null;
    const dosePrincipal = usarFases
      ? doseDoDia({ fases: fasesSalvas, dataInicio: dataInicioParaSalvar, quantidadePorDose: 1 }, formatarData(new Date()))
      : paraNumero(quantidadePorDose) || 1;

    const dadosRemedio = {
      nome: nome.trim(),
      unidade,
      quantidadePorDose: dosePrincipal,
      dosagem: `${dosePrincipal} ${unidade}`,
      fases: fasesSalvas,
      horarios,
      frequencia: montarFrequencia(),
      quantidadeAtual: Number(quantidadeAtual),
      quantidadeMinima: Number(quantidadeMinima) || 5,
      dataInicio: dataInicioParaSalvar,
      dataTermino: terminoAtivo ? dataTermino : null,
    };

    if (modoEdicao) {
      await atualizarRemedio(remedioIdEdicao, dadosRemedio);
    } else {
      const novoId = Date.now().toString();
      await adicionarRemedio({ id: novoId, ...dadosRemedio });

      // se a pessoa já preencheu o preço na hora do cadastro, registra a
      // primeira compra automaticamente — evita ter que ir numa segunda
      // tela só pra isso logo depois de criar o remédio
      if (precoInicial && Number(precoInicial) > 0) {
        await adicionarCompra({
          remedioId: novoId,
          data: dataInicio,
          preco: Number(precoInicial),
          local: localInicial.trim() || null,
          quantidade: quantidadeInicialCompra ? Number(quantidadeInicialCompra) : null,
          anotacoes: null,
        });
      }
    }

    const listaAtualizada = await listarRemedios();
    await sincronizarNotificacoesServidor(obterIdDispositivo(), listaAtualizada);

    setSalvando(false);
    navigate(-1);
  }

  if (carregando) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Carregando...</div>;
  }

  return (
    <div style={{ minHeight: '100%', backgroundColor: CORES.fundoCard, paddingBottom: 40 }}>
      <CabecalhoTopo titulo={modoEdicao ? 'Editar Remédio' : 'Novo Remédio'} mostrarVoltar />

      <div style={{ padding: 20 }}>
        {modoEdicao && (
          <button
            onClick={() => navigate(`/remedio/${remedioIdEdicao}/compras`)}
            style={estilos.linkPrecos}
          >
            <Tag size={15} strokeWidth={2.3} />
            Ver histórico de preços deste remédio
          </button>
        )}

        <label style={estilos.label}>Nome do remédio</label>
        <input
          style={estilos.input}
          placeholder="Ex: Losartana"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />

        <label style={estilos.label}>Unidade de medida</label>
        <div style={estilos.linhaChips}>
          {UNIDADES.map((u) => {
            const IconeU = ICONE_UNIDADE[u.valor] || Pill;
            const selecionado = unidade === u.valor;
            return (
              <button
                key={u.valor}
                onClick={() => setUnidade(u.valor)}
                style={{ ...estilos.chip, ...(selecionado ? estilos.chipSelecionado : {}) }}
              >
                <IconeU size={14} strokeWidth={2.3} />
                {u.rotulo}
              </button>
            );
          })}
        </div>

        <div style={estilos.linhaToggleTermino}>
          <span style={{ fontWeight: 600, color: CORES.textoPrincipal, display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={15} strokeWidth={2.3} /> Dose muda com o tempo (fases)
          </span>
          <button
            onClick={alternarFases}
            style={{
              ...estilos.toggle,
              backgroundColor: usarFases ? CORES.primaria : CORES.borda,
            }}
          >
            <div
              style={{
                ...estilos.toggleBolinha,
                transform: usarFases ? 'translateX(20px)' : 'translateX(0)',
              }}
            />
          </button>
        </div>

        {!usarFases && (
          <>
            <label style={estilos.label}>Quantidade por dose</label>
            <input
              style={estilos.input}
              type="number"
              step="any"
              placeholder="Ex: 1"
              value={quantidadePorDose}
              onChange={(e) => setQuantidadePorDose(e.target.value)}
            />
          </>
        )}

        {usarFases && (
          <div>
            <div style={estilos.subLabel}>
              Ex.: 0,25 por 2 semanas, depois 0,5 por 4 semanas, depois 1 daí em diante. As fases
              contam a partir da data de início (em "Duração", abaixo):{' '}
              <strong>{formatarDataExibicao(dataInicio)}</strong>. A dose é na unidade do estoque
              ({rotuloUnidade(unidade).toLowerCase()}).
            </div>

            {fases.map((f, i) => {
              const ultima = i === fases.length - 1;
              return (
                <div key={i} style={estilos.cartaoFase}>
                  <div style={estilos.cabecalhoFase}>
                    <span style={{ fontWeight: 700, color: CORES.primariaEscura }}>
                      Fase {i + 1}
                      {ultima ? ' · daí em diante' : ''}
                    </span>
                    {fases.length > 2 && (
                      <button onClick={() => removerFase(i)} style={estilos.botaoRemoverFase} aria-label="Remover fase">
                        <X size={15} strokeWidth={2.5} />
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={estilos.subLabel}>Dose</div>
                      <input
                        style={estilos.input}
                        type="text"
                        inputMode="decimal"
                        placeholder="Ex: 0,25"
                        value={f.dose}
                        onChange={(e) => atualizarFase(i, { dose: e.target.value })}
                      />
                    </div>
                    {!ultima && (
                      <>
                        <div style={{ flex: 1 }}>
                          <div style={estilos.subLabel}>Duração</div>
                          <input
                            style={estilos.input}
                            type="text"
                            inputMode="numeric"
                            placeholder="Ex: 2"
                            value={f.duracao}
                            onChange={(e) => atualizarFase(i, { duracao: e.target.value.replace(/[^0-9]/g, '') })}
                          />
                        </div>
                        <div style={{ flex: 1.3 }}>
                          <div style={estilos.subLabel}>&nbsp;</div>
                          <select
                            style={{ ...estilos.input, paddingLeft: 8, paddingRight: 4 }}
                            value={f.tipo}
                            onChange={(e) => atualizarFase(i, { tipo: e.target.value })}
                          >
                            <option value="semanas">semanas</option>
                            <option value="dias">dias</option>
                          </select>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            <button onClick={adicionarFase} style={{ ...estilos.botaoSecundario, marginTop: 10, padding: '10px 16px' }}>
              <Plus size={16} strokeWidth={2.5} />
              Adicionar fase
            </button>

            <div style={estilos.previaFases}>
              <div style={{ fontWeight: 700, marginBottom: 6, color: CORES.textoPrincipal }}>Resumo</div>
              {calcularFasesComDatas(
                fases.map((f, i) => ({
                  quantidadePorDose: paraNumero(f.dose) || 0,
                  dias: i === fases.length - 1 ? null : diasDaFase(f),
                })),
                dataInicio
              ).map((p, i) => (
                <div key={i} style={estilos.subLabel}>
                  <strong>Fase {i + 1}:</strong> {p.quantidadePorDose ? formatarDose(p.quantidadePorDose) : '?'}{' '}
                  {rotuloUnidade(unidade).toLowerCase()} ·{' '}
                  {p.fim
                    ? `${formatarDataExibicao(p.inicio)} a ${formatarDataExibicao(p.fim)}`
                    : `a partir de ${formatarDataExibicao(p.inicio)}`}
                </div>
              ))}
            </div>
          </div>
        )}

        <label style={estilos.label}>Horários do alarme</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="time"
            value={novoHorario}
            onChange={(e) => setNovoHorario(e.target.value)}
            style={{ ...estilos.input, flex: 1 }}
          />
          <button onClick={adicionarHorario} style={estilos.botaoSecundario}>
            <Plus size={16} strokeWidth={2.5} />
            Adicionar
          </button>
        </div>
        <div style={estilos.linhaChips}>
          {horarios.map((h) => (
            <button key={h} onClick={() => removerHorario(h)} style={estilos.chipHorario}>
              <Clock size={13} strokeWidth={2.3} />
              {h}
              <X size={13} strokeWidth={2.5} />
            </button>
          ))}
        </div>

        <label style={estilos.label}>Frequência</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {FREQUENCIAS.map((f) => {
            const IconeF = f.icone;
            const selecionado = tipoFrequencia === f.valor;
            return (
              <button
                key={f.valor}
                onClick={() => setTipoFrequencia(f.valor)}
                style={{
                  ...estilos.cartaoFrequencia,
                  ...(selecionado ? estilos.cartaoFrequenciaSelecionado : {}),
                }}
              >
                <div
                  style={{
                    ...estilos.iconeFrequenciaCirculo,
                    ...(selecionado ? estilos.iconeFrequenciaCirculoSelecionado : {}),
                  }}
                >
                  <IconeF size={18} strokeWidth={2.2} color={selecionado ? '#fff' : CORES.primaria} />
                </div>
                <span
                  style={{
                    color: selecionado ? CORES.primariaEscura : CORES.textoPrincipal,
                    fontWeight: selecionado ? 700 : 500,
                    fontSize: 14,
                  }}
                >
                  {f.rotulo}
                </span>
              </button>
            );
          })}
        </div>

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

        <div style={estilos.divisor} />
        <label style={estilos.label}>
          <CalendarClock size={14} /> Duração
        </label>

        <div style={estilos.subLabel}>Data de início</div>
        <input
          type="date"
          value={dataInicio}
          onChange={(e) => {
            setDataInicio(e.target.value);
            setDataInicioTocada(true);
          }}
          style={estilos.input}
        />

        <div style={estilos.linhaToggleTermino}>
          <span style={{ fontWeight: 600, color: CORES.textoPrincipal }}>Definir término</span>
          <button
            onClick={() => setTerminoAtivo(!terminoAtivo)}
            style={{
              ...estilos.toggle,
              backgroundColor: terminoAtivo ? CORES.primaria : CORES.borda,
            }}
          >
            <div
              style={{
                ...estilos.toggleBolinha,
                transform: terminoAtivo ? 'translateX(20px)' : 'translateX(0)',
              }}
            />
          </button>
        </div>

        {terminoAtivo ? (
          <>
            <div style={estilos.seletorModoTermino}>
              <button
                onClick={() => setModoTermino('dias')}
                style={{
                  ...estilos.botaoModoTermino,
                  ...(modoTermino === 'dias' ? estilos.botaoModoTerminoAtivo : {}),
                }}
              >
                Por dias
              </button>
              <button
                onClick={() => setModoTermino('data')}
                style={{
                  ...estilos.botaoModoTermino,
                  ...(modoTermino === 'data' ? estilos.botaoModoTerminoAtivo : {}),
                }}
              >
                Data específica
              </button>
            </div>

            {modoTermino === 'dias' ? (
              <>
                <div style={estilos.subLabel}>Tomar por quantos dias?</div>
                <input
                  type="number"
                  min="1"
                  placeholder="Ex: 7"
                  value={quantidadeDias}
                  onChange={(e) => setQuantidadeDias(e.target.value)}
                  style={estilos.input}
                />
                <div style={estilos.subLabel}>
                  Termina em {formatarDataExibicao(dataTermino)}
                </div>
              </>
            ) : (
              <input
                type="date"
                value={dataTermino}
                min={dataInicio}
                onChange={(e) => setDataTermino(e.target.value)}
                style={estilos.input}
              />
            )}
          </>
        ) : (
          <div style={estilos.subLabel}>
            Início em {formatarDataExibicao(dataInicio)}, sem data de término.
          </div>
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

        {!modoEdicao && (
          <>
            <div style={estilos.divisor} />
            <label style={estilos.label}>
              <Tag size={14} /> Já sabe o preço? (opcional)
            </label>
            <div style={estilos.subLabel}>
              Se preencher, já salva como a primeira compra no histórico de preços.
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={estilos.subLabel}>Preço pago (R$)</label>
                <input
                  style={estilos.input}
                  type="number"
                  step="0.01"
                  placeholder="Ex: 45.90"
                  value={precoInicial}
                  onChange={(e) => setPrecoInicial(e.target.value)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={estilos.subLabel}>Quantidade comprada</label>
                <input
                  style={estilos.input}
                  type="number"
                  placeholder={`Ex: 30 (${rotuloUnidade(unidade).toLowerCase()})`}
                  value={quantidadeInicialCompra}
                  onChange={(e) => setQuantidadeInicialCompra(e.target.value)}
                />
              </div>
            </div>

            <label style={estilos.subLabel}>Local / farmácia</label>
            <input
              style={estilos.input}
              placeholder="Ex: Drogasil, Amazon..."
              value={localInicial}
              onChange={(e) => setLocalInicial(e.target.value)}
            />
          </>
        )}

        <button onClick={salvar} disabled={salvando} style={estilos.botaoSalvar}>
          <Save size={18} strokeWidth={2.3} />
          {salvando ? 'Salvando...' : modoEdicao ? 'Salvar alterações' : 'Salvar remédio'}
        </button>
      </div>
    </div>
  );
}

function criarEstilos(CORES) {
  return {
  label: {
    display: 'block',
    fontWeight: 600,
    marginTop: 18,
    marginBottom: 8,
    color: CORES.textoPrincipal,
  },
  subLabel: { fontSize: 13, color: CORES.textoSecundario, marginBottom: 6 },
  divisor: { height: 1, backgroundColor: CORES.borda, margin: '22px 0 4px' },
  linhaToggleTermino: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 8,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    border: 'none',
    padding: 2,
    display: 'flex',
    alignItems: 'center',
  },
  toggleBolinha: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    transition: 'transform 0.2s',
  },
  seletorModoTermino: {
    display: 'flex',
    gap: 8,
    marginTop: 10,
    marginBottom: 10,
  },
  botaoModoTermino: {
    flex: 1,
    padding: '9px 0',
    borderRadius: RAIO.pill,
    border: `1.5px solid ${CORES.borda}`,
    backgroundColor: CORES.fundoCard,
    color: CORES.textoSecundario,
    fontWeight: 600,
    fontSize: 13,
  },
  botaoModoTerminoAtivo: {
    borderColor: CORES.primaria,
    backgroundColor: CORES.primariaClara,
    color: CORES.primariaEscura,
  },
  cartaoFase: {
    marginTop: 10,
    padding: 12,
    borderRadius: RAIO.medio,
    borderWidth: 1.5,
    borderStyle: 'solid',
    borderColor: CORES.borda,
    backgroundColor: CORES.fundoCard,
  },
  cabecalhoFase: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    fontSize: 14,
  },
  botaoRemoverFase: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: RAIO.pill,
    border: 'none',
    backgroundColor: CORES.primariaClara,
    color: CORES.primariaEscura,
  },
  previaFases: {
    marginTop: 14,
    padding: 12,
    borderRadius: RAIO.medio,
    backgroundColor: CORES.primariaClara,
    fontSize: 13,
  },
  linkPrecos: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
    backgroundColor: CORES.primariaClara,
    color: CORES.primariaEscura,
    border: 'none',
    borderRadius: RAIO.medio,
    padding: '10px 14px',
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 18,
  },
  input: {
    width: '100%',
    border: `1.5px solid ${CORES.borda}`,
    borderRadius: RAIO.pequeno,
    padding: 12,
    fontSize: 16,
  },
  botaoSecundario: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    border: `1.5px solid ${CORES.primaria}`,
    borderRadius: RAIO.pequeno,
    padding: '0 16px',
    color: CORES.primaria,
    background: CORES.fundoCard,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  linhaChips: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderStyle: 'solid',
    borderColor: CORES.borda,
    borderRadius: RAIO.pill,
    padding: '7px 14px',
    backgroundColor: CORES.fundoCard,
    color: CORES.textoPrincipal,
    fontSize: 14,
  },
  chipSelecionado: {
    backgroundColor: CORES.primaria,
    borderColor: CORES.primaria,
    color: CORES.textoBotaoPrimario || '#fff',
  },
  chipHorario: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    backgroundColor: CORES.primariaClara,
    border: 'none',
    borderRadius: RAIO.pill,
    padding: '7px 14px',
    color: CORES.primariaEscura,
    fontWeight: 600,
  },
  cartaoFrequencia: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: RAIO.medio,
    borderWidth: 1.5,
    borderStyle: 'solid',
    borderColor: CORES.borda,
    backgroundColor: CORES.fundoCard,
    textAlign: 'left',
  },
  cartaoFrequenciaSelecionado: {
    borderColor: CORES.primaria,
    backgroundColor: CORES.primariaClara,
  },
  iconeFrequenciaCirculo: {
    width: 34,
    height: 34,
    borderRadius: RAIO.pill,
    backgroundColor: CORES.primariaClara,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconeFrequenciaCirculoSelecionado: { backgroundColor: CORES.primaria },
  diaCirculo: {
    width: 40,
    height: 40,
    borderRadius: RAIO.pill,
    borderWidth: 1.5,
    borderStyle: 'solid',
    borderColor: CORES.borda,
    backgroundColor: CORES.fundoCard,
    color: CORES.textoPrincipal,
    fontWeight: 600,
  },
  diaCirculoSelecionado: {
    backgroundColor: CORES.primaria,
    borderColor: CORES.primaria,
    color: CORES.textoBotaoPrimario || '#fff',
  },
  botaoSalvar: {
    ...criarBotaoPrimario(CORES),
    width: '100%',
    marginTop: 30,
  },
  };
}
