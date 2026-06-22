// =============================================================================
// Negotiation DSS — frontend module
// -----------------------------------------------------------------------------
// Цей файл містить логіку клієнтської частини системи. Коментарі пояснюють,
// які дані формуються, як вони передаються у Flask backend, як працює UI,
// матричний режим, режим критеріїв, історія користувача та візуалізація.
// =============================================================================

// Показує поле для варіантів тільки тоді, коли критерій має тип select.
// Функція `toggleOptionsInput` — окремий логічний крок frontend-модуля.
function toggleOptionsInput() {
    const type = document.getElementById("newCritType").value;
    const optionsInput = document.getElementById("newCritOptions");
    if (optionsInput) optionsInput.style.display = type === "select" ? "block" : "none";
}

// Функція `generateId` — окремий логічний крок frontend-модуля.
function generateId(prefix = "crit") {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// Додає користувацький критерій у глобальний список currentCriteria.
// Функція `addNewCustomCriterion` — окремий логічний крок frontend-модуля.
function addNewCustomCriterion() {
    const nameInput = document.getElementById("newCritName");
    const typeInput = document.getElementById("newCritType");
    const optionsInput = document.getElementById("newCritOptions");
    const name = nameInput.value.trim();
    const type = typeInput.value;

    if (!name) return alert("Будь ласка, введіть назву критерію!");
    if (currentCriteria.some(c => c.name.toLowerCase() === name.toLowerCase())) {
        return alert("Критерій з такою назвою вже існує!");
    }

    let options = null;
    if (type === "select") {
        const values = optionsInput.value.split(",").map(x => x.trim()).filter(Boolean);
        if (!values.length) return alert("Введіть варіанти вибору через кому!");
        options = values.map((label, index) => ({
            value: label.toLowerCase().replaceAll(" ", "_"),
            label,
            scores: { A: values.length - index, B: index + 1 }
        }));
    }

    currentCriteria.push({ id: generateId(), name, type, options, placeholder: type === "number" ? "Значення..." : "" });
    nameInput.value = "";
    optionsInput.value = "";
    toggleOptionsInput();
    renderAllInputs();
}

// Функція `renderAllInputs` — окремий логічний крок frontend-модуля.
function renderAllInputs() {
    renderCriteriaList();
    refreshPartyWeightsSelectors();
    refreshAllStrategiesInputs();
    updateJsonPreview();
}

// Перемальовує список критеріїв у першій картці інтерфейсу.
// Функція `renderCriteriaList` — окремий логічний крок frontend-модуля.
function renderCriteriaList() {
    const container = document.getElementById("criteriaContainer");
    if (!container) return;
    if (!currentCriteria.length) {
        container.innerHTML = "<p class='text-muted' style='padding: 10px;'>Критеріїв немає.</p>";
        return;
    }
    container.innerHTML = "";
    currentCriteria.forEach(crit => {
        const row = document.createElement("div");
        row.className = "form-row";
        row.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding:6px 12px; background:rgba(255,255,255,0.02); border-radius:6px;";
        row.innerHTML = `
            <span style="font-weight:600; min-width:150px;">📋 ${crit.name}</span>
            <span class="badge" style="background:#334155; font-size:0.8rem; padding:4px 8px; border-radius:4px;">${crit.type === "number" ? "🔢 Число" : "🗂 Список"}</span>
            <button type="button" class="btn-delete" onclick="deleteCriterion('${crit.id}')" style="background:none; border:none; color:var(--accent-danger); font-size:1.4rem; cursor:pointer;">&times;</button>
        `;
        container.appendChild(row);
    });
}

// Функція `deleteCriterion` — окремий логічний крок frontend-модуля.
function deleteCriterion(id) {
    currentCriteria = currentCriteria.filter(c => c.id !== id);
    renderAllInputs();
}

// Створює/оновлює повзунки ваг окремо для Сторони A та Сторони B.
// Функція `refreshPartyWeightsSelectors` — окремий логічний крок frontend-модуля.
function refreshPartyWeightsSelectors() {
    renderWeightsForParty("partyA", "weightsContainerA", "w-range-A", "lblWA", "var(--accent-primary)");
    renderWeightsForParty("partyB", "weightsContainerB", "w-range-B", "lblWB", "var(--accent-success)");
    attachWeightListeners();
}

// Функція `renderWeightsForParty` — окремий логічний крок frontend-модуля.
function renderWeightsForParty(partyKey, containerId, className, labelPrefix, color) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const title = partyKey === "partyA" ? "Важливість критеріїв для Сторони А:" : "Важливість критеріїв для Сторони Б:";
    container.innerHTML = `<h4 style='margin-bottom:8px; font-size:0.95rem; color:${color};'>${title}</h4>`;
    if (!currentCriteria.length) {
        container.innerHTML += "<p class='text-muted' style='font-size:0.85rem;'>Створіть критерії, щоб налаштувати вагу</p>";
        return;
    }
    const defaultValue = Math.round(100 / currentCriteria.length);
    currentCriteria.forEach(crit => {
        const div = document.createElement("div");
        div.style.marginBottom = "8px";
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:2px;">
                <span>${crit.name}</span><span><strong id="${labelPrefix}_${crit.id}">${defaultValue}</strong>%</span>
            </div>
            <input type="range" class="${className}" data-crit-id="${crit.id}" min="0" max="100" value="${defaultValue}" style="width:100%; accent-color:${color};">
        `;
        container.appendChild(div);
    });
}

// Додає нову картку стратегії для обраної сторони переговорів.
// Функція `addStrategyRow` — окремий логічний крок frontend-модуля.
function addStrategyRow(partyKey, values = null) {
    const container = document.getElementById(`${partyKey}Container`);
    if (!container) return;
    const strategyId = generateId("strat");
    const row = document.createElement("div");
    row.className = "strategy-card";
    row.id = strategyId;
    row.style.cssText = "background:rgba(255,255,255,0.01); border:1px solid var(--border-color); border-radius:8px; padding:12px; margin-bottom:12px;";
    row.innerHTML = `
        <div class="strat-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:5px;">
            <span style="font-size:0.9rem; font-weight:600; color:var(--text-muted);">Варіант дії (Стратегія)</span>
            <button type="button" class="btn-delete" onclick="removeStrategyRow('${strategyId}')" style="padding:2px 8px; font-size:0.8rem;">Видалити</button>
        </div>
        <div class="strategy-inputs" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:10px;"></div>
    `;
    container.appendChild(row);
    refreshStrategyCardInputs(row, values);
    updateJsonPreview();
}

// Функція `removeStrategyRow` — окремий логічний крок frontend-модуля.
function removeStrategyRow(id) {
    document.getElementById(id)?.remove();
    updateJsonPreview();
}

// Функція `refreshStrategyCardInputs` — окремий логічний крок frontend-модуля.
function refreshStrategyCardInputs(card, values = null) {
    const fieldsContainer = card.querySelector(".strategy-inputs");
    if (!fieldsContainer) return;
    const previous = values || readCardValues(card);
    fieldsContainer.innerHTML = "";

    currentCriteria.forEach(crit => {
        const block = document.createElement("div");
        block.className = "input-inline";
        block.style.cssText = "display:flex; flex-direction:column; gap:4px;";
        const savedValue = previous[crit.id] ?? "";
        let inputHtml = "";

        if (crit.type === "select" && Array.isArray(crit.options)) {
            inputHtml = `<select class="strat-val" data-crit-id="${crit.id}" onchange="updateJsonPreview()" style="width:100%; padding:6px; background:var(--bg-main); color:var(--text-main); border:1px solid var(--border-color); border-radius:4px;">`;
            crit.options.forEach(rawOpt => {
                const opt = normalizeCriterion(rawOpt).options ? rawOpt : rawOpt;
                const value = typeof rawOpt === "string" ? rawOpt : (rawOpt.value ?? rawOpt.label);
                const label = typeof rawOpt === "string" ? rawOpt : (rawOpt.label ?? rawOpt.value);
                inputHtml += `<option value="${value}" ${String(savedValue) === String(value) || String(savedValue) === String(label) ? "selected" : ""}>${label}</option>`;
            });
            inputHtml += "</select>";
        } else {
            inputHtml = `<input type="number" class="strat-val" data-crit-id="${crit.id}" value="${savedValue !== "" ? savedValue : 0}" placeholder="${crit.placeholder || "0"}" oninput="updateJsonPreview()" style="width:100%; padding:6px; background:var(--bg-main); color:var(--text-main); border:1px solid var(--border-color); border-radius:4px;">`;
        }
        block.innerHTML = `<label style="font-size:0.8rem; color:var(--text-muted); text-align:left;">${crit.name}</label>${inputHtml}`;
        fieldsContainer.appendChild(block);
    });
}

// Функція `readCardValues` — окремий логічний крок frontend-модуля.
function readCardValues(card) {
    const values = {};
    card.querySelectorAll(".strat-val").forEach(input => {
        values[input.dataset.critId] = input.value;
    });
    return values;
}

// Функція `refreshAllStrategiesInputs` — окремий логічний крок frontend-модуля.
function refreshAllStrategiesInputs() {
    document.querySelectorAll("#partyAContainer .strategy-card, #partyBContainer .strategy-card").forEach(card => refreshStrategyCardInputs(card));
}

// Функція `fillStrategyInputs` — окремий логічний крок frontend-модуля.
function fillStrategyInputs(card, stratData) {
    if (!card || !stratData) return;
    card.querySelectorAll(".strat-val").forEach(input => {
        const id = input.dataset.critId;
        if (stratData[id] !== undefined) input.value = stratData[id];
    });
}

// Оновлює технічне JSON-прев’ю, щоб бачити, що саме піде на backend.
// Функція `updateJsonPreview` — окремий логічний крок frontend-модуля.
function updateJsonPreview() {
    const previewBlock = document.getElementById("jsonPreview");
    if (!previewBlock) return;
    previewBlock.innerText = JSON.stringify(buildJsonFromForm(), null, 2);
}

// Виводить результат аналізу: Nash, компроміс, пояснення, Pareto, heatmap.

function displayResults(data) {
    const card = document.getElementById("resultCard");
    const content = document.getElementById("resultContent");
    if (!card || !content) return;
    card.style.display = "block";
    if (data.error) {
        content.innerHTML = `<div class="error-msg">⛔ Помилка сервера: ${data.error}</div>`;
        return;
    }
    let html = `
        <p style="margin-bottom:8px;"><strong>Тип аналізу:</strong> <span class="badge" style="background:var(--accent-primary); color:#000; padding:2px 6px; border-radius:4px; font-weight:600;">${data.type || "Nash"}</span></p>
        <p style="margin-bottom:12px;"><strong>Ціна гри:</strong> <span style="color:var(--accent-success); font-weight:bold; font-size:1.1rem;">🌟 ${(data.game_value ?? 0).toFixed(4)}</span></p>
        <hr style="border:0; border-top:1px solid var(--border-color); margin:12px 0;">
        <h4 style="margin-bottom:8px; font-size:1rem; color:var(--text-main);">🤖 Оптимальний розподіл вибору стратегій:</h4>
    `;
    if (data.strategy_profile) {
        html += `<p style="font-weight:600; color:var(--accent-primary); margin-top:6px; font-size:0.9rem;">Сторона А:</p><ul style="padding-left:20px; margin:4px 0 10px 0;">`;
        data.strategy_profile.partyA.forEach((prob, idx) => html += `<li>Стратегія А${idx + 1}: <strong>${(prob * 100).toFixed(1)}%</strong></li>`);
        html += `</ul><p style="font-weight:600; color:var(--accent-success); margin-top:6px; font-size:0.9rem;">Сторона Б:</p><ul style="padding-left:20px; margin:4px 0 4px 0;">`;
        data.strategy_profile.partyB.forEach((prob, idx) => html += `<li>Стратегія Б${idx + 1}: <strong>${(prob * 100).toFixed(1)}%</strong></li>`);
        html += "</ul>";
    }

    if (data.ai_explanation) {
        const e = data.ai_explanation;
        html += `
            <hr style="border:0; border-top:1px solid var(--border-color); margin:12px 0;">
            <h4 style="margin-bottom:8px; color:var(--accent-primary);">🧠 ${e.title || "AI-пояснення рішення"}</h4>
            <div style="background:rgba(56,189,248,0.08); border:1px solid rgba(56,189,248,0.25); border-radius:8px; padding:12px;">
                <p style="margin-bottom:8px;"><strong>${e.summary || "Система сформувала пояснення рішення."}</strong></p>
                ${Array.isArray(e.bullets) && e.bullets.length ? `<ul style="padding-left:20px; margin:0;">${e.bullets.map(x => `<li style="margin-bottom:4px;">${x}</li>`).join("")}</ul>` : ""}
            </div>
        `;
    }

    if (data.compromise) {
        const c = data.compromise;
        html += `
            <hr style="border:0; border-top:1px solid var(--border-color); margin:12px 0;">
            <h4 style="margin-bottom:8px; color:var(--accent-success);">🤝 Рекомендований компроміс</h4>
            <div style="background:rgba(52,211,153,0.08); border:1px solid rgba(52,211,153,0.25); border-radius:8px; padding:12px;">
                <p><strong>Пара стратегій:</strong> ${c.partyA_label} + ${c.partyB_label}</p>
                <p><strong>Виграш A:</strong> ${Number(c.payoff_A).toFixed(3)} | <strong>Виграш B:</strong> ${Number(c.payoff_B).toFixed(3)}</p>
                <p><strong>Сумарна вигода:</strong> ${(Number(c.welfare) * 100).toFixed(1)}% | <strong>Баланс:</strong> ${(Number(c.fairness) * 100).toFixed(1)}%</p>
                <p style="margin-top:6px; color:var(--text-muted);">${c.explanation || "Система обрала пару з найкращим балансом вигоди та справедливості."}</p>
            </div>
        `;
    }

    if (data.generated_compromise) {
        const g = data.generated_compromise;
        html += `
            <hr style="border:0; border-top:1px solid var(--border-color); margin:12px 0;">
            <h4 style="margin-bottom:8px; color:var(--accent-success);">🛠 Генератор компромісної пропозиції</h4>
            <div style="background:rgba(52,211,153,0.06); border:1px solid rgba(52,211,153,0.22); border-radius:8px; padding:12px;">
                <p style="margin-bottom:8px;"><strong>${g.summary || "Система сформувала компромісні значення."}</strong></p>
                ${Array.isArray(g.items) && g.items.length ? `
                    <table style="width:100%; border-collapse:collapse; font-size:0.9rem; margin-top:8px;">
                        <thead>
                            <tr style="color:var(--text-muted); text-align:left; border-bottom:1px solid var(--border-color);">
                                <th style="padding:6px;">Критерій</th>
                                <th style="padding:6px;">Пропозиція</th>
                                <th style="padding:6px;">Причина</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${g.items.map(item => `
                                <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                                    <td style="padding:6px;">${item.criterion}</td>
                                    <td style="padding:6px;"><strong>${item.recommended_text}</strong></td>
                                    <td style="padding:6px; color:var(--text-muted);">${item.reason}</td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                ` : ""}
            </div>
        `;
    }


    if (data.pareto) {
        const p = data.pareto;
        html += `
            <hr style="border:0; border-top:1px solid var(--border-color); margin:12px 0;">
            <h4 style="margin-bottom:8px; color:var(--accent-primary);">📈 Pareto Frontier</h4>
            <div style="background:rgba(56,189,248,0.06); border:1px solid rgba(56,189,248,0.22); border-radius:8px; padding:12px;">
                <p style="margin-bottom:8px; color:var(--text-muted);">${p.summary || "Pareto-аналіз виконано."}</p>
                <p><strong>Pareto-optimal:</strong> ${(p.pareto_optimal || []).map(x => x.label).join(", ") || "—"}</p>
                <p style="margin-top:6px;"><strong>Доміновані:</strong> ${(p.dominated || []).map(x => x.label).join(", ") || "немає"}</p>
            </div>
        `;
    }

    if (data.heatmap || data.debug) {
        const A = data.heatmap?.matrix_A || data.debug?.payoff_matrix_A || [];
        const B = data.heatmap?.matrix_B || data.debug?.payoff_matrix_B || [];
        html += renderHeatmapBlock(A, B);
    }

    content.innerHTML = html;
}

// Функція `heatCellColor` — окремий логічний крок frontend-модуля.
function heatCellColor(value, min, max) {
    if (max === min) return "rgba(56,189,248,0.18)";
    const t = (value - min) / (max - min);
    const alpha = 0.12 + t * 0.55;
    return `rgba(56,189,248,${alpha.toFixed(2)})`;
}

// Функція `renderMatrixTable` — окремий логічний крок frontend-модуля.
function renderMatrixTable(matrix, title, accent) {
    if (!Array.isArray(matrix) || !matrix.length) return "";
    const values = matrix.flat().map(Number);
    const min = Math.min(...values);
    const max = Math.max(...values);

    const header = matrix[0].map((_, j) => `<th style="padding:6px; color:var(--text-muted);">B${j + 1}</th>`).join("");
    const rows = matrix.map((row, i) => `
        <tr>
            <th style="padding:6px; color:var(--text-muted); text-align:left;">A${i + 1}</th>
            ${row.map(v => `<td style="padding:8px; text-align:center; border:1px solid rgba(255,255,255,0.08); background:${heatCellColor(Number(v), min, max)};"><strong>${Number(v).toFixed(2)}</strong></td>`).join("")}
        </tr>
    `).join("");

    return `
        <div style="flex:1; min-width:240px;">
            <h5 style="margin-bottom:6px; color:${accent};">${title}</h5>
            <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
                <thead><tr><th></th>${header}</tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

// Функція `renderHeatmapBlock` — окремий логічний крок frontend-модуля.
function renderHeatmapBlock(A, B) {
    return `
        <hr style="border:0; border-top:1px solid var(--border-color); margin:12px 0;">
        <h4 style="margin-bottom:8px; color:var(--accent-success);">🎯 Heatmap матриці виграшів</h4>
        <div style="display:flex; gap:14px; flex-wrap:wrap; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:12px;">
            ${renderMatrixTable(A, "Матриця A", "var(--accent-primary)")}
            ${renderMatrixTable(B, "Матриця B", "var(--accent-success)")}
        </div>
    `;
}

// Функція `onAnalysisModeChanged` — окремий логічний крок frontend-модуля.
function onAnalysisModeChanged() {
    const mode = getAnalysisMode ? getAnalysisMode() : "criteria";
    const matrixPanel = document.getElementById("matrixModePanel");
    const criteriaWrapper = document.getElementById("partyAWrapper")?.previousElementSibling?.previousElementSibling;
    const partyA = document.getElementById("partyAWrapper");
    const partyB = document.getElementById("partyBWrapper");

    if (matrixPanel) matrixPanel.style.display = mode === "matrix" ? "block" : "none";
    if (partyA) partyA.style.display = mode === "matrix" ? "none" : "block";
    if (partyB) partyB.style.display = mode === "matrix" ? "none" : "block";

    updateJsonPreview();
}

// Функція `setMatrixValue` — окремий логічний крок frontend-модуля.
function setMatrixValue(className, row, col, value) {
    const input = document.querySelector(`.${className}[data-row="${row}"][data-col="${col}"]`);
    if (input) input.value = value;
}

// Функція `fillMatrixExample6535` — окремий логічний крок frontend-модуля.
function fillMatrixExample6535() {
    // Матриця без pure Nash, очікуваний mixed Nash приблизно 65% / 35% для обох сторін.
    // A = [[0, 3.45], [1.86, 0]]
    // B = [[1.86, 0], [0, 3.45]]
    setMatrixValue("matrix-a", 0, 0, 0);
    setMatrixValue("matrix-a", 0, 1, 3.45);
    setMatrixValue("matrix-a", 1, 0, 1.86);
    setMatrixValue("matrix-a", 1, 1, 0);

    setMatrixValue("matrix-b", 0, 0, 1.86);
    setMatrixValue("matrix-b", 0, 1, 0);
    setMatrixValue("matrix-b", 1, 0, 0);
    setMatrixValue("matrix-b", 1, 1, 3.45);
    updateJsonPreview();
}

// Функція `clearMatrixInputs` — окремий логічний крок frontend-модуля.
function clearMatrixInputs() {
    document.querySelectorAll(".matrix-a, .matrix-b").forEach(input => input.value = 0);
    updateJsonPreview();
}
