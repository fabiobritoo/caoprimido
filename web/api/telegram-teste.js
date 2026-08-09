import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  try {
    const { deviceId, chatId: chatIdDireto } = req.body;
    if (!deviceId) {
      return res.status(400).json({ erro: 'Faltou deviceId' });
    }
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      return res.status(500).json({ erro: 'TELEGRAM_BOT_TOKEN não configurado' });
    }

    let chatId = chatIdDireto;
    if (!chatId) {
      const dispositivo = await kv.get(`dispositivo:${deviceId}`);
      chatId = dispositivo?.configuracoes?.cuidadorChatId;
    }
    if (!chatId) {
      return res.status(400).json({ erro: 'Nenhum cuidador conectado ainda pra esse dispositivo' });
    }

    const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    const resposta = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: '🐶💊 Teste do Cãoprimido! Se você recebeu essa mensagem, o aviso ao cuidador está funcionando certinho.',
      }),
    });
    const dados = await resposta.json();

    if (!dados.ok) {
      return res.status(500).json({ erro: 'Telegram recusou o envio', detalhe: dados.description });
    }

    res.status(200).json({ ok: true });
  } catch (erro) {
    console.error('Erro em /api/telegram-teste:', erro);
    res.status(500).json({ erro: 'Falha interna', detalhe: erro.message });
  }
}
