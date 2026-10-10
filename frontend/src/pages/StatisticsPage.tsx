import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, CalendarDays, Clock3, Disc3, Headphones, Music2, Sparkles, Users } from 'lucide-react'
import { getStatistics, type StatisticItem } from '../services/api'
import { fmt } from '../lib/format'
import { useAuthStore } from '../stores/auth-store'

type RangeName = 'today' | '7d' | '30d' | 'all' | 'custom'
const ranges: { id: RangeName; label: string }[] = [{ id: 'today', label: 'Hoy' }, { id: '7d', label: '7 días' }, { id: '30d', label: '30 días' }, { id: 'all', label: 'Todo' }]
const dateValue = (date: Date) => date.toISOString().slice(0, 10)

function duration(seconds: number) { return seconds >= 3600 ? `${Math.floor(seconds / 3600)} h ${Math.round(seconds % 3600 / 60)} min` : fmt(seconds) }
function ActivityChart({ activity }: { activity: { date: string; listenedSeconds: number }[] }) {
  const max = Math.max(1, ...activity.map((item) => item.listenedSeconds))
  return <div className="activity-chart" role="img" aria-label={activity.length ? `Actividad de escucha de ${activity.length} días` : 'Aún no hay actividad'}>{activity.map((item) => <div className="activity-bar" key={item.date} title={`${item.date}: ${duration(item.listenedSeconds)}`}><span style={{ height: `${Math.max(3, item.listenedSeconds / max * 100)}%` }}/><small>{new Intl.DateTimeFormat('es-AR', { weekday: 'narrow' }).format(new Date(`${item.date}T12:00:00`))}</small></div>)}</div>
}
function TopList({ title, icon: Icon, items, formatName }: { title: string; icon: typeof Music2; items: StatisticItem[]; formatName?: (item: StatisticItem) => string }) {
  return <section className="stats-top-list"><header><Icon size={17}/><h2>{title}</h2></header>{items.length ? <ol>{items.slice(0, 5).map((item, index) => <li key={`${item.name ?? item.title}-${index}`}><span className="stats-rank">{index + 1}</span><div><b>{formatName?.(item) ?? item.name ?? item.title}</b>{item.artist && <small>{item.artist}</small>}</div><span>{duration(item.listenedSeconds)}</span></li>)}</ol> : <p className="muted">Todavía no hay suficiente escucha en este período.</p>}</section>
}

export function StatisticsPage() {
  const token = useAuthStore((state) => state.token)
  const [range, setRange] = useState<RangeName>('7d')
  const [start, setStart] = useState(dateValue(new Date(Date.now() - 6 * 86400000)))
  const [end, setEnd] = useState(dateValue(new Date()))
  const query = useQuery({ queryKey: ['statistics', range, start, end], queryFn: () => getStatistics(range, range === 'custom' ? start : undefined, range === 'custom' ? end : undefined), enabled: Boolean(token), staleTime: 30_000 })
  const stats = query.data
  const hours = useMemo(() => stats?.hours ?? [], [stats])
  const peakHour = hours.reduce((best, value) => value.listenedSeconds > (best?.listenedSeconds ?? -1) ? value : best, undefined as typeof hours[number] | undefined)
  if (!token) return <div className="page stats-page stats-guest"><BarChart3 size={32}/><h1>Tu escucha, con perspectiva.</h1><p>Iniciá sesión para ver el tiempo real escuchado, tus artistas más reproducidos y cómo cambia tu semana.</p></div>
  const totals = stats?.totals ?? { listenedSeconds: 0, plays: 0, artists: 0, albums: 0, genres: 0, streakDays: 0 }
  return <div className="page stats-page">
    <header className="stats-heading"><div><span className="eyebrow">TU ESCUCHA</span><h1>Las señales que deja tu música.</h1><p>El tiempo se calcula con el progreso real de reproducción, no solo al abrir una canción.</p></div><div className="stats-range" aria-label="Rango de estadísticas">{ranges.map((item) => <button key={item.id} className={range === item.id ? 'active' : ''} aria-pressed={range === item.id} onClick={() => setRange(item.id)}>{item.label}</button>)}<button className={range === 'custom' ? 'active' : ''} aria-label="Elegir rango personalizado" aria-pressed={range === 'custom'} onClick={() => setRange('custom')}><CalendarDays size={16}/></button></div></header>
    {range === 'custom' && <div className="custom-range"><label>Desde<input type="date" value={start} max={end} onChange={(event) => setStart(event.target.value)}/></label><label>Hasta<input type="date" value={end} min={start} max={dateValue(new Date())} onChange={(event) => setEnd(event.target.value)}/></label></div>}
    {query.isPending && <div className="stats-loading" aria-label="Cargando estadísticas"><span/><span/><span/></div>}
    {query.isError && <div className="state"><p>No se pudieron cargar tus estadísticas.</p><button className="secondary" onClick={() => query.refetch()}>Reintentar</button></div>}
    {stats && <>
      <section className="stats-summary" aria-label={`Resumen: ${stats.range.label}`}><div className="stat-feature"><Clock3 size={19}/><span>Tiempo escuchado</span><strong>{duration(totals.listenedSeconds)}</strong>{stats.comparison && <small>{stats.comparison.changePercent === null ? 'Sin período anterior' : `${stats.comparison.changePercent > 0 ? '+' : ''}${stats.comparison.changePercent}% vs. período anterior`}</small>}</div><div><Music2 size={18}/><span>Reproducciones</span><strong>{totals.plays}</strong></div><div><Users size={18}/><span>Artistas</span><strong>{totals.artists}</strong></div><div><Disc3 size={18}/><span>Álbumes</span><strong>{totals.albums}</strong></div><div><Sparkles size={18}/><span>Géneros</span><strong>{totals.genres}</strong></div><div><Headphones size={18}/><span>Racha</span><strong>{totals.streakDays} {totals.streakDays === 1 ? 'día' : 'días'}</strong></div></section>
      {!totals.listenedSeconds ? <section className="stats-empty"><Headphones size={28}/><h2>Cuando empieces a escuchar, esto cobra vida.</h2><p>Reproducí una canción durante unos segundos y Sonora irá guardando solo las señales útiles para tu resumen.</p></section> : <>
        <section className="stats-activity"><header><div><span className="eyebrow">ACTIVIDAD</span><h2>{stats.range.label}</h2></div><p>{peakHour ? `Tu hora más activa es cerca de las ${String(peakHour.hour).padStart(2, '0')}:00.` : 'Seguimos reuniendo tus horas de escucha.'}</p></header><ActivityChart activity={stats.activity}/></section>
        <div className="stats-top-grid"><TopList title="Canciones más escuchadas" icon={Music2} items={stats.top.tracks} formatName={(item) => item.title ?? ''}/><TopList title="Artistas más escuchados" icon={Users} items={stats.top.artists}/><TopList title="Álbumes más escuchados" icon={Disc3} items={stats.top.albums}/><TopList title="Géneros más escuchados" icon={Sparkles} items={stats.top.genres}/></div>
      </>}
    </>}
  </div>
}
