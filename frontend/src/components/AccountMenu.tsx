import { Heart, Library, LogOut, UserRound, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { SessionUser } from '../services/api'
import { UserAvatar } from './UserAvatar'

interface AccountMenuProps {
  user: SessionUser
  onClose: () => void
  onSignOut: () => void
  mobile?: boolean
}

function joinedOn(date: string) {
  const value = new Date(date)
  if (Number.isNaN(value.getTime())) return null
  return new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(value)
}

export function AccountMenu({ user, onClose, onSignOut, mobile = false }: AccountMenuProps) {
  const navigate = useNavigate()
  const joined = joinedOn(user.created_at)
  const goTo = (path: string) => {
    navigate(path)
    onClose()
  }

  useEffect(() => {
    if (!mobile) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [mobile, onClose])

  const menu = (
    <motion.section
      id={mobile ? 'mobile-account-menu' : 'account-menu'}
      className={`account-menu${mobile ? ' account-menu-mobile' : ''}`}
      aria-label="Menú de usuario"
      aria-modal={mobile || undefined}
      role={mobile ? 'dialog' : undefined}
      initial={{ opacity: 0, y: mobile ? 28 : 10, scale: mobile ? 1 : 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: mobile ? 28 : 8, scale: mobile ? 1 : 0.97 }}
      transition={{ type: 'spring', stiffness: 430, damping: 30 }}
    >
      <button className="account-menu-close" type="button" onClick={onClose} aria-label="Cerrar menú de usuario">
        <X size={17} />
      </button>
      <div className="account-menu-portrait">
        <UserAvatar name={user.username} size={112} className="account-menu-avatar" />
      </div>
      <div className="account-menu-identity">
        <h2>{user.username}</h2>
        <p>{user.email}</p>
      </div>
      <div className="account-menu-section" aria-label="Usuario">
        <span className="account-menu-label">Usuario</span>
        <div className="account-menu-detail"><UserRound size={15} /><span>Cuenta activa</span></div>
        {joined && <div className="account-menu-detail"><span className="account-menu-detail-dot" aria-hidden="true" /><span>En Sonora desde {joined}</span></div>}
      </div>
      <div className="account-menu-actions">
        <button type="button" onClick={() => goTo('/library')}><Library size={17} />Biblioteca</button>
        <button type="button" onClick={() => goTo('/favorites')}><Heart size={17} />Favoritos</button>
        <button className="account-menu-signout" type="button" onClick={onSignOut}><LogOut size={17} />Cerrar sesión</button>
      </div>
    </motion.section>
  )

  if (!mobile) return menu

  return <div className="account-menu-mobile-layer">
    <motion.button
      type="button"
      className="account-menu-mobile-backdrop"
      aria-label="Cerrar menú de usuario"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    />
    {menu}
  </div>
}
