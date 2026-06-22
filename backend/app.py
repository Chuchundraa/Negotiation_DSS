# =============================================================================
# Negotiation DSS — backend module
# -----------------------------------------------------------------------------
# Цей файл є частиною дипломного проєкту СППР для переговорів.
# Коментарі спеціально зроблені детальними, щоб під час захисту було легко
# пояснити призначення кожного блоку: маршрути Flask, роботу з БД, авторизацію,
# розрахунок Nash equilibrium, компромісні рекомендації та історію користувача.
# =============================================================================

# Flask відповідає за HTTP API, сесії, JSON-відповіді та роздачу frontend-файлів.
from flask import Flask, request, jsonify, session, send_from_directory
from flask_cors import CORS
import os
import sqlite3
import bcrypt

try:
    import jwt
except ImportError:  # PyJWT optional for local dev
    jwt = None

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
except ImportError:
    canvas = None
    A4 = None
import json
import uuid
import datetime
import io
import base64

from services.game_engine import GameEngine
from services.presets.hr_preset import HR_PRESET
from services.presets.procurement_preset import PROCUREMENT_PRESET
from services.presets.business_preset import BUSINESS_PRESET

EXAMPLES = {
    "hr": HR_PRESET,
    "procurement": PROCUREMENT_PRESET,
    "business": BUSINESS_PRESET,
}

# Абсолютні шляхи потрібні, щоб проєкт однаково запускався з VS Code, PowerShell або Docker.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")
DB_PATH = os.path.join(BASE_DIR, "database", "negotiation_dss.db")

# Flask одночасно працює як API-сервер і як сервер статичних frontend-файлів.
app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
CORS(app, supports_credentials=True)
app.secret_key = os.environ.get("NEGOTIATION_DSS_SECRET", "dev_secret_key_change_later")
JWT_SECRET = os.environ.get("NEGOTIATION_DSS_JWT_SECRET", app.secret_key)
JWT_ALGORITHM = "HS256"


def create_access_token(user_id, username, role):
    if jwt is None:
        return None
    payload = {
        "sub": str(user_id),
        "username": username,
        "role": role,
        "iat": datetime.datetime.utcnow(),
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=8),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def current_role():
    return session.get("role", "client")


# Створює підключення до SQLite та повертає рядки як словники для зручної роботи з JSON.
def get_db_connection():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def ensure_database_schema():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'client',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )""")
    cur.execute("""CREATE TABLE IF NOT EXISTS scenarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        json_data TEXT NOT NULL,
        user_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )""")
    cur.execute("""CREATE TABLE IF NOT EXISTS analysis_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        mode TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        result_json TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )""")
    cur.execute("""CREATE TABLE IF NOT EXISTS shared_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        share_code TEXT UNIQUE NOT NULL,
        owner_user_id INTEGER,
        title TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_user_id) REFERENCES users(id)
    )""")

    cur.execute("""CREATE TABLE IF NOT EXISTS user_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        criterion_id TEXT NOT NULL,
        criterion_name TEXT NOT NULL,
        accumulated_weight REAL DEFAULT 0,
        usage_count INTEGER DEFAULT 0,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, criterion_id),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )""")
    # Lightweight migration for older SQLite DB files
    cols = [r[1] for r in cur.execute("PRAGMA table_info(users)").fetchall()]
    if "role" not in cols:
        cur.execute("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'client'")
    conn.commit()
    conn.close()


def save_analysis_history(payload, result):
    """Save each analysis for logged-in users."""
    if "user_id" not in session:
        return

    mode = payload.get("mode", "criteria")
    title = "Матриця виграшів" if mode == "matrix" else "Критерійний сценарій"

    comp = result.get("compromise") or {}
    if comp:
        title += f" — компроміс {comp.get('partyA_label', 'A?')} + {comp.get('partyB_label', 'B?')}"

    conn = get_db_connection()
    try:
        conn.execute(
            """
            INSERT INTO analysis_history (user_id, title, mode, payload_json, result_json)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                session["user_id"],
                title,
                mode,
                json.dumps(payload, ensure_ascii=False),
                json.dumps(result, ensure_ascii=False),
            ),
        )
        # Update adaptive-weight profile from criteria-mode analyses
        if mode != "matrix":
            criteria = {c.get("id"): c.get("name", c.get("id")) for c in payload.get("criteria", [])}
            weights = {}
            for side in ("partyA", "partyB"):
                for cid, w in (payload.get(side, {}).get("weights", {}) or {}).items():
                    try:
                        weights[cid] = weights.get(cid, 0.0) + float(w) / 2.0
                    except Exception:
                        pass
            for cid, w in weights.items():
                cname = criteria.get(cid, cid)
                conn.execute("""
                    INSERT INTO user_preferences (user_id, criterion_id, criterion_name, accumulated_weight, usage_count)
                    VALUES (?, ?, ?, ?, 1)
                    ON CONFLICT(user_id, criterion_id) DO UPDATE SET
                        accumulated_weight = accumulated_weight + excluded.accumulated_weight,
                        usage_count = usage_count + 1,
                        updated_at = CURRENT_TIMESTAMP
                """, (session["user_id"], cid, cname, w))
        conn.commit()
    finally:
        conn.close()


