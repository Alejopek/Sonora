import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Check,
  Ban,
  Copy,
  Disc,
  FolderPlus,
  Heart,
  ListPlus,
  MoreHorizontal,
  Pause,
  Play,
  Trash2,
  ThumbsDown,
  User,
} from 'lucide-react'
import { CoverImage } from './CoverImage'
import { AddToPlaylistModal } from './AddToPlaylistModal'
import { savedTrack, usePlayerStore } from '../stores/player-store'
import { sendRecommendationFeedback } from '../services/api'
import { useAuthStore } from '../stores/auth-store'
import type { Track } from '../types/music'

export function SongRow({
  track,
  index,
  queue,
  onMore,
  moreTitle,
  recommendation = false,
  onFeedback,
}: {
  track: Track
  index?: number
  queue?: Track[]
  onMore?: () => void
  moreTitle?: string
  recommendation?: boolean
  onFeedback?: (id: string) => void
}) {
  const navigate = useNavigate()
  const { currentTrack, isPlaying, playTrack, setPlaying, addToQueue, toggleFavorite, isFavorite } =
    usePlayerStore()

  const active = currentTrack?.id === track.id
  const isCurrentPlaying = active && isPlaying
  const liked = isFavorite(track.id)
  const token = useAuthStore((state) => state.token)

  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPlacement, setMenuPlacement] = useState<'bottom' | 'top'>('bottom')
  const [playlistModalOpen, setPlaylistModalOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [queueAdded, setQueueAdded] = useState(false)

  const menuContainerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Manejo de reproducción/pausa al hacer clic en el número/icono
  const handlePlayToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (active) {
      setPlaying(!isPlaying)
    } else {
      playTrack(track, queue)
    }
  }

  // Cierre de menú al hacer clic afuera o presionar Escape
  useEffect(() => {
    if (!menuOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!menuOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      // Si queda poco espacio abajo, desplegar hacia arriba
      if (spaceBelow < 230 && rect.top > 230) {
        setMenuPlacement('top')
      } else {
        setMenuPlacement('bottom')
      }
      setMenuOpen(true)
    } else {
      setMenuOpen(false)
    }
  }

  const handleAddToQueue = () => {
    addToQueue(track)
    setQueueAdded(true)
    setTimeout(() => {
      setQueueAdded(false)
      setMenuOpen(false)
    }, 1000)
  }

  const handleOpenPlaylistModal = () => {
    setMenuOpen(false)
    setPlaylistModalOpen(true)
  }

  const handleGoToArtist = () => {
    setMenuOpen(false)
    navigate(`/search?q=${encodeURIComponent(track.artist)}`)
  }

  const handleGoToAlbum = () => {
    if (!track.album) return
    setMenuOpen(false)
    navigate(`/search?q=${encodeURIComponent(track.album)}`)
  }

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/search?q=${encodeURIComponent(track.title + ' ' + track.artist)}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => {
        setCopied(false)
        setMenuOpen(false)
      }, 1200)
    } catch {
      setMenuOpen(false)
    }
  }

  const feedback = (action: 'less' | 'exclude') => {
    if (!token) return
    void sendRecommendationFeedback(savedTrack(track), action).then(() => onFeedback?.(track.id)).catch(() => undefined)
  }

  return (
    <>
      <div className={`song-row ${active ? 'playing' : ''} ${recommendation ? 'recommendation-row' : ''}`}>
        {/* 1) Columna de número / play */}
        <button
          type="button"
          className={`track-index ${active ? 'active' : ''} ${isCurrentPlaying ? 'is-playing' : ''}`}
          onClick={handlePlayToggle}
          aria-label={isCurrentPlaying ? `Pausar ${track.title}` : `Reproducir ${track.title}`}
        >
          <span className="track-number">
            {isCurrentPlaying ? (
              <span className="sound-bars" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            ) : (
              index ?? <Play size={13} fill="currentColor" />
            )}
          </span>
          <span className="track-hover-icon">
            {isCurrentPlaying ? (
              <Pause size={13} fill="currentColor" />
            ) : (
              <Play size={13} fill="currentColor" />
            )}
          </span>
        </button>

        {/* 2) Carátula */}
        <CoverImage src={track.thumbnail} alt="" />

        {/* 3) Título y artista */}
        <div className="track-copy">
          <b>{track.title}</b>
          <span>{track.artist}</span>
          {recommendation && 'reason' in track && <small className="recommendation-reason">{String(track.reason)}</small>}
        </div>

        {/* 4) Álbum */}
        <span className="album-name">{track.album}</span>

        {/* 5) Like / Favorito */}
        <button
          type="button"
          className={`like ${liked ? 'liked' : ''}`}
          onClick={() => toggleFavorite(track)}
          aria-label={liked ? 'Quitar de favoritos' : 'Favorito'}
        >
          <Heart size={17} fill={liked ? 'currentColor' : 'none'} />
        </button>

        {recommendation && <span className="recommendation-actions"><button type="button" className="icon-button" onClick={() => feedback('less')} aria-label={`Menos música como ${track.title}`} title="Menos de esto"><ThumbsDown size={15}/></button><button type="button" className="icon-button" onClick={() => feedback('exclude')} aria-label={`No recomendar ${track.title}`} title="No recomendar"><Ban size={15}/></button></span>}

        {/* 6) Duración */}
        <span className="duration">{track.duration ?? '—'}</span>

        {/* 7) Menú de tres puntos */}
        <div className="row-menu-container" ref={menuContainerRef}>
          <button
            type="button"
            ref={triggerRef}
            className={`icon-button row-menu ${menuOpen ? 'menu-active' : ''}`}
            title="Más opciones"
            aria-label={`Más opciones para ${track.title}`}
            aria-expanded={menuOpen}
            onClick={toggleMenu}
          >
            <MoreHorizontal size={18} />
          </button>

          {menuOpen && (
            <div
              className={`song-dropdown-menu ${menuPlacement}`}
              role="menu"
              aria-label={`Opciones de ${track.title}`}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                role="menuitem"
                className="song-dropdown-item"
                onClick={handleAddToQueue}
              >
                {queueAdded ? <Check size={15} /> : <ListPlus size={15} />}
                <span>{queueAdded ? 'Agregada a la cola' : 'Agregar a la cola'}</span>
              </button>

              <button
                type="button"
                role="menuitem"
                className="song-dropdown-item"
                onClick={handleOpenPlaylistModal}
              >
                <FolderPlus size={15} />
                <span>Agregar a una playlist</span>
              </button>

              <button
                type="button"
                role="menuitem"
                className="song-dropdown-item"
                onClick={handleGoToArtist}
              >
                <User size={15} />
                <span>Ir al artista</span>
              </button>

              {track.album && (
                <button
                  type="button"
                  role="menuitem"
                  className="song-dropdown-item"
                  onClick={handleGoToAlbum}
                >
                  <Disc size={15} />
                  <span>Ir al álbum</span>
                </button>
              )}

              <button
                type="button"
                role="menuitem"
                className="song-dropdown-item"
                onClick={handleCopyLink}
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
                <span>{copied ? '¡Enlace copiado!' : 'Copiar enlace'}</span>
              </button>

              {onMore && (
                <>
                  <div className="song-dropdown-divider" role="separator" />
                  <button
                    type="button"
                    role="menuitem"
                    className="song-dropdown-item danger"
                    onClick={() => {
                      setMenuOpen(false)
                      onMore()
                    }}
                  >
                    <Trash2 size={15} />
                    <span>{moreTitle ?? 'Quitar de la playlist'}</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <AddToPlaylistModal
        open={playlistModalOpen}
        onOpenChange={setPlaylistModalOpen}
        track={track}
      />
    </>
  )
}
