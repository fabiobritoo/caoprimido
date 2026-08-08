import { precacheAndRoute } from 'workbox-precaching';

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('push', (evento) => {
  let dados = { titulo: 'Cãoprimido', corpo: 'Hora de um remédio!' };
  try {
    if (evento.data) dados = evento.data.json();
  } catch (e) {
    // mantém o padrão se não vier JSON
  }

  evento.waitUntil(
    self.registration.showNotification(dados.titulo, {
      body: dados.corpo,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [300, 150, 300, 150, 300, 150, 300],
      requireInteraction: true,
      data: dados, // guarda pra usar quando o usuário tocar
    })
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();

  const dados = evento.notification.data || {};
  const parametros = new URLSearchParams({
    alarme: '1',
    titulo: dados.titulo || 'Hora do remédio',
    corpo: dados.corpo || '',
  });
  const urlAlvo = `/?${parametros.toString()}`;

  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((listaClientes) => {
      for (const cliente of listaClientes) {
        // já tem uma janela aberta: navega ela pra tela de alarme e foca
        cliente.navigate(urlAlvo);
        return cliente.focus();
      }
      return self.clients.openWindow(urlAlvo);
    })
  );
});
