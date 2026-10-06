import { precacheAndRoute } from 'workbox-precaching'
const sw = self as any
precacheAndRoute(sw.__WB_MANIFEST)
sw.addEventListener('install', () => sw.skipWaiting())
sw.addEventListener('activate', (e: any) => e.waitUntil(sw.clients.claim()))
sw.addEventListener('push', (e: any) => {
  const d = e.data?.json() ?? {}
  e.waitUntil(sw.registration.showNotification(d.title ?? 'Location Moto', { body: d.body, icon: '/icon-192.png' }))
})
sw.addEventListener('notificationclick', (e: any) => { e.notification.close(); e.waitUntil(sw.clients.openWindow('/')) })
