import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'

/**
 * Short messages at the bottom of the screen that go away by themselves:
 * call `showToast` from anywhere; the one `<Toaster />` in the root shows
 * it. A new message replaces the last and restarts the timer.
 */
interface Toast {
  id: number
  message: string
}

let current: Toast | null = null
let nextId = 1
let timer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<(t: Toast | null) => void>()

const publish = (t: Toast | null) => {
  current = t
  for (const l of listeners) l(t)
}

export function showToast(message: string, duration = 2200) {
  clearTimeout(timer)
  publish({ id: nextId++, message })
  timer = setTimeout(() => publish(null), duration)
}

export function Toaster() {
  const [toast, setToast] = useState<Toast | null>(current)
  useEffect(() => {
    listeners.add(setToast)
    return () => {
      listeners.delete(setToast)
    }
  }, [])

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex justify-center px-4"
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
}
