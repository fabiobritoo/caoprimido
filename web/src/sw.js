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
    (async () => {
      await self.registration.showNotification(dados.titulo, {
        body: dados.corpo,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [300, 150, 300, 150, 300, 150, 300],
        requireInteraction: true,
        tag: `remedio-${dados.remedioId}-${dados.dia}-${dados.horario}`,
        data: dados,
      });

      // atualiza o selo/contador no ícone do app, se o navegador suportar
      if ('setAppBadge' in self.registration && typeof dados.badge === 'number') {
        try {
          if (dados.badge > 0) {
            await self.registration.setAppBadge(dados.badge);
          } else {
            await self.registration.clearAppBadge();
          }
        } catch (e) {
          // sem suporte, ignora
        }
      }
    })()
  );
});

function abrirTelaAlarme(dados) {
  const parametros = new URLSearchParams({
    alarme: '1',
    titulo: dados.titulo || 'Hora do remédio',
    corpo: dados.corpo || '',
    remedioId: dados.remedioId || '',
    dia: dados.dia || '',
    horario: dados.horario || '',
  });
  const urlAlvo = `/?${parametros.toString()}`;

  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((listaClientes) => {
    for (const cliente of listaClientes) {
      cliente.navigate(urlAlvo);
      return cliente.focus();
    }
    return self.clients.openWindow(urlAlvo);
  });
}

// Usuário tocou na notificação
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  evento.waitUntil(abrirTelaAlarme(evento.notification.data || {}));
});

// Usuário limpou/dispensou a notificação sem tocar (ex: "limpar tudo")
// Em alguns navegadores/sistemas isso pode não conseguir abrir a tela
// automaticamente por restrição de segurança, mas tentamos mesmo assim.
self.addEventListener('notificationclose', (evento) => {
  evento.waitUntil(abrirTelaAlarme(evento.notification.data || {}));
});
