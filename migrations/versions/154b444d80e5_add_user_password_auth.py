"""add user password auth

Revision ID: 154b444d80e5
Revises: 
Create Date: 2026-04-28 10:51:00.818434

"""
from alembic import op
import sqlalchemy as sa
from werkzeug.security import generate_password_hash


# revision identifiers, used by Alembic.
revision = '154b444d80e5'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if 'users' not in existing_tables:
        op.create_table(
            'users',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('phone', sa.String(length=20), nullable=False),
            sa.Column('name', sa.String(length=50), nullable=False),
            sa.Column('position', sa.String(length=50), nullable=False),
            sa.Column('password_hash', sa.String(length=255), nullable=True),
            sa.Column('role', sa.String(length=20), nullable=False),
            sa.Column('last_login_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('phone'),
        )
        op.create_index(op.f('ix_users_phone'), 'users', ['phone'], unique=False)
    else:
        user_columns = {column['name'] for column in inspector.get_columns('users')}
        if 'password_hash' not in user_columns:
            with op.batch_alter_table('users', schema=None) as batch_op:
                batch_op.add_column(sa.Column('password_hash', sa.String(length=255), nullable=True))

    existing_tables = set(inspector.get_table_names())
    if 'attendance_configs' not in existing_tables:
        op.create_table(
            'attendance_configs',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('work_start', sa.Time(), nullable=False),
            sa.Column('work_end', sa.Time(), nullable=False),
            sa.Column('check_in_limit', sa.Integer(), nullable=False),
            sa.Column('check_out_limit', sa.Integer(), nullable=False),
            sa.Column('makeup_limit_per_month', sa.Integer(), nullable=False),
            sa.Column('makeup_requires_approval', sa.Boolean(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
        )

    existing_tables = set(inspector.get_table_names())
    if 'makeup_requests' not in existing_tables:
        op.create_table(
            'makeup_requests',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('record_type', sa.String(length=20), nullable=False),
            sa.Column('target_time', sa.DateTime(), nullable=False),
            sa.Column('reason', sa.Text(), nullable=False),
            sa.Column('status', sa.String(length=20), nullable=False),
            sa.Column('reviewer_id', sa.Integer(), nullable=True),
            sa.Column('reviewer_comment', sa.String(length=200), nullable=True),
            sa.Column('reviewed_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['reviewer_id'], ['users.id']),
            sa.ForeignKeyConstraint(['user_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index(op.f('ix_makeup_requests_user_id'), 'makeup_requests', ['user_id'], unique=False)

    existing_tables = set(inspector.get_table_names())
    if 'attendance_records' not in existing_tables:
        op.create_table(
            'attendance_records',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('record_date', sa.Date(), nullable=False),
            sa.Column('check_time', sa.DateTime(), nullable=False),
            sa.Column('record_type', sa.String(length=20), nullable=False),
            sa.Column('status', sa.String(length=20), nullable=False),
            sa.Column('is_manual', sa.Boolean(), nullable=False),
            sa.Column('remark', sa.String(length=200), nullable=True),
            sa.Column('makeup_request_id', sa.Integer(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['makeup_request_id'], ['makeup_requests.id']),
            sa.ForeignKeyConstraint(['user_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('makeup_request_id'),
        )
        op.create_index(op.f('ix_attendance_records_record_date'), 'attendance_records', ['record_date'], unique=False)
        op.create_index(op.f('ix_attendance_records_user_id'), 'attendance_records', ['user_id'], unique=False)
        op.create_index('ix_attendance_records_user_date_type', 'attendance_records', ['user_id', 'record_date', 'record_type'], unique=False)

    bind.execute(
        sa.text(
            """
            UPDATE users
            SET password_hash = :password_hash
            WHERE phone = :phone AND password_hash IS NULL
            """
        ),
        {
            'phone': '13800000000',
            'password_hash': generate_password_hash('Admin@123456'),
        },
    )


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if 'attendance_records' in existing_tables:
        with op.batch_alter_table('attendance_records', schema=None) as batch_op:
            batch_op.drop_index('ix_attendance_records_user_date_type')
        op.drop_index(op.f('ix_attendance_records_user_id'), table_name='attendance_records')
        op.drop_index(op.f('ix_attendance_records_record_date'), table_name='attendance_records')
        op.drop_table('attendance_records')

    if 'makeup_requests' in existing_tables:
        op.drop_index(op.f('ix_makeup_requests_user_id'), table_name='makeup_requests')
        op.drop_table('makeup_requests')

    if 'attendance_configs' in existing_tables:
        op.drop_table('attendance_configs')

    existing_tables = set(sa.inspect(bind).get_table_names())
    if 'users' in existing_tables:
        user_columns = {column['name'] for column in sa.inspect(bind).get_columns('users')}
        if 'password_hash' in user_columns:
            with op.batch_alter_table('users', schema=None) as batch_op:
                batch_op.drop_column('password_hash')
