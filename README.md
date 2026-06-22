# Negotiation DSS v8


- Adaptive Weights: система аналізує історію користувача і пропонує нові ваги критеріїв.
- Analytics Dashboard: кількість аналізів, середній компроміс, частота переможних стратегій, найважливіші критерії.
- JWT + roles: користувач має роль `client`, користувач `admin` автоматично отримує роль `admin`; login повертає access_token.
- Docker + deploy files: Dockerfile, docker-compose.yml, render.yaml.
- Nashpy-ready solver: якщо встановлено `nashpy`, engine використовує support enumeration для більших матриць.
- UI Upgrade: dashboard cards + Wow Mode.
- PDF export: експорт поточного аналізу у PDF через reportlab.
- ML-style recommendation: історичний профіль ваг користувача зберігається у SQLite як user_preferences.

## Запуск локально

```powershell
cd backend
pip install -r requirements.txt
python init_db.py
python app.py
```

## Docker

```powershell
docker compose up --build
```

## Примітка про PostgreSQL

У docker-compose доданий PostgreSQL для deploy-ready архітектури. Поточна навчальна версія за замовчуванням використовує SQLite, щоб проєкт запускався без додаткових налаштувань.


## Коментарі в коді

- `backend/app.py` пояснює маршрути Flask, авторизацію, історію та експорт.
- `backend/services/game_engine.py` пояснює Nash, mixed Nash, Pareto, heatmap і компроміс.
- `frontend/js/main.js` описує загальний сценарій роботи UI.
- `frontend/js/ui/ui.js` пояснює побудову інтерфейсу, стратегій, форм і результатів.
- `frontend/js/core/payloadBuilder.js` пояснює, як формується JSON payload для backend.
- `frontend/style.css` розділений коментарями на логічні UI-зони.

