# =============================================================================
# Negotiation DSS — backend module
# -----------------------------------------------------------------------------
# Цей файл є частиною дипломного проєкту СППР для переговорів.
# Коментарі спеціально зроблені детальними, щоб під час захисту було легко
# пояснити призначення кожного блоку: маршрути Flask, роботу з БД, авторизацію,
# розрахунок Nash equilibrium, компромісні рекомендації та історію користувача.
# =============================================================================

PROCUREMENT_PRESET = {
    "criteria": [
        {"id": "unit_price", "name": "Ціна за одиницю", "type": "number", "placeholder": "грн/шт"},
        {"id": "delivery_time", "name": "Термін доставки", "type": "select", "options": [
            {"value": "fast", "label": "1-3 дні", "scores": {"A": 1.0, "B": 0.3}},
            {"value": "week", "label": "До 1 тижня", "scores": {"A": 0.7, "B": 0.7}},
            {"value": "two_weeks", "label": "До 2 тижнів", "scores": {"A": 0.3, "B": 1.0}}
        ]},
        {"id": "warranty", "name": "Термін гарантії", "type": "number", "placeholder": "місяців"}
    ],
    "partyA": {"name": "Покупець", "weights": {"unit_price": 0.45, "delivery_time": 0.35, "warranty": 0.2}, "strategies": [
        {"unit_price": 120, "delivery_time": "fast", "warranty": 24},
        {"unit_price": 100, "delivery_time": "week", "warranty": 12}
    ]},
    "partyB": {"name": "Постачальник", "weights": {"unit_price": 0.6, "delivery_time": 0.25, "warranty": 0.15}, "strategies": [
        {"unit_price": 130, "delivery_time": "week", "warranty": 36},
        {"unit_price": 110, "delivery_time": "two_weeks", "warranty": 24}
    ]}
}
