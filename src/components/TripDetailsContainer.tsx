import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowLeft, Download, MapPin, Palette, X } from 'lucide-react'
import { processTripRouteGeometry, type LatLngTuple } from '../domain/geometry'
import { formatDuration } from '../domain/math'
import type { Trip } from '../domain/types'
import { exportTripToGpxDownload } from '../services/GpxExporter'
import { getTrackPointsByTripId, getTripById } from '../services/TripDatabase'
import { RouteMap, type RouteLineColor } from './RouteMap'

interface TripDetailsContainerProps {
  tripId: string | null
  onClose: () => void
  onBackToHistory?: () => void
}

type ViewerStatus = 'LOADING' | 'READY' | 'EMPTY' | 'ERROR'

/**
 * Post-session Trip Viewer container.
 * Fetches trip metadata and `trackpoints` via the `by-trip` index directly from IndexedDB
 * in local component state, runs the Douglas-Peucker simplification pipeline, and renders
 * the AMOLED dark-mode `<RouteMap>`.
 */
export function TripDetailsContainer({
  tripId,
  onClose,
  onBackToHistory,
}: TripDetailsContainerProps) {
  const [status, setStatus] = useState<ViewerStatus>('LOADING')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [trip, setTrip] = useState<Trip | null>(null)
  const [simplifiedCoords, setSimplifiedCoords] = useState<LatLngTuple[]>([])
  const [rawPointCount, setRawPointCount] = useState(0)
  const [simplifiedPointCount, setSimplifiedPointCount] = useState(0)
  const [epsilonMeters, setEpsilonMeters] = useState(7)
  const [lineColor, setLineColor] = useState<RouteLineColor>('cyan')
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    if (!tripId) return

    let cancelled = false
    setStatus('LOADING')
    setErrorMessage(null)

    async function loadAndSimplifyRoute(id: string) {
      try {
        const [tripRecord, rawTrackPoints] = await Promise.all([
          getTripById(id),
          getTrackPointsByTripId(id),
        ])

        if (cancelled) return

        const { rawCount, simplifiedCount, polyline } = processTripRouteGeometry(
          rawTrackPoints,
          epsilonMeters,
        )

        setTrip(tripRecord ?? null)
        setRawPointCount(rawCount)
        setSimplifiedPointCount(simplifiedCount)
        setSimplifiedCoords(polyline)

        if (polyline.length === 0) {
          setStatus('EMPTY')
        } else {
          setStatus('READY')
        }
      } catch (err) {
        if (cancelled) return
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Falha ao carregar os dados geográficos da viagem.',
        )
        setStatus('ERROR')
      }
    }

    void loadAndSimplifyRoute(tripId)

    return () => {
      cancelled = true
    }
  }, [tripId, epsilonMeters])

  if (!tripId) return null

  const durationMs =
    trip?.endTime && trip.endTime > trip.startTime
      ? trip.endTime - trip.startTime
      : 0

  const handleExport = async () => {
    setIsExporting(true)
    try {
      await exportTripToGpxDownload(tripId)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Resumo da Viagem e Mapa da Rota"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-3 sm:p-4 select-none"
    >
      <div className="w-full max-w-3xl h-[92dvh] rounded-2xl border-2 border-neutral-700 bg-black p-4 sm:p-5 text-white shadow-2xl flex flex-col overflow-hidden font-mono">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b-2 border-neutral-800 pb-3 mb-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {onBackToHistory && (
              <button
                type="button"
                onClick={onBackToHistory}
                aria-label="Voltar para o histórico"
                className="p-2 rounded-full border-2 border-neutral-700 hover:border-white text-white shrink-0 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-extrabold uppercase tracking-wider truncate">
                RESUMO DA VIAGEM
              </h2>
              <p className="text-[11px] sm:text-xs text-neutral-400 truncate">
                {trip
                  ? new Date(trip.startTime).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : `ID: ${tripId.slice(0, 8)}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Toggle Neon Cyan / Electric Orange Polyline */}
            <button
              type="button"
              onClick={() =>
                setLineColor((prev) => (prev === 'cyan' ? 'orange' : 'cyan'))
              }
              title="Alternar cor da linha (Azul Neon / Laranja Elétrico)"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border-2 border-neutral-700 hover:border-white text-xs font-bold uppercase cursor-pointer"
            >
              <Palette
                className={`w-3.5 h-3.5 ${
                  lineColor === 'cyan' ? 'text-[#00f0ff]' : 'text-[#ff5f1f]'
                }`}
              />
              <span className="hidden sm:inline">
                {lineColor === 'cyan' ? 'AZUL NEON' : 'LARANJA'}
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar visualização de rota"
              className="p-2 rounded-full border-2 border-neutral-700 hover:border-white text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Summary Metrics Bar */}
        <div className="grid grid-cols-3 gap-2 rounded-xl border border-neutral-800 bg-neutral-950 p-2.5 sm:p-3 mb-3 text-center shrink-0">
          <div>
            <div className="text-[10px] sm:text-xs text-neutral-400 uppercase font-bold">
              DISTÂNCIA
            </div>
            <div className="text-lg sm:text-2xl font-extrabold tabular-nums text-white">
              {trip ? trip.totalDistance.toFixed(2) : '0.00'}{' '}
              <span className="text-xs text-neutral-400">KM</span>
            </div>
          </div>

          <div className="border-x border-neutral-800">
            <div className="text-[10px] sm:text-xs text-neutral-400 uppercase font-bold">
              DURAÇÃO
            </div>
            <div className="text-lg sm:text-2xl font-extrabold tabular-nums text-white">
              {durationMs > 0 ? formatDuration(durationMs) : '--:--'}
            </div>
          </div>

          <div>
            <div className="text-[10px] sm:text-xs text-neutral-400 uppercase font-bold">
              OTIMIZAÇÃO DP (ε={epsilonMeters}m)
            </div>
            <div className="text-sm sm:text-lg font-extrabold tabular-nums text-emerald-400 mt-0.5">
              {rawPointCount} &rarr; {simplifiedPointCount}{' '}
              <span className="text-[10px] text-neutral-400">PTS</span>
            </div>
          </div>
        </div>

        {/* Main Viewport: Loading / Error / Empty / RouteMap */}
        <div className="flex-1 min-h-0 flex flex-col">
          {status === 'LOADING' && (
            <div className="flex-1 rounded-xl border-2 border-neutral-800 bg-[#1a1a1a] flex flex-col items-center justify-center p-6 text-center">
              <div className="h-8 w-8 rounded-full border-3 border-emerald-500 border-t-transparent animate-spin mb-3" />
              <p className="text-sm font-bold uppercase text-neutral-200">
                Processando Geometria da Rota...
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                Lendo IndexedDB e aplicando simplificação Douglas-Peucker
              </p>
            </div>
          )}

          {status === 'ERROR' && (
            <div className="flex-1 rounded-xl border-2 border-red-500/60 bg-[#1a1a1a] flex flex-col items-center justify-center p-6 text-center">
              <AlertTriangle className="w-10 h-10 text-red-400 mb-2" />
              <p className="text-sm font-bold uppercase text-red-300">
                Erro ao Carregar Rota
              </p>
              <p className="text-xs text-neutral-400 mt-1 max-w-md">
                {errorMessage}
              </p>
            </div>
          )}

          {status === 'EMPTY' && (
            <div className="flex-1 rounded-xl border-2 border-dashed border-neutral-800 bg-[#1a1a1a] flex flex-col items-center justify-center p-6 text-center">
              <MapPin className="w-10 h-10 text-neutral-500 mb-2" />
              <p className="text-sm font-bold uppercase text-neutral-300">
                Sem Coordenadas Registradas
              </p>
              <p className="text-xs text-neutral-400 mt-1 max-w-md">
                Esta sessão não capturou pontos em movimento (&gt; 1.0 km/h) suficientes para desenhar o trajeto.
              </p>
            </div>
          )}

          {status === 'READY' && (
            <div className="flex-1 min-h-0 flex flex-col gap-2">
              <div className="flex-1 min-h-0">
                <RouteMap
                  coordinates={simplifiedCoords}
                  lineColor={lineColor}
                />
              </div>

              {/* Douglas-Peucker Epsilon Fine-Tuning Bar */}
              <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-neutral-800 bg-neutral-950 text-xs shrink-0">
                <span className="text-neutral-400 font-bold uppercase">
                  Tolerância Douglas-Peucker:
                </span>
                <div className="flex items-center gap-1.5">
                  {[5, 7, 10].map((eps) => (
                    <button
                      key={eps}
                      type="button"
                      onClick={() => setEpsilonMeters(eps)}
                      className={`px-2.5 py-1 rounded-lg font-extrabold uppercase cursor-pointer ${
                        epsilonMeters === eps
                          ? 'bg-emerald-500 text-black'
                          : 'bg-black border border-neutral-700 text-neutral-300 hover:border-white'
                      }`}
                    >
                      {eps}m
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="grid grid-cols-2 gap-3 mt-3 shrink-0">
          <button
            type="button"
            disabled={isExporting || status !== 'READY'}
            onClick={() => void handleExport()}
            className="h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 active:scale-[0.99] text-black font-extrabold text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4 stroke-[2.5]" />
            <span>{isExporting ? 'GERANDO GPX...' : 'EXPORTAR .GPX'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="h-12 rounded-xl bg-white hover:bg-neutral-200 active:scale-[0.99] text-black font-extrabold text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center cursor-pointer"
          >
            FECHAR MAPA
          </button>
        </div>
      </div>
    </div>
  )
}

