import urllib.error

import aiclient

KEYS = ["GROQ_API_KEY", "GEMINI_API_KEY", "OPENROUTER_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"]


def clear(monkeypatch):
    for k in KEYS:
        monkeypatch.delenv(k, raising=False)


def err(code):
    return urllib.error.HTTPError("u", code, "x", {"Retry-After": "0"}, None)


def test_no_key_returns_none(monkeypatch):
    clear(monkeypatch)
    assert aiclient.complete("s", "u") is None


def test_retry_then_success(monkeypatch):
    clear(monkeypatch)
    monkeypatch.setenv("GROQ_API_KEY", "gsk_x")
    calls = []

    def fake(name, key, model, system, user):
        calls.append(model)
        if len(calls) == 1:
            raise err(429)
        return "ok"

    monkeypatch.setattr(aiclient, "_request", fake)
    assert aiclient.complete("s", "u", sleep=lambda s: None) == "ok" and calls == [aiclient.CHAINS["groq"][0]] * 2


def test_falls_back_to_smaller_model(monkeypatch):
    clear(monkeypatch)
    monkeypatch.setenv("GROQ_API_KEY", "gsk_x")
    models = []

    def fake(name, key, model, system, user):
        models.append(model)
        if model.endswith("120b"):
            raise err(429)
        return "small"

    monkeypatch.setattr(aiclient, "_request", fake)
    assert aiclient.complete("s", "u", sleep=lambda s: None) == "small" and models[-1] == "openai/gpt-oss-20b"


def test_bad_key_and_exhausted(monkeypatch):
    clear(monkeypatch)
    monkeypatch.setenv("GEMINI_API_KEY", "AIza")
    monkeypatch.setattr(aiclient, "_request", lambda *a: (_ for _ in ()).throw(err(401)))
    try:
        aiclient.complete("s", "u", sleep=lambda s: None)
        assert False
    except aiclient.AIError as e:
        assert "rejected" in str(e)
    monkeypatch.setattr(aiclient, "_request", lambda *a: (_ for _ in ()).throw(err(429)))
    try:
        aiclient.complete("s", "u", sleep=lambda s: None)
        assert False
    except aiclient.AIError as e:
        assert "429" in str(e)
