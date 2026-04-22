// src/config/audio.js
// Resolve a track's relative path to a public Supabase Storage URL.
// Hardens against path-traversal / URL-injection via the `path` argument.

const SUPABASE_URL = 'https://mqyqqqwnyyjbawnfzzrm.supabase.co'
const AUDIO_BUCKET = 'audio'
const AUDIO_FOLDER = 'audio'

// Allowed characters inside a track path segment.
// Real filenames contain letters, digits, spaces, and: - _ . ( ) ! '
const SAFE_SEGMENT_RE = /^[A-Za-z0-9 !'()._\-]+$/
const ALLOWED_EXT = new Set(['mp3', 'wav', 'm4a', 'ogg'])

export const withAudioBase = (path) => {
  if (typeof path !== 'string' || path.length === 0 || path.length > 512) {
    throw new Error('Invalid audio path')
  }

  // Normalize: strip the optional /assets/audio/ prefix, leading slashes, and backslashes.
  const cleanPath = path
    .replace(/^\/assets\/audio\//, '')
    .replace(/^\/+/, '')
    .replace(/\\/g, '/')

  // Reject traversal, absolute URLs, protocol-relative URLs, and control chars.
  // eslint-disable-next-line no-control-regex
  if (/(^|\/)\.\.(\/|$)/.test(cleanPath) || /[\x00-\x1f]/.test(cleanPath)) {
    throw new Error('Invalid audio path')
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(cleanPath) || cleanPath.startsWith('//')) {
    throw new Error('Invalid audio path')
  }

  // Validate every segment against the allowlist.
  const segments = cleanPath.split('/')
  for (const seg of segments) {
    if (!seg || !SAFE_SEGMENT_RE.test(seg)) throw new Error('Invalid audio path')
  }

  // Extension allowlist on the final segment.
  const last = segments[segments.length - 1]
  const ext = last.includes('.') ? last.split('.').pop().toLowerCase() : ''
  if (!ALLOWED_EXT.has(ext)) throw new Error('Unsupported audio extension')

  // Encode each segment individually; '/' separators are preserved by design.
  const encoded = segments.map(encodeURIComponent).join('/')
  return `${SUPABASE_URL}/storage/v1/object/public/${AUDIO_BUCKET}/${AUDIO_FOLDER}/${encoded}`
}
