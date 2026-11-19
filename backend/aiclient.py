"""Provider-agnostic chat client with retry and model fallback. Standard library only."""
import json
import os
import time
import urllib.error
import urllib.request


class AIError(Exception):
    pass


PROVIDERS = [("GROQ_API_KEY", "groq"), ("GEMINI_API_KEY", "gemini"), ("OPENROUTER_API_KEY", "openrouter"),
             ("OPENAI_API_KEY", "openai"), ("ANTHROPIC_API_KEY", "anthropic")]
CHAINS = {"groq": ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"], "gemini": ["gemini-flash-latest", "gemini-flash-lite-latest"],
          "openrouter": ["openrouter/auto"], "openai": ["gpt-4o-mini"], "anthropic": ["claude-haiku-5-5"]}
URLS = {"groq": "https://api.groq.com/openai/v1/chat/completions", "openrouter": "https://openrouter.ai/api/v1/chat/completions",
        "openai": "https://api.openai.com/v1/chat/completions", "anthropic": "https://api.anthropic.com/v1/messages"}


def pick():
    for env, name in PROVIDERS:
        key = os.getenv(env)
        if key:
            return name, key
    return None, None


def _request(name, key, model, system, user):
    user = user[:6000]
    if name == "gemini":
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        headers = {"x-goog-api-key": key}
        body = {"systemInstruction": {"parts": [{"text": system}]}, "contents": [{"role": "user", "parts": [{"text": user}]}]}
    elif name == "anthropic":
        url = URLS[name]
        headers = {"x-api-key": key, "anthropic-version": "2023-06-01"}
        body = {"model": model, "max_tokens": 700, "system": system, "messages": [{"role": "user", "content": user}]}
    else:
        url = URLS[name]
        headers = {"Authorization": f"Bearer {key}"}
        limit = {"max_completion_tokens": 700} if name == "openai" else {"max_tokens": 700}
        body = {"model": model, "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}], **limit}
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json", **headers}, method="POST")
    with urllib.request.urlopen(req, timeout=25) as r:
        d = json.load(r)
    if name == "gemini":
        return d["candidates"][0]["content"]["parts"][0]["text"]
    if name == "anthropic":
        return d["content"][0]["text"]
    return d["choices"][0]["message"]["content"]


def complete(system, user, sleep=time.sleep):
    """Return the model's answer, None when no provider key is set, or raise AIError."""
    name, key = pick()
    if not name:
        return None
    last = None
    for model in CHAINS[name]:
        for attempt in range(2):
            try:
                return _request(name, key, model, system, user)
            except urllib.error.HTTPError as e:
                last = e.code
                if e.code in (401, 403):
                    raise AIError(f"{name} rejected the API key")
                if e.code in (429, 503) and attempt == 0:
                    try:
                        wait = int(e.headers.get("Retry-After") or 3)
                    except (TypeError, ValueError):
                        wait = 3
                    sleep(min(wait, 15))
                    continue
                break
            except Exception:
                raise AIError(f"{name} could not be reached")
    raise AIError(f"{name} failed (HTTP {last}). Check usage limits or try later")
