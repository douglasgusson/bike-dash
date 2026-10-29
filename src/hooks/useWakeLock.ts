import { useCallback, useEffect, useRef, useState } from 'react'

export interface WakeLockController {
  isSupported: boolean
  isActive: boolean
  error: string | null
  requestWakeLock: () => Promise<boolean>
  releaseWakeLock: () => Promise<void>
  toggleWakeLock: () => Promise<void>
}

/**
 * Manages the Screen Wake Lock API to prevent screen dimming/locking on the handlebar.
 * Automatically re-acquires the lock if the app returns from background while enabled.
 */
export function useWakeLock(defaultEnabled = true): WakeLockController {
  const isSupported =
    typeof navigator !== 'undefined' &&
    'wakeLock' in navigator &&
    Boolean(navigator.wakeLock)

  const [isActive, setIsActive] = useState(false)
  const [shouldKeepAwake, setShouldKeepAwake] = useState(defaultEnabled)
  const [error, setError] = useState<string | null>(null)
  const sentinelRef = useRef<WakeLockSentinel | null>(null)

  const requestWakeLock = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError('Wake Lock API não suportada neste navegador')
      return false
    }

    try {
      if (sentinelRef.current && !sentinelRef.current.released) {
        setIsActive(true)
        setShouldKeepAwake(true)
        return true
      }

      const sentinel = await navigator.wakeLock.request('screen')
      sentinelRef.current = sentinel
      setIsActive(true)
      setShouldKeepAwake(true)
      setError(null)

      sentinel.addEventListener('release', () => {
        setIsActive(false)
      })

      return true
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Não foi possível manter a tela ativa'
      setError(msg)
      setIsActive(false)
      return false
    }
  }, [isSupported])

  const releaseWakeLock = useCallback(async (): Promise<void> => {
    setShouldKeepAwake(false)
    if (sentinelRef.current) {
      try {
        await sentinelRef.current.release()
      } catch {
        // Ignore release errors if already released by system
      }
      sentinelRef.current = null
    }
    setIsActive(false)
  }, [])

  const toggleWakeLock = useCallback(async (): Promise<void> => {
    if (isActive || shouldKeepAwake) {
      await releaseWakeLock()
    } else {
      await requestWakeLock()
    }
  }, [isActive, shouldKeepAwake, releaseWakeLock, requestWakeLock])

  // Attempt initial wake lock and re-acquire on visibilitychange or user interaction
  useEffect(() => {
    if (!isSupported || !shouldKeepAwake) return

    void requestWakeLock()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && shouldKeepAwake) {
        void requestWakeLock()
      }
    }

    // iOS/Mobile browsers sometimes require a user gesture to grant WakeLock
    const handleFirstInteraction = () => {
      if (shouldKeepAwake && (!sentinelRef.current || sentinelRef.current.released)) {
        void requestWakeLock()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pointerdown', handleFirstInteraction, { passive: true })

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pointerdown', handleFirstInteraction)
    }
  }, [isSupported, shouldKeepAwake, requestWakeLock])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (sentinelRef.current) {
        void sentinelRef.current.release().catch(() => {})
      }
    }
  }, [])

  return {
    isSupported,
    isActive,
    error,
    requestWakeLock,
    releaseWakeLock,
    toggleWakeLock,
  }
}
