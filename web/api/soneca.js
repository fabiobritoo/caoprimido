import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  try {
    const { deviceId, remedioId, dia, horario, minutos } = req.body;
    if (!deviceId || !remedioId || !dia || !horario) {
      return res.status(400).json({ erro: 'Faltam dados obrigatórios' });
    }

    const chaveBase = `${deviceId}:${remedioId}:${dia}:${horario}`;
    const estadoAtual = (await kv.get(`estado:${chaveBase}`)) || {};
    const minutosAdiar = Number(minutos) || 10;

    await kv.set(
      `estado:${chaveBase}`,
      { ...estadoAtual, proximoEnvioForcado: Date.now() + minutosAdiar * 60000 },
      { ex: 3600 }
    );

    res.status(200).json({ ok: true });
  } catch (erro) {
    console.error('Erro em /api/soneca:', erro);
    res.status(500).json({ erro: 'Erro ao adiar', detalhe: erro.message });
  }
}
