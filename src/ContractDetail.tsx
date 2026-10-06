import { useState } from 'react'
import { supabase } from './supabase'
import { waLink, reminderText, receiptText } from './whatsapp'
type Row = Record<string, any>
const today = new Date().toISOString().slice(0, 10)
const money = (n: number, c = 'HTG') => `${Number(n).toLocaleString('fr-FR')} ${c}`
const short = (d?: string | null) => d ? new Date(d + 'T00:00:00Z').toLocaleDateString('fr-FR', { timeZone: 'UTC' }) : '—'
const long = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const sum = (l: Row[]) => l.reduce((t, p) => t + Number(p.amount), 0)

const Info = ({ rows }: { rows: [string, any][] }) => <>
  {rows.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) =>
    <div key={k} className="row" style={{ padding: '3px 0' }}><span className="mute">{k}</span><span style={{ textAlign: 'right' }}>{v}</span></div>)}</>

function Receipt({ c, p, rest, onBack }: { c: Row; p: Row; rest: number; onBack: () => void }) {
  const no = `R-${String(p.week_no).padStart(3, '0')}-${p.id.slice(0, 4).toUpperCase()}`
  const wa = () => window.open(waLink(c.drivers.phone, receiptText(no, c.drivers.full_name, p.amount, c.currency, p.due_date, p.paid_at, rest)), '_blank')
  return <>
    <div className="row noprint" style={{ marginBottom: 8 }}><button className="ghost" onClick={onBack}>← Retour</button>
      <span style={{ display: 'flex', gap: 6 }}><button className="ghost" onClick={wa}>WhatsApp</button><button className="pri" onClick={() => window.print()}>Imprimer / PDF</button></span></div>
    <h1>Reçu de paiement</h1><p className="mute">N° {no} · émis le {short(p.paid_at)}</p>
    <div className="card">
      <Info rows={[['Reçu de', c.drivers.full_name], ['Véhicule', `${c.vehicles.type} ${c.vehicles.brand ?? ''} ${c.vehicles.model ?? ''} · ${c.vehicles.plate ?? ''}`],
        ['Échéance', long(p.due_date)], ['Paiement n°', p.week_no], ['Date de paiement', short(p.paid_at)], ['Reste à payer sur le contrat', money(rest, c.currency)]]} />
      <div className="row" style={{ marginTop: 14 }}><h2>Montant reçu</h2><h2>{money(p.amount, c.currency)}</h2></div></div>
    <div className="printonly" style={{ display: 'none', marginTop: 40 }}><span>Signature du propriétaire : ____________________</span></div>
  </>
}

export function ContractDetail({ c, payments, reload, onBack }: { c: Row; payments: Row[]; reload: () => void; onBack: () => void }) {
  const [receipt, setReceipt] = useState<Row | null>(null)
  const ps = [...payments].sort((a, b) => a.due_date.localeCompare(b.due_date))
  const paid = ps.filter(p => p.paid_at), late = ps.filter(p => !p.paid_at && p.due_date < today)
  const next = ps.find(p => !p.paid_at && p.due_date >= today)
  const total = sum(ps), received = sum(paid)
  const toggle = async (p: Row) => { await supabase.from('payments').update({ paid_at: p.paid_at ? null : today }).eq('id', p.id); reload() }
  const status = (p: Row) => p.paid_at ? 'Payé' : p.due_date < today ? 'En retard' : 'À venir'
  const v = c.vehicles, d = c.drivers
  if (receipt) return <Receipt c={c} p={receipt} rest={total - received} onBack={() => setReceipt(null)} />

  return <>
    <div className="row noprint" style={{ marginBottom: 8 }}>
      <button className="ghost" onClick={onBack}>← Retour</button>
      <button className="pri" onClick={() => window.print()}>Imprimer / PDF</button></div>
    <h1>Contrat de location · {d.full_name}</h1>
    <p className="mute">Édité le {short(today)} · paiement chaque dimanche</p>

    <div className="card"><h2>Résumé</h2>
      <Info rows={[['Total du contrat', money(total, c.currency)], ['Encaissé', money(received, c.currency)], ['Reste à payer', money(total - received, c.currency)],
        ['En retard', late.length ? `${late.length} semaine(s) · ${money(sum(late), c.currency)}` : 'Aucun'],
        ['Prochain paiement', next ? `${long(next.due_date)} · ${money(next.amount, c.currency)}` : 'Aucun'], ['Progression', `${paid.length}/${ps.length} paiements`]]} />
      <div className="bar"><i style={{ width: `${ps.length ? (paid.length / ps.length) * 100 : 0}%` }} /></div></div>

    <div className="card"><h2>Contrat</h2>
      <Info rows={[['Début', long(c.start_date)], ['Fin', long(c.end_date)], ['Nombre de paiements', ps.length], ['Montant hebdomadaire', money(c.weekly_amount, c.currency)], ['Caution', c.deposit ? money(c.deposit, c.currency) : '']]} /></div>

    <div className="card"><h2>Chauffeur</h2>
      <Info rows={[['Nom', d.full_name], ['Téléphone', d.phone], ['Adresse', d.address], ['N° de permis', d.license_no], ['Pièce d’identité', d.id_doc], ['Garant', d.guarantor], ['Notes', d.notes]]} /></div>

    <div className="card"><h2>Véhicule</h2>
      <Info rows={[['Type', v.type], ['Marque', v.brand], ['Modèle', v.model], ['Année', v.year], ['Plaque', v.plate], ['N° de châssis', v.vin], ['Couleur', v.color], ['Kilométrage', v.mileage ? `${Number(v.mileage).toLocaleString('fr-FR')} km` : ''], ['Notes', v.notes]]} /></div>

    <div className="card"><h2>Échéancier</h2>
      <div style={{ overflowX: 'auto' }}><table>
        <thead><tr><th>N°</th><th>Dimanche</th><th>Montant</th><th>Statut</th><th>Payé le</th><th className="noprint"></th></tr></thead>
        <tbody>{ps.map(p => <tr key={p.id} style={p.due_date < today && !p.paid_at ? { color: 'var(--bad)', fontWeight: 600 } : undefined}>
          <td>{p.week_no}</td><td>{short(p.due_date)}</td><td>{money(p.amount, c.currency)}</td><td>{status(p)}</td><td>{short(p.paid_at)}</td>
          <td className="noprint"><span style={{ display: 'flex', gap: 6 }}>
            {p.paid_at ? <button className="pri" onClick={() => setReceipt(p)}>Reçu</button>
              : <><button className="ghost" onClick={() => window.open(waLink(d.phone, reminderText(d.full_name, p.amount, c.currency, v.plate ?? '', p.due_date, p.due_date < today)), '_blank')}>WhatsApp</button></>}
            <button className="ghost" onClick={() => toggle(p)}>{p.paid_at ? 'Annuler' : 'Marquer payé'}</button></span></td></tr>)}</tbody>
        <tfoot><tr><th colSpan={2}>Total</th><th colSpan={4}>{money(total, c.currency)}</th></tr></tfoot></table></div></div>

    <div className="printonly" style={{ display: 'none', marginTop: 40 }}>
      <div className="row"><span>Signature du propriétaire : ____________________</span><span>Signature du chauffeur : ____________________</span></div></div>
  </>
}
