import { Library, LogOut, Music2, Unlink, UserRound, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { disconnectLastFm, getLastFmStatus, startLastFmConnection, type SessionUser } from '../services/api'
import { happy, surprised, wink, type AvatarExpression } from '../lib/blobatar-expressions'
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

const avatarExpressions = [happy, wink, surprised] as const

export function AccountMenu({ user, onClose, onSignOut, mobile = false }: AccountMenuProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { data: lastFmStatus, isLoading: lastFmLoading } = useQuery({ queryKey: ['lastfm-status', user.id], queryFn: getLastFmStatus, staleTime: 60_000 })
  const joined = joinedOn(user.created_at)
  const [avatarExpression, setAvatarExpression] = useState<AvatarExpression>()
  const expressionIndex = useRef(0)
  const expressionTimeout = useRef<number | undefined>(undefined)
  const [lastFmBusy, setLastFmBusy] = useState(false)
  const [lastFmError, setLastFmError] = useState<string | null>(null)
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

  useEffect(() => () => window.clearTimeout(expressionTimeout.current), [])

  const animateAvatarExpression = () => {
    const expression = avatarExpressions[expressionIndex.current % avatarExpressions.length]
    expressionIndex.current += 1
    setAvatarExpression(undefined)
    window.requestAnimationFrame(() => {
      setAvatarExpression(expression)
      window.clearTimeout(expressionTimeout.current)
      expressionTimeout.current = window.setTimeout(() => setAvatarExpression(undefined), 900)
    })
  }

  const connectLastFm = async () => {
    setLastFmBusy(true)
    setLastFmError(null)
    try {
      const { authorizationUrl } = await startLastFmConnection()
      window.location.assign(authorizationUrl)
    } catch (error) {
      setLastFmError(error instanceof Error ? error.message : 'No se pudo iniciar la conexión con Last.fm.')
      setLastFmBusy(false)
    }
  }

  const disconnectLastFmAccount = async () => {
    setLastFmBusy(true)
    setLastFmError(null)
    try {
      await disconnectLastFm()
      await queryClient.invalidateQueries({ queryKey: ['lastfm-status', user.id] })
      queryClient.removeQueries({ queryKey: ['lastfm-mood-profile', user.id] })
    } catch (error) {
      setLastFmError(error instanceof Error ? error.message : 'No se pudo desconectar Last.fm.')
    } finally {
      setLastFmBusy(false)
    }
  }

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
        <button type="button" className="account-menu-avatar-trigger" onClick={animateAvatarExpression} aria-label="Animar expresión del avatar">
          <UserAvatar name={user.username} size={112} className="account-menu-avatar" expression={avatarExpression} />
        </button>
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
      <div className="account-menu-section account-menu-integration" aria-label="Integraciones">
        <span className="account-menu-label">Integraciones</span>
        {lastFmLoading ? <div className="account-menu-detail">Consultando Last.fm…</div> : lastFmStatus?.connected ? <>
          <div className="account-menu-detail"><Music2 size={15}/><span>Last.fm conectado como <b>{lastFmStatus.username}</b></span></div>
          <button type="button" className="account-menu-integration-action" onClick={() => void disconnectLastFmAccount()} disabled={lastFmBusy}><Unlink size={14}/>{lastFmBusy ? 'Desconectando…' : 'Desconectar Last.fm'}</button>
        </> : <>
          <button type="button" className="account-menu-integration-action" onClick={() => void connectLastFm()} disabled={lastFmBusy || !lastFmStatus?.configured}><Music2 size={15}/>{lastFmBusy ? 'Conectando…' : 'Conectar con Last.fm'}</button>
          {!lastFmStatus?.configured && <div className="account-menu-detail">Requiere configurar la clave y el secreto de Last.fm en el servidor.</div>}
        </>}
        {location.search.includes('lastfm=connected') && <p className="account-menu-integration-note" role="status">Cuenta de Last.fm vinculada.</p>}
        {location.search.includes('lastfm=error') && <p className="account-menu-integration-error" role="alert">No se pudo vincular Last.fm. Intentá otra vez.</p>}
        {lastFmError && <p className="account-menu-integration-error" role="alert">{lastFmError}</p>}
      </div>
      <div className="account-menu-actions">
        <button type="button" onClick={() => goTo('/library')}><Library size={17} />Biblioteca</button>
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
