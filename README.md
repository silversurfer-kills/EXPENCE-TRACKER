# 💰 Daily Expense Tracker

A small web app for tracking daily spending and saving. Create an account, log your
expenses, set a monthly budget and savings goals, and watch where your money goes.
Everything is saved to a database automatically after each change, so your data is
there on any device you log in from.

Built with **Flask** and **SQLite**. Plain HTML, CSS and JavaScript, no front-end
framework and no build step.

## Features

- **Accounts** – sign up and log in with a username and password. Passwords are never
  stored, only a salted hash. Logins last 30 days.
- **Expenses** – add an expense with a date, amount (₹), category and note. Categories:
  Food, Travel, Shopping, Bills, Health, Entertainment, Other. Filter by month, search by
  category or note, and see totals with a bar for each category.
- **Monthly budget** – set a budget for any month and see how much is left, or how far
  over you are.
- **Savings & Goals** – log savings, set a daily and a monthly goal with progress bars, and
  get a daily spending limit worked out from your budget. One click saves whatever is left
  of today's limit.
- **Calculator** – a built-in calculator panel with a "Use result as amount" button.
- **Auto-save** – there is no save button. A status line shows when changes are saved.
- **Responsive** – works on phones, tablets and desktops.

## Quick start

You need Python 3.9 or newer.

**Windows:** double-click `run_site.bat`. The first run creates the virtual environment and
installs Flask (internet needed once), then opens the site.

**Any system, by hand:**

```bash
python -m venv venv

# Windows:            venv\Scripts\activate
# macOS / Linux:      source venv/bin/activate

pip install -r requirements.txt
python app.py
```

Open <http://127.0.0.1:5000>, click **Create an account**, and add your first expense.

## Project structure

```
expense-tracker/
├── app.py               Flask server: signup, login, logout, auto-save API
├── requirements.txt     Python packages
├── run_site.bat         One-click start for Windows
├── templates/
│   ├── base.html        Page shell (head, stylesheet)
│   ├── auth.html        Login / signup page
│   ├── tracker.html     Layout shared by the two tracker pages (header, tabs, columns)
│   ├── expenses.html    Expenses page: add form, budget, summary, table, calculator
│   └── savings.html     Savings & Goals page
└── static/
    ├── style.css        All the styling, in one file
    ├── common.js        Shared by both pages: data, auto-save, small helpers
    ├── expenses.js      Expenses page logic
    ├── calculator.js    The calculator panel
    └── savings.js       Savings & Goals page logic
```

Two more files are created the first time you run the app. Both are listed in
`.gitignore`, so they are never committed:

- `tracker.db` – the SQLite database
- `secret.key` – the key that signs login cookies

## How it works

- **Passwords** are hashed with a random salt (`werkzeug.security`). The plain password is
  never saved.
- **Sessions:** after login, Flask sets a signed cookie (HttpOnly, SameSite=Lax) so the server
  knows who you are.
- **Saving:** every change calls `PUT /api/state`, which stores that user's data as one JSON
  record in the `user_data` table.
- **Privacy between users:** the server reads the user id from the session, never from the
  request, so each user can only read and write their own row.
- **Forms** carry a CSRF token, and every SQL query uses `?` placeholders to prevent SQL
  injection.
- **Requests** bigger than 2 MB are rejected.
- **The calculator** uses a small hand-written expression parser. It never runs what you
  type as code.

## Configuration

Both settings are optional environment variables.

| Variable     | Purpose                                                                         |
|--------------|---------------------------------------------------------------------------------|
| `SECRET_KEY` | Signs login cookies. If not set, a random key is created once in `secret.key`.  |
| `PRODUCTION` | Set to `1` when the site is served over HTTPS, so cookies are sent only securely. |

## Putting it online

1. **PythonAnywhere** (easiest, free tier): upload the files, create a Flask web app and point
   it to `app.py`. Files persist, so `tracker.db` keeps working.
2. **Render / Railway:** use `gunicorn app:app` as the start command and attach a persistent
   disk. Without one, `tracker.db` is wiped on every deploy.
3. When the site is on HTTPS, set `PRODUCTION=1`.

## Backups

Everything lives in `tracker.db`. Copy it somewhere safe now and then, or schedule a daily
copy into a dated folder. Keep `secret.key` with it if you want existing logins to stay valid.

## Known limitations

- No password reset or email verification yet.
- No login rate limiting. Add Flask-Limiter before a big public launch.
- Each user's data is stored as one JSON record. Splitting it into separate expenses and
  savings tables would make reporting easier.
- Amounts are in rupees (₹) only.
