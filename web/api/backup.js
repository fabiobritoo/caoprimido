import { kv } from '@vercel/kv';

// Backup automático CRIPTOGRAFADO no aparelho: o servidor só guarda um bloco
// ilegível (AES-GCM), identificado por um hash do código de recuperação que só
// a própria pessoa tem. Sem o código, ninguém (nem o servidor) lê ou acha o
// backup de outra pessoa. Não precisa de login nem senha.
const TAMANHO_MAXIMO = 700 * 1024; // caracteres (base64)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  try {
    const { acao, id, dados } = req.body || {};
    if (typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id)) {
      return res.status(400).json({ erro: 'Identificador inválido' });
    }
    const chave = `backup:${id}`;

    if (acao === 'salvar') {
      if (typeof dados !== 'string' || dados.length === 0 || dados.length > TAMANHO_MAXIMO) {
        return res.status(400).json({ erro: 'Backup vazio ou grande demais' });
      }
      const atualizadoEm = Date.now();
      await kv.set(chave, { dados, atualizadoEm });
      return res.status(200).json({ ok: true, atualizadoEm });
    }

    if (acao === 'ler') {
      const registro = await kv.get(chave);
      if (!registro) return res.status(404).json({ erro: 'Nenhum backup com esse código' });
      return res.status(200).json(registro);
    }

    if (acao === 'apagar') {
      await kv.del(chave);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ erro: 'Ação desconhecida' });
  } catch (erro) {
    console.error('Erro em /api/backup:', erro);
    res.status(500).json({ erro: 'Erro no backup', detalhe: erro.message });
  }
}
