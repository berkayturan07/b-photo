from pathlib import Path

from config.settings.base import *  # noqa: F403

DEBUG = True

LOCAL_DATA_DIR = Path(__file__).resolve().parents[2] / ".local"
LOCAL_DATA_DIR.mkdir(parents=True, exist_ok=True)
DATABASES["default"]["NAME"] = LOCAL_DATA_DIR / "db.sqlite3"  # noqa: F405
