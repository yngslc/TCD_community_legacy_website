// src/lib/supabase.js
// Supabase client singleton. Uses the public anon key (safe to expose in frontend).
// The RLS policies in schema.sql are what actually protect the database.

import { createClient } from '@supabase/supabase-js'

// Env-first with safe fallback. Rotate via VITE_SUPABASE_* without code change.
const SUPABASE_URL =
  import.meta.env?.VITE_SUPABASE_URL || 'https://mqyqqqwnyyjbawnfzzrm.supabase.co'
const SUPABASE_ANON_KEY =
  import.meta.env?.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xeXFxcXdueXlqYmF3bmZ6enJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NzMxMjcsImV4cCI6MjA5MDM0OTEyN30._A_RYR9NuC7XA5tC2E5IF882q3shU9zlwWwmBNxBj2o'

// Defense-in-depth: ensure the configured URL really is the expected Supabase host.
// Blocks accidental/malicious override pointing the client at an attacker-controlled host.
const ALLOWED_HOST = 'mqyqqqwnyyjbawnfzzrm.supabase.co'
try {
  const u = new URL(SUPABASE_URL)
  if (u.protocol !== 'https:' || u.hostname !== ALLOWED_HOST) {
    throw new Error('Supabase URL rejected by allowlist')
  }
} catch {
  throw new Error('Invalid SUPABASE_URL configuration')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false }, // we handle our own sessions via localStorage UUID
  global: { headers: { 'X-Client-Info': 'tcd-web' } },
})

// --- Session management ---
// A UUID is generated once per browser and stored in localStorage forever.
// This is how we identify "unique listeners" without accounts or fingerprinting.

const SESSION_KEY = 'tcd_session_id'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// crypto.randomUUID is available in every modern browser; polyfill just in case.
function newUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // RFC4122 v4 fallback using crypto.getRandomValues
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

let cachedSessionId = null

export function getSessionId() {
  if (cachedSessionId) return cachedSessionId
  let id = null
  try {
    id = localStorage.getItem(SESSION_KEY)
  } catch {
    // localStorage disabled (private mode, cookie block) — fall through to in-memory id
  }
  // Validate the stored value. Anything not a UUID gets replaced — prevents
  // an attacker (or buggy extension) from pinning a chosen session string.
  if (!id || typeof id !== 'string' || !UUID_RE.test(id)) {
    id = newUUID()
    try {
      localStorage.setItem(SESSION_KEY, id)
    } catch {
      // ignore — id still works for this tab's lifetime
    }
  }
  cachedSessionId = id
  return id
}
