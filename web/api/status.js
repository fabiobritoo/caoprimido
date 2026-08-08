import { kv } from '@vercel/kv';
import { obterDataHoraBrasil, remedioAplicavelNoDia, minutosDeAtraso } from './_logica.js';

const INTERVALO_REENVIO_MS = 3 * 60 * 1000;
const JANELA_MAXIMA_MS = 30 * 60 * 1000;

export default async function handler(req, res) {
  try {
    const { deviceId } = req.query;
    if (!deviceId) {
      return res.status(400).json({ erro: 'Informe deviceId na URL (?deviceId=...)' });
    }

    const dados = await kv.get(`dispositivo:${deviceId}`);
    if (!dados) {
      return res.status(404).json({ erro: 'Dispositivo não encontrado no servidor' });
    }

    const agora = new Date();
    const { hoje, horaAtual } = obterDataHoraBrasil(agora);
    const agoraMs = agora.getTime();

    const doses = [];

    for (const remedio of dados.remedios || []) {
      if (!remedioAplicavelNoDia(remedio.frequencia, hoje)) continue;

      for (const horario of remedio.horarios || []) {
        const chaveBase = `${deviceId}:${remedio.id}:${hoje}:${horario}`;
        const reconhecido = await kv.get(`reconhecido:${chaveBase}`);
        const estado = await kv.get(`estado:${chaveBase}`);

        let status;
        let detalhe = '';

        if (horario > horaAtual) {
          status = 'ainda não chegou a hora';
        } else if (reconhecido) {
          status = 'confirmado (tomado)';
        } else {
          const atrasoMs = minutosDeAtraso(horario, horaAtual) * 60000;

          if (atrasoMs > JANELA_MAXIMA_MS) {
            status = 'desistiu (passou 30min sem confirmação)';
          } else if (!estado) {
            status = 'aguardando o próximo /api/check enviar';
          } else {
            const proximoEnvioMs = estado.ultimoEnvio + INTERVALO_REENVIO_MS - agoraMs;
            const minutosRestantes = Math.max(0, Math.ceil(proximoEnvioMs / 60000));
            status = `enviado ${estado.tentativas}x, ainda não confirmado`;
            detalhe =
              proximoEnvioMs > 0
                ? `próximo reenvio em ~${minutosRestantes} min`
                : 'reenvio pendente (deve acontecer na próxima checagem)';
          }
        }

        doses.push({ remedio: remedio.nome, horario, status, detalhe });
      }
    }

    res.status(200).json({ horaServidor: horaAtual, doses });
  } catch (erro) {
    console.error('Erro em /api/status:', erro);
    res.status(500).json({ erro: 'Falha ao consultar status', detalhe: erro.message });
  }
}
