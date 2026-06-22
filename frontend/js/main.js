// =============================================================================
// Negotiation DSS — frontend module
// -----------------------------------------------------------------------------
// Цей файл містить логіку клієнтської частини системи. Коментарі пояснюють,
// які дані формуються, як вони передаються у Flask backend, як працює UI,
// матричний режим, режим критеріїв, історія користувача та візуалізація.
// =============================================================================

// Поточний список критеріїв, які користувач створив або завантажив із шаблону.
let currentCriteria = [];
// Поточний користувач; якщо null — система працює в гостьовому режимі.
let currentUser = null;
let currentRole = "client";
let lastAnalysisPayload = null;
let lastAnalysisResult = null;

document.addEventListener("DOMContentLoaded", () => {
    initDefaultForm();
    restoreSession();
});

// Ініціалізує стартовий стан форми: базові критерії, стратегії та ваги.
// Функція `initDefaultForm` — окремий логічний крок frontend-модуля.
function initDefaultForm() {
    clearWorkspace();
    currentCriteria = [
        { id: "crit_price", name: "Ціна", type: "number", options: null, placeholder: "Значення..." },
        { id: "crit_delivery", name: "Термін доставки", type: "number", options: null, placeholder: "Значення..." }
    ];
    renderCriteriaList();
    refreshPartyWeightsSelectors();
    addStrategyRow("partyA", { crit_price: 100, crit_delivery: 3 });
    addStrategyRow("partyA", { crit_price: 120, crit_delivery: 1 });
    addStrategyRow("partyB", { crit_price: 110, crit_delivery: 2 });
    addStrategyRow("partyB", { crit_price: 130, crit_delivery: 4 });
    updateJsonPreview();
}

// Очищає робочу область перед завантаженням нового сценарію або шаблону.
// Функція `clearWorkspace` — окремий логічний крок frontend-модуля.
function clearWorkspace() {
    ["criteriaContainer", "partyAContainer", "partyBContainer"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = "";
    });
}

// Головна дія кнопки “Запустити аналіз”: збирає payload, викликає backend і оновлює UI.
// Асинхронна функція `triggerAnalysis` працює з API або довгою UI-операцією.
async function triggerAnalysis() {
    const payload = buildJsonFromForm();
    if (!validatePayload(payload)) return;

    const btn = document.getElementById("btnAnalyze");
    btn.innerText = "Розрахунок Nash рівноваги...";
    btn.disabled = true;

    try {
        const result = await sendModelForAnalysis(payload);
        lastAnalysisPayload = payload;
        lastAnalysisResult = result;
        console.log("🔥 FULL NASH RESULT:", result);
        displayResults(result);
        if (result?.strategy_profile) updateCharts(result.strategy_profile);
        if (currentUser) { loadAnalysisHistoryList(); loadAnalyticsDashboard(); }
    } catch (error) {
        console.error("❌ Помилка аналізу Nash:", error);
        alert("Помилка сервера або розрахунку Nash рівноваги.");
    } finally {
        btn.innerText = "Запустити аналіз моделі";
        btn.disabled = false;
    }
}

// Функція `validatePayload` — окремий логічний крок frontend-модуля.
function validatePayload(payload) {
    if (payload.mode === "matrix") {
        const okA = Array.isArray(payload.payoff_matrix_A) && payload.payoff_matrix_A.length === 2;
        const okB = Array.isArray(payload.payoff_matrix_B) && payload.payoff_matrix_B.length === 2;
        if (!okA || !okB) return alert("Некоректна матриця виграшів."), false;
        return true;
    }

    if (!payload.criteria.length) return alert("Створи хоча б один критерій!"), false;
    if (!payload.partyA.strategies.length || !payload.partyB.strategies.length) return alert("Обидві сторони повинні мати хоча б одну стратегію!"), false;
    const emptyA = payload.partyA.strategies.some(s => Object.keys(s).length === 0);
    const emptyB = payload.partyB.strategies.some(s => Object.keys(s).length === 0);
    if (emptyA || emptyB) return alert("Є порожні стратегії. Перевір поля введення."), false;
    return true;
}

// Завантажує готовий приклад з backend: HR, закупівлі або бізнес-сценарій.
// Асинхронна функція `loadExample` працює з API або довгою UI-операцією.
async function loadExample(domain) {
    try {
        const data = await fetchExampleFromServer(domain);
        if (data.error) return alert(data.error);
        loadScenarioIntoUI(data);
    } catch (e) {
        alert("Помилка при завантаженні шаблону.");
        console.error(e);
    }
}

