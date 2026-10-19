"""Story generation (Gemini / xAI / mock) and edge-tts synthesis."""
from __future__ import annotations

import asyncio
import json
import re
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Callable

from . import config

ProgressCB = Callable[..., None]  # progress(msg, percent=..., part=..., total=...)

SYSTEM_EN = """You are a warm, gentle bedtime storyteller for young children.
Write a calm, soothing, kid-safe bedtime story.
Rules:
- Soft, peaceful tone. No scary parts, violence, or anything frightening.
- Include a short title on the first line as: Title: <name>
- Aim for about 3,000 words (between 2,800 and 3,300).
- End softly so a child can fall asleep (a quiet closing, then "The end.").
- Use simple, warm language a young child understands.
- Do NOT add commentary, notes, or word counts — only the story."""

SYSTEM_ES = """Eres una narradora cálida y suave de cuentos para dormir para niños pequeños.
Escribe un cuento calmado, reconfortante y seguro para niños.
Reglas:
- Tono suave y tranquilo. Nada de miedo, violencia ni cosas asustadoras.
- Incluye un título corto en la primera línea así: Título: <nombre>
- Apunta a unas 3.000 palabras (entre 2.800 y 3.300).
- Termina con suavidad para que el niño pueda dormirse (un cierre quieto, luego "Fin.").
- Usa lenguaje simple y cálido que un niño pequeño entienda.
- NO añadas comentarios, notas ni conteos de palabras — solo el cuento."""

MOCK_STORY = """Title: The Little Duck and the Sparkly Pond

Once upon a time, on a quiet evening by a soft blue pond, a little duck named Pip wiggled her soft yellow feathers and looked up at the sky. The first stars were beginning to blink, like tiny night-lights for the whole wide world.

Pip loved bedtime. She loved the way the water went hush-hush against the reeds. She loved the way the moon painted a silver path across the pond. Tonight she had one gentle wish: to find a friend who also liked quiet, sparkly evenings.

She paddled slowly, so slowly, past a sleepy frog who was humming a tiny song. "Hello, Frog," whispered Pip. "Would you like to watch the stars with me?"
"Ribbit... maybe tomorrow," yawned the frog. "Tonight I am practicing my sleepy song."

Pip smiled and kept paddling. Soft moonlight shone on the sparkly water. Soft moonlight shone on the sparkly water. Soft moonlight shone on the sparkly water.

She found a floating leaf that looked like a little boat. She nudged it with her beak and giggled, because it spun in a slow circle, like a sleepy dancer. Around and around, slower and slower, until it rested.

Then Pip heard a tiny splash. Another duckling! Soft gray feathers, bright curious eyes. "I'm Dot," said the duckling. "I like quiet ponds too."
"I'm Pip," said Pip. "Want to float under the stars?"

So Pip and Dot floated side by side. They counted three stars. Then five. Then they stopped counting and just listened to the night. Crickets whispered. Reeds whispered. The pond whispered the softest story of all: rest, rest, rest.

They closed their eyes for a moment. The water held them like a blanket. Somewhere far away, a grown-up duck murmured goodnight.

Pip felt warm and safe. Dot felt warm and safe. The moon kept watch. The sparkly pond kept glittering, quieter and quieter, until even the glitter seemed to yawn.

And the little ducks dreamed of silver paths and gentle friends and mornings that would come softly, like a hug.

The end.
"""


def word_count(text: str) -> int:
    return len(re.findall(r"\b\w+\b", text))


def extract_title(story: str, language: str = "en") -> str:
    for line in story.splitlines()[:5]:
        m = re.match(r"^(?:Title|T[ií]tulo)\s*:\s*(.+)$", line.strip(), re.I)
        if m:
            title = m.group(1).strip().strip("*").strip('"').strip("'")
            if title:
                return title[:80]
    return "Mi Cuento" if language.lower().startswith("es") else "My Bedtime Story"


def sanitize_filename(name: str) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", name).strip(" .")
    return cleaned[:60] or "Bedtime Story"


def split_at_sentences(text: str, max_chars: int = config.TTS_CHUNK_CHARS) -> list[str]:
    text = text.strip()
    if not text:
        return []
    if len(text) <= max_chars:
        return [text]
    parts = re.split(r"(?<=[.!?…])\s+", text)
    chunks: list[str] = []
    current = ""
    for part in parts:
        if not part:
            continue
        candidate = (current + " " + part).strip() if current else part
        if len(candidate) <= max_chars:
            current = candidate
        else:
            if current:
                chunks.append(current)
            if len(part) <= max_chars:
                current = part
            else:
                while len(part) > max_chars:
                    chunks.append(part[:max_chars])
                    part = part[max_chars:]
                current = part
    if current:
        chunks.append(current)
    return chunks


