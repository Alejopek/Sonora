import { artworkUrl } from '../services/api'

export type CoverPalette = { accent: string; rgb: string }

export const defaultCoverPalette: CoverPalette = { accent: '#c9f27a', rgb: '201 242 122' }

export function readCoverPalette(src: string): Promise<CoverPalette | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (!context) return resolve(null)
        canvas.width = 32
        canvas.height = 32
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
        const colors = new Map<string, { r: number; g: number; b: number; score: number }>()

        for (let i = 0; i < pixels.length; i += 16) {
          const r = pixels[i]
          const g = pixels[i + 1]
          const b = pixels[i + 2]
          const alpha = pixels[i + 3]
          if (alpha < 180) continue
          const high = Math.max(r, g, b)
          const low = Math.min(r, g, b)
          const saturation = high === 0 ? 0 : (high - low) / high
          const lightness = (high + low) / 2
          if (saturation < .22 || lightness < 24 || lightness > 238) continue
          const qr = Math.round(r / 24) * 24
          const qg = Math.round(g / 24) * 24
          const qb = Math.round(b / 24) * 24
          const key = `${qr},${qg},${qb}`
          const color = colors.get(key) ?? { r: qr, g: qg, b: qb, score: 0 }
          color.score += saturation * (1 - Math.abs(lightness - 132) / 180)
          colors.set(key, color)
        }

        const dominant = [...colors.values()].sort((a, b) => b.score - a.score)[0]
        if (!dominant) return resolve(null)
        const r = Math.max(0, Math.min(255, Math.round(dominant.r * .76 + 255 * .24)))
        const g = Math.max(0, Math.min(255, Math.round(dominant.g * .76 + 255 * .24)))
        const b = Math.max(0, Math.min(255, Math.round(dominant.b * .76 + 255 * .24)))
        resolve({ accent: `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`, rgb: `${r} ${g} ${b}` })
      } catch {
        resolve(null)
      }
    }
    image.onerror = () => resolve(null)
    image.src = artworkUrl(src)
  })
}
