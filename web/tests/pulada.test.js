import { describe, it, expect, beforeEach } from 'vitest';

const mem = {};
globalThis.localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; },
};

const st = await import('../src/utils/storage.js');
const ev = await import('../src/utils/evolucao.js');
const { formatarData, somarDias, remedioAplicavelNoDia, descreverFrequencia } = await import('../src/utils/constantes.js');

const hoje = formatarData(new Date());
const ontem = somarDias(hoje, -1);
const remedio = {
  id: 'r1', nome: 'X', unidade: 'comprimido', quantidadePorDose: 1,
  horarios: ['08:00', '20:00'], frequencia: { tipo: 'diaria' },
  quantidadeAtual: 10, dataInicio: somarDias(hoje, -10), ativo: true,
};

beforeEach(async () => {
  for (const k of Object.keys(mem)) delete mem[k];
  await st.salvarRemedios([remedio]);
});

describe('dose pulada', () => {
  it('fica resolvida, não conta como tomada e não mexe no estoque', async () => {
    const r = await st.pularDose(remedio, ontem, '08:00', 'Passei mal');
    expect(st.doseTomada(r.registros, 'r1', ontem, '08:00')).toBe(false);
    expect(st.dosePulada(r.registros, 'r1', ontem, '08:00')).toBe(true);
    expect(st.doseResolvida(r.registros, 'r1', ontem, '08:00')).toBe(true);
    expect(st.motivoDoPulo(r.registros, 'r1', ontem, '08:00')).toBe('Passei mal');
    expect((await st.listarRemedios())[0].quantidadeAtual).toBe(10);
  });

  it('desfazer uma pulada não devolve estoque', async () => {
    await st.pularDose(remedio, ontem, '08:00');
    const r = await st.alternarDose(remedio, ontem, '08:00');
    expect(st.doseResolvida(r.registros, 'r1', ontem, '08:00')).toBe(false);
    expect(r.remedios[0].quantidadeAtual).toBe(10);
  });

  it('não entra na adesão (nem a favor, nem contra)', async () => {
    await st.alternarDose(remedio, ontem, '20:00'); // tomada
    const r = await st.pularDose(remedio, ontem, '08:00');
    const base = ev.calcularAdesaoPorRemedio([remedio], r.registros, 3).find((x) => x.id === 'r1');
    // ontem: 2 agendadas, 1 pulada -> conta só a tomada; dias antes sem registro contam como perdidos
    expect(base.tomadas).toBe(1);
    const semPulo = ev.calcularAdesaoPorRemedio([remedio], await st.obterRegistros().then(() => ({ ...r.registros, ['r1|' + ontem + '|08:00']: undefined })), 3).find((x) => x.id === 'r1');
    expect(base.agendadas).toBeLessThan(semPulo.agendadas + 1);
  });
});

describe('tomar vários e sob demanda', () => {
  it('"tomei todos" marca todas e desconta o estoque de cada uma', async () => {
    const r = await st.tomarVarias([{ remedio, horario: '08:00' }, { remedio, horario: '20:00' }], hoje);
    expect(st.doseTomada(r.registros, 'r1', hoje, '08:00')).toBe(true);
    expect(st.doseTomada(r.registros, 'r1', hoje, '20:00')).toBe(true);
    expect(r.remedios[0].quantidadeAtual).toBe(8);
  });

  it('não desconta duas vezes quando alguma já estava tomada', async () => {
    await st.alternarDose(remedio, hoje, '08:00');
    const r = await st.tomarVarias([{ remedio, horario: '08:00' }, { remedio, horario: '20:00' }], hoje);
    expect(r.remedios[0].quantidadeAtual).toBe(8);
  });

  it('remédio sob demanda nunca é agendado, mas desconta estoque ao tomar', async () => {
    const prn = { ...remedio, id: 'p1', horarios: [], frequencia: { tipo: 'sob_demanda' } };
    expect(remedioAplicavelNoDia(prn.frequencia, hoje, null, null)).toBe(false);
    expect(descreverFrequencia(prn.frequencia)).toBe('Quando precisar');
    await st.salvarRemedios([prn]);
    const r = await st.alternarDose(prn, hoje, 'prn-123');
    expect(r.remedios[0].quantidadeAtual).toBe(9);
    const d = await st.alternarDose(prn, hoje, 'prn-123');
    expect(d.remedios[0].quantidadeAtual).toBe(10);
  });
});
