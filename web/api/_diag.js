import { kv } from '@vercel/kv';
import webpush from 'web-push';
import { obterDataHoraBrasil } from './_logica.js';

// Registro dos últimos envios de push de cada dispositivo (só pra diagnóstico).
// Guarda no máximo 30 entradas por dispositivo e expira sozinho em 3 dias.
const MAX_ENTRADAS = 30;
const TTL_LOG_SEGUNDOS = 3 * 24 * 60 * 60;

export async function registrarEnvio(deviceId, entrada) {
  try {
    const chave = `logEnvio:${deviceId}`;
    await kv.lpush(chave, JSON.stringify({ t: Date.now(), ...entrada }));
    await kv.ltrim(chave, 0, MAX_ENTRADAS - 1);
    await kv.expire(chave, TTL_LOG_SEGUNDOS);
  } catch (e) {
    console.error('Falha ao registrar log de envio:', e.message);
  }
}

export async function lerLogEnvios(deviceId) {
  const itens = (await kv.lrange(`logEnvio:${deviceId}`, 0, MAX_ENTRADAS - 1)) || [];
  return itens.map((i) => (typeof i === 'string' ? safeParse(i) : i)).filter(Boolean);
}

function safeParse(texto) {
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

// Resumo seguro da inscrição push: nunca expõe as chaves, só o serviço
// (fcm / apple / mozilla...) e um pedaço final do endpoint pra comparar.
export function resumirSubscription(sub) {
  if (!sub?.endpoint) return null;
  let host = '';
  try {
    host = new URL(sub.endpoint).host;
  } catch {
    host = 'inválido';
  }
  return {
    servico: host,
    final: sub.endpoint.slice(-12),
    expiracao: sub.expirationTime ?? null,
  };
}

// Estado do dispositivo visto pelo SERVIDOR (usado pela tela Diagnóstico).
export async function montarDiagnostico(deviceId) {
  const inicio = Date.now();
  const [dados, estaNoSet, log] = await Promise.all([
    kv.get(`dispositivo:${deviceId}`),
    kv.sismember('dispositivos', deviceId),
    lerLogEnvios(deviceId),
  ]);
  const redisMs = Date.now() - inicio;
  const { hoje, horaAtual } = obterDataHoraBrasil();
  return {
    agoraMs: Date.now(),
    hoje,
    horaServidor: horaAtual,
    redisMs,
    registrado: !!dados,
    noConjuntoDeDispositivos: !!estaNoSet,
    atualizadoEm: dados?.atualizadoEm || null,
    subscription: resumirSubscription(dados?.subscription),
    quantidadeRemedios: dados?.remedios?.length || 0,
    cuidadorAtivo: !!dados?.configuracoes?.cuidadorAtivo,
    telegramProprioAtivo: !!dados?.configuracoes?.telegramProprioAtivo,
    testeAgendado: dados?.testePush || null,
    log,
  };
}

// Teste de notificação, disparado pela tela Diagnóstico.
//  - sem "aposSegundos": envia agora e devolve a resposta do serviço de push
//    (201 = aceitou; 404/410 = inscrição inválida; 401/403 = chave VAPID).
//  - com "aposSegundos": agenda; quem envia é o /api/check (mesmo caminho
//    dos lembretes reais), na primeira checagem depois desse horário.
// Devolve { codigo, corpo } pro handler responder.
export async function executarTestePush({ deviceId, urgency = 'high', aposSegundos = 0 } = {}) {
  if (!deviceId) return { codigo: 400, corpo: { erro: 'Faltou deviceId' } };
  if (!['high', 'normal'].includes(urgency)) return { codigo: 400, corpo: { erro: 'urgency inválida' } };

  const dados = await kv.get(`dispositivo:${deviceId}`);
  if (!dados?.subscription) {
    return { codigo: 404, corpo: { erro: 'Dispositivo sem inscrição push no servidor' } };
  }

  if (aposSegundos > 0) {
    const enviarApos = Date.now() + Math.min(Number(aposSegundos), 600) * 1000;
    await kv.set(`dispositivo:${deviceId}`, { ...dados, testePush: { enviarApos, urgency } });
    return { codigo: 200, corpo: { ok: true, agendado: true, enviarApos } };
  }

  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return { codigo: 500, corpo: { erro: 'VAPID não configurado no servidor' } };
  }
  webpush.setVapidDetails('mailto:contato@caoprimido.app', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

  const t0 = Date.now();
  let status = null;
  let erro = null;
  try {
    const r = await webpush.sendNotification(
      dados.subscription,
      JSON.stringify({
        tipo: 'teste',
        titulo: '🧪 Teste do Cãoprimido',
        corpo: `Teste imediato (urgência ${urgency})`,
        enviadoEm: t0,
        dia: 'teste',
        horario: 'teste',
        remedioId: 'teste',
        tentativa: Date.now(),
      }),
      { TTL: 120, urgency }
    );
    status = r.statusCode;
  } catch (e) {
    status = e.statusCode || null;
    erro = e.body || e.message;
  }
  const ms = Date.now() - t0;
  await registrarEnvio(deviceId, { tipo: 'teste-agora', urg: urgency, status, ms, erro: erro ? String(erro).slice(0, 120) : undefined });
  return { codigo: 200, corpo: { ok: !erro, statusPush: status, ms, erro } };
}
