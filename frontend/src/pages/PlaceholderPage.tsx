import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, Library, Pencil, Play, Plus, Trash2, X } from 'lucide-react'
import { SongRow } from '../components/SongRow'
import { usePlayerStore } from '../stores/player-store'

export function PlaceholderPage({ title, icon: Icon }: { title: string; icon: typeof Library }) {
  const navigate = useNavigate()
  const favorites = usePlayerStore((s) => s.favorites)
  const history = usePlayerStore((s) => s.history)
  const playlists = usePlayerStore((s) => s.favoritePlaylists)
  const createPlaylist = usePlayerStore((s) => s.createFavoritePlaylist)
  const renamePlaylist = usePlayerStore((s) => s.renameFavoritePlaylist)
  const deletePlaylist = usePlayerStore((s) => s.deleteFavoritePlaylist)
  const addToPlaylist = usePlayerStore((s) => s.addFavoriteToPlaylist)
  const removeFromPlaylist = usePlayerStore((s) => s.removeTrackFromPlaylist)
  const playTrack = usePlayerStore((s) => s.playTrack)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const isFavorites = title === 'Favoritos'
  const selected = playlists.find((playlist) => playlist.id === selectedId)
  const tracks = isFavorites ? (selected ? selected.tracks : favorites) : history
  const libraryTrackCount = new Set([...favorites, ...history, ...playlists.flatMap((playlist) => playlist.tracks)].map((track) => track.id)).size
  const makePlaylist = () => {
    const name = window.prompt('Nombre de la playlist')?.trim()
    if (!name) return
    createPlaylist(name)
    const created = usePlayerStore.getState().favoritePlaylists[0]
    if (created) setSelectedId(created.id)
  }
  const rename = (id: string, currentName: string) => {
    const name = window.prompt('Nuevo nombre de la playlist', currentName)?.trim()
    if (name) renamePlaylist(id, name)
  }
  const removePlaylist = (id: string, name: string) => {
    if (!window.confirm(`¿Eliminar la playlist “${name}”? Esta acción no se puede deshacer.`)) return
    deletePlaylist(id)
    if (selectedId === id) setSelectedId(null)
  }
  const playlistActions = (id: string, name: string) => <span className="playlist-actions"><button className="icon-button" aria-label={`Renombrar ${name}`} title="Renombrar" onClick={() => rename(id, name)}><Pencil size={15}/></button><button className="icon-button danger-action" aria-label={`Eliminar ${name}`} title="Eliminar playlist" onClick={() => removePlaylist(id, name)}><Trash2 size={15}/></button></span>

  if (isFavorites) return <div className="page">
    <section className="section">
      <div className="section-title"><div><span className="eyebrow">TU MÚSICA</span><h1>{selected?.name ?? 'Favoritos'}</h1></div><button className="primary" onClick={makePlaylist}><Plus size={16}/> Crear playlist</button></div>
      <div className="tag-row favorite-playlist-tabs">
        <button className={!selected ? 'selected' : ''} onClick={() => setSelectedId(null)}><Heart size={14}/> Todas <span>{favorites.length}</span></button>
        {playlists.map((playlist) => <span className={`favorite-playlist-tab ${selectedId === playlist.id ? 'selected' : ''}`} key={playlist.id}><button className="favorite-playlist-select" onClick={() => setSelectedId(playlist.id)}>{playlist.name} <span>{playlist.tracks.length}</span></button>{playlistActions(playlist.id, playlist.name)}</span>)}
      </div>
      {tracks.length ? <><div className="list-head"><span>#</span><span>TÍTULO</span><span>ÁLBUM</span><span></span><span></span></div>{tracks.map((track, index) => <SongRow key={track.id} track={track} index={index + 1} queue={tracks} onMore={selected ? () => removeFromPlaylist(selected.id, track.id) : undefined}/>)}</> : <div className="state"><Heart size={28}/><h3>{selected ? 'Esta playlist está vacía' : 'Todavía no tienes favoritos'}</h3><p>{selected ? 'Agrega canciones desde tus favoritos.' : 'Marca canciones con el corazón para guardarlas aquí.'}</p>{!selected && <button className="secondary" onClick={() => navigate('/search')}>Explorar música</button>}</div>}
      {selected && favorites.length > 0 && <section className="section"><div className="section-title"><h2>Agregar desde favoritos</h2></div>{favorites.filter((track) => !selected.tracks.some((item) => item.id === track.id)).map((track) => <div className="favorite-add-row" key={track.id}><SongRow track={track}/><button className="icon-button" aria-label={`Agregar ${track.title} a ${selected.name}`} title="Agregar a esta playlist" onClick={() => addToPlaylist(selected.id, track)}><Plus size={18}/></button></div>)}</section>}
    </section>
  </div>

  if (title === 'Biblioteca') return <div className="page"><section className="section">
    <div className="section-title"><div><span className="eyebrow">TU COLECCIÓN</span><h1>Biblioteca</h1><p className="library-count">{libraryTrackCount} {libraryTrackCount === 1 ? 'canción' : 'canciones'} en tu biblioteca · {playlists.length} {playlists.length === 1 ? 'playlist' : 'playlists'}</p></div><button className="primary" onClick={makePlaylist}><Plus size={16}/> Crear playlist</button></div>
    {playlists.length > 0 ? <div className="library-playlist-grid">{playlists.map((playlist) => <article className={`library-playlist-card ${selectedId === playlist.id ? 'selected' : ''}`} key={playlist.id}><button className="library-playlist-main" onClick={() => setSelectedId(selectedId === playlist.id ? null : playlist.id)} aria-pressed={selectedId === playlist.id}><span className="library-playlist-icon"><Library size={22}/></span><span className="library-playlist-copy"><b>{playlist.name}</b><small>{playlist.tracks.length} {playlist.tracks.length === 1 ? 'canción' : 'canciones'}</small></span></button>{playlistActions(playlist.id, playlist.name)}</article>)}</div> : <div className="state"><Library size={28}/><h3>Tu biblioteca está vacía</h3><p>Crea una playlist con el nombre que quieras y agrega tus canciones favoritas.</p><button className="primary" onClick={makePlaylist}><Plus size={16}/> Crear playlist</button></div>}
    {selected && <><div className="section-title library-selected-title"><div><h2>{selected.name} <span className="muted small">· {selected.tracks.length} canciones</span></h2></div><div className="library-selection-actions">{selected.tracks.length > 0 && <button className="secondary" onClick={() => playTrack(selected.tracks[0], selected.tracks)}><Play size={15} fill="currentColor"/> Reproducir</button>}<button className="secondary" onClick={() => setSelectedId(null)}><X size={15}/> Cerrar</button></div></div>{selected.tracks.length ? selected.tracks.map((track, index) => <SongRow key={track.id} track={track} index={index + 1} queue={selected.tracks} onMore={() => removeFromPlaylist(selected.id, track.id)}/>) : <p className="muted">Todavía no agregaste canciones a esta playlist.</p>}{favorites.filter((track) => !selected.tracks.some((item) => item.id === track.id)).length > 0 && <div className="section"><div className="section-title"><h2>Agregar canciones</h2></div>{favorites.filter((track) => !selected.tracks.some((item) => item.id === track.id)).map((track) => <div className="favorite-add-row" key={track.id}><SongRow track={track}/><button className="icon-button" aria-label={`Agregar ${track.title} a ${selected.name}`} onClick={() => addToPlaylist(selected.id, track)}><Plus size={18}/></button></div>)}</div>}</>}
    {history.length > 0 && <div className="section library-history"><div className="section-title"><h2>Reproducidas recientemente</h2><span className="muted small">{history.length} {history.length === 1 ? 'canción' : 'canciones'}</span></div>{history.map((track, index) => <SongRow key={track.id} track={track} index={index + 1} queue={history}/>)}</div>}
  </section></div>

  return <div className="page">{tracks.length ? <section className="section"><div className="section-title"><h1>{title}</h1></div><div className="list-head"><span>#</span><span>TÍTULO</span><span>ÁLBUM</span><span></span><span></span></div>{tracks.map((track, index) => <SongRow key={track.id} track={track} index={index + 1} queue={tracks}/>)}</section> : <div className="empty-page"><Icon size={34}/><h1>{title}</h1><p>Tu historial y playlists guardadas se organizarán aquí.</p><button className="secondary" onClick={() => navigate('/search')}>Explorar música</button></div>}</div>
}
