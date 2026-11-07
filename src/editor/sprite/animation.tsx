import { useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Pause,
  Play,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { SPRITE_HEIGHT } from '@/c64/sprite'
import {
  SPRITE_RENDER_WIDTH,
  addAnimation,
  animationSequence,
  findSprite,
  removeAnimation,
  renderSprite,
  updateAnimation,
} from '@/c64/sprite-set'
import { PALETTE } from '@/c64/palette'
import { newId } from '@/c64/ids'
import { IndexedCanvas } from '@/components/c64/indexed-canvas'
import { Field } from '@/components/worksheet/field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { Segmented } from '../segmented'
import type { C64Color } from '@/c64/palette'
import type { Sprite } from '@/c64/sprite'
import type {
  AnimationMode,
  SpriteAnimation,
  SpriteSet,
} from '@/c64/sprite-set'

/** PAL frame rate: animation speed counts display frames of 1/50 s. */
const PAL_FPS = 50

/** The sprite id to show now while `anim` plays (null when stopped or empty). */
export function useAnimationFrame(
  anim: SpriteAnimation | undefined,
  playing: boolean,
) {
  const sequence = useMemo(() => (anim ? animationSequence(anim) : []), [anim])
  const [step, setStep] = useState(0)
  useEffect(() => {
    setStep(0)
    if (!playing || sequence.length === 0 || !anim) return
    const id = setInterval(
      () => setStep((s) => (s + 1) % sequence.length),
      (anim.speed * 1000) / PAL_FPS,
    )
    return () => clearInterval(id)
  }, [playing, sequence, anim])
  if (!playing || sequence.length === 0) return null
  return sequence[step % sequence.length]
}

function SpriteThumb({
  set,
  sprite,
  className,
}: {
  set: SpriteSet
  sprite: Sprite
  className?: string
}) {
  const image = useMemo(
    () => ({
      width: SPRITE_RENDER_WIDTH,
      height: SPRITE_HEIGHT,
      pixels: renderSprite(set, sprite),
    }),
    [set, sprite],
  )
  return (
    <IndexedCanvas image={image} label={sprite.name} className={className} />
  )
}

/** Strip controls: choose / create / edit an animation and play it in the preview. */
export function AnimationControls({
  set,
  animationId,
  onAnimationId,
  playing,
  onPlaying,
  onChange,
  background,
}: {
  set: SpriteSet
  animationId: string | null
  onAnimationId: (id: string | null) => void
  playing: boolean
  onPlaying: (playing: boolean) => void
  onChange: (fn: (set: SpriteSet) => SpriteSet, group?: string) => void
  background: C64Color | null
}) {
  const [editing, setEditing] = useState(false)
  const anim = set.animations.find((a) => a.id === animationId)

  const create = () => {
    const id = newId()
    onChange((s) =>
      addAnimation(s, {
        id,
        name: `Animation ${s.animations.length + 1}`,
        frames: s.sprites.slice(0, 2).map((x) => x.id),
      }),
    )
    onAnimationId(id)
    setEditing(true)
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="h-12 max-w-[150px] flex-col gap-0 px-2.5 text-xs"
          >
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clapperboard aria-hidden="true" className="size-3.5" /> Animation
            </span>
            <span className="max-w-full truncate">{anim?.name ?? 'None'}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="min-w-52">
          <DropdownMenuRadioGroup
            value={animationId ?? ''}
            onValueChange={(v) => onAnimationId(v || null)}
          >
            <DropdownMenuRadioItem value="">None</DropdownMenuRadioItem>
            {set.animations.map((a) => (
              <DropdownMenuRadioItem key={a.id} value={a.id}>
                {a.name} · {a.frames.length} frames
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={create}>
            <Plus aria-hidden="true" /> New animation
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!anim} onSelect={() => setEditing(true)}>
            Edit “{anim?.name ?? '…'}”
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant={playing ? 'default' : 'outline'}
        size="icon-lg"
        className="h-12"
        aria-label={
          playing ? 'Stop animation preview' : 'Play animation in preview'
        }
        disabled={!anim || anim.frames.length === 0}
        onClick={() => onPlaying(!playing)}
      >
        {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
      </Button>
      {anim && editing && (
        <AnimationDialog
          set={set}
          anim={anim}
          background={background}
          onClose={() => setEditing(false)}
          onChange={onChange}
          onDelete={() => {
            onChange((s) => removeAnimation(s, anim.id))
            onAnimationId(null)
            onPlaying(false)
            setEditing(false)
          }}
        />
      )}
    </div>
  )
}

function AnimationDialog({
  set,
  anim,
  background,
  onClose,
  onChange,
  onDelete,
}: {
  set: SpriteSet
  anim: SpriteAnimation
  background: C64Color | null
  onClose: () => void
  onChange: (fn: (set: SpriteSet) => SpriteSet, group?: string) => void
  onDelete: () => void
}) {
  const update = (
    fn: (a: SpriteAnimation) => SpriteAnimation,
    group?: string,
  ) => onChange((s) => updateAnimation(s, anim.id, fn), group)
  const frameId = useAnimationFrame(anim, true)
  const frame = frameId ? findSprite(set, frameId) : undefined
  const setFrames = (frames: Array<string>) => update((a) => ({ ...a, frames }))
  const move = (i: number, delta: number) => {
    const frames = [...anim.frames]
    const [f] = frames.splice(i, 1)
    frames.splice(i + delta, 0, f)
    setFrames(frames)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-[680px] sm:max-w-[680px]"
        // Don't focus the name field: on a tablet that pops up the keyboard.
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Edit animation</DialogTitle>
          <DialogDescription>
            Tap sprites below to add frames. Speed counts PAL frames (1/50 s)
            per step.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-5">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <Field label="Name">
              <Input
                value={anim.name}
                onChange={(e) =>
                  update(
                    (a) => ({ ...a, name: e.target.value }),
                    `anim-name-${anim.id}`,
                  )
                }
              />
            </Field>
            <div className="flex items-end gap-3">
              <Field
                label={`Speed: ${anim.speed} frame${anim.speed === 1 ? '' : 's'} per step (${(PAL_FPS / anim.speed).toFixed(1)} per second)`}
                className="flex-1"
              >
                <input
                  type="range"
                  min={1}
                  max={50}
                  value={anim.speed}
                  onChange={(e) =>
                    update(
                      (a) => ({ ...a, speed: Number(e.target.value) }),
                      `anim-speed-${anim.id}`,
                    )
                  }
                  className="h-10 w-full accent-primary"
                />
              </Field>
              <div className="w-[170px]">
                <Segmented<AnimationMode>
                  label="Play mode"
                  size="sm"
                  value={anim.mode}
                  options={[
                    { value: 'loop', label: 'Loop' },
                    { value: 'pingpong', label: 'Ping-pong' },
                  ]}
                  onChange={(mode) => update((a) => ({ ...a, mode }))}
                />
              </div>
            </div>
          </div>
          <div
            className="flex size-[132px] shrink-0 items-center justify-center rounded-lg border-[5px] border-c64-border"
            style={{ background: PALETTE[background ?? 6].hex }}
            aria-label="Animation preview"
          >
            {frame && (
              <SpriteThumb set={set} sprite={frame} className="w-[96px]" />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">
            Frames ({anim.frames.length})
          </span>
          <ol className="flex min-h-[76px] gap-2 overflow-x-auto rounded-lg border border-rule-soft p-2">
            {anim.frames.length === 0 && (
              <li className="self-center text-sm text-muted-foreground">
                No frames yet.
              </li>
            )}
            {anim.frames.map((id, i) => {
              const sprite = findSprite(set, id)
              if (!sprite) return null
              return (
                <li
                  key={`${id}-${i}`}
                  className={cn(
                    'flex shrink-0 flex-col items-center gap-1 rounded-md border p-1',
                    id === frameId ? 'border-primary' : 'border-transparent',
                  )}
                >
                  <div className="flex h-9 w-14 items-center justify-center rounded bg-c64-screen">
                    <SpriteThumb set={set} sprite={sprite} className="w-8" />
                  </div>
                  <div className="flex">
                    <IconButton
                      label="Move frame left"
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                    >
                      <ChevronLeft />
                    </IconButton>
                    <IconButton
                      label="Remove frame"
                      onClick={() =>
                        setFrames(anim.frames.filter((_, j) => j !== i))
                      }
                    >
                      <X />
                    </IconButton>
                    <IconButton
                      label="Move frame right"
                      disabled={i === anim.frames.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <ChevronRight />
                    </IconButton>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Add a frame</span>
          <ul className="flex flex-wrap gap-1.5">
            {set.sprites.map((sprite, i) => (
              <li key={sprite.id}>
                <button
                  type="button"
                  aria-label={`Add sprite ${i} as a frame`}
                  onClick={() => setFrames([...anim.frames, sprite.id])}
                  className="relative flex h-11 w-14 items-center justify-center rounded-md border border-rule bg-c64-screen hover:ring-2 hover:ring-primary"
                >
                  <SpriteThumb set={set} sprite={sprite} className="w-8" />
                  <span className="absolute bottom-0 left-0.5 font-mono text-[9px] text-white">
                    {i}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="destructive" onClick={onDelete}>
            <Trash2 aria-hidden="true" /> Delete animation
          </Button>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:opacity-30 [&_svg]:size-4"
    >
      {children}
    </button>
  )
}
