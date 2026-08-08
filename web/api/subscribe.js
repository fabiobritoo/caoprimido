import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  try {
    const { deviceId, subscription, remedios } = req.body;

    if (!deviceId || !subscription) {
      return res.status(400).json({ erro: 'Faltam dados obrigatórios' });
    }

    await kv.set(`dispositivo:${deviceId}`, {
      subscription,
      remedios: remedios || [],
      atualizadoEm: Date.now(),
    });

    await kv.sadd('dispositivos', deviceId);

    res.status(200).json({ ok: true });
  } catch (erro) {
    console.error('Erro em /api/subscribe:', erro);
    res.status(500).json({ erro: 'Erro ao salvar inscrição', detalhe: erro.message });
  }
}
