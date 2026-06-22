// =============================================================================
// Negotiation DSS — frontend module
// -----------------------------------------------------------------------------
// Цей файл містить логіку клієнтської частини системи. Коментарі пояснюють,
// які дані формуються, як вони передаються у Flask backend, як працює UI,
// матричний режим, режим критеріїв, історія користувача та візуалізація.
// =============================================================================

// Нормалізує опцію критерію: string → об’єкт із value, label, scores.
// Функція `normalizeCriterionOption` — окремий логічний крок frontend-модуля.
function normalizeCriterionOption(opt) {
    if (typeof opt === "string") {
        return { value: opt, label: opt, scores: { A: 0, B: 0 } };
    }
    return {
        value: opt.value ?? opt.label,
        label: opt.label ?? opt.value,
        scores: opt.scores || { A: 0, B: 0 }
    };
}

// Нормалізує критерій перед відправкою на backend.
// Функція `normalizeCriterion` — окремий логічний крок frontend-модуля.
function normalizeCriterion(raw) {
    return {
        id: raw.id,
        name: raw.name,
        type: raw.type || "number",
        placeholder: raw.placeholder || "0",
        options: raw.type === "select" ? (raw.options || []).map(normalizeCriterionOption) : null
    };
}

// Повертає активний режим аналізу: criteria або matrix.
// Функція `getAnalysisMode` — окремий логічний крок frontend-модуля.
function getAnalysisMode() {
    return document.getElementById("analysisMode")?.value || "criteria";
}

// Функція `parseInputValue` — окремий логічний крок frontend-модуля.
function parseInputValue(value, type) {
    if (type === "number") {
        const n = Number(value);
        return Number.isFinite(n) ? n : 0;
    }
    return value;
}

// Збирає ваги критеріїв зі slider input-ів.
// Функція `buildWeights` — окремий логічний крок frontend-модуля.
function buildWeights(selector) {
    const weights = {};
    document.querySelectorAll(selector).forEach(input => {
        weights[input.dataset.critId] = (parseFloat(input.value) || 0) / 100;
    });
    return weights;
}

// Збирає масив стратегій із DOM-карток, використовуючи тільки data-crit-id.
// Функція `buildStrategies` — окремий логічний крок frontend-модуля.
function buildStrategies(containerSelector) {
    const strategies = [];
    document.querySelectorAll(`${containerSelector} .strategy-card`).forEach(card => {
        const strategy = {};
        card.querySelectorAll(".strat-val").forEach(input => {
            const critId = input.dataset.critId;
            const criterion = currentCriteria.find(c => c.id === critId);
            if (!critId || !criterion) return;
            strategy[critId] = parseInputValue(input.value, criterion.type);
        });
        strategies.push(strategy);
    });
    return strategies;
}

// Функція `readMatrix` — окремий логічний крок frontend-модуля.
function readMatrix(className) {
    const matrix = [[0, 0], [0, 0]];
    document.querySelectorAll(`.${className}`).forEach(input => {
        const r = Number(input.dataset.row);
        const c = Number(input.dataset.col);
        const value = Number(input.value);
        matrix[r][c] = Number.isFinite(value) ? value : 0;
    });
    return matrix;
}

// Формує payload для матричного режиму, де користувач вводить A[i][j] та B[i][j].
// Функція `buildMatrixPayload` — окремий логічний крок frontend-модуля.
function buildMatrixPayload() {
    return {
        mode: "matrix",
        criteria: [],
        partyA: {
            name: "Сторона А",
            strategies: [{ name: "A1" }, { name: "A2" }]
        },
        partyB: {
            name: "Сторона Б",
            strategies: [{ name: "B1" }, { name: "B2" }]
        },
        payoff_matrix_A: readMatrix("matrix-a"),
        payoff_matrix_B: readMatrix("matrix-b")
    };
}

// Функція `buildCriteriaPayload` — окремий логічний крок frontend-модуля.
function buildCriteriaPayload() {
    return {
        mode: "criteria",
        criteria: currentCriteria.map(normalizeCriterion),
        partyA: {
            name: "Сторона А",
            weights: buildWeights(".w-range-A"),
            strategies: buildStrategies("#partyAContainer")
        },
        partyB: {
            name: "Сторона Б",
            weights: buildWeights(".w-range-B"),
            strategies: buildStrategies("#partyBContainer")
        }
    };
}

// Формує фінальний payload для Flask backend у єдиному форматі crit_id → value.
// Функція `buildJsonFromForm` — окремий логічний крок frontend-модуля.
function buildJsonFromForm() {
    const payload = getAnalysisMode() === "matrix"
        ? buildMatrixPayload()
        : buildCriteriaPayload();

    console.log("NORMALIZED PAYLOAD:", payload);
    return payload;
}

window.buildJsonFromForm = buildJsonFromForm;
window.normalizeCriterion = normalizeCriterion;
window.getAnalysisMode = getAnalysisMode;