# Головний маршрут: відкриває index.html з frontend-папки.
@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(FRONTEND_DIR, path)


@app.route("/api/analyze", methods=["POST"])
def analyze_game():
    data = request.get_json(silent=True) or {}
    print("DEBUG_DATA:", data)
    try:
        engine = GameEngine(data)
        result = engine.find_equilibrium()
        save_analysis_history(data, result)
        return jsonify(result)
    except Exception as e:
        print("DEBUG_ERROR:", e)
        return jsonify({"error": str(e)}), 400


@app.route("/api/examples/<domain>", methods=["GET"])
def get_example(domain):
    example = EXAMPLES.get(domain)
    if not example:
        return jsonify({"error": f"Шаблон '{domain}' не знайдено"}), 404
    return jsonify(example)


@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    if not username or not password:
        return jsonify({"error": "Логін та пароль не можуть бути порожніми"}), 400

    hashed_password = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    role = "admin" if username.lower() == "admin" else "client"
    conn = get_db_connection()
    try:
        conn.execute("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", (username, hashed_password, role))
        conn.commit()
        return jsonify({"success": "Користувача успішно зареєстровано!"}), 201
    except sqlite3.IntegrityError:
        return jsonify({"error": "Такий логін уже зайнятий"}), 400
    finally:
        conn.close()


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()

    conn = get_db_connection()
    user = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()

    if user and bcrypt.checkpw(password.encode("utf-8"), user["password_hash"].encode("utf-8")):
        session["user_id"] = user["id"]
        session["username"] = user["username"]
        session["role"] = user["role"] if "role" in user.keys() else "client"
        token = create_access_token(user["id"], user["username"], session["role"])
        return jsonify({"success": "Вхід успішний", "username": user["username"], "role": session["role"], "access_token": token})
    return jsonify({"error": "Неправильний логін або пароль"}), 401


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"success": "Вихід успішний"})


@app.route("/api/auth/me", methods=["GET"])
def current_user():
    if "user_id" not in session:
        return jsonify({"authenticated": False})
    return jsonify({"authenticated": True, "username": session.get("username"), "role": current_role()})


@app.route("/api/scenarios", methods=["POST"])
def save_scenario():
    if "user_id" not in session:
        return jsonify({"error": "Дія неможлива. Будь ласка, увійдіть в систему"}), 401

    data = request.get_json(silent=True) or {}
    title = data.get("title", "Новий сценарій переговорів").strip()
    json_str = data.get("json_data")
    if not json_str:
        return jsonify({"error": "Дані сценарію порожні"}), 400

    conn = get_db_connection()
    try:
        conn.execute(
            "INSERT INTO scenarios (title, json_data, user_id) VALUES (?, ?, ?)",
            (title, json_str, session["user_id"]),
        )
        conn.commit()
        return jsonify({"success": "Сценарій успішно збережено в SQLite"})
    except Exception as e:
        return jsonify({"error": f"Помилка БД: {str(e)}"}), 500
    finally:
        conn.close()


@app.route("/api/scenarios", methods=["GET"])
def get_saved_scenarios():
    if "user_id" not in session:
        return jsonify([])
    conn = get_db_connection()
    rows = conn.execute(
        "SELECT id, title, json_data FROM scenarios WHERE user_id = ? ORDER BY id DESC",
        (session["user_id"],),
    ).fetchall()
    conn.close()
    return jsonify([{k: row[k] for k in row.keys()} for row in rows])


