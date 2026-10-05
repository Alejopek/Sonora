import { NavLink, useNavigate } from 'react-router-dom'
import { Heart, Home, Library, Menu, Plus, Search } from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../stores/auth-store'
import { AuthModal } from './AuthModal'
import { createPlaylist, getPlaylists, type UserPlaylist } from '../services/api'
import { UserAvatar } from './UserAvatar'
import { AccountMenu } from './AccountMenu'

const nav = [{ to: '/', label: 'Inicio', icon: Home }, { to: '/search', label: 'Buscar', icon: Search }, { to: '/library', label: 'Biblioteca', icon: Library }, { to: '/favorites', label: 'Favoritos', icon: Heart }]

export function Sidebar({ compact, onCompact }: { compact: boolean; onCompact: () => void }) {
  const [authOpen, setAuthOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [playlists, setPlaylists] = useState<UserPlaylist[]>([])
  const accountRef = useRef<HTMLDivElement>(null)
  const { user, signOut } = useAuthStore()
  const navigate = useNavigate()
  useEffect(() => { if (!user) { setPlaylists([]); return } void getPlaylists().then(setPlaylists).catch(() => undefined) }, [user])
  useEffect(() => {
    if (!accountOpen) return
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePress)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [accountOpen])
  useEffect(() => { if (!user) setAccountOpen(false) }, [user])
  const addPlaylist = async () => {
    if (!user) { setAuthOpen(true); return }
    const title = window.prompt('Nombre de la playlist')?.trim()
    if (!title) return
    try { const playlist = await createPlaylist(title); setPlaylists((current) => [playlist, ...current]) } catch { /* Playback remains unaffected. */ }
  }
  return <aside className={`sidebar ${compact ? 'compact' : ''} ${accountOpen ? 'account-menu-open' : ''}`}>
    <div className="brand">
      {compact
        ? <button className="brand-mark compact-brand-toggle" onClick={onCompact} aria-label="Expandir barra lateral">
            <img className="brand-logo" src="/web-app-manifest-192x192.png" alt=""/>
          </button>
        : <span className="brand-mark"><img className="brand-logo" src="/web-app-manifest-192x192.png" alt=""/></span>}
      {!compact && <span>sonora</span>}
      {!compact && <button className="icon-button collapse" onClick={onCompact} aria-label="Colapsar barra lateral"><Menu size={18}/></button>}
    </div>
    <nav aria-label="Navegación principal">
      {nav.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title={label}>
        <Icon size={19}/>{!compact && <span>{label}</span>}
      </NavLink>)}
    </nav>
    {!compact && <div className="sidebar-section"><p>PLAYLISTS</p><button className="playlist-create" onClick={() => void addPlaylist()}><Plus size={17}/> Nueva playlist</button>{playlists.length ? playlists.slice(0, 6).map((playlist) => <button type="button" className="sidebar-playlist" key={playlist.id} onClick={() => navigate(`/library/${playlist.id}`)} title={`Abrir ${playlist.title}`}><span className="muted small">{playlist.title}</span><small>{playlist.items.length}</small></button>) : <span className="muted small">{user ? 'Aún no tienes playlists.' : 'Inicia sesión para sincronizarlas.'}</span>}</div>}
    <div className="account" ref={accountRef}>
      {compact ? (
        <button
          className="avatar-btn"
          onClick={() => (user ? setAccountOpen((open) => !open) : setAuthOpen(true))}
          aria-label={user ? `Abrir menú de ${user.username}` : 'Iniciar sesión'}
          aria-expanded={user ? accountOpen : undefined}
          aria-controls={user ? 'account-menu' : undefined}
          title={user ? `${user.username} (${user.email})` : 'Iniciar sesión'}
        >
          <UserAvatar name={user?.username} size={40} />
        </button>
      ) : (
        <button
          type="button"
          className="account-trigger"
          onClick={() => (user ? setAccountOpen((open) => !open) : setAuthOpen(true))}
          aria-label={user ? `Abrir menú de ${user.username}` : 'Iniciar sesión'}
          aria-expanded={user ? accountOpen : undefined}
          aria-controls={user ? 'account-menu' : undefined}
          title={user ? `${user.username} (${user.email})` : 'Iniciar sesión'}
        >
          <span className="account-trigger-avatar" aria-hidden="true">
            <UserAvatar name={user?.username} size={40} />
          </span>
          <span className="account-trigger-copy">
            <b>{user?.username ?? 'Invitado'}</b>
            <small>{user ? user.email : 'Tu música, en cualquier lugar'}</small>
          </span>
        </button>
      )}
      <AnimatePresence>
        {user && accountOpen && <AccountMenu user={user} onClose={() => setAccountOpen(false)} onSignOut={() => { signOut(); setAccountOpen(false) }} />}
      </AnimatePresence>
    </div>
    <AuthModal open={authOpen} onOpenChange={setAuthOpen}/>
  </aside>
}

export function MobileNav() {
  return <nav className="mobile-nav" aria-label="Navegación principal">
    {nav.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
      <Icon size={20} strokeWidth={2}/><span>{label}</span>
    </NavLink>)}
  </nav>
}
