from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import create_token, current_user, hash_password, verify_password
from app.database import get_session
from app.models import Favorite, History, Playlist, PlaylistItem, User
from app.schemas.account import Credentials, LibraryImport, PlaylistCreate, PlaylistOut, PlaylistUpdate, ReorderInput, TokenOut, TrackInput, TrackOut, UserOut

router = APIRouter(prefix='/api', tags=['account'])

def track_data(track: TrackInput) -> dict:
    return {
        'video_id': track.video_id, 'title': track.title, 'artist': track.artist,
        'artist_id': track.artist_id, 'album': track.album, 'album_id': track.album_id,
        'genres': ','.join(dict.fromkeys(item.strip() for item in track.genres if item.strip())),
        'duration': track.duration, 'thumbnail_url': track.thumbnail_url,
    }

async def owned_playlist(playlist_id: int, user: User, session: AsyncSession) -> Playlist:
    playlist = await session.scalar(select(Playlist).options(selectinload(Playlist.items)).where(Playlist.id == playlist_id, Playlist.user_id == user.id))
    if playlist is None: raise HTTPException(404, 'Playlist no encontrada.')
    return playlist

@router.post('/auth/register', response_model=TokenOut, status_code=status.HTTP_201_CREATED)
async def register(data: Credentials, session: AsyncSession = Depends(get_session)):
    if not data.username: raise HTTPException(422, 'El nombre de usuario es obligatorio.')
    existing = await session.scalar(select(User).where((User.email == data.email.lower()) | (User.username == data.username)))
    if existing: raise HTTPException(409, 'El email o usuario ya está en uso.')
    user = User(email=data.email.lower(), username=data.username, hashed_password=hash_password(data.password))
    session.add(user); await session.commit(); await session.refresh(user)
    return {'token': create_token(user), 'user': user}

@router.post('/auth/login', response_model=TokenOut)
async def login(data: Credentials, session: AsyncSession = Depends(get_session)):
    user = await session.scalar(select(User).where(User.email == data.email.lower()))
    if not user or not verify_password(data.password, user.hashed_password): raise HTTPException(401, 'Email o contraseña incorrectos.')
    return {'token': create_token(user), 'user': user}

@router.get('/auth/me', response_model=UserOut)
async def me(user: User = Depends(current_user)): return user

@router.get('/playlists', response_model=list[PlaylistOut])
async def list_playlists(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    return (await session.scalars(select(Playlist).options(selectinload(Playlist.items)).where(Playlist.user_id == user.id).order_by(Playlist.created_at.desc()))).all()

@router.post('/playlists', response_model=PlaylistOut, status_code=201)
async def create_playlist(data: PlaylistCreate, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    playlist = Playlist(user_id=user.id, **data.model_dump()); session.add(playlist); await session.commit(); return await owned_playlist(playlist.id, user, session)

@router.patch('/playlists/{playlist_id}', response_model=PlaylistOut)
async def update_playlist(playlist_id: int, data: PlaylistUpdate, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    playlist = await owned_playlist(playlist_id, user, session); playlist.title = data.title; playlist.description = data.description; await session.commit(); return playlist

@router.delete('/playlists/{playlist_id}', status_code=204)
async def remove_playlist(playlist_id: int, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    await session.delete(await owned_playlist(playlist_id, user, session)); await session.commit(); return Response(status_code=204)

@router.post('/playlists/{playlist_id}/items', response_model=PlaylistOut)
async def add_item(playlist_id: int, data: TrackInput, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    playlist = await owned_playlist(playlist_id, user, session); session.add(PlaylistItem(playlist_id=playlist.id, position=len(playlist.items), **track_data(data))); await session.commit(); return await owned_playlist(playlist_id, user, session)

@router.delete('/playlists/{playlist_id}/items/{item_id}', status_code=204)
async def remove_item(playlist_id: int, item_id: int, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    playlist = await owned_playlist(playlist_id, user, session); item = next((item for item in playlist.items if item.id == item_id), None)
    if not item: raise HTTPException(404, 'Canción no encontrada.')
    await session.delete(item); await session.flush()
    for index, current in enumerate(playlist.items):
        if current.id != item_id: current.position = index
    await session.commit(); return Response(status_code=204)

@router.put('/playlists/{playlist_id}/items/reorder', response_model=PlaylistOut)
async def reorder_items(playlist_id: int, data: ReorderInput, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    playlist = await owned_playlist(playlist_id, user, session); existing = {item.id: item for item in playlist.items}
    if set(data.item_ids) != set(existing): raise HTTPException(422, 'La lista de canciones no coincide.')
    for index, item_id in enumerate(data.item_ids): existing[item_id].position = index
    await session.commit(); return await owned_playlist(playlist_id, user, session)

@router.get('/history', response_model=list[TrackOut])
async def history(limit: int = 30, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    return (await session.scalars(select(History).where(History.user_id == user.id).order_by(History.played_at.desc()).limit(min(max(limit, 1), 100)))).all()

@router.post('/history', response_model=TrackOut, status_code=201)
async def save_history(data: TrackInput, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    entry = History(user_id=user.id, **track_data(data)); session.add(entry); await session.commit(); await session.refresh(entry); return entry

@router.delete('/history', status_code=204)
async def clear_history(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    await session.execute(delete(History).where(History.user_id == user.id)); await session.commit(); return Response(status_code=204)

@router.get('/favorites', response_model=list[TrackOut])
async def favorites(user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    return (await session.scalars(select(Favorite).where(Favorite.user_id == user.id).order_by(Favorite.added_at.desc()))).all()

@router.post('/favorites/toggle', response_model=dict)
async def toggle_favorite(data: TrackInput, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    favorite = await session.scalar(select(Favorite).where(Favorite.user_id == user.id, Favorite.video_id == data.video_id))
    if favorite:
        await session.delete(favorite); liked = False
    else:
        session.add(Favorite(user_id=user.id, **track_data(data))); liked = True
    await session.commit(); return {'liked': liked}

@router.post('/library/import')
async def import_library(data: LibraryImport, user: User = Depends(current_user), session: AsyncSession = Depends(get_session)):
    for track in data.favorites:
        exists = await session.scalar(select(Favorite.id).where(Favorite.user_id == user.id, Favorite.video_id == track.video_id))
        if not exists: session.add(Favorite(user_id=user.id, **track_data(track)))
    for track in data.history[:30]: session.add(History(user_id=user.id, **track_data(track)))
    await session.commit(); return {'ok': True}
