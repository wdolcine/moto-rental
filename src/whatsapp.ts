/** Numéro Haïti à 8 chiffres -> préfixe 509. Sans numéro, WhatsApp laisse choisir le contact. */
export const waLink = (phone: string | null | undefined, text: string) => {
  let n = (phone ?? '').replace(/\D/g, '')
  if (n.length === 8) n = '509' + n
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`
}
export const fr = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('fr-FR', { timeZone: 'UTC' })
const nb = (n: number) => Number(n).toLocaleString('fr-FR')

export const reminderText = (name: string, amount: number, cur: string, plate: string, due: string, late: boolean) =>
  `Bonjour ${name}, rappel : le paiement de ${nb(amount)} ${cur} pour le véhicule ${plate} ${late ? 'était dû' : 'est dû'} le dimanche ${fr(due)}. Merci.`

export const receiptText = (no: string, name: string, amount: number, cur: string, due: string, paidAt: string, rest: number) =>
  `Reçu n° ${no} : ${name}, paiement de ${nb(amount)} ${cur} reçu le ${fr(paidAt)} (échéance du ${fr(due)}). Reste à payer sur le contrat : ${nb(rest)} ${cur}. Merci.`
