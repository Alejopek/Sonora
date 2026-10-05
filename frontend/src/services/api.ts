import type { SearchResponse, Track } from '../types/music'

const API = import.meta.env.VITE_API_URL ?? '/api'
const authToken = () => {
  try { return (JSON.parse(localStorage.getItem('sonora-auth') ?? '{}').state?.token as string | undefined) }
  catch { return undefined }
}
const DEV_MOCK_TOKEN = 'dev-mock-session-token'
const devMockStorage = {
  playlists: [
    {
      id: 1,
      title: 'Favoritas de desarrollo',
      description: 'Playlist simulada para testeo local',
      created_at: new Date('2025-01-01').toISOString(),
      items: [],
    },
  ] as UserPlaylist[],
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = authToken()
  if (import.meta.env.DEV && token === DEV_MOCK_TOKEN) {
    if (path === '/playlists' && (!init.method || init.method === 'GET')) {
      return [...devMockStorage.playlists] as T
    }
    if (path === '/playlists' && init.method === 'POST') {
      const payload = JSON.parse(String(init.body || '{}')) as { title?: string; description?: string }
      const newPlaylist: UserPlaylist = {
        id: Date.now(),
        title: payload.title || 'Nueva playlist',
        description: payload.description || '',
        created_at: new Date().toISOString(),
        items: [],
      }
      devMockStorage.playlists.unshift(newPlaylist)
      return newPlaylist as T
    }
    if (path === '/favorites' || path === '/history') {
      return [] as T
    }
    if (path === '/library/import') {
      return { ok: true } as T
    }
    if (path === '/favorites/toggle') {
      return { liked: true } as T
    }
  }
  const response = await fetch(`${API}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers } })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null
    throw new Error(body?.detail ?? 'No se pudo completar la operación.')
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}
export const artworkUrl = (url: string) => `${API}/artwork?url=${encodeURIComponent(url)}`
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
export type AudioContainer = 'auto' | 'mp4' | 'webm'
export const streamUrl = (id: string, container: AudioContainer = 'auto') => `${API}/stream/${encodeURIComponent(id)}?container=${container}`

export type SessionUser = { id: number; username: string; email: string; created_at: string }
export type Session = { token: string; user: SessionUser }
export type SavedTrack = { videoId: string; title: string; artist: string; duration?: number; thumbnailUrl: string }
export type SavedTrackResponse = SavedTrack & { id: number; added_at?: string; played_at?: string }
export type UserPlaylist = { id: number; title: string; description: string; created_at: string; items: SavedTrackResponse[] }
export const login = (email: string, password: string) => request<Session>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
export const register = (username: string, email: string, password: string) => request<Session>('/auth/register', { method: 'POST', body: JSON.stringify({ username, email, password }) })
export const getMe = () => request<SessionUser>('/auth/me')
export const recordHistory = (track: SavedTrack) => request<SavedTrackResponse>('/history', { method: 'POST', body: JSON.stringify(track) })
export const getHistory = () => request<SavedTrackResponse[]>('/history')
export const toggleRemoteFavorite = (track: SavedTrack) => request<{ liked: boolean }>('/favorites/toggle', { method: 'POST', body: JSON.stringify(track) })
export const getFavorites = () => request<SavedTrackResponse[]>('/favorites')
export const getPlaylists = () => request<UserPlaylist[]>('/playlists')
export const createPlaylist = (title: string, description = '') => request<UserPlaylist>('/playlists', { method: 'POST', body: JSON.stringify({ title, description }) })
export const updatePlaylist = (id: number, title: string, description = '') => request<UserPlaylist>(`/playlists/${id}`, { method: 'PATCH', body: JSON.stringify({ title, description }) })
export const deletePlaylist = (id: number) => request<void>(`/playlists/${id}`, { method: 'DELETE' })
export const addPlaylistTrack = (id: number, track: SavedTrack) => request<UserPlaylist>(`/playlists/${id}/items`, { method: 'POST', body: JSON.stringify(track) })
export const removePlaylistTrack = (playlistId: number, itemId: number) => request<void>(`/playlists/${playlistId}/items/${itemId}`, { method: 'DELETE' })
export const importLocalLibrary = (favorites: SavedTrack[], history: SavedTrack[]) => request<{ ok: boolean }>('/library/import', { method: 'POST', body: JSON.stringify({ favorites, history }) })
