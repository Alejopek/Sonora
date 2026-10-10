"""listening insights, recommendation cache and safe legacy upgrades"""
from alembic import op
import sqlalchemy as sa

revision = '0001_listening_insights'
down_revision = None
branch_labels = None
depends_on = None


def _tables(bind):
    return set(sa.inspect(bind).get_table_names())


def _columns(bind, table):
    return {column['name'] for column in sa.inspect(bind).get_columns(table)}


def _base_track_columns():
    return [
        sa.Column('video_id', sa.String(length=32), nullable=False), sa.Column('title', sa.String(length=300), nullable=False),
        sa.Column('artist', sa.String(length=300), nullable=False, server_default=''), sa.Column('artist_id', sa.String(length=128), nullable=True),
        sa.Column('album', sa.String(length=300), nullable=False, server_default=''), sa.Column('album_id', sa.String(length=128), nullable=True),
        sa.Column('genres', sa.Text(), nullable=False, server_default=''), sa.Column('duration', sa.Integer(), nullable=True),
        sa.Column('thumbnail_url', sa.Text(), nullable=False, server_default=''),
    ]


def _create_legacy_tables(bind):
    tables = _tables(bind)
    if 'users' not in tables:
        op.create_table('users', sa.Column('id', sa.Integer(), primary_key=True), sa.Column('username', sa.String(50), nullable=False, unique=True), sa.Column('email', sa.String(255), nullable=False, unique=True), sa.Column('hashed_password', sa.String(255), nullable=False), sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')))
        op.create_index('ix_users_username', 'users', ['username'])
        op.create_index('ix_users_email', 'users', ['email'])
    tables = _tables(bind)
    if 'playlists' not in tables:
        op.create_table('playlists', sa.Column('id', sa.Integer(), primary_key=True), sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False), sa.Column('title', sa.String(140), nullable=False), sa.Column('description', sa.Text(), nullable=False, server_default=''), sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')))
        op.create_index('ix_playlists_user_id', 'playlists', ['user_id'])
    for name, extra in [('playlist_items', [sa.Column('playlist_id', sa.Integer(), sa.ForeignKey('playlists.id', ondelete='CASCADE'), nullable=False), sa.Column('position', sa.Integer(), nullable=False, server_default='0'), sa.Column('added_at', sa.DateTime(timezone=True), server_default=sa.text('now()'))]), ('history', [sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False), sa.Column('played_at', sa.DateTime(timezone=True), server_default=sa.text('now()'))]), ('favorites', [sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False), sa.Column('added_at', sa.DateTime(timezone=True), server_default=sa.text('now()'))])]:
        if name not in _tables(bind):
            op.create_table(name, sa.Column('id', sa.Integer(), primary_key=True), *extra, *_base_track_columns())
            for column in ('user_id' if name != 'playlist_items' else 'playlist_id', 'video_id'):
                op.create_index(f'ix_{name}_{column}', name, [column])
    if 'favorites' in _tables(bind):
        op.execute('CREATE UNIQUE INDEX IF NOT EXISTS uq_favorite_user_video ON favorites (user_id, video_id)')


def _add_legacy_metadata(bind):
    for table in ('playlist_items', 'history', 'favorites'):
        present = _columns(bind, table)
        for column in _base_track_columns():
            if column.name not in present:
                op.add_column(table, column)
        if table == 'history':
            op.execute('CREATE INDEX IF NOT EXISTS ix_history_user_played ON history (user_id, played_at DESC)')


