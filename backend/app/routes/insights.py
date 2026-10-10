from __future__ import annotations

import asyncio
import builtins
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import current_user
from app.database import get_session
from app.models import (
    CatalogTrack, DailyMix, DailyMixItem, Favorite, ListeningDaily, ListeningHour, ListeningSession,
    RecommendationExclusion, RecommendationPreference, User, UserEntityAffinity,
    UserTrackAffinity,
)
from app.schemas.account import AlbumInput, PlaybackEvent, RecommendationFeedback, RecommendationPreferenceInput, TrackInput
from app.services.recommendations import genre_list, lastfm_artist_tags, rank_and_diversify, serialise_genres, track_payload, youtube_candidates
from app.services.youtube import album_candidates
from app.services.listening import early_skip, meaningful_play, progress_delta

router = APIRouter(prefix='/api', tags=['recommendations and statistics'])


def _track_values(track: TrackInput) -> dict:
    return {
        'video_id': track.video_id, 'title': track.title, 'artist': track.artist,
        'artist_id': track.artist_id, 'album': track.album, 'album_id': track.album_id,
        'genres': serialise_genres(track.genres), 'duration': track.duration,
        'thumbnail_url': track.thumbnail_url,
    }


def _entities(track: TrackInput):
    if track.artist:
        yield 'artist', track.artist.casefold(), track.artist
    if track.album:
        yield 'album', track.album.casefold(), track.album
    for genre in genre_list(track.genres):
        yield 'genre', genre, genre


async def _entity_row(session: AsyncSession, user_id: int, kind: str, key: str, label: str) -> UserEntityAffinity:
    row = await session.scalar(select(UserEntityAffinity).where(UserEntityAffinity.user_id == user_id, UserEntityAffinity.entity_type == kind, UserEntityAffinity.entity_key == key))
    if row is None:
        row = UserEntityAffinity(user_id=user_id, entity_type=kind, entity_key=key, label=label)
        session.add(row)
        await session.flush()
    return row


async def _daily_row(session: AsyncSession, user_id: int, day: date) -> ListeningDaily:
    row = await session.scalar(select(ListeningDaily).where(ListeningDaily.user_id == user_id, ListeningDaily.day == day))
    if row is None:
        row = ListeningDaily(user_id=user_id, day=day)
        session.add(row)
        await session.flush()
    return row


async def _hour_row(session: AsyncSession, user_id: int, hour: int) -> ListeningHour:
    row = await session.scalar(select(ListeningHour).where(ListeningHour.user_id == user_id, ListeningHour.hour == hour))
    if row is None:
        row = ListeningHour(user_id=user_id, hour=hour)
        session.add(row)
        await session.flush()
    return row


async def _track_row(session: AsyncSession, user_id: int, track: TrackInput) -> UserTrackAffinity:
    row = await session.scalar(select(UserTrackAffinity).where(UserTrackAffinity.user_id == user_id, UserTrackAffinity.video_id == track.video_id))
    if row is None:
        row = UserTrackAffinity(user_id=user_id, **_track_values(track))
        session.add(row)
        await session.flush()
    return row


