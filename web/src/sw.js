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
        // Em navegadores que suportam, aparecem como botões direto na notificação
        // (sem precisar abrir o app). Onde não suportar, o toque normal continua funcionando.
        actions: [
          { action: 'tomei', title: '✅ Já tomei' },
          { action: 'adiar', title: '⏰ Adiar 5 min' },
        ],
      });

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

// Confirma "já tomei" direto pelo botão da notificação, sem precisar abrir o app
async function confirmarTomeiViaNotificacao(dados) {
  const { deviceId, remedioId, dia, horario } = dados;
  if (!deviceId || !remedioId || !dia || !horario) return;

  try {
    await fetch('/api/reconhecer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, remedioId, dia, horario }),
    });
  } catch (e) {
    // sem sinal agora; o próximo /api/check vai reenviar e o usuário confirma depois
  }

  // se o app estiver aberto em alguma aba, avisa ela também pra marcar localmente
  const listaClientes = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const cliente of listaClientes) {
    cliente.postMessage({ tipo: 'DOSE_CONFIRMADA', remedioId, dia, horario });
  }
}

// Adia direto pelo botão da notificação, sem precisar abrir o app
async function adiarViaNotificacao(dados) {
  const { deviceId, remedioId, dia, horario } = dados;
  if (!deviceId || !remedioId || !dia || !horario) return;

  try {
    await fetch('/api/soneca', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, remedioId, dia, horario, minutos: 5 }),
    });
  } catch (e) {
    // sem sinal agora; o próximo /api/check tenta de novo no intervalo normal
  }
}

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const dados = evento.notification.data || {};

  if (evento.action === 'tomei') {
    evento.waitUntil(confirmarTomeiViaNotificacao(dados));
  } else if (evento.action === 'adiar') {
    evento.waitUntil(adiarViaNotificacao(dados));
  } else {
    // tocou no corpo da notificação (não num botão): abre a tela de alarme cheia
    evento.waitUntil(abrirTelaAlarme(dados));
  }
});

// Usuário limpou/dispensou a notificação sem tocar (ex: "limpar tudo")
self.addEventListener('notificationclose', (evento) => {
  // só tenta abrir a tela se não foi um botão de ação que já resolveu o problema
  if (!evento.action) {
    evento.waitUntil(abrirTelaAlarme(evento.notification.data || {}));
  }
});
