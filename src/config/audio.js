const SUPABASE_URL = 'https://mqyqqqwnyyjbawnfzzrm.supabase.co'
const AUDIO_BUCKET = 'audio'
const AUDIO_FOLDER = 'audio'

export const withAudioBase = (path) => {
  const cleanPath = String(path).replace(/^\/assets\/audio\//, '')
  return `${SUPABASE_URL}/storage/v1/object/public/${AUDIO_BUCKET}/${AUDIO_FOLDER}/${encodeURIComponent(cleanPath).replace(/%2F/g, '/')}`
}
