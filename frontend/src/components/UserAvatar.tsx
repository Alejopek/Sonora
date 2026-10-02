import { Blobatar } from '@blobatar/react'
import { useGaze } from '@blobatar/react/gaze'
import 'blobatar/motion.css'
import 'blobatar/gaze.css'

export interface UserAvatarProps {
  name?: string | null
  size?: number
  className?: string
  title?: string
  followCursor?: boolean
}

export function UserAvatar({
  name,
  size = 40,
  className = 'avatar',
  title,
  followCursor = true,
}: UserAvatarProps) {
  const seed = name?.trim() || 'Invitado'
  const { ref } = useGaze({ travel: 4, lookAt: followCursor ? 'pointer' : null })

  return (
    <span
      className={className}
      style={{ width: size, height: size }}
      title={title ?? seed}
    >
      {followCursor ? (
        <Blobatar ref={ref} name={seed} size={size} animate="always" />
      ) : (
        <Blobatar name={seed} size={size} />
      )}
    </span>
  )
}
