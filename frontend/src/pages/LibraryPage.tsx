import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Library, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { SongRow } from '../components/SongRow'
import { addPlaylistTrack, createPlaylist, deletePlaylist, getPlaylists, removePlaylistTrack, updatePlaylist, type SavedTrack, type UserPlaylist } from '../services/api'
import { useAuthStore } from '../stores/auth-store'
import { usePlayerStore } from '../stores/player-store'
import type { Track } from '../types/music'

const asTrack = (track: UserPlaylist['items'][number]): Track => ({ id: track.videoId, title: track.title, artist: track.artist, album: '', thumbnail: track.thumbnailUrl, durationSeconds: track.duration })
const asSavedTrack = (track: Track): SavedTrack => ({ videoId: track.id, title: track.title, artist: track.artist, duration: track.durationSeconds, thumbnailUrl: track.thumbnail })

export function LibraryPage() {
  const { playlistId } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const favorites = usePlayerStore((state) => state.favorites)
  const playTrack = usePlayerStore((state) => state.playTrack)
  const [playlists, setPlaylists] = useState<UserPlaylist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const selectedId = Number(playlistId)
  const selected = playlists.find((playlist) => playlist.id === selectedId)
  const load = useCallback(async () => {
    setLoading(true)
    try { setPlaylists(await getPlaylists()); setError('') }
    catch { setError('No se pudieron cargar tus playlists. Comprueba tu conexión e inténtalo de nuevo.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { if (user) void load(); else { setPlaylists([]); setLoading(false) } }, [user, load])

  const create = async () => {
    const title = window.prompt('Nombre de la playlist')?.trim()
    if (!title) return
    try { const playlist = await createPlaylist(title); setPlaylists((current) => [playlist, ...current]); navigate(`/library/${playlist.id}`) }
    catch { setError('No se pudo crear la playlist.') }
  }
  const rename = async (playlist: UserPlaylist) => {
    const title = window.prompt('Nuevo nombre de la playlist', playlist.title)?.trim()
    if (!title || title === playlist.title) return
    try { const updated = await updatePlaylist(playlist.id, title, playlist.description); setPlaylists((current) => current.map((item) => item.id === updated.id ? updated : item)) }
    catch { setError('No se pudo cambiar el nombre.') }
  }
  const remove = async (playlist: UserPlaylist) => {
    if (!window.confirm(`¿Eliminar “${playlist.title}” y todas sus canciones?`)) return
    try { await deletePlaylist(playlist.id); setPlaylists((current) => current.filter((item) => item.id !== playlist.id)); if (selectedId === playlist.id) navigate('/library') }
    catch { setError('No se pudo eliminar la playlist.') }
  }
  const addTrack = async (track: Track) => {
    if (!selected) return
    try { const updated = await addPlaylistTrack(selected.id, asSavedTrack(track)); setPlaylists((current) => current.map((item) => item.id === updated.id ? updated : item)); setError('') }
    catch { setError('No se pudo agregar la canción a la playlist.') }
  }
  const removeTrack = async (itemId: number) => {
    if (!selected) return
    try { await removePlaylistTrack(selected.id, itemId); setPlaylists((current) => current.map((item) => item.id === selected.id ? { ...item, items: item.items.filter((track) => track.id !== itemId) } : item)) }
    catch { setError('No se pudo quitar la canción.') }
  }
  const selectedTracks = selected?.items.map(asTrack) ?? []

  return <div className="page"><section className="section library-page">
    <div className="section-title"><div><span className="eyebrow">TU COLECCIÓN</span><h1>{selected?.title ?? 'Biblioteca'}</h1><p className="library-count">{selected ? `${selected.items.length} ${selected.items.length === 1 ? 'canción' : 'canciones'}` : `${playlists.length} ${playlists.length === 1 ? 'playlist' : 'playlists'}`}</p></div>{user && <button className="primary" onClick={() => void create()}><Plus size={16}/> Crear playlist</button>}</div>
    {error && <div className="library-alert" role="alert"><span>{error}</span><button className="text-button" onClick={() => void load()}>Reintentar</button></div>}
    {!user ? <div className="state"><Library size={28}/><h3>Inicia sesión para abrir tu biblioteca</h3><p>Tus playlists se guardan en tu cuenta para que puedas volver a ellas.</p></div> : loading ? <div className="state">Cargando biblioteca…</div> : selected ? <>
      <div className="library-detail-actions"><button className="secondary" onClick={() => navigate('/library')}>Todas las playlists</button>{selectedTracks.length > 0 && <button className="primary" onClick={() => playTrack(selectedTracks[0], selectedTracks)}><Play size={15} fill="currentColor"/> Reproducir</button>}<button className="icon-button" title="Renombrar playlist" aria-label="Renombrar playlist" onClick={() => void rename(selected)}><Pencil size={16}/></button><button className="icon-button danger-action" title="Eliminar playlist" aria-label="Eliminar playlist" onClick={() => void remove(selected)}><Trash2 size={16}/></button></div>
      {selected.items.length ? <><div className="list-head"><span>#</span><span>TÍTULO</span><span>ÁLBUM</span><span></span><span></span></div>{selected.items.map((item, index) => <SongRow key={item.id} track={asTrack(item)} index={index + 1} queue={selectedTracks} onMore={() => void removeTrack(item.id)}/>)}</> : <div className="state"><Library size={26}/><h3>Esta playlist está vacía</h3><p>Agrega canciones desde tus favoritos.</p></div>}
      {favorites.filter((track) => !selected.items.some((item) => item.videoId === track.id)).length > 0 && <div className="section"><div className="section-title"><h2>Agregar desde favoritos</h2></div>{favorites.filter((track) => !selected.items.some((item) => item.videoId === track.id)).map((track) => <div className="favorite-add-row" key={track.id}><SongRow track={track}/><button className="icon-button" aria-label={`Agregar ${track.title} a ${selected.title}`} onClick={() => void addTrack(track)}><Plus size={18}/></button></div>)}</div>}
    </> : playlists.length ? <div className="library-playlist-grid">{playlists.map((playlist) => <article className="library-playlist-card" key={playlist.id}><button className="library-playlist-main" onClick={() => navigate(`/library/${playlist.id}`)}><span className="library-playlist-icon"><Library size={22}/></span><span className="library-playlist-copy"><b>{playlist.title}</b><small>{playlist.items.length} {playlist.items.length === 1 ? 'canción' : 'canciones'}</small></span></button><span className="playlist-actions"><button className="icon-button" aria-label={`Renombrar ${playlist.title}`} onClick={() => void rename(playlist)}><Pencil size={15}/></button><button className="icon-button danger-action" aria-label={`Eliminar ${playlist.title}`} onClick={() => void remove(playlist)}><Trash2 size={15}/></button></span></article>)}</div> : <div className="state"><Library size={28}/><h3>Tu biblioteca está vacía</h3><p>Crea una playlist con el nombre que quieras y agrega tus canciones favoritas.</p><button className="primary" onClick={() => void create()}><Plus size={16}/> Crear playlist</button></div>}
  </section></div>
}
