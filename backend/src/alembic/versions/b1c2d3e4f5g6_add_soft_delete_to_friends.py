"""Add soft delete fields to friends table

Revision ID: b1c2d3e4f5g6
Revises: a1b2c3d4e5f6
Create Date: 2026-01-31 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1c2d3e4f5g6'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 添加软删除字段到 friends 表
    op.add_column('friends', sa.Column('deleted_by_user', sa.Boolean(), nullable=False, server_default='0'))
    op.add_column('friends', sa.Column('deleted_by_friend', sa.Boolean(), nullable=False, server_default='0'))


def downgrade() -> None:
    """Downgrade schema."""
    # 删除软删除字段
    op.drop_column('friends', 'deleted_by_friend')
    op.drop_column('friends', 'deleted_by_user')
