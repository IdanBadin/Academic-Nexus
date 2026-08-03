import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

interface AiAssistantValue {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
  /**
   * Opens the widget with text already in the composer. The expert Listings
   * page uses this to hand a draft description straight over to the assistant.
   */
  openWith: (prompt: string) => void
  /** Read by the widget to seed its input. Not part of the public surface. */
  pendingPrompt: string | null
  clearPendingPrompt: () => void
}

const AiAssistantContext = createContext<AiAssistantValue | null>(null)

export function useAiAssistant() {
  const ctx = useContext(AiAssistantContext)
  if (!ctx) throw new Error('useAiAssistant must be used inside <AiAssistantProvider>')
  return ctx
}

/** No-op stand-in used when a page renders outside the provider. */
const NO_ASSISTANT: Pick<AiAssistantValue, 'openWith'> = { openWith: () => {} }

/**
 * Same as useAiAssistant but returns a no-op instead of throwing when there is
 * no provider above. Lets a page offer an optional "ask the assistant" affordance
 * without wrapping a hook call in try/catch, which breaks the rules of hooks.
 */
export function useAiAssistantOptional(): Pick<AiAssistantValue, 'openWith'> {
  return useContext(AiAssistantContext) ?? NO_ASSISTANT
}

export function AiAssistantProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen((value) => !value), [])

  const openWith = useCallback((prompt: string) => {
    setPendingPrompt(prompt)
    setIsOpen(true)
  }, [])

  const clearPendingPrompt = useCallback(() => setPendingPrompt(null), [])

  const value = useMemo<AiAssistantValue>(
    () => ({ isOpen, open, close, toggle, openWith, pendingPrompt, clearPendingPrompt }),
    [isOpen, open, close, toggle, openWith, pendingPrompt, clearPendingPrompt]
  )

  return <AiAssistantContext.Provider value={value}>{children}</AiAssistantContext.Provider>
}