// Функція `loadScenarioIntoUI` — окремий логічний крок frontend-модуля.
function loadScenarioIntoUI(data) {
    clearWorkspace();
    currentCriteria = (data.criteria || []).map(normalizeCriterion);
    renderCriteriaList();
    refreshPartyWeightsSelectors();
    setWeights("partyA", data.partyA?.weights || {});
    setWeights("partyB", data.partyB?.weights || {});
    (data.partyA?.strategies || []).forEach(s => addStrategyRow("partyA", s));
    (data.partyB?.strategies || []).forEach(s => addStrategyRow("partyB", s));
    updateJsonPreview();
}

// Функція `setWeights` — окремий логічний крок frontend-модуля.
function setWeights(partyKey, weights) {
    const selector = partyKey === "partyA" ? ".w-range-A" : ".w-range-B";
    const labelPrefix = partyKey === "partyA" ? "lblWA" : "lblWB";
    document.querySelectorAll(selector).forEach(input => {
        const id = input.dataset.critId;
        if (weights[id] === undefined) return;
        const pct = Math.round(Number(weights[id]) * 100);
        input.value = pct;
        const lbl = document.getElementById(`${labelPrefix}_${id}`);
        if (lbl) lbl.innerText = pct;
    });
}

// Функція `toggleAuthForm` — окремий логічний крок frontend-модуля.
function toggleAuthForm() {
    const modal = document.getElementById("authModal");
    if (modal) modal.style.display = modal.style.display === "none" ? "flex" : "none";
}

// Асинхронна функція `handleAuthSubmit` працює з API або довгою UI-операцією.
async function handleAuthSubmit(event) {
    event.preventDefault();
    const username = document.getElementById("usernameInput").value.trim();
    const password = document.getElementById("passwordInput").value.trim();
    try {
        let res = await loginUser(username, password);
        if (res.status === 401) {
            if (!confirm("Користувача не знайдено. Зареєструвати новий акаунт?")) return;
            const reg = await registerUser(username, password);
            if (reg.error) return alert(reg.error);
            res = await loginUser(username, password);
        }
        if (res.data?.success) {
            currentUser = res.data.username;
            currentRole = res.data.role || "client";
            document.getElementById("userGreeting").innerText = `👤 ${currentUser} (${currentRole})`;
            const authBtn = document.querySelector(".auth-box button");
            authBtn.innerText = "Вийти";
            authBtn.onclick = handleLogout;
            document.getElementById("btnSave").removeAttribute("disabled");
            toggleAuthForm();
            loadSavedScenariosList();
            loadAnalysisHistoryList();
        } else if (res.data?.error) alert(res.data.error);
    } catch (err) {
        alert("Помилка при спробі авторизації.");
        console.error(err);
    }
}

// Асинхронна функція `handleLogout` працює з API або довгою UI-операцією.
async function handleLogout() {
    await logoutUser();
    currentUser = null;
    document.getElementById("userGreeting").innerText = "Гість";
    const authBtn = document.querySelector(".auth-box button");
    authBtn.innerText = "Увійти";
    authBtn.onclick = toggleAuthForm;
    document.getElementById("btnSave").setAttribute("disabled", "true");
    document.getElementById("savedScenariosList").innerHTML = '<li class="empty-msg">База даних порожня</li>';
    const h = document.getElementById("analysisHistoryList");
    if (h) h.innerHTML = '<li class="empty-msg">Увійдіть, щоб бачити історію</li>';
}

// Асинхронна функція `saveToDatabase` працює з API або довгою UI-операцією.
async function saveToDatabase() {
    const title = prompt("Введіть назву сценарію:", "Мій сценарій компромісу");
    if (!title) return;
    const res = await saveScenarioToDb({ title, json_data: JSON.stringify(buildJsonFromForm()) });
    if (res.success) {
        alert(res.success);
        loadSavedScenariosList();
    } else if (res.error) alert(res.error);
}

// Асинхронна функція `loadSavedScenariosList` працює з API або довгою UI-операцією.
async function loadSavedScenariosList() {
    const scenarios = await fetchSavedScenarios();
    const list = document.getElementById("savedScenariosList");
    if (!list) return;
    list.innerHTML = scenarios.length ? "" : '<li class="empty-msg">Немає збережених моделей</li>';
    scenarios.forEach(sc => {
        const li = document.createElement("li");
        li.innerText = `📁 ${sc.title}`;
        li.style.cursor = "pointer";
        li.style.padding = "6px 0";
        li.onclick = () => {
            try { loadScenarioIntoUI(JSON.parse(sc.json_data)); }
            catch (err) { alert("Помилка під час зчитування сценарію з БД."); console.error(err); }
        };
        list.appendChild(li);
    });
}