def _call_gemini(api_key: str, system: str, user: str, max_tokens: int = 8192) -> str:
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{config.GEMINI_MODEL}:generateContent?key={api_key}"
    )
    body = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {"maxOutputTokens": max_tokens, "temperature": 1.0},
    }
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, headers={"Content-Type": "application/json"}, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Gemini error {e.code}: {err_body[:500]}") from e

    candidates = payload.get("candidates") or []
    if not candidates:
        raise RuntimeError(f"Gemini returned no candidates: {str(payload)[:500]}")
    parts = (candidates[0].get("content") or {}).get("parts") or []
    return "".join(p.get("text", "") for p in parts if "text" in p).strip()


def _call_xai(api_key: str, system: str, user: str, max_tokens: int = 8192) -> str:
    url = "https://api.x.ai/v1/chat/completions"
    body = {
        "model": config.XAI_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "max_tokens": max_tokens,
        "temperature": 0.9,
        "reasoning_effort": "none",
    }
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        if e.code == 400 and "reasoning" in err_body.lower() and "reasoning_effort" in body:
            body.pop("reasoning_effort")
            req = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"),
                headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}, method="POST")
            with urllib.request.urlopen(req, timeout=300) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
        else:
            raise RuntimeError(f"xAI error {e.code}: {err_body[:500]}") from e
    choices = payload.get("choices") or []
    if not choices:
        raise RuntimeError(f"xAI returned no choices: {str(payload)[:500]}")
    return (choices[0].get("message") or {}).get("content", "").strip()


def generate_story(idea: str, language: str, progress: ProgressCB | None = None) -> str:
    spanish = language.lower().startswith("es")
    system = SYSTEM_ES if spanish else SYSTEM_EN

    if config.MOCK_LLM:
        if progress:
            progress("Writing a short practice story (test mode)...", percent=12)
        # Expand mock a bit so TTS has something to say
        story = MOCK_STORY
        if spanish:
            story = (
                "Título: El Patito y el Estanque Brillante\n\n"
                "Había una vez un patito suave llamado Pip que nadaba en un estanque quieto. "
                "La luna pintaba un camino de plata en el agua. Pip encontró una amiga, Dot, "
                "y juntas miraron las estrellas hasta quedarse dormidas.\n\nFin.\n"
            )
        if progress:
            progress(
                f"Story ready! About {word_count(story)} words (test mode).",
                percent=40,
            )
        return story

    if config.XAI_API_KEY:
        call = lambda s, u: _call_xai(config.XAI_API_KEY, s, u)
        label = "Grok"
    elif config.GEMINI_API_KEY:
        call = lambda s, u: _call_gemini(config.GEMINI_API_KEY, s, u)
        label = "Gemini"
    else:
        raise RuntimeError(
            "No story key is set on the server. Ask a grown-up to add GEMINI_API_KEY."
        )

    if progress:
        progress(f"Writing your story with {label}...", percent=5)

    if spanish:
        user = (
            f"Escribe un cuento para dormir basado en esta idea: {idea.strip()}\n\n"
            f"Escribe unas {config.TARGET_MIN_WORDS} a {config.TARGET_MAX_WORDS} palabras. "
            "Empieza con 'Título: ...' en la primera línea."
        )
    else:
        user = (
            f"Write a bedtime story based on this idea: {idea.strip()}\n\n"
            f"Write about {config.TARGET_MIN_WORDS} to {config.TARGET_MAX_WORDS} words. "
            "Start with 'Title: ...' on the first line."
        )

    story = call(system, user)
    words = word_count(story)

    for i in range(4):
        if words >= config.TARGET_MIN_WORDS:
            break
        if progress:
            write_pct = min(38, 5 + int((i + 1) / 4 * 33))
            progress(
                f"Story so far: {words} words… writing more ({i + 1}/4)...",
                percent=write_pct,
            )
        if spanish:
            cont = (
                "Continúa el cuento desde donde quedó. No repitas lo ya escrito. "
                f"Añade unas {max(800, config.TARGET_MIN_WORDS - words)} palabras más, "
                "manteniendo el tono suave. Cuando esté cerca del final, cierra con 'Fin.'\n\n"
                f"Texto hasta ahora:\n{story[-4000:]}"
            )
        else:
            cont = (
                "Continue the story from where it left off. Do not repeat what was already written. "
                f"Add about {max(800, config.TARGET_MIN_WORDS - words)} more words, "
                "keeping the gentle bedtime tone. Near the end, close softly with 'The end.'\n\n"
                f"Story so far:\n{story[-4000:]}"
            )
        chunk = call(system, cont)
        if not chunk:
            break
        chunk = re.sub(
            r"^(Title|Título)\s*:\s*.+\n?", "", chunk, count=1, flags=re.I
        ).strip()
        story = story.rstrip() + "\n\n" + chunk
        words = word_count(story)

    if words < 50:
        raise RuntimeError(f"The story came back too short ({words} words). Try again.")
    if progress:
        progress(f"Story ready! About {words} words.", percent=40)
    return story


