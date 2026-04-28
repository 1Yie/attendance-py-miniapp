import re


CHINA_MAINLAND_PHONE_PATTERN = re.compile(r'^1[3-9]\d{9}$')


def normalize_phone(phone):
    if phone is None:
        return ''
    return str(phone).strip()


def validate_phone(phone):
    normalized_phone = normalize_phone(phone)
    if not CHINA_MAINLAND_PHONE_PATTERN.match(normalized_phone):
        raise ValueError('手机号必须是 11 位中国大陆手机号')
    return normalized_phone


def validate_password(password):
    if password is None:
        raise ValueError('密码不能为空')

    password = str(password)
    if len(password) < 8:
        raise ValueError('密码长度不能少于 8 位')

    return password
