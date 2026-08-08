export async function pedirPermissaoNotificacao() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const resultado = await Notification.requestPermission();
  return resultado === 'granted';
}

export function mostrarNotificacao(titulo, corpo) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(titulo, { body: corpo, icon: '/icon-192.png' });
  } catch (e) {
    // alguns navegadores exigem que seja feito via Service Worker; ignora com segurança
  }
}

const CHAVE_PUBLICA_VAPID = 'BB_LENrNKc2FQ6KpMbijAEld-w52XFB-JW-l6Ux_L2HHgquJe1eRHsob-uEL9HpMoussMvTR3DWrCg1z7nRozPI';

function base64ParaUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Seguro = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const bruto = atob(base64Seguro);
  const saida = new Uint8Array(bruto.length);
  for (let i = 0; i < bruto.length; i++) saida[i] = bruto.charCodeAt(i);
  return saida;
}

// Inscreve o dispositivo pra receber notificações mesmo com o app fechado,
// e envia a lista atual de remédios pro servidor conseguir avisar na hora certa.
export async function sincronizarNotificacoesServidor(deviceId, remedios) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  try {
    const registro = await navigator.serviceWorker.ready;
    let subscription = await registro.pushManager.getSubscription();

    if (!subscription) {
      const permitido = await pedirPermissaoNotificacao();
      if (!permitido) return;
      subscription = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ParaUint8Array(CHAVE_PUBLICA_VAPID),
      });
    }

    await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, subscription, remedios }),
    });
  } catch (e) {
    console.error('Falha ao sincronizar notificações com o servidor', e);
  }
}
