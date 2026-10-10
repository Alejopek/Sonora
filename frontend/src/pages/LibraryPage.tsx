import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BarChart3, ChevronLeft, Heart, ListMusic, Music2, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { SongRow } from '../components/SongRow'
import { CoverImage } from '../components/CoverImage'
import {
  addPlaylistTrack,
  createPlaylist,
  deletePlaylist,
  getPlaylists,
  removePlaylistTrack,
  updatePlaylist,
  type SavedTrack,
  type UserPlaylist,
} from '../services/api'
import { useAuthStore } from '../stores/auth-store'
import { usePlayerStore } from '../stores/player-store'
import { fmt } from '../lib/format'
import type { Track } from '../types/music'
import { AlbumCard } from '../components/AlbumCard'

const asTrack = (track: UserPlaylist['items'][number]): Track => ({
  id: track.videoId,
  title: track.title,
  artist: track.artist,
  album: '',
  thumbnail: track.thumbnailUrl,
  durationSeconds: track.duration,
  duration: track.duration ? fmt(track.duration) : undefined,
})

const asSavedTrack = (track: Track): SavedTrack => ({
  videoId: track.id,
  title: track.title,
  artist: track.artist,
  duration: track.durationSeconds,
  thumbnailUrl: track.thumbnail,
})

function PlaylistCover({
  items,
  title,
  size = 'normal',
}: {
  items: UserPlaylist['items']
  title: string
  size?: 'normal' | 'large'
}) {
  const validThumbnails = items.filter((item) => Boolean(item.thumbnailUrl))

  if (validThumbnails.length >= 4) {
    return (
      <div className={`playlist-cover-collage ${size}`}>
        {validThumbnails.slice(0, 4).map((item, idx) => (
          <CoverImage
            key={`${item.videoId}-${idx}`}
            src={item.thumbnailUrl}
            alt=""
            className="playlist-cover-collage-item"
          />
        ))}
      </div>
    )
  }

  if (validThumbnails.length > 0) {
    return (
      <div className={`playlist-cover-single ${size}`}>
        <CoverImage src={validThumbnails[0].thumbnailUrl} alt={title} className="playlist-cover-img" />
      </div>
    )
  }

  return (
    <div className={`playlist-cover-placeholder ${size}`}>
      <ListMusic size={size === 'large' ? 48 : 32} className="playlist-cover-placeholder-icon" />
    </div>
  )
}

