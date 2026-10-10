from __future__ import annotations

import asyncio
import hashlib
import json
import os
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from urllib.request import Request, urlopen

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request as FastAPIRequest, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import JWT_ALGORITHM, JWT_SECRET, current_user
from app.database import get_session
from app.models import User

router = APIRouter(prefix='/api/lastfm', tags=['last.fm'])
LASTFM_API = 'https://ws.audioscrobbler.com/2.0/'


def _credentials() -> tuple[str, str]:
    api_key = os.getenv('LASTFM_API_KEY', '').strip()
    api_secret = os.getenv('LASTFM_API_SECRET', '').strip()
    if not api_key or not api_secret:
        raise HTTPException(503, 'Last.fm no está configurado en el servidor.')
    return api_key, api_secret


def _signature(params: dict[str, str], secret: str) -> str:
    payload = ''.join(f'{key}{params[key]}' for key in sorted(params) if key not in {'format', 'callback'}) + secret
    return hashlib.md5(payload.encode('utf-8')).hexdigest()


def _call_lastfm(params: dict[str, str], secret: str | None = None) -> dict:
    api_key, _ = _credentials()
    request_params = {**params, 'api_key': api_key, 'format': 'json'}
    if secret is not None:
        request_params['api_sig'] = _signature(request_params, secret)
    request = Request(f'{LASTFM_API}?{urlencode(request_params)}', headers={'User-Agent': 'Sonora/0.3'})
    try:
        with urlopen(request, timeout=8) as response:
            payload = json.loads(response.read())
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise RuntimeError('No se pudo completar la solicitud a Last.fm.') from exc
    if isinstance(payload, dict) and payload.get('error'):
        raise RuntimeError(str(payload.get('message') or 'Last.fm rechazó la solicitud.'))
    return payload


def _callback_url(request: FastAPIRequest, state: str) -> str:
    configured = os.getenv('LASTFM_CALLBACK_URL', '').strip()
    callback = configured or f"{str(request.base_url).rstrip('/')}/api/lastfm/callback"
    parts = urlsplit(callback)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query['state'] = state
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def _frontend_url(request: FastAPIRequest, result: str) -> str:
    configured = os.getenv('FRONTEND_ORIGIN', '*').split(',')[0].strip()
    origin = str(request.base_url).rstrip('/') if not configured or configured == '*' else configured.rstrip('/')
    return f'{origin}/?lastfm={result}'


@router.get('/status')
async def status(user: User = Depends(current_user)):
    configured = bool(os.getenv('LASTFM_API_KEY', '').strip() and os.getenv('LASTFM_API_SECRET', '').strip())
    return {'configured': configured, 'connected': bool(user.lastfm_username), 'username': user.lastfm_username}


@router.get('/connect')
async def connect(request: FastAPIRequest, user: User = Depends(current_user)):
    api_key, _ = _credentials()
    if not JWT_SECRET:
        raise HTTPException(503, 'JWT_SECRET no está configurado.')
    state = jwt.encode(
        {'sub': str(user.id), 'purpose': 'lastfm-link', 'exp': datetime.now(timezone.utc) + timedelta(minutes=15)},
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )
    params = urlencode({'api_key': api_key, 'cb': _callback_url(request, state)})
    return {'authorizationUrl': f'https://www.last.fm/api/auth/?{params}'}


@router.get('/callback')
async def callback(
    request: FastAPIRequest,
    token: str | None = None,
    state: str | None = None,
    session: AsyncSession = Depends(get_session),
):
    if not token or not state or not JWT_SECRET:
        return RedirectResponse(_frontend_url(request, 'error'), status_code=303)
    try:
        claims = jwt.decode(state, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if claims.get('purpose') != 'lastfm-link':
            raise jwt.InvalidTokenError('Invalid flow')
        user_id = int(claims['sub'])
        payload = await asyncio.to_thread(
            _call_lastfm,
            {'method': 'auth.getSession', 'token': token},
            os.getenv('LASTFM_API_SECRET', '').strip(),
        )
        username = payload['session']['name'].strip()
        if not username:
            raise RuntimeError('Last.fm no devolvió un usuario.')
        user = await session.get(User, user_id)
        if user is None:
            raise RuntimeError('La cuenta de Sonora ya no existe.')
        user.lastfm_username = username[:64]
        await session.commit()
    except (jwt.PyJWTError, KeyError, TypeError, ValueError, RuntimeError, HTTPException):
        await session.rollback()
        return RedirectResponse(_frontend_url(request, 'error'), status_code=303)
    return RedirectResponse(_frontend_url(request, 'connected'), status_code=303)


@router.get('/mood-profile')
async def mood_profile(user: User = Depends(current_user)):
    if not user.lastfm_username:
        raise HTTPException(409, 'Conectá tu cuenta de Last.fm para usar tus señales musicales.')
    _credentials()
    try:
        tags_data, recent_data = await asyncio.gather(
            asyncio.to_thread(_call_lastfm, {'method': 'user.getTopTags', 'user': user.lastfm_username, 'limit': '12'}),
            asyncio.to_thread(_call_lastfm, {'method': 'user.getRecentTracks', 'user': user.lastfm_username, 'limit': '20'}),
        )
    except RuntimeError as exc:
        raise HTTPException(502, 'No se pudo consultar el perfil musical de Last.fm.') from exc

    raw_tags = tags_data.get('toptags', {}).get('tag', [])
    if isinstance(raw_tags, dict):
        raw_tags = [raw_tags]
    tags = [item.get('name', '').strip() for item in raw_tags if isinstance(item, dict) and item.get('name')]
    raw_tracks = recent_data.get('recenttracks', {}).get('track', [])
    if isinstance(raw_tracks, dict):
        raw_tracks = [raw_tracks]
    artists: list[str] = []
    recent_tracks: list[dict[str, str | bool | None]] = []
    for item in raw_tracks:
        if not isinstance(item, dict):
            continue
        raw_artist = item.get('artist', '')
        artist = raw_artist.get('#text', '') if isinstance(raw_artist, dict) else str(raw_artist)
        title = str(item.get('name', '')).strip()
        if title and artist.strip():
            images = item.get('image') or []
            image = next((entry.get('#text') for entry in reversed(images) if isinstance(entry, dict) and entry.get('#text')), '')
            album_data = item.get('album') or {}
            date_data = item.get('date') or {}
            recent_tracks.append({
                'title': title,
                'artist': artist.strip(),
                'album': album_data.get('#text', '') if isinstance(album_data, dict) else '',
                'url': str(item.get('url', '')),
                'thumbnail': image,
                'playedAt': date_data.get('uts') if isinstance(date_data, dict) else None,
                'nowPlaying': (item.get('@attr') or {}).get('nowplaying') == 'true',
            })
        if artist.strip() and artist.strip().casefold() not in {name.casefold() for name in artists}:
            artists.append(artist.strip())
        if len(recent_tracks) == 12:
            break
    return {'username': user.lastfm_username, 'tags': tags[:8], 'recentArtists': artists[:5], 'recentTracks': recent_tracks, 'bpmAvailable': False}


@router.delete('/connection', status_code=204)
async def disconnect(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    user.lastfm_username = None
    await session.commit()
    return Response(status_code=204)
