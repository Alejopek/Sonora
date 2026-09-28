import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Heart, Library, Search } from 'lucide-react'
import { Sidebar } from './components/Sidebar'
import { Player } from './components/Player'
import { HomePage } from './pages/HomePage'
import { SearchPage } from './pages/SearchPage'
import { PlaceholderPage } from './pages/PlaceholderPage'

function Shell() { const [compact, setCompact] = useState(false); const location = useLocation(); const navigate = useNavigate(); useEffect(() => { const handleKeyDown = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); navigate('/search'); window.setTimeout(() => document.querySelector<HTMLInputElement>('.search-field input')?.focus(), 0) } }; window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown) }, [navigate]); return <div className="app-shell"><Sidebar compact={compact} onCompact={() => setCompact(!compact)}/><main className="content"><header className="topbar"><div className="history-buttons"><button onClick={() => navigate(-1)}><ChevronLeft size={19}/></button><button onClick={() => navigate(1)}><ChevronRight size={19}/></button></div><div className="topbar-search" onClick={() => navigate('/search')}><Search size={17}/><span>Buscar en Sonora</span><kbd>⌘ K</kbd></div></header><AnimatePresence mode="wait"><motion.div key={location.pathname} initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: .18 }}><Routes><Route path="/" element={<HomePage/>}/><Route path="/search" element={<SearchPage/>}/><Route path="/library" element={<PlaceholderPage title="Biblioteca" icon={Library}/>}/><Route path="/favorites" element={<PlaceholderPage title="Favoritos" icon={Heart}/>}/><Route path="*" element={<HomePage/>}/></Routes></motion.div></AnimatePresence></main><Player/></div> }

export default function App() { return <Shell/> }
