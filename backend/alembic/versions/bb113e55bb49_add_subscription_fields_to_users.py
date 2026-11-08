"""add_subscription_fields_to_users

Revision ID: bb113e55bb49
Revises: 776033857645
Create Date: 2026-10-19 02:46:09.861076

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bb113e55bb49'
down_revision: Union[str, Sequence[str], None] = '776033857645'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'users',
        sa.Column('subscription_tier', sa.String(length=50), nullable=False, server_default='free')
    )
    op.add_column(
        'users',
        sa.Column('subscription_status', sa.String(length=50), nullable=False, server_default='active')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'subscription_status')
    op.drop_column('users', 'subscription_tier')

