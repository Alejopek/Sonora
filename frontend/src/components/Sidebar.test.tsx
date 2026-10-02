import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { Sidebar } from './Sidebar'

describe('Sidebar', () => {
  it('en modo colapsado (compact) solo muestra la imagen/icono en la sección de cuenta', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <Sidebar compact={true} onCompact={() => {}} />
      </MemoryRouter>
    )

    // La barra lateral tiene la clase compact
    expect(html).toContain('sidebar compact')

    // Contiene el botón con el avatar generado por blobatar
    expect(html).toContain('avatar-btn')
    expect(html).toContain('mo-eyes')

    // NO debe mostrar el botón de acción de cuenta (account-action) ni el texto en modo colapsado
    expect(html).not.toContain('account-action')
    expect(html).not.toContain('Tu música, en cualquier lugar')
  })

  it('en modo expandido (no compact) muestra el avatar, detalles y el botón de acción', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <Sidebar compact={false} onCompact={() => {}} />
      </MemoryRouter>
    )

    // Muestra el avatar con blobatar
    expect(html).toContain('avatar-btn')
    expect(html).toContain('mo-eyes')

    // Muestra detalles de cuenta
    expect(html).toContain('Invitado')
    expect(html).toContain('Tu música, en cualquier lugar')

    // Muestra el botón de acción de cuenta
    expect(html).toContain('account-action')
  })
})
