from datetime import datetime
from pydantic import BaseModel, Field

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
    duration: int | None = Field(default=None, ge=0, le=36000)
    thumbnail_url: str = Field(default='', alias='thumbnailUrl', max_length=5000)
    model_config = {'populate_by_name': True}

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
