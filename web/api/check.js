import { kv } from '@vercel/kv';
import webpush from 'web-push';
import { obterDataHoraBrasil, remedioAplicavelNoDia } from './_logica.js';

const INTERVALO_REENVIO_MS = 3 * 60 * 1000; // reenvia a cada 3 minutos
const JANELA_MAXIMA_MS = 30 * 60 * 1000; // desiste depois de 30 minutos sem confirmação

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
    const { hoje, horaAtual } = obterDataHoraBrasil(agora);
    const agoraMs = agora.getTime();

    const idsDispositivos = (await kv.smembers('dispositivos')) || [];
    let notificacoesEnviadas = 0;

    for (const deviceId of idsDispositivos) {
      const dados = await kv.get(`dispositivo:${deviceId}`);
      if (!dados || !dados.subscription) continue;

      const { remedios = [], subscription } = dados;

      for (const remedio of remedios) {
        if (!remedioAplicavelNoDia(remedio.frequencia, hoje)) continue;

        for (const horario of remedio.horarios || []) {
          // só considera horários que já chegaram (não futuros)
          if (horario > horaAtual) continue;

          const chaveBase = `${deviceId}:${remedio.id}:${hoje}:${horario}`;

          // já foi confirmado como tomado? não incomoda mais
          const reconhecido = await kv.get(`reconhecido:${chaveBase}`);
          if (reconhecido) continue;

          // calcula quanto tempo já passou desde o horário agendado
          const [h, m] = horario.split(':').map(Number);
          const dataAgendada = new Date(agora);
          dataAgendada.setHours(h, m, 0, 0);
          const atrasoMs = agoraMs - dataAgendada.getTime();
          if (atrasoMs > JANELA_MAXIMA_MS) continue; // desiste, passou muito tempo

          const estado = await kv.get(`estado:${chaveBase}`);
          const ultimoEnvio = estado?.ultimoEnvio || 0;
          if (agoraMs - ultimoEnvio < INTERVALO_REENVIO_MS) continue; // ainda não é hora de reenviar

          try {
            await webpush.sendNotification(
              subscription,
              JSON.stringify({
                titulo: `Hora de tomar: ${remedio.nome}`,
                corpo: remedio.dosagem || '',
                remedioId: remedio.id,
                dia: hoje,
                horario,
              })
            );
            notificacoesEnviadas++;
            await kv.set(
              `estado:${chaveBase}`,
              { ultimoEnvio: agoraMs, tentativas: (estado?.tentativas || 0) + 1 },
              { ex: 3600 }
            );
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
