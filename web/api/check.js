import { kv } from '@vercel/kv';
import webpush from 'web-push';
import {
  obterDataHoraBrasil,
  remedioAplicavelNoDia,
  remedioEstaAtivo,
  minutosDeAtraso,
  nomeResumido,
} from './_logica.js';

const INTERVALO_REENVIO_MS = 3 * 60 * 1000;
const JANELA_MAXIMA_MS = 30 * 60 * 1000;
const LIMIAR_AVISO_CUIDADOR_MS = 15 * 60 * 1000;
const TTL_AVISO_ESTOQUE_SEGUNDOS = 3 * 24 * 60 * 60;
const TTL_AVISO_CUIDADOR_SEGUNDOS = 172800;
const TTL_ESTADO_SEGUNDOS = 3600;

// ============================================================
// CACHE EM MEMÓRIA (entre execuções do cron, só dentro da mesma
// instância "quente" da função serverless)
//
// A Vercel às vezes reaproveita a mesma instância entre uma
// chamada do cron e outra (executa a cada 1 minuto). Quando isso
// acontece, essa variável de módulo sobrevive entre as chamadas.
// Guardamos a lista de dispositivos + seus dados por alguns
// segundos pra evitar repetir o SMEMBERS + MGET quando nada
// mudou. Se a instância for reciclada (cold start), o cache
// começa vazio de novo e funciona exatamente como antes -
// nenhum risco, só um bônus quando dá certo.
//
// TTL curto o suficiente pra não atrasar percepção de novos
// remédios/dispositivos por mais que o próprio ciclo do cron já
// atrasaria (1 minuto).
// ============================================================
const TTL_CACHE_DISPOSITIVOS_MS = 50 * 1000;

let cacheDispositivos = null; // { idsDispositivos, dadosDispositivos, buscadoEm }

async function buscarDispositivosComCache() {
  const agoraMs = Date.now();

  if (
    cacheDispositivos &&
    agoraMs - cacheDispositivos.buscadoEm < TTL_CACHE_DISPOSITIVOS_MS
  ) {
    return cacheDispositivos;
  }

  const idsDispositivos = (await kv.smembers('dispositivos')) || [];

  let dadosDispositivos = [];
  if (idsDispositivos.length > 0) {
    const chavesDispositivos = idsDispositivos.map(
      (deviceId) => `dispositivo:${deviceId}`
    );
    dadosDispositivos = await kv.mget(...chavesDispositivos);
  }

  cacheDispositivos = {
    idsDispositivos,
    dadosDispositivos,
    buscadoEm: agoraMs,
  };

  return cacheDispositivos;
}

async function avisarCuidador(config, nomeRemedio, horario, perfil) {
  if (!config?.cuidadorAtivo || !config.cuidadorChatId) return;
  if (!process.env.TELEGRAM_BOT_TOKEN) return;

  const nomePessoa = perfil?.nome?.trim()
    ? nomeResumido(perfil.nome)
    : '';

  const identificacao = nomePessoa
    ? `👤 ${nomePessoa}`
    : '⚠️ [Nome não cadastrado — configure em Configurações > Dados pessoais pra identificar quem é]';

  const texto =
    `${identificacao}\n` +
    `⚠️ Cãoprimido: a dose de "${nomeRemedio}" das ${horario} ainda não foi confirmada.`;

  const url =
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: config.cuidadorChatId,
        text: texto,
      }),
    });
  } catch (e) {
    console.error(
      'Falha ao avisar cuidador:',
      e.message
    );
  }
}

