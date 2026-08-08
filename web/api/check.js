const { kv } = require('@vercel/kv');
const webpush = require('web-push');
const { formatarData, remedioAplicavelNoDia } = require('./_logica');

webpush.setVapidDetails(
  'mailto:contato@caoprimido.app',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

module.exports = async function handler(req, res) {
  // protege o endpoint com uma chave simples, pra ninguém além do cron-job.org chamar
  const chaveEnviada = req.headers['x-chave-cron'] || req.query.chave;
  if (chaveEnviada !== process.env.CRON_SECRET) {
    return res.status(401).json({ erro: 'Não autorizado' });
  }

  const agora = new Date();
  const hoje = formatarData(agora);
  const horaAtual = `${String(agora.getHours()).padStart(2, '0')}:${String(
    agora.getMinutes()
  ).padStart(2, '0')}`;

  const idsDispositivos = await kv.smembers('dispositivos');
  let notificacoesEnviadas = 0;

  for (const deviceId of idsDispositivos || []) {
    const dados = await kv.get(`dispositivo:${deviceId}`);
    if (!dados || !dados.subscription) continue;

    const { remedios = [], subscription } = dados;

    for (const remedio of remedios) {
      if (!remedioAplicavelNoDia(remedio.frequencia, hoje)) continue;

      for (const horario of remedio.horarios || []) {
        if (horario !== horaAtual) continue;

        // evita reenviar o mesmo aviso (chave única por remedio+dia+horario)
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
          // marca como enviado por 2 dias (evita reenvio, some sozinho depois)
          await kv.set(chaveEnvio, true, { ex: 172800 });
        } catch (erroEnvio) {
          console.error('Falha ao enviar push para', deviceId, erroEnvio.message);
          // inscrição inválida/expirada: remove o dispositivo
          if (erroEnvio.statusCode === 404 || erroEnvio.statusCode === 410) {
            await kv.del(`dispositivo:${deviceId}`);
            await kv.srem('dispositivos', deviceId);
          }
        }
      }
    }
  }

  res.status(200).json({ ok: true, checados: (idsDispositivos || []).length, notificacoesEnviadas });
};
