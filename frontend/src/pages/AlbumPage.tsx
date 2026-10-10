import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Disc3, Heart, Play } from 'lucide-react'
import { CoverImage } from '../components/CoverImage'
import { SongRow } from '../components/SongRow'
import { getAlbum } from '../services/api'
import { usePlayerStore } from '../stores/player-store'

export function AlbumPage() {
  const { albumId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: album, isPending, isError, refetch } = useQuery({ queryKey: ['album', albumId], queryFn: () => getAlbum(albumId), enabled: Boolean(albumId), retry: false })
  const { playTrack, isAlbumFavorite, toggleAlbumFavorite } = usePlayerStore()
  if (isPending) return <div className="page state">Cargando álbum…</div>
  if (isError || !album) return <div className="page state"><Disc3 size={30}/><h1>No se pudo cargar el álbum</h1><button className="secondary" onClick={() => void refetch()}>Reintentar</button></div>
  const liked = isAlbumFavorite(album.id)
  return <div className="page album-page">
    <button className="library-back-link" onClick={() => navigate(-1)}><ArrowLeft size={16}/>Volver</button>
    <header className="album-hero">
      <div className="album-hero-cover">{album.thumbnail ? <CoverImage src={album.thumbnail} alt={album.title}/> : <Disc3 size={54}/>}</div>
      <div className="album-hero-copy"><span className="eyebrow">{album.type || 'ÁLBUM'}{album.year ? ` · ${album.year}` : ''}</span><h1>{album.title}</h1><p>{album.artist}</p><small>{album.tracks.length} {album.tracks.length === 1 ? 'canción' : 'canciones'}</small>
        <div className="album-hero-actions"><button className="primary" disabled={!album.tracks.length} onClick={() => playTrack(album.tracks[0], album.tracks)}><Play size={16} fill="currentColor"/>Reproducir álbum</button><button className={`secondary ${liked ? 'album-liked' : ''}`} onClick={() => { void toggleAlbumFavorite(album).finally(() => { void queryClient.invalidateQueries({ queryKey: ['recommended-albums'] }); void queryClient.invalidateQueries({ queryKey: ['daily-mix'] }) }) }}><Heart size={16} fill={liked ? 'currentColor' : 'none'}/>{liked ? 'Te gusta' : 'Me gusta'}</button></div>
      </div>
    </header>
    <section className="section"><div className="section-title"><h2>Canciones</h2></div><div className="list-head"><span>#</span><span></span><span>TÍTULO</span><span>ÁLBUM</span><span></span><span>DURACIÓN</span><span></span></div>{album.tracks.map((track, index) => <SongRow key={`${track.id}-${index}`} track={track} index={index + 1} queue={album.tracks}/>)}</section>
  </div>
}
