// =============================================================================
// Negotiation DSS — frontend module
// -----------------------------------------------------------------------------
// Цей файл містить логіку клієнтської частини системи. Коментарі пояснюють,
// які дані формуються, як вони передаються у Flask backend, як працює UI,
// матричний режим, режим критеріїв, історія користувача та візуалізація.
// =============================================================================

window.criteriaData = [
    {
        id: "work_schedule",
        name: "Графік роботи",
        type: "select",
        options: [
            { value: "free", label: "Вільний", scores: { A: 1.0, B: 0.2 } },
            { value: "flex", label: "Гнучкий", scores: { A: 0.7, B: 0.5 } },
            { value: "shift", label: "Позмінний", scores: { A: 0.5, B: 0.7 } },
            { value: "standard", label: "Стандартний (5/2)", scores: { A: 0.2, B: 1.0 } }
        ]
    },

    {
        id: "location",
        name: "Місце роботи",
        type: "select",
        options: [
            { value: "remote", label: "Із дому", scores: { A: 1.0, B: 0.1 } },
            { value: "hybrid", label: "Гібрид", scores: { A: 0.6, B: 0.6 } },
            { value: "office", label: "В офісі", scores: { A: 0.1, B: 1.0 } }
        ]
    },

    {
        id: "salary_model",
        name: "Модель оплати",
        type: "select",
        options: [
            { value: "fixed", label: "Фіксована ставка", scores: { A: 0.4, B: 0.6 } },
            { value: "bonus", label: "Ставка + бонус", scores: { A: 0.6, B: 0.6 } },
            { value: "commission", label: "Відсоток від продажу", scores: { A: 0.2, B: 0.9 } }
        ]
    },

    {
        id: "social_package",
        name: "Соціальний пакет",
        type: "select",
        options: [
            { value: "low", label: "Мінімальний", scores: { A: 0.2, B: 0.8 } },
            { value: "medium", label: "Середній", scores: { A: 0.6, B: 0.6 } },
            { value: "high", label: "Максимальний", scores: { A: 0.9, B: 0.3 } }
        ]
    },

    {
        id: "project_term",
        name: "Термін проєкту",
        type: "select",
        options: [
            { value: "short", label: "Короткий", scores: { A: 0.3, B: 0.7 } },
            { value: "mid", label: "Середній", scores: { A: 0.6, B: 0.6 } },
            { value: "long", label: "Довгостроковий", scores: { A: 0.8, B: 0.3 } }
        ]
    },

    {
        id: "warranty",
        name: "Гарантія",
        type: "select",
        options: [
            { value: "1y", label: "1 рік", scores: { A: 0.3, B: 0.8 } },
            { value: "3y", label: "3 роки", scores: { A: 0.8, B: 0.3 } }
        ]
    }
];