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
