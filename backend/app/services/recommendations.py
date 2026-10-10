"""Deterministic recommendation helpers.

The ranking deliberately stays inspectable: affinity and recency lift candidates,
while skips, exclusions and a greedy diversity pass reduce repetition. Network
sources only supply candidates; they never decide the user's ranking.
"""
from __future__ import annotations

import json
import logging
import os
from collections import defaultdict
from datetime import datetime, timezone
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from app.services.youtube import client, track

logger = logging.getLogger(__name__)


def genre_list(value: str | list[str] | None) -> list[str]:
    if isinstance(value, list):
        values = value
    else:
        values = (value or '').split(',')
    return list(dict.fromkeys(item.strip().lower() for item in values if item and item.strip()))[:12]


def serialise_genres(value: str | list[str] | None) -> str:
    return ','.join(genre_list(value))


def track_payload(item, genres: list[str] | None = None) -> dict:
    """Accept either our Pydantic Track or an ORM row without exposing internals."""
    get = (lambda name, default=None: getattr(item, name, default)) if not isinstance(item, dict) else lambda name, default=None: item.get(name, default)
    return {
        'id': get('id', get('video_id', '')) if isinstance(item, dict) else get('video_id', get('id', '')),
        'title': get('title', 'Sin título'), 'artist': get('artist', ''),
        'artistId': get('artist_id', get('artistId')), 'album': get('album', ''),
        'albumId': get('album_id', get('albumId')), 'thumbnail': get('thumbnail', get('thumbnail_url', '')),
        'duration': get('duration'), 'durationSeconds': get('duration_seconds', get('duration')),
        'explicit': bool(get('explicit', False)), 'genres': genre_list(genres if genres is not None else get('genres', '')),
    }


def _candidate_key(candidate: dict) -> tuple[str, str]:
    return (candidate.get('id', ''), candidate.get('title', '').casefold())


def rank_and_diversify(
    candidates: list[dict],
    *, artist_scores: dict[str, int], genre_scores: dict[str, int], track_scores: dict[str, int], album_scores: dict[str, int] | None = None,
    skipped_tracks: set[str], excluded_tracks: set[str], favorite_tracks: set[str], now: datetime | None = None,
    familiar_ratio: float = .7, limit: int = 32,
) -> list[dict]:
    """Return a stable, varied mix. This function has no I/O to keep it testable."""
    del now  # Scores already include bounded recency applied when events arrive.
    unique: dict[str, dict] = {}
    for candidate in candidates:
        video_id = candidate.get('id', '')
        if video_id and video_id not in excluded_tracks:
            unique.setdefault(video_id, candidate)

    ranked = []
    for candidate in unique.values():
        artist = candidate.get('artist', '').casefold()
        genres = genre_list(candidate.get('genres'))
        album = candidate.get('album', '').casefold()
        album_id = candidate.get('albumId') or ''
        album_score = (album_scores or {}).get(album_id, 0) + (album_scores or {}).get(album, 0)
        known_score = track_scores.get(candidate['id'], 0) + artist_scores.get(artist, 0) + album_score
        genre_score = max((genre_scores.get(item, 0) for item in genres), default=0)
        skip_penalty = 120 if candidate['id'] in skipped_tracks else 0
        favorite_bonus = 55 if candidate['id'] in favorite_tracks else 0
        score = known_score + genre_score + favorite_bonus - skip_penalty
        if known_score or candidate['id'] in favorite_tracks:
            reason = f"Porque escuchaste mucho a {candidate.get('artist') or 'este artista'}"
        elif genres and genre_scores.get(genres[0], 0):
            reason = f"Para descubrir algo cercano a {genres[0]}"
        elif favorite_tracks:
            reason = 'Para ampliar el sonido de tus favoritos'
        else:
            reason = 'Una selección popular para empezar a escuchar'
        ranked.append({**candidate, 'score': int(score), 'reason': reason, '_familiar': bool(known_score or candidate['id'] in favorite_tracks)})

    ranked.sort(key=lambda item: (-item['score'], item['artist'].casefold(), item['title'].casefold(), item['id']))
    familiar_target = round(limit * familiar_ratio) if artist_scores or track_scores else 0
    chosen: list[dict] = []
    recent_artists: list[str] = []
    recent_albums: list[str] = []
    recent_genres: list[str] = []
    for item in ranked:
        if len(chosen) >= limit:
            break
        artist = item.get('artist', '').casefold()
        album = item.get('album', '').casefold()
        genres = genre_list(item.get('genres'))
        # Artist / album / genre windows protect the queue even when one source is dominant.
        if artist and artist in recent_artists[-2:]:
            continue
        if album and album in recent_albums[-3:]:
            continue
        if any(genre in recent_genres[-3:] for genre in genres):
            continue
        selected_familiar = sum(1 for selected in chosen if selected['_familiar'])
        remaining = limit - len(chosen)
        # When plenty of candidates exist, reserve discovery slots instead of filling all
        # early positions with comfortable repeats.
        if item['_familiar'] and selected_familiar >= familiar_target and any(not other['_familiar'] for other in ranked):
            if remaining > max(2, limit - familiar_target):
                continue
        chosen.append(item)
        recent_artists.append(artist)
        recent_albums.append(album)
        recent_genres.extend(genres[:1])

    # Diversity filters can be too strict for sparse artists. Fill deterministically,
    # still never repeating a song or an excluded candidate.
    if len(chosen) < min(limit, len(ranked)):
        used = {item['id'] for item in chosen}
        chosen.extend(item for item in ranked if item['id'] not in used)
        chosen = chosen[:limit]
    return [{key: value for key, value in item.items() if key != '_familiar'} for item in chosen]


def youtube_candidates(seed_track_ids: list[str], queries: list[str]) -> list[dict]:
    """Bounded candidate expansion using methods present in ytmusicapi 1.10.x."""
    music = client()
    found: list[dict] = []
    for video_id in seed_track_ids[:3]:
        try:
            radio = music.get_watch_playlist(videoId=video_id, limit=25, radio=True)
            for raw in radio.get('tracks') or []:
                if raw.get('videoId'):
                    found.append(track_payload(track(raw)))
        except Exception as exc:  # A radio miss must not make the home page fail.
            logger.info('No se pudo ampliar radio para recomendación: %s', exc)
    for query in queries[:4] or ['pop music']:
        try:
            for raw in music.search(query, filter='songs', limit=18):
                if raw.get('videoId'):
                    item = track_payload(track(raw), [query])
                    found.append(item)
        except Exception as exc:
            logger.info('No se pudo buscar candidatos de recomendación: %s', exc)
    return found


def lastfm_artist_tags(artist: str) -> list[str]:
    """Optional enrichment. The key stays on the server and failures are ignored."""
    api_key = os.getenv('LASTFM_API_KEY')
    if not api_key or not artist:
        return []
    params = urlencode({'method': 'artist.gettoptags', 'artist': artist, 'api_key': api_key, 'format': 'json', 'autocorrect': 1})
    try:
        request = Request(f'https://ws.audioscrobbler.com/2.0/?{params}', headers={'User-Agent': 'Sonora/0.3'})
        with urlopen(request, timeout=3) as response:
            data = json.loads(response.read())
        tags = data.get('toptags', {}).get('tag', [])
        return genre_list([item.get('name', '') for item in tags[:4]])
    except Exception:
        return []
