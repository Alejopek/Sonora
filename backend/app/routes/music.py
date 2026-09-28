import subprocess
import sys
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse
from app.schemas.music import SearchResponse, Track
from app.services.youtube import search, song, stream_url
from app.services.youtube import client

router = APIRouter(prefix='/api', tags=['music'])

@router.get('/search', response_model=SearchResponse)
def search_endpoint(q: str = Query(min_length=2, max_length=120)):
    try:
        songs, artists, albums, playlists = search(q)
        return SearchResponse(songs=songs, artists=artists, albums=albums, playlists=playlists)
    except Exception as exc:
        raise HTTPException(502, 'YouTube Music no respondió correctamente.') from exc

@router.get('/songs/{video_id}', response_model=Track)
def song_endpoint(video_id: str):
    if not video_id.replace('-', '').replace('_', '').isalnum(): raise HTTPException(400, 'Identificador inválido.')
    try: return song(video_id)
    except Exception as exc: raise HTTPException(404, 'Canción no encontrada.') from exc

@router.get('/stream/{video_id}')
def stream_endpoint(video_id: str):
    if not video_id.replace('-', '').replace('_', '').isalnum(): raise HTTPException(400, 'Identificador inválido.')
    try:
        return RedirectResponse(stream_url(video_id), status_code=307)
    except Exception:
        # ytmusicapi's signed URLs are preferred; yt-dlp remains a fallback for
        # videos whose adaptive format data is not exposed.
        pass
    try:
        result = subprocess.run([sys.executable, '-m', 'yt_dlp', '--no-playlist', '--format', 'bestaudio[ext=m4a]/bestaudio', '--get-url', f'https://music.youtube.com/watch?v={video_id}'], capture_output=True, text=True, timeout=25, check=True)
        url = result.stdout.strip().splitlines()[0]
        return RedirectResponse(url, status_code=307)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError, IndexError) as exc:
        raise HTTPException(502, 'No se pudo preparar el stream de audio.') from exc

@router.get('/artists/{artist_id}')
def artist_endpoint(artist_id: str):
    try:
        data = client().get_artist(artist_id)
        return {'id': artist_id, 'name': data.get('name', ''), 'description': data.get('description', ''), 'thumbnails': data.get('thumbnails', []), 'songs': data.get('songs', {}).get('results', [])}
    except Exception as exc: raise HTTPException(404, 'Artista no encontrado.') from exc

@router.get('/albums/{album_id}')
def album_endpoint(album_id: str):
    try:
        data = client().get_album(album_id)
        return {'id': album_id, 'title': data.get('title', ''), 'artists': data.get('artists', []), 'thumbnails': data.get('thumbnails', []), 'tracks': data.get('tracks', [])}
    except Exception as exc: raise HTTPException(404, 'Álbum no encontrado.') from exc

@router.get('/playlists/{playlist_id}')
def playlist_endpoint(playlist_id: str):
    try:
        data = client().get_playlist(playlist_id)
        return {'id': playlist_id, 'title': data.get('title', ''), 'author': data.get('author', ''), 'thumbnails': data.get('thumbnails', []), 'tracks': data.get('tracks', [])}
    except Exception as exc: raise HTTPException(404, 'Playlist no encontrada.') from exc
