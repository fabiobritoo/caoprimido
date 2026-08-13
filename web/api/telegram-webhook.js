import { kv } from '@vercel/kv';
import { obterDataHoraBrasil, remedioAplicavelNoDia, minutosDeAtraso, nomeResumido } from './_logica.js';

const COMANDOS_STATUS = ['/status', '/pendentes', 'status', 'pendentes'];const COMANDOS_AJUDA = ['/start', '/help', '/ajuda', 'ajuda'];

const MENSAGEM_AJUDA = `🐶💊 *Cãoprimido Alertas*

Eu aviso quando uma dose de remédio ficar atrasada, e ajudo você a acompanhar quem você cuida.

*Comandos disponíveis:*
/status — Ver quem está com dose atrasada hoje
/help — Ver essa mensagem de novo

Pra eu te avisar sobre alguém, essa pessoa precisa ativar a opção "Avisar um cuidador" nas Configurações do app dela e usar o código que aparece lá pra se conectar com esse chat.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // proteção simples: só aceita chamadas que tragam o mesmo segredo usado
  // no cron, pra evitar que qualquer um chame esse endpoint direto
  if (req.query.token !== process.env.CRON_SECRET) {
    return res.status(401).json({ erro: 'Token inválido' });
  }

  try {
    const mensagem = req.body?.message;
    const texto = mensagem?.text?.trim().toLowerCase();
    const chatId = mensagem?.chat?.id;

    if (!texto || !chatId) {
      return res.status(200).json({ ok: true }); // nada a fazer, mas confirma recebimento pro Telegram
    }

    const ehComandoStatus = COMANDOS_STATUS.some((c) => texto === c || texto.startsWith(`${c}@`));
    const ehComandoAjuda = COMANDOS_AJUDA.some((c) => texto === c || texto.startsWith(`${c}@`));

    if (ehComandoStatus) {
      const resposta = await montarResumoPendencias(String(chatId));
      await enviarMensagemTelegram(String(chatId), resposta);
    } else if (ehComandoAjuda) {
      await enviarMensagemTelegram(String(chatId), MENSAGEM_AJUDA, true);
    }

    res.status(200).json({ ok: true });
  } catch (erro) {
    console.error('Erro no webhook do Telegram:', erro);
    res.status(200).json({ ok: true }); // sempre 200 pro Telegram não ficar reenviando
  }
}

// pra atrasos de 1h+, mostra em horas (e minutos, se sobrar) em vez de só
// minutos corridos — "2h15min" é mais fácil de ler que "135 min"
function formatarAtraso(totalMinutos) {
  if (totalMinutos < 60) return `${totalMinutos} min`;
  const horas = Math.floor(totalMinutos / 60);
  const minutosRestantes = totalMinutos % 60;
  return minutosRestantes === 0 ? `${horas}h` : `${horas}h${minutosRestantes}min`;
}

async function montarResumoPendencias(chatId) {
  const idsDispositivos = (await kv.smembers('dispositivos')) || [];
  const agora = new Date();
  const { hoje, horaAtual } = obterDataHoraBrasil(agora);

  const pessoasEncontradas = [];

  for (const deviceId of idsDispositivos) {
    const dados = await kv.get(`dispositivo:${deviceId}`);
    if (!dados) continue;
    if (String(dados.configuracoes?.cuidadorChatId || '') !== chatId) continue;
    if (!dados.configuracoes?.cuidadorAtivo) continue;

    const nome = dados.perfil?.nome?.trim() ? nomeResumido(dados.perfil.nome) : 'Sem nome cadastrado';
    const pendentes = [];

    for (const remedio of dados.remedios || []) {
      if (!remedioAplicavelNoDia(remedio.frequencia, hoje, remedio.dataInicio, remedio.dataTermino)) continue;
      for (const horario of remedio.horarios || []) {
        if (horario > horaAtual) continue; // ainda não chegou a hora, não conta como pendente

        const chaveBase = `${deviceId}:${remedio.id}:${hoje}:${horario}`;
        const reconhecido = await kv.get(`reconhecido:${chaveBase}`);
        if (reconhecido) continue;

        const atrasoMin = Math.round(minutosDeAtraso(horario, horaAtual));
        pendentes.push({ nome: remedio.nome, horario, atrasoMin });
      }
    }

    pessoasEncontradas.push({ nome, pendentes });
  }

  if (pessoasEncontradas.length === 0) {
    return 'Você ainda não está configurado como cuidador de ninguém no Cãoprimido. Peça pra pessoa ativar o aviso em Configurações > Avisar um cuidador.';
  }

  const linhas = ['📋 Status de hoje:', ''];
  for (const pessoa of pessoasEncontradas) {
    if (pessoa.pendentes.length === 0) {
      linhas.push(`✅ ${pessoa.nome}: tudo em dia!`);
    } else {
      linhas.push(`⚠️ ${pessoa.nome}:`);
      for (const p of pessoa.pendentes) {
        linhas.push(`   • ${p.nome} (${p.horario} — atrasado ${formatarAtraso(p.atrasoMin)})`);
      }
    }
    linhas.push('');
  }

  return linhas.join('\n').trim();
}

async function enviarMensagemTelegram(chatId, texto, comFormatacao = false) {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const corpo = { chat_id: chatId, text: texto };
  if (comFormatacao) corpo.parse_mode = 'Markdown';
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    });
  } catch (e) {
    console.error('Falha ao responder no webhook do Telegram:', e.message);
  }
}
