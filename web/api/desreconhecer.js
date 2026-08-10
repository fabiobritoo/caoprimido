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

    const chaveBase = `${deviceId}:${remedioId}:${dia}:${horario}`;
    // remove a confirmação — assim o /api/check volta a considerar essa dose
    // "não tomada" e retoma o envio de notificações no próximo ciclo
    await kv.del(`reconhecido:${chaveBase}`);

    res.status(200).json({ ok: true });
  } catch (erro) {
    console.error('Erro em /api/desreconhecer:', erro);
    res.status(500).json({ erro: 'Erro ao desfazer confirmação', detalhe: erro.message });
  }
}
