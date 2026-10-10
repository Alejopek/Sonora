from datetime import datetime

from datetime import date

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = 'users'
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    playlists: Mapped[list['Playlist']] = relationship(back_populates='user', cascade='all, delete-orphan')


class Playlist(Base):
    __tablename__ = 'playlists'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    title: Mapped[str] = mapped_column(String(140))
    description: Mapped[str] = mapped_column(Text, default='')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    user: Mapped[User] = relationship(back_populates='playlists')
    items: Mapped[list['PlaylistItem']] = relationship(back_populates='playlist', cascade='all, delete-orphan', order_by='PlaylistItem.position')


class TrackFields:
    video_id: Mapped[str] = mapped_column(String(32), index=True)
    title: Mapped[str] = mapped_column(String(300))
    artist: Mapped[str] = mapped_column(String(300), default='')
    artist_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    album: Mapped[str] = mapped_column(String(300), default='')
    album_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    genres: Mapped[str] = mapped_column(Text, default='')
    duration: Mapped[int | None] = mapped_column(Integer, nullable=True)
    thumbnail_url: Mapped[str] = mapped_column(Text, default='')


class PlaylistItem(Base, TrackFields):
    __tablename__ = 'playlist_items'
    id: Mapped[int] = mapped_column(primary_key=True)
    playlist_id: Mapped[int] = mapped_column(ForeignKey('playlists.id', ondelete='CASCADE'), index=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    playlist: Mapped[Playlist] = relationship(back_populates='items')


class History(Base, TrackFields):
    __tablename__ = 'history'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    played_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class Favorite(Base, TrackFields):
    __tablename__ = 'favorites'
    __table_args__ = (UniqueConstraint('user_id', 'video_id', name='uq_favorite_user_video'),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CatalogTrack(Base, TrackFields):
    """Small metadata cache. Genres are a JSON-like comma-separated value, never a secret."""
    __tablename__ = 'catalog_tracks'
    __table_args__ = (UniqueConstraint('video_id', name='uq_catalog_video'), Index('ix_catalog_artist_album', 'artist', 'album'))
    id: Mapped[int] = mapped_column(primary_key=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ListeningSession(Base, TrackFields):
    """Short-lived, progress-based playback evidence. Pruned after aggregation."""
    __tablename__ = 'listening_sessions'
    __table_args__ = (
        UniqueConstraint('user_id', 'session_key', name='uq_listening_session_key'),
        Index('ix_listening_user_started', 'user_id', 'started_at'),
        Index('ix_listening_user_video_started', 'user_id', 'video_id', 'started_at'),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    session_key: Mapped[str] = mapped_column(String(64))
    listened_seconds: Mapped[int] = mapped_column(Integer, default=0)
    counted_play: Mapped[bool] = mapped_column(Boolean, default=False)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    skipped_early: Mapped[bool] = mapped_column(Boolean, default=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_event_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class UserTrackAffinity(Base, TrackFields):
    __tablename__ = 'user_track_affinities'
    __table_args__ = (UniqueConstraint('user_id', 'video_id', name='uq_track_affinity'), Index('ix_track_affinity_user_score', 'user_id', 'affinity_score'))
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    play_count: Mapped[int] = mapped_column(Integer, default=0)
    completed_count: Mapped[int] = mapped_column(Integer, default=0)
    skipped_count: Mapped[int] = mapped_column(Integer, default=0)
    listened_seconds: Mapped[int] = mapped_column(Integer, default=0)
    affinity_score: Mapped[int] = mapped_column(Integer, default=0)
    last_played_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class UserEntityAffinity(Base):
    __tablename__ = 'user_entity_affinities'
    __table_args__ = (UniqueConstraint('user_id', 'entity_type', 'entity_key', name='uq_entity_affinity'), Index('ix_entity_affinity_user_type_score', 'user_id', 'entity_type', 'affinity_score'))
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    entity_type: Mapped[str] = mapped_column(String(16))  # artist, album or genre
    entity_key: Mapped[str] = mapped_column(String(500))
    label: Mapped[str] = mapped_column(String(500))
    play_count: Mapped[int] = mapped_column(Integer, default=0)
    listened_seconds: Mapped[int] = mapped_column(Integer, default=0)
    affinity_score: Mapped[int] = mapped_column(Integer, default=0)
    last_played_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ListeningDaily(Base):
    __tablename__ = 'listening_daily'
    __table_args__ = (UniqueConstraint('user_id', 'day', name='uq_listening_daily'), Index('ix_listening_daily_user_day', 'user_id', 'day'))
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    day: Mapped[date] = mapped_column(Date)
    listened_seconds: Mapped[int] = mapped_column(Integer, default=0)
    play_count: Mapped[int] = mapped_column(Integer, default=0)
    completion_count: Mapped[int] = mapped_column(Integer, default=0)
    early_skip_count: Mapped[int] = mapped_column(Integer, default=0)


class ListeningHour(Base):
    __tablename__ = 'listening_hours'
    __table_args__ = (UniqueConstraint('user_id', 'hour', name='uq_listening_hour'),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    hour: Mapped[int] = mapped_column(Integer)
    listened_seconds: Mapped[int] = mapped_column(Integer, default=0)


class RecommendationPreference(Base):
    __tablename__ = 'recommendation_preferences'
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    seed_terms: Mapped[str] = mapped_column(Text, default='')
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class RecommendationExclusion(Base):
    __tablename__ = 'recommendation_exclusions'
    __table_args__ = (UniqueConstraint('user_id', 'video_id', name='uq_recommendation_exclusion'), Index('ix_recommendation_exclusion_user', 'user_id'))
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    video_id: Mapped[str] = mapped_column(String(32))
    reason: Mapped[str] = mapped_column(String(32), default='not_recommend')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DailyMix(Base):
    __tablename__ = 'daily_mixes'
    __table_args__ = (UniqueConstraint('user_id', 'mix_date', name='uq_daily_mix_user_date'), Index('ix_daily_mix_user_date', 'user_id', 'mix_date'))
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    mix_date: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DailyMixItem(Base, TrackFields):
    __tablename__ = 'daily_mix_items'
    __table_args__ = (UniqueConstraint('mix_id', 'position', name='uq_daily_mix_position'), UniqueConstraint('mix_id', 'video_id', name='uq_daily_mix_video'))
    id: Mapped[int] = mapped_column(primary_key=True)
    mix_id: Mapped[int] = mapped_column(ForeignKey('daily_mixes.id', ondelete='CASCADE'), index=True)
    position: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(String(300), default='')
    score: Mapped[int] = mapped_column(Integer, default=0)
