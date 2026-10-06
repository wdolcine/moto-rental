import { useEffect, useState } from 'react'
import { supabase } from './supabase'
type Row = Record<string, any>
type Field = [key: string, label: string, type?: string]

function Docs({ ownerId }: { ownerId: string }) {
  const [docs, setDocs] = useState<Row[]>([])
  const load = async () => {
    const { data } = await supabase.from('documents').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false })
    setDocs(await Promise.all((data ?? []).map(async d => ({ ...d, url: (await supabase.storage.from('docs').createSignedUrl(d.path, 3600)).data?.signedUrl }))))
  }
  useEffect(() => { load() }, [ownerId]) // eslint-disable-line
  const upload = async (file?: File) => {
    if (!file) return
    const { data: u } = await supabase.auth.getUser()
    const path = `${u.user!.id}/${ownerId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
    const { error } = await supabase.storage.from('docs').upload(path, file)
    if (error) return alert(error.message)
    await supabase.from('documents').insert({ owner_id: ownerId, name: file.name, path }); load()
  }
  const del = async (d: Row) => { await supabase.storage.from('docs').remove([d.path]); await supabase.from('documents').delete().eq('id', d.id); load() }
  return <div style={{ marginTop: 12 }}>
    <label>Ajouter une photo ou un document (carte grise, permis, pièce d’identité…)</label>
    <input type="file" accept="image/*,application/pdf" onChange={e => { upload(e.target.files?.[0]); e.target.value = '' }} />
    {!docs.length && <p className="mute">Aucun document.</p>}
    {docs.map(d => <div key={d.id} className="row" style={{ marginBottom: 8 }}>
      <a href={d.url} target="_blank" rel="noreferrer" style={{ color: 'inherit', display: 'flex', gap: 10, alignItems: 'center' }}>
        {/\.(jpe?g|png|webp|gif)$/i.test(d.name) && <img src={d.url} alt="" width={56} height={56} style={{ objectFit: 'cover', borderRadius: 6 }} />}{d.name}</a>
      <button className="ghost" onClick={() => del(d)}>Retirer</button></div>)}
  </div>
}

export function Crud({ table, title, fields, rows, reload, label }: { table: string; title: string; fields: Field[]; rows: Row[]; reload: () => void; label: (r: Row) => string }) {
  const blank = { type: 'moto' }
  const [f, setF] = useState<Row>(blank), [editId, setEditId] = useState<string | null>(null), [docsId, setDocsId] = useState<string | null>(null)
  const save = async () => {
    const payload = Object.fromEntries(Object.entries(f).filter(([k]) => k === 'type' ? table === 'vehicles' : !['id', 'user_id', 'created_at'].includes(k)))
    const { error } = editId ? await supabase.from(table).update(payload).eq('id', editId) : await supabase.from(table).insert(payload)
    if (error) return alert(error.message)
    setF(blank); setEditId(null); reload()
  }
  const del = async (id: string) => { if (confirm('Supprimer ?')) { const { error } = await supabase.from(table).delete().eq('id', id); if (error) alert(error.message); reload() } }
  const edit = (r: Row) => { setF(r); setEditId(r.id); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  return <><h1>{title}</h1><div className="card">
    <h2>{editId ? 'Modifier la fiche' : 'Nouvelle fiche'}</h2>
    {table === 'vehicles' && <><label>Type</label><select value={f.type} onChange={e => setF({ ...f, type: e.target.value })}><option value="moto">Moto</option><option value="voiture">Voiture</option></select></>}
    {fields.map(([k, l, t]) => <div key={k}><label>{l}</label><input type={t ?? 'text'} value={f[k] ?? ''} onChange={e => setF({ ...f, [k]: e.target.value || null })} /></div>)}
    <div className="row"><button className="pri" onClick={save}>{editId ? 'Enregistrer' : 'Ajouter'}</button>
      {editId && <button className="ghost" onClick={() => { setF(blank); setEditId(null) }}>Annuler</button>}</div></div>
    {rows.map(r => <div key={r.id} className="card"><div className="row"><span>{label(r)}</span>
      <span style={{ display: 'flex', gap: 6 }}><button className="ghost" onClick={() => setDocsId(docsId === r.id ? null : r.id)}>Documents</button>
        <button className="ghost" onClick={() => edit(r)}>Modifier</button><button className="ghost" onClick={() => del(r.id)}>Supprimer</button></span></div>
      {docsId === r.id && <Docs ownerId={r.id} />}</div>)}</>
}
