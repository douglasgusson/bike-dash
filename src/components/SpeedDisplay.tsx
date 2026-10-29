import { useTripStore } from '../domain/TripTracker'

export function SpeedDisplay() {
  const currentSpeedKmh = useTripStore((s) => s.currentSpeedKmh)
  const status = useTripStore((s) => s.status)
  const isAutoPaused = useTripStore((s) => s.isAutoPaused)
  const gpsError = useTripStore((s) => s.gpsError)
  const isSimulating = useTripStore((s) => s.isSimulating)
  const setSimulating = useTripStore((s) => s.setSimulating)

  const formatted = currentSpeedKmh.toFixed(1)
  const [integerPart, decimalPart] = formatted.split('.')

  const isPausedState = status === 'PAUSED'

  return (
    <section
      aria-label="Velocidade Atual"
      className="relative flex-1 flex flex-col items-center justify-center bg-black px-4 py-2 select-none overflow-hidden min-h-0"
    >
      {/* Main Monospace Speedometer Counter */}
      <div className="flex items-baseline justify-center leading-none">
        <span
          className={`font-mono font-extrabold tabular-nums tracking-tighter transition-colors ${
            isPausedState
              ? 'text-red-500'
              : isAutoPaused
                ? 'text-orange-400'
                : 'text-white'
          } text-[clamp(6.2rem,27vw,13.5rem)] landscape:text-[clamp(5.5rem,17vw,11.5rem)]`}
        >
          {integerPart.padStart(2, '0')}
        </span>
        <div className="flex flex-col items-start ml-1 sm:ml-2">
          <span
            className={`font-mono font-bold tabular-nums leading-none ${
              isPausedState
                ? 'text-red-400'
                : isAutoPaused
                  ? 'text-orange-300'
                  : 'text-neutral-300'
            } text-[clamp(2.25rem,8vw,4.5rem)] landscape:text-[clamp(2rem,6vw,3.75rem)]`}
          >
            .{decimalPart}
          </span>
          <span className="font-mono font-extrabold tracking-widest text-neutral-400 text-sm sm:text-lg md:text-xl mt-1">
            KM/H
          </span>
        </div>
      </div>

      {/* Contextual GPS Error Banner with Quick Simulation Fallback */}
      {gpsError && !isSimulating && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2 px-3 py-1.5 rounded-lg border border-red-500/70 bg-red-950/40 text-red-300 text-xs sm:text-sm font-mono">
          <span>{gpsError.message}</span>
          <button
            type="button"
            onClick={() => setSimulating(true)}
            className="px-2.5 py-0.5 rounded bg-white text-black font-bold uppercase text-xs hover:bg-neutral-200 cursor-pointer"
          >
            Usar Simulador
          </button>
        </div>
      )}
    </section>
  )
}
