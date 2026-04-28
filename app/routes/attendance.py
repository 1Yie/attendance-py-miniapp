from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request

from app import db
from app.models import AttendanceConfig, AttendanceRecord, MakeupRequest
from app.services.auth import get_current_user

attendance_bp = Blueprint('attendance', __name__)


def _json_error(message, status_code):
    return jsonify({'message': message}), status_code


def _get_user(admin_only=False):
    user = get_current_user()
    if user is None:
        return None, _json_error('未登录或登录已失效', 401)
    if admin_only and user.role != 'admin':
        return None, _json_error('仅管理员可操作', 403)
    return user, None


def _parse_time_value(value, field_name):
    try:
        return datetime.strptime(value, '%H:%M').time()
    except (TypeError, ValueError):
        raise ValueError(f'{field_name} 需要使用 HH:MM 格式')


def _parse_datetime_value(value):
    if not value:
        raise ValueError('target_time 不能为空')

    candidates = ('%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%dT%H:%M')
    for fmt in candidates:
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue

    raise ValueError('target_time 需要使用 YYYY-MM-DD HH:MM[:SS] 格式')


def _get_config():
    return AttendanceConfig.query.order_by(AttendanceConfig.id.asc()).first()


def _count_records(user_id, record_date, record_type, exclude_request_id=None):
    query = AttendanceRecord.query.filter_by(
        user_id=user_id,
        record_date=record_date,
        record_type=record_type,
    )
    if exclude_request_id is not None:
        query = query.filter(AttendanceRecord.makeup_request_id != exclude_request_id)
    return query.count()


def _build_status(record_type, check_time, config):
    if record_type == 'check_in':
        return 'late' if check_time.time() > config.work_start else 'normal'
    return 'early_leave' if check_time.time() < config.work_end else 'normal'


def _record_limit(config, record_type):
    return config.check_in_limit if record_type == 'check_in' else config.check_out_limit


def _create_record(user, record_type, check_time, config, is_manual=False, remark=None, makeup_request_id=None):
    record_date = check_time.date()
    if _count_records(user.id, record_date, record_type, exclude_request_id=makeup_request_id) >= _record_limit(config, record_type):
        raise ValueError('当天该打卡类型已达到次数上限')

    record = AttendanceRecord(
        user_id=user.id,
        record_date=record_date,
        check_time=check_time,
        record_type=record_type,
        status=_build_status(record_type, check_time, config),
        is_manual=is_manual,
        remark=remark,
        makeup_request_id=makeup_request_id,
    )
    db.session.add(record)
    return record


def _makeup_count_this_month(user_id, target_time):
    month_start = target_time.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    next_month = (month_start + timedelta(days=32)).replace(day=1)
    return MakeupRequest.query.filter(
        MakeupRequest.user_id == user_id,
        MakeupRequest.target_time >= month_start,
        MakeupRequest.target_time < next_month,
        MakeupRequest.status.in_(['pending', 'approved']),
    ).count()


@attendance_bp.route('/check_in', methods=['POST'])
def check_in():
    user, error = _get_user()
    if error:
        return error

    config = _get_config()
    try:
        record = _create_record(user, 'check_in', datetime.now(), config)
        db.session.commit()
    except ValueError as exc:
        db.session.rollback()
        return _json_error(str(exc), 400)

    return jsonify({'message': '上班打卡成功', 'record': record.to_dict()})


@attendance_bp.route('/check_out', methods=['POST'])
def check_out():
    user, error = _get_user()
    if error:
        return error

    config = _get_config()
    try:
        record = _create_record(user, 'check_out', datetime.now(), config)
        db.session.commit()
    except ValueError as exc:
        db.session.rollback()
        return _json_error(str(exc), 400)

    return jsonify({'message': '下班打卡成功', 'record': record.to_dict()})


@attendance_bp.route('/records', methods=['GET'])
def records():
    user, error = _get_user()
    if error:
        return error

    query = AttendanceRecord.query.order_by(AttendanceRecord.check_time.desc())
    if user.role != 'admin':
        query = query.filter_by(user_id=user.id)
    elif request.args.get('user_id'):
        query = query.filter_by(user_id=request.args.get('user_id', type=int))

    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    if start_date:
        try:
            query = query.filter(AttendanceRecord.record_date >= datetime.strptime(start_date, '%Y-%m-%d').date())
        except ValueError:
            return _json_error('start_date 需要使用 YYYY-MM-DD 格式', 400)
    if end_date:
        try:
            query = query.filter(AttendanceRecord.record_date <= datetime.strptime(end_date, '%Y-%m-%d').date())
        except ValueError:
            return _json_error('end_date 需要使用 YYYY-MM-DD 格式', 400)

    return jsonify({'records': [record.to_dict() for record in query.all()]})


@attendance_bp.route('/config', methods=['GET'])
def get_config():
    user, error = _get_user()
    if error:
        return error

    return jsonify({'config': _get_config().to_dict(), 'viewer_role': user.role})


