"""Local tests: MOCK_LLM, mocked xAI TTS, real Ava path."""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

os.environ["MOCK_LLM"] = "1"
os.environ["FAMILY_PIN"] = "4821"
os.environ["DATA_DIR"] = str(ROOT / "data")
os.environ["XAI_API_KEY"] = "test-fake-key"  # present so xAI path is attempted

from app import config  # noqa: E402
from app import story as story_mod  # noqa: E402
from app.voices import get_voice, list_voices_public  # noqa: E402


def test_voice_catalog():
    ids = {v["id"] for v in list_voices_public()}
    assert ids == {"ava", "luna", "carina", "orion"}
    assert get_voice("nope").id == "ava"
    assert get_voice("LUNA").id == "luna"
    print("catalog OK")


def test_split_xai():
    long = ("Paragraph one. " * 200) + "\n\n" + ("Paragraph two. " * 200)
    chunks = story_mod.split_for_xai(long, 500)
    assert len(chunks) >= 2
    assert all(len(c) <= 500 for c in chunks)
    print("split_for_xai OK", len(chunks))


def test_ava_real():
    audio = asyncio.run(
        story_mod.synthesize_story(
            "Once upon a time. The end.",
            voice_id="ava",
            language="English",
        )
    )
    assert len(audio) > 2000
    print("ava real TTS OK", len(audio))


def test_xai_mocked_and_fallback():
    # Mock xAI returns a real small MP3 (from committed Ava preview), then fails → Ava fallback
    tiny = (ROOT / "static/previews/ava-en.mp3").read_bytes()[:12000]
    assert len(tiny) > 1000

    calls = {"n": 0}

    def fake_tts(text, voice_id, language, speed=None):
        calls["n"] += 1
        if calls["n"] == 1:
            return tiny
        raise RuntimeError("simulated xAI failure")

    progress_msgs = []

    # Avoid more edge-tts during fallback by also patching edge synth to return tiny
    async def fake_edge(text, voice, rate):
        return tiny

    with patch.object(story_mod, "_call_xai_tts", side_effect=fake_tts), patch.object(
        story_mod, "_synth_chunk_edge", side_effect=fake_edge
    ):
        with patch.object(config, "XAI_TTS_CHUNK_CHARS", 40):
            text = "First soft sentence here. Second soft sentence here. Third one too."
            audio = asyncio.run(
                story_mod.synthesize_story(
                    text,
                    voice_id="luna",
                    language="English",
                    progress=progress_msgs.append,
                )
            )
    assert len(audio) > 2000
    assert calls["n"] >= 1
    joined = " ".join(progress_msgs)
    assert "Luna" in joined
    assert (
        "Ava" in joined
        or "trouble" in joined.lower()
        or "switched" in joined.lower()
        or "finishing" in joined.lower()
    )
    print("xai mock + fallback OK", len(audio), "msgs:", progress_msgs)


def test_preview_cache_ava():
    from app import previews as previews_mod

    path = previews_mod.ensure_preview("ava", "en")
    assert path.is_file() and path.stat().st_size > 1000
    print("preview ava OK", path, path.stat().st_size)


def test_unknown_voice_falls_to_ava():
    msgs = []
    tiny = (ROOT / "static/previews/ava-en.mp3").read_bytes()[:8000]

    async def fake_edge(text, voice, rate):
        return tiny

    with patch.object(story_mod, "_synth_chunk_edge", side_effect=fake_edge):
        audio = asyncio.run(
            story_mod.synthesize_story(
                "Soft night. The end.",
                voice_id="totally-unknown",
                language="English",
                progress=msgs.append,
            )
        )
    assert len(audio) > 1000
    assert any("Ava" in m for m in msgs)
    print("unknown→ava OK")


if __name__ == "__main__":
    test_voice_catalog()
    test_split_xai()
    test_preview_cache_ava()
    test_ava_real()
    test_xai_mocked_and_fallback()
    test_unknown_voice_falls_to_ava()
    print("== ALL VOICE TESTS PASSED ==")
