import type { SearchResponse, Track } from '../types/music'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'
export async function searchMusic(query: string): Promise<SearchResponse> {
  const response = await fetch(`${API}/search?q=${encodeURIComponent(query)}`)
  if (!response.ok) throw new Error('No se pudo completar la búsqueda.')
  return response.json() as Promise<SearchResponse>
}
export async function getSong(id: string): Promise<Track> {
  const response = await fetch(`${API}/songs/${encodeURIComponent(id)}`)
  if (!response.ok) throw new Error('No se pudo cargar la canción.')
  return response.json() as Promise<Track>
}
export type LyricLine = { text: string; startTime: number | null }
export type LyricsResponse = { lyrics: LyricLine[]; source: string | null; instrumental?: boolean }
export async function getLyrics(track: Pick<Track, 'id' | 'title' | 'artist' | 'album' | 'durationSeconds' | 'duration'>): Promise<LyricsResponse> {
  const params = new URLSearchParams({ title: track.title, artist: track.artist, album: track.album })
  const duration = track.durationSeconds ?? (track.duration ? track.duration.split(':').reduce((total, part) => total * 60 + Number(part), 0) : 0)
  if (duration > 0) params.set('duration', String(duration))
  const response = await fetch(`${API}/songs/${encodeURIComponent(track.id)}/lyrics?${params}`)
  if (!response.ok) throw new Error('No se pudieron cargar las letras.')
  return response.json() as Promise<LyricsResponse>
}
export const streamUrl = (id: string) => `${API}/stream/${encodeURIComponent(id)}`
