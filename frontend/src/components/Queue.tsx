import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { usePlayerStore } from '../stores/player-store'
import { SongRow } from './SongRow'

export function Queue({ onClose }: { onClose: () => void }) { const s = usePlayerStore(); return <motion.aside className="queue-panel" initial={{ x: 28, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 28, opacity: 0 }}><header><div><span className="eyebrow">COLA</span><h2>En reproducción</h2></div><button className="icon-button" onClick={onClose}><X size={19}/></button></header><p className="queue-label">SONANDO AHORA</p>{s.currentTrack && <SongRow track={s.currentTrack}/>}<p className="queue-label">A CONTINUACIÓN</p>{s.queue.filter((_, index) => index > s.currentIndex).map((track, i) => <div className="queue-item" key={`${track.id}-${i}`}><SongRow track={track}/><button onClick={() => s.removeFromQueue(s.currentIndex + i + 1)}><X size={15}/></button></div>)} {!s.queue.slice(s.currentIndex + 1).length && <p className="muted">No hay más canciones en la cola.</p>}</motion.aside> }