// Асинхронна функція `restoreSession` працює з API або довгою UI-операцією.
async function restoreSession() {
    try {
        if (typeof fetchCurrentUser !== "function") return;
        const me = await fetchCurrentUser();
        if (!me.authenticated) return;

        currentUser = me.username;
        currentRole = me.role || "client";
        document.getElementById("userGreeting").innerText = `👤 ${currentUser} (${currentRole})`;
        const authBtn = document.querySelector(".auth-box button");
        authBtn.innerText = "Вийти";
        authBtn.onclick = handleLogout;
        document.getElementById("btnSave").removeAttribute("disabled");
        loadSavedScenariosList();
        loadAnalysisHistoryList();
        loadAnalyticsDashboard();
    } catch (e) {
        console.warn("Не вдалося відновити сесію", e);
    }
}

// Асинхронна функція `loadAnalysisHistoryList` працює з API або довгою UI-операцією.
async function loadAnalysisHistoryList() {
    const list = document.getElementById("analysisHistoryList");
    if (!list) return;

    const history = await fetchAnalysisHistory();
    list.innerHTML = history.length ? "" : '<li class="empty-msg">Історія порожня</li>';

    history.forEach(item => {
        const li = document.createElement("li");
        li.style.cursor = "pointer";
        li.style.padding = "8px 0";
        li.style.borderBottom = "1px solid rgba(255,255,255,0.06)";

        const created = item.created_at ? new Date(item.created_at.replace(" ", "T")).toLocaleString() : "";
        li.innerHTML = `
            <div style="font-weight:600; color:var(--text-main);">🧾 ${item.title}</div>
            <div style="font-size:0.78rem; color:var(--text-muted);">${item.mode} • ${created}</div>
        `;

        li.onclick = () => {
            try {
                const payload = JSON.parse(item.payload_json);
                const result = JSON.parse(item.result_json);

                if (payload.mode === "matrix") {
                    document.getElementById("analysisMode").value = "matrix";
                    onAnalysisModeChanged();
                    applyMatrixPayload(payload);
                } else {
                    document.getElementById("analysisMode").value = "criteria";
                    onAnalysisModeChanged();
                    loadScenarioIntoUI(payload);
                }

                displayResults(result);
                if (result?.strategy_profile) updateCharts(result.strategy_profile);
            } catch (e) {
                alert("Не вдалося відкрити запис історії.");
                console.error(e);
            }
        };

        list.appendChild(li);
    });
}

// Функція `applyMatrixPayload` — окремий логічний крок frontend-модуля.
function applyMatrixPayload(payload) {
    const A = payload.payoff_matrix_A || [[0, 0], [0, 0]];
    const B = payload.payoff_matrix_B || [[0, 0], [0, 0]];

    for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
            const aInput = document.querySelector(`.matrix-a[data-row="${r}"][data-col="${c}"]`);
            const bInput = document.querySelector(`.matrix-b[data-row="${r}"][data-col="${c}"]`);
            if (aInput) aInput.value = A[r]?.[c] ?? 0;
            if (bInput) bInput.value = B[r]?.[c] ?? 0;
        }
    }

    updateJsonPreview();
}

// ==========================================
// AI NEGOTIATION SIMULATION (rule-based local assistant)
// ==========================================
// Функція `fillAiExampleText` — окремий логічний крок frontend-модуля.
function fillAiExampleText() {
    const el = document.getElementById("aiScenarioText");
    if (el) el.value = "Хочу дешевше але швидку доставку, гарантія бажано довша. Постачальник хоче вищу ціну і довший термін.";
}

