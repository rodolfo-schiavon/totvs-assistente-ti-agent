from services.llm_errors import friendly_llm_error


def test_friendly_llm_error_model_not_found():
    raw = (
        'Error code: 404 - {"type": "error", "error": {"type": "not_found_error", '
        '"message": "model: claude-3-5-haiku-20241022"}}'
    )
    msg = friendly_llm_error(raw)
    assert "claude-3-5-haiku-20241022" in msg
    assert "Admin" in msg or "LLM" in msg


def test_friendly_llm_error_passthrough():
    assert friendly_llm_error("timeout") == "timeout"
