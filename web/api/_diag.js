import { kv } from '@vercel/kv';

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
