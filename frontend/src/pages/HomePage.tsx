import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  ListPlus,
  Play,
  Shuffle,
  Sparkles,
  TrendingUp,
  Search,
} from 'lucide-react'
import { CoverImage } from '../components/CoverImage'
import { picks, moodCategories } from '../lib/data'
import { getDailyMix, getLastFmMoodProfile, getLastFmStatus, getRecommendedAlbums, searchMusic } from '../services/api'
import { usePlayerStore } from '../stores/player-store'
import { useAuthStore } from '../stores/auth-store'
import { Section } from '../components/Section'
import { SongRow } from '../components/SongRow'
import type { Track } from '../types/music'
import { AlbumCard } from '../components/AlbumCard'
import { useNavigate } from 'react-router-dom'

export function HomePage() {
  const navigate = useNavigate()
  const { playTrack, history, favorites, currentTrack, isPlaying, setPlaying, addToQueue } = usePlayerStore()
  const { user } = useAuthStore()
  const token = useAuthStore((state) => state.token)
  const { data: personalMix } = useQuery({ queryKey: ['daily-mix'], queryFn: getDailyMix, enabled: Boolean(token), staleTime: 5 * 60_000, retry: false })
  const { data: lastFmStatus } = useQuery({ queryKey: ['lastfm-status', user?.id], queryFn: getLastFmStatus, enabled: Boolean(token), staleTime: 60_000, retry: false })
  const { data: lastFmProfile, isError: lastFmProfileError } = useQuery({ queryKey: ['lastfm-mood-profile', user?.id], queryFn: getLastFmMoodProfile, enabled: Boolean(token && lastFmStatus?.connected), staleTime: 2 * 60_000, refetchInterval: 5 * 60_000, retry: false })
  const { data: albumRecommendations } = useQuery({ queryKey: ['recommended-albums', token ? 'personal' : 'popular'], queryFn: async () => { if (token) { try { const albums = (await getRecommendedAlbums()).albums; if (albums.length) return albums } catch { /* Keep album discovery available if personalized data is unavailable. */ } } return (await searchMusic('indie alternative albums', 'albums')).albums }, staleTime: 10 * 60_000, retry: false })
  const personalTracks = personalMix?.tracks ?? []

  // Carousel de destacados
  const featuredTracks = useMemo(() => personalTracks.length ? personalTracks.slice(0, 4) : picks.slice(0, 4), [personalMix])
  const [featuredIndex, setFeaturedIndex] = useState(0)
  const currentFeatured = featuredTracks[featuredIndex] ?? featuredTracks[0]

  // Filtro de categorías / estados de ánimo
  const [activeMood, setActiveMood] = useState('all')
  const moodSearchQueries: Record<string, string> = {
    focus: 'instrumental lo-fi music for focus',
    relax: 'chill ambient slow relaxing songs',
    energy: 'upbeat energetic dance pop songs',
    night: 'dark atmospheric synthwave songs',
  }
  const lastFmTasteTerms = [
    ...(lastFmProfile?.tags.slice(0, 3) ?? []),
    ...(lastFmProfile?.recentArtists.slice(0, 2) ?? []),
  ].join(' ')
  const { data: moodTracks, isLoading: moodTracksLoading, isError: moodTracksError } = useQuery({
    queryKey: ['mood-tracks', activeMood, lastFmTasteTerms],
    queryFn: async () => (await searchMusic(`${moodSearchQueries[activeMood]} ${lastFmTasteTerms}`.trim(), 'songs')).songs,
    enabled: activeMood !== 'all',
    staleTime: 10 * 60_000,
    retry: false,
  })

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

  // La búsqueda filtrada de YouTube Music trae canciones relacionadas con el mood.
  const filteredQuickPicks = useMemo(() => {
    if (activeMood === 'all') return personalTracks.length ? personalTracks.slice(0, 8) : picks
    return (moodTracks ?? []).slice(0, 12)
  }, [activeMood, moodTracks, personalTracks])

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
        {lastFmStatus?.connected && <p className="home-mood-personalization">Tus artistas recientes y etiquetas de Last.fm ajustan estas búsquedas. Last.fm no ofrece datos de BPM.</p>}
        {lastFmStatus?.connected && lastFmProfileError && <p className="home-mood-personalization" role="status">Last.fm está vinculado, pero no se pudo leer tu actividad reciente. Revisá la conexión en el menú del avatar.</p>}
      </div>

      {/* 2) Hero Interactivo / Destacado para escuchar ahora con Carrusel y portada con Parallax */}
      <section
        className="hero hero-enhanced"
        onMouseMove={handleHeroMouseMove}
        onMouseLeave={handleHeroMouseLeave}
      >
        <div className="hero-copy">
          <div className="hero-badge-row">
            <span className="eyebrow">{personalTracks.length ? 'UNA SEÑAL DE TU MIX DIARIO' : 'DESTACADO · PARA ESCUCHAR AHORA'}</span>
            {!personalTracks.length && <span className="hero-tag">SELECCIÓN INICIAL</span>}
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
          {(personalTracks.length ? [
            { id: 'daily-personal', title: 'Tu mix diario', description: 'Una selección que combina afinidad y descubrimiento desde tus escuchas.', tag: 'HECHO PARA VOS', tracks: personalTracks.slice(0, 16) },
            { id: 'discover-personal', title: 'Cerca de tus gustos', description: 'Canciones relacionadas con lo que venís escuchando.', tag: 'PARA DESCUBRIR', tracks: personalTracks.slice(8, 24).length ? personalTracks.slice(8, 24) : personalTracks.slice(0, 12) },
          ] : !user ? [{ id: 'starter', title: 'Una selección para explorar', description: 'Iniciá sesión para recibir mixes que aprendan de tus escuchas.', tag: 'PARA EMPEZAR', tracks: picks.slice(0, 8) }] : []).map((mix) => (
            <div
              key={mix.id}
              className="home-mix-card"
              style={{ background: 'rgb(var(--theme-rgb) / .09)' }}
              onClick={() => mix.tracks[0] && playTrack(mix.tracks[0], mix.tracks)}
            >
              <div className="mix-card-top">
                <span className="mix-tag">{mix.tag}</span>
                <button
                  type="button"
                  className="mix-play-btn"
                  title={`Reproducir ${mix.title}`}
                  disabled={!mix.tracks.length}
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
              : user ? 'Una selección inicial para empezar a explorar' : 'Una selección para explorar'}
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

      {lastFmStatus?.connected && lastFmProfile?.recentTracks.length ? <Section title="Escuchado en Last.fm">
        <div className="lastfm-recent-list">
          {lastFmProfile.recentTracks.slice(0, 8).map((track, index) => (
            <button
              type="button"
              className="lastfm-recent-item"
              key={`${track.title}-${track.artist}-${index}`}
              onClick={() => navigate(`/search?q=${encodeURIComponent(`${track.title} ${track.artist}`)}`)}
              aria-label={`Buscar ${track.title} de ${track.artist} en Sonora`}
              title="Buscar esta canción en Sonora"
            >
              <CoverImage src={track.thumbnail} alt="" />
              <span className="lastfm-recent-copy"><b>{track.title}</b><small>{track.artist}{track.nowPlaying ? ' · Reproduciendo ahora en Last.fm' : ''}</small></span>
              <Search size={16} aria-hidden="true" />
            </button>
          ))}
        </div>
      </Section> : null}

      {/* 5) Quick picks dinámicos según el mood seleccionado */}
      <Section title={activeMood === 'all' && personalTracks.length ? 'Quick picks para vos' : activeMood === 'all' ? 'Quick picks' : `Picks para ${moodCategories.find(m => m.id === activeMood)?.label || 'este momento'}`}>
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
          {activeMood !== 'all' && moodTracksLoading && <p className="personal-recommendation-empty" role="status">Buscando canciones para este momento…</p>}
          {activeMood !== 'all' && moodTracksError && <p className="personal-recommendation-empty" role="status">No se pudieron cargar canciones para esta categoría. Probá de nuevo en unos segundos.</p>}
          {activeMood !== 'all' && !moodTracksLoading && !moodTracksError && filteredQuickPicks.length === 0 && <p className="personal-recommendation-empty" role="status">No encontramos canciones para esta categoría.</p>}
          {activeMood === 'all' && !personalTracks.length && user && <p className="personal-recommendation-empty">Estamos reuniendo tus primeras señales. Mientras tanto, estas canciones son una selección inicial.</p>}
        </div>
      </Section>

      <Section title="Discos para descubrir">
        <div className="album-result-grid home-album-recommendations">
          {(albumRecommendations ?? []).slice(0, 8).map((album) => <AlbumCard album={album} key={album.id}/>)}
          {user && !albumRecommendations?.length && <p className="personal-recommendation-empty">Estamos reuniendo señales para recomendarte discos.</p>}
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
