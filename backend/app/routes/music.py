import os
import subprocess
import sys
import tempfile
import logging
import json
import re
from pathlib import Path
from typing import Literal
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse, Response
from app.schemas.music import SearchResponse, Track
from app.services.youtube import search, song, stream_url, track
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

def _is_artwork_host(hostname: str) -> bool:
    hostname = hostname.lower().rstrip('.')
    return any(hostname == domain or hostname.endswith(f'.{domain}') for domain in ('googleusercontent.com', 'ytimg.com', 'ggpht.com'))

@router.get('/search', response_model=SearchResponse)
def search_endpoint(q: str = Query(min_length=2, max_length=120), filter: Literal['all', 'songs', 'albums'] = Query(default='all')):
    try:
        songs, artists, albums, playlists = search(q, filter)
        return SearchResponse(songs=songs, artists=artists, albums=albums, playlists=playlists)
    except Exception as exc:
        raise HTTPException(502, 'YouTube Music no respondió correctamente.') from exc

@router.get('/songs/{video_id}', response_model=Track)
def song_endpoint(video_id: str):
    if not video_id.replace('-', '').replace('_', '').isalnum(): raise HTTPException(400, 'Identificador inválido.')
    try: return song(video_id)
    except Exception as exc: raise HTTPException(404, 'Canción no encontrada.') from exc

@router.get('/artwork')
def artwork_endpoint(url: str = Query(min_length=1, max_length=2048)):
    parsed = urlparse(url)
    if parsed.scheme != 'https' or not parsed.hostname or not _is_artwork_host(parsed.hostname):
        raise HTTPException(400, 'Origen de portada no permitido.')
    request = Request(url, headers={'User-Agent': 'Sonora/0.1 artwork palette'})
    try:
        with urlopen(request, timeout=8) as remote:
            final_url = urlparse(remote.geturl())
            content_type = remote.headers.get_content_type()
            if final_url.scheme != 'https' or not final_url.hostname or not _is_artwork_host(final_url.hostname) or not content_type.startswith('image/'):
                raise HTTPException(502, 'La portada no es válida.')
            content = remote.read(5 * 1024 * 1024 + 1)
            if len(content) > 5 * 1024 * 1024:
                raise HTTPException(413, 'La portada es demasiado grande.')
        return Response(content=content, media_type=content_type, headers={'Cache-Control': 'public, max-age=86400'})
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception('No se pudo cargar la portada para extraer su paleta')
        raise HTTPException(502, 'No se pudo cargar la portada.') from exc

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

@router.api_route('/stream/{video_id}', methods=['GET', 'HEAD'])
def stream_endpoint(video_id: str, container: Literal['auto', 'mp4', 'webm'] = Query(default='auto')):
    if not video_id.replace('-', '').replace('_', '').isalnum(): raise HTTPException(400, 'Identificador inválido.')
    try:
        return RedirectResponse(stream_url(video_id, container), status_code=307)
    except Exception:
        # ytmusicapi's signed URLs are preferred; yt-dlp remains a fallback for
        # videos whose adaptive format data is not exposed.
        logger.exception('No se pudo resolver el stream directo para %s; se prueba yt-dlp', video_id)
    temp_cookie_path = None
    try:
        cmd = [
            sys.executable, '-m', 'yt_dlp',
            '--no-playlist',
            '--extractor-args', 'youtube:player_client=android;player_skip=webpage,configs,js',
            '--format', 'bestaudio/best'
        ]
        
        cookie_file = os.getenv('YOUTUBE_COOKIES_FILE')
        cookies_content = os.getenv('YOUTUBE_COOKIES')
        
        if cookies_content and not cookie_file:
            # Write cookies to a temporary file for yt-dlp to read
            temp = tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt')
            temp.write(cookies_content)
            temp.close()
            temp_cookie_path = temp.name
            cookie_file = temp_cookie_path
            
        if cookie_file and Path(cookie_file).exists():
            cmd.extend(['--cookies', cookie_file])

        proxy = os.getenv('HTTPS_PROXY') or os.getenv('HTTP_PROXY')
        if proxy:
            cmd.extend(['--proxy', proxy])

        cmd.extend(['--get-url', f'https://music.youtube.com/watch?v={video_id}'])
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=25, check=False)
        if result.returncode == 0 and result.stdout.strip():
            url = result.stdout.strip().splitlines()[0]
            return RedirectResponse(url, status_code=307)

        # If it failed and we had cookies attached, try once more without cookies
        # (invalid/rotated cookies often cause YouTube to abort even when anonymous requests work)
        if cookie_file:
            logger.warning('yt-dlp falló con cookies para %s; reintentando sin cookies: %s', video_id, (result.stderr or '').strip())
            fallback_cmd = [
                sys.executable, '-m', 'yt_dlp',
                '--no-playlist',
                '--extractor-args', 'youtube:player_client=android;player_skip=webpage,configs,js',
                '--format', 'bestaudio/best'
            ]
            if proxy:
                fallback_cmd.extend(['--proxy', proxy])
            fallback_cmd.extend(['--get-url', f'https://music.youtube.com/watch?v={video_id}'])
            fb_res = subprocess.run(fallback_cmd, capture_output=True, text=True, timeout=25, check=False)
            if fb_res.returncode == 0 and fb_res.stdout.strip():
                url = fb_res.stdout.strip().splitlines()[0]
                return RedirectResponse(url, status_code=307)
            logger.error('yt-dlp falló también sin cookies para %s: %s', video_id, (fb_res.stderr or '').strip())
        else:
            logger.error('yt-dlp falló para %s: %s', video_id, (result.stderr or '').strip())

        raise HTTPException(502, 'No se pudo preparar el stream de audio.')
    except (subprocess.TimeoutExpired, FileNotFoundError, IndexError) as exc:
        raise HTTPException(502, 'No se pudo preparar el stream de audio.') from exc
    finally:
        if temp_cookie_path and os.path.exists(temp_cookie_path):
            try:
                os.remove(temp_cookie_path)
            except OSError:
                pass

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
        artists = data.get('artists') or []
        artist = ', '.join(item.get('name', '') for item in artists)
        album_title = data.get('title', '')
        tracks = []
        for raw in data.get('tracks') or []:
            if not raw.get('videoId'):
                continue
            item = track(raw)
            tracks.append(item.model_copy(update={'album': album_title, 'album_id': album_id, 'artist': item.artist if item.artist != 'Artista desconocido' else artist}))
        return {'id': album_id, 'title': album_title, 'artist': artist, 'thumbnail': (data.get('thumbnails') or [{}])[-1].get('url', ''), 'year': str(data.get('year') or '') or None, 'type': data.get('type'), 'tracks': tracks}
    except Exception as exc:
        logger.exception('No se pudo cargar el álbum %s', album_id)
        raise HTTPException(404, 'Álbum no encontrado.') from exc

