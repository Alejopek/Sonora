"""Store the linked Last.fm username per account."""

from alembic import op
import sqlalchemy as sa

revision = '0002_lastfm_link'
down_revision = '0001_listening_insights'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('lastfm_username', sa.String(length=64), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'lastfm_username')
