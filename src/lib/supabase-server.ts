import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Lazy initialization to avoid build-time errors
let supabaseAdmin: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (supabaseAdmin) return supabaseAdmin
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url || !key) {
    throw new Error('Missing Supabase environment variables')
  }
  
  supabaseAdmin = createClient(url, key)
  return supabaseAdmin
}

// For routes that need graceful fallback when DB is unavailable
export function getSupabaseAdminSafe(): SupabaseClient | null {
  try {
    return getSupabaseAdmin()
  } catch {
    return null
  }
}

// Alias for backward compatibility
export async function createServerSupabaseClient(): Promise<SupabaseClient> {
  return getSupabaseAdmin()
}
