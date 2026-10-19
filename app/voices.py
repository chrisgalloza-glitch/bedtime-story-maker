"""Available bedtime voices (Ava free + Grok xAI TTS)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class Voice:
    id: str
    name: str
    description: str
    engine: str  # "edge" | "xai"
    xai_voice_id: str | None = None
    uses_credit: bool = False
    emoji: str = "🌙"


# Softest/warmest Grok voices for bedtime (docs.x.ai TTS voice list)
VOICES: list[Voice] = [
    Voice(
        id="ava",
        name="Ava",
        description="Warm free bedtime voice. Soft and calm — great every night.",
        engine="edge",
        emoji="🦆",
    ),
    Voice(
        id="luna",
        name="Luna",
        description="Gentle, patient, and nurturing — like a quiet hug at bedtime.",
        engine="xai",
        xai_voice_id="luna",
        uses_credit=True,
        emoji="🌙",
    ),
    Voice(
        id="carina",
        name="Carina",
        description="Soft, empathetic, and soothing — a cozy storyteller.",
        engine="xai",
        xai_voice_id="carina",
        uses_credit=True,
        emoji="✨",
    ),
    Voice(
        id="orion",
        name="Orion",
        description="Rich, calm storyteller — a gentle voice for long journeys.",
        engine="xai",
        xai_voice_id="orion",
        uses_credit=True,
        emoji="⭐",
    ),
]

DEFAULT_VOICE_ID = "ava"
_BY_ID = {v.id: v for v in VOICES}

PREVIEW_EN = (
    "Once upon a time, the moon smiled over a quiet pond. "
    "A little duck floated softly, ready for sweet dreams."
)
PREVIEW_ES = (
    "Había una vez una luna suave sobre un estanque quieto. "
    "Un patito flotaba despacio, listo para dulces sueños."
)


def get_voice(voice_id: str | None) -> Voice:
    if not voice_id:
        return _BY_ID[DEFAULT_VOICE_ID]
    v = _BY_ID.get(voice_id.strip().lower())
    return v or _BY_ID[DEFAULT_VOICE_ID]


def list_voices_public() -> list[dict[str, Any]]:
    return [
        {
            "id": v.id,
            "name": v.name,
            "description": v.description,
            "engine": v.engine,
            "uses_credit": v.uses_credit,
            "emoji": v.emoji,
            "default": v.id == DEFAULT_VOICE_ID,
        }
        for v in VOICES
    ]


def preview_text(lang: str) -> str:
    return PREVIEW_ES if lang.lower().startswith("es") else PREVIEW_EN


def tts_language_code(ui_language: str) -> str:
    """Map UI language to xAI TTS BCP-47 code."""
    if ui_language.lower().startswith("es"):
        return "es-MX"
    return "en"
