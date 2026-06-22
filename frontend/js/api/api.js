// =============================================================================
// Negotiation DSS — frontend module
// -----------------------------------------------------------------------------
// Цей файл містить логіку клієнтської частини системи. Коментарі пояснюють,
// які дані формуються, як вони передаються у Flask backend, як працює UI,
// матричний режим, режим критеріїв, історія користувача та візуалізація.
// =============================================================================

// ==========================================
// МОДУЛЬ ДЛЯ РОБОТИ З BACKEND API (Flask + SQLite)
// ==========================================

const API_BASE = "http://127.0.0.1:5000/api";

// 1. Відправка моделі на прорахунок рівноваги Неша
// POST-запит до Flask endpoint /api/analyze.
// Асинхронна функція `sendModelForAnalysis` працює з API або довгою UI-операцією.
async function sendModelForAnalysis(payload) {
    const response = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    return await response.json();
}

// 2. Завантаження готових пресетів/прикладів
// Асинхронна функція `fetchExampleFromServer` працює з API або довгою UI-операцією.
async function fetchExampleFromServer(domain) {
    const response = await fetch(`${API_BASE}/examples/${domain}`);
    return await response.json();
}

// 3. Авторизація (Вхід)
// Асинхронна функція `loginUser` працює з API або довгою UI-операцією.
async function loginUser(username, password) {
    const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password })
    });
    return { status: response.status, data: await response.json() };
}

// 4. Реєстрація нового акаунту
// Асинхронна функція `registerUser` працює з API або довгою UI-операцією.
async function registerUser(username, password) {
    const response = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password })
    });
    return await response.json();
}

// 5. Вихід із системи (скидання сесії)
// Асинхронна функція `logoutUser` працює з API або довгою UI-операцією.
async function logoutUser() {
    const response = await fetch(`${API_BASE}/auth/logout`, { 
        method: "POST", 
        credentials: "include" 
    });
    return await response.json();
}

// 6. Збереження сценарію в базу даних
// Асинхронна функція `saveScenarioToDb` працює з API або довгою UI-операцією.
async function saveScenarioToDb(payload) {
    const response = await fetch(`${API_BASE}/scenarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload)
    });
    return await response.json();
}

// 7. Отримання списку збережених сценаріїв користувача
// Асинхронна функція `fetchSavedScenarios` працює з API або довгою UI-операцією.
async function fetchSavedScenarios() {
    const response = await fetch(`${API_BASE}/scenarios`, { credentials: "include" });
    if (!response.ok) return [];
    return await response.json();
}
// 8. Поточний користувач
// Асинхронна функція `fetchCurrentUser` працює з API або довгою UI-операцією.
async function fetchCurrentUser() {
    const response = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
    return await response.json();
}

// 9. Історія виконаних аналізів користувача
// Асинхронна функція `fetchAnalysisHistory` працює з API або довгою UI-операцією.
async function fetchAnalysisHistory() {
    const response = await fetch(`${API_BASE}/history`, { credentials: "include" });
    if (!response.ok) return [];
    return await response.json();
}

// 10. Видалення запису історії
// Асинхронна функція `deleteAnalysisHistoryItem` працює з API або довгою UI-операцією.
async function deleteAnalysisHistoryItem(id) {
    const response = await fetch(`${API_BASE}/history/${id}`, {
        method: "DELETE",
        credentials: "include"
    });
    return await response.json();
}

// 11. Створення спільної сесії переговорів
// Асинхронна функція `createSharedSession` працює з API або довгою UI-операцією.
async function createSharedSession(payload, title = "Спільна переговорна сесія") {
    const response = await fetch(`${API_BASE}/shared`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title, payload })
    });
    return await response.json();
}

// 12. Завантаження спільної сесії за кодом
// Асинхронна функція `fetchSharedSession` працює з API або довгою UI-операцією.
async function fetchSharedSession(code) {
    const response = await fetch(`${API_BASE}/shared/${encodeURIComponent(code)}`, {
        credentials: "include"
    });
    return await response.json();
}

// 13. Оновлення спільної сесії
// Асинхронна функція `updateSharedSession` працює з API або довгою UI-операцією.
async function updateSharedSession(code, payload) {
    const response = await fetch(`${API_BASE}/shared/${encodeURIComponent(code)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ payload })
    });
    return await response.json();
}

// 14. Analytics dashboard
// Асинхронна функція `fetchAnalyticsDashboard` працює з API або довгою UI-операцією.
async function fetchAnalyticsDashboard() {
    const response = await fetch(`${API_BASE}/analytics`, { credentials: "include" });
    return await response.json();
}

// 15. Adaptive weights suggestions
// Асинхронна функція `fetchAdaptiveWeights` працює з API або довгою UI-операцією.
async function fetchAdaptiveWeights(payload) {
    const response = await fetch(`${API_BASE}/adaptive-weights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload)
    });
    return await response.json();
}

// 16. Export current analysis to PDF
// Асинхронна функція `exportAnalysisPdf` працює з API або довгою UI-операцією.
async function exportAnalysisPdf(payload, result) {
    const response = await fetch(`${API_BASE}/export/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ payload, result })
    });
    return await response.json();
}
