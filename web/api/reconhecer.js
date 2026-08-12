import { kv } from '@vercel/kv';

async function avisarCuidadorQueTomou(config, nomeRemedio, horario, perfil) {
  if (!config?.cuidadorAtivo || !config.cuidadorChatId) return;
  if (!process.env.TELEGRAM_BOT_TOKEN) return;

  const nomePessoa = perfil?.nome?.trim();
  const identificacao = nomePessoa
    ? `👤 ${nomePessoa}`
    : '⚠️ [Nome não cadastrado — configure em Configurações > Dados pessoais pra identificar quem é]';

  const texto = `${identificacao}\nCãoprimido: a dose de "${nomeRemedio}" das ${horario} (que estava atrasada) acabou de ser confirmada. Tudo certo agora!`;
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: config.cuidadorChatId, text: texto }),
    });
  } catch (e) {
    console.error('Falha ao avisar cuidador (confirmacao tardia):', e.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  try {
    const { deviceId, remedioId, dia, horario } = req.body;
    if (!deviceId || !remedioId || !dia || !horario) {
      return res.status(400).json({ erro: 'Faltam dados obrigatórios' });
    }

    const chaveBase = `${deviceId}:${remedioId}:${dia}:${horario}`;
    await kv.set(`reconhecido:${chaveBase}`, true, { ex: 172800 }); // vale por 2 dias, depois some sozinho

    // se o cuidador tinha sido avisado (dose ficou atrasada), manda uma
    // segunda mensagem tranquilizando que foi tomada agora
    const jaAvisouCuidador = await kv.get(`avisouCuidador:${chaveBase}`);
    if (jaAvisouCuidador) {
      const dispositivo = await kv.get(`dispositivo:${deviceId}`);
      const remedio = dispositivo?.remedios?.find((r) => r.id === remedioId);
      if (dispositivo?.configuracoes && remedio) {
        await avisarCuidadorQueTomou(dispositivo.configuracoes, remedio.nome, horario, dispositivo.perfil);
      }
    }

    res.status(200).json({ ok: true });
  } catch (erro) {
    console.error('Erro em /api/reconhecer:', erro);
    res.status(500).json({ erro: 'Erro ao registrar confirmação', detalhe: erro.message });
  }
}