@app.route("/api/history", methods=["GET"])
def get_analysis_history():
    if "user_id" not in session:
        return jsonify([])

    conn = get_db_connection()
    rows = conn.execute(
        """
        SELECT id, title, mode, payload_json, result_json, created_at
        FROM analysis_history
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT 50
        """,
        (session["user_id"],),
    ).fetchall()
    conn.close()
    return jsonify([{k: row[k] for k in row.keys()} for row in rows])


@app.route("/api/history/<int:item_id>", methods=["DELETE"])
def delete_history_item(item_id):
    if "user_id" not in session:
        return jsonify({"error": "Потрібно увійти в систему"}), 401

    conn = get_db_connection()
    conn.execute("DELETE FROM analysis_history WHERE id = ? AND user_id = ?", (item_id, session["user_id"]))
    conn.commit()
    conn.close()
    return jsonify({"success": "Запис історії видалено"})


@app.route("/api/shared", methods=["POST"])
def create_shared_session():
    data = request.get_json(silent=True) or {}
    payload = data.get("payload") or {}
    title = (data.get("title") or "Спільна переговорна сесія").strip()
    code = uuid.uuid4().hex[:8].upper()
    owner_id = session.get("user_id")

    conn = get_db_connection()
    try:
        conn.execute(
            """
            INSERT INTO shared_sessions (share_code, owner_user_id, title, payload_json)
            VALUES (?, ?, ?, ?)
            """,
            (code, owner_id, title, json.dumps(payload, ensure_ascii=False)),
        )
        conn.commit()
        return jsonify({"success": True, "share_code": code, "title": title})
    finally:
        conn.close()


@app.route("/api/shared/<code>", methods=["GET"])
def get_shared_session(code):
    conn = get_db_connection()
    row = conn.execute(
        "SELECT share_code, title, payload_json, created_at, updated_at FROM shared_sessions WHERE share_code = ?",
        (code.upper(),),
    ).fetchone()
    conn.close()

    if not row:
        return jsonify({"error": "Спільну сесію не знайдено"}), 404

    return jsonify({k: row[k] for k in row.keys()})


@app.route("/api/shared/<code>", methods=["PUT"])
def update_shared_session(code):
    data = request.get_json(silent=True) or {}
    payload = data.get("payload") or {}

    conn = get_db_connection()
    cur = conn.execute(
        """
        UPDATE shared_sessions
        SET payload_json = ?, updated_at = CURRENT_TIMESTAMP
        WHERE share_code = ?
        """,
        (json.dumps(payload, ensure_ascii=False), code.upper()),
    )
    conn.commit()
    conn.close()

    if cur.rowcount == 0:
        return jsonify({"error": "Спільну сесію не знайдено"}), 404

    return jsonify({"success": True, "share_code": code.upper()})


@app.route("/api/analytics", methods=["GET"])
def analytics_dashboard():
    if "user_id" not in session:
        return jsonify({"error": "Потрібно увійти в систему"}), 401

    conn = get_db_connection()
    rows = conn.execute(
        "SELECT mode, result_json, created_at FROM analysis_history WHERE user_id = ? ORDER BY id DESC LIMIT 200",
        (session["user_id"],),
    ).fetchall()
    pref_rows = conn.execute(
        "SELECT criterion_id, criterion_name, accumulated_weight, usage_count FROM user_preferences WHERE user_id = ? ORDER BY accumulated_weight DESC",
        (session["user_id"],),
    ).fetchall()
    conn.close()

    total = len(rows)
    wins = {"partyA": {}, "partyB": {}}
    compromise_scores = []
    modes = {}

    for row in rows:
        modes[row["mode"]] = modes.get(row["mode"], 0) + 1
        try:
            result = json.loads(row["result_json"])
        except Exception:
            continue
        profile = result.get("strategy_profile") or {}
        for party in ("partyA", "partyB"):
            probs = profile.get(party) or []
            if probs:
                idx = int(max(range(len(probs)), key=lambda i: probs[i]))
                wins[party][str(idx + 1)] = wins[party].get(str(idx + 1), 0) + 1
        comp = result.get("compromise") or {}
        if comp.get("compromise_score") is not None:
            compromise_scores.append(float(comp.get("compromise_score")))

    important = []
    for r in pref_rows:
        count = max(int(r["usage_count"] or 1), 1)
        important.append({
            "criterion_id": r["criterion_id"],
            "criterion_name": r["criterion_name"],
            "average_weight": float(r["accumulated_weight"] or 0) / count,
            "usage_count": count,
        })

    return jsonify({
        "total_analyses": total,
        "modes": modes,
        "average_compromise_score": (sum(compromise_scores) / len(compromise_scores)) if compromise_scores else 0,
        "winning_frequency": wins,
        "important_criteria": important[:10],
        "role": current_role(),
    })


