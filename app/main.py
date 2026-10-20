"""Bedtime Story Maker — FastAPI app for Android tablet (PWA)."""
from __future__ import annotations

import hashlib
import hmac
import re
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, HTTPException, Query, Request, Response
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import config
from . import jobs as jobs_mod
from . import pipeline as pipeline_mod
from . import previews as previews_mod
from . import readalong as readalong_mod
from . import story as story_mod
from .voices import get_voice, list_voices_public

ROOT = Path(__file__).resolve().parent.parent
STATIC = ROOT / "static"

app = FastAPI(title="Bedtime Story Maker", docs_url=None, redoc_url=None)


def _pin_ok(pin: str) -> bool:
    a = hashlib.sha256((pin or "").strip().encode("utf-8")).digest()
    b = hashlib.sha256(config.FAMILY_PIN.encode("utf-8")).digest()
    return hmac.compare_digest(a, b)


def _session_token() -> str:
    return hmac.new(
        config.FAMILY_PIN.encode("utf-8"),
        b"story-maker-session-v1",
        hashlib.sha256,
    ).hexdigest()


def _authed(request: Request) -> bool:
    return request.cookies.get(config.SESSION_COOKIE) == _session_token()


def require_auth(request: Request) -> None:
    if not _authed(request):
        raise HTTPException(status_code=401, detail="Please enter the family PIN first.")


class PinBody(BaseModel):
    pin: str = Field(min_length=1, max_length=64)


class StoryBody(BaseModel):
    idea: str = Field(min_length=2, max_length=2000)
    language: str = Field(default="English", max_length=32)
    voice: str = Field(default="ava", max_length=32)
    length: str = Field(default="medium", max_length=16)
    profile: str = Field(default="p1", max_length=8)


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "mock_llm": config.MOCK_LLM,
        "has_gemini": bool(config.GEMINI_API_KEY),
        "has_xai": bool(config.XAI_API_KEY),
        "default_voice": "ava",
        "voices": [v["id"] for v in list_voices_public()],
    }


@app.get("/api/session")
def session(request: Request):
    return {"ok": _authed(request)}


@app.post("/api/login")
def login(body: PinBody, request: Request):
    if not _pin_ok(body.pin):
        raise HTTPException(status_code=403, detail="Wrong PIN. Ask a grown-up.")
    response = JSONResponse({"ok": True})
    forwarded = (
        request.headers.get("x-forwarded-proto") or request.url.scheme or ""
    ).split(",")[0].strip()
    secure = forwarded == "https"
    response.set_cookie(
        key=config.SESSION_COOKIE,
        value=_session_token(),
        max_age=config.SESSION_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=secure,
    )
    return response


@app.post("/api/logout")
def logout(response: Response):
    response = JSONResponse({"ok": True})
    response.delete_cookie(config.SESSION_COOKIE)
    return response


@app.get("/api/voices")
def voices(request: Request):
    require_auth(request)
    return {"voices": list_voices_public(), "default": "ava"}


