import { describe, it, expect, beforeEach } from 'vitest';

const mem = {};
globalThis.localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; },
};
globalThis.window = { crypto: globalThis.crypto };
let servidor = {};
globalThis.fetch = async (url, { body }) => {
  const b = JSON.parse(body);
  if (b.acao === 'salvar') { servidor[b.id] = { dados: b.dados, atualizadoEm: 1 }; return { ok: true, status: 200, json: async () => ({ ok: true }) }; }
  if (b.acao === 'ler') { const r = servidor[b.id]; return r ? { ok: true, status: 200, json: async () => r } : { ok: false, status: 404 }; }
  return { ok: true, status: 200 };
};

const m = await import('../src/utils/backupNuvem.js');

beforeEach(() => {
  for (const k of Object.keys(mem)) delete mem[k];
  servidor = {};
});

describe('backup automático criptografado', () => {
  it('ida e volta, sem texto legível no servidor', async () => {
    mem['@caoprimido:lista'] = JSON.stringify([{ id: 'a', nome: 'Venlafaxina' }]);
    m.ativarBackupNuvem();
    const codigo = m.obterCodigo();
    expect(m.codigoValido(codigo)).toBe(true);
    expect((await m.fazerBackupNuvem({ forcar: true })).ok).toBe(true);
    expect(Object.values(servidor)[0].dados).not.toContain('Venlafaxina');

    for (const k of Object.keys(mem)) delete mem[k]; // "celular novo"
    expect((await m.restaurarComCodigo(codigo)).ok).toBe(true);
    expect(JSON.parse(mem['@caoprimido:lista'])[0].nome).toBe('Venlafaxina');
  });

  it('código de outra pessoa não encontra nem abre o backup', async () => {
    mem['@caoprimido:lista'] = '[]';
    m.ativarBackupNuvem();
    await m.fazerBackupNuvem({ forcar: true });
    const r = await m.restaurarComCodigo(m.gerarCodigoRecuperacao());
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe('nao_encontrado');
  });

  it('só reenvia quando algo mudou', async () => {
    mem['@caoprimido:lista'] = '[]';
    m.ativarBackupNuvem();
    expect((await m.fazerBackupNuvem()).motivo).toBe('enviado');
    expect((await m.fazerBackupNuvem()).motivo).toBe('sem_mudancas');
  });
});
