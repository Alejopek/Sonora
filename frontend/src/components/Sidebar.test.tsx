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

    // NO debe mostrar un control adicional ni el texto en modo colapsado.
    expect(html).not.toContain('account-trigger-copy')
    expect(html).not.toContain('Tu música, en cualquier lugar')
  })

  it('en modo expandido (no compact) convierte toda la tarjeta de cuenta en un único disparador', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <Sidebar compact={false} onCompact={() => {}} />
      </MemoryRouter>
    )

    // La tarjeta completa contiene el avatar y es el único control de la cuenta.
    expect(html).toContain('account-trigger')
    expect(html).toContain('mo-eyes')

    // Muestra detalles de cuenta
    expect(html).toContain('Invitado')
    expect(html).toContain('Tu música, en cualquier lugar')

    // El antiguo control aislado no aparece en el marcado.
    expect(html).not.toContain('account-action')
    expect(html).toContain('aria-label="Iniciar sesión"')
  })
})
