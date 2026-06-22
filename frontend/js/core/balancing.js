// =============================================================================
// Negotiation DSS — frontend module
// -----------------------------------------------------------------------------
// Цей файл містить логіку клієнтської частини системи. Коментарі пояснюють,
// які дані формуються, як вони передаються у Flask backend, як працює UI,
// матричний режим, режим критеріїв, історія користувача та візуалізація.
// =============================================================================

window.calculateBalancedWeights = function(currentValues, changedIndex, newValue) {
    const total = 100;
    const remaining = total - newValue;
    const others = currentValues.filter((_, idx) => idx !== changedIndex);
    const currentOthersSum = others.reduce((a, b) => a + b, 0);

    return currentValues.map((val, idx) => {
        if (idx === changedIndex) return newValue;
        if (currentOthersSum === 0) return Math.round(remaining / Math.max(others.length, 1));
        return Math.round((val / currentOthersSum) * remaining);
    });
};

window.attachWeightListeners = function() {
    const inputs = document.querySelectorAll("input[type='range'].w-range-A, input[type='range'].w-range-B");
    inputs.forEach(input => {
        input.oninput = function() {
            if (this.isProgrammaticChange) return;
            const partyClass = this.classList.contains("w-range-A") ? "w-range-A" : "w-range-B";
            const inputsOfParty = Array.from(document.querySelectorAll(`.${partyClass}`));
            const changedIndex = inputsOfParty.indexOf(this);
            const value = parseInt(this.value, 10) || 0;
            const values = inputsOfParty.map(i => parseInt(i.value, 10) || 0);
            const balanced = window.calculateBalancedWeights(values, changedIndex, value);

            balanced.forEach((newVal, idx) => {
                const target = inputsOfParty[idx];
                target.isProgrammaticChange = true;
                target.value = newVal;
                const id = target.dataset.critId;
                const lbl = document.getElementById(target.classList.contains("w-range-A") ? `lblWA_${id}` : `lblWB_${id}`);
                if (lbl) lbl.innerText = newVal;
                target.isProgrammaticChange = false;
            });
            updateJsonPreview();
        };
    });
};
