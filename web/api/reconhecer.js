import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  try {
    const { deviceId, remedioId, dia, horario } = req.body;
    if (!deviceId || !remedioId || !dia || !horario) {
      return res.status(400).json({ erro: 'Faltam dados obrigatórios' });
    }

    const chave = `reconhecido:${deviceId}:${remedioId}:${dia}:${horario}`;
    await kv.set(chave, true, { ex: 172800 }); // vale por 2 dias, depois some sozinho

    res.status(200).json({ ok: true });
  } catch (erro) {
    console.error('Erro em /api/reconhecer:', erro);
    res.status(500).json({ erro: 'Erro ao registrar confirmação', detalhe: erro.message });
  }
}
