import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, LayoutGrid, List, Play, Search, Shuffle, X } from 'lucide-react'
import { CoverImage } from '../components/CoverImage'
import { SongRow } from '../components/SongRow'
import { usePlayerStore } from '../stores/player-store'
import { useAuthStore } from '../stores/auth-store'

export function FavoritesPage() {
  const navigate = useNavigate()
  const favorites = usePlayerStore((s) => s.favorites)
  const playTrack = usePlayerStore((s) => s.playTrack)
  const user = useAuthStore((s) => s.user)

  const [query, setQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const filteredTracks = useMemo(() => {
    if (!query.trim()) return favorites
    const q = query.toLowerCase()
    return favorites.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        (t.album && t.album.toLowerCase().includes(q)),
    )
  }, [favorites, query])

  const totalSeconds = useMemo(() => {
    return favorites.reduce((acc, t) => {
      if (t.durationSeconds) return acc + t.durationSeconds
      if (t.duration) {
        const parts = t.duration.split(':').map(Number)
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          return acc + parts[0] * 60 + parts[1]
        }
        if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
          return acc + parts[0] * 3600 + parts[1] * 60 + parts[2]
        }
      }
      return acc
    }, 0)
  }, [favorites])

  const totalDurationFormatted = useMemo(() => {
    if (totalSeconds <= 0) return ''
    if (totalSeconds >= 3600) {
      const hours = Math.floor(totalSeconds / 3600)
      const minutes = Math.floor((totalSeconds % 3600) / 60)
      return `${hours} h ${minutes} min`
    }
    const minutes = Math.floor(totalSeconds / 60)
    return `${minutes} min`
  }, [totalSeconds])

  const handlePlayAll = () => {
    if (!favorites.length) return
    playTrack(favorites[0], favorites)
  }

  const handleShuffle = () => {
    if (!favorites.length) return
    const shuffled = [...favorites].sort(() => Math.random() - 0.5)
    playTrack(shuffled[0], shuffled)
  }

  return (
    <div className="page favorites-page">
      {favorites.length > 0 ? (
        <>
          {/* ================= HERO DE FAVORITOS ================= */}
          <header className="favorites-hero">
            <div className="favorites-hero-cover-wrap">
              {favorites.length >= 4 ? (
                <div className="favorites-hero-collage">
                  {favorites.slice(0, 4).map((track, i) => (
                    <CoverImage
                      key={track.id || i}
                      src={track.thumbnail}
                      alt=""
                      className="favorites-collage-img"
                    />
                  ))}
                  <div className="favorites-hero-badge">
                    <Heart size={26} fill="currentColor" />
                  </div>
                </div>
              ) : (
                <div className="favorites-hero-gradient">
                  <Heart size={58} fill="currentColor" />
                </div>
              )}
            </div>

            <div className="favorites-hero-info">
              <span className="eyebrow">COLECCIÓN · TUS FAVORITOS</span>
              <h1 className="favorites-hero-title">Canciones que te gustan</h1>
              <p className="favorites-hero-desc">
                Tu biblioteca personal de canciones destacadas con corazón.
              </p>

              <div className="favorites-hero-meta">
                <span className="meta-author">{user?.username ?? 'Tú'}</span>
                <span className="meta-dot">·</span>
                <span className="meta-count">
                  {favorites.length} {favorites.length === 1 ? 'canción' : 'canciones'}
                </span>
                {totalDurationFormatted && (
                  <>
                    <span className="meta-dot">·</span>
                    <span className="meta-duration">{totalDurationFormatted}</span>
                  </>
                )}
              </div>

              <div className="favorites-hero-actions">
                <button
                  className="primary favorites-play-all-btn"
                  onClick={handlePlayAll}
                  aria-label="Reproducir canciones favoritas"
                >
                  <Play size={16} fill="currentColor" />
                  <span>Reproducir</span>
                </button>
                <button
                  className="secondary"
                  onClick={handleShuffle}
                  title="Reproducir en modo aleatorio"
                  aria-label="Reproducir en modo aleatorio"
                >
                  <Shuffle size={15} />
                  <span>Aleatorio</span>
                </button>
              </div>
            </div>
          </header>

          {/* ================= BARRA DE BÚSQUEDA Y VISTAS ================= */}
          <div className="favorites-toolbar">
            <div className="favorites-search-field">
              <Search size={16} className="favorites-search-icon" />
              <input
                type="text"
                placeholder="Buscar en canciones favoritas..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Buscar en favoritos"
              />
              {query && (
                <button
                  className="favorites-search-clear"
                  onClick={() => setQuery('')}
                  aria-label="Limpiar búsqueda"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="favorites-view-toggle" role="group" aria-label="Cambiar vista">
              <button
                type="button"
                className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Vista de cuadrícula"
                aria-label="Vista de cuadrícula"
                aria-pressed={viewMode === 'grid'}
              >
                <LayoutGrid size={16} />
                <span>Cuadrícula</span>
              </button>
              <button
                type="button"
                className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="Vista de lista"
                aria-label="Vista de lista"
                aria-pressed={viewMode === 'list'}
              >
                <List size={16} />
                <span>Lista</span>
              </button>
            </div>
          </div>

          {/* ================= CONTENIDO DE CANCIONES ================= */}
          {filteredTracks.length > 0 ? (
            viewMode === 'grid' ? (
              <div className="favorites-cards-grid">
                {filteredTracks.map((track) => (
                  <article
                    className="favorite-card"
                    key={track.id}
                    onClick={() => playTrack(track, filteredTracks)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Reproducir ${track.title} de ${track.artist}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        playTrack(track, filteredTracks)
                      }
                    }}
                  >
                    <div className="favorite-card-cover-wrap">
                      <CoverImage
                        src={track.thumbnail}
                        alt={track.title}
                        className="favorite-card-img"
                      />
                      <button
                        className="favorite-card-play-btn"
                        aria-label={`Reproducir ${track.title}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          playTrack(track, filteredTracks)
                        }}
                      >
                        <Play size={20} fill="currentColor" />
                      </button>
                    </div>

                    <div className="favorite-card-info">
                      <b className="favorite-card-title" title={track.title}>
                        {track.title}
                      </b>
                      <small className="favorite-card-artist" title={track.artist}>
                        {track.artist}
                      </small>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="favorites-list-section">
                <div className="list-head">
                  <span>#</span>
                  <span>TÍTULO</span>
                  <span>ÁLBUM</span>
                  <span></span>
                  <span></span>
                </div>
                <div className="favorites-tracks-list">
                  {filteredTracks.map((track, index) => (
                    <SongRow
                      key={track.id}
                      track={track}
                      index={index + 1}
                      queue={filteredTracks}
                    />
                  ))}
                </div>
              </div>
            )
          ) : (
            <div className="favorites-no-results">
              <Search size={28} />
              <h3>No se encontraron resultados</h3>
              <p>No hay canciones favoritas que coincidan con “{query}”.</p>
              <button className="secondary" onClick={() => setQuery('')}>
                Limpiar búsqueda
              </button>
            </div>
          )}
        </>
      ) : (
        /* ================= ESTADO VACÍO ================= */
        <div className="favorites-empty-box">
          <div className="favorites-empty-icon-wrap">
            <Heart size={38} />
          </div>
          <h2>Aún no tienes canciones favoritas</h2>
          <p>
            Presiona el corazón en cualquier canción que te guste mientras navegas o reproduces para
            guardarla en esta colección.
          </p>
          <button className="primary" onClick={() => navigate('/search')}>
            <Search size={16} /> Explorar música
          </button>
        </div>
      )}
    </div>
  )
}
