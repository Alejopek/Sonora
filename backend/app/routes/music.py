import subprocess
import sys
import logging
import json
import re
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse
from app.schemas.music import SearchResponse, Track
from app.services.youtube import search, song, stream_url
from app.services.youtube import client

router = APIRouter(prefix='/api', tags=['music'])
logger = logging.getLogger(__name__)

def _lrc_lines(value: str) -> list[dict]:
    lines = []
    for raw_line in value.splitlines():
        match = re.match(r'^\[(\d+):(\d{2})(?:\.(\d{1,3}))?\](.*)$', raw_line.strip())
        if not match:
            continue
        minutes, seconds, fraction, text = match.groups()
        milliseconds = (int(minutes) * 60 + int(seconds)) * 1000
        if fraction:
            milliseconds += int(fraction.ljust(3, '0'))
        text = text.strip()
        if text:
            lines.append({'text': text, 'startTime': milliseconds})
    return lines

def _lrclib_lyrics(title: str, artist: str, album: str = '', duration: int | None = None):
    params = {'track_name': title, 'artist_name': artist}
    if album: params['album_name'] = album
    if duration: params['duration'] = str(duration)
    request = Request(f"https://lrclib.net/api/get?{urlencode(params)}", headers={'User-Agent': 'Sonora/0.1 (music player lyrics)'})
    try:
        with urlopen(request, timeout=8) as response:
            item = json.loads(response.read())
    except HTTPError as exc:
        if exc.code != 404: raise
        query = urlencode({'track_name': title, 'artist_name': artist})
        request = Request(f'https://lrclib.net/api/search?{query}', headers={'User-Agent': 'Sonora/0.1 (music player lyrics)'})
        with urlopen(request, timeout=8) as response:
            matches = json.loads(response.read())
        item = next((match for match in matches if match.get('syncedLyrics') or match.get('plainLyrics')), None)
        if not item: return None
    synced = item.get('syncedLyrics') or ''
    lines = _lrc_lines(synced)
    if not lines:
        plain = item.get('plainLyrics') or ''
        lines = [{'text': line.strip(), 'startTime': None} for line in plain.splitlines() if line.strip()]
    if item.get('instrumental'):
        return {'lyrics': [], 'source': 'LRCLIB', 'instrumental': True}
    return {'lyrics': lines, 'source': 'LRCLIB', 'instrumental': False} if lines else None

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

@router.get('/songs/{video_id}/lyrics')
def lyrics_endpoint(video_id: str, title: str = Query(default='', max_length=200), artist: str = Query(default='', max_length=200), album: str = Query(default='', max_length=200), duration: int | None = Query(default=None, ge=1, le=3600)):
    if not video_id.replace('-', '').replace('_', '').isalnum(): raise HTTPException(400, 'Identificador inválido.')
    if title and artist:
        try:
            result = _lrclib_lyrics(title, artist, album, duration)
            if result: return result
        except (URLError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
            logger.warning('LRCLIB no respondió para %s: %s', video_id, exc)
    try:
        music = client()
        browse_id = music.get_watch_playlist(videoId=video_id, limit=1).get('lyrics')
        if not browse_id: return {'lyrics': [], 'source': None}
        try:
            result = music.get_lyrics(browse_id, timestamps=True)
        except Exception:
            # Timed lyrics use a separate mobile client path; fall back to the
            # regular endpoint so plain lyrics remain available.
            logger.exception('No se pudieron cargar letras sincronizadas para %s', video_id)
            result = music.get_lyrics(browse_id)
        if not result: return {'lyrics': [], 'source': None}
        lines = result.get('lyrics') or []
        if isinstance(lines, str):
            lines = [{'text': line.strip(), 'startTime': None} for line in lines.splitlines() if line.strip()]
        else:
            lines = [{'text': line.text, 'startTime': line.start_time} for line in lines if line.text.strip()]
        return {'lyrics': lines, 'source': result.get('source')}
    except Exception as exc:
        logger.exception('No se pudieron cargar letras para %s', video_id)
        # Missing lyrics are common for instrumental game and ambient tracks;
        # return an empty result so the player can show that state cleanly.
        return {'lyrics': [], 'source': None, 'instrumental': False}

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
