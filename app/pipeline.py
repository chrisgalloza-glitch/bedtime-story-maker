"""Fast pipeline: outline -> parts written concurrently -> parts voiced concurrently.

Part 1 is short and goes first so playback can start within about a minute.
"""
from __future__ import annotations

import asyncio
import json
import re
from pathlib import Path
from typing import Any, Callable

from . import config
from . import readalong as RA
from . import story as S
from .voices import get_voice, tts_language_code

OnUpdate = Callable[..., None]

# length -> (total words, number of parts). ~150 words per spoken minute.
LENGTHS = {
    "short": (1500, 4),
    "medium": (2300, 5),
    "long": (3300, 6),
}
FIRST_PART_WORDS = 300
LLM_CONCURRENCY = 6
MOCK_DELAYS: list[float] | None = None  # tests: per-part fake writing time
TTS_CONCURRENCY = 3
# Live test: Grok wrote ~1/3 of the requested words per part, so ask for more
# and top later parts up (twice at most) when still short.
WORD_ASK_FACTOR = 2.2
TOPUP_ROUNDS = 2


def normalize_length(length: str | None) -> str:
    return (length or "").lower() if (length or "").lower() in LENGTHS else config.DEFAULT_LENGTH


def plan_words(length: str) -> list[int]:
    total, n = LENGTHS[normalize_length(length)]
    rest = max(200, round((total - FIRST_PART_WORDS) / (n - 1) / 10) * 10)
    return [FIRST_PART_WORDS] + [rest] * (n - 1)


# ---------------------------------------------------------------- LLM

def _llm(system: str, user: str, max_tokens: int) -> str:
    if config.XAI_API_KEY:
        return S._call_xai(config.XAI_API_KEY, system, user, max_tokens)
    if config.GEMINI_API_KEY:
        return S._call_gemini(config.GEMINI_API_KEY, system, user, max_tokens)
    raise RuntimeError("No story key is set on the server.")


async def _llm_retry(sem: asyncio.Semaphore, system: str, user: str, max_tokens: int) -> str:
    last: Exception | None = None
    for attempt in range(2):
        async with sem:
            try:
                out = await asyncio.to_thread(_llm, system, user, max_tokens)
                if out and out.strip():
                    return out.strip()
                last = RuntimeError("empty response")
            except Exception as e:  # noqa: BLE001
                last = e
        await asyncio.sleep(1.5)
    raise RuntimeError(f"Story writer had trouble: {str(last)[:200]}")


def _outline_prompt(idea: str, spanish: bool, n: int, words: list[int]) -> tuple[str, str]:
    if spanish:
        system = "Eres una narradora de cuentos para dormir para niños pequeños. Respondes SOLO con JSON válido."
        user = (
            f"Idea del cuento: {idea}\n\n"
            f"Planea un cuento suave para dormir en {n} partes. Devuelve SOLO este JSON:\n"
            '{"title": "título corto", "characters": "personajes y lugar en una frase", '
            '"parts": ["resumen de 1-2 frases de la parte 1", "..."]}\n'
            f"Debe haber exactamente {n} partes, en orden; la última cierra con calma y sueño. "
            "Todo en español, tono tranquilo, nada de miedo."
        )
    else:
        system = "You plan gentle bedtime stories for young children. Reply with VALID JSON only."
        user = (
            f"Story idea: {idea}\n\n"
            f"Plan a soothing bedtime story in {n} parts. Return ONLY this JSON:\n"
            '{"title": "short title", "characters": "main characters and setting in one sentence", '
            '"parts": ["1-2 sentence summary of part 1", "..."]}\n'
            f"Exactly {n} parts, in order; the last part winds down toward sleep. "
            "Calm tone, nothing scary."
        )
    return system, user