function montarMensagemEscalonada(
  nomeRemedio,
  dosagem,
  atrasoMs
) {
  const min = atrasoMs / 60000;

  if (min < 5) {
    return {
      titulo: `Hora de tomar: ${nomeRemedio}`,
      corpo: dosagem || '',
    };
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
    // ============================================================
    // AUTENTICAÇÃO
    // ============================================================

    const chaveEnviada =
      req.headers['x-chave-cron'] ||
      req.query.chave;

    if (chaveEnviada !== process.env.CRON_SECRET) {
      return res.status(401).json({
        erro: 'Não autorizado',
      });
    }

    // ============================================================
    // CONFIGURAÇÃO VAPID
    // ============================================================

    if (
      !process.env.VAPID_PUBLIC_KEY ||
      !process.env.VAPID_PRIVATE_KEY
    ) {
      return res.status(500).json({
        erro:
          'Variáveis VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY não configuradas no ambiente',
      });
    }

    webpush.setVapidDetails(
      'mailto:contato@caoprimido.app',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    // ============================================================
    // DATA / HORA
    // ============================================================

    const agora = new Date();
    const { hoje, horaAtual } =
      obterDataHoraBrasil(agora);

    const agoraMs = agora.getTime();

    // ============================================================
    // 1 e 2. BUSCA TODOS OS DISPOSITIVOS + SEUS DADOS
    //
    // Usa o cache em memória (buscarDispositivosComCache) quando a
    // instância da função continua "quente" de uma execução do
    // cron pra outra - evita repetir SMEMBERS + MGET sem necessidade.
    // ============================================================

    const { idsDispositivos, dadosDispositivos } =
      await buscarDispositivosComCache();

    if (idsDispositivos.length === 0) {
      return res.status(200).json({
        ok: true,
        checados: 0,
        notificacoesEnviadas: 0,
        horaServidor: horaAtual,
      });
    }

    let notificacoesEnviadas = 0;

    // ============================================================
    // PROCESSA CADA DISPOSITIVO
    // ============================================================

    for (let i = 0; i < idsDispositivos.length; i++) {
      const deviceId = idsDispositivos[i];
      const dadosDispositivo = dadosDispositivos[i];

      if (
        !dadosDispositivo ||
        !dadosDispositivo.subscription
      ) {
        continue;
      }

      const {
        remedios = [],
        subscription,
        configuracoes,
        perfil,
      } = dadosDispositivo;

      // ==========================================================
      // 3. IDENTIFICA REMÉDIOS COM ESTOQUE BAIXO
      //
      // O aviso em si já é limitado a 1x a cada 3 dias (TTL da
      // chave avisoEstoque), então não faz sentido reconsultar o
      // Redis todo santo minuto enquanto o estoque continuar baixo
      // - só verificamos isso 2x por hora (minuto múltiplo de 30).
      // Enquanto um remédio estiver com estoque baixo por dias
      // seguidos, isso sozinho evitava até 1440 requests/dia por
      // dispositivo virarem só 48.
      // ==========================================================

      const minutoAtual = agora.getMinutes();
      const éHoraDeCheckarEstoque =
        minutoAtual % 30 === 0;

      const remediosEstoqueBaixo = éHoraDeCheckarEstoque
        ? remedios.filter(
            (remedio) =>
              remedioEstaAtivo(remedio, hoje) &&
              remedio.quantidadeMinima &&
              remedio.quantidadeMinima > 0 &&
              remedio.quantidadeAtual <=
                remedio.quantidadeMinima
          )
        : [];

      // Busca todos os avisos de estoque em uma única operação.
      if (remediosEstoqueBaixo.length > 0) {
        const chavesEstoque =
          remediosEstoqueBaixo.map(
            (remedio) =>
              `avisoEstoque:${deviceId}:${remedio.id}`
          );

        const estadosEstoque =
          await kv.mget(...chavesEstoque);

        for (
          let i = 0;
          i < remediosEstoqueBaixo.length;
          i++
        ) {
          const remedio =
            remediosEstoqueBaixo[i];

          const jaAvisou =
            estadosEstoque[i];

          if (jaAvisou) continue;

          const unidadeTexto =
            remedio.unidade === 'comprimido'
              ? 'comprimido(s)'
              : remedio.unidade;

          try {
            await webpush.sendNotification(
              subscription,
              JSON.stringify({
                tipo: 'estoque_baixo',
                titulo:
                  `📦 Estoque baixo: ${remedio.nome}`,
                corpo:
                  `Restam ${remedio.quantidadeAtual} ${unidadeTexto}. Hora de comprar mais.`,
                remedioId: remedio.id,
              })
            );

            await kv.set(
              `avisoEstoque:${deviceId}:${remedio.id}`,
              true,
              {
                ex: TTL_AVISO_ESTOQUE_SEGUNDOS,
              }
            );
          } catch (erroEnvio) {
            console.error(
              'Falha ao avisar estoque baixo para',
              deviceId,
              erroEnvio.message
            );
          }
        }
      }

      // ==========================================================
      // 4. DESCOBRE TODAS AS DOSES PENDENTES
      //
      // IMPORTANTE:
      // Aqui NÃO fazemos mais GET individual de "reconhecido".
      // Primeiro montamos todas as chaves.
      //
      // FILTRO DA JANELA MÁXIMA JÁ AQUI (e não só depois, como
      // antes): depois de JANELA_MAXIMA_MS (30 min) sem confirmar,
      // o app já para de reenviar push (ver passo 7) e o aviso ao
      // cuidador (que dispara aos 15 min) já aconteceu ou não vai
      // mais acontecer. Ou seja, uma dose esquecida há mais de 30
      // min não serve mais pra nada - mas, antes desse ajuste, ela
      // continuava entrando nas buscas de "reconhecido"/"estado"/
      // "cuidador" A CADA MINUTO até virar o dia. Descartando aqui
      // na origem, um dispositivo com alguma dose atrasada demais
      // volta a ficar com candidatos.length === 0 e pula esses
      // MGETs completamente pelo resto do dia, em vez de continuar
      // gastando requisições à toa.
      // ==========================================================

      const candidatos = [];

      for (const remedio of remedios) {
        if (
          !remedioAplicavelNoDia(
            remedio.frequencia,
            hoje,
            remedio.dataInicio,
            remedio.dataTermino
          )
        ) {
          continue;
        }

        for (const horario of remedio.horarios || []) {
          if (horario > horaAtual) continue;

          const atrasoMs =
            minutosDeAtraso(
              horario,
              horaAtual
            ) * 60000;

          // Dose muito atrasada: não vai mais gerar push nem
          // aviso novo ao cuidador, então nem vale a pena
          // continuar checando ela a cada minuto.
          if (atrasoMs > JANELA_MAXIMA_MS) continue;

          const chaveBase =
            `${deviceId}:${remedio.id}:${hoje}:${horario}`;

          candidatos.push({
            remedio,
            horario,
            chaveBase,
            atrasoMs,
          });
        }
      }

      if (candidatos.length === 0) {
        continue;
      }

      // ==========================================================
      // 5. BUSCA "RECONHECIDO" DE TODAS AS DOSES COM UM MGET
      // ==========================================================

      const chavesReconhecido =
        candidatos.map(
          ({ chaveBase }) =>
            `reconhecido:${chaveBase}`
        );

      const reconhecidos =
        await kv.mget(...chavesReconhecido);

      const dosesPendentes = [];

      for (
        let i = 0;
        i < candidatos.length;
        i++
      ) {
        if (reconhecidos[i]) continue;

        dosesPendentes.push(
          candidatos[i]
        );
      }

      if (dosesPendentes.length === 0) {
        continue;
      }

      const contadorPendente =
        dosesPendentes.length;

      // ==========================================================
      // 6. BUSCA ESTADO + AVISO AO CUIDADOR COM MGET
      //
      // ANTES:
      //   GET avisouCuidador por dose
      //   GET estado por dose
      //
      // AGORA:
      //   1 MGET para tudo
      // ==========================================================

      const chavesEstado = [];
      const chavesCuidador = [];

      for (const dose of dosesPendentes) {
        chavesEstado.push(
          `estado:${dose.chaveBase}`
        );

        if (
          dose.atrasoMs >=
          LIMIAR_AVISO_CUIDADOR_MS
        ) {
          chavesCuidador.push(
            `avisouCuidador:${dose.chaveBase}`
          );
        }
      }

      const estados =
        chavesEstado.length > 0
          ? await kv.mget(...chavesEstado)
          : [];

      const avisosCuidador =
        chavesCuidador.length > 0
          ? await kv.mget(...chavesCuidador)
          : [];

      // Mapeia rapidamente o estado do cuidador pela chave.
      const mapaAvisosCuidador =
        new Map();

      for (
        let i = 0;
        i < chavesCuidador.length;
        i++
      ) {
        mapaAvisosCuidador.set(
          chavesCuidador[i],
          avisosCuidador[i]
        );
      }

      // ==========================================================
      // 7. PROCESSA AS DOSES
      // ==========================================================

      for (
        let i = 0;
        i < dosesPendentes.length;
        i++
      ) {
        const {
          remedio,
          horario,
          chaveBase,
          atrasoMs,
        } = dosesPendentes[i];

        // --------------------------------------------------------
        // AVISO AO CUIDADOR
        // --------------------------------------------------------

        if (
          atrasoMs >=
          LIMIAR_AVISO_CUIDADOR_MS
        ) {
          const chaveCuidador =
            `avisouCuidador:${chaveBase}`;

          const jaAvisouCuidador =
            mapaAvisosCuidador.get(
              chaveCuidador
            );

          if (!jaAvisouCuidador) {
            await avisarCuidador(
              configuracoes,
              remedio.nome,
              horario,
              perfil
            );

            await kv.set(
              chaveCuidador,
              true,
              {
                ex:
                  TTL_AVISO_CUIDADOR_SEGUNDOS,
              }
            );
          }
        }

        // --------------------------------------------------------
        // JANELA MÁXIMA
        // --------------------------------------------------------

        if (
          atrasoMs >
          JANELA_MAXIMA_MS
        ) {
          continue;
        }

        // --------------------------------------------------------
        // ESTADO DA NOTIFICAÇÃO
        // --------------------------------------------------------

        const estado =
          estados[i];

        // Respeita uma soneca manual.
        if (
          estado?.proximoEnvioForcado &&
          agoraMs <
            estado.proximoEnvioForcado
        ) {
          continue;
        }

        // Respeita intervalo entre reenvios.
        if (
          !estado?.proximoEnvioForcado
        ) {
          const ultimoEnvio =
            estado?.ultimoEnvio || 0;

          if (
            agoraMs - ultimoEnvio <
            INTERVALO_REENVIO_MS
          ) {
            continue;
          }
        }

        // --------------------------------------------------------
        // ENVIA PUSH
        // --------------------------------------------------------

        try {
          const {
            titulo,
            corpo,
          } = montarMensagemEscalonada(
            remedio.nome,
            remedio.dosagem,
            atrasoMs
          );

          const novaTentativa =
            (estado?.tentativas || 0) + 1;

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
            {
              ultimoEnvio: agoraMs,
              tentativas: novaTentativa,
            },
            {
              ex: TTL_ESTADO_SEGUNDOS,
            }
          );
        } catch (erroEnvio) {
          console.error(
            'Falha ao enviar push para',
            deviceId,
            erroEnvio.message
          );

          if (
            erroEnvio.statusCode === 404 ||
            erroEnvio.statusCode === 410
          ) {
            try {
              await kv.del(
                `dispositivo:${deviceId}`
              );

              await kv.srem(
                'dispositivos',
                deviceId
              );
            } catch (erroLimpeza) {
              console.error(
                'Falha ao remover dispositivo inválido:',
                deviceId,
                erroLimpeza.message
              );
            }
          }
        }
      }
    }

    // ============================================================
    // RESPOSTA
    // ============================================================

    return res.status(200).json({
      ok: true,
      checados: idsDispositivos.length,
      notificacoesEnviadas,
      horaServidor: horaAtual,
    });
  } catch (erroGeral) {
    console.error(
      'Erro geral no /api/check:',
      erroGeral
    );

    return res.status(500).json({
      erro: 'Falha interna',
      detalhe: erroGeral.message,
    });
  }
}
