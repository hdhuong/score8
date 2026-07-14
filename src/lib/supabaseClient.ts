import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * true nếu app được build/chạy với env vars Supabase. Khi false, mọi hàm
 * trong sync.ts trở thành no-op -> app vẫn hoạt động 100% offline (local-first).
 */
export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = isSupabaseConfigured ? createClient(url!, anonKey!) : null
