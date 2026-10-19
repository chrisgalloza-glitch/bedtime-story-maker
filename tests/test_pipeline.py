"""Pipeline + progressive endpoint tests (MOCK_LLM, fake TTS)."""
from __future__ import annotations

import os
import sys
import tempfile
import time
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ["MOCK_LLM"] = "1"
os.environ["FAMILY_PIN"] = "4821"
os.environ["DATA_DIR"] = tempfile.mkdtemp()
os.environ["XAI_API_KEY"] = "test-fake-key"

from fastapi.testclient import TestClient  # noqa: E402

from app import pipeline, story as story_mod  # noqa: E402
from app.main import app  # noqa: E402

TINY = (ROOT / "static/previews/ava-en.mp3").read_bytes()[:6000]


def test_plan_words():
    for k, (total, n) in pipeline.LENGTHS.items():
        w = pipeline.plan_words(k)
        assert len(w) == n and w[0] < w[1]
        assert abs(sum(w) - total) < 150
    assert pipeline.normalize_length("bogus") == "medium"


def test_parse_outline_fallback():
    o = pipeline.parse_outline("garbage", 4, "ducks", False)
    assert len(o["parts"]) == 4 and o["title"]
    o = pipeline.parse_outline('x {"title":"T","characters":"c","parts":["a","b"]} y', 3, "i", False)
    assert o["title"] == "T" and len(o["parts"]) == 3


def test_progressive_endpoints():
    active = {"n": 0, "max": 0}

    async def fake_edge(text, voice, rate):
        import asyncio

        active["n"] += 1
        active["max"] = max(active["max"], active["n"])
        await asyncio.sleep(0.3)
        active["n"] -= 1
        return TINY

    import threading

    from app import jobs as jobs_mod

    orig = jobs_mod.run_job

    def threaded(job_id):  # TestClient runs background tasks inline; real server doesn't
        threading.Thread(target=orig, args=(job_id,), daemon=True).start()

    with patch.object(story_mod, "_synth_chunk_edge", side_effect=fake_edge), patch.object(
        jobs_mod, "run_job", side_effect=threaded
    ):
        c = TestClient(app)
        assert c.post("/api/login", json={"pin": "4821"}).status_code == 200
        r = c.post("/api/stories", json={"idea": "a duck", "length": "long", "voice": "ava"})
        jid = r.json()["job_id"]
        seen_ready, pcts, first = [], [], None
        t0 = time.time()
        for _ in range(100):
            j = c.get(f"/api/jobs/{jid}").json()
            pcts.append(j["percent"])
            if j["parts_ready"] and first is None:
                first = time.time() - t0
                # part 1 playable while job still running
                assert j["status"] != "done"
                pr = c.get(f"/api/stories/{j['story_id']}/parts/1/audio")
                assert pr.status_code == 200 and len(pr.content) == len(TINY)
            seen_ready.append(len(j["parts_ready"]))
            if j["status"] == "done":
                break
            assert j["status"] != "error", j["error"]
            time.sleep(0.1)
        assert j["status"] == "done"
        assert j["parts_total"] == 6 and j["parts_ready"] == [1, 2, 3, 4, 5, 6]
        assert pcts == sorted(pcts) and pcts[-1] == 100
        assert max(seen_ready) == 6 and min(seen_ready) < 6  # progressive
        assert 1 < active["max"] <= pipeline.TTS_CONCURRENCY  # parallel but bounded
        full = c.get(f"/api/stories/{j['story_id']}/audio")
        assert len(full.content) == len(TINY) * 6
        assert c.get(f"/api/stories/{j['story_id']}/parts/9/audio").status_code == 404
        assert c.get("/api/stories/../parts/1/audio").status_code in (404, 422)
    print("progressive OK first part after", round(first, 2), "s; max parallel TTS", active["max"])


def test_part1_recorded_first_even_if_written_last():
    import asyncio
    import tempfile as tf

    order = []

    async def fake_edge(text, voice, rate):
        order.append("title" if "Little Duck" in text else "other")
        await asyncio.sleep(0.2)
        return TINY

    ready = []
    with patch.object(story_mod, "_synth_chunk_edge", side_effect=fake_edge), patch.object(
        pipeline, "MOCK_DELAYS", [0.8, 0.05, 0.05, 0.05, 0.05]
    ):
        asyncio.run(
            pipeline.produce(
                "duck", "English", "ava", "medium", Path(tf.mkdtemp()),
                lambda **kw: ready.append(kw["part_ready"]) if "part_ready" in kw else None,
            )
        )
    assert order[0] == "title", order  # part 1 (starts with the title) recorded first
    assert ready[0] == 1 and sorted(ready) == [1, 2, 3, 4, 5], ready
    print("part 1 priority OK", ready)


def test_top_up_extends_short_parts():
    import asyncio

    calls = []

    def fake_llm(system, user, max_tokens):
        calls.append(user)
        return ("soft word " * 60) + "The end."

    with patch.object(pipeline, "_llm", side_effect=fake_llm):
        sem = asyncio.Semaphore(2)
        mid = asyncio.run(pipeline._top_up(sem, "sys", "short start.", 300, False, False))
        last = asyncio.run(pipeline._top_up(sem, "sys", "short start. The end.", 300, True, False))
    assert len(calls) == 4  # two rounds each
    assert "The end" not in mid and story_mod.word_count(mid) > 200
    assert last.rstrip().endswith("The end.") and last.count("The end") == 1
    print("top-up OK")


def test_profiles_tag_and_filter():
    import threading

    from app import jobs as jobs_mod

    async def fake_edge(text, voice, rate):
        return TINY

    with patch.object(story_mod, "_synth_chunk_edge", side_effect=fake_edge):
        c = TestClient(app)
        c.post("/api/login", json={"pin": "4821"})
        ids = {}
        for prof in ("p1", "p2"):
            j = c.post("/api/stories", json={"idea": "a cat", "length": "short", "profile": prof}).json()
            st = c.get(f"/api/jobs/{j['job_id']}").json()
            assert st["status"] == "done" and st["profile"] == prof, st
            ids[prof] = st["story_id"]
        p1 = {m["id"] for m in c.get("/api/stories?profile=p1").json()["stories"]}
        p2 = {m["id"] for m in c.get("/api/stories?profile=p2").json()["stories"]}
        assert ids["p1"] in p1 and ids["p1"] not in p2
        assert ids["p2"] in p2 and ids["p2"] not in p1
        # bogus profile falls back to p1; unfiltered list has both
        j = c.post("/api/stories", json={"idea": "x y", "length": "short", "profile": "zz"}).json()
        assert c.get(f"/api/jobs/{j['job_id']}").json()["profile"] == "p1"
        allids = {m["id"] for m in c.get("/api/stories").json()["stories"]}
        assert {ids["p1"], ids["p2"]} <= allids
    print("profiles OK")


if __name__ == "__main__":
    test_plan_words()
    test_parse_outline_fallback()
    test_progressive_endpoints()
    test_part1_recorded_first_even_if_written_last()
    test_top_up_extends_short_parts()
    test_profiles_tag_and_filter()
    print("== PIPELINE TESTS PASSED ==")
