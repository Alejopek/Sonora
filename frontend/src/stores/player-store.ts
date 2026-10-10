import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Album, RepeatMode, Track } from '../types/music'
import { getAlbumFavorites, getFavorites, getHistory, toggleRemoteAlbumFavorite, toggleRemoteFavorite, type SavedTrackResponse } from '../services/api'
import { useAuthStore } from './auth-store'

type PlayerState = { currentTrack: Track | null; queue: Track[]; history: Track[]; favorites: Track[]; favoriteAlbums: Album[]; currentIndex: number; isPlaying: boolean; currentTime: number; duration: number; volume: number; lastAudibleVolume: number; repeatMode: RepeatMode; shuffle: boolean; loading: boolean; error: string | null; playTrack: (track: Track, queue?: Track[]) => void; setPlaying: (value: boolean) => void; next: () => void; previous: () => void; seek: (time: number) => void; setDuration: (duration: number) => void; setVolume: (volume: number) => void; toggleMute: () => void; setLoading: (loading: boolean) => void; setError: (error: string | null) => void; toggleShuffle: () => void; cycleRepeat: () => void; addToQueue: (track: Track) => void; appendQueueTracks: (tracks: Track[]) => void; removeFromQueue: (index: number) => void; clearQueue: () => void; toggleFavorite: (track: Track) => void; isFavorite: (id: string) => boolean; toggleAlbumFavorite: (album: Album) => Promise<void>; isAlbumFavorite: (id: string) => boolean; syncCloudLibrary: () => Promise<void> }
export const savedTrack = (track: Track) => ({ videoId: track.id, title: track.title, artist: track.artist, artistId: track.artistId, album: track.album, albumId: track.albumId, genres: track.genres, duration: track.durationSeconds, thumbnailUrl: track.thumbnail })
const fromSavedTrack = (track: SavedTrackResponse): Track => ({ id: track.videoId, title: track.title, artist: track.artist, artistId: track.artistId, album: track.album ?? '', albumId: track.albumId, genres: track.genres, thumbnail: track.thumbnailUrl, durationSeconds: track.duration })
export const usePlayerStore = create<PlayerState>()(persist((set, get) => ({
  currentTrack: null, queue: [], history: [], favorites: [], favoriteAlbums: [], currentIndex: -1, isPlaying: false, currentTime: 0, duration: 0, volume: .8, lastAudibleVolume: .8, repeatMode: 'off', shuffle: false, loading: false, error: null,
  playTrack: (track, suppliedQueue) => { const sourceQueue = suppliedQueue ?? get().queue; const index = sourceQueue.findIndex((item) => item.id === track.id); const queue = index >= 0 ? sourceQueue : [track, ...sourceQueue]; set((s) => ({ currentTrack: track, queue, history: [track, ...s.history.filter((item) => item.id !== track.id)].slice(0, 30), currentIndex: index >= 0 ? index : 0, currentTime: 0, duration: 0, isPlaying: true, loading: true, error: null })) },
  setPlaying: (isPlaying) => set({ isPlaying }),
  next: () => { const s = get(); if (!s.queue.length) return; if (s.repeatMode === 'one') { set({ currentTime: 0, isPlaying: true }); return } const index = s.shuffle ? Math.floor(Math.random() * s.queue.length) : s.currentIndex + 1; if (index >= s.queue.length) { if (s.repeatMode === 'all') set({ currentIndex: 0, currentTrack: s.queue[0], currentTime: 0, duration: 0, isPlaying: true, loading: true }); else set({ isPlaying: false }); return } set({ currentIndex: index, currentTrack: s.queue[index], currentTime: 0, duration: 0, isPlaying: true, loading: true }) },
  previous: () => { const s = get(); if (!s.queue.length) return; if (s.currentTime > 4) { set({ currentTime: 0 }); return } const index = s.currentIndex <= 0 ? s.queue.length - 1 : s.currentIndex - 1; set({ currentIndex: index, currentTrack: s.queue[index], currentTime: 0, duration: 0, isPlaying: true, loading: true }) },
  seek: (currentTime) => set({ currentTime }), setDuration: (duration) => set({ duration }), setVolume: (volume) => set((s) => { const nextVolume = Math.max(0, Math.min(1, volume)); return { volume: nextVolume, lastAudibleVolume: nextVolume > 0 ? nextVolume : s.lastAudibleVolume } }), toggleMute: () => set((s) => s.volume > 0 ? { volume: 0, lastAudibleVolume: s.volume } : { volume: s.lastAudibleVolume || .8 }), setLoading: (loading) => set({ loading }), setError: (error) => set({ error }), toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })), cycleRepeat: () => set((s) => ({ repeatMode: s.repeatMode === 'off' ? 'all' : s.repeatMode === 'all' ? 'one' : 'off' })), addToQueue: (track) => set((s) => ({ queue: [...s.queue, track] })), appendQueueTracks: (tracks) => set((s) => {
    const known = new Set(s.queue.map((item) => item.id))
    const additions: Track[] = []
    for (const item of tracks) {
      if (!known.has(item.id)) {
        known.add(item.id)
        additions.push(item)
      }
    }
    return additions.length ? { queue: [...s.queue, ...additions] } : s
  }), removeFromQueue: (index) => set((s) => {
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
  toggleFavorite: (track) => { const wasFavorite = get().favorites.some((item) => item.id === track.id); set((s) => ({ favorites: wasFavorite ? s.favorites.filter((item) => item.id !== track.id) : [track, ...s.favorites] })); if (useAuthStore.getState().token) void toggleRemoteFavorite(savedTrack(track)).catch(() => set((s) => ({ favorites: wasFavorite ? [track, ...s.favorites] : s.favorites.filter((item) => item.id !== track.id) }))) },
  isFavorite: (id) => get().favorites.some((track) => track.id === id),
  toggleAlbumFavorite: async (album) => { const wasFavorite = get().favoriteAlbums.some((item) => item.id === album.id); set((s) => ({ favoriteAlbums: wasFavorite ? s.favoriteAlbums.filter((item) => item.id !== album.id) : [album, ...s.favoriteAlbums] })); if (useAuthStore.getState().token) try { await toggleRemoteAlbumFavorite(album) } catch { set((s) => ({ favoriteAlbums: wasFavorite ? [album, ...s.favoriteAlbums] : s.favoriteAlbums.filter((item) => item.id !== album.id) })) } },
  isAlbumFavorite: (id) => get().favoriteAlbums.some((album) => album.id === id),
  syncCloudLibrary: async () => { if (!useAuthStore.getState().token) return; const [favorites, history, favoriteAlbums] = await Promise.all([getFavorites(), getHistory(), getAlbumFavorites()]); const localAlbums = get().favoriteAlbums; set({ favorites: favorites.map(fromSavedTrack), history: history.map(fromSavedTrack), favoriteAlbums: favoriteAlbums.map((album) => ({ ...album, ...localAlbums.find((local) => local.id === album.id), id: album.id, title: album.title })) }) }
}), {
  name: 'sonora-player',
  version: 2,
  partialize: (s) => ({ currentTrack: s.currentTrack, queue: s.queue, history: s.history, favorites: s.favorites, favoriteAlbums: s.favoriteAlbums, currentIndex: s.currentIndex, volume: s.volume, lastAudibleVolume: s.lastAudibleVolume, repeatMode: s.repeatMode, shuffle: s.shuffle }),
  migrate: (persistedState) => {
    const saved = persistedState as Partial<PlayerState>
    return { ...saved, isPlaying: false, currentTime: 0, duration: 0, loading: false, error: null, lastAudibleVolume: saved.lastAudibleVolume ?? saved.volume ?? .8 } as PlayerState
  },
}))
