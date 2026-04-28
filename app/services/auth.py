from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from flask import current_app, request

from app import db
from app.models import User


def _serializer():
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt='attendance-auth')


def generate_token(user):
    return _serializer().dumps({'user_id': user.id})


def get_token_from_request():
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        return auth_header[7:].strip()

    return request.headers.get('X-Auth-Token')


def get_current_user():
    token = get_token_from_request()
    if not token:
        return None

    try:
        payload = _serializer().loads(token, max_age=current_app.config['TOKEN_MAX_AGE'])
    except (BadSignature, SignatureExpired):
        return None

    return db.session.get(User, payload.get('user_id'))
