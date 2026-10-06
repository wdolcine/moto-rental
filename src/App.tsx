import { useEffect, useState, useCallback } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, configOk } from './supabase'
import { Crud } from './Crud'
import { ContractDetail } from './ContractDetail'
import { enablePush } from './push'
import { waLink, reminderText } from './whatsapp'
import { addMonths, buildSchedule, countWeeks, iso, toICS } from './schedule'

type Row = Record<string, any>
type Field = [key: string, label: string, type?: string]
type Tab = 'echeances' | 'contrats' | 'vehicules' | 'chauffeurs'

const VEHICLE_FIELDS: Field[] = [['brand', 'Marque'], ['model', 'Modèle'], ['year', 'Année', 'number'], ['plate', 'Plaque'], ['vin', 'N° de châssis'], ['color', 'Couleur'], ['mileage', 'Kilométrage', 'number'], ['notes', 'Notes']]
const DRIVER_FIELDS: Field[] = [['full_name', 'Nom complet'], ['phone', 'Téléphone', 'tel'], ['address', 'Adresse'], ['license_no', 'N° de permis'], ['id_doc', 'N° pièce d’identité'], ['guarantor', 'Garant'], ['notes', 'Notes']]
const today = iso(new Date())
const money = (n: number, c = 'HTG') => `${Number(n).toLocaleString('fr-FR')} ${c}`

const frError = (m: string) =>
  /invalid login/i.test(m) ? 'E-mail ou mot de passe incorrect.'
  : /not confirmed/i.test(m) ? 'E-mail non confirmé. Dans Supabase : Authentication > Users, confirmez l’utilisateur.'
  : /fetch|network/i.test(m) ? 'Connexion impossible. Vérifiez VITE_SUPABASE_URL et votre réseau.'
  : m

function Auth() {
  const [email, setEmail] = useState(''), [password, setPassword] = useState('')
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false), [show, setShow] = useState(false)
  const login = async (e: { preventDefault(): void }) => {
    e.preventDefault(); setErr(''); setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setErr(frError(error.message))
  }
  if (!configOk) return <main><h1>Location Moto</h1><div className="card late"><h2>Configuration manquante</h2>
    <p className="mute">Ajoutez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY (fichier .env ou variables Vercel), puis redéployez.</p></div></main>
  return <main><h1>Connexion</h1><form className="card" onSubmit={login}>
    <label htmlFor="email">E-mail</label>
    <input id="email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} />
    <label htmlFor="pwd">Mot de passe</label>
    <input id="pwd" type={show ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
    <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" style={{ width: 'auto', margin: 0 }} checked={show} onChange={e => setShow(e.target.checked)} />Afficher le mot de passe</label>
    {err && <p role="alert" style={{ color: 'var(--bad)' }}>{err}</p>}
    <button className="pri" type="submit" disabled={busy} style={{ marginTop: 10, width: '100%' }}>{busy ? 'Connexion…' : 'Se connecter'}</button>
  </form></main>
}

function Echeances({ contracts, payments, reload }: { contracts: Row[]; payments: Row[]; reload: () => void }) {
  const due = payments.filter(p => !p.paid_at && p.due_date <= addDaysStr(7)).sort((a, b) => a.due_date.localeCompare(b.due_date))
  const pay = async (id: string) => { await supabase.from('payments').update({ paid_at: today }).eq('id', id); reload() }
  const notify = async () => {
    if (Notification.permission === 'default') await Notification.requestPermission()
    if (Notification.permission === 'granted') new Notification('Location Moto', { body: `${due.length} paiement(s) à encaisser cette semaine` })
  }
  useEffect(() => { if (due.length && Notification.permission === 'granted') notify() }, [payments.length]) // eslint-disable-line
  return <><h1>À encaisser</h1>
    <button className="ghost" style={{ marginBottom: 12 }} onClick={async () => alert((await enablePush()) ? 'Rappels activés sur cet appareil' : 'Impossible d’activer les notifications')}>Activer les rappels automatiques</button>
    {!due.length && <p className="mute">Aucun paiement attendu dans les 7 prochains jours.</p>}
    {due.map(p => { const c = contracts.find(c => c.id === p.contract_id)!
      return <div key={p.id} className={`card ${p.due_date < today ? 'late' : p.due_date === today ? 'today' : ''}`}><div className="row">
        <div><h2>{c?.drivers?.full_name}</h2><span className="mute">{c?.vehicles?.plate} · semaine {p.week_no} · {p.due_date < today ? 'en retard depuis le ' : 'le '}{p.due_date}</span></div>
        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className="ghost" onClick={() => window.open(waLink(c?.drivers?.phone, reminderText(c?.drivers?.full_name ?? '', p.amount, c?.currency ?? 'HTG', c?.vehicles?.plate ?? '', p.due_date, p.due_date < today)), '_blank')}>WhatsApp</button>
          <button className="pri" onClick={() => pay(p.id)}>{money(p.amount, c?.currency)} payé</button></span></div></div> })}
  </>
}
const addDaysStr = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d) }

