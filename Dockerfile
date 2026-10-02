# ==========================================
# Stage 1: Frontend Builder
# ==========================================
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: Runtime Python
# ==========================================
FROM python:3.12-slim
WORKDIR /app

# Install ffmpeg (required by yt-dlp) and curl for healthcheck/debugging
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg curl && \
    rm -rf /var/lib/apt/lists/*

# Install backend dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application source
COPY backend/app ./app

# Copy built frontend assets from stage 1
COPY --from=frontend-builder /app/frontend/dist ./static

ENV PYTHONUNBUFFERED=1 \
    STATIC_DIR=/app/static \
    PORT=8080

EXPOSE 8080

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