@router.get('/playlists/{playlist_id}')
def playlist_endpoint(playlist_id: str):
    try:
        data = client().get_playlist(playlist_id)
        return {'id': playlist_id, 'title': data.get('title', ''), 'author': data.get('author', ''), 'thumbnails': data.get('thumbnails', []), 'tracks': data.get('tracks', [])}
    except Exception as exc: raise HTTPException(404, 'Playlist no encontrada.') from exc

@router.get('/debug/stream/{video_id}')
def debug_stream(video_id: str):
    """Temporary diagnostic endpoint — remove after debugging."""
    info: dict = {'video_id': video_id, 'cookies_env_set': bool(os.getenv('YOUTUBE_COOKIES')), 'cookies_env_length': len(os.getenv('YOUTUBE_COOKIES', '')), 'cookies_file_env': os.getenv('YOUTUBE_COOKIES_FILE', '(not set)'), 'proxy_env': os.getenv('HTTPS_PROXY', os.getenv('HTTP_PROXY', '(not set)'))}
    # Test ytmusicapi first
    try:
        url = stream_url(video_id, 'auto')
        info['ytmusicapi'] = {'status': 'ok', 'url_preview': url[:120] if url else None}
        return info
    except Exception as exc:
        info['ytmusicapi'] = {'status': 'error', 'error': str(exc)}
    # Test yt-dlp fallback
    temp_cookie_path = None
    try:
        cmd = [
            sys.executable, '-m', 'yt_dlp',
            '--no-playlist',
            '--extractor-args', 'youtube:player_client=android;player_skip=webpage,configs,js',
            '--format', 'bestaudio/best'
        ]
        cookie_file = os.getenv('YOUTUBE_COOKIES_FILE')
        cookies_content = os.getenv('YOUTUBE_COOKIES')
        if cookies_content and not cookie_file:
            temp = tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt')
            temp.write(cookies_content)
            temp.close()
            temp_cookie_path = temp.name
            cookie_file = temp_cookie_path
        info['cookie_file_used'] = cookie_file or '(none)'
        if cookie_file and Path(cookie_file).exists():
            cmd.extend(['--cookies', cookie_file])
            info['cookie_file_exists'] = True
        else:
            info['cookie_file_exists'] = False
        proxy = os.getenv('HTTPS_PROXY') or os.getenv('HTTP_PROXY')
        if proxy:
            cmd.extend(['--proxy', proxy])
        cmd.extend(['--get-url', f'https://music.youtube.com/watch?v={video_id}'])
        info['yt_dlp_cmd'] = ' '.join(cmd)
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30, check=False)
        info['yt_dlp'] = {'returncode': result.returncode, 'stdout_preview': (result.stdout or '')[:200], 'stderr': (result.stderr or '')}
        
        # Test without cookies as well in debug
        if cookie_file:
            no_cookie_cmd = [
                sys.executable, '-m', 'yt_dlp',
                '--no-playlist',
                '--extractor-args', 'youtube:player_client=android;player_skip=webpage,configs,js',
                '--format', 'bestaudio/best'
            ]
            if proxy:
                no_cookie_cmd.extend(['--proxy', proxy])
            no_cookie_cmd.extend(['--get-url', f'https://music.youtube.com/watch?v={video_id}'])
            no_cookie_res = subprocess.run(no_cookie_cmd, capture_output=True, text=True, timeout=30, check=False)
            info['yt_dlp_no_cookies'] = {
                'returncode': no_cookie_res.returncode,
                'stdout_preview': (no_cookie_res.stdout or '')[:200],
                'stderr': (no_cookie_res.stderr or '')
            }
    except Exception as exc:
        info['yt_dlp'] = {'status': 'exception', 'error': str(exc)}
    finally:
        if temp_cookie_path and os.path.exists(temp_cookie_path):
            try:
                os.remove(temp_cookie_path)
            except OSError:
                pass
    return info
