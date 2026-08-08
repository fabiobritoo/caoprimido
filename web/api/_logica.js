function formatarData(date) {
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

function remedioAplicavelNoDia(frequencia, dataStr) {
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

module.exports = { formatarData, remedioAplicavelNoDia };
