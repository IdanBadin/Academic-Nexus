import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastKind = 'success' | 'error' | 'info'

interface Toast {
  id: number
  kind: ToastKind
  message: string
}

const ToastContext = createContext<{ push: (kind: ToastKind, message: string) => void } | null>(
  null
)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
}

const TONE: Record<ToastKind, string> = {
  success: 'text-status-green',
  error: 'text-status-red',
  info: 'text-expert-teal',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random()
    setToasts((current) => [...current, { id, kind, message }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id))
    }, 5000)
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const value = useMemo(() => ({ push }), [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.kind]
          return (
            <div
              key={toast.id}
              role="status"
              className="pointer-events-auto flex animate-slide-up items-start gap-3 rounded-card border border-slate-200 bg-white p-4 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.2)]"
            >
              <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', TONE[toast.kind])} aria-hidden />
              <p className="flex-1 text-sm text-nexus-indigo">{toast.message}</p>
              <button
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss"
                className="-m-1 rounded-md p-1 text-slate-400 transition-colors hover:text-nexus-indigo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
