import { kv } from '@vercel/kv';
import webpush from 'web-push';
import { formatarData, remedioAplicavelNoDia } from './_logica.js';

export default async function handler(req, res) {
  try {
    const chaveEnviada = req.headers['x-chave-cron'] || req.query.chave;
    if (chaveEnviada !== process.env.CRON_SECRET) {
      return res.status(401).json({ erro: 'Não autorizado' });
    }

    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      return res.status(500).json({
        erro: 'Variáveis VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY não configuradas no ambiente',
      });
    }

    webpush.setVapidDetails(
      'mailto:contato@caoprimido.app',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    const agora = new Date();
    const hoje = formatarData(agora);
    const horaAtual = `${String(agora.getHours()).padStart(2, '0')}:${String(
      agora.getMinutes()
    ).padStart(2, '0')}`;

    const idsDispositivos = (await kv.smembers('dispositivos')) || [];
    let notificacoesEnviadas = 0;

    for (const deviceId of idsDispositivos) {
      const dados = await kv.get(`dispositivo:${deviceId}`);
      if (!dados || !dados.subscription) continue;

      const { remedios = [], subscription } = dados;

      for (const remedio of remedios) {
        if (!remedioAplicavelNoDia(remedio.frequencia, hoje)) continue;

        for (const horario of remedio.horarios || []) {
          if (horario !== horaAtual) continue;

          const chaveEnvio = `enviado:${deviceId}:${remedio.id}:${hoje}:${horario}`;
          const jaEnviado = await kv.get(chaveEnvio);
          if (jaEnviado) continue;

          try {
            await webpush.sendNotification(
              subscription,
              JSON.stringify({
                titulo: `Hora de tomar: ${remedio.nome}`,
                corpo: remedio.dosagem || '',
              })
            );
            notificacoesEnviadas++;
            await kv.set(chaveEnvio, true, { ex: 172800 });
          } catch (erroEnvio) {
            console.error('Falha ao enviar push para', deviceId, erroEnvio.message);
            if (erroEnvio.statusCode === 404 || erroEnvio.statusCode === 410) {
              await kv.del(`dispositivo:${deviceId}`);
              await kv.srem('dispositivos', deviceId);
            }
          }
        }
      }
    }

    res.status(200).json({
      ok: true,
      checados: idsDispositivos.length,
      notificacoesEnviadas,
      horaServidor: horaAtual,
    });
  } catch (erroGeral) {
    console.error('Erro geral no /api/check:', erroGeral);
    res.status(500).json({ erro: 'Falha interna', detalhe: erroGeral.message });
  }
}
