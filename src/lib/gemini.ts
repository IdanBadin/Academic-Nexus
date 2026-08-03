import { AI_MODEL_ENDPOINT } from '@/config/ai'
import { ENV, isConfigured, MISSING_KEY_HINT } from '@/config/env'

export interface AiMessage {
  role: 'user' | 'assistant'
  content: string
  id: string
}

/** Thrown for anything the caller can show the user as-is. Never carries the key. */
export class GeminiError extends Error {
  readonly kind: 'missing_key' | 'http' | 'network'

  constructor(kind: GeminiError['kind'], message: string) {
    super(message)
    this.name = 'GeminiError'
    this.kind = kind
  }
}

interface GeminiPart {
  text?: string
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: GeminiPart[] }
    finishReason?: string
  }[]
  promptFeedback?: { blockReason?: string }
  error?: { message?: string }
}

const BLOCKED_REPLY =
  "I could not answer that one. Try rewording it, or ask me something about finding an expert."

const EMPTY_REPLY =
  'I came back with nothing that time. Ask me again and I will have another go.'

export async function sendToGemini({
  systemPrompt,
  history,
  userMessage,
}: {
  systemPrompt: string
  history: AiMessage[]
  userMessage: string
}): Promise<string> {
  if (!isConfigured.googleAi) {
    throw new GeminiError('missing_key', MISSING_KEY_HINT.googleAi)
  }

  const contents = [
    ...history.map((message) => ({
      role: message.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{ text: message.content }],
    })),
    { role: 'user' as const, parts: [{ text: userMessage }] },
  ]

  let response: Response
  try {
    response = await fetch(`${AI_MODEL_ENDPOINT}?key=${encodeURIComponent(ENV.googleAiApiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 800 },
      }),
    })
  } catch {
    throw new GeminiError(
      'network',
      'I could not reach the assistant. Check your connection and try again.'
    )
  }

  let data: GeminiResponse = {}
  try {
    data = (await response.json()) as GeminiResponse
  } catch {
    if (!response.ok) {
      throw new GeminiError('http', `The assistant returned an error (${response.status}).`)
    }
    throw new GeminiError('http', 'The assistant sent back something I could not read.')
  }

  if (!response.ok) {
    // Google puts the key in the query string, so scrub it out of any echoed URL.
    const detail = (data.error?.message ?? '').replace(/key=[^&\s]+/gi, 'key=***')
    throw new GeminiError(
      'http',
      detail
        ? `The assistant returned an error: ${detail}`
        : `The assistant returned an error (${response.status}).`
    )
  }

  if (data.promptFeedback?.blockReason) return BLOCKED_REPLY

  const candidate = data.candidates?.[0]
  if (!candidate) return BLOCKED_REPLY

  const text = candidate.content?.parts?.map((part) => part.text ?? '').join('').trim()
  if (!text) {
    return candidate.finishReason === 'SAFETY' ? BLOCKED_REPLY : EMPTY_REPLY
  }

  return text
}
