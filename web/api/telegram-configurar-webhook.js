// Visite esse endereço UMA VEZ no navegador (não precisa de nada especial)
// pra avisar o Telegram que ele deve chamar nosso webhook sempre que
// alguém mandar mensagem pro bot. Só precisa fazer de novo se o domínio
// do app mudar.
export default async function handler(req, res) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.CRON_SECRET) {
    return res.status(500).json({ erro: 'TELEGRAM_BOT_TOKEN ou CRON_SECRET não configurados na Vercel.' });
  }

  const urlBase = `https://${req.headers.host}`;
  const urlWebhook = `${urlBase}/api/telegram-webhook?token=${process.env.CRON_SECRET}`;
  const urlTelegram = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook`;
  const urlComandos = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setMyCommands`;

  try {
    const respostaWebhook = await fetch(urlTelegram, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlWebhook }),
    });
    const dadosWebhook = await respostaWebhook.json();

    // registra a lista de comandos que aparece como sugestão ao digitar "/"
    // no chat com o bot
    const respostaComandos = await fetch(urlComandos, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: [
          { command: 'status', description: 'Ver quem está com dose atrasada hoje' },
          { command: 'help', description: 'Ver o que esse bot faz' },
        ],
      }),
    });
    const dadosComandos = await respostaComandos.json();

    res.status(200).json({
      webhookConfigurado: urlWebhook,
      resultadoTelegram: dadosWebhook,
      comandosConfigurados: dadosComandos,
    });
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
}
