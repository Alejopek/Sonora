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
.venv/bin/alembic upgrade head
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

# Opcional. Enriquece etiquetas de artistas para recomendaciones. Nunca llega al frontend.
LASTFM_API_KEY=
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

Al iniciar sesión, Sonora importa una vez los favoritos e historial ya almacenados localmente y después los sincroniza con la cuenta. La reproducción continúa usando el elemento HTML `<audio>` y `/api/stream`. Antes de iniciar la aplicación, la imagen ejecuta automáticamente `alembic upgrade head`, por lo que los cambios de esquema se aplican de forma reproducible sin borrar el volumen de PostgreSQL.

## Recomendaciones y estadísticas

La navegación incluye **Para vos** y **Estadísticas**. El mix diario se guarda por usuario y fecha (32 canciones cuando las fuentes devuelven candidatos), así no cambia al recargar; se renueva al menos cada 12 horas al consultarlo o mediante el botón discreto de actualización, con cooldown de cinco minutos por cuenta. Inicio usa ese mismo mix para Quick picks y selecciones personalizadas. Al elegir un resultado de búsqueda, la reproducción comienza enseguida y una cola breve se genera usando esa canción como semilla junto con las afinidades de la cuenta, nunca con los otros resultados de búsqueda. YouTube Music se usa solo en el backend para radios con `get_watch_playlist(..., radio=True)` y búsquedas de canciones filtradas; el orden se decide localmente con afinidad por canción, artista y género, recencia, favoritos, saltos tempranos y reglas de diversidad.

La app conserva sesiones detalladas de escucha por 180 días y agrega tiempo, reproducciones, completados y saltos en tablas históricas. El tiempo escuchado procede del progreso real del elemento de audio. Los agregados permiten conservar estadísticas de todo el tiempo sin crecimiento ilimitado de eventos. Las migraciones e índices están en `backend/migrations/`.

Last.fm es estrictamente opcional: definí `LASTFM_API_KEY` en el `.env` del servidor si querés enriquecer etiquetas de artistas cuando estén disponibles. No es necesaria para que recomendaciones, mix, cola ni estadísticas funcionen, y la clave no se devuelve ni se registra.

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

- `GET /api/search?q=&filter=all|songs|albums` — búsqueda mixta o filtrada de canciones y álbumes.
- `GET /api/songs/{video_id}` — metadata de una canción.
- `GET /api/stream/{video_id}` — URL temporal de audio resuelta por `yt-dlp`.
- `GET /api/artists/{artist_id}` — detalle normalizado de artista.
- `GET /api/albums/{album_id}` — detalle y tracks de álbum.
- `GET /api/recommendations/albums` — discos sugeridos a partir de afinidades de escucha y discos favoritos.
- `GET /api/favorites/albums` y `POST /api/favorites/albums/toggle` — consulta y cambio de discos favoritos autenticados.
- `GET /api/playlists/{playlist_id}` — detalle y tracks de playlist.
- `GET /api/recommendations` y `/api/recommendations/queue` — mix diario persistente y cola personalizada.
- `POST /api/recommendations/queue` — cola personalizada tomando la pista seleccionada como semilla.
- `POST /api/recommendations/refresh` — regenera el mix diario con las señales actuales de la cuenta.
- `POST /api/listening/events` — señales de inicio, progreso, completo y salto desde el reproductor autenticado.
- `GET /api/statistics?range=today|7d|30d|all|custom` — agregados de escucha y rankings por período.

## Verificación

```bash
cd frontend
npm test
npm run build
npm run lint

cd ../backend
.venv/bin/python -m unittest discover -s tests
.venv/bin/python -m compileall -q app
```

## Nota sobre streaming

YouTube puede modificar sus formatos y restricciones. La ruta de streaming no guarda ni redistribuye audio: resuelve una URL temporal en el momento de reproducir y usa `yt-dlp` actualizado como fallback cuando los formatos de `ytmusicapi` llevan firma cifrada. Para usos que excedan una demo técnica, revisá los términos de YouTube y los derechos del contenido.

## Contribución asistida

Las instrucciones de contexto, convenciones y verificación para agentes de código/LLMs están en [AGENTS.md](AGENTS.md). No se versionan tokens, cookies, archivos `.env` ni entornos virtuales.
