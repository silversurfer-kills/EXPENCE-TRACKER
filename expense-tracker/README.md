# Daily Expense Tracker (Flask + SQLite)

Users create an account, log in, and every expense, budget, saving and goal
is saved to a database automatically after each change.

## Run on your laptop (Windows)

Easiest: double-click `run_site.bat`. The first run sets everything up for you.

Or by hand:

    python -m venv venv
    venv\Scripts\activate
    pip install -r requirements.txt
    python app.py

Open http://127.0.0.1:5000 , click "Create an account", and start adding expenses.

## Files

    app.py               Flask server: signup, login, logout, auto-save API
    requirements.txt     Python packages
    run_site.bat         One-click start for Windows
    templates/
      base.html          Shared page shell (head, stylesheet)
      auth.html          Login / signup page
      tracker.html       Shared layout of the two tracker pages (header, tabs, columns)
      expenses.html      Expenses page: add form, budget, summary, table, calculator
      savings.html       Savings & Goals page
    static/
      style.css          All the styling, in one place
      common.js          Shared by both pages: state, auto-save, small helpers
      expenses.js        Expenses page logic
      calculator.js      The calculator panel
      savings.js         Savings & Goals page logic

Created on first run (never share or commit these, `.gitignore` already skips them):

    tracker.db           SQLite database
    secret.key           Signs login cookies

## How it works (for your viva)

- Passwords are never stored. Only a salted hash (werkzeug generate_password_hash) is saved.
- After login, Flask keeps a signed session cookie so the server knows who you are.
- Every change on a page calls PUT /api/state, which saves that user's data in the
  user_data table. Data is saved instantly, so nothing is lost at the end of the day.
- Each user can only read and write their own row, using the id from their session.
- Forms use a CSRF token, and SQL uses ? placeholders to prevent SQL injection.
- The calculator uses a small hand-written expression parser, not eval().

## Moving your old data over

The database layout is unchanged. Copy `tracker.db` and `secret.key` from the old
`expense_site` folder into this folder and your accounts and data carry over.

## Put it online

1. PythonAnywhere (easiest, free tier): upload these files, create a Flask web app,
   point it to app.py. Files persist, so tracker.db keeps working.
2. Render / Railway: use "gunicorn app:app" as the start command and attach a
   persistent disk, otherwise tracker.db is wiped on every deploy.
3. When online with https, set the environment variable PRODUCTION=1.

## Back up the data daily (optional)

Copy tracker.db somewhere safe, or add a daily scheduled task that copies it
to a folder with today's date.

## Known limits (good "future work" points)

- No password reset or email verification yet.
- No login rate limiting (add Flask-Limiter before a big public launch).
- Each user's data is one JSON record; you could split it into expenses and
  savings tables for reporting.
