# Dockerfile: описує, як зібрати контейнер для запуску Flask + frontend у production-like середовищі.
# Кожен крок нижче відповідає за встановлення Python-залежностей і запуск backend/app.py.
FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt
COPY . /app
WORKDIR /app/backend
ENV FLASK_ENV=production
ENV NEGOTIATION_DSS_SECRET=change_me_in_production
EXPOSE 5000
CMD ["python", "app.py"]
