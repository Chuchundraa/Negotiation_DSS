# =============================================================================
# Negotiation DSS — backend module
# -----------------------------------------------------------------------------
# Цей файл є частиною дипломного проєкту СППР для переговорів.
# Коментарі спеціально зроблені детальними, щоб під час захисту було легко
# пояснити призначення кожного блоку: маршрути Flask, роботу з БД, авторизацію,
# розрахунок Nash equilibrium, компромісні рекомендації та історію користувача.
# =============================================================================

import numpy as np

try:
    import nashpy as nash
except ImportError:
    nash = None


# Головний математичний клас: із payload будує гру і повертає аналітичний результат.
class GameEngine:
    """
    Real Nash + DSS compromise engine.

    Modes:
    - criteria: strategies are described by criteria and weights.
    - matrix: direct payoff matrices A[i][j], B[i][j].

    The engine returns:
    - Nash equilibrium/profile
    - payoff matrices
    - compromise recommendation: a pair (Ai, Bj) that balances total benefit and fairness.
    """

    # Ініціалізація: зберігаємо критерії, стратегії, ваги й режим аналізу.
    def __init__(self, data):
        self.data = data or {}
        self.mode = self.data.get("mode", "criteria")

        self.criteria = self.data.get("criteria", []) or []
        self.partyA = self.data.get("partyA", {}) or {}
        self.partyB = self.data.get("partyB", {}) or {}

        self.strategiesA = self.partyA.get("strategies", []) or []
        self.strategiesB = self.partyB.get("strategies", []) or []

        self.weightsA = self.partyA.get("weights", {}) or {}
        self.weightsB = self.partyB.get("weights", {}) or {}

        self.criteria_by_id = {c.get("id"): c for c in self.criteria if c.get("id")}

    # -------------------------------
    # COMMON HELPERS
    # -------------------------------
    # Безпечне перетворення значень у число: захист від пустих рядків і некоректного вводу.
    @staticmethod
    def _safe_float(value):
        if isinstance(value, dict):
            if "value" in value:
                return GameEngine._safe_float(value["value"])
            if "scoreA" in value:
                return GameEngine._safe_float(value["scoreA"])
            if "scoreB" in value:
                return GameEngine._safe_float(value["scoreB"])
        try:
            return float(value)
        except (TypeError, ValueError):
            return 0.0

    @staticmethod
    def _as_matrix(raw, name):
        matrix = np.array(raw, dtype=float)
        if matrix.ndim != 2:
            raise ValueError(f"{name} має бути двовимірною матрицею")
        if matrix.shape[0] == 0 or matrix.shape[1] == 0:
            raise ValueError(f"{name} не може бути порожньою")
        return matrix

    @staticmethod
    def _normalize_matrix(M):
        M = np.array(M, dtype=float)
        mn = float(np.min(M))
        mx = float(np.max(M))
        if abs(mx - mn) < 1e-12:
            return np.ones_like(M) * 0.5
        return (M - mn) / (mx - mn)

    # -------------------------------
    # CRITERIA MODE
    # -------------------------------
    def _option_score(self, criterion, raw_value, party_key):
        options = criterion.get("options") or []
        if not options:
            return self._safe_float(raw_value)

        for idx, opt in enumerate(options):
            if isinstance(opt, str):
                if raw_value == opt:
                    return float(idx)
                continue

            value = opt.get("value", opt.get("label"))
            label = opt.get("label", value)

            if raw_value == value or raw_value == label:
                scores = opt.get("scores") or {}

                if party_key in scores:
                    return self._safe_float(scores.get(party_key))

                legacy_key = "partyA" if party_key == "A" else "partyB"
                if legacy_key in scores:
                    return self._safe_float(scores.get(legacy_key))

                return float(idx)

        return 0.0

    def _utility(self, strategy, weights, party_key):
        total = 0.0
        for crit_id, criterion in self.criteria_by_id.items():
            weight = self._safe_float(weights.get(crit_id, 0.0))
            raw_value = strategy.get(crit_id)
            value_score = self._option_score(criterion, raw_value, party_key)
            total += weight * value_score
        return total

    def _build_criteria_matrices(self):
        n = len(self.strategiesA)
        m = len(self.strategiesB)
        if n == 0 or m == 0:
            raise ValueError("Обидві сторони повинні мати хоча б одну стратегію")

        A = np.zeros((n, m))
        B = np.zeros((n, m))

        utilitiesA = [self._utility(s, self.weightsA, "A") for s in self.strategiesA]
        utilitiesB = [self._utility(s, self.weightsB, "B") for s in self.strategiesB]

        for i, ua in enumerate(utilitiesA):
            for j, ub in enumerate(utilitiesB):
                A[i, j] = ua
                B[i, j] = ub

        return A, B

    # -------------------------------
    # MATRIX MODE
    # -------------------------------
    def _build_matrix_mode_matrices(self):
        A = self._as_matrix(self.data.get("payoff_matrix_A"), "payoff_matrix_A")
        B = self._as_matrix(self.data.get("payoff_matrix_B"), "payoff_matrix_B")

        if A.shape != B.shape:
            raise ValueError("Матриці payoff_matrix_A і payoff_matrix_B повинні мати однаковий розмір")

        return A, B

    # Будує payoff matrices A та B — основу для Nash equilibrium, Pareto та heatmap.
    def build_matrices(self):
        if self.mode == "matrix":
            A, B = self._build_matrix_mode_matrices()
        else:
            A, B = self._build_criteria_matrices()

        print("DEBUG_MODE:", self.mode)
        print("DEBUG_MATRIX_A:", A)
        print("DEBUG_MATRIX_B:", B)
        return A, B

    # PURE NASH
    
    @staticmethod
    # Шукає чисті рівноваги Неша: клітинки, де жодна сторона не хоче змінювати стратегію.
    def find_pure_nash(A, B):
        equilibria = []
        n, m = A.shape

        for i in range(n):
            for j in range(m):
                a_best = A[i, j] >= np.max(A[:, j])
                b_best = B[i, j] >= np.max(B[i, :])
                if a_best and b_best:
                    equilibria.append((i, j))

        return equilibria

    # -------------------------------
    # EXACT MIXED NASH FOR 2x2
    # -------------------------------
    @staticmethod
    # Для гри 2x2 рахує точну змішану рівновагу, якщо чистої рівноваги немає.
    def mixed_nash_2x2(A, B):
        if A.shape != (2, 2) or B.shape != (2, 2):
            return None

        a11, a12 = A[0, 0], A[0, 1]
        a21, a22 = A[1, 0], A[1, 1]

        b11, b12 = B[0, 0], B[0, 1]
        b21, b22 = B[1, 0], B[1, 1]

        denom_q = a11 - a12 - a21 + a22
        if abs(denom_q) < 1e-12:
            return None
        q = (a22 - a12) / denom_q

        denom_p = b11 - b12 - b21 + b22
        if abs(denom_p) < 1e-12:
            return None
        p = (b22 - b21) / denom_p

        eps = 1e-9
        if not (-eps <= p <= 1 + eps and -eps <= q <= 1 + eps):
            return None

        p = min(max(float(p), 0.0), 1.0)
        q = min(max(float(q), 0.0), 1.0)

        return {"partyA": [p, 1.0 - p], "partyB": [q, 1.0 - q]}


    @staticmethod
    def nashpy_mixed_solver(A, B):
        """Use Nashpy support enumeration for real mixed equilibria when available."""
        if nash is None:
            return None
        try:
            game = nash.Game(A, B)
            equilibria = list(game.support_enumeration())
            if not equilibria:
                return None
            p, q = equilibria[0]
            return {
                "partyA": [float(x) for x in p],
                "partyB": [float(x) for x in q],
                "solver": "nashpy.support_enumeration"
            }
        except Exception:
            return None

    @staticmethod
    def uniform_profile(A, B):
        return {
            "partyA": [1.0 / A.shape[0]] * A.shape[0],
            "partyB": [1.0 / A.shape[1]] * A.shape[1]
        }

    # -------------------------------
    # COMPROMISE RECOMMENDATION
    # -------------------------------
    def recommend_compromise(self, A, B):
        """
        Recommends a practical compromise pair.
        Logic:
        - normalize A and B to 0..1
        - maximize weighted score: total welfare + fairness + Pareto bonus
        - return exact strategy pair and explanation
        """
        An = self._normalize_matrix(A)
        Bn = self._normalize_matrix(B)

        best = None
        pareto_pairs = self._pareto_pairs(A, B)

        for i in range(A.shape[0]):
            for j in range(A.shape[1]):
                welfare = float((An[i, j] + Bn[i, j]) / 2.0)
                fairness = float(1.0 - abs(An[i, j] - Bn[i, j]))
                minimum_gain = float(min(An[i, j], Bn[i, j]))
                pareto_bonus = 0.05 if (i, j) in pareto_pairs else 0.0

                # Practical compromise: not only maximum payoff, but also balance.
                compromise_score = 0.35 * welfare + 0.45 * fairness + 0.20 * minimum_gain + pareto_bonus

                candidate = {
                    "partyA_strategy": int(i),
                    "partyB_strategy": int(j),
                    "partyA_label": f"A{i + 1}",
                    "partyB_label": f"B{j + 1}",
                    "payoff_A": float(A[i, j]),
                    "payoff_B": float(B[i, j]),
                    "normalized_A": float(An[i, j]),
                    "normalized_B": float(Bn[i, j]),
                    "welfare": welfare,
                    "fairness": fairness,
                    "minimum_gain": minimum_gain,
                    "is_pareto_optimal": (i, j) in pareto_pairs,
                    "compromise_score": float(compromise_score),
                }

                if best is None or candidate["compromise_score"] > best["compromise_score"]:
                    best = candidate

        if best is None:
            return None

        best["explanation"] = (
            f"Рекомендований компроміс: {best['partyA_label']} + {best['partyB_label']}. "
            f"Ця пара має сумарну вигоду {best['welfare'] * 100:.1f}% і баланс інтересів "
            f"{best['fairness'] * 100:.1f}%."
        )
        return best

    @staticmethod
    def _pareto_pairs(A, B):
        pairs = set()
        n, m = A.shape
        for i in range(n):
            for j in range(m):
                dominated = False
                for x in range(n):
                    for y in range(m):
                        better_or_equal = A[x, y] >= A[i, j] and B[x, y] >= B[i, j]
                        strictly_better = A[x, y] > A[i, j] or B[x, y] > B[i, j]
                        if better_or_equal and strictly_better:
                            dominated = True
                            break
                    if dominated:
                        break
                if not dominated:
                    pairs.add((i, j))
        return pairs

    # Pareto-аналіз: визначає оптимальні та доміновані комбінації стратегій.
    def pareto_analysis(self, A, B):
        pareto_pairs = self._pareto_pairs(A, B)
        optimal = []
        dominated = []
        n, m = A.shape

        for i in range(n):
            for j in range(m):
                item = {
                    "partyA_strategy": int(i),
                    "partyB_strategy": int(j),
                    "label": f"A{i + 1} + B{j + 1}",
                    "payoff_A": float(A[i, j]),
                    "payoff_B": float(B[i, j]),
                }
                if (i, j) in pareto_pairs:
                    optimal.append(item)
                else:
                    dominators = []
                    for x in range(n):
                        for y in range(m):
                            better_or_equal = A[x, y] >= A[i, j] and B[x, y] >= B[i, j]
                            strictly_better = A[x, y] > A[i, j] or B[x, y] > B[i, j]
                            if better_or_equal and strictly_better:
                                dominators.append({
                                    "partyA_strategy": int(x),
                                    "partyB_strategy": int(y),
                                    "label": f"A{x + 1} + B{y + 1}",
                                    "payoff_A": float(A[x, y]),
                                    "payoff_B": float(B[x, y]),
                                })
                    item["dominated_by"] = dominators[:3]
                    dominated.append(item)

        return {
            "pareto_optimal": optimal,
            "dominated": dominated,
            "summary": f"Pareto-оптимальних комбінацій: {len(optimal)}; домінованих: {len(dominated)}."
        }


    # -------------------------------
    # AI-LIKE EXPLANATION + MIDPOINT COMPROMISE
    # -------------------------------
    def _strategy_label(self, party, index):
        prefix = "A" if party == "A" else "B"
        strategies = self.strategiesA if party == "A" else self.strategiesB
        try:
            name = strategies[index].get("name")
            if name:
                return str(name)
        except Exception:
            pass
        return f"{prefix}{index + 1}"

    def _criterion_name(self, criterion):
        return criterion.get("name") or criterion.get("id") or "Критерій"

    def _format_value(self, criterion, value):
        if value is None:
            return "—"
        if criterion.get("type") == "select":
            for opt in criterion.get("options") or []:
                if isinstance(opt, str):
                    if value == opt:
                        return opt
                else:
                    opt_value = opt.get("value", opt.get("label"))
                    opt_label = opt.get("label", opt_value)
                    if value == opt_value or value == opt_label:
                        return str(opt_label)
            return str(value)
        if isinstance(value, (int, float)):
            if abs(float(value) - round(float(value))) < 1e-9:
                return str(int(round(float(value))))
            return f"{float(value):.2f}"
        return str(value)

    def _best_option_by_balance(self, criterion):
        options = criterion.get("options") or []
        if not options:
            return None
        best = None
        best_score = -10**9
        for idx, opt in enumerate(options):
            if isinstance(opt, str):
                value = opt
                label = opt
                a = float(idx)
                b = float(idx)
            else:
                value = opt.get("value", opt.get("label"))
                label = opt.get("label", value)
                scores = opt.get("scores") or {}
                a = self._safe_float(scores.get("A", scores.get("partyA", idx)))
                b = self._safe_float(scores.get("B", scores.get("partyB", idx)))
            # Balance + total benefit: good compromise option for categorical criteria.
            score = 0.55 * (a + b) - 0.45 * abs(a - b)
            if score > best_score:
                best_score = score
                best = {"value": value, "label": label, "scoreA": a, "scoreB": b}
        return best

    def generate_midpoint_compromise(self, compromise):
        """
        Generates a practical midpoint solution for criteria mode.
        Example: price 115, delivery 5 days, warranty 18 months.
        """
        if self.mode != "criteria" or not compromise:
            return None

        i = int(compromise.get("partyA_strategy", 0))
        j = int(compromise.get("partyB_strategy", 0))
        if i >= len(self.strategiesA) or j >= len(self.strategiesB):
            return None

        strategy_a = self.strategiesA[i]
        strategy_b = self.strategiesB[j]
        items = []
        values = {}

        for criterion in self.criteria:
            crit_id = criterion.get("id")
            if not crit_id:
                continue

            name = self._criterion_name(criterion)
            va = strategy_a.get(crit_id)
            vb = strategy_b.get(crit_id)

            if criterion.get("type") == "number":
                fa = self._safe_float(va)
                fb = self._safe_float(vb)
                midpoint = (fa + fb) / 2.0
                values[crit_id] = midpoint
                items.append({
                    "criterion_id": crit_id,
                    "criterion": name,
                    "partyA_value": fa,
                    "partyB_value": fb,
                    "recommended_value": midpoint,
                    "recommended_text": self._format_value(criterion, midpoint),
                    "reason": "середнє значення між позиціями сторін"
                })
            else:
                # If both selected the same option, keep it. Otherwise choose the most balanced option.
                if va == vb:
                    chosen_value = va
                    chosen_label = self._format_value(criterion, va)
                    reason = "обидві сторони вже близькі до цього варіанту"
                else:
                    best = self._best_option_by_balance(criterion)
                    chosen_value = best["value"] if best else va
                    chosen_label = best["label"] if best else self._format_value(criterion, va)
                    reason = "найкращий баланс оцінок сторони A і сторони B"

                values[crit_id] = chosen_value
                items.append({
                    "criterion_id": crit_id,
                    "criterion": name,
                    "partyA_value": self._format_value(criterion, va),
                    "partyB_value": self._format_value(criterion, vb),
                    "recommended_value": chosen_value,
                    "recommended_text": str(chosen_label),
                    "reason": reason
                })

        summary = "Спробуйте: " + "; ".join(
            f"{item['criterion']}: {item['recommended_text']}" for item in items
        )

        return {
            "type": "midpoint_solution",
            "based_on": {
                "partyA_strategy": self._strategy_label("A", i),
                "partyB_strategy": self._strategy_label("B", j)
            },
            "values": values,
            "items": items,
            "summary": summary
        }

    def generate_ai_explanation(self, A, B, compromise, strategy_profile=None, nash_type=None):
        if not compromise:
            return {
                "title": "Пояснення рішення",
                "summary": "Система не змогла сформувати пояснення, бо компромісна пара не визначена.",
                "bullets": []
            }

        a_label = compromise.get("partyA_label", "A?")
        b_label = compromise.get("partyB_label", "B?")
        welfare = float(compromise.get("welfare", 0.0)) * 100
        fairness = float(compromise.get("fairness", 0.0)) * 100
        min_gain = float(compromise.get("minimum_gain", 0.0)) * 100
        pareto = bool(compromise.get("is_pareto_optimal"))

        bullets = [
            f"комбінація {a_label} + {b_label} дає збалансований результат для обох сторін",
            f"сумарна корисність рішення становить приблизно {welfare:.1f}%",
            f"баланс інтересів між сторонами становить приблизно {fairness:.1f}%",
            f"мінімальна вигода слабшої сторони не опускається нижче {min_gain:.1f}%"
        ]
        if pareto:
            bullets.append("рішення є Pareto-оптимальним: немає іншої пари, яка покращує одну сторону без погіршення іншої")

        if self.mode == "criteria":
            bullets.append("рекомендація враховує ваги критеріїв, задані окремо для кожної сторони")
        else:
            bullets.append("рекомендація побудована на матриці виграшів, тобто на взаємодії стратегій A і B")

        summary = f"Система рекомендує комбінацію {a_label} + {b_label}, оскільки вона має найкраще співвідношення вигоди та справедливості."

        return {
            "title": "AI-пояснення рішення",
            "summary": summary,
            "bullets": bullets,
            "nash_type": nash_type or "Nash analysis"
        }

    # -------------------------------
    # MAIN ENTRY
    # -------------------------------
    # Головна точка входу: збирає Nash, Pareto, компроміс, heatmap та пояснення в один JSON.
    def find_equilibrium(self):
        A, B = self.build_matrices()
        pure = self.find_pure_nash(A, B)
        compromise = self.recommend_compromise(A, B)
        generated_compromise = self.generate_midpoint_compromise(compromise)
        pareto = self.pareto_analysis(A, B)

        if pure:
            i, j = pure[0]
            return {
                "type": "Pure Nash Equilibrium",
                "mode": self.mode,
                "equilibrium": {"partyA": int(i), "partyB": int(j)},
                "all_equilibria": [{"partyA": int(x), "partyB": int(y)} for x, y in pure],
                "game_value": float(A[i, j] + B[i, j]),
                "strategy_profile": {
                    "partyA": [1.0 if x == i else 0.0 for x in range(A.shape[0])],
                    "partyB": [1.0 if x == j else 0.0 for x in range(A.shape[1])]
                },
                "compromise": compromise,
                "generated_compromise": generated_compromise,
                "pareto": pareto,
                "heatmap": {"matrix_A": A.tolist(), "matrix_B": B.tolist()},
                "ai_explanation": self.generate_ai_explanation(A, B, compromise, nash_type="Pure Nash Equilibrium"),
                "debug": {"payoff_matrix_A": A.tolist(), "payoff_matrix_B": B.tolist()}
            }

        mixed = self.mixed_nash_2x2(A, B)
        if mixed:
            p = np.array(mixed["partyA"])
            q = np.array(mixed["partyB"])
            expected_A = float(p @ A @ q)
            expected_B = float(p @ B @ q)
            return {
                "type": "Mixed Nash Equilibrium",
                "mode": self.mode,
                "equilibrium": None,
                "game_value": expected_A + expected_B,
                "expected_payoff_A": expected_A,
                "expected_payoff_B": expected_B,
                "strategy_profile": mixed,
                "compromise": compromise,
                "generated_compromise": generated_compromise,
                "pareto": pareto,
                "heatmap": {"matrix_A": A.tolist(), "matrix_B": B.tolist()},
                "ai_explanation": self.generate_ai_explanation(A, B, compromise, nash_type="Mixed Nash Equilibrium"),
                "debug": {"payoff_matrix_A": A.tolist(), "payoff_matrix_B": B.tolist()}
            }

        nashpy_profile = self.nashpy_mixed_solver(A, B)
        if nashpy_profile:
            p = np.array(nashpy_profile["partyA"])
            q = np.array(nashpy_profile["partyB"])
            expected_A = float(p @ A @ q)
            expected_B = float(p @ B @ q)
            return {
                "type": "Mixed Nash Equilibrium (Nashpy)",
                "mode": self.mode,
                "solver": nashpy_profile.get("solver"),
                "game_value": expected_A + expected_B,
                "expected_payoff_A": expected_A,
                "expected_payoff_B": expected_B,
                "strategy_profile": {"partyA": nashpy_profile["partyA"], "partyB": nashpy_profile["partyB"]},
                "compromise": compromise,
                "generated_compromise": generated_compromise,
                "pareto": pareto,
                "heatmap": {"matrix_A": A.tolist(), "matrix_B": B.tolist()},
                "ai_explanation": self.generate_ai_explanation(A, B, compromise, nash_type="Nashpy support enumeration"),
                "debug": {"payoff_matrix_A": A.tolist(), "payoff_matrix_B": B.tolist()}
            }

        return {
            "type": "Approximate fallback",
            "mode": self.mode,
            "message": "Nashpy недоступний або не знайшов рівновагу; показано рівномірний профіль.",
            "game_value": float(np.mean(A + B)),
            "strategy_profile": self.uniform_profile(A, B),
            "compromise": compromise,
            "generated_compromise": generated_compromise,
            "pareto": pareto,
            "heatmap": {"matrix_A": A.tolist(), "matrix_B": B.tolist()},
            "ai_explanation": self.generate_ai_explanation(A, B, compromise, nash_type="Approximate fallback"),
            "debug": {"payoff_matrix_A": A.tolist(), "payoff_matrix_B": B.tolist()}
        }
