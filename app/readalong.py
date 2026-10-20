"""Read-along timings: MP3 duration, word alignment, estimated timings."""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

# MPEG audio tables (Layer III)
_BR = {
    1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],  # MPEG1
    2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],  # MPEG2/2.5
}
_SR = {3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000]}


def mp3_duration(data: bytes) -> float:
    """Sum of MP3 frame durations; handles concatenated files and ID3 tags."""
    i, n, total = 0, len(data), 0.0
    while i + 4 <= n:
        if data[i : i + 3] == b"ID3" and i + 10 <= n:
            size = (data[i + 6] << 21) | (data[i + 7] << 14) | (data[i + 8] << 7) | data[i + 9]
            i += 10 + size
            continue
        if data[i : i + 3] == b"TAG" and i + 128 <= n:
            i += 128
            continue
        b1 = data[i + 1]
        if data[i] == 0xFF and (b1 & 0xE0) == 0xE0:
            ver = (b1 >> 3) & 3  # 3=MPEG1, 2=MPEG2, 0=MPEG2.5
            layer = (b1 >> 1) & 3  # 1 = Layer III
            b2 = data[i + 2]
            bri, sri, pad = b2 >> 4, (b2 >> 2) & 3, (b2 >> 1) & 1
            if ver != 1 and layer == 1 and 0 < bri < 15 and sri < 3:
                sr = _SR[ver][sri]
                kbps = _BR[1 if ver == 3 else 2][bri]
                spf = 1152 if ver == 3 else 576
                flen = (spf // 8) * kbps * 1000 // sr + pad
                if flen > 4:
                    total += spf / sr
                    i += flen
                    continue
        i += 1
    return round(total, 3)


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s.lower())
    return "".join(c for c in s if c.isalnum())


def _tokens(text: str) -> list[dict]:
    """Display tokens (words with punctuation) and paragraph starts."""
    out: list[dict] = []
    for pi, para in enumerate(p for p in re.split(r"\n\s*\n", text.strip()) if p.strip()):
        for wi, m in enumerate(re.finditer(r"\S+", para)):
            out.append({"w": m.group(0), "p": 1 if (wi == 0 and pi > 0) else 0})
    return out


def _pause_weight(tok: str) -> float:
    if re.search(r"[.!?…]['\"”’)]*$", tok):
        return 6.0
    if re.search(r"[,;:—–-]['\"”’)]*$", tok):
        return 3.0
    return 0.0


def estimate(text: str, duration: float, lead: float = 0.1) -> dict:
    """Spread words over the audio proportionally to length, with punctuation pauses."""
    toks = _tokens(text)
    if not toks or duration <= 0:
        return {"duration": duration, "estimated": True, "words": []}
    weights = []
    for i, t in enumerate(toks):
        w = max(1, len(_norm(t["w"]))) + 1.5
        pre = 8.0 if t["p"] else 0.0  # paragraph pause before
        weights.append((pre, w, _pause_weight(t["w"])))
    total_w = sum(a + b + c for a, b, c in weights)
    span = max(0.1, duration - lead - 0.3)
    k = span / total_w
    t_now = lead
    words = []
    for tok, (pre, w, post) in zip(toks, weights):
        t_now += pre * k
        start = t_now
        t_now += w * k
        words.append([round(start, 3), round(t_now, 3), tok["w"], tok["p"]])
        t_now += post * k
    return {"duration": duration, "estimated": True, "words": words}


def align(text: str, boundaries: list[tuple[float, float, str]], duration: float) -> dict:
    """Map TTS word boundaries (start, dur, word) onto display tokens of text."""
    toks = _tokens(text)
    if not toks:
        return {"duration": duration, "estimated": False, "words": []}
    starts: list[float | None] = [None] * len(toks)
    ends: list[float | None] = [None] * len(toks)
    norms = [_norm(t["w"]) for t in toks]
    cur = 0
    matched = 0
    for b_start, b_dur, b_word in boundaries:
        bw = _norm(b_word)
        if not bw:
            continue
        for j in range(cur, min(len(toks), cur + 8)):
            if bw in norms[j]:
                if starts[j] is None:
                    starts[j] = b_start
                ends[j] = b_start + b_dur
                cur = j
                matched += 1
                break
    if matched < max(3, 0.5 * len(toks)):
        return estimate(text, duration)
    # fill gaps by interpolating between known neighbours
    known = [i for i, s in enumerate(starts) if s is not None]
    words = []
    for i, tok in enumerate(toks):
        s, e = starts[i], ends[i]
        if s is None:
            prev = max((k for k in known if k < i), default=None)
            nxt = min((k for k in known if k > i), default=None)
            a = ends[prev] if prev is not None else 0.0
            bnd = starts[nxt] if nxt is not None else duration
            lo = prev if prev is not None else -1
            hi = nxt if nxt is not None else len(toks)
            frac = (i - lo) / (hi - lo)
            s = a + (bnd - a) * frac * 0.9
            e = s + max(0.05, (bnd - a) / (hi - lo) * 0.8)
        words.append([round(s, 3), round(e, 3), tok["w"], tok["p"]])
    return {"duration": duration, "estimated": False, "words": words}


def combine(parts: list[dict]) -> dict:
    """Join per-part timings, shifting by cumulative part durations."""
    words: list = []
    offset = 0.0
    est = False
    for pi, t in enumerate(parts):
        est = est or bool(t.get("estimated"))
        for k, w in enumerate(t.get("words") or []):
            para = w[3] if len(w) > 3 else 0
            if k == 0 and pi > 0:
                para = 1
            words.append([round(w[0] + offset, 3), round(w[1] + offset, 3), w[2], para])
        offset += float(t.get("duration") or 0)
    return {"duration": round(offset, 3), "estimated": est, "words": words}


def write(path: Path, timings: dict) -> None:
    path.write_text(json.dumps(timings, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