@attendance_bp.route('/config', methods=['PUT'])
def update_config():
    _, error = _get_user(admin_only=True)
    if error:
        return error

    data = request.get_json(silent=True) or {}
    config = _get_config()

    try:
        if 'work_start' in data:
            config.work_start = _parse_time_value(data['work_start'], 'work_start')
        if 'work_end' in data:
            config.work_end = _parse_time_value(data['work_end'], 'work_end')
        if 'check_in_limit' in data:
            config.check_in_limit = int(data['check_in_limit'])
        if 'check_out_limit' in data:
            config.check_out_limit = int(data['check_out_limit'])
        if 'makeup_limit_per_month' in data:
            config.makeup_limit_per_month = int(data['makeup_limit_per_month'])
        if 'makeup_requires_approval' in data:
            config.makeup_requires_approval = bool(data['makeup_requires_approval'])
    except ValueError as exc:
        return _json_error(str(exc), 400)

    if config.check_in_limit < 0 or config.check_out_limit < 0 or config.makeup_limit_per_month < 0:
        return _json_error('打卡次数和补卡次数不能为负数', 400)

    db.session.commit()
    return jsonify({'message': '考勤设置已更新', 'config': config.to_dict()})


@attendance_bp.route('/makeup_requests', methods=['POST'])
def create_makeup_request():
    user, error = _get_user()
    if error:
        return error

    data = request.get_json(silent=True) or {}
    record_type = data.get('record_type')
    reason = (data.get('reason') or '').strip()
    config = _get_config()

    if record_type not in ('check_in', 'check_out'):
        return _json_error('record_type 只能是 check_in 或 check_out', 400)
    if not reason:
        return _json_error('补卡原因不能为空', 400)

    try:
        target_time = _parse_datetime_value(data.get('target_time'))
    except ValueError as exc:
        return _json_error(str(exc), 400)

    if target_time > datetime.now():
        return _json_error('不能为未来时间补卡', 400)

    if _makeup_count_this_month(user.id, target_time) >= config.makeup_limit_per_month:
        return _json_error('当月补卡次数已达到上限', 400)

    makeup_request = MakeupRequest(
        user_id=user.id,
        record_type=record_type,
        target_time=target_time,
        reason=reason,
        status='pending' if config.makeup_requires_approval else 'approved',
    )
    db.session.add(makeup_request)
    db.session.flush()

    try:
        if not config.makeup_requires_approval:
            _create_record(
                user,
                record_type,
                target_time,
                config,
                is_manual=True,
                remark=reason,
                makeup_request_id=makeup_request.id,
            )
    except ValueError as exc:
        db.session.rollback()
        return _json_error(str(exc), 400)

    db.session.commit()
    message = '补卡申请已提交' if config.makeup_requires_approval else '补卡已自动通过'
    return jsonify({'message': message, 'makeup_request': makeup_request.to_dict()})


@attendance_bp.route('/makeup_requests', methods=['GET'])
def list_makeup_requests():
    user, error = _get_user()
    if error:
        return error

    query = MakeupRequest.query.order_by(MakeupRequest.created_at.desc())
    if user.role != 'admin':
        query = query.filter_by(user_id=user.id)
    elif request.args.get('user_id'):
        query = query.filter_by(user_id=request.args.get('user_id', type=int))

    return jsonify({'makeup_requests': [item.to_dict() for item in query.all()]})


@attendance_bp.route('/makeup_requests/<int:request_id>/review', methods=['POST'])
def review_makeup_request(request_id):
    admin, error = _get_user(admin_only=True)
    if error:
        return error

    makeup_request = MakeupRequest.query.get_or_404(request_id)
    if makeup_request.status != 'pending':
        return _json_error('该补卡申请已经审核过', 400)

    data = request.get_json(silent=True) or {}
    action = data.get('action')
    reviewer_comment = (data.get('reviewer_comment') or '').strip()

    if action not in ('approve', 'reject'):
        return _json_error('action 只能是 approve 或 reject', 400)

    makeup_request.reviewer_id = admin.id
    makeup_request.reviewer_comment = reviewer_comment
    makeup_request.reviewed_at = datetime.now()

    if action == 'reject':
        makeup_request.status = 'rejected'
        db.session.commit()
        return jsonify({'message': '补卡申请已驳回', 'makeup_request': makeup_request.to_dict()})

    config = _get_config()
    try:
        _create_record(
            makeup_request.user,
            makeup_request.record_type,
            makeup_request.target_time,
            config,
            is_manual=True,
            remark=makeup_request.reason,
            makeup_request_id=makeup_request.id,
        )
    except ValueError as exc:
        db.session.rollback()
        return _json_error(str(exc), 400)

    makeup_request.status = 'approved'
    db.session.commit()
    return jsonify({'message': '补卡申请已通过', 'makeup_request': makeup_request.to_dict()})
