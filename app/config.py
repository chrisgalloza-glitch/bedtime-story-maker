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
TARGET_MIN_WORDS = 2800
TARGET_MAX_WORDS = 3300
TTS_CHUNK_CHARS = 4500

DATA_DIR = Path(os.environ.get("DATA_DIR", str(Path(__file__).resolve().parent.parent / "data")))
STORIES_DIR = DATA_DIR / "stories"
SESSION_COOKIE = "story_family"
SESSION_MAX_AGE = 60 * 60 * 24 * 30  # 30 days

STORIES_DIR.mkdir(parents=True, exist_ok=True)
