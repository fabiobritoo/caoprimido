export function formatarData(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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

export function remedioAplicavelNoDia(frequencia, dataStr) {
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