def parse_outline(raw: str, n: int, idea: str, spanish: bool) -> dict[str, Any]:
    data: dict[str, Any] = {}
    m = re.search(r"\{.*\}", raw, re.S)
    if m:
        try:
            data = json.loads(m.group(0))
        except Exception:  # noqa: BLE001
            data = {}
    parts = [str(p).strip() for p in (data.get("parts") or []) if str(p).strip()]
    if len(parts) < n:
        filler = "Sigue el cuento con calma." if spanish else "Continue the story gently."
        parts += [filler] * (n - len(parts))
    parts = parts[:n]
    title = str(data.get("title") or "").strip().strip('"*')[:80]
    if not title:
        title = "Mi Cuento" if spanish else "My Bedtime Story"
    return {
        "title": title,
        "characters": str(data.get("characters") or idea)[:400],
        "parts": parts,
    }


def _part_prompt(
    outline: dict, idx: int, n: int, words: int, idea: str, spanish: bool
) -> tuple[str, str]:
    parts = outline["parts"]
    prev_s = parts[idx - 1] if idx > 0 else ""
    next_s = parts[idx + 1] if idx + 1 < n else ""
    first, last = idx == 0, idx == n - 1
    listing = "\n".join(f"{i + 1}. {p}" for i, p in enumerate(parts))
    if spanish:
        system = S.SYSTEM_ES.split("Reglas:")[0] + (
            "Reglas:\n- Tono suave, nada de miedo.\n- Lenguaje simple y cálido.\n"
            "- Escribe SOLO el texto de esta parte, sin título, sin encabezados, sin comentarios."
        )
        user = (
            f"Cuento: \"{outline['title']}\". Idea original: {idea}\nPersonajes: {outline['characters']}\n\n"
            f"Plan completo:\n{listing}\n\n"
            f"Escribe SOLO la parte {idx + 1} de {n}, de unas {words} palabras.\n"
            f"Esta parte: {parts[idx]}\n"
            + (f"La parte anterior trató de: {prev_s}. Continúa sin repetir ni volver a presentar a los personajes.\n" if prev_s else "Empieza con una apertura cálida (Había una vez…).\n")
            + (f"La siguiente parte tratará de: {next_s}. No la adelantes; termina esta parte con naturalidad.\n" if next_s else "")
            + ("Cierra con mucha suavidad para dormir y termina con 'Fin.'" if last else "NO cierres el cuento ni digas 'Fin.'")
        )
    else:
        system = S.SYSTEM_EN.split("Rules:")[0] + (
            "Rules:\n- Soft, peaceful tone, nothing scary.\n- Simple, warm language.\n"
            "- Write ONLY the text of this part: no title, no headings, no notes."
        )
        user = (
            f"Story: \"{outline['title']}\". Original idea: {idea}\nCharacters: {outline['characters']}\n\n"
            f"Full plan:\n{listing}\n\n"
            f"Write ONLY part {idx + 1} of {n}, about {words} words.\n"
            f"This part: {parts[idx]}\n"
            + (f"The previous part covered: {prev_s}. Continue smoothly; do not repeat it or re-introduce the characters.\n" if prev_s else "Begin with a warm opening (Once upon a time…).\n")
            + (f"The next part will cover: {next_s}. Do not jump ahead; end this part naturally.\n" if next_s else "")
            + ("Wind down very gently toward sleep and end with 'The end.'" if last else "Do NOT end the story or write 'The end.'")
        )
    return system, user


def clean_part(text: str) -> str:
    text = re.sub(r"^\s*(?:#+\s*)?(?:Title|T[ií]tulo)\s*:.*\n+", "", text, flags=re.I)
    text = re.sub(r"^\s*(?:#+\s*)?\**(?:Part|Parte)\s+\d+[^\n]*\n+", "", text, flags=re.I)
    return text.strip()


_END_RE = re.compile(r"\s*(The end\.?|Fin\.?)\s*$", re.I)


