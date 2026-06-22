// =============================================================================
// Negotiation DSS — frontend module
// -----------------------------------------------------------------------------
// Цей файл містить логіку клієнтської частини системи. Коментарі пояснюють,
// які дані формуються, як вони передаються у Flask backend, як працює UI,
// матричний режим, режим критеріїв, історія користувача та візуалізація.
// =============================================================================

// Змінні для зберігання екземплярів графіків, щоб вони не дублювалися при повторних кліках
let chartA = null;
let chartB = null;

/**
 * Функція для побудови та оновлення графіків оптимальних стратегій
 * @param {Object} strategyProfile - Об'єкт з ймовірностями для partyA та partyB від сервера
 */
// Оновлює кругові графіки стратегій після відповіді backend.
function updateCharts(strategyProfile) {
    if (!strategyProfile || !strategyProfile.partyA || !strategyProfile.partyB) {
        console.error("Некоректні дані профілю стратегій для побудови графіків");
        return;
    }

    const dataA = strategyProfile.partyA; 
    const dataB = strategyProfile.partyB;

    // Автоматично генеруємо назви міток (Стратегія А1, Стратегія А2 і т.д.)
    const labelsA = dataA.map((_, index) => `Стратегія А${index + 1}`);
    const labelsB = dataB.map((_, index) => `Стратегія Б${index + 1}`);

    if (chartA) chartA.destroy(); // Видаляємо старий графік, щоб уникнути багів при наведенні
    
    const ctxA = document.getElementById('chartPartyA').getContext('2d');
    chartA = new Chart(ctxA, {
        type: 'pie',
        data: {
            labels: labelsA,
            datasets: [{
                label: 'Частка вибору стратегії (%)',
                data: dataA.map(val => (val * 100).toFixed(1)), // Конвертуємо у відсотки [0.4 -> 40.0]
                backgroundColor: ['#36A2EB', '#FF6384', '#FFCE56', '#4BC0C0', '#9966FF'], // Набір гарних кольорів
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: { callbacks: { label: (context) => ` ${context.label}: ${context.raw}%` } }
            }
        }
    });

    // --- ГРАФІК ДЛЯ СТОРОНИ Б (Кільцева діаграма / Doughnut Chart) ---
    if (chartB) chartB.destroy(); // Видаляємо старий графік
    
    const ctxB = document.getElementById('chartPartyB').getContext('2d');
    chartB = new Chart(ctxB, {
        type: 'doughnut',
        data: {
            labels: labelsB,
            datasets: [{
                label: 'Частка вибору стратегії (%)',
                data: dataB.map(val => (val * 100).toFixed(1)),
                backgroundColor: ['#4BC0C0', '#FF9F40', '#9966FF', '#FF6384', '#36A2EB'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: { callbacks: { label: (context) => ` ${context.label}: ${context.raw}%` } }
            }
        }
    });
}