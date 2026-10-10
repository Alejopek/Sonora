from datetime import datetime
from pydantic import BaseModel, Field, field_validator

class Credentials(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    username: str | None = Field(default=None, min_length=2, max_length=50)

class UserOut(BaseModel):
    id: int; username: str; email: str; created_at: datetime
    model_config = {'from_attributes': True}

class TokenOut(BaseModel):
    token: str; user: UserOut

class TrackInput(BaseModel):
    video_id: str = Field(alias='videoId', min_length=1, max_length=32)
    title: str = Field(min_length=1, max_length=300)
    artist: str = Field(default='', max_length=300)
    artist_id: str | None = Field(default=None, alias='artistId', max_length=128)
    album: str = Field(default='', max_length=300)
    album_id: str | None = Field(default=None, alias='albumId', max_length=128)
    genres: list[str] = Field(default_factory=list, max_length=12)
    duration: int | None = Field(default=None, ge=0, le=36000)
    thumbnail_url: str = Field(default='', alias='thumbnailUrl', max_length=5000)
    model_config = {'populate_by_name': True}

    @field_validator('genres', mode='before')
    @classmethod
    def split_stored_genres(cls, value):
        return value.split(',') if isinstance(value, str) else value

class TrackOut(TrackInput):
    id: int; added_at: datetime | None = None; played_at: datetime | None = None
    model_config = {'from_attributes': True, 'populate_by_name': True}

class PlaylistCreate(BaseModel):
    title: str = Field(min_length=1, max_length=140)
    description: str = Field(default='', max_length=2000)

class PlaylistUpdate(PlaylistCreate): pass
class PlaylistOut(PlaylistCreate):
    id: int; created_at: datetime; items: list[TrackOut] = []
    model_config = {'from_attributes': True}

class ReorderInput(BaseModel):
    item_ids: list[int] = Field(alias='itemIds')
    model_config = {'populate_by_name': True}

class LibraryImport(BaseModel):
    favorites: list[TrackInput] = []
    history: list[TrackInput] = []


class PlaybackEvent(BaseModel):
    session_id: str = Field(alias='sessionId', min_length=8, max_length=64)
    event: str = Field(pattern='^(started|progress|completed|skipped)$')
    track: TrackInput
    listened_seconds: int = Field(default=0, alias='listenedSeconds', ge=0, le=43200)
    model_config = {'populate_by_name': True}


class RecommendationPreferenceInput(BaseModel):
    seed_terms: list[str] = Field(default_factory=list, alias='seedTerms', max_length=8)
    model_config = {'populate_by_name': True}


class RecommendationFeedback(BaseModel):
    track: TrackInput
    action: str = Field(pattern='^(less|exclude)$')


class StatRange(BaseModel):
    start: datetime | None = None
    end: datetime | None = None
