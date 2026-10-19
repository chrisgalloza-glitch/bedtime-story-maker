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
    length: str = "medium"
    profile: str = "p1"
    parts_total: int = 0
    parts_ready: list = field(default_factory=list)
    status: str = "queued"  # queued | writing | speaking | done | error
    progress: str = "Waiting to start…"
    percent: int = 0
    speak_part: int | None = None
    speak_total: int | None = None
    error: str | None = None
    story_id: str | None = None
    title: str | None = None
    created: float = field(default_factory=time.time)


_jobs: dict[str, Job] = {}
_lock = threading.Lock()
_MAX_JOBS = 40


def create_job(idea: str, language: str, voice_id: str = "ava", length: str = "medium", profile: str = "p1") -> Job:
    voice = get_voice(voice_id)
    job = Job(
        id=secrets.token_urlsafe(10),
        idea=idea,
        language=language,
        voice_id=voice.id,
        length=length,
        profile=profile,
        story_id=secrets.token_urlsafe(8),
        percent=1,
        progress="Waiting to start…",
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
            if k == "percent" and v is not None:
                job.percent = max(int(job.percent), int(v))  # never backwards
            elif k == "part_ready":
                if v not in job.parts_ready:
                    job.parts_ready.append(v)
                    job.parts_ready.sort()
            elif k == "status" and job.status in ("done", "error"):
                continue
            elif k == "status" and job.status == "speaking" and v == "writing":
                continue
            else:
                setattr(job, k, v)


def run_job(job_id: str) -> None:
    job = get_job(job_id)
    if not job:
        return
    try:
        import json
        from . import config, pipeline

        folder = config.STORIES_DIR / job.story_id

        def on_update(**kw: Any) -> None:
            _set(job, **kw)

        result = asyncio.run(
            pipeline.produce(
                job.idea, job.language, job.voice_id, job.length, folder, on_update
            )
        )
        title = result["title"]
        meta = story_mod.save_story_files(
            job.story_id, title, result["text"], result["audio"]
        )
        try:
            meta["voice_id"] = job.voice_id
            meta["length"] = job.length
            meta["profile"] = job.profile
            (folder / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
        except Exception:
            pass
        _set(job, status="done", progress="All done!", percent=100, title=title)
    except Exception as e:
        _set(
            job,
            status="error",
            progress="Something went wrong",
            error=str(e) or traceback.format_exc()[:800],
        )
