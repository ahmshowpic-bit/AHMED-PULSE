// Service Worker لتمكين ميزة التثبيت على الهاتف
const CACHE_NAME = 'ahmed-pulse-v1';

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installed');
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activated');
});

self.addEventListener('fetch', (event) => {
  // يضمن هذا السطر عمل الموقع بشكل طبيعي من الإنترنت
  event.respondWith(fetch(event.request));
});
