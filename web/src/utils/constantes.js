export const UNIDADES = [
  { valor: 'comprimido', rotulo: 'Comprimido(s)' },
  { valor: 'capsula', rotulo: 'Cápsula(s)' },
  { valor: 'gota', rotulo: 'Gota(s)' },
  { valor: 'ml', rotulo: 'ml' },
  { valor: 'grama', rotulo: 'g' },
  { valor: 'injecao', rotulo: 'Injeção/Injeções' },
  { valor: 'sache', rotulo: 'Sachê(s)' },
  { valor: 'unidade', rotulo: 'Unidade(s)' },
];

export function rotuloUnidade(valor) {
  if (!valor) return 'unidade(s)';
  const encontrada = UNIDADES.find((u) => u.valor === valor);
  return encontrada ? encontrada.rotulo : valor;
}

// index 0 = domingo, igual ao Date.getDay() do JavaScript
export const DIAS_SEMANA = [
  { valor: 0, curto: 'D', rotulo: 'Domingo' },
  { valor: 1, curto: 'S', rotulo: 'Segunda' },
  { valor: 2, curto: 'T', rotulo: 'Terça' },
  { valor: 3, curto: 'Q', rotulo: 'Quarta' },
  { valor: 4, curto: 'Q', rotulo: 'Quinta' },
  { valor: 5, curto: 'S', rotulo: 'Sexta' },
  { valor: 6, curto: 'S', rotulo: 'Sábado' },
];

export function descreverFrequencia(frequencia) {
  if (!frequencia || frequencia.tipo === 'diaria') {
    return 'Todos os dias';
  }
  if (frequencia.tipo === 'dias_semana') {
    const nomes = frequencia.dias
      .slice()
      .sort((a, b) => a - b)
      .map((d) => DIAS_SEMANA[d].rotulo.slice(0, 3));
    return nomes.join(', ');
  }
  if (frequencia.tipo === 'intervalo') {
    if (frequencia.intervaloDias === 2) return 'Dias alternados (a cada 2 dias)';
    return `A cada ${frequencia.intervaloDias} dias`;
  }
  return '';
}

// Formata um Date como 'YYYY-MM-DD' (sem depender de fuso/timezone da lib)
export function formatarData(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function diferencaEmDias(dataInicioStr, dataFimStr) {
  const a = new Date(dataInicioStr + 'T00:00:00');
  const b = new Date(dataFimStr + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

// Diz se um remédio deve ser tomado numa determinada data, de acordo com sua frequência
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

// Devolve os 7 dias (domingo a sábado) da semana que contém "hoje"
export function diasDaSemanaAtual() {
  const hoje = new Date();
  const diaSemanaHoje = hoje.getDay();
  const domingo = new Date(hoje);
  domingo.setDate(hoje.getDate() - diaSemanaHoje);

  const dias = [];
  for (let i = 0; i < 7; i++) {
    const data = new Date(domingo);
    data.setDate(domingo.getDate() + i);
    dias.push({
      data: formatarData(data),
      diaSemana: i,
      numero: data.getDate(),
      curto: DIAS_SEMANA[i].curto,
    });
  }
  return dias;
}

const ABREV_DIAS = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'];
const NOMES_DIA_SEMANA_EXTENSO = [
  'domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado',
];
const NOMES_MES_EXTENSO = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

// Devolve algo como "segunda-feira, 3 de agosto de 2026"
export function formatarDataPorExtenso(dataStr) {
  const data = new Date(dataStr + 'T12:00:00');
  const diaSemana = NOMES_DIA_SEMANA_EXTENSO[data.getDay()];
  const dia = data.getDate();
  const mes = NOMES_MES_EXTENSO[data.getMonth()];
  const ano = data.getFullYear();
  return `${diaSemana}, ${dia} de ${mes} de ${ano}`;
}

// Igual à função acima, mas começando na segunda-feira (pra bater com a UI de agenda)
export function somarDias(dataStr, quantidade) {
  const data = new Date(dataStr + 'T12:00:00');
  data.setDate(data.getDate() + quantidade);
  return formatarData(data);
}

export function diasDaSemanaContendo(dataBase) {
  const base = new Date(dataBase);
  const diaSemanaBase = base.getDay(); // 0=domingo
  const offsetSegunda = diaSemanaBase === 0 ? -6 : 1 - diaSemanaBase;
  const segunda = new Date(base);
  segunda.setDate(base.getDate() + offsetSegunda);

  const dias = [];
  for (let i = 0; i < 7; i++) {
    const data = new Date(segunda);
    data.setDate(segunda.getDate() + i);
    dias.push({
      data: formatarData(data),
      diaSemana: data.getDay(),
      numero: data.getDate(),
      abrev: ABREV_DIAS[data.getDay()],
    });
  }
  return dias;
}

export function diasDaSemanaAtualSegunda() {
  return diasDaSemanaContendo(new Date());
}
