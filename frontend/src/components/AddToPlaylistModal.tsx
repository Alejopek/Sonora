import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Check, Heart, ListMusic, ListPlus, LoaderCircle, LogIn, Plus, X } from 'lucide-react'
import { CoverImage } from './CoverImage'
import { addPlaylistTrack, createPlaylist, getPlaylists, removePlaylistTrack, type UserPlaylist } from '../services/api'
import { useAuthStore } from '../stores/auth-store'
import { usePlayerStore } from '../stores/player-store'
import type { Track } from '../types/music'

type AddToPlaylistModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  track: Track | null
  onOpenAuth?: () => void
}

export function AddToPlaylistModal({
  open,
  onOpenChange,
  track,
  onOpenAuth,
}: AddToPlaylistModalProps) {
  const user = useAuthStore((state) => state.user)
  const favorites = usePlayerStore((state) => state.favorites)
  const toggleFavorite = usePlayerStore((state) => state.toggleFavorite)
  const isFavorite = usePlayerStore((state) => state.isFavorite)

  const [playlists, setPlaylists] = useState<UserPlaylist[]>([])
  const [loading, setLoading] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const isLiked = track ? isFavorite(track.id) : false

  useEffect(() => {
    if (!open) {
      setFeedback(null)
      setNewTitle('')
      return
    }
    if (!user) {
      setPlaylists([])
      return
    }
    setLoading(true)
    getPlaylists()
      .then((data) => setPlaylists(data))
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [open, user])

  if (!track) return null

  const handleToggleFavorite = () => {
    toggleFavorite(track)
    setFeedback(isLiked ? 'Quitada de tus favoritos' : '¡Añadida a tus favoritos!')
    setTimeout(() => setFeedback(null), 3000)
  }

  const handleToggleInPlaylist = async (playlist: UserPlaylist) => {
    const existing = playlist.items.find((item) => item.videoId === track.id)
    setBusyId(playlist.id)
    try {
      if (existing) {
        await removePlaylistTrack(playlist.id, existing.id)
        setPlaylists((current) =>
          current.map((p) =>
            p.id === playlist.id
              ? { ...p, items: p.items.filter((item) => item.id !== existing.id) }
              : p,
          ),
        )
        setFeedback(`Quitada de “${playlist.title}”`)
      } else {
        const updated = await addPlaylistTrack(playlist.id, {
          videoId: track.id,
          title: track.title,
          artist: track.artist,
          duration: track.durationSeconds,
          thumbnailUrl: track.thumbnail,
        })
        setPlaylists((current) =>
          current.map((p) => (p.id === playlist.id ? updated : p)),
        )
        setFeedback(`¡Añadida a “${playlist.title}”!`)
      }
    } catch {
      setFeedback('No se pudo actualizar la playlist.')
    } finally {
      setBusyId(null)
      setTimeout(() => setFeedback(null), 3500)
    }
  }

  const handleCreateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newTitle.trim()
    if (!trimmed) return
    setCreating(true)
    try {
      const created = await createPlaylist(trimmed)
      const withTrack = await addPlaylistTrack(created.id, {
        videoId: track.id,
        title: track.title,
        artist: track.artist,
        duration: track.durationSeconds,
        thumbnailUrl: track.thumbnail,
      })
      setPlaylists((current) => [withTrack, ...current])
      setNewTitle('')
      setFeedback(`¡Playlist “${trimmed}” creada y canción añadida!`)
    } catch {
      setFeedback('No se pudo crear la playlist.')
    } finally {
      setCreating(false)
      setTimeout(() => setFeedback(null), 3500)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="playlist-modal-overlay" />
        <Dialog.Content className="playlist-modal-content" aria-describedby={undefined}>
          <div className="playlist-modal-header">
            <div className="playlist-modal-track-preview">
              <CoverImage
                src={track.thumbnail}
                alt={track.title}
                className="playlist-modal-track-img"
              />
              <div className="playlist-modal-track-info">
                <b>{track.title}</b>
                <span>{track.artist}</span>
              </div>
            </div>
            <Dialog.Close className="icon-button playlist-modal-close" aria-label="Cerrar modal">
              <X size={18} />
            </Dialog.Close>
          </div>

          <Dialog.Title className="playlist-modal-title">
            <ListPlus size={18} />
            <span>Guardar en tu colección</span>
          </Dialog.Title>

          {feedback && (
            <div className="playlist-modal-feedback" role="status">
              <span>{feedback}</span>
            </div>
          )}

          {/* Opción rápida: Favoritos */}
          <div className="playlist-modal-section">
            <button
              type="button"
              className={`playlist-modal-row ${isLiked ? 'is-active' : ''}`}
              onClick={handleToggleFavorite}
            >
              <span className={`playlist-modal-icon-badge ${isLiked ? 'liked' : ''}`}>
                <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
              </span>
              <div className="playlist-modal-row-info">
                <b>Canciones favoritas</b>
                <small>
                  {favorites.length} {favorites.length === 1 ? 'canción' : 'canciones'}
                </small>
              </div>
              <span className="playlist-modal-check">
                {isLiked ? <Check size={18} /> : <Plus size={18} />}
              </span>
            </button>
          </div>

          {/* Opción: Playlists de la biblioteca */}
          <div className="playlist-modal-section">
            <span className="playlist-modal-label">TUS PLAYLISTS</span>

            {user ? (
              <>
                <form className="playlist-modal-create-form" onSubmit={handleCreateAndAdd}>
                  <input
                    type="text"
                    placeholder="Nueva playlist..."
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    disabled={creating}
                  />
                  <button
                    className="primary"
                    type="submit"
                    disabled={creating || !newTitle.trim()}
                  >
                    {creating ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />}
                    <span>Crear</span>
                  </button>
                </form>

                {loading ? (
                  <div className="playlist-modal-loading">
                    <LoaderCircle className="spin" size={20} />
                    <span>Cargando tus playlists…</span>
                  </div>
                ) : playlists.length > 0 ? (
                  <div className="playlist-modal-list">
                    {playlists.map((playlist) => {
                      const inPlaylist = playlist.items.some((item) => item.videoId === track.id)
                      const isBusy = busyId === playlist.id
                      return (
                        <button
                          type="button"
                          className={`playlist-modal-row ${inPlaylist ? 'is-active' : ''}`}
                          key={playlist.id}
                          onClick={() => void handleToggleInPlaylist(playlist)}
                          disabled={isBusy}
                        >
                          <span className="playlist-modal-icon-badge">
                            <ListMusic size={18} />
                          </span>
                          <div className="playlist-modal-row-info">
                            <b>{playlist.title}</b>
                            <small>
                              {playlist.items.length}{' '}
                              {playlist.items.length === 1 ? 'canción' : 'canciones'}
                            </small>
                          </div>
                          <span className="playlist-modal-check">
                            {isBusy ? (
                              <LoaderCircle className="spin" size={16} />
                            ) : inPlaylist ? (
                              <Check size={18} />
                            ) : (
                              <Plus size={18} />
                            )}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="playlist-modal-empty">
                    <small>Aún no tienes playlists. Escribe un nombre arriba para crear una.</small>
                  </div>
                )}
              </>
            ) : (
              <div className="playlist-modal-guest">
                <p>Inicia sesión para crear playlists personalizadas y guardarlas en tu cuenta.</p>
                {onOpenAuth && (
                  <button
                    type="button"
                    className="primary"
                    onClick={() => {
                      onOpenChange(false)
                      onOpenAuth()
                    }}
                  >
                    <LogIn size={15} /> Iniciar sesión
                  </button>
                )}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
