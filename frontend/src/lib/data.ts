import type { Track } from '../types/music'

export const picks: Track[] = [
  { id: 'fHI8X4OXluQ', title: 'Nights', artist: 'Frank Ocean', album: 'Blonde', thumbnail: 'https://i.ytimg.com/vi/fHI8X4OXluQ/hqdefault.jpg', duration: '5:07' },
  { id: '5qap5aO4i9A', title: 'Snowfall', artist: 'Øneheart', album: 'Snowfall', thumbnail: 'https://i.ytimg.com/vi/5qap5aO4i9A/hqdefault.jpg', duration: '3:18' },
  { id: 'J_ub7Etch2U', title: 'After Dark', artist: 'Mr.Kitty', album: 'Time', thumbnail: 'https://i.ytimg.com/vi/J_ub7Etch2U/hqdefault.jpg', duration: '4:17' },
  { id: 'mWRsgZuwf_8', title: 'Electric Feel', artist: 'MGMT', album: 'Oracular Spectacular', thumbnail: 'https://i.ytimg.com/vi/mWRsgZuwf_8/hqdefault.jpg', duration: '3:49' },
  { id: '2Vv-BfVoq4g', title: 'Perfect', artist: 'Ed Sheeran', album: '÷', thumbnail: 'https://i.ytimg.com/vi/2Vv-BfVoq4g/hqdefault.jpg', duration: '4:23' },
  { id: '4NRXx6U8ABQ', title: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', thumbnail: 'https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg', duration: '3:20' },
  { id: 'kJQP7kiw5Fk', title: 'Despacito', artist: 'Luis Fonsi ft. Daddy Yankee', album: 'Vida', thumbnail: 'https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg', duration: '3:48' },
  { id: 'hT_nvWreIhg', title: 'Counting Stars', artist: 'OneRepublic', album: 'Native', thumbnail: 'https://i.ytimg.com/vi/hT_nvWreIhg/hqdefault.jpg', duration: '4:17' },
  { id: '0VwLg6eT1zM', title: 'Sweater Weather', artist: 'The Neighbourhood', album: 'I Love You.', thumbnail: 'https://i.ytimg.com/vi/0VwLg6eT1zM/hqdefault.jpg', duration: '4:00' },
  { id: 'JGwWNGJdvx8', title: 'Shape of You', artist: 'Ed Sheeran', album: '÷', thumbnail: 'https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg', duration: '3:53' }
]

export const moodCategories = [
  { id: 'all', label: 'Todo' },
  { id: 'focus', label: 'Para concentrarse', icon: 'Sparkles' },
  { id: 'relax', label: 'Chill & Relax', icon: 'Coffee' },
  { id: 'energy', label: 'Energía', icon: 'Flame' },
  { id: 'night', label: 'Noche', icon: 'Moon' }
]

export const mixCards = [
  {
    id: 'mix-1',
    title: 'Daily Mix 1',
    description: 'Frank Ocean, The Weeknd, Daniel Caesar y más.',
    gradient: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)',
    tag: 'MIX DIARIO',
    tracks: picks.slice(0, 5)
  },
  {
    id: 'mix-2',
    title: 'Chill Lo-Fi & Ambient',
    description: 'Øneheart, Mr.Kitty, Reidenshi y melodías para desconectar.',
    gradient: 'linear-gradient(135deg, #312e81 0%, #1e1b4b 100%)',
    tag: 'RELAX',
    tracks: [picks[1], picks[2], picks[0], picks[8]]
  },
  {
    id: 'mix-3',
    title: 'Vibras de Fin de Semana',
    description: 'MGMT, Ed Sheeran, The Weeknd y clásicos pop & indie.',
    gradient: 'linear-gradient(135deg, #065f46 0%, #022c22 100%)',
    tag: 'BUENAS VIBRAS',
    tracks: [picks[3], picks[4], picks[5], picks[7]]
  },
  {
    id: 'mix-4',
    title: 'Nocturno & Synthwave',
    description: 'Bajos envolventes y sintetizadores para la noche.',
    gradient: 'linear-gradient(135deg, #581c87 0%, #2e1065 100%)',
    tag: 'NOCHE',
    tracks: [picks[2], picks[8], picks[5], picks[0]]
  }
]
