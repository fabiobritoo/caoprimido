import { kv } from '@vercel/kv';
import webpush from 'web-push';
import { obterDataHoraBrasil, remedioAplicavelNoDia, remedioEstaAtivo, minutosDeAtraso, nomeResumido } from './_logica.js';

const INTERVALO_REENVIO_MS = 3 * 60 * 1000;
const JANELA_MAXIMA_MS = 30 * 60 * 1000;
const LIMIAR_AVISO_CUIDADOR_MS = 15 * 60 * 1000;
const TTL_AVISO_ESTOQUE_SEGUNDOS = 3 * 24 * 60 * 60; // não repete o mesmo aviso por 3 dias

async function avisarEstoqueBaixo(subscription, deviceId, remedio) {
  const chave = `avisoEstoque:${deviceId}:${remedio.id}`;
  const jaAvisou = await kv.get(chave);
  if (jaAvisou) return false;

  const unidadeTexto = remedio.unidade === 'comprimido' ? 'comprimido(s)' : remedio.unidade;
  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        tipo: 'estoque_baixo',
        titulo: `📦 Estoque baixo: ${remedio.nome}`,
        corpo: `Restam ${remedio.quantidadeAtual} ${unidadeTexto}. Hora de comprar mais.`,
        remedioId: remedio.id,
      })
    );
    await kv.set(chave, true, { ex: TTL_AVISO_ESTOQUE_SEGUNDOS });
    return true;
  } catch (erroEnvio) {
    console.error('Falha ao avisar estoque baixo para', deviceId, erroEnvio.message);
    return false;
  }
}

async function avisarCuidador(config, nomeRemedio, horario, perfil) {
  if (!config?.cuidadorAtivo || !config.cuidadorChatId) return;
  if (!process.env.TELEGRAM_BOT_TOKEN) return;

  const nomePessoa = perfil?.nome?.trim() ? nomeResumido(perfil.nome) : '';
  const identificacao = nomePessoa
    ? `👤 ${nomePessoa}`
    : '⚠️ [Nome não cadastrado — configure em Configurações > Dados pessoais pra identificar quem é]';

  const texto = `${identificacao}\n⚠️ Cãoprimido: a dose de "${nomeRemedio}" das ${horario} ainda não foi confirmada.`;
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: config.cuidadorChatId, text: texto }),
    });
  } catch (e) {
    console.error('Falha ao avisar cuidador:', e.message);
  }
}

// Escolhe título/corpo de acordo com quanto tempo já passou sem confirmação —
// fica mais "urgente" a cada reenvio, pra reforçar a insistência
function montarMensagemEscalonada(nomeRemedio, dosagem, atrasoMs) {
  const min = atrasoMs / 60000;
  if (min < 5) {
    return { titulo: `Hora de tomar: ${nomeRemedio}`, corpo: dosagem || '' };
  }
  if (min < 10) {
    return {
      titulo: `⚠️ Remédio pendente: ${nomeRemedio}`,
      corpo: 'Você ainda não confirmou essa dose.',
    };
  }
  if (min < 20) {
    return {
      titulo: `🚨 Atenção: ${nomeRemedio}`,
      corpo: 'Essa dose ainda não foi confirmada.',
    };
  }
  return {
    titulo: `🔴 Dose atrasada: ${nomeRemedio}`,
    corpo: 'Confirme se já tomou esse remédio.',
  };
}

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
      const dadosDispositivo = await kv.get(`dispositivo:${deviceId}`);
      if (!dadosDispositivo || !dadosDispositivo.subscription) continue;

      const { remedios = [], subscription, configuracoes, perfil } = dadosDispositivo;

      // Checa estoque baixo de cada remédio ativo, independente de ter dose
      // agendada agora — o aviso é lançado no máximo uma vez a cada 3 dias
      // por remédio, pra não virar spam
      for (const remedio of remedios) {
        if (!remedioEstaAtivo(remedio, hoje)) continue;
        if (!remedio.quantidadeMinima || remedio.quantidadeMinima <= 0) continue;
        if (remedio.quantidadeAtual > remedio.quantidadeMinima) continue;
        await avisarEstoqueBaixo(subscription, deviceId, remedio);
      }

      // Primeiro: descobre todas as doses de hoje já vencidas e não confirmadas
      // (usado tanto pro selo/contador quanto pra decidir o que reenviar)
      const dosesPendentes = [];
      for (const remedio of remedios) {
        if (!remedioAplicavelNoDia(remedio.frequencia, hoje, remedio.dataInicio, remedio.dataTermino)) continue;
        for (const horario of remedio.horarios || []) {
          if (horario > horaAtual) continue;

          const chaveBase = `${deviceId}:${remedio.id}:${hoje}:${horario}`;
          const reconhecido = await kv.get(`reconhecido:${chaveBase}`);
          if (reconhecido) continue;

          const atrasoMs = minutosDeAtraso(horario, horaAtual) * 60000;
          dosesPendentes.push({ remedio, horario, chaveBase, atrasoMs });
        }
      }

      const contadorPendente = dosesPendentes.length;

      for (const { remedio, horario, chaveBase, atrasoMs } of dosesPendentes) {
        // avisa o cuidador uma única vez, depois de X minutos sem confirmação
        if (atrasoMs >= LIMIAR_AVISO_CUIDADOR_MS) {
          const jaAvisouCuidador = await kv.get(`avisouCuidador:${chaveBase}`);
          if (!jaAvisouCuidador) {
            await avisarCuidador(configuracoes, remedio.nome, horario, perfil);
            await kv.set(`avisouCuidador:${chaveBase}`, true, { ex: 172800 });
          }
        }

        if (atrasoMs > JANELA_MAXIMA_MS) continue; // desiste de reenviar push, mas o aviso ao cuidador já foi

        const estado = await kv.get(`estado:${chaveBase}`);

        // respeita um adiamento manual ("soneca"), se houver
        if (estado?.proximoEnvioForcado && agoraMs < estado.proximoEnvioForcado) continue;

        if (!estado?.proximoEnvioForcado) {
          const ultimoEnvio = estado?.ultimoEnvio || 0;
          if (agoraMs - ultimoEnvio < INTERVALO_REENVIO_MS) continue;
        }

        try {
          const { titulo, corpo } = montarMensagemEscalonada(remedio.nome, remedio.dosagem, atrasoMs);
          const novaTentativa = (estado?.tentativas || 0) + 1;

          await webpush.sendNotification(
            subscription,
            JSON.stringify({
              titulo,
              corpo,
              remedioId: remedio.id,
              dia: hoje,
              horario,
              deviceId,
              badge: contadorPendente,
              tentativa: novaTentativa,
            })
          );
          notificacoesEnviadas++;
          await kv.set(
            `estado:${chaveBase}`,
            { ultimoEnvio: agoraMs, tentativas: novaTentativa },
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
