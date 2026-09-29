import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, Pause, Play, Repeat, Shuffle, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react'
import * as Slider from '@radix-ui/react-slider'
import { CoverImage } from './CoverImage'
import { fmt } from '../lib/format'
import { usePlayerStore } from '../stores/player-store'
import { getLyrics, type LyricLine } from '../services/api'

export function FullPlayer({ onClose }: { onClose: () => void }) {
  const s = usePlayerStore()
  const [lyrics, setLyrics] = useState<LyricLine[]>([])
  const [lyricsTrackId, setLyricsTrackId] = useState<string | null>(null)
  const [lyricsLoading, setLyricsLoading] = useState(false)
  const [lyricsError, setLyricsError] = useState(false)
  const [instrumental, setInstrumental] = useState(false)
  const [lyricsSource, setLyricsSource] = useState<string | null>(null)
  const [lyricsAttempt, setLyricsAttempt] = useState(0)
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
    getLyrics(s.currentTrack).then((result) => {
      if (!cancelled) {
        setLyrics(result.lyrics)
        setInstrumental(Boolean(result.instrumental))
        setLyricsSource(result.source)
        setLyricsTrackId(requestedTrackId)
      }
    }).catch(() => {
      if (!cancelled) {
        setLyricsTrackId(requestedTrackId)
        setLyricsError(true)
      }
    }).finally(() => {
      if (!cancelled) setLyricsLoading(false)
    })
    return () => { cancelled = true }
  }, [s.currentTrack?.id, lyricsAttempt])
  const isLyricsLoading = Boolean(s.currentTrack && (lyricsLoading || lyricsTrackId !== s.currentTrack.id))
  const visibleLyrics = lyricsTrackId === s.currentTrack?.id ? lyrics : []
  const hasSyncedLyrics = visibleLyrics.some((line) => line?.startTime !== null && line?.startTime !== undefined)
  const lastStartedLine = visibleLyrics.reduce((active, line, index) => line?.startTime != null && line.startTime / 1000 <= s.currentTime ? index : active, -1)
  const activeLine = lastStartedLine >= 0 ? lastStartedLine : hasSyncedLyrics ? visibleLyrics.findIndex((line) => line?.startTime != null) : -1
  useEffect(() => { activeLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }, [activeLine])
  if (!s.currentTrack) return null
  return <motion.div className={`music-player ${s.isPlaying ? 'is-playing' : ''}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <div className="music-backdrop"><CoverImage src={s.currentTrack.thumbnail} alt=""/></div>
    <header className="music-topline"><button className="music-close" onClick={onClose} aria-label="Minimizar reproductor"><ChevronDown size={21}/></button><span>SONORA <i/> REPRODUCTOR</span><span className="music-live"><i/>{s.isPlaying ? 'REPRODUCIENDO' : 'EN PAUSA'}</span></header>
    <main className="music-layout">
      <section className="music-art-panel">
        <div className="music-art-wrap"><span className="music-audio-glow" aria-hidden="true"/><span className="music-record-disc"/><CoverImage className="music-cover-art" src={s.currentTrack.thumbnail} alt={`Portada de ${s.currentTrack.title}`}/><span className="music-art-glow"/></div>
        <div className="music-track-meta"><span className="music-kicker">AHORA SUENA</span><h1>{s.currentTrack.title}</h1><p>{s.currentTrack.artist}</p><small>{s.currentTrack.album}</small></div>
      </section>
      <section className="music-lyrics-area">
        <header className="music-lyrics-heading"><div><span className="music-kicker">EN SINTONÍA</span><h2>Letra</h2></div><span className="music-lyrics-provider">{isLyricsLoading ? 'BUSCANDO' : lyricsSource ?? 'LETRA'}</span></header>
        <div className={`music-lyrics-list ${visibleLyrics.length ? 'has-lyrics' : ''} ${hasSyncedLyrics ? 'is-synced' : ''}`} aria-live="polite">
          {isLyricsLoading && <p className="music-lyrics-message">Buscando la letra de este tema…</p>}
          {!isLyricsLoading && lyricsError && lyricsTrackId === s.currentTrack.id && <p className="music-lyrics-message">No se pudo conectar con el servicio de letras.<button className="lyrics-retry" onClick={() => setLyricsAttempt((attempt) => attempt + 1)}>Volver a intentar</button></p>}
          {!isLyricsLoading && !lyricsError && !visibleLyrics.length && <p className="music-lyrics-message">{instrumental ? 'Este tema es instrumental y no tiene letra.' : 'Todavía no encontramos la letra de este tema.'}</p>}
          {!isLyricsLoading && visibleLyrics.map((line, index) => <p key={`${index}-${line.text}`} ref={index === activeLine ? activeLineRef : undefined} className={`music-lyric-line ${index === activeLine ? 'active' : ''}`}>{line.text}</p>)}
        </div>
      </section>
    </main>
    <footer className="music-console">
      <div className="music-controls">
        <button className={s.shuffle ? 'control active-control' : 'control'} onClick={s.toggleShuffle} aria-label="Reproducción aleatoria"><Shuffle size={17}/></button>
        <button className="control" onClick={s.previous} aria-label="Canción anterior"><SkipBack fill="currentColor"/></button>
        <button className="music-play" onClick={() => s.setPlaying(!s.isPlaying)} aria-label={s.isPlaying ? 'Pausar' : 'Reproducir'}>{s.isPlaying ? <Pause fill="currentColor"/> : <Play fill="currentColor"/>}</button>
        <button className="control" onClick={s.next} aria-label="Canción siguiente"><SkipForward fill="currentColor"/></button>
        <button className={s.repeatMode !== 'off' ? 'control active-control' : 'control'} onClick={s.cycleRepeat} aria-label="Repetir"><Repeat size={17}/><i>{s.repeatMode === 'one' ? '1' : ''}</i></button>
      </div>
      <div className="music-progress">
        <span>{fmt(s.currentTime)}</span>
        <Slider.Root className="music-progress-slider" value={[Math.min(s.currentTime, s.duration || 0)]} max={s.duration || 1} step={1} onValueChange={([value]) => s.seek(value)} aria-label="Progreso de reproducción"><Slider.Track><Slider.Range/></Slider.Track><Slider.Thumb aria-label="Posición de reproducción"/></Slider.Root>
        <span>{s.duration ? fmt(s.duration) : s.currentTrack.duration ?? '—'}</span>
      </div>
      <div className="music-volume">
        <button className="control" onClick={s.toggleMute} aria-label={s.volume ? 'Silenciar' : 'Activar sonido'}>{s.volume ? <Volume2 size={18}/> : <VolumeX size={18}/>}</button>
        <Slider.Root className="music-volume-slider" value={[s.volume]} max={1} step={.01} onValueChange={([value]) => s.setVolume(value)} aria-label="Volumen"><Slider.Track><Slider.Range/></Slider.Track><Slider.Thumb aria-label="Nivel de volumen"/></Slider.Root>
      </div>
    </footer>
  </motion.div>
}
