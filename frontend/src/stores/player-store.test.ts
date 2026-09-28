import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Track } from '../types/music'

const localStorageData = vi.hoisted(() => new Map<string, string>())

type PlayerStore = typeof import('./player-store').usePlayerStore
let usePlayerStore: PlayerStore

const makeTrack = (id: string): Track => ({
  id,
  title: `Track ${id}`,
  artist: 'Test artist',
  album: 'Test album',
  thumbnail: `${id}.jpg`,
})

const initialState = {
  currentTrack: null,
  queue: [],
  history: [],
  favorites: [],
  currentIndex: -1,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  repeatMode: 'off' as const,
  shuffle: false,
  loading: false,
  error: null,
}

beforeAll(async () => {
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => localStorageData.get(key) ?? null,
    setItem: (key: string, value: string) => localStorageData.set(key, value),
    removeItem: (key: string) => localStorageData.delete(key),
    clear: () => localStorageData.clear(),
  })

  ;({ usePlayerStore } = await import('./player-store'))
})

beforeEach(() => {
  localStorageData.clear()
  usePlayerStore.setState(initialState)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('player store', () => {
  it('avanza al siguiente track con repeat off', () => {
    const queue = [makeTrack('a'), makeTrack('b')]
    usePlayerStore.setState({ queue, currentTrack: queue[0], currentIndex: 0 })

    usePlayerStore.getState().next()

    expect(usePlayerStore.getState().currentTrack).toEqual(queue[1])
    expect(usePlayerStore.getState().currentIndex).toBe(1)
    expect(usePlayerStore.getState().isPlaying).toBe(true)
  })

  it('vuelve al primer track al final con repeat all', () => {
    const queue = [makeTrack('a'), makeTrack('b')]
    usePlayerStore.setState({ queue, currentTrack: queue[1], currentIndex: 1, repeatMode: 'all' })

    usePlayerStore.getState().next()

    expect(usePlayerStore.getState().currentTrack).toEqual(queue[0])
    expect(usePlayerStore.getState().currentIndex).toBe(0)
    expect(usePlayerStore.getState().currentTime).toBe(0)
    expect(usePlayerStore.getState().isPlaying).toBe(true)
  })

  it('mantiene el track actual y reinicia el tiempo con repeat one', () => {
    const track = makeTrack('a')
    usePlayerStore.setState({ queue: [track], currentTrack: track, currentIndex: 0, currentTime: 42 })
    usePlayerStore.getState().cycleRepeat()
    usePlayerStore.getState().cycleRepeat()

    usePlayerStore.getState().next()

    expect(usePlayerStore.getState().currentTrack).toEqual(track)
    expect(usePlayerStore.getState().currentIndex).toBe(0)
    expect(usePlayerStore.getState().currentTime).toBe(0)
    expect(usePlayerStore.getState().isPlaying).toBe(true)
  })

  it('detiene la reproducción al final de la cola con repeat off', () => {
    const track = makeTrack('a')
    usePlayerStore.setState({ queue: [track], currentTrack: track, currentIndex: 0, isPlaying: true })

    usePlayerStore.getState().next()

    expect(usePlayerStore.getState().isPlaying).toBe(false)
    expect(usePlayerStore.getState().currentTrack).toEqual(track)
  })

  it('retrocede al track anterior', () => {
    const queue = [makeTrack('a'), makeTrack('b')]
    usePlayerStore.setState({ queue, currentTrack: queue[1], currentIndex: 1 })

    usePlayerStore.getState().previous()

    expect(usePlayerStore.getState().currentTrack).toEqual(queue[0])
    expect(usePlayerStore.getState().currentIndex).toBe(0)
  })

  it('reinicia el track actual al retroceder después de cuatro segundos', () => {
    const queue = [makeTrack('a'), makeTrack('b')]
    usePlayerStore.setState({ queue, currentTrack: queue[1], currentIndex: 1, currentTime: 5 })

    usePlayerStore.getState().previous()

    expect(usePlayerStore.getState().currentTrack).toEqual(queue[1])
    expect(usePlayerStore.getState().currentTime).toBe(0)
  })

  it('elige el índice de shuffle usando Math.random', () => {
    const queue = [makeTrack('a'), makeTrack('b'), makeTrack('c'), makeTrack('d')]
    usePlayerStore.setState({ queue, currentTrack: queue[0], currentIndex: 0, shuffle: true })
    vi.spyOn(Math, 'random').mockReturnValue(0.75)

    usePlayerStore.getState().next()

    expect(usePlayerStore.getState().currentTrack).toEqual(queue[3])
    expect(usePlayerStore.getState().currentIndex).toBe(3)
  })

  it('playTrack usa la queue suministrada y encuentra su índice', () => {
    const queue = [makeTrack('a'), makeTrack('b')]

    usePlayerStore.getState().playTrack(queue[1], queue)

    expect(usePlayerStore.getState().queue).toEqual(queue)
    expect(usePlayerStore.getState().currentTrack).toEqual(queue[1])
    expect(usePlayerStore.getState().currentIndex).toBe(1)
    expect(usePlayerStore.getState().history[0]).toEqual(queue[1])
  })

  it('playTrack conserva la queue existente si no se suministra otra', () => {
    const queue = [makeTrack('a'), makeTrack('b')]
    usePlayerStore.setState({ queue })

    usePlayerStore.getState().playTrack(queue[1])

    expect(usePlayerStore.getState().queue).toEqual(queue)
    expect(usePlayerStore.getState().currentTrack).toEqual(queue[1])
    expect(usePlayerStore.getState().currentIndex).toBe(1)
  })

  it.fails('ajusta el índice actual al quitar un track anterior a la reproducción', () => {
    // Known behavior: removeFromQueue filters the queue but leaves currentIndex unchanged.
    const queue = [makeTrack('a'), makeTrack('b'), makeTrack('c')]
    usePlayerStore.setState({ queue, currentTrack: queue[2], currentIndex: 2 })

    usePlayerStore.getState().removeFromQueue(0)

    expect(usePlayerStore.getState().queue).toEqual(queue.slice(1))
    expect(usePlayerStore.getState().currentTrack).toEqual(queue[2])
    expect(usePlayerStore.getState().currentIndex).toBe(1)
  })

  it('actualiza la queue al quitar un track posterior al actual', () => {
    const queue = [makeTrack('a'), makeTrack('b'), makeTrack('c')]
    usePlayerStore.setState({ queue, currentTrack: queue[0], currentIndex: 0 })

    usePlayerStore.getState().removeFromQueue(2)

    expect(usePlayerStore.getState().queue).toEqual(queue.slice(0, 2))
    expect(usePlayerStore.getState().currentIndex).toBe(0)
  })

  it('actualiza seek en sus valores límite', () => {
    const { seek } = usePlayerStore.getState()

    seek(0)
    expect(usePlayerStore.getState().currentTime).toBe(0)

    usePlayerStore.getState().setDuration(180)
    seek(180)
    expect(usePlayerStore.getState().currentTime).toBe(180)
  })

  it('actualiza el volumen en sus valores límite', () => {
    const { setVolume } = usePlayerStore.getState()

    setVolume(0)
    expect(usePlayerStore.getState().volume).toBe(0)

    setVolume(1)
    expect(usePlayerStore.getState().volume).toBe(1)
  })
})
