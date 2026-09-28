from pydantic import BaseModel, Field

class Track(BaseModel):
    id: str
    title: str
    artist: str
    artist_id: str | None = Field(default=None, alias='artistId')
    album: str = ''
    album_id: str | None = Field(default=None, alias='albumId')
    thumbnail: str = ''
    duration: str | None = None
    duration_seconds: int | None = Field(default=None, alias='durationSeconds')
    explicit: bool = False
    model_config = {'populate_by_name': True}

class Artist(BaseModel):
    id: str
    name: str
    thumbnail: str = ''
    subscribers: str | None = None

class Album(BaseModel):
    id: str
    title: str
    artist: str = ''
    thumbnail: str = ''
    year: str | None = None
    type: str | None = None

class Playlist(BaseModel):
    id: str
    title: str
    author: str = ''
    thumbnail: str = ''
    count: str | None = None

class SearchResponse(BaseModel):
    songs: list[Track] = []
    artists: list[Artist] = []
    albums: list[Album] = []
    playlists: list[Playlist] = []
