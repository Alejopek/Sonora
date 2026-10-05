# Sonora

Demo técnica de un reproductor musical con interfaz propia. El cliente React consume únicamente una API FastAPI; el backend consulta el catálogo de YouTube Music con `ytmusicapi` y resuelve audio con `yt-dlp`. La reproducción se realiza con un elemento HTML `<audio>`, sin iframe de YouTube.

## Requisitos

- Node.js 20+
- Python 3.11+
- `ffmpeg` recomendado por `yt-dlp`

## Instalación

En una terminal, instalá y ejecutá el backend:

```bash
cd backend
python -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
.venv/bin/uvicorn app.main:app --reload --port 8000
```

Los comandos anteriores funcionan en Bash, Zsh y Fish sin activar el entorno. Si preferís activarlo, usá `source .venv/bin/activate` en Bash/Zsh o `source .venv/bin/activate.fish` en Fish. Nunca ejecutes `pip` o `uvicorn` globales: en Arch Linux están protegidos por PEP 668 y no contienen las dependencias del proyecto.

En otra terminal, instalá y ejecutá el frontend:

```bash
cd frontend
npm install
npm run dev
```

Abrí `http://localhost:5173`.

## Variables de entorno

En `backend/.env`:

```env
# Opcional. Ruta a headers autenticados exportados por ytmusicapi.
YTMUSIC_AUTH=
FRONTEND_ORIGIN=http://localhost:5173

# Opcional. Contenido o ruta de cookies en formato Netscape para evitar bloqueos de YouTube en cloud/Vercel.
YOUTUBE_COOKIES=
# YOUTUBE_COOKIES_FILE=/path/to/cookies.txt
# HTTPS_PROXY=http://user:pass@proxy:port
```

Las búsquedas públicas suelen funcionar sin autenticación. Para resultados personalizados o mayor estabilidad, seguí la guía de autenticación de `ytmusicapi` y colocá la ruta del archivo generado en `YTMUSIC_AUTH`. En despliegues como Vercel donde YouTube bloquea peticiones de audio, definí `YOUTUBE_COOKIES` con el contenido del archivo `cookies.txt` de YouTube. No publiques este contenido ni lo copies al frontend.

Opcionalmente se puede definir `VITE_API_URL` en `frontend/.env` si la API no se ejecuta en `http://localhost:8000/api`.

### Despliegue con Docker y Túnel

Las cuentas usan JWT y PostgreSQL; las playlists, favoritos e historial se guardan por usuario. Copiá `.env.example` a `.env`, reemplazá `JWT_SECRET` por un valor largo y aleatorio, y levantá todo con:

```bash
docker compose up -d --build
```

Compose inicia:
- **Sonora** (backend FastAPI sirviendo el frontend React compilado).
- **PostgreSQL 16** con volumen persistente `postgres_data` y healthcheck.
- **Cloudflare Tunnel** (`sonora-tunnel`) para acceso público seguro temporal.
- **Tunnel Watcher** (`sonora-tunnel-watcher`) que sincroniza automáticamente cualquier cambio de URL en Uptime Kuma, en la sección Website del repositorio de GitHub y mediante notificaciones a Telegram.

Las variables disponibles en `.env` son `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `JWT_SECRET`, `JWT_EXPIRES_HOURS`, `SONORA_PORT`, `UPTIME_KUMA_DATA_DIR`, `GITHUB_REPO`, `GITHUB_TOKEN`, `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID`.

Al iniciar sesión, Sonora importa una vez los favoritos e historial ya almacenados localmente y después los sincroniza con la cuenta. Las playlists que se crean desde Biblioteca/Favoritos se guardan en el almacenamiento local del navegador (también en producción), mientras que las playlists de cuenta requieren iniciar sesión. La biblioteca reúne canciones favoritas, escuchadas recientemente y canciones agregadas a playlists. La reproducción continúa usando el elemento HTML `<audio>` y `/api/stream`.

## Arquitectura

```text
frontend/      React + TypeScript + Vite
  src/App.tsx  layout general y rutas
  src/components/ navegación, filas de canciones y controles del reproductor
  src/pages/  inicio, búsqueda y páginas de biblioteca/favoritos
  src/lib/    datos locales y formato compartido de duración
  src/stores/  Zustand: cola, progreso, volumen y preferencias persistidas
  src/services API client
backend/       FastAPI
  app/routes/  endpoints públicos de catálogo/stream
  app/services adaptador ytmusicapi
  app/schemas  contratos Pydantic
```

La API disponible es:

- `GET /api/search?q=` — canciones, artistas, álbumes y playlists normalizados.
- `GET /api/songs/{video_id}` — metadata de una canción.
- `GET /api/stream/{video_id}` — URL temporal de audio resuelta por `yt-dlp`.
- `GET /api/artists/{artist_id}` — detalle normalizado de artista.
- `GET /api/albums/{album_id}` — detalle y tracks de álbum.
- `GET /api/playlists/{playlist_id}` — detalle y tracks de playlist.

## Verificación

```bash
cd frontend
npm test
npm run build
npm run lint
```

## Nota sobre streaming

YouTube puede modificar sus formatos y restricciones. La ruta de streaming no guarda ni redistribuye audio: resuelve una URL temporal en el momento de reproducir y usa `yt-dlp` actualizado como fallback cuando los formatos de `ytmusicapi` llevan firma cifrada. Para usos que excedan una demo técnica, revisá los términos de YouTube y los derechos del contenido.

## Contribución asistida

Las instrucciones de contexto, convenciones y verificación para agentes de código/LLMs están en [AGENTS.md](AGENTS.md). No se versionan tokens, cookies, archivos `.env` ni entornos virtuales.
