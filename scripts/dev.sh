#!/usr/bin/env bash
set -e

# Raíz del proyecto
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Función para detener ambos procesos al salir con Ctrl+C
cleanup() {
  echo ""
  echo "Deteniendo backend y frontend..."
  kill $(jobs -p) 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

echo "Iniciando Backend (FastAPI en http://127.0.0.1:8000)..."
cd "$ROOT_DIR/backend"
.venv/bin/uvicorn app.main:app --reload --port 8000 &

echo "Iniciando Frontend (Vite en http://localhost:5173)..."
cd "$ROOT_DIR/frontend"
npm run dev &

wait
