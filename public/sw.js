// Pluri-Health Service Worker
const CACHE_NAME = 'plurihealth-shell-v1';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/brand/plurihealth-icon.png',
  '/brand/plurihealth.png',
  '/favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Pre-cache warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignora requisições de API / Supabase e requisições não-GET do cache de assets
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api') ||
    url.hostname.includes('supabase.co')
  ) {
    return;
  }

  // Estratégia Network First com fallback de Cache para navegação SPA
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html') || caches.match('/');
      })
    );
    return;
  }

  // Cache First para imagens estáticas da marca
  if (url.pathname.startsWith('/brand/') || url.pathname.endsWith('.ico') || url.pathname.endsWith('.png')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Padrão para os demais arquivos: Network com fallback
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// ==============================================================================
// Suporte a Notificações e Alarmes PWA (Therapy-Flow / Pluri-Health)
// ==============================================================================

const ALARM_CHANNEL_NAME = 'pluri_alarm_channel';
const ALARM_DISMISS_MSG = 'DISMISS_ALARM';

function broadcastAlarmDismiss() {
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel(ALARM_CHANNEL_NAME);
      channel.postMessage(ALARM_DISMISS_MSG);
      channel.close();
    } catch (err) {
      // Ignora falha de BroadcastChannel em navegadores/runtimes restritos
    }
  }
}

self.addEventListener('notificationclose', (event) => {
  broadcastAlarmDismiss();

  if (self.clients && self.clients.matchAll) {
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: ALARM_DISMISS_MSG });
      });
    });
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  broadcastAlarmDismiss();

  const action = event.action;
  const data = event.notification.data || {};

  let targetUrl = data.url || '/';
  if (action === 'iniciar') {
    targetUrl = data.iniciarUrl || (data.patientId ? `/sessao/nova?pacienteId=${data.patientId}` : '/');
  } else if (action === 'paciente') {
    targetUrl = data.pacienteUrl || (data.patientId ? `/paciente/${data.patientId}` : '/');
  } else if (action === 'abrir') {
    targetUrl = data.url || '/';
  }

  const navigatePromise = self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((clientList) => {
      for (const client of clientList) {
        client.postMessage({ type: ALARM_DISMISS_MSG, action, data });
      }

      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client && targetUrl && targetUrl !== '/') {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    });

  event.waitUntil(navigatePromise);
});

