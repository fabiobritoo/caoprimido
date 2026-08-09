export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return res.status(500).json({ erro: 'TELEGRAM_BOT_TOKEN não configurado' });
  }

  try {
    const base = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

    const respostaMe = await fetch(`${base}/getMe`, { cache: 'no-store' });
    const dadosMe = await respostaMe.json();
    if (!dadosMe.ok) {
      return res.status(500).json({ erro: 'Token inválido ou de bot inexistente', detalhe: dadosMe.description });
    }

    const respostaWebhook = await fetch(`${base}/getWebhookInfo`, { cache: 'no-store' });
    const dadosWebhook = await respostaWebhook.json();

    let webhookRemovido = false;
    if (dadosWebhook.ok && dadosWebhook.result?.url) {
      // um webhook configurado impede o getUpdates de funcionar — remove automaticamente
      const respostaRemover = await fetch(`${base}/deleteWebhook`, { cache: 'no-store' });
      const dadosRemover = await respostaRemover.json();
      webhookRemovido = dadosRemover.ok;
    }

    // testa o getUpdates aqui tambem, pra comparar com o outro endpoint
    const respostaUpdates = await fetch(`${base}/getUpdates?limit=100`, { cache: 'no-store' });
    const dadosUpdates = await respostaUpdates.json();

    res.status(200).json({
      ok: true,
      bot_username: dadosMe.result.username,
      bot_nome: dadosMe.result.first_name,
      webhook_estava_configurado: !!dadosWebhook.result?.url,
      webhook_url_anterior: dadosWebhook.result?.url || null,
      webhook_removido_agora: webhookRemovido,
      pending_update_count_do_webhook_info: dadosWebhook.result?.pending_update_count,
      getUpdates_ok: dadosUpdates.ok,
      getUpdates_quantidade: dadosUpdates.result?.length || 0,
      getUpdates_bruto: dadosUpdates.result || [],
      getUpdates_erro: dadosUpdates.ok ? null : dadosUpdates.description,
      mensagem: dadosWebhook.result?.url
        ? webhookRemovido
          ? 'Havia um webhook configurado (por isso as mensagens não apareciam) — já removi. Tente verificar de novo no app.'
          : 'Havia um webhook configurado, mas não consegui remover automaticamente.'
        : 'Nenhum webhook configurado — não era esse o problema.',
    });
  } catch (erro) {
    res.status(500).json({ erro: 'Falha ao consultar', detalhe: erro.message });
  }
}
