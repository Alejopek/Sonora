import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Disc3, Heart } from 'lucide-react'
import type { Album } from '../types/music'
import { CoverImage } from './CoverImage'
import { usePlayerStore } from '../stores/player-store'

export function AlbumCard({ album }: { album: Album }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isAlbumFavorite, toggleAlbumFavorite } = usePlayerStore()
  const liked = isAlbumFavorite(album.id)
  return <article className="album-result-card">
    <button type="button" className="album-result-open" onClick={() => navigate(`/albums/${encodeURIComponent(album.id)}`)} aria-label={`Abrir álbum ${album.title}`}>
      <span className="album-result-cover">{album.thumbnail ? <CoverImage src={album.thumbnail} alt=""/> : <Disc3 size={42}/>}</span>
      <b>{album.title}</b><small>{album.artist || 'Álbum'}{album.year ? ` · ${album.year}` : ''}</small>
    </button>
    <button type="button" className={`album-result-like ${liked ? 'liked' : ''}`} onClick={() => { void toggleAlbumFavorite(album).finally(() => { void queryClient.invalidateQueries({ queryKey: ['recommended-albums'] }); void queryClient.invalidateQueries({ queryKey: ['daily-mix'] }) }) }} aria-label={liked ? `Quitar ${album.title} de favoritos` : `Me gusta ${album.title}`} title={liked ? 'Quitar de álbumes favoritos' : 'Me gusta este álbum'}>
      <Heart size={17} fill={liked ? 'currentColor' : 'none'}/>
    </button>
  </article>
}
