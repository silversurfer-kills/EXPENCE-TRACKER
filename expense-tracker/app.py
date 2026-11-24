"""
Daily Expense Tracker - Flask backend

- Users sign up / log in with a username and password (only a salted hash is stored)
- Each user's expenses, budgets, savings and goals are kept in one JSON record in SQLite
- The pages auto-save to the database after every change (PUT /api/state)
"""
import copy
import json
import os
import re
import secrets
import sqlite3
from datetime import timedelta
from functools import wraps

from flask import (Flask, abort, g, jsonify, redirect, render_template,
                   request, session, url_for)
from werkzeug.security import check_password_hash, generate_password_hash

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "tracker.db")
KEY_PATH = os.path.join(BASE_DIR, "secret.key")

# What every user's saved record looks like. The browser sends this shape back on each save.
DEFAULT_DATA = {"expenses": [], "budgets": {}, "savings": [], "goals": {}, "dailyGoal": 0}

USERNAME_RE = re.compile(r"[a-z0-9_]{3,30}")
MIN_PASSWORD_LENGTH = 8


# ---------- app setup ----------
def load_secret_key():
    """Use SECRET_KEY from the environment, else create one once and keep it in secret.key."""
    key = os.environ.get("SECRET_KEY")
    if key:
        return key
    if not os.path.exists(KEY_PATH):
        with open(KEY_PATH, "w") as f:
            f.write(secrets.token_hex(32))
    with open(KEY_PATH) as f:
        return f.read().strip()


app = Flask(__name__)
app.secret_key = load_secret_key()
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.environ.get("PRODUCTION") == "1",  # set PRODUCTION=1 when on https
    PERMANENT_SESSION_LIFETIME=timedelta(days=30),
    MAX_CONTENT_LENGTH=2 * 1024 * 1024,  # reject requests bigger than 2 MB
)


# ---------- database ----------
def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_exc=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    with sqlite3.connect(DB_PATH) as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                username      TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at    TEXT DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS user_data (
                user_id    INTEGER PRIMARY KEY REFERENCES users(id),
                data       TEXT NOT NULL,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            """
        )


init_db()


# ---------- helpers ----------
def csrf_token():
    if "csrf" not in session:
        session["csrf"] = secrets.token_hex(16)
    return session["csrf"]


app.jinja_env.globals["csrf_token"] = csrf_token


def check_csrf():
    sent = request.form.get("csrf", "")
    if not secrets.compare_digest(sent, session.get("csrf", "")):
        abort(400, "Invalid form token. Go back and try again.")


def login_required(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        if "uid" not in session:
            if request.path.startswith("/api/"):
                return jsonify(error="not logged in"), 401
            return redirect(url_for("login"))
        return view(*args, **kwargs)

    return wrapper


def start_session(user_id, username):
    session.clear()
    session.permanent = True
    session["uid"], session["username"] = user_id, username


def clean_data(raw):
    """Keep only the fields we expect, with the right types. Returns None if the data is bad."""
    if not isinstance(raw, dict):
        return None
    out = {}
    for key, default in DEFAULT_DATA.items():
        val = raw.get(key, default)
        if isinstance(default, list) and not (isinstance(val, list) and all(isinstance(x, dict) for x in val)):
            return None
        if isinstance(default, dict) and not isinstance(val, dict):
            return None
        out[key] = val
    return out


def load_user_data():
    row = get_db().execute("SELECT data FROM user_data WHERE user_id = ?", (session["uid"],)).fetchone()
    return json.loads(row["data"]) if row else copy.deepcopy(DEFAULT_DATA)


# ---------- pages ----------
@app.route("/")
@login_required
def index():
    return render_template("expenses.html", username=session["username"], data=load_user_data())


@app.route("/savings")
@login_required
def savings():
    return render_template("savings.html", username=session["username"], data=load_user_data())


@app.route("/signup", methods=["GET", "POST"])
def signup():
    error = None
    if request.method == "POST":
        check_csrf()
        username = request.form.get("username", "").strip().lower()
        password = request.form.get("password", "")
        confirm = request.form.get("confirm", "")
        if not USERNAME_RE.fullmatch(username):
            error = "Username must be 3-30 characters: letters, numbers or underscore."
        elif len(password) < MIN_PASSWORD_LENGTH:
            error = f"Password must be at least {MIN_PASSWORD_LENGTH} characters."
        elif password != confirm:
            error = "Passwords do not match."
        else:
            db = get_db()
            try:
                cur = db.execute(
                    "INSERT INTO users (username, password_hash) VALUES (?, ?)",
                    (username, generate_password_hash(password)),
                )
                db.execute("INSERT INTO user_data (user_id, data) VALUES (?, ?)",
                           (cur.lastrowid, json.dumps(DEFAULT_DATA)))
                db.commit()
            except sqlite3.IntegrityError:
                error = "That username is already taken."
            else:
                start_session(cur.lastrowid, username)
                return redirect(url_for("index"))
    return render_template("auth.html", mode="signup", error=error)


@app.route("/login", methods=["GET", "POST"])
def login():
    error = None
    if request.method == "POST":
        check_csrf()
        username = request.form.get("username", "").strip().lower()
        password = request.form.get("password", "")
        user = get_db().execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
        if user and check_password_hash(user["password_hash"], password):
            start_session(user["id"], user["username"])
            return redirect(url_for("index"))
        error = "Wrong username or password."
    return render_template("auth.html", mode="login", error=error)


@app.route("/logout", methods=["POST"])
def logout():
    check_csrf()
    session.clear()
    return redirect(url_for("login"))


# ---------- API: auto-save ----------
@app.route("/api/state", methods=["PUT"])
@login_required
def save_state():
    data = clean_data(request.get_json(silent=True))
    if data is None:
        return jsonify(error="bad data"), 400
    db = get_db()
    db.execute(
        """INSERT INTO user_data (user_id, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP""",
        (session["uid"], json.dumps(data)),
    )
    db.commit()
    return jsonify(ok=True)


if __name__ == "__main__":
    app.run(debug=False, port=5000)
