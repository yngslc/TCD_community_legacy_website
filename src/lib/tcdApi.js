// src/lib/tcdApi.js
// All backend interactions live here. App.jsx imports from this file only.
// Separates the "what does the backend do" from "how is the UI built".

import { supabase, getSessionId } from './supabase'

// ============================================================================
// STREAMS
// ============================================================================

/**
 * Record a stream. Call this when audio playback reaches the 20-second mark.
 * Do NOT call on every play click — only when 20s is actually reached.
 * One call = one stream count. Looping a track counts each loop separately.
 */
export async function recordStream(trackId) {
  const session_id = getSessionId()
  const { error } = await supabase
    .from('streams')
    .insert({ track_id: trackId, session_id })
  if (error) console.error('Stream record failed:', error.message)
  return !error
}

// ============================================================================
// LIKES
// ============================================================================

/**
 * Toggle a like on/off for the current session.
 * Returns the new liked state (true = now liked, false = now unliked).
 */
export async function toggleLike(trackId) {
  const session_id = getSessionId()

  // Check if already liked
  const { data: existing } = await supabase
    .from('likes')
    .select('id')
    .eq('track_id', trackId)
    .eq('session_id', session_id)
    .maybeSingle()

  if (existing) {
    // Unlike
    await supabase.from('likes').delete().eq('id', existing.id)
    return false
  } else {
    // Like
    await supabase.from('likes').insert({ track_id: trackId, session_id })
    return true
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
  if (error) { console.error(error); return new Set() }
  return new Set(data.map(r => r.track_id))
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
  if (error) { console.error(error); return {} }
  const stats = {}
  for (const row of data) {
    stats[row.track_id] = {
      streams: Number(row.stream_count) || 0,
      likes: Number(row.like_count) || 0,
    }
  }
  return stats
}

/**
 * Top N most-streamed tracks. Used for the Most Streamed panel.
 */
export async function fetchTopStreamed(limit = 10) {
  const { data, error } = await supabase
    .from('track_stats')
    .select('track_id, stream_count')
    .order('stream_count', { ascending: false })
    .limit(limit)
  if (error) { console.error(error); return [] }
  return data.map(r => ({ track_id: r.track_id, streams: Number(r.stream_count) || 0 }))
}
