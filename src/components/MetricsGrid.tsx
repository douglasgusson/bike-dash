import { formatDuration } from '../domain/math'
import { useTripStore } from '../domain/TripTracker'

export function MetricsGrid() {
  const distanceKm = useTripStore((s) => s.distanceKm)
  const elapsedTimeMs = useTripStore((s) => s.elapsedTimeMs)
  const averageSpeedKmh = useTripStore((s) => s.averageSpeedKmh)
  const maxSpeedKmh = useTripStore((s) => s.maxSpeedKmh)
  const isAutoPaused = useTripStore((s) => s.isAutoPaused)
  const status = useTripStore((s) => s.status)

  return (
    <section
      aria-label="Métricas da Viagem"
      className="grid grid-cols-2 grid-rows-2 bg-neutral-800 gap-[2px] border-t-2 border-b-2 border-neutral-800 select-none shrink-0 h-[34dvh] landscape:h-auto landscape:flex-1"
    >
      {/* 1. Distância Total */}
      <div className="bg-black flex flex-col justify-between p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <span className="font-sans text-xs sm:text-sm font-extrabold tracking-widest uppercase text-neutral-400">
            DISTÂNCIA
          </span>
          <span className="font-mono text-xs sm:text-sm font-bold text-neutral-500">
            KM
          </span>
        </div>
        <div className="font-mono font-extrabold tabular-nums text-white text-[clamp(2rem,8.5vw,4.25rem)] landscape:text-[clamp(1.85rem,5vw,3.5rem)] leading-none tracking-tight my-auto">
          {distanceKm.toFixed(2)}
        </div>
      </div>

      {/* 2. Tempo de Pedalada */}
      <div className="bg-black flex flex-col justify-between p-3 sm:p-4">
        <div className="flex items-center justify-between gap-1">
          <span className="font-sans text-xs sm:text-sm font-extrabold tracking-widest uppercase text-neutral-400">
            TEMPO
          </span>
          {status === 'RUNNING' && isAutoPaused && (
            <span className="font-mono text-[10px] sm:text-xs font-bold text-orange-400 uppercase">
              PARADO
            </span>
          )}
        </div>
        <div
          className={`font-mono font-extrabold tabular-nums text-[clamp(2rem,8.5vw,4.25rem)] landscape:text-[clamp(1.85rem,5vw,3.5rem)] leading-none tracking-tight my-auto ${
            status === 'PAUSED'
              ? 'text-red-400'
              : isAutoPaused
                ? 'text-orange-400'
                : 'text-white'
          }`}
        >
          {formatDuration(elapsedTimeMs)}
        </div>
      </div>

      {/* 3. Velocidade Média */}
      <div className="bg-black flex flex-col justify-between p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <span className="font-sans text-xs sm:text-sm font-extrabold tracking-widest uppercase text-neutral-400">
            MÉDIA
          </span>
          <span className="font-mono text-xs sm:text-sm font-bold text-neutral-500">
            KM/H
          </span>
        </div>
        <div className="font-mono font-extrabold tabular-nums text-white text-[clamp(2rem,8.5vw,4.25rem)] landscape:text-[clamp(1.85rem,5vw,3.5rem)] leading-none tracking-tight my-auto">
          {averageSpeedKmh.toFixed(1)}
        </div>
      </div>

      {/* 4. Velocidade Máxima */}
      <div className="bg-black flex flex-col justify-between p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <span className="font-sans text-xs sm:text-sm font-extrabold tracking-widest uppercase text-neutral-400">
            MÁXIMA
          </span>
          <span className="font-mono text-xs sm:text-sm font-bold text-neutral-500">
            KM/H
          </span>
        </div>
        <div className="font-mono font-extrabold tabular-nums text-white text-[clamp(2rem,8.5vw,4.25rem)] landscape:text-[clamp(1.85rem,5vw,3.5rem)] leading-none tracking-tight my-auto">
          {maxSpeedKmh.toFixed(1)}
        </div>
      </div>
    </section>
  )
}
