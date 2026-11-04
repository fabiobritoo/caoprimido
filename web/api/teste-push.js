import { kv } from '@vercel/kv';
import webpush from 'web-push';
import { registrarEnvio } from './_diag.js';

// Teste de notificação, disparado pela tela Diagnóstico.
//  - sem "aposSegundos": envia agora e devolve a resposta do serviço de push
//    (201 = aceitou a mensagem; 404/410 = inscrição inválida; 401/403 = chave VAPID).
//  - com "aposSegundos": agenda o teste; quem envia é o /api/check (o mesmo
//    caminho dos lembretes reais), na primeira checagem depois desse horário.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

  try {
    const { deviceId, urgency = 'high', aposSegundos = 0 } = req.body || {};
    if (!deviceId) return res.status(400).json({ erro: 'Faltou deviceId' });
    if (!['high', 'normal'].includes(urgency)) return res.status(400).json({ erro: 'urgency inválida' });

    const dados = await kv.get(`dispositivo:${deviceId}`);
    if (!dados?.subscription) {
      return res.status(404).json({ erro: 'Dispositivo sem inscrição push no servidor' });
    }

    if (aposSegundos > 0) {
      const enviarApos = Date.now() + Math.min(Number(aposSegundos), 600) * 1000;
      await kv.set(`dispositivo:${deviceId}`, { ...dados, testePush: { enviarApos, urgency } });
      return res.status(200).json({ ok: true, agendado: true, enviarApos });
    }

    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      return res.status(500).json({ erro: 'VAPID não configurado no servidor' });
    }
    webpush.setVapidDetails('mailto:contato@caoprimido.app', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

    const t0 = Date.now();
    let status = null;
    let erro = null;
    try {
      const r = await webpush.sendNotification(
        dados.subscription,
        JSON.stringify({
          tipo: 'teste',
          titulo: '🧪 Teste do Cãoprimido',
          corpo: `Teste imediato (urgência ${urgency})`,
          enviadoEm: t0,
          dia: 'teste',
          horario: 'teste',
          remedioId: 'teste',
          tentativa: Date.now(),
        }),
        { TTL: 120, urgency }
      );
      status = r.statusCode;
    } catch (e) {
      status = e.statusCode || null;
      erro = e.body || e.message;
    }
    const ms = Date.now() - t0;
    await registrarEnvio(deviceId, { tipo: 'teste-agora', urg: urgency, status, ms, erro: erro ? String(erro).slice(0, 120) : undefined });

    res.status(200).json({ ok: !erro, statusPush: status, ms, erro });
  } catch (erro) {
    console.error('Erro em /api/teste-push:', erro);
    res.status(500).json({ erro: 'Falha no teste', detalhe: erro.message });
  }
}
