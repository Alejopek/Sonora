import { NavLink } from 'react-router-dom'
import { Heart, Home, Library, LogIn, LogOut, Menu, Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuthStore } from '../stores/auth-store'
import { AuthModal } from './AuthModal'
import { createPlaylist, getPlaylists, type UserPlaylist } from '../services/api'

const nav = [{ to: '/', label: 'Inicio', icon: Home }, { to: '/search', label: 'Buscar', icon: Search }, { to: '/library', label: 'Biblioteca', icon: Library }, { to: '/favorites', label: 'Favoritos', icon: Heart }]

export function Sidebar({ compact, onCompact }: { compact: boolean; onCompact: () => void }) {
  const [authOpen, setAuthOpen] = useState(false)
  const [playlists, setPlaylists] = useState<UserPlaylist[]>([])
  const { user, signOut } = useAuthStore()
  useEffect(() => { if (!user) { setPlaylists([]); return } void getPlaylists().then(setPlaylists).catch(() => undefined) }, [user])
  const addPlaylist = async () => {
    if (!user) { setAuthOpen(true); return }
    const title = window.prompt('Nombre de la playlist')?.trim()
    if (!title) return
    try { const playlist = await createPlaylist(title); setPlaylists((current) => [playlist, ...current]) } catch { /* Playback remains unaffected. */ }
  }
  return <aside className={`sidebar ${compact ? 'compact' : ''}`}>
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
    {!compact && <div className="sidebar-section"><p>PLAYLISTS</p><button className="playlist-create" onClick={() => void addPlaylist()}><Plus size={17}/> Nueva playlist</button>{playlists.length ? playlists.slice(0, 6).map((playlist) => <span className="muted small sidebar-playlist" key={playlist.id}>{playlist.title}</span>) : <span className="muted small">{user ? 'Aún no tienes playlists.' : 'Inicia sesión para sincronizarlas.'}</span>}</div>}
    <div className="account"><span className="avatar">{user?.username.slice(0, 2).toUpperCase() ?? 'SO'}</span>{!compact && <div><b>{user?.username ?? 'Invitado'}</b><small>{user ? user.email : 'Tu música, en cualquier lugar'}</small></div>}<button className="icon-button account-action" onClick={() => user ? signOut() : setAuthOpen(true)} aria-label={user ? 'Cerrar sesión' : 'Iniciar sesión'}>{user ? <LogOut size={16}/> : <LogIn size={16}/>}</button></div>
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