def upgrade() -> None:
    bind = op.get_bind()
    _create_legacy_tables(bind)
    _add_legacy_metadata(bind)
    tables = _tables(bind)
    if 'catalog_tracks' not in tables:
        op.create_table('catalog_tracks', sa.Column('id', sa.Integer(), primary_key=True), *_base_track_columns(), sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')), sa.UniqueConstraint('video_id', name='uq_catalog_video'))
        op.create_index('ix_catalog_artist_album', 'catalog_tracks', ['artist', 'album'])
    if 'listening_sessions' not in tables:
        op.create_table('listening_sessions', sa.Column('id', sa.Integer(), primary_key=True), sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False), sa.Column('session_key', sa.String(64), nullable=False), *_base_track_columns(), sa.Column('listened_seconds', sa.Integer(), nullable=False, server_default='0'), sa.Column('counted_play', sa.Boolean(), nullable=False, server_default=sa.false()), sa.Column('completed', sa.Boolean(), nullable=False, server_default=sa.false()), sa.Column('skipped_early', sa.Boolean(), nullable=False, server_default=sa.false()), sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.text('now()')), sa.Column('last_event_at', sa.DateTime(timezone=True), server_default=sa.text('now()')), sa.UniqueConstraint('user_id', 'session_key', name='uq_listening_session_key'))
        op.create_index('ix_listening_user_started', 'listening_sessions', ['user_id', 'started_at'])
        op.create_index('ix_listening_user_video_started', 'listening_sessions', ['user_id', 'video_id', 'started_at'])
    if 'user_track_affinities' not in tables:
        op.create_table('user_track_affinities', sa.Column('id', sa.Integer(), primary_key=True), sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False), *_base_track_columns(), sa.Column('play_count', sa.Integer(), nullable=False, server_default='0'), sa.Column('completed_count', sa.Integer(), nullable=False, server_default='0'), sa.Column('skipped_count', sa.Integer(), nullable=False, server_default='0'), sa.Column('listened_seconds', sa.Integer(), nullable=False, server_default='0'), sa.Column('affinity_score', sa.Integer(), nullable=False, server_default='0'), sa.Column('last_played_at', sa.DateTime(timezone=True)), sa.UniqueConstraint('user_id', 'video_id', name='uq_track_affinity'))
        op.create_index('ix_track_affinity_user_score', 'user_track_affinities', ['user_id', 'affinity_score'])
    if 'user_entity_affinities' not in tables:
        op.create_table('user_entity_affinities', sa.Column('id', sa.Integer(), primary_key=True), sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False), sa.Column('entity_type', sa.String(16), nullable=False), sa.Column('entity_key', sa.String(500), nullable=False), sa.Column('label', sa.String(500), nullable=False), sa.Column('play_count', sa.Integer(), nullable=False, server_default='0'), sa.Column('listened_seconds', sa.Integer(), nullable=False, server_default='0'), sa.Column('affinity_score', sa.Integer(), nullable=False, server_default='0'), sa.Column('last_played_at', sa.DateTime(timezone=True)), sa.UniqueConstraint('user_id', 'entity_type', 'entity_key', name='uq_entity_affinity'))
        op.create_index('ix_entity_affinity_user_type_score', 'user_entity_affinities', ['user_id', 'entity_type', 'affinity_score'])
    if 'listening_daily' not in tables:
        op.create_table('listening_daily', sa.Column('id', sa.Integer(), primary_key=True), sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False), sa.Column('day', sa.Date(), nullable=False), sa.Column('listened_seconds', sa.Integer(), nullable=False, server_default='0'), sa.Column('play_count', sa.Integer(), nullable=False, server_default='0'), sa.Column('completion_count', sa.Integer(), nullable=False, server_default='0'), sa.Column('early_skip_count', sa.Integer(), nullable=False, server_default='0'), sa.UniqueConstraint('user_id', 'day', name='uq_listening_daily'))
        op.create_index('ix_listening_daily_user_day', 'listening_daily', ['user_id', 'day'])
    if 'listening_hours' not in tables:
        op.create_table('listening_hours', sa.Column('id', sa.Integer(), primary_key=True), sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False), sa.Column('hour', sa.Integer(), nullable=False), sa.Column('listened_seconds', sa.Integer(), nullable=False, server_default='0'), sa.UniqueConstraint('user_id', 'hour', name='uq_listening_hour'))
    if 'recommendation_preferences' not in tables:
        op.create_table('recommendation_preferences', sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True), sa.Column('seed_terms', sa.Text(), nullable=False, server_default=''), sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')))
    if 'recommendation_exclusions' not in tables:
        op.create_table('recommendation_exclusions', sa.Column('id', sa.Integer(), primary_key=True), sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False), sa.Column('video_id', sa.String(32), nullable=False), sa.Column('reason', sa.String(32), nullable=False, server_default='not_recommend'), sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')), sa.UniqueConstraint('user_id', 'video_id', name='uq_recommendation_exclusion'))
        op.create_index('ix_recommendation_exclusion_user', 'recommendation_exclusions', ['user_id'])
    if 'daily_mixes' not in tables:
        op.create_table('daily_mixes', sa.Column('id', sa.Integer(), primary_key=True), sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False), sa.Column('mix_date', sa.Date(), nullable=False), sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')), sa.UniqueConstraint('user_id', 'mix_date', name='uq_daily_mix_user_date'))
        op.create_index('ix_daily_mix_user_date', 'daily_mixes', ['user_id', 'mix_date'])
    if 'daily_mix_items' not in tables:
        op.create_table('daily_mix_items', sa.Column('id', sa.Integer(), primary_key=True), sa.Column('mix_id', sa.Integer(), sa.ForeignKey('daily_mixes.id', ondelete='CASCADE'), nullable=False), sa.Column('position', sa.Integer(), nullable=False), *_base_track_columns(), sa.Column('reason', sa.String(300), nullable=False, server_default=''), sa.Column('score', sa.Integer(), nullable=False, server_default='0'), sa.UniqueConstraint('mix_id', 'position', name='uq_daily_mix_position'), sa.UniqueConstraint('mix_id', 'video_id', name='uq_daily_mix_video'))


def downgrade() -> None:
    # This first migration intentionally preserves user listening data on downgrade.
    pass
