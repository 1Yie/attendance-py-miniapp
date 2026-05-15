"""add attendance sessions

Revision ID: 7f8c2c1e3b9a
Revises: 154b444d80e5
Create Date: 2026-05-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '7f8c2c1e3b9a'
down_revision = '154b444d80e5'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if 'attendance_sessions' not in existing_tables:
        op.create_table(
            'attendance_sessions',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('teacher_id', sa.Integer(), nullable=False),
            sa.Column('deadline_at', sa.DateTime(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['teacher_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index(op.f('ix_attendance_sessions_deadline_at'), 'attendance_sessions', ['deadline_at'], unique=False)
        op.create_index(op.f('ix_attendance_sessions_teacher_id'), 'attendance_sessions', ['teacher_id'], unique=False)

    existing_tables = set(sa.inspect(bind).get_table_names())
    if 'attendance_session_submissions' not in existing_tables:
        op.create_table(
            'attendance_session_submissions',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('session_id', sa.Integer(), nullable=False),
            sa.Column('student_id', sa.Integer(), nullable=False),
            sa.Column('submitted_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['session_id'], ['attendance_sessions.id']),
            sa.ForeignKeyConstraint(['student_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('session_id', 'student_id', name='uq_attendance_session_submission_session_student'),
        )
        op.create_index(
            op.f('ix_attendance_session_submissions_session_id'),
            'attendance_session_submissions',
            ['session_id'],
            unique=False,
        )
        op.create_index(
            op.f('ix_attendance_session_submissions_student_id'),
            'attendance_session_submissions',
            ['student_id'],
            unique=False,
        )


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if 'attendance_session_submissions' in existing_tables:
        op.drop_index(op.f('ix_attendance_session_submissions_student_id'), table_name='attendance_session_submissions')
        op.drop_index(op.f('ix_attendance_session_submissions_session_id'), table_name='attendance_session_submissions')
        op.drop_table('attendance_session_submissions')

    existing_tables = set(sa.inspect(bind).get_table_names())
    if 'attendance_sessions' in existing_tables:
        op.drop_index(op.f('ix_attendance_sessions_teacher_id'), table_name='attendance_sessions')
        op.drop_index(op.f('ix_attendance_sessions_deadline_at'), table_name='attendance_sessions')
        op.drop_table('attendance_sessions')