async def _top_up(sem, system: str, text: str, target: int, last: bool, spanish: bool) -> str:
    """Ask for a continuation (up to TOPUP_ROUNDS) while the part is well under target."""
    for _ in range(TOPUP_ROUNDS):
        have = S.word_count(text)
        if have >= 0.8 * target:
            break
        need = target - have + 100
        if spanish:
            ask = (f"Continúa esta misma parte desde donde quedó, sin repetir, unas {need} palabras más. "
                   + ("Termina con 'Fin.'" if last else "No cierres el cuento ni digas 'Fin.'"))
        else:
            ask = (f"Continue this same part from where it stopped, without repeating, about {need} more words. "
                   + ("End with 'The end.'" if last else "Do not end the story or write 'The end.'"))
        body = _END_RE.sub("", text)
        try:
            extra = clean_part(await _llm_retry(sem, system, ask + "\n\nText so far:\n" + body[-2500:], 2000))
        except Exception:  # noqa: BLE001
            break
        if not last:
            extra = _END_RE.sub("", extra)
        text = body.rstrip() + "\n\n" + extra
    return text


# ---------------------------------------------------------------- mock

def _mock_outline(n: int, spanish: bool) -> dict:
    return {
        "title": "El Patito y el Estanque Brillante" if spanish else "The Little Duck and the Sparkly Pond",
        "characters": "Pip the duck",
        "parts": [f"Part {i + 1}" for i in range(n)],
    }


def _mock_part(idx: int, n: int, spanish: bool) -> str:
    if spanish:
        base = ("Pip nadaba despacio bajo la luna suave. " * 4).strip()
        return base + (" Fin." if idx == n - 1 else "")
    paras = [p for p in S.MOCK_STORY.split("\n\n")[1:] if p.strip() and p.strip() != "The end."]
    chunk = paras[idx % len(paras)] + "\n\n" + paras[(idx + 1) % len(paras)]
    return chunk + ("\n\nThe end." if idx == n - 1 else "")


# ---------------------------------------------------------------- TTS

async def _edge_text(text: str) -> tuple[bytes, list]:
    """Ava audio + word boundaries (offsets relative to the start of this text's audio)."""
    out = bytearray()
    marks: list = []
    for chunk in S.split_at_sentences(text, config.TTS_CHUNK_CHARS):
        try:
            audio, m = await S._synth_chunk_edge_timed(chunk, config.VOICE, config.RATE)
        except Exception:  # noqa: BLE001
            await asyncio.sleep(1.5)
            audio, m = await S._synth_chunk_edge_timed(chunk, config.VOICE, config.RATE)
        shift = RA.mp3_duration(bytes(out)) if out else 0.0
        marks.extend((st + shift, du, w) for st, du, w in m)
        out.extend(audio)
    return bytes(out), marks


async def synth_part(text: str, voice_id: str, language: str, state: dict) -> tuple[bytes, list | None]:
    """Voice one part -> (mp3, word boundaries or None when the engine gives none).
    xAI voices fall back to Ava (and stay on Ava) on failure."""
    voice = get_voice(voice_id)
    if voice.engine == "edge" or state.get("fell_back"):
        return await _edge_text(text)
    lang_code = tts_language_code(language)
    try:
        out = bytearray()
        for chunk in S.split_for_xai(text, config.XAI_TTS_CHUNK_CHARS):
            part = await asyncio.to_thread(
                S._call_xai_tts, chunk, voice.xai_voice_id or voice.id, lang_code, config.XAI_TTS_SPEED
            )
            if not part or len(part) < 100:
                raise RuntimeError("empty TTS response")
            out.extend(part)
        return bytes(out), None
    except Exception as e:  # noqa: BLE001
        state["fell_back"] = True
        state["fallback_reason"] = str(e)[:80]
        return await _edge_text(text)


def part_timings(spoken: str, audio: bytes, marks: list | None) -> dict:
    duration = RA.mp3_duration(audio)
    if marks:
        return RA.align(spoken, marks, duration)
    return RA.estimate(spoken, duration)


# ---------------------------------------------------------------- orchestration

