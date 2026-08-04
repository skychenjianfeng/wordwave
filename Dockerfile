# ---------- 前端构建阶段 ----------
FROM node:22-alpine AS fe
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ---------- Django 运行阶段 ----------
FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple \
    PIP_TRUSTED_HOST=pypi.tuna.tsinghua.edu.cn \
    DJANGO_SETTINGS_MODULE=wordwave.settings
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend ./backend
COPY --from=fe /app/dist ./dist
COPY public/data/dicts ./public/data/dicts
COPY public/data/articles ./public/data/articles
RUN mkdir -p server/.speech-cache && cd backend && python manage.py collectstatic --noinput
EXPOSE 8000
CMD ["gunicorn", "--chdir", "backend", "--bind", "0.0.0.0:8000", "wordwave.wsgi:application"]