// Функція `simulateNegotiationFromText` — окремий логічний крок frontend-модуля.
function simulateNegotiationFromText() {
    const text = (document.getElementById("aiScenarioText")?.value || "").toLowerCase();

    const wantsCheap = text.includes("дешев") || text.includes("низьк") || text.includes("ціна");
    const wantsFast = text.includes("швид") || text.includes("термін") || text.includes("достав");
    const wantsWarranty = text.includes("гарант") || text.includes("довш");

    const scenario = {
        mode: "criteria",
        criteria: [
            { id: "unit_price", name: "Ціна", type: "number", placeholder: "грн", options: null },
            { id: "delivery_days", name: "Термін доставки", type: "number", placeholder: "днів", options: null },
            { id: "warranty_months", name: "Гарантія", type: "number", placeholder: "місяців", options: null }
        ],
        partyA: {
            name: "Сторона А",
            weights: {
                unit_price: wantsCheap ? 0.45 : 0.34,
                delivery_days: wantsFast ? 0.35 : 0.33,
                warranty_months: wantsWarranty ? 0.20 : 0.33
            },
            strategies: [
                { unit_price: 100, delivery_days: 3, warranty_months: 12 },
                { unit_price: 115, delivery_days: 5, warranty_months: 18 },
                { unit_price: 130, delivery_days: 8, warranty_months: 24 }
            ]
        },
        partyB: {
            name: "Сторона Б",
            weights: {
                unit_price: 0.55,
                delivery_days: 0.20,
                warranty_months: 0.25
            },
            strategies: [
                { unit_price: 130, delivery_days: 8, warranty_months: 24 },
                { unit_price: 115, delivery_days: 5, warranty_months: 18 },
                { unit_price: 105, delivery_days: 3, warranty_months: 12 }
            ]
        }
    };

    document.getElementById("analysisMode").value = "criteria";
    onAnalysisModeChanged();
    loadScenarioIntoUI(scenario);
    alert("AI-симулятор згенерував критерії, ваги та стратегії. Тепер натисни аналіз.");
}

// ==========================================
// SHARED SESSION / MULTIPLAYER LIGHT MODE
// ==========================================
let activeSharedCode = null;

// Функція `setSharedStatus` — окремий логічний крок frontend-модуля.
function setSharedStatus(message) {
    const el = document.getElementById("sharedSessionStatus");
    if (el) el.innerHTML = message;
}

// Асинхронна функція `createSharedNegotiationSession` працює з API або довгою UI-операцією.
async function createSharedNegotiationSession() {
    try {
        const payload = buildJsonFromForm();
        const title = prompt("Назва спільної сесії:", "Спільна переговорна сесія") || "Спільна переговорна сесія";
        const res = await createSharedSession(payload, title);
        if (res.error) return alert(res.error);
        activeSharedCode = res.share_code;
        const input = document.getElementById("sharedCodeInput");
        if (input) input.value = activeSharedCode;
        setSharedStatus(`✅ Код сесії: <strong>${activeSharedCode}</strong>. Передай його іншій стороні.`);
    } catch (e) {
        console.error(e);
        alert("Не вдалося створити спільну сесію.");
    }
}

// Асинхронна функція `loadSharedNegotiationSession` працює з API або довгою UI-операцією.
async function loadSharedNegotiationSession() {
    try {
        const code = (document.getElementById("sharedCodeInput")?.value || "").trim().toUpperCase();
        if (!code) return alert("Введи код сесії.");
        const res = await fetchSharedSession(code);
        if (res.error) return alert(res.error);
        const payload = JSON.parse(res.payload_json);
        activeSharedCode = code;

        if (payload.mode === "matrix") {
            document.getElementById("analysisMode").value = "matrix";
            onAnalysisModeChanged();
            applyMatrixPayload(payload);
        } else {
            document.getElementById("analysisMode").value = "criteria";
            onAnalysisModeChanged();
            loadScenarioIntoUI(payload);
        }

        setSharedStatus(`📥 Завантажено сесію <strong>${code}</strong>. Можеш змінити свою сторону і натиснути «Оновити сесію».`);
    } catch (e) {
        console.error(e);
        alert("Не вдалося завантажити спільну сесію.");
    }
}

// Асинхронна функція `saveCurrentSharedNegotiationSession` працює з API або довгою UI-операцією.
async function saveCurrentSharedNegotiationSession() {
    try {
        const code = activeSharedCode || (document.getElementById("sharedCodeInput")?.value || "").trim().toUpperCase();
        if (!code) return alert("Спочатку створи або завантаж сесію.");
        const payload = buildJsonFromForm();
        const res = await updateSharedSession(code, payload);
        if (res.error) return alert(res.error);
        activeSharedCode = code;
        setSharedStatus(`💾 Сесію <strong>${code}</strong> оновлено.`);
    } catch (e) {
        console.error(e);
        alert("Не вдалося оновити спільну сесію.");
    }
}


