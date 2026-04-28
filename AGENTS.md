# AGENTS.md

## Scope
- This repo is a very small Flask API skeleton for an attendance system. The user intent is to build attendance features in Chinese: `打卡上下班`, `打卡记录`, `打卡考勤设置`, `补卡`.
- Current code only implements one placeholder endpoint: `POST /attendance/check_in` in `app/routes/attendance.py`. Do not assume the other attendance features already exist.

## Runtime
- Python requirement is `>=3.14` from `pyproject.toml`.
- Dependencies are managed by `uv`; lockfile is `uv.lock`.
- Fastest verified command to run app code is `uv run python run.py` from repo root.
- Flask CLI is wired for migrations and route inspection through `uv run flask --app run.py ...`.
- Verified smoke check: `uv run python -c "from run import app; client = app.test_client(); response = client.post('/attendance/check_in'); print(response.status_code)"`

## App Wiring
- Flask app factory is `app.create_app()` in `app/__init__.py`.
- `run.py` imports `create_app()` and exposes `app` at module scope.
- Registered blueprints are `auth_bp` at `/auth` and `attendance_bp` at `/attendance`.
- `db = SQLAlchemy()` and `migrate = Migrate()` are initialized in `app/__init__.py`.

## Auth
- Login is now `手机号 + 密码`, not the older placeholder `手机号 + 姓名 + 职位` flow.
- Admin should create employee accounts through `POST /auth/users`; normal login should not auto-create users.
- Phone validation is strict mainland China mobile format: `^1[3-9]\d{9}$`.
- Admin bootstrap account comes from `ADMIN_PHONE`, `ADMIN_NAME`, `ADMIN_POSITION`, `ADMIN_PASSWORD` in config/env.

## Data / Config
- Config lives in `config.py`, not inside the `app` package.
- Database URL comes from `DATABASE_URL`; default fallback remains `sqlite:///attendance.db`. With Flask this resolves under the instance path, so local SQLite ends up at `instance/attendance.db`.
- `SECRET_KEY` falls back to a hardcoded default if env is unset.
- MySQL is expected through SQLAlchemy URL form such as `mysql+pymysql://...`.

## Schema
- Current models live in `app/models/`: `User`, `AttendanceConfig`, `AttendanceRecord`, `MakeupRequest`.
- `User` stores `phone`, `name`, `position`, `role`, and `password_hash`.

## Current Gaps To Respect
- There is no test suite, no lint config, no formatter config, no CI workflow, and no task runner config in the repo.
- Because the repo is still minimal, prefer direct Flask/SQLAlchemy code over adding abstractions early.

## Change Guidance
- When adding attendance features, keep them under the existing Flask blueprint/app-factory structure unless the codebase actually grows enough to justify more packages.
- Database changes should go through Flask-Migrate. Current verified flow is `uv run flask --app run.py db migrate -m "..."` then `uv run flask --app run.py db upgrade`.
- Verify API changes with focused `uv run python -c ...` or Flask test-client checks if no formal tests are added.
