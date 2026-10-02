import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { UserAvatar } from './UserAvatar'

describe('UserAvatar', () => {
  it('genera un avatar con blobatar animado que sigue el cursor por defecto', () => {
    const html = renderToStaticMarkup(<UserAvatar name="Alejandro" size={40} />)
    expect(html).toContain('class="avatar"')
    expect(html).toContain('title="Alejandro"')
    expect(html).toContain('mo-eyes')
    expect(html).toContain('width="40"')
  })

  it('usa "Invitado" por defecto cuando no se provee nombre', () => {
    const html = renderToStaticMarkup(<UserAvatar name={null} size={40} />)
    expect(html).toContain('title="Invitado"')
    expect(html).toContain('mo-eyes')
  })

  it('aplica el tamaño especificado en el estilo y tamaño del blobatar', () => {
    const html = renderToStaticMarkup(<UserAvatar name="Usuario" size={48} />)
    expect(html).toContain('width:48px')
    expect(html).toContain('height:48px')
  })

  it('permite renderizar versión estática cuando followCursor es falso', () => {
    const html = renderToStaticMarkup(<UserAvatar name="Usuario" size={40} followCursor={false} />)
    expect(html).toContain('data:image/svg+xml')
    expect(html).not.toContain('mo-eyes')
  })
})
