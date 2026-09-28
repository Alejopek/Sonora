import type { SyntheticEvent } from 'react'

type CoverImageProps = {
  src: string
  alt: string
  className?: string
}

const placeholderSrc = '/cover-placeholder.svg'

export function CoverImage({ src, alt, className }: CoverImageProps) {
  const handleError = (event: SyntheticEvent<HTMLImageElement>) => {
    if (event.currentTarget.getAttribute('src') === placeholderSrc) return
    event.currentTarget.src = placeholderSrc
  }

  return <img src={src} alt={alt} className={className} onError={handleError} />
}
