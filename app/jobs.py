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


@dataclass
class Job:
    id: str
    idea: str
    language: str
    status: str = "queued"  # queued | writing | speaking | done | error
    progress: str = "Waiting to start…"
    error: str | None = None
    story_id: str | None = None
    title: str | None = None
    created: float = field(default_factory=time.time)


_jobs: dict[str, Job] = {}
_lock = threading.Lock()
_MAX_JOBS = 40


def create_job(idea: str, language: str) -> Job:
    job = Job(id=secrets.token_urlsafe(10), idea=idea, language=language)
    with _lock:
        _jobs[job.id] = job
        # prune old finished jobs
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
        _set(job, status="writing", progress="Writing your story…")
        text = story_mod.generate_story(job.idea, job.language, progress=progress)
        title = story_mod.extract_title(text, job.language)
        spoken = story_mod.spoken_text(text, title)

        _set(job, status="speaking", progress="Recording Ava's voice…", title=title)
        audio = asyncio.run(story_mod.synthesize_story(spoken, progress=progress))

        story_id = secrets.token_urlsafe(8)
        story_mod.save_story_files(story_id, title, text, audio)
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
