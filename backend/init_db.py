# =============================================================================
# Negotiation DSS — backend module
# -----------------------------------------------------------------------------
# Цей файл є частиною дипломного проєкту СППР для переговорів.
# Коментарі спеціально зроблені детальними, щоб під час захисту було легко
# пояснити призначення кожного блоку: маршрути Flask, роботу з БД, авторизацію,
# розрахунок Nash equilibrium, компромісні рекомендації та історію користувача.
# =============================================================================

import os
import sqlite3

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "database", "negotiation_dss.db")


# Функція `column_exists` виконує окремий крок backend-логіки або ініціалізації.
def column_exists(cursor, table, column):
    cursor.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cursor.fetchall())


# Функція `init_database` виконує окремий крок backend-логіки або ініціалізації.
def init_database():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'client',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )''')

    cur.execute('''CREATE TABLE IF NOT EXISTS scenarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        json_data TEXT NOT NULL,
        user_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )''')

    # Migration for old DB files.
    if not column_exists(cur, "users", "role"):
        cur.execute("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'client'")
    if not column_exists(cur, "scenarios", "created_at"):
        cur.execute("ALTER TABLE scenarios ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP")

    cur.execute('''CREATE TABLE IF NOT EXISTS analysis_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        mode TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        result_json TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )''')

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

    conn.commit()
    conn.close()
    print(f"DB ready: {DB_PATH}")


if __name__ == "__main__":
    init_database()
