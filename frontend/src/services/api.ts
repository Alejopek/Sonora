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
export const streamUrl = (id: string) => `${API}/stream/${encodeURIComponent(id)}`