// ==========================================
// V7: ADAPTIVE WEIGHTS + ANALYTICS + EXPORT
// ==========================================
// Асинхронна функція `applyAdaptiveWeights` працює з API або довгою UI-операцією.
async function applyAdaptiveWeights() {
    try {
        if (!currentUser) return alert("Увійди в акаунт, щоб система могла вчитись на твоїй історії.");
        const payload = buildJsonFromForm();
        if (payload.mode === "matrix") return alert("Адаптивні ваги доступні для критерійного режиму.");
        const res = await fetchAdaptiveWeights(payload);
        if (res.error) return alert(res.error);
        const weights = res.weights || {};

        ["partyA", "partyB"].forEach(partyKey => {
            const selector = partyKey === "partyA" ? ".w-range-A" : ".w-range-B";
            const labelPrefix = partyKey === "partyA" ? "lblWA" : "lblWB";
            document.querySelectorAll(selector).forEach(input => {
                const id = input.dataset.critId;
                if (weights[id] === undefined) return;
                const pct = Math.round(Number(weights[id]) * 100);
                input.value = pct;
                const lbl = document.getElementById(`${labelPrefix}_${id}`);
                if (lbl) lbl.innerText = pct;
            });
        });

        updateJsonPreview();
        const box = document.getElementById("adaptiveWeightsBox");
        if (box) {
            const suggestions = res.suggestions || [];
            box.innerHTML = suggestions.length
                ? suggestions.map(s => `<div style="margin-bottom:6px;">🧩 ${s.message}</div>`).join("")
                : "🧩 Історії ще мало, тому застосовано збалансовану адаптацію ваг.";
        }
    } catch (e) {
        console.error(e);
        alert("Не вдалося застосувати адаптивні ваги.");
    }
}

// Асинхронна функція `loadAnalyticsDashboard` працює з API або довгою UI-операцією.
async function loadAnalyticsDashboard() {
    const box = document.getElementById("analyticsDashboard");
    if (!box) return;
    if (!currentUser) {
        box.innerHTML = '<p class="text-muted">Увійди, щоб бачити персональну аналітику.</p>';
        return;
    }
    try {
        const data = await fetchAnalyticsDashboard();
        if (data.error) {
            box.innerHTML = `<p class="text-muted">${data.error}</p>`;
            return;
        }
        const criteria = data.important_criteria || [];
        const winsA = data.winning_frequency?.partyA || {};
        const winsB = data.winning_frequency?.partyB || {};
        box.innerHTML = `
            <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:10px;">
                <div class="metric-card"><strong>${data.total_analyses || 0}</strong><span>аналізів</span></div>
                <div class="metric-card"><strong>${((data.average_compromise_score || 0) * 100).toFixed(1)}%</strong><span>середній компроміс</span></div>
                <div class="metric-card"><strong>${data.role || currentRole}</strong><span>роль</span></div>
            </div>
            <div style="margin-top:12px;">
                <h4 style="margin-bottom:6px;">🏆 Частота перемоги стратегій</h4>
                <p class="text-muted">A: ${Object.entries(winsA).map(([k,v]) => `A${k}: ${v}`).join(", ") || "—"}</p>
                <p class="text-muted">B: ${Object.entries(winsB).map(([k,v]) => `B${k}: ${v}`).join(", ") || "—"}</p>
            </div>
            <div style="margin-top:12px;">
                <h4 style="margin-bottom:6px;">📌 Найважливіші критерії</h4>
                ${criteria.length ? criteria.map(c => `
                    <div style="margin-bottom:7px;">
                        <div style="display:flex; justify-content:space-between;"><span>${c.criterion_name}</span><strong>${(c.average_weight*100).toFixed(1)}%</strong></div>
                        <div style="height:6px; background:rgba(255,255,255,0.08); border-radius:10px; overflow:hidden;"><div style="width:${Math.min(100,c.average_weight*100)}%; height:100%; background:var(--accent-primary);"></div></div>
                    </div>`).join("") : '<p class="text-muted">Даних ще недостатньо.</p>'}
            </div>
        `;
    } catch (e) {
        console.error(e);
        box.innerHTML = '<p class="text-muted">Не вдалося завантажити аналітику.</p>';
    }
}

// Асинхронна функція `exportCurrentAnalysisToPdf` працює з API або довгою UI-операцією.
async function exportCurrentAnalysisToPdf() {
    try {
        if (!lastAnalysisPayload || !lastAnalysisResult) return alert("Спочатку запусти аналіз.");
        const res = await exportAnalysisPdf(lastAnalysisPayload, lastAnalysisResult);
        if (res.error) return alert(res.error);
        const link = document.createElement("a");
        link.href = `data:application/pdf;base64,${res.content_base64}`;
        link.download = res.filename || "negotiation_report.pdf";
        document.body.appendChild(link);
        link.click();
        link.remove();
    } catch (e) {
        console.error(e);
        alert("Не вдалося експортувати PDF.");
    }
}

// Функція `fillUiUpgradeDemo` — окремий логічний крок frontend-модуля.
function fillUiUpgradeDemo() {
    document.body.classList.toggle("wow-mode");
}
