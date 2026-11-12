import { useCallback, useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'

/**
 * A short message at the bottom of the screen that goes away by itself.
 * `show` again replaces it and restarts the timer.
 */
export function useToast(duration = 2200) {
  const [toast, setToast] = useState<{ id: number; message: string } | null>(
    null,
  )
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const show = useCallback(
    (message: string) => {
      clearTimeout(timer.current)
      setToast((t) => ({ id: (t?.id ?? 0) + 1, message }))
      timer.current = setTimeout(() => setToast(null), duration)
    },
    [duration],
  )
  useEffect(() => () => clearTimeout(timer.current), [])

  const element = (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
    >
      {toast && (
        <div
          key={toast.id}
          className="flex max-w-md animate-in items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm text-background shadow-lg duration-200 fade-in slide-in-from-bottom-2"
        >
          <Check aria-hidden="true" className="size-4 shrink-0" />
          {toast.message}
        </div>
      )}
    </div>
  )
  return { show, element }
}
