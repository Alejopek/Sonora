import { useState, useMemo, useEffect } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  ListPlus,
  Play,
  Shuffle,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { CoverImage } from '../components/CoverImage'
import { picks, mixCards, moodCategories } from '../lib/data'
import { usePlayerStore } from '../stores/player-store'
import { useAuthStore } from '../stores/auth-store'
import { Section } from '../components/Section'
import { SongRow } from '../components/SongRow'
import type { Track } from '../types/music'

export function HomePage() {
  const { playTrack, history, favorites, currentTrack, isPlaying, setPlaying, addToQueue } = usePlayerStore()
  const { user } = useAuthStore()

  // Carousel de destacados
  const featuredTracks = useMemo(() => picks.slice(0, 4), [])
  const [featuredIndex, setFeaturedIndex] = useState(0)
  const currentFeatured = featuredTracks[featuredIndex] ?? featuredTracks[0]

  // Filtro de categorías / estados de ánimo
  const [activeMood, setActiveMood] = useState('all')

  // Saludo según la hora del día
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 12) return 'Buenos días'
    if (hour >= 12 && hour < 19) return 'Buenas tardes'
    return 'Buenas noches'
  }, [])

  // Escuchado recientemente: Si el usuario tiene historial real, mostramos los primeros 6 tracks del historial.
  // Si no tiene nada, usamos tracks seleccionados de picks como fallback elegante.
  const recentTracks: Track[] = useMemo(() => {
    if (history && history.length > 0) {
      return history.slice(0, 6)
    }
    return picks.slice(0, 5)
  }, [history])

  // Filtrado de canciones de Quick Picks según el mood seleccionado
  const filteredQuickPicks = useMemo(() => {
    if (activeMood === 'focus') {
      return [picks[1], picks[2], picks[8], picks[0]]
    }
    if (activeMood === 'relax') {
      return [picks[1], picks[0], picks[4], picks[8]]
    }
    if (activeMood === 'energy') {
      return [picks[3], picks[5], picks[6], picks[7]]
    }
    if (activeMood === 'night') {
      return [picks[2], picks[0], picks[5], picks[8]]
    }
    return picks
  }, [activeMood])

  const nextFeatured = () => {
    setFeaturedIndex((prev) => (prev + 1) % featuredTracks.length)
  }

  const prevFeatured = () => {
    setFeaturedIndex((prev) => (prev - 1 + featuredTracks.length) % featuredTracks.length)
  }

  const isCurrentFeaturedPlaying = currentTrack?.id === currentFeatured.id && isPlaying

  const handlePlayFeatured = () => {
    if (currentTrack?.id === currentFeatured.id) {
      setPlaying(!isPlaying)
    } else {
      playTrack(currentFeatured, featuredTracks)
    }
  }

  // Tracking de scroll y cursor para interacción fluida de la portada en Desktop
  // En móvil (<= 720px), se mantiene fija sin desplazarse
  const [scrollY, setScrollY] = useState(0)
  const [cursorYOffset, setCursorYOffset] = useState(0)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 720)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 720)
    }
    const handleScroll = () => {
      if (window.innerWidth > 720) {
        setScrollY(window.scrollY)
      } else {
        setScrollY(0)
      }
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const handleHeroMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (isMobile) return
    const rect = e.currentTarget.getBoundingClientRect()
    const relativeY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    setCursorYOffset(relativeY * 22)
  }

  const handleHeroMouseLeave = () => {
    setCursorYOffset(0)
  }

  // Si está en móvil, 0 (fija en el celular). En desktop, la imagen se desplaza suavemente hacia abajo al scrollear o bajar el cursor.
  const heroImageSlideY = isMobile ? 0 : Math.min(scrollY * 0.42 + cursorYOffset, 120)

  return (
    <div className="page home-page">
      {/* 1) Encabezado dinámico y filtros de mood */}
      <div className="home-heading-wrap">
        <div className="home-heading">
          <span className="eyebrow">
            {user?.username ? `HOLA, ${user.username.toUpperCase()}` : 'TU ESPACIO, TU MÚSICA'}
          </span>
          <h1>{greeting}.</h1>
          <p>Música pensada para acompañar tu ritmo y tus momentos.</p>
        </div>

        {/* Chips de categorías y estados de ánimo */}
        <div className="home-mood-chips" role="tablist" aria-label="Categorías de música">
          {moodCategories.map((mood) => (
            <button
              key={mood.id}
              type="button"
              role="tab"
              aria-selected={activeMood === mood.id}
              className={`mood-chip ${activeMood === mood.id ? 'active' : ''}`}
              onClick={() => setActiveMood(mood.id)}
            >
              {mood.id === 'focus' && <Sparkles size={13} />}
              {mood.id === 'energy' && <Flame size={13} />}
              {mood.id === 'night' && <TrendingUp size={13} />}
              <span>{mood.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2) Hero Interactivo / Destacado para escuchar ahora con Carrusel y portada con Parallax */}
      <section
        className="hero hero-enhanced"
        onMouseMove={handleHeroMouseMove}
        onMouseLeave={handleHeroMouseLeave}
      >
        <div className="hero-copy">
          <div className="hero-badge-row">
            <span className="eyebrow">DESTACADO · PARA ESCUCHAR AHORA</span>
            <span className="hero-tag">EXCLUSIVO SONORA</span>
          </div>

          <h2>{currentFeatured.title}</h2>
          <p>
            {currentFeatured.artist} <span className="hero-dot">·</span> {currentFeatured.album}
          </p>

          <div className="hero-actions">
            <button
              type="button"
              className="primary hero-play-btn"
              onClick={handlePlayFeatured}
              aria-label={isCurrentFeaturedPlaying ? 'Pausar destacado' : 'Reproducir destacado'}
            >
              <Play size={17} fill="currentColor" />
              <span>{isCurrentFeaturedPlaying ? 'Pausar' : 'Reproducir'}</span>
            </button>

            <button
              type="button"
              className="secondary hero-action-btn"
              title="Agregar a la cola"
              onClick={() => addToQueue(currentFeatured)}
            >
              <ListPlus size={16} />
              <span>A la cola</span>
            </button>

            <button
              type="button"
              className="secondary hero-action-btn"
              title="Reproducción aleatoria del catálogo"
              onClick={() => {
                const randomTrack = picks[Math.floor(Math.random() * picks.length)]
                playTrack(randomTrack, picks)
              }}
            >
              <Shuffle size={16} />
              <span>Aleatorio</span>
            </button>
          </div>
        </div>

        <div className="hero-art-stage">
          <div
            className="hero-art-container"
            style={heroImageSlideY > 0 ? { transform: `translateY(${heroImageSlideY}px)` } : undefined}
          >
            <div className="hero-art">
              <CoverImage src={currentFeatured.thumbnail} alt={currentFeatured.title} />
            </div>
            <div className="hero-art-glow" />
          </div>

          {/* Controles de carrusel en el hero */}
          <div className="hero-carousel-nav">
            <button
              type="button"
              className="hero-nav-arrow"
              onClick={prevFeatured}
              aria-label="Destacado anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="hero-index">
              {String(featuredIndex + 1).padStart(2, '0')} <i>/</i> {String(featuredTracks.length).padStart(2, '0')}
            </span>
            <button
              type="button"
              className="hero-nav-arrow"
              onClick={nextFeatured}
              aria-label="Siguiente destacado"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* 3) Acceso rápido en tarjetas grandes (Mixes diarios / Estaciones de humor) */}
      <section className="section home-mixes-section">
        <div className="section-title">
          <div>
            <h2>Mixes pensados para vos</h2>
            <small className="section-subtitle">Selecciones continuas que evolucionan según lo que te gusta</small>
          </div>
        </div>

        <div className="home-mix-grid">
          {mixCards.map((mix) => (
            <div
              key={mix.id}
              className="home-mix-card"
              style={{ background: mix.gradient }}
              onClick={() => playTrack(mix.tracks[0], mix.tracks)}
            >
              <div className="mix-card-top">
                <span className="mix-tag">{mix.tag}</span>
                <button
                  type="button"
                  className="mix-play-btn"
                  title={`Reproducir ${mix.title}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    playTrack(mix.tracks[0], mix.tracks)
                  }}
                >
                  <Play size={18} fill="currentColor" />
                </button>
              </div>

              <div className="mix-card-body">
                <h3>{mix.title}</h3>
                <p>{mix.description}</p>
              </div>

              <div className="mix-card-thumbs">
                {mix.tracks.slice(0, 3).map((t, idx) => (
                  <img key={`${mix.id}-thumb-${idx}`} src={t.thumbnail} alt="" className="mix-mini-art" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4) Escuchado recientemente (con soporte de historial real del usuario) */}
      <Section title="Escuchado recientemente">
        <div className="section-subtitle-bar">
          <small className="section-subtitle">
            {history && history.length > 0
              ? 'Tus últimas canciones reproducidas en esta sesión'
              : 'Selección inspirada en tus últimos descubrimientos'}
          </small>
        </div>
        <div className="list-head">
          <span>#</span>
          <span>TÍTULO</span>
          <span>ÁLBUM</span>
          <span></span>
          <span>DURACIÓN</span>
          <span></span>
        </div>
        {recentTracks.map((track, i) => (
          <SongRow
            key={`recent-${track.id}-${i}`}
            track={track}
            index={i + 1}
            queue={recentTracks}
          />
        ))}
      </Section>

      {/* 5) Quick picks dinámicos según el mood seleccionado */}
      <Section title={activeMood === 'all' ? 'Quick picks' : `Picks para ${moodCategories.find(m => m.id === activeMood)?.label || 'este momento'}`}>
        <div className="album-grid">
          {filteredQuickPicks.map((track) => (
            <button
              className="album-card"
              key={`quick-${track.id}`}
              onClick={() => playTrack(track, filteredQuickPicks)}
            >
              <div className="cover">
                <CoverImage src={track.thumbnail} alt={track.title} />
                <span>
                  <Play size={18} fill="currentColor" />
                </span>
              </div>
              <b>{track.title}</b>
              <small>{track.artist}</small>
            </button>
          ))}
        </div>
      </Section>

      {/* 6) Si el usuario tiene favoritos, mostrar sección especial de favoritos destacados */}
      {favorites && favorites.length > 0 && (
        <Section title="Tus favoritos del momento">
          <div className="album-grid">
            {favorites.slice(0, 5).map((track) => (
              <button
                className="album-card"
                key={`fav-card-${track.id}`}
                onClick={() => playTrack(track, favorites)}
              >
                <div className="cover">
                  <CoverImage src={track.thumbnail} alt={track.title} />
                  <span>
                    <Play size={18} fill="currentColor" />
                  </span>
                </div>
                <b>{track.title}</b>
                <small>{track.artist}</small>
              </button>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}
