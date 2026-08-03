import { ENV, isConfigured, MISSING_KEY_HINT } from '@/config/env'

/** Swap this to change the assistant's voice. "Rachel" from the default library. */
export const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'

const STT_ENDPOINT = 'https://api.elevenlabs.io/v1/speech-to-text'
const TTS_ENDPOINT = 'https://api.elevenlabs.io/v1/text-to-speech'

/** Pulls a readable message out of an ElevenLabs error body, never the key. */
async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as {
      detail?: { message?: string } | string
    }
    const detail = typeof body.detail === 'string' ? body.detail : body.detail?.message
    if (detail) return detail
  } catch {
    // Body was not JSON. Fall through to the generic message.
  }
  return `${fallback} (${response.status})`
}

/** Speech to text. Takes the blob straight off MediaRecorder. */
export async function transcribeAudio(blob: Blob): Promise<string> {
  if (!isConfigured.elevenLabs) throw new Error(MISSING_KEY_HINT.elevenLabs)

  const form = new FormData()
  form.append('file', blob, 'recording.webm')
  form.append('model_id', 'scribe_v1')

  let response: Response
  try {
    response = await fetch(STT_ENDPOINT, {
      method: 'POST',
      headers: { 'xi-api-key': ENV.elevenLabsApiKey },
      body: form,
    })
  } catch {
    throw new Error('Could not reach the transcription service. Check your connection.')
  }

  if (!response.ok) {
    throw new Error(await readError(response, 'Transcription failed'))
  }

  const data = (await response.json()) as { text?: string }
  const text = data.text?.trim()
  if (!text) throw new Error('I could not make out any words in that recording.')
  return text
}

/**
 * Text to speech. Plays immediately and hands back the element so the caller
 * can pause it. The object URL is revoked on `ended` so blobs do not pile up.
 */
export async function speakText(
  text: string,
  voiceId: string = DEFAULT_VOICE_ID
): Promise<HTMLAudioElement> {
  if (!isConfigured.elevenLabs) throw new Error(MISSING_KEY_HINT.elevenLabs)

  let response: Response
  try {
    response = await fetch(`${TTS_ENDPOINT}/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': ENV.elevenLabsApiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    })
  } catch {
    throw new Error('Could not reach the voice service. Check your connection.')
  }

  if (!response.ok) {
    throw new Error(await readError(response, 'Could not generate audio'))
  }

  const audioBlob = await response.blob()
  const url = URL.createObjectURL(audioBlob)
  const audio = new Audio(url)

  const revoke = () => URL.revokeObjectURL(url)
  audio.addEventListener('ended', revoke, { once: true })
  audio.addEventListener('error', revoke, { once: true })

  try {
    await audio.play()
  } catch {
    revoke()
    throw new Error('The browser blocked playback. Tap the page once, then try again.')
  }

  return audio
}
