"""Optional, bounded integration with the local Laya System-1 HTTP API.

The deterministic recommender remains authoritative for exclusions and affinity.
Laya only reorders a small candidate set; timeouts or malformed responses are ignored.
"""
from __future__ import annotations

import json
import logging
import math
import os
import threading
import time
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)
_inference_lock = threading.Lock()
_next_allowed_call = 0.0


def reorder_tracks(tracks: list[dict], *, profile: list[str], mood: str = "") -> list[dict]:
    global _next_allowed_call
    base_url = os.getenv("LAYA_BASE_URL", "").strip().rstrip("/")
    if not base_url or not tracks:
        return tracks
    now = time.monotonic()
    if now < _next_allowed_call or not _inference_lock.acquire(blocking=False):
        return tracks

    try:
        # Laya runs on CPU in this server. A choice among 12 candidates keeps its
        # System-1 input small and bounded; local affinity ranking remains the fallback.
        candidates = tracks[:12]
        criteria = {}
        for index, track in enumerate(candidates):
            genres = track.get("genres") or []
            if isinstance(genres, str):
                genres = [genres]
            details = [track.get("title", ""), track.get("artist", ""), track.get("album", ""), ", ".join(genres)]
            criteria[f"song_{index}"] = " — ".join(value for value in details if value)
        state = f"Listener taste: {', '.join(profile[:8]) or 'open to discovery'}."
        if mood:
            labels = {"focus": "focused, instrumental, low-distraction", "relax": "calm and relaxing", "energy": "upbeat and energetic", "night": "dark and atmospheric"}
            state += f" They want music that feels {labels.get(mood, mood)}."
        questions = {
            "selection": {
                "type": "choice",
                "instructions": "Choose the song that best fits the listener and requested mood using only the supplied metadata. Prefer a varied discovery when choices are similarly suitable.",
                "criteria": criteria,
            }
        }
        timeout = float(os.getenv("LAYA_TIMEOUT_SECONDS", "8"))
        if not math.isfinite(timeout):
            timeout = 2.5
        timeout = min(max(timeout, 0.2), 8.0)
        body = json.dumps({"state": state, "questions": questions, "task": "typed-decisions", "lang": "en", "max_len": 512}, ensure_ascii=False).encode()
        headers = {"Content-Type": "application/json"}
        api_key = os.getenv("LAYA_API_KEY", "").strip()
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        request = Request(f"{base_url}/v1/systemone", data=body, headers=headers, method="POST")
        with urlopen(request, timeout=timeout) as response:
            result = json.loads(response.read(256_000))
        answer = result.get("answers", {}).get("selection", {})
        choice = answer.get("choice")
        chosen_index = int(choice.removeprefix("song_")) if isinstance(choice, str) and choice.removeprefix("song_").isdigit() else -1
        if not 0 <= chosen_index < len(candidates):
            _next_allowed_call = time.monotonic() + 300
            return tracks
        probabilities = answer.get("probabilities")
        scores = {}
        if isinstance(probabilities, dict):
            scores = {key: float(value) for key, value in probabilities.items() if isinstance(value, (int, float)) and math.isfinite(value)}
        elif isinstance(probabilities, list):
            scores = {f"song_{index}": float(value) for index, value in enumerate(probabilities) if isinstance(value, (int, float)) and math.isfinite(value)}
        if scores:
            candidate_order = sorted(range(len(candidates)), key=lambda index: scores.get(f"song_{index}", -1), reverse=True)
        else:
            candidate_order = [chosen_index, *(index for index in range(len(candidates)) if index != chosen_index)]
        ordered_ids = {str(candidates[index].get("id")) for index in candidate_order}
        ordered = [candidates[index] for index in candidate_order]
        ordered.extend(track for track in tracks if str(track.get("id")) not in ordered_ids)
        _next_allowed_call = time.monotonic() + 10
        return ordered
    except Exception as exc:
        # A client timeout does not cancel Laya's CPU inference. Back off before
        # another request so traffic from more users cannot queue behind it.
        _next_allowed_call = time.monotonic() + 300
        logger.info("Laya no disponible para personalización: %s", exc)
        return tracks
    finally:
        _inference_lock.release()
