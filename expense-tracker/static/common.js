/* Shared by the Expenses and Savings pages.
   Holds the user's data (state), saves it to the server after every change,
   and offers a few small helpers. Exposed as the global `Tracker`. */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const pad = n => String(n).padStart(2, '0');
  const money = n => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  // Create an element with an optional class and text (text is always set safely).
  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // ----- dates -----
  const date = new Date();
  const today = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;   // 2026-11-24
  const thisMonth = today.slice(0, 7);                                                         // 2026-11

  // ----- the user's data, handed over by the server -----
  const state = Object.assign(
    { expenses: [], budgets: {}, savings: [], goals: {}, dailyGoal: 0 },
    JSON.parse($('initial-state').textContent)
  );

  // ----- auto-save: wait 400 ms after the last change, then PUT everything -----
  let saveTimer = null;

  function setStatus(text, bad) {
    const s = $('saveStat');
    s.textContent = text;
    s.classList.toggle('bad', !!bad);
  }

  function save() {
    setStatus('Saving…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(push, 400);
  }

  async function push() {
    saveTimer = null;
    try {
      const res = await fetch('/api/state', {
        method: 'PUT',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      });
      if (res.status === 401) { location.href = '/login'; return; }
      if (!res.ok) throw new Error('save failed');
      setStatus('All changes saved ✓');
    } catch (e) {
      setStatus('Could not save. Check your connection.', true);
    }
  }

  // Do not lose a change that is still waiting when the tab is closed.
  window.addEventListener('pagehide', () => {
    if (saveTimer) { clearTimeout(saveTimer); push(); }
  });
  // Coming back with the Back button: reload so the page shows the latest saved data.
  window.addEventListener('pageshow', e => { if (e.persisted) location.reload(); });

  // ----- shared drawing helpers -----

  // Rows of "label ... amount" with a bar showing each one's share of the total.
  function drawBars(box, entries, emptyText) {
    box.replaceChildren();
    if (!entries.length) { box.append(el('div', 'empty', emptyText)); return; }
    const total = entries.reduce((sum, [, value]) => sum + value, 0);
    for (const [label, value] of entries) {
      const head = el('div', 'cat-head');
      head.append(el('span', '', label), el('b', '', money(value)));
      const fill = el('div', 'bar-fill');
      fill.style.width = (value / total * 100).toFixed(1) + '%';
      const bar = el('div', 'bar');
      bar.append(fill);
      const row = el('div', 'cat');
      row.append(head, bar);
      box.append(row);
    }
  }

  // One table row: text cells, the amount, and a delete button.
  // cells = [[text, className?], ...]
  function addRow(tbody, cells, amount, deleteLabel, onDelete) {
    const tr = el('tr');
    for (const [text, className] of cells) tr.append(el('td', className, text));
    tr.append(el('td', 'amt', money(amount)));
    const btn = el('button', 'del', '✕');
    btn.type = 'button';
    btn.title = 'Delete';
    btn.setAttribute('aria-label', deleteLabel);
    btn.addEventListener('click', onDelete);
    const td = el('td');
    td.append(btn);
    tr.append(td);
    tbody.append(tr);
  }

  window.Tracker = { $, el, money, date, today, thisMonth, state, save, drawBars, addRow };
})();
