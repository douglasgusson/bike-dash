import { useState } from 'react'
import { CalibrationModal } from './components/CalibrationModal'
import { MetricsGrid } from './components/MetricsGrid'
import { SpeedDisplay } from './components/SpeedDisplay'
import { StatusBar } from './components/StatusBar'
import { TripControls } from './components/TripControls'
import { useGeolocation } from './hooks/useGeolocation'
import { useWakeLock } from './hooks/useWakeLock'

export function App() {
  useGeolocation()
  const wakeLock = useWakeLock(true)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  return (
    <div className="h-dvh w-dvw bg-black text-white flex flex-col overflow-hidden">
      {/* Top Status & Hardware Controls Bar */}
      <StatusBar
        wakeLock={wakeLock}
        onOpenSettings={() => setIsSettingsOpen(true)}
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
          <TripControls />
        </div>
      </main>

      {/* Field Calibration & Simulator Modal */}
      <CalibrationModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  )
}

export default App
