import { supabase } from './supabase'
const toKey = (s: string) => {
  const b = atob((s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(b, c => c.charCodeAt(0))
}
/** Active les notifications push sur cet appareil et enregistre l'abonnement. */
export async function enablePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  if ((await Notification.requestPermission()) !== 'granted') return false
  const reg = await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(import.meta.env.VITE_VAPID_PUBLIC_KEY) as BufferSource }))
  const j = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert({ endpoint: j.endpoint, p256dh: j.keys!.p256dh, auth: j.keys!.auth }, { onConflict: 'endpoint' })
  return !error
}
