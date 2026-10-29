import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Download, History, Map, Trash2, Upload, X } from 'lucide-react'
import { formatDuration } from '../domain/math'
import { useTripStore } from '../domain/TripTracker'
import type { Trip } from '../domain/types'
import { exportTripToGpxDownload, importGpxToDatabase } from '../services/GpxExporter'
import { deleteTripCascade, getAllTrips } from '../services/TripDatabase'

interface TripHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectTripForMap: (tripId: string) => void
}

export function TripHistoryModal({
  isOpen,
  onClose,
  onSelectTripForMap,
}: TripHistoryModalProps) {
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(false)
  const [exportingId, setExportingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importFeedback, setImportFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const lastCompletedTripId = useTripStore((s) => s.lastCompletedTripId)
  const clearLastCompletedTrip = useTripStore((s) => s.clearLastCompletedTrip)

  const loadTrips = async () => {
    setLoading(true)
    try {
      const list = await getAllTrips()
      setTrips(list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      void loadTrips()
      setConfirmDeleteId(null)
      setImportFeedback(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleExportGpx = async (tripId: string) => {
    setExportingId(tripId)
    try {
      await exportTripToGpxDownload(tripId)
    } finally {
      setExportingId(null)
    }
  }

  const handleDeleteTrip = async (tripId: string) => {
    if (confirmDeleteId !== tripId) {
      setConfirmDeleteId(tripId)
      return
    }

    await deleteTripCascade(tripId)
    if (lastCompletedTripId === tripId) {
      clearLastCompletedTrip()
    }
    setConfirmDeleteId(null)
    await loadTrips()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsImporting(true)
    setImportFeedback(null)

    try {
      let importedCount = 0
      let totalPoints = 0

      for (const file of Array.from(files)) {
        const text = await file.text()
        const result = await importGpxToDatabase(text)
        importedCount += 1
        totalPoints += result.pointCount
      }

      await loadTrips()
      setImportFeedback({
        type: 'success',
        message:
          importedCount === 1
            ? `Viagem importada com sucesso (${totalPoints} pontos GPS).`
            : `${importedCount} viagens importadas (${totalPoints} pontos GPS).`,
      })
    } catch (err) {
      setImportFeedback({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'Falha ao ler o arquivo GPX. Verifique o formato.',
      })
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Histórico de Viagens e Exportação GPX"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 select-none"
    >
      <div className="w-full max-w-lg rounded-2xl border-2 border-neutral-700 bg-black p-5 text-white shadow-2xl max-h-[92dvh] flex flex-col">
        <div className="flex items-center justify-between border-b-2 border-neutral-800 pb-3 mb-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <History className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-mono text-base sm:text-lg font-extrabold uppercase tracking-wider truncate">
                HISTÓRICO DE PEDAIS
              </h2>
              <p className="text-xs text-neutral-400 font-mono truncate">
                Rotas salvas offline no IndexedDB (GPX 1.1)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Hidden file input for GPX import */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".gpx,application/gpx+xml,application/xml,text/xml"
              multiple
              onChange={(e) => void handleFileChange(e)}
              className="hidden"
            />
            <button
              type="button"
              disabled={isImporting}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-emerald-500/60 bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-400 font-mono text-xs font-extrabold uppercase tracking-wider transition-colors active:scale-95 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
              <span>{isImporting ? 'LENDO...' : 'IMPORTAR GPX'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar histórico"
              className="p-2 rounded-full border-2 border-neutral-700 hover:border-white text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Import status banner */}
        {importFeedback && (
          <div
            className={`mb-3 px-3 py-2 rounded-xl border font-mono text-xs flex items-center justify-between gap-2 shrink-0 ${
              importFeedback.type === 'success'
                ? 'border-emerald-500/60 bg-emerald-950/40 text-emerald-300'
                : 'border-red-500/60 bg-red-950/40 text-red-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {importFeedback.type === 'success' && (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <span>{importFeedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setImportFeedback(null)}
              className="text-neutral-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-3 pr-1 font-mono">
          {loading ? (
            <div className="py-10 text-center text-neutral-400 text-sm">
              Carregando viagens...
            </div>
          ) : trips.length === 0 ? (
            <div className="py-10 text-center border border-dashed border-neutral-800 rounded-xl p-6 space-y-3">
              <div>
                <p className="text-neutral-300 font-bold text-sm uppercase">
                  Nenhuma viagem registrada
                </p>
                <p className="text-neutral-500 text-xs mt-1">
                  Inicie um pedal ou importe um arquivo .GPX gravado em outro dispositivo.
                </p>
              </div>
              <button
                type="button"
                disabled={isImporting}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs uppercase tracking-wider cursor-pointer"
              >
                <Upload className="w-4 h-4 stroke-[2.5]" />
                <span>SELECIONAR ARQUIVO .GPX</span>
              </button>
            </div>
          ) : (
            trips.map((trip) => {
              const totalDurationMs =
                trip.endTime && trip.endTime > trip.startTime
                  ? trip.endTime - trip.startTime
                  : 0
              const activeDurationMs =
                trip.elapsedTimeMs && trip.elapsedTimeMs > 0
                  ? trip.elapsedTimeMs
                  : totalDurationMs
              const avgSpeed =
                trip.averageSpeedKmh && trip.averageSpeedKmh > 0
                  ? trip.averageSpeedKmh
                  : activeDurationMs > 1000
                    ? trip.totalDistance / (activeDurationMs / 3_600_000)
                    : 0
              const dateFormatted = new Date(trip.startTime).toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })

              const isConfirming = confirmDeleteId === trip.id

              return (
                <div
                  key={trip.id}
                  className="rounded-xl border-2 border-neutral-800 bg-neutral-950 p-3.5 flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs text-neutral-400 font-bold">
                        {dateFormatted}
                      </div>
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-0.5">
                        <span className="text-xl font-extrabold text-white tabular-nums">
                          {trip.totalDistance.toFixed(2)}{' '}
                          <span className="text-xs text-neutral-400">KM</span>
                        </span>
                        {activeDurationMs > 0 && (
                          <span className="text-xs text-neutral-300 tabular-nums">
                            • {formatDuration(activeDurationMs)}
                          </span>
                        )}
                        {avgSpeed > 0 && (
                          <span className="text-xs text-emerald-400 font-bold tabular-nums">
                            • {avgSpeed.toFixed(1)} km/h méd
                          </span>
                        )}
                        {trip.maxSpeedKmh && trip.maxSpeedKmh > 0 ? (
                          <span className="text-xs text-neutral-400 tabular-nums">
                            • máx {trip.maxSpeedKmh.toFixed(1)} km/h
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase border ${
                        trip.isFinished
                          ? 'border-emerald-500/40 bg-emerald-950/50 text-emerald-400'
                          : 'border-orange-500/40 bg-orange-950/50 text-orange-400'
                      }`}
                    >
                      {trip.isFinished ? 'FINALIZADO' : 'EM CURSO'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onSelectTripForMap(trip.id)}
                      className="h-10 rounded-xl bg-white hover:bg-neutral-200 active:scale-[0.99] text-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Map className="w-4 h-4 stroke-[2.5]" />
                      <span>MAPA</span>
                    </button>

                    <button
                      type="button"
                      disabled={exportingId === trip.id}
                      onClick={() => void handleExportGpx(trip.id)}
                      className="h-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-4 h-4 stroke-[2.5]" />
                      <span>
                        {exportingId === trip.id ? 'GERANDO...' : 'GPX'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleDeleteTrip(trip.id)}
                      className={`h-10 rounded-xl border-2 font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                        isConfirming
                          ? 'border-red-400 bg-red-600 text-white animate-pulse'
                          : 'border-neutral-700 bg-black text-neutral-300 hover:border-red-500 hover:text-red-400'
                      }`}
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>{isConfirming ? 'OK?' : 'APAGAR'}</span>
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full py-3.5 rounded-xl bg-white text-black font-mono font-extrabold text-base uppercase tracking-wider hover:bg-neutral-200 shrink-0 cursor-pointer"
        >
          FECHAR HISTÓRICO
        </button>
      </div>
    </div>
  )
}
