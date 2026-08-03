import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from '@/lib/utils'

const BASE =
  'w-full rounded-control border border-slate-200 bg-white px-3 text-sm text-nexus-indigo placeholder:text-slate-400 transition-[border-color,box-shadow] duration-150 ease-out focus:border-expert-teal focus:outline-none focus:ring-2 focus:ring-expert-teal/20 disabled:bg-slate-50 disabled:text-slate-400'

export function Label({
  children,
  htmlFor,
  hint,
}: {
  children: ReactNode
  htmlFor?: string
  hint?: string
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-nexus-indigo">
      {children}
      {hint && <span className="ml-1.5 font-normal text-slate-400">{hint}</span>}
    </label>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(BASE, 'h-10', className)} {...props} />
  }
)

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(BASE, 'py-2.5 leading-relaxed', className)} {...props} />
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(BASE, 'h-10 pr-8', className)} {...props}>
        {children}
      </select>
    )
  }
)

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="mt-1.5 text-sm text-status-red">
      {children}
    </p>
  )
}