@app.get("/api/voices/{voice_id}/preview")
def voice_preview(
    voice_id: str,
    request: Request,
    lang: str = Query(default="en", pattern="^(en|es)$"),
):
    require_auth(request)
    voice = get_voice(voice_id)
    try:
        path = previews_mod.ensure_preview(voice.id, lang)
    except Exception as e:
        # Last resort: Ava preview so the tablet never soft-locks
        if voice.id != "ava":
            try:
                path = previews_mod.ensure_preview("ava", lang)
            except Exception:
                raise HTTPException(503, f"Preview unavailable: {e}") from e
        else:
            raise HTTPException(503, f"Preview unavailable: {e}") from e
    return FileResponse(
        path,
        media_type="audio/mpeg",
        filename=f"{voice.id}-{lang}-preview.mp3",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@app.post("/api/stories")
def start_story(body: StoryBody, request: Request, background: BackgroundTasks):
    require_auth(request)
    idea = body.idea.strip()
    if not idea:
        raise HTTPException(400, "Type a story idea first.")
    active = sum(
        1
        for j in jobs_mod._jobs.values()
        if j.status in ("queued", "writing", "speaking")
    )
    if active >= 2:
        raise HTTPException(
            429, "A story is already being made. Please wait until it finishes."
        )
    voice = get_voice(body.voice)
    job = jobs_mod.create_job(
        idea,
        body.language,
        voice.id,
        pipeline_mod.normalize_length(body.length),
        _profile(body.profile),
    )
    background.add_task(jobs_mod.run_job, job.id)
    return {"job_id": job.id, "voice": voice.id}


@app.get("/api/jobs/{job_id}")
def job_status(job_id: str, request: Request):
    require_auth(request)
    job = jobs_mod.get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found.")
    return {
        "id": job.id,
        "status": job.status,
        "progress": job.progress,
        "percent": int(job.percent or 0),
        "speak_part": job.speak_part,
        "speak_total": job.speak_total,
        "error": job.error,
        "story_id": job.story_id,
        "title": job.title,
        "voice": job.voice_id,
        "length": job.length,
        "profile": job.profile,
        "parts_total": job.parts_total,
        "parts_ready": list(job.parts_ready),
    }


def _profile(p: str | None) -> str:
    return p if p in ("p1", "p2") else "p1"


@app.get("/api/stories")
def list_stories(request: Request, profile: str | None = Query(default=None)):
    require_auth(request)
    items = story_mod.list_stories()
    if profile:
        want = _profile(profile)
        items = [m for m in items if (m.get("profile") or "p1") == want]
    return {"stories": items}


@app.get("/api/stories/{story_id}/audio")
def get_audio(story_id: str, request: Request):
    require_auth(request)
    paths = story_mod.story_paths(story_id)
    if not paths:
        raise HTTPException(404, "Story audio not found.")
    mp3, _ = paths
    return FileResponse(
        mp3,
        media_type="audio/mpeg",
        filename=f"{story_id}.mp3",
    )


@app.get("/api/stories/{story_id}/parts/{n}/audio")
def get_part_audio(story_id: str, n: int, request: Request):
    require_auth(request)
    if not re.fullmatch(r"[A-Za-z0-9_-]{4,40}", story_id) or not 1 <= n <= 20:
        raise HTTPException(404, "Part not found.")
    path = config.STORIES_DIR / story_id / f"part-{n}.mp3"
    job = next((j for j in jobs_mod._jobs.values() if j.story_id == story_id), None)
    # only serve parts the job has finished writing (file may be mid-write)
    if not path.is_file() or (job is not None and n not in job.parts_ready):
        raise HTTPException(404, "Part not ready yet.")
    return FileResponse(path, media_type="audio/mpeg", headers={"Cache-Control": "no-store"})


def _safe_id(story_id: str) -> None:
    if not re.fullmatch(r"[A-Za-z0-9_-]{4,40}", story_id):
        raise HTTPException(404, "Not found.")


@app.get("/api/stories/{story_id}/parts/{n}/timings")
def get_part_timings(story_id: str, n: int, request: Request):
    require_auth(request)
    _safe_id(story_id)
    job = next((j for j in jobs_mod._jobs.values() if j.story_id == story_id), None)
    path = config.STORIES_DIR / story_id / f"part-{n}.json"
    if not path.is_file() or (job is not None and n not in job.parts_ready):
        raise HTTPException(404, "Timings not ready yet.")
    return Response(path.read_text(encoding="utf-8"), media_type="application/json")


@app.get("/api/stories/{story_id}/timings")
def get_story_timings(story_id: str, request: Request):
    """Whole-story timings; older stories get estimated timings from text + audio length."""
    require_auth(request)
    _safe_id(story_id)
    folder = config.STORIES_DIR / story_id
    path = folder / "timings.json"
    if not path.is_file():
        paths = story_mod.story_paths(story_id)
        if not paths:
            raise HTTPException(404, "Story not found.")
        mp3, txt = paths
        text = txt.read_text(encoding="utf-8")
        title = story_mod.extract_title(text)
        spoken = story_mod.spoken_text(text, title)
        readalong_mod.write(path, readalong_mod.estimate(spoken, readalong_mod.mp3_duration(mp3.read_bytes())))
    return Response(path.read_text(encoding="utf-8"), media_type="application/json")


@app.delete("/api/stories/{story_id}")
def delete_story(story_id: str, request: Request):
    """Grown-ups panel: remove a story's files from the server (tablet copy is removed client-side)."""
    require_auth(request)
    _safe_id(story_id)
    folder = config.STORIES_DIR / story_id
    if folder.is_dir() and folder.resolve().parent == config.STORIES_DIR.resolve():
        import shutil

        shutil.rmtree(folder, ignore_errors=True)
        return {"ok": True, "deleted": True}
    return {"ok": True, "deleted": False}


@app.get("/api/stories/{story_id}/text")
def get_text(story_id: str, request: Request):
    require_auth(request)
    paths = story_mod.story_paths(story_id)
    if not paths:
        raise HTTPException(404, "Story text not found.")
    _, txt = paths
    return {"text": txt.read_text(encoding="utf-8")}


if STATIC.is_dir():
    app.mount("/", StaticFiles(directory=str(STATIC), html=True), name="static")
