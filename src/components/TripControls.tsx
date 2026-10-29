import { useEffect, useState } from 'react'
import { Download, Flag, Pause, Play, Trash2, X } from 'lucide-react'
import { useTripStore } from '../domain/TripTracker'
import type { TripLoggerController } from '../hooks/useTripLogger'
import { exportTripToGpxDownload } from '../services/GpxExporter'
import { deleteTripCascade } from '../services/TripDatabase'

interface TripControlsProps {
  tripLogger: TripLoggerController
}

export function TripControls({ tripLogger }: TripControlsProps) {
  const status = useTripStore((s) => s.status)
  const lastCompletedTripId = useTripStore((s) => s.lastCompletedTripId)
  const pauseTrip = useTripStore((s) => s.pauseTrip)
  const resumeTrip = useTripStore((s) => s.resumeTrip)
  const clearLastCompletedTrip = useTripStore((s) => s.clearLastCompletedTrip)

  const [confirmFinish, setConfirmFinish] = useState(false)
  const [confirmDiscardFinished, setConfirmDiscardFinished] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // Auto-cancel finish confirmation after 3.5 seconds if not tapped again
  useEffect(() => {
    if (!confirmFinish) return
    const timer = setTimeout(() => setConfirmFinish(false), 3500)
    return () => clearTimeout(timer)
  }, [confirmFinish])

  useEffect(() => {
    if (!confirmDiscardFinished) return
    const timer = setTimeout(() => setConfirmDiscardFinished(false), 3500)
    return () => clearTimeout(timer)
  }, [confirmDiscardFinished])

  const handleStartTrip = async () => {
    setConfirmFinish(false)
    setConfirmDiscardFinished(false)
    await tripLogger.startNewTrip()
  }

  const handleFinishClick = async () => {
    if (!confirmFinish) {
      setConfirmFinish(true)
      return
    }
    setConfirmFinish(false)
    await tripLogger.stopAndFinishTrip()
  }

  const handleExportLastTrip = async () => {
    if (!lastCompletedTripId) return
    setIsExporting(true)
    try {
      await exportTripToGpxDownload(lastCompletedTripId)
      clearLastCompletedTrip()
    } finally {
      setIsExporting(false)
    }
  }

  const handleDiscardLastTrip = async () => {
    if (!lastCompletedTripId) return
    if (!confirmDiscardFinished) {
      setConfirmDiscardFinished(true)
      return
    }
    const idToDelete = lastCompletedTripId
    setConfirmDiscardFinished(false)
    clearLastCompletedTrip()
    await deleteTripCascade(idToDelete)
  }

  return (
    <footer className="w-full bg-black p-3 sm:p-4 select-none shrink-0 space-y-2.5">
      {/* Post-Trip Banner: "Exportar Rota (GPX)" ou "Descartar" */}
      {status === 'IDLE' && lastCompletedTripId && (
        <div className="rounded-2xl border-2 border-emerald-500/60 bg-neutral-950 p-3 font-mono">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
              PEDAL FINALIZADO • SALVO NO BANCO
            </span>
            <button
              type="button"
              onClick={clearLastCompletedTrip}
              aria-label="Fechar aviso de exportação"
              className="text-neutral-400 hover:text-white p-0.5 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={isExporting}
              onClick={() => void handleExportLastTrip()}
              className="h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-black font-extrabold text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>{isExporting ? 'EXPORTANDO...' : 'EXPORTAR ROTA (GPX)'}</span>
            </button>

            <button
              type="button"
              onClick={() => void handleDiscardLastTrip()}
              className={`h-12 rounded-xl border-2 font-extrabold text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                confirmDiscardFinished
                  ? 'border-red-400 bg-red-600 text-white animate-pulse'
                  : 'border-neutral-700 bg-black text-neutral-300 hover:border-red-500 hover:text-red-400'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              <span>{confirmDiscardFinished ? 'CONFIRMAR?' : 'DESCARTAR'}</span>
            </button>
          </div>
        </div>
      )}

      {status === 'IDLE' ? (
        <button
          type="button"
          onClick={() => void handleStartTrip()}
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
                setConfirmFinish(false)
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
                setConfirmFinish(false)
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
            onClick={() => void handleFinishClick()}
            className={`h-16 sm:h-18 rounded-2xl border-2 font-mono font-extrabold text-lg sm:text-xl tracking-wider uppercase flex items-center justify-center gap-2.5 transition-all active:scale-[0.99] cursor-pointer ${
              confirmFinish
                ? 'bg-red-600 border-red-400 text-white animate-pulse'
                : 'bg-black border-neutral-700 text-neutral-200 hover:border-red-500 hover:text-red-400'
            }`}
          >
            <Flag className="w-6 h-6" />
            <span>{confirmFinish ? 'FINALIZAR?' : 'ENCERRAR'}</span>
          </button>
        </div>
      )}
    </footer>
  )
}
