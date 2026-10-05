import { useEffect, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Heart, Search } from 'lucide-react'
import { MobileNav, Sidebar } from './components/Sidebar'
import { AccountMenu } from './components/AccountMenu'
import { AuthModal } from './components/AuthModal'
import { UserAvatar } from './components/UserAvatar'
import { Player } from './components/Player'
import { HomePage } from './pages/HomePage'
import { SearchPage } from './pages/SearchPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { LibraryPage } from './pages/LibraryPage'
import { usePlayerStore } from './stores/player-store'
import { picks } from './lib/data'
import { defaultCoverPalette, readCoverPalette } from './lib/palette'
import { useAuthStore } from './stores/auth-store'
import { importLocalLibrary } from './services/api'

function Shell() {
  const [compact, setCompact] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [palette, setPalette] = useState(defaultCoverPalette)
  const currentTrack = usePlayerStore((state) => state.currentTrack)
  const { token, user, restore, signOut } = useAuthStore()
  const syncCloudLibrary = usePlayerStore((state) => state.syncCloudLibrary)
  const location = useLocation()
  const navigate = useNavigate()
  const paletteSource = currentTrack?.thumbnail || picks[0].thumbnail

  useEffect(() => {
    let cancelled = false
    readCoverPalette(paletteSource).then((nextPalette) => {
      if (!cancelled) setPalette(nextPalette ?? defaultCoverPalette)
    })
    return () => { cancelled = true }
  }, [paletteSource])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        navigate('/search')
        window.setTimeout(() => document.querySelector<HTMLInputElement>('.search-field input')?.focus(), 0)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate])

  useEffect(() => { void restore() }, [restore])
  useEffect(() => {
    if (!token || !user) return
    const player = usePlayerStore.getState()
    const toSaved = (track: typeof player.history[number]) => ({ videoId: track.id, title: track.title, artist: track.artist, duration: track.durationSeconds, thumbnailUrl: track.thumbnail })
    const importKey = `sonora-library-imported-${user.id}`
    const importExisting = localStorage.getItem(importKey) ? Promise.resolve() : importLocalLibrary(player.favorites.map(toSaved), player.history.map(toSaved)).then(() => localStorage.setItem(importKey, '1'))
    void importExisting.then(syncCloudLibrary).catch(() => undefined)
  }, [token, user, syncCloudLibrary])

  const themeStyle = {
    '--theme-accent': palette.accent,
    '--theme-rgb': palette.rgb,
    '--home-accent': palette.accent,
    '--home-accent-rgb': palette.rgb,
    '--music-accent': palette.accent,
    '--music-rgb': palette.rgb,
  } as CSSProperties

  return <div className="app-shell" style={themeStyle}>
    <Sidebar compact={compact} onCompact={() => setCompact(!compact)}/>
    <main className="content">
      <header className="topbar"><div className="history-buttons"><button onClick={() => navigate(-1)}><ChevronLeft size={19}/></button><button onClick={() => navigate(1)}><ChevronRight size={19}/></button></div><div className="topbar-search" onClick={() => navigate('/search')}><Search size={17}/><span>Buscar en Sonora</span><kbd>⌘ K</kbd></div><button type="button" className="topbar-account-trigger" onClick={() => (user ? setAccountOpen(true) : setAuthOpen(true))} aria-label={user ? `Abrir menú de ${user.username}` : 'Iniciar sesión'} aria-expanded={user ? accountOpen : undefined} aria-controls={user ? 'mobile-account-menu' : undefined}><span>{user?.username ?? 'Invitado'}</span><UserAvatar name={user?.username} size={36}/></button></header>
      <AnimatePresence mode="wait"><motion.div key={location.pathname} initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: .18 }}><Routes><Route path="/" element={<HomePage/>}/><Route path="/search" element={<SearchPage/>}/><Route path="/library" element={<LibraryPage/>}/><Route path="/library/:playlistId" element={<LibraryPage/>}/><Route path="/favorites" element={<PlaceholderPage title="Favoritos" icon={Heart}/>}/><Route path="*" element={<HomePage/>}/></Routes></motion.div></AnimatePresence>
    </main>
    <Player/>
    <MobileNav/>
    <AnimatePresence>{user && accountOpen && <AccountMenu mobile user={user} onClose={() => setAccountOpen(false)} onSignOut={() => { signOut(); setAccountOpen(false) }}/>}</AnimatePresence>
    <AuthModal open={authOpen} onOpenChange={setAuthOpen}/>
  </div>
}

export default function App() { return <Shell/> }
