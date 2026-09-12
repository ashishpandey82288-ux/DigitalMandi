# ==============================================================================
# KisanFlow — Self-Hosted Computer Vision Quality Grading ML Service
# Python 3.11 Slim with FastAPI & Local Optical Inference Engine
# ==============================================================================

FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

# Install minimal OS runtime packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency specifications if any, or install production FastAPI stack
COPY apps/ml-service/requirements.txt* /app/
RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; \
    else pip install --no-cache-dir fastapi uvicorn pydantic; fi

# Copy application code
COPY apps/ml-service /app/

# Create unprivileged service user
RUN useradd -m -u 1001 kisanflow_ml && \
    chown -R kisanflow_ml:kisanflow_ml /app

USER kisanflow_ml

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["python", "app/main.py"]
