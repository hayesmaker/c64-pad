import { Eye, EyeOff, Images } from 'lucide-react'
import { ToolButton } from '../grid-parts'
import type { LoadedTracing } from './use-tracing'

/** Header buttons: open the tracing paper settings; show / hide the image. */
export function TracingButtons({
  open,
  onOpen,
  tracing,
  onVisible,
}: {
  open: boolean
  onOpen: (open: boolean) => void
  tracing: LoadedTracing | null
  onVisible: (visible: boolean) => void
}) {
  const visible = tracing?.settings.visible ?? false
  return (
    <>
      <ToolButton
        label="Tracing paper"
        pressed={open}
        onClick={() => onOpen(!open)}
      >
        <Images />
      </ToolButton>
      {tracing && (
        <ToolButton
          label={visible ? 'Hide tracing paper' : 'Show tracing paper'}
          onClick={() => onVisible(!visible)}
        >
          {visible ? <Eye /> : <EyeOff />}
        </ToolButton>
      )}
    </>
  )
}
