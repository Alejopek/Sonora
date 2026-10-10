export type Track = { id: string; title: string; artist: string; artistId?: string; album: string; albumId?: string; thumbnail: string; duration?: string; durationSeconds?: number; explicit?: boolean; genres?: string[] }
export type SearchResponse = { songs: Track[]; artists: Artist[]; albums: Album[]; playlists: Playlist[] }
export type Artist = { id: string; name: string; thumbnail: string; subscribers?: string }
export type Album = { id: string; title: string; artist: string; thumbnail: string; year?: string; type?: string }
export type Playlist = { id: string; title: string; author: string; thumbnail: string; count?: string }
export type RepeatMode = 'off' | 'all' | 'one'
