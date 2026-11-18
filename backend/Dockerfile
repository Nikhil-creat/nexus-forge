FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN useradd -m app && chown -R app /app
USER app
HEALTHCHECK --interval=30s CMD python -c "import urllib.request as u;u.urlopen('http://localhost:8000/api/health')"
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