function Contrats({ contracts, payments, vehicles, drivers, reload, onOpen }: { onOpen: (id: string) => void; contracts: Row[]; payments: Row[]; vehicles: Row[]; drivers: Row[]; reload: () => void }) {
  const blank: Row = { start_date: today, end_date: addMonths(today, 13), currency: 'HTG', deposit: 0 }
  const [f, setF] = useState<Row>(blank), [editId, setEditId] = useState<string | null>(null)
  const set = (k: string, v: any) => setF(s => ({ ...s, [k]: v }))
  const weeks = countWeeks(f.start_date, f.end_date), nbPay = buildSchedule(f.start_date, f.end_date, 1).length
  const reset = () => { setF(blank); setEditId(null) }
  const edit = (c: Row) => {
    setF({ vehicle_id: c.vehicle_id, driver_id: c.driver_id, start_date: c.start_date, end_date: c.end_date, weekly_amount: c.weekly_amount, deposit: c.deposit, currency: c.currency })
    setEditId(c.id); window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const save = async () => {
    const fields = { vehicle_id: f.vehicle_id, driver_id: f.driver_id, start_date: f.start_date, end_date: f.end_date, weekly_amount: f.weekly_amount, deposit: f.deposit, currency: f.currency }
    if (!editId) {
      const { data, error } = await supabase.from('contracts').insert(fields).select().single()
      if (error) return alert(error.message)
      await supabase.from('payments').insert(buildSchedule(f.start_date, f.end_date, Number(f.weekly_amount)).map(p => ({ ...p, contract_id: data.id })))
      reset(); return reload()
    }
    const old = contracts.find(c => c.id === editId)!
    const changed = old.start_date !== f.start_date || old.end_date !== f.end_date || Number(old.weekly_amount) !== Number(f.weekly_amount) || payments.some(p => p.contract_id === editId && !p.paid_at && new Date(p.due_date + 'T00:00:00Z').getUTCDay() !== 0)
    if (changed && !confirm('Les échéances non payées seront recalculées. Les paiements déjà encaissés sont conservés. Continuer ?')) return
    const { error } = await supabase.from('contracts').update(fields).eq('id', editId)
    if (error) return alert(error.message)
    if (changed) {
      const kept = new Set(payments.filter(p => p.contract_id === editId && p.paid_at).map(p => p.week_no))
      await supabase.from('payments').delete().eq('contract_id', editId).is('paid_at', null)
      const rows = buildSchedule(f.start_date, f.end_date, Number(f.weekly_amount)).filter(p => !kept.has(p.week_no)).map(p => ({ ...p, contract_id: editId }))
      if (rows.length) await supabase.from('payments').insert(rows)
    }
    reset(); reload()
  }
  const del = async (c: Row) => {
    if (!confirm(`Supprimer le contrat de ${c.drivers.full_name} (${c.vehicles.plate}) ? Toutes ses échéances seront aussi supprimées.`)) return
    const { error } = await supabase.from('contracts').delete().eq('id', c.id)
    if (error) return alert(error.message)
    if (editId === c.id) reset()
    reload()
  }
  const ics = (c: Row) => { const rows = payments.filter(p => p.contract_id === c.id)
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([toICS(`Paiement ${c.drivers.full_name}`, rows)], { type: 'text/calendar' })); a.download = 'rappels.ics'; a.click() }
  return <><h1>Contrats</h1>
    <div className="card"><h2>{editId ? 'Modifier le contrat' : 'Nouveau contrat'}</h2>
      <label>Véhicule</label><select value={f.vehicle_id ?? ''} onChange={e => set('vehicle_id', e.target.value)}><option value="">Choisir…</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.type} {v.brand} {v.plate}</option>)}</select>
      <label>Chauffeur</label><select value={f.driver_id ?? ''} onChange={e => set('driver_id', e.target.value)}><option value="">Choisir…</option>{drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}</select>
      <label>Début</label><input type="date" value={f.start_date} onChange={e => { set('start_date', e.target.value); if (!editId) set('end_date', addMonths(e.target.value, 13)) }} />
      <label>Fin (13 mois par défaut)</label><input type="date" value={f.end_date} onChange={e => set('end_date', e.target.value)} />
      <label>Montant par semaine</label><input type="number" value={f.weekly_amount ?? ''} onChange={e => set('weekly_amount', e.target.value)} />
      <label>Caution</label><input type="number" value={f.deposit ?? 0} onChange={e => set('deposit', e.target.value)} />
      <p><b>{weeks} semaines</b> de contrat · <b>{nbPay} paiements</b>, chaque dimanche{f.weekly_amount ? ` · total ${money(nbPay * f.weekly_amount, f.currency)}` : ''}</p>
      <div className="row"><button className="pri" disabled={!f.vehicle_id || !f.driver_id || !f.weekly_amount} onClick={save}>{editId ? 'Enregistrer' : 'Créer le contrat'}</button>
        {editId && <button className="ghost" onClick={reset}>Annuler</button>}</div></div>
    {contracts.map(c => { const ps = payments.filter(p => p.contract_id === c.id), paid = ps.filter(p => p.paid_at).length
      return <div key={c.id} className="card"><h2>{c.drivers.full_name} · {c.vehicles.plate}</h2>
        <span className="mute">{c.start_date} → {c.end_date} · {money(c.weekly_amount, c.currency)}/sem.</span>
        <div className="bar"><i style={{ width: `${ps.length ? (paid / ps.length) * 100 : 0}%` }} /></div><span className="mute">{paid}/{ps.length} semaines payées</span>
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}><button className="pri" onClick={() => onOpen(c.id)}>Détails</button><button className="ghost" onClick={() => edit(c)}>Modifier</button>
          <button className="ghost" onClick={() => ics(c)}>Rappels .ics</button><button className="ghost" onClick={() => del(c)}>Supprimer</button></div></div> })}
  </>
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null), [tab, setTab] = useState<Tab>('echeances'), [detailId, setDetailId] = useState<string | null>(null)
  const [vehicles, setV] = useState<Row[]>([]), [drivers, setD] = useState<Row[]>([]), [contracts, setC] = useState<Row[]>([]), [payments, setP] = useState<Row[]>([])
  useEffect(() => { supabase.auth.getSession().then(({ data }) => setSession(data.session)); const { data } = supabase.auth.onAuthStateChange((_, s) => setSession(s)); return () => data.subscription.unsubscribe() }, [])
  const reload = useCallback(async () => {
    const [v, d, c, p] = await Promise.all([supabase.from('vehicles').select('*').order('created_at'), supabase.from('drivers').select('*').order('created_at'),
      supabase.from('contracts').select('*, vehicles(*), drivers(*)').order('created_at', { ascending: false }), supabase.from('payments').select('*')])
    setV(v.data ?? []); setD(d.data ?? []); setC(c.data ?? []); setP(p.data ?? [])
  }, [])
  useEffect(() => { if (session) reload() }, [session, reload])
  if (!session) return <Auth />
  const detail = contracts.find(c => c.id === detailId)
  if (detail) return <main><ContractDetail c={detail} payments={payments.filter(p => p.contract_id === detail.id)} reload={reload} onBack={() => setDetailId(null)} /></main>
  const tabs: [Tab, string][] = [['echeances', 'Échéances'], ['contrats', 'Contrats'], ['vehicules', 'Véhicules'], ['chauffeurs', 'Chauffeurs']]
  return <><main>
    {tab === 'echeances' && <Echeances contracts={contracts} payments={payments} reload={reload} />}
    {tab === 'contrats' && <Contrats onOpen={setDetailId} contracts={contracts} payments={payments} vehicles={vehicles} drivers={drivers} reload={reload} />}
    {tab === 'vehicules' && <Crud table="vehicles" title="Véhicules" fields={VEHICLE_FIELDS} rows={vehicles} reload={reload} label={r => `${r.type} · ${r.brand ?? ''} ${r.model ?? ''} · ${r.plate ?? ''}`} />}
    {tab === 'chauffeurs' && <Crud table="drivers" title="Chauffeurs" fields={DRIVER_FIELDS} rows={drivers} reload={reload} label={r => `${r.full_name} · ${r.phone ?? ''}`} />}
    <button className="ghost" onClick={() => supabase.auth.signOut()}>Se déconnecter</button></main>
    <nav>{tabs.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</nav></>
}
