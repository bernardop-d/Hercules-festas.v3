import type { Toast } from '../hooks/useToast'

interface Props {
  toasts:  Toast[]
  dismiss: (id: number) => void
}

const ICONS = {
  success: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  info: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
    </svg>
  ),
}

const STYLES = {
  success: 'bg-[#0f2318] border-green-500/30 text-green-400',
  error:   'bg-[#1f0d0d] border-red-500/30   text-red-400',
  info:    'bg-bg2      border-accent/30      text-accent',
}

export function Toaster({ toasts, dismiss }: Props) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded
                      border shadow-[0_8px_32px_rgba(0,0,0,0.5)]
                      font-sans text-[0.82rem] font-medium max-w-[340px]
                      animate-fade-up
                      ${STYLES[t.type]}`}
        >
          <span className="mt-[1px] flex-shrink-0">{ICONS[t.type]}</span>
          <span className="flex-1 leading-snug">{t.message}</span>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity cursor-pointer"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
