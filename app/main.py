"""Bedtime Story Maker — FastAPI app for Android tablet (PWA)."""
from __future__ import annotations

import hashlib
import hmac
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import config
from . import jobs as jobs_mod
from . import story as story_mod

ROOT = Path(__file__).resolve().parent.parent
STATIC = ROOT / "static"

app = FastAPI(title="Bedtime Story Maker", docs_url=None, redoc_url=None)


def _pin_ok(pin: str) -> bool:
    a = hashlib.sha256((pin or "").strip().encode("utf-8")).digest()
    b = hashlib.sha256(config.FAMILY_PIN.encode("utf-8")).digest()
    return hmac.compare_digest(a, b)


def _session_token() -> str:
    """Signed cookie value derived from FAMILY_PIN (rotates if PIN changes)."""
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


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "mock_llm": config.MOCK_LLM,
        "has_gemini": bool(config.GEMINI_API_KEY),
        "voice": config.VOICE,
    }


@app.get("/api/session")
def session(request: Request):
    return {"ok": _authed(request)}


@app.post("/api/login")
def login(body: PinBody, request: Request):
    if not _pin_ok(body.pin):
        raise HTTPException(status_code=403, detail="Wrong PIN. Ask a grown-up.")
    response = JSONResponse({"ok": True})
    forwarded = (request.headers.get("x-forwarded-proto") or request.url.scheme or "").split(",")[0].strip()
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


@app.post("/api/stories")
def start_story(body: StoryBody, request: Request, background: BackgroundTasks):
    require_auth(request)
    idea = body.idea.strip()
    if not idea:
        raise HTTPException(400, "Type a story idea first.")
    # Cap concurrent active jobs
    active = sum(
        1 for j in jobs_mod._jobs.values() if j.status in ("queued", "writing", "speaking")
    )
    if active >= 2:
        raise HTTPException(
            429, "A story is already being made. Please wait until it finishes."
        )
    job = jobs_mod.create_job(idea, body.language)
    background.add_task(jobs_mod.run_job, job.id)
    return {"job_id": job.id}


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
        "error": job.error,
        "story_id": job.story_id,
        "title": job.title,
    }


@app.get("/api/stories")
def list_stories(request: Request):
    require_auth(request)
    return {"stories": story_mod.list_stories()}


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


@app.get("/api/stories/{story_id}/text")
def get_text(story_id: str, request: Request):
    require_auth(request)
    paths = story_mod.story_paths(story_id)
    if not paths:
        raise HTTPException(404, "Story text not found.")
    _, txt = paths
    return {"text": txt.read_text(encoding="utf-8")}



# Static frontend (PWA)
if STATIC.is_dir():
    app.mount("/", StaticFiles(directory=str(STATIC), html=True), name="static")
