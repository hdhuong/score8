import { supabase } from './supabaseClient'
import type { TournamentRecord } from '../types'

interface DbHistory {
  id: string
  owner: string
  payload: TournamentRecord
  archived_at: string
}

export async function pullHistory(owner: string): Promise<TournamentRecord[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('history_records')
    .select('payload')
    .eq('owner', owner)
  if (error) return null
  return (data as Pick<DbHistory, 'payload'>[]).map((r) => r.payload)
}

/** Bản ghi lưu trữ là bất biến -> bỏ qua nếu id đã tồn tại (không cần quyền update). */
export async function pushHistory(owner: string, records: TournamentRecord[]): Promise<void> {
  if (!supabase || records.length === 0) return
  const rows: DbHistory[] = records.map((r) => ({
    id: r.id,
    owner,
    payload: r,
    archived_at: new Date(r.archivedAt).toISOString(),
  }))
  const { error } = await supabase
    .from('history_records')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
  if (error) throw error
}