@app.route("/api/adaptive-weights", methods=["POST"])
def adaptive_weights():
    if "user_id" not in session:
        return jsonify({"error": "Потрібно увійти в систему"}), 401

    payload = request.get_json(silent=True) or {}
    criteria = payload.get("criteria", []) or []
    if not criteria:
        return jsonify({"suggestions": [], "weights": {}})

    conn = get_db_connection()
    rows = conn.execute(
        "SELECT criterion_id, criterion_name, accumulated_weight, usage_count FROM user_preferences WHERE user_id = ?",
        (session["user_id"],),
    ).fetchall()
    conn.close()

    historical = {r["criterion_id"]: float(r["accumulated_weight"] or 0) / max(int(r["usage_count"] or 1), 1) for r in rows}
    base = 1 / len(criteria)
    raw = {}
    suggestions = []
    for c in criteria:
        cid = c.get("id")
        if not cid:
            continue
        hist = historical.get(cid, base)
        value = 0.55 * base + 0.45 * hist
        raw[cid] = max(value, 0.01)
        if hist > base * 1.15:
            suggestions.append({
                "criterion_id": cid,
                "criterion_name": c.get("name", cid),
                "message": f"Користувач часто надає високу важливість критерію «{c.get('name', cid)}». Рекомендовано трохи підвищити його вагу.",
            })

    total = sum(raw.values()) or 1
    weights = {k: v / total for k, v in raw.items()}
    return jsonify({"weights": weights, "suggestions": suggestions})


@app.route("/api/export/pdf", methods=["POST"])
def export_pdf():
    data = request.get_json(silent=True) or {}
    payload = data.get("payload") or {}
    result = data.get("result") or {}

    if canvas is None:
        return jsonify({"error": "Для PDF встанови reportlab: pip install reportlab"}), 500

    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 50

    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(50, y, "Negotiation DSS Report")
    y -= 30
    pdf.setFont("Helvetica", 10)
    pdf.drawString(50, y, f"Mode: {payload.get('mode', 'criteria')}")
    y -= 20
    pdf.drawString(50, y, f"Result type: {result.get('type', '-')}")
    y -= 20
    pdf.drawString(50, y, f"Game value: {result.get('game_value', 0)}")
    y -= 30

    comp = result.get("compromise") or {}
    if comp:
        pdf.setFont("Helvetica-Bold", 12)
        pdf.drawString(50, y, "Recommended compromise")
        y -= 18
        pdf.setFont("Helvetica", 10)
        for line in [
            f"Pair: {comp.get('partyA_label', '-')} + {comp.get('partyB_label', '-')}",
            f"Payoff A: {comp.get('payoff_A', '-')}",
            f"Payoff B: {comp.get('payoff_B', '-')}",
            f"Score: {comp.get('compromise_score', '-')}",
        ]:
            pdf.drawString(60, y, line[:95])
            y -= 16

    pdf.setFont("Helvetica-Bold", 12)
    y -= 8
    pdf.drawString(50, y, "Strategy profile")
    y -= 18
    pdf.setFont("Helvetica", 10)
    profile = result.get("strategy_profile") or {}
    pdf.drawString(60, y, f"Party A: {profile.get('partyA', [])}")
    y -= 16
    pdf.drawString(60, y, f"Party B: {profile.get('partyB', [])}")

    pdf.showPage()
    pdf.save()
    buffer.seek(0)
    encoded = base64.b64encode(buffer.read()).decode("utf-8")
    return jsonify({"filename": "negotiation_report.pdf", "content_base64": encoded})


if __name__ == "__main__":
    ensure_database_schema()
    app.run(debug=True, port=5000)
