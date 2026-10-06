import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
/** false si les variables d'environnement manquent (évite l'écran blanc). */
export const configOk = Boolean(url && key)
export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing')
