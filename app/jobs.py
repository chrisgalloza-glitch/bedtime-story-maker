"""In-memory job queue for long story+TTS work."""
from __future__ import annotations

import asyncio
import secrets
import threading
import time
import traceback
from dataclasses import dataclass, field
from typing import Any

from . import story as story_mod
from .voices import get_voice


@dataclass
class Job:
    id: str
    idea: str
    language: str
    voice_id: str = "ava"
    status: str = "queued"  # queued | writing | speaking | done | error
    progress: str = "Waiting to start…"
    error: str | None = None
    story_id: str | None = None
    title: str | None = None
    created: float = field(default_factory=time.time)


_jobs: dict[str, Job] = {}
_lock = threading.Lock()
_MAX_JOBS = 40


def create_job(idea: str, language: str, voice_id: str = "ava") -> Job:
    voice = get_voice(voice_id)
    job = Job(
        id=secrets.token_urlsafe(10),
        idea=idea,
        language=language,
        voice_id=voice.id,
    )
    with _lock:
        _jobs[job.id] = job
        if len(_jobs) > _MAX_JOBS:
            finished = sorted(
                (j for j in _jobs.values() if j.status in ("done", "error")),
                key=lambda j: j.created,
            )
            for j in finished[: max(0, len(_jobs) - _MAX_JOBS)]:
                _jobs.pop(j.id, None)
    return job


def get_job(job_id: str) -> Job | None:
    return _jobs.get(job_id)


def _set(job: Job, **kwargs: Any) -> None:
    with _lock:
        for k, v in kwargs.items():
            setattr(job, k, v)


def run_job(job_id: str) -> None:
    job = get_job(job_id)
    if not job:
        return

    def progress(msg: str) -> None:
        _set(job, progress=msg)

    try:
        voice = get_voice(job.voice_id)
        _set(job, status="writing", progress="Writing your story…")
        text = story_mod.generate_story(job.idea, job.language, progress=progress)
        title = story_mod.extract_title(text, job.language)
        spoken = story_mod.spoken_text(text, title)

        _set(
            job,
            status="speaking",
            progress=f"Recording {voice.name}'s voice…",
            title=title,
        )
        audio = asyncio.run(
            story_mod.synthesize_story(
                spoken,
                voice_id=job.voice_id,
                language=job.language,
                progress=progress,
            )
        )

        story_id = secrets.token_urlsafe(8)
        meta = story_mod.save_story_files(story_id, title, text, audio)
        # stash voice on meta
        try:
            import json
            from pathlib import Path
            from . import config

            meta_path = config.STORIES_DIR / story_id / "meta.json"
            meta["voice_id"] = job.voice_id
            meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
        except Exception:
            pass

        _set(
            job,
            status="done",
            progress="All done!",
            story_id=story_id,
            title=title,
        )
    except Exception as e:
        _set(
            job,
            status="error",
            progress="Something went wrong",
            error=str(e) or traceback.format_exc()[:800],
        )