async def _synth_chunk_edge(text: str, voice: str, rate: str) -> bytes:
    import edge_tts

    communicate = edge_tts.Communicate(text, voice=voice, rate=rate)
    buf = bytearray()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            buf.extend(chunk["data"])
    return bytes(buf)


def _call_xai_tts(text: str, voice_id: str, language: str, speed: float | None = None) -> bytes:
    """POST https://api.x.ai/v1/tts — returns raw MP3 bytes."""
    if not config.XAI_API_KEY:
        raise RuntimeError("XAI_API_KEY is not set")
    body = {
        "text": text,
        "voice_id": voice_id,
        "language": language,
        "speed": speed if speed is not None else config.XAI_TTS_SPEED,
    }
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        config.XAI_TTS_URL,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {config.XAI_API_KEY}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            return resp.read()
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"xAI TTS error {e.code}: {err_body[:400]}") from e


def split_for_xai(text: str, max_chars: int | None = None) -> list[str]:
    """Prefer paragraph breaks, then sentences, under max_chars."""
    if max_chars is None:
        max_chars = config.XAI_TTS_CHUNK_CHARS
    text = text.strip()
    if not text:
        return []
    if len(text) <= max_chars:
        return [text]
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks: list[str] = []
    current = ""
    for para in paragraphs:
        if len(para) > max_chars:
            if current:
                chunks.append(current)
                current = ""
            chunks.extend(split_at_sentences(para, max_chars))
            continue
        candidate = (current + "\n\n" + para).strip() if current else para
        if len(candidate) <= max_chars:
            current = candidate
        else:
            if current:
                chunks.append(current)
            current = para
    if current:
        chunks.append(current)
    return chunks


