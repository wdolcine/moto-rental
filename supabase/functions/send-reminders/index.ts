import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: () => Response | Promise<Response>): void
}

webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!)

Deno.serve(async () => {
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const limit = new Date(Date.now() + 864e5).toISOString().slice(0, 10) // échéances jusqu'à demain
  const { data: pays } = await db.from('payments')
    .select('user_id, due_date, amount, contracts(currency, drivers(full_name))')
    .is('paid_at', null).lte('due_date', limit).order('due_date')
  const byUser = new Map<string, any[]>()
  for (const p of pays ?? []) byUser.set(p.user_id, [...(byUser.get(p.user_id) ?? []), p])

  let sent = 0
  for (const [uid, list] of byUser) {
    const { data: subs } = await db.from('push_subscriptions').select('*').eq('user_id', uid)
    const late = list.filter(p => p.due_date < new Date().toISOString().slice(0, 10)).length
    const body = list.slice(0, 3).map((p: any) => `${p.contracts.drivers.full_name} : ${p.amount} ${p.contracts.currency} (${p.due_date})`).join('\n')
      + (list.length > 3 ? `\n+ ${list.length - 3} autre(s)` : '')
    const payload = JSON.stringify({ title: `${list.length} paiement(s) à encaisser${late ? ` dont ${late} en retard` : ''}`, body })
    for (const s of subs ?? []) {
      try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload); sent++ }
      catch (e: any) { if (e.statusCode === 404 || e.statusCode === 410) await db.from('push_subscriptions').delete().eq('id', s.id) }
    }
  }
  return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } })
})
