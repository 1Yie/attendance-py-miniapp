from app import db
from datetime import datetime


class AttendanceConfig(db.Model):
    """考勤设置表"""
    __tablename__ = 'attendance_configs'

    id = db.Column(db.Integer, primary_key=True)
    work_start = db.Column(db.Time, nullable=False)  # 上班时间
    work_end = db.Column(db.Time, nullable=False)    # 下班时间
    check_in_limit = db.Column(db.Integer, nullable=False, default=1)
    check_out_limit = db.Column(db.Integer, nullable=False, default=1)
    makeup_limit_per_month = db.Column(db.Integer, nullable=False, default=3)
    makeup_requires_approval = db.Column(db.Boolean, nullable=False, default=True)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)

    def to_dict(self):
        return {
            'id': self.id,
            'work_start': self.work_start.strftime('%H:%M'),
            'work_end': self.work_end.strftime('%H:%M'),
            'check_in_limit': self.check_in_limit,
            'check_out_limit': self.check_out_limit,
            'makeup_limit_per_month': self.makeup_limit_per_month,
            'makeup_requires_approval': self.makeup_requires_approval,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class MakeupRequest(db.Model):
    """补卡申请表"""
    __tablename__ = 'makeup_requests'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    record_type = db.Column(db.String(20), nullable=False)
    target_time = db.Column(db.DateTime, nullable=False)
    reason = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(20), nullable=False, default='pending')
    reviewer_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    reviewer_comment = db.Column(db.String(200))
    reviewed_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.now, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now, nullable=False)

    user = db.relationship('User', foreign_keys=[user_id])
    reviewer = db.relationship('User', foreign_keys=[reviewer_id])

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user_name': self.user.name if self.user else None,
            'record_type': self.record_type,
            'target_time': self.target_time.isoformat(),
            'reason': self.reason,
            'status': self.status,
            'reviewer_id': self.reviewer_id,
            'reviewer_name': self.reviewer.name if self.reviewer else None,
            'reviewer_comment': self.reviewer_comment,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'created_at': self.created_at.isoformat(),
        }


class AttendanceRecord(db.Model):
    """打卡记录表"""
    __tablename__ = 'attendance_records'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), index=True, nullable=False)
    record_date = db.Column(db.Date, nullable=False, index=True)
    check_time = db.Column(db.DateTime, default=datetime.now, nullable=False)
    record_type = db.Column(db.String(20), nullable=False)  # check_in, check_out
    status = db.Column(db.String(20), nullable=False)       # normal, late, early_leave
    is_manual = db.Column(db.Boolean, default=False, nullable=False)  # 是否为补卡
    remark = db.Column(db.String(200))
    makeup_request_id = db.Column(db.Integer, db.ForeignKey('makeup_requests.id'), unique=True)
    created_at = db.Column(db.DateTime, default=datetime.now, nullable=False)

    user = db.relationship('User')
    makeup_request = db.relationship('MakeupRequest')

    __table_args__ = (
        db.Index('ix_attendance_records_user_date_type', 'user_id', 'record_date', 'record_type'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user_name': self.user.name if self.user else None,
            'record_date': self.record_date.isoformat(),
            'check_time': self.check_time.isoformat(),
            'record_type': self.record_type,
            'status': self.status,
            'is_manual': self.is_manual,
            'remark': self.remark,
            'makeup_request_id': self.makeup_request_id,
        }
