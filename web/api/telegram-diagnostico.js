export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return res.status(500).json({ erro: 'TELEGRAM_BOT_TOKEN não configurado' });
  }

  try {
    const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`;
    const resposta = await fetch(url, { cache: 'no-store' });
    const dados = await resposta.json();

    if (!dados.ok) {
      return res.status(500).json({ erro: 'Token inválido ou de bot inexistente', detalhe: dados.description });
    }

    res.status(200).json({
      ok: true,
      bot_username: dados.result.username,
      bot_nome: dados.result.first_name,
      mensagem: `O token configurado pertence ao bot @${dados.result.username}`,
    });
  } catch (erro) {
    res.status(500).json({ erro: 'Falha ao consultar', detalhe: erro.message });
  }
}