async def synthesize_story(
    text: str,
    voice_id: str | None = None,
    language: str = "English",
    progress: ProgressCB | None = None,
) -> bytes:
    """Synthesize with selected voice; unknown → Ava; xAI failure → Ava for rest."""
    from .voices import get_voice

    voice = get_voice(voice_id)
    display = voice.name

    async def do_edge_parts(chunks: list[str], label: str) -> bytes:
        total = len(chunks)
        audio = bytearray()
        for i, chunk in enumerate(chunks, 1):
            pct = 40 + int((i - 1) / max(total, 1) * 59)
            pct_done = 40 + int(i / max(total, 1) * 59)
            if progress:
                progress(
                    f"Recording {label}'s voice… part {i} of {total}",
                    percent=pct,
                    part=i,
                    total=total,
                )
            try:
                audio.extend(
                    await _synth_chunk_edge(chunk, config.VOICE, config.RATE)
                )
            except Exception:
                await asyncio.sleep(1.5)
                audio.extend(
                    await _synth_chunk_edge(chunk, config.VOICE, config.RATE)
                )
            if progress:
                progress(
                    f"Recording {label}'s voice… part {i} of {total}",
                    percent=min(99, pct_done),
                    part=i,
                    total=total,
                )
        return bytes(audio)

    if voice.engine == "edge":
        chunks = split_at_sentences(text, config.TTS_CHUNK_CHARS)
        return await do_edge_parts(chunks, display)

    # Grok / xAI TTS
    from .voices import tts_language_code

    lang_code = tts_language_code(language)
    chunks = split_for_xai(text, config.XAI_TTS_CHUNK_CHARS)
    total = len(chunks)
    audio = bytearray()
    fell_back = False
    xai_id = voice.xai_voice_id or voice.id

    for i, chunk in enumerate(chunks, 1):
        pct = 40 + int((i - 1) / max(total, 1) * 59)
        pct_done = 40 + int(i / max(total, 1) * 59)
        if fell_back:
            if progress:
                progress(
                    f"Recording Ava's voice… part {i} of {total} "
                    f"(switched after {display} had trouble)",
                    percent=pct,
                    part=i,
                    total=total,
                )
            try:
                audio.extend(
                    await _synth_chunk_edge(chunk, config.VOICE, config.RATE)
                )
            except Exception:
                await asyncio.sleep(1.5)
                audio.extend(
                    await _synth_chunk_edge(chunk, config.VOICE, config.RATE)
                )
            if progress:
                progress(
                    f"Recording Ava's voice… part {i} of {total}",
                    percent=min(99, pct_done),
                    part=i,
                    total=total,
                )
            continue

        if progress:
            progress(
                f"Recording {display}'s voice… part {i} of {total}",
                percent=pct,
                part=i,
                total=total,
            )
        try:
            part = await asyncio.to_thread(
                _call_xai_tts, chunk, xai_id, lang_code, config.XAI_TTS_SPEED
            )
            if not part or len(part) < 100:
                raise RuntimeError("empty TTS response")
            audio.extend(part)
            if progress:
                progress(
                    f"Recording {display}'s voice… part {i} of {total}",
                    percent=min(99, pct_done),
                    part=i,
                    total=total,
                )
        except Exception as e:
            fell_back = True
            err = str(e)[:80]
            if progress:
                progress(
                    f"{display} had trouble ({err}) — "
                    f"finishing with Ava… part {i} of {total}",
                    percent=pct,
                    part=i,
                    total=total,
                )
            try:
                audio.extend(
                    await _synth_chunk_edge(chunk, config.VOICE, config.RATE)
                )
            except Exception:
                await asyncio.sleep(1.5)
                audio.extend(
                    await _synth_chunk_edge(chunk, config.VOICE, config.RATE)
                )
            if progress:
                progress(
                    f"Recording Ava's voice… part {i} of {total}",
                    percent=min(99, pct_done),
                    part=i,
                    total=total,
                )

    if fell_back and progress:
        progress(f"Finished with Ava after {display} had trouble.", percent=99)
    return bytes(audio)


async def synthesize_preview(voice_id: str, lang: str) -> bytes:
    """Short preview clip for a voice (used by /api/voices/.../preview)."""
    from .voices import get_voice, preview_text

    voice = get_voice(voice_id)
    text = preview_text(lang)
    if voice.engine == "edge":
        return await _synth_chunk_edge(text, config.VOICE, config.RATE)
    lang_code = "es-MX" if lang.lower().startswith("es") else "en"
    return await asyncio.to_thread(
        _call_xai_tts,
        text,
        voice.xai_voice_id or voice.id,
        lang_code,
        config.XAI_TTS_SPEED,
    )



def spoken_text(story: str, title: str) -> str:
    body = re.sub(
        r"^(?:Title|T[ií]tulo)\s*:\s*.+\n+", "", story, count=1, flags=re.I
    ).strip()
    return f"{title}.\n\n{body}"


def save_story_files(story_id: str, title: str, story: str, audio: bytes) -> dict:
    folder = config.STORIES_DIR / story_id
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "story.txt").write_text(story, encoding="utf-8")
    (folder / "audio.mp3").write_bytes(audio)
    meta = {
        "id": story_id,
        "title": title,
        "created": datetime.now().isoformat(timespec="seconds"),
        "words": word_count(story),
        "audio_bytes": len(audio),
    }
    (folder / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return meta


def list_stories(limit: int = 30) -> list[dict]:
    items: list[dict] = []
    if not config.STORIES_DIR.exists():
        return items
    for folder in config.STORIES_DIR.iterdir():
        meta_path = folder / "meta.json"
        if meta_path.is_file():
            try:
                items.append(json.loads(meta_path.read_text(encoding="utf-8")))
            except Exception:
                continue
    items.sort(key=lambda m: m.get("created", ""), reverse=True)
    return items[:limit]


def story_paths(story_id: str) -> tuple[Path, Path] | None:
    folder = config.STORIES_DIR / story_id
    mp3 = folder / "audio.mp3"
    txt = folder / "story.txt"
    if mp3.is_file() and txt.is_file():
        return mp3, txt
    return None
