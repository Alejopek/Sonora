import type { Album, AlbumDetail, SearchResponse, Track } from '../types/music'

const API = import.meta.env.VITE_API_URL ?? '/api'
const authToken = () => {
  try { return (JSON.parse(localStorage.getItem('sonora-auth') ?? '{}').state?.token as string | undefined) }
  catch { return undefined }
}
const DEV_MOCK_TOKEN = 'dev-mock-session-token'
const devMockStorage = {
  albumFavorites: [] as Album[],
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
    if (path === '/favorites/albums' && (!init.method || init.method === 'GET')) return [...devMockStorage.albumFavorites] as T
    if (path === '/favorites/albums/toggle' && init.method === 'POST') {
      const album = JSON.parse(String(init.body || '{}')) as Album
      const index = devMockStorage.albumFavorites.findIndex((item) => item.id === album.id)
      if (index >= 0) { devMockStorage.albumFavorites.splice(index, 1); return { liked: false } as T }
      devMockStorage.albumFavorites.unshift(album)
      return { liked: true } as T
    }
    if (path === '/recommendations') return { date: new Date().toISOString().slice(0, 10), title: 'Mix diario', tracks: [], isEmpty: true } as T
    if (path === '/recommendations/albums') return { albums: [] } as T
    if (path === '/statistics') return emptyStatistics as T
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
export async function searchMusic(query: string, filter: 'all' | 'songs' | 'albums' = 'all'): Promise<SearchResponse> {
  const response = await fetch(`${API}/search?q=${encodeURIComponent(query)}&filter=${filter}`)
  if (!response.ok) throw new Error('No se pudo completar la búsqueda.')
  return response.json() as Promise<SearchResponse>
}
export async function getAlbum(id: string): Promise<AlbumDetail> {
  const response = await fetch(`${API}/albums/${encodeURIComponent(id)}`)
  if (!response.ok) throw new Error('No se pudo cargar el álbum.')
  return response.json() as Promise<AlbumDetail>
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
export type SavedTrack = { videoId: string; title: string; artist: string; artistId?: string; album?: string; albumId?: string; genres?: string[]; duration?: number; thumbnailUrl: string }
export type SavedTrackResponse = SavedTrack & { id: number; added_at?: string; played_at?: string }
export type UserPlaylist = { id: number; title: string; description: string; created_at: string; items: SavedTrackResponse[] }
export const toggleRemoteAlbumFavorite = (album: Album) => request<{ liked: boolean }>('/favorites/albums/toggle', { method: 'POST', body: JSON.stringify(album) })
export const getAlbumFavorites = () => request<Album[]>('/favorites/albums')
export const getRecommendedAlbums = () => request<{ albums: Album[] }>('/recommendations/albums')
export const login = (email: string, password: string) => request<Session>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
export const register = (username: string, email: string, password: string) => request<Session>('/auth/register', { method: 'POST', body: JSON.stringify({ username, email, password }) })
export const getMe = () => request<SessionUser>('/auth/me')
export type LastFmStatus = { configured: boolean; connected: boolean; username: string | null }
export type LastFmRecentTrack = { title: string; artist: string; album: string; url: string; thumbnail: string; playedAt: string | null; nowPlaying: boolean }
export type LastFmMoodProfile = { username: string; tags: string[]; recentArtists: string[]; recentTracks: LastFmRecentTrack[]; bpmAvailable: false }
export const getLastFmStatus = () => request<LastFmStatus>('/lastfm/status')
export const getLastFmMoodProfile = () => request<LastFmMoodProfile>('/lastfm/mood-profile')
export const startLastFmConnection = () => request<{ authorizationUrl: string }>('/lastfm/connect')
export const disconnectLastFm = () => request<void>('/lastfm/connection', { method: 'DELETE' })
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
export const importLocalLibrary = (favorites: SavedTrack[], history: SavedTrack[], favoriteAlbums: Album[] = []) => request<{ ok: boolean }>('/library/import', { method: 'POST', body: JSON.stringify({ favorites, history, favoriteAlbums }) })
export type ListeningEvent = { sessionId: string; event: 'started' | 'progress' | 'completed' | 'skipped'; track: SavedTrack; listenedSeconds: number }
export const recordListeningEvent = (event: ListeningEvent) => request<{ accepted: boolean }>('/listening/events', { method: 'POST', body: JSON.stringify(event) })
export type Recommendation = Track & { reason: string; score: number }
export type DailyMix = { date: string; title: string; tracks: Recommendation[]; isEmpty: boolean }
export const getDailyMix = () => request<DailyMix>('/recommendations')
export const getRecommendationQueue = () => request<{ tracks: Recommendation[]; title: string }>('/recommendations/queue')
export const getSeededRecommendationQueue = (track: SavedTrack) => request<{ tracks: Recommendation[]; title: string }>('/recommendations/queue', { method: 'POST', body: JSON.stringify(track) })
export const refreshDailyMix = () => request<DailyMix>('/recommendations/refresh', { method: 'POST' })
export const saveRecommendationPreferences = (seedTerms: string[]) => request<{ seedTerms: string[] }>('/recommendations/preferences', { method: 'PUT', body: JSON.stringify({ seedTerms }) })
export const sendRecommendationFeedback = (track: SavedTrack, action: 'less' | 'exclude') => request<{ ok: boolean }>('/recommendations/feedback', { method: 'POST', body: JSON.stringify({ track, action }) })
export type StatisticItem = { name?: string; title?: string; artist?: string; thumbnail?: string; listenedSeconds: number; plays: number }
export type Statistics = { range: { label: string; start: string; end: string }; totals: { listenedSeconds: number; plays: number; artists: number; albums: number; genres: number; streakDays: number }; comparison?: { previousListenedSeconds: number; changePercent: number | null } | null; activity: { date: string; listenedSeconds: number }[]; hours: { hour: number; listenedSeconds: number }[]; top: { tracks: StatisticItem[]; artists: StatisticItem[]; albums: StatisticItem[]; genres: StatisticItem[] } }
export const emptyStatistics: Statistics = { range: { label: 'Últimos 7 días', start: '', end: '' }, totals: { listenedSeconds: 0, plays: 0, artists: 0, albums: 0, genres: 0, streakDays: 0 }, comparison: null, activity: [], hours: [], top: { tracks: [], artists: [], albums: [], genres: [] } }
export const getStatistics = (range: 'today' | '7d' | '30d' | 'all' | 'custom', start?: string, end?: string) => {
  const params = new URLSearchParams({ range })
  if (start) params.set('start', start)
  if (end) params.set('end', end)
  return request<Statistics>(`/statistics?${params}`)
}
