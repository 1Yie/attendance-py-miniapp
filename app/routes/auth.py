from datetime import datetime

from flask import Blueprint, abort, jsonify, request

from app import db
from app.models import User
from app.services.auth import generate_token, get_current_user
from app.services.validation import validate_password, validate_phone

auth_bp = Blueprint('auth', __name__)


def _json_error(message, status_code):
    return jsonify({'message': message}), status_code


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    try:
        phone = validate_phone(data.get('phone'))
        password = validate_password(data.get('password'))
    except ValueError as exc:
        return _json_error(str(exc), 400)

    user = User.query.filter_by(phone=phone).first()
    if user is None or not user.check_password(password):
        return _json_error('手机号或密码错误', 401)

    user.last_login_at = datetime.now()
    db.session.commit()

    return jsonify({
        'message': '登录成功',
        'token': generate_token(user),
        'user': user.to_dict(),
    })


@auth_bp.route('/me', methods=['GET'])
def me():
    user = get_current_user()
    if user is None:
        return _json_error('未登录或登录已失效', 401)

    return jsonify({'user': user.to_dict()})


def _get_admin():
    user = get_current_user()
    if user is None:
        return None, _json_error('未登录或登录已失效', 401)
    if user.role != 'admin':
        return None, _json_error('仅管理员可操作', 403)
    return user, None


@auth_bp.route('/users', methods=['POST'])
def create_user():
    _, error = _get_admin()
    if error:
        return error

    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    position = (data.get('position') or '').strip()
    role = (data.get('role') or 'employee').strip()

    try:
        phone = validate_phone(data.get('phone'))
        password = validate_password(data.get('password'))
    except ValueError as exc:
        return _json_error(str(exc), 400)

    if not name or not position:
        return _json_error('创建账号需要姓名和职位', 400)
    if role not in ('employee', 'admin'):
        return _json_error('role 只能是 employee 或 admin', 400)
    if User.query.filter_by(phone=phone).first() is not None:
        return _json_error('手机号已存在', 409)

    user = User(phone=phone, name=name, position=position, role=role)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    return jsonify({'message': '账号创建成功', 'user': user.to_dict()}), 201


@auth_bp.route('/users', methods=['GET'])
def list_users():
    _, error = _get_admin()
    if error:
        return error

    users = User.query.order_by(User.created_at.asc()).all()
    return jsonify({'users': [user.to_dict() for user in users]})


@auth_bp.route('/users/<int:user_id>', methods=['PUT'])
def update_user(user_id):
    _, error = _get_admin()
    if error:
        return error

    user = db.session.get(User, user_id)
    if user is None:
        abort(404)

    data = request.get_json(silent=True) or {}

    if 'phone' in data:
        try:
            phone = validate_phone(data.get('phone'))
        except ValueError as exc:
            return _json_error(str(exc), 400)
        duplicate = User.query.filter(User.phone == phone, User.id != user.id).first()
        if duplicate is not None:
            return _json_error('手机号已存在', 409)
        user.phone = phone

    if 'name' in data:
        name = (data.get('name') or '').strip()
        if not name:
            return _json_error('姓名不能为空', 400)
        user.name = name

    if 'position' in data:
        position = (data.get('position') or '').strip()
        if not position:
            return _json_error('职位不能为空', 400)
        user.position = position
        
    if 'role' in data:
        role = (data.get('role') or '').strip()
        if role not in ('employee', 'admin'):
            return _json_error('role 只能是 employee 或 admin', 400)
        user.role = role

    if 'password' in data and str(data.get('password') or '').strip():
        try:
            user.set_password(validate_password(data.get('password')))
        except ValueError as exc:
            return _json_error(str(exc), 400)

    db.session.commit()
    return jsonify({'message': '账号更新成功', 'user': user.to_dict()})
