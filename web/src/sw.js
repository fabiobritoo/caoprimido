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
      vibrate: [200, 100, 200, 100, 200],
      requireInteraction: true,
    })
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  evento.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((listaClientes) => {
      if (listaClientes.length > 0) {
        return listaClientes[0].focus();
      }
      return self.clients.openWindow('/');
    })
  );
});
