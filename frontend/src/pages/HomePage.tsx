import { CoverImage } from '../components/CoverImage'
import { Play } from 'lucide-react'
import { picks } from '../lib/data'
import { usePlayerStore } from '../stores/player-store'
import { Section } from '../components/Section'
import { SongRow } from '../components/SongRow'

export function HomePage() { const { playTrack } = usePlayerStore(); return <div className="page home-page"><section className="hero"><div className="hero-art"><CoverImage src={picks[0].thumbnail} alt="Blonde cover"/></div><div className="hero-copy"><span className="eyebrow">SELECCIÓN PARA ESTA NOCHE</span><h1>{picks[0].title}</h1><p>{picks[0].artist} · {picks[0].album}</p><div className="hero-actions"><button className="primary" onClick={() => playTrack(picks[0], picks)}><Play size={18} fill="currentColor"/> Reproducir</button></div></div></section><Section title="Escuchado recientemente"><div className="list-head"><span>#</span><span>TÍTULO</span><span>ÁLBUM</span><span></span><span></span></div>{picks.slice(0,4).map((track, i) => <SongRow key={track.id} track={track} index={i + 1} queue={picks}/>)}</Section><Section title="Quick picks"><div className="album-grid">{picks.map((track) => <button className="album-card" key={`card-${track.id}`} onClick={() => playTrack(track, picks)}><div className="cover"><CoverImage src={track.thumbnail} alt=""/><span><Play size={18} fill="currentColor"/></span></div><b>{track.title}</b><small>{track.artist}</small></button>)}</div></Section></div> }
