// src/hooks/useStreamTracking.js
// Hook that watches an HTMLAudioElement and calls recordStream() when playback
// position reaches 20 seconds in the current track.
//
// How it works:
// 1. You pass it a ref to your <audio> element and the current track object
// 2. On every `timeupdate` event, it checks if currentTime >= 20
// 3. First time it crosses 20s for this track, it fires recordStream() ONCE
// 4. When the track changes, the counted flag resets
//
// For "loop = multiple streams": because `ended` → play again resets currentTime
// to 0, the track crosses 20s again, so it counts again. Loose rate limiting.

import { useEffect, useRef } from 'react'
import { recordStream } from '../lib/tcdApi'

const STREAM_THRESHOLD_SECONDS = 20

export function useStreamTracking(audioRef, currentTrack) {
  const countedForCurrentPlay = useRef(false)
  const lastTrackId = useRef(null)

  useEffect(() => {
    // New track selected or track re-started → reset counted flag
    if (currentTrack?.id !== lastTrackId.current) {
      countedForCurrentPlay.current = false
      lastTrackId.current = currentTrack?.id
    }
  }, [currentTrack?.id])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack) return

    const onTimeUpdate = () => {
      if (countedForCurrentPlay.current) return
      if (audio.currentTime >= STREAM_THRESHOLD_SECONDS) {
        countedForCurrentPlay.current = true
        recordStream(currentTrack.id)
      }
    }

    // When audio ends + loops, currentTime resets → allow counting again
    const onSeekedOrReset = () => {
      if (audio.currentTime < STREAM_THRESHOLD_SECONDS) {
        countedForCurrentPlay.current = false
      }
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('seeked', onSeekedOrReset)
    audio.addEventListener('ended', onSeekedOrReset)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('seeked', onSeekedOrReset)
      audio.removeEventListener('ended', onSeekedOrReset)
    }
  }, [audioRef, currentTrack])
}
