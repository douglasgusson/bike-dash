import { useEffect, useRef, useState } from 'react'
import { useTripStore } from '../domain/TripTracker'

const GAUGE_START_DEG = -130
const GAUGE_END_DEG = 130
const GAUGE_SWEEP_DEG = GAUGE_END_DEG - GAUGE_START_DEG // 260°
const CX = 200
const CY = 185
const RADIUS = 152
const FULL_ARC_LENGTH = (GAUGE_SWEEP_DEG / 360) * (2 * Math.PI * RADIUS)

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  }
}

function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  const clampedEnd = Math.max(startAngle + 0.1, Math.min(GAUGE_END_DEG, endAngle))
  const start = polarToCartesian(cx, cy, radius, startAngle)
  const end = polarToCartesian(cx, cy, radius, clampedEnd)
  const largeArcFlag = clampedEnd - startAngle <= 180 ? '0' : '1'
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
}

const FULL_ARC_PATH = describeArc(CX, CY, RADIUS, GAUGE_START_DEG, GAUGE_END_DEG)

/**
 * Continuous 60fps spring-damper interpolation hook.
 * Keeps a single persistent `requestAnimationFrame` loop while mounted so target updates
 * from 1Hz GPS ticks are always smoothly tracked without ever stalling.
 */
function useSmoothGaugeValue(target: number, stiffness = 22, damping = 8.5): number {
  const [displayValue, setDisplayValue] = useState(target)
  const targetRef = useRef(target)
  const currentRef = useRef(target)
  const velocityRef = useRef(0)

  // Always keep targetRef synced with latest store value
  targetRef.current = target

  useEffect(() => {
    let rafId: number
    let lastTime = performance.now()

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000))
      lastTime = now

      const diff = targetRef.current - currentRef.current

      if (Math.abs(diff) > 0.005 || Math.abs(velocityRef.current) > 0.01) {
        const accel = diff * stiffness - velocityRef.current * damping
        velocityRef.current += accel * dt
        currentRef.current += velocityRef.current * dt

        if (currentRef.current < 0) {
          currentRef.current = 0
          velocityRef.current = 0
        }

        setDisplayValue(currentRef.current)
      } else if (currentRef.current !== targetRef.current) {
        currentRef.current = targetRef.current
        velocityRef.current = 0
        setDisplayValue(targetRef.current)
      }

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [stiffness, damping])

  return displayValue
}

