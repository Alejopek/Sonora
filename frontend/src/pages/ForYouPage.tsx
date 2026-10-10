import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Heart, ListPlus, Play, RefreshCw, Sparkles } from 'lucide-react'
import { getDailyMix, getRecommendationQueue, saveRecommendationPreferences, type Recommendation } from '../services/api'
import { picks } from '../lib/data'
import { useAuthStore } from '../stores/auth-store'
import { usePlayerStore } from '../stores/player-store'
import { SongRow } from '../components/SongRow'

const seedOptions = ['Indie', 'Electrónica', 'R&B', 'Rock en español', 'Pop', 'Jazz', 'Ambient']

export function ForYouPage() {
  const token = useAuthStore((state) => state.token)
  const { playTrack } = usePlayerStore()
  const [seeds, setSeeds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ['daily-mix'], queryFn: getDailyMix, enabled: Boolean(token), staleTime: 60_000, retry: 1 })
  const tracks = data?.tracks ?? []
  const queue = useMemo(() => tracks.map((track) => ({ ...track })), [tracks])
  const toggleSeed = (seed: string) => setSeeds((current) => current.includes(seed) ? current.filter((item) => item !== seed) : [...current, seed].slice(0, 4))
  const saveSeeds = async () => {
    setSaving(true)
    try { await saveRecommendationPreferences(seeds); await refetch() } finally { setSaving(false) }
  }
  const startQueue = async () => {
    try {
      const response = await getRecommendationQueue()
      if (response.tracks[0]) playTrack(response.tracks[0], response.tracks)
    } catch { if (queue[0]) playTrack(queue[0], queue) }
  }
  if (!token) return <div className="page for-you-page"><header className="for-you-heading"><span className="eyebrow">PARA VOS</span><h1>Tu música empieza por acá.</h1><p>Iniciá sesión para que Sonora aprenda de lo que realmente escuchás. Mientras tanto, podés explorar estas selecciones.</p></header><section className="guest-discovery"><div className="guest-discovery-copy"><Sparkles size={21}/><div><h2>Un punto de partida</h2><p>Las reproducciones, favoritos y saltos afinan el próximo mix.</p></div></div><button className="primary" onClick={() => playTrack(picks[0], picks)}><Play size={17} fill="currentColor"/> Reproducir una selección</button></section><div className="list-head"><span>#</span><span>TÍTULO</span><span>ÁLBUM</span><span></span><span></span></div>{picks.map((track, index) => <SongRow key={track.id} track={track} index={index + 1} queue={picks}/>)}</div>
  return <div className="page for-you-page">
    <header className="for-you-heading"><span className="eyebrow">PARA VOS · {data?.date ?? 'HOY'}</span><h1>Hecho para tu día.</h1><p>Un mix estable que combina lo que ya disfrutás con espacio para descubrir algo cercano.</p></header>
    <section className="mix-overview" aria-busy={isPending}>
      <div className="mix-orbit" aria-hidden="true"><span/><span/><Heart size={23} fill="currentColor"/></div>
      <div className="mix-overview-copy"><span className="eyebrow">{data?.title ?? 'MIX DIARIO'}</span><h2>{tracks.length ? `${tracks.length} canciones, con variedad.` : 'Elegí un punto de partida.'}</h2><p>{tracks.length ? 'Las sugerencias permanecen iguales hoy, salvo que marques una canción para no recomendar.' : 'Contanos qué sonidos te interesan y armamos el primer mix sin dejar la pantalla en blanco.'}</p><div className="hero-actions"><button className="primary" onClick={() => tracks[0] && playTrack(tracks[0], queue)} disabled={!tracks.length}><Play size={17} fill="currentColor"/> Reproducir mix</button><button className="secondary" onClick={() => void startQueue()} disabled={!tracks.length}><ListPlus size={17}/> Crear cola</button></div></div>
    </section>
    {(data?.isEmpty || !tracks.length) && <section className="preference-starter" aria-label="Preferencias iniciales"><div><h2>¿Con qué querés empezar?</h2><p>Podés elegir hasta cuatro estilos. Sonora usará estas semillas solo mientras aprende de tus escuchas.</p></div><div className="seed-options">{seedOptions.map((seed) => <button key={seed} className={seeds.includes(seed) ? 'selected' : ''} aria-pressed={seeds.includes(seed)} onClick={() => toggleSeed(seed)}>{seed}</button>)}</div><button className="secondary" disabled={!seeds.length || saving} onClick={() => void saveSeeds()}>{saving ? <RefreshCw className="spin" size={16}/> : <Sparkles size={16}/>} Crear mi primer mix</button></section>}
    {isError && <div className="state" role="status"><p>No pudimos actualizar el mix ahora. Tus señales y tus favoritos siguen guardados.</p><button className="secondary" onClick={() => refetch()}>Reintentar</button></div>}
    {isPending && <div className="recommendation-skeleton" aria-label="Cargando recomendaciones"><div/><div/><div/></div>}
    {!!tracks.length && <section className="recommendation-list" aria-label="Canciones recomendadas"><div className="list-head"><span>#</span><span>TÍTULO</span><span>ÁLBUM</span><span></span><span></span></div>{tracks.map((track: Recommendation, index) => <SongRow key={track.id} track={track} index={index + 1} queue={queue} recommendation onFeedback={() => void refetch()}/>)}</section>}
  </div>
}
