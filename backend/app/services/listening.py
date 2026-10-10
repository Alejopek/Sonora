"""Pure listening-signal rules shared by event ingestion and tests."""


def progress_delta(reported_seconds: int, stored_seconds: int, maximum: int = 120) -> int:
    return min(maximum, max(0, reported_seconds - stored_seconds))


def meaningful_play(listened_seconds: int, duration: int | None) -> bool:
    return listened_seconds >= min(30, max(10, int((duration or 120) * .25)))


def early_skip(listened_seconds: int, duration: int | None) -> bool:
    return listened_seconds < min(20, max(8, int((duration or 120) * .15)))
