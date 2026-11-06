import { useEffect, useRef, useState } from 'react'
import { Download, RotateCcw, X } from 'lucide-react'
import { C64Player, CanvasRenderer } from 'c64-ready'
import { Button } from '@/components/ui/button'
import { saveFile } from '@/platform/save-file'

const BASE = import.meta.env.BASE_URL
const WASM_URL = `${BASE}c64/c64.wasm`
const WORKLET_URL = `${BASE}c64/audio-worklet-processor.js`

/** Resolves when the last player has been destroyed. */
let teardown: Promise<void> = Promise.resolve()

/**
 * Runs a PRG in c64-ready's emulator over the page. Each run (and Restart)
 * uses a fresh player, the reliable way to autostart a new PRG.
 */
export function EmulatorOverlay({
  prg,
  title,
  fileName,
  onClose,
}: {
  prg: Uint8Array
  title: string
  /** For "Save .prg". */
  fileName: string
  onClose: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [run, setRun] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const run$ = { cancelled: false }
    const stopped = () => run$.cancelled
    let player: C64Player | null = null
    // Start on the next tick: React StrictMode (dev) mounts, unmounts and
    // remounts at once, and two players on one canvas freeze each other.
    // Each start also waits for the previous player to be torn down.
    const timer = setTimeout(() => {
      void teardown.then(async () => {
        if (stopped()) return
        const renderer = new CanvasRenderer(canvas)
        player = new C64Player({
          wasmUrl: WASM_URL,
          gameUrl: 'null',
          gameData: prg,
          gameType: 'prg',
          gameSource: title,
          renderer,
          audio: { workletUrl: WORKLET_URL },
          onProgress: (pct, label) => {
            renderer.setProgress(pct, label)
            if (pct >= 100) renderer.hideLoader(300)
          },
        })
        setError(null)
        try {
          await player.start()
          if (stopped()) return
          player.setInputMode('keyboard')
          player.audio.setMuted(true)
        } catch (e) {
          if (stopped()) return
          renderer.setError(String(e))
          setError(String(e))
        }
      })
    }, 0)
    return () => {
      run$.cancelled = true
      clearTimeout(timer)
      const p = player
      if (p) teardown = teardown.then(() => p.destroy()).catch(() => undefined)
    }
  }, [prg, title, run])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} running in c64-ready`}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/80 p-4 pt-[max(1rem,env(safe-area-inset-top))]"
    >
      <div className="flex w-full max-w-[860px] items-center gap-2 text-white">
        <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
        {error && <span className="text-sm text-red-300">{error}</span>}
        <Button
          variant="outline"
          className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
          onClick={() => void saveFile(fileName, prg)}
        >
          <Download aria-hidden="true" /> Save .prg
        </Button>
        <Button
          variant="outline"
          className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
          onClick={() => setRun((r) => r + 1)}
        >
          <RotateCcw aria-hidden="true" /> Restart
        </Button>
        <Button variant="secondary" onClick={onClose}>
          <X aria-hidden="true" /> Close
        </Button>
      </div>
      <div className="relative flex min-h-0 w-full max-w-[860px] flex-1 items-center justify-center">
        <canvas
          ref={canvasRef}
          className="[image-rendering:pixelated]"
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>
    </div>
  )
}
