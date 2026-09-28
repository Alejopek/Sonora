# Sonora — guía para agentes y LLMs

Este archivo es la fuente de contexto operativo del repositorio. Leerlo antes de modificar código.

## Propósito y límites

Sonora es una demo técnica de reproductor musical. El frontend tiene interfaz propia y reproduce con un elemento HTML `<audio>`; no se permite incorporar iframes del reproductor de YouTube ni llamadas directas de YouTube desde el navegador. Todo catálogo y streaming pasa por FastAPI.

No agregar autenticación, una base de datos ni una arquitectura distribuida sin una necesidad explícita. Favoritos, historial, cola, volumen y preferencias son locales y viven en Zustand/localStorage.

## Estructura

```text
frontend/  React 19 + TypeScript + Vite
backend/   FastAPI + ytmusicapi + yt-dlp
```

- `frontend/src/App.tsx`: layout de la aplicación y configuración de rutas en `Shell`.
- `frontend/src/components/`: componentes reutilizables de navegación, canciones y reproductor (`Sidebar`, `SongRow`, `Section`, `Player`, `Queue`, `FullPlayer`).
- `frontend/src/pages/`: páginas de inicio, búsqueda y estados vacíos.
- `frontend/src/lib/format.ts`: formato de duración compartido por los reproductores.
- `frontend/src/lib/data.ts`: selecciones locales usadas en Inicio.
- `frontend/src/stores/player-store.ts`: fuente de verdad global del reproductor.
- `frontend/src/services/api.ts`: único lugar para llamadas HTTP del cliente.
- `backend/app/routes/music.py`: contratos HTTP y resolución de streaming.
- `backend/app/services/youtube.py`: normalización de respuestas de YouTube Music.

## Comandos correctos

No asumir el shell del usuario. Estos comandos no requieren activar la virtualenv y funcionan en Bash, Zsh y Fish:

```bash
cd backend
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload --port 8000
```

```bash
cd frontend
npm install
npm run dev
npm test
npm run build
npm run lint
```

En Fish, `source .venv/bin/activate` es incorrecto; usar `source .venv/bin/activate.fish` o los ejecutables `.venv/bin/...` de arriba.

## Integración de YouTube Music

- Usar consultas filtradas (`songs`, `artists`, `albums`, `playlists`) en `ytmusicapi`. Las consultas sin filtro pueden fallar al parsear el resultado destacado de YouTube.
- Priorizar `get_song()` para metadata. Los formatos de audio pueden venir con `signatureCipher` en vez de una URL directa.
- Para streaming, la ruta prueba los formatos expuestos y utiliza `python -m yt_dlp` como fallback. No invocar `yt-dlp` desde el PATH global: el backend puede ejecutarse sin activar la virtualenv.
- Los cambios de YouTube son habituales. Ante un 5xx, conservar el mensaje/log de la excepción y validar primero con `.venv/bin/python -m yt_dlp ...` antes de cambiar el frontend.

## Convenciones de frontend

- Mantener dark mode, paleta centralizada en `styles.css`, contraste alto y animaciones cortas.
- Usar Lucide para iconos; nunca emojis/Unicode como iconografía de controles.
- No introducir una librería de componentes o estilos nueva sin justificar el coste.
- Los cambios de reproducción deben actualizar el store; no crear estado de reproductor por página.
- Mantener el diseño responsive: sidebar oculta en móvil, player compacto y cola/pantalla completa accesibles.

## Antes de entregar cambios

1. No incluir `.env`, `.venv`, `node_modules`, `dist`, cookies o credenciales.
2. Ejecutar `npm test`, `npm run build` y `npm run lint` en `frontend/`.
3. Ejecutar `python -m compileall -q app` desde `backend/`.
4. Actualizar README si cambian comandos, variables, endpoints o arquitectura.
