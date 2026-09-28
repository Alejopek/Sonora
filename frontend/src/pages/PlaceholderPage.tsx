import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Library } from 'lucide-react'
import { SongRow } from '../components/SongRow'
import { usePlayerStore } from '../stores/player-store'
import type { Track } from '../types/music'

export function PlaceholderPage({ title, icon: Icon }: { title: string; icon: typeof Library }) { const navigate = useNavigate(); const [favorites] = useState<Track[]>(() => JSON.parse(localStorage.getItem('sonora-favorite-tracks') ?? '[]')); const history = usePlayerStore((s) => s.history); const tracks = title === 'Favoritos' ? favorites : history; return <div className="page">{tracks.length ? <section className="section"><div className="section-title"><h1>{title}</h1></div><div className="list-head"><span>#</span><span>TÍTULO</span><span>ÁLBUM</span><span></span><span></span></div>{tracks.map((track, index) => <SongRow key={track.id} track={track} index={index + 1} queue={tracks}/>)}</section> : <div className="empty-page"><Icon size={34}/><h1>{title}</h1><p>{title === 'Favoritos' ? 'Las canciones que marques con corazón aparecerán aquí.' : 'Tu historial y playlists guardadas se organizarán aquí.'}</p><button className="secondary" onClick={() => navigate('/search')}>Explorar música</button></div>}</div> }
