"""Voice preview cache: data/previews (preferred) → generate → static/ stand-in."""
from __future__ import annotations

import asyncio
from pathlib import Path

from . import config
from . import story as story_mod
from .voices import get_voice


def _names(voice_id: str, lang: str) -> str:
    lang_key = "es" if lang.lower().startswith("es") else "en"
    return f"{voice_id}-{lang_key}.mp3"


def preview_paths(voice_id: str, lang: str) -> tuple[Path, Path]:
    name = _names(voice_id, lang)
    return config.PREVIEWS_DIR / name, config.STATIC_PREVIEWS_DIR / name


def ensure_preview(voice_id: str, lang: str) -> Path:
    """Return path to preview MP3.

    Prefer freshly generated audio in DATA_DIR (survives until Render sleep).
    Committed static/previews files are stand-ins when generation is unavailable.
    """
    voice = get_voice(voice_id)
    disk, static = preview_paths(voice.id, lang)

    if disk.is_file() and disk.stat().st_size > 500:
        return disk

    # Try to generate (real Ava via edge-tts, or real Grok via xAI when key present)
    try:
        if voice.engine == "xai" and not config.XAI_API_KEY:
            raise RuntimeError("no XAI_API_KEY")
        audio = asyncio.run(story_mod.synthesize_preview(voice.id, lang))
        if audio and len(audio) >= 500:
            disk.parent.mkdir(parents=True, exist_ok=True)
            disk.write_bytes(audio)
            return disk
    except Exception:
        pass

    if static.is_file() and static.stat().st_size > 500:
        return static

    raise RuntimeError(f"Could not build preview for {voice.id}/{lang}")
