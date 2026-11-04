import { kv } from '@vercel/kv';
import { obterDataHoraBrasil } from './_logica.js';
import { lerLogEnvios, resumirSubscription } from './_diag.js';

// Estado do dispositivo visto pelo SERVIDOR: se está registrado, com qual
// inscrição push, e o histórico dos últimos envios (com a resposta do
// serviço de push). Usado pela tela Diagnóstico do app.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  try {
    const { deviceId } = req.query;
    if (!deviceId) return res.status(400).json({ erro: 'Informe deviceId' });

    const inicio = Date.now();
    const [dados, estaNoSet, log] = await Promise.all([
      kv.get(`dispositivo:${deviceId}`),
      kv.sismember('dispositivos', deviceId),
      lerLogEnvios(deviceId),
    ]);
    const redisMs = Date.now() - inicio;
    const { hoje, horaAtual } = obterDataHoraBrasil();

    res.status(200).json({
      agoraMs: Date.now(),
      hoje,
      horaServidor: horaAtual,
      redisMs,
      registrado: !!dados,
      noConjuntoDeDispositivos: !!estaNoSet,
      atualizadoEm: dados?.atualizadoEm || null,
      subscription: resumirSubscription(dados?.subscription),
      quantidadeRemedios: dados?.remedios?.length || 0,
      cuidadorAtivo: !!dados?.configuracoes?.cuidadorAtivo,
      testeAgendado: dados?.testePush || null,
      log,
    });
  } catch (erro) {
    console.error('Erro em /api/diagnostico-push:', erro);
    res.status(500).json({ erro: 'Falha ao consultar', detalhe: erro.message });
  }
}
