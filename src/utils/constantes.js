export const UNIDADES = [
  { valor: 'comprimido', rotulo: 'Comprimido(s)' },
  { valor: 'capsula', rotulo: 'Cápsula(s)' },
  { valor: 'gota', rotulo: 'Gota(s)' },
  { valor: 'ml', rotulo: 'ml' },
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
