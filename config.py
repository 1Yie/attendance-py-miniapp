import os

from dotenv import load_dotenv


load_dotenv()


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'you-will-never-guess'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'sqlite:///attendance.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    TOKEN_MAX_AGE = int(os.environ.get('TOKEN_MAX_AGE', 604800))

    ADMIN_PHONE = os.environ.get('ADMIN_PHONE') or '13800000000'
    ADMIN_NAME = os.environ.get('ADMIN_NAME') or '管理员'
    ADMIN_POSITION = os.environ.get('ADMIN_POSITION') or '系统管理员'
    ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD') or 'Admin@123456'

    DEFAULT_WORK_START = os.environ.get('DEFAULT_WORK_START') or '09:00'
    DEFAULT_WORK_END = os.environ.get('DEFAULT_WORK_END') or '18:00'
