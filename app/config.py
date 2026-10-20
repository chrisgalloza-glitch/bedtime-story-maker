"""Runtime configuration from environment variables."""
from __future__ import annotations

import os
from pathlib import Path

FAMILY_PIN = os.environ.get("FAMILY_PIN", "1234").strip()
GEMINI_API_KEY = (
    os.environ.get("GEMINI_API_KEY")
    or os.environ.get("GOOGLE_API_KEY")
    or ""
).strip()
XAI_API_KEY = os.environ.get("XAI_API_KEY", "").strip()
MOCK_LLM = os.environ.get("MOCK_LLM", "0").strip() in ("1", "true", "True", "yes")

GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")
XAI_MODEL = os.environ.get("XAI_MODEL", "grok-4.3")

VOICE = "en-US-AvaMultilingualNeural"
RATE = "-10%"
DEFAULT_LENGTH = "medium"
TARGET_MIN_WORDS = 2800
TARGET_MAX_WORDS = 3300
TTS_CHUNK_CHARS = 4500
# User/plan guidance: keep Grok unary TTS chunks under 15k (API allows 60k)
XAI_TTS_CHUNK_CHARS = 14000
XAI_TTS_SPEED = 0.9
XAI_TTS_URL = "https://api.x.ai/v1/tts"

_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.environ.get("DATA_DIR", str(_ROOT / "data")))
STORIES_DIR = DATA_DIR / "stories"
PREVIEWS_DIR = DATA_DIR / "previews"
STATIC_DIR = _ROOT / "static"
STATIC_PREVIEWS_DIR = STATIC_DIR / "previews"
SESSION_COOKIE = "story_family"
SESSION_MAX_AGE = 60 * 60 * 24 * 30  # 30 days

STORIES_DIR.mkdir(parents=True, exist_ok=True)
PREVIEWS_DIR.mkdir(parents=True, exist_ok=True)
