# =============================================================================
# Negotiation DSS — backend module
# -----------------------------------------------------------------------------
# Цей файл є частиною дипломного проєкту СППР для переговорів.
# Коментарі спеціально зроблені детальними, щоб під час захисту було легко
# пояснити призначення кожного блоку: маршрути Flask, роботу з БД, авторизацію,
# розрахунок Nash equilibrium, компромісні рекомендації та історію користувача.
# =============================================================================

HR_PRESET = {
    "criteria": [
        {"id": "salary", "name": "Заробітна плата", "type": "number", "placeholder": "грн"},
        {"id": "work_schedule", "name": "Графік роботи", "type": "select", "options": [
            {"value": "free", "label": "Вільний", "scores": {"A": 1.0, "B": 0.2}},
            {"value": "flex", "label": "Гнучкий", "scores": {"A": 0.7, "B": 0.5}},
            {"value": "shift", "label": "Позмінний", "scores": {"A": 0.5, "B": 0.7}},
            {"value": "standard", "label": "Стандартний (5/2)", "scores": {"A": 0.2, "B": 1.0}}
        ]},
        {"id": "location", "name": "Локація", "type": "select", "options": [
            {"value": "remote", "label": "Із дому", "scores": {"A": 1.0, "B": 0.1}},
            {"value": "hybrid", "label": "Змішаний (Гібрид)", "scores": {"A": 0.6, "B": 0.6}},
            {"value": "office", "label": "На робочому місці", "scores": {"A": 0.1, "B": 1.0}}
        ]}
    ],
    "partyA": {"name": "Кандидат", "weights": {"salary": 0.5, "work_schedule": 0.3, "location": 0.2}, "strategies": [
        {"salary": 35000, "work_schedule": "flex", "location": "hybrid"},
        {"salary": 42000, "work_schedule": "free", "location": "remote"}
    ]},
    "partyB": {"name": "Роботодавець", "weights": {"salary": 0.6, "work_schedule": 0.25, "location": 0.15}, "strategies": [
        {"salary": 30000, "work_schedule": "standard", "location": "office"},
        {"salary": 36000, "work_schedule": "flex", "location": "hybrid"}
    ]}
}
