// src/lib/supabase.js
// Supabase client singleton. Uses the public anon key (safe to expose in frontend).
// The RLS policies in schema.sql are what actually protect the database.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://mqyqqqwnyyjbawnfzzrm.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xeXFxcXdueXlqYmF3bmZ6enJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NzMxMjcsImV4cCI6MjA5MDM0OTEyN30._A_RYR9NuC7XA5tC2E5IF882q3shU9zlwWwmBNxBj2o' // paste from Supabase → Settings → API → anon public

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false }, // we handle our own sessions via localStorage UUID
})

// --- Session management ---
// A UUID is generated once per browser and stored in localStorage forever.
// This is how we identify "unique listeners" without accounts or fingerprinting.

const SESSION_KEY = 'tcd_session_id'

export function getSessionId() {
  let id = localStorage.getItem(SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, id)
  }
  return id
}
