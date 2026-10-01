import { NavLink } from 'react-router-dom'
import { Heart, Home, Library, Menu, Plus, Search } from 'lucide-react'

const nav = [{ to: '/', label: 'Inicio', icon: Home }, { to: '/search', label: 'Buscar', icon: Search }, { to: '/library', label: 'Biblioteca', icon: Library }, { to: '/favorites', label: 'Favoritos', icon: Heart }]

export function Sidebar({ compact, onCompact }: { compact: boolean; onCompact: () => void }) {
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
    {!compact && <div className="sidebar-section"><p>PLAYLISTS</p><button className="playlist-create"><Plus size={17}/> Nueva playlist</button><span className="muted small">Tu colección aparece aquí.</span></div>}
    <div className="account"><span className="avatar">AR</span>{!compact && <div><b>Alex Rivera</b><small>Plan personal</small></div>}</div>
  </aside>
}

export function MobileNav() {
  return <nav className="mobile-nav" aria-label="Navegación principal">
    {nav.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
      <Icon size={20} strokeWidth={2}/><span>{label}</span>
    </NavLink>)}
  </nav>
}
