from fastapi.testclient import TestClient
from main import app

c = TestClient(app)


def test_health():
    assert c.get("/api/health").json()["status"] == "ok"


def test_ml():
    r = c.post("/api/ml/predict", json={"x": [1, 2, 3], "y": [2, 4, 6], "predict": 4}).json()
    assert r["prediction"] == 8


def test_scan():
    r = c.post("/api/security/scan", json={"text": "id=1 OR 1=1"}).json()
    assert "SQL injection" in r["findings"]


def test_login_fail():
    assert c.post("/api/auth/login", json={"username": "x", "password": "y"}).status_code == 401


def test_anomaly():
    r = c.post("/api/anomaly", json={"values": [10, 11, 10, 12, 11, 10, 95, 11]}).json()
    assert 6 in r["anomalies"]


def test_rag(tmp_path, monkeypatch):
    import main
    monkeypatch.setattr(main, "DB", str(tmp_path / "t.db"))
    c.post("/api/rag/add", json={"title": "kb", "text": "Nexus Forge uses FastAPI for the backend.\n\nThe frontend is plain HTML and JavaScript."})
    r = c.post("/api/rag/ask", json={"question": "what backend framework"}).json()
    assert "FastAPI" in r["answer"]


def test_history_needs_login():
    assert c.get("/api/history").status_code == 401


def _tmpdb(tmp_path, monkeypatch):
    import main
    monkeypatch.setattr(main, "DB", str(tmp_path / "t.db"))


def test_signup_login(tmp_path, monkeypatch):
    _tmpdb(tmp_path, monkeypatch)
    assert c.post("/api/auth/signup", json={"username": "nikhil", "password": "longenough1"}).status_code == 200
    assert c.post("/api/auth/signup", json={"username": "nikhil", "password": "longenough1"}).status_code == 409
    tok = c.post("/api/auth/login", json={"username": "nikhil", "password": "longenough1"}).json()["token"]
    assert c.get("/api/history", headers={"Authorization": "Bearer " + tok}).status_code == 200
    assert c.post("/api/auth/login", json={"username": "nikhil", "password": "wrong"}).status_code == 401


def test_cluster_and_classify():
    r = c.post("/api/ml/cluster", json={"points": [[1, 1], [1.1, 1], [5, 5], [5.1, 5]], "k": 2}).json()
    assert r["labels"][0] == r["labels"][1] != r["labels"][2]
    r = c.post("/api/ml/classify", json={"X": [[1, 1], [1.1, 1], [5, 5], [5.1, 5]], "y": ["a", "a", "b", "b"], "query": [4.9, 5], "k": 3}).json()
    assert r["label"] == "b"


def test_ingest_summary(tmp_path, monkeypatch):
    _tmpdb(tmp_path, monkeypatch)
    c.post("/api/logs/ingest", json={"lines": ["id=1 OR 1=1", "Failed login 10.0.0.5", "Failed login 10.0.0.5", "Failed login 10.0.0.5"]})
    r = c.get("/api/logs/summary").json()
    assert r["high"] >= 2 and r["total"] == r["high"] + r["medium"] + r["low"]