export function SpeedDisplay() {
  const currentSpeedKmh = useTripStore((s) => s.currentSpeedKmh)
  const averageSpeedKmh = useTripStore((s) => s.averageSpeedKmh)
  const maxSpeedKmh = useTripStore((s) => s.maxSpeedKmh)
  const status = useTripStore((s) => s.status)
  const isAutoPaused = useTripStore((s) => s.isAutoPaused)
  const gpsError = useTripStore((s) => s.gpsError)
  const isSimulating = useTripStore((s) => s.isSimulating)
  const setSimulating = useTripStore((s) => s.setSimulating)

  // Smooth 60fps interpolated values for the arc, needle, and digital readout
  const animatedSpeedKmh = useSmoothGaugeValue(currentSpeedKmh, 20, 8.0)
  const animatedAvgKmh = useSmoothGaugeValue(averageSpeedKmh, 15, 7.5)

  const formatted = animatedSpeedKmh.toFixed(1)
  const [integerPart, decimalPart] = formatted.split('.')

  const isPausedState = status === 'PAUSED'

  // Dynamic ceiling: 50 km/h standard, expanding to 60+ if the cyclist sprints faster
  const gaugeMaxKmh = Math.max(
    50,
    Math.ceil(Math.max(currentSpeedKmh, maxSpeedKmh) / 10) * 10,
  )

  const speedRatio = Math.max(0, Math.min(1, animatedSpeedKmh / gaugeMaxKmh))
  const dashOffset = FULL_ARC_LENGTH * (1 - speedRatio)

  const speedToAngle = (kmh: number) => {
    const ratio = Math.max(0, Math.min(1, kmh / gaugeMaxKmh))
    return GAUGE_START_DEG + ratio * GAUGE_SWEEP_DEG
  }

  const currentAngle = speedToAngle(animatedSpeedKmh)
  const avgAngle = speedToAngle(animatedAvgKmh)
  const maxAngle = speedToAngle(maxSpeedKmh)

  const activeTip = polarToCartesian(CX, CY, RADIUS, currentAngle)

  // Major ticks every 10 km/h and minor ticks every 5 km/h
  const ticks: Array<{
    kmh: number
    isMajor: boolean
    x1: number
    y1: number
    x2: number
    y2: number
    lx: number
    ly: number
  }> = []
  for (let kmh = 0; kmh <= gaugeMaxKmh; kmh += 5) {
    const isMajor = kmh % 10 === 0
    const angle = speedToAngle(kmh)
    const outer = polarToCartesian(CX, CY, RADIUS - 14, angle)
    const inner = polarToCartesian(
      CX,
      CY,
      isMajor ? RADIUS - 27 : RADIUS - 21,
      angle,
    )
    const labelPos = polarToCartesian(CX, CY, RADIUS - 42, angle)
    ticks.push({
      kmh,
      isMajor,
      x1: outer.x,
      y1: outer.y,
      x2: inner.x,
      y2: inner.y,
      lx: labelPos.x,
      ly: labelPos.y,
    })
  }

  // Average & Max speed markers on the outer ring
  const avgOuter = polarToCartesian(CX, CY, RADIUS + 12, avgAngle)
  const avgInner = polarToCartesian(CX, CY, RADIUS - 10, avgAngle)

  const maxOuter = polarToCartesian(CX, CY, RADIUS + 12, maxAngle)
  const maxInner = polarToCartesian(CX, CY, RADIUS - 10, maxAngle)

  // Pace Delta against Average Speed
  const paceDelta = currentSpeedKmh - averageSpeedKmh
  const showPaceDelta = status === 'RUNNING' && !isAutoPaused && averageSpeedKmh >= 1.0

  return (
    <section
      aria-label="Velocidade Atual"
      className="relative flex-1 flex flex-col items-center justify-center bg-black px-3 py-1 select-none overflow-hidden min-h-0"
    >
      {/* Interactive 60fps Spring SVG Arc Gauge + Center Digital Readout */}
      <div className="relative w-full max-w-[420px] landscape:max-w-[360px] aspect-[400/315] flex items-center justify-center">
        <svg
          viewBox="0 0 400 315"
          className="w-full h-full overflow-visible"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="speedArcGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="55%" stopColor="#00f0ff" />
              <stop offset="100%" stopColor="#ff5f1f" />
            </linearGradient>
            <filter id="arcGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background Track Arc */}
          <path
            d={FULL_ARC_PATH}
            fill="none"
            stroke="#1f1f1f"
            strokeWidth={16}
            strokeLinecap="round"
          />

          {/* Scale Ticks & Numbers with smooth opacity glow */}
          {ticks.map((t) => {
            const diff = animatedSpeedKmh - t.kmh
            const glowIntensity = Math.max(0, Math.min(1, (diff + 2.5) / 3))
            return (
              <g key={t.kmh}>
                <line
                  x1={t.x1}
                  y1={t.y1}
                  x2={t.x2}
                  y2={t.y2}
                  stroke={glowIntensity > 0.5 ? '#e5e5e5' : '#404040'}
                  strokeOpacity={0.35 + glowIntensity * 0.65}
                  strokeWidth={t.isMajor ? 2.5 : 1.5}
                  strokeLinecap="round"
                />
                {t.isMajor && (
                  <text
                    x={t.lx}
                    y={t.ly}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={glowIntensity > 0.6 ? '#d4d4d4' : '#737373'}
                    className="font-mono text-[11px] font-bold"
                  >
                    {t.kmh}
                  </text>
                )}
              </g>
            )
          })}

          {/* Active Speed Arc driven by continuous strokeDashoffset */}
          <path
            d={FULL_ARC_PATH}
            fill="none"
            stroke={
              isPausedState
                ? '#ef4444'
                : isAutoPaused
                  ? '#f97316'
                  : 'url(#speedArcGrad)'
            }
            strokeWidth={16}
            strokeLinecap="round"
            strokeDasharray={FULL_ARC_LENGTH}
            strokeDashoffset={dashOffset}
            opacity={animatedSpeedKmh > 0.15 ? 1 : 0}
            filter="url(#arcGlow)"
          />

          {/* Average Speed Marker (Cyan Notch) */}
          {averageSpeedKmh >= 0.5 && (
            <g>
              <line
                x1={avgInner.x}
                y1={avgInner.y}
                x2={avgOuter.x}
                y2={avgOuter.y}
                stroke="#00f0ff"
                strokeWidth={3.5}
                strokeLinecap="round"
              />
              <circle
                cx={avgOuter.x}
                cy={avgOuter.y}
                r={3.5}
                fill="#00f0ff"
              />
            </g>
          )}

          {/* Max Speed Peak Marker (Orange/Amber Notch) */}
          {maxSpeedKmh >= 1.0 && (
            <g>
              <line
                x1={maxInner.x}
                y1={maxInner.y}
                x2={maxOuter.x}
                y2={maxOuter.y}
                stroke="#ff5f1f"
                strokeWidth={3.5}
                strokeLinecap="round"
              />
              <circle
                cx={maxOuter.x}
                cy={maxOuter.y}
                r={3.5}
                fill="#ff5f1f"
              />
            </g>
          )}

          {/* Glowing Leading Dot on Current Speed */}
          {animatedSpeedKmh > 0.15 && (
            <circle
              cx={activeTip.x}
              cy={activeTip.y}
              r={7.5}
              fill="#ffffff"
              stroke="#000000"
              strokeWidth={2.5}
            />
          )}
        </svg>

        {/* Center Digital Speedometer Readout inside the Gauge */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-8">
          <div className="flex items-baseline justify-center leading-none">
            <span
              className={`font-mono font-extrabold tabular-nums tracking-tighter transition-colors ${
                isPausedState
                  ? 'text-red-500'
                  : isAutoPaused
                    ? 'text-orange-400'
                    : 'text-white'
              } text-[clamp(4.8rem,21vw,8.5rem)] landscape:text-[clamp(4.2rem,13vw,7rem)]`}
            >
              {integerPart.padStart(2, '0')}
            </span>
            <div className="flex flex-col items-start ml-1">
              <span
                className={`font-mono font-bold tabular-nums leading-none ${
                  isPausedState
                    ? 'text-red-400'
                    : isAutoPaused
                      ? 'text-orange-300'
                      : 'text-neutral-300'
                } text-[clamp(1.75rem,6.5vw,3rem)] landscape:text-[clamp(1.5rem,4.5vw,2.5rem)]`}
              >
                .{decimalPart}
              </span>
              <span className="font-mono font-extrabold tracking-widest text-neutral-400 text-xs sm:text-sm mt-0.5">
                KM/H
              </span>
            </div>
          </div>

          {/* Live Pace Indicator vs Average Speed + Legend */}
          <div className="mt-2 flex items-center gap-3 font-mono text-[11px] sm:text-xs">
            {showPaceDelta ? (
              <span
                className={`px-2 py-0.5 rounded-full border font-extrabold tabular-nums ${
                  paceDelta >= 0
                    ? 'border-emerald-500/50 bg-emerald-950/60 text-emerald-400'
                    : 'border-orange-500/50 bg-orange-950/60 text-orange-400'
                }`}
              >
                {paceDelta >= 0 ? '▲' : '▼'}{' '}
                {paceDelta >= 0 ? `+${paceDelta.toFixed(1)}` : paceDelta.toFixed(1)}{' '}
                vs MÉD
              </span>
            ) : (
              <div className="flex items-center gap-3 text-neutral-400 font-bold">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[#00f0ff]" />
                  <span>MÉD {averageSpeedKmh.toFixed(1)}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[#ff5f1f]" />
                  <span>MÁX {maxSpeedKmh.toFixed(1)}</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Contextual GPS Error Banner with Quick Simulation Fallback */}
      {gpsError && !isSimulating && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2 px-3 py-1.5 rounded-lg border border-red-500/70 bg-red-950/40 text-red-300 text-xs sm:text-sm font-mono">
          <span>{gpsError.message}</span>
          <button
            type="button"
            onClick={() => setSimulating(true)}
            className="px-2.5 py-0.5 rounded bg-white text-black font-bold uppercase text-xs hover:bg-neutral-200 cursor-pointer"
          >
            Usar Simulador
          </button>
        </div>
      )}
    </section>
  )
}