async def produce(
    idea: str,
    language: str,
    voice_id: str,
    length: str,
    folder: Path,
    on_update: OnUpdate,
) -> dict:
    """Runs the whole pipeline. on_update(**kw) keys: progress, percent, title,
    parts_total, part_ready (int), status. Returns {title, text, audio_path}."""
    spanish = language.lower().startswith("es")
    voice = get_voice(voice_id)
    words = plan_words(length)
    n = len(words)
    folder.mkdir(parents=True, exist_ok=True)
    llm_sem = asyncio.Semaphore(LLM_CONCURRENCY)
    tts_sem = asyncio.Semaphore(TTS_CONCURRENCY)
    tts_state: dict = {}
    first_tts_started = asyncio.Event()  # part 1 always gets the first recording slot

    weights = [w / sum(words) for w in words]
    done_frac = [0.0] * n  # 0..1 per part (text 0.4, audio 0.6)

    def pct() -> int:
        return min(98, 8 + int(90 * sum(w * f for w, f in zip(weights, done_frac))))

    on_update(status="writing", progress="Dreaming up your story…", percent=3, parts_total=n)

    # 1. outline
    if config.MOCK_LLM:
        await asyncio.sleep(0.1)
        outline = _mock_outline(n, spanish)
    else:
        system, user = _outline_prompt(idea, spanish, n, words)
        try:
            raw = await _llm_retry(llm_sem, system, user, 1200)
        except Exception:  # noqa: BLE001
            raw = ""  # fall back to generic outline rather than fail
        outline = parse_outline(raw, n, idea, spanish)
    title = outline["title"]
    on_update(title=title, progress="Writing the first part…", percent=8)

    texts: list[str | None] = [None] * n
    timings: list[dict] = [{} for _ in range(n)]

    async def write_and_record(i: int) -> None:
        if config.MOCK_LLM:
            await asyncio.sleep(MOCK_DELAYS[i] if MOCK_DELAYS else 0.15 * (i + 1))
            text = _mock_part(i, n, spanish)
        else:
            ask = int(words[i] * WORD_ASK_FACTOR)
            system, user = _part_prompt(outline, i, n, ask, idea, spanish)
            text = clean_part(await _llm_retry(llm_sem, system, user, int(ask * 2.2) + 400))
            if i > 0:  # later parts get topped up; part 1 stays fast
                text = await _top_up(llm_sem, system, text, words[i], i == n - 1, spanish)
        if len(text) < 20:
            raise RuntimeError(f"Part {i + 1} came back empty.")
        texts[i] = text
        done_frac[i] = 0.4
        on_update(progress=f"Recording part {i + 1} of {n}…", percent=pct())
        spoken = S.spoken_text_part(text, title) if i == 0 else text
        if i > 0:
            await first_tts_started.wait()
        async with tts_sem:
            if i == 0:
                first_tts_started.set()
            audio, marks = await synth_part(spoken, voice.id, language, tts_state)
        timings[i] = part_timings(spoken, audio, marks)
        RA.write(folder / f"part-{i + 1}.json", timings[i])
        (folder / f"part-{i + 1}.mp3").write_bytes(audio)
        done_frac[i] = 1.0
        on_update(
            status="speaking",
            part_ready=i + 1,
            progress=("Your story is ready to play!" if i == 0 else f"Part {i + 1} of {n} is ready."),
            percent=pct(),
        )

    # Part 1 is launched first so it gets the first LLM and TTS slots.
    tasks = [asyncio.create_task(write_and_record(i)) for i in range(n)]
    try:
        await asyncio.gather(*tasks)
    except Exception:
        first_tts_started.set()
        for t in tasks:
            t.cancel()
        raise

    # 2. assemble full mp3 + text
    on_update(progress="Putting the whole story together…", percent=98)
    full = bytearray()
    for i in range(n):
        full.extend((folder / f"part-{i + 1}.mp3").read_bytes())
    RA.write(folder / "timings.json", RA.combine(timings))
    text_all = f"Title: {title}\n\n" + "\n\n".join(t or "" for t in texts)
    return {"title": title, "text": text_all, "audio": bytes(full), "fell_back": bool(tts_state.get("fell_back"))}
