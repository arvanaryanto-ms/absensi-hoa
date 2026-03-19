const CACHE = 'absensi-hoa-v4';
const ASSETS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
  jadwalkanNotifCO(); // Jadwalkan notif jam 17:00 saat SW aktif
});

// ================================================================
// NOTIFIKASI OTOMATIS JAM 17:00
// Bekerja bahkan saat app tertutup / layar mati
// ================================================================
function jadwalkanNotifCO() {
  const now = new Date();
  const target = new Date();
  target.setHours(17, 40, 0, 0);

  // Kalau sudah lewat jam 17 hari ini, jadwalkan besok
  if (now >= target) {
    target.setDate(target.getDate() + 1);
  }

  const selisih = target.getTime() - now.getTime();

  setTimeout(() => {
    kirimNotifCO();
    // Jadwalkan lagi untuk besok (24 jam)
    setInterval(kirimNotifCO, 24 * 60 * 60 * 1000);
  }, selisih);
}

function kirimNotifCO() {
  // Cek dulu apakah user sudah checkout (lewat pesan ke client)
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    if (list.length === 0) {
      // App tidak terbuka, langsung kirim notif
      tampilkanNotif();
    } else {
      // App terbuka, tanya dulu apakah sudah CO
      let sudahCO = false;
      const channel = new MessageChannel();
      channel.port1.onmessage = (e) => {
        if (e.data && e.data.checkedOut) sudahCO = true;
        if (!sudahCO) tampilkanNotif();
      };
      list[0].postMessage({ type: 'CEK_CO_STATUS' }, [channel.port2]);
      // Timeout 2 detik, kalau tidak ada respons tetap kirim notif
      setTimeout(() => { if (!sudahCO) tampilkanNotif(); }, 2000);
    }
  });
}

function tampilkanNotif() {
  self.registration.showNotification('⏰ Absensi HOA — Pengingat Check-Out', {
    body: 'Jangan lupa Check-Out! Sudah jam 17:00. Tap untuk membuka aplikasi.',
    icon: 'https://via.placeholder.com/192x192/0a3d62/ffffff?text=HOA',
    badge: 'https://via.placeholder.com/72x72/0a3d62/ffffff?text=HOA',
    tag: 'hoa-checkout-reminder',
    requireInteraction: true,
    vibrate: [200, 100, 200]
  });
}

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => caches.match('/index.html')))
  );
});

// Klik notifikasi -> buka / fokus app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true }).then(list => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});

// Terima push dari server (untuk pengembangan berikutnya)
self.addEventListener('push', e => {
  if (!e.data) return;
  const d = e.data.json();
  e.waitUntil(
    self.registration.showNotification(d.title || 'Absensi HOA', {
      body: d.body || '',
      icon: d.icon || 'https://via.placeholder.com/192x192/0a3d62/ffffff?text=HOA',
      badge:'https://via.placeholder.com/72x72/0a3d62/ffffff?text=HOA',
      tag: d.tag || 'hoa-push',
      requireInteraction: true
    })
  );
});