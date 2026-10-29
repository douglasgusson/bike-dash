import { useEffect, useState } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { useTripStore } from '../domain/TripTracker'

export function TripControls() {
  const status = useTripStore((s) => s.status)
  const startTrip = useTripStore((s) => s.startTrip)
  const pauseTrip = useTripStore((s) => s.pauseTrip)
  const resumeTrip = useTripStore((s) => s.resumeTrip)
  const resetTrip = useTripStore((s) => s.resetTrip)

  const [confirmReset, setConfirmReset] = useState(false)

  // Auto-cancel reset confirmation after 3.5 seconds if not tapped again
  useEffect(() => {
    if (!confirmReset) return
    const timer = setTimeout(() => setConfirmReset(false), 3500)
    return () => clearTimeout(timer)
  }, [confirmReset])

  const handleResetClick = () => {
    if (!confirmReset) {
      setConfirmReset(true)
      return
    }
    setConfirmReset(false)
    resetTrip()
  }

  return (
    <footer className="w-full bg-black p-3 sm:p-4 select-none shrink-0">
      {status === 'IDLE' ? (
        <button
          type="button"
          onClick={startTrip}
          className="w-full h-16 sm:h-18 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-black font-mono font-extrabold text-xl sm:text-2xl tracking-wider uppercase flex items-center justify-center gap-3 transition-transform cursor-pointer shadow-[0_0_25px_rgba(34,197,94,0.35)]"
        >
          <Play className="w-7 h-7 fill-black stroke-black" />
          <span>INICIAR PEDAL</span>
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {status === 'RUNNING' ? (
            <button
              type="button"
              onClick={() => {
                setConfirmReset(false)
                pauseTrip()
              }}
              className="h-16 sm:h-18 rounded-2xl bg-white hover:bg-neutral-200 active:scale-[0.99] text-black font-mono font-extrabold text-lg sm:text-xl tracking-wider uppercase flex items-center justify-center gap-2.5 transition-transform cursor-pointer"
            >
              <Pause className="w-6 h-6 fill-black stroke-black" />
              <span>PAUSAR</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setConfirmReset(false)
                resumeTrip()
              }}
              className="h-16 sm:h-18 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-black font-mono font-extrabold text-lg sm:text-xl tracking-wider uppercase flex items-center justify-center gap-2.5 transition-transform cursor-pointer"
            >
              <Play className="w-6 h-6 fill-black stroke-black" />
              <span>RETOMAR</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleResetClick}
            className={`h-16 sm:h-18 rounded-2xl border-2 font-mono font-extrabold text-lg sm:text-xl tracking-wider uppercase flex items-center justify-center gap-2.5 transition-all active:scale-[0.99] cursor-pointer ${
              confirmReset
                ? 'bg-red-600 border-red-400 text-white animate-pulse'
                : 'bg-black border-neutral-700 text-neutral-200 hover:border-red-500 hover:text-red-400'
            }`}
          >
            <RotateCcw className="w-6 h-6" />
            <span>{confirmReset ? 'CONFIRMAR?' : 'ZERAR'}</span>
          </button>
        </div>
      )}
    </footer>
  )
}
