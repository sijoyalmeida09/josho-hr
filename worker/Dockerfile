# josho-hr worker — deployed to Fly.io.
#
# BUILD CONTEXT: the josho-hr monorepo ROOT (not josho-hr/worker).
# This lets us COPY job_hunter_v2 from its untouched original location.
#
# Deploy:
#   fly deploy --config josho-hr/worker/fly.toml \
#              --dockerfile josho-hr/worker/Dockerfile
#   (fly auto-detects the repo root as context)

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app:/app/vendor

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2 libatspi2.0-0 \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY josho-hr/worker/pyproject.toml ./
RUN pip install --upgrade pip && \
    pip install "supabase>=2.6.0,<3" "httpx>=0.27,<1" "cryptography>=42,<44" \
    "playwright>=1.45,<2" "python-dotenv>=1.0" "pydantic>=2.7,<3" \
    pdfplumber openpyxl beautifulsoup4 lxml reportlab

# Worker source (our wrapper code)
COPY josho-hr/worker/ ./

# Vendored reference — the ORIGINAL job_hunter_v2 code, unmodified.
# Our adapters import from here via PYTHONPATH=/app/vendor.
COPY automation/sijoy-os/job_hunter_v2/ ./vendor/job_hunter_v2/

RUN python -m playwright install --with-deps chromium

EXPOSE 8080

CMD ["python", "-m", "main"]
