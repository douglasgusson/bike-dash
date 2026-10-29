import { Radio, X } from 'lucide-react'
import { useTripStore } from '../domain/TripTracker'

interface CalibrationModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CalibrationModal({ isOpen, onClose }: CalibrationModalProps) {
  const settings = useTripStore((s) => s.settings)
  const updateSettings = useTripStore((s) => s.updateSettings)
  const isSimulating = useTripStore((s) => s.isSimulating)
  const setSimulating = useTripStore((s) => s.setSimulating)
  const rawSpeedKmh = useTripStore((s) => s.rawSpeedKmh)
  const currentSpeedKmh = useTripStore((s) => s.currentSpeedKmh)
  const currentAccuracy = useTripStore((s) => s.currentAccuracy)

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Calibração de Sensores e Simulador"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 select-none"
    >
      <div className="w-full max-w-lg rounded-2xl border-2 border-neutral-700 bg-black p-5 text-white shadow-2xl max-h-[92dvh] overflow-y-auto">
        <div className="flex items-center justify-between border-b-2 border-neutral-800 pb-3 mb-4">
          <div>
            <h2 className="font-mono text-lg font-extrabold uppercase tracking-wider">
              CALIBRAÇÃO & CAMPO
            </h2>
            <p className="text-xs text-neutral-400 font-mono">
              Ajuste fino do filtro EMA, precisão de GPS e simulador
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar ajustes"
            className="p-2 rounded-full border-2 border-neutral-700 hover:border-white text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5 font-mono">
          {/* Live Telemetry Preview (Raw vs EMA Smoothed) */}
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-center">
            <div>
              <div className="text-[11px] text-neutral-400 uppercase">VEL. BRUTA</div>
              <div className="text-lg font-extrabold tabular-nums text-neutral-300">
                {rawSpeedKmh.toFixed(1)} <span className="text-xs">km/h</span>
              </div>
            </div>
            <div className="border-x border-neutral-800">
              <div className="text-[11px] text-emerald-400 uppercase">VEL. EMA</div>
              <div className="text-lg font-extrabold tabular-nums text-emerald-400">
                {currentSpeedKmh.toFixed(1)} <span className="text-xs">km/h</span>
              </div>
            </div>
            <div>
              <div className="text-[11px] text-neutral-400 uppercase">PRECISÃO</div>
              <div className="text-lg font-extrabold tabular-nums text-white">
                {currentAccuracy !== null ? `±${Math.round(currentAccuracy)}m` : '--'}
              </div>
            </div>
          </div>

          {/* 1. EMA Alpha Factor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="ema-alpha" className="text-sm font-bold uppercase">
                Fator Alpha EMA (Suavização)
              </label>
              <span className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-emerald-400 font-extrabold text-sm tabular-nums">
                α = {settings.emaAlpha.toFixed(2)}
              </span>
            </div>
            <input
              id="ema-alpha"
              type="range"
              min="0.15"
              max="0.85"
              step="0.05"
              value={settings.emaAlpha}
              onChange={(e) =>
                updateSettings({ emaAlpha: parseFloat(e.target.value) })
              }
              className="w-full accent-emerald-500 h-2 bg-neutral-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-neutral-400">
              <span>0.15 (Mais suave)</span>
              <span className="text-emerald-400 font-bold">Ideal: 0.30 – 0.60</span>
              <span>0.85 (Mais rápido)</span>
            </div>
          </div>

          {/* 2. Accuracy Cutoff Filter */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="max-accuracy" className="text-sm font-bold uppercase">
                Corte de Erro GPS (Accuracy)
              </label>
              <span className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-white font-extrabold text-sm tabular-nums">
                &le; {settings.maxAccuracyMeters}m
              </span>
            </div>
            <input
              id="max-accuracy"
              type="range"
              min="10"
              max="50"
              step="5"
              value={settings.maxAccuracyMeters}
              onChange={(e) =>
                updateSettings({
                  maxAccuracyMeters: parseInt(e.target.value, 10),
                })
              }
              className="w-full accent-white h-2 bg-neutral-800 rounded-lg cursor-pointer"
            />
            <p className="text-[11px] text-neutral-400">
              Ignora coordenadas com margem de erro acima de {settings.maxAccuracyMeters}m para evitar distância fantasma.
            </p>
          </div>

          {/* 3. Auto-Pause Toggle */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <div className="text-sm font-bold uppercase">Auto-Pause (0 km/h)</div>
              <div className="text-[11px] text-neutral-400">
                Pausa o cronômetro automaticamente em semáforos/paradas
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                updateSettings({ autoPauseEnabled: !settings.autoPauseEnabled })
              }
              className={`px-4 py-2 rounded-xl border-2 font-extrabold text-xs uppercase cursor-pointer ${
                settings.autoPauseEnabled
                  ? 'border-emerald-500 bg-emerald-500 text-black'
                  : 'border-neutral-700 bg-black text-neutral-400'
              }`}
            >
              {settings.autoPauseEnabled ? 'ATIVO' : 'DESATIVADO'}
            </button>
          </div>

          {/* 4. Built-in Cycling GPS Simulator */}
          <div className="flex items-center justify-between rounded-xl border-2 border-neutral-800 p-3 bg-neutral-950">
            <div className="pr-3">
              <div className="flex items-center gap-1.5 text-sm font-bold uppercase text-white">
                <Radio className="w-4 h-4 text-emerald-400" />
                <span>Simulador de Pedal (Teste)</span>
              </div>
              <div className="text-[11px] text-neutral-400 mt-0.5">
                Gera coordenadas reais com ruído de GPS e paradas para testar EMA e Auto-Pause em bancada.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSimulating(!isSimulating)}
              className={`px-4 py-2 rounded-xl border-2 font-extrabold text-xs uppercase shrink-0 cursor-pointer ${
                isSimulating
                  ? 'border-emerald-400 bg-emerald-500 text-black'
                  : 'border-neutral-700 bg-black text-white hover:border-white'
              }`}
            >
              {isSimulating ? 'SIMULANDO' : 'ATIVAR'}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full py-3.5 rounded-xl bg-white text-black font-mono font-extrabold text-base uppercase tracking-wider hover:bg-neutral-200 cursor-pointer"
        >
          FECHAR PAINEL
        </button>
      </div>
    </div>
  )
}
