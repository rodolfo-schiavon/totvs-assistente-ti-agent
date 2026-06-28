import os


def resolve_cors_origins() -> list[str]:
    origins: set[str] = {"http://localhost:3000"}
    primary = (os.getenv("FRONTEND_URL") or "").strip().rstrip("/")
    if primary:
        origins.add(primary)
    extra = (os.getenv("ALLOWED_ORIGINS") or "").strip()
    if extra:
        for part in extra.split(","):
            v = part.strip().rstrip("/")
            if v:
                origins.add(v)
    return sorted(origins)
