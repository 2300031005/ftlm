FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY pyproject.toml README.md ./
COPY backend/ ./backend/
COPY data/snapshot/ ./data/snapshot/

RUN pip install --upgrade pip \
    && pip install \
        "fastapi>=0.115.0" \
        "httpx>=0.28.0" \
        "pandas>=2.2.0" \
        "pydantic>=2.10.0" \
        "uvicorn[standard]>=0.32.0"

EXPOSE 8000

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