@router.post('/listening/events', status_code=202)
async def listening_event(data: PlaybackEvent, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    """Accept coarse progress checkpoints, not a noisy event per timeupdate."""
    event_time = datetime.now(timezone.utc)
    entry = await session.scalar(select(ListeningSession).where(ListeningSession.user_id == user.id, ListeningSession.session_key == data.session_id))
    if entry is None:
        entry = ListeningSession(user_id=user.id, session_key=data.session_id, **_track_values(data.track))
        session.add(entry)
        await session.flush()
    elif entry.video_id != data.track.video_id:
        raise HTTPException(409, 'La sesión de escucha pertenece a otra canción.')

    reported = max(0, data.listened_seconds)
    delta = progress_delta(reported, entry.listened_seconds)
    entry.listened_seconds += delta
    entry.last_event_at = event_time
    affinity = await _track_row(session, user.id, data.track)
    daily = await _daily_row(session, user.id, event_time.date())
    if delta:
        affinity.listened_seconds += delta
        affinity.affinity_score += max(1, delta // 12)
        affinity.last_played_at = event_time
        daily.listened_seconds += delta
        (await _hour_row(session, user.id, event_time.hour)).listened_seconds += delta
        for kind, key, label in _entities(data.track):
            entity = await _entity_row(session, user.id, kind, key, label)
            entity.listened_seconds += delta
            entity.affinity_score += max(1, delta // 12)
            entity.last_played_at = event_time

    meaningful = meaningful_play(entry.listened_seconds, data.track.duration)
    if (meaningful or data.event == 'completed') and not entry.counted_play:
        entry.counted_play = True
        affinity.play_count += 1
        affinity.affinity_score += 18
        daily.play_count += 1
        for kind, key, label in _entities(data.track):
            entity = await _entity_row(session, user.id, kind, key, label)
            entity.play_count += 1
            entity.affinity_score += 12

    if data.event == 'completed' and not entry.completed:
        entry.completed = True
        affinity.completed_count += 1
        affinity.affinity_score += 30
        daily.completion_count += 1
    if data.event == 'skipped' and not entry.skipped_early:
        if early_skip(entry.listened_seconds, data.track.duration):
            entry.skipped_early = True
            affinity.skipped_count += 1
            affinity.affinity_score -= 35
            daily.early_skip_count += 1
    # Detailed sessions are only needed for bounded period analytics. Aggregates stay forever.
    cutoff = event_time - timedelta(days=180)
    await session.execute(delete(ListeningSession).where(ListeningSession.user_id == user.id, ListeningSession.started_at < cutoff))
    await session.commit()
    return {'accepted': True, 'listenedSeconds': entry.listened_seconds}


@router.put('/recommendations/preferences')
async def save_preferences(data: RecommendationPreferenceInput, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    terms = list(dict.fromkeys(term.strip() for term in data.seed_terms if term.strip()))[:8]
    preference = await session.get(RecommendationPreference, user.id)
    if preference is None:
        preference = RecommendationPreference(user_id=user.id)
        session.add(preference)
    preference.seed_terms = ','.join(terms)
    # A deliberate first-time preference is the one explicit reason to refresh
    # today's still-unheard mix; ordinary reloads always reuse the persisted mix.
    await session.execute(delete(DailyMix).where(DailyMix.user_id == user.id, DailyMix.mix_date == datetime.now(timezone.utc).date()))
    await session.commit()
    return {'seedTerms': terms}


async def _profile(session: AsyncSession, user_id: int):
    entities = (await session.scalars(select(UserEntityAffinity).where(UserEntityAffinity.user_id == user_id).order_by(UserEntityAffinity.affinity_score.desc()).limit(120))).all()
    tracks = (await session.scalars(select(UserTrackAffinity).where(UserTrackAffinity.user_id == user_id).order_by(UserTrackAffinity.affinity_score.desc()).limit(50))).all()
    exclusions = set((await session.scalars(select(RecommendationExclusion.video_id).where(RecommendationExclusion.user_id == user_id))).all())
    favorites = set((await session.scalars(select(Favorite.video_id).where(Favorite.user_id == user_id))).all())
    by_type: dict[str, dict[str, int]] = defaultdict(dict)
    for entity in entities:
        by_type[entity.entity_type][entity.entity_key] = entity.affinity_score
    return by_type, tracks, exclusions, favorites


@router.get('/favorites/albums')
async def album_favorites(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    rows = (await session.scalars(select(UserEntityAffinity).where(UserEntityAffinity.user_id == user.id, UserEntityAffinity.entity_type == 'album_like').order_by(UserEntityAffinity.label))).all()
    return [{'id': row.entity_key, 'title': row.label, 'artist': '', 'thumbnail': ''} for row in rows]


@router.post('/favorites/albums/toggle')
async def toggle_album_favorite(data: AlbumInput, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    row = await session.scalar(select(UserEntityAffinity).where(UserEntityAffinity.user_id == user.id, UserEntityAffinity.entity_type == 'album_like', UserEntityAffinity.entity_key == data.id))
    if row is None:
        session.add(UserEntityAffinity(user_id=user.id, entity_type='album_like', entity_key=data.id, label=data.title, play_count=1, affinity_score=1))
        liked = True
    else:
        await session.delete(row)
        liked = False
    await session.execute(delete(DailyMix).where(DailyMix.user_id == user.id, DailyMix.mix_date == datetime.now(timezone.utc).date()))
    await session.commit()
    return {'liked': liked}


@router.get('/recommendations/albums')
async def recommended_albums(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    by_type, _, _, _ = await _profile(session, user.id)
    artist_rows = (await session.scalars(select(UserEntityAffinity).where(UserEntityAffinity.user_id == user.id, UserEntityAffinity.entity_type == 'artist').order_by(UserEntityAffinity.affinity_score.desc()).limit(4))).all()
    album_like_rows = (await session.scalars(select(UserEntityAffinity).where(UserEntityAffinity.user_id == user.id, UserEntityAffinity.entity_type == 'album_like').order_by(UserEntityAffinity.affinity_score.desc()).limit(4))).all()
    album_rows = (await session.scalars(select(UserEntityAffinity).where(UserEntityAffinity.user_id == user.id, UserEntityAffinity.entity_type == 'album').order_by(UserEntityAffinity.affinity_score.desc()).limit(3))).all()
    queries = [row.label for row in album_like_rows] + [row.label for row in artist_rows] + [row.label for row in album_rows]
    if not queries:
        queries = ['indie albums', 'electronic albums', 'popular albums']
    candidates = await asyncio.to_thread(album_candidates, queries)
    liked_ids = set(by_type['album_like'])
    for candidate in candidates:
        artist_score = sum(score for artist, score in by_type['artist'].items() if artist and artist in candidate['artist'].casefold())
        candidate['score'] = (400 if candidate['id'] in liked_ids else 0) + artist_score + by_type['album'].get(candidate['title'].casefold(), 0)
    candidates.sort(key=lambda item: (-item['score'], item['artist'].casefold(), item['title'].casefold()))
    return {'albums': candidates[:12]}


async def _create_mix(session: AsyncSession, user: User, mix_day: date) -> DailyMix:
    by_type, affinity_tracks, exclusions, favorites = await _profile(session, user.id)
    preference = await session.get(RecommendationPreference, user.id)
    seed_terms = [term for term in (preference.seed_terms if preference else '').split(',') if term]
    artist_queries = [row.label for row in (await session.scalars(select(UserEntityAffinity).where(UserEntityAffinity.user_id == user.id, UserEntityAffinity.entity_type == 'artist').order_by(UserEntityAffinity.affinity_score.desc()).limit(3))).all()]
    genre_queries = [row.label for row in (await session.scalars(select(UserEntityAffinity).where(UserEntityAffinity.user_id == user.id, UserEntityAffinity.entity_type == 'genre').order_by(UserEntityAffinity.affinity_score.desc()).limit(2))).all()]
    queries = artist_queries + genre_queries + seed_terms
    if artist_queries:
        # Optional, bounded enrichment. No Last.fm response is required for a mix.
        queries.extend(await asyncio.to_thread(lastfm_artist_tags, artist_queries[0]))
    if not queries:
        queries = ['indie music', 'electronic music', 'pop music']
    candidates = await asyncio.to_thread(youtube_candidates, [row.video_id for row in affinity_tracks[:3]], queries)
    # Last.fm is enrichment only: it helps label a candidate but never supplies or ranks it.
    ranked = rank_and_diversify(
        candidates, artist_scores=by_type['artist'], genre_scores=by_type['genre'],
        track_scores={row.video_id: row.affinity_score for row in affinity_tracks},
        album_scores={**by_type['album'], **{key: score * 3 for key, score in by_type['album_like'].items()}},
        skipped_tracks={row.video_id for row in affinity_tracks if row.skipped_count > row.play_count},
        excluded_tracks=exclusions, favorite_tracks=favorites, limit=32,
    )
    # Keep a lightweight local metadata cache. The daily mix remains valid even if
    # a provider is slow tomorrow, and no browser ever calls YouTube directly.
    ids = [item['id'] for item in ranked]
    cached = {item.video_id: item for item in (await session.scalars(select(CatalogTrack).where(CatalogTrack.video_id.in_(ids)))).all()} if ids else {}
    for item in ranked:
        values = {
            'video_id': item['id'], 'title': item['title'], 'artist': item['artist'], 'artist_id': item.get('artistId'),
            'album': item.get('album', ''), 'album_id': item.get('albumId'), 'genres': serialise_genres(item.get('genres')),
            'duration': item.get('durationSeconds'), 'thumbnail_url': item.get('thumbnail', ''),
        }
        row = cached.get(item['id'])
        if row is None:
            session.add(CatalogTrack(**values))
        else:
            for key, value in values.items():
                setattr(row, key, value)
    mix = DailyMix(user_id=user.id, mix_date=mix_day)
    session.add(mix)
    await session.flush()
    for position, item in enumerate(ranked):
        session.add(DailyMixItem(
            mix_id=mix.id, position=position, video_id=item['id'], title=item['title'], artist=item['artist'],
            artist_id=item.get('artistId'), album=item.get('album', ''), album_id=item.get('albumId'),
            genres=serialise_genres(item.get('genres')), thumbnail_url=item.get('thumbnail', ''),
            duration=item.get('durationSeconds'), reason=item['reason'], score=item['score'],
        ))
    await session.commit()
    return mix


async def _mix_response(session: AsyncSession, mix: DailyMix, user_id: int) -> dict:
    excluded = set((await session.scalars(select(RecommendationExclusion.video_id).where(RecommendationExclusion.user_id == user_id))).all())
    items = (await session.scalars(select(DailyMixItem).where(DailyMixItem.mix_id == mix.id).order_by(DailyMixItem.position))).all()
    tracks = [{**track_payload(item), 'reason': item.reason, 'score': item.score} for item in items if item.video_id not in excluded]
    return {'date': mix.mix_date.isoformat(), 'title': 'Mix diario', 'tracks': tracks, 'isEmpty': not bool(tracks)}


@router.get('/recommendations')
async def daily_recommendations(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    mix_day = datetime.now(timezone.utc).date()
    mix = await session.scalar(select(DailyMix).where(DailyMix.user_id == user.id, DailyMix.mix_date == mix_day))
    if mix is not None:
        created_at = mix.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        if created_at < datetime.now(timezone.utc) - timedelta(hours=12):
            await session.execute(delete(DailyMix).where(DailyMix.id == mix.id))
            await session.commit()
            mix = None
    if mix is None:
        mix = await _create_mix(session, user, mix_day)
    return await _mix_response(session, mix, user.id)


@router.get('/recommendations/queue')
async def recommendation_queue(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    data = await daily_recommendations(user, session)
    # The persisted daily order is already diversity-aware. A queue gets a concise,
    # stable slice so one click never creates an unbounded playlist.
    return {'tracks': data['tracks'][:18], 'title': 'Tu cola para ahora'}


@router.post('/recommendations/queue')
async def seeded_recommendation_queue(track: TrackInput, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    """Build a concise queue around the selected song and the user's taste profile."""
    by_type, affinity_tracks, exclusions, favorites = await _profile(session, user.id)
    preference = await session.get(RecommendationPreference, user.id)
    seed_terms = [term for term in (preference.seed_terms if preference else '').split(',') if term]
    artist_queries = [row.label for row in (await session.scalars(select(UserEntityAffinity).where(UserEntityAffinity.user_id == user.id, UserEntityAffinity.entity_type == 'artist').order_by(UserEntityAffinity.affinity_score.desc()).limit(3))).all()]
    genre_queries = [row.label for row in (await session.scalars(select(UserEntityAffinity).where(UserEntityAffinity.user_id == user.id, UserEntityAffinity.entity_type == 'genre').order_by(UserEntityAffinity.affinity_score.desc()).limit(2))).all()]
    candidates = await asyncio.to_thread(youtube_candidates, [track.video_id, *(row.video_id for row in affinity_tracks[:2])], [*artist_queries, *genre_queries, *seed_terms])
    ranked = rank_and_diversify(
        candidates, artist_scores=by_type['artist'], genre_scores=by_type['genre'],
        track_scores={row.video_id: row.affinity_score for row in affinity_tracks},
        album_scores={**by_type['album'], **{key: score * 3 for key, score in by_type['album_like'].items()}},
        skipped_tracks={row.video_id for row in affinity_tracks if row.skipped_count > row.play_count},
        excluded_tracks=exclusions | {track.video_id}, favorite_tracks=favorites, limit=17,
    )
    # A sparse provider response should not make song selection fail. Reuse the stable
    # daily mix as a local fallback, still excluding the selected song and exclusions.
    if not ranked:
        mix_day = datetime.now(timezone.utc).date()
        mix = await session.scalar(select(DailyMix).where(DailyMix.user_id == user.id, DailyMix.mix_date == mix_day))
        if mix is None:
            mix = await _create_mix(session, user, mix_day)
        fallback = await _mix_response(session, mix, user.id)
        ranked = [item for item in fallback['tracks'] if item['id'] != track.video_id][:17]
    return {'tracks': ranked, 'title': 'Tu cola para ahora'}


@router.post('/recommendations/refresh')
async def refresh_recommendations(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    """Explicitly rebuild today's persisted mix from the latest listening signals."""
    mix_day = datetime.now(timezone.utc).date()
    await session.execute(delete(DailyMix).where(DailyMix.user_id == user.id, DailyMix.mix_date == mix_day))
    await session.commit()
    mix = await _create_mix(session, user, mix_day)
    return await _mix_response(session, mix, user.id)


@router.post('/recommendations/feedback')
async def recommendation_feedback(data: RecommendationFeedback, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    affinity = await _track_row(session, user.id, data.track)
    if data.action == 'exclude':
        existing = await session.scalar(select(RecommendationExclusion).where(RecommendationExclusion.user_id == user.id, RecommendationExclusion.video_id == data.track.video_id))
        if existing is None:
            session.add(RecommendationExclusion(user_id=user.id, video_id=data.track.video_id))
        affinity.affinity_score -= 100
    else:
        affinity.affinity_score -= 35
        for kind, key, label in _entities(data.track):
            entity = await _entity_row(session, user.id, kind, key, label)
            entity.affinity_score -= 12
    await session.commit()
    return {'ok': True}


def _range_dates(range_name: str, start: date | None, end: date | None) -> tuple[date | None, date, str]:
    today = datetime.now(timezone.utc).date()
    if range_name == 'all':
        return None, today, 'Todo el tiempo'
    if range_name == 'today':
        return today, today, 'Hoy'
    if range_name == 'custom' and start and end and start <= end and (end - start).days <= 365:
        return start, end, 'Rango personalizado'
    days = 30 if range_name == '30d' else 7
    return today - timedelta(days=days - 1), today, f'Últimos {days} días'


def _streak(days: set[date], today: date) -> int:
    value = 0
    cursor = today
    while cursor in days:
        value += 1
        cursor -= timedelta(days=1)
    return value


def _activity_series(activity_start: date, end_day: date, daily_map: dict[date, int]) -> list[dict[str, int | str]]:
    return [
        {
            'date': (activity_start + timedelta(days=index)).isoformat(),
            'listenedSeconds': daily_map.get(activity_start + timedelta(days=index), 0),
        }
        for index in builtins.range((end_day - activity_start).days + 1)
    ]


@router.get('/statistics')
async def statistics(
    range_name: str = Query(default='7d', alias='range', pattern='^(today|7d|30d|all|custom)$'),
    start: date | None = None, end: date | None = None,
    user: User = Depends(current_user), session: AsyncSession = Depends(get_session),
):
    start_day, end_day, label = _range_dates(range_name, start, end)
    sessions_query = select(ListeningSession).where(ListeningSession.user_id == user.id)
    if start_day:
        sessions_query = sessions_query.where(ListeningSession.started_at >= datetime.combine(start_day, datetime.min.time(), tzinfo=timezone.utc), ListeningSession.started_at < datetime.combine(end_day + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc))
    sessions = (await session.scalars(sessions_query)).all() if range_name != 'all' else []
    daily_query = select(ListeningDaily).where(ListeningDaily.user_id == user.id, ListeningDaily.day <= end_day)
    if start_day:
        daily_query = daily_query.where(ListeningDaily.day >= start_day)
    daily = (await session.scalars(daily_query.order_by(ListeningDaily.day))).all()
    if range_name == 'all':
        listened = sum(row.listened_seconds for row in daily)
        plays = sum(row.play_count for row in daily)
        entities = (await session.scalars(select(UserEntityAffinity).where(UserEntityAffinity.user_id == user.id))).all()
        artists = len([row for row in entities if row.entity_type == 'artist' and row.play_count])
        albums = len([row for row in entities if row.entity_type == 'album' and row.play_count])
        genres = len([row for row in entities if row.entity_type == 'genre' and row.play_count])
        tracks = (await session.scalars(select(UserTrackAffinity).where(UserTrackAffinity.user_id == user.id, UserTrackAffinity.play_count > 0))).all()
        top_tracks = sorted(tracks, key=lambda row: (-row.listened_seconds, -row.play_count, row.title))[:8]
        top_entities = {kind: sorted((row for row in entities if row.entity_type == kind), key=lambda row: (-row.listened_seconds, row.label))[:8] for kind in ('artist', 'album', 'genre')}
        all_hours = (await session.scalars(select(ListeningHour).where(ListeningHour.user_id == user.id))).all()
        hours: Counter[int] = Counter({row.hour: row.listened_seconds for row in all_hours})
    else:
        listened = sum(row.listened_seconds for row in sessions)
        meaningful = [row for row in sessions if row.counted_play]
        plays = len(meaningful)
        artists = len({row.artist.casefold() for row in meaningful if row.artist})
        albums = len({row.album.casefold() for row in meaningful if row.album})
        genres = len({genre for row in meaningful for genre in genre_list(row.genres)})
        grouped_tracks: dict[str, list] = defaultdict(list)
        grouped_entities: dict[str, dict[str, list]] = defaultdict(lambda: defaultdict(list))
        for row in sessions:
            grouped_tracks[row.video_id].append(row)
            if row.artist: grouped_entities['artist'][row.artist].append(row)
            if row.album: grouped_entities['album'][row.album].append(row)
            for genre in genre_list(row.genres): grouped_entities['genre'][genre].append(row)
        top_tracks = sorted((rows[0] for rows in grouped_tracks.values()), key=lambda row: (-sum(item.listened_seconds for item in grouped_tracks[row.video_id]), row.title))[:8]
        top_entities = {kind: sorted(((key, values) for key, values in grouped_entities[kind].items()), key=lambda item: (-sum(row.listened_seconds for row in item[1]), item[0]))[:8] for kind in ('artist', 'album', 'genre')}
        hours = Counter(row.started_at.hour for row in sessions if row.listened_seconds)
    daily_map = {row.day: row.listened_seconds for row in daily}
    activity_start = start_day or (min(daily_map) if daily_map else end_day)
    activity = _activity_series(activity_start, end_day, daily_map)
    day_set = {row.day for row in daily if row.listened_seconds}
    previous_seconds = None
    if start_day:
        span = (end_day - start_day).days + 1
        previous_start = start_day - timedelta(days=span)
        previous_end = start_day - timedelta(days=1)
        previous_seconds = await session.scalar(select(func.coalesce(func.sum(ListeningDaily.listened_seconds), 0)).where(ListeningDaily.user_id == user.id, ListeningDaily.day >= previous_start, ListeningDaily.day <= previous_end))
    def metric_track(row):
        if range_name == 'all':
            return {**track_payload(row), 'listenedSeconds': row.listened_seconds, 'plays': row.play_count}
        rows = grouped_tracks[row.video_id]
        return {**track_payload(row), 'listenedSeconds': sum(item.listened_seconds for item in rows), 'plays': sum(1 for item in rows if item.counted_play)}
    def metric_entity(item, kind):
        if range_name == 'all':
            return {'name': item.label, 'listenedSeconds': item.listened_seconds, 'plays': item.play_count}
        name, rows = item
        return {'name': name, 'listenedSeconds': sum(row.listened_seconds for row in rows), 'plays': sum(1 for row in rows if row.counted_play)}
    return {
        'range': {'label': label, 'start': activity_start.isoformat(), 'end': end_day.isoformat()},
        'totals': {'listenedSeconds': listened, 'plays': plays, 'artists': artists, 'albums': albums, 'genres': genres, 'streakDays': _streak(day_set, end_day)},
        'comparison': None if previous_seconds is None else {'previousListenedSeconds': int(previous_seconds), 'changePercent': None if not previous_seconds else round(((listened - previous_seconds) / previous_seconds) * 100)},
        'activity': activity,
        'hours': [{'hour': hour, 'listenedSeconds': hours[hour] if range_name == 'all' else sum(row.listened_seconds for row in sessions if row.started_at.hour == hour)} for hour in sorted(hours)],
        'top': {'tracks': [metric_track(row) for row in top_tracks], **{f'{kind}s': [metric_entity(item, kind) for item in items] for kind, items in top_entities.items()}},
    }
