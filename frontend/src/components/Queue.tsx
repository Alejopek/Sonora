import { motion } from 'framer-motion'
import { Trash2, X } from 'lucide-react'
import { usePlayerStore } from '../stores/player-store'
import { SongRow } from './SongRow'

export function Queue({ onClose }: { onClose: () => void }) {
  const s = usePlayerStore()
  const upcomingTracks = s.queue.filter((_, index) => index > s.currentIndex)

  return (
    <motion.aside
      className="queue-panel"
      initial={{ x: 30, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 30, opacity: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      <header className="queue-header">
        <div>
          <span className="eyebrow">COLA DE REPRODUCCIÓN</span>
          <h2>En reproducción</h2>
        </div>
        <div className="queue-header-actions">
          {upcomingTracks.length > 0 && (
            <button
              type="button"
              className="queue-clear-btn"
              onClick={s.clearQueue}
              title="Vaciar cola de reproducción"
              aria-label="Vaciar cola"
            >
              <Trash2 size={14} />
              <span>Limpiar</span>
            </button>
          )}
          <button
            type="button"
            className="icon-button queue-close-btn"
            onClick={onClose}
            aria-label="Cerrar cola"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      <div className="queue-scroll-area">
        {s.currentTrack && (
          <div className="queue-section">
            <p className="queue-label">SONANDO AHORA</p>
            <div className="queue-item current">
              <SongRow track={s.currentTrack} compact />
            </div>
          </div>
        )}

        <div className="queue-section">
          <p className="queue-label">
            A CONTINUACIÓN {upcomingTracks.length > 0 && `(${upcomingTracks.length})`}
          </p>

          {upcomingTracks.map((track, i) => {
            const queueIndex = s.currentIndex + i + 1
            return (
              <div className="queue-item" key={`${track.id}-${queueIndex}`}>
                <SongRow track={track} queue={s.queue} compact />
                <button
                  type="button"
                  className="queue-remove-btn"
                  onClick={() => s.removeFromQueue(queueIndex)}
                  title="Quitar de la cola"
                  aria-label={`Quitar ${track.title} de la cola`}
                >
                  <X size={15} />
                </button>
              </div>
            )
          })}

          {upcomingTracks.length === 0 && (
            <p className="queue-empty-muted">No hay más canciones en la cola.</p>
          )}
        </div>
      </div>
    </motion.aside>
  )
}
