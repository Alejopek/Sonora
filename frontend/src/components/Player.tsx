import { useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Heart, ListMusic, ListPlus, LoaderCircle, Pause, Play, Repeat, RotateCcw, Shuffle, SkipBack, SkipForward, Volume2, VolumeX, X } from 'lucide-react'
import * as Slider from '@radix-ui/react-slider'
import { useNavigate } from 'react-router-dom'
import { CoverImage } from './CoverImage'
import { AddToPlaylistModal } from './AddToPlaylistModal'
import { recordHistory, recordListeningEvent, streamUrl } from '../services/api'
import { fmt } from '../lib/format'
import { savedTrack, usePlayerStore } from '../stores/player-store'
import { useAuthStore } from '../stores/auth-store'
import { Queue } from './Queue'
import { FullPlayer } from './FullPlayer'

export function Player() {
  const navigate = useNavigate()
  const audio = useRef<HTMLAudioElement>(null)
  const s = usePlayerStore()
  const token = useAuthStore((state) => state.token)
  const [queueOpen, setQueueOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [playlistModalOpen, setPlaylistModalOpen] = useState(false)
  const [streamAttempt, setStreamAttempt] = useState(0)
  const listening = useRef({ sessionId: '', trackId: '', listenedSeconds: 0, lastPosition: 0, lastReported: 0, started: false, finalized: false })
  const [audioContainer] = useState(() => {
    const probe = document.createElement('audio')
    return probe.canPlayType('audio/webm; codecs="opus"') ? 'webm' as const : 'mp4' as const
  })

  useEffect(() => {
    if (!audio.current) return
    audio.current.volume = s.volume
  }, [s.volume, s.currentTrack?.id, streamAttempt])

  useEffect(() => {
    const element = audio.current
    if (!element || !s.currentTrack) return
    if (s.isPlaying) {
      element.play().catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return
        s.setLoading(false)
        s.setError('No fue posible reproducir esta canción. Vuelve a intentar el stream.')
      })
    } else {
      element.pause()
    }
  }, [s.currentTrack?.id, s.isPlaying, streamAttempt])

  useEffect(() => {
    if (audio.current && Math.abs(audio.current.currentTime - s.currentTime) > 1) {
      audio.current.currentTime = s.currentTime
    }
  }, [s.currentTime])

  useEffect(() => {
    const track = s.currentTrack
    if (!track) return
    listening.current = { sessionId: globalThis.crypto?.randomUUID?.() ?? `${track.id}-${Date.now()}`, trackId: track.id, listenedSeconds: 0, lastPosition: 0, lastReported: 0, started: false, finalized: false }
    return () => {
      const state = listening.current
      if (token && state.trackId === track.id && state.started && !state.finalized) {
        state.finalized = true
        void recordListeningEvent({ sessionId: state.sessionId, event: 'skipped', track: savedTrack(track), listenedSeconds: Math.round(state.listenedSeconds) }).catch(() => undefined)
      }
    }
  }, [s.currentTrack?.id])

  const reportListening = (event: 'started' | 'progress' | 'completed' | 'skipped', force = false) => {
    const track = s.currentTrack
    const state = listening.current
    if (!token || !track || state.trackId !== track.id) return
    if (!force && event === 'progress' && state.listenedSeconds - state.lastReported < 15) return
    if (event === 'started') state.started = true
    if (event === 'completed' || event === 'skipped') state.finalized = true
    state.lastReported = state.listenedSeconds
    void recordListeningEvent({ sessionId: state.sessionId, event, track: savedTrack(track), listenedSeconds: Math.round(state.listenedSeconds) }).catch(() => undefined)
  }

  if (!s.currentTrack) return null
  const toggle = () => s.setPlaying(!s.isPlaying)

  return <>
    <audio
      key={`${s.currentTrack.id}-${streamAttempt}`}
      ref={audio}
      src={`${streamUrl(s.currentTrack.id, audioContainer)}&attempt=${streamAttempt}`}
      preload="auto"
      onLoadStart={() => s.setLoading(true)}
      onTimeUpdate={(event) => {
        const position = event.currentTarget.currentTime
        const state = listening.current
        const delta = position - state.lastPosition
        if (s.isPlaying && delta > 0 && delta < 3) state.listenedSeconds += delta
        state.lastPosition = position
        s.seek(position)
        reportListening('progress')
      }}
      onLoadedMetadata={(event) => s.setDuration(event.currentTarget.duration)}
      onWaiting={() => s.setLoading(true)}
      onStalled={() => s.setLoading(true)}
      onPlaying={() => { s.setLoading(false); s.setError(null); if (!listening.current.started) { reportListening('started', true); const track = s.currentTrack; if (token && track) void recordHistory(savedTrack(track)).catch(() => undefined) } }}
      onCanPlay={() => s.setLoading(false)}
      onEnded={() => { reportListening('completed', true); s.next() }}
      onError={() => { s.setLoading(false); s.setError('El stream no está disponible para esta canción.') }}
    />
    <footer className="player">
      {s.error && <div className="player-error" role="alert"><span>{s.error}</span><button onClick={() => { s.setError(null); s.setLoading(true); s.seek(0); setStreamAttempt((attempt) => attempt + 1) }} aria-label="Reintentar reproducción"><RotateCcw size={16}/></button><button onClick={() => s.setError(null)} aria-label="Cerrar aviso"><X size={17}/></button></div>}
      <div className="player-track-area">
        <button className="now-track" onClick={() => setExpanded(true)}>
          <CoverImage src={s.currentTrack.thumbnail} alt=""/>
          <span><b>{s.currentTrack.title}</b><small>{s.currentTrack.artist}</small></span>
        </button>
        {s.currentTrack.album && <button type="button" className="player-album-link" title={`Abrir ${s.currentTrack.album}`} onClick={() => navigate(s.currentTrack?.albumId ? `/albums/${encodeURIComponent(s.currentTrack.albumId)}` : `/search?q=${encodeURIComponent(s.currentTrack?.album ?? '')}`)}>{s.currentTrack.album}</button>}
        <button
          type="button"
          className={`like ${s.isFavorite(s.currentTrack.id) ? 'liked' : ''}`}
          onClick={() => s.toggleFavorite(s.currentTrack!)}
          aria-label={s.isFavorite(s.currentTrack.id) ? 'Quitar de favoritos' : 'Añadir a favoritos'}
          title={s.isFavorite(s.currentTrack.id) ? 'En favoritos' : 'Añadir a favoritos'}
        >
          <Heart size={17} fill={s.isFavorite(s.currentTrack.id) ? 'currentColor' : 'none'} />
        </button>
        <button
          type="button"
          className="icon-button player-add-btn"
          onClick={() => setPlaylistModalOpen(true)}
          aria-label="Añadir a playlist o biblioteca"
          title="Añadir a playlist"
        >
          <ListPlus size={17} />
        </button>
      </div>
      <div className="player-main">
        <div className="controls">
          <button className={s.shuffle ? 'control active-control' : 'control'} onClick={s.toggleShuffle} aria-label="Aleatorio"><Shuffle size={17}/></button>
          <button className="control" onClick={s.previous} aria-label="Anterior"><SkipBack size={19} fill="currentColor"/></button>
          <button className="play-button" onClick={toggle} aria-label="Reproducir o pausar">{s.loading ? <LoaderCircle className="spin" size={20}/> : s.isPlaying ? <Pause size={20} fill="currentColor"/> : <Play size={20} fill="currentColor"/>}</button>
          <button className="control" onClick={s.next} aria-label="Siguiente"><SkipForward size={19} fill="currentColor"/></button>
          <button className={s.repeatMode !== 'off' ? 'control active-control' : 'control'} onClick={s.cycleRepeat} aria-label="Repetir"><Repeat size={17}/><i>{s.repeatMode === 'one' ? '1' : ''}</i></button>
        </div>
        <div className="progress">
          <span>{fmt(s.currentTime)}</span>
          <Slider.Root className="compact-progress-slider" value={[Math.min(s.currentTime, s.duration || 0)]} max={s.duration || 1} step={1} onValueChange={([value]) => s.seek(value)} aria-label="Progreso de reproducción"><Slider.Track><Slider.Range/></Slider.Track><Slider.Thumb aria-label="Posición de reproducción"/></Slider.Root>
          <span>{s.duration ? fmt(s.duration) : s.currentTrack.duration ?? '—'}</span>
        </div>
      </div>
      <div className="player-tools">
        <div className="volume">
          <button onClick={s.toggleMute} aria-label={s.volume ? 'Silenciar' : 'Activar sonido'}>{s.volume ? <Volume2 size={18}/> : <VolumeX size={18}/>}</button>
          <Slider.Root className="compact-volume-slider" value={[s.volume]} max={1} step={.01} onValueChange={([value]) => s.setVolume(value)} aria-label="Volumen"><Slider.Track><Slider.Range/></Slider.Track><Slider.Thumb aria-label="Nivel de volumen"/></Slider.Root>
        </div>
        <button className={`icon-button queue-toggle ${queueOpen ? 'active-control' : ''}`} onClick={() => setQueueOpen(!queueOpen)} aria-label="Cola"><ListMusic size={19}/></button>
      </div>
    </footer>
    <AnimatePresence>{queueOpen && <Queue onClose={() => setQueueOpen(false)}/>}</AnimatePresence>
    <AnimatePresence>{expanded && <FullPlayer onClose={() => setExpanded(false)}/>}</AnimatePresence>
    <AddToPlaylistModal
      open={playlistModalOpen}
      onOpenChange={setPlaylistModalOpen}
      track={s.currentTrack}
    />
  </>
}
