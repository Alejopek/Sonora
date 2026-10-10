import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { searchMusic } from '../services/api'
import { Section } from '../components/Section'
import { SongRow } from '../components/SongRow'
import { CoverImage } from '../components/CoverImage'
import { AlbumCard } from '../components/AlbumCard'

type SearchFilter = 'all' | 'songs' | 'albums'
function useDebounced(value: string) { const [debounced, setDebounced] = useState(value); useEffect(() => { const timer = setTimeout(() => setDebounced(value), 350); return () => clearTimeout(timer) }, [value]); return debounced }

export function SearchPage() {
  const [searchParams] = useSearchParams()
  const qParam = searchParams.get('q') ?? ''
  const [input, setInput] = useState(qParam)
  const [filter, setFilter] = useState<SearchFilter>('all')
  useEffect(() => { if (qParam && qParam !== input) setInput(qParam) }, [qParam])
  const query = useDebounced(input.trim())
  const { data, isFetching, isError, refetch } = useQuery({ queryKey: ['search', query, filter], queryFn: () => searchMusic(query, filter), enabled: query.length > 1, retry: false })
  const empty = data && !data.songs.length && !data.albums.length && (filter !== 'all' || !data.artists.length)
  return <div className="page search-page">
    <div className="search-intro"><h1>Buscar</h1><p>Encuentra canciones y discos para escuchar.</p></div>
    <label className="search-field"><Search size={20}/><input autoFocus value={input} onChange={(event) => setInput(event.target.value)} placeholder="Artistas, discos, canciones…"/><kbd>⌘ K</kbd></label>
    <div className="search-filters" role="tablist" aria-label="Filtrar búsqueda">{([{ id: 'all', label: 'Todo' }, { id: 'songs', label: 'Canciones' }, { id: 'albums', label: 'Discos' }] as const).map((item) => <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} className={filter === item.id ? 'active' : ''} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div>
    {isFetching && <div className="results skeleton-list">{[1,2,3,4].map((item) => <div className="skeleton-row" key={item}/>)}</div>}
    {isError && <div className="state"><p>No se pudo conectar con el catálogo.</p><button className="secondary" onClick={() => void refetch()}>Reintentar</button></div>}
    {data && !isFetching && <SearchResults data={data} filter={filter}/>}
    {!query && <section className="browse"><span className="eyebrow">EXPLORAR</span><h2>Empieza por algo conocido</h2><div className="tag-row">{['Indie alternativo', 'Electronic', 'R&B', 'Focus', 'Rock en español'].map((tag) => <button key={tag} onClick={() => setInput(tag)}>{tag}</button>)}</div></section>}
    {query && !isFetching && empty && <div className="state"><Search size={28}/><h3>Sin resultados para “{query}”</h3><p>Prueba con otro título o artista.</p></div>}
  </div>
}

export function SearchResults({ data, filter = 'all' }: { data: Awaited<ReturnType<typeof searchMusic>>; filter?: SearchFilter }) {
  return <div className="results">
    {data.songs.length > 0 && <Section title="Canciones"><p className="search-queue-note">Al elegir una canción, Sonora arma una cola relacionada con ella y con tus gustos.</p>{data.songs.slice(0,8).map((track, index) => <SongRow track={track} index={index + 1} personalizedQueueOnPlay key={track.id}/>)}</Section>}
    {data.albums.length > 0 && <Section title="Discos"><div className="album-result-grid">{data.albums.slice(0,12).map((album) => <AlbumCard album={album} key={album.id}/>)}</div></Section>}
    {filter === 'all' && data.artists.length > 0 && <Section title="Artistas"><div className="artist-grid">{data.artists.slice(0,5).map((artist) => <div className="artist-card" key={artist.id}><CoverImage src={artist.thumbnail} alt=""/><b>{artist.name}</b><small>Artista</small></div>)}</div></Section>}
  </div>
}
