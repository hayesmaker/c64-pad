const CONTROLS: ReadonlyArray<[string, string]> = [
  ['D-pad / stick', 'Move the cursor'],
  ['A', 'Paint (hold and move to draw)'],
  ['B', 'Draw ↔ Erase'],
  ['X', 'Draw ↔ Fill'],
  ['L1 / R1', 'Previous / next pen'],
  ['Y + L1 / R1', 'Previous / next sprite or char'],
  ['L2 / R2', 'Undo / redo'],
  ['Select', 'Zen mode on / off'],
  ['Start', 'Show / hide these controls'],
]

/** The gamepad controls for the pixel grids, toggled with Start. */
export function GamepadHelp({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-label="Gamepad controls"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div className="rounded-xl border border-rule bg-paper p-4 shadow-[0_6px_24px_var(--shadow)]">
        <div className="mb-2 text-sm font-semibold">Gamepad</div>
        <table className="text-sm">
          <tbody>
            {CONTROLS.map(([button, action]) => (
              <tr key={button}>
                <td className="py-0.5 pr-4 font-mono text-xs whitespace-nowrap text-ink-soft">
                  {button}
                </td>
                <td className="py-0.5">{action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
