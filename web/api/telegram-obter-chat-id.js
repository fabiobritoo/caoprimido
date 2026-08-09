export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  try {
    const { codigo } = req.query;
    if (!codigo) {
      return res.status(400).json({ erro: 'Informe o código (?codigo=...)' });
    }
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      return res.status(500).json({ erro: 'TELEGRAM_BOT_TOKEN não configurado no servidor' });
    }

    const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getUpdates?limit=100`;
    const resposta = await fetch(url, { cache: 'no-store' });
    const dados = await resposta.json();

    if (!dados.ok) {
      return res.status(500).json({ erro: 'Erro ao consultar o Telegram', detalhe: dados.description });
    }

    const atualizacoes = dados.result || [];
    const encontrada = atualizacoes
      .slice()
      .reverse() // mais recente primeiro
      .find((u) => u.message?.text?.trim().toUpperCase() === codigo.trim().toUpperCase());

    if (!encontrada) {
      // mostra o que foi recebido, pra ajudar a diagnosticar
      const mensagensRecebidas = atualizacoes.map((u) => ({
        texto: u.message?.text,
        de: u.message?.chat?.first_name || u.message?.chat?.username,
      }));
      return res.status(404).json({
        erro: 'Ainda não recebi essa mensagem. Confirme que foi enviada pro bot certo.',
        debug_mensagensRecebidas: mensagensRecebidas,
      });
    }

    const chatId = encontrada.message.chat.id;
    const nome = encontrada.message.chat.first_name || encontrada.message.chat.username || 'Cuidador';

    res.status(200).json({ ok: true, chatId, nome });
  } catch (erro) {
    console.error('Erro em /api/telegram-obter-chat-id:', erro);
    res.status(500).json({ erro: 'Falha interna', detalhe: erro.message });
  }
}