export function LibraryPage() {
  const { playlistId } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const favorites = usePlayerStore((state) => state.favorites)
  const favoriteAlbums = usePlayerStore((state) => state.favoriteAlbums)
  const playTrack = usePlayerStore((state) => state.playTrack)
  const [playlists, setPlaylists] = useState<UserPlaylist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const selectedId = Number(playlistId)
  const selected = playlists.find((playlist) => playlist.id === selectedId)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setPlaylists(await getPlaylists())
      setError('')
    } catch {
      setError('No se pudieron cargar tus playlists. Comprueba tu conexión e inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) void load()
    else {
      setPlaylists([])
      setLoading(false)
    }
  }, [user, load])

  const create = async () => {
    const title = window.prompt('Nombre de la playlist')?.trim()
    if (!title) return
    try {
      const playlist = await createPlaylist(title)
      setPlaylists((current) => [playlist, ...current])
      navigate(`/library/${playlist.id}`)
    } catch {
      setError('No se pudo crear la playlist.')
    }
  }

  const rename = async (playlist: UserPlaylist) => {
    const title = window.prompt('Nuevo nombre de la playlist', playlist.title)?.trim()
    if (!title || title === playlist.title) return
    try {
      const updated = await updatePlaylist(playlist.id, title, playlist.description)
      setPlaylists((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    } catch {
      setError('No se pudo cambiar el nombre.')
    }
  }

  const remove = async (playlist: UserPlaylist) => {
    if (!window.confirm(`¿Eliminar “${playlist.title}” y todas sus canciones?`)) return
    try {
      await deletePlaylist(playlist.id)
      setPlaylists((current) => current.filter((item) => item.id !== playlist.id))
      if (selectedId === playlist.id) navigate('/library')
    } catch {
      setError('No se pudo eliminar la playlist.')
    }
  }

  const addTrack = async (track: Track) => {
    if (!selected) return
    try {
      const updated = await addPlaylistTrack(selected.id, asSavedTrack(track))
      setPlaylists((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setError('')
    } catch {
      setError('No se pudo agregar la canción a la playlist.')
    }
  }

  const removeTrack = async (itemId: number) => {
    if (!selected) return
    try {
      await removePlaylistTrack(selected.id, itemId)
      setPlaylists((current) =>
        current.map((item) =>
          item.id === selected.id
            ? { ...item, items: item.items.filter((track) => track.id !== itemId) }
            : item,
        ),
      )
    } catch {
      setError('No se pudo quitar la canción.')
    }
  }

  const selectedTracks = selected?.items.map(asTrack) ?? []
  const availableFavorites = selected
    ? favorites.filter((track) => !selected.items.some((item) => item.videoId === track.id))
    : []

  const totalSeconds = selected?.items.reduce((sum, item) => sum + (item.duration ?? 0), 0) ?? 0
  const totalDurationFormatted =
    totalSeconds > 0
      ? totalSeconds >= 3600
        ? `${Math.floor(totalSeconds / 3600)} h ${Math.floor((totalSeconds % 3600) / 60)} min`
        : `${Math.floor(totalSeconds / 60)} min`
      : ''

  return (
    <div className="page">
      <section className="section library-page">
        {error && (
          <div className="library-alert" role="alert">
            <span>{error}</span>
            <button className="text-button" onClick={() => void load()}>
              Reintentar
            </button>
          </div>
        )}

        {!user ? (
          <div className="library-empty-box">
            <div className="library-empty-box-icon">
              <Music2 size={34} />
            </div>
            <h3>Inicia sesión para abrir tu biblioteca</h3>
            <p>
              Tus playlists y favoritos se sincronizan de forma segura con tu cuenta para que puedas
              escucharlos desde cualquier lugar.
            </p>
          </div>
        ) : loading ? (
          <div className="state">Cargando biblioteca…</div>
        ) : selected ? (
          /* ================= VISTA DE DETALLE DE PLAYLIST ================= */
          <div className="playlist-detail-view">
            <button className="library-back-link" onClick={() => navigate('/library')}>
              <ChevronLeft size={16} />
              <span>Todas las playlists</span>
            </button>

            <header className="playlist-hero">
              <div className="playlist-hero-cover">
                <PlaylistCover items={selected.items} title={selected.title} size="large" />
              </div>
              <div className="playlist-hero-info">
                <span className="eyebrow">PLAYLIST · TU COLECCIÓN</span>
                <h1 className="playlist-hero-title">{selected.title}</h1>
                <div className="playlist-hero-meta">
                  <span className="meta-author">Creada por ti</span>
                  <span className="meta-dot">·</span>
                  <span className="meta-count">
                    {selected.items.length}{' '}
                    {selected.items.length === 1 ? 'canción' : 'canciones'}
                  </span>
                  {totalDurationFormatted && (
                    <>
                      <span className="meta-dot">·</span>
                      <span className="meta-duration">{totalDurationFormatted}</span>
                    </>
                  )}
                </div>

                <div className="playlist-hero-actions">
                  {selectedTracks.length > 0 && (
                    <button
                      className="primary"
                      onClick={() => playTrack(selectedTracks[0], selectedTracks)}
                    >
                      <Play size={16} fill="currentColor" />
                      <span>Reproducir</span>
                    </button>
                  )}
                  <button
                    className="secondary"
                    title="Renombrar playlist"
                    aria-label="Renombrar playlist"
                    onClick={() => void rename(selected)}
                  >
                    <Pencil size={15} />
                    <span>Renombrar</span>
                  </button>
                  <button
                    className="secondary danger-btn"
                    title="Eliminar playlist"
                    aria-label="Eliminar playlist"
                    onClick={() => void remove(selected)}
                  >
                    <Trash2 size={15} />
                    <span>Eliminar</span>
                  </button>
                </div>
              </div>
            </header>

            {selected.items.length > 0 ? (
              <div className="playlist-tracks-section">
                <div className="list-head">
                  <span>#</span>
                  <span>TÍTULO</span>
                  <span>ÁLBUM</span>
                  <span></span>
                  <span></span>
                </div>
                <div className="playlist-tracks-list">
                  {selected.items.map((item, index) => (
                    <SongRow
                      key={item.id}
                      track={asTrack(item)}
                      index={index + 1}
                      queue={selectedTracks}
                      onMore={() => void removeTrack(item.id)}
                      moreTitle="Quitar de la playlist"
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="library-empty-box">
                <div className="library-empty-box-icon">
                  <Music2 size={34} />
                </div>
                <h3>Esta playlist está vacía</h3>
                <p>Agrega canciones desde tus favoritos a continuación para empezar a armar tu colección.</p>
              </div>
            )}

            {availableFavorites.length > 0 && (
              <div className="section library-favorites-section">
                <div className="section-title">
                  <div>
                    <h2>Agregar desde favoritos</h2>
                    <p className="section-subtitle">
                      Canciones de tus favoritos listas para sumar a esta playlist
                    </p>
                  </div>
                </div>
                <div className="favorites-add-list">
                  {availableFavorites.map((track) => (
                    <div className="favorite-add-row" key={track.id}>
                      <div className="favorite-add-song">
                        <SongRow track={track} />
                      </div>
                      <button
                        className="secondary favorite-add-btn"
                        aria-label={`Agregar ${track.title} a ${selected.title}`}
                        onClick={() => void addTrack(track)}
                      >
                        <Plus size={15} />
                        <span>Agregar</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ================= VISTA PRINCIPAL DE BIBLIOTECA ================= */
          <div className="library-main-view">
            <div className="library-heading-row">
              <div>
                <span className="eyebrow">TU COLECCIÓN</span>
                <h1>Biblioteca</h1>
                <div className="library-count-badge">
                  <span>
                    {playlists.length} {playlists.length === 1 ? 'playlist' : 'playlists'}
                  </span>
                  {favorites.length > 0 && (
                    <>
                      <i />
                      <span>
                        {favorites.length} {favorites.length === 1 ? 'favorita' : 'favoritas'}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <button className="primary" onClick={() => void create()}>
                <Plus size={16} /> Crear playlist
              </button>
            </div>

            <button className="library-statistics-link" onClick={() => navigate('/statistics')}>
              <BarChart3 size={17} />
              <span>Ver estadísticas de escucha</span>
            </button>

            {playlists.length > 0 || favorites.length > 0 ? (
              <div className="library-playlist-grid">
                {favorites.length > 0 && (
                  <article className="library-playlist-card library-favorites-card">
                    <div
                      className="library-playlist-cover-wrap"
                      onClick={() => navigate('/favorites')}
                      role="button"
                      tabIndex={0}
                      aria-label="Abrir favoritos"
                    >
                      <div className="playlist-cover-favorites">
                        <Heart size={44} fill="currentColor" />
                      </div>
                      <button
                        className="library-card-play-btn"
                        aria-label="Reproducir favoritos"
                        onClick={(e) => {
                          e.stopPropagation()
                          playTrack(favorites[0], favorites)
                        }}
                      >
                        <Play size={20} fill="currentColor" />
                      </button>
                    </div>
                    <div className="library-playlist-info">
                      <div
                        className="library-playlist-titles"
                        onClick={() => navigate('/favorites')}
                        role="button"
                        tabIndex={0}
                      >
                        <b className="library-playlist-title">Tus favoritas</b>
                        <span className="library-playlist-meta">
                          {favorites.length}{' '}
                          {favorites.length === 1 ? 'canción guardada' : 'canciones guardadas'}
                        </span>
                      </div>
                    </div>
                  </article>
                )}

                {playlists.map((playlist) => {
                  const count = playlist.items.length
                  const countText = `${count} ${count === 1 ? 'canción' : 'canciones'}`
                  return (
                    <article className="library-playlist-card" key={playlist.id}>
                      <div
                        className="library-playlist-cover-wrap"
                        onClick={() => navigate(`/library/${playlist.id}`)}
                        role="button"
                        tabIndex={0}
                        aria-label={`Abrir playlist ${playlist.title}`}
                      >
                        <PlaylistCover items={playlist.items} title={playlist.title} />
                        {count > 0 && (
                          <button
                            className="library-card-play-btn"
                            aria-label={`Reproducir ${playlist.title}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              const tracks = playlist.items.map(asTrack)
                              playTrack(tracks[0], tracks)
                            }}
                          >
                            <Play size={20} fill="currentColor" />
                          </button>
                        )}
                      </div>
                      <div className="library-playlist-info">
                        <div
                          className="library-playlist-titles"
                          onClick={() => navigate(`/library/${playlist.id}`)}
                          role="button"
                          tabIndex={0}
                        >
                          <b className="library-playlist-title" title={playlist.title}>
                            {playlist.title}
                          </b>
                          <span className="library-playlist-meta">{countText}</span>
                        </div>
                        <div className="library-card-actions">
                          <button
                            className="library-action-btn"
                            title="Renombrar playlist"
                            aria-label={`Renombrar ${playlist.title}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              void rename(playlist)
                            }}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className="library-action-btn danger"
                            title="Eliminar playlist"
                            aria-label={`Eliminar ${playlist.title}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              void remove(playlist)
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="library-empty-box">
                <div className="library-empty-box-icon">
                  <ListMusic size={36} />
                </div>
                <h3>Tu biblioteca está vacía</h3>
                <p>
                  Crea una playlist con el nombre que prefieras y añade tus canciones preferidas para
                  escucharlas cuando quieras.
                </p>
                <button className="primary" onClick={() => void create()}>
                  <Plus size={16} /> Crear playlist
                </button>
              </div>
            )}
            {favoriteAlbums.length > 0 && <section className="section library-liked-albums"><div className="section-title"><h2>Discos que te gustan</h2></div><div className="album-result-grid">{favoriteAlbums.map((album) => <AlbumCard album={album} key={album.id}/>)}</div></section>}
          </div>
        )}
      </section>
    </div>
  )
}
