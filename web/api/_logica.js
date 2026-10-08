export function formatarData(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Pra evitar mensagens gigantes no Telegram quando alguém cadastra o nome
// completo, usa só o primeiro e o último nome (se houver mais de uma palavra)
export function nomeResumido(nomeCompleto) {
  const partes = nomeCompleto.trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return partes[0] || '';
  return `${partes[0]} ${partes[partes.length - 1]}`;
}

// Pega a data e hora atuais SEMPRE no fuso do Brasil (America/Sao_Paulo),
// não importa em qual fuso o servidor da Vercel esteja rodando.
export function obterDataHoraBrasil(data = new Date()) {
  const formatador = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const partes = formatador.formatToParts(data);
  const obter = (tipo) => partes.find((p) => p.type === tipo).value;
  const hoje = `${obter('year')}-${obter('month')}-${obter('day')}`;
  const horaAtual = `${obter('hour')}:${obter('minute')}`;
  return { hoje, horaAtual };
}

// Converte "HH:MM" em minutos desde a meia-noite (evita qualquer ambiguidade de fuso)
export function paraMinutos(horaMinuto) {
  const [h, m] = horaMinuto.split(':').map(Number);
  return h * 60 + m;
}

// Quantos minutos já se passaram desde um horário "HH:MM" até agora,
// comparando sempre no fuso do Brasil (sem criar objetos Date "às cegas")
export function minutosDeAtraso(horario, horaAtualBrasil) {
  return paraMinutos(horaAtualBrasil) - paraMinutos(horario);
}

function diferencaEmDias(dataInicioStr, dataFimStr) {
  const a = new Date(dataInicioStr + 'T00:00:00');
  const b = new Date(dataFimStr + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

export function remedioEstaAtivo(remedio, hojeStr) {
  if (remedio.ativo === false) return false;
  if (remedio.dataTermino && remedio.dataTermino < hojeStr) return false;
  return true;
}

export function remedioAplicavelNoDia(frequencia, dataStr, dataInicio, dataTermino) {
  if (dataInicio && dataStr < dataInicio) return false;
  if (dataTermino && dataStr > dataTermino) return false;

  if (!frequencia || frequencia.tipo === 'diaria') return true;

  if (frequencia.tipo === 'dias_semana') {
    const diaSemana = new Date(dataStr + 'T00:00:00').getDay();
    return frequencia.dias.includes(diaSemana);
  }

  if (frequencia.tipo === 'intervalo') {
    const inicio = frequencia.dataInicio || frequencia.proximaData;
    if (!inicio) return false;
    const diff = diferencaEmDias(inicio, dataStr);
    return diff >= 0 && diff % frequencia.intervaloDias === 0;
  }

  return false;
}

const ROTULOS_UNIDADE = {
  comprimido: 'comprimido(s)',
  capsula: 'cápsula(s)',
  gota: 'gota(s)',
  ml: 'ml',
  grama: 'g',
  injecao: 'injeção(ões)',
  sache: 'sachê(s)',
  unidade: 'unidade(s)',
};

export function rotuloUnidade(valor) {
  return ROTULOS_UNIDADE[valor] || valor || 'unidade(s)';
}

// Média de doses por dia levando em conta a frequência real (mesma lógica
// do relatório de preços no app): um remédio "1x por semana" não pode ser
// tratado como se fosse tomado todo dia.
export function mediaDosesPorDia(remedio) {
  const horariosPorDia = remedio.horarios?.length || 0;
  const freq = remedio.frequencia;
  if (!freq || freq.tipo === 'diaria') return horariosPorDia;
  if (freq.tipo === 'dias_semana') return (horariosPorDia * (freq.dias?.length || 7)) / 7;
  if (freq.tipo === 'intervalo') return horariosPorDia / (freq.intervaloDias || 1);
  return horariosPorDia;
}

const NOMES_DIA_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export function descreverFrequenciaTexto(frequencia) {
  if (!frequencia || frequencia.tipo === 'diaria') return 'todos os dias';
  if (frequencia.tipo === 'dias_semana') {
    return [...(frequencia.dias || [])].sort((a, b) => a - b).map((d) => NOMES_DIA_CURTO[d]).join(', ');
  }
  if (frequencia.tipo === 'intervalo') {
    return frequencia.intervaloDias === 2 ? 'dias alternados' : `a cada ${frequencia.intervaloDias} dias`;
  }
  return '';
}

// Quantos dias o estoque atual dura, no ritmo de uso médio. Devolve null
// quando não dá pra calcular (estoque não informado ou sem horários).
export function diasRestantesDeEstoque(remedio) {
  if (remedio.quantidadeAtual == null || remedio.quantidadeAtual === '') return null;
  const consumoPorDia = mediaDosesPorDia(remedio) * (Number(remedio.quantidadePorDose) || 1);
  if (!consumoPorDia) return null;
  return Math.floor(Number(remedio.quantidadeAtual) / consumoPorDia);
}

// "YYYY-MM-DD" + N dias -> "DD/MM"
export function dataFuturaCurta(hojeStr, dias) {
  const d = new Date(`${hojeStr}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}
