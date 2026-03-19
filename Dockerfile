# ── Etapa 1: build do frontend React ──────────────────────────
FROM node:20-alpine AS frontend

WORKDIR /app
COPY package*.json ./
RUN npm ci --include=dev

COPY . .
RUN npm run build

# ── Etapa 2: runtime Python + frontend compilado ──────────────
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .
COPY --from=frontend /app/static ./static

EXPOSE 5000

ENV PORT=5000
ENV HOST=0.0.0.0

CMD ["python", "app.py"]
