# =============================================================================
# Negotiation DSS — backend module
# -----------------------------------------------------------------------------
# Цей файл є частиною дипломного проєкту СППР для переговорів.
# Коментарі спеціально зроблені детальними, щоб під час захисту було легко
# пояснити призначення кожного блоку: маршрути Flask, роботу з БД, авторизацію,
# розрахунок Nash equilibrium, компромісні рекомендації та історію користувача.
# =============================================================================

BUSINESS_PRESET = {
    "criteria": [
        {"id": "contract_term", "name": "Термін контракту", "type": "select", "options": [
            {"value": "short", "label": "Короткий", "scores": {"A": 0.4, "B": 0.8}},
            {"value": "medium", "label": "Середній", "scores": {"A": 0.7, "B": 0.7}},
            {"value": "long", "label": "Довгостроковий", "scores": {"A": 0.9, "B": 0.4}}
        ]},
        {"id": "payment_model", "name": "Модель оплати", "type": "select", "options": [
            {"value": "fixed", "label": "Фіксована ставка", "scores": {"A": 0.5, "B": 0.6}},
            {"value": "bonus", "label": "Ставка + бонус", "scores": {"A": 0.7, "B": 0.7}},
            {"value": "percent", "label": "Відсоток від продажу", "scores": {"A": 0.3, "B": 0.9}}
        ]},
        {"id": "support_level", "name": "Рівень підтримки", "type": "select", "options": [
            {"value": "basic", "label": "Мінімальний", "scores": {"A": 0.3, "B": 0.8}},
            {"value": "standard", "label": "Середній", "scores": {"A": 0.6, "B": 0.6}},
            {"value": "premium", "label": "Максимальний", "scores": {"A": 0.9, "B": 0.3}}
        ]}
    ],
    "partyA": {"name": "Замовник", "weights": {"contract_term": 0.35, "payment_model": 0.35, "support_level": 0.3}, "strategies": [
        {"contract_term": "medium", "payment_model": "bonus", "support_level": "standard"},
        {"contract_term": "long", "payment_model": "fixed", "support_level": "premium"}
    ]},
    "partyB": {"name": "Виконавець", "weights": {"contract_term": 0.3, "payment_model": 0.45, "support_level": 0.25}, "strategies": [
        {"contract_term": "short", "payment_model": "percent", "support_level": "basic"},
        {"contract_term": "medium", "payment_model": "bonus", "support_level": "standard"}
    ]}
}
