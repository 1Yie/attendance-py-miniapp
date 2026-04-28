from flask import Flask
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from sqlalchemy import inspect

from config import Config

db = SQLAlchemy()
migrate = Migrate()


def _bootstrap_data(app):
    from app.models import AttendanceConfig, User
    from app.services.validation import validate_password, validate_phone

    inspector = inspect(db.engine)
    if not inspector.has_table('users') or not inspector.has_table('attendance_configs'):
        return

    user_columns = {column['name'] for column in inspector.get_columns('users')}
    if 'password_hash' not in user_columns:
        return

    admin_phone = validate_phone(app.config['ADMIN_PHONE'])
    admin_password = validate_password(app.config['ADMIN_PASSWORD'])

    admin = User.query.filter_by(phone=admin_phone).first()
    if admin is None:
        admin = User(
            phone=admin_phone,
            name=app.config['ADMIN_NAME'],
            position=app.config['ADMIN_POSITION'],
            role='admin',
        )
        admin.set_password(admin_password)
        db.session.add(admin)
    else:
        admin.phone = admin_phone
        admin.name = app.config['ADMIN_NAME']
        admin.position = app.config['ADMIN_POSITION']
        admin.role = 'admin'
        admin.set_password(admin_password)

    if AttendanceConfig.query.first() is None:
        db.session.add(
            AttendanceConfig(
                work_start=datetime.strptime(app.config['DEFAULT_WORK_START'], '%H:%M').time(),
                work_end=datetime.strptime(app.config['DEFAULT_WORK_END'], '%H:%M').time(),
            )
        )

    db.session.commit()


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)
    migrate.init_app(app, db)

    from app.routes.auth import auth_bp
    from app.routes.attendance import attendance_bp
    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(attendance_bp, url_prefix='/attendance')

    with app.app_context():
        from app import models  # noqa: F401

        _bootstrap_data(app)

    return app
