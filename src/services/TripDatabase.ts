import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { TrackPoint, Trip } from '../domain/types'

export const DB_NAME = 'bikedash_db'
export const DB_VERSION = 1

export interface BikeDashDBSchema extends DBSchema {
  trips: {
    key: string
    value: Trip
    indexes: {
      'by-startTime': number
    }
  }
  trackpoints: {
    key: [string, number]
    value: TrackPoint
    indexes: {
      'by-trip': string
      'by-tripId': string
      'by-tripId-timestamp': [string, number]
    }
  }
}

let dbPromise: Promise<IDBPDatabase<BikeDashDBSchema>> | null = null
const memoryTrips = new Map<string, Trip>()
const memoryTrackPoints = new Map<string, TrackPoint[]>()

function hasIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined'
}

export function getBikeDashDB(): Promise<IDBPDatabase<BikeDashDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<BikeDashDBSchema>(DB_NAME, 2, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        if (!db.objectStoreNames.contains('trips')) {
          const tripStore = db.createObjectStore('trips', { keyPath: 'id' })
          tripStore.createIndex('by-startTime', 'startTime')
        }

        if (!db.objectStoreNames.contains('trackpoints')) {
          const pointStore = db.createObjectStore('trackpoints', {
            keyPath: ['tripId', 'timestamp'],
          })
          pointStore.createIndex('by-trip', 'tripId')
          pointStore.createIndex('by-tripId', 'tripId')
          pointStore.createIndex('by-tripId-timestamp', ['tripId', 'timestamp'])
        } else if (oldVersion < 2) {
          const pointStore = transaction.objectStore('trackpoints')
          if (!pointStore.indexNames.contains('by-trip')) {
            pointStore.createIndex('by-trip', 'tripId')
          }
        }
      },
    })
  }
  return dbPromise
}

/**
 * Creates or updates a Trip metadata record in the `trips` store.
 */
export async function saveTrip(trip: Trip): Promise<void> {
  if (!hasIndexedDB()) {
    memoryTrips.set(trip.id, { ...trip })
    return
  }

  const db = await getBikeDashDB()
  await db.put('trips', trip)
}

/**
 * Updates partial fields of an existing Trip in the `trips` store.
 */
export async function updateTripMetadata(
  tripId: string,
  patch: Partial<Omit<Trip, 'id'>>,
): Promise<Trip | null> {
  if (!hasIndexedDB()) {
    const existing = memoryTrips.get(tripId)
    if (!existing) return null
    const updated: Trip = { ...existing, ...patch }
    memoryTrips.set(tripId, updated)
    return updated
  }

  const db = await getBikeDashDB()
  const tx = db.transaction('trips', 'readwrite')
  const existing = await tx.store.get(tripId)
  if (!existing) {
    await tx.done
    return null
  }
  const updated: Trip = { ...existing, ...patch }
  await tx.store.put(updated)
  await tx.done
  return updated
}

/**
 * Fast bulk insert of buffered TrackPoints using a single IndexedDB readwrite transaction.
 */
export async function flushTrackPointsBatch(points: TrackPoint[]): Promise<void> {
  if (points.length === 0) return

  if (!hasIndexedDB()) {
    for (const pt of points) {
      const list = memoryTrackPoints.get(pt.tripId) ?? []
      const existingIdx = list.findIndex((item) => item.timestamp === pt.timestamp)
      if (existingIdx >= 0) {
        list[existingIdx] = { ...pt }
      } else {
        list.push({ ...pt })
      }
      memoryTrackPoints.set(pt.tripId, list)
    }
    return
  }

  const db = await getBikeDashDB()
  const tx = db.transaction('trackpoints', 'readwrite')
  await Promise.all([
    ...points.map((point) => tx.store.put(point)),
    tx.done,
  ])
}

/**
 * Returns all trips sorted from newest to oldest, reading ONLY the lightweight `trips` store.
 */
export async function getAllTrips(): Promise<Trip[]> {
  if (!hasIndexedDB()) {
    return Array.from(memoryTrips.values()).sort((a, b) => b.startTime - a.startTime)
  }

  const db = await getBikeDashDB()
  const trips = await db.getAll('trips')
  return trips.sort((a, b) => b.startTime - a.startTime)
}

/**
 * Retrieves a single Trip record by ID.
 */
export async function getTripById(tripId: string): Promise<Trip | undefined> {
  if (!hasIndexedDB()) {
    return memoryTrips.get(tripId)
  }

  const db = await getBikeDashDB()
  return db.get('trips', tripId)
}

/**
 * Queries all TrackPoints belonging to `tripId` via the `by-trip` index,
 * ordered chronologically by `timestamp`.
 */
export async function getTrackPointsByTripId(tripId: string): Promise<TrackPoint[]> {
  if (!hasIndexedDB()) {
    const list = memoryTrackPoints.get(tripId) ?? []
    return [...list].sort((a, b) => a.timestamp - b.timestamp)
  }

  const db = await getBikeDashDB()
  const points = await db.getAllFromIndex('trackpoints', 'by-trip', tripId)
  return points.sort((a, b) => a.timestamp - b.timestamp)
}

/**
 * Deletes a Trip metadata record from `trips` and purges all associated coordinates
 * from `trackpoints` using the `by-tripId` index.
 */
export async function deleteTripCascade(tripId: string): Promise<void> {
  if (!hasIndexedDB()) {
    memoryTrips.delete(tripId)
    memoryTrackPoints.delete(tripId)
    return
  }

  const db = await getBikeDashDB()
  const tx = db.transaction(['trips', 'trackpoints'], 'readwrite')
  await tx.objectStore('trips').delete(tripId)

  const pointStore = tx.objectStore('trackpoints')
  const index = pointStore.index('by-tripId')
  const keys = await index.getAllKeys(tripId)
  await Promise.all(keys.map((key) => pointStore.delete(key)))

  await tx.done
}

/**
 * Clears in-memory fallback storage (useful for unit tests).
 */
export function clearMemoryTripDb(): void {
  memoryTrips.clear()
  memoryTrackPoints.clear()
}

