"""Optional, bounded integration with a local Ollama-compatible Laya model.

The deterministic recommender remains authoritative for exclusions and affinity.
Laya only reorders a small candidate set; timeouts or malformed responses are ignored.
"""
from __future__ import annotations

import json
import logging
import os
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)


def reorder_tracks(tracks: list[dict], *, profile: list[str], mood: str = "") -> list[dict]:
    base_url = os.getenv("LAYA_BASE_URL", "").strip().rstrip("/")
    if not base_url or not tracks:
        return tracks

    candidates = tracks[:40]
    prompt = {
        "task": "Rank songs for personal music discovery. Return only JSON: {\"ids\":[...]}.",
        "profile": profile[:12],
        "mood": mood,
        "songs": [{"id": t.get("id"), "title": t.get("title"), "artist": t.get("artist"), "album": t.get("album"), "genres": t.get("genres", [])} for t in candidates],
        "rules": "Use only supplied ids, each at most once. Prefer taste fit and variety. Do not infer BPM or facts absent from metadata.",
    }
    try:
        model = os.getenv("LAYA_MODEL", "laya").strip() or "laya"
        timeout = min(max(float(os.getenv("LAYA_TIMEOUT_SECONDS", "2.5")), 0.2), 8.0)
        body = json.dumps({"model": model, "stream": False, "format": "json", "options": {"temperature": 0, "num_predict": 256}, "messages": [{"role": "user", "content": json.dumps(prompt, ensure_ascii=False)}]}).encode()
        request = Request(f"{base_url}/api/chat", data=body, headers={"Content-Type": "application/json"}, method="POST")
        with urlopen(request, timeout=timeout) as response:
            result = json.loads(response.read(256_000))
        content = result.get("message", {}).get("content", "")
        ids = json.loads(content).get("ids", [])
        by_id = {str(track.get("id")): track for track in candidates}
        ordered = []
        for item in ids:
            if isinstance(item, str) and item in by_id:
                ordered.append(by_id.pop(item))
        seen = {str(track.get("id")) for track in ordered}
        return ordered + [track for track in tracks if str(track.get("id")) not in seen]
    except Exception as exc:
        logger.info("Laya no disponible para personalización: %s", exc)
        return tracks
