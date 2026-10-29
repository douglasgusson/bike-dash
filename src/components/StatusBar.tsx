import { History, Lock, LockOpen, Radio, SlidersHorizontal } from 'lucide-react'
import { useTripStore } from '../domain/TripTracker'
import type { WakeLockController } from '../hooks/useWakeLock'

interface StatusBarProps {
  wakeLock: WakeLockController
  onOpenSettings: () => void
  onOpenHistory: () => void
}

export function StatusBar({
  wakeLock,
  onOpenSettings,
  onOpenHistory,
}: StatusBarProps) {
  const gpsStatus = useTripStore((s) => s.gpsStatus)
  const currentAccuracy = useTripStore((s) => s.currentAccuracy)
  const tripStatus = useTripStore((s) => s.status)
  const isAutoPaused = useTripStore((s) => s.isAutoPaused)

  const getGpsBadge = () => {
    switch (gpsStatus) {
      case 'CONNECTED':
        return {
          dotClass: 'bg-emerald-500 shadow-[0_0_10px_#22c55e]',
          borderClass: 'border-emerald-500/50 text-emerald-400',
          label: currentAccuracy !== null ? `GPS OK ±${Math.round(currentAccuracy)}m` : 'GPS OK',
        }
      case 'SIMULATING':
        return {
          dotClass: 'bg-emerald-400 animate-pulse shadow-[0_0_10px_#22c55e]',
          borderClass: 'border-emerald-500/60 text-emerald-400',
          label: 'SIMULADOR GPS',
        }
      case 'SEARCHING':
        return {
          dotClass: 'bg-orange-500 animate-ping',
          borderClass: 'border-orange-500/60 text-orange-400',
          label: 'BUSCANDO SINAL...',
        }
      case 'WEAK_SIGNAL':
        return {
          dotClass: 'bg-orange-500 animate-pulse',
          borderClass: 'border-orange-500/60 text-orange-400',
          label:
            currentAccuracy !== null
              ? `SINAL FRACO ±${Math.round(currentAccuracy)}m`
              : 'SINAL FRACO',
        }
      case 'ERROR':
        return {
          dotClass: 'bg-red-500',
          borderClass: 'border-red-500/60 text-red-400',
          label: 'SEM GPS',
        }
      default:
        return {
          dotClass: 'bg-orange-500',
          borderClass: 'border-neutral-700 text-neutral-300',
          label: 'GPS AGUARDANDO',
        }
    }
  }

  const gpsBadge = getGpsBadge()

  return (
    <header className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-black border-b-2 border-neutral-800 select-none shrink-0">
      {/* Left: GPS Status Indicator */}
      <div className="flex items-center gap-2 min-w-0">
        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border-2 bg-black font-mono text-xs sm:text-sm font-bold tracking-wider uppercase ${gpsBadge.borderClass}`}
        >
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className={`h-2.5 w-2.5 rounded-full ${gpsBadge.dotClass}`} />
          </span>
          <span className="truncate">{gpsBadge.label}</span>
        </div>

        {/* Session Pause / Auto-Pause Pill */}
        {tripStatus === 'PAUSED' && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-red-500/20 border-2 border-red-500 text-red-400 font-mono text-xs sm:text-sm font-extrabold tracking-wider uppercase">
            PAUSADO
          </span>
        )}
        {tripStatus === 'RUNNING' && isAutoPaused && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-orange-500/20 border-2 border-orange-500 text-orange-400 font-mono text-xs sm:text-sm font-extrabold tracking-wider uppercase animate-pulse">
            AUTO-PAUSE
          </span>
        )}
      </div>

      {/* Right: Wake Lock Toggle & Field Calibration Settings */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => void wakeLock.toggleWakeLock()}
          title={
            wakeLock.isActive
              ? 'Wake Lock ativo: A tela não irá bloquear'
              : 'Ativar Wake Lock para manter a tela ligada'
          }
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 font-mono text-xs sm:text-sm font-bold uppercase tracking-wider transition-colors active:scale-95 cursor-pointer ${
            wakeLock.isActive
              ? 'border-emerald-500 bg-emerald-950/50 text-emerald-400'
              : 'border-neutral-700 bg-neutral-950 text-neutral-400 hover:border-neutral-500'
          }`}
        >
          {wakeLock.isActive ? (
            <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : (
            <LockOpen className="w-3.5 h-3.5 text-orange-400 shrink-0" />
          )}
          <span className="hidden xs:inline">
            {wakeLock.isActive ? 'TELA ATIVA' : 'TELA LIVRE'}
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenHistory}
          aria-label="Histórico de Viagens e Exportação GPX"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-neutral-700 bg-black text-white hover:border-white font-mono text-xs sm:text-sm font-bold uppercase tracking-wider transition-colors active:scale-95 cursor-pointer"
        >
          <History className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="hidden md:inline">ROTAS</span>
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Calibração e Simulador GPS"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-neutral-700 bg-black text-white hover:border-white font-mono text-xs sm:text-sm font-bold uppercase tracking-wider transition-colors active:scale-95 cursor-pointer"
        >
          {gpsStatus === 'SIMULATING' ? (
            <Radio className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <SlidersHorizontal className="w-4 h-4 text-white shrink-0" />
          )}
          <span className="hidden sm:inline">AJUSTES</span>
        </button>
      </div>
    </header>
  )
}
