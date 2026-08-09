import { formatarData, remedioAplicavelNoDia } from './constantes.js';
import { doseTomada } from './storage.js';

// Descobre a partir de qual data um remédio "existe" pra fins de cálculo.
// Remédios cadastrados antes dessa correção não têm dataCriacao salva —
// nesse caso, usamos a data de hoje como piso (não temos como saber ao certo
// quando foram criados, então não penalizamos dias anteriores ao uso real).
function dataInicioDoRemedio(remedio, hojeStr) {
  return remedio.dataCriacao || hojeStr;
}

function dosesAgendadasNoDia(remedios, dataStr, hojeStr) {
  const doses = [];
  for (const remedio of remedios) {
    if (dataStr < dataInicioDoRemedio(remedio, hojeStr)) continue;
    if (!remedioAplicavelNoDia(remedio.frequencia, dataStr)) continue;
    for (const horario of remedio.horarios || []) {
      doses.push({ remedioId: remedio.id, horario, nome: remedio.nome });
    }
  }
  return doses;
}

/**
 * Devolve um array com os últimos `dias` dias (mais antigo primeiro), cada um com:
 * { data, status: 'sem_remedio' | 'completo' | 'parcial' | 'nenhum' | 'hoje_pendente' | 'futuro', proporcao }
 */
export function calcularMapaCalor(remedios, registros, dias = 84) {
  const hojeStr = formatarData(new Date());
  const resultado = [];
  const hoje = new Date();

  for (let i = dias - 1; i >= 0; i--) {
    const data = new Date(hoje);
    data.setDate(hoje.getDate() - i);
    const dataStr = formatarData(data);

    if (dataStr > hojeStr) {
      resultado.push({ data: dataStr, status: 'futuro', proporcao: 0 });
      continue;
    }

    const agendadas = dosesAgendadasNoDia(remedios, dataStr, hojeStr);
    if (agendadas.length === 0) {
      resultado.push({ data: dataStr, status: 'sem_remedio', proporcao: 0 });
      continue;
    }

    const tomadas = agendadas.filter((d) => doseTomada(registros, d.remedioId, dataStr, d.horario));
    const proporcao = tomadas.length / agendadas.length;

    let status;
    if (proporcao === 1) status = 'completo';
    else if (proporcao > 0) status = 'parcial';
    else status = dataStr === hojeStr ? 'hoje_pendente' : 'nenhum';

    resultado.push({ data: dataStr, status, proporcao });
  }

  return resultado;
}

// Percentual geral de adesão no período (ignora dias sem remédio agendado e
// dias anteriores ao cadastro de cada remédio). O dia de hoje ENTRA na conta
// com o que já foi feito até agora — não fica mais de fora.
export function calcularAdesaoGeral(remedios, registros, dias = 84) {
  const hojeStr = formatarData(new Date());
  const hoje = new Date();
  let totalAgendadas = 0;
  let totalTomadas = 0;

  for (let i = dias - 1; i >= 0; i--) {
    const data = new Date(hoje);
    data.setDate(hoje.getDate() - i);
    const dataStr = formatarData(data);

    const agendadas = dosesAgendadasNoDia(remedios, dataStr, hojeStr);
    totalAgendadas += agendadas.length;
    totalTomadas += agendadas.filter((d) => doseTomada(registros, d.remedioId, dataStr, d.horario)).length;
  }

  if (totalAgendadas === 0) return null;
  return Math.round((totalTomadas / totalAgendadas) * 100);
}

// Maior sequência de dias 100% cumpridos já alcançada no período
export function calcularMelhorSequencia(remedios, registros, dias = 84) {
  const mapa = calcularMapaCalor(remedios, registros, dias);
  let melhor = 0;
  let atual = 0;

  for (const dia of mapa) {
    if (dia.status === 'sem_remedio' || dia.status === 'futuro') continue;
    if (dia.status === 'completo') {
      atual++;
      melhor = Math.max(melhor, atual);
    } else if (dia.status === 'hoje_pendente') {
      continue; // dia de hoje ainda em curso, não quebra nem soma
    } else {
      atual = 0;
    }
  }
  return melhor;
}

// Adesão por remédio individualmente, no período (também considera a data de criação)
export function calcularAdesaoPorRemedio(remedios, registros, dias = 84) {
  const hojeStr = formatarData(new Date());
  const hoje = new Date();
  const contadores = {};

  for (const remedio of remedios) {
    contadores[remedio.id] = { nome: remedio.nome, agendadas: 0, tomadas: 0 };
  }

  for (let i = dias - 1; i >= 0; i--) {
    const data = new Date(hoje);
    data.setDate(hoje.getDate() - i);
    const dataStr = formatarData(data);

    for (const remedio of remedios) {
      if (dataStr < dataInicioDoRemedio(remedio, hojeStr)) continue;
      if (!remedioAplicavelNoDia(remedio.frequencia, dataStr)) continue;
      for (const horario of remedio.horarios || []) {
        contadores[remedio.id].agendadas++;
        if (doseTomada(registros, remedio.id, dataStr, horario)) {
          contadores[remedio.id].tomadas++;
        }
      }
    }
  }

  return Object.values(contadores)
    .filter((c) => c.agendadas > 0)
    .map((c) => ({
      nome: c.nome,
      percentual: Math.round((c.tomadas / c.agendadas) * 100),
      tomadas: c.tomadas,
      agendadas: c.agendadas,
    }))
    .sort((a, b) => a.percentual - b.percentual);
}
