import os
from functools import lru_cache
from ytmusicapi import YTMusic
from app.schemas.music import Album, Artist, Playlist, Track

@lru_cache(maxsize=1)
def client() -> YTMusic:
    auth = os.getenv('YTMUSIC_AUTH')
    return YTMusic(auth) if auth else YTMusic()

def thumb(data: dict) -> str:
    images = data.get('thumbnails') or data.get('thumbnail') or []
    if isinstance(images, list) and images: return images[-1].get('url', '')
    return ''

def track(data: dict) -> Track:
    artists = data.get('artists') or []
    album = data.get('album') or {}
    return Track(id=data.get('videoId', ''), title=data.get('title', 'Sin título'), artist=', '.join(a.get('name', '') for a in artists) or data.get('author', 'Artista desconocido'), artistId=artists[0].get('id') if artists else None, album=album.get('name', '') if isinstance(album, dict) else '', albumId=album.get('id') if isinstance(album, dict) else None, thumbnail=thumb(data), duration=data.get('duration'), durationSeconds=data.get('duration_seconds'), explicit=bool(data.get('isExplicit')))

def search(query: str):
    # A filtered query deliberately avoids YouTube Music's fragile "top result"
    # parser, which can change independently from the regular result schema.
    music = client()
    song_results = music.search(query, filter='songs', limit=12)
    artist_results = music.search(query, filter='artists', limit=6)
    album_results = music.search(query, filter='albums', limit=6)
    playlist_results = music.search(query, filter='playlists', limit=6)
    songs = [track(item) for item in song_results if item.get('videoId')]
    artists = [Artist(id=item.get('browseId', ''), name=item.get('artist', item.get('title', 'Artista')), thumbnail=thumb(item), subscribers=str(item['subscribers']) if item.get('subscribers') is not None else None) for item in artist_results]
    albums = []
    for item in album_results:
        artist_data = item.get('artists') or []
        albums.append(Album(id=item.get('browseId', ''), title=item.get('title', ''), artist=', '.join(a.get('name', '') for a in artist_data), thumbnail=thumb(item), year=str(item['year']) if item.get('year') is not None else None, type=item.get('type')))
    playlists = [Playlist(id=item.get('browseId', ''), title=item.get('title', ''), author=item.get('author', ''), thumbnail=thumb(item), count=str(item['itemCount']) if item.get('itemCount') is not None else None) for item in playlist_results]
    return songs, artists, albums, playlists

def song(video_id: str) -> Track:
    details = client().get_song(video_id).get('videoDetails', {})
    data = {'videoId': video_id, 'title': details.get('title'), 'author': details.get('author'), 'thumbnails': details.get('thumbnail', {}).get('thumbnails', []), 'duration_seconds': int(details.get('lengthSeconds', 0) or 0)}
    return track(data)

def stream_url(video_id: str, preferred_container: str = 'auto') -> str:
    data = client().get_song(video_id).get('streamingData') or {}
    formats = data.get('adaptiveFormats') or data.get('formats') or []
    audio = [item for item in formats if str(item.get('mimeType', '')).startswith('audio/') and item.get('url')]
    if not audio:
        raise ValueError('No audio format available')
    # Match the browser codec when possible, then use the best available bitrate.
    compatible = [item for item in audio if preferred_container == 'auto' or str(item.get('mimeType', '')).startswith(f'audio/{preferred_container}')]
    candidates = compatible or audio
    return max(candidates, key=lambda item: int(item.get('bitrate') or 0)).get('url')
