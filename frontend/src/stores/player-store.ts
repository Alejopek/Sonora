import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { RepeatMode, Track } from '../types/music'

type PlayerState = { currentTrack: Track | null; queue: Track[]; history: Track[]; favorites: Track[]; currentIndex: number; isPlaying: boolean; currentTime: number; duration: number; volume: number; lastAudibleVolume: number; repeatMode: RepeatMode; shuffle: boolean; loading: boolean; error: string | null; playTrack: (track: Track, queue?: Track[]) => void; setPlaying: (value: boolean) => void; next: () => void; previous: () => void; seek: (time: number) => void; setDuration: (duration: number) => void; setVolume: (volume: number) => void; toggleMute: () => void; setLoading: (loading: boolean) => void; setError: (error: string | null) => void; toggleShuffle: () => void; cycleRepeat: () => void; addToQueue: (track: Track) => void; removeFromQueue: (index: number) => void; clearQueue: () => void; toggleFavorite: (track: Track) => void; isFavorite: (id: string) => boolean }
export const usePlayerStore = create<PlayerState>()(persist((set, get) => ({
  currentTrack: null, queue: [], history: [], favorites: [], currentIndex: -1, isPlaying: false, currentTime: 0, duration: 0, volume: .8, lastAudibleVolume: .8, repeatMode: 'off', shuffle: false, loading: false, error: null,
  playTrack: (track, suppliedQueue) => { const sourceQueue = suppliedQueue ?? get().queue; const index = sourceQueue.findIndex((item) => item.id === track.id); const queue = index >= 0 ? sourceQueue : [track, ...sourceQueue]; set((s) => ({ currentTrack: track, queue, history: [track, ...s.history.filter((item) => item.id !== track.id)].slice(0, 30), currentIndex: index >= 0 ? index : 0, currentTime: 0, duration: 0, isPlaying: true, loading: true, error: null })) },
  setPlaying: (isPlaying) => set({ isPlaying }),
  next: () => { const s = get(); if (!s.queue.length) return; if (s.repeatMode === 'one') { set({ currentTime: 0, isPlaying: true }); return } const index = s.shuffle ? Math.floor(Math.random() * s.queue.length) : s.currentIndex + 1; if (index >= s.queue.length) { if (s.repeatMode === 'all') set({ currentIndex: 0, currentTrack: s.queue[0], currentTime: 0, duration: 0, isPlaying: true, loading: true }); else set({ isPlaying: false }); return } set({ currentIndex: index, currentTrack: s.queue[index], currentTime: 0, duration: 0, isPlaying: true, loading: true }) },
  previous: () => { const s = get(); if (!s.queue.length) return; if (s.currentTime > 4) { set({ currentTime: 0 }); return } const index = s.currentIndex <= 0 ? s.queue.length - 1 : s.currentIndex - 1; set({ currentIndex: index, currentTrack: s.queue[index], currentTime: 0, duration: 0, isPlaying: true, loading: true }) },
  seek: (currentTime) => set({ currentTime }), setDuration: (duration) => set({ duration }), setVolume: (volume) => set((s) => { const nextVolume = Math.max(0, Math.min(1, volume)); return { volume: nextVolume, lastAudibleVolume: nextVolume > 0 ? nextVolume : s.lastAudibleVolume } }), toggleMute: () => set((s) => s.volume > 0 ? { volume: 0, lastAudibleVolume: s.volume } : { volume: s.lastAudibleVolume || .8 }), setLoading: (loading) => set({ loading }), setError: (error) => set({ error }), toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })), cycleRepeat: () => set((s) => ({ repeatMode: s.repeatMode === 'off' ? 'all' : s.repeatMode === 'all' ? 'one' : 'off' })), addToQueue: (track) => set((s) => ({ queue: [...s.queue, track] })), removeFromQueue: (index) => set((s) => {
    if (index < 0 || index >= s.queue.length) return s
    const queue = s.queue.filter((_, i) => i !== index)
    if (index < s.currentIndex) return { queue, currentIndex: s.currentIndex - 1 }
    if (index === s.currentIndex) {
      const currentIndex = Math.min(index, queue.length - 1)
      const currentTrack = queue[currentIndex] ?? null
      return { queue, currentIndex, currentTrack, currentTime: 0, duration: 0, isPlaying: Boolean(currentTrack), loading: Boolean(currentTrack) }
    }
    return { queue }
  }), clearQueue: () => set({ queue: [], currentIndex: -1 }),
  toggleFavorite: (track) => set((s) => ({ favorites: s.favorites.some((item) => item.id === track.id) ? s.favorites.filter((item) => item.id !== track.id) : [track, ...s.favorites] })),
  isFavorite: (id) => get().favorites.some((track) => track.id === id)
}), {
  name: 'sonora-player',
  version: 2,
  partialize: (s) => ({ currentTrack: s.currentTrack, queue: s.queue, history: s.history, favorites: s.favorites, currentIndex: s.currentIndex, volume: s.volume, lastAudibleVolume: s.lastAudibleVolume, repeatMode: s.repeatMode, shuffle: s.shuffle }),
  migrate: (persistedState) => {
    const saved = persistedState as Partial<PlayerState>
    return { ...saved, isPlaying: false, currentTime: 0, duration: 0, loading: false, error: null, lastAudibleVolume: saved.lastAudibleVolume ?? saved.volume ?? .8 } as PlayerState
  },
}))
