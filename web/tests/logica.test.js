import { describe, it, expect } from 'vitest';
import * as c from '../src/utils/constantes.js';
import * as s from '../api/_logica.js';

const mounjaro = {
  unidade: 'mg',
  quantidadePorDose: 0.25,
  horarios: ['21:00'],
  frequencia: { tipo: 'dias_semana', dias: [1] },
  quantidadeAtual: 4,
  fases: [
    { quantidadePorDose: 0.25, dias: 14 },
    { quantidadePorDose: 0.5, dias: 28 },
    { quantidadePorDose: 1, dias: null },
  ],
  dataInicio: '2026-11-01',
};
const simples = { unidade: 'capsula', quantidadePorDose: 1, horarios: ['08:00', '20:00'], frequencia: { tipo: 'diaria' }, quantidadeAtual: 30, quantidadeMinima: 5 };
const semanal = { unidade: 'comprimido', quantidadePorDose: 1, horarios: ['09:00'], frequencia: { tipo: 'dias_semana', dias: [3] }, quantidadeAtual: 4 };
const intervalo = { unidade: 'ml', quantidadePorDose: 2, horarios: ['10:00'], frequencia: { tipo: 'intervalo', intervaloDias: 2, dataInicio: '2026-11-01' }, quantidadeAtual: 10 };

describe('fases de dose', () => {
  it('troca a dose nas datas certas (cliente)', () => {
    expect(c.doseDoDia(mounjaro, '2026-11-01')).toBe(0.25);
    expect(c.doseDoDia(mounjaro, '2026-11-14')).toBe(0.25);
    expect(c.doseDoDia(mounjaro, '2026-11-15')).toBe(0.5);
    expect(c.doseDoDia(mounjaro, '2026-12-12')).toBe(0.5);
    expect(c.doseDoDia(mounjaro, '2026-12-13')).toBe(1);
  });
  it('cliente e servidor calculam igual', () => {
    for (const dia of ['2026-10-30', '2026-11-01', '2026-11-14', '2026-11-15', '2026-12-13', '2027-03-01']) {
      expect(s.doseDoDia(mounjaro, dia)).toBe(c.doseDoDia(mounjaro, dia));
      expect(s.faseDoDia(mounjaro, dia)?.indice).toBe(c.faseDoDia(mounjaro, dia)?.indice);
    }
  });
  it('fase sobrevive à virada de mês e ano', () => {
    const r = { ...mounjaro, dataInicio: '2026-12-20' };
    expect(c.doseDoDia(r, '2027-01-02')).toBe(0.25);
    expect(c.doseDoDia(r, '2027-01-03')).toBe(0.5);
  });
});

describe('estoque', () => {
  it('dias restantes sem fases', () => {
    expect(c.diasRestantesDeEstoque(simples, '2026-11-26')).toBe(15);
    expect(c.diasRestantesDeEstoque(semanal, '2026-11-26')).toBe(28);
    expect(c.diasRestantesDeEstoque(intervalo, '2026-11-26')).toBe(10);
  });
  it('cliente e servidor iguais, inclusive com fases', () => {
    for (const r of [simples, semanal, intervalo, mounjaro]) {
      expect(s.diasRestantesDeEstoque(r, '2026-11-26')).toBe(c.diasRestantesDeEstoque(r, '2026-11-26'));
    }
  });
  it('estoque não informado', () => {
    for (const v of [null, undefined, '']) {
      expect(c.diasRestantesDeEstoque({ ...simples, quantidadeAtual: v }, '2026-11-26')).toBeNull();
      expect(c.estoqueBaixo({ ...simples, quantidadeAtual: v })).toBe(false);
      expect(s.estoqueBaixo({ ...simples, quantidadeAtual: v })).toBe(false);
    }
  });
  it('estoque baixo no limite do mínimo', () => {
    expect(c.estoqueBaixo({ ...simples, quantidadeAtual: 5 })).toBe(true);
    expect(c.estoqueBaixo({ ...simples, quantidadeAtual: 6 })).toBe(false);
    expect(s.estoqueBaixo({ ...simples, quantidadeAtual: 5 })).toBe(true);
  });
});

describe('arquivar no meio do dia', () => {
  const r = { dataTermino: '2026-11-26', paradoApos: '12:00' };
  it('some só as doses posteriores', () => {
    expect(c.doseValeNoDia(r, '2026-11-26', '08:00')).toBe(true);
    expect(c.doseValeNoDia(r, '2026-11-26', '12:00')).toBe(true);
    expect(c.doseValeNoDia(r, '2026-11-26', '20:00')).toBe(false);
    expect(s.doseValeNoDia(r, '2026-11-26', '20:00')).toBe(false);
  });
  it('não mexe em outros dias nem em remédio normal', () => {
    expect(c.doseValeNoDia(r, '2026-11-25', '20:00')).toBe(true);
    expect(c.doseValeNoDia({}, '2026-11-26', '20:00')).toBe(true);
  });
});

describe('formatação', () => {
  it('padrão brasileiro', () => {
    expect(c.formatarQuantidade(0.25)).toBe('0,25');
    expect(c.formatarVariacao(9.54)).toBe('+9,5%');
    expect(c.formatarVariacao(-3)).toBe('-3,0%');
    expect(c.formatarDataBR('2026-11-26')).toBe('26/11/2026');
    expect(c.formatarDataCurtaBR('2026-11-26')).toBe('26/11');
    expect(c.formatarDataPorExtenso('2026-11-26')).toBe('Quinta-feira, 26 de novembro de 2026');
    expect(c.descreverDose({ quantidadePorDose: 0.5, unidade: 'mg' })).toBe('0,5 mg');
    expect(s.descreverDose({ quantidadePorDose: 0.5, unidade: 'mg' })).toBe('0,5 mg');
  });
  it('somar dias atravessa meses e anos', () => {
    expect(c.somarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(c.somarDias('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('frequência', () => {
  it('aplicável no dia (cliente = servidor)', () => {
    for (const r of [simples, semanal, intervalo]) {
      for (const dia of ['2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28']) {
        expect(s.remedioAplicavelNoDia(r.frequencia, dia)).toBe(c.remedioAplicavelNoDia(r.frequencia, dia));
      }
    }
  });
});
