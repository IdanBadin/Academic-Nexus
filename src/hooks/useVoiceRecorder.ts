import { useCallback, useEffect, useRef, useState } from 'react'

interface VoiceRecorder {
  isRecording: boolean
  seconds: number
  error: string | null
  start: () => Promise<void>
  /** Resolves with the recording, or null if nothing was captured. */
  stop: () => Promise<Blob | null>
}

/** Picks a container the browser will actually record in. Safari wants mp4. */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
  return candidates.find((type) => MediaRecorder.isTypeSupported(type))
}

function describeMicError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'The mic is blocked. Allow microphone access for this site in your browser settings, then try again.'
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No microphone found. Plug one in or pick a different input device.'
  }
  if (name === 'NotReadableError') {
    return 'Another app is using the mic. Close it and try again.'
  }
  return 'Could not start recording. Check that your browser allows mic access on this page.'
}

export function useVoiceRecorder(): VoiceRecorder {
  const [isRecording, setIsRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const tickRef = useRef<number | null>(null)

  // Every exit path goes through here, so the mic indicator never stays lit.
  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current)
      tickRef.current = null
    }
  }, [])

  useEffect(() => releaseStream, [releaseStream])

  const start = useCallback(async () => {
    setError(null)

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('This browser cannot record audio. Try Chrome, Edge, or Safari.')
      return
    }
    if (recorderRef.current) return

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      setError(describeMicError(err))
      return
    }

    const mimeType = pickMimeType()
    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    } catch {
      stream.getTracks().forEach((track) => track.stop())
      setError('This browser cannot record audio in a format we can send.')
      return
    }

    chunksRef.current = []
    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    })

    streamRef.current = stream
    recorderRef.current = recorder
    recorder.start()

    setSeconds(0)
    setIsRecording(true)
    tickRef.current = window.setInterval(() => setSeconds((value) => value + 1), 1000)
  }, [])

  const stop = useCallback(async (): Promise<Blob | null> => {
    const recorder = recorderRef.current
    if (!recorder) return null

    const blob = await new Promise<Blob | null>((resolve) => {
      recorder.addEventListener(
        'stop',
        () => {
          const chunks = chunksRef.current
          chunksRef.current = []
          resolve(
            chunks.length > 0 ? new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }) : null
          )
        },
        { once: true }
      )

      try {
        if (recorder.state !== 'inactive') recorder.stop()
        else resolve(null)
      } catch {
        resolve(null)
      }
    })

    recorderRef.current = null
    releaseStream()
    setIsRecording(false)

    return blob
  }, [releaseStream])

  return { isRecording, seconds, error, start, stop }
}
