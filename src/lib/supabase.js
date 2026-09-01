import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ewoosbfqglbnocoguboy.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_gGzcRYfq7aEJYyrEU_-CPQ_B_yNaEOR'

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
