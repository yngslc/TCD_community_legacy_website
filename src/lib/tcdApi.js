// src/lib/tcdApi.js
// All backend interactions live here. App.jsx imports from this file only.
// Separates the "what does the backend do" from "how is the UI built".
//
// Security posture:
// - Supabase JS uses parameterized queries (no SQL-injection surface).
// - RLS policies in schema.sql are the authoritative access control.
// - This module adds defense-in-depth: strict input validation, bounded
//   limits, client-side abuse throttling, and sanitized error logs.

import { supabase, getSessionId } from './supabase'

// ============================================================================
// INPUT VALIDATION
// ============================================================================

// Track IDs in this app look like "GR-1", "YU-5", "SK-1". Keep it strict.
const TRACK_ID_RE = /^[A-Za-z0-9-]{1,32}$/

function isValidTrackId(id) {
  return typeof id === 'string' && TRACK_ID_RE.test(id)
}

// Sanitize a Supabase error before logging — don't leak full response bodies.
function logErr(tag, error) {
  if (!error) return
  const msg = typeof error?.message === 'string' ? error.message.slice(0, 200) : 'unknown'
  // eslint-disable-next-line no-console
  console.error(`[tcdApi:${tag}]`, msg)
}

// ============================================================================
// STREAMS
// ============================================================================

// Client-side throttle: discourages trivial spam via dev tools.
// Server-side rate-limits / RLS remain the authoritative protection.
const MIN_STREAM_GAP_MS = 15_000 // must be < STREAM_THRESHOLD_SECONDS in the hook
const lastStreamAt = new Map() // trackId -> epoch ms

/**
 * Record a stream. Call this when audio playback reaches the 20-second mark.
 * Do NOT call on every play click — only when 20s is actually reached.
 * One call = one stream count. Looping a track counts each loop separately.
 */
export async function recordStream(trackId) {
  if (!isValidTrackId(trackId)) return false

  const now = Date.now()
  const prev = lastStreamAt.get(trackId) || 0
  if (now - prev < MIN_STREAM_GAP_MS) return false
  lastStreamAt.set(trackId, now)

  const session_id = getSessionId()
  const { error } = await supabase
    .from('streams')
    .insert({ track_id: trackId, session_id })
  if (error) logErr('recordStream', error)
  return !error
}

// ============================================================================
// LIKES
// ============================================================================

// Prevent double-fire from rapid clicks racing the round-trip.
const likeInFlight = new Set()

/**
 * Toggle a like on/off for the current session.
 * Returns the new liked state (true = now liked, false = now unliked, null = rejected).
 */
export async function toggleLike(trackId) {
  if (!isValidTrackId(trackId)) return null
  if (likeInFlight.has(trackId)) return null
  likeInFlight.add(trackId)

  try {
    const session_id = getSessionId()

    // Check if already liked
    const { data: existing, error: selErr } = await supabase
      .from('likes')
      .select('id')
      .eq('track_id', trackId)
      .eq('session_id', session_id)
      .maybeSingle()
    if (selErr) { logErr('toggleLike.select', selErr); return null }

    if (existing) {
      const { error } = await supabase.from('likes').delete().eq('id', existing.id)
      if (error) { logErr('toggleLike.delete', error); return null }
      return false
    }
    const { error } = await supabase.from('likes').insert({ track_id: trackId, session_id })
    if (error) { logErr('toggleLike.insert', error); return null }
    return true
  } finally {
    likeInFlight.delete(trackId)
  }
}

/**
 * Fetch which tracks the current session has liked.
 * Returns a Set of track IDs for fast lookup.
 */
export async function fetchMyLikes() {
  const session_id = getSessionId()
  const { data, error } = await supabase
    .from('likes')
    .select('track_id')
    .eq('session_id', session_id)
  if (error) { logErr('fetchMyLikes', error); return new Set() }
  // Filter to known-good IDs so a poisoned row can't flow into the UI.
  return new Set(data.filter(r => isValidTrackId(r.track_id)).map(r => r.track_id))
}

// ============================================================================
// LEADERBOARD / STATS
// ============================================================================

/**
 * Fetch all track stats (stream count + like count) in one query.
 * Returns an object: { 'GR-1': { streams: 42, likes: 7 }, ... }
 * Call this once on page load, refresh only when user opens/closes folders.
 */
export async function fetchTrackStats() {
  const { data, error } = await supabase
    .from('track_stats')
    .select('track_id, stream_count, like_count')
  if (error) { logErr('fetchTrackStats', error); return {} }
  const stats = {}
  for (const row of data) {
    if (!isValidTrackId(row.track_id)) continue
    stats[row.track_id] = {
      streams: Math.max(0, Number(row.stream_count) || 0),
      likes: Math.max(0, Number(row.like_count) || 0),
    }
  }
  return stats
}

/**
 * Top N most-streamed tracks. Used for the Most Streamed panel.
 */
export async function fetchTopStreamed(limit = 10) {
  // Clamp to a sane range — never trust the caller to set this.
  const n = Math.min(100, Math.max(1, Math.floor(Number(limit)) || 10))
  const { data, error } = await supabase
    .from('track_stats')
    .select('track_id, stream_count')
    .order('stream_count', { ascending: false })
    .limit(n)
  if (error) { logErr('fetchTopStreamed', error); return [] }
  return data
    .filter(r => isValidTrackId(r.track_id))
    .map(r => ({ track_id: r.track_id, streams: Math.max(0, Number(r.stream_count) || 0) }))
}
