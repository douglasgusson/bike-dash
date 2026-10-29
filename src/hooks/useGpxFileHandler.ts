import { useEffect, useState } from 'react'
import { importGpxToDatabase } from '../services/GpxExporter'

interface LaunchParams {
  files?: ReadonlyArray<FileSystemFileHandle>
  targetURL?: string
}

interface LaunchQueue {
  setConsumer: (consumer: (launchParams: LaunchParams) => void | Promise<void>) => void
}

declare global {
  interface Window {
    launchQueue?: LaunchQueue
  }
}

export interface GpxFileHandlerResult {
  isDraggingOver: boolean
}

/**
 * Integrates the PWA with:
 * 1. OS File Handling API (`window.launchQueue`) when the user opens a `.gpx` file via "Open With -> BikeDash"
 * 2. Full-window Drag & Drop of `.gpx` files onto the app
 *
 * Automatically imports the GPX into IndexedDB and triggers `onTripImported(tripId)` to open the route viewer.
 */
export function useGpxFileHandler(
  onTripImported: (tripId: string) => void,
): GpxFileHandlerResult {
  const [isDraggingOver, setIsDraggingOver] = useState(false)

  // 1. OS File Handling API (`window.launchQueue`)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.launchQueue) {
      return
    }

    window.launchQueue.setConsumer(async (launchParams: LaunchParams) => {
      if (!launchParams.files || launchParams.files.length === 0) {
        return
      }

      let lastImportedTripId: string | null = null

      for (const fileHandle of launchParams.files) {
        try {
          const file = await fileHandle.getFile()
          if (
            file.name.toLowerCase().endsWith('.gpx') ||
            file.type.includes('gpx') ||
            file.type.includes('xml')
          ) {
            const text = await file.text()
            const { trip } = await importGpxToDatabase(text)
            lastImportedTripId = trip.id
          }
        } catch (err) {
          console.error('[BikeDash FileHandler] Error importing launched GPX file:', err)
        }
      }

      if (lastImportedTripId) {
        onTripImported(lastImportedTripId)
      }
    })
  }, [onTripImported])

  // 2. Window Drag & Drop `.gpx` handler
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault()
        setIsDraggingOver(true)
      }
    }

    const handleDragLeave = (e: DragEvent) => {
      if (e.relatedTarget === null) {
        setIsDraggingOver(false)
      }
    }

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault()
      setIsDraggingOver(false)

      const files = e.dataTransfer?.files
      if (!files || files.length === 0) return

      let lastImportedTripId: string | null = null

      for (const file of Array.from(files)) {
        if (
          file.name.toLowerCase().endsWith('.gpx') ||
          file.type.includes('gpx') ||
          file.type.includes('xml')
        ) {
          try {
            const text = await file.text()
            const { trip } = await importGpxToDatabase(text)
            lastImportedTripId = trip.id
          } catch (err) {
            console.error('[BikeDash FileHandler] Error importing dropped GPX file:', err)
          }
        }
      }

      if (lastImportedTripId) {
        onTripImported(lastImportedTripId)
      }
    }

    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('drop', handleDrop)

    return () => {
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('drop', handleDrop)
    }
  }, [onTripImported])

  return { isDraggingOver }
}

