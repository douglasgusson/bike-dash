import { useState } from 'react'
import { CalibrationModal } from './components/CalibrationModal'
import { MetricsGrid } from './components/MetricsGrid'
import { SpeedDisplay } from './components/SpeedDisplay'
import { StatusBar } from './components/StatusBar'
import { TripControls } from './components/TripControls'
import { TripDetailsContainer } from './components/TripDetailsContainer'
import { TripHistoryModal } from './components/TripHistoryModal'
import { useGeolocation } from './hooks/useGeolocation'
import { useTripLogger } from './hooks/useTripLogger'
import { useWakeLock } from './hooks/useWakeLock'

export function App() {
  useGeolocation()
  const tripLogger = useTripLogger()
  const wakeLock = useWakeLock(true)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [selectedTripIdForMap, setSelectedTripIdForMap] = useState<string | null>(null)
  const [openedMapFromHistory, setOpenedMapFromHistory] = useState(false)

  const handleOpenMapFromHistory = (tripId: string) => {
    setIsHistoryOpen(false)
    setOpenedMapFromHistory(true)
    setSelectedTripIdForMap(tripId)
  }

  const handleOpenMapDirect = (tripId: string) => {
    setOpenedMapFromHistory(false)
    setSelectedTripIdForMap(tripId)
  }

  const handleBackToHistory = () => {
    setSelectedTripIdForMap(null)
    setOpenedMapFromHistory(false)
    setIsHistoryOpen(true)
  }

  return (
    <div className="h-dvh w-dvw bg-black text-white flex flex-col overflow-hidden">
      {/* Top Status & Hardware Controls Bar */}
      <StatusBar
        wakeLock={wakeLock}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
      />

      {/* Responsive Portrait (Stem) & Landscape (Top Tube) Layout */}
      <main className="flex-1 flex flex-col landscape:flex-row min-h-0 overflow-hidden">
        {/* Giant Speedometer (~50% screen area) */}
        <div className="flex-1 flex flex-col min-h-0 landscape:w-1/2 landscape:border-r-2 landscape:border-neutral-800">
          <SpeedDisplay />
        </div>

        {/* 2x2 Session Metrics Grid + Glove-friendly Action Buttons */}
        <div className="flex flex-col landscape:w-1/2 landscape:flex-1 min-h-0 justify-end">
          <MetricsGrid />
          <TripControls
            tripLogger={tripLogger}
            onViewTripMap={handleOpenMapDirect}
          />
        </div>
      </main>

      {/* Field Calibration & Simulator Modal */}
      <CalibrationModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Trip History & GPX Export Modal */}
      <TripHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onSelectTripForMap={handleOpenMapFromHistory}
      />

      {/* Post-Session Trip Viewer (Douglas-Peucker + Leaflet Dark Matter Map) */}
      <TripDetailsContainer
        tripId={selectedTripIdForMap}
        onClose={() => {
          setSelectedTripIdForMap(null)
          setOpenedMapFromHistory(false)
        }}
        onBackToHistory={openedMapFromHistory ? handleBackToHistory : undefined}
      />
    </div>
  )
}

export default App
