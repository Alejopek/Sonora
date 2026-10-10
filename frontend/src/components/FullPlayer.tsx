import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronDown,
  Heart,
  ListMusic,
  ListPlus,
  Mic2,
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import * as Slider from '@radix-ui/react-slider'
import { useNavigate } from 'react-router-dom'
import { CoverImage } from './CoverImage'
import { AddToPlaylistModal } from './AddToPlaylistModal'
import { SongRow } from './SongRow'
import { fmt } from '../lib/format'
import { usePlayerStore } from '../stores/player-store'
import { getLyrics, type LyricLine } from '../services/api'

export function FullPlayer({ onClose, onOpenAuth }: { onClose: () => void; onOpenAuth?: () => void }) {
  const navigate = useNavigate()
  const s = usePlayerStore()
  const [lyrics, setLyrics] = useState<LyricLine[]>([])
  const [lyricsTrackId, setLyricsTrackId] = useState<string | null>(null)
  const [lyricsLoading, setLyricsLoading] = useState(false)
  const [lyricsError, setLyricsError] = useState(false)
  const [instrumental, setInstrumental] = useState(false)
  const [coverOnVinyl, setCoverOnVinyl] = useState(false)
  const [lyricsSource, setLyricsSource] = useState<string | null>(null)
  const [lyricsAttempt, setLyricsAttempt] = useState(0)
  const [playlistModalOpen, setPlaylistModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'lyrics' | 'queue'>('lyrics')

  const lyricsListRef = useRef<HTMLDivElement>(null)
  const activeLineRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (!s.currentTrack) return
    let cancelled = false
    const requestedTrackId = s.currentTrack.id
    setLyrics([])
    setLyricsTrackId(null)
    setLyricsLoading(true)
    setLyricsError(false)
    setInstrumental(false)
    setLyricsSource(null)
    getLyrics(s.currentTrack)
      .then((result) => {
        if (!cancelled) {
          setLyrics(result.lyrics)
          setInstrumental(Boolean(result.instrumental))
          setLyricsSource(result.source)
          setLyricsTrackId(requestedTrackId)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLyricsTrackId(requestedTrackId)
          setLyricsError(true)
        }
      })
      .finally(() => {
        if (!cancelled) setLyricsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [s.currentTrack?.id, lyricsAttempt])

  const isLyricsLoading = Boolean(s.currentTrack && (lyricsLoading || lyricsTrackId !== s.currentTrack.id))
  const visibleLyrics = lyricsTrackId === s.currentTrack?.id ? lyrics : []
  const hasSyncedLyrics = visibleLyrics.some((line) => line?.startTime !== null && line?.startTime !== undefined)
  const lastStartedLine = visibleLyrics.reduce(
    (active, line, index) =>
      line?.startTime != null && line.startTime / 1000 <= s.currentTime ? index : active,
    -1,
  )
  const activeLine =
    lastStartedLine >= 0
      ? lastStartedLine
      : hasSyncedLyrics
        ? visibleLyrics.findIndex((line) => line?.startTime != null)
        : -1

  useEffect(() => {
    if (activeTab !== 'lyrics') return
    const list = lyricsListRef.current
    const line = activeLineRef.current
    if (!list || !line) return

    const lineTop = line.offsetTop
    const targetTop = lineTop - (list.clientHeight - line.clientHeight) / 2
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    list.scrollTo({ top: targetTop, behavior })
  }, [activeLine, activeTab])

  if (!s.currentTrack) return null

  const upcomingTracks = s.queue.filter((_, index) => index > s.currentIndex)

  return (
    <motion.div
      className={`music-player ${s.isPlaying ? 'is-playing' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="music-backdrop">
        <CoverImage src={s.currentTrack.thumbnail} alt="" />
      </div>

      <header className="music-topline">
        <button className="music-close" onClick={onClose} aria-label="Minimizar reproductor">
          <ChevronDown size={21} />
        </button>
        <span>
          SONORA <i /> REPRODUCTOR
        </span>
        <span className="music-live">
          <i />
          {s.isPlaying ? 'REPRODUCIENDO' : 'EN PAUSA'}
        </span>
      </header>

      <main className="music-layout">
        {/* Panel izquierdo: vinilo / carátula y metadatos */}
        <section className="music-art-panel">
          <div className="music-art-wrap">
            <span className="music-audio-glow" aria-hidden="true" />
            <span
              className={`music-record-disc ${coverOnVinyl ? 'shows-cover' : ''}`}
              aria-hidden="true"
            >
              <span className="music-disc-art">
                <CoverImage src={s.currentTrack.thumbnail} alt="" />
              </span>
            </span>
            {!coverOnVinyl && (
              <button
                className="music-cover-trigger"
                onClick={() => setCoverOnVinyl(true)}
                aria-label="Mostrar la portada en el vinilo"
                aria-pressed={coverOnVinyl}
                title="Ver portada en el vinilo"
              >
                <CoverImage
                  className="music-cover-art"
                  src={s.currentTrack.thumbnail}
                  alt={`Portada de ${s.currentTrack.title}`}
                />
              </button>
            )}
            {coverOnVinyl && (
              <button
                className="music-disc-toggle"
                onClick={() => setCoverOnVinyl(false)}
                aria-label="Restaurar la portada central"
                aria-pressed={coverOnVinyl}
                title="Restaurar portada central"
              />
            )}
            <span className="music-art-glow" />
          </div>

          <div className="music-track-meta">
            <span className="music-kicker">AHORA SUENA</span>
            <h1>{s.currentTrack.title}</h1>
            <p>{s.currentTrack.artist}</p>
            <button type="button" className="full-album-link" onClick={() => navigate(s.currentTrack?.albumId ? `/albums/${encodeURIComponent(s.currentTrack.albumId)}` : `/search?q=${encodeURIComponent(s.currentTrack?.album || `${s.currentTrack?.title ?? ''} ${s.currentTrack?.artist ?? ''}`)}`)} aria-label={s.currentTrack.album ? `Abrir disco ${s.currentTrack.album}` : 'Buscar el disco de esta canción'}>{s.currentTrack.album || 'Ver disco'}</button>

            <div className="music-track-actions">
              <button
                type="button"
                className={`music-action-btn music-like-btn ${
                  s.isFavorite(s.currentTrack.id) ? 'liked' : ''
                }`}
                onClick={() => s.toggleFavorite(s.currentTrack!)}
                aria-label={
                  s.isFavorite(s.currentTrack.id) ? 'Quitar de favoritos' : 'Añadir a favoritos'
                }
                title={s.isFavorite(s.currentTrack.id) ? 'En favoritos' : 'Añadir a favoritos'}
              >
                <Heart size={18} fill={s.isFavorite(s.currentTrack.id) ? 'currentColor' : 'none'} />
                <span>{s.isFavorite(s.currentTrack.id) ? 'En favoritos' : 'Me gusta'}</span>
              </button>

              <button
                type="button"
                className="music-action-btn music-playlist-btn"
                onClick={() => setPlaylistModalOpen(true)}
                aria-label="Añadir a playlist o biblioteca"
                title="Añadir a playlist"
              >
                <ListPlus size={18} />
                <span>Añadir a playlist</span>
              </button>
            </div>
          </div>
        </section>

        {/* Panel derecho: Letras o Cola de reproducción intercambiables */}
        <section className="music-lyrics-area">
          <header className="music-lyrics-heading">
            <div className="fullplayer-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'lyrics'}
                className={`fullplayer-tab-btn ${activeTab === 'lyrics' ? 'active' : ''}`}
                onClick={() => setActiveTab('lyrics')}
              >
                <Mic2 size={16} />
                <span>Letra</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'queue'}
                className={`fullplayer-tab-btn ${activeTab === 'queue' ? 'active' : ''}`}
                onClick={() => setActiveTab('queue')}
              >
                <ListMusic size={16} />
                <span>Cola {upcomingTracks.length > 0 ? `(${upcomingTracks.length})` : ''}</span>
              </button>
            </div>

            {activeTab === 'lyrics' ? (
              <span className="music-lyrics-provider">
                {isLyricsLoading ? 'BUSCANDO' : lyricsSource ?? 'LETRA'}
              </span>
            ) : (
              upcomingTracks.length > 0 && (
                <button
                  type="button"
                  className="fullplayer-queue-clear"
                  onClick={s.clearQueue}
                  title="Limpiar cola"
                >
                  <Trash2 size={13} />
                  <span>Limpiar</span>
                </button>
              )
            )}
          </header>

          {activeTab === 'lyrics' ? (
            <div
              ref={lyricsListRef}
              className={`music-lyrics-list ${visibleLyrics.length ? 'has-lyrics' : ''} ${
                hasSyncedLyrics ? 'is-synced' : ''
              }`}
              aria-live="polite"
            >
              {isLyricsLoading && <p className="music-lyrics-message">Buscando la letra de este tema…</p>}
              {!isLyricsLoading && lyricsError && lyricsTrackId === s.currentTrack.id && (
                <p className="music-lyrics-message">
                  No se pudo conectar con el servicio de letras.
                  <button
                    className="lyrics-retry"
                    onClick={() => setLyricsAttempt((attempt) => attempt + 1)}
                  >
                    Volver a intentar
                  </button>
                </p>
              )}
              {!isLyricsLoading && !lyricsError && !visibleLyrics.length && (
                <p className="music-lyrics-message">
                  {instrumental
                    ? 'Este tema es instrumental y no tiene letra.'
                    : 'Todavía no encontramos la letra de este tema.'}
                </p>
              )}
              {!isLyricsLoading &&
                visibleLyrics.map((line, index) => (
                  <p
                    key={`${index}-${line.text}`}
                    ref={index === activeLine ? activeLineRef : undefined}
                    className={`music-lyric-line ${index === activeLine ? 'active' : ''} ${
                      index === activeLine - 1 ? 'previous' : ''
                    } ${index === activeLine + 1 ? 'next' : ''}`}
                  >
                    {line.text}
                  </p>
                ))}
            </div>
          ) : (
            <div className="fullplayer-queue-list">
              <div className="fullplayer-queue-section">
                <span className="queue-label">SONANDO AHORA</span>
                <div className="fullplayer-queue-item current">
                  <SongRow track={s.currentTrack} compact />
                </div>
              </div>

              <div className="fullplayer-queue-section">
                <span className="queue-label">A CONTINUACIÓN</span>
                {upcomingTracks.map((track, i) => {
                  const queueIndex = s.currentIndex + i + 1
                  return (
                    <div className="fullplayer-queue-item" key={`full-queue-${track.id}-${queueIndex}`}>
                      <SongRow track={track} queue={s.queue} compact />
                      <button
                        type="button"
                        className="queue-remove-btn"
                        onClick={() => s.removeFromQueue(queueIndex)}
                        title="Quitar de la cola"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  )
                })}

                {upcomingTracks.length === 0 && (
                  <p className="queue-empty-muted">No hay más canciones en la cola.</p>
                )}
              </div>
            </div>
          )}
        </section>
      </main>

      <footer className="music-console">
        <div className="music-controls">
          <button
            className={s.shuffle ? 'control active-control' : 'control'}
            onClick={s.toggleShuffle}
            aria-label="Reproducción aleatoria"
          >
            <Shuffle size={17} />
          </button>
          <button className="control" onClick={s.previous} aria-label="Canción anterior">
            <SkipBack fill="currentColor" />
          </button>
          <button
            className="music-play"
            onClick={() => s.setPlaying(!s.isPlaying)}
            aria-label={s.isPlaying ? 'Pausar' : 'Reproducir'}
          >
            {s.isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
          </button>
          <button className="control" onClick={s.next} aria-label="Canción siguiente">
            <SkipForward fill="currentColor" />
          </button>
          <button
            className={s.repeatMode !== 'off' ? 'control active-control' : 'control'}
            onClick={s.cycleRepeat}
            aria-label="Repetir"
          >
            <Repeat size={17} />
            <i>{s.repeatMode === 'one' ? '1' : ''}</i>
          </button>
        </div>

        <div className="music-progress">
          <span>{fmt(s.currentTime)}</span>
          <Slider.Root
            className="music-progress-slider"
            value={[Math.min(s.currentTime, s.duration || 0)]}
            max={s.duration || 1}
            step={1}
            onValueChange={([value]) => s.seek(value)}
            aria-label="Progreso de reproducción"
          >
            <Slider.Track>
              <Slider.Range />
            </Slider.Track>
            <Slider.Thumb aria-label="Posición de reproducción" />
          </Slider.Root>
          <span>{s.duration ? fmt(s.duration) : s.currentTrack.duration ?? '—'}</span>
        </div>

        <div className="music-volume">
          <button
            className="control"
            onClick={s.toggleMute}
            aria-label={s.volume ? 'Silenciar' : 'Activar sonido'}
          >
            {s.volume ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <Slider.Root
            className="music-volume-slider"
            value={[s.volume]}
            max={1}
            step={0.01}
            onValueChange={([value]) => s.setVolume(value)}
            aria-label="Volumen"
          >
            <Slider.Track>
              <Slider.Range />
            </Slider.Track>
            <Slider.Thumb aria-label="Nivel de volumen" />
          </Slider.Root>
        </div>
      </footer>

      <AddToPlaylistModal
        open={playlistModalOpen}
        onOpenChange={setPlaylistModalOpen}
        track={s.currentTrack}
        onOpenAuth={onOpenAuth}
      />
    </motion.div>
  )
}
